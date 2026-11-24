/**
 * Rulebook 1.83.0 §31 (owner decisions 24 Nov: admins only): `organizations/{orgId}/orgCompliance/documents` — the
 * organisation's insurance & accreditations — is read and written only by an admin of that organisation (the `E`
 * claim, billing open), never by a manager, an operative or another company's admin, and the organisation catch-all
 * read never re-opens it. Emulator only.
 *
 *   RULES_PORT=8080 npx tsx --test tests/orgCompliance.rules.test.ts   (with the Firestore emulator running)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { deleteDoc, doc, getDoc, runTransaction, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore'
import { orgComplianceAddWriteFields, orgComplianceMergePayload } from '../lib/canonical/orgCompliance.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-oc'
const HOME = 'org-oc-home'
const ADMIN = 'oc-admin'
const MGR = 'oc-mgr'
const OPSMGR = 'oc-opsmgr'
const OP = 'oc-op'
const STRANGER = 'oc-stranger' // admin of HOME only
const VADMIN = 'oc-vadmin' // home company HOME, an admin of ORG through the members map only
const OPADMIN = 'oc-opadmin' // admin with a stray operativeMode flag (still an admin, rulebook 1.11.0)
const DEADMIN = 'oc-deadmin' // admin whose users document of ORG says isActive: false
const GONEADMIN = 'oc-goneadmin' // admin of ORG through the members map, membership there accountActive: false

let env: RulesTestEnvironment

async function db(uid: string): Promise<Firestore> {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

function payload(uid: string, ms: number) {
  const plan = orgComplianceAddWriteFields(null, {
    section: 'insurance',
    organizationId: ORG,
    todayKey: '2026-11-24',
    details: { docType: 'public_liability', title: 'Public liability', expiresOn: '2027-03-31' },
    file: { path: `organizations/${ORG}/compliance/${uid}_${ms}.pdf`, fileName: 'pl.pdf', contentType: 'application/pdf', sizeBytes: 10, uploadedAtMs: ms, uploadedBy: uid },
  })
  return { ...orgComplianceMergePayload(plan.set!), updatedAt: serverTimestamp(), updatedBy: uid, updatedFrom: 'web' }
}

const ref = (d: Firestore, org = ORG) => doc(d, 'organizations', org, 'orgCompliance', 'documents')

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-org-compliance',
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
      name: 'Compliance Co', creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [MGR]: 'manager', [OPSMGR]: 'manager', [OP]: 'operative', [VADMIN]: 'admin', [OPADMIN]: 'admin', [DEADMIN]: 'admin', [GONEADMIN]: 'admin' },
    })
    await setDoc(doc(d, 'organizations', HOME), { name: 'Home Co', creatorUserId: STRANGER, members: { [STRANGER]: 'admin', [VADMIN]: 'manager' } })
    const user = (id: string, fields: Record<string, unknown>) =>
      setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, passwordSet: true, isActive: true, firstName: 'F', surname: id, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(MGR, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(OPSMGR, { role: 'manager', manager: true, operatives: true, assignedManagerUserIds: [ADMIN] })
    await user(OP, { role: 'operative', operativeMode: true, assignedManagerUserIds: [MGR] })
    await user(VADMIN, { role: 'manager', manager: true, organizationId: HOME })
    await user(STRANGER, { role: 'admin', adminAccess: true, isSuperAdmin: true, organizationId: HOME })
    await user(OPADMIN, { role: 'admin', adminAccess: true, operativeMode: true })
    await user(DEADMIN, { role: 'admin', adminAccess: true, isActive: false })
    await user(GONEADMIN, { role: 'manager', manager: true, organizationId: HOME })
    await setDoc(doc(d, 'users', GONEADMIN, 'orgMemberships', ORG), { organizationId: ORG, role: 'admin', accountActive: false })
    await setDoc(ref(d), payload(ADMIN, 1))
  })
})

test('an admin of the organisation reads and writes it (also through a transaction, as the apps do)', async () => {
  const d = await db(ADMIN)
  await assertSucceeds(getDoc(ref(d)))
  await assertSucceeds(setDoc(ref(d), payload(ADMIN, 2), { merge: true }))
  await assertSucceeds(
    runTransaction(d, async (t) => {
      await t.get(ref(d))
      t.set(ref(d), payload(ADMIN, 3), { merge: true })
    })
  )
  // Nobody deletes the whole document (it would orphan the files); entries are removed one by one.
  await assertFails(deleteDoc(ref(d)))
})

test('an admin through the members map (home company elsewhere) reads and writes it', async () => {
  const d = await db(VADMIN)
  await assertSucceeds(getDoc(ref(d)))
  await assertSucceeds(setDoc(ref(d), payload(VADMIN, 4), { merge: true }))
})

test('managers, operatives and another company\'s admin never read or write it', async () => {
  for (const uid of [MGR, OPSMGR, OP, STRANGER]) {
    const d = await db(uid)
    await assertFails(getDoc(ref(d)))
    await assertFails(setDoc(ref(d), payload(uid, 5), { merge: true }))
    await assertFails(deleteDoc(ref(d)))
  }
})

test('a lapsed subscription closes it for the admin too', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG), { billing: { accessOpen: false } }, { merge: true })
  })
  const d = await db(ADMIN)
  await assertFails(getDoc(ref(d)))
  await assertFails(setDoc(ref(d), payload(ADMIN, 6), { merge: true }))
})

test('review of #441: only the documents id, only documents / updatedAt / write metadata', async () => {
  const d = await db(ADMIN)
  await assertFails(setDoc(doc(d, 'organizations', ORG, 'orgCompliance', 'other'), payload(ADMIN, 7)))
  await assertFails(getDoc(doc(d, 'organizations', ORG, 'orgCompliance', 'other')))
  await assertFails(setDoc(ref(d), { ...payload(ADMIN, 8), extra: true }, { merge: true }))
  await assertSucceeds(setDoc(ref(d), payload(ADMIN, 9)))
})

test('review of #441: an admin with a stray operative-mode flag is an admin (as Storage and the rulebook)', async () => {
  const d = await db(OPADMIN)
  await assertSucceeds(getDoc(ref(d)))
  await assertSucceeds(setDoc(ref(d), payload(OPADMIN, 10), { merge: true }))
})

test('review of #441: a deactivated admin (users document or membership) reads and writes nothing', async () => {
  for (const uid of [DEADMIN, GONEADMIN]) {
    const d = await db(uid)
    await assertFails(getDoc(ref(d)))
    await assertFails(setDoc(ref(d), payload(uid, 11), { merge: true }))
  }
})

test('review of #441: a company scheduled for deletion closes it for its admin', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG), { deletion: { status: 'scheduled' } }, { merge: true })
  })
  const d = await db(ADMIN)
  await assertFails(getDoc(ref(d)))
  await assertFails(setDoc(ref(d), payload(ADMIN, 12), { merge: true }))
})
