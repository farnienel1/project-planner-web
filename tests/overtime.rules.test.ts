/**
 * Rulebook 1.29.0 (§16, §25): PAYE overtime security rules — the line manager's booking update, overtime requests,
 * reviews and saved reports. Runs against the Firestore emulator only (own project id, so it can run beside
 * tests/firestore.rules.test.ts).
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
import { assertFails, assertLogicalDeny } from './rulesAssert.ts'
import { claimsContext } from './authClaimsContext.ts'
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const rules = readFileSync(path.join(root, 'firestore.rules'), 'utf8')

const ORG = 'org-ot'
const ORG_B = 'org-ot-b'
const ADMIN = 'ot-admin'
const LM = 'ot-lm'
const SAM = 'ot-sam'
const PM = 'ot-pm'
const MGR2 = 'ot-mgr2'
const OP2 = 'ot-op2'
const ADMIN_B = 'ot-admin-b'

let env: RulesTestEnvironment

/** Rulebook 1.32.4: the caller's token carries the auth claims of the seeded data (`tests/authClaimsContext.ts`). */
async function db(uid: string) {
  return (await claimsContext(env, uid, { email: `${uid}@test.com` })).firestore()
}
async function orgDoc(uid: string, ...segments: string[]) {
  return doc(await db(uid), 'organizations', ORG, ...segments)
}

const LINE = { bookingId: 'B1', collection: 'bookings', dayKey: '2026-11-04', fingerprint: 'fp', action: 'keep', cancel: false }
function requestData(userId: string, extra: Record<string, unknown> = {}) {
  return { userId, rangeStart: '2026-11-01', rangeEnd: '2026-11-30', status: 'pending', lines: [LINE], ...extra }
}
function reviewData(userId: string, bookingId: string, reviewedBy: string, extra: Record<string, unknown> = {}) {
  return { userId, bookingId, collection: 'bookings', decision: 'approved', fingerprint: 'fp', reviewedBy, requestId: null, ...extra }
}
function reportData(userId: string, extra: Record<string, unknown> = {}) {
  return {
    userId,
    userName: 'Sam',
    companyName: 'Overtime Co',
    rangeStart: '2026-10-26',
    rangeEnd: '2026-11-25',
    kind: 'overtime',
    lines: [],
    totals: { overtimeHours: 0, clockHours: 0, lineCount: 0 },
    generatedBy: userId,
    ...extra,
  }
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG), {
      name: 'Overtime Co',
      creatorUserId: ADMIN,
      members: { [ADMIN]: 'admin', [LM]: 'manager', [SAM]: 'member', [PM]: 'manager', [MGR2]: 'manager', [OP2]: 'member' },
    })
    await setDoc(doc(d, 'organizations', ORG_B), { name: 'Other Co', creatorUserId: ADMIN_B, members: { [ADMIN_B]: 'admin' } })
    const user = (id: string, fields: Record<string, unknown>) => setDoc(doc(d, 'users', id), { email: `${id}@test.com`, organizationId: ORG, ...fields })
    await user(ADMIN, { role: 'admin', adminAccess: true, isSuperAdmin: true })
    await user(LM, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(SAM, { role: 'operative', operativeMode: true, employmentType: 'paye', assignedManagerUserIds: [LM] })
    await user(PM, { role: 'manager', manager: true, employmentType: 'paye', assignedManagerUserIds: [LM] })
    await user(MGR2, { role: 'manager', manager: true, assignedManagerUserIds: [ADMIN] })
    await user(OP2, { role: 'operative', operativeMode: true, assignedManagerUserIds: [MGR2] })
    await setDoc(doc(d, 'users', ADMIN_B), { email: `${ADMIN_B}@test.com`, organizationId: ORG_B, role: 'admin', adminAccess: true })
    await setDoc(doc(d, 'organizations', ORG, 'projects', 'job1'), { name: 'Riverside', managerUserIds: [PM] })
    await setDoc(doc(d, 'organizations', ORG, 'projects', 'job2'), { name: 'School', managerUserIds: [MGR2] })
    const booking = (id: string, operativeId: string, projectId: string, extra: Record<string, unknown> = {}) =>
      setDoc(doc(d, 'organizations', ORG, 'bookings', id), {
        id,
        operativeId,
        projectId,
        jobCollection: 'projects',
        date: 1762214400000,
        timeSlot: 'CUSTOM_HOURS',
        workStartTime: '06:30',
        workEndTime: '14:00',
        status: 'Confirmed',
        bookedBy: 'Ada',
        notes: '',
        ...extra,
      })
    await booking('B1', SAM, 'job1')
    await booking('B2', PM, 'job2')
    await booking('B3', PM, 'job1')
    await booking('B4', OP2, 'job2')
    // A catalogue row linked to Sam's account (the link is member-writable, so it grants no booking write).
    await setDoc(doc(d, 'organizations', ORG, 'operatives', 'row-sam'), { firstName: 'Sam', email: 'other@test.com', linkedUserId: SAM })
    await booking('BR1', 'row-sam', 'job1')
    await setDoc(doc(d, 'platformConfig', 'app'), { enforcedReads: true })
    await setDoc(doc(d, 'organizations', ORG, 'managerSiteBookings', 'M1'), {
      userId: PM,
      date: 1762214400000,
      timeSlot: 'CUSTOM_HOURS',
      workStartTime: '06:30',
      workEndTime: '17:00',
      locationType: 'office',
    })
  })
}

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-project-planner-overtime',
    firestore: { rules, host: '127.0.0.1', port: Number(process.env.RULES_PORT || 8080) },
  })
})

test.beforeEach(async () => {
  await env.clearFirestore()
  await seed()
})

test.after(async () => {
  await env?.cleanup()
})

// MARK: - Bookings: the line manager applies an approved request (overtime fields only)

test('line manager changes their report\'s booking times and overtime rate', async () => {
  await assertSucceeds(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { workStartTime: '07:30', workEndTime: '15:00', otMultiplierOverride: 2, timeSlot: 'CUSTOM_HOURS' }))
})

test('line manager cancels their report\'s booking and removes a custom rate', async () => {
  await assertSucceeds(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { status: 'Cancelled' }))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'organizations', ORG, 'bookings', 'B1'), { otMultiplierOverride: 2 })
  })
  await assertSucceeds(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { otMultiplierOverride: deleteField() }))
})

test('line manager may not change any other booking field or status', async () => {
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { notes: 'changed' }))
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { projectId: 'job2' }))
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { status: 'Tentative' }))
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { operativeId: LM }))
})

test('line manager may only set an overtime rate of 1–3 in 0.25 steps', async () => {
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { otMultiplierOverride: 3.5 }))
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { otMultiplierOverride: 1.1 }))
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { otMultiplierOverride: 0.75 }))
  await assertSucceeds(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { otMultiplierOverride: 1.25 }))
  await assertSucceeds(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { otMultiplierOverride: 3 }))
})

test('a manager who is not the line manager or the job manager cannot change the booking', async () => {
  await assertFails(updateDoc(await orgDoc(MGR2, 'bookings', 'B1'), { workStartTime: '07:30' }))
})

test('an operative never writes a booking, not even their own', async () => {
  await assertFails(updateDoc(await orgDoc(SAM, 'bookings', 'B1'), { workStartTime: '07:30' }))
  await assertFails(updateDoc(await orgDoc(SAM, 'bookings', 'B1'), { status: 'Cancelled' }))
})

test('admins keep writing every booking field', async () => {
  await assertSucceeds(updateDoc(await orgDoc(ADMIN, 'bookings', 'B1'), { notes: 'admin note', otMultiplierOverride: 2 }))
})

test('a PAYE manager changes their own booking only where they manage the job; their line manager may change it', async () => {
  await assertFails(updateDoc(await orgDoc(PM, 'bookings', 'B2'), { workStartTime: '07:30' }))
  await assertSucceeds(updateDoc(await orgDoc(PM, 'bookings', 'B3'), { workStartTime: '07:30' }))
  await assertSucceeds(updateDoc(await orgDoc(LM, 'bookings', 'B2'), { workStartTime: '07:30' }))
})

test('the line manager rule also covers manager site bookings', async () => {
  await assertSucceeds(updateDoc(await orgDoc(LM, 'managerSiteBookings', 'M1'), { workEndTime: '16:00' }))
  await assertFails(updateDoc(await orgDoc(LM, 'managerSiteBookings', 'M1'), { locationType: 'project' }))
  await assertFails(updateDoc(await orgDoc(MGR2, 'managerSiteBookings', 'M1'), { workEndTime: '16:00' }))
})

test('an admin of another company is no line manager here', async () => {
  await assertFails(updateDoc(doc(await db(ADMIN_B), 'organizations', ORG, 'bookings', 'B1'), { workStartTime: '07:30' }))
})

test('a booking under an operatives row on ANOTHER email is never written through the line-manager path (admins and job managers only)', async () => {
  // row-sam's email is other@test.com, which names no account: 1.33.0's row path (the row's email → userEmails → the
  // users document's line managers) does not match, so only the job's manager and admins write it.
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'BR1'), { workStartTime: '07:30' }))
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'BR1'), { status: 'Cancelled' }))
  await assertSucceeds(updateDoc(await orgDoc(PM, 'bookings', 'BR1'), { workStartTime: '07:30' }))
  await assertSucceeds(updateDoc(await orgDoc(ADMIN, 'bookings', 'BR1'), { status: 'Cancelled' }))
})

test('relink attack: re-pointing an operatives row at a report never grants a booking write', async () => {
  // Another manager's operative, booked under a catalogue row on a job LM does not manage.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await setDoc(doc(d, 'organizations', ORG, 'operatives', 'row-x'), { firstName: 'Xavier', email: 'x@test.com' })
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'BX'), {
      id: 'BX', operativeId: 'row-x', projectId: 'job2', jobCollection: 'projects', date: 1762214400000,
      timeSlot: 'CUSTOM_HOURS', workStartTime: '06:30', workEndTime: '14:00', status: 'Confirmed', bookedBy: 'Ada', notes: '',
    })
  })
  // Rulebook 1.31.1 (S4): only an admin, or an operatives manager linking an operative they manage, changes a row's
  // account link. Before, any member could, so the booking rules below never trust the link either way.
  await assertLogicalDeny(updateDoc(await orgDoc(LM, 'operatives', 'row-x'), { linkedUserId: SAM }))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'organizations', ORG, 'operatives', 'row-x'), { linkedUserId: SAM })
  })
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'BX'), { status: 'Cancelled' }))
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'BX'), { workStartTime: '07:30' }))
  // Even an operative relinking the row gains nothing.
  await assertFails(updateDoc(await orgDoc(OP2, 'bookings', 'BX'), { status: 'Cancelled' }))
})

test('line manager booking writes: clock times are short text and the slot is a known one', async () => {
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { workStartTime: 730 }))
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { workEndTime: 'x'.repeat(40) }))
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { timeSlot: 'WHATEVER' }))
  await assertSucceeds(updateDoc(await orgDoc(LM, 'bookings', 'B1'), { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '15:00' }))
})

test('1.33.0 reads: with enforced reads every manager (a line manager who does not manage the job included) reads the booking', async () => {
  // 1.33.0 (owner decision 6 Nov): every manager reads every job and booking, so the 1.29.0 known limit is gone.
  await assertSucceeds(getDoc(await orgDoc(LM, 'bookings', 'B1')))
  await assertFails(getDoc(await orgDoc(OP2, 'bookings', 'B1')))
  await assertSucceeds(getDoc(await orgDoc(PM, 'bookings', 'B1')))
  await assertSucceeds(getDoc(await orgDoc(ADMIN, 'bookings', 'B1')))
})

// MARK: - overtimeRequests

test('the person sends their own pending request; never for someone else or already approved', async () => {
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  await assertFails(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R2'), requestData(PM)))
  await assertFails(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R3'), requestData(SAM, { status: 'approved' })))
  await assertFails(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R4'), requestData(SAM, { lines: [] })))
  await assertFails(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R5'), requestData(SAM, { decidedBy: SAM })))
  await assertFails(setDoc(doc(await db(ADMIN_B), 'organizations', ORG, 'overtimeRequests', 'R6'), requestData(ADMIN_B)))
})

test('requests are read by the person, their line managers and admins only', async () => {
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  await assertSucceeds(getDoc(await orgDoc(SAM, 'overtimeRequests', 'R1')))
  await assertSucceeds(getDoc(await orgDoc(LM, 'overtimeRequests', 'R1')))
  await assertSucceeds(getDoc(await orgDoc(ADMIN, 'overtimeRequests', 'R1')))
  await assertFails(getDoc(await orgDoc(MGR2, 'overtimeRequests', 'R1')))
  await assertFails(getDoc(await orgDoc(OP2, 'overtimeRequests', 'R1')))
  await assertFails(getDoc(doc(await db(ADMIN_B), 'organizations', ORG, 'overtimeRequests', 'R1')))
  await assertSucceeds(getDocs(query(collection(await db(SAM), 'organizations', ORG, 'overtimeRequests'), where('userId', '==', SAM))))
  await assertSucceeds(getDocs(query(collection(await db(LM), 'organizations', ORG, 'overtimeRequests'), where('userId', '==', SAM))))
  await assertSucceeds(getDocs(collection(await db(ADMIN), 'organizations', ORG, 'overtimeRequests')))
  await assertFails(getDocs(collection(await db(LM), 'organizations', ORG, 'overtimeRequests')))
})

test('the person withdraws their own pending request but never approves it', async () => {
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  await assertFails(updateDoc(await orgDoc(SAM, 'overtimeRequests', 'R1'), { status: 'approved', decidedBy: SAM }))
  await assertFails(updateDoc(await orgDoc(SAM, 'overtimeRequests', 'R1'), { lines: [] }))
  await assertSucceeds(updateDoc(await orgDoc(SAM, 'overtimeRequests', 'R1'), { status: 'withdrawn' }))
  // Withdrawn is final.
  await assertFails(updateDoc(await orgDoc(LM, 'overtimeRequests', 'R1'), { status: 'approved', decidedBy: LM }))
})

test('the line manager or an admin approves; another manager or a changed line cannot', async () => {
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  await assertFails(updateDoc(await orgDoc(MGR2, 'overtimeRequests', 'R1'), { status: 'approved', decidedBy: MGR2 }))
  await assertFails(updateDoc(await orgDoc(LM, 'overtimeRequests', 'R1'), { status: 'approved', decidedBy: ADMIN }))
  await assertFails(updateDoc(await orgDoc(LM, 'overtimeRequests', 'R1'), { status: 'approved', decidedBy: LM, lines: [] }))
  await assertFails(updateDoc(await orgDoc(LM, 'overtimeRequests', 'R1'), { status: 'withdrawn' }))
  await assertSucceeds(
    updateDoc(await orgDoc(LM, 'overtimeRequests', 'R1'), {
      status: 'approved',
      decidedBy: LM,
      decisions: { B1: { action: 'approve' } },
      appliedBookingIds: ['B1'],
      droppedBookingIds: [],
    })
  )
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R2'), requestData(SAM)))
  await assertSucceeds(updateDoc(await orgDoc(ADMIN, 'overtimeRequests', 'R2'), { status: 'approved', decidedBy: ADMIN }))
})

test('nobody approves their own request, admins included', async () => {
  await assertSucceeds(setDoc(await orgDoc(ADMIN, 'overtimeRequests', 'RA'), requestData(ADMIN)))
  await assertFails(updateDoc(await orgDoc(ADMIN, 'overtimeRequests', 'RA'), { status: 'approved', decidedBy: ADMIN }))
})

test('requests are never deleted by an app', async () => {
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  await assertFails(deleteDoc(await orgDoc(SAM, 'overtimeRequests', 'R1')))
  await assertFails(deleteDoc(await orgDoc(ADMIN, 'overtimeRequests', 'R1')))
})

// MARK: - overtimeReviews

test('line managers and admins write a report\'s reviews; the id is {userId}_{bookingId} and reviewedBy the writer', async () => {
  await assertSucceeds(setDoc(await orgDoc(LM, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', LM)))
  await assertSucceeds(setDoc(await orgDoc(ADMIN, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', ADMIN, { decision: 'trimmed' })))
  await assertFails(setDoc(await orgDoc(LM, 'overtimeReviews', 'wrong-id'), reviewData(SAM, 'B1', LM)))
  await assertFails(setDoc(await orgDoc(LM, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', ADMIN)))
  await assertFails(setDoc(await orgDoc(LM, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', LM, { decision: 'whatever' })))
  await assertFails(setDoc(await orgDoc(MGR2, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', MGR2)))
})

test('an operative never writes their own review; a PAYE manager only for bookings they may edit', async () => {
  await assertFails(setDoc(await orgDoc(SAM, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', SAM)))
  await assertSucceeds(setDoc(await orgDoc(PM, 'overtimeReviews', `${PM}_B3`), reviewData(PM, 'B3', PM)))
  await assertFails(setDoc(await orgDoc(PM, 'overtimeReviews', `${PM}_B2`), reviewData(PM, 'B2', PM)))
  await assertSucceeds(setDoc(await orgDoc(ADMIN, 'overtimeReviews', `${ADMIN}_B4`), reviewData(ADMIN, 'B4', ADMIN)))
})

test('reviews are read by the person, their line managers and admins only; deleted by admins only', async () => {
  await assertSucceeds(setDoc(await orgDoc(LM, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', LM)))
  await assertSucceeds(getDoc(await orgDoc(SAM, 'overtimeReviews', `${SAM}_B1`)))
  await assertSucceeds(getDoc(await orgDoc(LM, 'overtimeReviews', `${SAM}_B1`)))
  await assertFails(getDoc(await orgDoc(MGR2, 'overtimeReviews', `${SAM}_B1`)))
  await assertFails(getDoc(await orgDoc(OP2, 'overtimeReviews', `${SAM}_B1`)))
  await assertFails(deleteDoc(await orgDoc(LM, 'overtimeReviews', `${SAM}_B1`)))
  await assertSucceeds(deleteDoc(await orgDoc(ADMIN, 'overtimeReviews', `${SAM}_B1`)))
})

// MARK: - overtimeReports

test('the person saves their own report once; it is never changed or deleted', async () => {
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeReports', 'REP1'), reportData(SAM)))
  await assertFails(setDoc(await orgDoc(SAM, 'overtimeReports', 'REP2'), reportData(PM)))
  await assertFails(setDoc(await orgDoc(LM, 'overtimeReports', 'REP3'), reportData(SAM, { generatedBy: LM })))
  await assertFails(setDoc(await orgDoc(SAM, 'overtimeReports', 'REP4'), reportData(SAM, { kind: 'expenses' })))
  await assertFails(updateDoc(await orgDoc(SAM, 'overtimeReports', 'REP1'), { userName: 'Changed' }))
  await assertFails(deleteDoc(await orgDoc(SAM, 'overtimeReports', 'REP1')))
  await assertFails(deleteDoc(await orgDoc(ADMIN, 'overtimeReports', 'REP1')))
})

test('reports are read by the person, their line managers and admins only', async () => {
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeReports', 'REP1'), reportData(SAM)))
  await assertSucceeds(getDoc(await orgDoc(SAM, 'overtimeReports', 'REP1')))
  await assertSucceeds(getDoc(await orgDoc(LM, 'overtimeReports', 'REP1')))
  await assertSucceeds(getDoc(await orgDoc(ADMIN, 'overtimeReports', 'REP1')))
  await assertFails(getDoc(await orgDoc(MGR2, 'overtimeReports', 'REP1')))
  await assertFails(getDoc(await orgDoc(OP2, 'overtimeReports', 'REP1')))
  await assertSucceeds(getDocs(query(collection(await db(SAM), 'organizations', ORG, 'overtimeReports'), where('userId', '==', SAM))))
})

test('1.32.0 partial approval: the line manager records what they applied and the request stays pending for an admin', async () => {
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'RP'), requestData(SAM)))
  await assertSucceeds(
    updateDoc(await orgDoc(LM, 'overtimeRequests', 'RP'), {
      status: 'pending',
      decidedBy: LM,
      decisions: { B1: { action: 'approve' } },
      appliedBookingIds: ['B1'],
      droppedBookingIds: [],
    })
  )
  // Still only the decision fields, still never by the person or another manager.
  await assertFails(updateDoc(await orgDoc(LM, 'overtimeRequests', 'RP'), { status: 'pending', decidedBy: LM, lines: [] }))
  await assertFails(updateDoc(await orgDoc(SAM, 'overtimeRequests', 'RP'), { status: 'pending', decidedBy: SAM, appliedBookingIds: ['B1'] }))
  await assertFails(updateDoc(await orgDoc(MGR2, 'overtimeRequests', 'RP'), { status: 'pending', decidedBy: MGR2, appliedBookingIds: ['B1'] }))
  // The admin completes it.
  await assertSucceeds(updateDoc(await orgDoc(ADMIN, 'overtimeRequests', 'RP'), { status: 'approved', decidedBy: ADMIN, appliedBookingIds: ['B1', 'B2'] }))
  await assertFails(updateDoc(await orgDoc(ADMIN, 'overtimeRequests', 'RP'), { status: 'pending', decidedBy: ADMIN }), 'approved is final')
})

// MARK: - 1.33.0: Return (staleBookingIds / deletedBookingIds), new review decisions, every id, delete on Return

async function seed133() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    // Sam's own operatives row (same email as Sam's account) and the email claim that names Sam.
    await setDoc(doc(d, 'organizations', ORG, 'userEmails', `${SAM}@test.com`), { userId: SAM })
    await setDoc(doc(d, 'organizations', ORG, 'operatives', 'row-sam2'), { firstName: 'Sam', email: `${SAM.toUpperCase()}@TEST.COM` })
    await setDoc(doc(d, 'organizations', ORG, 'operatives', 'row-ghost'), { firstName: 'Ghost' })
    await setDoc(doc(d, 'organizations', ORG, 'userEmails', `${OP2}@test.com`), { userId: OP2 })
    await setDoc(doc(d, 'organizations', ORG, 'operatives', 'row-op2'), { firstName: 'Op', email: `${OP2}@test.com` })
    const base = { projectId: 'job2', jobCollection: 'projects', date: 1762214400000, timeSlot: 'CUSTOM_HOURS', workStartTime: '06:30', workEndTime: '14:00', status: 'Confirmed', bookedBy: 'Ada', notes: '' }
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'BR2'), { id: 'BR2', operativeId: 'row-sam2', ...base })
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'BG'), { id: 'BG', operativeId: 'row-ghost', ...base })
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'BO'), { id: 'BO', operativeId: 'row-op2', ...base })
  })
}

test('1.33.0 every id: the line manager writes the overtime fields of a booking under the person\'s own operatives row', async () => {
  await seed133()
  await assertSucceeds(updateDoc(await orgDoc(LM, 'bookings', 'BR2'), { workStartTime: '07:30', otMultiplierOverride: 1.5 }))
  // Never another field, and never through a row on someone else's email or a row with no email (a ghost).
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'BR2'), { projectId: 'job1' }))
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'BO'), { workStartTime: '07:30' }))
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'BG'), { workStartTime: '07:30' }))
  // A manager who is not Sam's line manager and does not manage job2 cannot; the job's manager and admins still can.
  await assertFails(updateDoc(await orgDoc(PM, 'bookings', 'BR2'), { workStartTime: '07:45' }))
  await assertFails(updateDoc(await orgDoc(OP2, 'bookings', 'BR2'), { workStartTime: '07:45' }))
  await assertSucceeds(updateDoc(await orgDoc(MGR2, 'bookings', 'BR2'), { workStartTime: '08:00' }))
  await assertSucceeds(updateDoc(await orgDoc(ADMIN, 'bookings', 'BR2'), { workStartTime: '08:15' }))
  // OP2's line manager (MGR2) reaches OP2's row; Sam's does not.
  await assertSucceeds(updateDoc(await orgDoc(MGR2, 'bookings', 'BO'), { workStartTime: '07:30' }))
})

test('1.33.0 Return: the decider writes approved with staleBookingIds and deletedBookingIds; nothing else', async () => {
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  await assertFails(updateDoc(await orgDoc(LM, 'overtimeRequests', 'R1'), { status: 'approved', decidedBy: LM, staleBookingIds: [], lines: [] }))
  await assertFails(updateDoc(await orgDoc(LM, 'overtimeRequests', 'R1'), { status: 'returned', decidedBy: LM }))
  await assertSucceeds(
    updateDoc(await orgDoc(LM, 'overtimeRequests', 'R1'), {
      status: 'approved',
      decidedBy: LM,
      decisions: { B1: { action: 'approve' } },
      appliedBookingIds: [],
      droppedBookingIds: [],
      staleBookingIds: ['B1'],
      deletedBookingIds: [],
    })
  )
})

test('1.33.0 reviews: changed, declined and deleted are decisions; anything else is refused', async () => {
  for (const decision of ['changed', 'declined', 'deleted']) {
    await assertSucceeds(setDoc(await orgDoc(LM, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', LM, { decision, requestId: 'R1' })))
  }
  await assertFails(setDoc(await orgDoc(LM, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', LM, { decision: 'returned' })))
  await assertFails(setDoc(await orgDoc(MGR2, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', MGR2, { decision: 'declined' })))
})

async function returnDelete(uid: string, bookingId: string, requestId: string, request: Record<string, unknown>, tombstone: Record<string, unknown> = {}) {
  const d = await db(uid)
  const batch = writeBatch(d)
  batch.delete(doc(d, 'organizations', ORG, 'bookings', bookingId))
  batch.set(doc(d, 'organizations', ORG, 'deletedBookings', bookingId), {
    bookingId, collection: 'bookings', deletedBy: uid, deletedFrom: 'web', deletedAt: serverTimestamp(), overtimeRequestId: requestId, ...tombstone,
  })
  batch.update(doc(d, 'organizations', ORG, 'overtimeRequests', requestId), {
    status: 'approved', decidedBy: uid, decisions: {}, appliedBookingIds: [], droppedBookingIds: [], staleBookingIds: [], ...request,
  })
  return batch.commit()
}

test('1.33.0 delete on Return: the line manager deletes the one booking their returned request names, with its tombstone', async () => {
  await seed133()
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  // Not listed in deletedBookingIds, or the tombstone names no request: refused.
  await assertFails(returnDelete(LM, 'B1', 'R1', { deletedBookingIds: [] }))
  {
    const d = await db(LM)
    const batch = writeBatch(d)
    batch.delete(doc(d, 'organizations', ORG, 'bookings', 'B1'))
    batch.set(doc(d, 'organizations', ORG, 'deletedBookings', 'B1'), { bookingId: 'B1', collection: 'bookings', deletedBy: LM, deletedFrom: 'web', deletedAt: serverTimestamp() })
    batch.update(doc(d, 'organizations', ORG, 'overtimeRequests', 'R1'), { status: 'approved', decidedBy: LM, deletedBookingIds: ['B1'] })
    await assertFails(batch.commit())
  }
  // B1 is Sam's, on job1 (PM's job): LM is not the job's manager, but the Return deletes it.
  await assertSucceeds(returnDelete(LM, 'B1', 'R1', { deletedBookingIds: ['B1'] }))
})

test('1.33.0 delete on Return: never another person\'s booking, never by someone who did not decide, never a manager site booking', async () => {
  await seed133()
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  // OP2's booking (B4) is not Sam's: LM is not OP2's line manager.
  await assertFails(returnDelete(LM, 'B4', 'R1', { deletedBookingIds: ['B4'] }))
  // A manager who is not Sam's line manager cannot decide, so cannot delete.
  await assertFails(returnDelete(PM, 'B1', 'R1', { deletedBookingIds: ['B1'] }))
  // A request already decided by someone else (ADMIN) gives LM nothing.
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R2'), requestData(SAM)))
  await assertSucceeds(updateDoc(await orgDoc(ADMIN, 'overtimeRequests', 'R2'), { status: 'approved', decidedBy: ADMIN, deletedBookingIds: ['B1'] }))
  const d = await db(LM)
  const batch = writeBatch(d)
  batch.delete(doc(d, 'organizations', ORG, 'bookings', 'B1'))
  batch.set(doc(d, 'organizations', ORG, 'deletedBookings', 'B1'), { bookingId: 'B1', collection: 'bookings', deletedBy: LM, deletedFrom: 'web', deletedAt: serverTimestamp(), overtimeRequestId: 'R2' })
  await assertFails(batch.commit())
  // A tombstone that already existed (not written in this batch) never opens the delete.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'organizations', ORG, 'deletedBookings', 'B3'), { bookingId: 'B3', collection: 'bookings', deletedBy: LM, deletedFrom: 'web', overtimeRequestId: 'R1' })
  })
  await assertFails(deleteDoc(await orgDoc(LM, 'bookings', 'B3')))
  // Manager site bookings never go through this path.
  const m = writeBatch(d)
  m.delete(doc(d, 'organizations', ORG, 'managerSiteBookings', 'M1'))
  m.set(doc(d, 'organizations', ORG, 'deletedBookings', 'M1'), { bookingId: 'M1', collection: 'managerSiteBookings', deletedBy: LM, deletedFrom: 'web', deletedAt: serverTimestamp(), overtimeRequestId: 'R1' })
  m.update(doc(d, 'organizations', ORG, 'overtimeRequests', 'R1'), { status: 'approved', decidedBy: LM, deletedBookingIds: ['M1'] })
  await assertFails(m.commit())
})

test('1.33.0 delete on Return: a booking under the person\'s own operatives row too; an admin\'s tombstone may name the request', async () => {
  await seed133()
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  await assertSucceeds(returnDelete(LM, 'BR2', 'R1', { deletedBookingIds: ['BR2'] }))
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'R3'), requestData(SAM)))
  await assertSucceeds(returnDelete(ADMIN, 'B1', 'R3', { deletedBookingIds: ['B1'] }))
  // A tombstone with any other extra key is refused.
  await assertFails(
    setDoc(await orgDoc(ADMIN, 'deletedBookings', 'B3'), { bookingId: 'B3', collection: 'bookings', deletedBy: ADMIN, deletedFrom: 'web', deletedAt: serverTimestamp(), note: 'x' })
  )
})

// MARK: - 1.33.0 review fix: the Return reaches bookings filed under any of the person's ids (former invite id, same-email account)

async function seedReturnAliases() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    // Sam's old invite placeholder id (its users document was deleted on accept) and a second account on Sam's email
    // that does not list LM as line manager.
    await updateDoc(doc(d, 'users', SAM), { formerUserIds: ['ot-sam-invite'], sameEmailUserIds: ['ot-sam-2'] })
    await setDoc(doc(d, 'users', 'ot-sam-2'), { email: `${SAM}@test.com`, organizationId: ORG, role: 'operative', operativeMode: true, assignedManagerUserIds: [ADMIN] })
    const base = { projectId: 'job2', jobCollection: 'projects', date: 1762214400000, timeSlot: 'CUSTOM_HOURS', workStartTime: '06:30', workEndTime: '14:00', status: 'Confirmed', bookedBy: 'Ada', notes: '' }
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'BF'), { id: 'BF', operativeId: 'ot-sam-invite', ...base })
    await setDoc(doc(d, 'organizations', ORG, 'bookings', 'BS'), { id: 'BS', operativeId: 'ot-sam-2', ...base })
  })
}

/** A Return's booking change and its request update in one batch (the web transaction writes both). */
async function returnUpdate(uid: string, bookingId: string, requestId: string, request: Record<string, unknown>, booking: Record<string, unknown> = {}) {
  const d = await db(uid)
  const batch = writeBatch(d)
  batch.update(doc(d, 'organizations', ORG, 'bookings', bookingId), { workStartTime: '07:30', otMultiplierOverride: 2, overtimeReturnRequestId: requestId, ...booking })
  batch.update(doc(d, 'organizations', ORG, 'overtimeRequests', requestId), {
    status: 'approved', decidedBy: uid, decisions: {}, droppedBookingIds: [], staleBookingIds: [], deletedBookingIds: [], ...request,
  })
  return batch.commit()
}

test('1.33.0 Return under another id: the line manager changes a booking filed under the person\'s former invite id or same-email account', async () => {
  await seedReturnAliases()
  // Without a Return, the plain line-manager path does not reach these ids (the bug the review found).
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'BF'), { workStartTime: '07:30' }))
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'BS'), { workStartTime: '07:30' }))
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'RA'), requestData(SAM)))
  await assertSucceeds(returnUpdate(LM, 'BF', 'RA', { appliedBookingIds: ['BF'] }))
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'RB'), requestData(SAM)))
  await assertSucceeds(returnUpdate(LM, 'BS', 'RB', { appliedBookingIds: ['BS'] }))
  // A booking under Sam's own users id goes through the Return path too.
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'RC'), requestData(SAM)))
  await assertSucceeds(returnUpdate(LM, 'B1', 'RC', { appliedBookingIds: ['B1'] }))
})

test('1.33.0 Return under another id: never a field outside the overtime list, never a booking the request does not name', async () => {
  await seedReturnAliases()
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'RA'), requestData(SAM)))
  // The request names B1, not BF.
  await assertFails(returnUpdate(LM, 'BF', 'RA', { appliedBookingIds: ['B1'] }))
  // Another field beside the overtime fields.
  await assertFails(returnUpdate(LM, 'BF', 'RA', { appliedBookingIds: ['BF'] }, { projectId: 'job1' }))
  // A request id that does not exist / is not decided in this batch.
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'BF'), { workStartTime: '07:30', overtimeReturnRequestId: 'RA' }))
  await assertFails(updateDoc(await orgDoc(LM, 'bookings', 'BF'), { workStartTime: '07:30', overtimeReturnRequestId: 'nope' }))
})

test('1.33.0 Return under another id: a different manager, or the line manager using another person\'s request, gets nothing', async () => {
  await seedReturnAliases()
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'RA'), requestData(SAM)))
  // MGR2 (job2's manager but not Sam's line manager) cannot decide Sam's request, so cannot use it.
  await assertFails(returnUpdate(MGR2, 'BF', 'RA', { appliedBookingIds: ['BF'] }, { workStartTime: '08:00' }))
  // PM (another report of LM) sends a request; LM returns it naming Sam's alias booking: refused (not PM's booking).
  await assertSucceeds(setDoc(await orgDoc(PM, 'overtimeRequests', 'RP'), requestData(PM)))
  await assertFails(returnUpdate(LM, 'BF', 'RP', { appliedBookingIds: ['BF'] }))
  await assertFails(returnUpdate(LM, 'BS', 'RP', { appliedBookingIds: ['BS'] }))
  await assertFails(returnDelete(LM, 'BF', 'RP', { deletedBookingIds: ['BF'] }))
})

test('1.33.0 delete on Return under another id: the line manager deletes the person\'s booking filed under their former invite id', async () => {
  await seedReturnAliases()
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'RA'), requestData(SAM)))
  await assertSucceeds(returnDelete(LM, 'BF', 'RA', { deletedBookingIds: ['BF'] }))
  await assertSucceeds(setDoc(await orgDoc(SAM, 'overtimeRequests', 'RB'), requestData(SAM)))
  await assertSucceeds(returnDelete(LM, 'BS', 'RB', { deletedBookingIds: ['BS'] }))
})
