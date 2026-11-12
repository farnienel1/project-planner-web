import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bookingDeleteFingerprint } from '../canonical/index.ts'
import { serializeBooking, serializeManagerSiteBooking } from '../ios-parity/converters.ts'
import { createWritePayload } from '../firebase/partialWrite.ts'
import { londonMidnight } from '../ios-parity/londonTime.ts'
import { detectOperativeClashes } from '../scheduling/bookingClashUtils.ts'
import { replacesNotYetTaken } from '../scheduling/draftProjectBooking.ts'
import type { Booking, Operative, Project, User } from '../../types/index.ts'

const DAY = londonMidnight(new Date('2026-11-17T12:00:00Z'))

function booking(partial: Partial<Booking>): Booking {
  return {
    id: 'B-1',
    operativeId: 'op-1',
    projectId: 'P-1',
    date: DAY,
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: '07:30',
    workEndTime: '16:00',
    bookedBy: 'x',
    status: 'Confirmed',
    createdAt: DAY,
    updatedAt: DAY,
    ...partial,
  } as Booking
}

const asStored = (data: Record<string, unknown>) => {
  // As Firestore hands it back: instants are Timestamps, not Dates.
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    out[key] = value instanceof Date ? { seconds: Math.floor(value.getTime() / 1000), nanoseconds: 0 } : value
  }
  return out
}

test('1.41 review #3: the store copy and the stored document give the same delete fingerprint (labour)', () => {
  const copy = createWritePayload(serializeBooking(booking({})))
  assert.equal(
    bookingDeleteFingerprint({ ...copy, collection: 'bookings' }, 'Europe/London'),
    bookingDeleteFingerprint({ ...asStored(copy), collection: 'bookings' }, 'Europe/London')
  )
})

test('1.41 review #3: a booking changed on another device has a different fingerprint', () => {
  const seen = createWritePayload(serializeBooking(booking({})))
  const live = createWritePayload(serializeBooking(booking({ workEndTime: '18:00' })))
  assert.notEqual(
    bookingDeleteFingerprint({ ...seen, collection: 'bookings' }, 'Europe/London'),
    bookingDeleteFingerprint({ ...asStored(live), collection: 'bookings' }, 'Europe/London')
  )
})

test('1.41 review #3: the store copy and the stored document give the same delete fingerprint (manager site)', () => {
  const copy = createWritePayload(serializeManagerSiteBooking({
    id: 'B33C0E70-8C0B-472D-8FC6-267002FAC471',
    userId: 'u-1',
    organizationId: 'org',
    date: DAY,
    timeSlot: 'FULL DAY',
    locationType: 'project',
    locationId: 'P-1',
    isBreakRemoved: false,
    createdAt: DAY,
    updatedAt: DAY,
  } as Parameters<typeof serializeManagerSiteBooking>[0]))
  assert.equal(
    bookingDeleteFingerprint({ ...copy, collection: 'managerSiteBookings' }, 'Europe/London'),
    bookingDeleteFingerprint({ ...asStored(copy), collection: 'managerSiteBookings' }, 'Europe/London')
  )
})

test('1.41 review #6: the wizard clash check finds a booking stored under the person\'s former id', () => {
  const clashes = detectOperativeClashes({
    operativeIds: ['op-new'],
    slots: [{ date: DAY, slot: 'FULL DAY' }],
    bookings: [booking({ id: 'B-OLD', operativeId: 'OLD-INVITE-ID', projectId: 'P-2' })],
    operatives: [{ id: 'op-new', firstName: 'Ada', lastName: 'Site', email: 'ada@example.com' } as Operative],
    projects: [{ id: 'P-2', siteName: 'Other', jobNumber: 'J2' } as Project],
    users: [{ id: 'u-ada', email: 'ada@example.com', formerUserIds: ['old-invite-id'] } as User],
    timeZone: 'Europe/London',
  })
  assert.deepEqual(clashes.map((c) => c.existingBookingId), ['B-OLD'])
})

test('1.41 review #6: without the roster only the picked id counts (unchanged)', () => {
  const clashes = detectOperativeClashes({
    operativeIds: ['op-new'],
    slots: [{ date: DAY, slot: 'FULL DAY' }],
    bookings: [booking({ id: 'B-OLD', operativeId: 'OLD-INVITE-ID', projectId: 'P-2' })],
    operatives: [{ id: 'op-new', firstName: 'Ada', lastName: 'Site', email: 'ada@example.com' } as Operative],
    projects: [{ id: 'P-2', siteName: 'Other', jobNumber: 'J2' } as Project],
    timeZone: 'Europe/London',
  })
  assert.deepEqual(clashes, [])
})

test('1.41 review #10: a booking overlapping two selected days is replaced once, on the first day', () => {
  const taken = new Set<string>()
  const night = { collection: 'bookings' as const, bookingId: 'NIGHT' }
  const other = { collection: 'bookings' as const, bookingId: 'B-2' }
  assert.deepEqual(replacesNotYetTaken([night], taken), [night])
  assert.deepEqual(replacesNotYetTaken([{ ...night, bookingId: 'night' }, other], taken), [other])
  assert.equal(replacesNotYetTaken([night], taken), undefined)
  assert.equal(replacesNotYetTaken(undefined, taken), undefined)
})
