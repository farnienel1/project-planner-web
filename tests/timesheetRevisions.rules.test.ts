/**
 * Rulebook 1.55.0 §8 / §16: timesheet revisions (REV 1, REV 2, …).
 *
 * A revision lives beside its original at `settings/{original id}_rev{N}`. It is created only by the sheet's person (an
 * owner write when a booking change made a revision due) or someone who may sign their sheet off (an admin, or their
 * line manager), with the exact create shape (`timesheetRevisionCreateFields`: the copied fields equal to the version it
 * corrects), and only when that version is exported. Once a revision exists the exported original never changes, and
 * an exported revision never changes.
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { deleteDoc, doc, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { timesheetRevisionCreateFields } from '../lib/canonical/timesheetRevisions.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-rev'
const ADMIN = 'rev-admin'
const LM = 'rev-lm'
const OTHER_LM = 'rev-other-lm'
const OP = 'rev-op'
const ORIGINAL = `timesheet_${OP}_1761955200`
const OPEN_ORIGINAL = `timesheet_${OP}_1763251200`

let env: RulesTestEnvironment

async function db(uid: string) {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

const exportedAt = Timestamp.fromMillis(Date.parse('2026-11-16T10:00:00Z'))
const signedAt = Timestamp.fromMillis(Date.parse('2026-11-15T10:00:00Z'))
const originalData = {
  userId: OP,
  weekStartKey: '2026-11-01',
  weekEndKey: '2026-11-15',
  weekStart: Timestamp.fromMillis(Date.parse('2026-11-01T00:00:00Z')),
  weekEnd: Timestamp.fromMillis(Date.parse('2026-11-15T00:00:00Z')),
  operativeSignedAt: signedAt,
  managerSignedAt: signedAt,
  exportedAt,
  expenseEntries: [{ id: 'e1', title: 'Fuel', amount: 20 }],
  priceWorkEntries: [],
  extraEntryReviews: { e1: { decision: 'declined' } },
  weeklyReportOverride: { lines: [] },
}

/** The create a writer sends: the rulebook's fields plus the server time and write metadata. */
function revisionPayload(previousId: string, previous: Record<string, unknown>, writer: string, extra: Record<string, unknown> = {}) {
  const made = timesheetRevisionCreateFields({ previous: { documentId: previousId, data: previous }, writerUserId: writer })
  if (!made) throw new Error('no revision fields')
  return { id: made.documentId, data: { ...made.fields, revisionCreatedAt: serverTimestamp(), updatedBy: writer, updatedFrom: 'web', updatedAt: serverTimestamp(), ...extra } }
}

async function reset() {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    await setDoc(doc(fs, 'organizations', ORG), {
      name: 'Revisions Ltd',
      creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [LM]: 'manager', [OTHER_LM]: 'manager', [OP]: 'operative' },
    })
    await setDoc(doc(fs, 'users', ADMIN), { email: `${ADMIN}@test.com`, organizationId: ORG, role: 'admin', adminAccess: true, isSuperAdmin: true, passwordSet: true })
    for (const uid of [LM, OTHER_LM]) {
      await setDoc(doc(fs, 'users', uid), { email: `${uid}@test.com`, organizationId: ORG, role: 'manager', manager: true, permissions: { manager: true, operativeMode: false }, passwordSet: true })
    }
    await setDoc(doc(fs, 'users', OP), {
      email: `${OP}@test.com`,
      organizationId: ORG,
      role: 'operative',
      operativeMode: true,
      permissions: { operativeMode: true },
      assignedManagerUserIds: [LM],
      assignedManagerUserId: LM,
      employmentType: 'self_employed',
      passwordSet: true,
    })
    await setDoc(doc(fs, 'organizations', ORG, 'settings', ORIGINAL), originalData)
    await setDoc(doc(fs, 'organizations', ORG, 'settings', OPEN_ORIGINAL), { ...originalData, weekStartKey: '2026-11-16', exportedAt: null, managerSignedAt: null })
  })
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-timesheet-revisions',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080) },
  })
})

test.after(async () => {
  await env?.cleanup()
})

test('an admin creates REV 1 of an exported sheet', async () => {
  await reset()
  const rev = revisionPayload(ORIGINAL, originalData, ADMIN)
  await assertSucceeds(setDoc(doc(await db(ADMIN), 'organizations', ORG, 'settings', rev.id), rev.data))
})

test("the person's line manager creates REV 1", async () => {
  await reset()
  const rev = revisionPayload(ORIGINAL, originalData, LM)
  await assertSucceeds(setDoc(doc(await db(LM), 'organizations', ORG, 'settings', rev.id), rev.data))
})

test('another manager cannot create a revision', async () => {
  await reset()
  const rev = revisionPayload(ORIGINAL, originalData, OTHER_LM)
  await assertFails(setDoc(doc(await db(OTHER_LM), 'organizations', ORG, 'settings', rev.id), rev.data))
})

test('the person creates REV 1 with their own owner write (a booking change made it due)', async () => {
  await reset()
  const rev = revisionPayload(ORIGINAL, originalData, OP)
  await assertSucceeds(setDoc(doc(await db(OP), 'organizations', ORG, 'settings', rev.id), rev.data))
})

test('the person cannot create a revision that changes what it copies (no self-approved reviews or entries)', async () => {
  await reset()
  const fs = await db(OP)
  const forgedReview = revisionPayload(ORIGINAL, originalData, OP, { extraEntryReviews: { e1: { decision: 'approved' } } })
  await assertFails(setDoc(doc(fs, 'organizations', ORG, 'settings', forgedReview.id), forgedReview.data))
  const forgedEntry = revisionPayload(ORIGINAL, originalData, OP, { expenseEntries: [{ id: 'e1', title: 'Fuel', amount: 2000 }] })
  await assertFails(setDoc(doc(fs, 'organizations', ORG, 'settings', forgedEntry.id), forgedEntry.data))
  const signed = revisionPayload(ORIGINAL, originalData, OP, { managerSignedAt: signedAt })
  await assertFails(setDoc(doc(fs, 'organizations', ORG, 'settings', signed.id), signed.data))
  const otherWriter = revisionPayload(ORIGINAL, originalData, OP, { revisionCreatedBy: LM })
  await assertFails(setDoc(doc(fs, 'organizations', ORG, 'settings', otherWriter.id), otherWriter.data))
})

test('no revision of a sheet that is not exported, and no second open revision', async () => {
  await reset()
  const fs = await db(ADMIN)
  const notExported = { ...originalData, weekStartKey: '2026-11-16', exportedAt: null, managerSignedAt: null }
  const made = timesheetRevisionCreateFields({ previous: { documentId: OPEN_ORIGINAL, data: { ...notExported, exportedAt } }, writerUserId: ADMIN })!
  await assertFails(setDoc(doc(fs, 'organizations', ORG, 'settings', made.documentId), { ...made.fields, revisionCreatedAt: serverTimestamp() }))
  const rev1 = revisionPayload(ORIGINAL, originalData, ADMIN)
  await assertSucceeds(setDoc(doc(fs, 'organizations', ORG, 'settings', rev1.id), rev1.data))
  // REV 2 while REV 1 is open (not exported): refused.
  const rev2 = timesheetRevisionCreateFields({ previous: { documentId: rev1.id, data: { ...originalData, exportedAt } }, writerUserId: ADMIN })!
  await assertFails(setDoc(doc(fs, 'organizations', ORG, 'settings', rev2.documentId), { ...rev2.fields, revisionCreatedAt: serverTimestamp() }))
  // A revision id that skips a number: refused.
  await assertFails(
    setDoc(doc(fs, 'organizations', ORG, 'settings', `${ORIGINAL}_rev3`), { ...rev2.fields, revision: 3, previousVersionId: `${ORIGINAL}_rev2`, revisionCreatedAt: serverTimestamp() })
  )
})

test('once a revision exists the exported original never changes, admins included', async () => {
  await reset()
  const rev1 = revisionPayload(ORIGINAL, originalData, ADMIN)
  await assertSucceeds(setDoc(doc(await db(ADMIN), 'organizations', ORG, 'settings', rev1.id), rev1.data))
  await assertFails(updateDoc(doc(await db(ADMIN), 'organizations', ORG, 'settings', ORIGINAL), { managerNote: 'changed' }))
  await assertFails(updateDoc(doc(await db(LM), 'organizations', ORG, 'settings', ORIGINAL), { extraEntryReviews: {} }))
  await assertFails(updateDoc(doc(await db(OP), 'organizations', ORG, 'settings', ORIGINAL), { managerNote: 'x' }))
  await assertFails(deleteDoc(doc(await db(ADMIN), 'organizations', ORG, 'settings', ORIGINAL)))
})

test('an open revision is signed like any sheet; its revision fields never change; exported, it is frozen', async () => {
  await reset()
  const rev1 = revisionPayload(ORIGINAL, originalData, LM)
  await assertSucceeds(setDoc(doc(await db(LM), 'organizations', ORG, 'settings', rev1.id), rev1.data))
  const opRef = doc(await db(OP), 'organizations', ORG, 'settings', rev1.id)
  await assertSucceeds(updateDoc(opRef, { operativeSignedAt: signedAt, operativeSignedByName: 'Op' }))
  await assertFails(updateDoc(opRef, { revision: 5 }))
  await assertFails(deleteDoc(opRef))
  const lmRef = doc(await db(LM), 'organizations', ORG, 'settings', rev1.id)
  await assertFails(updateDoc(lmRef, { previousVersionId: 'x' }))
  await assertSucceeds(updateDoc(lmRef, { managerSignedAt: signedAt, weeklyReportOverride: { lines: [] } }))
  await assertSucceeds(updateDoc(lmRef, { exportedAt }))
  await assertFails(updateDoc(lmRef, { managerNote: 'after export' }))
  await assertFails(updateDoc(doc(await db(ADMIN), 'organizations', ORG, 'settings', rev1.id), { managerNote: 'admin after export' }))
  // REV 2 of the exported REV 1.
  const stored = { ...originalData, ...rev1.data, exportedAt }
  const made = timesheetRevisionCreateFields({ previous: { documentId: rev1.id, data: stored }, writerUserId: LM })!
  await assertSucceeds(setDoc(doc(await db(LM), 'organizations', ORG, 'settings', made.documentId), { ...made.fields, revisionCreatedAt: serverTimestamp() }))
})

test('an unexported revision can be removed by a reviewer, never by the person', async () => {
  await reset()
  const rev1 = revisionPayload(ORIGINAL, originalData, LM)
  await assertSucceeds(setDoc(doc(await db(LM), 'organizations', ORG, 'settings', rev1.id), rev1.data))
  await assertFails(deleteDoc(doc(await db(OP), 'organizations', ORG, 'settings', rev1.id)))
  await assertSucceeds(deleteDoc(doc(await db(LM), 'organizations', ORG, 'settings', rev1.id)))
})

test('an ordinary timesheet without revisions works as before', async () => {
  await reset()
  await assertSucceeds(updateDoc(doc(await db(OP), 'organizations', ORG, 'settings', OPEN_ORIGINAL), { managerNote: 'hello' }))
})
