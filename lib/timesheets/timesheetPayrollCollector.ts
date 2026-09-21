/**
 * iOS parity: Core/TimesheetPayrollCollector.swift
 */
import type { Booking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { managerSiteBookingDisplayTitle } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { dayKey } from '@/lib/ios-parity/londonTime'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { employmentTypeOnDay, isBillableSelfEmployedDay } from '@/lib/ios-parity/employmentType'
import {
  formatTimesheetHours,
  overtimeHoursBeyondPaidStandard,
  paidBookedHours,
  scheduleLabel,
  weekdayOtMultiplier,
} from '@/lib/timesheets/timesheetHours'

export type PayrollRateBasis = 'dayRate' | 'hourly'

export type TimesheetPayrollLineItem = {
  id: string
  date: Date
  jobNumber: string
  projectName: string
  details: string
  paidHours: number
  payrollBasis: PayrollRateBasis
  dayRate: number
  hourlyRate?: number | null
  amount: number
  isPayeDay: boolean
  isOvertimeLine: boolean
}

export type TimesheetPayrollSummary = {
  totalHours: number
  overtimeHours: number
  shiftCount: number
  baseAmount: number
  overtimeAmount: number
  lineItems: TimesheetPayrollLineItem[]
  workAmount: number
}

function isDateInPeriod(date: Date, start: Date, end: Date, timeZone?: string): boolean {
  const key = dayKey(date, timeZone)
  return key >= dayKey(start, timeZone) && key <= dayKey(end, timeZone)
}

function resolveRate(user: User, operative?: Operative | null): {
  basis: PayrollRateBasis
  dayRate: number
  hourlyRate: number | null
} {
  if (user.dayRate != null && user.dayRate > 0) {
    return { basis: 'dayRate', dayRate: user.dayRate, hourlyRate: null }
  }
  if (user.hourlyRate != null && user.hourlyRate > 0) {
    return { basis: 'hourly', dayRate: 0, hourlyRate: user.hourlyRate }
  }
  if (operative?.dayRate && operative.dayRate > 0) {
    return { basis: 'dayRate', dayRate: operative.dayRate, hourlyRate: null }
  }
  if (operative?.hourlyRate && operative.hourlyRate > 0) {
    return { basis: 'hourly', dayRate: 0, hourlyRate: operative.hourlyRate }
  }
  return { basis: 'dayRate', dayRate: 0, hourlyRate: null }
}

function payForHours(
  paidHours: number,
  standardDayHours: number,
  resolved: { basis: PayrollRateBasis; dayRate: number; hourlyRate: number | null },
  otMultiplier = 1
): number {
  if (paidHours <= 0) return 0
  if (resolved.basis === 'hourly') {
    return (resolved.hourlyRate || 0) * paidHours * otMultiplier
  }
  return resolved.dayRate * (paidHours / Math.max(standardDayHours, 0.01)) * otMultiplier
}

function projectLabel(
  projectId: string | undefined,
  projects: Project[],
  smallWorks: Project[]
): { jobNumber: string; siteName: string } {
  if (!projectId) return { jobNumber: '—', siteName: 'Unknown Project' }
  const match = projects.find((row) => row.id === projectId) || smallWorks.find((row) => row.id === projectId)
  if (!match) return { jobNumber: '—', siteName: 'Unknown Project' }
  return { jobNumber: match.jobNumber || '—', siteName: match.siteName || 'Site' }
}

function managerLabels(
  booking: ManagerSiteBooking,
  projects: Project[],
  smallWorks: Project[]
): { jobNumber: string; siteName: string } {
  if (booking.locationType === 'project' || booking.locationType === 'small_work') {
    return projectLabel(booking.locationId, projects, smallWorks)
  }
  const map = new Map<string, string>()
  for (const project of [...projects, ...smallWorks]) map.set(project.id, project.siteName)
  return { jobNumber: '—', siteName: managerSiteBookingDisplayTitle(booking, map) }
}

export function timesheetRateAnnotation(line: TimesheetPayrollLineItem): string {
  if (line.isPayeDay) return 'PAYE'
  if (line.payrollBasis === 'hourly' && line.hourlyRate) return `£${line.hourlyRate.toFixed(2)}/hr`
  if (line.dayRate > 0) return `£${line.dayRate.toFixed(2)}/day`
  return 'rate not set'
}

export function timesheetHoursRateLine(line: TimesheetPayrollLineItem): string {
  return `${formatTimesheetHours(line.paidHours)}h · ${timesheetRateAnnotation(line)}`
}

export function collectTimesheetPayroll({
  user,
  bookings,
  managerSiteBookings,
  operatives,
  projects,
  smallWorks,
  periodStart,
  periodEnd,
  payrollPolicy,
  timeZone,
}: {
  user: User
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  projects: Project[]
  smallWorks: Project[]
  periodStart: Date
  periodEnd: Date
  payrollPolicy: OrgPayrollTimePolicy
  timeZone?: string
}): TimesheetPayrollSummary {
  const policy = payrollPolicy || DEFAULT_PAYROLL_POLICY
  const standardDayHours = Math.max(policy.standardPaidHours, 0.01)
  const matched = operatives.filter(
    (operative) => operative.email.trim().toLowerCase() === user.email.trim().toLowerCase()
  )
  const linked = findOperativeForUser(user, operatives)
  const operativeIds = new Set(matched.map((row) => row.id))
  if (linked) operativeIds.add(linked.id)
  const resolved = resolveRate(user, linked || matched[0])
  const lineItems: TimesheetPayrollLineItem[] = []
  let shiftCount = 0
  let totalHours = 0
  let overtimeHours = 0
  let baseAmount = 0
  let overtimeAmount = 0

  const pushBooking = (
    idPrefix: string,
    bookingId: string,
    date: Date,
    timeSlot: string,
    workStartTime: string | undefined,
    workEndTime: string | undefined,
    isBreakRemoved: boolean | undefined,
    labels: { jobNumber: string; siteName: string }
  ) => {
    if (!isDateInPeriod(date, periodStart, periodEnd, timeZone)) return
    if (!isBillableSelfEmployedDay(user, date, timeZone)) return
    const paidHours = paidBookedHours(timeSlot, workStartTime, workEndTime, policy, isBreakRemoved)
    const otHours = overtimeHoursBeyondPaidStandard(
      date,
      timeSlot,
      workStartTime,
      workEndTime,
      policy,
      isBreakRemoved
    )
    const normalHours = Math.max(0, paidHours - otHours)
    const otMultiplier = weekdayOtMultiplier(date, policy)
    shiftCount += 1
    totalHours += paidHours
    overtimeHours += otHours
    const isPaye = employmentTypeOnDay(user, date, timeZone) === 'paye'
    const dayRate = isPaye ? 0 : resolved.dayRate
    const hourlyRate = isPaye ? null : resolved.hourlyRate
    const normalAmount = isPaye ? 0 : payForHours(normalHours, standardDayHours, resolved)
    baseAmount += normalAmount
    lineItems.push({
      id: `${idPrefix}-${bookingId}-normal`,
      date,
      jobNumber: labels.jobNumber,
      projectName: labels.siteName,
      details: scheduleLabel(timeSlot, workStartTime, workEndTime, isBreakRemoved),
      paidHours: normalHours,
      payrollBasis: resolved.basis,
      dayRate,
      hourlyRate,
      amount: normalAmount,
      isPayeDay: isPaye,
      isOvertimeLine: false,
    })
    if (otHours > 0.05) {
      const otAmount = isPaye ? 0 : payForHours(otHours, standardDayHours, resolved, otMultiplier)
      overtimeAmount += otAmount
      const otDayRate = isPaye ? 0 : resolved.basis === 'dayRate' ? resolved.dayRate * otMultiplier : 0
      const otHourly = isPaye ? null : resolved.hourlyRate != null ? resolved.hourlyRate * otMultiplier : null
      lineItems.push({
        id: `${idPrefix}-${bookingId}-ot`,
        date,
        jobNumber: labels.jobNumber,
        projectName: `${labels.siteName} (Overtime)`,
        details: `OT ${formatTimesheetHours(otHours)}h`,
        paidHours: otHours,
        payrollBasis: resolved.basis,
        dayRate: otDayRate,
        hourlyRate: otHourly,
        amount: otAmount,
        isPayeDay: isPaye,
        isOvertimeLine: true,
      })
    }
  }

  for (const booking of bookings) {
    if (String(booking.status).toLowerCase() === 'cancelled') continue
    if (!booking.operativeId || !operativeIds.has(booking.operativeId)) continue
    pushBooking(
      'op',
      booking.id,
      new Date(booking.date),
      String(booking.timeSlot),
      booking.workStartTime,
      booking.workEndTime,
      booking.isBreakRemoved,
      projectLabel(booking.projectId, projects, smallWorks)
    )
  }

  for (const booking of managerSiteBookings) {
    if (booking.userId !== user.id) continue
    pushBooking(
      'mgr',
      booking.id,
      new Date(booking.date),
      String(booking.timeSlot),
      booking.workStartTime,
      booking.workEndTime,
      booking.isBreakRemoved,
      managerLabels(booking, projects, smallWorks)
    )
  }

  lineItems.sort((a, b) => {
    if (a.date.getTime() !== b.date.getTime()) return a.date.getTime() - b.date.getTime()
    if (a.isOvertimeLine !== b.isOvertimeLine) return a.isOvertimeLine ? 1 : -1
    return a.jobNumber.localeCompare(b.jobNumber)
  })

  return {
    totalHours,
    overtimeHours,
    shiftCount,
    baseAmount,
    overtimeAmount,
    lineItems,
    workAmount: baseAmount + overtimeAmount,
  }
}
