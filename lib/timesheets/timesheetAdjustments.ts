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
  const review = draft.payrollLineReviews[line.id]
  if (!review) return line.amount
  switch (review.decision) {
    case 'declined':
      return 0
    case 'edited':
      return review.revisedAmount ?? line.amount
    default:
      return line.amount
  }
}

export function isPayrollLineRemoved(
  line: TimesheetPayrollLineItem,
  draft: TimesheetDraft,
  managerHasSigned: boolean,
  applyLiveReview = false
): boolean {
  const applyDecisions = managerHasSigned || applyLiveReview
  if (!applyDecisions) return false
  return draft.payrollLineReviews[line.id]?.decision === 'declined'
}

export function effectiveExpenseAmount(
  entry: TimesheetExpenseEntry,
  managerHasSigned: boolean,
  applyLiveReview = false
): number {
  if (!(managerHasSigned || applyLiveReview)) return entry.amount
  switch (entry.managerDecision) {
    case 'declined':
      return 0
    case 'edited':
      return entry.managerRevisedAmount ?? entry.amount
    default:
      return entry.amount
  }
}

export function effectivePriceWorkAmount(
  entry: TimesheetPriceWorkEntry,
  managerHasSigned: boolean,
  applyLiveReview = false
): number {
  if (!(managerHasSigned || applyLiveReview)) return entry.amount
  switch (entry.managerDecision) {
    case 'declined':
      return 0
    case 'edited':
      return entry.managerRevisedAmount ?? entry.amount
    default:
      return entry.amount
  }
}

export function extrasPendingReview(draft: TimesheetDraft): boolean {
  return (
    draft.expenseEntries.some((entry) => entry.managerDecision === 'pending') ||
    draft.priceWorkEntries.some((entry) => entry.managerDecision === 'pending')
  )
}

export function payrollTotal(
  lines: TimesheetPayrollLineItem[],
  draft: TimesheetDraft,
  managerHasSigned: boolean,
  applyLiveReview = false
): number {
  return lines.reduce(
    (sum, line) => sum + effectivePayrollAmount(line, draft, managerHasSigned, applyLiveReview),
    0
  )
}

export function expensesTotal(draft: TimesheetDraft, managerHasSigned: boolean, applyLiveReview = false): number {
  return draft.expenseEntries.reduce(
    (sum, entry) => sum + effectiveExpenseAmount(entry, managerHasSigned, applyLiveReview),
    0
  )
}

export function priceWorkTotal(draft: TimesheetDraft, managerHasSigned: boolean, applyLiveReview = false): number {
  return draft.priceWorkEntries.reduce(
    (sum, entry) => sum + effectivePriceWorkAmount(entry, managerHasSigned, applyLiveReview),
    0
  )
}

export function grandTotal(
  lines: TimesheetPayrollLineItem[],
  draft: TimesheetDraft,
  managerHasSigned: boolean,
  applyLiveReview = false
): number {
  return (
    payrollTotal(lines, draft, managerHasSigned, applyLiveReview) +
    expensesTotal(draft, managerHasSigned, applyLiveReview) +
    priceWorkTotal(draft, managerHasSigned, applyLiveReview)
  )
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

export function managerAdjustmentRows(draft: TimesheetDraft): ManagerAdjustmentRow[] {
  const rows: ManagerAdjustmentRow[] = []
  for (const entry of draft.expenseEntries) {
    if (entry.managerDecision === 'approved' || entry.managerDecision === 'pending') continue
    rows.push({
      title: `Expense: ${entry.title}`,
      decision: entry.managerDecision,
      detail:
        entry.managerDecision === 'edited'
          ? `£${entry.amount.toFixed(2)} → £${(entry.managerRevisedAmount ?? entry.amount).toFixed(2)}`
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
          ? `£${entry.amount.toFixed(2)} → £${(entry.managerRevisedAmount ?? entry.amount).toFixed(2)}`
          : null,
    })
  }
  for (const [lineId, review] of Object.entries(draft.payrollLineReviews)) {
    if (review.decision !== 'declined' && review.decision !== 'edited') continue
    rows.push({
      title: `${review.decision === 'declined' ? 'Day removed' : 'Day adjusted'} (${lineId.slice(0, 8)}…)`,
      decision: review.decision,
      detail:
        review.decision === 'edited' ? `New amount £${(review.revisedAmount ?? 0).toFixed(2)}` : null,
    })
  }
  return rows
}
