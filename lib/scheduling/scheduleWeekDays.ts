/**
 * Rulebook 1.37.0 (review #299, 2): the day keys of a job's scheduling week and which day a stored booking falls on.
 * Grid cells are calendar dates (browser-local midnight whose local Y-M-D is the day, `calendarDayKey`); a booking's
 * `date` is an instant read in the organisation zone (`dayKeyInZone`, rulebook §1). Bookings and leave marks are both
 * bucketed by these day keys, so they stay on the same column whatever the browser's zone — before 1.37.0 the grid
 * compared a booking with the cell's browser-local midnight, one day out for a browser east of the organisation.
 */
import { calendarDayKey } from '@/lib/orgTime/organizationWeek'
import { dateFromDayKeyInZone, dayKeyInZone } from '@/lib/orgTime/zoneTime'

export function scheduleWeekDayKeys(weekDays: ReadonlyArray<Date>): string[] {
  return weekDays.map((day) => calendarDayKey(day))
}

/** Whether a stored booking instant is on `dayKey` in the organisation zone. */
export function bookingOnScheduleDay(date: Date | string | number, dayKey: string, timeZone: string): boolean {
  const instant = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(instant.getTime())) return false
  return dayKeyInZone(instant, timeZone) === dayKey
}

/**
 * The stored date for a booking made on a grid column (Quick add): organisation-zone midnight of the column's
 * calendar day, as every stored day is (rulebook §1). Never the cell's browser-local midnight, which is the previous
 * organisation day for a browser east of the organisation (review #299).
 */
export function scheduleColumnDate(day: Date, timeZone: string): Date {
  return dateFromDayKeyInZone(calendarDayKey(day), timeZone)
}
