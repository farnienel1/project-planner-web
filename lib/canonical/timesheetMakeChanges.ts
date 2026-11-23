/**
 * Rulebook 1.76.0 §8 (owner decisions 23 Nov, A1 and B1): the reviewer's "Make changes" button on a timesheet.
 *
 * - **Signed off, not exported** (`reopenReview`, A1): the line manager or an admin reopens the review on the page and
 *   changes labour lines with ⚙ / ✕ — booking edits (1.72.0), recorded on the sheet in `reviewerBookingEdits` (1.74.0) so
 *   the sheet never goes back to the person. Nothing is written by the button itself: the first booking edit makes the
 *   signed snapshot stale, `signedTimesheetBookingChanges` reads the sheet as reopened and waiting for the line manager
 *   (Awaiting sign-off; no export or invoice on the stale snapshot), and the counter-signature again rebuilds the snapshot
 *   from the live bookings and tells the person ("changed and signed off", `timesheetSignedNoticeText`). Leaving without
 *   a change leaves the sheet exactly as signed. The person never signs again for these edits.
 * - **Exported** (`createRevision`, B1): the next revision is created (`canCreateTimesheetRevision`,
 *   `timesheetRevisionCreateFields`, 1.55.0 — the old "Create revision" button, renamed). The reviewer may then change
 *   the revision's labour lines before the person signs it (`timesheetRevisionReviewerMayEditBookings`); the person signs,
 *   the line manager signs off and it is exported as REV N, as before.
 * - **Anything else**: no button (`null`) — the person themselves, a sheet not counter-signed yet (the reviewer is
 *   already reviewing it), a sheet already reopened (already back in review, or with the person), a self-signed sheet
 *   (nobody counter-signs it), or an exported sheet whose next revision cannot be created (one is already open).
 */
import { parseTimesheetStatusFields, isTimesheetManagerSigned, isTimesheetOperativeSigned, resolveTimesheetExportedAtMs } from './timesheetPeriod'
import { timesheetSheetIsRevision } from './timesheetSnapshot'

export const TIMESHEET_MAKE_CHANGES_LABEL = 'Make changes'
/** Help under the button on a signed-off (not exported) sheet. */
export const TIMESHEET_MAKE_CHANGES_REOPEN_HELP =
  'Change or remove bookings on this timesheet with ⚙ and ✕, then sign it off again. The person does not sign again; they are told it was changed and signed off.'
/** Help under the button on an exported sheet. */
export const TIMESHEET_MAKE_CHANGES_REVISION_HELP =
  'This timesheet has been exported, so changes go on a new revision. You can change its bookings, then the person signs it again and you sign it off. It is exported as the next REV.'
/** Shown while the reviewer has pressed Make changes on a signed-off sheet and has not changed anything yet. */
export const TIMESHEET_MAKE_CHANGES_ACTIVE_NOTE =
  'Making changes: use ⚙ to change a booking or ✕ to remove it. The timesheet stays signed off until you change something; then sign it off again.'
export const TIMESHEET_MAKE_CHANGES_CANCEL_LABEL = 'Stop making changes'
/**
 * Review of #427 (finding 1): a signed-off sheet whose signed copy cannot tell a changed booking (signed before 1.46.0 —
 * its labour lines carry no `bookingFingerprint` — or no signed copy at all) gets no Make changes: a ⚙ time change would
 * not reopen it, so it could be exported at the old hours with no way to sign it off again.
 */
export const TIMESHEET_MAKE_CHANGES_OLD_SHEET_HELP =
  'This timesheet was signed before 14 Nov. Export it, then use Make changes to correct it in a revision.'
/** On a revision the person has not signed yet, for the reviewer. */
export const TIMESHEET_REVISION_REVIEWER_EDIT_NOTE =
  'You can change or remove this revision’s bookings with ⚙ and ✕ before the person signs it.'

export type TimesheetMakeChangesAction = 'reopenReview' | 'createRevision'

export type TimesheetMakeChangesInput = {
  /** The viewer reviews this person's timesheets (`timesheetWriterIsReviewer`: their line manager or an admin, never the person). */
  viewerIsReviewer: boolean
  /** The viewer is the sheet's person under any of their ids (always no button). */
  viewerIsSubject?: boolean | null
  /** The person's sheet is self-signed (`timesheetSelfSigned`): nobody counter-signs it. */
  selfSigned?: boolean | null
  /**
   * The sheet's booking change (`signedTimesheetBookingChanges`, folded with late extras by
   * `timesheetChangesWithLateExtras`). A reopened sheet is already in review or with the person.
   */
  change?: { reopened?: boolean | null } | null
  /** `canCreateTimesheetRevision(...).allowed` for this pay run's chain (exported sheets only). */
  revisionAllowed?: boolean | null
}

/**
 * The signed copy (`weeklyReportOverride.lines`) can tell a changed booking: it exists and every labour line (not leave,
 * not a PAYE day, not an Edit hours part of another line) carries a `bookingFingerprint` (written from 1.46.0). With no
 * labour line there is nothing to change.
 */
export function timesheetSignedCopyTracksBookings(sheet: Record<string, unknown> | null | undefined): boolean {
  const override = sheet?.weeklyReportOverride
  if (!override || typeof override !== 'object') return false
  const lines = (override as { lines?: unknown }).lines
  if (!Array.isArray(lines)) return false
  const labour = lines.filter((line) => {
    if (!line || typeof line !== 'object') return false
    const row = line as Record<string, unknown>
    if (row.isLeave === true || row.isPayeDay === true) return false
    return !(typeof row.reviewPartOf === 'string' && row.reviewPartOf.trim() !== '')
  }) as Array<Record<string, unknown>>
  if (labour.length === 0) return false
  return labour.every((row) => typeof row.bookingFingerprint === 'string' && row.bookingFingerprint.trim() !== '')
}

/** Signed off, not exported, not self-signed, not reopened, viewed by a reviewer who is not the person. */
function signedOffForReview(sheet: Record<string, unknown>, input: TimesheetMakeChangesInput): boolean {
  if (input.viewerIsReviewer !== true || input.viewerIsSubject === true || input.selfSigned === true) return false
  if (resolveTimesheetExportedAtMs(sheet) != null) return false
  const fields = parseTimesheetStatusFields(sheet)
  if (!isTimesheetOperativeSigned(fields) || !isTimesheetManagerSigned(fields)) return false
  return input.change?.reopened !== true
}

/**
 * What the reviewer's "Make changes" button does on this sheet, or null when it is not shown. `sheet` carries the
 * signatures, `exportedAt` / `invoiceGeneratedAt` and the signed copy (`weeklyReportOverride`, its lines'
 * `bookingFingerprint`, `isLeave`, `isPayeDay`, `reviewPartOf`).
 */
export function timesheetMakeChangesAction(
  sheet: Record<string, unknown> | null | undefined,
  input: TimesheetMakeChangesInput
): TimesheetMakeChangesAction | null {
  if (!sheet || input.viewerIsReviewer !== true || input.viewerIsSubject === true) return null
  if (resolveTimesheetExportedAtMs(sheet) != null) return input.revisionAllowed === true ? 'createRevision' : null
  if (!signedOffForReview(sheet, input)) return null
  return timesheetSignedCopyTracksBookings(sheet) ? 'reopenReview' : null
}

/**
 * The help text under the button for an action. With no action, pass the sheet and the same input: a signed-off sheet
 * whose signed copy cannot tell a changed booking (finding 1) reads `TIMESHEET_MAKE_CHANGES_OLD_SHEET_HELP`; otherwise null.
 */
export function timesheetMakeChangesHelp(
  action: TimesheetMakeChangesAction | null | undefined,
  sheet?: Record<string, unknown> | null,
  input?: TimesheetMakeChangesInput | null
): string | null {
  if (action === 'reopenReview') return TIMESHEET_MAKE_CHANGES_REOPEN_HELP
  if (action === 'createRevision') return TIMESHEET_MAKE_CHANGES_REVISION_HELP
  if (sheet && input && signedOffForReview(sheet, input) && !timesheetSignedCopyTracksBookings(sheet)) {
    return TIMESHEET_MAKE_CHANGES_OLD_SHEET_HELP
  }
  return null
}

/**
 * B1: a reviewer may change a revision's bookings (⚙ / ✕, 1.72.0) while the revision is open and the person has not
 * signed it yet — no ✓ (nothing to approve before the person signs). Once the person signs, the normal review applies.
 * Never on an exported version, never for the person, never on an original sheet (only revisions).
 */
export function timesheetRevisionReviewerMayEditBookings(
  sheet: Record<string, unknown> | null | undefined,
  input: Pick<TimesheetMakeChangesInput, 'viewerIsReviewer' | 'viewerIsSubject'>
): boolean {
  if (!sheet || input.viewerIsReviewer !== true || input.viewerIsSubject === true) return false
  if (!timesheetSheetIsRevision(sheet as { revision?: unknown; revisionOf?: unknown })) return false
  if (resolveTimesheetExportedAtMs(sheet) != null) return false
  return !isTimesheetOperativeSigned(parseTimesheetStatusFields(sheet))
}
