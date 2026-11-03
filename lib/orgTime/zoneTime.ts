/**
 * Calendar-day helpers in an IANA time zone.
 * Pay periods, timesheet stamps, and month length use the organisation’s
 * origin-country zone — not the phone or browser locale — so a user abroad
 * still sees the org’s working calendar.
 */

export const LONDON_TIME_ZONE = 'Europe/London'

export type ZoneParts = { y: number; m: number; d: number; h: number; min: number }

// Constructing an Intl.DateTimeFormat costs far more than formatting with one.
// Pay-period and coverage maths call partsInZone thousands of times per render,
// so formatters are kept per zone and recent results are memoised per instant.
const partsFormatters = new Map<string, Intl.DateTimeFormat>()
const partsMemo = new Map<string, ZoneParts>()
const PARTS_MEMO_LIMIT = 4_096

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsFormatters.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    partsFormatters.set(timeZone, fmt)
  }
  return fmt
}

export function partsInZone(date: Date, timeZone: string): ZoneParts {
  const memoKey = `${timeZone}|${date.getTime()}`
  const cached = partsMemo.get(memoKey)
  if (cached) return cached
  const map: Record<string, string> = {}
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  const parts: ZoneParts = {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    h: Number(map.hour),
    min: Number(map.minute),
  }
  if (partsMemo.size >= PARTS_MEMO_LIMIT) {
    partsMemo.delete(partsMemo.keys().next().value as string)
  }
  partsMemo.set(memoKey, parts)
  return parts
}

export function dayKeyInZone(date: Date, timeZone: string): string {
  const { y, m, d } = partsInZone(date, timeZone)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Offset of `timeZone` from UTC at `instant`, in milliseconds (local wall clock minus UTC), to the minute.
 */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const floored = Math.floor(instantMs / 60_000) * 60_000
  const p = partsInZone(new Date(floored), timeZone)
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - floored
}

/**
 * Rulebook 1.12.0: the first instant of the calendar day `y-m-d` in `timeZone`. Works out the zone offset at that
 * local midnight directly (two passes, so a DST change on the day is respected) instead of starting from UTC noon,
 * which in a zone at UTC+12 or later (Pacific/Auckland, Pacific/Kiritimati, Pacific/Chatham) is already the next
 * local day. When a DST change skips midnight itself, the first instant of that day is returned.
 */
function localMidnightMs(y: number, m: number, d: number, timeZone: string): number {
  const wall = Date.UTC(y, m - 1, d, 0, 0, 0)
  const dayOf = (ms: number) => {
    const p = partsInZone(new Date(ms), timeZone)
    return Date.UTC(p.y, p.m - 1, p.d)
  }
  const first = wall - zoneOffsetMs(wall, timeZone)
  const second = wall - zoneOffsetMs(first, timeZone)
  if (dayOf(second) === wall) return second
  // Midnight skipped by a DST change: the other offset gives the first instant of the day.
  const third = wall - zoneOffsetMs(second, timeZone)
  return dayOf(third) === wall ? third : second
}

export function midnightInZone(date: Date, timeZone: string): Date {
  const { y, m, d } = partsInZone(date, timeZone)
  return new Date(localMidnightMs(y, m, d, timeZone))
}

export function addDaysInZone(date: Date, days: number, timeZone: string): Date {
  const { y, m, d } = partsInZone(date, timeZone)
  // Calendar arithmetic on the local date (UTC fields only, never an instant), then that day's local midnight.
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return new Date(localMidnightMs(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), timeZone))
}

export function daysInZoneMonth(date: Date, timeZone: string): number {
  const { y, m } = partsInZone(date, timeZone)
  return new Date(Date.UTC(y, m, 0, 12, 0, 0)).getUTCDate()
}

export function isoWeekdayInZone(date: Date, timeZone: string): number {
  const { y, m, d } = partsInZone(date, timeZone)
  const js = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay()
  return js === 0 ? 7 : js
}

export function dayOfMonthInZone(date: Date, timeZone: string): number {
  return partsInZone(date, timeZone).d
}

export function dateFromDayKeyInZone(key: string, timeZone: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  // Normalise an out-of-range day (e.g. 2026-02-31) the way Date.UTC does, then that day's local midnight.
  const day = new Date(Date.UTC(y, m - 1, d))
  if (Number.isNaN(day.getTime())) return new Date(NaN)
  return new Date(localMidnightMs(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), timeZone))
}

/** Unix seconds of local midnight in `timeZone` — iOS timesheet_{uid}_{stamp}. */
export function unixStartOfDayInZone(date: Date, timeZone: string): number {
  return Math.floor(midnightInZone(date, timeZone).getTime() / 1000)
}

export function formatLongDayInZone(date: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return fmt.format(date)
}

export function formatAbbreviatedDayInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

export function formatStampInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function datePartsInZone(
  date: Date,
  timeZone: string
): { day: number; month: number; year: number; monthName: string } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const map: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  return {
    day: Number(map.day),
    month: Number(new Intl.DateTimeFormat('en-GB', { timeZone, month: 'numeric' }).format(date)),
    year: Number(map.year),
    monthName: map.month,
  }
}
