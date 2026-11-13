/**
 * Manual annual-leave adjustments (rulebook 1.40.0 §4.4, owner decisions 11 Nov H28–H35).
 *
 * An admin or the person's line manager (never the person) adds or takes off days for ONE leave year with a reason:
 * `organizations/{orgId}/annualLeaveAdjustments/{id}` `{ userId, days, reason, yearKey, createdBy, createdAt }`
 * (createdAt the server time), written once, never changed or deleted (append-only history). `annualLeaveBalance` adds the
 * adjustments of the year shown on top of the allowance (after pro rata and carry-over), only while the person has an
 * allowance (PAYE); never carried over. Remaining may go below zero (owner answer).
 *
 * Why a collection of its own and not a list on `users/{uid}`: every member reads the roster's users documents, so
 * reasons there would be public; and an append-only list on the users document would cost every users update
 * expressions in the security rules. A create-only document is append-only by its rule, and is read only by the
 * person, their line managers and admins.
 *
 * Every adjustment tells every admin (`annual_leave_adjusted`, company activity). The older "set remaining for this
 * year" override (`annualLeaveYearAllowance` + `annualLeaveYearAllowanceKey`) is no longer offered; a stored one is
 * still read until its year ends (`annualLeaveBalance`).
 */

import { lineManagerIds, type LeaveRequester } from './leaveRequests'
import { companyActivityRecipients } from './notificationRecipients'
import { documentInstantMs, documentNumber } from './peopleDocuments'
import { idKey, idText, personIdSet, type PersonRosterRow } from './personIds'
import type { StaffAccountRole } from './staffAccess'

export const ANNUAL_LEAVE_ADJUSTMENTS_COLLECTION = 'annualLeaveAdjustments'
export const ANNUAL_LEAVE_ADJUSTED_NOTICE_TYPE = 'annual_leave_adjusted'

/** Largest single adjustment either way, in days. */
export const ANNUAL_LEAVE_ADJUSTMENT_MAX_DAYS = 365
export const ANNUAL_LEAVE_ADJUSTMENT_REASON_MAX = 200

export const ANNUAL_LEAVE_ADJUSTMENT_DAYS_MESSAGE = 'Enter the days to add or take off, in half days (for example 2 or -0.5).'
export const ANNUAL_LEAVE_ADJUSTMENT_REASON_MESSAGE = 'Add a reason for this change.'
export const ANNUAL_LEAVE_ADJUSTMENT_REASON_TOO_LONG_MESSAGE = `Keep the reason to ${ANNUAL_LEAVE_ADJUSTMENT_REASON_MAX} characters.`
export const ANNUAL_LEAVE_ADJUSTMENT_NOT_ALLOWED_MESSAGE =
  "Only an admin or this person's line manager can adjust their annual leave, and nobody adjusts their own."
export const ANNUAL_LEAVE_ADJUSTMENT_NOTE =
  'Adds or takes off days for this leave year only. It does not carry over, and it counts only while the person is PAYE.'

export type AnnualLeaveAdjustment = {
  id: string
  userId: string
  /** Days added (above 0) or taken off (below 0), half-day steps. */
  days: number
  reason: string
  /** The leave year it belongs to: the year's first day (`leaveYearBounds(...).yearKey`). */
  yearKey: string
  createdBy: string
  createdAtMs: number | null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Null when the days and reason may be saved, else the message to show. */
export function annualLeaveAdjustmentValidationError(input: { days: unknown; reason: unknown }): string | null {
  const raw = typeof input.days === 'string' ? input.days.trim() : input.days
  const days = raw === '' || raw == null ? NaN : Number(raw)
  if (
    !Number.isFinite(days) ||
    days === 0 ||
    Math.abs(days) > ANNUAL_LEAVE_ADJUSTMENT_MAX_DAYS ||
    Math.abs(days * 2 - Math.round(days * 2)) > 1e-9
  ) {
    return ANNUAL_LEAVE_ADJUSTMENT_DAYS_MESSAGE
  }
  const reason = text(input.reason)
  if (!reason) return ANNUAL_LEAVE_ADJUSTMENT_REASON_MESSAGE
  if (reason.length > ANNUAL_LEAVE_ADJUSTMENT_REASON_MAX) return ANNUAL_LEAVE_ADJUSTMENT_REASON_TOO_LONG_MESSAGE
  return null
}

export type AnnualLeaveAdjustmentActor = PersonRosterRow & { role?: StaffAccountRole | string | null }

/**
 * Whether `viewer` may add an adjustment for `subject`: an admin or Super Admin outside operative mode, or one of the
 * subject's active line managers (`lineManagerIds`) — never the subject under any of their ids. The same people as the
 * security rule.
 */
export function canAdjustAnnualLeave(
  viewer: { id?: string | null; role?: StaffAccountRole | null; email?: string | null } | null | undefined,
  subject: LeaveRequester | null | undefined,
  roster: ReadonlyArray<AnnualLeaveAdjustmentActor> | null | undefined
): boolean {
  const me = idKey(viewer?.id)
  if (!viewer || !me || !subject || !idText(subject.id)) return false
  const members = (roster || []).filter((row) => row && idText(row.id)) as PersonRosterRow[]
  if (personIdSet(subject, members).some((id) => idKey(id) === me)) return false
  const role = viewer.role
  if (role && role.isOperativeMode !== true && (role.isAdmin === true || role.isSuperAdmin === true)) return true
  const viewerIds = new Set(personIdSet({ id: viewer.id, email: viewer.email }, members).map(idKey))
  return lineManagerIds(subject, members).some((id) => viewerIds.has(idKey(id)))
}

/**
 * Whether `viewer` may see `subject`'s adjustments: the subject (amount, reason, date) and everyone who may add them
 * (the history with who and when).
 */
export function canViewAnnualLeaveAdjustments(
  viewer: { id?: string | null; role?: StaffAccountRole | null; email?: string | null } | null | undefined,
  subject: LeaveRequester | null | undefined,
  roster: ReadonlyArray<AnnualLeaveAdjustmentActor> | null | undefined
): boolean {
  const me = idKey(viewer?.id)
  if (!me || !subject) return false
  const members = (roster || []).filter((row) => row && idText(row.id)) as PersonRosterRow[]
  if (personIdSet(subject, members).some((id) => idKey(id) === me)) return true
  return canAdjustAnnualLeave(viewer, subject, roster)
}

/**
 * The fields of a new `annualLeaveAdjustments/{id}` document (the app adds `createdAt` as server time — the rules
 * require the request time — and the write metadata). Days snapped to half days, reason trimmed. No author name is
 * stored (review r306 #6): screens show the writer's roster name by `createdBy` (`annualLeaveAdjustmentAuthorName`).
 * Null when the input is refused (`annualLeaveAdjustmentValidationError`, a missing person, author or year, the
 * person themself, or a year not in `allowedYearKeys` — the apps pass the current leave year only).
 */
export function annualLeaveAdjustmentCreateFields(input: {
  userId: unknown
  days: unknown
  reason: unknown
  yearKey: unknown
  createdBy: unknown
  /** The leave years an adjustment may be added to (the screen's current leave year). Missing: any day key. */
  allowedYearKeys?: ReadonlyArray<string> | null
}): { userId: string; days: number; reason: string; yearKey: string; createdBy: string } | null {
  const userId = text(input.userId)
  const yearKey = text(input.yearKey)
  const createdBy = text(input.createdBy)
  if (!userId || !createdBy || !isDayKey(yearKey) || idKey(userId) === idKey(createdBy)) return null
  if (input.allowedYearKeys && !input.allowedYearKeys.map(text).includes(yearKey)) return null
  if (annualLeaveAdjustmentValidationError({ days: input.days, reason: input.reason })) return null
  return {
    userId,
    days: Math.round(Number(input.days) * 2) / 2,
    reason: text(input.reason),
    yearKey,
    createdBy,
  }
}

/**
 * 1.40.0 (review r306 #6): who made an adjustment, from the roster by `createdBy` (any id the writer goes by, without
 * case), never a stored free-text name. "Someone" when the writer is not on the roster (a deleted account).
 */
export function annualLeaveAdjustmentAuthorName(
  adjustment: { createdBy?: unknown } | null | undefined,
  roster: ReadonlyArray<PersonRosterRow & { firstName?: string | null; surname?: string | null; lastName?: string | null }> | null | undefined
): string {
  const by = idKey(text(adjustment?.createdBy))
  if (!by) return 'Someone'
  const members = (roster || []).filter((row) => row && idText(row.id))
  const row =
    members.find((member) => idKey(member.id) === by) ??
    members.find((member) => personIdSet(member, members as PersonRosterRow[]).some((id) => idKey(id) === by))
  if (!row) return 'Someone'
  const name = `${text(row.firstName)} ${text(row.surname) || text(row.lastName)}`.trim()
  return name || text(row.email) || 'Someone'
}

/** Reads `annualLeaveAdjustments/{id}`. Null without a person, a year or a number of days. Never drops one for its reason. */
export function parseAnnualLeaveAdjustmentDocument(docId: unknown, data: unknown): AnnualLeaveAdjustment | null {
  const id = text(docId)
  const row = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const userId = text(row.userId)
  const yearKey = text(row.yearKey)
  const days = documentNumber(row.days)
  if (!id || !userId || !isDayKey(yearKey) || days == null) return null
  return {
    id,
    userId,
    days: Math.round(days * 2) / 2,
    reason: text(row.reason),
    yearKey,
    createdBy: text(row.createdBy),
    createdAtMs: documentInstantMs(row.createdAt),
  }
}

/**
 * The adjustments of one person — stored under any id they go by (`personIdSet`, without case) — oldest first.
 * `personIds` is that set.
 */
export function annualLeaveAdjustmentsForPerson<T extends { userId?: string | null; createdAtMs?: number | null; id?: string }>(
  adjustments: ReadonlyArray<T> | null | undefined,
  personIds: ReadonlyArray<string> | null | undefined
): T[] {
  const ids = new Set((personIds || []).map(idKey).filter(Boolean))
  if (ids.size === 0) return []
  return (adjustments || [])
    .filter((row) => row && ids.has(idKey(row.userId)))
    .slice()
    .sort((a, b) => (a.createdAtMs ?? Number.MAX_SAFE_INTEGER) - (b.createdAtMs ?? Number.MAX_SAFE_INTEGER))
}

/** "+2 days", "−0.5 day", "+1 day" (a true minus sign). */
export function annualLeaveAdjustmentLabel(days: unknown): string {
  const n = Math.round(Number(days) * 2) / 2
  if (!Number.isFinite(n) || n === 0) return '0 days'
  const abs = Math.abs(n)
  const unit = abs === 1 || abs === 0.5 ? 'day' : 'days'
  return `${n > 0 ? '+' : '−'}${abs} ${unit}`
}

/**
 * `annual_leave_adjusted`: every active admin and super admin outside operative mode, never the person who made it —
 * `companyActivityRecipients` (account ids only, one per person, never a ghost).
 */
export function annualLeaveAdjustedRecipients(
  actor: Parameters<typeof companyActivityRecipients>[0],
  roster: Parameters<typeof companyActivityRecipients>[1]
): string[] {
  return companyActivityRecipients(actor, roster)
}

/** The inbox title and message for `annual_leave_adjusted`. */
export function annualLeaveAdjustedNoticeText(input: {
  personName: unknown
  actorName: unknown
  days: unknown
  reason: unknown
}): { title: string; message: string; detail: string | null } {
  const person = text(input.personName) || 'Someone'
  const actor = text(input.actorName) || 'Someone'
  const reason = text(input.reason)
  return {
    title: 'Annual leave adjusted',
    // 1.40.0 (review r306 #10): the push sends `title` and `message` only, so the reason is never on a lock screen;
    // it is the inbox row's `detail`.
    message: `${actor} adjusted ${person}'s annual leave by ${annualLeaveAdjustmentLabel(input.days)} this leave year.`,
    detail: reason ? `Reason: ${reason}` : null,
  }
}
