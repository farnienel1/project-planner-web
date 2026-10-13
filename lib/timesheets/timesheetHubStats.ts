/**
 * Hub tile numbers and User Timesheets tabs share this identity.
 * Awaiting / Signed off are the current pay-run roster buckets.
 * Exported is every leftover-filtered history row the reviewer can see —
 * not "exported this pay run".
 */
import { timesheetListBucket, type TimesheetStatusFields } from '@/lib/canonical'
import { groupHasLineManager } from '@/lib/timesheets/timesheetWeekUtils'
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

export function currentPeriodTimesheetMembers(
  groups: User[][],
  drafts: ReadonlyMap<string, TimesheetDraft>,
  bucket: 'awaiting' | 'signed' | 'exported'
): User[] {
  const rows: User[] = []
  for (const group of groups) {
    const picked = pickTimesheetGroupDraft(group, drafts)
    if (!picked) continue
    if (timesheetListBucket(timesheetStatusFieldsFromDraft(picked.draft), groupHasLineManager(group)) === bucket) {
      rows.push(picked.member)
    }
  }
  return rows
}

export function currentPeriodTimesheetBucketCounts(
  groups: User[][],
  drafts: ReadonlyMap<string, TimesheetDraft>
): { awaiting: number; signed: number; exported: number } {
  return {
    awaiting: currentPeriodTimesheetMembers(groups, drafts, 'awaiting').length,
    signed: currentPeriodTimesheetMembers(groups, drafts, 'signed').length,
    exported: currentPeriodTimesheetMembers(groups, drafts, 'exported').length,
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
}): { awaiting: number; signed: number; exported: number } {
  const current = currentPeriodTimesheetBucketCounts(input.groups, input.currentPeriodDrafts)
  return {
    awaiting: current.awaiting,
    signed: current.signed,
    exported: Math.max(0, Math.floor(Number(input.exportedHistoryCount) || 0)),
  }
}
