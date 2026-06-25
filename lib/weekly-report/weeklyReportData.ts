import { format } from 'date-fns'
import { getDayKindForBookings } from '@/lib/annualLeave/dayStatus'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { mergeProjectsAndSmallWorks } from '@/lib/projects/workStatus'
import { computeOperativeBookingClashWarnings } from '@/lib/scheduling/bookingClashUtils'
import { managerSiteBookingDisplayTitle } from '@/lib/scheduling/managerSiteBookingUtils'
import { getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import type { OrganizationDetails } from '@/lib/settings/organizationSettings'
import { computeManagerBookingClashWarnings } from '@/lib/warnings/managerClashWarnings'
import { computeUnbookedLabourWarningsForDateRange } from '@/lib/warnings/unbookedLabourWarnings'
import type { Booking, HolidayBooking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { Subcontractor } from '@/types'
import {
  computeInvoicingPeriod,
} from '@/lib/warnings/warningLookahead'
import {
  formatReportPeriodLabel,
  isDateWithinReportPeriod,
  type ReportPeriod,
} from '@/lib/weekly-report/invoicingPeriodUtils'
import {
  bookingDayUnits,
  buildPayLinesForDays,
  findUserAndOperative,
  resolveDisplayName,
  resolvePersonRole,
  resolvePersonTrade,
} from '@/lib/weekly-report/weeklyReportPayroll'

export type WeeklyReportWarningRow = {
  status: string
  priority: string
  type: string
  date: string
  description: string
  detail: string
  forPerson: string
}

export type WeeklyReportProjectRow = {
  person: string
  trade: string
  role: string
  days: number
}

export type WeeklyReportProjectGroup = {
  projectName: string
  jobNumber: string
  rows: WeeklyReportProjectRow[]
  projectTotal: number
}

export type WeeklyReportSubRow = {
  projectName: string
  jobNumber: string
  subContractor: string
  type: string
  time: string
  days: number
}

export type WeeklyReportLeaveRow = {
  person: string
  role: string
  days: number
  type: string
}

export type WeeklyReportManagerScheduleRow = {
  person: string
  role: string
  location: string
  time: string
  days: number
}

export type WeeklyReportPayPerson = {
  person: string
  role: string
  lines: { rateType: string; days: number; rate: number; pay: number }[]
  personTotal: number
}

export type WeeklyReportData = {
  organizationName: string
  companyLogoURL?: string
  reportPeriod: ReportPeriod
  invoicingPeriodLabel: string
  generatedAt: Date
  warnings: WeeklyReportWarningRow[]
  projectGroups: WeeklyReportProjectGroup[]
  allProjectWorkTotal: number
  subContractorRows: WeeklyReportSubRow[]
  subContractorTotal: number
  annualLeaveRows: WeeklyReportLeaveRow[]
  annualLeaveTotal: number
  managerScheduleRows: WeeklyReportManagerScheduleRow[]
  managerScheduleTotal: number
  paySummary: WeeklyReportPayPerson[]
  grandTotal: number
}

export type SubcontractorBookingRow = {
  id: string
  subcontractorId: string
  projectId: string
  date: Date
  timeSlot: string
  workStartTime?: string
  workEndTime?: string
}

function leaveDaysInPeriod(booking: HolidayBooking, period: ReportPeriod, standardHours: number): number {
  let days = 0
  let cursor = new Date(period.start)
  while (cursor <= period.end) {
    const kind = getDayKindForBookings(cursor, [booking])
    if (kind === 'approvedFull' || kind === 'approvedHalf') {
      days += kind === 'approvedHalf' ? 0.5 : 1
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function filterWarningsToPeriod<T extends { date: Date }>(warnings: T[], period: ReportPeriod): T[] {
  return warnings.filter((warning) => isDateWithinReportPeriod(warning.date, period))
}

export function buildWeeklyReportData({
  organizationName,
  companyLogoURL,
  period,
  bookings,
  managerSiteBookings,
  subcontractorBookings,
  subcontractors,
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
  subcontractorBookings: SubcontractorBookingRow[]
  subcontractors: Subcontractor[]
  operatives: Operative[]
  users: User[]
  projects: Project[]
  smallWorks: Project[]
  holidays: HolidayBooking[]
  orgDetails: OrganizationDetails | null
}): WeeklyReportData {
  const payroll = orgDetails?.payrollTimePolicy
  const standardHours = payroll?.standardPaidHours ?? 8
  const otMultiplier = payroll?.weekdayOutsideStandardMultiplier ?? 1.5
  const mergedWorks = mergeProjectsAndSmallWorks(projects, smallWorks)
  const projectsById = new Map<string, Project>()
  mergedWorks.forEach((project) => projectsById.set(project.id, project))

  const invoicingPeriod = orgDetails?.invoicing
    ? computeInvoicingPeriod(period.end, orgDetails.invoicing)
    : null

  const periodOperativeBookings = bookings.filter((booking) => isDateWithinReportPeriod(booking.date, period))
  const periodManagerBookings = managerSiteBookings.filter((booking) =>
    isDateWithinReportPeriod(booking.date, period)
  )
  const periodSubBookings = subcontractorBookings.filter((booking) =>
    isDateWithinReportPeriod(booking.date, period)
  )

  const projectGroupsMap = new Map<string, WeeklyReportProjectGroup>()
  const payDaysByPerson = new Map<string, number>()

  const addProjectRow = (
    projectId: string,
    userId: string | undefined,
    operativeId: string | undefined,
    days: number
  ) => {
    const project = projectsById.get(projectId)
    if (!project) return
    const { user, operative } = findUserAndOperative(users, operatives, { userId, operativeId })
    const person = resolveDisplayName(user, operative)
    const key = project.id
    const group =
      projectGroupsMap.get(key) ||
      ({
        projectName: project.siteName || project.jobNumber,
        jobNumber: project.jobNumber,
        rows: [],
        projectTotal: 0,
      } satisfies WeeklyReportProjectGroup)

    group.rows.push({
      person,
      trade: resolvePersonTrade(user, operative),
      role: resolvePersonRole(user, operative),
      days,
    })
    group.projectTotal = Math.round((group.projectTotal + days) * 100) / 100
    projectGroupsMap.set(key, group)

    const payKey = user?.id || operativeId || person
    payDaysByPerson.set(payKey, Math.round(((payDaysByPerson.get(payKey) || 0) + days) * 100) / 100)
  }

  for (const booking of periodOperativeBookings) {
    const days = bookingDayUnits(
      String(booking.timeSlot),
      booking.workStartTime,
      booking.workEndTime,
      payroll
    )
    addProjectRow(booking.projectId, undefined, booking.operativeId, days)
  }

  for (const booking of periodManagerBookings) {
    if (booking.locationType !== 'project' && booking.locationType !== 'small_work') continue
    if (!booking.locationId) continue
    const days = bookingDayUnits(
      String(booking.timeSlot),
      booking.workStartTime,
      booking.workEndTime,
      payroll
    )
    addProjectRow(booking.locationId, booking.userId, undefined, days)
  }

  const managerScheduleRows: WeeklyReportManagerScheduleRow[] = []
  let managerScheduleTotal = 0
  for (const booking of periodManagerBookings) {
    if (booking.locationType === 'project' || booking.locationType === 'small_work') continue
    const { user, operative } = findUserAndOperative(users, operatives, { userId: booking.userId })
    const days = bookingDayUnits(
      String(booking.timeSlot),
      booking.workStartTime,
      booking.workEndTime,
      payroll
    )
    const location = managerSiteBookingDisplayTitle(
      booking,
      new Map(Array.from(projectsById.entries()).map(([id, p]) => [id, p.siteName || p.jobNumber]))
    )
    managerScheduleRows.push({
      person: resolveDisplayName(user, operative),
      role: resolvePersonRole(user, operative),
      location,
      time: booking.workStartTime && booking.workEndTime
        ? `${booking.workStartTime} – ${booking.workEndTime}`
        : String(booking.timeSlot || 'Full Day'),
      days,
    })
    managerScheduleTotal += days
    const payKey = booking.userId
    payDaysByPerson.set(payKey, Math.round(((payDaysByPerson.get(payKey) || 0) + days) * 100) / 100)
  }
  managerScheduleTotal = Math.round(managerScheduleTotal * 100) / 100

  const subContractorRows: WeeklyReportSubRow[] = periodSubBookings.map((booking) => {
    const project = projectsById.get(booking.projectId)
    const sub = subcontractors.find((entry) => entry.id === booking.subcontractorId)
    const days = bookingDayUnits(
      booking.timeSlot,
      booking.workStartTime,
      booking.workEndTime,
      payroll
    )
    return {
      projectName: project?.siteName || project?.jobNumber || 'Project',
      jobNumber: project?.jobNumber || '—',
      subContractor: sub?.name || 'Sub contractor',
      type: sub?.subcontractorType || '—',
      time: booking.workStartTime && booking.workEndTime
        ? `${booking.workStartTime} – ${booking.workEndTime}`
        : booking.timeSlot,
      days,
    }
  })
  const subContractorTotal = Math.round(
    subContractorRows.reduce((sum, row) => sum + row.days, 0) * 100
  ) / 100

  const annualLeaveRows: WeeklyReportLeaveRow[] = []
  const leavePeople = new Map<string, WeeklyReportLeaveRow>()
  for (const holiday of holidays.filter((entry) => entry.status === 'approved')) {
    const days = leaveDaysInPeriod(holiday, period, standardHours)
    if (days <= 0) continue
    const user = holiday.userId ? users.find((entry) => entry.id === holiday.userId) : undefined
    const operative = holiday.operativeId
      ? operatives.find((entry) => entry.id === holiday.operativeId)
      : user
        ? findOperativeForUser(user, operatives)
        : undefined
    const displayName = resolveDisplayName(user, operative)
    const existing = leavePeople.get(displayName)
    if (existing) {
      existing.days = Math.round((existing.days + days) * 100) / 100
    } else {
      leavePeople.set(displayName, {
        person: displayName,
        role: resolvePersonRole(user, operative),
        days,
        type: 'Approved',
      })
    }
  }
  annualLeaveRows.push(...Array.from(leavePeople.values()))
  const annualLeaveTotal = Math.round(
    annualLeaveRows.reduce((sum, row) => sum + row.days, 0) * 100
  ) / 100

  const warningDetection = orgDetails?.warningDetection
  const rosterOperatives = getActiveOperativesForScheduling(operatives)
  const warnings: WeeklyReportWarningRow[] = []

  if (warningDetection?.detectClashes) {
    for (const clash of filterWarningsToPeriod(
      computeOperativeBookingClashWarnings(bookings, rosterOperatives, mergedWorks),
      period
    )) {
      warnings.push({
        status: 'Open',
        priority: 'High',
        type: 'Booking clash',
        date: format(clash.date, 'd MMM yyyy'),
        description: clash.operativeName,
        detail: clash.message,
        forPerson: clash.operativeName,
      })
    }
    for (const clash of filterWarningsToPeriod(
      computeManagerBookingClashWarnings(managerSiteBookings, users, mergedWorks),
      period
    )) {
      warnings.push({
        status: 'Open',
        priority: 'Medium',
        type: 'Manager overlap',
        date: format(clash.date, 'd MMM yyyy'),
        description: clash.personName,
        detail: clash.message,
        forPerson: clash.personName,
      })
    }
  }

  if (warningDetection) {
    for (const warning of computeUnbookedLabourWarningsForDateRange({
      bookings,
      operatives,
      users,
      holidays,
      warningDetection,
      periodStart: period.start,
      periodEnd: period.end,
    })) {
      warnings.push({
        status: 'Open',
        priority: 'Medium',
        type: 'Unbooked labour',
        date: format(warning.date, 'd MMM yyyy'),
        description: warning.operativeName,
        detail: warning.message,
        forPerson: warning.operativeName,
      })
    }
  }

  const paySummary: WeeklyReportPayPerson[] = []
  let grandTotal = 0
  for (const user of users) {
    const operative = findOperativeForUser(user, operatives)
    const key = user.id
    const days = payDaysByPerson.get(key)
    if (!days || days <= 0) continue
    const lines = buildPayLinesForDays(days, user.dayRate, user.hourlyRate, standardHours, otMultiplier)
    const personTotal = Math.round(lines.reduce((sum, line) => sum + line.pay, 0) * 100) / 100
    if (lines.length === 0) continue
    paySummary.push({
      person: resolveDisplayName(user, operative),
      role: resolvePersonRole(user, operative),
      lines,
      personTotal,
    })
    grandTotal += personTotal
  }

  for (const operative of operatives) {
    const linkedUser = users.find((user) => findOperativeForUser(user, [operative])?.id === operative.id)
    if (linkedUser) continue
    const days = payDaysByPerson.get(operative.id)
    if (!days || days <= 0) continue
    const lines = buildPayLinesForDays(days, undefined, operative.hourlyRate, standardHours, otMultiplier)
    const personTotal = Math.round(lines.reduce((sum, line) => sum + line.pay, 0) * 100) / 100
    if (lines.length === 0) continue
    paySummary.push({
      person: resolveDisplayName(undefined, operative),
      role: 'Operative',
      lines,
      personTotal,
    })
    grandTotal += personTotal
  }

  const projectGroups = Array.from(projectGroupsMap.values()).sort((a, b) =>
    a.projectName.localeCompare(b.projectName)
  )
  const allProjectWorkTotal = Math.round(
    projectGroups.reduce((sum, group) => sum + group.projectTotal, 0) * 100
  ) / 100

  return {
    organizationName,
    companyLogoURL,
    reportPeriod: period,
    invoicingPeriodLabel: invoicingPeriod
      ? formatReportPeriodLabel(invoicingPeriod.start, invoicingPeriod.end)
      : '—',
    generatedAt: new Date(),
    warnings,
    projectGroups,
    allProjectWorkTotal,
    subContractorRows,
    subContractorTotal,
    annualLeaveRows,
    annualLeaveTotal,
    managerScheduleRows,
    managerScheduleTotal,
    paySummary: paySummary.sort((a, b) => a.person.localeCompare(b.person)),
    grandTotal: Math.round(grandTotal * 100) / 100,
  }
}
