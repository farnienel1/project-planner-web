/**
 * Rulebook 1.30.0 (§16, §26): PAYE price work, expenses, their saved report copies and personal site audits.
 * Runs against the Firestore emulator only (own project id, so it can run beside the other rules tests).
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import {
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { assertFails } from './rulesAssert.ts'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-pc'
const ORG_B = 'org-pc-b'
const ADMIN = 'pc-admin'
const LM = 'pc-lm'
const SAM = 'pc-sam'
const PEER = 'pc-peer'
const MGR2 = 'pc-mgr2'
const ADMIN_B = 'pc-admin-b'
const GONE = 'pc-gone'
const MEMBER = 'pc-member'
const VISITOR = 'pc-visitor'
const NOLM = 'pc-nolm'

let env: RulesTestEnvironment

function db(uid: string) {
  return env.authenticatedContext(uid, { email: `${uid}@test.com` }).firestore()
}
function orgDoc(uid: string, ...segments: string[]) {
  return doc(db(uid), 'organizations', ORG, ...segments)
}

const EVIDENCE = [{ path: `organizations/${ORG}/payeClaims/${SAM}/${SAM}_1700000000000.jpg`, name: 'receipt.jpg', kind: 'photo' }]
function priceWork(userId: string, extra: Record<string, unknown> = {}) {
  return {
    userId,
    title: 'Tiling',
    details: 'Bathroom',
    jobNumber: 'J-1042',
    startDate: '2026-11-03',
    endDate: '2026-11-05',
    approvedByUserId: LM,
    approvedByName: 'Lena',
    amount: 250,
    currency: 'GBP',
    evidence: [],
    createdBy: userId,
    ...extra,
  }
}
function expense(userId: string, extra: Record<string, unknown> = {}) {
  return { userId, title: 'Fuel', details: '', jobNumber: 'J-1', date: '2026-11-04', amount: 12.5, currency: 'GBP', evidence: EVIDENCE, createdBy: userId, ...extra }
}
function report(userId: string, extra: Record<string, unknown> = {}) {
  return {
    userId,
    userName: 'Sam',
    companyName: 'Claims Co',
    kind: 'expense',
    rangeStart: '2026-10-26',
    rangeEnd: '2026-11-25',
    currency: 'GBP',
    items: [],
    totals: { amount: 0, itemCount: 0, evidenceCount: 0 },
    generatedBy: userId,
    ...extra,
  }
}
function audit(ownerUserId: string, extra: Record<string, unknown> = {}) {
  return {
    ownerUserId,
    jobNumber: 'J-77',
    jobName: 'Garden wall',
    type: 'General',
    customTitle: '',
    date: '2026-11-04',
    authorName: 'Sam',
    items: [{ id: 'i1', title: 'Crack', imagePath: `organizations/${ORG}/personalSiteAudits/${ownerUserId}/A1/${ownerUserId}_1.jpg` }],
    ...extra,
  }
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG), {
      name: 'Claims Co',
      creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [LM]: 'manager', [SAM]: 'member', [PEER]: 'member', [MGR2]: 'manager', [GONE]: 'manager', [MEMBER]: 'member', [VISITOR]: 'manager', [NOLM]: 'member' },
    })
    await setDoc(doc(d, 'organizations', ORG_B), { name: 'Other Co', creatorUserId: ADMIN_B, members: { [ADMIN_B]: 'admin' } })
    const user = (id: string, fields: Record<string, unknown>) => setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(LM, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(SAM, { role: 'operative', operativeMode: true, employmentType: 'paye', assignedManagerUserIds: [LM] })
    await user(PEER, { role: 'operative', operativeMode: true, employmentType: 'paye', assignedManagerUserIds: [MGR2] })
    await user(MGR2, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(GONE, { role: 'manager', manager: true, isActive: false })
    await user(MEMBER, { role: 'member' })
    await user(NOLM, { role: 'operative', operativeMode: true, employmentType: 'paye', assignedManagerUserIds: [LM], hasNoLineManager: true })
    await setDoc(doc(d, 'users', VISITOR), { email: `${VISITOR}@test.com`, organizationId: ORG_B, role: 'manager', manager: true })
    await setDoc(doc(d, 'organizations', ORG, 'expenseItems', 'EXN'), expense(NOLM, { evidence: [{ path: `organizations/${ORG}/payeClaims/${NOLM}/${NOLM}_1.jpg`, name: 'r', kind: 'photo' }] }))
    await setDoc(doc(d, 'users', ADMIN_B), { email: `${ADMIN_B}@test.com`, organizationId: ORG_B, role: 'admin', adminAccess: true })
    await setDoc(doc(d, 'organizations', ORG, 'priceWorkItems', 'PW1'), priceWork(SAM))
    // Stored before 1.30.1: no job number.
    const { jobNumber: _legacyJob, ...legacy } = priceWork(SAM)
    void _legacyJob
    await setDoc(doc(d, 'organizations', ORG, 'priceWorkItems', 'PWOLD'), legacy)
    await setDoc(doc(d, 'organizations', ORG, 'expenseItems', 'EX1'), expense(SAM))
    await setDoc(doc(d, 'organizations', ORG, 'payeClaimReports', 'R1'), report(SAM))
    await setDoc(doc(d, 'organizations', ORG, 'personalSiteAudits', 'A1'), audit(SAM))
  })
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-paye-claims',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  })
})

test.beforeEach(async () => {
  await env.clearFirestore()
  await seed()
})

test.after(async () => {
  await env?.cleanup()
})

test('1.30.0 the person adds their own price work with a listed approver', async () => {
  await assertSucceeds(setDoc(orgDoc(SAM, 'priceWorkItems', 'PW2'), priceWork(SAM)))
  await assertSucceeds(setDoc(orgDoc(SAM, 'priceWorkItems', 'PW3'), priceWork(SAM, { approvedByUserId: ADMIN, startDate: '2026-11-04', endDate: '2026-11-04' })))
})

test('1.30.0 price work approver must be an active admin or manager of this organisation, never yourself or an operative', async () => {
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'X1'), priceWork(SAM, { approvedByUserId: SAM })))
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'X2'), priceWork(SAM, { approvedByUserId: PEER })))
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'X3'), priceWork(SAM, { approvedByUserId: GONE })))
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'X4'), priceWork(SAM, { approvedByUserId: ADMIN_B })))
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'X5'), priceWork(SAM, { approvedByUserId: 'Bob the builder' })))
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'X6'), priceWork(SAM, { approvedByUserId: '' })))
})

test('1.30.0 price work shape: dates in order, amount above zero, no extra fields', async () => {
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'X1'), priceWork(SAM, { endDate: '2026-11-01' })))
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'X2'), priceWork(SAM, { amount: 0 })))
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'X3'), priceWork(SAM, { approved: true })))
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'X4'), priceWork(SAM, { title: '' })))
})

test('1.30.0 nobody writes another person\'s price work or expenses — line managers and admins included', async () => {
  await assertFails(setDoc(orgDoc(LM, 'priceWorkItems', 'X1'), priceWork(SAM)))
  await assertFails(setDoc(orgDoc(ADMIN, 'expenseItems', 'X1'), expense(SAM)))
  await assertFails(updateDoc(orgDoc(LM, 'priceWorkItems', 'PW1'), { amount: 1 }))
  await assertFails(updateDoc(orgDoc(ADMIN, 'expenseItems', 'EX1'), { amount: 1 }))
  await assertFails(deleteDoc(orgDoc(ADMIN, 'expenseItems', 'EX1')))
  // Self-escalation: the person cannot move an item onto someone else.
  await assertFails(updateDoc(orgDoc(SAM, 'expenseItems', 'EX1'), { userId: PEER }))
})

test('1.30.0 expenses need at least one piece of evidence', async () => {
  await assertFails(setDoc(orgDoc(SAM, 'expenseItems', 'X1'), expense(SAM, { evidence: [] })))
  await assertSucceeds(setDoc(orgDoc(SAM, 'expenseItems', 'EX2'), expense(SAM)))
  await assertFails(updateDoc(orgDoc(SAM, 'expenseItems', 'EX1'), { evidence: [] }))
  await assertSucceeds(updateDoc(orgDoc(SAM, 'expenseItems', 'EX1'), { title: 'Diesel' }))
  await assertSucceeds(deleteDoc(orgDoc(SAM, 'expenseItems', 'EX1')))
})

test('1.30.0 who reads: the person, their line manager and admins; never a peer, another manager or another company', async () => {
  for (const uid of [SAM, LM, ADMIN]) {
    await assertSucceeds(getDoc(orgDoc(uid, 'priceWorkItems', 'PW1')))
    await assertSucceeds(getDoc(orgDoc(uid, 'expenseItems', 'EX1')))
    await assertSucceeds(getDoc(orgDoc(uid, 'payeClaimReports', 'R1')))
  }
  for (const uid of [PEER, MGR2, ADMIN_B]) {
    await assertFails(getDoc(orgDoc(uid, 'priceWorkItems', 'PW1')))
    await assertFails(getDoc(orgDoc(uid, 'expenseItems', 'EX1')))
    await assertFails(getDoc(orgDoc(uid, 'payeClaimReports', 'R1')))
  }
  // Queries: the line manager by userId; the person their own; a peer refused.
  await assertSucceeds(getDocs(query(collection(db(LM), 'organizations', ORG, 'expenseItems'), where('userId', '==', SAM))))
  await assertSucceeds(getDocs(query(collection(db(SAM), 'organizations', ORG, 'priceWorkItems'), where('userId', '==', SAM))))
  await assertSucceeds(getDocs(collection(db(ADMIN), 'organizations', ORG, 'priceWorkItems')))
  await assertFails(getDocs(query(collection(db(PEER), 'organizations', ORG, 'expenseItems'), where('userId', '==', SAM))))
  await assertFails(getDocs(collection(db(LM), 'organizations', ORG, 'expenseItems')))
})

test('1.30.0 saved claim reports: the person creates their own once; nobody changes or deletes them', async () => {
  await assertSucceeds(setDoc(orgDoc(SAM, 'payeClaimReports', 'R2'), report(SAM, { kind: 'priceWork' })))
  await assertFails(setDoc(orgDoc(SAM, 'payeClaimReports', 'R3'), report(SAM, { kind: 'overtime' })))
  await assertFails(setDoc(orgDoc(LM, 'payeClaimReports', 'R4'), report(SAM)))
  await assertFails(setDoc(orgDoc(SAM, 'payeClaimReports', 'R5'), report(SAM, { generatedBy: LM })))
  await assertFails(updateDoc(orgDoc(SAM, 'payeClaimReports', 'R1'), { userName: 'x' }))
  await assertFails(deleteDoc(orgDoc(ADMIN, 'payeClaimReports', 'R1')))
})

test('1.30.0 personal site audits are the owner\'s only — admins and line managers cannot read or write them', async () => {
  await assertSucceeds(getDoc(orgDoc(SAM, 'personalSiteAudits', 'A1')))
  for (const uid of [LM, ADMIN, PEER, ADMIN_B]) {
    await assertFails(getDoc(orgDoc(uid, 'personalSiteAudits', 'A1')))
    await assertFails(updateDoc(orgDoc(uid, 'personalSiteAudits', 'A1'), { jobName: 'x' }))
    await assertFails(deleteDoc(orgDoc(uid, 'personalSiteAudits', 'A1')))
  }
  await assertFails(getDocs(collection(db(ADMIN), 'organizations', ORG, 'personalSiteAudits')))
  await assertSucceeds(getDocs(query(collection(db(SAM), 'organizations', ORG, 'personalSiteAudits'), where('ownerUserId', '==', SAM))))
  await assertSucceeds(setDoc(orgDoc(PEER, 'personalSiteAudits', 'A2'), audit(PEER)))
  await assertFails(setDoc(orgDoc(PEER, 'personalSiteAudits', 'A3'), audit(SAM)))
  await assertFails(setDoc(orgDoc(SAM, 'personalSiteAudits', 'A4'), audit(SAM, { jobName: '' })))
  await assertFails(setDoc(orgDoc(SAM, 'personalSiteAudits', 'A5'), audit(SAM, { items: [] })))
  await assertFails(updateDoc(orgDoc(SAM, 'personalSiteAudits', 'A1'), { ownerUserId: PEER }))
  await assertSucceeds(updateDoc(orgDoc(SAM, 'personalSiteAudits', 'A1'), { jobName: 'Garden wall (rear)' }))
  await assertSucceeds(deleteDoc(orgDoc(SAM, 'personalSiteAudits', 'A1')))
})

test('1.30.0 another company\'s admin and an inactive member write nothing', async () => {
  await assertFails(setDoc(doc(db(ADMIN_B), 'organizations', ORG, 'expenseItems', 'X1'), expense(ADMIN_B)))
  await assertFails(setDoc(orgDoc(GONE, 'expenseItems', 'X2'), expense(GONE)))
  await assertFails(setDoc(orgDoc(GONE, 'personalSiteAudits', 'X3'), audit(GONE)))
})

test('1.30.0 review: evidence must be the person\'s own claim files — not another person\'s, a private audit photo, a URL or an SVG', async () => {
  const bad = [
    { path: `organizations/${ORG}/payeClaims/${PEER}/${PEER}_1.jpg`, name: 'theirs', kind: 'photo' },
    { path: `organizations/${ORG}/personalSiteAudits/${SAM}/A1/${SAM}_1.jpg`, name: 'private', kind: 'photo' },
    { path: 'https://example.com/x.jpg', name: 'url', kind: 'file' },
    { path: `organizations/${ORG_B}/payeClaims/${SAM}/${SAM}_1.jpg`, name: 'other org', kind: 'photo' },
    { path: `organizations/${ORG}/payeClaims/${SAM}/${SAM}_1.svg`, name: 'svg', kind: 'photo', contentType: 'image/svg+xml' },
    'junk',
  ]
  for (const [i, entry] of bad.entries()) {
    await assertFails(setDoc(orgDoc(SAM, 'expenseItems', `BAD${i}`), expense(SAM, { evidence: [entry] })))
    // Hidden behind a good first entry too.
    await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', `BADP${i}`), priceWork(SAM, { evidence: [...EVIDENCE, ...EVIDENCE, entry] })))
  }
  const many = Array.from({ length: 21 }, (_, i) => ({ ...EVIDENCE[0], path: `organizations/${ORG}/payeClaims/${SAM}/${SAM}_${i}.jpg` }))
  await assertFails(setDoc(orgDoc(SAM, 'expenseItems', 'MANY'), expense(SAM, { evidence: many })))
  await assertSucceeds(setDoc(orgDoc(SAM, 'expenseItems', 'TWENTY'), expense(SAM, { evidence: many.slice(0, 20) })))
  // The heaviest valid write: price work with an approver read and 20 entries stays inside the expression budget.
  await assertSucceeds(setDoc(orgDoc(SAM, 'priceWorkItems', 'TWENTYP'), priceWork(SAM, { evidence: many.slice(0, 20) })))
  await assertSucceeds(updateDoc(orgDoc(SAM, 'priceWorkItems', 'TWENTYP'), { title: 'Tiling (2)' }))
})

test('1.30.0 review: the approver needs the admin or manager flag and a users document of this organisation', async () => {
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'M1'), priceWork(SAM, { approvedByUserId: MEMBER })))
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'M2'), priceWork(SAM, { approvedByUserId: VISITOR })))
  await assertSucceeds(setDoc(orgDoc(SAM, 'priceWorkItems', 'M3'), priceWork(SAM, { approvedByUserId: MGR2 })))
})

test('1.30.0 review: a person with "No line manager" stored is not read through a listed line manager', async () => {
  await assertFails(getDoc(orgDoc(LM, 'expenseItems', 'EXN')))
  await assertSucceeds(getDoc(orgDoc(ADMIN, 'expenseItems', 'EXN')))
})

test('1.30.0 review: personal audit edits keep the create shape; report copies are capped', async () => {
  await assertFails(updateDoc(orgDoc(SAM, 'personalSiteAudits', 'A1'), { items: [] }))
  await assertFails(updateDoc(orgDoc(SAM, 'personalSiteAudits', 'A1'), { date: 'yesterday' }))
  await assertFails(updateDoc(orgDoc(SAM, 'personalSiteAudits', 'A1'), { jobNumber: 'x'.repeat(61) }))
  await assertFails(setDoc(orgDoc(SAM, 'payeClaimReports', 'BIG'), report(SAM, { items: Array.from({ length: 501 }, () => ({})) })))
})

test('1.30.1 new price work needs a job number of 1–60 characters; an older item without one stays editable', async () => {
  const { jobNumber: _job, ...noJob } = priceWork(SAM)
  void _job
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'J1'), noJob))
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'J2'), priceWork(SAM, { jobNumber: '' })))
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'J3'), priceWork(SAM, { jobNumber: 'x'.repeat(61) })))
  await assertFails(setDoc(orgDoc(SAM, 'priceWorkItems', 'J4'), priceWork(SAM, { jobNumber: 1042 })))
  await assertSucceeds(setDoc(orgDoc(SAM, 'priceWorkItems', 'J5'), priceWork(SAM, { jobNumber: 'x'.repeat(60) })))
  // Legacy item: an update without a job number still passes; adding one must be 1–60.
  await assertSucceeds(updateDoc(orgDoc(SAM, 'priceWorkItems', 'PWOLD'), { title: 'Tiling (old)' }))
  await assertFails(updateDoc(orgDoc(SAM, 'priceWorkItems', 'PWOLD'), { jobNumber: '' }))
  await assertSucceeds(updateDoc(orgDoc(SAM, 'priceWorkItems', 'PWOLD'), { jobNumber: 'J-7' }))
  await assertFails(updateDoc(orgDoc(SAM, 'priceWorkItems', 'PW1'), { jobNumber: 'x'.repeat(61) }))
})

function claimReview(userId: string, itemId: string, extra: Record<string, unknown> = {}) {
  return { userId, itemId, kind: 'expense', decision: 'approved', fingerprint: 'expense|Fuel', reviewedBy: LM, ...extra }
}

test('1.32.0 claim reviews: the line manager or an admin approves or rejects; never the person, a peer or another company', async () => {
  await assertSucceeds(setDoc(orgDoc(LM, 'payeClaimReviews', 'expense_EX1'), claimReview(SAM, 'EX1')))
  await assertSucceeds(updateDoc(orgDoc(LM, 'payeClaimReviews', 'expense_EX1'), { decision: 'rejected' }))
  await assertSucceeds(setDoc(orgDoc(ADMIN, 'payeClaimReviews', 'priceWork_PW1'), claimReview(SAM, 'PW1', { kind: 'priceWork', reviewedBy: ADMIN })))
  await assertSucceeds(getDoc(orgDoc(SAM, 'payeClaimReviews', 'expense_EX1')))
  await assertFails(getDoc(orgDoc(PEER, 'payeClaimReviews', 'expense_EX1')))
  await assertFails(setDoc(orgDoc(SAM, 'payeClaimReviews', 'expense_EX2'), claimReview(SAM, 'EX2', { reviewedBy: SAM })), 'never their own')
  await assertFails(setDoc(orgDoc(MGR2, 'payeClaimReviews', 'expense_EX3'), claimReview(SAM, 'EX3', { reviewedBy: MGR2 })), 'another manager')
  await assertFails(setDoc(orgDoc(LM, 'payeClaimReviews', 'expense_EX4'), claimReview(SAM, 'EX4', { reviewedBy: ADMIN })), 'reviewedBy is the writer')
  await assertFails(setDoc(orgDoc(LM, 'payeClaimReviews', 'wrong_id'), claimReview(SAM, 'EX5')), 'id is kind_itemId')
  await assertFails(setDoc(orgDoc(LM, 'payeClaimReviews', 'expense_EX6'), claimReview(SAM, 'EX6', { decision: 'maybe' })))
  await assertFails(setDoc(orgDoc(LM, 'payeClaimReviews', 'expense_EX7'), claimReview(SAM, 'EX7', { amount: 1 })), 'no extra fields')
  await assertFails(setDoc(orgDoc(VISITOR, 'payeClaimReviews', 'expense_EX8'), claimReview(SAM, 'EX8', { reviewedBy: VISITOR })))
  await assertFails(setDoc(orgDoc(LM, 'payeClaimReviews', 'expense_EXN'), claimReview(NOLM, 'EXN')), 'No line manager stored: admins only')
  await assertFails(deleteDoc(orgDoc(LM, 'payeClaimReviews', 'expense_EX1')))
})

test('1.32.0 review fix (r274 S2): a claim review is pinned to its item, its person and never the writer under any id', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG, 'payeClaimReviews', 'expense_EX1'), claimReview(SAM, 'EX1'))
    await setDoc(doc(d, 'users', 'pc-adm2'), { email: 'pc-adm2@test.com', organizationId: ORG, role: 'admin', adminAccess: true, formerUserIds: ['pc-adm2-old'] })
    await setDoc(doc(d, 'users', 'pc-adm2-old'), { email: 'pc-adm2@test.com', organizationId: ORG, role: 'admin', adminAccess: true })
    await setDoc(doc(d, 'organizations', ORG), { name: 'Claims Co', creatorUserId: ADMIN, members: { [ADMIN]: 'admin', [LM]: 'manager', [SAM]: 'member', [PEER]: 'member', [MGR2]: 'manager', 'pc-adm2': 'admin' } })
    await setDoc(doc(d, 'organizations', ORG, 'expenseItems', 'ADM2OLD'), expense('pc-adm2-old', { evidence: [{ path: `organizations/${ORG}/payeClaims/pc-adm2-old/x_1.jpg`, name: 'r', kind: 'photo' }] }))
    await setDoc(doc(d, 'organizations', ORG, 'expenseItems', 'LMX'), expense(LM, { evidence: [{ path: `organizations/${ORG}/payeClaims/${LM}/x_1.jpg`, name: 'r', kind: 'photo' }] }))
  })
  // Another person's line manager cannot re-file SAM's review under their own report.
  await assertFails(updateDoc(orgDoc(MGR2, 'payeClaimReviews', 'expense_EX1'), { userId: PEER, decision: 'rejected', reviewedBy: MGR2 }))
  // A review names the item's own person: LM cannot review their own item filed as SAM's.
  await assertFails(setDoc(orgDoc(LM, 'payeClaimReviews', 'expense_LMX'), claimReview(SAM, 'LMX')))
  // An admin never reviews their own item, under their uid or an alias id.
  await assertFails(setDoc(orgDoc('pc-adm2', 'payeClaimReviews', 'expense_ADM2OLD'), claimReview('pc-adm2-old', 'ADM2OLD', { reviewedBy: 'pc-adm2' })))
  // The item must exist.
  await assertFails(setDoc(orgDoc(LM, 'payeClaimReviews', 'expense_NOPE'), claimReview(SAM, 'NOPE')))
  // The line manager's own update of the review keeps working.
  await assertSucceeds(updateDoc(orgDoc(LM, 'payeClaimReviews', 'expense_EX1'), { decision: 'rejected', reviewedBy: LM }))
  // Another admin reviews the alias-filed item.
  await assertSucceeds(setDoc(orgDoc(ADMIN, 'payeClaimReviews', 'expense_ADM2OLD'), claimReview('pc-adm2-old', 'ADM2OLD', { reviewedBy: ADMIN })))
})
