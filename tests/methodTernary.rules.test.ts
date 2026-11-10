/**
 * Rulebook 1.33.1: writes carrying server timestamps answer on every allow that serves more than one method.
 *
 * 1.32.2 / 1.32.3 merged several `allow create, update[, delete]` blocks into one allow with a `request.method`
 * ternary. On the notifications block (`allow create, update: if canAccessOrganization(...) && ((request.method ==
 * 'create') ? … : …)`) a create whose `createdAt` is a server timestamp — the shape both apps write
 * (`notificationCreateFields`, rulebook 1.16.0) — crashed the rules engine (`IllegalStateException: ternary operator
 * predicate is always boolean`). The client got UNKNOWN, then ABORTED for ever, and on iOS every later write from that
 * phone queued behind it. 1.33.1 splits that allow; docs/firestore-rules-notes.md "1.33.1 notifications crash".
 *
 * Every write here races a timeout: a write the engine crashes on never settles, so it fails as `hang` instead of
 * hanging the suite. Set FIRESTORE_EMULATOR_LOG to the emulator's log file to also assert that it has no
 * `IllegalStateException` after the suite.
 *
 *   npm run test:rules
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { claimsContext } from './authClaimsContext.ts'
import { isExpressionLimitDenial } from './rulesAssert.ts'
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { notificationCreateFields } from '../lib/canonical/recordsDocuments.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'MT-ORG-1'
const OTHER_ORG = 'MT-ORG-2'
const SA = 'mt-super-admin'
const ADMIN = 'mt-admin'
const MGR = 'mt-manager'
const OP = 'mt-operative'
const OUT = 'mt-outsider'
const JOB = 'MT-JOB-1'
const WAIT_MS = 8000

const EMAILS: Record<string, string> = {
  [SA]: 'mt-sa@test.com',
  [ADMIN]: 'mt-admin@test.com',
  [MGR]: 'mt-mgr@test.com',
  [OP]: 'mt-op@test.com',
  [OUT]: 'mt-out@test.com',
}

let env: RulesTestEnvironment

type Outcome = 'allowed' | 'denied' | 'budget' | 'hang' | `error:${string}`

/** Settles a write within WAIT_MS: allowed, denied (logic), budget (1,000-expression limit), hang (crash) or another error. */
async function outcome(write: Promise<unknown>): Promise<Outcome> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<Outcome>((resolve) => {
    timer = setTimeout(() => resolve('hang'), WAIT_MS)
  })
  const settled = write.then(
    () => 'allowed' as Outcome,
    (error: { code?: string }) => {
      if (isExpressionLimitDenial(error)) return 'budget' as Outcome
      return error?.code === 'permission-denied' ? ('denied' as Outcome) : (`error:${String(error?.code)}` as Outcome)
    }
  )
  try {
    return await Promise.race([settled, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** A fresh client per call: a write the engine crashes on blocks its client's write stream, so later writes would hang too. */
async function dbAs(uid: string) {
  return (await claimsContext(env, uid, { email: EMAILS[uid], email_verified: true })).firestore()
}

/** Non-strict runs accept a denial by the 1,000-expression limit where a refusal is expected (as `tests/rulesAssert.ts`). */
function assertRefused(actual: Outcome, message?: string) {
  if (process.env.RULES_STRICT_BUDGET !== '1' && actual === 'budget') return
  assert.equal(actual, 'denied', message)
}

function orgDoc(db: Awaited<ReturnType<typeof dbAs>>, collection: string, id: string, org = ORG) {
  return doc(db, 'organizations', org, collection, id)
}

/** Write metadata as both apps add it (`writeMetadataFields` + the SDK server timestamp). */
function meta(uid: string, platform: 'web' | 'ios') {
  return { updatedAt: serverTimestamp(), updatedBy: uid, updatedFrom: platform }
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: `demo-method-ternary-${Date.now()}`,
    firestore: {
      rules,
      host: '127.0.0.1',
      port: Number(process.env.RULES_PORT ?? 8080),
    },
  })
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'organizations', ORG), {
      name: 'Method ternary',
      creatorUserId: SA,
      members: { [SA]: 'admin', [ADMIN]: 'admin', [MGR]: 'manager', [OP]: 'operative' },
      billing: { status: 'active', accessOpen: true },
    })
    await setDoc(doc(db, 'organizations', OTHER_ORG), {
      name: 'Other',
      creatorUserId: OUT,
      members: { [OUT]: 'admin' },
      billing: { status: 'active', accessOpen: true },
    })
    const base = { isActive: true, passwordSet: true }
    await setDoc(doc(db, 'users', SA), { ...base, organizationId: ORG, email: EMAILS[SA], role: 'admin', isSuperAdmin: true, adminAccess: true })
    await setDoc(doc(db, 'users', ADMIN), { ...base, organizationId: ORG, email: EMAILS[ADMIN], role: 'admin', adminAccess: true, assignedManagerUserIds: [SA] })
    await setDoc(doc(db, 'users', MGR), {
      ...base, organizationId: ORG, email: EMAILS[MGR], role: 'manager', manager: true, assignedManagerUserIds: [ADMIN],
      permissions: { projects: true, smallWorks: true },
    })
    await setDoc(doc(db, 'users', OP), {
      ...base, organizationId: ORG, email: EMAILS[OP], role: 'operative', operativeMode: true, assignedManagerUserIds: [MGR],
    })
    await setDoc(doc(db, 'users', OUT), { ...base, organizationId: OTHER_ORG, email: EMAILS[OUT], role: 'admin', adminAccess: true, isSuperAdmin: true })
    await setDoc(doc(db, 'organizations', ORG, 'projects', JOB), { jobNumber: 'J-1', managerIds: [MGR], managerUserIds: [MGR] })
    await setDoc(doc(db, 'organizations', ORG, 'notifications', 'mt-note-op'), { userId: OP, type: 'task_created', isRead: false, createdAt: Timestamp.now() })
    await setDoc(doc(db, 'organizations', ORG, 'bookings', 'mt-book-existing'), {
      operativeId: OP, projectId: JOB, jobCollection: 'projects', date: Timestamp.now(), timeSlot: 'FULL DAY', status: 'Confirmed',
    })
    await setDoc(doc(db, 'organizations', ORG, 'managerSiteBookings', 'mt-msb-existing'), {
      userId: MGR, locationType: 'project', locationId: JOB, jobCollection: 'projects', date: Timestamp.now(), timeSlot: 'FULL DAY',
    })
    await setDoc(doc(db, 'organizations', ORG, 'subcontractorBookings', 'mt-sub-existing'), {
      id: 'mt-sub-existing', subcontractorId: 'SUB-1', projectID: JOB, jobCollection: 'projects', date: Timestamp.now(), status: 'Confirmed',
    })
    await setDoc(doc(db, 'invitations', 'mt-invite-existing'), { organizationId: ORG, email: 'mt-new@test.com', isUsed: false, role: 'operative' })
  })
})

test.after(async () => {
  await env.cleanup()
})

type Db = Awaited<ReturnType<typeof dbAs>>

/** Runs one write as `uid` on a fresh client and settles it (see `outcome`). */
async function as(uid: string, write: (db: Db) => Promise<unknown>): Promise<Outcome> {
  return outcome(write(await dbAs(uid)))
}
async function allowed(uid: string, write: (db: Db) => Promise<unknown>, message?: string) {
  assert.equal(await as(uid, write), 'allowed', message)
}
async function refused(uid: string, write: (db: Db) => Promise<unknown>, message?: string) {
  assertRefused(await as(uid, write), message)
}

// MARK: - notifications (the 1.33.1 crash)

/**
 * A due-now inbox row exactly as both apps build it: rulebook `notificationCreateFields` with the SDK server timestamp
 * (1.16.0). iOS passes `FieldValue.serverTimestamp()` through the same packed function (`Rulebook+CreateDocuments.swift`).
 */
function notificationRow(userId: string, actorUserId: string | null, extra: Record<string, unknown> = {}) {
  const fields = notificationCreateFields({
    organizationId: ORG,
    type: 'booking_created',
    title: 'New booking',
    message: 'You have been booked onto J-1',
    userId,
    relatedId: JOB,
    actorUserId,
    createdAt: Date.now(),
    serverTimestamp: serverTimestamp(),
  })
  assert.ok(fields)
  return { ...fields.set, ...extra }
}

test('1.33.1: a notification with a server-timestamp createdAt answers (allowed member to member)', async () => {
  await allowed(SA, (db) => setDoc(orgDoc(db, 'notifications', 'mt-n1'), notificationRow(OP, SA)))
  await allowed(MGR, (db) => setDoc(orgDoc(db, 'notifications', 'mt-n2'), notificationRow(SA, MGR, { type: 'client_created' })))
  await allowed(OP, (db) => setDoc(orgDoc(db, 'notifications', 'mt-n3'), notificationRow(MGR, OP, { type: 'holiday_request_submitted' })))
  // Scheduled rows have no actor (rulebook §13); push_test is addressed to its sender.
  await allowed(OP, (db) => setDoc(orgDoc(db, 'notifications', 'mt-n4'), notificationRow(OP, null, { type: 'push_test' })))
  // Web writes one row per admin in one batch.
  await allowed(SA, (db) => {
    const batch = writeBatch(db)
    batch.set(orgDoc(db, 'notifications', 'mt-n5'), notificationRow(ADMIN, SA, { type: 'client_created' }))
    batch.set(orgDoc(db, 'notifications', 'mt-n6'), notificationRow(MGR, SA, { type: 'client_created' }))
    return batch.commit()
  })
})

test('1.33.1: a notification with a server-timestamp createdAt answers (refused otherwise)', async () => {
  await refused(OP, (db) => setDoc(orgDoc(db, 'notifications', 'mt-r1'), notificationRow(OUT, OP)), 'recipient not a member')
  await refused(OP, (db) => setDoc(orgDoc(db, 'notifications', 'mt-r2'), notificationRow(MGR, SA)), 'actor is not the caller')
  const { userId: _drop, ...noUser } = notificationRow(MGR, OP)
  await refused(OP, (db) => setDoc(orgDoc(db, 'notifications', 'mt-r3'), noUser), 'no userId')
  await refused(OUT, (db) => setDoc(orgDoc(db, 'notifications', 'mt-r4'), notificationRow(OP, OUT)), 'outsider')
})

test('1.33.1: marking a notification read with a server-timestamp updatedAt answers', async () => {
  await allowed(OP, (db) => updateDoc(orgDoc(db, 'notifications', 'mt-note-op'), { isRead: true, ...meta(OP, 'ios') }))
  // A merge-set or full set of an existing row is an update for the rules; with a server timestamp both hung on 1.33.0.
  await allowed(OP, (db) => setDoc(orgDoc(db, 'notifications', 'mt-note-op'), { isRead: true, ...meta(OP, 'ios') }, { merge: true }))
  await allowed(OP, (db) =>
    setDoc(orgDoc(db, 'notifications', 'mt-note-op'), { userId: OP, type: 'task_created', isRead: true, createdAt: Timestamp.now(), ...meta(OP, 'web') })
  )
  await refused(MGR, (db) => updateDoc(orgDoc(db, 'notifications', 'mt-note-op'), { isRead: false, ...meta(MGR, 'web') }))
  await allowed(ADMIN, (db) => updateDoc(orgDoc(db, 'notifications', 'mt-note-op'), { isRead: false, ...meta(ADMIN, 'web') }))
  await refused(OP, (db) => updateDoc(orgDoc(db, 'notifications', 'mt-note-op'), { actorUserId: SA, updatedAt: serverTimestamp() }), 'never another actor')
  await refused(OP, (db) => deleteDoc(orgDoc(db, 'notifications', 'mt-note-op')))
})

// MARK: - the other allows that serve more than one method

test('1.33.1: holiday bookings with server timestamps answer (create, update, delete)', async () => {
  const day = Timestamp.fromDate(new Date('2026-11-30T00:00:00Z'))
  const request = {
    userId: OP, operativeId: OP, startDate: day, endDate: day, timeSlot: 'FULL DAY', status: 'pending', createdAt: serverTimestamp(), ...meta(OP, 'ios'),
  }
  await allowed(OP, (db) => setDoc(orgDoc(db, 'holidayBookings', 'mt-h1'), request))
  await allowed(OP, (db) => updateDoc(orgDoc(db, 'holidayBookings', 'mt-h1'), { timeSlot: 'AM', ...meta(OP, 'ios') }))
  await allowed(MGR, (db) =>
    updateDoc(orgDoc(db, 'holidayBookings', 'mt-h1'), { status: 'approved', approvedByUserId: MGR, approvedAt: serverTimestamp(), ...meta(MGR, 'web') })
  )
  await allowed(SA, (db) =>
    setDoc(orgDoc(db, 'holidayBookings', 'mt-h2'), { ...request, userId: SA, operativeId: SA, status: 'approved', approvedAt: serverTimestamp(), ...meta(SA, 'web') })
  )
  await refused(OP, (db) => setDoc(orgDoc(db, 'holidayBookings', 'mt-h3'), { ...request, status: 'approved' }))
  await refused(OP, (db) => deleteDoc(orgDoc(db, 'holidayBookings', 'mt-h2')))
  await allowed(SA, (db) => deleteDoc(orgDoc(db, 'holidayBookings', 'mt-h2')))
})

test('1.33.1: settings documents with server timestamps answer (timesheet, deadlines, job types)', async () => {
  const sheet = `timesheet_${OP}_1764547200`
  await allowed(OP, (db) => setDoc(orgDoc(db, 'settings', sheet), { userId: OP, periodStart: '2026-11-01', managerNote: 'hi', createdAt: serverTimestamp(), ...meta(OP, 'ios') }))
  await allowed(OP, (db) => updateDoc(orgDoc(db, 'settings', sheet), { managerNote: 'edited', ...meta(OP, 'ios') }))
  await refused(OP, (db) => updateDoc(orgDoc(db, 'settings', sheet), { managerSignedAt: serverTimestamp(), managerSignedByUserId: OP, ...meta(OP, 'ios') }))
  await allowed(MGR, (db) =>
    updateDoc(orgDoc(db, 'settings', sheet), { managerSignedAt: serverTimestamp(), managerSignedByUserId: MGR, managerSignedByName: 'M', ...meta(MGR, 'web') })
  )
  await allowed(MGR, (db) => setDoc(orgDoc(db, 'settings', 'jobTypes'), { jobTypes: ['CAT A', 'CAT B'], ...meta(MGR, 'web') }))
  await allowed(OP, (db) => setDoc(orgDoc(db, 'settings', `deadlines_${JOB}`), { items: [], ...meta(OP, 'ios') }, { merge: true }))
  await refused(OP, (db) => deleteDoc(orgDoc(db, 'settings', sheet)))
})

test('1.33.1: overtime requests with server timestamps answer (create, withdraw)', async () => {
  const line = { bookingId: 'mt-book-existing', collection: 'bookings', action: 'keep', fingerprint: 'fp', hoursBefore: 1, hoursAfter: 1 }
  const create = { userId: OP, rangeStart: '2026-11-01', rangeEnd: '2026-11-30', status: 'pending', lines: [line], createdAt: serverTimestamp(), ...meta(OP, 'ios') }
  await allowed(OP, (db) => setDoc(orgDoc(db, 'overtimeRequests', 'mt-or1'), create))
  await refused(OP, (db) => setDoc(orgDoc(db, 'overtimeRequests', 'mt-or2'), { ...create, status: 'approved' }))
  await allowed(OP, (db) => updateDoc(orgDoc(db, 'overtimeRequests', 'mt-or1'), { status: 'withdrawn', withdrawnAt: serverTimestamp(), ...meta(OP, 'ios') }))
})

test('1.33.1: overtime reviews with a server-timestamp reviewedAt answer', async () => {
  const review = {
    userId: OP, bookingId: 'mt-book-existing', collection: 'bookings', decision: 'approved', fingerprint: 'fp', reviewedBy: MGR,
    requestId: 'mt-or1', reviewedAt: serverTimestamp(), ...meta(MGR, 'web'),
  }
  await allowed(MGR, (db) => setDoc(orgDoc(db, 'overtimeReviews', `${OP}_mt-book-existing`), review))
  await allowed(MGR, (db) => updateDoc(orgDoc(db, 'overtimeReviews', `${OP}_mt-book-existing`), { decision: 'changed', reviewedAt: serverTimestamp() }))
  await refused(OP, (db) => setDoc(orgDoc(db, 'overtimeReviews', `${OP}_mt-x`), { ...review, bookingId: 'mt-x', reviewedBy: OP }))
})

test('1.33.1: labour, manager site and subcontractor bookings with server timestamps answer', async () => {
  const day = Timestamp.fromDate(new Date('2026-11-30T00:00:00Z'))
  const labour = {
    operativeId: OP, projectId: JOB, jobCollection: 'projects', date: day, timeSlot: 'FULL DAY', status: 'Confirmed',
    bookedBy: 'M', createdAt: serverTimestamp(), ...meta(MGR, 'ios'),
  }
  await allowed(MGR, (db) => setDoc(orgDoc(db, 'bookings', 'mt-b1'), labour))
  await allowed(MGR, (db) => updateDoc(orgDoc(db, 'bookings', 'mt-b1'), { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00', ...meta(MGR, 'ios') }))
  await refused(OP, (db) => setDoc(orgDoc(db, 'bookings', 'mt-b2'), { ...labour, ...meta(OP, 'ios') }))
  // Delete with its tombstone in one batch (rulebook §2).
  await allowed(MGR, (db) => {
    const batch = writeBatch(db)
    batch.delete(orgDoc(db, 'bookings', 'mt-b1'))
    batch.set(orgDoc(db, 'deletedBookings', 'mt-b1'), { bookingId: 'mt-b1', collection: 'bookings', deletedAt: serverTimestamp(), deletedBy: MGR, deletedFrom: 'ios' })
    return batch.commit()
  })
  const site = { userId: MGR, locationType: 'project', locationId: JOB, jobCollection: 'projects', date: day, timeSlot: 'FULL DAY', createdAt: serverTimestamp(), ...meta(MGR, 'web') }
  await allowed(MGR, (db) => setDoc(orgDoc(db, 'managerSiteBookings', 'mt-m1'), site))
  await allowed(MGR, (db) => updateDoc(orgDoc(db, 'managerSiteBookings', 'mt-msb-existing'), { timeSlot: 'CUSTOM_HOURS', ...meta(MGR, 'web') }))
  const sub = {
    id: 'mt-s1', subcontractorId: 'SUB-1', projectID: JOB, jobCollection: 'projects', date: day, status: 'Confirmed', isBreakRemoved: false,
    bookedContactIds: [], bookedOperativeNames: [], createdAt: serverTimestamp(), ...meta(MGR, 'web'),
  }
  await allowed(MGR, (db) => setDoc(orgDoc(db, 'subcontractorBookings', 'mt-s1'), sub))
  await allowed(MGR, (db) => updateDoc(orgDoc(db, 'subcontractorBookings', 'mt-sub-existing'), { status: 'Tentative', ...meta(MGR, 'web') }))
})

test('1.33.1: invitations with server timestamps answer (create, mark used, delete)', async () => {
  const invitation = {
    organizationId: ORG, email: 'mt-invitee@test.com', role: 'operative', isUsed: false, invitedBy: ADMIN, operativeMode: true,
    permissions: { materials: false, siteAudit: false }, createdAt: serverTimestamp(),
  }
  await allowed(ADMIN, (db) => setDoc(doc(db, 'invitations', 'mt-i1'), invitation))
  await refused(ADMIN, (db) => setDoc(doc(db, 'invitations', 'mt-i3'), { ...invitation, email: 'mt-i3@test.com', adminAccess: 1.0 }), 'privilege values stay typed')
  await allowed(ADMIN, (db) => updateDoc(doc(db, 'invitations', 'mt-i1'), { isUsed: true, usedAt: serverTimestamp() }))
  await allowed(ADMIN, (db) => deleteDoc(doc(db, 'invitations', 'mt-invite-existing')))
  await refused(OP, (db) => setDoc(doc(db, 'invitations', 'mt-i2'), { ...invitation, email: 'mt-i2@test.com', invitedBy: OP }))
})

// MARK: - every organisation collection: a server-timestamp write always answers

const SWEEP_COLLECTIONS = [
  'clients', 'operatives', 'managers', 'subcontractors', 'projects', 'smallWorks', 'tasks', 'qualifications', 'skills', 'settings',
  'materials', 'materialCatalogue', 'materialSendRecords', 'wholesalers', 'siteAudits', 'variations', 'variationTrackers',
  'bookings', 'managerSiteBookings', 'subcontractorBookings', 'deletedBookings', 'holidayBookings', 'notifications',
  'overtimeRequests', 'overtimeReviews', 'overtimeReports', 'priceWorkItems', 'expenseItems', 'payeClaimReviews', 'payeClaimReports',
  'personalSiteAudits', 'payProfiles', 'operativeProfiles', 'operativeDayRateHistory', 'acceptedBookingClashes', 'warningResolutions',
  'dismissedWarnings', 'fileReports', 'worksListPicks', 'dashboardLayouts', 'userEmails', 'someOtherCollection',
]

test('1.33.1: a create and an update carrying server timestamps answer on every organisation collection', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    for (const name of SWEEP_COLLECTIONS) {
      await setDoc(doc(db, 'organizations', ORG, name, `sweep-seed-${name}`), { userId: OP, organizationId: ORG, title: 'seed' })
    }
  })
  const answers: string[] = []
  for (const uid of [SA, MGR, OP]) {
    for (const name of SWEEP_COLLECTIONS) {
      const data = { userId: uid, organizationId: ORG, title: 'sweep', createdAt: serverTimestamp(), ...meta(uid, 'web') }
      const created = await as(uid, (db) => setDoc(orgDoc(db, name, `sweep-${name}-${uid}`), data))
      const updated = await as(uid, (db) => updateDoc(orgDoc(db, name, `sweep-seed-${name}`), { title: `by ${uid}`, ...meta(uid, 'ios') }))
      for (const [kind, result] of [['create', created], ['update', updated]] as const) {
        if (result === 'hang' || result.startsWith('error:')) answers.push(`${name} ${kind} as ${uid}: ${result}`)
      }
    }
  }
  // Top-level people documents (Manage Users, My Profile, Change user type).
  const people: [string, string, (db: Db) => Promise<unknown>][] = [
    ['users self update', OP, (db) => updateDoc(doc(db, 'users', OP), { mobileNumber: '07000', ...meta(OP, 'ios') })],
    ['users admin update', SA, (db) => updateDoc(doc(db, 'users', OP), { firstName: 'Olly', ...meta(SA, 'web') })],
    ['users admin create', SA, (db) => setDoc(doc(db, 'users', 'mt-placeholder'), {
      organizationId: ORG, email: 'mt-placeholder@test.com', role: 'operative', operativeMode: true, passwordSet: false,
      isActive: true, createdAt: serverTimestamp(), ...meta(SA, 'web'),
    })],
    ['membership admin merge', SA, (db) => setDoc(doc(db, 'users', MGR, 'orgMemberships', ORG), {
      organizationId: ORG, role: 'manager', permissions: { manager: true }, updatedAt: serverTimestamp(),
    }, { merge: true })],
    ['membership self create', OP, (db) => setDoc(doc(db, 'users', OP, 'orgMemberships', ORG), {
      organizationId: ORG, status: 'active', acceptedAt: serverTimestamp(), ...meta(OP, 'web'),
    }, { merge: true })],
  ]
  for (const [label, uid, write] of people) {
    const result = await as(uid, write)
    if (result === 'hang' || result.startsWith('error:')) answers.push(`${label}: ${result}`)
  }
  assert.deepEqual(answers, [])
})

test('1.33.1: the emulator log has no IllegalStateException (set FIRESTORE_EMULATOR_LOG)', { skip: !process.env.FIRESTORE_EMULATOR_LOG }, () => {
  const log = readFileSync(String(process.env.FIRESTORE_EMULATOR_LOG), 'utf8')
  assert.equal((log.match(/IllegalStateException/g) ?? []).length, 0)
})
