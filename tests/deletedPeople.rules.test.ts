/**
 * Rulebook 1.59.0 §11, §16 (owner decision 17 Nov): `organizations/{orgId}/deletedPeople/{id}` — the small record a
 * person delete keeps so old bookings read "Former: Jane Smith". Created only in the same batch that deletes the
 * person's `users/{id}` (of this organisation) or `operatives/{id}` row — so exactly whoever may run that delete (admins;
 * an operatives manager for an operative) — in its exact shape; read by admins and managers; never updated or deleted
 * by an app; never through the organisation catch-all read. Emulator only.
 *
 *   RULES_PORT=8080 npx tsx --test tests/deletedPeople.rules.test.ts   (with the Firestore emulator running)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { arrayUnion, deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { formerPersonRecordFields } from '../lib/canonical/formerPeople.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-dp'
const OTHER_ORG = 'org-dp-2'
const ADMIN = 'dp-admin'
const MGR = 'dp-mgr'
const OPSMGR = 'dp-opsmgr'
const OP = 'dp-op'
const OP2 = 'dp-op2'
const ROW = 'dp-row'
const STRANGER = 'dp-stranger'

let env: RulesTestEnvironment

async function db(uid: string): Promise<Firestore> {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

function record(deletedBy: string, id: string, extra: Record<string, unknown> = {}) {
  const write = formerPersonRecordFields({ person: { id, firstName: 'Jane', lastName: 'Smith', email: 'jane@test.com' }, deletedBy })!
  return { ...write.fields, deletedAt: serverTimestamp(), ...extra }
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-deleted-people',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT || 8080) },
  })
})

test.after(async () => {
  await env?.cleanup()
})

test.beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG), {
      name: 'Former Co', creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [MGR]: 'manager', [OPSMGR]: 'manager', [OP]: 'operative', [OP2]: 'operative' },
    })
    await setDoc(doc(d, 'organizations', OTHER_ORG), { name: 'Other Co', creatorUserId: STRANGER, members: { [STRANGER]: 'admin' } })
    const user = (id: string, fields: Record<string, unknown>) =>
      setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, passwordSet: true, isActive: true, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(MGR, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(OPSMGR, { role: 'manager', manager: true, operatives: true, assignedManagerUserIds: [ADMIN] })
    await user(OP, { role: 'operative', operativeMode: true, assignedManagerUserIds: [MGR] })
    await user(OP2, { role: 'operative', operativeMode: true, assignedManagerUserIds: [MGR] })
    await setDoc(doc(d, 'users', STRANGER), { email: `${STRANGER}@test.com`, organizationId: OTHER_ORG, passwordSet: true, role: 'admin', adminAccess: true, isSuperAdmin: true })
    await setDoc(doc(d, 'organizations', ORG, 'operatives', ROW), { firstName: 'Row', lastName: 'Only', email: '' })
    await setDoc(doc(d, 'organizations', ORG, 'deletedPeople', 'existing'), { displayName: 'Old Person', email: '', personIds: ['existing'], deletedAt: new Date(), deletedBy: ADMIN })
  })
})

test('an admin writes the record in the batch that deletes the users document', async () => {
  const d = await db(ADMIN)
  const batch = writeBatch(d)
  batch.delete(doc(d, 'users', OP))
  batch.set(doc(d, 'organizations', ORG, 'deletedPeople', OP), record(ADMIN, OP))
  await assertSucceeds(batch.commit())
})

test('an admin writes the record in the batch that deletes a catalogue operatives row', async () => {
  const d = await db(ADMIN)
  const batch = writeBatch(d)
  batch.delete(doc(d, 'organizations', ORG, 'operatives', ROW))
  batch.set(doc(d, 'organizations', ORG, 'deletedPeople', ROW), record(ADMIN, ROW))
  await assertSucceeds(batch.commit())
})

test('an operatives manager writes the record when deleting an operative', async () => {
  const d = await db(OPSMGR)
  const batch = writeBatch(d)
  batch.delete(doc(d, 'users', OP))
  batch.set(doc(d, 'organizations', ORG, 'deletedPeople', OP), record(OPSMGR, OP))
  await assertSucceeds(batch.commit())
})

test('no record without the delete in the same batch, by anyone', async () => {
  for (const uid of [ADMIN, OPSMGR, MGR]) {
    const d = await db(uid)
    await assertFails(setDoc(doc(d, 'organizations', ORG, 'deletedPeople', OP2), record(uid, OP2)))
  }
})

test('a manager without the Operatives permission cannot delete the person, so cannot write the record', async () => {
  const d = await db(MGR)
  const batch = writeBatch(d)
  batch.delete(doc(d, 'users', OP))
  batch.set(doc(d, 'organizations', ORG, 'deletedPeople', OP), record(MGR, OP))
  await assertFails(batch.commit())
})

test('another company cannot write a record here, even when deleting its own person', async () => {
  const d = await db(STRANGER)
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'dp-theirs'), { email: 'dp-theirs@test.com', organizationId: OTHER_ORG, passwordSet: true, role: 'operative', operativeMode: true })
  })
  const batch = writeBatch(d)
  batch.delete(doc(d, 'users', 'dp-theirs'))
  batch.set(doc(d, 'organizations', ORG, 'deletedPeople', 'dp-theirs'), record(STRANGER, 'dp-theirs'))
  await assertFails(batch.commit())
})

test('the record has exactly its shape: deletedBy the caller, deletedAt the request time, its id in personIds', async () => {
  const d = await db(ADMIN)
  const bad = [
    record(ADMIN, OP, { extra: 1 }),
    record(OPSMGR, OP),
    record(ADMIN, OP, { deletedAt: new Date(0) }),
    record(ADMIN, OP, { personIds: ['someone-else'] }),
    record(ADMIN, OP, { displayName: 5 }),
  ]
  for (const fields of bad) {
    const batch = writeBatch(d)
    batch.delete(doc(d, 'users', OP))
    batch.set(doc(d, 'organizations', ORG, 'deletedPeople', OP), fields)
    await assertFails(batch.commit())
  }
})

test('never changed or deleted by an app; read by admins and managers only', async () => {
  const admin = await db(ADMIN)
  await assertFails(updateDoc(doc(admin, 'organizations', ORG, 'deletedPeople', 'existing'), { displayName: 'Changed' }))
  await assertFails(deleteDoc(doc(admin, 'organizations', ORG, 'deletedPeople', 'existing')))
  await assertSucceeds(getDoc(doc(admin, 'organizations', ORG, 'deletedPeople', 'existing')))
  await assertSucceeds(getDocs(collection(await db(MGR), 'organizations', ORG, 'deletedPeople')))
  const op = await db(OP)
  await assertFails(getDoc(doc(op, 'organizations', ORG, 'deletedPeople', 'existing')))
  await assertFails(getDocs(collection(op, 'organizations', ORG, 'deletedPeople')))
  await assertFails(getDoc(doc(await db(STRANGER), 'organizations', ORG, 'deletedPeople', 'existing')))
})

test('Add User link offer: an admin adds a former person\'s ids to a new placeholder; an operatives manager cannot', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'dp-new'), {
      email: 'jane@test.com', organizationId: ORG, passwordSet: false, role: 'operative', operativeMode: true, firstName: 'Jane', surname: 'Smith',
    })
  })
  const link = { formerUserIds: arrayUnion('old-jane', 'PH-OLD'), updatedBy: ADMIN, updatedFrom: 'web', updatedAt: serverTimestamp() }
  await assertSucceeds(updateDoc(doc(await db(ADMIN), 'users', 'dp-new'), link))
  await assertFails(updateDoc(doc(await db(OPSMGR), 'users', 'dp-new'), { ...link, formerUserIds: arrayUnion('x'), updatedBy: OPSMGR }))
})
