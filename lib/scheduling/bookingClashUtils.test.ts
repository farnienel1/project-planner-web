import { test } from 'node:test'
import assert from 'node:assert/strict'
import { londonMidnight } from '../ios-parity/londonTime.ts'
import { formatClashSummary } from './bookingClashUtils.ts'

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
