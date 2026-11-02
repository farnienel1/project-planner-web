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
  timesheetSelfSigned,
  timesheetTimestampMs,
} from '@/lib/canonical'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'

/** The organisation roster (`users` on `organizationId`); the rules read active managers and aliases from it. */
type Roster = ReadonlyArray<User>

/**
 * `lineManagerIds(user, roster)` (rulebook §8): `assignedManagerUserIds`, else the legacy single id; none when
 * `hasNoLineManager`; only active roster members, never the person under any of their ids.
 */
export function lineManagerUserIds(user: User, users: Roster = []): string[] {
  return lineManagerIds(rulebookPerson(user, users), rulebookRoster(users))
}

export function userHasLineManager(user: User, users: Roster = []): boolean {
  return lineManagerUserIds(user, users).length > 0
}

/**
 * `timesheetSelfSigned(user, roster)`: an admin or super admin outside operative mode with no active line manager.
 * Their own signature completes the sheet; no note to the manager, no "pending manager signature".
 */
export function userTimesheetSelfSigned(user: User, users: Roster = []): boolean {
  return timesheetSelfSigned(rulebookPerson(user, users), rulebookRoster(users))
}

/** Everyone except a self-signed admin waits for a counter-signature (their line manager, else the admins). */
export function requiresLineManagerCounterSign(user: User, users: Roster = []): boolean {
  return timesheetRequiresManagerCounterSign(!userTimesheetSelfSigned(user, users))
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

export function isTimesheetFullyApproved(draft: TimesheetDraft, user: User, users: Roster = []): boolean {
  return isTimesheetFullySigned(statusFields(draft), requiresLineManagerCounterSign(user, users))
}

/** Awaiting sign-off = operative signed, manager not yet, and the sheet is not self-signed. */
export function awaitingManagerSignOff(draft: TimesheetDraft, user: User, users: Roster = []): boolean {
  return isTimesheetAwaitingSignOff(statusFields(draft), requiresLineManagerCounterSign(user, users))
}

export function applySelfApprovalIfNoLineManager(draft: TimesheetDraft, user: User, users: Roster = []): TimesheetDraft {
  if (requiresLineManagerCounterSign(user, users) || !draft.operativeSignedAt) return draft
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

export function hoursWarningCopy(user: User, users: Roster = []): string {
  return userHasLineManager(user, users)
    ? "If you don't agree with the hours shown, contact your line manager to amend your booking schedule before signing. Agreed changes appear on a new timesheet."
    : "If you don't agree with the hours shown, amend your booking schedule before signing. Agreed changes appear on a new timesheet."
}

/** Shown under Signed off. Exact copy shared with iOS. */
export const SIGNED_OFF_EDIT_NOTE =
  'To edit this timesheet, please go to the signed off timesheets page, export it and then edit within the exported timesheets tab.'

/** iOS MyTimesheetView.postSignWarningMessage — only used once the sheet is fully approved. */
export function postSignExtraWarningCopy(user: User, draft: TimesheetDraft, users: Roster = []): string {
  if (requiresLineManagerCounterSign(user, users) && draft.managerSignedAt) {
    return 'You have already signed your timesheet and your line manager has signed it off. If you add price work or expenses, you will need to have your timesheet signed again by yourself and your line manager.'
  }
  return 'You have already signed your timesheet. If you add price work or expenses, you will need to sign it again before generating an invoice.'
}
