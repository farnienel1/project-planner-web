/**
 * iOS parity: Views/TimesheetManagerReviewSupport.swift TimesheetDraftAdjustments
 */
import type {
  TimesheetDraft,
  TimesheetExpenseEntry,
  TimesheetManagerDecision,
  TimesheetPriceWorkEntry,
} from '@/lib/timesheets/timesheetDraft'
import type { TimesheetPayrollLineItem } from '@/lib/timesheets/timesheetPayrollCollector'
import { formatMoney } from '@/lib/canonical/money'
import {
  payrollLineReview,
  timesheetEntryEffectiveAmount,
  timesheetEntryReviewWriteFields,
  timesheetEntryReviewsAfterWrite,
  timesheetEntryFingerprintMap,
  type PayrollLineReview,
} from '@/lib/canonical/timesheetEntryReviews'
import { timesheetTotals, type TimesheetTotals } from '@/lib/canonical/timesheetTotals'

/**
 * The line manager's review of a payroll line (canonical `payrollLineReview`): the line id as stored, then without
 * case, so a review iOS keyed by an upper-case id counts on screen exactly as it does on the invoice.
 */
export function draftPayrollLineReview(
  draft: TimesheetDraft,
  lineId: string | null | undefined,
  /** 1.46.0: the live line, so a review made against an older version of the booking reads as pending (stale). */
  live?: { bookingFingerprint?: string | null } | null
): PayrollLineReview | null {
  return payrollLineReview(draft as unknown as Record<string, unknown>, lineId, live)
}

export type ManagerAdjustmentRow = {
  title: string
  decision: TimesheetManagerDecision
  detail?: string | null
}

export function effectivePayrollAmount(
  line: TimesheetPayrollLineItem,
  draft: TimesheetDraft,
  managerHasSigned: boolean,
  applyLiveReview = false
): number {
  const applyDecisions = managerHasSigned || applyLiveReview
  if (!applyDecisions) return line.amount
  const review = draftPayrollLineReview(draft, line.id, line)
  if (!review) return line.amount
  return timesheetEntryEffectiveAmount(review.decision, review.revisedAmount, line.amount)
}

export function isPayrollLineRemoved(
  line: TimesheetPayrollLineItem,
  draft: TimesheetDraft,
  managerHasSigned: boolean,
  applyLiveReview = false
): boolean {
  const applyDecisions = managerHasSigned || applyLiveReview
  if (!applyDecisions) return false
  return draftPayrollLineReview(draft, line.id, line)?.decision === 'declined'
}

export function effectiveExpenseAmount(
  entry: TimesheetExpenseEntry,
  managerHasSigned: boolean,
  applyLiveReview = false
): number {
  if (!(managerHasSigned || applyLiveReview)) return entry.amount
  return timesheetEntryEffectiveAmount(entry.managerDecision, entry.managerRevisedAmount, entry.amount)
}

export function effectivePriceWorkAmount(
  entry: TimesheetPriceWorkEntry,
  managerHasSigned: boolean,
  applyLiveReview = false
): number {
  if (!(managerHasSigned || applyLiveReview)) return entry.amount
  return timesheetEntryEffectiveAmount(entry.managerDecision, entry.managerRevisedAmount, entry.amount)
}

export function extrasPendingReview(draft: TimesheetDraft): boolean {
  return (
    draft.expenseEntries.some((entry) => entry.managerDecision === 'pending') ||
    draft.priceWorkEntries.some((entry) => entry.managerDecision === 'pending')
  )
}

/**
 * The stored-sheet shape of a draft, as the rulebook reads it (`timesheetInvoiceRows`, `timesheetTotals`).
 * `reviewerPreview`: the line manager's screen before their save lands — the entry decisions on screen are laid over
 * the stored reviews exactly as their save will write them (`timesheetEntryReviewWriteFields`).
 */
export function timesheetSheetFields(draft: TimesheetDraft, options: { reviewerPreview?: boolean } = {}): Record<string, unknown> {
  let extraEntryReviews = draft.extraEntryReviews ?? null
  if (options.reviewerPreview) {
    const written = timesheetEntryReviewWriteFields({
      stored: extraEntryReviews,
      entries: [...draft.priceWorkEntries, ...draft.expenseEntries],
      reviewedByUserId: '',
      reviewedAtMs: 0,
    })
    extraEntryReviews = timesheetEntryReviewsAfterWrite(extraEntryReviews, written)
  }
  return {
    weeklyReportOverride: draft.weeklyReportOverride ?? null,
    payrollLineReviews: draft.payrollLineReviews,
    extraEntryReviews,
    priceWorkEntries: draft.priceWorkEntries,
    expenseEntries: draft.expenseEntries,
    managerSignedAt: draft.managerSignedAt ?? null,
  }
}

/**
 * Rulebook 1.22.0 (§8): the totals of one sheet — `timesheetTotals`, the sum of its invoice rows. `decided` is
 * whether review decisions apply on this screen (the line manager has signed, or the viewer is reviewing it); a
 * reviewer's screen also applies their labour reviews before they sign. List rows pass `decided: true` (the export
 * invoice). `timesheetDays` (`timesheetDayKeysForPeriod`) leaves out rows on PAYE days, as the invoice does.
 */
export function draftTimesheetTotals(input: {
  lines: TimesheetPayrollLineItem[]
  draft: TimesheetDraft
  decided: boolean
  reviewing?: boolean
  timesheetDays?: ReadonlyArray<string> | null
  timeZone?: string
}): TimesheetTotals {
  return timesheetTotals({
    sheet: timesheetSheetFields(input.draft, { reviewerPreview: input.reviewing === true }),
    payrollLines: input.lines,
    extrasMode: input.decided ? 'decided' : 'raw',
    applyLabourReviews: input.reviewing === true ? true : null,
    timesheetDays: input.timesheetDays ?? null,
    timeZone: input.timeZone ?? null,
    // Rulebook 1.45.0: the draft is the loaded copy; its entries carry the reader's fingerprints.
    entryFingerprints: timesheetEntryFingerprintMap([...input.draft.priceWorkEntries, ...input.draft.expenseEntries]),
  })
}

export function managerAdjustmentCount(draft: TimesheetDraft): number {
  return managerAdjustmentRows(draft).length
}

export function showsTimesheetAdjustment(input: {
  original: number
  effective: number
  decision: TimesheetManagerDecision
  managerHasSigned: boolean
  applyLiveReview?: boolean
}): boolean {
  const { original, effective, decision, managerHasSigned, applyLiveReview = false } = input
  return (
    (managerHasSigned || applyLiveReview) &&
    decision !== 'approved' &&
    decision !== 'pending' &&
    (original !== effective || decision === 'declined')
  )
}

export function managerAdjustmentRows(draft: TimesheetDraft, currencyCode?: string): ManagerAdjustmentRow[] {
  const money = (amount: number) => formatMoney(amount, currencyCode)
  const rows: ManagerAdjustmentRow[] = []
  for (const entry of draft.expenseEntries) {
    if (entry.managerDecision === 'approved' || entry.managerDecision === 'pending') continue
    rows.push({
      title: `Expense: ${entry.title}`,
      decision: entry.managerDecision,
      detail:
        entry.managerDecision === 'edited'
          ? `${money(entry.amount)} → ${money(entry.managerRevisedAmount ?? entry.amount)}`
          : null,
    })
  }
  for (const entry of draft.priceWorkEntries) {
    if (entry.managerDecision === 'approved' || entry.managerDecision === 'pending') continue
    rows.push({
      title: `Price work: ${entry.title}`,
      decision: entry.managerDecision,
      detail:
        entry.managerDecision === 'edited'
          ? `${money(entry.amount)} → ${money(entry.managerRevisedAmount ?? entry.amount)}`
          : null,
    })
  }
  for (const [lineId, review] of Object.entries(draft.payrollLineReviews)) {
    if (review.decision !== 'declined' && review.decision !== 'edited') continue
    rows.push({
      title: `${review.decision === 'declined' ? 'Day removed' : 'Day adjusted'} (${lineId.slice(0, 8)}…)`,
      decision: review.decision,
      detail:
        review.decision === 'edited' ? `New amount ${money(review.revisedAmount ?? 0)}` : null,
    })
  }
  return rows
}
