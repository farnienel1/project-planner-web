/**
 * iOS parity: Core/TimesheetPayrollCollector.swift
 */
import type { PayrollTimePolicyScheduledChange, PayrollTimePolicyState } from '@/lib/canonical'
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
import { personRateHistoryIds } from '@/lib/pay/personRateHistoryIds'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import {
  bookingIdsForAccount,
  bookingOccupiesDay,
  formatMoney,
  overlappingBookingIds,
  overtimeBookingFingerprint,
  payrollLineClockRanges,
  payrollMultipliedHours,
  timesheetLineClockText,
  weekdayPaidHours,
} from '@/lib/canonical'
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
import { timesheetDaysForPerson } from '@/lib/canonical/peopleDocuments'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { normalizeDocumentId } from '@/lib/canonical'

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
  standardDayHours: number
  otMultiplier?: number | null
  /**
   * Rulebook 1.20.3 (display only, never stored): an overtime line's clock hours at the multiplier and the unpaid
   * break taken off them as plain hours (`payrollMultipliedHours`). `paidHours` / `amount` are unchanged.
   */
  otClockHours?: number
  otBreakHours?: number
  /**
   * Rulebook 1.22.0 (`timesheetTotals`), on a booking's standard line only: the booking's weighted paid hours
   * (`payrollHoursResult.totalPaidHours`) and its overtime clock hours, so the sheet's Hours and Overtime figures are
   * the rulebook's sum of its lines.
   */
  bookingPaidHours?: number
  bookingOvertimeHours?: number
  amount: number
  isPayeDay: boolean
  isOvertimeLine: boolean
  hasRate: boolean
  /** The booking (operative or manager) this line comes from. */
  bookingId?: string
  /**
   * Rulebook 1.43.0 (display only, never stored): the booking's own clock times and break toggle. `details` now shows
   * only this line's part (`payrollLineClockRanges`), so Edit hours reads the whole booking from these when the live
   * booking is not loaded.
   */
  bookingStartTime?: string
  bookingEndTime?: string
  bookingBreakRemoved?: boolean
  /**
   * Rulebook 1.46.0 (never stored): the booking's own overtime rate (`otMultiplierOverride`), so Edit hours re-prices
   * the booking at it (`revisedPayrollLineAmounts`). Missing = the organisation's rate.
   */
  bookingOtMultiplierOverride?: number | null
  /**
   * Rulebook 1.46.0 (never stored on the line): the booking as it is now (`overtimeBookingFingerprint`), on both lines
   * of a booking. Edit hours stores it on its review (`reviewedBookingFingerprint`); once the booking changes the
   * review is stale (`payrollLineReview`), so a changed booking is never paid twice.
   */
  bookingFingerprint?: string
  /** Rulebook 1.46.0 (never stored): whether this line's booking has its own overtime line on the sheet. */
  bookingHasOvertimeLine?: boolean
  /** Rulebook 1.43.0 (rebuild check only, never stored): when the line's booking was created and last written. */
  bookingCreatedAt?: Date
  bookingUpdatedAt?: Date
  dayKey?: string
  /**
   * `overlappingBookingIds`: this booking overlaps another on the same day. Every booking is
   * still paid; the line is shown amber so the person and their manager can check it.
   */
  isOverlapping?: boolean
}

/**
 * Overtime a booking needs before it gets its own overtime line (web and iOS collectors). Kept as it is in 1.46.0:
 * whether to keep, drop or apply it everywhere is an owner question (the weekly report has no cut-off).
 */
export const TIMESHEET_OVERTIME_LINE_MIN_HOURS = 0.05

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
  // 1.44.0: every line carries the paid day in effect on its own day (`weekdayPaidHours`, set by the collector).
  const standard = orgDayHours(line.standardDayHours)
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
    clockHours: line.otClockHours ?? null,
    breakHours: line.otBreakHours ?? null,
  }).equation
}

/** Clock span may sit beside the equation. A slot name such as FULL DAY is not the quantity. */
export function timesheetLabourDetails(line: TimesheetPayrollLineItem, currencyCode?: string): string {
  const equation = timesheetHoursRateLine(line, currencyCode)
  // 1.43.0: only the clock part of the details (`timesheetLineClockText`), so the multiplied text is not shown twice.
  const clock = timesheetLineClockText(line.details)
  if (isClockSpanLabel(clock)) return `${clock} · ${equation}`
  return equation
}

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate()
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null
  }
  return null
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
  payrollPolicyState = null,
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
  /**
   * Rulebook 1.19.0: the organisation's whole working-hours state (`OrganizationDetails.payrollTimePolicyState`:
   * history, prior, current and the pending change). When given, each day is priced under the policy in effect on it
   * (`payrollTimePolicyForDayFromState`) and the loose prior / effectiveFrom / scheduled fields are not used.
   */
  payrollPolicyState?: PayrollTimePolicyState | null
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
  const rateHistoryOperativeIds = personRateHistoryIds(user, operatives, { aliasUserIds }).operativeIds
  // Rulebook 1.11.0 `timesheetDaysForPerson`: only the days the person is self-employed count. A PAYE day never
  // produces a timesheet line (it stays a booking for warnings, Daily Overview and Weekly Report hours).
  const zone = timeZone || organizationZoneOr()
  const countedDays = new Set(
    timesheetDaysForPerson(
      {
        employmentType: user.employmentType,
        employmentTypeTransitionFrom: user.employmentTypeTransitionFrom,
        employmentTypeEffectiveAt: user.employmentTypeEffectiveAt,
      },
      { startDayKey: dayKey(periodStart, zone), endDayKey: dayKey(periodEnd, zone) },
      zone
    )
  )
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
    otMultiplierOverride?: number | null,
    bookingCreatedAt?: Date | null,
    bookingUpdatedAt?: Date | null
  ) => {
    if (!isDateInPeriod(date, periodStart, periodEnd, timeZone)) return
    if (!countedDays.has(dayKey(date, zone))) return
    const policy = orgPayrollPolicyForDay(
      date,
      currentPolicy,
      payrollPolicyPrior,
      payrollPolicyEffectiveFrom,
      timeZone,
      payrollPolicyScheduled,
      payrollPolicyState
    )
    // 1.20.0: a day rate divides by the weekday paid day in effect that day (`weekdayPaidHours`).
    const standardDayHours = orgDayHours(weekdayPaidHours(policy))
    // One rulebook result (`payrollHoursResult`), the same figures the iOS collector uses.
    const hours = bookingHoursOnDay(date, timeSlot, workStartTime, workEndTime, policy, isBreakRemoved, otMultiplierOverride, zone)
    const paidHours = hours.totalPaidHours
    const otHours = hours.outsideHours
    const normalHours = Math.max(0, hours.standardHours)
    const otMultiplier = hours.outsideMultiplier
    const resolved = resolveForTimesheetDay({
      user,
      operative: operative || linked || matched[0],
      day: date,
      history,
      timeZone,
      aliasUserIds,
      // 1.36.0 (FU-5): rate history filed under any of the person's `operatives` rows, not only one.
      operativeIds: rateHistoryOperativeIds,
    })
    const hasRate = payrollRateHasValue(resolved)
    // 1.20.3: hours at the multiplier as clock hours, with any unpaid break as plain hours (display only).
    const multiplied = payrollMultipliedHours(hours)
    // 1.43.0 (owner rule, `payrollLineClockRanges`): a booking with clock times shows the standard-window times on its
    // standard line and the overtime times on its overtime line. Wording only; a booking with no standard part keeps
    // its own times, and a named slot (FULL DAY, AM, PM) keeps its name.
    const clockRanges = workStartTime && workEndTime ? payrollLineClockRanges(hours) : null
    const standardDetails = clockRanges?.standardText
      ? isBreakRemoved
        ? `${clockRanges.standardText} · no break`
        : clockRanges.standardText
      : scheduleLabel(timeSlot, workStartTime, workEndTime, isBreakRemoved)
    const multipliedText = multiplied && multiplied.breakHours > 0 ? `OT ${multiplied.text}` : null
    const overtimeDetails = clockRanges?.overtimeText
      ? multipliedText
        ? `${clockRanges.overtimeText} · ${multipliedText}`
        : clockRanges.overtimeText
      : multipliedText ?? `OT ${formatTimesheetHours(multiplied ? multiplied.clockHours : otHours)}h`
    shiftCount += 1
    totalHours += paidHours
    overtimeHours += multiplied ? multiplied.clockHours : otHours
    const isPaye = employmentTypeOnDay(user, date, timeZone) === 'paye'
    const lineBookingId = `${idPrefix}-${bookingId}`
    const lineDayKey = dayKey(date, timeZone)
    const bookingFingerprint = overtimeBookingFingerprint({
      id: bookingId,
      personId: '',
      dayKey: lineDayKey,
      timeSlot,
      workStartTime,
      workEndTime,
      isBreakRemoved: isBreakRemoved === true,
      otMultiplierOverride: otMultiplierOverride ?? null,
    })
    paidBookings.push({ id: lineBookingId, dayKey: lineDayKey, timeSlot, workStartTime, workEndTime })
    const normalAmount = payForHours(resolved, normalHours, standardDayHours)
    baseAmount += normalAmount
    lineItems.push({
      id: `${idPrefix}-${bookingId}-normal`,
      date,
      jobNumber: labels.jobNumber,
      projectName: labels.siteName,
      details: standardDetails,
      paidHours: normalHours,
      payrollBasis: resolved.basis,
      dayRate: resolved.dayRate ?? 0,
      hourlyRate: resolved.hourlyRate,
      standardDayHours,
      bookingPaidHours: paidHours,
      bookingOvertimeHours: multiplied ? multiplied.clockHours : otHours,
      amount: normalAmount,
      isPayeDay: isPaye,
      isOvertimeLine: false,
      hasRate,
      bookingId: lineBookingId,
      ...(workStartTime && workEndTime ? { bookingStartTime: workStartTime, bookingEndTime: workEndTime, bookingBreakRemoved: isBreakRemoved === true } : {}),
      ...(otMultiplierOverride != null ? { bookingOtMultiplierOverride: otMultiplierOverride } : {}),
        bookingFingerprint,
      ...(bookingCreatedAt instanceof Date && !Number.isNaN(bookingCreatedAt.getTime()) ? { bookingCreatedAt } : {}),
      ...(bookingUpdatedAt instanceof Date && !Number.isNaN(bookingUpdatedAt.getTime()) ? { bookingUpdatedAt } : {}),
      dayKey: lineDayKey,
    })
    if (otHours > TIMESHEET_OVERTIME_LINE_MIN_HOURS) {
      const otAmount = payForHours(resolved, otHours, standardDayHours, otMultiplier)
      overtimeAmount += otAmount
      const otRates = overtimeDisplayRates(resolved, otMultiplier)
      lineItems.push({
        id: `${idPrefix}-${bookingId}-ot`,
        date,
        jobNumber: labels.jobNumber,
        projectName: `${labels.siteName} (Overtime)`,
        details: overtimeDetails,
        paidHours: otHours,
        ...(multiplied && multiplied.breakHours > 0 ? { otClockHours: multiplied.clockHours, otBreakHours: multiplied.breakHours } : {}),
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
        ...(workStartTime && workEndTime ? { bookingStartTime: workStartTime, bookingEndTime: workEndTime, bookingBreakRemoved: isBreakRemoved === true } : {}),
        ...(otMultiplierOverride != null ? { bookingOtMultiplierOverride: otMultiplierOverride } : {}),
        bookingFingerprint,
        ...(bookingCreatedAt instanceof Date && !Number.isNaN(bookingCreatedAt.getTime()) ? { bookingCreatedAt } : {}),
        ...(bookingUpdatedAt instanceof Date && !Number.isNaN(bookingUpdatedAt.getTime()) ? { bookingUpdatedAt } : {}),
        dayKey: lineDayKey,
      })
    }
  }

  for (const booking of bookings) {
    if (!bookingOccupiesDay(booking.status)) continue
    if (!booking.operativeId || !operativeIds.has(booking.operativeId.toLowerCase())) continue
    const matchedOperative = matched.find((row) => normalizeDocumentId(row.id) === normalizeDocumentId(booking.operativeId)) || linked
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
      booking.otMultiplierOverride,
      toDateOrNull(booking.createdAt),
      toDateOrNull(booking.updatedAt)
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
      linked || matched[0],
      // Rulebook 1.29.0: a manager site booking's own overtime rate prices its overtime part too.
      booking.otMultiplierOverride,
      toDateOrNull(booking.createdAt),
      toDateOrNull(booking.updatedAt)
    )
  }

  // Every booking is paid; overlapping ones are only flagged (`overlappingBookingIds`).
  // 1.23.0: each booking's named slot under the working hours in effect on its own day (as pay, 1.19.0).
  const overlapState: PayrollTimePolicyState = payrollPolicyState ?? {
    current: currentPolicy,
    prior: payrollPolicyPrior,
    effectiveFrom: payrollPolicyEffectiveFrom,
    scheduled: payrollPolicyScheduled,
  }
  const overlapping = new Set(overlappingBookingIds(paidBookings, overlapState))
  for (const line of lineItems) line.isOverlapping = Boolean(line.bookingId && overlapping.has(line.bookingId))
  // 1.46.0: a standard-line Edit hours review that carries overtime is stale once the booking has its own overtime line.
  const bookingsWithOvertime = new Set(lineItems.filter((line) => line.isOvertimeLine && line.bookingId).map((line) => line.bookingId))
  for (const line of lineItems) line.bookingHasOvertimeLine = Boolean(line.bookingId && bookingsWithOvertime.has(line.bookingId))

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
