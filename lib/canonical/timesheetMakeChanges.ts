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

/** What the reviewer's "Make changes" button does on this sheet, or null when it is not shown. */
export function timesheetMakeChangesAction(
  sheet: Record<string, unknown> | null | undefined,
  input: TimesheetMakeChangesInput
): TimesheetMakeChangesAction | null {
  if (!sheet || input.viewerIsReviewer !== true || input.viewerIsSubject === true) return null
  if (resolveTimesheetExportedAtMs(sheet) != null) return input.revisionAllowed === true ? 'createRevision' : null
  if (input.selfSigned === true) return null
  const fields = parseTimesheetStatusFields(sheet)
  if (!isTimesheetOperativeSigned(fields) || !isTimesheetManagerSigned(fields)) return null
  if (input.change?.reopened === true) return null
  return 'reopenReview'
}

/** The help text under the button for an action. */
export function timesheetMakeChangesHelp(action: TimesheetMakeChangesAction | null | undefined): string | null {
  if (action === 'reopenReview') return TIMESHEET_MAKE_CHANGES_REOPEN_HELP
  if (action === 'createRevision') return TIMESHEET_MAKE_CHANGES_REVISION_HELP
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
