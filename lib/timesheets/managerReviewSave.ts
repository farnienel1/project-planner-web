/**
 * iOS parity: Views/InvoicingView.swift applyExtraReviewSave. Rulebook 1.72.0: a labour line's Edit hours changes the
 * booking (`timesheetReviewBookingEditWrites`), so the payroll review save is gone.
 */
import type { TimesheetManagerDecision } from '@/lib/timesheets/timesheetDraft'
import { roundPennies } from '@/lib/canonical/payRate'

const AMOUNT_EPS = 0.01

export function amountsUnchanged(revised: number, original: number): boolean {
  return Math.abs(revised - original) < AMOUNT_EPS
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
