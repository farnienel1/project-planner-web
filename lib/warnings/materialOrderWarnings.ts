import {
  LONDON_TIME_ZONE,
  dateFromDayKeyInZone,
} from '@/lib/orgTime/zoneTime'
import { materialCutOffWarningRows, materialLineCountsAsOrdered } from '@/lib/canonical'
import type { Booking, MaterialSendRecord, Project, ProjectMaterialLine } from '@/types'

export type MissedMaterialOrderWarning = {
  id: string
  type: 'missed_material_order'
  title: 'Material order not placed'
  projectId: string
  projectLabel: string
  date: Date
  unorderedCount: number
  message: string
}

function sendRecordInputs(sendRecords: MaterialSendRecord[]) {
  return sendRecords.map((record) => ({
    requestType: record.requestType,
    materialIds: (record.lines || []).map((entry) => entry.materialId),
  }))
}

/** The rulebook's `materialLineCountsAsOrdered`: status `ordered`, or listed on an order send record. */
export function isMaterialLineOrdered(line: ProjectMaterialLine, sendRecords: MaterialSendRecord[]): boolean {
  return materialLineCountsAsOrdered({ id: line.id, status: line.status }, sendRecordInputs(sendRecords))
}

export type MaterialCutoffOptions = {
  enabled?: boolean
  cutOffOnSaturday?: boolean
  cutOffOnSunday?: boolean
  cutOffHour?: number
  cutOffMinute?: number
  referenceDate?: Date
  /** Organisation business zone (`organizationTimeZone(countryCode)`). */
  timeZone?: string
}

function isoOf(value: unknown): string | null {
  const date = value instanceof Date ? value : value == null ? null : new Date(value as string | number)
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null
}

/**
 * Material cut-off rows from the rulebook's `materialCutOffWarningRows`: after the organisation cut-off,
 * for jobs with an active booking tomorrow. An empty material list still warns.
 */
export function computeMissedMaterialOrderWarnings(
  materials: ProjectMaterialLine[],
  sendRecords: MaterialSendRecord[],
  projects: Project[],
  bookings: Booking[] = [],
  options: MaterialCutoffOptions = {}
): MissedMaterialOrderWarning[] {
  const timeZone = options.timeZone || LONDON_TIME_ZONE
  const rows = materialCutOffWarningRows({
    now: (options.referenceDate ?? new Date()).toISOString(),
    timeZone,
    cutOff: {
      materialOrderCutOff: options.enabled !== false,
      materialCutOffHour: options.cutOffHour,
      materialCutOffMinute: options.cutOffMinute,
      materialCutOffOnSaturday: options.cutOffOnSaturday,
      materialCutOffOnSunday: options.cutOffOnSunday,
    },
    projects: projects.map((project) => ({
      id: project.id,
      jobNumber: project.jobNumber,
      siteName: project.siteName,
    })),
    bookings: bookings.map((booking) => ({
      projectId: booking.projectId,
      status: booking.status,
      dateIso: isoOf(booking.date),
    })),
    materials: materials.map((line) => ({
      id: line.id,
      projectId: line.projectId,
      status: line.status,
      dateIso: isoOf(line.date),
    })),
    sendRecords: sendRecordInputs(sendRecords),
  })
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    projectId: row.projectId,
    projectLabel: row.projectLabel,
    date: dateFromDayKeyInZone(row.dayKey, timeZone),
    unorderedCount: row.unorderedCount,
    message: row.message,
  }))
}
