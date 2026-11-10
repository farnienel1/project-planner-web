// Review #299 (2): a browser east of the organisation zone. Set before any Date is made.
process.env.TZ = 'Pacific/Auckland'

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bookingOnScheduleDay, scheduleColumnDate, scheduleWeekDayKeys } from './scheduleWeekDays.ts'
import { dateFromDayKeyInZone, dayKeyInZone } from '../orgTime/zoneTime.ts'
import { jobScheduleLeaveMarks } from '../canonical/index.ts'

test('1.37.0 week grid: bookings and leave share the calendar day keys in a browser east of the organisation', () => {
  // Mon 23 – Sun 29 Nov 2026 as browser-local midnights (Auckland), the way the grid builds its cells.
  const weekDays = Array.from({ length: 7 }, (_, i) => new Date(2026, 10, 23 + i))
  const dayKeys = scheduleWeekDayKeys(weekDays)
  assert.deepEqual(dayKeys, ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'])
  const zone = 'Europe/London'
  // A booking stored at London midnight of Monday 23 Nov (an Auckland Monday afternoon).
  const booking = dateFromDayKeyInZone('2026-11-23', zone)
  assert.deepEqual(dayKeys.map((key) => bookingOnScheduleDay(booking, key, zone)), [true, false, false, false, false, false, false])
  // The cell's own browser-local midnight is Sunday 22 Nov in London — the old comparison put it a day out.
  assert.notEqual(new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(weekDays[0]), '2026-11-23')
  // Leave on Monday lands on the same column.
  const [row] = jobScheduleLeaveMarks({
    people: [{ key: 'p', ids: ['u'] }],
    holidays: [{ id: 'h', userId: 'u', startDayKey: '2026-11-23', endDayKey: '2026-11-23', timeSlot: 'FULL DAY', status: 'approved' }],
    dayKeys,
    timeZone: zone,
  })
  assert.deepEqual(row.days.map((d) => d.onLeave), [true, false, false, false, false, false, false])
})

test('1.37.0 week grid: Quick add saves the column\'s organisation day in a browser east of the organisation', () => {
  const zone = 'Europe/London'
  const monday = new Date(2026, 10, 23) // the Monday cell, Auckland midnight
  // The cell itself is Sunday in London — what Quick add saved before the fix.
  assert.equal(dayKeyInZone(monday, zone), '2026-11-22')
  const saved = scheduleColumnDate(monday, zone)
  assert.equal(dayKeyInZone(saved, zone), '2026-11-23')
  assert.equal(saved.getTime(), dateFromDayKeyInZone('2026-11-23', zone).getTime())
  assert.equal(bookingOnScheduleDay(saved, '2026-11-23', zone), true)
})
