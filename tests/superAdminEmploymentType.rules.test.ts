/**
 * 17 Nov owner bug: the Super Admin could never be set to PAYE (web Edit User hid Employment type for every Super
 * Admin). This suite sends the exact batch web Edit User's Save sends (`useUserStore.saveUser`: the users partial
 * update from `buildSaveUserPayload` / `changedUserPayload`, the pay profile half `payProfileWriteFieldsFromProfileWrite`,
 * the `userEmails` claim) and checks the security rules accept it:
 *   - the Super Admin changing their own employment type (rulebook §8 `canChangePersonPay`: an admin may, including
 *     their own pay; firestore.rules `selfUpdateKeepsManagedFields` with `admin` true), with `privatePay` off and on;
 *   - the Super Admin changing their own leave allowance;
 *   - another admin changing the Super Admin's employment type (rulebook §16: an admin who is not the Super Admin never
 *     changes the Super Admin's role, permissions, active flag or company — names and other fields stay editable).
 *     Web does not offer this today (`canEditTargetUser` keeps the Super Admin's page to the Super Admin); the test
 *     records what the rules allow.
 * Emulator only (own project id).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, serverTimestamp, setDoc, Timestamp, writeBatch, type Firestore } from 'firebase/firestore'
import { claimsContext } from './authClaimsContext.ts'
import { assertLogicalDeny } from './rulesAssert.ts'
import { buildSaveUserPayload, changedUserPayload } from '../lib/firebase/userPayload.ts'
import { parseOrgUser } from '../lib/firebase/parseUser.ts'
import { applyEmploymentTypeChange } from '../lib/canonical/userProfile.ts'
import { payProfileWriteFieldsFromProfileWrite, sharedDocumentPayWrite } from '../lib/canonical/payProfile.ts'
import { writeMetadataFields } from '../lib/canonical/index.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-sa-emp'
const SUPER = 'sa-emp-super'
const ADMIN = 'sa-emp-admin'
const OP = 'sa-emp-op'

let env: RulesTestEnvironment

const stored: Record<string, Record<string, unknown>> = {
  [SUPER]: {
    email: `${SUPER}@test.com`, organizationId: ORG, firstName: 'Sue', surname: 'Per', role: 'admin', adminAccess: true,
    isSuperAdmin: true, isActive: true, passwordSet: true, annualLeaveSelfBook: true, timesheetSelfSign: true,
    // No employmentType stored: reads as self-employed (§8) — the owner's state.
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
      await setDoc(doc(d, 'organizations', ORG, 'userEmails', `${id}@test.com`), { userId: id })
    }
    await setDoc(doc(d, 'platformConfig', 'app'), { privatePay })
  })
}

async function db(uid: string): Promise<Firestore> {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore() as unknown as Firestore
}

/** The batch web Edit User's Save writes for `edit` on `subjectId`, as `saveUser` builds it. */
function editUserSave(d: Firestore, writerId: string, subjectId: string, edit: (user: NonNullable<ReturnType<typeof parseOrgUser>>) => void, privatePay: boolean) {
  const baseline = parseOrgUser(subjectId, { ...stored[subjectId] })
  const next = parseOrgUser(subjectId, { ...stored[subjectId] })
  if (!baseline || !next) throw new Error('parse failed')
  edit(next)
  const payload = changedUserPayload(buildSaveUserPayload(next), buildSaveUserPayload(baseline))
  delete payload.organizationId
  payload.updatedAt = serverTimestamp()
  Object.assign(payload, writeMetadataFields(writerId, 'web'))
  const batch = writeBatch(d)
  batch.update(doc(d, 'users', subjectId), sharedDocumentPayWrite(payload, { privatePay }))
  const pay = payProfileWriteFieldsFromProfileWrite(subjectId, payload)
  if (pay) {
    batch.set(
      doc(d, 'organizations', ORG, 'payProfiles', subjectId),
      { ...pay, ...writeMetadataFields(writerId, 'web'), updatedAt: serverTimestamp() },
      { merge: true }
    )
  }
  batch.set(doc(d, 'organizations', ORG, 'userEmails', `${subjectId}@test.com`), { userId: subjectId })
  return { batch, payload }
}

function toPaye(user: NonNullable<ReturnType<typeof parseOrgUser>>) {
  // EditUserProfile.runSave: "Immediately" stores today in the organisation zone (rulebook 1.40.0, item 18).
  const change = applyEmploymentTypeChange({ previousType: user.employmentType, nextType: 'paye', effectiveAt: 'immediate', timeZone: 'Europe/London' })
  user.employmentType = change.employmentType
  user.employmentTypeTransitionFrom = change.employmentTypeTransitionFrom || undefined
  user.employmentTypeEffectiveAt = change.employmentTypeEffectiveAt ? new Date(change.employmentTypeEffectiveAt) : undefined
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
  test(`privatePay ${privatePay ? 'on' : 'off'}: the Super Admin sets their own employment type to PAYE (the screen's batch)`, async () => {
    await env.clearFirestore()
    await seed(privatePay)
    const { batch, payload } = editUserSave(await db(SUPER), SUPER, SUPER, toPaye, privatePay)
    if (!('employmentType' in payload)) throw new Error('the save must carry employmentType')
    await assertSucceeds(batch.commit())
  })

  test(`privatePay ${privatePay ? 'on' : 'off'}: another admin sets the Super Admin's employment type (rules only; web does not offer it)`, async () => {
    await env.clearFirestore()
    await seed(privatePay)
    const { batch } = editUserSave(await db(ADMIN), ADMIN, SUPER, toPaye, privatePay)
    await assertSucceeds(batch.commit())
  })
}

test("the Super Admin changes their own annual leave allowance (the screen's batch)", async () => {
  await env.clearFirestore()
  await seed(false)
  const { batch } = editUserSave(await db(SUPER), SUPER, SUPER, (user) => {
    user.annualLeaveEnabled = true
    user.annualLeaveDaysPerYear = 28
  }, false)
  await assertSucceeds(batch.commit())
})

test('unchanged guard: an operative still cannot set their own employment type', async () => {
  await env.clearFirestore()
  await seed(false)
  const { batch } = editUserSave(await db(OP), OP, OP, toPaye, false)
  await assertLogicalDeny(batch.commit())
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
