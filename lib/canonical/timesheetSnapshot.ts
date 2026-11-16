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
 * 3. `timesheetOwnerCanAddExtras`: once the line manager has signed (or the sheet was approved), the person cannot
 *    change price work or expenses (the security rules refuse it). Adding them used to clear only the person's own
 *    signature and leave the sheet half signed; the screens now say so and offer nothing. 1.54.0 (owner decision 16 Nov):
 *    after that, until the sheet is exported, the person adds "late extras" instead (`timesheetOwnerCanAddLateExtras`,
 *    `timesheetLateExtras.ts`) — never the signed entries — and they pay only once a reviewer approves them.
 */

import { documentInstantMs } from './peopleDocuments'

export const TIMESHEET_SNAPSHOT_LOADING_MESSAGE = 'Loading bookings…'
export const TIMESHEET_SNAPSHOT_FAILED_MESSAGE =
  'Could not load the bookings for this timesheet, so it cannot be signed yet. Check your connection and try again.'
export const TIMESHEET_PAY_INPUTS_LOADING_MESSAGE = 'Loading pay settings and rate history…'
export const TIMESHEET_SIGNED_OFF_EXTRAS_MESSAGE = 'This timesheet is signed off — add it to your next timesheet.'
/** 1.54.0: shown instead of the late-extras add controls once the sheet is exported. */
export const TIMESHEET_EXPORTED_EXTRAS_MESSAGE = 'This timesheet has been exported — add it to your next timesheet.'
/**
 * Rulebook 1.55.0 §8 (review of #344): a revision of an exported timesheet carries the entries exactly as exported; the
 * person never adds, edits or deletes price work, expenses or late extras on it — after export they go on the next
 * timesheet.
 */
export const TIMESHEET_REVISION_EXTRAS_MESSAGE =
  'This is a revision of an exported timesheet — add price work or expenses to your next timesheet.'

/** 1.55.0: whether the sheet is a revision (`revision` above 0, or a stored `revisionOf`). */
export function timesheetSheetIsRevision(sheet: { revision?: unknown; revisionOf?: unknown } | null | undefined): boolean {
  const n = typeof sheet?.revision === 'number' ? sheet.revision : Number(sheet?.revision)
  return (Number.isFinite(n) && n > 0) || (typeof sheet?.revisionOf === 'string' && sheet.revisionOf.trim() !== '')
}

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
  /**
   * 1.54.0 (review of #337): a manager site booking at Office / Working from home / Site survey / a custom place. Such
   * a booking was left off sheets signed while that schedule option was switched off, so it never makes a signed
   * snapshot read as frozen empty (signed is final): it is ignored here and never enters the repaired snapshot.
   */
  scheduleOptionPlace?: boolean | null
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
    if (!line || line.isPayeDay === true || line.scheduleOptionPlace === true) return false
    const created = documentInstantMs(line.bookingCreatedAt)
    const updated = documentInstantMs(line.bookingUpdatedAt)
    if (created == null || updated == null) return false
    return Math.max(created, updated) <= approvedMs
  })
}

export type TimesheetExtrasSheet = {
  managerSignedAt?: InstantLike
  approvedAt?: InstantLike
  /** 1.54.0: stops the person adding late extras (as stored, see below). */
  exportedAt?: InstantLike
  /**
   * 1.54.0 (review of #337): whether the stored document's `exportedAt` is set as the security rules test it
   * (`timesheetExportedFieldSet`). Pass it when `exportedAt` above is a value an app resolved (an export leftover
   * of an invoice reads as not exported in the lists), so the add control and the rules always agree.
   */
  exportedAtStored?: boolean | null
  /** 1.55.0: REV N (0 or missing for an original) — a revision never takes owner extras. */
  revision?: number | null
  /** 1.55.0: the stored `revisionOf` of a revision document. */
  revisionOf?: string | null
}

/**
 * Rulebook 1.54.0 (review of #337): a stored `exportedAt` the security rules count as set — a timestamp or a number
 * (`resource.data.exportedAt is timestamp || is number`). The person's late-extras writes are refused from then on,
 * so the screens offer no add, edit or delete control.
 */
export function timesheetExportedFieldSet(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'number') return Number.isFinite(value)
  if (value instanceof Date) return !Number.isNaN(value.getTime())
  if (typeof value === 'object') {
    const row = value as Record<string, unknown>
    return typeof row.toMillis === 'function' || typeof row.seconds === 'number' || typeof row._seconds === 'number'
  }
  // A date text (an app's in-memory copy of the stamp) counts too: the add control may be stricter than the rules,
  // never looser.
  if (typeof value === 'string') return value.trim() !== '' && !Number.isNaN(Date.parse(value))
  return false
}

/**
 * Rulebook 1.43.0 §8: whether the person may add price work or expenses to their own sheet. Not once their line
 * manager has signed it (`managerSignedAt`, or the older `approvedAt` — the fields the security rules test); then
 * `message` is `TIMESHEET_SIGNED_OFF_EXTRAS_MESSAGE` and the screen offers no add control and clears no signature. A
 * self-signed sheet (`selfSigned`: no line manager signs it) stays open: adding asks the person to sign it again.
 * 1.54.0: after the line manager has signed, `timesheetOwnerCanAddLateExtras` decides the late-extras control.
 */
export function timesheetOwnerCanAddExtras(
  sheet: TimesheetExtrasSheet | null | undefined,
  options: { selfSigned?: boolean | null } = {}
): { allowed: boolean; message: string | null } {
  if (timesheetSheetIsRevision(sheet)) return { allowed: false, message: TIMESHEET_REVISION_EXTRAS_MESSAGE }
  if (options.selfSigned === true) return { allowed: true, message: null }
  if (present(sheet?.managerSignedAt) || present(sheet?.approvedAt)) {
    return { allowed: false, message: TIMESHEET_SIGNED_OFF_EXTRAS_MESSAGE }
  }
  return { allowed: true, message: null }
}

/**
 * Rulebook 1.54.0 §8 (owner decision 16 Nov, "allow adding after sign-off so they can re-issue"): whether the person
 * may add, edit or delete **late extras** (`lateExtras`) on their own sheet — only once the line manager has signed
 * (before that they use the ordinary entries; a self-signed sheet keeps its own flow) and until the sheet is exported
 * (`exportedAtStored`, else `timesheetExportedFieldSet(exportedAt)`; then `TIMESHEET_EXPORTED_EXTRAS_MESSAGE`). The
 * signed entries never change; a late extra pays only once a reviewer approves it (`timesheetLateExtraDecision`).
 */
export function timesheetOwnerCanAddLateExtras(
  sheet: TimesheetExtrasSheet | null | undefined,
  options: { selfSigned?: boolean | null } = {}
): { allowed: boolean; message: string | null } {
  if (timesheetSheetIsRevision(sheet)) return { allowed: false, message: TIMESHEET_REVISION_EXTRAS_MESSAGE }
  if (options.selfSigned === true) return { allowed: false, message: null }
  if (!present(sheet?.managerSignedAt) && !present(sheet?.approvedAt)) return { allowed: false, message: null }
  const exported = typeof sheet?.exportedAtStored === 'boolean' ? sheet.exportedAtStored : timesheetExportedFieldSet(sheet?.exportedAt)
  if (exported) return { allowed: false, message: TIMESHEET_EXPORTED_EXTRAS_MESSAGE }
  return { allowed: true, message: null }
}
