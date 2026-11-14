/**
 * Rulebook 1.43.0 §8 (owner bug reports, 14 Nov): when a signed timesheet's snapshot may be built, when an empty one is
 * rebuilt, and when the person may still add price work or expenses.
 *
 * 1. `weeklyReportOverride` (the signed snapshot) is built once, at full approval, from the bookings the screen holds.
 *    A counter-signature made before the period's bookings had loaded froze a snapshot with no labour lines, and the
 *    invoice then showed only price work. `timesheetSnapshotReady` holds sign-off (and every save that builds the
 *    snapshot) until the bookings and pay inputs have loaded.
 * 2. `timesheetSnapshotNeedsRebuild` finds a snapshot already frozen empty: it has no labour lines although the period
 *    has live labour lines and nobody has exported it. Such a snapshot is rebuilt (signatures untouched). A snapshot
 *    with labour lines is never re-priced.
 * 3. `timesheetOwnerCanAddExtras`: once the line manager has signed (or the sheet was approved), the person cannot
 *    change price work or expenses (the security rules refuse it). Adding them used to clear only the person's own
 *    signature and leave the sheet half signed; the screens now say so and offer nothing.
 */

export const TIMESHEET_SNAPSHOT_LOADING_MESSAGE = 'Loading bookings…'
export const TIMESHEET_SNAPSHOT_FAILED_MESSAGE =
  'Could not load the bookings for this timesheet, so it cannot be signed yet. Check your connection and try again.'
export const TIMESHEET_PAY_INPUTS_LOADING_MESSAGE = 'Loading pay settings and rate history…'
export const TIMESHEET_SIGNED_OFF_EXTRAS_MESSAGE = 'This timesheet is signed off — add it to your next timesheet.'

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
  weeklyReportOverride?: { lines?: ReadonlyArray<unknown> | null } | null
  exportedAt?: InstantLike
}

export type TimesheetLiveLabourLine = {
  /** A PAYE day is never a timesheet line (§8). */
  isPayeDay?: boolean | null
}

/**
 * Rulebook 1.43.0 §8: true when the stored signed snapshot was frozen empty — it exists, holds no labour lines, the
 * period has at least one live labour line (PAYE days left out), and the sheet has not been exported. The snapshot is
 * then rebuilt from the live bookings with the signatures as they are. False for a snapshot with any labour line
 * (never re-priced), an exported sheet, or no snapshot.
 */
export function timesheetSnapshotNeedsRebuild(
  sheet: TimesheetSnapshotSheet | null | undefined,
  liveLabourLines: ReadonlyArray<TimesheetLiveLabourLine> | number | null | undefined
): boolean {
  const override = sheet?.weeklyReportOverride
  if (!override) return false
  if (present(sheet?.exportedAt)) return false
  const stored = Array.isArray(override.lines) ? override.lines.length : 0
  if (stored > 0) return false
  const live =
    typeof liveLabourLines === 'number'
      ? liveLabourLines
      : (liveLabourLines ?? []).filter((line) => line && line.isPayeDay !== true).length
  return live > 0
}

export type TimesheetExtrasSheet = {
  managerSignedAt?: InstantLike
  approvedAt?: InstantLike
}

/**
 * Rulebook 1.43.0 §8: whether the person may add price work or expenses to their own sheet. Not once their line
 * manager has signed it (`managerSignedAt`, or the older `approvedAt` — the fields the security rules test); then
 * `message` is `TIMESHEET_SIGNED_OFF_EXTRAS_MESSAGE` and the screen offers no add control and clears no signature. A
 * self-signed sheet (`selfSigned`: no line manager signs it) stays open: adding asks the person to sign it again.
 */
export function timesheetOwnerCanAddExtras(
  sheet: TimesheetExtrasSheet | null | undefined,
  options: { selfSigned?: boolean | null } = {}
): { allowed: boolean; message: string | null } {
  if (options.selfSigned === true) return { allowed: true, message: null }
  if (present(sheet?.managerSignedAt) || present(sheet?.approvedAt)) {
    return { allowed: false, message: TIMESHEET_SIGNED_OFF_EXTRAS_MESSAGE }
  }
  return { allowed: true, message: null }
}
