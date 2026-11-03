import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { HolidayBooking } from '../../types/index.ts'
import { holidayToLeaveDay, userLeaveBalance } from './leaveBalance.ts'

// Mon 9 – Fri 13 Nov 2026 stored at Sydney midnight (AEDT, UTC+11): 8 Nov 13:00Z – 12 Nov 13:00Z.
function sydneyLeave(): HolidayBooking {
  return {
    id: 'h1',
    userId: 'u1',
    startDate: new Date('2026-11-08T13:00:00Z'),
    endDate: new Date('2026-11-12T13:00:00Z'),
    timeSlot: 'FULL DAY',
    status: 'approved',
  } as unknown as HolidayBooking
}

test('holidayToLeaveDay reads the days in the organisation zone, not London', () => {
  assert.deepEqual(
    { start: holidayToLeaveDay(sydneyLeave(), 'Australia/Sydney').startDayKey, end: holidayToLeaveDay(sydneyLeave(), 'Australia/Sydney').endDayKey },
    { start: '2026-11-09', end: '2026-11-13' }
  )
})

test('userLeaveBalance counts Mon–Fri leave as 5 days in a Sydney organisation', () => {
  const balance = userLeaveBalance({
    user: { annualLeaveEnabled: true } as never,
    bookings: [sydneyLeave()],
    now: new Date('2026-11-20T00:00:00Z'),
    timeZone: 'Australia/Sydney',
  })
  assert.equal(balance.taken, 5)
})
