/**
 * 17 Nov owner bug: the Super Admin could never be set to PAYE (web Edit User hid Employment type for every Super
 * Admin; iPhone refused the save). This suite checks the security rules accept the Super Admin's own change.
 *
 * What it sends (review of #385: no longer a hand-rebuilt subset). `useUserStore.saveUser` reads `@/lib/firebase/config`
 * (the live app) and cannot be pointed at the emulator, so `replayEditUserSave` below replays, in order, every write
 * Edit User's Save makes (`EditUserProfile.runSave` → `saveUser`, lib/stores/userStore.ts), built with the same helpers:
 *   1. the baseline: the stored users document with the pay profile laid over while `privatePay` is on
 *      (`payEditorStartingValues`, what `payEditorRecord` returns), parsed with `parseOrgUser`;
 *   2. the users partial update (`buildSaveUserPayload` / `changedUserPayload`, `sharedDocumentPayWrite`, write
 *      metadata when the saver is the person or an admin);
 *   3. the pay profile merge (`payProfileWriteFieldsFromProfileWrite`, when `canChangePersonPay`);
 *   4. the `userEmails/{email}` claim;
 *   5. the same-email users documents of this organisation and the `operatives` / `managers` rows on the email
 *      (names only, `identityFields` — copied below from userStore.ts, which is not exported);
 *   6. the `operativeProfiles/{uid}` mirror via `addPartialDocumentToBatch` + `operativeProfileWriteFields`
 *      (a create when it is missing — the Super Admin has none);
 * all in ONE batch, then the follow-up calls `runSave` makes after it:
 *   7. `setUserActive` (`userActiveWrites`, then the membership updates, whose failure is ignored);
 *   8. `saveTaxIds` when VAT / UTR changed (`taxIdsDocumentFields`);
 *   (`syncLinkedOperative` writes only for an operative; the Super Admin is not one.)
 * The iPhone save (`FirebaseBackend.updateUserEmploymentType` → `updateUserDocumentWithPayProfile`) is replayed as
 * that function builds it.
 * Emulator only (own project id).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { claimsContext } from './authClaimsContext.ts'
import { assertLogicalDeny } from './rulesAssert.ts'
import { applyExclusiveRateFields, buildSaveUserPayload, changedUserPayload } from '../lib/firebase/userPayload.ts'
import { addPartialDocumentToBatch } from '../lib/firebase/partialWrite.ts'
import { parseOrgUser } from '../lib/firebase/parseUser.ts'
import { applyEmploymentTypeChange } from '../lib/canonical/userProfile.ts'
import {
  payEditorStartingValues,
  payProfileWriteFieldsFromProfileWrite,
  sharedDocumentPayWrite,
} from '../lib/canonical/payProfile.ts'
import { operativeProfileWriteFields } from '../lib/canonical/operationsDocuments.ts'
import { userActiveWrites } from '../lib/canonical/peopleAccess.ts'
import { canChangePersonPay } from '../lib/canonical/payAccess.ts'
import { taxIdsDocumentFields, writeMetadataFields } from '../lib/canonical/index.ts'
import type { User } from '../types/index.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-sa-emp'
const SUPER = 'sa-emp-super'
const SUPER_COPY = 'sa-emp-super-copy'
const ADMIN = 'sa-emp-admin'
const OP = 'sa-emp-op'

let env: RulesTestEnvironment

const stored: Record<string, Record<string, unknown>> = {
  [SUPER]: {
    email: `${SUPER}@test.com`, organizationId: ORG, firstName: 'Sue', surname: 'Per', role: 'admin', adminAccess: true,
    isSuperAdmin: true, isActive: true, passwordSet: true, annualLeaveSelfBook: true, timesheetSelfSign: true,
    // No employmentType stored: reads as self-employed (§8) — the owner's state.
  },
  // An older users document of the Super Admin on the same email (repeated user-type saves leave these).
  [SUPER_COPY]: {
    email: `${SUPER}@test.com`, organizationId: ORG, firstName: 'Sue', surname: 'Per', role: 'admin', adminAccess: true,
    isActive: true, passwordSet: true,
  },
  [ADMIN]: {
    email: `${ADMIN}@test.com`, organizationId: ORG, firstName: 'Ada', surname: 'Min', role: 'admin', adminAccess: true,
    isActive: true, passwordSet: true, assignedManagerUserIds: [SUPER], assignedManagerUserId: SUPER,
  },
  [OP]: {
    email: `${OP}@test.com`, organizationId: ORG, firstName: 'Op', surname: 'Er', role: 'operative', operativeMode: true,
    isActive: true, passwordSet: true, assignedManagerUserIds: [ADMIN], assignedManagerUserId: ADMIN,
    employmentType: 'self_employed', payBasis: 'day', dayRate: 200,
  },
}

async function seed(privatePay: boolean) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG), {
      name: 'Super Co', creatorUserId: SUPER, members: { [SUPER]: 'admin', [ADMIN]: 'admin', [OP]: 'operative' },
    })
    for (const [id, data] of Object.entries(stored)) {
      await setDoc(doc(d, 'users', id), data)
      if (id !== SUPER_COPY) await setDoc(doc(d, 'organizations', ORG, 'userEmails', `${data.email}`), { userId: id })
    }
    // A managers row on the Super Admin's email (the name sync updates it).
    await setDoc(doc(d, 'organizations', ORG, 'managers', 'mgr-row-super'), { firstName: 'Sue', lastName: 'Per', email: `${SUPER}@test.com` })
    await setDoc(doc(d, 'users', SUPER, 'orgMemberships', ORG), { organizationId: ORG, role: 'admin', accountActive: true })
    await setDoc(doc(d, 'platformConfig', 'app'), { privatePay })
  })
}

async function db(uid: string): Promise<Firestore> {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore() as unknown as Firestore
}

/** userStore.ts `identityFields` (not exported; kept identical). */
function identityFields(user: User): Record<string, unknown> {
  const firstName = user.firstName.trim()
  const surname = user.surname.trim()
  const displayName = `${firstName} ${surname}`.trim()
  return { firstName, surname, lastName: surname, name: displayName, displayName, updatedAt: Timestamp.now() }
}

function isAdmin(user: User): boolean {
  return Boolean(user.isSuperAdmin || user.permissions.adminAccess)
}

/** Every write Edit User's Save makes for `edit` on `subjectId`, in `saveUser`'s order, then its follow-ups. */
async function replayEditUserSave(
  d: Firestore,
  saver: User,
  subjectId: string,
  edit: (user: User) => void,
  privatePay: boolean,
  taxIds?: { utrNumber: string; vatNumber: string }
) {
  // 1. Baseline (`payEditorRecord` → `payEditorStartingValues`).
  const storedSnap = await getDoc(doc(d, 'users', subjectId))
  const storedData = storedSnap.data() as Record<string, unknown>
  const profileSnap = privatePay ? await getDoc(doc(d, 'organizations', ORG, 'payProfiles', subjectId)).catch(() => null) : null
  const record = payEditorStartingValues(storedData, profileSnap?.exists() ? (profileSnap.data() as never) : null, { privatePay }).record
  const baseline = parseOrgUser(subjectId, { ...record, organizationId: ORG })
  const next = parseOrgUser(subjectId, { ...record, organizationId: ORG })
  if (!baseline || !next) throw new Error('parse failed')
  edit(next)
  // 2. Users partial update.
  const full = buildSaveUserPayload(next)
  delete full.organizationId
  Object.assign(full, identityFields(next))
  const before = buildSaveUserPayload(baseline)
  delete before.organizationId
  Object.assign(before, identityFields(baseline))
  const payload = changedUserPayload(full, before)
  payload.updatedAt = serverTimestamp()
  const metadata = writeMetadataFields(saver.id, 'web')
  if (metadata && (saver.id === subjectId || isAdmin(saver))) Object.assign(payload, metadata)
  const payWriter = canChangePersonPay(
    { userId: saver.id, isAdmin: isAdmin(saver), isManager: Boolean(saver.permissions.manager), hasOperativesAccess: Boolean(saver.permissions.operatives), isOperativeMode: Boolean(saver.permissions.operativeMode) },
    { userId: subjectId, isOperative: Boolean(next.permissions.operativeMode || next.role === 'operative') }
  )
  // 5. Same-email users documents of this organisation and the operatives / managers rows on the email.
  const email = next.email.toLowerCase().trim()
  const sameEmail = (await getDocs(query(collection(d, 'users'), where('organizationId', '==', ORG), where('email', '==', email), limit(10))))
    .docs.filter((row) => row.id !== subjectId && (isAdmin(saver) || row.data().passwordSet === true)).map((row) => row.ref)
  const linked = []
  for (const name of ['operatives', 'managers'] as const) {
    for (const row of (await getDocs(collection(d, 'organizations', ORG, name))).docs) {
      if (String(row.data().email || '').trim().toLowerCase() === email) linked.push(row.ref)
    }
  }
  const batch = writeBatch(d)
  batch.update(doc(d, 'users', subjectId), sharedDocumentPayWrite(payload, { privatePay }))
  // 3. Pay profile.
  if (payWriter) {
    const pay = payProfileWriteFieldsFromProfileWrite(subjectId, payload)
    if (pay) batch.set(doc(d, 'organizations', ORG, 'payProfiles', subjectId), { ...pay, ...(metadata || {}), updatedAt: serverTimestamp() }, { merge: true })
  }
  // 4. Email claim.
  if (email) batch.set(doc(d, 'organizations', ORG, 'userEmails', email), { userId: subjectId })
  for (const ref of sameEmail) batch.update(ref, identityFields(next))
  for (const ref of linked) batch.update(ref, identityFields(next))
  // 6. operativeProfiles mirror (created when missing).
  if (payWriter && (next.permissions.operativeMode || next.permissions.manager || next.permissions.adminAccess || next.isSuperAdmin)) {
    const profile: Record<string, unknown> = { userId: subjectId }
    applyExclusiveRateFields(profile, next)
    await addPartialDocumentToBatch(batch, doc(d, 'organizations', ORG, 'operativeProfiles', subjectId), profile, operativeProfileWriteFields, { userId: saver.id })
  }
  await batch.commit()
  // 7. setUserActive (unchanged active flag) — users documents in one batch, then the membership updates.
  const roster = (await getDocs(query(collection(d, 'users'), where('organizationId', '==', ORG)))).docs.map((row) => ({ id: row.id, ...(row.data() as Record<string, unknown>) }))
  const person = roster.find((row) => row.id === subjectId) as Record<string, unknown> | undefined
  const writes = userActiveWrites({
    organizationId: ORG,
    person: { id: subjectId, email: (person?.email as string) ?? null, organizationId: (person?.organizationId as string) ?? null },
    isActive: next.isActive,
    roster: roster.map((row) => ({ id: row.id, email: (row as Record<string, unknown>).email as string, organizationId: (row as Record<string, unknown>).organizationId as string })),
  })
  const activeBatch = writeBatch(d)
  let profileWrites = 0
  for (const write of writes) {
    if (write.kind === 'membership') continue
    activeBatch.update(doc(d, ...(write.path.split('/') as [string, ...string[]])), { ...write.fields, updatedAt: Timestamp.now() })
    profileWrites += 1
  }
  if (profileWrites > 0) await activeBatch.commit()
  for (const write of writes.filter((w) => w.kind === 'membership')) {
    if (!isAdmin(saver)) continue
    await updateDoc(doc(d, ...(write.path.split('/') as [string, ...string[]])), { ...write.fields, updatedAt: Timestamp.now() }).catch(() => undefined)
  }
  // 8. saveTaxIds.
  if (taxIds) {
    const fields = taxIdsDocumentFields({ ...taxIds, updatedByUserId: saver.id })
    if (!fields) throw new Error('no tax fields')
    await setDoc(doc(d, 'users', subjectId, 'private', 'taxIds'), { ...fields, updatedAt: serverTimestamp() })
    await updateDoc(doc(d, 'users', subjectId), { utrNumber: null, vatNumber: null }).catch(() => undefined)
  }
  return payload
}

function toPaye(user: User) {
  // EditUserProfile.runSave: "Immediately" stores today in the organisation zone (rulebook 1.40.0, item 18).
  const change = applyEmploymentTypeChange({ previousType: user.employmentType, nextType: 'paye', effectiveAt: 'immediate', timeZone: 'Europe/London' })
  user.employmentType = change.employmentType
  user.employmentTypeTransitionFrom = change.employmentTypeTransitionFrom || undefined
  user.employmentTypeEffectiveAt = change.employmentTypeEffectiveAt ? new Date(change.employmentTypeEffectiveAt) : undefined
}

function asUser(id: string): User {
  const user = parseOrgUser(id, { ...stored[id] })
  if (!user) throw new Error('parse failed')
  return user
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-sa-employment',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT || 8080) },
  })
})

test.after(async () => {
  await env?.cleanup()
})

for (const privatePay of [false, true]) {
  test(`privatePay ${privatePay ? 'on' : 'off'}: the Super Admin sets their own employment type to PAYE (every write of the Save)`, async () => {
    await env.clearFirestore()
    await seed(privatePay)
    const d = await db(SUPER)
    const payload = await assertSucceeds(replayEditUserSave(d, asUser(SUPER), SUPER, toPaye, privatePay))
    if (!('employmentType' in payload)) throw new Error('the save must carry employmentType')
    // The mirror was created (it did not exist) and the pay profile holds the type while privatePay is on.
    let mirror = false
    await env.withSecurityRulesDisabled(async (ctx) => {
      mirror = (await getDoc(doc(ctx.firestore(), 'organizations', ORG, 'operativeProfiles', SUPER))).exists()
    })
    if (!mirror) throw new Error('the operativeProfiles mirror was not written')
  })

  test(`privatePay ${privatePay ? 'on' : 'off'}: another admin writes the Super Admin's employment type (rules only; neither app offers it)`, async () => {
    await env.clearFirestore()
    await seed(privatePay)
    await assertSucceeds(replayEditUserSave(await db(ADMIN), asUser(ADMIN), SUPER, toPaye, privatePay))
  })
}

test("the Super Admin changes their own annual leave allowance and VAT / UTR (every write of the Save)", async () => {
  await env.clearFirestore()
  await seed(false)
  await assertSucceeds(replayEditUserSave(await db(SUPER), asUser(SUPER), SUPER, (user) => {
    user.annualLeaveEnabled = true
    user.annualLeaveDaysPerYear = 28
  }, false, { utrNumber: '1234567890', vatNumber: 'GB123456789' }))
})

test('unchanged guard: an operative still cannot set their own employment type', async () => {
  await env.clearFirestore()
  await seed(false)
  await assertLogicalDeny(replayEditUserSave(await db(OP), asUser(OP), OP, toPaye, false))
})

for (const privatePay of [false, true]) {
  test(`privatePay ${privatePay ? 'on' : 'off'}: the Super Admin's own change as iOS sends it (FirebaseBackend.updateUserEmploymentType)`, async () => {
    await env.clearFirestore()
    await seed(privatePay)
    const d = await db(SUPER)
    const change = applyEmploymentTypeChange({ previousType: undefined, nextType: 'paye', effectiveAt: 'immediate', timeZone: 'Europe/London' })
    const payload: Record<string, unknown> = {
      employmentType: 'paye',
      employmentTypeTransitionFrom: change.employmentTypeTransitionFrom,
      employmentTypeEffectiveAt: Timestamp.fromDate(new Date(change.employmentTypeEffectiveAt as never)),
      timesheetsEnabled: false,
      updatedAt: Timestamp.now(),
    }
    const batch = writeBatch(d)
    const shared = sharedDocumentPayWrite(payload, { privatePay })
    if (Object.keys(shared).some((key) => !['updatedAt', 'updatedBy', 'updatedFrom'].includes(key))) {
      batch.update(doc(d, 'users', SUPER), shared)
    }
    const pay = payProfileWriteFieldsFromProfileWrite(SUPER, payload)
    if (!pay) throw new Error('no pay profile write')
    batch.set(doc(d, 'organizations', ORG, 'payProfiles', SUPER), { ...pay, updatedAt: serverTimestamp(), updatedBy: SUPER, updatedFrom: 'ios' }, { merge: true })
    await assertSucceeds(batch.commit())
  })
}

test("the Super Admin's own leave allowance change as iOS sends it (only the changed figure, FirebaseBackend.updateAnnualLeaveEntitlement)", async () => {
  await env.clearFirestore()
  await seed(false)
  const d = await db(SUPER)
  await assertSucceeds(updateDoc(doc(d, 'users', SUPER), { annualLeaveCarriesOver: true, updatedAt: Timestamp.now() }))
  await assertSucceeds(updateDoc(doc(d, 'users', SUPER), { annualLeaveEnabled: true, updatedAt: Timestamp.now() }))
})
