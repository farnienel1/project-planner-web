import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { DEFAULT_MY_SCHEDULE, DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import { emptyTimesheetDraft, type TimesheetDraft } from './timesheetDraft.ts'
import { applyWeeklyReportOverride } from './weeklyReportOverride.ts'
import { collectTimesheetPayroll } from './timesheetPayrollCollector.ts'
import { draftBookingChanges, draftForFigures, draftSignedBookingRecord, periodBookingChanges } from './timesheetBookingChanges.ts'
import { draftFromFirestoreMap, draftToFirestoreMap } from './timesheetStorage.ts'
import { signedTimesheetActions } from '../canonical/index.ts'
import type { ManagerSiteBooking } from '../scheduling/managerSiteBookingUtils.ts'

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
function linesFor(bookings: Booking[], managerSiteBookings: ManagerSiteBooking[] = [], options: Partial<Parameters<typeof collectTimesheetPayroll>[0]> = {}) {
  return collectTimesheetPayroll({ ...collectorBase, managerSiteBookings, user: person, bookings, periodStart: period.start, periodEnd: period.end, ...options }).lineItems
}
function recordOf(bookings: Booking[], managerSiteBookings: ManagerSiteBooking[] = []) {
  return draftSignedBookingRecord({ lines: linesFor(bookings, managerSiteBookings), bookings, managerSiteBookings, timeZone: 'Europe/London' })
}
function changes(draft: TimesheetDraft, bookings: Booking[], managerSiteBookings: ManagerSiteBooking[] = [], lines = linesFor(bookings, managerSiteBookings)) {
  return draftBookingChanges({ draft, lines, bookings, managerSiteBookings, timeZone: 'Europe/London', liveLoaded: true, selfSigned: false })
}
function signedSheet(bookings: Booking[], managerSiteBookings: ManagerSiteBooking[] = []): TimesheetDraft {
  const signed: TimesheetDraft = {
    ...emptyTimesheetDraft(),
    operativeSignedAt: new Date('2026-09-18T09:00:00Z'),
    operativeSignedByName: 'Ada Booked',
    operativeSignedBookings: recordOf(bookings, managerSiteBookings),
    operativeSignedBookingsAt: new Date('2026-09-18T09:00:00Z'),
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
    managerSiteBookings,
  })
}

test('1.47.0 web: a changed booking reopens a signed sheet for the person; re-signing then counter-signing rebuilds it', () => {
  const sheet = signedSheet([booking()])
  assert.ok(sheet.weeklyReportOverride?.lines.length)
  const unchanged = changes(sheet, [booking()])
  assert.equal(unchanged.changed, false)

  const moved = [booking({ workEndTime: '18:00', updatedAt: new Date('2026-09-19T08:00:00Z') })]
  const change = changes(sheet, moved)
  assert.equal(change.reopened, true)
  assert.equal(change.waitingFor, 'person')
  // Figures come from the live bookings while reopened.
  assert.equal(draftForFigures(sheet, change).weeklyReportOverride, null)

  // The person signs again (record of the live bookings): now waiting for the line manager.
  const resigned: TimesheetDraft = {
    ...sheet,
    operativeSignedAt: new Date('2026-09-19T09:00:00Z'),
    operativeSignedBookings: recordOf(moved),
    operativeSignedBookingsAt: new Date('2026-09-19T09:00:00Z'),
  }
  const afterResign = changes(resigned, moved)
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
  const done = changes(countersigned, moved)
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
  const change = changes(exported, moved)
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

test('1.47.0 web (review #325 blocker 1): switching Office off in schedule options does not reopen; deleting it does', () => {
  const office = {
    id: 'm1',
    userId: 'u1',
    date: day,
    timeSlot: 'CUSTOM',
    locationType: 'office',
    workStartTime: '07:00',
    workEndTime: '16:00',
    createdAt: new Date('2026-09-10T08:00:00Z'),
    updatedAt: new Date('2026-09-10T08:00:00Z'),
  } as ManagerSiteBooking
  const sheet = signedSheet([booking()], [office])
  assert.ok(sheet.operativeSignedBookings?.some((row) => row.collection === 'managerSiteBookings'))
  const officeOff = linesFor([booking()], [office], { scheduleOptions: { ...DEFAULT_MY_SCHEDULE, showOffice: false } })
  assert.equal(officeOff.some((line) => line.id.startsWith('mgr-')), false, 'the collector drops the office booking')
  assert.equal(changes(sheet, [booking()], [office], officeOff).changed, false)
  // A real delete (the document is gone) reopens.
  const deleted = changes(sheet, [booking()], [], linesFor([booking()], []))
  assert.equal(deleted.reopened, true)
  assert.deepEqual(deleted.removedBookingIds, ['m1'])
})

test('1.47.0 web (review #325 blocker 2): the person no longer matched to an old booking (email change, row unlinked) does not reopen', () => {
  const sheet = signedSheet([booking()])
  // The collector no longer finds the booking for the person (no operatives row on their email any more).
  const unlinked = linesFor([booking()], [], { operatives: [] })
  assert.equal(unlinked.length, 0)
  assert.equal(changes(sheet, [booking()], [], unlinked).changed, false)
  // The booking given to another operative: removed.
  assert.equal(changes(sheet, [booking({ operativeId: 'op2' })], [], unlinked).reopened, true)
})
