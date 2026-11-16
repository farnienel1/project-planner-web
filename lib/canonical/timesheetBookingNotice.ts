/**
 * Rulebook 1.54.0 §8 / §13 (owner decision 16 Nov): "Your signed timesheet has changed". When a booking on a person's
 * signed, not-exported timesheet changes so the sheet reopens (the 1.47.0 rule, `signedTimesheetBookingChanges`), the
 * person gets an inbox row and a push (`timesheet_bookings_changed`).
 *
 * It is written by the server (the `timesheetBookingsChangedNotice` Cloud Function, on every labour and manager site
 * booking write), because the person who edits the booking — a job manager or admin — may not be able to read the
 * person's timesheet. The function reads the sheets of the booking's person and asks `timesheetBookingChangeNotice`
 * for each; nothing else decides.
 *
 * What counts is the 1.47.0 rule, booking by booking: a change to a booking the person signed (its day, slot, times,
 * overtime rate, break toggle, job or place, or the booking deleted, taken off its day or given to someone outside
 * the person's ids), or a booking newly on the sheet (created, moved into the period, or back on its day). Never: a
 * booking that was on the sheet's days but not signed (a filter left it off), a PAYE day, a sheet signed before 1.47.0
 * with neither a record nor a snapshot, an exported sheet, Tentative ↔ Confirmed, or a write that changes none of
 * those fields (write metadata, notes).
 *
 * One notice per sheet per signature: the dedupe key holds the sheet id and the person's signature instant, so further
 * changes before they sign again add no row; signing again (a new signature) lets the next change notify again.
 */

import { derivedDocumentId } from './derivedIds'
import { excludeActor, type NotificationPerson } from './notificationRecipients'
import { timesheetDaysForPerson, type TimesheetPerson } from './peopleDocuments'
import { normalizeDocumentId } from './scheduleSources'
import { overtimeFingerprintKey } from './bookingFingerprint'
import { overtimeBookingFingerprint } from './payeOvertime'
import {
  signedTimesheetBookingPlace,
  signedTimesheetLineBookingKey,
  type SignedTimesheetBookingDocument,
  type SignedTimesheetLine,
} from './timesheetBookingChanges'
import { resolveTimesheetExportedAtMs, timesheetTimestampMs, TIMESHEET_SIGNED_AFTER_MS } from './timesheetPeriod'
import { bookingOccupiesDay } from './warningRows'

export const TIMESHEET_BOOKINGS_CHANGED_NOTICE_TYPE = 'timesheet_bookings_changed'
export const TIMESHEET_BOOKINGS_CHANGED_NOTICE_TITLE = 'Your signed timesheet has changed'
export const TIMESHEET_BOOKINGS_CHANGED_NOTICE_MESSAGE =
  'A booking on your signed timesheet has changed. Please review and sign again, or speak to your line manager if something isn\'t correct.'

export type TimesheetBookingNoticeSheet = {
  userId?: unknown
  operativeSignedAt?: unknown
  operativeSignedAtMs?: unknown
  operativeSignedBookings?: unknown
  operativeSignedBookingsSignedAt?: unknown
  operativeSignedBookingsAt?: unknown
  managerSignedAt?: unknown
  approvedAt?: unknown
  exportedAt?: unknown
  exportedAtMs?: unknown
  weeklyReportOverride?: { lines?: ReadonlyArray<SignedTimesheetLine | null | undefined> | null } | null
}

export type TimesheetBookingNoticeDecision = {
  notify: boolean
  /** Why (or why not) — for the function's log line. */
  reason:
    | 'not-signed'
    | 'exported'
    | 'not-this-person'
    | 'outside-period'
    | 'paye-day'
    | 'no-change'
    | 'nothing-signed-to-compare'
    | 'booking-not-signed'
    | 'signed-booking-changed'
    | 'booking-added'
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function realMs(value: unknown): number | null {
  const ms = timesheetTimestampMs(value)
  return ms != null && ms > TIMESHEET_SIGNED_AFTER_MS ? ms : null
}

function present(value: unknown): boolean {
  return value != null && value !== '' && value !== false
}

function core(doc: SignedTimesheetBookingDocument): string {
  const fingerprint = overtimeBookingFingerprint({
    id: doc.bookingId,
    personId: '',
    dayKey: text(doc.dayKey),
    timeSlot: text(doc.timeSlot),
    workStartTime: text(doc.workStartTime) || undefined,
    workEndTime: text(doc.workEndTime) || undefined,
    isBreakRemoved: doc.isBreakRemoved === true,
    otMultiplierOverride: typeof doc.otMultiplierOverride === 'number' ? doc.otMultiplierOverride : null,
  } as Parameters<typeof overtimeBookingFingerprint>[0])
  // Without its status part (Tentative ↔ Confirmed is not pay), slot read canonically — as `signedTimesheetBookingChanges`.
  return overtimeFingerprintKey(fingerprint).split('|').slice(0, 6).join('|')
}

function occupies(doc: SignedTimesheetBookingDocument): boolean {
  const status = text(doc.status)
  return status === '' || bookingOccupiesDay(status)
}

/** Whether a booking write changed anything the 1.47.0 rule reads (day, slot, times, rate, break, place, person, status). */
export function timesheetBookingWriteMatters(
  before: SignedTimesheetBookingDocument | null | undefined,
  after: SignedTimesheetBookingDocument | null | undefined
): boolean {
  if (!before || !after) return Boolean(before || after)
  if (core(before) !== core(after)) return true
  if (signedTimesheetBookingPlace(before) !== signedTimesheetBookingPlace(after)) return true
  if (normalizeDocumentId(text(before.personId)) !== normalizeDocumentId(text(after.personId))) return true
  return occupies(before) !== occupies(after)
}

/** The bookings a signed sheet names: the person's current record, and the signed snapshot's lines. */
function signedBookingKeys(sheet: TimesheetBookingNoticeSheet): { keys: Set<string>; anyReference: boolean } {
  const keys = new Set<string>()
  let anyReference = false
  const signedMs = realMs(sheet.operativeSignedAt) ?? realMs(sheet.operativeSignedAtMs)
  const recordSignedMs = realMs(sheet.operativeSignedBookingsSignedAt)
  const recordAtMs = realMs(sheet.operativeSignedBookingsAt)
  const recordCurrent =
    signedMs != null &&
    (recordSignedMs != null ? Math.abs(signedMs - recordSignedMs) <= 1000 : recordAtMs != null && signedMs <= recordAtMs + 5 * 60 * 1000)
  if (recordCurrent && Array.isArray(sheet.operativeSignedBookings)) {
    anyReference = true
    for (const row of sheet.operativeSignedBookings) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const key = signedTimesheetLineBookingKey({ bookingId: r.bookingId, bookingCollection: r.collection })
      if (key) keys.add(key)
    }
  }
  const lines = sheet.weeklyReportOverride && Array.isArray(sheet.weeklyReportOverride.lines) ? sheet.weeklyReportOverride.lines : null
  if (lines) {
    for (const line of lines) {
      if (!line || line.isLeave === true || line.isPayeDay === true) continue
      const key = signedTimesheetLineBookingKey(line)
      if (key) {
        keys.add(key)
        anyReference = true
      }
    }
  }
  return { keys, anyReference }
}

/**
 * Rulebook 1.54.0: whether one booking write should tell this sheet's person that their signed timesheet changed.
 * `before` / `after` are the booking document before and after the write (null for a create / delete), in the
 * `SignedTimesheetBookingDocument` shape with organisation-zone day keys. `personIds` are every id the sheet's person
 * goes by (`personIdSet`, former and same-email ids, `operatives` rows on their email); `person` is their users
 * document (for the self-employed days, `timesheetDaysForPerson`). `periodStartDayKey` / `periodEndDayKey`: the sheet's
 * pay run.
 */
export function timesheetBookingChangeNotice(input: {
  sheet: TimesheetBookingNoticeSheet | null | undefined
  periodStartDayKey: string
  periodEndDayKey: string
  before: SignedTimesheetBookingDocument | null | undefined
  after: SignedTimesheetBookingDocument | null | undefined
  personIds: ReadonlyArray<string | null | undefined>
  person?: TimesheetPerson | null
  timeZone?: string | null
}): TimesheetBookingNoticeDecision {
  const sheet = input.sheet
  if (!sheet) return { notify: false, reason: 'not-signed' }
  const signed = present(sheet.operativeSignedAt) || present(sheet.operativeSignedAtMs) || present(sheet.managerSignedAt) || present(sheet.approvedAt)
  if (!signed) return { notify: false, reason: 'not-signed' }
  if (resolveTimesheetExportedAtMs(sheet as Record<string, unknown>) != null || realMs(sheet.exportedAtMs) != null) {
    return { notify: false, reason: 'exported' }
  }
  if (!timesheetBookingWriteMatters(input.before, input.after)) return { notify: false, reason: 'no-change' }
  const ids = new Set(input.personIds.map((id) => normalizeDocumentId(text(id))).filter(Boolean))
  const start = text(input.periodStartDayKey)
  const end = text(input.periodEndDayKey)
  const selfEmployedDays = input.person
    ? new Set(timesheetDaysForPerson(input.person, { startDayKey: start, endDayKey: end }, input.timeZone))
    : null
  const onSheet = (doc: SignedTimesheetBookingDocument | null | undefined): 'yes' | 'no-person' | 'no-period' | 'no-paye' => {
    if (!doc) return 'no-person'
    if (!ids.has(normalizeDocumentId(text(doc.personId)))) return 'no-person'
    const day = text(doc.dayKey)
    if (!day || day < start || day > end) return 'no-period'
    if (selfEmployedDays && !selfEmployedDays.has(day)) return 'no-paye'
    return occupies(doc) ? 'yes' : 'no-period'
  }
  const was = onSheet(input.before)
  const now = onSheet(input.after)
  if (was !== 'yes' && now !== 'yes') {
    const reason = was === 'no-paye' || now === 'no-paye' ? 'paye-day' : was === 'no-period' || now === 'no-period' ? 'outside-period' : 'not-this-person'
    return { notify: false, reason }
  }
  const { keys, anyReference } = signedBookingKeys(sheet)
  if (!anyReference) return { notify: false, reason: 'nothing-signed-to-compare' }
  const doc = (input.before ?? input.after) as SignedTimesheetBookingDocument
  const key = signedTimesheetLineBookingKey({ bookingId: doc.bookingId, bookingCollection: doc.collection || 'bookings' })
  if (was === 'yes') {
    return keys.has(key) ? { notify: true, reason: 'signed-booking-changed' } : { notify: false, reason: 'booking-not-signed' }
  }
  // Newly on the sheet (created, moved into the period, back on its day, given to this person): an addition.
  return keys.has(key) ? { notify: true, reason: 'signed-booking-changed' } : { notify: true, reason: 'booking-added' }
}

/** `timesheet_bookings_changed`: the sheet's person (an account), never the person who changed the booking. */
export function timesheetBookingsChangedRecipients(
  subject: NotificationPerson,
  actor: NotificationPerson,
  roster: Parameters<typeof excludeActor>[2]
): string[] {
  const id = typeof subject === 'string' ? text(subject) : text(subject?.id)
  return id ? excludeActor([id], actor, roster) : []
}

/**
 * The notice's de-dupe key: one row per sheet per person signature (`timesheetBookingsChanged|{sheetDocId}|{signedMs}`),
 * and its document id (`derivedDocumentId`, UUID-shaped, the same on every run). Null without a signature instant.
 */
export function timesheetBookingsChangedNoticeId(sheetDocId: string, sheet: TimesheetBookingNoticeSheet | null | undefined): string | null {
  const id = text(sheetDocId)
  const signedMs = realMs(sheet?.operativeSignedAt) ?? realMs(sheet?.operativeSignedAtMs) ?? realMs(sheet?.managerSignedAt) ?? realMs(sheet?.approvedAt)
  if (!id || signedMs == null) return null
  return derivedDocumentId(`timesheetBookingsChanged|${id}|${signedMs}`)
}
