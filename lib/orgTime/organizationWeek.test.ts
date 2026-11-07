import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calendarDayKey,
  isOrganizationWeekendCalendarDate,
  organizationCalendarWeekEnd,
  organizationCalendarWeekStart,
  organizationCurrentWeekStart,
  organizationTodayCalendarDate,
  organizationWeekStartInstant,
} from './organizationWeek.ts'
import { setQuickSelectWeekdays, calendarGridDays } from '../scheduling/scheduleUtils.ts'

test('1.36.0 FU-4: the organisation week of a calendar date runs Monday to Sunday', () => {
  const wed = new Date(2026, 10, 11) // Wednesday 11 Nov 2026
  assert.equal(calendarDayKey(organizationCalendarWeekStart(wed, 'Europe/London')), '2026-11-09')
  const end = organizationCalendarWeekEnd(wed, 'Europe/London')
  assert.equal(calendarDayKey(end), '2026-11-15')
  assert.equal(end.getHours(), 23)
  assert.equal(isOrganizationWeekendCalendarDate(new Date(2026, 10, 14), 'Europe/London'), true)
  assert.equal(isOrganizationWeekendCalendarDate(new Date(2026, 10, 13), 'Europe/London'), false)
})

test("1.36.0 FU-4: 'now' is the organisation's today, not the browser's", () => {
  // 23:30 UTC on Sunday 8 Nov is already Monday 9 Nov in Auckland: the organisation's week is the new one.
  const now = new Date('2026-11-08T23:30:00Z')
  assert.equal(calendarDayKey(organizationTodayCalendarDate('Pacific/Auckland', now)), '2026-11-09')
  assert.equal(calendarDayKey(organizationTodayCalendarDate('Europe/London', now)), '2026-11-08')
  assert.equal(calendarDayKey(organizationCurrentWeekStart('Europe/London', now)), '2026-11-02')
  assert.equal(calendarDayKey(organizationCurrentWeekStart('Pacific/Auckland', now)), '2026-11-09')
})

test('1.36.0 FU-4: a stored week commencing is organisation-zone midnight of the Monday', () => {
  const instant = organizationWeekStartInstant(new Date('2026-11-12T10:00:00Z'), 'Europe/London')
  assert.equal(instant.toISOString(), '2026-11-09T00:00:00.000Z')
  const summer = organizationWeekStartInstant(new Date('2026-07-15T10:00:00Z'), 'Europe/London')
  assert.equal(summer.toISOString(), '2026-07-12T23:00:00.000Z') // Monday 13 Jul 00:00 BST
})

test('1.36.0 FU-4: quick select counts working days from the organisation today it is given', () => {
  const weekend = (date: Date) => isOrganizationWeekendCalendarDate(date, 'Europe/London')
  const picked = Array.from(setQuickSelectWeekdays(3, weekend, new Date(2026, 10, 13)).values()).map((slot) =>
    calendarDayKey(slot.date)
  )
  assert.deepEqual(picked, ['2026-11-13', '2026-11-16', '2026-11-17'])
})

test('1.36.0 FU-4: the month grid starts on a Monday and ends on a Sunday', () => {
  const days = calendarGridDays(new Date(2026, 10, 1))
  assert.equal(calendarDayKey(days[0]), '2026-10-26')
  assert.equal(calendarDayKey(days[days.length - 1]), '2026-12-06')
  assert.equal(days.length % 7, 0)
})
