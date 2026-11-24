/**
 * Rulebook 1.88.0 §8, §11, §16 "Line managers per organisation" (owner decision 24 Nov, before launch). Jane's home is
 * company A (her users document names A, her line manager there is BOB_A); she is also a member of company B through
 * `organizations/B.members` and her membership `users/jane/orgMemberships/B`. B's admin sets B's line manager for her
 * on that membership (`lineManager` map). Then, in B only, CAROL_B decides her leave, reviews her timesheet, reads her
 * overtime and her pay; in A nothing changes. Jane never sets her own; a non-admin never sets one; "No line manager"
 * only on an admin membership. Home-company people read their users document exactly as before; nobody writes a
 * line-manager map on a home person's membership. Co-members of B read a membership in B; an outsider does not. Emulator only.
 *
 *   RULES_PORT=8080 npx tsx --test tests/orgLineManagers.rules.test.ts   (with the Firestore emulator running)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { doc, getDoc, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const A = 'org-lm-a'
const B = 'org-lm-b'
const JANE = 'lm-jane' // home A, operative member of B
const BOB_A = 'lm-bob-a' // manager, home A (Jane's line manager in A)
const ADMIN_A = 'lm-admin-a'
const ADMIN_B = 'lm-admin-b'
const CAROL_B = 'lm-carol-b' // manager, home B (Jane's line manager in B once set)
const DAVE_B = 'lm-dave-b' // manager, home B (nobody's line manager)
const OP_B = 'lm-op-b' // operative, home B, line manager CAROL_B on the users document

let env: RulesTestEnvironment

async function db(uid: string): Promise<Firestore> {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

const lineManager = (ids: string[], none = false) => ({ assignedManagerUserIds: ids, assignedManagerUserId: ids[0] ?? null, hasNoLineManager: none })

function leave(org: string, userId: string) {
  return {
    organizationId: org,
    userId,
    status: 'pending',
    startDate: Timestamp.fromMillis(Date.parse('2026-12-01T00:00:00Z')),
    endDate: Timestamp.fromMillis(Date.parse('2026-12-01T00:00:00Z')),
    timeSlot: 'FULL DAY',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }
}
const approve = (uid: string) => ({ status: 'approved', approvedByUserId: uid, approvedAt: Timestamp.now() })

async function seed(withMap: boolean) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', A), { name: 'A Co', creatorUserId: ADMIN_A, members: { [ADMIN_A]: 'admin', [BOB_A]: 'manager', [JANE]: 'operative' } })
    await setDoc(doc(d, 'organizations', B), {
      name: 'B Co', creatorUserId: ADMIN_B,
      members: { [ADMIN_B]: 'admin', [CAROL_B]: 'manager', [DAVE_B]: 'manager', [OP_B]: 'operative', [JANE]: 'operative' },
    })
    const user = (id: string, org: string, fields: Record<string, unknown>) =>
      setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: org, passwordSet: true, isActive: true, ...fields })
    await user(ADMIN_A, A, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(BOB_A, A, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN_A] })
    await user(JANE, A, { role: 'operative', operativeMode: true, assignedManagerUserIds: [BOB_A], assignedManagerUserId: BOB_A, employmentType: 'self_employed' })
    await user(ADMIN_B, B, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(CAROL_B, B, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN_B] })
    await user(DAVE_B, B, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN_B] })
    await user(OP_B, B, { role: 'operative', operativeMode: true, assignedManagerUserIds: [CAROL_B], employmentType: 'self_employed' })
    await setDoc(doc(d, 'users', JANE, 'orgMemberships', B), {
      organizationId: B, role: 'operative', status: 'active', accountActive: true, permissions: { operativeMode: true },
      ...(withMap ? { lineManager: lineManager([CAROL_B]) } : {}),
    })
    // A HOME person's membership (no line-manager map: their users document holds it; the rules refuse a map here).
    await setDoc(doc(d, 'users', OP_B, 'orgMemberships', B), {
      organizationId: B, role: 'operative', status: 'active', permissions: { operativeMode: true },
    })
    await setDoc(doc(d, 'organizations', B, 'holidayBookings', 'H-JANE-B'), leave(B, JANE))
    await setDoc(doc(d, 'organizations', A, 'holidayBookings', 'H-JANE-A'), leave(A, JANE))
    await setDoc(doc(d, 'organizations', B, 'holidayBookings', 'H-OP-B'), leave(B, OP_B))
    for (const [org, id] of [[B, `timesheet_${JANE}_1761955200`], [A, `timesheet_${JANE}_1761955200`], [B, `timesheet_${OP_B}_1761955200`]]) {
      const subject = id.includes(JANE) ? JANE : OP_B
      await setDoc(doc(d, 'organizations', org, 'settings', id), { userId: subject, weekStartKey: '2026-11-01', weekStart: Timestamp.fromMillis(Date.parse('2026-11-01T00:00:00Z')) })
    }
    // Timesheets are read only by the person, their line managers, admins and pay viewers while `privatePay` is on.
    await setDoc(doc(d, 'platformConfig', 'app'), { privatePay: true })
    await setDoc(doc(d, 'organizations', B, 'overtimeRequests', 'OT-JANE'), { userId: JANE, status: 'pending', rangeStart: '2026-11-01', rangeEnd: '2026-11-15', lines: [] })
  })
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-org-line-managers',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT || 8080) },
  })
})
test.after(async () => {
  await env?.cleanup()
})

const membership = async (uid: string, person = JANE, org = B) => doc(await db(uid), 'users', person, 'orgMemberships', org)
const leaveRef = async (uid: string, org: string, id: string) => doc(await db(uid), 'organizations', org, 'holidayBookings', id)
const sheet = async (uid: string, org: string, person = JANE) => doc(await db(uid), 'organizations', org, 'settings', `timesheet_${person}_1761955200`)

test("B's admin sets Jane's line manager in B; Jane, a manager and A's admin cannot", async () => {
  await env.clearFirestore()
  await seed(false)
  await assertFails(updateDoc(await membership(JANE), { lineManager: lineManager([CAROL_B]) }))
  await assertFails(updateDoc(await membership(CAROL_B), { lineManager: lineManager([CAROL_B]) }))
  await assertFails(updateDoc(await membership(ADMIN_A), { lineManager: lineManager([BOB_A]) }))
  // "No line manager" is for admins only: refused on an operative membership.
  await assertFails(updateDoc(await membership(ADMIN_B), { lineManager: lineManager([], true) }))
  await assertSucceeds(updateDoc(await membership(ADMIN_B), { lineManager: lineManager([CAROL_B]) }))
})

test('an admin never sets their own line manager on their membership', async () => {
  await env.clearFirestore()
  await seed(true)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await updateDoc(doc(d, 'organizations', B), { [`members.${ADMIN_A}`]: 'admin' })
    await setDoc(doc(d, 'users', ADMIN_A, 'orgMemberships', B), { organizationId: B, role: 'admin', status: 'active', permissions: { adminAccess: true } })
  })
  await assertFails(updateDoc(await membership(ADMIN_A, ADMIN_A), { lineManager: lineManager([CAROL_B]) }))
})

test("in B, Jane's B line manager decides her leave, reviews her timesheet and reads her overtime; not in A", async () => {
  await env.clearFirestore()
  await seed(true)
  await assertSucceeds(getDoc(await sheet(CAROL_B, B)))
  await assertSucceeds(getDoc(await leaveRef(CAROL_B, B, 'H-JANE-B')))
  await assertSucceeds(getDoc(doc(await db(CAROL_B), 'organizations', B, 'overtimeRequests', 'OT-JANE')))
  await assertFails(getDoc(doc(await db(DAVE_B), 'organizations', B, 'overtimeRequests', 'OT-JANE')))
  await assertFails(getDoc(await sheet(DAVE_B, B)))
  await assertFails(updateDoc(await leaveRef(DAVE_B, B, 'H-JANE-B'), approve(DAVE_B)))
  await assertSucceeds(updateDoc(await leaveRef(CAROL_B, B, 'H-JANE-B'), approve(CAROL_B)))
  // In A (her home) CAROL_B is nobody: refused.
  await assertFails(getDoc(await sheet(CAROL_B, A)))
  await assertFails(updateDoc(await leaveRef(CAROL_B, A, 'H-JANE-A'), approve(CAROL_B)))
  // In A her home line manager still decides, as before.
  await assertSucceeds(updateDoc(await leaveRef(BOB_A, A, 'H-JANE-A'), approve(BOB_A)))
})

test('without a map in B, nothing changes: Carol is not her line manager there', async () => {
  await env.clearFirestore()
  await seed(false)
  await assertFails(updateDoc(await leaveRef(CAROL_B, B, 'H-JANE-B'), approve(CAROL_B)))
  await assertFails(getDoc(doc(await db(CAROL_B), 'organizations', B, 'overtimeRequests', 'OT-JANE')))
  await assertFails(getDoc(await sheet(CAROL_B, B)))
})

test('a home person keeps the users document: no map is ever written on their home membership', async () => {
  await env.clearFirestore()
  await seed(true)
  // B's admin sets a home person's line manager on the users document, never on their membership in B.
  await assertFails(updateDoc(await membership(ADMIN_B, OP_B), { lineManager: lineManager([DAVE_B]) }))
  await assertSucceeds(getDoc(await sheet(CAROL_B, B, OP_B)))
  await assertSucceeds(updateDoc(await leaveRef(CAROL_B, B, 'H-OP-B'), approve(CAROL_B)))
  await env.clearFirestore()
  await seed(true)
  await assertFails(updateDoc(await leaveRef(DAVE_B, B, 'H-OP-B'), approve(DAVE_B)))
  await assertFails(getDoc(await sheet(DAVE_B, B, OP_B)))
})

test("B's members read Jane's membership in B; an outsider does not", async () => {
  await env.clearFirestore()
  await seed(true)
  await assertSucceeds(getDoc(await membership(CAROL_B)))
  await assertSucceeds(getDoc(await membership(JANE)))
  await assertSucceeds(getDoc(await membership(ADMIN_B)))
  await assertFails(getDoc(await membership(BOB_A)))
})
