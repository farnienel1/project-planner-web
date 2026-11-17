/**
 * Rulebook 1.63.0 §22 (owner decision 17 Nov, B / bug C): a Submitted or Closed variation that is changed back to
 * Open is no longer pinned. The reopen write clears `voNumberLocked` with the status (`variationStatusWriteFields`),
 * so the next renumber is accepted; a variation still Submitted (or Closed) keeps its number.
 *
 * Root cause of bug C (17 Nov): web `setVariationStatus` set `voNumberLocked: true` on Submit and kept it on reopen.
 * The security rules refuse a VO number change while the STORED `voNumberLocked` is true, so the tracker's renumber
 * transaction was refused with "Missing or insufficient permissions". The first test reproduces it.
 *
 *   firebase emulators:exec --only firestore "tsx --test tests/variationReopen.rules.test.ts"
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { doc, runTransaction, setDoc, updateDoc } from 'firebase/firestore'
import { variationStatusWriteFields } from '../lib/canonical/variations.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-vo-reopen'
const ADMIN = 'vr-admin'
const JOB = 'JOB-R'

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
    statusHistory: [],
    ...extra,
  }
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-variations-reopen',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080) },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    await setDoc(doc(fs, 'organizations', ORG), { name: 'Reopen Ltd', creatorUserId: ADMIN, members: { [ADMIN]: 'admin' } })
    await setDoc(doc(fs, 'users', ADMIN), { email: `${ADMIN}@test.com`, organizationId: ORG, role: 'admin', adminAccess: true, isSuperAdmin: true, passwordSet: true })
    await setDoc(doc(fs, 'organizations', ORG, 'projects', JOB), { jobNumber: 'C646', managerIds: [ADMIN], managerUserIds: [ADMIN] })
    await setDoc(doc(fs, 'organizations', ORG, 'variationTrackers', JOB), { parentId: JOB, parentType: 'project', enabled: true, version: 1 })
    await setDoc(doc(fs, 'organizations', ORG, 'variations', 'old-way'), variation('old-way', { voNumber: 'VO-003', sequence: 3 }))
    await setDoc(doc(fs, 'organizations', ORG, 'variations', 'new-way'), variation('new-way', { voNumber: 'VO-004', sequence: 4 }))
    await setDoc(doc(fs, 'organizations', ORG, 'variations', 'stays-sub'), variation('stays-sub', { voNumber: 'VO-005', sequence: 5 }))
  })
})

test.after(async () => {
  await env.cleanup()
})

const ref = async (id: string) => doc(await db(ADMIN), 'organizations', ORG, 'variations', id)

test('bug C reproduced: a reopen that keeps the stored lock (web before 1.63.0) makes the renumber refused', async () => {
  // Submit as web did before 1.63.0, then reopen keeping voNumberLocked: true.
  await assertSucceeds(updateDoc(await ref('old-way'), { status: 'submitted', voNumberLocked: true }))
  await assertSucceeds(updateDoc(await ref('old-way'), { status: 'open', voNumberLocked: true }))
  // The tracker's renumber transaction: refused because the stored lock is still true.
  await assertFails(
    (async () => {
      const fs = await db(ADMIN)
      const r = doc(fs, 'organizations', ORG, 'variations', 'old-way')
      return runTransaction(fs, async (tx) => {
      await tx.get(r)
      tx.update(r, { voNumber: 'VO-007', sequence: 7, numberHistory: [{ from: 'VO-003', to: 'VO-007' }] })
      })
    })()
  )
  // Repair (1.63.0, `variationStaleNumberLocks`): clearing the stale lock on its own is allowed, then the renumber passes.
  await assertSucceeds(updateDoc(await ref('old-way'), { voNumberLocked: false }))
  await assertSucceeds(updateDoc(await ref('old-way'), { voNumber: 'VO-007', sequence: 7, numberHistory: [{ from: 'VO-003', to: 'VO-007' }] }))
})

test('1.63.0: submit, reopen (lock cleared in the same write), then renumber is accepted', async () => {
  const submit = variationStatusWriteFields('submitted')
  await assertSucceeds(updateDoc(await ref('new-way'), submit))
  // While submitted the number is pinned.
  await assertFails(updateDoc(await ref('new-way'), { voNumber: 'VO-008' }))
  const reopen = variationStatusWriteFields('open')
  await assertSucceeds(updateDoc(await ref('new-way'), reopen))
  await assertSucceeds(
    (async () => {
      const fs = await db(ADMIN)
      const r = doc(fs, 'organizations', ORG, 'variations', 'new-way')
      return runTransaction(fs, async (tx) => {
      await tx.get(r)
      tx.update(r, { voNumber: 'VO-008', sequence: 8, numberHistory: [{ from: 'VO-004', to: 'VO-008' }] })
      })
    })()
  )
})

test('1.63.0: a variation still submitted (or closed) is still refused a new number', async () => {
  await assertSucceeds(updateDoc(await ref('stays-sub'), variationStatusWriteFields('submitted')))
  await assertFails(updateDoc(await ref('stays-sub'), { voNumber: 'VO-009' }))
  await assertSucceeds(updateDoc(await ref('stays-sub'), variationStatusWriteFields('closed')))
  await assertFails(updateDoc(await ref('stays-sub'), { voNumber: 'VO-009' }))
  // Moving it in sequence is still allowed (unchanged).
  await assertSucceeds(updateDoc(await ref('stays-sub'), { sequence: 9 }))
})

test('a renumber transaction that reads a variation with no variations/{id} document (settings copy only) is refused by the read rule', async () => {
  const fs = await db(ADMIN)
  const missing = doc(fs, 'organizations', ORG, 'variations', 'settings-only-row')
  await assertFails(runTransaction(fs, async (tx) => {
    await tx.get(missing)
  }))
})
