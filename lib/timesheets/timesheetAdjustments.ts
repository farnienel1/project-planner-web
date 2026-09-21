/**
 * iOS parity: Views/TimesheetManagerReviewSupport.swift TimesheetDraftAdjustments
 */
import type { TimesheetDraft, TimesheetExpenseEntry, TimesheetPriceWorkEntry } from '@/lib/timesheets/timesheetDraft'
import type { TimesheetPayrollLineItem } from '@/lib/timesheets/timesheetPayrollCollector'

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
  const payroll = Object.values(draft.payrollLineReviews).filter(
    (review) => review.decision === 'declined' || review.decision === 'edited'
  ).length
  const extras = [...draft.expenseEntries, ...draft.priceWorkEntries].filter(
    (entry) => entry.managerDecision === 'declined' || entry.managerDecision === 'edited'
  ).length
  return payroll + extras
}
