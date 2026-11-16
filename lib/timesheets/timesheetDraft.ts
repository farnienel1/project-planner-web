/**
 * iOS parity: Models/TimesheetDraftModels.swift
 */
import type { PayeClaimEvidence, SignedTimesheetBooking, TimesheetEntryReview } from '@/lib/canonical'

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

/**
 * Rulebook 1.54.0 §8: a price work or expense entry added after the line manager signed (`lateExtras`). Its
 * `managerDecision` is the reviewer's decision from the review map only (`timesheetLateExtraDecision`); it is never
 * written to the entry. It pays only once approved.
 */
export type TimesheetLateExtra =
  | (TimesheetPriceWorkEntry & { kind: 'priceWork'; lateState?: TimesheetLateExtraState; lateReason?: TimesheetLateExtraReason })
  | (TimesheetExpenseEntry & { kind: 'expense'; lateState?: TimesheetLateExtraState; lateReason?: TimesheetLateExtraReason })

/**
 * Rulebook 1.54.0 (third review of #337): where a loaded late extra stands (`timesheetLateExtraDecision`) — `ignored`
 * (its id is a signed entry's or an earlier late extra's) is never paid and never offered for review. Read only.
 */
export type TimesheetLateExtraState = 'approved' | 'declined' | 'pending' | 'ignored'
export type TimesheetLateExtraReason = 'review' | 'no-review' | 'stale-review' | 'not-late-review' | 'id-taken' | 'id-unusable' | 'no-title' | 'no-kind' | 'no-id'

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
  /**
   * Rulebook 1.46.0: the signed line's own PAYE / leave flags (`isInvoiceLine` reads them; a signed row is never
   * filtered by the live lines). Written on every snapshot line; missing on older snapshots means false.
   */
  isPayeDay?: boolean
  isLeave?: boolean
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
  /** Rulebook 1.54.0: an approved late extra (`timesheetLateExtrasSnapshotRows`); missing on every other row. */
  lateExtra?: boolean
  /** Rulebook 1.54.0: the late extra's fingerprint when it was approved. */
  entryFingerprint?: string
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
  /**
   * Rulebook 1.54.0 §8: price work and expenses the person added after the line manager signed (until exported). The
   * signed entries above never change after that. Missing when the stored sheet has none.
   */
  lateExtras?: TimesheetLateExtra[]
  payrollLineReviews: Record<string, TimesheetPayrollLineReview>
  managerNote: string
  operativeSignedAt?: Date | null
  operativeSignedByName?: string | null
  operativeSignatureImageBase64?: string | null
  /**
   * Rulebook 1.47.0 §8: the bookings the person signed (`signedTimesheetBookingRecord`), written with every operative
   * signature. Missing on sheets signed before 1.47.0 (then the signed snapshot, if any, is what they signed).
   */
  operativeSignedBookings?: SignedTimesheetBooking[] | null
  /**
   * Rulebook 1.47.0: when `operativeSignedBookings` was written — server time (written with `serverTimestamp()`;
   * null while the write is pending or on a sheet signed before 1.47.0).
   */
  operativeSignedBookingsAt?: Date | null
  /** The `operativeSignedAt` the record belongs to (same value; ties the record to its signature). */
  operativeSignedBookingsSignedAt?: Date | null
  /** Local only: write `operativeSignedBookingsAt` as the server time on the next save. Never stored. */
  operativeSignedBookingsAtPending?: boolean
  /**
   * Rulebook 1.54.0 (review of #337): the stored `exportedAt` is set as the security rules test it
   * (`timesheetExportedFieldSet`), whatever `exportedAt` above resolved to. Read only, never written.
   */
  exportedAtStored?: boolean
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
  /**
   * Rulebook 1.55.0 §8: the version this draft was read from — 0 for the original, N for REV N (from the document id,
   * `parseTimesheetRevisionDocId`). Read only, never written.
   */
  revision?: number
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
