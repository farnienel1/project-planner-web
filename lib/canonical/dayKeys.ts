/**
 * Day-key helpers shared by the canonical warning rules.
 * Plain date arithmetic in the organisation time zone. No business rules live here.
 */

import {
  LONDON_TIME_ZONE,
  addDaysInZone,
  dateFromDayKeyInZone,
  dayKeyInZone,
  isoWeekdayInZone,
} from '../orgTime/zoneTime'

export function zoneOrLondon(timeZone?: string | null): string {
  const value = String(timeZone || '').trim()
  return value || LONDON_TIME_ZONE
}

/** Inclusive list of day keys, capped so a bad range cannot loop forever. */
export function eachDayKey(startKey: string, endKey: string, timeZone: string, cap = 400): string[] {
  if (!startKey || !endKey || startKey > endKey) return []
  const keys: string[] = []
  let cursor = dateFromDayKeyInZone(startKey, timeZone)
  while (dayKeyInZone(cursor, timeZone) <= endKey) {
    keys.push(dayKeyInZone(cursor, timeZone))
    cursor = addDaysInZone(cursor, 1, timeZone)
    if (keys.length > cap) break
  }
  return keys
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a day key. */
export function isoWeekdayOfDayKey(dayKey: string, timeZone: string): number {
  return isoWeekdayInZone(dateFromDayKeyInZone(dayKey, timeZone), timeZone)
}

/** "Monday 12 October" in the organisation time zone. */
export function formatLongDayKey(dayKey: string, timeZone: string): string {
  const date = dateFromDayKeyInZone(dayKey, timeZone)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}
