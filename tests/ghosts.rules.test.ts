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
import { deleteDoc, doc, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { ghostCreateWrites, ghostUpgradeWrites } from '../lib/canonical/ghostOperatives.ts'

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

