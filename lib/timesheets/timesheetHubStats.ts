/**
 * Hub tile numbers and User Timesheets tabs share this identity.
 * Awaiting / Signed off are the current pay-run roster buckets.
 * Exported is every leftover-filtered history row the reviewer can see —
 * not "exported this pay run".
 */
import { timesheetListBucket, type TimesheetStatusFields } from '@/lib/canonical'
import { requiresLineManagerCounterSign } from '@/lib/timesheets/timesheetApprovalPolicy'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import type { User } from '@/types'

export function timesheetStatusFieldsFromDraft(draft: TimesheetDraft): TimesheetStatusFields {
  return {
    operativeSignedAtMs: draft.operativeSignedAt?.getTime() ?? null,
    operativeSignedByName: draft.operativeSignedByName || '',
    operativeSignatureImageBase64: draft.operativeSignatureImageBase64 || '',
    managerSignedAtMs: draft.managerSignedAt?.getTime() ?? null,
    managerSignedByName: draft.managerSignedByName || '',
    managerSignedByUserId: draft.managerSignedByUserId || '',
    managerSignatureImageBase64: draft.managerSignatureImageBase64 || '',
    exportedAtMs: draft.exportedAt?.getTime() ?? null,
  }
}

/** Same pick as the Awaiting / Signed-off lists: prefer a signed sheet in the email group. */
export function pickTimesheetGroupDraft(
  group: User[],
  drafts: ReadonlyMap<string, TimesheetDraft>
): { member: User; draft: TimesheetDraft } | null {
  const signed = group
    .map((member) => ({ member, draft: drafts.get(member.id) }))
    .find((row) => row.draft?.operativeSignedAt)
  if (signed?.draft) return { member: signed.member, draft: signed.draft }
  const any = group.map((member) => ({ member, draft: drafts.get(member.id) })).find((row) => row.draft)
  return any?.draft ? { member: any.member, draft: any.draft } : null
}

/**
 * `users` is the organisation roster: only a self-signed admin (`timesheetSelfSigned(user, roster)`) skips the
 * counter-signature; everyone else waits for their line manager, or the admins.
 */
export function currentPeriodTimesheetMembers(
  groups: User[][],
  drafts: ReadonlyMap<string, TimesheetDraft>,
  bucket: 'awaiting' | 'signed' | 'exported',
  users: ReadonlyArray<User> = [],
  /**
   * Rulebook 1.47.0 §8: the sheet's `signedTimesheetBookingChanges` (when the caller has the live bookings) — a reopened
   * sheet waiting for the person leaves Awaiting / Signed off; one the person signed again is Awaiting again.
   */
  bookingChange?: (member: User, draft: TimesheetDraft) => { reopened?: boolean | null; waitingFor?: 'person' | 'lineManager' | null } | null
): User[] {
  const rows: User[] = []
  for (const group of groups) {
    const picked = pickTimesheetGroupDraft(group, drafts)
    if (!picked) continue
    const counterSign = requiresLineManagerCounterSign(picked.member, users)
    if (timesheetListBucket(timesheetStatusFieldsFromDraft(picked.draft), counterSign, bookingChange?.(picked.member, picked.draft) ?? null) === bucket) {
      rows.push(picked.member)
    }
  }
  return rows
}

type BookingChangeOf = Parameters<typeof currentPeriodTimesheetMembers>[4]

export function currentPeriodTimesheetBucketCounts(
  groups: User[][],
  drafts: ReadonlyMap<string, TimesheetDraft>,
  users: ReadonlyArray<User> = [],
  /** Rulebook 1.47.0 §8: as `currentPeriodTimesheetMembers`. */
  bookingChange?: BookingChangeOf
): { awaiting: number; signed: number; exported: number } {
  return {
    awaiting: currentPeriodTimesheetMembers(groups, drafts, 'awaiting', users, bookingChange).length,
    signed: currentPeriodTimesheetMembers(groups, drafts, 'signed', users, bookingChange).length,
    exported: currentPeriodTimesheetMembers(groups, drafts, 'exported', users, bookingChange).length,
  }
}

/**
 * Hub tiles: Awaiting + Signed off from the current pay-run list, Exported from
 * the same history universe as User Timesheets → Exported.
 */
export function timesheetReviewerHubStats(input: {
  groups: User[][]
  currentPeriodDrafts: ReadonlyMap<string, TimesheetDraft>
  exportedHistoryCount: number
  /** The organisation roster (`timesheetSelfSigned`). */
  users?: ReadonlyArray<User>
  /** Rulebook 1.47.0 §8: the sheet's booking changes (`signedTimesheetBookingChanges`), when the live bookings loaded. */
  bookingChange?: BookingChangeOf
}): { awaiting: number; signed: number; exported: number } {
  const current = currentPeriodTimesheetBucketCounts(input.groups, input.currentPeriodDrafts, input.users ?? [], input.bookingChange)
  return {
    awaiting: current.awaiting,
    signed: current.signed,
    exported: Math.max(0, Math.floor(Number(input.exportedHistoryCount) || 0)),
  }
}
