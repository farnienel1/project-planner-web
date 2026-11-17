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

/** The record the apps write for a deleted document (`formerPersonRecordFields` of that document), plus overrides. */
function record(deletedBy: string, person: Record<string, unknown> & { id: string }, extra: Record<string, unknown> = {}) {
  const write = formerPersonRecordFields({ person: person as never, deletedBy })!
  return { ...write.fields, deletedAt: serverTimestamp(), ...extra }
}
const OP_DOC = { firstName: 'Ollie', surname: 'Op', email: `${OP}@test.com` }
const opRecord = (by: string, extra: Record<string, unknown> = {}) => record(by, { id: OP, ...OP_DOC }, extra)

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
    await user(OP, { role: 'operative', operativeMode: true, assignedManagerUserIds: [MGR], ...OP_DOC })
    await user(OP2, { role: 'operative', operativeMode: true, assignedManagerUserIds: [MGR] })
    await setDoc(doc(d, 'users', STRANGER), { email: `${STRANGER}@test.com`, organizationId: OTHER_ORG, passwordSet: true, role: 'admin', adminAccess: true, isSuperAdmin: true })
    await setDoc(doc(d, 'organizations', ORG, 'operatives', ROW), { firstName: 'Row', lastName: 'Only', email: '' })
    await setDoc(doc(d, 'organizations', ORG, 'deletedPeople', 'existing'), { displayName: 'Old Person', email: '', personIds: ['existing'], deletedAt: new Date(), deletedBy: ADMIN })
  })
})

async function deleteWith(uid: string, path: string[], recordId: string, fields: Record<string, unknown>) {
  const d = await db(uid)
  const batch = writeBatch(d)
  batch.delete(doc(d, path[0], ...path.slice(1)))
  batch.set(doc(d, 'organizations', ORG, 'deletedPeople', recordId), fields)
  return batch.commit()
}

test('an admin writes the record in the batch that deletes the users document', async () => {
  await assertSucceeds(deleteWith(ADMIN, ['users', OP], OP, opRecord(ADMIN)))
})

test('an admin writes the record in the batch that deletes a catalogue operatives row', async () => {
  await assertSucceeds(deleteWith(ADMIN, ['organizations', ORG, 'operatives', ROW], ROW, record(ADMIN, { id: ROW, firstName: 'Row', lastName: 'Only', email: '' })))
})

test('an operatives manager writes the record when deleting an operative', async () => {
  await assertSucceeds(deleteWith(OPSMGR, ['users', OP], OP, opRecord(OPSMGR)))
})

test('no record without the delete in the same batch, by anyone', async () => {
  for (const uid of [ADMIN, OPSMGR, MGR]) {
    const d = await db(uid)
    await assertFails(setDoc(doc(d, 'organizations', ORG, 'deletedPeople', OP2), record(uid, { id: OP2, email: `${OP2}@test.com` })))
  }
})

test('a manager without the Operatives permission cannot delete the person, so cannot write the record', async () => {
  await assertFails(deleteWith(MGR, ['users', OP], OP, opRecord(MGR)))
})

test('another company cannot write a record here, even when deleting its own person', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', 'dp-theirs'), { email: 'dp-theirs@test.com', organizationId: OTHER_ORG, passwordSet: true, role: 'operative', operativeMode: true })
  })
  const d = await db(STRANGER)
  const batch = writeBatch(d)
  batch.delete(doc(d, 'users', 'dp-theirs'))
  batch.set(doc(d, 'organizations', ORG, 'deletedPeople', 'dp-theirs'), record(STRANGER, { id: 'dp-theirs', email: 'dp-theirs@test.com' }))
  await assertFails(batch.commit())
})

test('the record has exactly its shape: deletedBy the caller, deletedAt the request time, its id in personIds', async () => {
  for (const fields of [
    opRecord(ADMIN, { extra: 1 }),
    opRecord(OPSMGR),
    opRecord(ADMIN, { deletedAt: new Date(0) }),
    opRecord(ADMIN, { personIds: ['someone-else'] }),
    opRecord(ADMIN, { displayName: 5 }),
  ]) {
    await assertFails(deleteWith(ADMIN, ['users', OP], OP, fields))
  }
})

test('review M1: the record is tied to the deleted users document — no forged email, name or ids', async () => {
  for (const fields of [
    opRecord(ADMIN, { email: 'boss@elsewhere.test' }),
    opRecord(ADMIN, { displayName: 'Someone Else' }),
    opRecord(ADMIN, { personIds: [OP, ADMIN] }),
  ]) {
    await assertFails(deleteWith(ADMIN, ['users', OP], OP, fields))
  }
  // Anonymised (no name, no email) is always allowed.
  await assertSucceeds(deleteWith(ADMIN, ['users', OP], OP, opRecord(ADMIN, { displayName: 'Deleted user', email: '' })))
})

test('review M1: an operatives manager deleting a row linked to an admin cannot forge its email or ids', async () => {
  const LINKED = 'dp-row-linked'
  const rowDoc = { firstName: 'Ada', lastName: 'Admin', email: `${ADMIN}@test.com`, linkedUserId: ADMIN }
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG, 'operatives', LINKED), rowDoc)
  })
  const path = ['organizations', ORG, 'operatives', LINKED]
  const honest = record(OPSMGR, { id: LINKED, ...rowDoc, linkedIds: [ADMIN] })
  await assertFails(deleteWith(OPSMGR, path, LINKED, { ...honest, personIds: [LINKED, ADMIN, OP2] }))
  await assertFails(deleteWith(OPSMGR, path, LINKED, { ...honest, personIds: [LINKED, OP2] }))
  await assertFails(deleteWith(OPSMGR, path, LINKED, { ...honest, email: `${OP2}@test.com` }))
  await assertFails(deleteWith(OPSMGR, path, LINKED, { ...honest, displayName: 'Ollie Op' }))
  // Only what the row itself holds.
  await assertSucceeds(deleteWith(OPSMGR, path, LINKED, honest))
})

test('review M1: deleting an invitee placeholder cannot forge its record', async () => {
  const PH = 'dp-placeholder'
  const phDoc = { email: 'invitee@test.com', organizationId: ORG, passwordSet: false, role: 'operative', operativeMode: true, firstName: 'Ivy', surname: 'Invitee', formerUserIds: ['old-ph'] }
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', PH), phDoc)
  })
  const honest = record(ADMIN, { id: PH, ...phDoc })
  await assertFails(deleteWith(ADMIN, ['users', PH], PH, { ...honest, email: 'someone@test.com' }))
  await assertFails(deleteWith(ADMIN, ['users', PH], PH, { ...honest, personIds: [PH, 'old-ph', OP2] }))
  await assertSucceeds(deleteWith(ADMIN, ['users', PH], PH, honest))
})

// Review L1: the record compares the users document's organisation with `homeOrgIs` (id, path and case forms). The users
// delete rule itself accepts only a document whose `organizationId` matches exactly (a path-form document's delete is
// refused before the record is judged), so no batch reaches the record rule with another form; nothing to test here.

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

test('review L2: materialContacts — staff create an address once, with only the server time; nobody changes it', async () => {
  const ref = (d: Firestore, key: string) => doc(d, 'organizations', ORG, 'materialContacts', key)
  await assertSucceeds(setDoc(ref(await db(MGR), 'new@wholesale.test'), { firstSentAt: serverTimestamp() }))
  await assertSucceeds(setDoc(ref(await db(ADMIN), 'two@wholesale.test'), { firstSentAt: serverTimestamp() }))
  await assertFails(setDoc(ref(await db(OP), 'op@wholesale.test'), { firstSentAt: serverTimestamp() }))
  await assertFails(setDoc(ref(await db(MGR), 'x@wholesale.test'), { firstSentAt: serverTimestamp(), note: 'hi' }))
  await assertFails(setDoc(ref(await db(MGR), 'y@wholesale.test'), { firstSentAt: new Date(0) }))
  await assertFails(setDoc(ref(await db(MGR), 'new@wholesale.test'), { firstSentAt: serverTimestamp() }))
  await assertFails(deleteDoc(ref(await db(ADMIN), 'new@wholesale.test')))
  await assertFails(setDoc(ref(await db(STRANGER), 'z@wholesale.test'), { firstSentAt: serverTimestamp() }))
  await assertSucceeds(getDoc(ref(await db(MGR), 'new@wholesale.test')))
})
