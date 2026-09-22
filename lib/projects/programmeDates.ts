import { dayKeyInZone, LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'

function utcDayFromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
}

/** Whole calendar days from `from` to `to` in `timeZone`. Positive = `to` is in the future. */
export function calendarDayOffset(to: Date, from = new Date(), timeZone = LONDON_TIME_ZONE): number {
  const start = utcDayFromKey(dayKeyInZone(from, timeZone)).getTime()
  const end = utcDayFromKey(dayKeyInZone(to, timeZone)).getTime()
  return Math.round((end - start) / 86_400_000)
}

/**
 * Programme progress across inclusive calendar days.
 * Start day = 0%. End day (and after) = 100%. Same-day programmes snap to 100% once live.
 */
export function programmeProgressPercent(
  startDate: Date,
  endDate: Date,
  now = new Date(),
  timeZone = LONDON_TIME_ZONE
): number {
  const elapsed = -calendarDayOffset(startDate, now, timeZone)
  const span = calendarDayOffset(endDate, startDate, timeZone)
  if (span <= 0) return elapsed >= 0 ? 100 : 0
  if (elapsed <= 0) return 0
  if (elapsed >= span) return 100
  return Math.round((elapsed / span) * 100)
}
