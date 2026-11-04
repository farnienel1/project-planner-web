import { test } from 'node:test'
import assert from 'node:assert/strict'
import { londonMidnight } from '../ios-parity/londonTime.ts'
import { detectOperativeClashes, formatClashSummary } from './bookingClashUtils.ts'
import type { Booking, Operative, Project } from '../../types/index.ts'

test('a clash on a London day is not labelled as the previous UTC date', () => {
  const summary = formatClashSummary([
    {
      operativeId: 'op',
      operativeName: 'Test Operative',
      date: londonMidnight(new Date('2026-10-06T12:00:00Z')),
      newTimeSlot: 'FULL DAY',
      existingBookingId: 'b',
      existingProjectId: 'p',
      existingTimeSlot: 'FULL DAY',
      existingProjectLabel: 'C984 71 Broadwick Street',
    },
  ])
  assert.match(summary, /6 Oct 2026/)
  assert.equal(summary.includes('5 Oct'), false)
  assert.equal(summary.includes('00:00'), false)
})

test('detectOperativeClashes finds an iOS upper-case booking for a web lower-case operative id', () => {
  const day = londonMidnight(new Date('2026-10-14T12:00:00Z'))
  const existing = {
    id: 'B-IOS',
    operativeId: 'ABCD-OP-1',
    projectId: 'P-OTHER',
    date: day,
    timeSlot: 'FULL DAY',
    bookedBy: 'x',
    status: 'Confirmed',
    createdAt: day,
    updatedAt: day,
  } as Booking
  const clashes = detectOperativeClashes({
    operativeIds: ['abcd-op-1'],
    slots: [{ date: day, slot: 'FULL DAY' }],
    bookings: [existing],
    operatives: [{ id: 'abcd-op-1', firstName: 'Ada', lastName: 'Site' } as Operative],
    projects: [{ id: 'P-OTHER', siteName: 'Other', jobNumber: 'J2' } as Project],
    timeZone: 'Europe/London',
  })
  assert.deepEqual(clashes.map((c) => c.existingBookingId), ['B-IOS'])
})
