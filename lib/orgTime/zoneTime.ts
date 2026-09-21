/**
 * Calendar-day helpers in an IANA time zone.
 * Pay periods, timesheet stamps, and month length use the organisation’s
 * origin-country zone — not the phone or browser locale — so a user abroad
 * still sees the org’s working calendar.
 */

export const LONDON_TIME_ZONE = 'Europe/London'

export function partsInZone(
  date: Date,
  timeZone: string
): { y: number; m: number; d: number; h: number; min: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const map: Record<string, string> = {}
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value
  }
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    h: Number(map.hour),
    min: Number(map.minute),
  }
}

export function dayKeyInZone(date: Date, timeZone: string): string {
  const { y, m, d } = partsInZone(date, timeZone)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function midnightInZone(date: Date, timeZone: string): Date {
  const { y, m, d } = partsInZone(date, timeZone)
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
  const shown = partsInZone(guess, timeZone)
  const deltaMin = shown.h * 60 + shown.min
  return new Date(guess.getTime() - deltaMin * 60_000)
}

export function addDaysInZone(date: Date, days: number, timeZone: string): Date {
  const { y, m, d } = partsInZone(date, timeZone)
  const noon = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0))
  return midnightInZone(noon, timeZone)
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
  return midnightInZone(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)), timeZone)
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
