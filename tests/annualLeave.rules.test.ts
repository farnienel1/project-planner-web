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
import { addDoc, collection, deleteDoc, doc, getDocs, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
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

function adjustment(userId: string, by: string, extra: Record<string, unknown> = {}) {
  const fields = annualLeaveAdjustmentCreateFields({ userId, days: 2, reason: 'Long service', yearKey: '2026-01-01', createdBy: by, createdByName: 'Someone' })
  if (!fields) throw new Error('no fields')
  return { ...fields, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), updatedBy: by, updatedFrom: 'web', ...extra }
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
    await setDoc(doc(d, 'organizations', ORG, 'holidayBookings', 'H-ROW'), leave({ operativeId: ROW, status: 'pending' }))
    await setDoc(doc(d, 'organizations', ORG, 'holidayBookings', 'H-OP'), leave({ userId: OP, status: 'pending' }))
    await setDoc(doc(d, 'organizations', ORG, 'annualLeaveAdjustments', 'ADJ-OP'), adjustment(OP, ADMIN))
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
  await assertLogicalDeny(addDoc(await adjustments(OP), adjustment(OP, OP)))
  await assertLogicalDeny(addDoc(await adjustments(ADMIN), adjustment(ADMIN, ADMIN)))
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
