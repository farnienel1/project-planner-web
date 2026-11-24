/**
 * Owner report 24 Nov: on web the line manager's ✕ / ⚙ on a timesheet line (1.72.0) read and wrote
 * `bookings/op-{id}` — the collector's prefixed `bookingId` used as the document id — so ✕ showed "This was deleted on
 * another device." and nothing changed. `timesheetLineBooking` must give the stored booking document id.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { collectTimesheetPayroll } from './timesheetPayrollCollector.ts'
import { timesheetLineBooking } from './payrollLineBookingLookup.ts'
import { DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'

const subject = {
  id: 'u1', email: 'ada@x.com', firstName: 'Ada', surname: 'B', organizationId: 'org', role: 'operative',
  passwordSet: true, policyAccepted: true, isSuperAdmin: false, isActive: true, createdAt: new Date(), updatedAt: new Date(),
  dayRate: 200, employmentType: 'self_employed',
  permissions: { operativeMode: true },
} as unknown as User

const operative = {
  id: 'op1', firstName: 'Ada', lastName: 'B', email: 'ada@x.com', startDate: new Date(), hourlyRate: 0, dayRate: 200,
  skills: [], qualifications: [], isActive: true, createdAt: new Date(), updatedAt: new Date(),
} as unknown as Operative

const project = {
  id: 'proj1', jobNumber: 'J-1', siteName: 'Site One', addressLine1: '1 Road', townCity: 'London', postcode: 'E1 1AA',
  client: { id: 'c1', name: 'Client', createdAt: new Date(), updatedAt: new Date() }, startDate: new Date(),
  endDate: new Date(), jobType: 'CAT A', manager: { name: 'Custom', email: '' }, isLive: true,
  createdAt: new Date(), updatedAt: new Date(),
} as unknown as Project

const BOOKING_ID = '6A9632BA-1C2D-4E5F-8A9B-0C1D2E3F4A5B'

function lines() {
  const booking: Booking = {
    id: BOOKING_ID, operativeId: 'op1', projectId: 'proj1', date: new Date('2026-11-17T08:00:00Z'),
    timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '19:00', bookedBy: 'Ada', status: 'Confirmed',
    createdAt: new Date(), updatedAt: new Date(),
  } as Booking
  return collectTimesheetPayroll({
    user: subject, bookings: [booking], managerSiteBookings: [], operatives: [operative], projects: [project], smallWorks: [],
    periodStart: new Date('2026-11-16T00:00:00Z'), periodEnd: new Date('2026-11-30T00:00:00Z'),
    payrollPolicy: DEFAULT_PAYROLL_POLICY, timeZone: 'Europe/London',
  }).lineItems
}

test('24 Nov: the collector line carries the prefixed id (unchanged), and ✕ / ⚙ use the stored booking id', () => {
  const items = lines()
  const standard = items.find((line) => !line.isOvertimeLine)
  const overtime = items.find((line) => line.isOvertimeLine)
  assert.ok(standard && overtime)
  // The collector's shape is read elsewhere (1.47.0 `signedTimesheetLineBookingKey`) and is not changed here.
  assert.equal(standard.bookingId, `op-${BOOKING_ID}`)
  assert.deepEqual(timesheetLineBooking(standard), { bookingId: BOOKING_ID, collection: 'bookings' })
  assert.deepEqual(timesheetLineBooking(overtime), { bookingId: BOOKING_ID, collection: 'bookings' })
})

test('24 Nov: a manager site line maps to managerSiteBookings with the bare id', () => {
  assert.deepEqual(
    timesheetLineBooking({ id: 'mgr-M1-normal', bookingId: 'mgr-M1', bookingCollection: 'managerSiteBookings' }),
    { bookingId: 'M1', collection: 'managerSiteBookings' }
  )
  assert.deepEqual(timesheetLineBooking({ id: 'mgr-M1-ot' }), { bookingId: 'M1', collection: 'managerSiteBookings' })
})

test('24 Nov: a bare bookingId (and a booking id that itself starts op-) is used as stored', () => {
  assert.deepEqual(timesheetLineBooking({ id: 'op-B1-normal', bookingId: 'B1' }), { bookingId: 'B1', collection: 'bookings' })
  // A stored booking id that really is `op-x`: its line id is `op-op-x-normal`, its prefixed bookingId `op-op-x`.
  assert.deepEqual(timesheetLineBooking({ id: 'op-op-x-normal', bookingId: 'op-op-x' }), { bookingId: 'op-x', collection: 'bookings' })
  assert.equal(timesheetLineBooking({ id: 'leave-1' }), null)
})

test('24 Nov end to end: a reviewer ✕ recorded under timesheetLineBooking keeps the sheet with the reviewer', async () => {
  const { timesheetReviewerBookingEditRecord, signedTimesheetBookingChanges, signedTimesheetActions } = await import(
    '../canonical/timesheetBookingChanges.ts'
  )
  const standard = lines().find((line) => !line.isOvertimeLine)
  assert.ok(standard && standard.bookingFingerprint)
  const signedAt = '2026-11-20T08:00:00Z'
  const sheet = {
    operativeSignedAt: signedAt,
    operativeSignedBookingsSignedAt: signedAt,
    operativeSignedBookingsAt: signedAt,
    operativeSignedBookings: [
      { bookingId: BOOKING_ID, collection: 'bookings', fingerprint: standard.bookingFingerprint, personId: 'op1', place: 'job|proj1' },
    ],
  }
  const target = timesheetLineBooking(standard)
  assert.ok(target)
  const changesWith = (booking: { collection: string; bookingId: string }) => {
    const recorded = timesheetReviewerBookingEditRecord({ sheet, booking, after: null, deleted: true, editedBy: 'lm1' })
    assert.ok(recorded)
    return signedTimesheetBookingChanges({
      sheet: { ...sheet, reviewerBookingEdits: { [recorded.key]: recorded.value } },
      liveLines: [],
      liveLoaded: true,
      liveBookings: [],
      tombstonedBookingIds: [{ collection: 'bookings', bookingId: BOOKING_ID }],
    } as Parameters<typeof signedTimesheetBookingChanges>[0])
  }
  // The id ✕ now deletes and records: the sheet is not reopened, the reviewer may counter-sign.
  const fixed = changesWith(target)
  assert.equal(fixed.reopened, false)
  assert.equal(signedTimesheetActions(fixed).lineManagerMayCounterSign, true)
  assert.equal(target.bookingId, BOOKING_ID)
})
