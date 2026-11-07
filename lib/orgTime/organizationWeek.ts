/**
 * Rulebook §1 (1.36.0, sweep FU-4): the Monday–Sunday organisation week for web screens, from the rulebook's
 * `organizationWeekDayKeys` (1.35.0) and `isWeekendDayKey`, in the organisation time zone — never the browser's week.
 *
 * Two kinds of Date appear on web week screens:
 * - **calendar dates**: a grid cell or a picked day, a Date at browser-local midnight whose local Y-M-D *is* the day
 *   (date-fns `format`, `addDays`, `isSameDay` work on these). The week and weekend of a calendar date are fixed by
 *   its Y-M-D, so the helpers read its local day key and ask the rulebook.
 * - **"now"**: `new Date()` is an instant; which day (and so which week) it is depends on the zone. The helpers turn
 *   it into the organisation's today first, so a browser abroad (or near midnight) opens on the organisation's week.
 *
 * Instants that are stored (a toolbox talk's week commencing) use `organizationWeekStartInstant`: organisation-zone
 * midnight of the week's Monday, as every other stored day is (rulebook §1).
 */
import { isWeekendDayKey, organizationWeekDayKeys } from '@/lib/canonical'
import { dateFromDayKeyInZone, dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

const pad = (value: number) => String(value).padStart(2, '0')

/** The local Y-M-D of a calendar date, as a day key. */
export function calendarDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Browser-local midnight of a day key (a calendar date). */
export function calendarDateOfKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** The organisation's today as a calendar date (its Y-M-D is today in the organisation zone). */
export function organizationTodayCalendarDate(timeZone?: string | null, now: Date = new Date()): Date {
  return calendarDateOfKey(dayKeyInZone(now, organizationZoneOr(timeZone)))
}

/** Monday of the organisation week containing a calendar date (`organizationWeekDayKeys`), as a calendar date. */
export function organizationCalendarWeekStart(date: Date, timeZone?: string | null): Date {
  const week = organizationWeekDayKeys(calendarDayKey(date), organizationZoneOr(timeZone))
  return week.startDayKey ? calendarDateOfKey(week.startDayKey) : date
}

/**
 * The last moment of the organisation week containing a calendar date (Sunday 23:59:59.999 local), the same bound
 * date-fns `endOfWeek` gave, so `date <= end` comparisons keep their meaning.
 */
export function organizationCalendarWeekEnd(date: Date, timeZone?: string | null): Date {
  const week = organizationWeekDayKeys(calendarDayKey(date), organizationZoneOr(timeZone))
  const sunday = week.endDayKey ? calendarDateOfKey(week.endDayKey) : date
  return new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 23, 59, 59, 999)
}

/** The organisation week containing today (in the organisation zone), as a calendar date. */
export function organizationCurrentWeekStart(timeZone?: string | null, now: Date = new Date()): Date {
  return organizationCalendarWeekStart(organizationTodayCalendarDate(timeZone, now), timeZone)
}

/** Whether a calendar date is a Saturday or Sunday (`isWeekendDayKey`). */
export function isOrganizationWeekendCalendarDate(date: Date, timeZone?: string | null): boolean {
  return isWeekendDayKey(calendarDayKey(date), organizationZoneOr(timeZone))
}

/** Organisation-zone midnight of the Monday of the week containing `instant` (for stored week-commencing values). */
export function organizationWeekStartInstant(instant: Date, timeZone?: string | null): Date {
  const zone = organizationZoneOr(timeZone)
  const week = organizationWeekDayKeys(dayKeyInZone(instant, zone), zone)
  return week.startDayKey ? dateFromDayKeyInZone(week.startDayKey, zone) : instant
}
