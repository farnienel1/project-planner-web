import { addDaysInZone, dateFromDayKeyInZone, dayKeyInZone, isoWeekdayInZone, LONDON_TIME_ZONE, partsInZone } from '@/lib/orgTime/zoneTime'
import type { AnalyticsDateRange } from '@/lib/analytics/dateRange'

export type ConsolePeriodId = 'today' | 'week' | 'month' | 'year' | 'to_date'

export const CONSOLE_PERIODS: { id: ConsolePeriodId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
  { id: 'to_date', label: 'To date' },
]

function startOfDay(date: Date, timeZone = LONDON_TIME_ZONE): Date {
  return dateFromDayKeyInZone(dayKeyInZone(date, timeZone), timeZone)
}

function startOfMonth(date: Date, timeZone = LONDON_TIME_ZONE): Date {
  const key = dayKeyInZone(date, timeZone)
  const [y, m] = key.split('-').map(Number)
  return dateFromDayKeyInZone(`${y}-${String(m).padStart(2, '0')}-01`, timeZone)
}

function startOfYear(date: Date, timeZone = LONDON_TIME_ZONE): Date {
  const { y } = partsInZone(date, timeZone)
  return dateFromDayKeyInZone(`${y}-01-01`, timeZone)
}

function startOfWeekMonday(date: Date, timeZone = LONDON_TIME_ZONE): Date {
  const weekday = isoWeekdayInZone(date, timeZone)
  return addDaysInZone(startOfDay(date, timeZone), 1 - weekday, timeZone)
}

function sameClockLastPeriod(now: Date, daysBack: number, timeZone = LONDON_TIME_ZONE): Date {
  const parts = partsInZone(now, timeZone)
  const shifted = addDaysInZone(startOfDay(now, timeZone), -daysBack, timeZone)
  const key = dayKeyInZone(shifted, timeZone)
  const [y, m, d] = key.split('-').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d, parts.h, parts.min, 0))
  const shown = partsInZone(guess, timeZone)
  const deltaMin = (shown.h - parts.h) * 60 + (shown.min - parts.min)
  return new Date(guess.getTime() - deltaMin * 60_000)
}

export function resolveConsolePeriod(period: ConsolePeriodId, now = new Date(), timeZone = LONDON_TIME_ZONE): AnalyticsDateRange {
  const today = startOfDay(now, timeZone)
  if (period === 'today') {
    return {
      preset: 'today',
      start: today,
      end: now,
      previousStart: addDaysInZone(today, -7, timeZone),
      previousEnd: sameClockLastPeriod(now, 7, timeZone),
      label: 'Today',
    }
  }
  if (period === 'week') {
    const start = startOfWeekMonday(now, timeZone)
    const prevStart = addDaysInZone(start, -7, timeZone)
    return {
      preset: 'last_7',
      start,
      end: now,
      previousStart: prevStart,
      previousEnd: sameClockLastPeriod(now, 7, timeZone),
      label: 'This week',
    }
  }
  if (period === 'month') {
    const start = startOfMonth(now, timeZone)
    const { d } = partsInZone(now, timeZone)
    const prevMonthEnd = addDaysInZone(start, -1, timeZone)
    const prevStart = startOfMonth(prevMonthEnd, timeZone)
    const prevDay = Math.min(d, Number(dayKeyInZone(prevMonthEnd, timeZone).slice(-2)))
    const prevKey = `${dayKeyInZone(prevStart, timeZone).slice(0, 8)}${String(prevDay).padStart(2, '0')}`
    const previousEnd = dateFromDayKeyInZone(prevKey, timeZone)
    const prevParts = partsInZone(now, timeZone)
    previousEnd.setUTCHours(previousEnd.getUTCHours() + prevParts.h, prevParts.min)
    return {
      preset: 'this_month',
      start,
      end: now,
      previousStart: prevStart,
      previousEnd,
      label: 'This month',
    }
  }
  if (period === 'year') {
    const start = startOfYear(now, timeZone)
    const key = dayKeyInZone(now, timeZone)
    const prevKey = `${Number(key.slice(0, 4)) - 1}${key.slice(4)}`
    return {
      preset: 'last_month',
      start,
      end: now,
      previousStart: startOfYear(addDaysInZone(start, -1, timeZone), timeZone),
      previousEnd: dateFromDayKeyInZone(prevKey, timeZone),
      label: 'This year',
    }
  }
  return {
    preset: 'all_time',
    start: dateFromDayKeyInZone('2018-01-01', timeZone),
    end: now,
    previousStart: dateFromDayKeyInZone('2018-01-01', timeZone),
    previousEnd: dateFromDayKeyInZone('2018-01-01', timeZone),
    label: 'To date',
  }
}

export function formatGbpFromPence(pence: number, compact = false): string {
  const pounds = Math.max(0, pence) / 100
  if (!compact) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(pounds)
  }
  if (pounds >= 1_000_000) return `£${(pounds / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  if (pounds >= 1_000) return `£${(pounds / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return `£${Math.round(pounds)}`
}

export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(Math.round(value))
}

export function deltaCopy(current: number, previous: number): { text: string; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0 && current === 0) return { text: 'No change', direction: 'flat' }
  if (previous === 0) return { text: 'No previous-period data', direction: 'flat' }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10
  if (pct === 0) return { text: 'No change', direction: 'flat' }
  const direction = pct > 0 ? 'up' : 'down'
  return { text: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs comparison`, direction }
}

/**
 * Owner console PR 1 (spec §2, audit §3): the console store downloads product events and sessions only for the page's
 * period — from the start of its comparison period — and never more than CONSOLE_EVENTS_CAP of each (newest first).
 * The console is platform-wide, so its periods are in Europe/London (resolveConsolePeriod's default, PLAN §2).
 * "To date" has no start, so it is the newest CONSOLE_EVENTS_CAP; a capped load is shown as such, never as complete.
 */
export const CONSOLE_EVENTS_CAP = 5000

/** The first instant the store must load events from for this period; null means "no lower bound" (To date). */
export function consoleEventsSince(period: ConsolePeriodId, now = new Date(), timeZone?: string): Date | null {
  if (period === 'to_date') return null
  const range = resolveConsolePeriod(period, now, timeZone)
  return range.previousStart.getTime() < range.start.getTime() ? range.previousStart : range.start
}

/** True when the loaded events cover every instant from `from` onwards (so a count over it is complete). */
export function consoleEventsCover(
  loaded: { since: Date | null; truncated: boolean } | null,
  from: Date
): boolean {
  if (!loaded || loaded.truncated) return false
  return loaded.since === null || loaded.since.getTime() <= from.getTime()
}

/** True when a load from `loadedSince` already covers what `wanted` needs (no download needed). */
export function consoleEventsLoadCovers(loadedSince: Date | null | undefined, wanted: Date | null): boolean {
  if (loadedSince === undefined) return false
  if (loadedSince === null) return true
  return wanted !== null && loadedSince.getTime() <= wanted.getTime()
}
