import assert from 'node:assert/strict'
import test from 'node:test'
import { managerBookingIdentity, operativeBookingIdentity, uniqueBookingsById } from './bookingRequestIdentity'
import type { ManagerSiteBooking } from './managerSiteBookingUtils'

const ZONE = 'Europe/London'
const saturday = new Date('2026-11-07T00:00:00Z')

function managerBooking(id: string, start: string, end: string): ManagerSiteBooking {
  return {
    id,
    userId: 'USER-1',
    date: saturday,
    timeSlot: 'CUSTOM_HOURS',
    locationType: 'project',
    locationId: 'JOB-1',
    workStartTime: start,
    workEndTime: end,
    isBreakRemoved: false,
    createdAt: saturday,
    updatedAt: saturday,
    organizationId: 'ORG',
  } as ManagerSiteBooking
}

test('1.20.2: two Saturday bookings at the same job with other times are two bookings (My Schedule / Book labour)', () => {
  const morning = managerBooking('A', '07:30', '12:00')
  const afternoon = managerBooking('B', '13:00', '16:00')
  assert.notEqual(managerBookingIdentity(morning, ZONE), managerBookingIdentity(afternoon, ZONE))
  assert.equal(managerBookingIdentity(morning, ZONE), managerBookingIdentity(managerBooking('C', '07:30', '12:00'), ZONE))
  // My Schedule lists every stored booking: only the same document id is folded.
  assert.deepEqual(uniqueBookingsById([morning, afternoon, { ...morning }]).map((row) => row.id), ['A', 'B'])
  assert.deepEqual(uniqueBookingsById([morning, { ...morning, id: 'a' }]).map((row) => row.id), ['A'])
})

test('1.20.2: operative booking identity compares custom times', () => {
  const booking = { operativeId: 'OP-1', projectId: 'JOB-1', date: saturday, timeSlot: 'CUSTOM' as never, workStartTime: '07:30', workEndTime: '12:00', isBreakRemoved: false }
  assert.notEqual(operativeBookingIdentity(booking, ZONE), operativeBookingIdentity({ ...booking, workStartTime: '08:00' }, ZONE))
  assert.equal(operativeBookingIdentity(booking, ZONE), operativeBookingIdentity({ ...booking, operativeId: 'op-1' }, ZONE))
})
