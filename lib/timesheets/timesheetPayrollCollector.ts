/**
 * iOS parity: Core/TimesheetPayrollCollector.swift
 */
import type { PayrollTimePolicyScheduledChange } from '@/lib/canonical'
import type { Booking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { managerSiteBookingDisplayTitle } from '@/lib/scheduling/managerSiteBookingUtils'
import {
  DEFAULT_MY_SCHEDULE,
  DEFAULT_PAYROLL_POLICY,
  includesManagerScheduleLocation,
  orgPayrollPolicyForDay,
  type MyScheduleOptions,
  type OrgPayrollTimePolicy,
} from '@/lib/settings/organizationSettings'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { bookingIdsForAccount, bookingOccupiesDay, formatMoney, overlappingBookingIds } from '@/lib/canonical'
import { employmentTypeOnDay } from '@/lib/ios-parity/employmentType'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import {
  overtimeDisplayRates,
  payForHours,
  payrollRateHasValue,
  resolveForTimesheetDay,
  type PayrollRateBasis,
} from '@/lib/timesheets/payrollRateResolver'
import { isClockSpanLabel, orgDayHours, payLineDisplay, quantityText } from '@/lib/timesheets/payBasis'
import { bookingHoursOnDay, formatTimesheetHours, scheduleLabel } from '@/lib/timesheets/timesheetHours'
import { dayKey } from '@/lib/ios-parity/londonTime'

export type { PayrollRateBasis }

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
  standardDayHours?: number
  otMultiplier?: number | null
  amount: number
  isPayeDay: boolean
  isOvertimeLine: boolean
  hasRate: boolean
  /** The booking (operative or manager) this line comes from. */
  bookingId?: string
  dayKey?: string
  /**
   * `overlappingBookingIds`: this booking overlaps another on the same day. Every booking is
   * still paid; the line is shown amber so the person and their manager can check it.
   */
  isOverlapping?: boolean
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

export function timesheetRateAnnotation(line: TimesheetPayrollLineItem, currencyCode?: string): string {
  if (line.isPayeDay) return 'PAYE'
  if (!line.hasRate) return 'rate not set'
  if (line.payrollBasis === 'hourly') return `${formatMoney(line.hourlyRate ?? 0, currencyCode)}/hr`
  return `${formatMoney(line.dayRate, currencyCode)}/day`
}

export function timesheetHoursRateLine(line: TimesheetPayrollLineItem, currencyCode?: string): string {
  const standard = line.standardDayHours && line.standardDayHours > 0 ? line.standardDayHours : orgDayHours(8)
  if (line.isPayeDay) return `${quantityText(line.paidHours, 'hours')} = ${formatMoney(0, currencyCode)}`
  const hourly = line.payrollBasis === 'hourly'
  const rate = !line.hasRate ? null : hourly ? (line.hourlyRate ?? 0) : line.dayRate
  return payLineDisplay({
    payBasis: hourly ? 'hourly' : 'day',
    paidHours: line.paidHours,
    standardDayHours: standard,
    rate,
    pay: line.amount,
    isOvertime: line.isOvertimeLine,
    otMultiplier: line.otMultiplier ?? null,
    currencyCode,
  }).equation
}

/** Clock span may sit beside the equation. A slot name such as FULL DAY is not the quantity. */
export function timesheetLabourDetails(line: TimesheetPayrollLineItem, currencyCode?: string): string {
  const equation = timesheetHoursRateLine(line, currencyCode)
  if (isClockSpanLabel(line.details)) return `${line.details} · ${equation}`
  return equation
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
  payrollPolicyPrior = null,
  payrollPolicyEffectiveFrom = null,
  payrollPolicyScheduled = null,
  timeZone,
  history = emptyDayRateHistory(),
  scheduleOptions = DEFAULT_MY_SCHEDULE,
  aliasUserIds = [],
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
  payrollPolicyPrior?: OrgPayrollTimePolicy | null
  payrollPolicyEffectiveFrom?: string | null
  /** A pending working-hours change; counts from its effectiveFrom day (`effectivePayrollTimePolicy`). */
  payrollPolicyScheduled?: PayrollTimePolicyScheduledChange | null
  timeZone?: string
  history?: OperativeDayRateHistoryCollection
  scheduleOptions?: MyScheduleOptions
  aliasUserIds?: string[]
}): TimesheetPayrollSummary {
  const currentPolicy = payrollPolicy || DEFAULT_PAYROLL_POLICY
  const matched = operatives.filter(
    (operative) => operative.email.trim().toLowerCase() === user.email.trim().toLowerCase()
  )
  const linked = findOperativeForUser(user, operatives)
  // Catalogue rows on this email, the account id, former invite ids and same-email aliases (web #189).
  const operativeIds = new Set(
    bookingIdsForAccount(
      { id: user.id, email: user.email, formerIds: user.formerUserIds ?? [], aliasIds: aliasUserIds },
      operatives
    ).map((id) => id.toLowerCase())
  )
  if (linked) operativeIds.add(linked.id.toLowerCase())
  const lineItems: TimesheetPayrollLineItem[] = []
  let shiftCount = 0
  let totalHours = 0
  let overtimeHours = 0
  let baseAmount = 0
  let overtimeAmount = 0
  const paidBookings: Array<{
    id: string
    dayKey: string
    timeSlot: string
    workStartTime?: string
    workEndTime?: string
  }> = []

  const pushBooking = (
    idPrefix: string,
    bookingId: string,
    date: Date,
    timeSlot: string,
    workStartTime: string | undefined,
    workEndTime: string | undefined,
    isBreakRemoved: boolean | undefined,
    labels: { jobNumber: string; siteName: string },
    operative?: Operative | null,
    otMultiplierOverride?: number | null
  ) => {
    if (!isDateInPeriod(date, periodStart, periodEnd, timeZone)) return
    const policy = orgPayrollPolicyForDay(
      date,
      currentPolicy,
      payrollPolicyPrior,
      payrollPolicyEffectiveFrom,
      timeZone,
      payrollPolicyScheduled
    )
    const standardDayHours = orgDayHours(policy.standardPaidHours)
    // One rulebook result (`payrollHoursResult`), the same figures the iOS collector uses.
    const hours = bookingHoursOnDay(date, timeSlot, workStartTime, workEndTime, policy, isBreakRemoved, otMultiplierOverride)
    const paidHours = hours.totalPaidHours
    const otHours = hours.outsideHours
    const normalHours = Math.max(0, hours.standardHours)
    const otMultiplier = hours.outsideMultiplier
    const resolved = resolveForTimesheetDay({
      user,
      operative: operative || linked || matched[0],
      day: date,
      history,
      standardDayHours,
      timeZone,
      aliasUserIds,
    })
    const hasRate = payrollRateHasValue(resolved)
    shiftCount += 1
    totalHours += paidHours
    overtimeHours += otHours
    const isPaye = employmentTypeOnDay(user, date, timeZone) === 'paye'
    const lineBookingId = `${idPrefix}-${bookingId}`
    const lineDayKey = dayKey(date, timeZone)
    paidBookings.push({ id: lineBookingId, dayKey: lineDayKey, timeSlot, workStartTime, workEndTime })
    const normalAmount = payForHours(resolved, normalHours, standardDayHours)
    baseAmount += normalAmount
    lineItems.push({
      id: `${idPrefix}-${bookingId}-normal`,
      date,
      jobNumber: labels.jobNumber,
      projectName: labels.siteName,
      details: scheduleLabel(timeSlot, workStartTime, workEndTime, isBreakRemoved),
      paidHours: normalHours,
      payrollBasis: resolved.basis,
      dayRate: resolved.dayRate ?? 0,
      hourlyRate: resolved.hourlyRate,
      standardDayHours,
      amount: normalAmount,
      isPayeDay: isPaye,
      isOvertimeLine: false,
      hasRate,
      bookingId: lineBookingId,
      dayKey: lineDayKey,
    })
    if (otHours > 0.05) {
      const otAmount = payForHours(resolved, otHours, standardDayHours, otMultiplier)
      overtimeAmount += otAmount
      const otRates = overtimeDisplayRates(resolved, otMultiplier)
      lineItems.push({
        id: `${idPrefix}-${bookingId}-ot`,
        date,
        jobNumber: labels.jobNumber,
        projectName: `${labels.siteName} (Overtime)`,
        details: `OT ${formatTimesheetHours(otHours)}h`,
        paidHours: otHours,
        payrollBasis: resolved.basis,
        dayRate: otRates.dayRate,
        hourlyRate: otRates.hourlyRate,
        standardDayHours,
        otMultiplier,
        amount: otAmount,
        isPayeDay: isPaye,
        isOvertimeLine: true,
        hasRate,
        bookingId: lineBookingId,
        dayKey: lineDayKey,
      })
    }
  }

  for (const booking of bookings) {
    if (!bookingOccupiesDay(booking.status)) continue
    if (!booking.operativeId || !operativeIds.has(booking.operativeId.toLowerCase())) continue
    const matchedOperative = matched.find((row) => row.id === booking.operativeId) || linked
    pushBooking(
      'op',
      booking.id,
      new Date(booking.date),
      String(booking.timeSlot),
      booking.workStartTime,
      booking.workEndTime,
      booking.isBreakRemoved,
      projectLabel(booking.projectId, projects, smallWorks),
      matchedOperative,
      booking.otMultiplierOverride
    )
  }

  const managerUserIds = new Set([user.id, ...aliasUserIds, ...(user.formerUserIds ?? [])])
  for (const booking of managerSiteBookings) {
    if (!managerUserIds.has(booking.userId)) continue
    if (!includesManagerScheduleLocation(scheduleOptions, booking)) continue
    pushBooking(
      'mgr',
      booking.id,
      new Date(booking.date),
      String(booking.timeSlot),
      booking.workStartTime,
      booking.workEndTime,
      booking.isBreakRemoved,
      managerLabels(booking, projects, smallWorks),
      linked || matched[0]
    )
  }

  // Every booking is paid; overlapping ones are only flagged (`overlappingBookingIds`).
  const overlapping = new Set(overlappingBookingIds(paidBookings, currentPolicy))
  for (const line of lineItems) line.isOverlapping = Boolean(line.bookingId && overlapping.has(line.bookingId))

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
