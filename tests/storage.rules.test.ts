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
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const firestoreRules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')
const storageRules = readFileSync(path.join(root, 'storage.rules'), 'utf8')

const ORG_A = 'org-a'
const ORG_B = 'org-b'
const ADMIN_A = 'admin-a'
const OP_A = 'op-a'
const ADMIN_B = 'admin-b'
const OP_B = 'op-b'
const MGR_A = 'mgr-a'
const OPMODE_ADMIN_A = 'opmode-admin-a'
// 1.30.0: a PAYE operative whose line managers are MGR_A and an inactive manager.
const CLAIM_OP_A = 'claim-op-a'
const GONE_MGR_A = 'gone-mgr-a'

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
      members: { [ADMIN_A]: 'admin', [OP_A]: 'member', [CLAIM_OP_A]: 'member', [GONE_MGR_A]: 'member', [MGR_A]: 'member', [OPMODE_ADMIN_A]: 'member', [ADMIN_B]: 'member' },
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
    await setDoc(doc(db, 'users', CLAIM_OP_A), {
      email: 'claim-op-a@test.com',
      organizationId: ORG_A,
      role: 'operative',
      operativeMode: true,
      employmentType: 'paye',
      assignedManagerUserIds: [MGR_A, GONE_MGR_A],
    })
    await setDoc(doc(db, 'users', GONE_MGR_A), {
      email: 'gone-mgr-a@test.com',
      organizationId: ORG_A,
      role: 'manager',
      manager: true,
      isActive: false,
    })
    await setDoc(doc(db, 'users', MGR_A), {
      email: 'mgr-a@test.com',
      organizationId: ORG_A,
      role: 'manager',
      manager: true,
      adminAccess: false,
      firstName: 'Mo',
    })
    await setDoc(doc(db, 'users', OPMODE_ADMIN_A), {
      email: 'opmode-admin-a@test.com',
      organizationId: ORG_A,
      role: 'admin',
      adminAccess: true,
      operativeMode: true,
      firstName: 'Opal',
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

// ---------------------------------------------------------------------------------------------------------------
// Rulebook 1.25.0 §24 (fileDeletePermission): no client deletes or overwrites another person's file.
// Uploads are named {uid}_{unixMs}.{ext}; the uploader may delete or overwrite within 15 minutes of the upload,
// admins of the organisation (outside operative mode) may delete. The 15-minute expiry itself is not exercised
// here (the emulator clock cannot be moved); canonical.test.ts locks the number in storage.rules.
// ---------------------------------------------------------------------------------------------------------------

const EMAIL: Record<string, string> = {
  [ADMIN_A]: 'admin-a@test.com',
  [OP_A]: 'op-a@test.com',
  [MGR_A]: 'mgr-a@test.com',
  [OPMODE_ADMIN_A]: 'opmode-admin-a@test.com',
  [ADMIN_B]: 'admin-b@test.com',
}

function del(uid: string, objectPath: string) {
  return deleteObject(ref(authStorage(uid, EMAIL[uid]), objectPath))
}

let seq = 0
function certPath(uploader: string) {
  seq += 1
  return `organizations/${ORG_A}/operatives/op1/qualifications/q1/certificates/${uploader}_${Date.now() + seq}.pdf`
}

test('1.25.0 uploader deletes their own fresh certificate (undo window)', async () => {
  const objectPath = certPath(OP_A)
  await assertSucceeds(put(OP_A, EMAIL[OP_A], objectPath, 64, 'application/pdf'))
  await assertSucceeds(del(OP_A, objectPath))
})

test('1.25.0 an operative cannot delete a certificate someone else uploaded', async () => {
  const objectPath = certPath(ADMIN_A)
  await assertSucceeds(put(ADMIN_A, EMAIL[ADMIN_A], objectPath, 64, 'application/pdf'))
  await assertFails(del(OP_A, objectPath))
})

test('1.25.0 a manager cannot delete an operative\'s site audit photo, task file or H&S file', async () => {
  const paths = [
    `organizations/${ORG_A}/siteAudits/a1/images/${OP_A}_${Date.now()}.jpg`,
    `organizations/${ORG_A}/tasks/t1/files/${OP_A}_${Date.now()}.pdf`,
    `organizations/${ORG_A}/healthSafety/job-1/rams/${OP_A}_${Date.now()}.pdf`,
    `organizations/${ORG_A}/healthSafety/job-1/variationEvidence/${OP_A}_${Date.now()}.jpg`,
  ]
  for (const objectPath of paths) {
    const type = objectPath.endsWith('.jpg') ? 'image/jpeg' : 'application/pdf'
    await assertSucceeds(put(OP_A, EMAIL[OP_A], objectPath, 64, type))
    await assertFails(del(MGR_A, objectPath))
  }
})

test('1.25.0 an admin of the organisation deletes any file in it', async () => {
  const objectPath = `organizations/${ORG_A}/tasks/t1/${OP_A}_${Date.now()}.pdf`
  await assertSucceeds(put(OP_A, EMAIL[OP_A], objectPath, 64, 'application/pdf'))
  await assertSucceeds(del(ADMIN_A, objectPath))
})

test('1.25.0 an admin in operative mode, or an admin of another company, cannot delete someone else\'s file', async () => {
  const objectPath = `organizations/${ORG_A}/healthSafety/job-1/other/${OP_A}_${Date.now()}.pdf`
  await assertSucceeds(put(OP_A, EMAIL[OP_A], objectPath, 64, 'application/pdf'))
  await assertFails(del(OPMODE_ADMIN_A, objectPath))
  // ADMIN_B is a plain member of ORG_A here; their admin flags belong to ORG_B.
  await assertFails(del(ADMIN_B, objectPath))
})

test('1.25.0 nobody overwrites another person\'s file; the uploader may retry the same path', async () => {
  const objectPath = certPath(OP_A)
  await assertSucceeds(put(OP_A, EMAIL[OP_A], objectPath, 64, 'application/pdf'))
  await assertFails(put(MGR_A, EMAIL[MGR_A], objectPath, 64, 'application/pdf'))
  await assertFails(put(ADMIN_A, EMAIL[ADMIN_A], objectPath, 64, 'application/pdf'))
  await assertSucceeds(put(OP_A, EMAIL[OP_A], objectPath, 128, 'application/pdf'))
})

test('1.25.0 a file without an uploader in its name is admin-delete only', async () => {
  const objectPath = `organizations/${ORG_A}/tasks/t1/old-drawing-${Date.now()}.pdf`
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), objectPath), new Uint8Array(16), { contentType: 'application/pdf' })
  })
  await assertFails(del(OP_A, objectPath))
  await assertFails(del(MGR_A, objectPath))
  await assertSucceeds(del(ADMIN_A, objectPath))
})

test('1.25.0 profile photo: the person or an admin deletes it, nobody else', async () => {
  const objectPath = `organizations/${ORG_A}/userProfiles/${OP_A}/profile.jpg`
  await assertSucceeds(put(OP_A, EMAIL[OP_A], objectPath, 512, 'image/jpeg'))
  await assertFails(del(MGR_A, objectPath))
  await assertSucceeds(del(OP_A, objectPath))
  await assertSucceeds(put(ADMIN_A, EMAIL[ADMIN_A], objectPath, 512, 'image/jpeg'))
  await assertSucceeds(del(ADMIN_A, objectPath))
})

test('1.25.0 timesheet exports and the logo: admins delete, managers do not', async () => {
  const exportPath = `organizations/${ORG_A}/timesheetExports/${Math.floor(Date.now() / 1000)}_Mo_timesheet.pdf`
  await assertSucceeds(put(MGR_A, EMAIL[MGR_A], exportPath, 512, 'application/pdf'))
  await assertFails(del(MGR_A, exportPath))
  await assertFails(put(MGR_A, EMAIL[MGR_A], exportPath, 512, 'application/pdf'))
  await assertSucceeds(del(ADMIN_A, exportPath))
  const logoPath = `organizations/${ORG_A}/branding/company_logo/${ADMIN_A}_${Date.now()}.png`
  await assertSucceeds(put(ADMIN_A, EMAIL[ADMIN_A], logoPath, 512, 'image/png'))
  await assertFails(del(MGR_A, logoPath))
  await assertSucceeds(del(ADMIN_A, logoPath))
})

// Rulebook 1.30.0 §26: claim evidence (the person, their line manager, admins) and personal site audits (owner only).
EMAIL[CLAIM_OP_A] = 'claim-op-a@test.com'
EMAIL[GONE_MGR_A] = 'gone-mgr-a@test.com'

function read(uid: string, objectPath: string) {
  return getBytes(ref(authStorage(uid, EMAIL[uid]), objectPath))
}

test('1.30.0 claim evidence: the person uploads to their own folder only; images and PDFs up to 10MB', async () => {
  const own = `organizations/${ORG_A}/payeClaims/${CLAIM_OP_A}/${CLAIM_OP_A}_${Date.now()}.jpg`
  await assertSucceeds(put(CLAIM_OP_A, EMAIL[CLAIM_OP_A], own, 256, 'image/jpeg'))
  await assertSucceeds(put(CLAIM_OP_A, EMAIL[CLAIM_OP_A], own.replace('.jpg', '1.pdf'), 256, 'application/pdf'))
  await assertFails(put(CLAIM_OP_A, EMAIL[CLAIM_OP_A], own.replace('.jpg', '2.docx'), 256, 'application/msword'))
  await assertFails(put(CLAIM_OP_A, EMAIL[CLAIM_OP_A], own.replace('.jpg', '3.jpg'), 11 * MB, 'image/jpeg'))
  // Nobody uploads into someone else's folder — line manager, admin or peer.
  const theirs = `organizations/${ORG_A}/payeClaims/${CLAIM_OP_A}/${MGR_A}_${Date.now()}.jpg`
  await assertFails(put(MGR_A, EMAIL[MGR_A], theirs, 256, 'image/jpeg'))
  await assertFails(put(ADMIN_A, EMAIL[ADMIN_A], theirs.replace(MGR_A, ADMIN_A), 256, 'image/jpeg'))
  await assertFails(put(OP_A, EMAIL[OP_A], theirs.replace(MGR_A, OP_A), 256, 'image/jpeg'))
})

test('1.30.0 claim evidence is read by the person, their line manager and admins — never a peer or another company', async () => {
  const objectPath = `organizations/${ORG_A}/payeClaims/${CLAIM_OP_A}/${CLAIM_OP_A}_${Date.now() + 7}.pdf`
  await assertSucceeds(put(CLAIM_OP_A, EMAIL[CLAIM_OP_A], objectPath, 128, 'application/pdf'))
  await assertSucceeds(read(CLAIM_OP_A, objectPath))
  await assertSucceeds(read(MGR_A, objectPath))
  await assertSucceeds(read(ADMIN_A, objectPath))
  await assertFails(read(OP_A, objectPath))
  await assertFails(read(ADMIN_B, objectPath))
  // Delete as §24: the uploader within the undo window or an admin; never the line manager.
  await assertFails(del(MGR_A, objectPath))
  await assertSucceeds(del(CLAIM_OP_A, objectPath))
})

test('1.30.0 personal site audit photos are the owner\'s only — admins included cannot read or delete them', async () => {
  const objectPath = `organizations/${ORG_A}/personalSiteAudits/${CLAIM_OP_A}/A1/${CLAIM_OP_A}_${Date.now() + 9}.jpg`
  await assertSucceeds(put(CLAIM_OP_A, EMAIL[CLAIM_OP_A], objectPath, 256, 'image/jpeg'))
  await assertFails(put(CLAIM_OP_A, EMAIL[CLAIM_OP_A], objectPath.replace('.jpg', 'x.pdf'), 256, 'application/pdf'))
  await assertSucceeds(read(CLAIM_OP_A, objectPath))
  for (const uid of [MGR_A, ADMIN_A, OP_A, ADMIN_B]) await assertFails(read(uid, objectPath))
  await assertFails(del(ADMIN_A, objectPath))
  await assertFails(put(ADMIN_A, EMAIL[ADMIN_A], `organizations/${ORG_A}/personalSiteAudits/${CLAIM_OP_A}/A1/${ADMIN_A}_1.jpg`, 64, 'image/jpeg'))
  await assertSucceeds(del(CLAIM_OP_A, objectPath))
})

test('1.30.0 review: an inactive line manager reads no evidence; an admin with a stray operative flag does (1.11.0); no SVG', async () => {
  const objectPath = `organizations/${ORG_A}/payeClaims/${CLAIM_OP_A}/${CLAIM_OP_A}_${Date.now() + 11}.jpg`
  await assertSucceeds(put(CLAIM_OP_A, EMAIL[CLAIM_OP_A], objectPath, 128, 'image/jpeg'))
  await assertFails(read(GONE_MGR_A, objectPath))
  await assertSucceeds(read(OPMODE_ADMIN_A, objectPath))
  await assertFails(put(CLAIM_OP_A, EMAIL[CLAIM_OP_A], objectPath.replace('.jpg', 'x.svg'), 128, 'image/svg+xml'))
  await assertFails(put(CLAIM_OP_A, EMAIL[CLAIM_OP_A], `organizations/${ORG_A}/personalSiteAudits/${CLAIM_OP_A}/A1/${CLAIM_OP_A}_${Date.now()}.svg`, 128, 'image/svg+xml'))
})
