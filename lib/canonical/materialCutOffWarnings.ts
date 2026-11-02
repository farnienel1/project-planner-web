/**
 * Material cut-off warning rows (low priority), shared by web and iOS.
 *
 * After the organisation cut-off clock (`organizations/{orgId}.settings.materialCutOff`, read through
 * `resolveMaterialCutOffClock`) on the organisation's business day, every job with an active booking
 * tomorrow warns when tomorrow has no material lines, or when any of tomorrow's lines is not ordered.
 * A line is ordered when its status is `ordered`, or when it appears in an order send record
 * (`requestType == 'order'`). Saturday or Sunday tomorrow is skipped unless that day's cut-off flag is on.
 * The row key is `materials-{projectId}-{yyyy-MM-dd}` (tomorrow's organisation day key), so an approval
 * or removal made on either platform hides the same row.
 */

import { normalizeBookingStatus } from './bookings'
import { addDaysInZone, dayKeyInZone, isoWeekdayInZone, midnightInZone, partsInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import {
  formatMaterialCutOffClock,
  materialCutOffClockMinutes,
  resolveMaterialCutOffClock,
  type MaterialCutOffSettings,
} from './organizationSettings'
import { bookingOccupiesDay } from './warningRows'

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export type MaterialCutOffProjectInput = {
  id: string
  jobNumber?: string | null
  siteName?: string | null
}

/** One booking day. Pass `dayKey` (organisation day) or `dateIso` (an instant read in the organisation zone). */
export type MaterialCutOffBookingInput = {
  projectId: string
  status?: unknown
  dayKey?: string | null
  dateIso?: string | null
}

/** One `organizations/{orgId}/projects/{projectId}/materials` line. */
export type MaterialCutOffMaterialInput = {
  id: string
  projectId: string
  status?: string | null
  dayKey?: string | null
  dateIso?: string | null
}

/** One material send record. Only `requestType == 'order'` counts; `materialIds` are its lines' `materialId`s. */
export type MaterialCutOffSendRecordInput = {
  requestType?: string | null
  materialIds?: readonly string[] | null
  lines?: ReadonlyArray<{ materialId?: string | null }> | null
}

export type MaterialCutOffWarningInput = {
  /** The current instant: ISO string, epoch milliseconds, or Date. */
  now: string | number | Date
  /** Organisation business zone (`organizationTimeZone(countryCode)`). */
  timeZone?: string | null
  /** `organizations/{orgId}.settings.materialCutOff` (raw map or parsed). Missing → 16:00, on, weekends off. */
  cutOff?: Record<string, unknown> | MaterialCutOffSettings | null
  projects: readonly MaterialCutOffProjectInput[]
  bookings: readonly MaterialCutOffBookingInput[]
  materials: readonly MaterialCutOffMaterialInput[]
  sendRecords?: readonly MaterialCutOffSendRecordInput[] | null
}

export type MaterialCutOffWarningRow = {
  /** `materials-{projectId}-{yyyy-MM-dd}`; also the `warningResolutions` key. */
  id: string
  resolutionKey: string
  type: 'missed_material_order'
  severity: 'low'
  title: 'Material order not placed'
  projectId: string
  /** Job number, else site name, else the first 8 characters of the id. */
  jobNumber: string
  /** `{jobNumber} {siteName}` trimmed, else `jobNumber`. */
  projectLabel: string
  /** Tomorrow, the day the materials are for. */
  dayKey: string
  /** Lines still not ordered; 0 when tomorrow has no lines at all. */
  unorderedCount: number
  /** `HH:mm` organisation cut-off. */
  cutOffLabel: string
  message: string
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function instant(value: MaterialCutOffWarningInput['now']): Date {
  if (value instanceof Date) return value
  return new Date(value as string | number)
}

function dayKeyOf(row: { dayKey?: string | null; dateIso?: string | null }, timeZone: string): string {
  const key = text(row.dayKey)
  if (DAY_KEY.test(key)) return key
  const iso = text(row.dateIso)
  if (!iso) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : dayKeyInZone(date, timeZone)
}

function orderedMaterialIds(records: readonly MaterialCutOffSendRecordInput[] | null | undefined): Set<string> {
  const ids = new Set<string>()
  for (const record of records || []) {
    if (!record || text(record.requestType).toLowerCase() !== 'order') continue
    for (const id of record.materialIds || []) {
      const value = text(id)
      if (value) ids.add(value)
    }
    for (const line of record.lines || []) {
      const value = text(line?.materialId)
      if (value) ids.add(value)
    }
  }
  return ids
}

/** A material line counts as ordered when its status is `ordered` or an order send record lists it. */
export function materialLineCountsAsOrdered(
  line: Pick<MaterialCutOffMaterialInput, 'id' | 'status'>,
  sendRecords: readonly MaterialCutOffSendRecordInput[] | null | undefined
): boolean {
  if (text(line.status).toLowerCase() === 'ordered') return true
  return orderedMaterialIds(sendRecords).has(text(line.id))
}

/** Material cut-off warning rows for tomorrow. Empty before the cut-off, when off, or on a skipped weekend. */
export function materialCutOffWarningRows(input: MaterialCutOffWarningInput): MaterialCutOffWarningRow[] {
  const timeZone = zoneOrLondon(input.timeZone)
  const now = instant(input.now)
  if (Number.isNaN(now.getTime())) return []
  const clock = resolveMaterialCutOffClock({ organizationMaterialCutOff: input.cutOff ?? null })
  if (clock.materialOrderCutOff === false) return []
  const parts = partsInZone(now, timeZone)
  if (parts.h * 60 + parts.min < materialCutOffClockMinutes(clock)) return []

  const tomorrow = addDaysInZone(midnightInZone(now, timeZone), 1, timeZone)
  const weekday = isoWeekdayInZone(tomorrow, timeZone)
  if (weekday === 6 && clock.materialCutOffOnSaturday !== true) return []
  if (weekday === 7 && clock.materialCutOffOnSunday !== true) return []
  const tomorrowKey = dayKeyInZone(tomorrow, timeZone)

  const bookedProjectIds: string[] = []
  const seen = new Set<string>()
  for (const booking of input.bookings || []) {
    const projectId = text(booking?.projectId)
    if (!projectId || seen.has(projectId)) continue
    if (!bookingOccupiesDay(normalizeBookingStatus(booking.status) ?? booking.status)) continue
    if (dayKeyOf(booking, timeZone) !== tomorrowKey) continue
    seen.add(projectId)
    bookedProjectIds.push(projectId)
  }

  const projectsById = new Map((input.projects || []).map((project) => [text(project.id), project]))
  const ordered = orderedMaterialIds(input.sendRecords)
  const cutOffLabel = formatMaterialCutOffClock(clock)
  const rows: MaterialCutOffWarningRow[] = []

  for (const projectId of bookedProjectIds) {
    const project = projectsById.get(projectId)
    if (!project) continue
    const lines = (input.materials || []).filter(
      (line) => text(line.projectId) === projectId && dayKeyOf(line, timeZone) === tomorrowKey
    )
    const unordered = lines.filter((line) => text(line.status).toLowerCase() !== 'ordered' && !ordered.has(text(line.id)))
    if (lines.length > 0 && unordered.length === 0) continue

    const jobNumber = text(project.jobNumber) || text(project.siteName) || projectId.slice(0, 8)
    const message =
      lines.length === 0
        ? `No materials have been ordered for ${jobNumber} tomorrow's work (cut-off ${cutOffLabel}).`
        : `Materials for ${jobNumber} were not fully ordered by the cut-off ${cutOffLabel} for tomorrow's work (${unordered.length} line${
            unordered.length === 1 ? '' : 's'
          } still not ordered).`
    const id = `materials-${projectId}-${tomorrowKey}`
    rows.push({
      id,
      resolutionKey: id,
      type: 'missed_material_order',
      severity: 'low',
      title: 'Material order not placed',
      projectId,
      jobNumber,
      projectLabel: `${text(project.jobNumber)} ${text(project.siteName)}`.trim() || jobNumber,
      dayKey: tomorrowKey,
      unorderedCount: lines.length === 0 ? 0 : unordered.length,
      cutOffLabel,
      message,
    })
  }

  return rows.sort((a, b) => a.projectLabel.localeCompare(b.projectLabel))
}
