/**
 * Owner decision 25 Nov: after a booking is saved from a job's scheduling, the week grid opens on the Monday–Sunday
 * organisation week that holds the FIRST booked day (`organizationWeekDayKeys`, rulebook 1.35.0 §1), not the current
 * week. Several weeks booked → the week of the earliest day. The week travels on the schedule URL as `?week=YYYY-MM-DD`
 * (that week's Monday). Display / navigation only: nothing is stored.
 */
import { organizationWeekDayKeys } from '@/lib/canonical'
import { calendarDateOfKey } from '@/lib/orgTime/organizationWeek'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

export const SCHEDULE_WEEK_PARAM = 'week'

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

/** The Monday day key of the organisation week holding the earliest of `dayKeys`, or '' when none is valid. */
export function scheduleReturnWeekKey(dayKeys: ReadonlyArray<string>, timeZone?: string | null): string {
  const valid = dayKeys.map((key) => String(key || '').trim()).filter((key) => DAY_KEY.test(key)).sort()
  if (valid.length === 0) return ''
  return organizationWeekDayKeys(valid[0], organizationZoneOr(timeZone)).startDayKey
}

/** The schedule page URL that opens on the week of the earliest booked day (the base path when none). */
export function scheduleReturnHref(basePath: string, dayKeys: ReadonlyArray<string>, timeZone?: string | null): string {
  const week = scheduleReturnWeekKey(dayKeys, timeZone)
  return week ? `${basePath}?${SCHEDULE_WEEK_PARAM}=${week}` : basePath
}

/**
 * The week grid's starting Monday from the `week` URL value, as a calendar date (browser-local midnight of that
 * Monday, as the grid's other week dates), or null when the value is missing or not a day key.
 */
export function scheduleWeekFromParam(value: string | null | undefined, timeZone?: string | null): Date | null {
  const key = String(value || '').trim()
  if (!DAY_KEY.test(key)) return null
  const monday = organizationWeekDayKeys(key, organizationZoneOr(timeZone)).startDayKey
  return monday ? calendarDateOfKey(monday) : null
}
