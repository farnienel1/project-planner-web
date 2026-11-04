import { test } from 'node:test'
import assert from 'node:assert/strict'
import { overtimePersonIds } from './overtimePersonIds.ts'
import { overtimeApprovalWrites, overtimeRequestLineFields, parseOvertimeRequestDocument } from '../canonical/index.ts'

const ORG = {
  countryCode: 'GB',
  payrollTimePolicy: {
    standardDayStart: '07:30',
    standardDayEnd: '16:00',
    unpaidBreakMinutes: 30,
    breakWindowStart: '12:00',
    breakWindowEnd: '12:30',
    weekdayOutsideStandardMultiplier: 1.5,
  },
}
const TZ = 'Europe/London'

function booking(id: string, personId: string) {
  return {
    id,
    collection: 'bookings' as const,
    personId,
    dayKey: '2026-11-04',
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: '06:30',
    workEndTime: '14:00',
    status: 'Confirmed',
    jobId: 'job-1',
    jobNumber: 'J-1042',
    jobName: 'Riverside Flats',
  }
}

test('Overtime ids include every operatives row on the email, not one', () => {
  const ids = overtimePersonIds({ id: 'sam', email: 'Sam@x.com' }, ['sam'], [
    { id: 'row-1', email: 'sam@x.com' },
    { id: 'row-2', email: 'SAM@x.com' },
    { id: 'row-other', email: 'other@x.com' },
  ])
  assert.deepEqual(ids, ['sam', 'row-1', 'row-2'])
})

test('decision A: a booking on a second operatives row ends in needsAdmin for a line manager; an admin approves it', () => {
  const operatives = [
    { id: 'row-1', email: 'sam@x.com' },
    { id: 'row-2', email: 'sam@x.com' },
  ]
  const personIds = overtimePersonIds({ id: 'sam', email: 'sam@x.com' }, ['sam'], operatives)
  const rowBooking = booking('B-ROW2', 'row-2')
  const line = overtimeRequestLineFields({ booking: rowBooking, organization: ORG, timeZone: TZ, proposal: { action: 'strike' }, personIds })
  assert.ok(line, 'the second-row booking is the person\'s own and can be requested')
  const request = parseOvertimeRequestDocument('R1', { userId: 'sam', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', status: 'pending', lines: [line] })
  const base = { request, bookings: { 'B-ROW2': rowBooking }, organization: ORG, timeZone: TZ, deciderId: 'lm', requesterIds: personIds, decisions: { 'B-ROW2': { action: 'approve' as const } } }
  const asLineManager = overtimeApprovalWrites(base)
  assert.deepEqual(asLineManager.ok === false && [asLineManager.reason, asLineManager.bookingIds], ['needsAdmin', ['B-ROW2']])
  assert.equal(overtimeApprovalWrites({ ...base, deciderIsAdmin: true }).ok, true)
})
