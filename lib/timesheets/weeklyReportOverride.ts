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
import { DEFAULT_MY_SCHEDULE, DEFAULT_PAYROLL_POLICY, orgPayrollPolicyForDay } from '@/lib/settings/organizationSettings'
import { isTimesheetFullyApproved, userTimesheetSelfSigned } from '@/lib/timesheets/timesheetApprovalPolicy'
import {
  effectiveExpenseAmount,
  effectivePayrollAmount,
  effectivePriceWorkAmount,
  isPayrollLineRemoved,
  draftPayrollLineReview,
} from '@/lib/timesheets/timesheetAdjustments'
import { bookingIdFromLineId } from '@/lib/timesheets/payrollLineBookingLookup'
import {
  collectTimesheetPayroll,
  type TimesheetPayrollLineItem,
} from '@/lib/timesheets/timesheetPayrollCollector'
import { emptyDayRateHistory, type OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import { orgDayHours } from '@/lib/timesheets/payBasis'
import type { PayrollTimePolicyState } from '@/lib/canonical'
import { payrollLineReviewKey, payrollLineReviewSnapshotParts, timesheetSnapshotNeedsRebuild, weekdayPaidHours } from '@/lib/canonical'
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
  /** The organisation roster: `timesheetSelfSigned(user, roster)` reads active line managers from it. */
  users?: ReadonlyArray<User>
  viewer?: User | null
  weekStart: Date
  weekEnd: Date
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  projects: Project[]
  smallWorks: Project[]
  history?: OperativeDayRateHistoryCollection
  aliasUserIds?: string[]
  payrollPolicy?: OrgPayrollTimePolicy
  payrollPolicyPrior?: OrgPayrollTimePolicy | null
  payrollPolicyEffectiveFrom?: string | null
  /** Rulebook 1.19.0: the whole working-hours state; each day is priced under the rules in effect on it. */
  payrollPolicyState?: PayrollTimePolicyState | null
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
  const standard = orgDayHours(standardPaidHours)
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
    payBasis: line.payrollBasis === 'hourly' ? 'hourly' : 'day',
    isOvertime: line.isOvertimeLine,
    otMultiplier: line.isOvertimeLine ? line.otMultiplier ?? null : null,
    decision,
    bookingId: bookingIdFromLineId(line.id) || '',
    ...(line.bookingFingerprint ? { bookingFingerprint: line.bookingFingerprint } : {}),
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

function payrollSummaryFor(input: WeeklyReportOverrideInput) {
  const policy = input.payrollPolicy || DEFAULT_PAYROLL_POLICY
  return collectTimesheetPayroll({
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
    payrollPolicyState: input.payrollPolicyState,
    timeZone: input.timeZone,
    history: input.history || emptyDayRateHistory(),
    scheduleOptions: input.scheduleOptions || DEFAULT_MY_SCHEDULE,
    aliasUserIds: input.aliasUserIds,
  })
}

function makeOverride(input: WeeklyReportOverrideInput, prepared?: ReturnType<typeof payrollSummaryFor>): WeeklyReportOverride {
  const policy = input.payrollPolicy || DEFAULT_PAYROLL_POLICY
  const summary = prepared ?? payrollSummaryFor(input)
  const managerHasSigned = Boolean(input.draft.managerSignedAt)
  const lines: WeeklyReportLabourLine[] = []
  // 1.46.0 (review): never two snapshot lines with one id — a part `{booking}-ot` is left out when the booking has its
  // own overtime line (that review is stale anyway), and a line is never pushed twice.
  const liveIds = new Set(summary.lineItems.map((line) => line.id.toLowerCase()))
  const pushedIds = new Set<string>()
  const pushLine = (row: WeeklyReportLabourLine) => {
    const key = row.id.toLowerCase()
    if (pushedIds.has(key)) return
    pushedIds.add(key)
    lines.push(row)
  }
  for (const line of summary.lineItems) {
    const review = draftPayrollLineReview(input.draft, line.id, line)
    // 1.46.0 (third review): each signed line records the booking's state at signing and the review applied, so a later
    // save tests a review against the sheet as signed (`reapplyReviews`), never against today's bookings.
    const signedState = {
      bookingHadOvertimeLine: line.bookingHasOvertimeLine === true,
      appliedReviewKey: payrollLineReviewKey(review),
    }
    if (isPayrollLineRemoved(line, input.draft, managerHasSigned, true)) {
      pushLine({ ...labourLine(line, 'declined', 0, 0, input.managerSiteBookings), ...signedState })
      continue
    }
    const amount = effectivePayrollAmount(line, input.draft, managerHasSigned, true)
    // 1.19.0: day units against the standard day in effect on the line's own day.
    const linePolicy = orgPayrollPolicyForDay(
      line.date,
      policy,
      input.payrollPolicyPrior,
      input.payrollPolicyEffectiveFrom,
      input.timeZone,
      null,
      input.payrollPolicyState
    )
    // Rulebook 1.46.0 (`payrollLineReviewSnapshotParts`): an Edit hours review signs the hours and money of each part
    // it pays — a standard line carrying overtime becomes the standard line plus `{booking}-ot` at the multiplier.
    const parts = payrollLineReviewSnapshotParts(line, review)
    if (parts) {
      const standard = orgDayHours(weekdayPaidHours(linePolicy))
      for (const part of parts) {
        if (part.id !== line.id && liveIds.has(part.id.toLowerCase())) continue
        pushLine({
          ...labourLine(line, 'edited', part.amount, part.paidHours / standard, input.managerSiteBookings),
          ...signedState,
          id: part.id,
          paidHours: part.paidHours,
          isOvertime: part.isOvertime,
          otMultiplier: part.isOvertime ? part.otMultiplier : null,
          ...(part.isOvertime && !line.isOvertimeLine ? { projectName: `${line.projectName} (Overtime)` } : {}),
        })
      }
      continue
    }
    const days = scaledDays(line, amount, weekdayPaidHours(linePolicy))
    pushLine({ ...labourLine(line, agreedDecision(review?.decision), amount, days, input.managerSiteBookings), ...signedState })
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
    selfSigned: userTimesheetSelfSigned(input.user, input.users ?? []),
    lines,
    priceWork: money.priceWork,
    expenses: money.expenses,
  }
}

function reapplyReviews(existing: WeeklyReportOverride, input: WeeklyReportOverrideInput): WeeklyReportOverride {
  const managerHasSigned = Boolean(input.draft.managerSignedAt)
  const money = moneyLines(input.draft, managerHasSigned)
  const viewerName = personName(input.viewer)
  const existingIds = new Set(existing.lines.map((line) => line.id.toLowerCase()))
  // 1.46.0 (reviews of #324): a signed line is never re-priced by an Edit hours review that is stale against the sheet
  // AS SIGNED — the same test as at signing (`payrollLineReview`): the booking fingerprint the line was signed with (a
  // line signed before 1.46.0 has none, so a fingerprinted review never applies to it), and a standard-line review
  // carrying overtime while the booking had its own overtime line at signing (`bookingHadOvertimeLine`; a part the
  // review added itself is not such a line). A review that is the one applied at signing (`appliedReviewKey`) changes
  // nothing.
  const reviewFor = (line: WeeklyReportLabourLine) => {
    const review = draftPayrollLineReview(input.draft, line.id, {
      bookingFingerprint: line.bookingFingerprint ?? '',
      isOvertimeLine: line.isOvertime,
      bookingHasOvertimeLine: line.bookingHadOvertimeLine === true,
    })
    if (review && line.appliedReviewKey != null && payrollLineReviewKey(review) === line.appliedReviewKey) return 'unchanged' as const
    return review
  }
  // Rulebook 1.46.0: an Edit hours review signs the hours and money of each part (`payrollLineReviewSnapshotParts`),
  // applied to the snapshot line of that id — including a `{booking}-ot` line added for a standard line's overtime. When
  // two reviews give a part of one id, the line's own review wins, else the first line in snapshot order.
  const partsFrom = new Map<string, WeeklyReportLabourLine[]>()
  const partById = new Map<string, { row: WeeklyReportLabourLine; own: boolean }>()
  for (const line of existing.lines) {
    const review = reviewFor(line)
    if (!review || review === 'unchanged' || review.decision === 'declined') continue
    const parts = payrollLineReviewSnapshotParts({ id: line.id, isOvertimeLine: line.isOvertime }, review)
    if (!parts) continue
    const standardDay = line.days > 0.0001 && line.paidHours > 0 ? line.paidHours / line.days : null
    const appliedReviewKey = payrollLineReviewKey(review)
    const rows = parts.map((part) => ({
      ...line,
      id: part.id,
      paidHours: part.paidHours,
      days: standardDay ? part.paidHours / standardDay : line.days,
      amount: part.amount,
      isOvertime: part.isOvertime,
      otMultiplier: part.isOvertime ? part.otMultiplier : null,
      decision: 'edited' as const,
      appliedReviewKey,
    }))
    partsFrom.set(line.id.toLowerCase(), rows)
    for (const row of rows) {
      const key = row.id.toLowerCase()
      const own = key === line.id.toLowerCase()
      const held = partById.get(key)
      if (held && (held.own || !own)) continue
      partById.set(key, { row, own })
    }
  }
  const lines = existing.lines.flatMap((line): WeeklyReportLabourLine[] => {
    const review = reviewFor(line)
    if (review === 'unchanged') return [line]
    const decision = review?.decision ?? line.decision
    if (decision === 'declined') {
      return [{ ...line, amount: 0, days: 0, decision: 'declined' as const, appliedReviewKey: payrollLineReviewKey(review) }]
    }
    const added = (partsFrom.get(line.id.toLowerCase()) ?? []).filter((row) => !existingIds.has(row.id.toLowerCase()))
    const part = partById.get(line.id.toLowerCase())
    if (part) {
      return [
        { ...part.row, bookingFingerprint: line.bookingFingerprint, bookingHadOvertimeLine: line.bookingHadOvertimeLine },
        ...added,
      ]
    }
    if (decision === 'edited' && review && typeof review.revisedAmount === 'number') {
      const revised = review.revisedAmount
      const days = line.amount > 0.0001 ? line.days * (revised / line.amount) : line.days
      return [{ ...line, days, amount: revised, decision: 'edited' as const, appliedReviewKey: payrollLineReviewKey(review) }]
    }
    return [{ ...line, decision: agreedDecision(decision) }, ...added]
  })
  return {
    approvedAt: input.draft.managerSignedAt || input.draft.operativeSignedAt || existing.approvedAt,
    approvedByUserId: input.draft.managerSignedByUserId || input.viewer?.id || existing.approvedByUserId,
    approvedByName:
      input.draft.managerSignedByName ||
      input.draft.operativeSignedByName ||
      viewerName ||
      existing.approvedByName,
    selfSigned: userTimesheetSelfSigned(input.user, input.users ?? []),
    lines,
    priceWork: money.priceWork,
    expenses: money.expenses,
  }
}

/** Write or clear `weeklyReportOverride`. Existing labour lines are not rebuilt from bookings. */
export function applyWeeklyReportOverride(input: WeeklyReportOverrideInput): TimesheetDraft {
  if (!isTimesheetFullyApproved(input.draft, input.user, input.users ?? [])) {
    if (!input.draft.weeklyReportOverride) return input.draft
    return { ...input.draft, weeklyReportOverride: null }
  }
  const existing = input.draft.weeklyReportOverride
  if (existing) {
    // Rulebook 1.43.0 (`timesheetSnapshotNeedsRebuild`): a snapshot frozen with no labour lines (signed before the
    // period's bookings had loaded) is rebuilt from the live bookings when they hold labour lines and nobody has
    // exported the sheet. Signatures and who approved it stay as stored. A snapshot with any labour line is never
    // rebuilt or re-priced.
    if (existing.lines.length === 0 && !input.draft.exportedAt) {
      // Review r318: only bookings created and last written by the time the sheet was approved count (PAYE days left out), so a booking
      // added to the period later never re-prices a sheet that was signed with price work or expenses only.
      const summary = payrollSummaryFor(input)
      const live = summary.lineItems.map((line) => ({
        isPayeDay: line.isPayeDay,
        bookingCreatedAt: line.bookingCreatedAt ?? null,
        bookingUpdatedAt: line.bookingUpdatedAt ?? null,
      }))
      if (timesheetSnapshotNeedsRebuild(input.draft, live)) {
        const fresh = makeOverride(input, summary)
        return {
          ...input.draft,
          weeklyReportOverride: {
            ...fresh,
            approvedAt: existing.approvedAt,
            approvedByUserId: existing.approvedByUserId,
            approvedByName: existing.approvedByName,
            selfSigned: existing.selfSigned,
          },
        }
      }
    }
    return { ...input.draft, weeklyReportOverride: reapplyReviews(existing, input) }
  }
  return { ...input.draft, weeklyReportOverride: makeOverride(input) }
}
