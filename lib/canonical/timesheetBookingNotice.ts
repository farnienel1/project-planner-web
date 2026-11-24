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
  signedTimesheetBookingWriteReopens,
  type SignedTimesheetBookingDocument,
  type SignedTimesheetLine,
  type SignedTimesheetSheet,
} from './timesheetBookingChanges'
import { resolveTimesheetExportedAtMs, timesheetTimestampMs, TIMESHEET_SIGNED_AFTER_MS } from './timesheetPeriod'
import { bookingOccupiesDay } from './warningRows'
import { isSiteLocationType } from './homeOverview'

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
  /** 1.55.0: the sheet is exported, so the notice is "an update to your already exported timesheet" (a revision due). */
  exported?: boolean
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

/** Where a booking stands against one person's sheet for a pay run (`timesheetBookingSheetTest`). */
export type TimesheetBookingOnSheet = 'yes' | 'no-person' | 'no-period' | 'no-paye'

/** A stored booking with its write times (epoch ms, Date, Timestamp-like or ISO), for `timesheetLiveLinesFromBookings`. */
export type TimesheetLiveBookingDocument = SignedTimesheetBookingDocument & { createdAt?: unknown; updatedAt?: unknown }

/**
 * Rulebook 1.54.0 / 1.78.0 §8: whether a booking is on one person's timesheet for a pay run — the booking's person is
 * one of `personIds` (without case), its organisation-zone day is inside the pay run, the person is self-employed that
 * day (`timesheetDaysForPerson`, when `person` is given; a PAYE day is never a timesheet line) and its status occupies
 * the day (`bookingOccupiesDay`; no status occupies it). The one test behind `timesheetBookingChangeNotice` and
 * `timesheetLiveLinesFromBookings`, so the server reads a sheet's bookings exactly as the notice does.
 */
export function timesheetBookingSheetTest(input: {
  personIds: ReadonlyArray<string | null | undefined>
  periodStartDayKey: string
  periodEndDayKey: string
  person?: TimesheetPerson | null
  timeZone?: string | null
}): (doc: SignedTimesheetBookingDocument | null | undefined) => TimesheetBookingOnSheet {
  const ids = new Set((input.personIds ?? []).map((id) => normalizeDocumentId(text(id))).filter(Boolean))
  const start = text(input.periodStartDayKey)
  const end = text(input.periodEndDayKey)
  const selfEmployedDays = input.person
    ? new Set(timesheetDaysForPerson(input.person, { startDayKey: start, endDayKey: end }, input.timeZone))
    : null
  return (doc) => {
    if (!doc) return 'no-person'
    if (!ids.has(normalizeDocumentId(text(doc.personId)))) return 'no-person'
    const day = text(doc.dayKey)
    if (!day || day < start || day > end) return 'no-period'
    if (selfEmployedDays && !selfEmployedDays.has(day)) return 'no-paye'
    return occupies(doc) ? 'yes' : 'no-period'
  }
}

/**
 * Rulebook 1.78.0 §8: one person's live timesheet lines for a pay run, from the stored booking documents (labour and
 * manager site, any person) — for a caller with no timesheet collector (the sign-off reminder Cloud Function), so it can
 * ask `signedTimesheetBookingChanges` exactly as the apps do. One line per booking on the sheet
 * (`timesheetBookingSheetTest`): `bookingId`, `bookingCollection`, `bookingFingerprint` (`overtimeBookingFingerprint`
 * of the booking, as the collector writes it), `bookingCreatedAt` / `bookingUpdatedAt`, and `scheduleOptionPlace` for a
 * manager site booking that is not on a project or small works (Office, Working from home, Site survey, a custom place).
 * PAYE days and bookings off their day are left out (they are never timesheet lines). Lines carry no hours or pay.
 */
export function timesheetLiveLinesFromBookings(input: {
  bookings: ReadonlyArray<TimesheetLiveBookingDocument | null | undefined> | null | undefined
  personIds: ReadonlyArray<string | null | undefined>
  periodStartDayKey: string
  periodEndDayKey: string
  person?: TimesheetPerson | null
  timeZone?: string | null
}): SignedTimesheetLine[] {
  const onSheet = timesheetBookingSheetTest(input)
  const lines: SignedTimesheetLine[] = []
  for (const doc of input.bookings ?? []) {
    if (!doc || !text(doc.bookingId) || onSheet(doc) !== 'yes') continue
    const collection = text(doc.collection) || 'bookings'
    const fingerprint = overtimeBookingFingerprint({
      id: text(doc.bookingId),
      personId: '',
      dayKey: text(doc.dayKey),
      timeSlot: text(doc.timeSlot),
      workStartTime: text(doc.workStartTime) || undefined,
      workEndTime: text(doc.workEndTime) || undefined,
      isBreakRemoved: doc.isBreakRemoved === true,
      otMultiplierOverride: typeof doc.otMultiplierOverride === 'number' ? doc.otMultiplierOverride : null,
    } as Parameters<typeof overtimeBookingFingerprint>[0])
    lines.push({
      bookingId: text(doc.bookingId),
      bookingCollection: collection,
      bookingFingerprint: fingerprint,
      isPayeDay: false,
      bookingCreatedAt: doc.createdAt ?? null,
      bookingUpdatedAt: doc.updatedAt ?? null,
      scheduleOptionPlace: collection === 'managerSiteBookings' && !isSiteLocationType(doc.locationType),
    })
  }
  return lines
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
  /** The write's server time (additions are judged against the signature less the 1.47.0 window). */
  nowMs?: number | null
  /**
   * 1.55.0 §8: also judge an exported sheet — pass the latest version of the pay run only
   * (`timesheetLatestVersion`). A change there makes a revision due (`exported: true` on the decision). Missing = an
   * exported sheet never notifies, as before 1.55.0.
   */
  includeExported?: boolean | null
}): TimesheetBookingNoticeDecision {
  const sheet = input.sheet
  if (!sheet) return { notify: false, reason: 'not-signed' }
  const signed = present(sheet.operativeSignedAt) || present(sheet.operativeSignedAtMs) || present(sheet.managerSignedAt) || present(sheet.approvedAt)
  if (!signed) return { notify: false, reason: 'not-signed' }
  const exported = resolveTimesheetExportedAtMs(sheet as Record<string, unknown>) != null || realMs(sheet.exportedAtMs) != null
  if (exported && input.includeExported !== true) return { notify: false, reason: 'exported' }
  if (!timesheetBookingWriteMatters(input.before, input.after)) return { notify: false, reason: 'no-change' }
  const onSheet = timesheetBookingSheetTest({
    personIds: input.personIds,
    periodStartDayKey: input.periodStartDayKey,
    periodEndDayKey: input.periodEndDayKey,
    person: input.person,
    timeZone: input.timeZone,
  })
  const was = onSheet(input.before)
  const now = onSheet(input.after)
  if (was !== 'yes' && now !== 'yes') {
    const reason = was === 'no-paye' || now === 'no-paye' ? 'paye-day' : was === 'no-period' || now === 'no-period' ? 'outside-period' : 'not-this-person'
    return { notify: false, reason }
  }
  // Review of #337 (item 3): exactly the app's decision (`signedTimesheetBookingWriteReopens`, the 1.47.0 comparison
  // restricted to this booking), so a notice goes out only when the person will see the triangle.
  const doc = (input.after ?? input.before) as SignedTimesheetBookingDocument
  const decision = signedTimesheetBookingWriteReopens({
    sheet: sheet as SignedTimesheetSheet,
    booking: { collection: doc.collection || 'bookings', bookingId: doc.bookingId },
    after: input.after ?? null,
    afterOnSheet: now === 'yes',
    personIds: input.personIds,
    includeExported: exported,
    nowMs: typeof input.nowMs === 'number' && Number.isFinite(input.nowMs) ? input.nowMs : Date.now(),
  })
  if (decision.reference === 'none') return { notify: false, reason: 'nothing-signed-to-compare' }
  if (!decision.reopens) return { notify: false, reason: 'booking-not-signed' }
  return { notify: true, ...(exported ? { exported: true } : {}), reason: decision.kind === 'added' ? 'booking-added' : 'signed-booking-changed' }
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

/**
 * 1.55.0 §8 / §13: the de-dupe id of "an update to your already exported timesheet" — one row per exported version
 * (`timesheetRevisionDue|{sheetDocId}|{exportedAt ms}`, `derivedDocumentId`), so the person is told once per version
 * however many bookings change. Null without an export instant.
 */
export function timesheetRevisionDueNoticeId(sheetDocId: string, sheet: TimesheetBookingNoticeSheet | null | undefined): string | null {
  const id = text(sheetDocId)
  const exportedMs = realMs(sheet?.exportedAt) ?? realMs(sheet?.exportedAtMs)
  if (!id || exportedMs == null) return null
  return derivedDocumentId(`timesheetRevisionDue|${id}|${exportedMs}`)
}
