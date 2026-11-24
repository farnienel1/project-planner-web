/**
 * Site map view helpers (display only, owner 24 Nov): where the map opens, which colour a job's dot is, and the
 * figures of the summary card under the map. Every figure comes from a rulebook output that is already worked out
 * (`siteMapPins` for people on site, the Daily Overview model — `buildDailyOverview`, priced by `payrollHoursResult` —
 * for hours and overtime, its leave rows `dailyOverviewLeaveRows` for annual leave). Nothing is priced again here.
 */

import { parseCompanyDetails } from '@/lib/canonical'
import { normalizeWorkId, type DailyOverviewModel } from '@/lib/daily-overview/buildDailyOverview'

/** The map opens on the office showing about this many miles around it. */
export const OFFICE_VIEW_RADIUS_MILES = 10

const METRES_PER_MILE = 1609.344
const METRES_PER_DEGREE_LATITUDE = 111_320

export type LatLng = { latitude: number; longitude: number }

/** The organisation's office pin (`defaultLatitude` / `defaultLongitude`, §4.1), or null when none is saved. */
export function officeCentreFromOrganization(orgDoc: unknown): LatLng | null {
  const details = parseCompanyDetails(orgDoc)
  const latitude = details.defaultLatitude
  const longitude = details.defaultLongitude
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  if (latitude === 0 && longitude === 0) return null
  return { latitude, longitude }
}

/** South-west and north-east corners of a box `miles` around a point (for `fitBounds`). */
export function radiusBounds(centre: LatLng, miles = OFFICE_VIEW_RADIUS_MILES): [[number, number], [number, number]] {
  const metres = Math.max(0, miles) * METRES_PER_MILE
  const dLat = metres / METRES_PER_DEGREE_LATITUDE
  const cos = Math.cos((centre.latitude * Math.PI) / 180)
  const dLng = metres / (METRES_PER_DEGREE_LATITUDE * Math.max(0.01, Math.abs(cos)))
  return [
    [centre.latitude - dLat, centre.longitude - dLng],
    [centre.latitude + dLat, centre.longitude + dLng],
  ]
}

/** Projects are blue dots, small works red dots. The collection decides the kind (`jobKind`, §17). */
export const SITE_MAP_DOT_COLORS = { project: '#2563eb', smallWork: '#dc2626' } as const

export type SiteMapJobSummary = {
  peopleOnSite: number
  /** Paid hours of the day's bookings on the job (Daily Overview's job line, the pay rule's `totalPaidHours`). */
  hoursOnSite: number
  /** Clock hours at a multiplier on the job (Daily Overview's `otClockHours`). */
  overtimeClockHours: number
  /** The one overtime rate on the job that day, or null when there are several (or none). */
  overtimeMultiplier: number | null
  /** People on approved annual leave that day (Daily Overview's leave list, whole team). */
  onAnnualLeave: number
}

/**
 * The summary card for one job on one day, from the Daily Overview model of that day and the job's
 * `siteMapPins` people count. A job nobody is booked on reads 0 throughout.
 */
export function siteMapJobSummary(input: {
  jobId: string
  peopleOnSite: number
  model: Pick<DailyOverviewModel, 'projectCards' | 'holidays'> | null
}): SiteMapJobSummary {
  const key = normalizeWorkId(input.jobId)
  const card = input.model?.projectCards.find((entry) => normalizeWorkId(entry.project.id) === key) ?? null
  return {
    peopleOnSite: Math.max(0, input.peopleOnSite || 0),
    hoursOnSite: card?.bookedHours ?? 0,
    overtimeClockHours: card?.overtimeClockHours ?? 0,
    overtimeMultiplier: card?.overtimeMultiplier ?? null,
    onAnnualLeave: input.model?.holidays.length ?? 0,
  }
}
