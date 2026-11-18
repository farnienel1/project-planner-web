/**
 * Rules 1.64.0 (§16): mass-assignment allowlists. Before 1.64.0 several write paths were denylists, or used
 * `diff().changedKeys().hasOnly(...)`, which ignores added and removed keys, so an extra or deleted field slipped
 * through. Each path now lists the keys it may touch (`affectedKeys().hasOnly`, or `keys().hasOnly` on create).
 *
 * The suite has three parts:
 * 1. The attacks an emulator audit proved on main d3927045 (17 Nov), each now refused.
 * 2. A sweep: every tightened create / update path, sent each privileged field as an extra key, is refused.
 * 3. The write shapes web and iOS send today on those paths still pass.
 *
 *   npm run test:rules
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { assertFails, assertSucceeds } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { notificationCreateFields, organizationCreateFields, parseTaskDocument, taskFields, taskWriteFields } from '../lib/canonical'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(process.env.RULES_PATH || path.join(root, 'firestore.rules'), 'utf8')

let env: RulesTestEnvironment
const ORG = 'pe-org'
const FOUNDER = 'pe-founder'
const ADMIN = 'pe-admin'
const MGR = 'pe-mgr' // a manager with the Operatives toggle
const OP = 'pe-op' // a signed-up operative, line-managed by MGR
const OP2 = 'pe-op2' // a signed-up operative, line-managed by ADMIN
const PH = 'pe-ph' // an invite placeholder (not signed up)
const NOW = Timestamp.fromDate(new Date('2026-11-17T10:00:00Z'))

function person(id: string, extra: Record<string, unknown>) {
  return { email: `${id}@test.com`, organizationId: ORG, firstName: id, surname: 'Test', isActive: true, passwordSet: true, ...extra }
}

async function seed() {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    await setDoc(doc(fs, 'organizations', ORG), {
      name: 'Escalation Ltd', creatorUserId: FOUNDER,
      members: { [FOUNDER]: 'admin', [ADMIN]: 'admin', [MGR]: 'manager', [OP]: 'operative', [OP2]: 'operative', [PH]: 'operative' },
    })
    await setDoc(doc(fs, 'users', FOUNDER), person(FOUNDER, { role: 'admin', adminAccess: true, isSuperAdmin: true }))
    await setDoc(doc(fs, 'users', ADMIN), person(ADMIN, { role: 'admin', adminAccess: true, assignedManagerUserIds: [FOUNDER] }))
    await setDoc(doc(fs, 'users', MGR), person(MGR, {
      role: 'manager', manager: true, operatives: true, adminAccess: false, isSuperAdmin: false,
      permissions: { manager: true, operatives: true }, annualLeaveSelfBook: true, assignedManagerUserIds: [ADMIN],
    }))
    await setDoc(doc(fs, 'users', OP), person(OP, {
      role: 'operative', operativeMode: true, manager: false, adminAccess: false, isSuperAdmin: false,
      permissions: { operativeMode: true, materials: true, siteAudit: true }, materials: true, siteAudit: true,
      assignedManagerUserIds: [MGR], assignedManagerUserId: MGR, annualLeaveDaysPerYear: 25, payBasis: 'day', dayRate: 200,
      notificationPreferences: { timesheetSignOff: true }, pushTokens: ['old-token'],
    }))
    await setDoc(doc(fs, 'users', OP2), person(OP2, {
      role: 'operative', operativeMode: true, assignedManagerUserIds: [ADMIN], assignedManagerUserId: ADMIN,
    }))
    await setDoc(doc(fs, 'users', PH), person(PH, {
      role: 'operative', operativeMode: true, passwordSet: false, assignedManagerUserIds: [ADMIN],
    }))
    await setDoc(doc(fs, 'organizations', ORG, 'tasks', 't1'), {
      id: 't1', title: 'Task', createdByUserId: ADMIN, createdBy: 'Admin', status: 'To Do',
      assignedOperativeIds: [OP], organizationId: ORG,
    })
    await setDoc(doc(fs, 'organizations', ORG, 'operatives', 'row-op'), {
      email: `${OP}@test.com`, name: 'Op One', isActive: true, qualifications: [], qualificationExpiryDates: {},
    })
    await setDoc(doc(fs, 'organizations', ORG, 'operatives', 'row-op2'), {
      email: `${OP2}@test.com`, name: 'Op Two', isActive: true, qualifications: [{ id: 'q1', name: 'CSCS' }],
    })
    await setDoc(doc(fs, 'organizations', ORG, 'managers', 'row-mgr'), { email: `${MGR}@test.com`, name: 'Mgr' })
    await setDoc(doc(fs, 'organizations', ORG, 'notifications', 'n-op'), {
      organizationId: ORG, type: 'task_created', title: 'T', message: 'M', userId: OP, isRead: false, createdAt: NOW,
    })
    await setDoc(doc(fs, 'productFeedback', 'idea1'), { authorUserId: 'someone-else', title: 'Idea', voteCount: 1, commentCount: 0 })
    await setDoc(doc(fs, 'productFeedback', 'idea-op'), { authorUserId: OP, title: 'Mine', voteCount: 1, commentCount: 0 })
    await setDoc(doc(fs, 'productFeedbackComments', 'c-op'), { authorUserId: OP, suggestionId: 'idea1', body: 'Hi', isOfficial: false })
    await setDoc(doc(fs, 'productSessions', 's-op'), { userId: OP, organizationId: ORG, startedAt: NOW, lastActivityAt: NOW })
  })
}

async function db(uid: string, extra: Record<string, unknown> = {}) {
  return (await claimsContext(env, uid, { email: `${uid}@test.com`, ...extra })).firestore()
}

const PRIVILEGED_USER_FIELDS: Record<string, unknown> = {
  role: 'admin', isSuperAdmin: true, adminAccess: true, manager: true, operatives: true,
  'permissions.adminAccess': true, 'permissions.manager': true, 'permissions.operatives': true,
  'permissions.annualLeaveSelfBook': true, annualLeaveSelfBook: true, timesheetSelfSign: true,
  organizationId: 'other-org', isActive: false, passwordSet: deleteField(), ghost: true, inviteEmailHint: 'x@test.com',
  invitationId: 'inv-1', dayRate: 999, hourlyRate: 99, payBasis: 'hourly', assignedManagerUserIds: ['pe-op2'],
  assignedManagerUserId: 'pe-op2', hasNoLineManager: true, employmentType: 'paye', annualLeaveDaysPerYear: 365,
  annualLeaveYearAllowance: 99, annualLeaveCarriesOver: true, annualLeaveEnabled: false, timesheetsEnabled: true,
  formerUserIds: ['someone'], sameEmailUserIds: ['someone'], accountConfirmed: false, email: 'other@test.com',
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-privilege-escalation',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080) },
  })
})

test.after(async () => {
  await env.cleanup()
})

// ── Part 1: the attacks proven on main d3927045 ──────────────────────────────────────────────

test('A ops manager: cannot remove passwordSet, add ghost / invitationId / accountConfirmed, or then change the line manager', async () => {
  await seed()
  const mgr = await db(MGR)
  await assertFails(updateDoc(doc(mgr, 'users', OP2), { passwordSet: deleteField() })) // A1
  await assertFails(updateDoc(doc(mgr, 'users', OP2), { assignedManagerUserIds: [MGR] })) // A2 (control: signed up)
  await assertFails(updateDoc(doc(mgr, 'users', OP), { ghost: true })) // A3
  await assertFails(updateDoc(doc(mgr, 'users', OP), { invitationId: 'x', accountConfirmed: true })) // A4
  await assertFails(updateDoc(doc(mgr, 'users', OP), { role: deleteField() })) // A5 (probe2)
  await assertFails(updateDoc(doc(mgr, 'users', OP), { inviteEmailHint: 'x@test.com' }))
})

test('B self: cannot raise annual leave, add an employment type, unset passwordSet / accountConfirmed or add manager', async () => {
  await seed()
  const op = await db(OP)
  await assertFails(updateDoc(doc(op, 'users', OP), { annualLeaveDaysPerYear: 365 })) // B1
  await assertFails(updateDoc(doc(op, 'users', OP), { annualLeaveCarriesOver: true }))
  await assertFails(updateDoc(doc(op, 'users', OP), { annualLeaveYearAllowance: 99 }))
  await assertFails(updateDoc(doc(op, 'users', OP), { employmentType: 'paye' })) // B2 (missing stays missing)
  await assertFails(updateDoc(doc(op, 'users', OP), { accountConfirmed: false }))
  await assertFails(updateDoc(doc(op, 'users', OP), { manager: true })) // B4 (control)
  await assertFails(updateDoc(doc(op, 'users', OP), { passwordSet: deleteField() })) // B5 (probe2)
  await assertFails(updateDoc(doc(op, 'users', OP), { passwordSet: false }))
  await assertFails(updateDoc(doc(op, 'users', OP), { timesheetsEnabled: true }))
  await assertFails(updateDoc(doc(op, 'users', OP), { invitationId: 'inv-x' }))
  await assertFails(updateDoc(doc(op, 'users', OP), { ppIdeaAdmin: { idea1: { officialResponse: 'x' } } }))
})

test('C leave: ownership on create is the userId, never an operativeId next to someone else\'s userId', async () => {
  await seed()
  const mgr = await db(MGR) // a self-booker
  await assertFails(setDoc(doc(mgr, 'organizations', ORG, 'holidayBookings', 'h1'), {
    userId: OP2, operativeId: MGR, status: 'approved', startDate: '2026-12-01', endDate: '2026-12-05', timeSlot: 'FULL DAY',
  })) // C1
  const op = await db(OP)
  await assertFails(setDoc(doc(op, 'organizations', ORG, 'holidayBookings', 'h2'), {
    userId: OP2, operativeId: OP, status: 'pending', startDate: '2026-12-01', endDate: '2026-12-05',
  })) // C2
})

test('D organisation create: only the exact create shape, the creator alone as admin, billing pending', async () => {
  await seed()
  const evil = env.authenticatedContext('pe-evil', { email: 'pe-evil@test.com', email_verified: false }).firestore()
  const base = organizationCreateFields({ name: 'Evil', creatorUserId: 'pe-evil', createdAt: NOW, updatedAt: NOW }) as Record<string, unknown>
  await assertFails(setDoc(doc(evil, 'organizations', 'neworg'), {
    name: 'X', creatorUserId: 'pe-evil', members: { 'pe-evil': 'admin', [MGR]: 'operative' },
    billing: { status: 'active', accessOpen: true, mrrPence: 99900 },
  })) // D1
  await assertFails(setDoc(doc(evil, 'organizations', 'o2'), { ...base, billing: { ...(base.billing as object), status: 'active' } }))
  await assertFails(setDoc(doc(evil, 'organizations', 'o3'), { ...base, billing: { ...(base.billing as object), accessOpen: true } }))
  await assertFails(setDoc(doc(evil, 'organizations', 'o4'), { ...base, billing: { ...(base.billing as object), trialUsed: true } }))
  await assertFails(setDoc(doc(evil, 'organizations', 'o5'), { ...base, subscription: { status: 'active' } }))
  await assertFails(setDoc(doc(evil, 'organizations', 'o6'), { ...base, members: { 'pe-evil': 'admin', [MGR]: 'manager' } }))
  await assertFails(setDoc(doc(evil, 'organizations', 'o7'), { ...base, creatorUserId: MGR }))
  await assertFails(setDoc(doc(evil, 'organizations', 'o8'), { ...base, deletion: { status: 'scheduled' } }))
  await assertFails(setDoc(doc(evil, 'organizations', 'o9'), { ...base, isInternal: true }))
})

test('E tasks and operatives rows: an operative completes their task and edits only their own qualifications', async () => {
  await seed()
  const op = await db(OP)
  await assertFails(updateDoc(doc(op, 'organizations', ORG, 'tasks', 't1'), { createdByUserId: OP, status: 'Completed', assignedOperativeIds: [] })) // E1
  await assertFails(updateDoc(doc(op, 'organizations', ORG, 'tasks', 't1'), { assignedOperativeIds: [] }))
  await assertFails(updateDoc(doc(op, 'organizations', ORG, 'tasks', 't1'), { title: 'Renamed' }))
  await assertFails(setDoc(doc(op, 'organizations', ORG, 'tasks', 't2'), { title: 'New', createdByUserId: ADMIN }))
  await assertFails(updateDoc(doc(op, 'organizations', ORG, 'operatives', 'row-op2'), {
    qualifications: [{ id: 'q1', name: 'CSCS', endDate: '2099-01-01' }], isActive: false,
  })) // E2
  await assertFails(updateDoc(doc(op, 'organizations', ORG, 'operatives', 'row-op2'), { qualifications: [] }))
  await assertFails(updateDoc(doc(op, 'organizations', ORG, 'operatives', 'row-op'), { isActive: false }))
  await assertFails(updateDoc(doc(op, 'organizations', ORG, 'managers', 'row-mgr'), { name: 'Hacked' }))
})

test('F product feedback: no official response, status, hidden or vote count from a user', async () => {
  await seed()
  const op = await db(OP)
  await assertFails(updateDoc(doc(op, 'productFeedback', 'idea1'), { officialResponse: 'Visit http://evil', status: 'shipped', hidden: true })) // F1
  await assertFails(setDoc(doc(op, 'productFeedback', 'idea2'), { authorUserId: OP, title: 't', officialResponse: 'x', voteCount: 9999, status: 'shipped' })) // F2
  await assertFails(updateDoc(doc(op, 'productFeedback', 'idea1'), { voteCount: 50 }))
  await assertFails(updateDoc(doc(op, 'productFeedback', 'idea-op'), { status: 'shipped' }))
  await assertFails(setDoc(doc(op, 'productFeedbackComments', 'c2'), { authorUserId: OP, suggestionId: 'idea1', body: 'x', isOfficial: true }))
  await assertFails(updateDoc(doc(op, 'productFeedbackComments', 'c-op'), { isOfficial: true }))
  await assertFails(updateDoc(doc(op, 'productSessions', 's-op'), { userId: 'someone-else' }))
})

test('G notifications: actorUserId is the caller (except the three scheduled types), known keys only, read state only', async () => {
  await seed()
  const op = await db(OP)
  const row = { organizationId: ORG, type: 'push_test', title: 'Reset your password', message: 'http://evil', userId: ADMIN, isRead: false, createdAt: NOW }
  await assertFails(setDoc(doc(op, 'organizations', ORG, 'notifications', 'n1'), row)) // G1
  await assertFails(setDoc(doc(op, 'organizations', ORG, 'notifications', 'n2'), { ...row, actorUserId: ADMIN }))
  await assertFails(setDoc(doc(op, 'organizations', ORG, 'notifications', 'n3'), { ...row, actorUserId: OP, isRead: true }))
  await assertFails(setDoc(doc(op, 'organizations', ORG, 'notifications', 'n4'), { ...row, actorUserId: OP, link: 'http://evil' }))
  await assertFails(updateDoc(doc(op, 'organizations', ORG, 'notifications', 'n-op'), { title: 'Changed' }))
  await assertFails(updateDoc(doc(op, 'organizations', ORG, 'notifications', 'n-op'), { actorUserId: OP }))
  const admin = await db(ADMIN)
  await assertFails(updateDoc(doc(admin, 'organizations', ORG, 'notifications', 'n-op'), { message: 'Phish' }))
})

test('I / J account confirmations and email claims', async () => {
  await seed()
  const evil = env.authenticatedContext('pe-evil', { email: 'pe-evil@test.com', email_verified: false }).firestore()
  await assertFails(setDoc(doc(evil, 'accountConfirmations', 'tok1'), { userId: 'pe-evil', email: `${OP}@test.com`, isUsed: false }))
  await assertFails(setDoc(doc(evil, 'accountConfirmations', 'tok2'), { userId: 'pe-evil', email: 'pe-evil@test.com', isUsed: true }))
  await assertFails(setDoc(doc(evil, 'accountConfirmations', 'tok3'), { userId: 'pe-evil', email: 'pe-evil@test.com', isUsed: false, role: 'admin' }))
  await assertFails(setDoc(doc(evil, 'organizations', ORG, 'userEmails', 'pe-evil@test.com'), { userId: 'pe-evil' })) // J1
})

// ── Part 2: privileged fields as extra keys ────────────────────────────────────────────────

test('sweep: every privileged field is refused on an operative\'s own profile update', async () => {
  await seed()
  const op = await db(OP)
  for (const [key, value] of Object.entries(PRIVILEGED_USER_FIELDS)) {
    if (key === 'passwordSet') continue // removal tested in B (deleteField is not a value here)
    await assertFails(updateDoc(doc(op, 'users', OP), { firstName: 'Ok', [key]: value }))
  }
})

test('sweep: every field outside the operative edit list is refused on an operatives manager\'s update', async () => {
  await seed()
  const mgr = await db(MGR)
  const refused = ['role', 'isSuperAdmin', 'adminAccess', 'manager', 'operatives', 'permissions.adminAccess', 'organizationId',
    'ghost', 'inviteEmailHint', 'invitationId', 'formerUserIds', 'sameEmailUserIds', 'accountConfirmed', 'email', 'hasNoLineManager']
  for (const key of refused) {
    await assertFails(updateDoc(doc(mgr, 'users', OP), { firstName: 'Ok', [key]: PRIVILEGED_USER_FIELDS[key] }))
  }
  await assertFails(updateDoc(doc(mgr, 'users', OP), { firstName: 'Ok', passwordSet: deleteField() }))
  await assertFails(updateDoc(doc(mgr, 'users', OP), { firstName: 'Ok', status: 'active' }))
  await assertFails(updateDoc(doc(mgr, 'users', OP), { firstName: 'Ok', createdAt: NOW }))
})

test('sweep: privileged keys on organisation, notification, idea, task, operative row and confirmation writes', async () => {
  await seed()
  const evil = env.authenticatedContext('pe-evil', { email: 'pe-evil@test.com', email_verified: false }).firestore()
  const base = organizationCreateFields({ name: 'Evil', creatorUserId: 'pe-evil', createdAt: NOW, updatedAt: NOW }) as Record<string, unknown>
  for (const extra of [{ billing: { status: 'active' } }, { members: { 'pe-evil': 'admin', x: 'admin' } }, { creatorUserId: 'x' },
    { deletion: { status: 'scheduled' } }, { platformOwner: true }, { role: 'admin' }]) {
    await assertFails(setDoc(doc(evil, 'organizations', 'sw-org'), { ...base, ...extra }))
  }
  const op = await db(OP)
  const n = { organizationId: ORG, type: 'task_created', title: 'T', message: 'M', userId: ADMIN, isRead: false, createdAt: NOW, actorUserId: OP }
  for (const extra of [{ role: 'admin' }, { actorUserId: ADMIN }, { isRead: true }, { permissions: {} }]) {
    await assertFails(setDoc(doc(op, 'organizations', ORG, 'notifications', 'sw-n'), { ...n, ...extra }))
  }
  for (const extra of [{ status: 'approved' }, { userId: ADMIN }, { type: 'x' }, { role: 'admin' }]) {
    await assertFails(updateDoc(doc(op, 'organizations', ORG, 'notifications', 'n-op'), { isRead: true, ...extra }))
  }
  for (const extra of [{ officialResponse: 'x' }, { status: 'shipped' }, { hidden: true }, { pinned: true }, { releaseNote: 'x' },
    { voteCount: 2 }, { commentCount: 1 }, { reviewedByUserId: 'x' }, { mergedIntoId: 'x' }, { authorUserId: 'x' }, { role: 'admin' }]) {
    await assertFails(setDoc(doc(op, 'productFeedback', 'sw-idea'), { authorUserId: OP, title: 't', voteCount: 1, commentCount: 0, ...extra }))
    // (a ±1 vote or comment count is a legitimate update; the sweep sends a jump instead)
    const updateExtra = 'voteCount' in extra ? { voteCount: 9 } : 'commentCount' in extra ? { commentCount: 5 } : extra
    await assertFails(updateDoc(doc(op, 'productFeedback', 'idea-op'), { title: 'Edited', ...updateExtra }))
  }
  for (const extra of [{ createdByUserId: OP }, { createdBy: 'Op' }, { assignedOperativeIds: [] }, { organizationId: 'x' }, { priority: 'High' }]) {
    await assertFails(updateDoc(doc(op, 'organizations', ORG, 'tasks', 't1'), { status: 'In Progress', ...extra }))
  }
  for (const extra of [{ isActive: false }, { email: 'x@test.com' }, { userId: OP }, { linkedUserId: OP }, { dayRate: 999 }, { notes: 'x' }, { skills: ['x'] }]) {
    await assertFails(updateDoc(doc(op, 'organizations', ORG, 'operatives', 'row-op'), { qualifications: [], ...extra }))
  }
  for (const extra of [{ isUsed: true }, { organizationId: ORG, role: 'admin' }, { accountConfirmed: true }]) {
    await assertFails(setDoc(doc(evil, 'accountConfirmations', 'sw-tok'), { userId: 'pe-evil', email: 'pe-evil@test.com', isUsed: false, ...extra }))
  }
})

// ── Part 3: the write shapes both apps send today ───────────────────────────────────────────

test('positive: own profile writes from web and iOS still save', async () => {
  await seed()
  const op = await db(OP)
  const me = doc(op, 'users', OP)
  // Web Settings → profile; iOS patchUserIdentity (names, lastName, name, displayName, mobile, metadata).
  await assertSucceeds(updateDoc(me, { firstName: 'New', surname: 'Name', mobileNumber: '07000', updatedAt: serverTimestamp(), updatedBy: OP, updatedFrom: 'web' }))
  await assertSucceeds(updateDoc(me, { firstName: 'Newer', surname: 'Name', lastName: 'Name', name: 'Newer Name', displayName: 'Newer Name', mobileNumber: deleteField(), updatedBy: OP, updatedFrom: 'ios', updatedAt: serverTimestamp() }))
  await assertSucceeds(updateDoc(me, { email: `${OP}@test.com` })) // unchanged email in an iOS identity write
  await assertSucceeds(updateDoc(me, { profilePhotoURL: 'https://x/p.jpg', profilePhotoUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() }))
  await assertSucceeds(updateDoc(me, { 'notificationPreferences.timesheetSignOff': false, updatedAt: NOW }))
  await assertSucceeds(setDoc(me, { pushTokens: ['old-token', 'new-token'], pushTokenUpdatedAt: NOW }, { merge: true }))
  await assertSucceeds(updateDoc(me, { pushTokens: arrayUnion('third') }))
  await assertSucceeds(updateDoc(me, { lastSeenAt: NOW }))
  await assertSucceeds(setDoc(me, { lastSeenAt: NOW, updatedAt: NOW }, { merge: true }))
  await assertSucceeds(updateDoc(me, {
    policyAccepted: true, policyAcceptedAt: NOW, legalPackVersion: '2026-11', legalPackAcceptedAt: NOW,
    legalAcceptances: { saas: true, dpa: true }, updatedBy: OP, updatedFrom: 'web', updatedAt: NOW,
  }))
  await assertSucceeds(updateDoc(me, { accountConfirmed: true, accountConfirmedAt: NOW, updatedAt: NOW }))
  await assertSucceeds(setDoc(me, { webNavigateSidebar: { order: ['a'] } }, { merge: true }))
  await assertSucceeds(setDoc(me, { webDashboardLayouts: { [ORG]: { layout: [] } }, webDashboardLayout: null, updatedAt: NOW }, { merge: true }))
  await assertSucceeds(updateDoc(me, { 'ppIdeas.i1': { title: 'x' }, 'ppIdeaVotes.i1': { userId: OP }, ppIdeaBoard: true, updatedAt: NOW }))
  await assertSucceeds(updateDoc(me, { utrNumber: deleteField(), vatNumber: deleteField() }))
  await assertSucceeds(updateDoc(me, { tradeTypePreset: 'Electrician', tradeTypeCustom: deleteField(), updatedAt: NOW }))
  // Web sign-in repair patch (authStore): passwordSet → true, skills → false.
  await assertSucceeds(updateDoc(me, { passwordSet: true, skills: false, updatedAt: NOW }))
  // An iOS full merge that writes privileged fields back unchanged still passes (diff, not presence).
  await assertSucceeds(setDoc(me, {
    role: 'operative', operativeMode: true, isActive: true, organizationId: ORG, dayRate: 200, payBasis: 'day',
    assignedManagerUserIds: [MGR], assignedManagerUserId: MGR, annualLeaveDaysPerYear: 25, firstName: 'Merged',
  }, { merge: true }))
})

test('positive: a placeholder repaired on sign-in may set passwordSet true; an admin edit is unchanged', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', OP2), { passwordSet: deleteField(), operativeMode: deleteField() })
  })
  const op2 = await db(OP2)
  await assertSucceeds(updateDoc(doc(op2, 'users', OP2), { passwordSet: true, operativeMode: true, updatedAt: NOW }))
  const admin = await db(ADMIN)
  await assertSucceeds(updateDoc(doc(admin, 'users', OP), { annualLeaveDaysPerYear: 28, timesheetsEnabled: true, employmentType: 'paye' }))
})

test('positive: an operatives manager still edits an operative', async () => {
  await seed()
  const mgr = await db(MGR)
  await assertSucceeds(updateDoc(doc(mgr, 'users', OP), {
    firstName: 'Op', surname: 'Renamed', lastName: 'Renamed', name: 'Op Renamed', displayName: 'Op Renamed', updatedAt: NOW,
  }))
  await assertSucceeds(updateDoc(doc(mgr, 'users', OP), { dayRate: deleteField(), hourlyRate: 25, payBasis: 'hourly' }))
  await assertSucceeds(updateDoc(doc(mgr, 'users', OP), { materials: false, 'permissions.materials': false, updatedAt: NOW }))
  await assertSucceeds(updateDoc(doc(mgr, 'users', OP), { mobileNumber: '07111', tradeTypePreset: 'Labourer', employmentStartDate: '2026-01-05' }))
  await assertSucceeds(updateDoc(doc(mgr, 'users', OP), { annualLeaveDaysPerYear: 28, timesheetsEnabled: true }))
  // A placeholder's line manager is still theirs to set (1.33.0).
  await assertSucceeds(updateDoc(doc(mgr, 'users', PH), { assignedManagerUserIds: [MGR], assignedManagerUserId: MGR }))
})

test('positive: organisation create from the web setup wizard and from iOS sign-up', async () => {
  await seed()
  const founder = env.authenticatedContext('pe-new', { email: 'pe-new@test.com', email_verified: false }).firestore()
  const web = organizationCreateFields({
    name: 'New Co', creatorUserId: 'pe-new', planKey: 'year', createdAt: NOW, updatedAt: NOW,
    settings: { myScheduleOptions: {}, materialCutOff: {}, currencyCode: 'GBP', bankHolidayRegionId: 'GB-ENG-WLS' },
    setupFields: {
      officeAddressLine1: '1 Road', officeAddressLine2: 'Unit 2', officeCity: 'Town', officeCounty: 'County',
      officePostcode: 'AB1 2CD', countryCode: 'GB', companyLogoURL: 'https://x/l.png', currency: 'GBP', currencyCode: 'GBP',
      bankHolidayRegionId: 'GB-ENG-WLS', payrollTimePolicy: { standardDayStart: '07:00' }, annualLeaveDefaults: { daysPerYear: 25 },
      warningDetection: { detectClashes: true }, invoicing: { paymentRunMode: 'date_ranges', payePayday: 25 },
    },
  }) as Record<string, unknown>
  await assertSucceeds(setDoc(doc(founder, 'organizations', 'pe-new-org'), web))
  const ios = organizationCreateFields({
    name: 'iOS Co', creatorUserId: 'pe-new', planKey: null, createdAt: NOW, updatedAt: NOW, setupFields: { countryCode: 'GB' }, settings: {},
  }) as Record<string, unknown>
  await assertSucceeds(setDoc(doc(founder, 'organizations', 'pe-ios-org'), ios))
  // The founder's own email claim right after the create (their token has no claims for the new company yet).
  await assertSucceeds(setDoc(doc(founder, 'organizations', 'pe-new-org', 'userEmails', 'pe-new@test.com'), { userId: 'pe-new' }))
})

test('positive: leave, notifications, feedback, tasks, operative rows, confirmations and sessions', async () => {
  await seed()
  const op = await db(OP)
  await assertSucceeds(setDoc(doc(op, 'organizations', ORG, 'holidayBookings', 'h-own'), {
    userId: OP, operativeId: OP, status: 'pending', startDate: '2026-12-01', endDate: '2026-12-02', timeSlot: 'FULL DAY',
  }))
  const mgr = await db(MGR)
  await assertSucceeds(setDoc(doc(mgr, 'organizations', ORG, 'holidayBookings', 'h-mgr'), {
    userId: MGR, status: 'approved', approvedByUserId: MGR, startDate: '2026-12-01', endDate: '2026-12-02', timeSlot: 'FULL DAY',
  }))
  // A line manager books approved leave for their report (§9 canBookLeaveFor).
  await assertSucceeds(setDoc(doc(mgr, 'organizations', ORG, 'holidayBookings', 'h-for'), {
    userId: OP, status: 'approved', approvedByUserId: MGR, startDate: '2026-12-08', endDate: '2026-12-08', timeSlot: 'FULL DAY',
  }))
  // Notifications: the shared create shape (web saveInboxNotification / iOS saveNotification).
  const created = notificationCreateFields({
    organizationId: ORG, type: 'task_created', title: 'T', message: 'M', userId: ADMIN, actorUserId: OP, relatedId: 't1',
    dayKey: '2026-11-17', catalogue: 'projects', detail: 'd', createdAt: NOW, serverTimestamp: serverTimestamp(),
  } as never)
  await assertSucceeds(setDoc(doc(op, 'organizations', ORG, 'notifications', 'n-ok'), created!.set))
  const scheduled = notificationCreateFields({
    organizationId: ORG, type: 'deadline_reminder', title: 'T', message: 'M', userId: OP, createdAt: NOW,
  } as never)
  await assertSucceeds(setDoc(doc(op, 'organizations', ORG, 'notifications', 'n-sched'), scheduled!.set))
  await assertSucceeds(updateDoc(doc(op, 'organizations', ORG, 'notifications', 'n-op'), { isRead: true }))
  // Feedback: submitIdea shape, a vote, a comment and its edit.
  await assertSucceeds(setDoc(doc(op, 'productFeedback', 'idea-new'), {
    title: 'T', details: 'D', category: 'feature', relatedFeature: 'x', authorUserId: OP, authorName: 'Op', authorRole: 'operative',
    organizationId: ORG, organizationName: '', showCompanyName: false, voteCount: 1, commentCount: 0, publicStatus: 'under_review',
    productDecision: 'none', status: 'new', officialResponse: '', releaseNote: '', effort: '', pinned: false, hidden: false,
    mergedIntoId: '', createdAt: NOW, updatedAt: NOW, reviewedByUserId: '', followerCount: 1, orgCount: 0, trendingScore: 0,
  }))
  await assertSucceeds(setDoc(doc(op, 'productFeedback', 'idea1'), { voteCount: 2, updatedAt: NOW }, { merge: true }))
  await assertSucceeds(setDoc(doc(op, 'productFeedback', 'idea1'), { commentCount: 1, updatedAt: NOW }, { merge: true }))
  await assertSucceeds(updateDoc(doc(op, 'productFeedback', 'idea-op'), { title: 'Edited', details: 'More', updatedAt: NOW }))
  await assertSucceeds(setDoc(doc(op, 'productFeedbackComments', 'c-new'), { suggestionId: 'idea1', authorUserId: OP, authorName: 'Op', body: 'x', isOfficial: false, createdAt: NOW }))
  await assertSucceeds(setDoc(doc(op, 'productFeedbackComments', 'c-op'), { body: 'Edited', editedAt: NOW }, { merge: true }))
  await assertSucceeds(setDoc(doc(op, 'productFeedbackComments', 'c-op'), { deleted: true, body: '', updatedAt: NOW }, { merge: true }))
  await assertSucceeds(setDoc(doc(op, 'productSessions', 's-op'), { lastActivityAt: NOW, exitPath: '/x' }, { merge: true }))
  await assertSucceeds(setDoc(doc(op, 'productSessions', 's-op'), { endedAt: NOW, lastActivityAt: NOW }, { merge: true }))
  // Tasks: an operative creates a task as themself and completes an assigned one; an admin edits anything but the creator.
  await assertSucceeds(setDoc(doc(op, 'organizations', ORG, 'tasks', 't-op'), { id: 't-op', title: 'Mine', createdByUserId: OP, createdBy: 'Op', status: 'To Do' }))
  await assertSucceeds(updateDoc(doc(op, 'organizations', ORG, 'tasks', 't1'), {
    status: 'Completed', completedBy: 'Op', completedAt: NOW, completedItemIds: ['i1'], completionNotes: 'done', updatedAt: NOW,
  }))
  const admin = await db(ADMIN)
  await assertSucceeds(updateDoc(doc(admin, 'organizations', ORG, 'tasks', 't1'), { title: 'Renamed', assignedOperativeIds: [OP2], status: 'To Do' }))
  // Operative rows: own qualifications (iOS patchOperativeQualificationMaps / web saveOperativeQualifications); staff edits.
  await assertSucceeds(setDoc(doc(op, 'organizations', ORG, 'operatives', 'row-op'), {
    qualifications: [{ id: 'q1', name: 'CSCS' }], qualificationExpiryDates: { q1: NOW }, qualificationCertificateURLs: {}, updatedAt: NOW,
  }, { merge: true }))
  await assertSucceeds(updateDoc(doc(mgr, 'organizations', ORG, 'operatives', 'row-op2'), { name: 'Op Two Renamed' }))
  // An operative's own profile save copies their name, phone and trade onto their row (iPhone UserStore sync).
  await assertSucceeds(updateDoc(doc(op, 'organizations', ORG, 'operatives', 'row-op'), { firstName: 'Op', lastName: 'One', name: 'Op One', phone: '07700 900000', tradeTypePreset: 'Joiner', updatedAt: NOW }))
  await assertFails(updateDoc(doc(op, 'organizations', ORG, 'operatives', 'row-op2'), { name: 'Not mine' }))
  await assertSucceeds(updateDoc(doc(mgr, 'organizations', ORG, 'managers', 'row-mgr'), { name: 'Mgr Renamed' }))
  // Confirmation token: the web setup create shape.
  const fresh = env.authenticatedContext('pe-new', { email: 'pe-new@test.com', email_verified: false }).firestore()
  await assertSucceeds(setDoc(doc(fresh, 'accountConfirmations', 'tok-ok'), {
    userId: 'pe-new', email: 'pe-new@test.com', organizationId: 'pe-new-org', isUsed: false, createdAt: NOW,
  }))
  await assertSucceeds(updateDoc(doc(fresh, 'accountConfirmations', 'tok-ok'), { isUsed: true, usedAt: NOW }))
  // An existing member re-claims their own email in their company.
  await assertSucceeds(setDoc(doc(op, 'organizations', ORG, 'userEmails', `${OP}@test.com`), { userId: OP }))
})

// ── Report checks (1.64.0; the collection web #391 / rulebook 1.65.0 adds) ───────────────────

test('reportChecks: admins of the organisation read them (billing open); nobody writes; the catch-all read never re-opens them', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG, 'reportChecks', 'r1'), { reportId: 'r1', ok: false, checkedAt: NOW })
  })
  const admin = await db(ADMIN)
  const founder = await db(FOUNDER)
  const mgr = await db(MGR)
  const op = await db(OP)
  await assertSucceeds(getDoc(doc(admin, 'organizations', ORG, 'reportChecks', 'r1')))
  await assertSucceeds(getDocs(collection(founder, 'organizations', ORG, 'reportChecks')))
  await assertFails(getDoc(doc(mgr, 'organizations', ORG, 'reportChecks', 'r1')))
  await assertFails(getDoc(doc(op, 'organizations', ORG, 'reportChecks', 'r1')))
  await assertFails(getDocs(collection(op, 'organizations', ORG, 'reportChecks')))
  for (const who of [admin, founder, mgr, op]) {
    await assertFails(setDoc(doc(who, 'organizations', ORG, 'reportChecks', 'r2'), { reportId: 'r2', ok: true, checkedAt: NOW }))
    await assertFails(updateDoc(doc(who, 'organizations', ORG, 'reportChecks', 'r1'), { ok: true }))
    await assertFails(deleteDoc(doc(who, 'organizations', ORG, 'reportChecks', 'r1')))
  }
  // A lapsed subscription closes it to admins too (orgBillingOpen).
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'organizations', ORG), { billing: { accessOpen: false } })
  })
  await assertFails(getDoc(doc(admin, 'organizations', ORG, 'reportChecks', 'r1')))
})

// ── Review of #392 (18 Nov) ─────────────────────────────────────────────────────────────────

test('review #392 blocker: a deactivated person never writes their active flag or "no line manager" to another falsy value', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', OP), { isActive: false, hasNoLineManager: false })
  })
  const op = await db(OP)
  const me = doc(op, 'users', OP)
  // The auth claims treat only exactly `false` as inactive, so any other value would reactivate the account.
  await assertFails(updateDoc(me, { isActive: null }))
  await assertFails(updateDoc(me, { isActive: 0 }))
  await assertFails(updateDoc(me, { isActive: deleteField() }))
  await assertFails(updateDoc(me, { isActive: true }))
  await assertFails(updateDoc(me, { hasNoLineManager: null }))
  await assertFails(updateDoc(me, { hasNoLineManager: 0 }))
  // Resending the stored values, and an ordinary profile change, still save.
  await assertSucceeds(updateDoc(me, { isActive: false, hasNoLineManager: false, firstName: 'Still me' }))
})

test('review #392 nit 6: a person never adds an employment type, not even null', async () => {
  await seed()
  const me = doc(await db(OP), 'users', OP)
  await assertFails(updateDoc(me, { employmentType: null }))
  await assertFails(updateDoc(me, { employmentType: 'self_employed' }))
})

test('review #392 should-fix 2: an operative completes a task stored before 1.8.0 with the app\'s tidied write', async () => {
  await seed()
  // Real legacy shapes: lower-case priority, no details, untrimmed title, items without ids, no id field.
  const stored = {
    title: ' Fix the boiler ', priority: 'high', status: 'to do', projectId: 'job-1', createdByUserId: ADMIN, createdBy: 'Admin',
    organizationId: ORG, assignedOperativeIds: [OP], items: [{ title: 'Isolate' }, { title: 'Replace valve', description: 'Left side' }],
  }
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG, 'tasks', 'legacy'), stored)
  })
  const parsed = parseTaskDocument('legacy', stored) as Record<string, any>
  const next = taskFields({
    ...(parsed as any), id: 'legacy', status: 'Completed', completedBy: 'Op', completedAt: NOW,
    completedItemIds: (parsed.items || []).map((item: { id: string }) => item.id),
  } as never)
  const write = taskWriteFields(stored, next)
  const payload: Record<string, unknown> = { ...write.set }
  for (const key of write.remove) payload[key] = deleteField()
  for (const key of ['priority', 'items']) {
    if (!(key in payload)) throw new Error(`the tidied write should carry ${key}`)
  }
  const op = await db(OP)
  const ref = doc(op, 'organizations', ORG, 'tasks', 'legacy')
  // Beyond the tidy form, an operative still changes only the completion keys.
  await assertFails(updateDoc(ref, { ...payload, priority: 'Urgent' }))
  await assertFails(updateDoc(ref, { ...payload, title: 'Something else' }))
  await assertFails(updateDoc(ref, { ...payload, details: 'Rewritten' }))
  await assertFails(updateDoc(ref, { ...payload, items: [...(payload.items as unknown[]), { id: 'x', title: 'Extra', description: '' }] }))
  await assertFails(updateDoc(ref, { ...payload, id: 'other' }))
  await assertSucceeds(updateDoc(ref, payload))
})

test('review #392 re-review 3: own leave with the iPhone\'s upper-cased operativeId still saves (operativeId not checked)', async () => {
  await seed()
  const op = await db(OP)
  const leave = { userId: OP, status: 'pending', startDate: '2026-12-01', endDate: '2026-12-01', timeSlot: 'FULL DAY' }
  // iOS HolidayView sends the operatives row id upper-cased; a lower-case or non-UUID row id must not refuse the save.
  await assertSucceeds(setDoc(doc(op, 'organizations', ORG, 'holidayBookings', 'h-n7a'), { ...leave, operativeId: 'ROW-OP' }))
  await assertSucceeds(setDoc(doc(op, 'organizations', ORG, 'holidayBookings', 'h-n7b'), { ...leave, operativeId: 'row-op' }))
  await assertSucceeds(setDoc(doc(op, 'organizations', ORG, 'holidayBookings', 'h-n7c'), { ...leave, operativeId: OP }))
  // Someone else's userId is still never the caller's own leave.
  await assertFails(setDoc(doc(op, 'organizations', ORG, 'holidayBookings', 'h-n7d'), { ...leave, userId: OP2, operativeId: OP }))
})

test('review #392 nit 8: an Operatives manager removes an operative\'s legacy UTR / VAT, never sets them', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', OP), { utrNumber: '1234567890', vatNumber: 'GB123' })
  })
  const mgr = await db(MGR)
  await assertFails(updateDoc(doc(mgr, 'users', OP), { utrNumber: '999' }))
  await assertFails(updateDoc(doc(mgr, 'users', OP2), { vatNumber: 'GB999' }))
  await assertSucceeds(updateDoc(doc(mgr, 'users', OP), { utrNumber: deleteField(), vatNumber: deleteField() }))
})

test('review #392 re-review blocker: a deactivated admin never writes their own active flag or "no line manager"', async () => {
  await seed()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'users', ADMIN), { isActive: false, hasNoLineManager: false })
  })
  const me = doc(await db(ADMIN), 'users', ADMIN)
  await assertFails(updateDoc(me, { isActive: true }))
  await assertFails(updateDoc(me, { isActive: null }))
  await assertFails(updateDoc(me, { isActive: deleteField() }))
  await assertFails(updateDoc(me, { hasNoLineManager: true }))
  await assertFails(updateDoc(me, { hasNoLineManager: null }))
  await assertSucceeds(updateDoc(me, { isActive: false, firstName: 'Admin still' }))
  // The Super Admin's own profile saves (self-repair of their flags) are unchanged.
  const founder = doc(await db(FOUNDER), 'users', FOUNDER)
  await assertSucceeds(updateDoc(founder, { firstName: 'Founder', adminAccess: true, role: 'admin' }))
  await assertFails(updateDoc(founder, { isActive: false }))
})

test('review #392 re-review 2: tidy items only on a task whose stored items have no ids; never on a modern task', async () => {
  await seed()
  const modern = {
    id: 'modern', title: 'Modern', details: '', priority: 'Normal', status: 'To Do', projectId: 'job-1', createdByUserId: ADMIN,
    createdBy: 'Admin', organizationId: ORG, assignedOperativeIds: [OP],
    items: [{ id: 'i1', title: 'One', description: '' }, { id: 'i2', title: 'Two', description: '' }],
  }
  const legacy = {
    title: 'Legacy', priority: 'Normal', status: 'To Do', projectId: 'job-1', createdByUserId: ADMIN, createdBy: 'Admin',
    organizationId: ORG, assignedOperativeIds: [OP], items: [{ title: 'One' }, { title: 'Two' }],
  }
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore()
    await setDoc(doc(fs, 'organizations', ORG, 'tasks', 'modern'), modern)
    await setDoc(doc(fs, 'organizations', ORG, 'tasks', 'legacy2'), legacy)
  })
  const complete = (id: string, stored: Record<string, unknown>) => {
    const parsed = parseTaskDocument(id, stored) as Record<string, any>
    const next = taskFields({
      ...(parsed as any), id, status: 'Completed', completedBy: 'Op', completedAt: NOW,
      completedItemIds: (parsed.items || []).map((item: { id: string }) => item.id),
    } as never)
    const write = taskWriteFields(stored, next)
    const payload: Record<string, unknown> = { ...write.set }
    for (const key of write.remove) payload[key] = deleteField()
    return payload
  }
  const modernPayload0 = complete('modern', modern)
  const legacyPayload0 = complete('legacy2', legacy)
  const op = await db(OP)
  const modernRef = doc(op, 'organizations', ORG, 'tasks', 'modern')
  const modernPayload = modernPayload0
  await assertFails(updateDoc(modernRef, { ...modernPayload, items: [{ id: 'i1', title: 'Rewritten', description: '' }, modern.items[1]] }))
  await assertFails(updateDoc(modernRef, { ...modernPayload, items: [modern.items[0]] }))
  await assertSucceeds(updateDoc(modernRef, modernPayload))
  const legacyRef = doc(op, 'organizations', ORG, 'tasks', 'legacy2')
  const legacyPayload = legacyPayload0
  await assertFails(updateDoc(legacyRef, { ...legacyPayload, items: (legacyPayload.items as unknown[]).slice(0, 1) }))
  await assertSucceeds(updateDoc(legacyRef, legacyPayload))
})
