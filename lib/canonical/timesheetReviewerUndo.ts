/**
 * Rulebook 1.90.0 §8 (owner request 24 Nov): "Cancel changes" — undo what the line manager (or an admin) changed while
 * making changes to a timesheet, not just close the mode.
 *
 * A "making changes" session is every reviewer edit recorded on the sheet under the person's current signature and the
 * current counter-signature (`reviewerBookingEdits` records with the same `forSignedAtMs` and `forManagerSignedAtMs`), or
 * on a draft revision (`forRevisionDraft`). Each booking record holds the booking's values before the session's first
 * edit (`before`, `timesheetReviewerEditBefore`); each price work / expense decision changed in the session holds the
 * stored review it replaced (`timesheetReviewerReviewRecord`).
 *
 * `timesheetReviewerUndoPlan` turns the session into writes, never overwriting a later change by someone else:
 * - a ⚙ / trim: the booking's edit fields are put back (`restore`) — only while the booking is still exactly as the
 *   reviewer left it (same fingerprint and place); otherwise that booking is refused (`changedSince`, `gone`);
 * - a ✕: the booking is re-created from its before-values under a NEW id (`recreate`) — a deleted booking's id stays
 *   tombstoned for good (§2: nothing resurrects a deleted id), and the old record is kept (`restoredAs`) with a record
 *   for the new one (`restoredFrom`), so the sheet does not read as changed; refused when the before-values are missing
 *   (an edit made before 1.90.0) or the booking somehow exists again;
 * - a price work / expense decision: the stored review is put back (or removed when there was none).
 * Who may write what is still the security rules' (§16): a line manager who does not manage the job may put back times
 * but not re-create a removed booking — the app reports that one as refused (`notAllowed`).
 *
 * Nothing here writes; the apps pass stored documents in and write what comes back.
 */
import { normalizeDocumentId } from './scheduleSources'
import {
  signedTimesheetBookingPlace,
  timesheetReviewerBookingEditKey,
  timesheetReviewerBookingFingerprint,
  timesheetReviewerEditStillAsLeft,
} from './timesheetBookingChanges'
import { resolveTimesheetExportedAtMs, timesheetTimestampMs, TIMESHEET_SIGNED_AFTER_MS } from './timesheetPeriod'
import { TIMESHEET_REVIEW_BOOKING_FIELDS, timesheetReviewBookingDocument } from './timesheetReviewBookingWrites'
import { timesheetRevisionIsDraft } from './timesheetRevisionDraft'

export const TIMESHEET_REVIEWER_CANCEL_CHANGES_LABEL = 'Cancel changes'
export const TIMESHEET_REVIEWER_CANCEL_CHANGES_DONE_MESSAGE = 'Changes cancelled. The timesheet is as it was before you made changes.'
export const TIMESHEET_REVIEWER_UNDO_CHANGED_SINCE_MESSAGE = 'This booking has been changed again since — not undone.'
export const TIMESHEET_REVIEWER_UNDO_GONE_MESSAGE = 'This booking was removed elsewhere since — not undone.'
export const TIMESHEET_REVIEWER_UNDO_NO_BEFORE_MESSAGE = 'This change was made before Cancel changes existed, so its old values are not known — not undone.'
/** Review of #457 (finding 1): a removed booking whose stored values lack its person or day is never re-created half-made. */
export const TIMESHEET_REVIEWER_UNDO_INCOMPLETE_MESSAGE =
  "This removed booking's details were not all kept, so it can't be put back safely — not undone. Book it again in scheduling."
export const TIMESHEET_REVIEWER_UNDO_NOT_ALLOWED_MESSAGE =
  "You can't book this job, so this removed booking can't be put back. Ask an admin or the job's manager to book it again."
/** The key prefix of a price work / expense decision's record in `reviewerBookingEdits` (no booking id: never compared). */
export const TIMESHEET_REVIEWER_REVIEW_RECORD_PREFIX = 'review__extra__'

/** Stored fields never copied when a removed booking is re-created (the app writes its own id, times and metadata). */
const RECREATE_DROP_FIELDS = ['id', 'createdAt', 'updatedAt', 'updatedBy', 'updatedFrom', 'deletedAt', 'deletedBy'] as const
const MATCH_MS = 1000

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function realMs(value: unknown): number | null {
  const ms = timesheetTimestampMs(value)
  return ms != null && ms > TIMESHEET_SIGNED_AFTER_MS ? ms : null
}

function recordMs(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : realMs(value) ?? 0
}

/**
 * The before-values a reviewer edit stores: for a ✕ (`deleted`) the whole stored booking less what a re-create writes
 * itself; for a ⚙ / trim only the edit fields that are stored (an absent one is put back as absent).
 */
export function timesheetReviewerEditBefore(input: { data: Record<string, unknown> | null | undefined; deleted: boolean }): Record<string, unknown> | null {
  const data = record(input?.data)
  if (Object.keys(data).length === 0) return null
  const out: Record<string, unknown> = {}
  if (input.deleted) {
    for (const [key, value] of Object.entries(data)) {
      if (!(RECREATE_DROP_FIELDS as readonly string[]).includes(key) && value !== undefined) out[key] = value
    }
    return out
  }
  for (const key of TIMESHEET_REVIEW_BOOKING_FIELDS) if (data[key] !== undefined) out[key] = data[key]
  return out
}

/** The session a sheet is in now: the person's signature and the counter-signature (0 when none), and draft-ness. */
export function timesheetReviewerSession(sheet: Record<string, unknown> | null | undefined): { forSignedAtMs: number; forManagerSignedAtMs: number; draft: boolean } {
  const row = record(sheet)
  return {
    forSignedAtMs: realMs(row.operativeSignedAt) ?? realMs(row.operativeSignedAtMs) ?? 0,
    forManagerSignedAtMs: realMs(row.managerSignedAt) ?? realMs(row.approvedAt) ?? realMs(row.managerSignedAtMs) ?? 0,
    draft: timesheetRevisionIsDraft(row),
  }
}

export type TimesheetReviewerSessionRecord = {
  key: string
  kind: 'booking' | 'review'
  value: Record<string, unknown>
}

/**
 * The records of the current making-changes session still to undo: on a draft revision every draft record; otherwise
 * those under the current person signature AND the current counter-signature (so a review before the first sign-off is
 * never a session). Records already settled by an undo (`restoredAs`, `restoredFrom`) are left out.
 */
export function timesheetReviewerSessionRecords(sheet: Record<string, unknown> | null | undefined): TimesheetReviewerSessionRecord[] {
  const row = record(sheet)
  if (resolveTimesheetExportedAtMs(row) != null) return []
  const session = timesheetReviewerSession(row)
  const out: TimesheetReviewerSessionRecord[] = []
  // Review of #457 (finding 2): a late extra's decision (1.54.0) is never part of a making-changes session — a record an
  // earlier build wrote for one is ignored, so it never offers Cancel changes or puts a late extra's review back.
  const lateIds = new Set(
    (Array.isArray(row.lateExtras) ? row.lateExtras : []).map((entry) => normalizeDocumentId(text(record(entry).id))).filter(Boolean)
  )
  for (const [key, raw] of Object.entries(record(row.reviewerBookingEdits))) {
    const value = record(raw)
    if (text(value.restoredAs) || text(value.restoredFrom)) continue
    if (value.kind === 'extraReview' && (value.lateExtra === true || lateIds.has(normalizeDocumentId(text(value.entryId))))) continue
    const inSession = session.draft
      ? value.forRevisionDraft === true
      : session.forManagerSignedAtMs > 0 &&
        Math.abs(recordMs(value.forSignedAtMs) - session.forSignedAtMs) <= MATCH_MS &&
        Math.abs(recordMs(value.forManagerSignedAtMs) - session.forManagerSignedAtMs) <= MATCH_MS
    if (!inSession) continue
    out.push({ key, kind: value.kind === 'extraReview' ? 'review' : 'booking', value })
  }
  return out.sort((a, b) => a.key.localeCompare(b.key))
}

/**
 * Whether "Cancel changes" is offered to this viewer: a reviewer, never the person, on an unexported sheet with
 * something to undo in the current session (`timesheetReviewerSessionRecords`).
 */
export function timesheetReviewerCancelChangesOffered(input: {
  sheet: Record<string, unknown> | null | undefined
  viewerIsReviewer: boolean
  viewerIsSubject: boolean
}): boolean {
  if (input.viewerIsReviewer !== true || input.viewerIsSubject === true) return false
  return timesheetReviewerSessionRecords(input.sheet).length > 0
}

/** The confirm before Cancel changes. */
export function timesheetReviewerCancelChangesConfirmMessage(changeCount: number): string {
  const what = changeCount === 1 ? 'the change you made' : `the ${changeCount} changes you made`
  return `Cancel ${what}? Bookings go back to how they were and your decisions on price work and expenses are undone. A booking changed again by someone else since is left as it is.`
}

/**
 * The record of a price work / expense decision changed in the session: the stored review it replaced (`before`, null
 * when there was none). Null when nothing is recorded: not a session (no counter-signature and not a draft), exported,
 * or a record for this entry already exists in the session (the first before-value is kept).
 */
export function timesheetReviewerReviewRecord(input: {
  sheet: Record<string, unknown> | null | undefined
  entryId: unknown
  before: Record<string, unknown> | null | undefined
  editedBy: unknown
  /**
   * Review of #457 (finding 2): the reviewer pressed Make changes on this counter-signature and the session is open on
   * screen. Without it a decision is recorded only on a draft revision, or when the session already holds a record
   * (its first booking change ended the on-screen mode but the session goes on until the next sign-off).
   */
  makingChanges?: boolean
  /** The review being written; a late extra's (`lateExtra: true`, 1.54.0) is never recorded. */
  after?: Record<string, unknown> | null
}): { key: string; value: Record<string, unknown> } | null {
  const row = record(input?.sheet)
  if (resolveTimesheetExportedAtMs(row) != null) return null
  const session = timesheetReviewerSession(row)
  if (!session.draft && session.forManagerSignedAtMs === 0) return null
  const id = text(input.entryId)
  if (!id) return null
  if (record(input.after).lateExtra === true || record(input.before).lateExtra === true) return null
  const lateIds = (Array.isArray(row.lateExtras) ? row.lateExtras : []).map((entry) => normalizeDocumentId(text(record(entry).id)))
  if (lateIds.includes(normalizeDocumentId(id))) return null
  if (!session.draft && input.makingChanges !== true && timesheetReviewerSessionRecords(row).length === 0) return null
  const key = `${TIMESHEET_REVIEWER_REVIEW_RECORD_PREFIX}${normalizeDocumentId(id)}`.replace(/[^A-Za-z0-9_-]/g, '_')
  const existing = record(record(row.reviewerBookingEdits)[key])
  if (Object.keys(existing).length > 0 && timesheetReviewerSessionRecords(row).some((r) => r.key === key)) return null
  return {
    key,
    value: {
      kind: 'extraReview',
      entryId: id,
      before: input.before && typeof input.before === 'object' ? input.before : null,
      editedBy: text(input.editedBy),
      forSignedAtMs: session.forSignedAtMs,
      forManagerSignedAtMs: session.forManagerSignedAtMs,
      ...(session.draft ? { forRevisionDraft: true } : {}),
    },
  }
}

export type TimesheetReviewerUndoAction =
  | { kind: 'restore'; key: string; collection: string; bookingId: string; set: Record<string, unknown>; remove: string[] }
  | { kind: 'recreate'; key: string; collection: string; oldBookingId: string; data: Record<string, unknown> }
  | { kind: 'refuse'; key: string; collection: string; bookingId: string; reason: 'changedSince' | 'gone' | 'noBefore' | 'reappeared' | 'incomplete'; message: string }

export type TimesheetReviewerUndoPlan = {
  actions: TimesheetReviewerUndoAction[]
  /** Dotted `extraEntryReviews.{id}` values to put back, and the ones to remove. */
  reviews: { set: Record<string, unknown>; remove: string[] }
  /** `reviewerBookingEdits.{key}` records to remove once their write succeeded (restores and review records). */
  removeRecordKeys: string[]
  changeCount: number
  refusedCount: number
}

/**
 * The writes that undo the current session. `bookings` are the session's bookings read fresh: `data` the stored booking
 * (null when missing), `tombstoned` when its tombstone exists. Every refused booking is named with a message; nothing
 * changed since by someone else is ever overwritten.
 */
export function timesheetReviewerUndoPlan(input: {
  sheet: Record<string, unknown> | null | undefined
  bookings: ReadonlyArray<{ collection: string; bookingId: string; data: Record<string, unknown> | null; tombstoned?: boolean }>
  timeZone?: string | null
}): TimesheetReviewerUndoPlan {
  const records = timesheetReviewerSessionRecords(input?.sheet)
  const live = new Map<string, { data: Record<string, unknown> | null; tombstoned: boolean }>()
  for (const row of input?.bookings ?? []) {
    const key = timesheetReviewerBookingEditKey(row.collection, row.bookingId)
    if (key) live.set(key, { data: row.data ?? null, tombstoned: row.tombstoned === true })
  }
  const actions: TimesheetReviewerUndoAction[] = []
  const set: Record<string, unknown> = {}
  const remove: string[] = []
  const removeRecordKeys: string[] = []
  for (const entry of records) {
    const value = entry.value
    if (entry.kind === 'review') {
      const entryId = text(value.entryId)
      if (!entryId) continue
      const before = value.before && typeof value.before === 'object' ? value.before : null
      if (before) set[`extraEntryReviews.${entryId}`] = before
      else remove.push(`extraEntryReviews.${entryId}`)
      removeRecordKeys.push(entry.key)
      continue
    }
    const collection = text(value.collection) || 'bookings'
    const bookingId = text(value.bookingId)
    if (!bookingId) continue
    const refuse = (reason: 'changedSince' | 'gone' | 'noBefore' | 'reappeared' | 'incomplete', message: string) =>
      actions.push({ kind: 'refuse', key: entry.key, collection, bookingId, reason, message })
    const before = value.before && typeof value.before === 'object' ? (value.before as Record<string, unknown>) : null
    const now = live.get(timesheetReviewerBookingEditKey(collection, bookingId))
    if (!before) {
      refuse('noBefore', TIMESHEET_REVIEWER_UNDO_NO_BEFORE_MESSAGE)
      continue
    }
    if (value.deleted === true) {
      if (now?.data && !now.tombstoned) {
        refuse('reappeared', TIMESHEET_REVIEWER_UNDO_CHANGED_SINCE_MESSAGE)
        continue
      }
      // Review of #457 (finding 1): never write a booking without its person or its day.
      const personField = collection === 'managerSiteBookings' ? 'userId' : 'operativeId'
      if (!text(before[personField]) || before.date == null || text(before.date) === '') {
        refuse('incomplete', TIMESHEET_REVIEWER_UNDO_INCOMPLETE_MESSAGE)
        continue
      }
      actions.push({ kind: 'recreate', key: entry.key, collection, oldBookingId: bookingId, data: { ...before } })
      continue
    }
    if (!now?.data || now.tombstoned) {
      refuse('gone', TIMESHEET_REVIEWER_UNDO_GONE_MESSAGE)
      continue
    }
    const doc = timesheetReviewBookingDocument({ collection, id: bookingId, data: now.data, timeZone: input.timeZone ?? null })
    if (!timesheetReviewerEditStillAsLeft(value, doc)) {
      refuse('changedSince', TIMESHEET_REVIEWER_UNDO_CHANGED_SINCE_MESSAGE)
      continue
    }
    const restoreSet: Record<string, unknown> = {}
    const restoreRemove: string[] = []
    for (const field of TIMESHEET_REVIEW_BOOKING_FIELDS) {
      if (before[field] !== undefined) {
        if (JSON.stringify(before[field]) !== JSON.stringify(now.data[field])) restoreSet[field] = before[field]
      } else if (now.data[field] !== undefined) restoreRemove.push(field)
    }
    actions.push({ kind: 'restore', key: entry.key, collection, bookingId, set: restoreSet, remove: restoreRemove })
  }
  const refusedCount = actions.filter((a) => a.kind === 'refuse').length
  return { actions, reviews: { set, remove }, removeRecordKeys, changeCount: records.length, refusedCount }
}

/**
 * After a removed booking is re-created under `newBookingId`: the old record (kept, marked `restoredAs`, so the old id
 * still reads as removed by the reviewer) and a record for the new booking (`restoredFrom`, exactly as re-created, so it
 * is not read as an addition the person must sign). `createdDoc` is the re-created booking as written.
 */
export function timesheetReviewerRestoredRecords(input: {
  sheet: Record<string, unknown> | null | undefined
  oldKey: string
  oldRecord: Record<string, unknown>
  collection: string
  newBookingId: string
  createdDoc: Record<string, unknown>
  editedBy: unknown
  timeZone?: string | null
}): { old: { key: string; value: Record<string, unknown> }; created: { key: string; value: Record<string, unknown> } } | null {
  const key = timesheetReviewerBookingEditKey(input.collection, input.newBookingId)
  const doc = timesheetReviewBookingDocument({ collection: input.collection, id: input.newBookingId, data: input.createdDoc, timeZone: input.timeZone ?? null })
  if (!key || !doc) return null
  const session = timesheetReviewerSession(input.sheet)
  return {
    old: { key: input.oldKey, value: { ...input.oldRecord, restoredAs: input.newBookingId } },
    created: {
      key,
      value: {
        bookingId: input.newBookingId,
        collection: input.collection,
        fingerprint: timesheetReviewerBookingFingerprint(doc),
        place: signedTimesheetBookingPlace(doc),
        deleted: false,
        editedBy: text(input.editedBy),
        forSignedAtMs: session.forSignedAtMs,
        forManagerSignedAtMs: session.forManagerSignedAtMs,
        restoredFrom: text(input.oldRecord.bookingId),
      },
    },
  }
}
