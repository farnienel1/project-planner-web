/**
 * iOS parity: Views/InvoicingView.swift TimesheetApprovalPolicy,
 * Core/LineManagerSupport.swift
 *
 * Status math lives in `lib/canonical/timesheetPeriod.ts`. This file only
 * adapts the web User / TimesheetDraft shapes.
 */
import type { User } from '@/types'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import {
  isTimesheetAwaitingSignOff,
  lineManagerIds,
  isTimesheetFullySigned,
  isTimesheetOperativeSigned,
  timesheetRequiresManagerCounterSign,
  timesheetTimestampMs,
} from '@/lib/canonical'

/**
 * `lineManagerIds` (rulebook): `assignedManagerUserIds`, else the legacy single id; none when
 * `hasNoLineManager`. The same rule as User Timesheets scope and leave approvers.
 */
export function lineManagerUserIds(user: User): string[] {
  return lineManagerIds(user)
}

export function userHasLineManager(user: User): boolean {
  return lineManagerIds(user).length > 0
}

export function requiresLineManagerCounterSign(user: User): boolean {
  return timesheetRequiresManagerCounterSign(userHasLineManager(user))
}

function statusFields(draft: TimesheetDraft) {
  return {
    operativeSignedAtMs: timesheetTimestampMs(draft.operativeSignedAt),
    operativeSignedByName: draft.operativeSignedByName || '',
    operativeSignatureImageBase64: draft.operativeSignatureImageBase64 || '',
    managerSignedAtMs: timesheetTimestampMs(draft.managerSignedAt),
    managerSignedByName: draft.managerSignedByName || '',
    managerSignedByUserId: draft.managerSignedByUserId || '',
    managerSignatureImageBase64: draft.managerSignatureImageBase64 || '',
    exportedAtMs: timesheetTimestampMs(draft.exportedAt),
  }
}

/** A real operative signature: a date after 1 Jan 2020 plus a name or a signature image. */
export function isOperativeSigned(draft: TimesheetDraft): boolean {
  return isTimesheetOperativeSigned(statusFields(draft))
}

export function isTimesheetFullyApproved(draft: TimesheetDraft, user: User): boolean {
  return isTimesheetFullySigned(statusFields(draft), requiresLineManagerCounterSign(user))
}

/** Awaiting sign-off = operative signed, manager not yet, and a line manager exists. */
export function awaitingManagerSignOff(draft: TimesheetDraft, user: User): boolean {
  return isTimesheetAwaitingSignOff(statusFields(draft), requiresLineManagerCounterSign(user))
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
