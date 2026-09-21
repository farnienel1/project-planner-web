/**
 * iOS parity source: Core/MondayFirstCalendarSupport.swift
 * Spec: docs/ios-parity/04-business-logic.md §11
 *
 * Default zone is Europe/London. Pass the organisation origin-country IANA
 * zone (see lib/orgTime/orgTimeZone.ts) for pay periods and timesheet stamps.
 */

import {
  LONDON_TIME_ZONE,
  addDaysInZone,
  dateFromDayKeyInZone,
  datePartsInZone,
  dayKeyInZone,
  dayOfMonthInZone,
  daysInZoneMonth,
  formatLongDayInZone,
  isoWeekdayInZone,
  midnightInZone,
  partsInZone,
  unixStartOfDayInZone,
} from '@/lib/orgTime/zoneTime'

const LONDON = LONDON_TIME_ZONE

export { LONDON_TIME_ZONE }

function zone(timeZone?: string): string {
  return timeZone || LONDON
}

/** yyyy-MM-dd in the given zone (default Europe/London). */
export function dayKey(date: Date, timeZone?: string): string {
  return dayKeyInZone(date, zone(timeZone))
}

export function dateFromDayKey(key: string, timeZone?: string): Date {
  return dateFromDayKeyInZone(key, zone(timeZone))
}

/** Local midnight in the given zone as a Date (UTC instant). */
export function londonMidnight(date: Date, timeZone?: string): Date {
  return midnightInZone(date, zone(timeZone))
}

export function isSameLondonDay(a: Date, b: Date, timeZone?: string): boolean {
  return dayKey(a, timeZone) === dayKey(b, timeZone)
}

/**
 * Same-day match in the org zone (default Europe/London).
 * UTC midnight and London midnight for a UK calendar day already share a London day key.
 * Do not also match `toDateString()` — on UTC hosts that pulls in the previous local day.
 */
export function coversCalendarDay(value: Date, day: Date, timeZone?: string): boolean {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return false
  return isSameLondonDay(value, day, timeZone)
}

export function addLondonDays(date: Date, days: number, timeZone?: string): Date {
  return addDaysInZone(date, days, zone(timeZone))
}

/** Home date line: "Tuesday 16 Sep" (Blueprint §3.4). */
export function formatHomeDateLine(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zone(timeZone),
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

/** Up Next heading: "Wednesday 17th September" (HomeUpNextSupport.swift:209). */
export function dayHeadingWithOrdinal(date: Date, timeZone?: string): string {
  const { d } = partsInZone(date, zone(timeZone))
  const suffix =
    d % 100 >= 11 && d % 100 <= 13
      ? 'th'
      : d % 10 === 1
        ? 'st'
        : d % 10 === 2
          ? 'nd'
          : d % 10 === 3
            ? 'rd'
            : 'th'
  const weekday = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone(timeZone),
    weekday: 'long',
  }).format(date)
  const month = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone(timeZone),
    month: 'long',
  }).format(date)
  return `${weekday} ${d}${suffix} ${month}`
}

/** Short time like iOS `.short` in en-GB, e.g. "07:30". */
export function formatShortTime(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: zone(timeZone),
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

export function parseHhMm(value: string | undefined): number | null {
  if (!value) return null
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

export function addMinutesToDay(day: Date, minutes: number, timeZone?: string): Date {
  return new Date(londonMidnight(day, timeZone).getTime() + minutes * 60_000)
}

/** Hour in the zone (0–23). */
export function londonHour(date: Date, timeZone?: string): number {
  return partsInZone(date, zone(timeZone)).h
}

/** Minutes past midnight in the zone (0–1439). */
export function londonMinutesOfDay(date: Date, timeZone?: string): number {
  const { h, min } = partsInZone(date, zone(timeZone))
  return h * 60 + min
}

/** JS weekday in the zone: 0 = Sunday … 6 = Saturday. */
export function londonJsWeekday(date: Date, timeZone?: string): number {
  const { y, m, d } = partsInZone(date, zone(timeZone))
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay()
}

/** ISO weekday in the zone: 1 = Monday … 7 = Sunday. */
export function londonIsoWeekday(date: Date, timeZone?: string): number {
  return isoWeekdayInZone(date, zone(timeZone))
}

export function londonDayOfMonth(date: Date, timeZone?: string): number {
  return dayOfMonthInZone(date, zone(timeZone))
}

/** Last calendar day of the month containing `date` in the zone (28–31). */
export function daysInLondonMonth(date: Date, timeZone?: string): number {
  return daysInZoneMonth(date, zone(timeZone))
}

/** Monday of the week containing `date` in the zone. */
export function startOfLondonWeek(date: Date, timeZone?: string): Date {
  return addLondonDays(londonMidnight(date, timeZone), -(londonIsoWeekday(date, timeZone) - 1), timeZone)
}

/** Sunday of the week containing `date` in the zone. */
export function endOfLondonWeek(date: Date, timeZone?: string): Date {
  return addLondonDays(londonMidnight(date, timeZone), 7 - londonIsoWeekday(date, timeZone), timeZone)
}

export function unixStartOfDay(date: Date, timeZone?: string): number {
  return unixStartOfDayInZone(date, zone(timeZone))
}

export function formatLongDay(date: Date, timeZone?: string): string {
  return formatLongDayInZone(date, zone(timeZone))
}

export function londonDateParts(
  date: Date,
  timeZone?: string
): { day: number; month: number; year: number; monthName: string } {
  return datePartsInZone(date, zone(timeZone))
}
