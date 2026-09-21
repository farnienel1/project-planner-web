/**
 * iOS parity: Views/InvoicingView.swift applyPayrollReviewSave / applyExtraReviewSave
 */
import type { TimesheetManagerDecision, TimesheetPayrollLineReview } from '@/lib/timesheets/timesheetDraft'

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
  return { decision, revisedAmount: unchanged ? null : revisedAmount }
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
      managerRevisedAmount: unchanged ? null : revisedAmount,
    }
  }
  return { managerDecision: 'edited', managerRevisedAmount: revisedAmount }
}
