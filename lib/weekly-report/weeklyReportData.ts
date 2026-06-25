import { format } from 'date-fns'
import { computeOperativeBookingClashWarnings } from '@/lib/scheduling/bookingClashUtils'
import { buildOrgScheduleBookings, buildPeopleNameMap } from '@/lib/scheduling/scheduleBookingMerge'
import { getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import type { OrganizationDetails } from '@/lib/settings/organizationSettings'
import { computeManagerBookingClashWarnings } from '@/lib/warnings/managerClashWarnings'
import { computeUnbookedLabourWarningsForDateRange } from '@/lib/warnings/unbookedLabourWarnings'
import type { OperativeBookingClashWarning } from '@/lib/scheduling/bookingClashUtils'
import type { ManagerBookingClashWarning } from '@/lib/warnings/managerClashWarnings'
import type { UnbookedLabourWarning } from '@/lib/warnings/unbookedLabourWarnings'
import type { Booking, HolidayBooking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import {
  eachDayInReportPeriod,
  isDateWithinReportPeriod,
  type ReportPeriod,
} from '@/lib/weekly-report/invoicingPeriodUtils'

export type WeeklyReportBookingRow = {
  id: string
  date: Date
  personName: string
  personKind: 'operative' | 'manager'
  projectLabel: string
  timeSlot: string
  timeRange?: string
  status: string
  source: 'operative' | 'manager'
}

export type WeeklyReportDayGroup = {
  date: Date
  label: string
  bookings: WeeklyReportBookingRow[]
}

export type WeeklyReportPersonSummary = {
  key: string
  name: string
  kind: 'operative' | 'manager'
  bookingCount: number
  projectLabels: string[]
}

export type WeeklyReportProjectSummary = {
  projectId: string
  label: string
  bookingCount: number
  peopleCount: number
}

export type WeeklyReportData = {
  organizationName: string
  companyLogoURL?: string
  period: ReportPeriod
  generatedAt: Date
  invoicingDescription?: string
  stats: {
    totalBookings: number
    operativeBookings: number
    managerBookings: number
    peopleBooked: number
    projectsUsed: number
    operativeClashes: number
    managerOverlaps: number
    unbookedLabour: number
  }
  dayGroups: WeeklyReportDayGroup[]
  people: WeeklyReportPersonSummary[]
  projects: WeeklyReportProjectSummary[]
  operativeClashes: OperativeBookingClashWarning[]
  managerClashes: ManagerBookingClashWarning[]
  unbookedWarnings: UnbookedLabourWarning[]
}

function formatTimeSlot(booking: Booking): string {
  const slot = String(booking.timeSlot || 'FULL DAY')
  if (slot === 'CUSTOM_HOURS' && booking.workStartTime && booking.workEndTime) {
    return `${booking.workStartTime} – ${booking.workEndTime}`
  }
  return slot.replace(/_/g, ' ')
}

function filterWarningsToPeriod<T extends { date: Date }>(warnings: T[], period: ReportPeriod): T[] {
  return warnings.filter((warning) => isDateWithinReportPeriod(warning.date, period))
}

function projectLabelForBooking(
  booking: Booking,
  projectsById: Map<string, string>
): string {
  if (booking.displayTitle?.trim()) return booking.displayTitle.trim()
  return projectsById.get(booking.projectId) || booking.projectId
}

export function buildWeeklyReportData({
  organizationName,
  companyLogoURL,
  period,
  bookings,
  managerSiteBookings,
  operatives,
  users,
  projects,
  smallWorks,
  holidays,
  orgDetails,
}: {
  organizationName: string
  companyLogoURL?: string
  period: ReportPeriod
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  users: User[]
  projects: Project[]
  smallWorks: Project[]
  holidays: HolidayBooking[]
  orgDetails: OrganizationDetails | null
}): WeeklyReportData {
  const mergedWorks = mergeProjectsAndSmallWorks(projects, smallWorks)
  const projectsById = new Map<string, string>()
  mergedWorks.forEach((project) => {
    projectsById.set(project.id, project.siteName || project.jobNumber || project.id)
  })

  const peopleById = buildPeopleNameMap(operatives, users)
  const allBookings = buildOrgScheduleBookings(bookings, managerSiteBookings, projectsById)
  const periodBookings = allBookings.filter((booking) => isDateWithinReportPeriod(booking.date, period))

  const bookingRows: WeeklyReportBookingRow[] = periodBookings.map((booking) => {
    const isManager = booking.source === 'manager'
    const personName = isManager
      ? peopleById.get(booking.bookedBy) || 'Manager'
      : peopleById.get(booking.operativeId) || 'Operative'

    return {
      id: booking.id,
      date: booking.date,
      personName,
      personKind: isManager ? 'manager' : 'operative',
      projectLabel: projectLabelForBooking(booking, projectsById),
      timeSlot: String(booking.timeSlot || 'FULL DAY'),
      timeRange: formatTimeSlot(booking),
      status: String(booking.status || 'confirmed'),
      source: isManager ? 'manager' : 'operative',
    }
  })

  const dayGroups: WeeklyReportDayGroup[] = eachDayInReportPeriod(period).map((date) => {
    const dayBookings = bookingRows
      .filter((row) => isDateWithinReportPeriod(row.date, { start: date, end: date, label: '' }))
      .sort((a, b) => a.personName.localeCompare(b.personName))
    return {
      date,
      label: format(date, 'EEEE d MMMM yyyy'),
      bookings: dayBookings,
    }
  })

  const peopleMap = new Map<string, WeeklyReportPersonSummary>()
  for (const row of bookingRows) {
    const key = `${row.personKind}:${row.personName}`
    const existing = peopleMap.get(key) || {
      key,
      name: row.personName,
      kind: row.personKind,
      bookingCount: 0,
      projectLabels: [],
    }
    existing.bookingCount += 1
    if (!existing.projectLabels.includes(row.projectLabel)) {
      existing.projectLabels.push(row.projectLabel)
    }
    peopleMap.set(key, existing)
  }

  const projectMap = new Map<string, { label: string; bookings: WeeklyReportBookingRow[] }>()
  for (const row of bookingRows) {
    const projectKey = row.projectLabel
    const existing = projectMap.get(projectKey) || { label: projectKey, bookings: [] }
    existing.bookings.push(row)
    projectMap.set(projectKey, existing)
  }

  const projectsSummary: WeeklyReportProjectSummary[] = Array.from(projectMap.entries())
    .map(([projectId, entry]) => ({
      projectId,
      label: entry.label,
      bookingCount: entry.bookings.length,
      peopleCount: new Set(entry.bookings.map((row) => row.personName)).size,
    }))
    .sort((a, b) => b.bookingCount - a.bookingCount || a.label.localeCompare(b.label))

  const warningDetection = orgDetails?.warningDetection
  const rosterOperatives = getActiveOperativesForScheduling(operatives)

  const operativeClashes = warningDetection?.detectClashes
    ? filterWarningsToPeriod(
        computeOperativeBookingClashWarnings(bookings, rosterOperatives, mergedWorks),
        period
      )
    : []

  const managerClashes = warningDetection?.detectClashes
    ? filterWarningsToPeriod(
        computeManagerBookingClashWarnings(managerSiteBookings, users, mergedWorks),
        period
      )
    : []

  const unbookedWarnings =
    warningDetection
      ? computeUnbookedLabourWarningsForDateRange({
          bookings,
          operatives,
          users,
          holidays,
          warningDetection,
          periodStart: period.start,
          periodEnd: period.end,
        })
      : []

  const operativeBookingCount = bookingRows.filter((row) => row.source === 'operative').length
  const managerBookingCount = bookingRows.filter((row) => row.source === 'manager').length

  return {
    organizationName,
    companyLogoURL,
    period,
    generatedAt: new Date(),
    stats: {
      totalBookings: bookingRows.length,
      operativeBookings: operativeBookingCount,
      managerBookings: managerBookingCount,
      peopleBooked: peopleMap.size,
      projectsUsed: projectsSummary.length,
      operativeClashes: operativeClashes.length,
      managerOverlaps: managerClashes.length,
      unbookedLabour: unbookedWarnings.length,
    },
    dayGroups,
    people: Array.from(peopleMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    projects: projectsSummary,
    operativeClashes,
    managerClashes,
    unbookedWarnings,
  }
}
