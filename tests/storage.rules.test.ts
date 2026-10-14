/**
 * Storage rules first cut. Runs against Firestore + Storage emulators
 * because storage.rules calls firestore.get / firestore.exists.
 *
 *   npm run test:rules:storage
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { getBytes, ref, uploadBytes } from 'firebase/storage'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const firestoreRules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')
const storageRules = readFileSync(path.join(root, 'storage.rules'), 'utf8')

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const ADMIN_A = 'admin-a'
const OP_A = 'op-a'
const ADMIN_B = 'admin-b'
const OP_B = 'op-b'

const MB = 1024 * 1024

let env: RulesTestEnvironment

function authStorage(uid: string, email: string) {
  return env.authenticatedContext(uid, { email }).storage()
}

function put(
  uid: string,
  email: string,
  objectPath: string,
  size: number,
  contentType: string
) {
  return uploadBytes(ref(authStorage(uid, email), objectPath), new Uint8Array(size), { contentType })
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-rules',
    firestore: { rules: firestoreRules, host: '127.0.0.1', port: 8080 },
    storage: { rules: storageRules, host: '127.0.0.1', port: 9199 },
  })

  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A), {
      name: 'Company A',
      members: { [ADMIN_A]: 'admin', [OP_A]: 'member' },
      creatorUserId: ADMIN_A,
    })
    await setDoc(doc(db, 'organizations', ORG_B), {
      name: 'Company B',
      members: { [ADMIN_B]: 'admin', [OP_B]: 'member' },
      creatorUserId: ADMIN_B,
    })
    await setDoc(doc(db, 'users', ADMIN_A), {
      email: 'admin-a@test.com',
      organizationId: ORG_A,
      role: 'admin',
      adminAccess: true,
      firstName: 'Ada',
    })
    await setDoc(doc(db, 'users', OP_A), {
      email: 'op-a@test.com',
      organizationId: ORG_A,
      role: 'operative',
      adminAccess: false,
      isSuperAdmin: false,
      operativeMode: true,
      firstName: 'Ollie',
    })
    await setDoc(doc(db, 'users', ADMIN_B), {
      email: 'admin-b@test.com',
      organizationId: ORG_B,
      role: 'admin',
      adminAccess: true,
      firstName: 'Bea',
    })
    await setDoc(doc(db, 'users', OP_B), {
      email: 'op-b@test.com',
      organizationId: ORG_B,
      role: 'operative',
      adminAccess: false,
      operativeMode: true,
      firstName: 'Ben',
    })
  })
})

test.after(async () => {
  await env.cleanup()
})

test('unauthenticated cannot write a certificate', async () => {
  const storage = env.unauthenticatedContext().storage()
  await assertFails(
    uploadBytes(
      ref(storage, `organizations/${ORG_A}/operatives/op1/qualifications/q1/certificates/cert.pdf`),
      new Uint8Array(16),
      { contentType: 'application/pdf' }
    )
  )
})

test('operative A cannot write admin A profile photo', async () => {
  await assertFails(
    put(
      OP_A,
      'op-a@test.com',
      `organizations/${ORG_A}/userProfiles/${ADMIN_A}/profile.jpg`,
      512,
      'image/jpeg'
    )
  )
})

test('user can write own profile photo under 2MB', async () => {
  await assertSucceeds(
    put(
      OP_A,
      'op-a@test.com',
      `organizations/${ORG_A}/userProfiles/${OP_A}/profile.jpg`,
      512,
      'image/jpeg'
    )
  )
})

test('oversize certificate write is denied', async () => {
  await assertFails(
    put(
      OP_A,
      'op-a@test.com',
      `organizations/${ORG_A}/operatives/op1/qualifications/q1/certificates/big.pdf`,
      10 * MB + 1,
      'application/pdf'
    )
  )
})

test('member can write a certificate under 10MB', async () => {
  await assertSucceeds(
    put(
      OP_A,
      'op-a@test.com',
      `organizations/${ORG_A}/operatives/op1/qualifications/q1/certificates/ok.pdf`,
      64,
      'application/pdf'
    )
  )
})

test('operative cannot write company logo', async () => {
  await assertFails(
    put(
      OP_A,
      'op-a@test.com',
      `organizations/${ORG_A}/branding/company_logo/op_logo.jpg`,
      512,
      'image/jpeg'
    )
  )
})

test('operative cannot write timesheet export', async () => {
  await assertFails(
    put(
      OP_A,
      'op-a@test.com',
      `organizations/${ORG_A}/timesheetExports/1000_Ollie_timesheet.pdf`,
      512,
      'application/pdf'
    )
  )
})

test('cross-org certificate write is denied', async () => {
  await assertFails(
    put(
      ADMIN_A,
      'admin-a@test.com',
      `organizations/${ORG_B}/operatives/op2/qualifications/q2/certificates/x.pdf`,
      64,
      'application/pdf'
    )
  )
})

test('admin can write company logo under 5MB', async () => {
  await assertSucceeds(
    put(
      ADMIN_A,
      'admin-a@test.com',
      `organizations/${ORG_A}/branding/company_logo/admin_logo.jpg`,
      512,
      'image/jpeg'
    )
  )
})

test('staff can write and read a timesheet export PDF', async () => {
  const objectPath = `organizations/${ORG_A}/timesheetExports/2000_Ada_timesheet.pdf`
  await assertSucceeds(put(ADMIN_A, 'admin-a@test.com', objectPath, 512, 'application/pdf'))
  await assertSucceeds(getBytes(ref(authStorage(ADMIN_A, 'admin-a@test.com'), objectPath)))
})

test('operative cannot read a timesheet export PDF', async () => {
  const objectPath = `organizations/${ORG_A}/timesheetExports/2001_staff_only.pdf`
  await assertSucceeds(put(ADMIN_A, 'admin-a@test.com', objectPath, 512, 'application/pdf'))
  await assertFails(getBytes(ref(authStorage(OP_A, 'op-a@test.com'), objectPath)))
})

test('variation evidence allows 10MB+1 (20MB exception) and denies 20MB+1', async () => {
  await assertSucceeds(
    put(
      OP_A,
      'op-a@test.com',
      `organizations/${ORG_A}/healthSafety/job-1/variationEvidence/shot.jpg`,
      10 * MB + 1,
      'image/jpeg'
    )
  )
  await assertFails(
    put(
      OP_A,
      'op-a@test.com',
      `organizations/${ORG_A}/healthSafety/job-1/variationEvidence/huge.jpg`,
      20 * MB + 1,
      'image/jpeg'
    )
  )
})

test('member can write a task file as application/octet-stream', async () => {
  await assertSucceeds(
    put(
      OP_A,
      'op-a@test.com',
      `organizations/${ORG_A}/tasks/task-1/op_1_drawing.bin`,
      128,
      'application/octet-stream'
    )
  )
})

test('unknown prefix is denied even for an org member', async () => {
  await assertFails(
    put(
      ADMIN_A,
      'admin-a@test.com',
      `organizations/${ORG_A}/misc/secret.bin`,
      16,
      'application/octet-stream'
    )
  )
})

test('storage rules file still has no public org-wide allow', () => {
  assert.match(storageRules, /callerOrgMatches\(orgId\) \|\| callerIsMember\(orgId\)/)
  assert.doesNotMatch(storageRules, /allow read, write: if callerOrgMatches/)
})
