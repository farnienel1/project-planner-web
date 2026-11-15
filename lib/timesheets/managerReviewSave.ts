/**
 * iOS parity: Views/InvoicingView.swift applyPayrollReviewSave / applyExtraReviewSave
 */
import type { TimesheetManagerDecision, TimesheetPayrollLineReview } from '@/lib/timesheets/timesheetDraft'
import { roundPennies } from '@/lib/canonical/payRate'

const AMOUNT_EPS = 0.01

export function amountsUnchanged(revised: number, original: number): boolean {
  return Math.abs(revised - original) < AMOUNT_EPS
}

export function payrollReviewAfterSave(
  prior: TimesheetManagerDecision | undefined,
  originalAmount: number,
  revisedAmount: number
): TimesheetPayrollLineReview {
  const unchanged = amountsUnchanged(revisedAmount, originalAmount)
  let decision: TimesheetManagerDecision
  if (prior === 'declined') decision = 'approved'
  else if (unchanged) decision = 'approved'
  else decision = 'edited'
  // 1.46.0: a revised amount is stored in pennies (`roundPennies`).
  return { decision, revisedAmount: unchanged ? null : roundPennies(revisedAmount) }
}

export function extraReviewAfterSave(
  prior: TimesheetManagerDecision,
  originalAmount: number,
  revisedAmount: number
): { managerDecision: TimesheetManagerDecision; managerRevisedAmount: number | null } {
  const unchanged = amountsUnchanged(revisedAmount, originalAmount)
  if (prior === 'declined' || unchanged) {
    return {
      managerDecision: 'approved',
      managerRevisedAmount: unchanged ? null : roundPennies(revisedAmount),
    }
  }
  return { managerDecision: 'edited', managerRevisedAmount: roundPennies(revisedAmount) }
}
