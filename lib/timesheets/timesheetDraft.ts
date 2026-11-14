/**
 * iOS parity: Models/TimesheetDraftModels.swift
 */
import type { PayeClaimEvidence, TimesheetEntryReview } from '@/lib/canonical'

export type TimesheetManagerDecision = 'pending' | 'approved' | 'declined' | 'edited'

export type TimesheetPayrollLineReview = {
  decision: TimesheetManagerDecision
  revisedAmount?: number | null
  /** Rulebook 1.46.0 Edit hours (`PayrollLineEditReviewFields`), on an `edited` review only. */
  revisedStandardHours?: number | null
  revisedOvertimeHours?: number | null
  revisedOvertimeClockHours?: number | null
  revisedOvertimeMultiplier?: number | null
  revisedStandardAmount?: number | null
  revisedOvertimeAmount?: number | null
  reviewedBookingFingerprint?: string | null
}

export type TimesheetExpenseEntry = {
  id: string
  title: string
  details: string
  jobNumber: string
  date: Date
  amount: number
  /** Older entries only: the receipt name both apps stored without uploading a file (read-only). */
  receiptName?: string | null
  /** Rulebook 1.45.0 §8: files, photos and frozen site audit copies (the PAYE claim evidence shape). */
  evidence?: PayeClaimEvidence[]
  /** Rulebook 1.45.0: the stored row's fingerprint (`parseTimesheetEntries`); never written back. */
  reviewFingerprint?: string
  managerDecision: TimesheetManagerDecision
  managerRevisedAmount?: number | null
}

export type TimesheetPriceWorkEntry = {
  id: string
  title: string
  details: string
  jobNumber: string
  agreedManagerName: string
  startDate: Date
  endDate?: Date | null
  amount: number
  /** Rulebook 1.45.0 §8: optional evidence (the PAYE claim evidence shape). */
  evidence?: PayeClaimEvidence[]
  /** Rulebook 1.45.0: the stored row's fingerprint (`parseTimesheetEntries`); never written back. */
  reviewFingerprint?: string
  managerDecision: TimesheetManagerDecision
  managerRevisedAmount?: number | null
}

/** Shared with iOS `TimesheetWeeklyReportLabourLine`. `bookingId` is "" when unknown. */
export type WeeklyReportLabourLine = {
  id: string
  date: Date
  jobNumber: string
  projectName: string
  locationKind: 'project' | 'small_work' | 'office' | 'working_from_home' | 'site_survey' | 'custom' | string
  details: string
  paidHours: number
  days: number
  amount: number
  /** Missing on older snapshots means day rate. */
  payBasis?: 'day' | 'hourly'
  isOvertime: boolean
  /** Written on new overtime snapshots. Missing on older lines. */
  otMultiplier?: number | null
  decision: TimesheetManagerDecision
  bookingId: string
  /**
   * Rulebook 1.46.0: the booking as it was when the line was signed (`overtimeBookingFingerprint`). A later Edit hours
   * review made against another version of the booking is never applied to the signed line.
   */
  bookingFingerprint?: string | null
  /** Rulebook 1.46.0: whether the booking had its own overtime line on the sheet when signed (a review's added part is not). */
  bookingHadOvertimeLine?: boolean
  /** Rulebook 1.46.0: `payrollLineReviewKey` of the review applied when the line was signed ('' when none). */
  appliedReviewKey?: string | null
  /**
   * Rulebook 1.46.0: on a `{booking}-ot` line an Edit hours review added for a standard line's overtime, that standard
   * line's id — the line follows that line's current review (recomputed together, 0 when it no longer pays overtime).
   */
  reviewPartOf?: string | null
}

/** Shared with iOS `TimesheetWeeklyReportMoneyLine`. */
export type WeeklyReportMoneyLine = {
  id: string
  title: string
  details: string
  jobNumber: string
  date: Date
  amount: number
  decision: TimesheetManagerDecision
}

/**
 * Written on `organizations/{orgId}/settings/timesheet_{userId}_{weekStartUnix}`
 * when the timesheet is fully approved. Cleared when signatures are cleared.
 */
export type WeeklyReportOverride = {
  approvedAt: Date
  approvedByUserId: string
  approvedByName: string
  selfSigned: boolean
  lines: WeeklyReportLabourLine[]
  priceWork: WeeklyReportMoneyLine[]
  expenses: WeeklyReportMoneyLine[]
}

export type TimesheetDraft = {
  expenseEntries: TimesheetExpenseEntry[]
  priceWorkEntries: TimesheetPriceWorkEntry[]
  payrollLineReviews: Record<string, TimesheetPayrollLineReview>
  managerNote: string
  operativeSignedAt?: Date | null
  operativeSignedByName?: string | null
  operativeSignatureImageBase64?: string | null
  managerSignedAt?: Date | null
  managerSignedByName?: string | null
  managerSignedByUserId?: string | null
  managerSignatureImageBase64?: string | null
  exportedAt?: Date | null
  weeklyReportOverride?: WeeklyReportOverride | null
  /**
   * Stored `extraEntryReviews` (line manager / admin decisions on price work and expenses), or
   * null on a legacy sheet that has none yet. Entry `managerDecision` values are already resolved
   * from it by `timesheetEntryDecision`; this copy only lets a reviewer save write what changed.
   */
  extraEntryReviews?: Record<string, TimesheetEntryReview> | null
}

export function emptyTimesheetDraft(): TimesheetDraft {
  return {
    expenseEntries: [],
    priceWorkEntries: [],
    payrollLineReviews: {},
    managerNote: '',
  }
}

export function decisionLabel(decision: TimesheetManagerDecision): string {
  switch (decision) {
    case 'pending':
      return 'Awaiting review'
    case 'approved':
      return 'Approved'
    case 'declined':
      return 'Declined'
    case 'edited':
      return 'Edited'
    default:
      return 'Awaiting review'
  }
}

/** iOS TimesheetManagerDecision.tint */
export function decisionTint(decision: TimesheetManagerDecision): string {
  switch (decision) {
    case 'pending':
      return '#FF9500'
    case 'approved':
      return '#34C759'
    case 'declined':
      return '#FF3B30'
    case 'edited':
      return '#007AFF'
    default:
      return '#FF9500'
  }
}

export function reviewSelection(decision: TimesheetManagerDecision): TimesheetManagerDecision {
  return decision === 'pending' ? 'approved' : decision
}
