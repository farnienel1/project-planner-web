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
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore'

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

function db(uid: string) {
  return env.authenticatedContext(uid, { email: `${uid}@test.com` }).firestore()
}
function orgDoc(uid: string, ...segments: string[]) {
  return doc(db(uid), 'organizations', ORG, ...segments)
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

// MARK: - Bookings: the line manager applies an approved request (overtime fields only)

test('line manager changes their report\'s booking times and overtime rate', async () => {
  await assertSucceeds(updateDoc(orgDoc(LM, 'bookings', 'B1'), { workStartTime: '07:30', workEndTime: '15:00', otMultiplierOverride: 2, timeSlot: 'CUSTOM_HOURS' }))
})

test('line manager cancels their report\'s booking and removes a custom rate', async () => {
  await assertSucceeds(updateDoc(orgDoc(LM, 'bookings', 'B1'), { status: 'Cancelled' }))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'organizations', ORG, 'bookings', 'B1'), { otMultiplierOverride: 2 })
  })
  await assertSucceeds(updateDoc(orgDoc(LM, 'bookings', 'B1'), { otMultiplierOverride: deleteField() }))
})

test('line manager may not change any other booking field or status', async () => {
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'B1'), { notes: 'changed' }))
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'B1'), { projectId: 'job2' }))
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'B1'), { status: 'Tentative' }))
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'B1'), { operativeId: LM }))
})

test('line manager may only set an overtime rate of 1–3 in 0.25 steps', async () => {
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'B1'), { otMultiplierOverride: 3.5 }))
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'B1'), { otMultiplierOverride: 1.1 }))
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'B1'), { otMultiplierOverride: 0.75 }))
  await assertSucceeds(updateDoc(orgDoc(LM, 'bookings', 'B1'), { otMultiplierOverride: 1.25 }))
  await assertSucceeds(updateDoc(orgDoc(LM, 'bookings', 'B1'), { otMultiplierOverride: 3 }))
})

test('a manager who is not the line manager or the job manager cannot change the booking', async () => {
  await assertFails(updateDoc(orgDoc(MGR2, 'bookings', 'B1'), { workStartTime: '07:30' }))
})

test('an operative never writes a booking, not even their own', async () => {
  await assertFails(updateDoc(orgDoc(SAM, 'bookings', 'B1'), { workStartTime: '07:30' }))
  await assertFails(updateDoc(orgDoc(SAM, 'bookings', 'B1'), { status: 'Cancelled' }))
})

test('admins keep writing every booking field', async () => {
  await assertSucceeds(updateDoc(orgDoc(ADMIN, 'bookings', 'B1'), { notes: 'admin note', otMultiplierOverride: 2 }))
})

test('a PAYE manager changes their own booking only where they manage the job; their line manager may change it', async () => {
  await assertFails(updateDoc(orgDoc(PM, 'bookings', 'B2'), { workStartTime: '07:30' }))
  await assertSucceeds(updateDoc(orgDoc(PM, 'bookings', 'B3'), { workStartTime: '07:30' }))
  await assertSucceeds(updateDoc(orgDoc(LM, 'bookings', 'B2'), { workStartTime: '07:30' }))
})

test('the line manager rule also covers manager site bookings', async () => {
  await assertSucceeds(updateDoc(orgDoc(LM, 'managerSiteBookings', 'M1'), { workEndTime: '16:00' }))
  await assertFails(updateDoc(orgDoc(LM, 'managerSiteBookings', 'M1'), { locationType: 'project' }))
  await assertFails(updateDoc(orgDoc(MGR2, 'managerSiteBookings', 'M1'), { workEndTime: '16:00' }))
})

test('an admin of another company is no line manager here', async () => {
  await assertFails(updateDoc(doc(db(ADMIN_B), 'organizations', ORG, 'bookings', 'B1'), { workStartTime: '07:30' }))
})

test('a booking filed under an operatives row is never written through the line-manager path (admins and job managers only)', async () => {
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'BR1'), { workStartTime: '07:30' }))
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'BR1'), { status: 'Cancelled' }))
  await assertSucceeds(updateDoc(orgDoc(PM, 'bookings', 'BR1'), { workStartTime: '07:30' }))
  await assertSucceeds(updateDoc(orgDoc(ADMIN, 'bookings', 'BR1'), { status: 'Cancelled' }))
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
  await assertLogicalDeny(updateDoc(orgDoc(LM, 'operatives', 'row-x'), { linkedUserId: SAM }))
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'organizations', ORG, 'operatives', 'row-x'), { linkedUserId: SAM })
  })
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'BX'), { status: 'Cancelled' }))
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'BX'), { workStartTime: '07:30' }))
  // Even an operative relinking the row gains nothing.
  await assertFails(updateDoc(orgDoc(OP2, 'bookings', 'BX'), { status: 'Cancelled' }))
})

test('line manager booking writes: clock times are short text and the slot is a known one', async () => {
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'B1'), { workStartTime: 730 }))
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'B1'), { workEndTime: 'x'.repeat(40) }))
  await assertFails(updateDoc(orgDoc(LM, 'bookings', 'B1'), { timeSlot: 'WHATEVER' }))
  await assertSucceeds(updateDoc(orgDoc(LM, 'bookings', 'B1'), { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '15:00' }))
})

test('reads are unchanged: with enforced reads a line manager who does not manage the job reads the booking only as before', async () => {
  // Known limit (1.29.0, rules expression budget): the line manager's overtime reads of a report's bookings follow the
  // existing read rules (switch off: every member; switch on: job managers, toggles, the person).
  await assertFails(getDoc(orgDoc(LM, 'bookings', 'B1')))
  await assertSucceeds(getDoc(orgDoc(PM, 'bookings', 'B1')))
  await assertSucceeds(getDoc(orgDoc(ADMIN, 'bookings', 'B1')))
})

// MARK: - overtimeRequests

test('the person sends their own pending request; never for someone else or already approved', async () => {
  await assertSucceeds(setDoc(orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  await assertFails(setDoc(orgDoc(SAM, 'overtimeRequests', 'R2'), requestData(PM)))
  await assertFails(setDoc(orgDoc(SAM, 'overtimeRequests', 'R3'), requestData(SAM, { status: 'approved' })))
  await assertFails(setDoc(orgDoc(SAM, 'overtimeRequests', 'R4'), requestData(SAM, { lines: [] })))
  await assertFails(setDoc(orgDoc(SAM, 'overtimeRequests', 'R5'), requestData(SAM, { decidedBy: SAM })))
  await assertFails(setDoc(doc(db(ADMIN_B), 'organizations', ORG, 'overtimeRequests', 'R6'), requestData(ADMIN_B)))
})

test('requests are read by the person, their line managers and admins only', async () => {
  await assertSucceeds(setDoc(orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  await assertSucceeds(getDoc(orgDoc(SAM, 'overtimeRequests', 'R1')))
  await assertSucceeds(getDoc(orgDoc(LM, 'overtimeRequests', 'R1')))
  await assertSucceeds(getDoc(orgDoc(ADMIN, 'overtimeRequests', 'R1')))
  await assertFails(getDoc(orgDoc(MGR2, 'overtimeRequests', 'R1')))
  await assertFails(getDoc(orgDoc(OP2, 'overtimeRequests', 'R1')))
  await assertFails(getDoc(doc(db(ADMIN_B), 'organizations', ORG, 'overtimeRequests', 'R1')))
  await assertSucceeds(getDocs(query(collection(db(SAM), 'organizations', ORG, 'overtimeRequests'), where('userId', '==', SAM))))
  await assertSucceeds(getDocs(query(collection(db(LM), 'organizations', ORG, 'overtimeRequests'), where('userId', '==', SAM))))
  await assertSucceeds(getDocs(collection(db(ADMIN), 'organizations', ORG, 'overtimeRequests')))
  await assertFails(getDocs(collection(db(LM), 'organizations', ORG, 'overtimeRequests')))
})

test('the person withdraws their own pending request but never approves it', async () => {
  await assertSucceeds(setDoc(orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  await assertFails(updateDoc(orgDoc(SAM, 'overtimeRequests', 'R1'), { status: 'approved', decidedBy: SAM }))
  await assertFails(updateDoc(orgDoc(SAM, 'overtimeRequests', 'R1'), { lines: [] }))
  await assertSucceeds(updateDoc(orgDoc(SAM, 'overtimeRequests', 'R1'), { status: 'withdrawn' }))
  // Withdrawn is final.
  await assertFails(updateDoc(orgDoc(LM, 'overtimeRequests', 'R1'), { status: 'approved', decidedBy: LM }))
})

test('the line manager or an admin approves; another manager or a changed line cannot', async () => {
  await assertSucceeds(setDoc(orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  await assertFails(updateDoc(orgDoc(MGR2, 'overtimeRequests', 'R1'), { status: 'approved', decidedBy: MGR2 }))
  await assertFails(updateDoc(orgDoc(LM, 'overtimeRequests', 'R1'), { status: 'approved', decidedBy: ADMIN }))
  await assertFails(updateDoc(orgDoc(LM, 'overtimeRequests', 'R1'), { status: 'approved', decidedBy: LM, lines: [] }))
  await assertFails(updateDoc(orgDoc(LM, 'overtimeRequests', 'R1'), { status: 'withdrawn' }))
  await assertSucceeds(
    updateDoc(orgDoc(LM, 'overtimeRequests', 'R1'), {
      status: 'approved',
      decidedBy: LM,
      decisions: { B1: { action: 'approve' } },
      appliedBookingIds: ['B1'],
      droppedBookingIds: [],
    })
  )
  await assertSucceeds(setDoc(orgDoc(SAM, 'overtimeRequests', 'R2'), requestData(SAM)))
  await assertSucceeds(updateDoc(orgDoc(ADMIN, 'overtimeRequests', 'R2'), { status: 'approved', decidedBy: ADMIN }))
})

test('nobody approves their own request, admins included', async () => {
  await assertSucceeds(setDoc(orgDoc(ADMIN, 'overtimeRequests', 'RA'), requestData(ADMIN)))
  await assertFails(updateDoc(orgDoc(ADMIN, 'overtimeRequests', 'RA'), { status: 'approved', decidedBy: ADMIN }))
})

test('requests are never deleted by an app', async () => {
  await assertSucceeds(setDoc(orgDoc(SAM, 'overtimeRequests', 'R1'), requestData(SAM)))
  await assertFails(deleteDoc(orgDoc(SAM, 'overtimeRequests', 'R1')))
  await assertFails(deleteDoc(orgDoc(ADMIN, 'overtimeRequests', 'R1')))
})

// MARK: - overtimeReviews

test('line managers and admins write a report\'s reviews; the id is {userId}_{bookingId} and reviewedBy the writer', async () => {
  await assertSucceeds(setDoc(orgDoc(LM, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', LM)))
  await assertSucceeds(setDoc(orgDoc(ADMIN, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', ADMIN, { decision: 'trimmed' })))
  await assertFails(setDoc(orgDoc(LM, 'overtimeReviews', 'wrong-id'), reviewData(SAM, 'B1', LM)))
  await assertFails(setDoc(orgDoc(LM, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', ADMIN)))
  await assertFails(setDoc(orgDoc(LM, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', LM, { decision: 'whatever' })))
  await assertFails(setDoc(orgDoc(MGR2, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', MGR2)))
})

test('an operative never writes their own review; a PAYE manager only for bookings they may edit', async () => {
  await assertFails(setDoc(orgDoc(SAM, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', SAM)))
  await assertSucceeds(setDoc(orgDoc(PM, 'overtimeReviews', `${PM}_B3`), reviewData(PM, 'B3', PM)))
  await assertFails(setDoc(orgDoc(PM, 'overtimeReviews', `${PM}_B2`), reviewData(PM, 'B2', PM)))
  await assertSucceeds(setDoc(orgDoc(ADMIN, 'overtimeReviews', `${ADMIN}_B4`), reviewData(ADMIN, 'B4', ADMIN)))
})

test('reviews are read by the person, their line managers and admins only; deleted by admins only', async () => {
  await assertSucceeds(setDoc(orgDoc(LM, 'overtimeReviews', `${SAM}_B1`), reviewData(SAM, 'B1', LM)))
  await assertSucceeds(getDoc(orgDoc(SAM, 'overtimeReviews', `${SAM}_B1`)))
  await assertSucceeds(getDoc(orgDoc(LM, 'overtimeReviews', `${SAM}_B1`)))
  await assertFails(getDoc(orgDoc(MGR2, 'overtimeReviews', `${SAM}_B1`)))
  await assertFails(getDoc(orgDoc(OP2, 'overtimeReviews', `${SAM}_B1`)))
  await assertFails(deleteDoc(orgDoc(LM, 'overtimeReviews', `${SAM}_B1`)))
  await assertSucceeds(deleteDoc(orgDoc(ADMIN, 'overtimeReviews', `${SAM}_B1`)))
})

// MARK: - overtimeReports

test('the person saves their own report once; it is never changed or deleted', async () => {
  await assertSucceeds(setDoc(orgDoc(SAM, 'overtimeReports', 'REP1'), reportData(SAM)))
  await assertFails(setDoc(orgDoc(SAM, 'overtimeReports', 'REP2'), reportData(PM)))
  await assertFails(setDoc(orgDoc(LM, 'overtimeReports', 'REP3'), reportData(SAM, { generatedBy: LM })))
  await assertFails(setDoc(orgDoc(SAM, 'overtimeReports', 'REP4'), reportData(SAM, { kind: 'expenses' })))
  await assertFails(updateDoc(orgDoc(SAM, 'overtimeReports', 'REP1'), { userName: 'Changed' }))
  await assertFails(deleteDoc(orgDoc(SAM, 'overtimeReports', 'REP1')))
  await assertFails(deleteDoc(orgDoc(ADMIN, 'overtimeReports', 'REP1')))
})

test('reports are read by the person, their line managers and admins only', async () => {
  await assertSucceeds(setDoc(orgDoc(SAM, 'overtimeReports', 'REP1'), reportData(SAM)))
  await assertSucceeds(getDoc(orgDoc(SAM, 'overtimeReports', 'REP1')))
  await assertSucceeds(getDoc(orgDoc(LM, 'overtimeReports', 'REP1')))
  await assertSucceeds(getDoc(orgDoc(ADMIN, 'overtimeReports', 'REP1')))
  await assertFails(getDoc(orgDoc(MGR2, 'overtimeReports', 'REP1')))
  await assertFails(getDoc(orgDoc(OP2, 'overtimeReports', 'REP1')))
  await assertSucceeds(getDocs(query(collection(db(SAM), 'organizations', ORG, 'overtimeReports'), where('userId', '==', SAM))))
})

test('1.32.0 partial approval: the line manager records what they applied and the request stays pending for an admin', async () => {
  await assertSucceeds(setDoc(orgDoc(SAM, 'overtimeRequests', 'RP'), requestData(SAM)))
  await assertSucceeds(
    updateDoc(orgDoc(LM, 'overtimeRequests', 'RP'), {
      status: 'pending',
      decidedBy: LM,
      decisions: { B1: { action: 'approve' } },
      appliedBookingIds: ['B1'],
      droppedBookingIds: [],
    })
  )
  // Still only the decision fields, still never by the person or another manager.
  await assertFails(updateDoc(orgDoc(LM, 'overtimeRequests', 'RP'), { status: 'pending', decidedBy: LM, lines: [] }))
  await assertFails(updateDoc(orgDoc(SAM, 'overtimeRequests', 'RP'), { status: 'pending', decidedBy: SAM, appliedBookingIds: ['B1'] }))
  await assertFails(updateDoc(orgDoc(MGR2, 'overtimeRequests', 'RP'), { status: 'pending', decidedBy: MGR2, appliedBookingIds: ['B1'] }))
  // The admin completes it.
  await assertSucceeds(updateDoc(orgDoc(ADMIN, 'overtimeRequests', 'RP'), { status: 'approved', decidedBy: ADMIN, appliedBookingIds: ['B1', 'B2'] }))
  await assertFails(updateDoc(orgDoc(ADMIN, 'overtimeRequests', 'RP'), { status: 'pending', decidedBy: ADMIN }), 'approved is final')
})
