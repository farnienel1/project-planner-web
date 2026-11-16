/**
 * Rulebook 1.43.0 §8 (owner bug reports, 14 Nov): when a signed timesheet's snapshot may be built, when an empty one is
 * rebuilt, and when the person may still add price work or expenses.
 *
 * 1. `weeklyReportOverride` (the signed snapshot) is built once, at full approval, from the bookings the screen holds.
 *    A counter-signature made before the period's bookings had loaded froze a snapshot with no labour lines, and the
 *    invoice then showed only price work. `timesheetSnapshotReady` holds sign-off (and every save that builds the
 *    snapshot) until the bookings and pay inputs have loaded.
 * 2. `timesheetSnapshotNeedsRebuild` finds a snapshot already frozen empty: it has no labour lines although the period
 *    has a live labour line whose booking already existed when the sheet was approved, and nobody has exported it.
 *    Such a snapshot is rebuilt (signatures untouched); a booking created or changed after approval never counts. A snapshot with labour lines, or a legitimately empty one, is
 *    never re-priced.
 * 3. `timesheetOwnerCanAddExtras`: 1.54.0 (owner decision 16 Nov) — the person adds, edits and deletes price work and
 *    expenses until the sheet is exported. After the line manager has signed, a change reopens the sheet for signing
 *    (`signedTimesheetExtrasChanges`); no stored signature is ever cleared (1.43.0's half-signed bug). Before 1.54.0 the
 *    block applied from the line manager's signature (`TIMESHEET_SIGNED_OFF_EXTRAS_MESSAGE`, kept for older builds).
 */

import { documentInstantMs } from './peopleDocuments'

export const TIMESHEET_SNAPSHOT_LOADING_MESSAGE = 'Loading bookings…'
export const TIMESHEET_SNAPSHOT_FAILED_MESSAGE =
  'Could not load the bookings for this timesheet, so it cannot be signed yet. Check your connection and try again.'
export const TIMESHEET_PAY_INPUTS_LOADING_MESSAGE = 'Loading pay settings and rate history…'
/** 1.43.0–1.53.0 wording, no longer returned (kept so older app builds that name it still load the script). */
export const TIMESHEET_SIGNED_OFF_EXTRAS_MESSAGE = 'This timesheet is signed off — add it to your next timesheet.'
/** 1.54.0: shown instead of the add controls once the sheet is exported. */
export const TIMESHEET_EXPORTED_EXTRAS_MESSAGE = 'This timesheet has been exported — add it to your next timesheet.'

export type TimesheetSnapshotReadyInput = {
  /** The period's labour and manager site bookings have arrived (the whole archive the screen asked for). */
  bookingsLoaded: boolean
  /** The bookings could not be loaded. */
  bookingsFailed?: boolean
  /** The person's pay (profile / settings) has loaded. Missing = loaded. */
  payProfileLoaded?: boolean
  /** The pay-rate history has loaded. Missing = loaded. */
  rateHistoryLoaded?: boolean
}

/**
 * Rulebook 1.43.0 §8: whether a timesheet may be signed or counter-signed now — every input the snapshot is built from
 * has loaded. `message` is what the sign buttons say while they wait ("Loading bookings…"), or why they cannot be used.
 */
export function timesheetSnapshotReady(input: TimesheetSnapshotReadyInput): { ready: boolean; failed: boolean; message: string | null } {
  if (input.bookingsFailed === true && input.bookingsLoaded !== true) {
    return { ready: false, failed: true, message: TIMESHEET_SNAPSHOT_FAILED_MESSAGE }
  }
  if (input.bookingsLoaded !== true) return { ready: false, failed: false, message: TIMESHEET_SNAPSHOT_LOADING_MESSAGE }
  if (input.payProfileLoaded === false || input.rateHistoryLoaded === false) {
    return { ready: false, failed: false, message: TIMESHEET_PAY_INPUTS_LOADING_MESSAGE }
  }
  return { ready: true, failed: false, message: null }
}

type InstantLike = unknown

function present(value: InstantLike): boolean {
  if (value == null || value === '' || value === false) return false
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  return true
}

export type TimesheetSnapshotSheet = {
  weeklyReportOverride?: { lines?: ReadonlyArray<unknown> | null; approvedAt?: InstantLike } | null
  exportedAt?: InstantLike
  managerSignedAt?: InstantLike
  approvedAt?: InstantLike
}

export type TimesheetLiveLabourLine = {
  /** A PAYE day is never a timesheet line (§8). */
  isPayeDay?: boolean | null
  /** When the line's booking was created (any stored instant shape). Missing = unknown: never counted. */
  bookingCreatedAt?: InstantLike
  /**
   * When the line's booking was last written (`updatedAt` write metadata, both apps). Review r318: a booking created
   * before approval but moved into the period later is caught by this. Missing = unknown: never counted.
   */
  bookingUpdatedAt?: InstantLike
}

/**
 * Rulebook 1.43.0 §8 (review r318): true only for a signed snapshot frozen empty by the loading bug — it exists, holds
 * no labour lines, the sheet has not been exported, and the period has a live labour line (PAYE days left out) whose
 * booking was created AND last written on or before the sheet was approved (the later of `createdAt` and `updatedAt`
 * ≤ the snapshot's `approvedAt`, else `managerSignedAt` / `approvedAt` on the sheet). Such a booking was there, as it
 * is now, when the sheet was signed, so its absence is the bug. A snapshot that is legitimately empty (price work or
 * expenses only) is never rebuilt because of a booking added to — or moved into, or changed in — the period later, nor
 * because of a booking whose times are unknown: a signed sheet is never re-priced. A snapshot with any labour line is
 * never rebuilt.
 */
export function timesheetSnapshotNeedsRebuild(
  sheet: TimesheetSnapshotSheet | null | undefined,
  liveLabourLines: ReadonlyArray<TimesheetLiveLabourLine | null | undefined> | null | undefined
): boolean {
  const override = sheet?.weeklyReportOverride
  if (!override) return false
  if (present(sheet?.exportedAt)) return false
  const stored = Array.isArray(override.lines) ? override.lines.length : 0
  if (stored > 0) return false
  const approvedMs =
    documentInstantMs(override.approvedAt) ?? documentInstantMs(sheet?.managerSignedAt) ?? documentInstantMs(sheet?.approvedAt)
  if (approvedMs == null) return false
  return (liveLabourLines ?? []).some((line) => {
    if (!line || line.isPayeDay === true) return false
    const created = documentInstantMs(line.bookingCreatedAt)
    const updated = documentInstantMs(line.bookingUpdatedAt)
    if (created == null || updated == null) return false
    return Math.max(created, updated) <= approvedMs
  })
}

export type TimesheetExtrasSheet = {
  managerSignedAt?: InstantLike
  approvedAt?: InstantLike
  /** 1.54.0: the only field that stops the person changing price work or expenses. */
  exportedAt?: InstantLike
}

/**
 * Rulebook 1.54.0 §8 (owner decision 16 Nov, replaces 1.43.0): whether the person may add, edit or delete price work or
 * expenses on their own sheet — until it is exported (`exportedAt`); then `message` is `TIMESHEET_EXPORTED_EXTRAS_MESSAGE`
 * and the screen offers no add control. Once the line manager has signed, a change reopens the sheet for signing
 * (`signedTimesheetExtrasChanges`); no signature is cleared. A self-signed sheet behaves the same (it is never exported
 * while the person still works on it). `options.selfSigned` is kept for callers and no longer changes the answer.
 */
export function timesheetOwnerCanAddExtras(
  sheet: TimesheetExtrasSheet | null | undefined,
  options: { selfSigned?: boolean | null } = {}
): { allowed: boolean; message: string | null } {
  if (present(sheet?.exportedAt)) return { allowed: false, message: TIMESHEET_EXPORTED_EXTRAS_MESSAGE }
  return { allowed: true, message: null }
}
