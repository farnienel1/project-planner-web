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

test('1.50.0 variation evidence caps at 10MB (was 20MB)', async () => {
  await assertSucceeds(
    put(MGR_A, 'mgr-a@test.com', `organizations/${ORG_A}/healthSafety/job-1/variationEvidence/${MGR_A}_1.jpg`, 10 * MB, 'image/jpeg')
  )
  for (const objectPath of [
    `organizations/${ORG_A}/healthSafety/job-1/variationEvidence/${MGR_A}_2.jpg`,
    `organizations/${ORG_A}/healthSafety/job-1/variations/${MGR_A}_2.pdf`,
    `organizations/${ORG_A}/variations/v1/${MGR_A}_2.pdf`,
  ]) {
    await assertFails(put(MGR_A, 'mgr-a@test.com', objectPath, 10 * MB + 1, objectPath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'))
  }
})

// Rulebook 1.52.0 §24 (owner decision 15 Nov): only staff upload and read variation evidence, never operatives.
const VARIATION_PATHS_152 = [
  `organizations/${ORG_A}/healthSafety/job-1/variations`,
  `organizations/${ORG_A}/healthSafety/job-1/variationEvidence`,
  `organizations/${ORG_A}/variations/v1`,
]

test('1.52.0 an operative cannot upload or read variation evidence on any of the three paths', async () => {
  for (const folder of VARIATION_PATHS_152) {
    await assertFails(put(OP_A, 'op-a@test.com', `${folder}/${OP_A}_${Date.now()}.jpg`, 64, 'image/jpeg'))
    const staffFile = `${folder}/${MGR_A}_${Date.now()}.jpg`
    await assertSucceeds(put(MGR_A, 'mgr-a@test.com', staffFile, 64, 'image/jpeg'))
    await assertFails(getBytes(ref(authStorage(OP_A, 'op-a@test.com'), staffFile)))
    // An admin in operative mode is not staff for this either.
    await assertFails(getBytes(ref(authStorage(OPMODE_ADMIN_A, 'opmode-admin-a@test.com'), staffFile)))
    await assertSucceeds(getBytes(ref(authStorage(ADMIN_A, 'admin-a@test.com'), staffFile)))
  }
})

test('1.52.0 a manager uploads, reads and (as uploader, in the undo window) deletes variation evidence', async () => {
  for (const folder of VARIATION_PATHS_152) {
    const file = `${folder}/${MGR_A}_${Date.now()}.pdf`
    await assertSucceeds(put(MGR_A, 'mgr-a@test.com', file, 64, 'application/pdf'))
    await assertSucceeds(getBytes(ref(authStorage(MGR_A, 'mgr-a@test.com'), file)))
    await assertFails(del(OP_A, file))
    await assertSucceeds(del(MGR_A, file))
  }
})

test('1.52.0 other health & safety files stay open to members (operatives still upload and read RAMS)', async () => {
  const file = `organizations/${ORG_A}/healthSafety/job-1/rams/${OP_A}_${Date.now()}.pdf`
  await assertSucceeds(put(OP_A, 'op-a@test.com', file, 64, 'application/pdf'))
  await assertSucceeds(getBytes(ref(authStorage(OP_A, 'op-a@test.com'), file)))
  // A folder whose name only starts with "variations" is not variation evidence.
  const other = `organizations/${ORG_A}/healthSafety/job-1/variationsNotes/${OP_A}_${Date.now()}.pdf`
  await assertSucceeds(put(OP_A, 'op-a@test.com', other, 64, 'application/pdf'))
})

test('1.52.0 review LOW: a health & safety file one level under the job, and a deep one, still open to members', async () => {
  const shallow = `organizations/${ORG_A}/healthSafety/job-1/${OP_A}_${Date.now()}.pdf`
  await assertSucceeds(put(OP_A, 'op-a@test.com', shallow, 64, 'application/pdf'))
  await assertSucceeds(getBytes(ref(authStorage(OP_A, 'op-a@test.com'), shallow)))
  const deep = `organizations/${ORG_A}/healthSafety/job-1/deadlines/d1/${OP_A}_${Date.now()}.jpg`
  await assertSucceeds(put(OP_A, 'op-a@test.com', deep, 64, 'image/jpeg'))
  await assertSucceeds(getBytes(ref(authStorage(OP_A, 'op-a@test.com'), deep)))
})

test('1.52.0 another company\'s staff never read variation evidence', async () => {
  const file = `organizations/${ORG_A}/healthSafety/job-1/variations/${ADMIN_A}_${Date.now()}.jpg`
  await assertSucceeds(put(ADMIN_A, 'admin-a@test.com', file, 64, 'image/jpeg'))
  await assertFails(getBytes(ref(authStorage(OP_B, 'op-b@test.com'), file)))
})

test('1.50.0 a task file as application/octet-stream is refused', async () => {
  await assertFails(
    put(OP_A, 'op-a@test.com', `organizations/${ORG_A}/tasks/task-1/op_1_drawing.bin`, 128, 'application/octet-stream')
  )
})

// Rulebook 1.80.0: subcontractor insurance / RAMS documents are staff only (no subcontractor login), photos and PDF, 10MB.
test('1.80.0 subcontractor documents: staff upload and read; operatives never; 10MB photos and PDF only', async () => {
  const folder = `organizations/${ORG_A}/subcontractors/sub-1/documents`
  await assertFails(put(OP_A, 'op-a@test.com', `${folder}/${OP_A}_${Date.now()}.pdf`, 64, 'application/pdf'))
  const file = `${folder}/${MGR_A}_${Date.now()}.pdf`
  await assertSucceeds(put(MGR_A, 'mgr-a@test.com', file, 64, 'application/pdf'))
  await assertSucceeds(getBytes(ref(authStorage(MGR_A, 'mgr-a@test.com'), file)))
  await assertSucceeds(getBytes(ref(authStorage(ADMIN_A, 'admin-a@test.com'), file)))
  await assertFails(getBytes(ref(authStorage(OP_A, 'op-a@test.com'), file)))
  await assertFails(getBytes(ref(authStorage(OPMODE_ADMIN_A, 'opmode-admin-a@test.com'), file)))
  await assertFails(put(MGR_A, 'mgr-a@test.com', `${folder}/${MGR_A}_${Date.now()}_big.pdf`, 10 * MB + 1, 'application/pdf'))
  await assertFails(put(MGR_A, 'mgr-a@test.com', `${folder}/${MGR_A}_${Date.now()}.svg`, 64, 'image/svg+xml'))
  await assertFails(del(OP_A, file))
  await assertSucceeds(del(MGR_A, file))
})

// Rulebook 1.83.0 §31: organisation insurance & accreditations are admins only (upload, read, delete), photos and PDF, 10MB.
test('1.83.0 compliance documents: admins only; managers and operatives never; 10MB photos and PDF only', async () => {
  const folder = `organizations/${ORG_A}/compliance`
  await assertFails(put(MGR_A, 'mgr-a@test.com', `${folder}/${MGR_A}_${Date.now()}.pdf`, 64, 'application/pdf'))
  await assertFails(put(OP_A, 'op-a@test.com', `${folder}/${OP_A}_${Date.now()}.pdf`, 64, 'application/pdf'))
  const file = `${folder}/${ADMIN_A}_${Date.now()}.pdf`
  await assertSucceeds(put(ADMIN_A, 'admin-a@test.com', file, 64, 'application/pdf'))
  await assertSucceeds(getBytes(ref(authStorage(ADMIN_A, 'admin-a@test.com'), file)))
  await assertFails(getBytes(ref(authStorage(MGR_A, 'mgr-a@test.com'), file)))
  await assertFails(getBytes(ref(authStorage(OP_A, 'op-a@test.com'), file)))
  await assertFails(put(ADMIN_A, 'admin-a@test.com', `${folder}/${ADMIN_A}_${Date.now()}_big.pdf`, 10 * MB + 1, 'application/pdf'))
  await assertFails(put(ADMIN_A, 'admin-a@test.com', `${folder}/${ADMIN_A}_${Date.now()}.svg`, 64, 'image/svg+xml'))
  await assertFails(del(MGR_A, file))
  await assertSucceeds(del(ADMIN_A, file))
  // Review of #441: the object name starts with the uploader's own uid; an admin with a stray operative-mode flag is
  // still an admin (as Firestore's orgAdminEither and the rulebook's canManageOrganizationCompliance).
  await assertFails(put(ADMIN_A, 'admin-a@test.com', `${folder}/${MGR_A}_${Date.now()}.pdf`, 64, 'application/pdf'))
  await assertFails(put(ADMIN_A, 'admin-a@test.com', `${folder}/x${ADMIN_A}_${Date.now()}.pdf`, 64, 'application/pdf'))
  const opmode = `${folder}/${OPMODE_ADMIN_A}_${Date.now()}.pdf`
  await assertSucceeds(put(OPMODE_ADMIN_A, 'opmode-admin-a@test.com', opmode, 64, 'application/pdf'))
  await assertSucceeds(getBytes(ref(authStorage(OPMODE_ADMIN_A, 'opmode-admin-a@test.com'), opmode)))
})

// Rulebook 1.50.0 §24 (owner decisions 15 Nov): photos (JPEG, PNG, HEIC/HEIF, WebP) and PDF only, per path.
const PATHS_150 = {
  profile: { path: `organizations/${ORG_A}/userProfiles/${OP_A}/profile.jpg`, max: 2 * MB, pdf: false },
  certificate: { path: `organizations/${ORG_A}/operatives/o1/qualifications/q1/certificates/${OP_A}_150`, max: 10 * MB, pdf: true },
  // 1.52.0: variation evidence is staff only — uploaded here by a manager.
  variationWeb: { path: `organizations/${ORG_A}/healthSafety/job-1/variations/${MGR_A}_150`, max: 10 * MB, pdf: true, uid: MGR_A },
  variationIos: { path: `organizations/${ORG_A}/healthSafety/job-1/variationEvidence/${MGR_A}_150`, max: 10 * MB, pdf: true, uid: MGR_A },
  variationFallback: { path: `organizations/${ORG_A}/variations/v1/${MGR_A}_150`, max: 10 * MB, pdf: true, uid: MGR_A },
  siteAudit: { path: `organizations/${ORG_A}/siteAudits/a1/images/${OP_A}_150`, max: 10 * MB, pdf: false },
  task: { path: `organizations/${ORG_A}/tasks/t1/${OP_A}_150`, max: 10 * MB, pdf: true },
  healthSafety: { path: `organizations/${ORG_A}/healthSafety/job-1/rams/${OP_A}_150`, max: 10 * MB, pdf: true },
  claim: { path: `organizations/${ORG_A}/payeClaims/${CLAIM_OP_A}/${CLAIM_OP_A}_150`, max: 10 * MB, pdf: true, uid: CLAIM_OP_A },
  personalAudit: { path: `organizations/${ORG_A}/personalSiteAudits/${CLAIM_OP_A}/A1/${CLAIM_OP_A}_150`, max: 10 * MB, pdf: false, uid: CLAIM_OP_A },
} as const

const REFUSED_150 = [
  ['svg', 'image/svg+xml'],
  ['xlsm', 'application/vnd.ms-excel.sheet.macroEnabled.12'],
  ['xlsm2', 'application/vnd.ms-excel.sheet.macroenabled.12'],
  ['bin', 'application/octet-stream'],
  ['gif', 'image/gif'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['zip', 'application/zip'],
  ['csv', 'text/csv'],
  ['html', 'text/html'],
  ['xml', 'application/xml'],
] as const

test('1.50.0 every path: a valid JPEG (and PDF where allowed) is accepted; SVG, xlsm, octet-stream, Office, ZIP, CSV and oversize are refused', async () => {
  let n = 0
  for (const [name, spec] of Object.entries(PATHS_150)) {
    const uid = 'uid' in spec ? spec.uid : OP_A
    const email = EMAIL[uid]
    const at = (suffix: string) => (name === 'profile' ? spec.path : `${spec.path}_${(n += 1)}.${suffix}`)
    await assertSucceeds(put(uid, email, at('jpg'), 256, 'image/jpeg'))
    for (const type of ['image/png', 'image/heic', 'image/heif', 'image/webp']) {
      await assertSucceeds(put(uid, email, at('img'), 256, type))
    }
    if (spec.pdf) await assertSucceeds(put(uid, email, at('pdf'), 256, 'application/pdf'))
    else await assertFails(put(uid, email, at('pdf'), 256, 'application/pdf'))
    for (const [suffix, type] of REFUSED_150) {
      await assertFails(put(uid, email, at(suffix), 256, type))
    }
    await assertFails(put(uid, email, at('jpg'), spec.max + 1, 'image/jpeg'))
  }
})

test('1.50.0 text/html is refused on every path (no hosted web pages)', async () => {
  for (const [name, spec] of Object.entries(PATHS_150)) {
    const uid = 'uid' in spec ? spec.uid : OP_A
    const objectPath = name === 'profile' ? spec.path : `${spec.path}_html.html`
    await assertFails(put(uid, EMAIL[uid], objectPath, 64, 'text/html'))
    await assertFails(put(uid, EMAIL[uid], objectPath, 64, 'text/html; charset=utf-8'))
  }
})

test('1.50.0 company logo and timesheet exports', async () => {
  const logo = (suffix: string) => `organizations/${ORG_A}/branding/company_logo/${ADMIN_A}_${Date.now()}_${suffix}`
  await assertSucceeds(put(ADMIN_A, EMAIL[ADMIN_A], logo('a.png'), 256, 'image/png'))
  await assertSucceeds(put(ADMIN_A, EMAIL[ADMIN_A], logo('b.pdf'), 256, 'application/pdf'))
  await assertFails(put(ADMIN_A, EMAIL[ADMIN_A], logo('c.svg'), 256, 'image/svg+xml'))
  await assertFails(put(ADMIN_A, EMAIL[ADMIN_A], logo('d.bin'), 256, 'application/octet-stream'))
  await assertFails(put(ADMIN_A, EMAIL[ADMIN_A], logo('f.html'), 256, 'text/html'))
  await assertFails(put(ADMIN_A, EMAIL[ADMIN_A], logo('e.png'), 5 * MB + 1, 'image/png'))
  const exportPath = (suffix: string) => `organizations/${ORG_A}/timesheetExports/${Math.floor(Date.now() / 1000)}_${suffix}`
  await assertSucceeds(put(ADMIN_A, EMAIL[ADMIN_A], exportPath('a.pdf'), 256, 'application/pdf'))
  await assertFails(put(ADMIN_A, EMAIL[ADMIN_A], exportPath('b.jpg'), 256, 'image/jpeg'))
  await assertFails(put(ADMIN_A, EMAIL[ADMIN_A], exportPath('d.html'), 256, 'text/html'))
  await assertFails(put(ADMIN_A, EMAIL[ADMIN_A], exportPath('c.pdf'), 10 * MB + 1, 'application/pdf'))
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
  // 1.54.1: membership is the home users document of this organisation, else the members entry and membership.
  assert.match(storageRules, /callerOrgMatches\(orgId\)\s*\?\s*userData\(\)\.get\('isActive', true\) != false\s*:\s*listedRole\(orgId\) != null && membershipActive\(orgId\)/)
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
  const exportPath = `organizations/${ORG_A}/timesheetExports/${MGR_A}_${Math.floor(Date.now() / 1000)}_Mo_timesheet.pdf`
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

// Rulebook 1.54.1 §14, §16, §19, §20 (platform scan 16 Nov): roles belong to their organisation; deactivated people,
// lapsed and scheduled-for-deletion organisations get no Storage access; exports are admins' and the exporter's.
const ORG_LAPSED = 'org-lapsed'
const ORG_DELETING = 'org-deleting'
const HOME_ADMIN_OP = 'home-admin-op' // admin at home (ORG_B), listed as 'operative' in ORG_A
const LISTED_MGR = 'listed-mgr' // operative at home (ORG_B), listed as 'manager' in ORG_A
const DEACT_A = 'deact-a' // manager whose users document of ORG_A says isActive: false
const LISTED_GONE = 'listed-gone' // listed 'manager' in ORG_A, membership there accountActive: false
const LAPSED_ADMIN = 'lapsed-admin'
const DELETING_ADMIN = 'deleting-admin'
for (const uid of [HOME_ADMIN_OP, LISTED_MGR, DEACT_A, LISTED_GONE, LAPSED_ADMIN, DELETING_ADMIN]) EMAIL[uid] = `${uid}@test.com`

let seeded154: Promise<void> | null = null
function seed154() {
  seeded154 ??= env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_A), {
      members: { [HOME_ADMIN_OP]: 'operative', [LISTED_MGR]: 'manager', [DEACT_A]: 'manager', [LISTED_GONE]: 'manager' },
    }, { merge: true })
    await setDoc(doc(db, 'users', HOME_ADMIN_OP), { email: EMAIL[HOME_ADMIN_OP], organizationId: ORG_B, role: 'admin', adminAccess: true, isSuperAdmin: true, manager: true })
    await setDoc(doc(db, 'users', LISTED_MGR), { email: EMAIL[LISTED_MGR], organizationId: ORG_B, role: 'operative', operativeMode: true })
    await setDoc(doc(db, 'users', DEACT_A), { email: EMAIL[DEACT_A], organizationId: ORG_A, role: 'manager', manager: true, isActive: false })
    await setDoc(doc(db, 'users', LISTED_GONE), { email: EMAIL[LISTED_GONE], organizationId: ORG_B, role: 'manager', manager: true })
    await setDoc(doc(db, 'users', LISTED_GONE, 'orgMemberships', ORG_A), { organizationId: ORG_A, role: 'manager', accountActive: false })
    await setDoc(doc(db, 'organizations', ORG_LAPSED), { name: 'Lapsed', members: { [LAPSED_ADMIN]: 'admin' }, creatorUserId: LAPSED_ADMIN, billing: { accessOpen: false } })
    await setDoc(doc(db, 'users', LAPSED_ADMIN), { email: EMAIL[LAPSED_ADMIN], organizationId: ORG_LAPSED, role: 'admin', adminAccess: true })
    await setDoc(doc(db, 'organizations', ORG_DELETING), { name: 'Deleting', members: { [DELETING_ADMIN]: 'admin' }, creatorUserId: DELETING_ADMIN, deletion: { status: 'scheduled' } })
    await setDoc(doc(db, 'users', DELETING_ADMIN), { email: EMAIL[DELETING_ADMIN], organizationId: ORG_DELETING, role: 'admin', adminAccess: true })
  })
  return seeded154
}

test('1.54.1 an admin at home who is an operative (or plain member) here gets no staff access here', async () => {
  await seed154()
  const exportFile = `organizations/${ORG_A}/timesheetExports/${ADMIN_A}_${Math.floor(Date.now() / 1000)}_x.pdf`
  await assertSucceeds(put(ADMIN_A, EMAIL[ADMIN_A], exportFile, 64, 'application/pdf'))
  const evidence = `organizations/${ORG_A}/healthSafety/job-1/variationEvidence/${ADMIN_A}_${Date.now()}.jpg`
  await assertSucceeds(put(ADMIN_A, EMAIL[ADMIN_A], evidence, 64, 'image/jpeg'))
  for (const uid of [HOME_ADMIN_OP, ADMIN_B]) {
    await assertFails(read(uid, exportFile))
    await assertFails(read(uid, evidence))
    await assertFails(put(uid, EMAIL[uid], `organizations/${ORG_A}/healthSafety/job-1/variations/${uid}_${Date.now()}.jpg`, 64, 'image/jpeg'))
    await assertFails(put(uid, EMAIL[uid], `organizations/${ORG_A}/timesheetExports/${uid}_${Math.floor(Date.now() / 1000)}_y.pdf`, 64, 'application/pdf'))
    // Never another person's profile photo, never the logo.
    await assertFails(put(uid, EMAIL[uid], `organizations/${ORG_A}/userProfiles/${OP_A}/profile.jpg`, 64, 'image/jpeg'))
    await assertFails(put(uid, EMAIL[uid], `organizations/${ORG_A}/branding/company_logo/${uid}_${Date.now()}.png`, 64, 'image/png'))
    // Still a member: member-level files stay open.
    await assertSucceeds(put(uid, EMAIL[uid], `organizations/${ORG_A}/tasks/t1/${uid}_${Date.now()}.pdf`, 64, 'application/pdf'))
  }
  // Their own company still treats them as the admin they are there.
  await assertSucceeds(put(HOME_ADMIN_OP, EMAIL[HOME_ADMIN_OP], `organizations/${ORG_B}/branding/company_logo/${HOME_ADMIN_OP}_${Date.now()}.png`, 64, 'image/png'))
})

test('1.54.1 a person listed as manager here is staff here, whatever their home users document says', async () => {
  await seed154()
  const evidence = `organizations/${ORG_A}/variations/v1/${LISTED_MGR}_${Date.now()}.pdf`
  await assertSucceeds(put(LISTED_MGR, EMAIL[LISTED_MGR], evidence, 64, 'application/pdf'))
  await assertSucceeds(read(LISTED_MGR, evidence))
})

test('1.54.1 deactivated people get no Storage access (users document or membership)', async () => {
  await seed154()
  const file = `organizations/${ORG_A}/tasks/t1/${OP_A}_${Date.now()}.pdf`
  await assertSucceeds(put(OP_A, EMAIL[OP_A], file, 64, 'application/pdf'))
  for (const uid of [DEACT_A, LISTED_GONE]) {
    await assertFails(read(uid, file))
    await assertFails(put(uid, EMAIL[uid], `organizations/${ORG_A}/tasks/t1/${uid}_${Date.now()}.pdf`, 64, 'application/pdf'))
  }
})

test('1.54.1 a lapsed or scheduled-for-deletion organisation gets no Storage access, admins included', async () => {
  await seed154()
  for (const [org, uid] of [[ORG_LAPSED, LAPSED_ADMIN], [ORG_DELETING, DELETING_ADMIN]]) {
    const file = `organizations/${org}/tasks/t1/${uid}_${Date.now()}.pdf`
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), file), new Uint8Array(16), { contentType: 'application/pdf' })
    })
    await assertFails(read(uid, file))
    await assertFails(put(uid, EMAIL[uid], `organizations/${org}/tasks/t1/${uid}_${Date.now() + 1}.pdf`, 64, 'application/pdf'))
    await assertFails(put(uid, EMAIL[uid], `organizations/${org}/branding/company_logo/${uid}_${Date.now()}.png`, 64, 'image/png'))
  }
})

test('1.54.1 timesheet export PDFs: admins read every export; the exporter reads their own; other managers none', async () => {
  await seed154()
  const stamp = Math.floor(Date.now() / 1000)
  const mine = `organizations/${ORG_A}/timesheetExports/${MGR_A}_${stamp}_Ada_timesheet.pdf`
  await assertSucceeds(put(MGR_A, EMAIL[MGR_A], mine, 64, 'application/pdf'))
  await assertSucceeds(read(MGR_A, mine))
  await assertSucceeds(read(ADMIN_A, mine))
  await assertFails(read(LISTED_MGR, mine))
  await assertFails(read(OP_A, mine))
  // Another person's export, and an export named before 1.54.1 (no uploader): admins only.
  const admins = `organizations/${ORG_A}/timesheetExports/${ADMIN_A}_${stamp}_Ben_timesheet.pdf`
  await assertSucceeds(put(ADMIN_A, EMAIL[ADMIN_A], admins, 64, 'application/pdf'))
  await assertFails(read(MGR_A, admins))
  const legacy = `organizations/${ORG_A}/timesheetExports/${stamp}_Old_timesheet.pdf`
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), legacy), new Uint8Array(16), { contentType: 'application/pdf' })
  })
  await assertFails(read(MGR_A, legacy))
  await assertSucceeds(read(ADMIN_A, legacy))
})

test('1.54.1 review: an export\'s name must start with the uploader\'s own uid, unless an admin uploads it', async () => {
  await seed154()
  const stamp = Math.floor(Date.now() / 1000)
  // A manager cannot plant a file under an admin's uid, nor use the pre-1.54.1 name.
  await assertFails(put(MGR_A, EMAIL[MGR_A], `organizations/${ORG_A}/timesheetExports/${ADMIN_A}_${stamp}_z.pdf`, 64, 'application/pdf'))
  await assertFails(put(MGR_A, EMAIL[MGR_A], `organizations/${ORG_A}/timesheetExports/${stamp}_z.pdf`, 64, 'application/pdf'))
  await assertSucceeds(put(MGR_A, EMAIL[MGR_A], `organizations/${ORG_A}/timesheetExports/${MGR_A}_${stamp}_z.pdf`, 64, 'application/pdf'))
  // An admin may upload any name (older iPhone builds name exports {seconds}_{file}).
  await assertSucceeds(put(ADMIN_A, EMAIL[ADMIN_A], `organizations/${ORG_A}/timesheetExports/${stamp}_admin_z.pdf`, 64, 'application/pdf'))
})

test('1.54.1 review: the platform owner is never locked out by a lapsed or scheduled-for-deletion organisation', async () => {
  await seed154()
  const OWNER = 'platform-owner-uid'
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG_LAPSED), { members: { [OWNER]: 'admin' } }, { merge: true })
    await setDoc(doc(db, 'users', OWNER), { email: 'info@projectplanner.us', organizationId: ORG_B, role: 'admin', adminAccess: true })
  })
  const file = `organizations/${ORG_LAPSED}/tasks/t1/${LAPSED_ADMIN}_${Date.now()}.pdf`
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), file), new Uint8Array(16), { contentType: 'application/pdf' })
  })
  const owner = env.authenticatedContext(OWNER, { email: 'info@projectplanner.us', email_verified: true }).storage()
  await assertSucceeds(getBytes(ref(owner, file)))
  // The same email unverified is not the platform owner.
  const unverified = env.authenticatedContext(OWNER, { email: 'info@projectplanner.us', email_verified: false }).storage()
  await assertFails(getBytes(ref(unverified, file)))
})

test('1.83.0 compliance documents: a deactivated admin, a lapsed and a scheduled-for-deletion company get nothing', async () => {
  await seed154()
  for (const [org, uid] of [[ORG_LAPSED, LAPSED_ADMIN], [ORG_DELETING, DELETING_ADMIN]]) {
    const file = `organizations/${org}/compliance/${uid}_${Date.now()}.pdf`
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), file), new Uint8Array(16), { contentType: 'application/pdf' })
    })
    await assertFails(read(uid, file))
    await assertFails(put(uid, EMAIL[uid], `organizations/${org}/compliance/${uid}_${Date.now() + 1}.pdf`, 64, 'application/pdf'))
  }
  const DEACT_ADMIN = 'deact-admin-a'
  EMAIL[DEACT_ADMIN] = `${DEACT_ADMIN}@test.com`
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users', DEACT_ADMIN), { email: EMAIL[DEACT_ADMIN], organizationId: ORG_A, role: 'admin', adminAccess: true, isActive: false })
  })
  const file = `organizations/${ORG_A}/compliance/${ADMIN_A}_${Date.now()}.pdf`
  await assertSucceeds(put(ADMIN_A, EMAIL[ADMIN_A], file, 64, 'application/pdf'))
  await assertFails(read(DEACT_ADMIN, file))
  await assertFails(put(DEACT_ADMIN, EMAIL[DEACT_ADMIN], `organizations/${ORG_A}/compliance/${DEACT_ADMIN}_${Date.now()}.pdf`, 64, 'application/pdf'))
})
