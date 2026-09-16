/**
 * iOS parity source: Core/MondayFirstCalendarSupport.swift
 * Spec: docs/ios-parity/04-business-logic.md §11
 */

const LONDON = 'Europe/London'

function partsInLondon(date: Date): { y: number; m: number; d: number; h: number; min: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const map: Record<string, string> = {}
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') map[p.type] = p.value
  }
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    h: Number(map.hour),
    min: Number(map.minute),
  }
}

/** yyyy-MM-dd in Europe/London. */
export function dayKey(date: Date): string {
  const { y, m, d } = partsInLondon(date)
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function dateFromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return londonMidnight(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)))
}

/** Local midnight Europe/London as a Date (UTC instant). */
export function londonMidnight(date: Date): Date {
  const { y, m, d } = partsInLondon(date)
  // Construct a UTC date that displays as 00:00 in London.
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
  const shown = partsInLondon(guess)
  const deltaMin =
    (shown.h * 60 + shown.min) - 0
  return new Date(guess.getTime() - deltaMin * 60_000)
}

export function isSameLondonDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b)
}

export function addLondonDays(date: Date, days: number): Date {
  const { y, m, d } = partsInLondon(date)
  const noon = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0))
  return londonMidnight(noon)
}

/** Home date line: "Tuesday 16 Sep" (Blueprint §3.4). */
export function formatHomeDateLine(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

/** Up Next heading: "Wednesday 17th September" (HomeUpNextSupport.swift:209). */
export function dayHeadingWithOrdinal(date: Date): string {
  const { d } = partsInLondon(date)
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
    timeZone: LONDON,
    weekday: 'long',
  }).format(date)
  const month = new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    month: 'long',
  }).format(date)
  return `${weekday} ${d}${suffix} ${month}`
}

/** Short time like iOS `.short` in en-GB, e.g. "07:30". */
export function formatShortTime(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
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

export function addMinutesToDay(day: Date, minutes: number): Date {
  return new Date(londonMidnight(day).getTime() + minutes * 60_000)
}
