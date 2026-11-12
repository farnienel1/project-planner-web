/**
 * Rulebook 1.40.0 (§4.4, §9, §16; owner decisions 11 Nov): security rules for annual leave.
 *  - `annualLeaveAdjustments`: create only (append-only history), by an admin or the person's line manager, never the
 *    person; read by the person, their line managers and admins; the catch-all never re-opens it.
 *  - `holidayBookings`: the line manager of leave filed only under an `operatives` row (no users document on `userId`)
 *    decides it, through the row's email claim; a line manager never moves leave to another person.
 * Emulator only (own project id).
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertLogicalDeny } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import { annualLeaveAdjustmentCreateFields } from '../lib/canonical/annualLeaveAdjustments.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-al'
const ADMIN = 'al-admin'
const LM = 'al-lm'
const OTHER = 'al-other'
const OP = 'al-op'
const ROWUSER = 'al-rowuser'
const ROW = 'al-row-1'

let env: RulesTestEnvironment

async function db(uid: string) {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

// The current calendar year's first day: inside the rules' window (a year either side of the request time).
const YEAR_KEY = `${new Date().getUTCFullYear()}-01-01`

function adjustment(userId: string, by: string, extra: Record<string, unknown> = {}) {
  const fields = annualLeaveAdjustmentCreateFields({ userId, days: 2, reason: 'Long service', yearKey: YEAR_KEY, createdBy: by })
  if (!fields) throw new Error('no fields')
  // As both apps write it: createdAt is the server time (the rules require the request time).
  return { ...fields, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: by, updatedFrom: 'web', ...extra }
}
/** A stored adjustment (seeded with the rules off; a server timestamp is not allowed there). */
function storedAdjustment(userId: string, by: string) {
  return { ...adjustment(userId, by), createdAt: Timestamp.now(), updatedAt: Timestamp.now() }
}

function leave(fields: Record<string, unknown>) {
  return {
    organizationId: ORG,
    startDate: Timestamp.fromMillis(Date.parse('2026-12-01T00:00:00Z')),
    endDate: Timestamp.fromMillis(Date.parse('2026-12-01T00:00:00Z')),
    timeSlot: 'FULL DAY',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...fields,
  }
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG), {
      name: 'Leave Co',
      creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [LM]: 'manager', [OTHER]: 'manager', [OP]: 'operative', [ROWUSER]: 'operative' },
    })
    const user = (id: string, fields: Record<string, unknown>) =>
      setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, passwordSet: true, isActive: true, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(LM, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(OTHER, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(OP, { role: 'operative', operativeMode: true, assignedManagerUserIds: [LM], employmentType: 'paye' })
    await user(ROWUSER, { role: 'operative', operativeMode: true, assignedManagerUserIds: [LM] })
    // An operatives row on ROWUSER's email; leave filed only under the row id (older iOS shape).
    await setDoc(doc(d, 'organizations', ORG, 'operatives', ROW), { firstName: 'Rowan', lastName: 'Row', email: `${ROWUSER}@test.com`, isActive: true })
    await setDoc(doc(d, 'organizations', ORG, 'userEmails', `${ROWUSER}@test.com`), { userId: ROWUSER })
    // An operatives row on the admin's own email (review r306 #6: an admin never adjusts it).
    await setDoc(doc(d, 'organizations', ORG, 'operatives', 'al-admin-row'), { firstName: 'Ada', lastName: 'Admin', email: `${ADMIN}@test.com`, isActive: true })
    await setDoc(doc(d, 'organizations', ORG, 'holidayBookings', 'H-ROW'), leave({ operativeId: ROW, status: 'pending' }))
    await setDoc(doc(d, 'organizations', ORG, 'holidayBookings', 'H-OP'), leave({ userId: OP, status: 'pending' }))
    await setDoc(doc(d, 'organizations', ORG, 'annualLeaveAdjustments', 'ADJ-OP'), storedAdjustment(OP, ADMIN))
  })
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-annual-leave',
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

const adjustments = async (uid: string) => collection(await db(uid), 'organizations', ORG, 'annualLeaveAdjustments')

test('adjustments: an admin and the line manager add one; another manager, the person and an admin for themself cannot', async () => {
  await assertSucceeds(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN)))
  await assertSucceeds(addDoc(await adjustments(LM), adjustment(OP, LM)))
  await assertLogicalDeny(addDoc(await adjustments(OTHER), adjustment(OP, OTHER)))
  // For oneself (the rulebook refuses to build it, so the document is written by hand).
  await assertLogicalDeny(addDoc(await adjustments(OP), { ...adjustment(LM, OP), userId: OP }))
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), { ...adjustment(OP, ADMIN), userId: ADMIN }))
  // Written by someone else's name.
  await assertLogicalDeny(addDoc(await adjustments(LM), adjustment(OP, ADMIN)))
})

test('adjustments: half days only, a reason, a day-key year, known fields', async () => {
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { days: 0.3 })))
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { days: 0 })))
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { days: 400 })))
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { reason: '' })))
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { yearKey: '2026' })))
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { extra: true })))
  await assertSucceeds(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { days: -1.5 })))
})

test('adjustments (review r306 #6): server-time createdAt, a year near today, a non-blank reason, no author name, never the admin\'s own row', async () => {
  // createdAt from the client clock, or missing.
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { createdAt: Timestamp.fromMillis(Date.now() - 60_000) })))
  const { createdAt: _drop, ...noCreatedAt } = adjustment(OP, ADMIN)
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), noCreatedAt))
  // A year more than a year away.
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { yearKey: `${new Date().getUTCFullYear() + 2}-01-01` })))
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { yearKey: `${new Date().getUTCFullYear() - 2}-01-01` })))
  // The next leave year is allowed by the rules (the apps offer the current one only).
  await assertSucceeds(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { yearKey: `${new Date().getUTCFullYear() + 1}-01-01` })))
  // A reason of spaces only, or too long.
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { reason: '   ' })))
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { reason: 'x'.repeat(201) })))
  // A free-text author name is no longer stored.
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment(OP, ADMIN, { createdByName: 'The Boss' })))
  // The admin's own operatives row.
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment('al-admin-row', ADMIN)))
  await assertSucceeds(addDoc(await adjustments(ADMIN), adjustment(ROW, ADMIN)))
})

test('adjustments: append-only — never updated or deleted, admins included', async () => {
  const ref = doc(await db(ADMIN), 'organizations', ORG, 'annualLeaveAdjustments', 'ADJ-OP')
  await assertLogicalDeny(updateDoc(ref, { days: 5 }))
  await assertLogicalDeny(deleteDoc(ref))
})

test('adjustments: read by the person, their line manager and admins only', async () => {
  const byPerson = async (uid: string) => getDocs(query(await adjustments(uid), where('userId', '==', OP)))
  await assertSucceeds(byPerson(OP))
  await assertSucceeds(byPerson(LM))
  await assertSucceeds(byPerson(ADMIN))
  await assertLogicalDeny(byPerson(OTHER))
  await assertSucceeds(getDocs(await adjustments(ADMIN)))
  await assertLogicalDeny(getDocs(await adjustments(OTHER)))
})

test('adjustments (review r306 #6): a deactivated person reads none, their own included', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', OP), { isActive: false })
  })
  await assertLogicalDeny(getDocs(query(await adjustments(OP), where('userId', '==', OP))))
  await assertSucceeds(getDocs(query(await adjustments(LM), where('userId', '==', OP))))
})

test('leave filed under an operatives row: its person\'s line manager decides it; another manager cannot', async () => {
  const ref = async (uid: string, id: string) => doc(await db(uid), 'organizations', ORG, 'holidayBookings', id)
  await assertLogicalDeny(updateDoc(await ref(OTHER, 'H-ROW'), { status: 'approved', approvedByUserId: OTHER, approvedAt: Timestamp.now() }))
  await assertSucceeds(updateDoc(await ref(LM, 'H-ROW'), { status: 'approved', approvedByUserId: LM, approvedAt: Timestamp.now() }))
  await assertSucceeds(setDoc(await ref(LM, 'H-ROW-2'), leave({ operativeId: ROW, status: 'approved', approvedByUserId: LM, approvedAt: Timestamp.now() })))
  await assertSucceeds(deleteDoc(await ref(LM, 'H-ROW')))
  // The users-document path is unchanged.
  await assertSucceeds(updateDoc(await ref(LM, 'H-OP'), { status: 'approved', approvedByUserId: LM, approvedAt: Timestamp.now() }))
})

test('a line manager never moves leave to another person; an admin still may', async () => {
  const ref = async (uid: string) => doc(await db(uid), 'organizations', ORG, 'holidayBookings', 'H-OP')
  await assertLogicalDeny(updateDoc(await ref(LM), { userId: ROWUSER }))
  await assertSucceeds(updateDoc(await ref(ADMIN), { userId: ROWUSER }))
})
