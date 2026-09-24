/**
 * iOS parity: Core/TimesheetWeeklyReportOverrideBuilder.swift
 *
 * Builds `weeklyReportOverride` on a fully approved timesheet. The first
 * approval snapshots labour from live bookings. Later saves keep those lines
 * and only re-apply payrollLineReviews plus the current price work and expenses.
 */
import type { Booking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { MyScheduleOptions, OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_MY_SCHEDULE, DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { isTimesheetFullyApproved, userHasLineManager } from '@/lib/timesheets/timesheetApprovalPolicy'
import {
  effectiveExpenseAmount,
  effectivePayrollAmount,
  effectivePriceWorkAmount,
  isPayrollLineRemoved,
} from '@/lib/timesheets/timesheetAdjustments'
import { bookingIdFromLineId } from '@/lib/timesheets/payrollLineBookingLookup'
import {
  collectTimesheetPayroll,
  type TimesheetPayrollLineItem,
} from '@/lib/timesheets/timesheetPayrollCollector'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import type {
  TimesheetDraft,
  TimesheetManagerDecision,
  WeeklyReportLabourLine,
  WeeklyReportMoneyLine,
  WeeklyReportOverride,
} from '@/lib/timesheets/timesheetDraft'

export type WeeklyReportOverrideInput = {
  draft: TimesheetDraft
  user: User
  viewer?: User | null
  weekStart: Date
  weekEnd: Date
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  projects: Project[]
  smallWorks: Project[]
  history?: OperativeDayRateHistoryCollection
  payrollPolicy?: OrgPayrollTimePolicy
  payrollPolicyPrior?: OrgPayrollTimePolicy | null
  payrollPolicyEffectiveFrom?: string | null
  scheduleOptions?: MyScheduleOptions
  timeZone?: string
}

function personName(user: User | null | undefined): string {
  if (!user) return ''
  const name = `${user.firstName || ''} ${user.surname || ''}`.trim()
  return name || user.email || user.id
}

function agreedDecision(decision: TimesheetManagerDecision | undefined): TimesheetManagerDecision {
  if (!decision || decision === 'pending') return 'approved'
  return decision
}

function scaledDays(
  line: TimesheetPayrollLineItem,
  effectiveAmount: number,
  standardPaidHours: number
): number {
  const standard = Math.max(standardPaidHours, 0.01)
  const baseDays = Math.max(0, line.paidHours) / standard
  if (line.amount <= 0.0001) return baseDays
  return baseDays * (effectiveAmount / line.amount)
}

function locationKindForLine(
  line: TimesheetPayrollLineItem,
  managerSiteBookings: ManagerSiteBooking[]
): string {
  if (line.id.startsWith('op-')) return 'project'
  const bookingId = bookingIdFromLineId(line.id)
  const booking = bookingId ? managerSiteBookings.find((row) => row.id === bookingId) : undefined
  if (booking) return booking.locationType
  const lower = line.projectName.toLowerCase()
  if (lower.includes('office')) return 'office'
  if (lower.includes('working from home')) return 'working_from_home'
  if (lower.includes('site survey')) return 'site_survey'
  if (line.jobNumber === '—') return 'custom'
  return 'project'
}

function labourLine(
  line: TimesheetPayrollLineItem,
  decision: TimesheetManagerDecision,
  amount: number,
  days: number,
  managerSiteBookings: ManagerSiteBooking[]
): WeeklyReportLabourLine {
  return {
    id: line.id,
    date: line.date,
    jobNumber: line.jobNumber,
    projectName: line.projectName,
    locationKind: locationKindForLine(line, managerSiteBookings),
    details: line.details,
    paidHours: line.paidHours,
    days,
    amount,
    isOvertime: line.isOvertimeLine,
    decision,
    bookingId: bookingIdFromLineId(line.id) || '',
  }
}

function moneyLines(
  draft: TimesheetDraft,
  managerHasSigned: boolean
): { priceWork: WeeklyReportMoneyLine[]; expenses: WeeklyReportMoneyLine[] } {
  const priceWork = draft.priceWorkEntries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    details: entry.details,
    jobNumber: entry.jobNumber,
    date: entry.startDate,
    amount: effectivePriceWorkAmount(entry, managerHasSigned, true),
    decision: agreedDecision(entry.managerDecision),
  }))
  const expenses = draft.expenseEntries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    details: entry.details,
    jobNumber: entry.jobNumber,
    date: entry.date,
    amount: effectiveExpenseAmount(entry, managerHasSigned, true),
    decision: agreedDecision(entry.managerDecision),
  }))
  return { priceWork, expenses }
}

function makeOverride(input: WeeklyReportOverrideInput): WeeklyReportOverride {
  const policy = input.payrollPolicy || DEFAULT_PAYROLL_POLICY
  const summary = collectTimesheetPayroll({
    user: input.user,
    bookings: input.bookings,
    managerSiteBookings: input.managerSiteBookings,
    operatives: input.operatives,
    projects: input.projects,
    smallWorks: input.smallWorks,
    periodStart: input.weekStart,
    periodEnd: input.weekEnd,
    payrollPolicy: policy,
    payrollPolicyPrior: input.payrollPolicyPrior,
    payrollPolicyEffectiveFrom: input.payrollPolicyEffectiveFrom,
    timeZone: input.timeZone,
    history: input.history || emptyDayRateHistory(),
    scheduleOptions: input.scheduleOptions || DEFAULT_MY_SCHEDULE,
  })
  const managerHasSigned = Boolean(input.draft.managerSignedAt)
  const lines: WeeklyReportLabourLine[] = []
  for (const line of summary.lineItems) {
    const review = input.draft.payrollLineReviews[line.id]
    if (isPayrollLineRemoved(line, input.draft, managerHasSigned, true)) {
      lines.push(labourLine(line, 'declined', 0, 0, input.managerSiteBookings))
      continue
    }
    const amount = effectivePayrollAmount(line, input.draft, managerHasSigned, true)
    const days = scaledDays(line, amount, policy.standardPaidHours)
    lines.push(
      labourLine(line, agreedDecision(review?.decision), amount, days, input.managerSiteBookings)
    )
  }
  const money = moneyLines(input.draft, managerHasSigned)
  const viewerName = personName(input.viewer)
  return {
    approvedAt: input.draft.managerSignedAt || input.draft.operativeSignedAt || new Date(),
    approvedByUserId: input.draft.managerSignedByUserId || input.viewer?.id || input.user.id,
    approvedByName:
      input.draft.managerSignedByName ||
      input.draft.operativeSignedByName ||
      viewerName ||
      personName(input.user),
    selfSigned: !userHasLineManager(input.user),
    lines,
    priceWork: money.priceWork,
    expenses: money.expenses,
  }
}

function reapplyReviews(existing: WeeklyReportOverride, input: WeeklyReportOverrideInput): WeeklyReportOverride {
  const managerHasSigned = Boolean(input.draft.managerSignedAt)
  const money = moneyLines(input.draft, managerHasSigned)
  const viewerName = personName(input.viewer)
  const lines = existing.lines.map((line) => {
    const review = input.draft.payrollLineReviews[line.id]
    const decision = review?.decision ?? line.decision
    if (decision === 'declined') {
      return { ...line, amount: 0, days: 0, decision: 'declined' as const }
    }
    if (decision === 'edited' && typeof review?.revisedAmount === 'number') {
      const revised = review.revisedAmount
      const days = line.amount > 0.0001 ? line.days * (revised / line.amount) : line.days
      return { ...line, days, amount: revised, decision: 'edited' as const }
    }
    return { ...line, decision: agreedDecision(decision) }
  })
  return {
    approvedAt: input.draft.managerSignedAt || input.draft.operativeSignedAt || existing.approvedAt,
    approvedByUserId: input.draft.managerSignedByUserId || input.viewer?.id || existing.approvedByUserId,
    approvedByName:
      input.draft.managerSignedByName ||
      input.draft.operativeSignedByName ||
      viewerName ||
      existing.approvedByName,
    selfSigned: !userHasLineManager(input.user),
    lines,
    priceWork: money.priceWork,
    expenses: money.expenses,
  }
}

/** Write or clear `weeklyReportOverride`. Existing labour lines are not rebuilt from bookings. */
export function applyWeeklyReportOverride(input: WeeklyReportOverrideInput): TimesheetDraft {
  if (!isTimesheetFullyApproved(input.draft, input.user)) {
    if (!input.draft.weeklyReportOverride) return input.draft
    return { ...input.draft, weeklyReportOverride: null }
  }
  if (input.draft.weeklyReportOverride) {
    return { ...input.draft, weeklyReportOverride: reapplyReviews(input.draft.weeklyReportOverride, input) }
  }
  return { ...input.draft, weeklyReportOverride: makeOverride(input) }
}
