/**
 * Rulebook 1.47.0 §8 (owner decision 15 Nov, answer 4.2 = (a)): a signed timesheet reopens when its bookings change.
 *
 * A self-employed person signs their timesheet, then (unless self-signed) their line manager counter-signs it and the
 * signed snapshot (`weeklyReportOverride`) is built. When a booking of that period changes afterwards — its day, slot,
 * times, overtime rate, break toggle or status (the `overtimeBookingFingerprint`), or a booking is added to or removed
 * from the sheet — and the sheet is NOT exported, the sheet goes back for signing: the person reviews the live
 * bookings and signs again, then the line manager counter-signs again. An exported sheet stays exactly as it was
 * (accounts have it); its reviewer only sees a warning.
 *
 * The state is DERIVED, never written by the person who edits the booking (a job manager or admin may not write the
 * person's sign-off fields, §16): every app compares what was signed with the live payroll lines of the period —
 *  - what the person signed: `operativeSignedBookings` (new 1.47.0 owner field, written with the operative signature
 *    by `signedTimesheetBookingRecord`), else the signed snapshot's lines;
 *  - what the line manager counter-signed: the signed snapshot's lines (`weeklyReportOverride.lines`).
 * Fingerprints are compared with `overtimeFingerprintsMatch` (slot spellings read canonically), never `===`.
 *
 * Guardrail 3 (never hide old data, no silent loss of signatures): a sheet signed before 1.46.0 has no booking
 * fingerprints. For it only a booking added to or removed from the sheet counts; hours are never compared (they move
 * with working-hours changes such as 1.44.0's derived paid day, which must never reopen a signed sheet). A sheet whose
 * signed lines name no booking at all, a person signature with neither a record nor a snapshot (before 1.47.0, waiting
 * for the line manager), and a period whose bookings have not loaded never read as changed. Nothing is written by this
 * rule: the stored signatures stay, and the sheet reads as signed again as soon as the bookings match (or it is signed
 * again).
 */

import { overtimeFingerprintsMatch } from './bookingFingerprint'
import { normalizeDocumentId } from './scheduleSources'
import { resolveTimesheetExportedAtMs, timesheetTimestampMs, TIMESHEET_SIGNED_AFTER_MS } from './timesheetPeriod'
import { timesheetSnapshotNeedsRebuild } from './timesheetSnapshot'

/** The popup on My Timesheets (owner's words, 15 Nov). */
export const SIGNED_TIMESHEET_CHANGED_MESSAGE =
  "One or more bookings have changed since you signed your timesheet. Please review and sign again, or speak to your line manager if something isn't correct."
/** Accessible label of the yellow warning triangle (My Timesheets hub entry and each changed row). */
export const SIGNED_TIMESHEET_CHANGED_LABEL = 'Bookings changed since you signed'
/** The status chip of a changed, unexported sheet on My Timesheets. */
export const SIGNED_TIMESHEET_CHANGED_STATUS = 'Bookings changed — sign again'
/** The line manager's review while the person has not signed again. */
export const SIGNED_TIMESHEET_CHANGED_REVIEWER_MESSAGE =
  'Bookings have changed since this timesheet was signed. It is back with the person to review and sign again; you can counter-sign once they have.'
/** The line manager's review once the person has signed the changed bookings again. */
export const SIGNED_TIMESHEET_CHANGED_COUNTERSIGN_MESSAGE =
  'Bookings changed after you counter-signed and the person has signed the new figures. Counter-sign again to approve them.'
/** An exported sheet whose bookings changed afterwards: frozen, warning only. */
export const SIGNED_TIMESHEET_EXPORTED_CHANGED_MESSAGE =
  'Bookings have changed since this timesheet was exported. The exported timesheet stays as it was — correct anything on the next timesheet.'

/** One booking as the person signed it (`operativeSignedBookings[]`). */
export type SignedTimesheetBooking = {
  bookingId: string
  /** `bookings` or `managerSiteBookings`. */
  collection: string
  /** `overtimeBookingFingerprint` of the booking when signed ('' when unknown). */
  fingerprint: string
}

/** A live payroll line or a signed snapshot line — only the fields this rule reads. */
export type SignedTimesheetLine = {
  id?: unknown
  bookingId?: unknown
  bookingCollection?: unknown
  bookingFingerprint?: unknown
  isPayeDay?: unknown
  isLeave?: unknown
  /** Snapshot lines: an Edit hours part of another line (same booking). */
  reviewPartOf?: unknown
  bookingCreatedAt?: unknown
  bookingUpdatedAt?: unknown
}

export type SignedTimesheetSheet = {
  operativeSignedAt?: unknown
  operativeSignedAtMs?: unknown
  operativeSignedBookings?: unknown
  managerSignedAt?: unknown
  managerSignedAtMs?: unknown
  approvedAt?: unknown
  exportedAt?: unknown
  exportedAtMs?: unknown
  invoiceGeneratedAt?: unknown
  weeklyReportOverride?: { lines?: ReadonlyArray<SignedTimesheetLine> | null; approvedAt?: unknown } | null
}

export type SignedTimesheetWaitingFor = 'person' | 'lineManager'

export type SignedTimesheetBookingChanges = {
  /** The bookings differ from what was last signed (any stage, exported included). */
  changed: boolean
  /** The sheet is exported (frozen): `changed` is a warning only. */
  exported: boolean
  /** Changed and not exported: the sheet is back for signing. */
  reopened: boolean
  /** Who must act on a reopened sheet; null when not reopened. */
  waitingFor: SignedTimesheetWaitingFor | null
  /** How the comparison was made for the reference that changed: fingerprints (1.46.0+), booking ids only, or none. */
  basis: 'fingerprint' | 'bookingIds' | 'none'
  changedBookingIds: string[]
  addedBookingIds: string[]
  removedBookingIds: string[]
  /** The person's popup (`SIGNED_TIMESHEET_CHANGED_MESSAGE`) when they must sign again, else null. */
  message: string | null
  /** The reviewer's note (counter-sign blocked, counter-sign again, or the exported warning), else null. */
  reviewerMessage: string | null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function realMs(value: unknown): number | null {
  const ms = timesheetTimestampMs(value)
  return ms != null && ms > TIMESHEET_SIGNED_AFTER_MS ? ms : null
}

/** The booking a line belongs to: `{collection}|{id}` (ids without case), or '' when the line names no booking. */
export function signedTimesheetLineBookingKey(line: SignedTimesheetLine | null | undefined): string {
  if (!line) return ''
  const rawId = text(line.id)
  let bookingId = text(line.bookingId)
  let prefix = ''
  const match = rawId.match(/^(op|mgr)-(.+)-(?:normal|ot)$/i)
  if (match) prefix = match[1].toLowerCase()
  if (!bookingId && match) bookingId = match[2]
  if (!bookingId) return ''
  const stored = text(line.bookingCollection)
  const collection = stored || (prefix === 'mgr' ? 'managerSiteBookings' : 'bookings')
  return `${collection}|${normalizeDocumentId(bookingId)}`
}

type BookingSide = Map<string, { bookingId: string; fingerprint: string; payeOnly: boolean }>

function groupLines(lines: ReadonlyArray<SignedTimesheetLine | null | undefined>): { byKey: BookingSide; keyless: number } {
  const byKey: BookingSide = new Map()
  let keyless = 0
  for (const line of lines) {
    if (!line || line.isLeave === true) continue
    const key = signedTimesheetLineBookingKey(line)
    if (!key) {
      keyless += 1
      continue
    }
    const fingerprint = text(line.bookingFingerprint)
    const paye = line.isPayeDay === true
    const held = byKey.get(key)
    if (!held) {
      byKey.set(key, { bookingId: key.split('|')[1] ?? '', fingerprint, payeOnly: paye })
    } else {
      if (!held.fingerprint && fingerprint) held.fingerprint = fingerprint
      if (!paye) held.payeOnly = false
    }
  }
  return { byKey, keyless }
}

function recordSide(raw: unknown): BookingSide | null {
  if (!Array.isArray(raw)) return null
  const side: BookingSide = new Map()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const key = signedTimesheetLineBookingKey({ bookingId: r.bookingId, bookingCollection: r.collection })
    if (!key) continue
    const fingerprint = text(r.fingerprint)
    const held = side.get(key)
    if (!held) side.set(key, { bookingId: key.split('|')[1] ?? '', fingerprint, payeOnly: false })
    else if (!held.fingerprint && fingerprint) held.fingerprint = fingerprint
  }
  return side
}

type Diff = { changed: string[]; added: string[]; removed: string[]; basis: 'fingerprint' | 'bookingIds' }

function diffSides(signed: BookingSide, live: BookingSide): Diff {
  const fingerprinted = Array.from(signed.values()).some((row) => row.fingerprint !== '')
  const changed: string[] = []
  const added: string[] = []
  const removed: string[] = []
  for (const [key, row] of signed) {
    const now = live.get(key)
    if (!now) {
      removed.push(row.bookingId)
      continue
    }
    // Before 1.46.0 there is no fingerprint: only additions and removals count (hours are never compared).
    if (row.fingerprint && now.fingerprint && !overtimeFingerprintsMatch(row.fingerprint, now.fingerprint)) changed.push(row.bookingId)
  }
  for (const [key, row] of live) {
    if (signed.has(key) || row.payeOnly) continue
    added.push(row.bookingId)
  }
  return { changed, added, removed, basis: fingerprinted ? 'fingerprint' : 'bookingIds' }
}

function isEmptyDiff(diff: Diff | null): boolean {
  return !diff || (diff.changed.length === 0 && diff.added.length === 0 && diff.removed.length === 0)
}

/**
 * Rulebook 1.47.0 §8: what the person signs — one row per booking of the live payroll lines (leave left out),
 * `{ bookingId, collection, fingerprint }`, stored as `operativeSignedBookings` with the operative signature (every
 * app, every signature, a re-signature included). Sorted by collection and id so the same bookings always write the
 * same list.
 */
export function signedTimesheetBookingRecord(
  liveLines: ReadonlyArray<SignedTimesheetLine | null | undefined> | null | undefined
): SignedTimesheetBooking[] {
  const out = new Map<string, SignedTimesheetBooking>()
  for (const line of liveLines ?? []) {
    if (!line || line.isLeave === true) continue
    const key = signedTimesheetLineBookingKey(line)
    if (!key) continue
    const fingerprint = text(line.bookingFingerprint)
    const held = out.get(key)
    if (held) {
      if (!held.fingerprint && fingerprint) held.fingerprint = fingerprint
      continue
    }
    const [collection] = key.split('|')
    const rawId = text(line.bookingId) || (text(line.id).match(/^(?:op|mgr)-(.+)-(?:normal|ot)$/i)?.[1] ?? '')
    out.set(key, { bookingId: rawId, collection, fingerprint })
  }
  return Array.from(out.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, row]) => row)
}

/**
 * Rulebook 1.47.0 §8: whether a signed timesheet's bookings changed since it was signed, and who must act.
 *
 * `liveLines` are the period's live payroll lines for the person (the timesheet collector's lines, each with
 * `bookingFingerprint`, `bookingCollection` and its id); `liveLoaded` must be true (the whole booking archive has
 * arrived, `timesheetSnapshotReady`), else nothing reads as changed. `selfSigned` (`timesheetSelfSigned`): the person's
 * own signature completes the sheet, so a stale snapshot is theirs to sign again.
 *
 * - Exported: `exported` true, `reopened` false — the snapshot is frozen; `changed` and `reviewerMessage` warn only.
 * - The person's reference (`operativeSignedBookings`, else the snapshot) differs from the live bookings: reopened,
 *   `waitingFor: 'person'` (their triangle and `message`); the line manager cannot counter-sign or export.
 * - The person signed the live bookings again but the snapshot is stale: `waitingFor: 'lineManager'` (counter-sign
 *   again; a self-signed sheet: `'person'`). The stale snapshot is never exported or invoiced.
 * - A snapshot frozen empty by the 1.43.0 loading bug (`timesheetSnapshotNeedsRebuild`) is repaired by that rule, not
 *   reopened.
 */
export function signedTimesheetBookingChanges(input: {
  sheet: SignedTimesheetSheet | null | undefined
  liveLines: ReadonlyArray<SignedTimesheetLine | null | undefined> | null | undefined
  liveLoaded: boolean
  selfSigned?: boolean | null
}): SignedTimesheetBookingChanges {
  const none: SignedTimesheetBookingChanges = {
    changed: false,
    exported: false,
    reopened: false,
    waitingFor: null,
    basis: 'none',
    changedBookingIds: [],
    addedBookingIds: [],
    removedBookingIds: [],
    message: null,
    reviewerMessage: null,
  }
  const sheet = input.sheet
  if (!sheet) return none
  const exported = resolveTimesheetExportedAtMs(sheet as Record<string, unknown>) != null || realMs(sheet.exportedAtMs) != null
  const base = { ...none, exported }
  if (input.liveLoaded !== true) return base
  const operativeSigned = realMs(sheet.operativeSignedAt) != null || realMs(sheet.operativeSignedAtMs) != null
  const override = sheet.weeklyReportOverride && typeof sheet.weeklyReportOverride === 'object' ? sheet.weeklyReportOverride : null
  const live = groupLines(input.liveLines ?? []).byKey

  let snapshotDiff: Diff | null = null
  if (override) {
    const lines = Array.isArray(override.lines) ? override.lines : []
    const grouped = groupLines(lines)
    const repairable = timesheetSnapshotNeedsRebuild(
      { weeklyReportOverride: { lines, approvedAt: override.approvedAt }, exportedAt: sheet.exportedAt, managerSignedAt: sheet.managerSignedAt, approvedAt: sheet.approvedAt },
      (input.liveLines ?? []).filter(Boolean).map((line) => ({
        isPayeDay: line?.isPayeDay === true,
        bookingCreatedAt: line?.bookingCreatedAt,
        bookingUpdatedAt: line?.bookingUpdatedAt,
      }))
    )
    // Signed lines that name no booking cannot be compared: never reopen on a guess.
    if (!repairable && !(grouped.byKey.size === 0 && grouped.keyless > 0)) snapshotDiff = diffSides(grouped.byKey, live)
  }
  const record = operativeSigned ? recordSide(sheet.operativeSignedBookings) : null
  const personDiff = record ? diffSides(record, live) : snapshotDiff

  const personChanged = operativeSigned || override ? !isEmptyDiff(personDiff) : false
  const snapshotChanged = !isEmptyDiff(snapshotDiff)
  if (!personChanged && !snapshotChanged) return base

  const used = (personChanged ? personDiff : snapshotDiff) as Diff
  const ids = {
    basis: used.basis,
    changedBookingIds: used.changed,
    addedBookingIds: used.added,
    removedBookingIds: used.removed,
  }
  if (exported) {
    return { ...base, ...ids, changed: true, reviewerMessage: SIGNED_TIMESHEET_EXPORTED_CHANGED_MESSAGE }
  }
  const waitingFor: SignedTimesheetWaitingFor = personChanged || input.selfSigned === true ? 'person' : 'lineManager'
  return {
    ...base,
    ...ids,
    changed: true,
    reopened: true,
    waitingFor,
    message: waitingFor === 'person' ? SIGNED_TIMESHEET_CHANGED_MESSAGE : null,
    reviewerMessage: waitingFor === 'person' ? SIGNED_TIMESHEET_CHANGED_REVIEWER_MESSAGE : SIGNED_TIMESHEET_CHANGED_COUNTERSIGN_MESSAGE,
  }
}

/**
 * Rulebook 1.47.0 §8: what each side may do with a sheet given its booking changes. A reopened sheet is never
 * exported or invoiced on its stale snapshot; while the person must sign again the line manager cannot counter-sign;
 * once they have, the line manager counter-signs again (and the snapshot is rebuilt from the live bookings,
 * `rebuildSnapshot`).
 */
export function signedTimesheetActions(change: Pick<SignedTimesheetBookingChanges, 'reopened' | 'waitingFor'> | null | undefined): {
  personMaySignAgain: boolean
  lineManagerMayCounterSign: boolean
  mayExport: boolean
  mayGenerateInvoice: boolean
  rebuildSnapshot: boolean
} {
  if (!change || change.reopened !== true) {
    return { personMaySignAgain: false, lineManagerMayCounterSign: true, mayExport: true, mayGenerateInvoice: true, rebuildSnapshot: false }
  }
  const person = change.waitingFor === 'person'
  return {
    personMaySignAgain: person,
    lineManagerMayCounterSign: !person,
    mayExport: false,
    mayGenerateInvoice: false,
    rebuildSnapshot: true,
  }
}
