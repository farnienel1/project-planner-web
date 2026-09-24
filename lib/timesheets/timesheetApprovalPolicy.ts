/**
 * iOS parity: Views/InvoicingView.swift TimesheetApprovalPolicy,
 * Core/LineManagerSupport.swift
 */
import type { User } from '@/types'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'

export function lineManagerUserIds(user: User): string[] {
  const ids = [
    ...(user.assignedManagerUserIds || []),
    user.assignedManagerUserId || '',
  ]
    .map((id) => id.trim())
    .filter(Boolean)
  const seen = new Set<string>()
  return ids.filter((id) => {
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

export function userHasLineManager(user: User): boolean {
  if (user.hasNoLineManager) return false
  return lineManagerUserIds(user).length > 0
}

export function requiresLineManagerCounterSign(user: User): boolean {
  return userHasLineManager(user)
}

export function isTimesheetFullyApproved(draft: TimesheetDraft, user: User): boolean {
  if (!draft.operativeSignedAt) return false
  if (requiresLineManagerCounterSign(user)) return Boolean(draft.managerSignedAt)
  return true
}

/** Awaiting sign-off = operative signed, manager not yet, and a line manager exists. */
export function awaitingManagerSignOff(draft: TimesheetDraft, user: User): boolean {
  return requiresLineManagerCounterSign(user) && Boolean(draft.operativeSignedAt) && !draft.managerSignedAt
}

export function applySelfApprovalIfNoLineManager(draft: TimesheetDraft, user: User): TimesheetDraft {
  if (requiresLineManagerCounterSign(user) || !draft.operativeSignedAt) return draft
  if (
    draft.managerSignedAt ||
    draft.managerSignedByName ||
    draft.managerSignedByUserId ||
    draft.managerSignatureImageBase64
  ) {
    return {
      ...draft,
      managerSignedAt: null,
      managerSignedByName: null,
      managerSignedByUserId: null,
      managerSignatureImageBase64: null,
    }
  }
  return draft
}

export function clearSignatures(draft: TimesheetDraft): TimesheetDraft {
  return {
    ...draft,
    operativeSignedAt: null,
    operativeSignedByName: null,
    operativeSignatureImageBase64: null,
    managerSignedAt: null,
    managerSignedByName: null,
    managerSignedByUserId: null,
    managerSignatureImageBase64: null,
    exportedAt: null,
    weeklyReportOverride: null,
    payrollLineReviews: {},
    expenseEntries: draft.expenseEntries.map((entry) => ({
      ...entry,
      managerDecision: 'approved' as const,
      managerRevisedAmount: null,
    })),
    priceWorkEntries: draft.priceWorkEntries.map((entry) => ({
      ...entry,
      managerDecision: 'approved' as const,
      managerRevisedAmount: null,
    })),
  }
}

export function hoursWarningCopy(user: User): string {
  return userHasLineManager(user)
    ? "If you don't agree with the hours shown, contact your line manager to amend your booking schedule before signing. Agreed changes appear on a new timesheet."
    : "If you don't agree with the hours shown, amend your booking schedule before signing. Agreed changes appear on a new timesheet."
}

/** Shown under Signed off. Exact copy shared with iOS. */
export const SIGNED_OFF_EDIT_NOTE =
  'To edit this timesheet, please go to the signed off timesheets page, export it and then edit within the exported timesheets tab.'

/** iOS MyTimesheetView.postSignWarningMessage — only used once the sheet is fully approved. */
export function postSignExtraWarningCopy(user: User, draft: TimesheetDraft): string {
  if (requiresLineManagerCounterSign(user) && draft.managerSignedAt) {
    return 'You have already signed your timesheet and your line manager has signed it off. If you add price work or expenses, you will need to have your timesheet signed again by yourself and your line manager.'
  }
  return 'You have already signed your timesheet. If you add price work or expenses, you will need to sign it again before generating an invoice.'
}
