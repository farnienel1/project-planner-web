/**
 * Rulebook 1.88.0 §8, §11, §16 "Line managers per organisation" (owner decision 24 Nov, before launch; review of #455,
 * fix (a)). Jane's home is company A (her users document names A, her line manager there is BOB_A); she is also a
 * member of company B through `organizations/B.members` and her membership `users/jane/orgMemberships/B`. B's admin
 * sets B's line manager for her in B's own record `organizations/B/memberLineManagers/jane` (only the three
 * line-manager keys). Then, in B only, CAROL_B decides her leave, reviews her timesheet, reads her overtime and her pay;
 * in A nothing changes. Jane never sets her own; a non-admin never sets one; A's admin never sets B's; "No line
 * manager" only for an admin member. Every B member reads the record; the membership itself stays readable to Jane and
 * B's admins only (pre-1.10.0 iPhone builds copied whole users documents, pay included, onto memberships). With no
 * record in B, Jane's home line manager has no rights in B. Emulator only.
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
import { inviteMembershipWrites } from '../lib/canonical/inviteAccept.ts'
import { deleteDoc, deleteField, doc, getDoc, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'

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

async function seed(withRecord: boolean) {
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
    // Jane's membership in B, as an iPhone build before 1.10.0 left it: a copy of her users document (pay included).
    await setDoc(doc(d, 'users', JANE, 'orgMemberships', B), {
      organizationId: B, role: 'operative', status: 'active', accountActive: true, permissions: { operativeMode: true },
      dayRate: 250, payBasis: 'day', employmentType: 'self_employed', phone: '07000 000000',
    })
    if (withRecord) await setDoc(doc(d, 'organizations', B, 'memberLineManagers', JANE), lineManager([CAROL_B]))
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
const record = async (uid: string, person = JANE, org = B) => doc(await db(uid), 'organizations', org, 'memberLineManagers', person)
const leaveRef = async (uid: string, org: string, id: string) => doc(await db(uid), 'organizations', org, 'holidayBookings', id)
const sheet = async (uid: string, org: string, person = JANE) => doc(await db(uid), 'organizations', org, 'settings', `timesheet_${person}_1761955200`)

test("B's admin sets Jane's line manager in B; Jane, a manager and A's admin cannot", async () => {
  await env.clearFirestore()
  await seed(false)
  await assertFails(setDoc(await record(JANE), lineManager([CAROL_B])))
  await assertFails(setDoc(await record(CAROL_B), lineManager([CAROL_B])))
  await assertFails(setDoc(await record(DAVE_B), lineManager([DAVE_B])))
  await assertFails(setDoc(await record(ADMIN_A), lineManager([BOB_A])))
  // "No line manager" is for admins only: refused for an operative member.
  await assertFails(setDoc(await record(ADMIN_B), lineManager([], true)))
  // Only the three keys and write metadata.
  await assertFails(setDoc(await record(ADMIN_B), { ...lineManager([CAROL_B]), dayRate: 250 }))
  await assertFails(setDoc(await record(ADMIN_B), { ...lineManager([CAROL_B]), updatedBy: CAROL_B }))
  await assertSucceeds(setDoc(await record(ADMIN_B), { ...lineManager([CAROL_B]), updatedBy: ADMIN_B, updatedFrom: 'web' }))
  // Jane cannot remove it; B's admin can.
  await assertFails(deleteDoc(await record(JANE)))
  await assertFails(deleteDoc(await record(ADMIN_A)))
  await assertSucceeds(deleteDoc(await record(ADMIN_B)))
  // The membership field is no longer the place: an admin's membership write carrying `lineManager` is not how it is
  // stored, and Jane can never write one on her own membership.
  await assertFails(updateDoc(await membership(JANE), { lineManager: lineManager([CAROL_B]) }))
})

test('an admin never sets their own line manager record', async () => {
  await env.clearFirestore()
  await seed(true)
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await updateDoc(doc(d, 'organizations', B), { [`members.${ADMIN_A}`]: 'admin' })
    await setDoc(doc(d, 'users', ADMIN_A, 'orgMemberships', B), { organizationId: B, role: 'admin', status: 'active', permissions: { adminAccess: true } })
  })
  await assertFails(setDoc(await record(ADMIN_A, ADMIN_A), lineManager([CAROL_B])))
  // B's own admin may set "No line manager" for an admin member.
  await assertSucceeds(setDoc(await record(ADMIN_B, ADMIN_A), lineManager([], true)))
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

test('without a record in B, Carol is not her line manager there, and her home line manager gains no rights in B', async () => {
  await env.clearFirestore()
  await seed(false)
  await assertFails(updateDoc(await leaveRef(CAROL_B, B, 'H-JANE-B'), approve(CAROL_B)))
  await assertFails(getDoc(doc(await db(CAROL_B), 'organizations', B, 'overtimeRequests', 'OT-JANE')))
  await assertFails(getDoc(await sheet(CAROL_B, B)))
  // BOB_A (her line manager in A) is also a member of B: no leave decision, timesheet or overtime of hers in B.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await updateDoc(doc(d, 'organizations', B), { [`members.${BOB_A}`]: 'manager' })
    await setDoc(doc(d, 'users', BOB_A, 'orgMemberships', B), { organizationId: B, role: 'manager', status: 'active', permissions: { manager: true } })
  })
  await assertFails(updateDoc(await leaveRef(BOB_A, B, 'H-JANE-B'), approve(BOB_A)))
  await assertFails(getDoc(await sheet(BOB_A, B)))
  await assertFails(getDoc(doc(await db(BOB_A), 'organizations', B, 'overtimeRequests', 'OT-JANE')))
})

test('a home person keeps the users document: a record for them in their home company changes nothing', async () => {
  await env.clearFirestore()
  await seed(true)
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', B, 'memberLineManagers', OP_B), lineManager([DAVE_B]))
  })
  await assertSucceeds(getDoc(await sheet(CAROL_B, B, OP_B)))
  await assertSucceeds(updateDoc(await leaveRef(CAROL_B, B, 'H-OP-B'), approve(CAROL_B)))
  await env.clearFirestore()
  await seed(true)
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', B, 'memberLineManagers', OP_B), lineManager([DAVE_B]))
  })
  await assertFails(updateDoc(await leaveRef(DAVE_B, B, 'H-OP-B'), approve(DAVE_B)))
  await assertFails(getDoc(await sheet(DAVE_B, B, OP_B)))
})

test("B's members read the record; the membership stays Jane's and B's admins' only (finding 1)", async () => {
  await env.clearFirestore()
  await seed(true)
  // The record: every active member of B; never an outsider.
  await assertSucceeds(getDoc(await record(CAROL_B)))
  await assertSucceeds(getDoc(await record(OP_B)))
  await assertSucceeds(getDoc(await record(JANE)))
  await assertFails(getDoc(await record(BOB_A)))
  // The membership (an old full copy with pay): Jane and B's admins only — never a co-member.
  await assertSucceeds(getDoc(await membership(JANE)))
  await assertSucceeds(getDoc(await membership(ADMIN_B)))
  await assertFails(getDoc(await membership(CAROL_B)))
  await assertFails(getDoc(await membership(OP_B)))
  await assertFails(getDoc(await membership(BOB_A)))
})

test('Jane deleting her own membership leaves B\'s line manager for her in place (finding 3)', async () => {
  await env.clearFirestore()
  await seed(true)
  await assertSucceeds(deleteDoc(await membership(JANE)))
  await assertSucceeds(getDoc(await record(ADMIN_B)))
  await assertSucceeds(updateDoc(await leaveRef(CAROL_B, B, 'H-JANE-B'), approve(CAROL_B)))
})

test('accepting an invitation into B creates the record exactly as the invitation stores it, in the accept batch only', async () => {
  await env.clearFirestore()
  await seed(false)
  const INV = 'inv-lm-jane'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await deleteDoc(doc(d, 'users', JANE, 'orgMemberships', B))
    // Not a member of B yet: accepting adds her `members` entry.
    await updateDoc(doc(d, 'organizations', B), { [`members.${JANE}`]: deleteField() })
    await setDoc(doc(d, 'invitations', INV), {
      organizationId: B, email: `${JANE}@test.com`, role: 'operative', permissions: { operativeMode: true }, isUsed: false,
      assignedManagerUserIds: [CAROL_B], assignedManagerUserId: CAROL_B, invitedBy: ADMIN_B,
    })
  })
  const jane = await db(JANE)
  let invitation: Record<string, unknown> = {}
  await env.withSecurityRulesDisabled(async (ctx) => {
    invitation = (await getDoc(doc(ctx.firestore(), 'invitations', INV))).data() ?? {}
  })
  // The app's own accept shape (`acceptIntoAnotherCompany`): membership, the record, the members entry, the invitation.
  const write = inviteMembershipWrites({ invitation, invitationId: INV, authUid: JANE, now: Timestamp.now() })
  if (!write?.lineManagerRecord) throw new Error('expected a line-manager record')
  const accept = (recordFields: Record<string, unknown>) => {
    const batch = writeBatch(jane)
    batch.set(doc(jane, 'users', JANE, 'orgMemberships', B), write.membership)
    batch.set(doc(jane, 'organizations', B, 'memberLineManagers', JANE), recordFields)
    batch.update(doc(jane, 'organizations', B), { [write.membersField]: write.role })
    batch.update(doc(jane, 'invitations', INV), { isUsed: true, usedAt: Timestamp.now() })
    return batch.commit()
  }
  // Not alone (no invitation being accepted in the same batch).
  await assertFails(setDoc(doc(jane, 'organizations', B, 'memberLineManagers', JANE), write.lineManagerRecord))
  // A different line manager than the invitation's: the whole batch is refused.
  await assertFails(accept(lineManager([DAVE_B])))
  await assertSucceeds(accept(write.lineManagerRecord))
  // Afterwards Jane cannot change it.
  await assertFails(setDoc(doc(jane, 'organizations', B, 'memberLineManagers', JANE), lineManager([DAVE_B])))
})
