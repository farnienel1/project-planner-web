/**
 * Rulebook 1.23.0 §21 (audit findings 17, 21, 22): the site map, a job's tile badges and its variation sources.
 *
 * - **Site map** (`siteMapPins`): one pin per job that is not inactive (`isLive` not stored false), with the bookings
 *   on the chosen organisation day — labour bookings whose status occupies the day (`bookingOccupiesDay`; cancelled
 *   never counts) and manager schedule bookings on that job (project or small works). Before 1.23.0 web counted
 *   cancelled bookings and used the London day; iOS the device day.
 * - **Job tile badges** (`jobTileBadges`): Scheduling = the job's Tentative labour bookings (all time, as iOS shows);
 *   Tasks = the job's tasks that are not completed; Active users = people booked on the job (labour bookings not
 *   cancelled, manager schedule bookings on it), each person once under all their ids (`personIdSet` over users,
 *   `operatives` and `managers` rows — before 1.23.0 one person under two ids, or on both a labour and a manager
 *   booking, counted twice), plus subcontractor firms with an open booking (Confirmed or Tentative) on it.
 * - **Variations** (`mergeVariationSources`, `openVariationCount`): the variation list merges the `variations`
 *   collection with the older fallback documents; for one id (without case) the newer `updatedAtMs` wins and the
 *   collection row wins a tie. The open badge counts rows not deleted whose status is `open` (any case).
 *
 * Job ids compare without case. Pure, JSON in / JSON out.
 */

import { normalizeBookingStatus, isOpenBookingStatus } from './bookings'
import { holidayDocumentDayKey } from './holidayDocument'
import { isSiteLocationType, personFolder, type FoldPersonRow } from './homeOverview'
import { idKey, idText } from './personIds'
import { normalizeProjectTaskStatus } from './operationsDocuments'
import { bookingOccupiesDay } from './warningRows'

type DatedRow = { date?: unknown; dayKey?: string | null }

function rowDay(row: DatedRow, timeZone?: string | null): string {
  const given = idText(row.dayKey)
  if (/^\d{4}-\d{2}-\d{2}$/.test(given)) return given
  return holidayDocumentDayKey(row.date, timeZone)
}

export type JobBadgeLabourBooking = DatedRow & { projectId?: string | null; operativeId?: string | null; status?: string | null }
export type JobBadgeManagerBooking = DatedRow & {
  userId?: string | null
  locationId?: string | null
  locationType?: string | null
}

export type SiteMapPin = {
  jobId: string
  /** Booking rows on the day (labour that occupies the day + manager schedule bookings on the job). */
  bookingCount: number
  /** People among them, each once under all their ids. */
  peopleCount: number
}

/**
 * Rulebook 1.23.0 §21: the site map's pins for one organisation day (`dayKey`; the default is today in the
 * organisation zone, `dayKeyInOrganizationZone`), in job order. Which jobs the viewer may see is decided before
 * (`visibleJobs`); this keeps jobs that are not inactive and counts the day's bookings on each.
 */
export function siteMapPins(input: {
  jobs: ReadonlyArray<{ id: string; isLive?: boolean | null }>
  bookings?: ReadonlyArray<JobBadgeLabourBooking> | null
  managerSiteBookings?: ReadonlyArray<JobBadgeManagerBooking> | null
  dayKey: string
  timeZone?: string | null
  /** Users, `operatives` and `managers` rows, to count each person once. */
  people?: ReadonlyArray<FoldPersonRow> | null
}): SiteMapPin[] {
  const fold = personFolder(input.people || [])
  const day = idText(input.dayKey)
  const perJob = new Map<string, { rows: number; people: Set<string> }>()
  const add = (jobId: unknown, personId: unknown) => {
    const key = idKey(jobId)
    if (!key) return
    const entry = perJob.get(key) || { rows: 0, people: new Set<string>() }
    entry.rows += 1
    const person = fold(personId)
    if (person) entry.people.add(person)
    perJob.set(key, entry)
  }
  for (const booking of input.bookings || []) {
    if (!booking || !bookingOccupiesDay(booking.status) || rowDay(booking, input.timeZone) !== day) continue
    add(booking.projectId, booking.operativeId)
  }
  for (const booking of input.managerSiteBookings || []) {
    if (!booking || !isSiteLocationType(booking.locationType) || rowDay(booking, input.timeZone) !== day) continue
    add(booking.locationId, booking.userId)
  }
  return (input.jobs || [])
    .filter((job) => job && idText(job.id) && job.isLive !== false)
    .map((job) => {
      const entry = perJob.get(idKey(job.id))
      return { jobId: idText(job.id), bookingCount: entry?.rows ?? 0, peopleCount: entry?.people.size ?? 0 }
    })
}

export type JobTileBadges = {
  /** Tentative labour bookings on the job (Scheduling tile). */
  tentativeBookings: number
  /** Tasks on the job that are not completed (Tasks tile). */
  openTasks: number
  /** People and subcontractor firms booked on the job (Active users tile). */
  activeUsers: number
}

/** Rulebook 1.23.0 §21: a job's Scheduling, Tasks and Active users tile badges. */
export function jobTileBadges(input: {
  jobId: string
  bookings?: ReadonlyArray<JobBadgeLabourBooking> | null
  managerSiteBookings?: ReadonlyArray<JobBadgeManagerBooking> | null
  subcontractorBookings?: ReadonlyArray<{ projectId?: string | null; subcontractorId?: string | null; status?: string | null }> | null
  tasks?: ReadonlyArray<{ projectId?: string | null; status?: string | null }> | null
  people?: ReadonlyArray<FoldPersonRow> | null
}): JobTileBadges {
  const job = idKey(input.jobId)
  const fold = personFolder(input.people || [])
  let tentativeBookings = 0
  const people = new Set<string>()
  for (const booking of input.bookings || []) {
    if (!booking || idKey(booking.projectId) !== job || !job) continue
    const status = normalizeBookingStatus(booking.status)
    if (status === 'Tentative') tentativeBookings += 1
    if (status === 'Cancelled') continue
    const person = fold(booking.operativeId)
    if (person) people.add(person)
  }
  for (const booking of input.managerSiteBookings || []) {
    if (!booking || idKey(booking.locationId) !== job || !job || !isSiteLocationType(booking.locationType)) continue
    const person = fold(booking.userId)
    if (person) people.add(person)
  }
  const firms = new Set<string>()
  for (const booking of input.subcontractorBookings || []) {
    if (!booking || idKey(booking.projectId) !== job || !job || !isOpenBookingStatus(booking.status)) continue
    const firm = idKey(booking.subcontractorId)
    if (firm) firms.add(firm)
  }
  const openTasks = (input.tasks || []).filter(
    (task) => task && job && idKey(task.projectId) === job && normalizeProjectTaskStatus(task.status) !== 'Completed'
  ).length
  return { tentativeBookings, openTasks, activeUsers: people.size + firms.size }
}

/**
 * Rulebook 1.23.0 §22: one variation list from the `variations` collection, the iOS settings-log fallback and the
 * one-document fallbacks. Rows are keyed by id without case; for one id the newer `updatedAtMs` wins and, on a tie,
 * the later source (collection over item documents over the settings log). Order: first appearance.
 */
export function mergeVariationSources<T extends { id: string; updatedAtMs?: number | null }>(
  collectionRows: ReadonlyArray<T> | null | undefined,
  fallbackRows: ReadonlyArray<T> | null | undefined,
  itemDocs?: ReadonlyArray<T> | null
): T[] {
  const byId = new Map<string, T>()
  const ms = (row: T) => (typeof row.updatedAtMs === 'number' && Number.isFinite(row.updatedAtMs) ? row.updatedAtMs : 0)
  for (const row of [...(fallbackRows || []), ...(itemDocs || []), ...(collectionRows || [])]) {
    const key = idKey(row?.id)
    if (!key) continue
    const existing = byId.get(key)
    if (!existing || ms(row) >= ms(existing)) byId.set(key, row)
  }
  return [...byId.values()]
}

/** Rulebook 1.23.0 §22: the open-variations badge — rows not deleted whose status is `open` (any case). */
export function openVariationCount(
  rows: ReadonlyArray<{ isDeleted?: boolean | null; status?: string | null }> | null | undefined
): number {
  return (rows || []).filter((row) => row && row.isDeleted !== true && idKey(row.status) === 'open').length
}
