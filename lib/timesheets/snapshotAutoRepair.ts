/**
 * Owner item 5 (17 Nov follow-up): the 1.43.0 repair of a signed snapshot frozen with no labour lines
 * (`timesheetSnapshotNeedsRebuild`) no longer waits for a reviewer to open that one sheet. When a line manager or an
 * admin has the Timesheets hub or User Timesheets open, every such sheet in the loaded pay runs that they may write is
 * rebuilt in the background through the exact existing path — `applyWeeklyReportOverride` (signatures and who approved
 * it kept, never an exported sheet, never a snapshot with a labour line) then `saveTimesheetDraft` (only the changed
 * fields) — once per sheet per session, and only once the bookings and the pay inputs have loaded.
 *
 * This file is the pure choice of which sheets to repair; `useSnapshotAutoRepair` does the reads and the save.
 */
import { timesheetSnapshotNeedsRebuild, timesheetWriterIsReviewer, seesEveryUserTimesheet } from '@/lib/canonical'
import { staffAccountRole } from '@/lib/permissions'
import { rulebookRoster } from '@/lib/staff/rulebookPeople'
import { lineManagerUserIds } from '@/lib/timesheets/timesheetApprovalPolicy'
import { userIdsSharingEmail } from '@/lib/timesheets/timesheetWeekUtils'
import type { TimesheetPayrollLineItem } from '@/lib/timesheets/timesheetPayrollCollector'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import type { User } from '@/types'

export type RepairSheet = { member: User; period: { start: Date; end: Date }; draft: TimesheetDraft; documentId: string | null }

/** Whether `viewer` may write `member`'s review fields (`timesheetWriterIsReviewer`, the rules' isTimesheetReviewer). */
export function viewerReviewsTimesheet(viewer: User | null | undefined, member: User, users: ReadonlyArray<User>): boolean {
  if (!viewer) return false
  return timesheetWriterIsReviewer({
    writerUserId: viewer.id,
    subjectUserId: member.id,
    writerIsAdmin: seesEveryUserTimesheet(staffAccountRole(viewer)),
    writerFormerIds: viewer.formerUserIds ?? [],
    writerAliasIds: userIdsSharingEmail(viewer, [...users]),
    subjectLineManagerIds: lineManagerUserIds(member, [...users]),
    roster: rulebookRoster([...users]),
  })
}

/**
 * The sheets to repair now: a stored document (its id known), a signed snapshot with no labour line, not exported,
 * `timesheetSnapshotNeedsRebuild` true against the period's live lines, a pay run the loaded bookings cover, a person
 * the viewer reviews whose own pay has been read (`payReady`), and not tried already this session (`tried`, by
 * organisation and document id).
 */
export function snapshotRepairCandidates(input: {
  organizationId: string
  sheets: ReadonlyArray<RepairSheet>
  viewer: User | null | undefined
  users: ReadonlyArray<User>
  liveLinesFor: (sheet: RepairSheet) => ReadonlyArray<TimesheetPayrollLineItem>
  coversPeriod?: (period: { start: Date; end: Date }) => boolean
  /**
   * Review of #368 (B2): this person's own pay has been read (`payStatusFor(member) === 'ready'`, as Export asks). A sheet
   * whose person's pay is still loading or failed is left for a later pass — never rebuilt from a stripped record.
   */
  payReady?: (member: User) => boolean
  tried: ReadonlySet<string>
}): Array<RepairSheet & { key: string }> {
  const out: Array<RepairSheet & { key: string }> = []
  const seen = new Set<string>()
  for (const sheet of input.sheets) {
    if (!sheet.documentId) continue
    const key = `${input.organizationId}|${sheet.documentId}`
    if (seen.has(key) || input.tried.has(key)) continue
    const override = sheet.draft.weeklyReportOverride
    if (!override || override.lines.length > 0 || sheet.draft.exportedAt) continue
    if (input.coversPeriod && !input.coversPeriod(sheet.period)) continue
    if (input.payReady && !input.payReady(sheet.member)) continue
    if (!viewerReviewsTimesheet(input.viewer, sheet.member, input.users)) continue
    if (!timesheetSnapshotNeedsRebuild(sheet.draft, input.liveLinesFor(sheet))) continue
    seen.add(key)
    out.push({ ...sheet, key })
  }
  return out
}
