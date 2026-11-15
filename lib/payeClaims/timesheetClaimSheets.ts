/**
 * Rulebook 1.45.0 §8 / §26 (guardrail 1, review #322): a self-employed person's timesheets for Users' read-only Price
 * work / Expenses rows. A person's sheets may be filed under any id they go by (`personIdSet`: their own id,
 * `formerUserIds`, `sameEmailUserIds`), so the screen reads under every one. Each sheet is read through
 * `parseTimesheetEntries` with all of those ids as the owner's, so evidence they uploaded under their current id stays
 * on a sheet filed under an older one. Pure: the Firestore reads are in `payeClaimsData.ts`.
 */
import { parseTimesheetEntries, type TimesheetEntriesDocument } from '@/lib/canonical'

export type TimesheetClaimSheet = { id: string; entries: TimesheetEntriesDocument }

/** The person's timesheet documents (any of the given reads, each sheet once by document id), parsed. */
export function timesheetClaimSheetsFromDocs(
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>,
  ownerUserIds: ReadonlyArray<string>,
  timeZone: string
): TimesheetClaimSheet[] {
  const seen = new Set<string>()
  const out: TimesheetClaimSheet[] = []
  for (const row of docs) {
    if (!row.id.startsWith('timesheet_') || seen.has(row.id)) continue
    seen.add(row.id)
    out.push({ id: row.id, entries: parseTimesheetEntries(row.id, row.data, { timeZone, ownerUserIds }) })
  }
  return out
}
