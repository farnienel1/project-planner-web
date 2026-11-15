/**
 * Rulebook 1.47.0 §8 (owner decision 15 Nov, answer 4.2 = (a)): a signed timesheet reopens when its bookings change.
 *
 * A self-employed person signs their timesheet, then (unless self-signed) their line manager counter-signs it and the
 * signed snapshot (`weeklyReportOverride`) is built. When one of its bookings changes afterwards and the sheet is NOT
 * exported, the sheet goes back for signing: the person reviews the live bookings and signs again, then the line
 * manager counter-signs again. An exported sheet stays exactly as it was (accounts have it); its reviewer only sees a
 * warning.
 *
 * What counts as a booking change (and nothing else does):
 *  - CHANGED: a signed booking's day, slot, start, finish, overtime rate or break toggle (`overtimeBookingFingerprint`
 *    without its status part — Tentative ↔ Confirmed is not pay), read from the live line or, when the booking is no
 *    longer on the sheet, from the booking document itself;
 *  - REMOVED: a signed booking whose document is gone (deleted, or tombstoned), whose status is Cancelled, or which now
 *    names another person than the one recorded at signing;
 *  - ADDED: a booking on the sheet now that was not signed, created or last written after the signature.
 * A booking that only drops out of (or into) the collector's lines because of a filter — schedule options switched off
 * or on, the person's email or `operatives` rows changing who the collector matches, a PAYE day, a load window — is
 * never a change: removals are judged from the booking documents, additions from their write times.
 *
 * The state is DERIVED, never written by the person who edits the booking (a job manager or admin may not write the
 * person's sign-off fields, §16):
 *  - what the person signed: `operativeSignedBookings` (1.47.0 owner field, written with the operative signature by
 *    `signedTimesheetBookingRecord`, with `operativeSignedBookingsAt`), else the signed snapshot's lines;
 *  - what the line manager counter-signed: the signed snapshot's lines (`weeklyReportOverride.lines`).
 * Fingerprints are compared with `overtimeFingerprintsMatch` semantics (slot spellings read canonically), never `===`.
 *
 * Guardrail 3 (never hide old data, no silent loss of signatures): a sheet signed before 1.46.0 has no booking
 * fingerprints, so only a deleted, cancelled or newly added booking can reopen it, never hours. Signed lines that name
 * no booking, a person signature with neither a record nor a snapshot, bookings that have not loaded, a booking whose
 * write times are unknown, and a record written before the latest signature (an older app re-signed without one) never
 * read as changed. Nothing is written by this rule.
 */

import { overtimeFingerprintKey } from './bookingFingerprint'
import { overtimeBookingFingerprint } from './payeOvertime'
import { documentInstantMs } from './peopleDocuments'
import { normalizeDocumentId } from './scheduleSources'
import { resolveTimesheetExportedAtMs, timesheetTimestampMs, TIMESHEET_SIGNED_AFTER_MS } from './timesheetPeriod'
import { timesheetSnapshotNeedsRebuild } from './timesheetSnapshot'
import { bookingOccupiesDay } from './warningRows'

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
/** Why Export left a sheet out. */
export const SIGNED_TIMESHEET_EXPORT_SKIPPED_MESSAGE = 'Not exported — bookings changed since it was signed; it is back with the person to sign again.'

/** A record written within this long after the signature belongs to it (the two are written in one save). */
const RECORD_SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000
/** `operativeSignedBookingsSignedAt` equal to `operativeSignedAt` (same value, written together) within this. */
const RECORD_SIGNED_AT_MATCH_MS = 1000
/**
 * Second review #325 item 3: a booking not on the record counts as added when it was written after the signature
 * less this window — conservative, so a fast signer's clock (device time) or a change the person's screen had not
 * received yet is never missed.
 */
export const SIGNED_TIMESHEET_ADDITION_WINDOW_MS = 10 * 60 * 1000

/** One booking as the person signed it (`operativeSignedBookings[]`). */
export type SignedTimesheetBooking = {
  bookingId: string
  /** `bookings` or `managerSiteBookings`. */
  collection: string
  /** `overtimeBookingFingerprint` of the booking when signed ('' when unknown). */
  fingerprint: string
  /** The booking's person id as stored when signed (labour `operativeId`, manager site `userId`); '' when unknown. */
  personId: string
  /**
   * Second review #325 item 4: where the booking was when signed — `signedTimesheetBookingPlace` (job, or Office /
   * Working from home / Site survey / custom place). '' when unknown. A change reopens the sheet.
   */
  place?: string
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

/**
 * A stored booking document (labour `bookings` or `managerSiteBookings`), any person — the source of truth for whether a
 * signed booking that is no longer on the sheet was deleted, cancelled, changed or given to someone else.
 */
export type SignedTimesheetBookingDocument = {
  bookingId: string
  collection: string
  /** Organisation-zone day of the booking. */
  dayKey: string
  timeSlot?: unknown
  workStartTime?: unknown
  workEndTime?: unknown
  isBreakRemoved?: unknown
  otMultiplierOverride?: unknown
  status?: unknown
  /** The booking's person id as stored (labour `operativeId`, manager site `userId`). */
  personId?: unknown
  /** Labour: the job (`projectId`). Manager site: `locationType`, `locationId`, `customLocationName`. */
  projectId?: unknown
  locationType?: unknown
  locationId?: unknown
  customLocationName?: unknown
}

/**
 * Second review #325 item 4: where a booking is — a labour booking's job (`job|{projectId}`), a manager site booking's
 * place (`{locationType}|{locationId}|{customLocationName}`), ids and names without case; '' when unknown. The job's
 * collection (`jobCollection`) is left out: older bookings gain it from a backfill, which must not reopen sheets.
 */
export function signedTimesheetBookingPlace(doc: SignedTimesheetBookingDocument | null | undefined): string {
  if (!doc) return ''
  const collection = text(doc.collection) || 'bookings'
  if (collection === 'bookings') {
    const job = normalizeDocumentId(text(doc.projectId))
    return job ? `job|${job}` : ''
  }
  const kind = text(doc.locationType).toLowerCase()
  if (!kind) return ''
  return `${kind}|${normalizeDocumentId(text(doc.locationId))}|${text(doc.customLocationName).toLowerCase()}`
}

export type SignedTimesheetSheet = {
  operativeSignedAt?: unknown
  operativeSignedAtMs?: unknown
  operativeSignedBookings?: unknown
  /**
   * When `operativeSignedBookings` was written — server time (second review #325 item 3); missing while the write is
   * pending (then the comparison is conservative).
   */
  operativeSignedBookingsAt?: unknown
  /** The `operativeSignedAt` the record belongs to (the same value, written together; ties the record to its signature). */
  operativeSignedBookingsSignedAt?: unknown
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

/** A fingerprint without its status part, slot read canonically: Tentative ↔ Confirmed is not a change. */
function fingerprintCore(fingerprint: unknown): string {
  const key = overtimeFingerprintKey(fingerprint)
  if (!key) return ''
  return key.split('|').slice(0, 6).join('|')
}

function sameBooking(a: unknown, b: unknown): boolean {
  const left = fingerprintCore(a)
  return left !== '' && left === fingerprintCore(b)
}

/** The booking a line names, `{ collection, bookingId }` (stored case), or null when it names none. */
function lineBooking(line: SignedTimesheetLine | null | undefined): { collection: string; bookingId: string } | null {
  if (!line) return null
  const rawId = text(line.id)
  const match = rawId.match(/^(op|mgr)-(.+)-(?:normal|ot)$/i)
  const prefix = match ? match[1].toLowerCase() : ''
  let bookingId = text(line.bookingId)
  // Web's live lines carry `bookingId` as the line prefix plus the id (`op-<id>`); the snapshot stores the bare id.
  if (bookingId && match && bookingId.toLowerCase() === `${prefix}-${match[2]}`.toLowerCase()) bookingId = match[2]
  if (!bookingId && match) bookingId = match[2]
  if (!bookingId) return null
  const stored = text(line.bookingCollection)
  return { collection: stored || (prefix === 'mgr' ? 'managerSiteBookings' : 'bookings'), bookingId }
}

function keyOf(collection: string, bookingId: string): string {
  return `${collection}|${normalizeDocumentId(bookingId)}`
}

/** The booking a line belongs to: `{collection}|{id}` (ids without case), or '' when the line names no booking. */
export function signedTimesheetLineBookingKey(line: SignedTimesheetLine | null | undefined): string {
  const booking = lineBooking(line)
  return booking ? keyOf(booking.collection, booking.bookingId) : ''
}

type SideRow = { bookingId: string; fingerprint: string; personId: string; place: string; writtenMs: number | null }
type Side = Map<string, SideRow>

/** Lines grouped by booking, leave and PAYE days left out on every side (a PAYE day is never a timesheet line, §8). */
function groupLines(lines: ReadonlyArray<SignedTimesheetLine | null | undefined>): { byKey: Side; keyless: number } {
  const byKey: Side = new Map()
  let keyless = 0
  for (const line of lines) {
    if (!line || line.isLeave === true || line.isPayeDay === true) continue
    const booking = lineBooking(line)
    if (!booking) {
      keyless += 1
      continue
    }
    const key = keyOf(booking.collection, booking.bookingId)
    const fingerprint = text(line.bookingFingerprint)
    const created = documentInstantMs(line.bookingCreatedAt as never)
    const updated = documentInstantMs(line.bookingUpdatedAt as never)
    const writtenMs = created == null && updated == null ? null : Math.max(created ?? 0, updated ?? 0)
    const held = byKey.get(key)
    if (!held) byKey.set(key, { bookingId: booking.bookingId, fingerprint, personId: '', place: '', writtenMs })
    else {
      if (!held.fingerprint && fingerprint) held.fingerprint = fingerprint
      if (writtenMs != null) held.writtenMs = Math.max(held.writtenMs ?? 0, writtenMs)
    }
  }
  return { byKey, keyless }
}

function recordSide(raw: unknown): Side | null {
  if (!Array.isArray(raw)) return null
  const side: Side = new Map()
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const booking = lineBooking({ bookingId: r.bookingId, bookingCollection: r.collection })
    if (!booking) continue
    const key = keyOf(booking.collection, booking.bookingId)
    if (!side.has(key)) {
      side.set(key, { bookingId: booking.bookingId, fingerprint: text(r.fingerprint), personId: text(r.personId), place: text(r.place), writtenMs: null })
    }
  }
  return side
}

type Documents = {
  byKey: Map<string, SignedTimesheetBookingDocument>
  tombstoned: Set<string>
  /** Every id the sheet's person goes by (`personIdSet` / `bookingIdsForAccount`), without case; null = unknown. */
  personIds: Set<string> | null
} | null

function documentFingerprint(doc: SignedTimesheetBookingDocument): string {
  return overtimeBookingFingerprint({
    id: doc.bookingId,
    personId: '',
    dayKey: text(doc.dayKey),
    timeSlot: text(doc.timeSlot),
    workStartTime: text(doc.workStartTime) || undefined,
    workEndTime: text(doc.workEndTime) || undefined,
    isBreakRemoved: doc.isBreakRemoved === true,
    otMultiplierOverride: typeof doc.otMultiplierOverride === 'number' ? doc.otMultiplierOverride : null,
  } as Parameters<typeof overtimeBookingFingerprint>[0])
}

/**
 * Second review #325 item 2: a booking whose status no longer occupies the day (Cancelled, Declined, any unknown word —
 * `bookingOccupiesDay`, the rule the collector drops it by) is off the sheet. A booking stored with no status (manager
 * site bookings) occupies its day.
 */
function statusTakesItOff(status: unknown): boolean {
  return text(status) !== '' && !bookingOccupiesDay(status)
}

type Diff = { changed: string[]; added: string[]; removed: string[]; basis: 'fingerprint' | 'bookingIds' }

function diffSides(signed: Side, live: Side, documents: Documents, addedAfterMs: number | null): Diff {
  const fingerprinted = Array.from(signed.values()).some((row) => row.fingerprint !== '')
  const changed: string[] = []
  const added: string[] = []
  const removed: string[] = []
  for (const [key, row] of signed) {
    const now = live.get(key)
    const doc = documents?.byKey.get(key)
    // Second review #325 item 4: a job or place change (the record holds it; the snapshot does not).
    const placeNow = signedTimesheetBookingPlace(doc)
    const placeChanged = Boolean(row.place && placeNow && row.place !== placeNow)
    if (now) {
      // Before 1.46.0 there is no fingerprint: only additions and removals count (hours are never compared).
      if ((row.fingerprint && now.fingerprint && !sameBooking(row.fingerprint, now.fingerprint)) || placeChanged) changed.push(row.bookingId)
      continue
    }
    // Not on the sheet now. Judge it from the booking itself, never from the filters that build the sheet.
    if (!documents) continue
    if (documents.tombstoned.has(key)) {
      removed.push(row.bookingId)
      continue
    }
    if (!doc || statusTakesItOff(doc.status)) {
      removed.push(row.bookingId)
      continue
    }
    // Given to someone else (second review #325 item 1): only when the booking's person is now outside every id the
    // sheet's person goes by — a booking rewritten from their `operatives` row to their users id is still theirs.
    // Without the person's ids nothing is read as given away.
    const docPerson = normalizeDocumentId(text(doc.personId))
    if (row.personId && docPerson && normalizeDocumentId(row.personId) !== docPerson && documents.personIds && !documents.personIds.has(docPerson)) {
      removed.push(row.bookingId)
      continue
    }
    if ((row.fingerprint && !sameBooking(row.fingerprint, documentFingerprint(doc))) || placeChanged) changed.push(row.bookingId)
    // Otherwise the booking is as signed and only a filter left it off the lines: no change.
  }
  for (const [key, row] of live) {
    if (signed.has(key)) continue
    // Added only when the booking was created or last written after the signature less the addition window (a filter
    // switched back on, or a person matched under another id, brings in bookings that were already there: no change).
    // A booking with no write time never counts.
    if (addedAfterMs == null || row.writtenMs == null || row.writtenMs <= addedAfterMs) continue
    added.push(row.bookingId)
  }
  return { changed, added, removed, basis: fingerprinted ? 'fingerprint' : 'bookingIds' }
}

function isEmptyDiff(diff: Diff | null): boolean {
  return !diff || (diff.changed.length === 0 && diff.added.length === 0 && diff.removed.length === 0)
}

/**
 * Rulebook 1.47.0 §8: what the person signs — one row per booking of the live payroll lines (leave and PAYE days left
 * out), `{ bookingId, collection, fingerprint, personId }`, stored as `operativeSignedBookings` with the operative
 * signature (every app, every signature, a re-signature included) together with `operativeSignedBookingsAt` (the
 * signature's instant). `personId` comes from the booking document (`liveBookings`) when given. Sorted by collection
 * and id so the same bookings always write the same list.
 */
export function signedTimesheetBookingRecord(
  liveLines: ReadonlyArray<SignedTimesheetLine | null | undefined> | null | undefined,
  liveBookings?: ReadonlyArray<SignedTimesheetBookingDocument | null | undefined> | null
): SignedTimesheetBooking[] {
  const docs = new Map<string, SignedTimesheetBookingDocument>()
  for (const doc of liveBookings ?? []) if (doc && text(doc.bookingId)) docs.set(keyOf(text(doc.collection) || 'bookings', text(doc.bookingId)), doc)
  const out = new Map<string, SignedTimesheetBooking>()
  for (const line of liveLines ?? []) {
    if (!line || line.isLeave === true || line.isPayeDay === true) continue
    const booking = lineBooking(line)
    if (!booking) continue
    const key = keyOf(booking.collection, booking.bookingId)
    const fingerprint = text(line.bookingFingerprint)
    const held = out.get(key)
    if (held) {
      if (!held.fingerprint && fingerprint) held.fingerprint = fingerprint
      continue
    }
    const doc = docs.get(key)
    out.set(key, { bookingId: booking.bookingId, collection: booking.collection, fingerprint, personId: text(doc?.personId), place: signedTimesheetBookingPlace(doc) })
  }
  return Array.from(out.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, row]) => row)
}

/**
 * Rulebook 1.47.0 §8: whether a signed timesheet's bookings changed since it was signed, and who must act.
 *
 * - `liveLines`: the period's live payroll lines for the person (the timesheet collector's lines, each with
 *   `bookingFingerprint`, `bookingCollection`, its id, and `bookingCreatedAt` / `bookingUpdatedAt`).
 * - `liveBookings`: the booking documents (labour and manager site, anyone's) loaded for at least the whole period, and
 *   `tombstonedBookingIds` (`{ collection, bookingId }`) when known. Without them a signed booking that is no longer on
 *   the sheet is never read as removed (it may only have been filtered out).
 * - `liveLoaded` must be true (the whole period's bookings arrived from the server, `timesheetSnapshotReady`), else
 *   nothing reads as changed. `selfSigned` (`timesheetSelfSigned`): the person's own signature completes the sheet.
 *
 * Exported: `exported` true, `reopened` false — frozen; `changed` and `reviewerMessage` warn only. Otherwise the person's
 * reference (`operativeSignedBookings` when it belongs to the latest signature, else the snapshot) differing from the
 * live bookings is `waitingFor: 'person'`; the person signed again but the snapshot is stale is `'lineManager'`
 * (self-signed: `'person'`). A snapshot frozen empty by the 1.43.0 loading bug is repaired by
 * `timesheetSnapshotNeedsRebuild`, not reopened.
 */
export function signedTimesheetBookingChanges(input: {
  sheet: SignedTimesheetSheet | null | undefined
  liveLines: ReadonlyArray<SignedTimesheetLine | null | undefined> | null | undefined
  liveLoaded: boolean
  selfSigned?: boolean | null
  liveBookings?: ReadonlyArray<SignedTimesheetBookingDocument | null | undefined> | null
  tombstonedBookingIds?: ReadonlyArray<{ collection?: unknown; bookingId?: unknown } | null | undefined> | null
  /**
   * Every id the sheet's person goes by (`personIdSet`, former and same-email ids, `operatives` rows on their email —
   * web `bookingIdsForAccount`). A signed booking now stored under one of them is still theirs. Missing = a booking is
   * never read as given to someone else.
   */
  personIds?: ReadonlyArray<string | null | undefined> | null
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
  const operativeSignedMs = realMs(sheet.operativeSignedAt) ?? realMs(sheet.operativeSignedAtMs)
  const override = sheet.weeklyReportOverride && typeof sheet.weeklyReportOverride === 'object' ? sheet.weeklyReportOverride : null
  const live = groupLines(input.liveLines ?? []).byKey

  let documents: Documents = null
  if (Array.isArray(input.liveBookings)) {
    const byKey = new Map<string, SignedTimesheetBookingDocument>()
    for (const doc of input.liveBookings) if (doc && text(doc.bookingId)) byKey.set(keyOf(text(doc.collection) || 'bookings', text(doc.bookingId)), doc)
    const tombstoned = new Set<string>()
    for (const row of input.tombstonedBookingIds ?? []) if (row && text(row.bookingId)) tombstoned.add(keyOf(text(row.collection) || 'bookings', text(row.bookingId)))
    const personIds = Array.isArray(input.personIds)
      ? new Set(input.personIds.map((id) => normalizeDocumentId(text(id))).filter(Boolean))
      : null
    documents = { byKey, tombstoned, personIds }
  }

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
    const snapshotAtMs = realMs(override.approvedAt) ?? realMs(sheet.managerSignedAt) ?? realMs(sheet.approvedAt) ?? operativeSignedMs
    // Signed lines that name no booking cannot be compared: never reopen on a guess.
    const snapshotAddedAfter = snapshotAtMs == null ? null : snapshotAtMs - SIGNED_TIMESHEET_ADDITION_WINDOW_MS
    if (!repairable && !(grouped.byKey.size === 0 && grouped.keyless > 0)) snapshotDiff = diffSides(grouped.byKey, live, documents, snapshotAddedAfter)
  }
  // The record belongs to the latest signature only (an older app may have signed again without writing one):
  // `operativeSignedBookingsSignedAt` equals `operativeSignedAt`; a record without it is current when written (server
  // time) no earlier than shortly before the signature.
  const recordAtMs = realMs(sheet.operativeSignedBookingsAt)
  const recordSignedAtMs = realMs(sheet.operativeSignedBookingsSignedAt)
  const recordCurrent =
    operativeSignedMs != null &&
    (recordSignedAtMs != null
      ? Math.abs(operativeSignedMs - recordSignedAtMs) <= RECORD_SIGNED_AT_MATCH_MS
      : recordAtMs != null && operativeSignedMs <= recordAtMs + RECORD_SIGNATURE_TOLERANCE_MS)
  const record = recordCurrent ? recordSide(sheet.operativeSignedBookings) : null
  // Additions against the server time of the record (else, while it is pending, the device time of the signature),
  // less the addition window.
  const recordReferenceMs = recordAtMs ?? operativeSignedMs
  const recordAddedAfter = recordReferenceMs == null ? null : recordReferenceMs - SIGNED_TIMESHEET_ADDITION_WINDOW_MS
  const personDiff = record ? diffSides(record, live, documents, recordAddedAfter) : snapshotDiff

  const personChanged = operativeSignedMs != null || override ? !isEmptyDiff(personDiff) : false
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
