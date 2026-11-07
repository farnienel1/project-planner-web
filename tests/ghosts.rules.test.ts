/**
 * Rulebook 1.34.0 (§11, §16): ghost operatives — security rules (Operatives-manager create, R1 and delete are in
 * tests/firestore.rules.test.ts, on its 1.31.1 people; seeded here they hit the emulator's ternary crash). A ghost is a `users/{id}` document with
 * `ghost: true`, `passwordSet: false`, no email. It reuses the users-document rules; R1 keeps its line manager locked
 * for Operatives managers, R2 gives a line manager no overtime booking writes on it. Emulator only (own project id).
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails, assertLogicalDeny } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { deleteDoc, deleteField, doc, getDoc, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { ghostCreateWrites, ghostUpgradeWrites } from '../lib/canonical/ghostOperatives.ts'
import { userDeleteWrites } from '../lib/canonical/userDelete.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-gh'
const ADMIN = 'gh-admin'
const OPS = 'gh-ops'
const MGR = 'gh-mgr'
const LM = 'gh-lm'
const GHOST = 'gh-ghost'
const OP = 'gh-op'

let env: RulesTestEnvironment

async function db(uid: string) {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

function ghostFields(id: string, actor: string, lineManager = LM) {
  const plan = ghostCreateWrites({
    organizationId: ORG,
    ghostId: id,
    draft: { firstName: 'Gus', surname: 'Ghost', payBasis: 'day', dayRate: 150, lineManagerIds: [lineManager] },
    actorUserId: actor,
    platform: 'web',
  })
  if (!plan) throw new Error('no plan')
  return { ...plan.user.fields, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }
}

function leave(uid: string, status: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'x', organizationId: ORG, userId: uid,
    startDate: Timestamp.fromMillis(Date.parse('2026-12-01T00:00:00Z')),
    endDate: Timestamp.fromMillis(Date.parse('2026-12-01T00:00:00Z')),
    status, timeSlot: 'FULL DAY',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    ...extra,
  }
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG), {
      name: 'Ghost Co',
      creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [OPS]: 'manager', [MGR]: 'manager', [LM]: 'manager', [OP]: 'operative' },
    })
    const user = (id: string, fields: Record<string, unknown>) =>
      setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, passwordSet: true, isActive: true, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(OPS, { role: 'manager', manager: true, operatives: true, permissions: { operatives: true }, assignedManagerUserIds: [ADMIN] })
    await user(MGR, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(LM, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(OP, { role: 'operative', operativeMode: true, assignedManagerUserIds: [LM] })
    await setDoc(doc(d, 'users', GHOST), ghostFields(GHOST, ADMIN))
    await setDoc(doc(d, 'organizations', ORG, 'projects', 'job1'), { name: 'Riverside', managerUserIds: [MGR] })
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'BG'), {
      id: 'BG', operativeId: GHOST, projectId: 'job1', jobCollection: 'projects', date: 1762214400000,
      timeSlot: 'CUSTOM_HOURS', workStartTime: '06:30', workEndTime: '17:00', status: 'Confirmed', bookedBy: 'Ada', notes: '',
    })
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'BO'), {
      id: 'BO', operativeId: OP, projectId: 'job1', jobCollection: 'projects', date: 1762214400000,
      timeSlot: 'CUSTOM_HOURS', workStartTime: '06:30', workEndTime: '17:00', status: 'Confirmed', bookedBy: 'Ada', notes: '',
    })
  })
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-ghosts',
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

test('R2: a ghost\'s line manager gets no overtime booking write on it; an ordinary report still works', async () => {
  const lm = await db(LM)
  await assertLogicalDeny(updateDoc(doc(lm, 'organizations', ORG, 'bookings', 'BG'), { workEndTime: '16:00' }))
  await assertSucceeds(updateDoc(doc(lm, 'organizations', ORG, 'bookings', 'BO'), { workEndTime: '16:00' }))
  // The job's manager still edits the ghost's booking (canWriteBooking).
  await assertSucceeds(updateDoc(doc(await db(MGR), 'organizations', ORG, 'bookings', 'BG'), { workEndTime: '16:00' }))
})

test('leave for a ghost: its line manager or an admin books it approved; another manager cannot', async () => {
  const ref = async (uid: string, id: string) => doc(await db(uid), 'organizations', ORG, 'holidayBookings', id)
  await assertSucceeds(setDoc(await ref(LM, 'gh-hol-1'), leave(GHOST, 'approved', { approvedByUserId: LM, approvedAt: Timestamp.now() })))
  await assertSucceeds(setDoc(await ref(ADMIN, 'gh-hol-2'), leave(GHOST, 'approved', { approvedByUserId: ADMIN, approvedAt: Timestamp.now() })))
  await assertFails(setDoc(await ref(OPS, 'gh-hol-3'), leave(GHOST, 'approved', { approvedByUserId: OPS, approvedAt: Timestamp.now() })))
})

test('Give app access: the admin batch passes; an Operatives manager\'s is refused', async () => {
  const plan = (viewer: Record<string, unknown>, invitationId: string) =>
    ghostUpgradeWrites({
      viewer,
      organizationId: ORG,
      ghostId: GHOST,
      ghost: ghostFields(GHOST, ADMIN),
      email: 'gus@test.com',
      invitationId,
      invitedBy: String(viewer.id),
      now: Timestamp.now(),
      actorUserId: String(viewer.id),
      platform: 'web',
    })
  const send = async (uid: string, p: NonNullable<ReturnType<typeof plan>>) => {
    const d = await db(uid)
    const batch = writeBatch(d)
    batch.update(doc(d, p.user.path), { ...p.user.set })
    batch.set(doc(d, p.invitation.path), p.invitation.fields)
    batch.set(doc(d, p.claim.path), p.claim.fields)
    return batch.commit()
  }
  const adminPlan = plan({ id: ADMIN, role: 'admin', adminAccess: true, isActive: true }, 'inv-gh-1')
  if (!adminPlan) throw new Error('admin plan refused by the rulebook')
  // The rulebook refuses an Operatives manager; their hand-built batch is refused by the rules too (email on a ghost).
  await assertFails(send(OPS, { ...adminPlan, invitation: { ...adminPlan.invitation, path: 'invitations/inv-gh-2', fields: { ...adminPlan.invitation.fields, invitedBy: OPS } } }))
  await assertSucceeds(send(ADMIN, adminPlan))
})


test('review fix B1: nobody marks their own users document a ghost or sets its invite email hint', async () => {
  const op = await db(OP)
  await assertLogicalDeny(updateDoc(doc(op, 'users', OP), { ghost: true }))
  await assertLogicalDeny(updateDoc(doc(op, 'users', OP), { inviteEmailHint: 'x@test.com' }))
  const admin = await db(ADMIN)
  await assertLogicalDeny(updateDoc(doc(admin, 'users', ADMIN), { ghost: true }))
  // The person's ordinary own edits still pass.
  await assertSucceeds(updateDoc(doc(op, 'users', OP), { mobileNumber: '07000 000000' }))
  // An Operatives manager never flips a ghost back; an admin may on someone else.
  await assertFails(updateDoc(doc(await db(OPS), 'users', GHOST), { ghost: false }))
  await assertSucceeds(updateDoc(doc(admin, 'users', GHOST), { inviteEmailHint: 'gus@test.com' }))
})

test('review fix B1: deleting a "ghost" listed in members still removes its members entry, membership and tax ids', async () => {
  const SELF = 'gh-self'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'users', SELF), { email: `${SELF}@test.com`, organizationId: ORG, passwordSet: true, isActive: true,
      role: 'operative', operativeMode: true, assignedManagerUserIds: [LM], ghost: true })
    await setDoc(doc(d, 'users', SELF, 'orgMemberships', ORG), { organizationId: ORG, role: 'operative', status: 'active' })
    await setDoc(doc(d, 'users', SELF, 'private', 'taxIds'), { utrNumber: '1' })
    await updateDoc(doc(d, 'organizations', ORG), { [`members.${SELF}`]: 'operative' })
  })
  const steps = userDeleteWrites({
    orgId: ORG,
    user: { id: SELF, email: `${SELF}@test.com`, role: { isAdmin: false, isSuperAdmin: false, isManager: false, isOperativeMode: true }, ghost: true },
    actorUserId: ADMIN,
    platform: 'web',
    nowIso: '2026-11-07T09:00:00Z',
    listedInMembers: true,
  })
  const admin = await db(ADMIN)
  for (const step of steps.filter((s) => s.step === 'account')) {
    const batch = writeBatch(admin)
    for (const write of step.writes) {
      if (write.op === 'delete') batch.delete(doc(admin, write.path))
      else if (write.op === 'update') batch.update(doc(admin, write.path), Object.fromEntries(write.deleteFields.map((k) => [k, deleteField()])))
    }
    await assertSucceeds(batch.commit())
  }
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    const org = (await getDoc(doc(d, 'organizations', ORG))).data() as { members: Record<string, unknown> }
    if (SELF in org.members) throw new Error('members entry left behind')
    if ((await getDoc(doc(d, 'users', SELF, 'orgMemberships', ORG))).exists()) throw new Error('membership left behind')
    if ((await getDoc(doc(d, 'users', SELF, 'private', 'taxIds'))).exists()) throw new Error('tax ids left behind')
  })
})
