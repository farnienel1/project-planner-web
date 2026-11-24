/**
 * Rulebook 1.81.0 §11, §16 (owner decision 24 Nov): `organizations/{orgId}/memberNames/{uid}` — a person's name in
 * one organisation. Read by every member of that organisation (the organisation catch-all read); written (set or
 * delete) only by that organisation's admins, the person themself, or the platform owner; only `firstName`
 * (1–100 characters, not blank), `surname` (0–100) and write metadata; `updatedBy` is the writer. Another company's
 * admin, a manager (Operatives permission or not) and an operative writing someone else's entry are refused.
 * Emulator only.
 *
 *   RULES_PORT=8080 npx tsx --test tests/memberNames.rules.test.ts   (with the Firestore emulator running)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { deleteDoc, doc, getDoc, getDocs, collection, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { memberNameWriteFields } from '../lib/canonical/memberNames.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-mn'
const HOME = 'org-mn-home'
const ADMIN = 'mn-admin'
const OPSMGR = 'mn-opsmgr'
const MGR = 'mn-mgr'
const OP = 'mn-op'
const VISITOR = 'mn-visitor' // home company HOME, a manager in ORG through the members map
const STRANGER = 'mn-stranger' // admin of HOME only
const VADMIN = 'mn-vadmin' // home company HOME, an admin of ORG through the members map only

let env: RulesTestEnvironment

async function db(uid: string, email = `${uid}@test.com`): Promise<Firestore> {
  return (await claimsContext(env, uid, { email })).firestore()
}

function entry(writer: string, firstName = 'Farns', surname = 'Nel') {
  return { ...memberNameWriteFields({ firstName, surname, writerUserId: writer, platform: 'web' })!, updatedAt: serverTimestamp() }
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-member-names',
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
      name: 'Names Co', creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [OPSMGR]: 'manager', [MGR]: 'manager', [OP]: 'operative', [VISITOR]: 'manager', [VADMIN]: 'admin' },
    })
    await setDoc(doc(d, 'organizations', HOME), { name: 'Home Co', creatorUserId: STRANGER, members: { [STRANGER]: 'admin', [VISITOR]: 'manager', [VADMIN]: 'manager' } })
    const user = (id: string, fields: Record<string, unknown>) =>
      setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, passwordSet: true, isActive: true, firstName: 'First', surname: id, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(OPSMGR, { role: 'manager', manager: true, operatives: true, assignedManagerUserIds: [ADMIN] })
    await user(MGR, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(OP, { role: 'operative', operativeMode: true, assignedManagerUserIds: [MGR] })
    await user(VISITOR, { role: 'manager', manager: true, organizationId: HOME, firstName: 'Farnie', surname: 'Nel' })
    await user(VADMIN, { role: 'manager', manager: true, organizationId: HOME })
    await user(STRANGER, { role: 'admin', adminAccess: true, isSuperAdmin: true, organizationId: HOME })
    await setDoc(doc(d, 'organizations', ORG, 'memberNames', OP), { firstName: 'Ollie', surname: 'Op' })
  })
})

const ref = (d: Firestore, uid: string, org = ORG) => doc(d, 'organizations', org, 'memberNames', uid)

test('every member of the organisation reads the entries', async () => {
  for (const uid of [ADMIN, MGR, OP, VISITOR]) {
    const d = await db(uid)
    await assertSucceeds(getDoc(ref(d, OP)))
    await assertSucceeds(getDocs(collection(d, 'organizations', ORG, 'memberNames')))
  }
})

test('another company cannot read the entries', async () => {
  await assertFails(getDoc(ref(await db(STRANGER), OP)))
})

test('an admin of the organisation writes and removes anyone\'s entry', async () => {
  const d = await db(ADMIN)
  await assertSucceeds(setDoc(ref(d, VISITOR), entry(ADMIN)))
  await assertSucceeds(deleteDoc(ref(d, VISITOR)))
  await assertSucceeds(setDoc(ref(d, OP), entry(ADMIN, 'Oliver', 'Op')))
})

test('a members-list-only admin (home company elsewhere) writes and removes anyone\'s entry here', async () => {
  const d = await db(VADMIN)
  await assertSucceeds(setDoc(ref(d, VISITOR), entry(VADMIN)))
  await assertSucceeds(deleteDoc(ref(d, VISITOR)))
  await assertSucceeds(setDoc(ref(d, OP), entry(VADMIN, 'Oliver', 'Op')))
  await assertFails(setDoc(ref(d, STRANGER, HOME), entry(VADMIN)))
})

test('a person writes and removes their own entry (a member from another company too)', async () => {
  await assertSucceeds(setDoc(ref(await db(VISITOR), VISITOR), entry(VISITOR)))
  await assertSucceeds(deleteDoc(ref(await db(VISITOR), VISITOR)))
  await assertSucceeds(setDoc(ref(await db(OP), OP), entry(OP, 'Olly', '')))
})

test('a manager, an Operatives manager and an operative cannot write someone else\'s entry', async () => {
  for (const uid of [MGR, OPSMGR, VISITOR]) {
    await assertFails(setDoc(ref(await db(uid), OP), entry(uid)))
    await assertFails(deleteDoc(ref(await db(uid), OP)))
  }
  await assertFails(setDoc(ref(await db(OP), MGR), entry(OP)))
})

test('another company\'s admin cannot write here, even their own member\'s entry', async () => {
  await assertFails(setDoc(ref(await db(STRANGER), VISITOR), entry(STRANGER)))
  await assertFails(setDoc(ref(await db(STRANGER), STRANGER), entry(STRANGER)))
})

test('the platform owner writes an entry', async () => {
  const owner = (await claimsContext(env, 'mn-owner', { email: 'info@projectplanner.us', email_verified: true })).firestore()
  await assertSucceeds(setDoc(ref(owner, VISITOR), entry('mn-owner')))
  await assertSucceeds(deleteDoc(ref(owner, VISITOR)))
})

test('only the name fields and write metadata, a non-blank first name, at most 100 characters, the writer as updatedBy', async () => {
  const d = await db(ADMIN)
  await assertFails(setDoc(ref(d, VISITOR), { ...entry(ADMIN), role: 'admin' }))
  await assertFails(setDoc(ref(d, VISITOR), { ...entry(ADMIN), firstName: '   ' }))
  await assertFails(setDoc(ref(d, VISITOR), { ...entry(ADMIN), firstName: 'x'.repeat(101) }))
  await assertFails(setDoc(ref(d, VISITOR), { ...entry(ADMIN), surname: 'y'.repeat(101) }))
  await assertFails(setDoc(ref(d, VISITOR), { ...entry(ADMIN), surname: 7 }))
  await assertFails(setDoc(ref(d, VISITOR), { ...entry(ADMIN), updatedBy: OP }))
  await assertSucceeds(setDoc(ref(d, VISITOR), { firstName: 'Farns' }))
})

test('the 1.81.0 read clean-up keeps every organisation list readable to members (catch-all read)', async () => {
  const d = await db(OP)
  for (const name of ['operatives', 'managers', 'tasks', 'qualifications', 'skills', 'materials', 'materialCatalogue', 'wholesalers', 'acceptedBookingClashes', 'warningResolutions', 'dismissedWarnings', 'dashboardLayouts', 'deletedBookings']) {
    await assertSucceeds(getDocs(collection(d, 'organizations', ORG, name)))
  }
  await assertFails(getDocs(collection(await db(STRANGER), 'organizations', ORG, 'operatives')))
})
