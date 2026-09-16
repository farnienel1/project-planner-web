import { isActiveBookingStatus } from '@/lib/ios-parity/enums'
import { addLondonDays, dayKey, londonIsoWeekday, londonMidnight, londonMinutesOfDay } from '@/lib/ios-parity/londonTime'
import { materialCutoffTimeLabel } from '@/lib/settings/orgHubUtils'
import type { Booking, MaterialSendRecord, Project, ProjectMaterialLine } from '@/types'

export type MissedMaterialOrderWarning = {
  id: string
  type: 'missed_material_order'
  projectId: string
  projectLabel: string
  date: Date
  unorderedCount: number
  message: string
}

/** Material line has been sent/ordered — not a missed order. */
export function isMaterialLineOrdered(
  line: ProjectMaterialLine,
  sendRecords: MaterialSendRecord[]
): boolean {
  const status = `${line.status || ''}`.toLowerCase()
  if (status.includes('sent') || status.includes('order')) {
    return true
  }
  return sendRecords.some(
    (record) =>
      record.requestType === 'order' &&
      record.lines.some((entry) => entry.materialId === line.id)
  )
}

export type MaterialCutoffOptions = {
  enabled?: boolean
  cutOffOnSaturday?: boolean
  cutOffOnSunday?: boolean
  cutOffHour?: number
  cutOffMinute?: number
  referenceDate?: Date
}

function cutoffMinutes(options: MaterialCutoffOptions): number {
  const hour = options.cutOffHour ?? 16
  const minute = options.cutOffMinute ?? 0
  return Math.max(0, Math.min(23, hour)) * 60 + Math.max(0, Math.min(59, minute))
}

/**
 * iOS Organisation material cut-off: after the configured London time, for projects
 * that have active bookings tomorrow. Empty material list still warns.
 */
export function computeMissedMaterialOrderWarnings(
  materials: ProjectMaterialLine[],
  sendRecords: MaterialSendRecord[],
  projects: Project[],
  bookings: Booking[] = [],
  options: MaterialCutoffOptions = {}
): MissedMaterialOrderWarning[] {
  const now = options.referenceDate ?? new Date()
  if (options.enabled === false) return []
  const cutoff = cutoffMinutes(options)
  if (londonMinutesOfDay(now) < cutoff) return []

  const today = londonMidnight(now)
  const tomorrow = addLondonDays(today, 1)
  const tomorrowIso = londonIsoWeekday(tomorrow)
  if (tomorrowIso === 6 && options.cutOffOnSaturday !== true) return []
  if (tomorrowIso === 7 && options.cutOffOnSunday !== true) return []

  const tomorrowKey = dayKey(tomorrow)
  const projectIdsWithTomorrowBookings = new Set(
    bookings
      .filter((booking) => isActiveBookingStatus(booking.status) && dayKey(booking.date) === tomorrowKey)
      .map((booking) => booking.projectId)
  )

  const projectsById = new Map(projects.map((project) => [project.id, project]))
  const warnings: MissedMaterialOrderWarning[] = []
  const cutoffLabel = materialCutoffTimeLabel(cutoff)

  for (const projectId of projectIdsWithTomorrowBookings) {
    const project = projectsById.get(projectId)
    if (!project) continue
    const tomorrowMaterials = materials.filter(
      (line) => line.projectId === projectId && dayKey(new Date(line.date)) === tomorrowKey
    )
    const unordered = tomorrowMaterials.filter((line) => !isMaterialLineOrdered(line, sendRecords))
    const needsWarning = tomorrowMaterials.length === 0 || unordered.length > 0
    if (!needsWarning) continue

    const jobNumber = project.jobNumber || project.siteName || projectId.slice(0, 8)
    const message =
      tomorrowMaterials.length === 0
        ? `No materials have been ordered for ${jobNumber} tomorrow's work (cut-off ${cutoffLabel}).`
        : `Materials for ${jobNumber} were not fully ordered by ${cutoffLabel} for tomorrow's work (${unordered.length} line${
            unordered.length === 1 ? '' : 's'
          } still not ordered).`

    warnings.push({
      id: `materials-${projectId}-${tomorrowKey}`,
      type: 'missed_material_order',
      projectId,
      projectLabel: `${project.jobNumber} ${project.siteName}`.trim() || jobNumber,
      date: tomorrow,
      unorderedCount: tomorrowMaterials.length === 0 ? 0 : unordered.length,
      message,
    })
  }

  return warnings.sort((a, b) => a.projectLabel.localeCompare(b.projectLabel))
}
