/**
 * Pre-launch rules hardening (rulebook 1.53.1, §16):
 * 1. An admin's update of another person's users document writes privilege values (isSuperAdmin, adminAccess, manager,
 *    operatives, operativeMode, annualLeaveSelfBook, timesheetSelfSign, top level and `permissions`) only as a bool or
 *    null, and a role only as one the apps write — as every other users write path already did (1.31.1).
 * 2. `members` on the organisation document: a written value is one of the role words; a legacy value already stored
 *    on another entry can no longer be copied onto a new entry.
 * 3. Nobody switches their own Annual Leave Management or Timesheet self-sign off (non-admins included; admins since
 *    1.31.1). Raising them was already refused.
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
import { doc, setDoc, updateDoc, deleteField } from 'firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(process.env.RULES_PATH || path.join(root, 'firestore.rules'), 'utf8')

let env: RulesTestEnvironment
const ORG = 'rh-org'
const FOUNDER = 'rh-founder'
const ADMIN = 'rh-admin'
const MGR = 'rh-mgr'
const OP = 'rh-op'
const OP_LEGACY = 'rh-op-legacy'

function person(id: string, extra: Record<string, unknown>) {
  return {
    email: `${id}@test.com`, organizationId: ORG, firstName: id, surname: 'Test', isActive: true, passwordSet: true,
    ...extra,
  }
}

async function seed() {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    await setDoc(doc(fs, 'organizations', ORG), {
      name: 'Hardening Ltd', creatorUserId: FOUNDER,
      members: { [FOUNDER]: 'admin', [ADMIN]: 'admin', [MGR]: 'manager', [OP]: 'operative', [OP_LEGACY]: 'operative', 'rh-legacy': 'owner' },
    })
    await setDoc(doc(fs, 'users', FOUNDER), person(FOUNDER, { role: 'admin', adminAccess: true, isSuperAdmin: true }))
    await setDoc(doc(fs, 'users', ADMIN), person(ADMIN, {
      role: 'admin', adminAccess: true, isSuperAdmin: false, assignedManagerUserIds: [FOUNDER], assignedManagerUserId: FOUNDER,
    }))
    await setDoc(doc(fs, 'users', MGR), person(MGR, {
      role: 'manager', manager: true, adminAccess: false, isSuperAdmin: false, annualLeaveSelfBook: true,
      permissions: { manager: true, annualLeaveSelfBook: true },
      assignedManagerUserIds: [ADMIN], assignedManagerUserId: ADMIN,
    }))
    await setDoc(doc(fs, 'users', OP), person(OP, {
      role: 'operative', operativeMode: true, manager: false, adminAccess: false, isSuperAdmin: false,
      permissions: { operativeMode: true, manager: false, adminAccess: false },
      assignedManagerUserIds: [MGR], assignedManagerUserId: MGR,
    }))
    // Legacy data: a non-bool privilege value stored before 1.31.1.
    await setDoc(doc(fs, 'users', OP_LEGACY), person(OP_LEGACY, {
      role: 'operative', operativeMode: 1, assignedManagerUserIds: [MGR], assignedManagerUserId: MGR,
    }))
  })
}

async function db(uid: string) {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-rules-hardening',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080) },
  })
})

test.after(async () => {
  await env.cleanup()
})

test('1.53.1 admin edit of another person: privilege values must be bool or null', async () => {
  await seed()
  const admin = await db(ADMIN)
  const op = doc(admin, 'users', OP)
  await assertFails(updateDoc(op, { 'permissions.adminAccess': 1 }))
  await assertFails(updateDoc(op, { adminAccess: 1 }))
  await assertFails(updateDoc(op, { manager: 'true' }))
  await assertFails(updateDoc(op, { operatives: 1.5 }))
  await assertFails(updateDoc(op, { operativeMode: 0 }))
  await assertFails(updateDoc(op, { 'permissions.isSuperAdmin': 'yes' }))
  await assertFails(updateDoc(op, { annualLeaveSelfBook: 1 }))
  await assertFails(updateDoc(op, { 'permissions.timesheetSelfSign': 1 }))
  await assertFails(updateDoc(op, { permissions: 'admin' }))
  await assertFails(updateDoc(op, { role: 'owner' }))
})

test('1.53.1 admin edit of another person: legitimate edits and a type change still save', async () => {
  await seed()
  const admin = await db(ADMIN)
  await assertSucceeds(updateDoc(doc(admin, 'users', OP), { firstName: 'Renamed', dayRate: 210, payBasis: 'day' }))
  await assertSucceeds(updateDoc(doc(admin, 'users', OP), {
    role: 'manager', manager: true, operativeMode: false,
    'permissions.manager': true, 'permissions.operativeMode': false, annualLeaveSelfBook: false,
  }))
  await assertSucceeds(updateDoc(doc(admin, 'users', MGR), { annualLeaveSelfBook: false, 'permissions.annualLeaveSelfBook': null }))
  await assertSucceeds(updateDoc(doc(admin, 'users', MGR), { manager: deleteField() }))
  // A legacy value stored before 1.31.1 does not block an unrelated edit.
  await assertSucceeds(updateDoc(doc(admin, 'users', OP_LEGACY), { firstName: 'Still legacy' }))
  await assertSucceeds(updateDoc(doc(admin, 'users', OP_LEGACY), { operativeMode: true }))
})

test('1.53.1 members: a written value is a role word; a stored legacy value is never copied to a new entry', async () => {
  await seed()
  const admin = await db(ADMIN)
  const org = doc(admin, 'organizations', ORG)
  await assertFails(updateDoc(org, { 'members.rh-new': 'owner' }))
  await assertFails(updateDoc(org, { 'members.rh-new': 'superuser' }))
  await assertFails(updateDoc(org, { 'members.rh-new': true }))
  await assertSucceeds(updateDoc(org, { 'members.rh-new': 'operative' }))
  // The untouched legacy entry does not block other changes, and it can be removed or replaced with a role word.
  await assertSucceeds(updateDoc(org, { name: 'Hardening Ltd (renamed)' }))
  await assertSucceeds(updateDoc(org, { 'members.rh-legacy': 'manager' }))
})

test('1.53.1 self-manage toggles: nobody switches their own off; an admin still does it for them', async () => {
  await seed()
  const mgr = await db(MGR)
  await assertFails(updateDoc(doc(mgr, 'users', MGR), { annualLeaveSelfBook: false, 'permissions.annualLeaveSelfBook': false }))
  await assertFails(updateDoc(doc(mgr, 'users', MGR), { annualLeaveSelfBook: deleteField(), 'permissions.annualLeaveSelfBook': deleteField() }))
  await assertSucceeds(updateDoc(doc(mgr, 'users', MGR), { firstName: 'Max', mobileNumber: '07000 000000' }))
  // Writing the toggles back unchanged (an iOS full profile save) still passes.
  await assertSucceeds(updateDoc(doc(mgr, 'users', MGR), { annualLeaveSelfBook: true, 'permissions.annualLeaveSelfBook': true, firstName: 'Maxine' }))
  const admin = await db(ADMIN)
  await assertSucceeds(updateDoc(doc(admin, 'users', MGR), { annualLeaveSelfBook: false, 'permissions.annualLeaveSelfBook': false }))
})
