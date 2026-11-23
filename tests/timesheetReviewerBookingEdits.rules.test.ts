/**
 * Rulebook 1.74.0 §8, §16 (owner decision 23 Nov): the line manager's ⚙ / ✕ from a timesheet's review is recorded on the
 * sheet (`reviewerBookingEdits.{key}`) in the same batch as the booking write, so the sheet stays with the reviewer.
 * These tests prove: the person's line manager (and an admin) may write the booking and the record in one batch; the
 * person never writes `reviewerBookingEdits` on their own sheet (any value, even an empty map); an exported sheet stays
 * frozen (the batch is refused whole, so the booking is not changed either). Emulator only (own project id).
 *
 *   RULES_PORT=8080 npx tsx --test tests/timesheetReviewerBookingEdits.rules.test.ts   (with the Firestore emulator running)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { doc, FieldPath, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { timesheetReviewBookingAfterEdit, timesheetReviewBookingDocument, timesheetReviewBookingEditWrites } from '../lib/canonical/timesheetReviewBookingWrites.ts'
import { timesheetReviewerBookingEditRecord } from '../lib/canonical/timesheetBookingChanges.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-rbe'
const ADMIN = 'rbe-admin'
const LM = 'rbe-lm'
const OP = 'rbe-op'
const SHEET = `timesheet_${OP}_1762300800`
const DAY = Timestamp.fromMillis(Date.parse('2026-11-16T00:00:00Z'))
const SIGNED = Timestamp.fromMillis(Date.parse('2026-11-17T09:00:00Z'))

let env: RulesTestEnvironment

async function db(uid: string): Promise<Firestore> {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

function labour(id: string) {
  return {
    id, operativeId: OP, projectId: 'job1', jobCollection: 'projects', date: DAY,
    timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '16:00', isBreakRemoved: false,
    status: 'Confirmed', bookedBy: 'Ada', organizationId: ORG, createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  }
}

async function seed(sheetExtra: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG), {
      name: 'Review Co', creatorUserId: ADMIN, members: { [ADMIN]: 'admin', [LM]: 'manager', [OP]: 'operative' },
    })
    const user = (id: string, fields: Record<string, unknown>) =>
      setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, passwordSet: true, isActive: true, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(LM, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(OP, { role: 'operative', operativeMode: true, assignedManagerUserIds: [LM] })
    await setDoc(doc(d, 'organizations', ORG, 'projects', 'job1'), { name: 'Riverside', managerUserIds: [ADMIN], managerIds: [ADMIN] })
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'B1'), labour('B1'))
    await setDoc(doc(d, 'organizations', ORG, 'settings', SHEET), {
      userId: OP, weekStart: DAY, weekStartKey: '2026-11-16', weekEnd: DAY, weekEndKey: '2026-11-30',
      operativeSignedAt: SIGNED, operativeSignedByName: 'Op', managerNote: '', expenseEntries: [], priceWorkEntries: [],
      ...sheetExtra,
    })
  })
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-reviewer-edits',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT || 8080) },
  })
})

test.beforeEach(async () => {
  await env.clearFirestore()
  await seed()
})

test.after(async () => {
  await env?.cleanup()
})

/** The batch the review page writes: the booking's ⚙ change and the sheet's record, exactly as the rulebook builds them. */
function reviewBatch(d: Firestore, uid: string) {
  const stored = labour('B1')
  const edit = timesheetReviewBookingEditWrites({
    booking: { ...stored, collection: 'bookings' } as never,
    startTime: '07:00', endTime: '19:00', isBreakRemoved: false, otMultiplierOverride: 2,
  })
  assert.ok(edit.ok && edit.changed)
  const before = timesheetReviewBookingDocument({ collection: 'bookings', id: 'B1', data: stored, timeZone: 'Europe/London' })
  assert.ok(before)
  const recorded = timesheetReviewerBookingEditRecord({
    sheet: { operativeSignedAt: SIGNED.toMillis() },
    booking: { collection: 'bookings', bookingId: 'B1' },
    after: timesheetReviewBookingAfterEdit(before as never, edit) as never,
    editedBy: uid,
  })
  assert.ok(recorded)
  const batch = writeBatch(d)
  batch.update(doc(d, 'organizations', ORG, 'bookings', 'B1'), { ...edit.set, updatedAt: serverTimestamp(), updatedBy: uid, updatedFrom: 'web' })
  batch.update(
    doc(d, 'organizations', ORG, 'settings', SHEET),
    new FieldPath('reviewerBookingEdits', recorded.key), { ...recorded.value, editedAt: serverTimestamp() },
    'updatedAt', serverTimestamp(), 'updatedBy', uid, 'updatedFrom', 'web'
  )
  return batch
}

test("the line manager writes their report's booking and the sheet's record in one batch", async () => {
  await assertSucceeds(reviewBatch(await db(LM), LM).commit())
  let stored: Record<string, unknown> | undefined
  await env.withSecurityRulesDisabled(async (ctx) => {
    stored = (await getDoc(doc(ctx.firestore(), 'organizations', ORG, 'settings', SHEET))).data()
  })
  assert.equal(Object.keys((stored?.reviewerBookingEdits ?? {}) as object).length, 1)
})

test('an admin reviewing writes the booking and the record in one batch', async () => {
  await assertSucceeds(reviewBatch(await db(ADMIN), ADMIN).commit())
})

test('the person never writes reviewerBookingEdits on their own sheet (a record, or an empty map)', async () => {
  const d = await db(OP)
  const ref = doc(d, 'organizations', ORG, 'settings', SHEET)
  await assertFails(updateDoc(ref, new FieldPath('reviewerBookingEdits', 'bookings__b1'), {
    bookingId: 'B1', collection: 'bookings', fingerprint: 'x', place: '', deleted: false, editedBy: LM, forSignedAtMs: SIGNED.toMillis(),
  }))
  await assertFails(updateDoc(ref, { reviewerBookingEdits: {} }))
  // Their ordinary own save (a note) still works.
  await assertSucceeds(updateDoc(ref, { managerNote: 'Please check Sunday', updatedAt: serverTimestamp(), updatedBy: OP, updatedFrom: 'web' }))
})

test('the person cannot remove a stored record either', async () => {
  await env.clearFirestore()
  await seed({ reviewerBookingEdits: { bookings__b1: { bookingId: 'B1', collection: 'bookings', fingerprint: 'x', forSignedAtMs: 1 } } })
  const d = await db(OP)
  await assertFails(updateDoc(doc(d, 'organizations', ORG, 'settings', SHEET), { reviewerBookingEdits: null }))
})

test('an exported sheet stays frozen: the batch is refused whole and the booking is not changed', async () => {
  await env.clearFirestore()
  await seed({ exportedAt: Timestamp.fromMillis(Date.parse('2026-11-20T09:00:00Z')), managerSignedAt: SIGNED })
  await assertFails(reviewBatch(await db(LM), LM).commit())
  let booking: Record<string, unknown> | undefined
  await env.withSecurityRulesDisabled(async (ctx) => {
    booking = (await getDoc(doc(ctx.firestore(), 'organizations', ORG, 'bookings', 'B1'))).data()
  })
  assert.equal(booking?.workEndTime, '16:00')
})

/** 1.76.0 (owner answer 23 Nov, b): Make changes on the signed price work and expenses — the review map entry and the
 * signed copy (re-signed) are written by the line manager on a signed-off, unexported sheet, late extras or not. */
function entryReviewUpdate(d: Firestore, uid: string) {
  return updateDoc(
    doc(d, 'organizations', ORG, 'settings', SHEET),
    new FieldPath('extraEntryReviews', 'ex1'),
    { decision: 'declined', revisedAmount: null, reviewedAmount: 40, reviewedByUserId: uid, reviewedAtMs: Date.now() },
    'managerSignedAt', serverTimestamp(),
    'weeklyReportOverride', { lines: [], priceWork: [], expenses: [{ id: 'ex1', title: 'Parking', amount: 0, decision: 'declined' }] },
    'updatedAt', serverTimestamp(), 'updatedBy', uid, 'updatedFrom', 'web'
  )
}
const SIGNED_COPY = {
  managerSignedAt: SIGNED, managerSignedByName: 'LM',
  expenseEntries: [{ id: 'ex1', title: 'Parking', amount: 40, jobNumber: 'J1' }],
  weeklyReportOverride: { lines: [], priceWork: [], expenses: [{ id: 'ex1', title: 'Parking', amount: 40, decision: 'approved' }] },
}

test('1.76.0 (b): the line manager changes a signed expense and signs off again on an unexported sheet', async () => {
  await env.clearFirestore()
  await seed(SIGNED_COPY)
  await assertSucceeds(entryReviewUpdate(await db(LM), LM))
})

test('1.76.0 (b): the same on a signed-off sheet that has late extras, before export', async () => {
  await env.clearFirestore()
  await seed({ ...SIGNED_COPY, lateExtras: [{ id: 'l1', kind: 'expense', title: 'Fuel', amount: 10, jobNumber: 'J1' }] })
  await assertSucceeds(entryReviewUpdate(await db(LM), LM))
})

test('1.76.0 (b): never on an exported sheet, and never by the person', async () => {
  await env.clearFirestore()
  await seed({ ...SIGNED_COPY, exportedAt: Timestamp.fromMillis(Date.parse('2026-11-20T09:00:00Z')) })
  await assertFails(entryReviewUpdate(await db(LM), LM))
  await env.clearFirestore()
  await seed(SIGNED_COPY)
  await assertFails(entryReviewUpdate(await db(OP), OP))
})
