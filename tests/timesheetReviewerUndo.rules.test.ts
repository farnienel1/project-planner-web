/**
 * Rulebook 1.90.0 §8 (owner 24 Nov): "Cancel changes" — the line manager's undo of their own booking edits uses the
 * writes the rules already allow (no rules change): putting a booking's times back is the 1.29.0 / 1.72.0 line-manager
 * update; a removed booking is re-created under a NEW id by someone who may book the job (an admin or the job's
 * manager) — never under its tombstoned id, admins included; a line manager who does not manage the job cannot
 * re-create it (the app reports that booking as not undone). Emulator only.
 *
 *   RULES_PORT=8080 npx tsx --test tests/timesheetReviewerUndo.rules.test.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { collection, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { cancelTimesheetReviewerChanges } from '../lib/timesheets/timesheetReviewerUndoWrite.ts'
import { timesheetReviewerEditBefore, timesheetReviewerUndoPlan } from '../lib/canonical/timesheetReviewerUndo.ts'
import { signedTimesheetBookingPlace, timesheetReviewBookingDocument, timesheetReviewerBookingFingerprint } from '../lib/canonical/index.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-undo'
const ADMIN = 'undo-admin'
const LM = 'undo-lm'
const JM = 'undo-jm'
const OP = 'undo-op'
const DAY = Timestamp.fromMillis(Date.parse('2026-11-16T00:00:00Z'))
const SHEET = `timesheet_${OP}_1763251200`
const SIGNED = Timestamp.fromMillis(Date.parse('2026-11-17T10:00:00Z'))
const COUNTER = Timestamp.fromMillis(Date.parse('2026-11-17T12:00:00Z'))

let env: RulesTestEnvironment

async function db(uid: string): Promise<Firestore> {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

function labour(id: string, end: string) {
  return {
    id, operativeId: OP, projectId: 'job1', jobCollection: 'projects', date: DAY,
    timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: end, isBreakRemoved: false,
    status: 'Confirmed', bookedBy: 'Ada', organizationId: ORG, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  }
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-ts-undo',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT || 8080) },
  })
})

test.beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG), { name: 'Undo Co', creatorUserId: ADMIN, members: { [ADMIN]: 'admin', [LM]: 'manager', [JM]: 'manager', [OP]: 'operative' } })
    const user = (id: string, fields: Record<string, unknown>) =>
      setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, passwordSet: true, isActive: true, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(LM, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(JM, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(OP, { role: 'operative', operativeMode: true, assignedManagerUserIds: [LM] })
    await setDoc(doc(d, 'organizations', ORG, 'projects', 'job1'), { name: 'Riverside', managerUserIds: [JM], managerIds: [JM] })
    // B1 was edited by LM from the review (16:00 → 19:00); B2 was removed by LM (tombstoned).
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'B1'), labour('B1', '19:00'))
    await setDoc(doc(d, 'organizations', ORG, 'deletedBookings', 'B2'), { bookingId: 'B2', collection: 'bookings', deletedAt: Timestamp.now(), deletedBy: LM, deletedFrom: 'web' })
    await setDoc(doc(d, 'organizations', ORG, 'settings', SHEET), { userId: OP, weekStartKey: '2026-11-16', operativeSignedAt: SIGNED, managerSignedAt: COUNTER })
  })
})

test.after(async () => {
  await env?.cleanup()
})

test('the line manager puts the booking times back with the sheet record removed, in one batch', async () => {
  const left = timesheetReviewBookingDocument({ collection: 'bookings', id: 'B1', data: labour('B1', '19:00'), timeZone: 'Europe/London' })
  if (!left) throw new Error('no doc')
  const plan = timesheetReviewerUndoPlan({
    sheet: {
      operativeSignedAt: SIGNED.toMillis(),
      managerSignedAt: COUNTER.toMillis(),
      reviewerBookingEdits: {
        bookings__b1: {
          bookingId: 'B1', collection: 'bookings', deleted: false, editedBy: LM, place: signedTimesheetBookingPlace(left),
          fingerprint: timesheetReviewerBookingFingerprint(left),
          forSignedAtMs: SIGNED.toMillis(), forManagerSignedAtMs: COUNTER.toMillis(),
          before: timesheetReviewerEditBefore({ data: labour('B1', '16:00'), deleted: false }),
        },
      },
    },
    bookings: [{ collection: 'bookings', bookingId: 'B1', data: labour('B1', '19:00') }],
    timeZone: 'Europe/London',
  })
  const restore = plan.actions.find((a) => a.kind === 'restore')
  if (!restore || restore.kind !== 'restore') throw new Error(`no restore: ${JSON.stringify(plan.actions)}`)
  const d = await db(LM)
  const batch = writeBatch(d)
  batch.update(doc(d, 'organizations', ORG, 'bookings', 'B1'), { ...restore.set, updatedAt: serverTimestamp(), updatedBy: LM, updatedFrom: 'web' })
  batch.update(doc(d, 'organizations', ORG, 'settings', SHEET), { 'reviewerBookingEdits.bookings__b1': deleteField(), updatedAt: serverTimestamp(), updatedBy: LM, updatedFrom: 'web' })
  await assertSucceeds(batch.commit())
})

test('a removed booking is never re-created under its tombstoned id, admins included', async () => {
  await assertFails(setDoc(doc(await db(ADMIN), 'organizations', ORG, 'bookings', 'B2'), labour('B2', '12:00')))
  await assertFails(setDoc(doc(await db(JM), 'organizations', ORG, 'bookings', 'B2'), labour('B2', '12:00')))
})

test('the job manager and an admin re-create it under a new id; a line manager who does not manage the job cannot', async () => {
  await assertSucceeds(setDoc(doc(await db(JM), 'organizations', ORG, 'bookings', 'B2NEW'), { ...labour('B2NEW', '12:00'), createdAt: serverTimestamp() }))
  await assertSucceeds(setDoc(doc(await db(ADMIN), 'organizations', ORG, 'bookings', 'B2NEW2'), { ...labour('B2NEW2', '12:00'), createdAt: serverTimestamp() }))
  await assertFails(setDoc(doc(await db(LM), 'organizations', ORG, 'bookings', 'B2NEW3'), { ...labour('B2NEW3', '12:00'), createdAt: serverTimestamp() }))
})

test('the job manager re-creates with the two sheet records in one batch', async () => {
  const d = await db(JM)
  const batch = writeBatch(d)
  batch.set(doc(d, 'organizations', ORG, 'bookings', 'B2R'), { ...labour('B2R', '12:00'), createdAt: serverTimestamp() })
  batch.update(doc(d, 'organizations', ORG, 'settings', SHEET), {
    'reviewerBookingEdits.bookings__b2': { bookingId: 'B2', collection: 'bookings', deleted: true, restoredAs: 'B2R' },
    'reviewerBookingEdits.bookings__b2r': { bookingId: 'B2R', collection: 'bookings', deleted: false, restoredFrom: 'B2' },
    updatedAt: serverTimestamp(), updatedBy: JM, updatedFrom: 'web',
  })
  // JM is not OP's line manager: the sheet write is refused, so the whole batch is (the app then reports the booking).
  await assertFails(batch.commit())
  const a = await db(ADMIN)
  const b2 = writeBatch(a)
  b2.set(doc(a, 'organizations', ORG, 'bookings', 'B2R'), { ...labour('B2R', '12:00'), createdAt: serverTimestamp() })
  b2.update(doc(a, 'organizations', ORG, 'settings', SHEET), {
    'reviewerBookingEdits.bookings__b2r': { bookingId: 'B2R', collection: 'bookings', deleted: false, restoredFrom: 'B2' },
    updatedAt: serverTimestamp(), updatedBy: ADMIN, updatedFrom: 'web',
  })
  await assertSucceeds(b2.commit())
})

test('the person never writes the reviewer records (no forged before-values)', async () => {
  await assertFails(updateDoc(doc(await db(OP), 'organizations', ORG, 'settings', SHEET), { 'reviewerBookingEdits.review__extra__e1': { kind: 'extraReview', entryId: 'e1', before: { decision: 'edited', revisedAmount: 9999 } } }))
})

// Review of #457 (finding 4): the web Cancel changes writer runs each undo in a transaction that re-reads the sheet,
// the booking and its tombstone — two runs at once re-create a removed booking once, and a booking changed since the
// plan was made is left as it is.
test('Cancel changes in a transaction: two runs at once re-create a removed booking once; a later change is never overwritten', async () => {
  const left = timesheetReviewBookingDocument({ collection: 'bookings', id: 'B1', data: labour('B1', '19:00'), timeZone: 'Europe/London' })
  if (!left) throw new Error('no doc')
  const fixed = { forSignedAtMs: SIGNED.toMillis(), forManagerSignedAtMs: COUNTER.toMillis(), editedBy: ADMIN }
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await updateDoc(doc(d, 'organizations', ORG, 'settings', SHEET), {
      'reviewerBookingEdits.bookings__b1': {
        bookingId: 'B1', collection: 'bookings', deleted: false, place: signedTimesheetBookingPlace(left),
        fingerprint: timesheetReviewerBookingFingerprint(left), ...fixed,
        before: timesheetReviewerEditBefore({ data: labour('B1', '16:00'), deleted: false }),
      },
      'reviewerBookingEdits.bookings__b2': {
        bookingId: 'B2', collection: 'bookings', deleted: true, fingerprint: '', place: '', ...fixed,
        before: timesheetReviewerEditBefore({ data: labour('B2', '12:00'), deleted: true }),
      },
    })
    // Someone else changes B1 again after the reviewer: Cancel changes must leave it.
    await updateDoc(doc(d, 'organizations', ORG, 'bookings', 'B1'), { workEndTime: '20:00' })
  })
  const a = await db(ADMIN)
  const [first, second] = await Promise.all([
    cancelTimesheetReviewerChanges(a, { organizationId: ORG, userId: ADMIN, documentId: SHEET, timeZone: 'Europe/London' }),
    cancelTimesheetReviewerChanges(a, { organizationId: ORG, userId: ADMIN, documentId: SHEET, timeZone: 'Europe/London' }),
  ])
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    const all = await getDocs(collection(d, 'organizations', ORG, 'bookings'))
    const recreated = all.docs.filter((d) => d.id !== 'B1')
    if (recreated.length !== 1) throw new Error(`expected one re-created booking, got ${recreated.length}`)
    const data = recreated[0].data()
    if (data.operativeId !== OP || data.projectId !== 'job1' || !data.date) throw new Error(`re-created booking is incomplete: ${JSON.stringify(data)}`)
    const b1 = (await getDoc(doc(d, 'organizations', ORG, 'bookings', 'B1'))).data()
    if (b1?.workEndTime !== '20:00') throw new Error('a later change was overwritten')
  })
  const refusedB1 = [...first.refused, ...second.refused].filter((r) => r.bookingId === 'B1')
  if (refusedB1.length === 0) throw new Error('the changed booking was not reported')
})
