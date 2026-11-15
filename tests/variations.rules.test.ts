/**
 * Rulebook 1.52.0 §16 / §22 (owner decisions 15 Nov): variations.
 *
 * - Staff (admins, managers) still write variations; operatives never.
 * - A change to a variation's VO number or `sequence` is made only by an admin or a manager of that job (the tracker).
 * - A Submitted or Closed variation (or one whose number is locked) is pinned: nobody changes its VO number. It can
 *   still be removed (soft delete, `isDeleted`).
 * - The tracker document is written by admins and the job's managers.
 * - Staff no longer hard-delete the settings copies (`settings/variations_*`, `settings/variationItem_*`).
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
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-vo'
const ADMIN = 'vo-admin'
const JOB_MGR = 'vo-job-mgr'
const OTHER_MGR = 'vo-other-mgr'
const OP = 'vo-op'
const JOB = 'JOB-1'
const SW = 'SW-1'

let env: RulesTestEnvironment

async function db(uid: string) {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

function variation(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    orgId: ORG,
    parentId: JOB,
    parentType: 'project',
    voNumber: 'VO-001',
    sequence: 1,
    voNumberLocked: false,
    status: 'open',
    heading: 'Extra sockets',
    isDeleted: false,
    numberHistory: [],
    ...extra,
  }
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-variations-152',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080) },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    await setDoc(doc(fs, 'organizations', ORG), {
      name: 'Variations Ltd',
      creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [JOB_MGR]: 'manager', [OTHER_MGR]: 'manager', [OP]: 'operative' },
    })
    await setDoc(doc(fs, 'users', ADMIN), { email: `${ADMIN}@test.com`, organizationId: ORG, role: 'admin', adminAccess: true, isSuperAdmin: true, passwordSet: true })
    for (const uid of [JOB_MGR, OTHER_MGR]) {
      await setDoc(doc(fs, 'users', uid), { email: `${uid}@test.com`, organizationId: ORG, role: 'manager', manager: true, permissions: { manager: true, operativeMode: false }, passwordSet: true })
    }
    await setDoc(doc(fs, 'users', OP), { email: `${OP}@test.com`, organizationId: ORG, role: 'operative', operativeMode: true, permissions: { operativeMode: true }, passwordSet: true })
    await setDoc(doc(fs, 'organizations', ORG, 'projects', JOB), { jobNumber: 'J1', managerIds: [JOB_MGR], managerUserIds: [JOB_MGR] })
    await setDoc(doc(fs, 'organizations', ORG, 'smallWorks', SW), { jobNumber: 'S1', managerIds: [JOB_MGR], managerUserIds: [JOB_MGR] })
    await setDoc(doc(fs, 'organizations', ORG, 'variations', 'open-1'), variation('open-1'))
    await setDoc(doc(fs, 'organizations', ORG, 'variations', 'open-2'), variation('open-2', { voNumber: 'VO-003', sequence: 3 }))
    await setDoc(doc(fs, 'organizations', ORG, 'variations', 'sub-1'), variation('sub-1', { voNumber: 'VO-002', sequence: 2, status: 'submitted', voNumberLocked: true }))
    await setDoc(doc(fs, 'organizations', ORG, 'variations', 'closed-1'), variation('closed-1', { voNumber: 'VO-004', sequence: 4, status: 'closed' }))
    await setDoc(doc(fs, 'organizations', ORG, 'variations', 'sw-1'), variation('sw-1', { parentId: SW, parentType: 'smallWork' }))
    // An older iOS build stored the job id in another letter case than the job document's.
    await setDoc(doc(fs, 'organizations', ORG, 'variations', 'lower-1'), variation('lower-1', { parentId: JOB.toLowerCase() }))
    // A job whose order is locked (review of #330, MEDIUM 4).
    await setDoc(doc(fs, 'organizations', ORG, 'projects', 'JOB-L'), { jobNumber: 'JL', managerIds: [JOB_MGR], managerUserIds: [JOB_MGR] })
    await setDoc(doc(fs, 'organizations', ORG, 'variations', 'locked-1'), variation('locked-1', { parentId: 'JOB-L' }))
    await setDoc(doc(fs, 'organizations', ORG, 'variationTrackers', 'JOB-L'), { parentId: 'JOB-L', parentType: 'project', enabled: true, version: 1, orderLocked: true, orderLockedByUid: ADMIN })
    await setDoc(doc(fs, 'organizations', ORG, 'variationTrackers', JOB), { parentId: JOB, parentType: 'project', enabled: true, version: 1 })
    await setDoc(doc(fs, 'organizations', ORG, 'settings', `variations_${JOB}`), { recordType: 'variationLog', parentId: JOB, items: [] })
    await setDoc(doc(fs, 'organizations', ORG, 'settings', 'variationItem_open-1'), { recordType: 'variationItem', parentId: JOB, voNumber: 'VO-001' })
    await setDoc(doc(fs, 'organizations', ORG, 'settings', 'jobTypes'), { jobTypes: ['CAT A'] })
  })
})

test.after(async () => {
  await env.cleanup()
})

const ref = async (uid: string, id: string) => doc(await db(uid), 'organizations', ORG, 'variations', id)

test('any staff member edits a variation\'s content (not its number)', async () => {
  await assertSucceeds(updateDoc(await ref(OTHER_MGR, 'open-1'), { heading: 'Edited by another manager' }))
  await assertSucceeds(updateDoc(await ref(OTHER_MGR, 'open-1'), { customLines: [{ id: 'c1', name: 'Skip', quantity: 1, cost: 150 }] }))
  await assertFails(updateDoc(await ref(OP, 'open-1'), { heading: 'Operative' }))
})

test('only an admin or the job\'s manager renumbers an open variation', async () => {
  await assertFails(updateDoc(await ref(OTHER_MGR, 'open-2'), { voNumber: 'VO-005', numberHistory: [{ from: 'VO-003', to: 'VO-005' }] }))
  await assertFails(updateDoc(await ref(OTHER_MGR, 'open-2'), { sequence: 9 }))
  await assertSucceeds(updateDoc(await ref(JOB_MGR, 'open-2'), { voNumber: 'VO-005', sequence: 5, numberHistory: [{ from: 'VO-003', to: 'VO-005' }] }))
  await assertSucceeds(updateDoc(await ref(ADMIN, 'open-2'), { voNumber: 'VO-003', sequence: 3 }))
  // Small works: the manager of that small works job.
  await assertSucceeds(updateDoc(await ref(JOB_MGR, 'sw-1'), { voNumber: 'VO-007' }))
  await assertFails(updateDoc(await ref(OTHER_MGR, 'sw-1'), { voNumber: 'VO-008' }))
})

test('a submitted or closed variation is pinned: no one changes its number, but it can be moved in sequence and removed', async () => {
  await assertFails(updateDoc(await ref(ADMIN, 'sub-1'), { voNumber: 'VO-009' }))
  await assertFails(updateDoc(await ref(JOB_MGR, 'closed-1'), { voNumber: 'VO-009' }))
  await assertSucceeds(updateDoc(await ref(JOB_MGR, 'sub-1'), { sequence: 7 }))
  // Removal is a soft delete; any staff member may remove it.
  await assertSucceeds(updateDoc(await ref(OTHER_MGR, 'closed-1'), { isDeleted: true }))
  await assertFails(updateDoc(await ref(OP, 'sub-1'), { isDeleted: true }))
})

test('variations are never hard-deleted', async () => {
  await assertFails(deleteDoc(await ref(ADMIN, 'open-1')))
})

test('the tracker is written by admins and the job\'s managers only', async () => {
  const tracker = async (uid: string) => doc(await db(uid), 'organizations', ORG, 'variationTrackers', JOB)
  await assertSucceeds(updateDoc(await tracker(JOB_MGR), { lockedByUid: JOB_MGR, lockedByName: 'M', lockedAt: new Date() }))
  await assertSucceeds(updateDoc(await tracker(ADMIN), { version: 2 }))
  await assertFails(updateDoc(await tracker(OTHER_MGR), { version: 3 }))
  await assertFails(updateDoc(await tracker(OP), { version: 3 }))
})

test('staff no longer hard-delete the variation settings copies; other settings deletes are unchanged', async () => {
  const settings = async (uid: string, id: string) => doc(await db(uid), 'organizations', ORG, 'settings', id)
  await assertFails(deleteDoc(await settings(ADMIN, `variations_${JOB}`)))
  await assertFails(deleteDoc(await settings(JOB_MGR, 'variationItem_open-1')))
  // Writing the copies still works for staff.
  await assertSucceeds(updateDoc(await settings(OTHER_MGR, 'variationItem_open-1'), { heading: 'Copy' }))
  await assertSucceeds(setDoc(await settings(ADMIN, 'variationItem_new-1'), { recordType: 'variationItem', parentId: JOB }, { merge: true }))
  await assertSucceeds(deleteDoc(await settings(ADMIN, 'jobTypes')))
})

test('review LOW: the job manager check ignores the letter case of the stored job id', async () => {
  await assertSucceeds(updateDoc(await ref(JOB_MGR, 'lower-1'), { voNumber: 'VO-011' }))
  await assertFails(updateDoc(await ref(OTHER_MGR, 'lower-1'), { voNumber: 'VO-012' }))
  const tracker = async (uid: string) => doc(await db(uid), 'organizations', ORG, 'variationTrackers', JOB.toLowerCase())
  await assertSucceeds(setDoc(await tracker(JOB_MGR), { parentId: JOB.toLowerCase(), parentType: 'project', orderLocked: false }, { merge: true }))
  await assertFails(setDoc(await tracker(OTHER_MGR), { parentId: JOB.toLowerCase(), parentType: 'project', orderLocked: true }, { merge: true }))
})

test('review MEDIUM 4: while the order is locked nobody renumbers or reorders; edits and removal still work', async () => {
  await assertFails(updateDoc(await ref(ADMIN, 'locked-1'), { voNumber: 'VO-020' }))
  await assertFails(updateDoc(await ref(JOB_MGR, 'locked-1'), { sequence: 4 }))
  await assertSucceeds(updateDoc(await ref(OTHER_MGR, 'locked-1'), { heading: 'Edited while locked' }))
  const lockDoc = async (uid: string) => doc(await db(uid), 'organizations', ORG, 'variationTrackers', 'JOB-L')
  // The job's manager unlocks it; then the renumber passes.
  await assertSucceeds(updateDoc(await lockDoc(JOB_MGR), { orderLocked: false }))
  await assertSucceeds(updateDoc(await ref(JOB_MGR, 'locked-1'), { voNumber: 'VO-020', sequence: 4 }))
  await assertFails(updateDoc(await lockDoc(OTHER_MGR), { orderLocked: true }))
  await assertSucceeds(updateDoc(await lockDoc(ADMIN), { orderLocked: true, orderLockedByUid: ADMIN }))
  await assertSucceeds(updateDoc(await ref(JOB_MGR, 'locked-1'), { isDeleted: true }))
})
