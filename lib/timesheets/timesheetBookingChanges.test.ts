import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import { emptyTimesheetDraft, type TimesheetDraft } from './timesheetDraft.ts'
import { applyWeeklyReportOverride } from './weeklyReportOverride.ts'
import { collectTimesheetPayroll } from './timesheetPayrollCollector.ts'
import { draftBookingChanges, draftForFigures, periodBookingChanges, signedTimesheetLiveLines } from './timesheetBookingChanges.ts'
import { draftFromFirestoreMap, draftToFirestoreMap } from './timesheetStorage.ts'
import { signedTimesheetActions, signedTimesheetBookingRecord } from '../canonical/index.ts'

// Rulebook 1.47.0 §8: a signed timesheet reopens when its bookings change (web wiring over the rulebook).

const person = {
  id: 'u1',
  email: 'ada@x.com',
  firstName: 'Ada',
  surname: 'Booked',
  organizationId: 'org',
  role: 'operative',
  passwordSet: true,
  policyAccepted: true,
  permissions: { operativeMode: true },
  isSuperAdmin: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  dayRate: 200,
  employmentType: 'self_employed',
  assignedManagerUserId: 'mgr',
} as unknown as User
const manager = { ...person, id: 'mgr', email: 'mgr@x.com', firstName: 'Morgan', role: 'manager', permissions: { manager: true }, assignedManagerUserId: undefined } as unknown as User
const users = [person, manager]

const operative = {
  id: 'op1',
  firstName: 'Ada',
  lastName: 'Booked',
  email: 'ada@x.com',
  startDate: new Date(),
  hourlyRate: 0,
  dayRate: 200,
  skills: [],
  qualifications: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Operative
const project = {
  id: 'proj1',
  jobNumber: 'J-1',
  siteName: 'Site One',
  startDate: new Date(),
  endDate: new Date(),
  jobType: 'CAT A',
  isLive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as Project

const day = new Date('2026-09-16T08:00:00Z')
function booking(partial: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    operativeId: 'op1',
    projectId: 'proj1',
    date: day,
    timeSlot: 'CUSTOM',
    workStartTime: '07:00',
    workEndTime: '16:00',
    bookedBy: 'Ada',
    status: 'Confirmed',
    createdAt: new Date('2026-09-10T08:00:00Z'),
    updatedAt: new Date('2026-09-10T08:00:00Z'),
    ...partial,
  } as Booking
}

const period = { start: new Date('2026-09-14T00:00:00Z'), end: new Date('2026-09-20T00:00:00Z') }
const collectorBase = {
  managerSiteBookings: [],
  operatives: [operative],
  projects: [project],
  smallWorks: [],
  payrollPolicy: DEFAULT_PAYROLL_POLICY,
  timeZone: 'Europe/London',
}
function linesFor(bookings: Booking[]) {
  return collectTimesheetPayroll({ ...collectorBase, user: person, bookings, periodStart: period.start, periodEnd: period.end }).lineItems
}
function signedSheet(bookings: Booking[]): TimesheetDraft {
  const lines = linesFor(bookings)
  const signed: TimesheetDraft = {
    ...emptyTimesheetDraft(),
    operativeSignedAt: new Date('2026-09-18T09:00:00Z'),
    operativeSignedByName: 'Ada Booked',
    operativeSignedBookings: signedTimesheetBookingRecord(signedTimesheetLiveLines(lines)),
    managerSignedAt: new Date('2026-09-18T10:00:00Z'),
    managerSignedByName: 'Morgan',
    managerSignedByUserId: 'mgr',
  }
  return applyWeeklyReportOverride({
    ...collectorBase,
    draft: signed,
    user: person,
    users,
    weekStart: period.start,
    weekEnd: period.end,
    bookings,
  })
}

test('1.47.0 web: a changed booking reopens a signed sheet for the person; re-signing then counter-signing rebuilds it', () => {
  const sheet = signedSheet([booking()])
  assert.ok(sheet.weeklyReportOverride?.lines.length)
  const unchanged = draftBookingChanges({ draft: sheet, lines: linesFor([booking()]), liveLoaded: true, selfSigned: false })
  assert.equal(unchanged.changed, false)

  const moved = [booking({ workEndTime: '18:00' })]
  const change = draftBookingChanges({ draft: sheet, lines: linesFor(moved), liveLoaded: true, selfSigned: false })
  assert.equal(change.reopened, true)
  assert.equal(change.waitingFor, 'person')
  // Figures come from the live bookings while reopened.
  assert.equal(draftForFigures(sheet, change).weeklyReportOverride, null)

  // The person signs again (record of the live bookings): now waiting for the line manager.
  const resigned: TimesheetDraft = {
    ...sheet,
    operativeSignedAt: new Date('2026-09-19T09:00:00Z'),
    operativeSignedBookings: signedTimesheetBookingRecord(signedTimesheetLiveLines(linesFor(moved))),
  }
  const afterResign = draftBookingChanges({ draft: resigned, lines: linesFor(moved), liveLoaded: true, selfSigned: false })
  assert.equal(afterResign.waitingFor, 'lineManager')
  assert.equal(signedTimesheetActions(afterResign).mayExport, false)

  // The line manager counter-signs again: the snapshot is rebuilt from the live bookings.
  const countersigned = applyWeeklyReportOverride({
    ...collectorBase,
    draft: { ...resigned, managerSignedAt: new Date('2026-09-19T10:00:00Z') },
    rebuildSnapshot: true,
    user: person,
    users,
    weekStart: period.start,
    weekEnd: period.end,
    bookings: moved,
  })
  const done = draftBookingChanges({ draft: countersigned, lines: linesFor(moved), liveLoaded: true, selfSigned: false })
  assert.equal(done.changed, false)
  // Without rebuildSnapshot the stored lines stay (1.43.0 rule, unchanged).
  const kept = applyWeeklyReportOverride({
    ...collectorBase,
    draft: resigned,
    user: person,
    users,
    weekStart: period.start,
    weekEnd: period.end,
    bookings: moved,
  })
  assert.deepEqual(kept.weeklyReportOverride?.lines, sheet.weeklyReportOverride?.lines)
})

test('1.47.0 web: an exported sheet is never rebuilt and reads as frozen', () => {
  const exported = { ...signedSheet([booking()]), exportedAt: new Date('2026-09-19T08:00:00Z') }
  const moved = [booking({ workEndTime: '18:00' })]
  const change = draftBookingChanges({ draft: exported, lines: linesFor(moved), liveLoaded: true, selfSigned: false })
  assert.equal(change.exported, true)
  assert.equal(change.reopened, false)
  const rebuilt = applyWeeklyReportOverride({
    ...collectorBase,
    draft: exported,
    rebuildSnapshot: true,
    user: person,
    users,
    weekStart: period.start,
    weekEnd: period.end,
    bookings: moved,
  })
  assert.deepEqual(rebuilt.weeklyReportOverride?.lines, exported.weeklyReportOverride?.lines)
})

test('1.47.0 web: periodBookingChanges waits for the bookings and ignores unsigned sheets', () => {
  const catalogue = { ...collectorBase, users, bookings: [booking({ workEndTime: '18:00' })], liveLoaded: false }
  const sheet = signedSheet([booking()])
  assert.equal(periodBookingChanges(catalogue, person, sheet, period), null)
  assert.equal(periodBookingChanges({ ...catalogue, liveLoaded: true }, person, emptyTimesheetDraft(), period), null)
  assert.equal(periodBookingChanges({ ...catalogue, liveLoaded: true }, person, sheet, period)?.waitingFor, 'person')
})

test('1.47.0 web: operativeSignedBookings round-trips through storage; an older sheet reads null', () => {
  const sheet = signedSheet([booking()])
  const back = draftFromFirestoreMap(draftToFirestoreMap(sheet))
  assert.deepEqual(back.operativeSignedBookings, sheet.operativeSignedBookings)
  assert.equal(draftFromFirestoreMap({ operativeSignedAt: new Date() }).operativeSignedBookings, null)
})
