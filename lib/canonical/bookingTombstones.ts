/**
 * Deleted-booking tombstones.
 *
 * Deleting a labour booking (`bookings`) or a manager schedule booking (`managerSiteBookings`)
 * also writes `organizations/{orgId}/deletedBookings/{bookingId}` in the same batch. Firestore
 * rules refuse any later create or update of `organizations/{orgId}/{collection}/{bookingId}`
 * while that tombstone exists, so a phone that was offline cannot bring the booking back by
 * replaying a queued save. The replaying app gets permission-denied, drops the queued item, and
 * tells the person "This booking was cancelled or deleted on another device".
 *
 * The rulebook builds the plain fields. Each app adds `deletedAt` as its SDK server timestamp
 * (web `serverTimestamp()`, iOS `FieldValue.serverTimestamp()`); the rules require it to equal
 * the request time. Tombstones are never updated; only an admin deletes one.
 *
 * A tombstone carries only `BOOKING_TOMBSTONE_FIELDS`. It is the one exception to "writes carry metadata"
 * (`writeMetadataFields`): no `updatedAt` / `updatedBy` / `updatedFrom`, because the rules accept no other keys.
 * Who may delete a booking (and write its tombstone) is `canDeleteBooking` (1.10.0): admins any booking, managers
 * bookings on the jobs they manage, operatives never. Subcontractor bookings (`subcontractorBookings`) are tombstoned
 * too from 1.10.0.
 *
 * 1.33.0 (owner decision 4 Nov "Offline delete on iOS"): iOS and Android queue a labour or manager schedule booking
 * delete offline (`offlineAvailability('booking.delete')`; subcontractor bookings stay online only,
 * `bookingDeleteOfflineAction`). The queued item keeps the booking's `bookingDeleteFingerprint` as last synced, and the
 * replay asks `offlineDeleteReplayDecision`. Web stays online only.
 */

import { bookingClock, bookingDateMs, normalizeBookingStatus, normalizeBookingTimeSlot } from './bookings'
import { zoneOrLondon } from './dayKeys'
import { idKey } from './personIds'
import {
  isTimesheetExported,
  isTimesheetManagerSigned,
  isTimesheetOperativeSigned,
  parseTimesheetStatusFields,
  timesheetPeriodContainsDay,
} from './timesheetPeriod'
import { WRITE_PLATFORMS, type WritePlatform } from './writeMetadata'
import { dayKeyInZone } from '../orgTime/zoneTime'

export const BOOKING_TOMBSTONE_COLLECTION = 'deletedBookings'
export const TOMBSTONED_BOOKING_COLLECTIONS = ['bookings', 'managerSiteBookings', 'subcontractorBookings'] as const
export type TombstonedBookingCollection = (typeof TOMBSTONED_BOOKING_COLLECTIONS)[number]

/** Each delete writes two documents, and a Firestore batch holds at most 500 writes. */
export const BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT = 200

/** Fields every tombstone stores, including the SDK-written `deletedAt`. */
export const BOOKING_TOMBSTONE_FIELDS = ['bookingId', 'collection', 'deletedAt', 'deletedBy', 'deletedFrom'] as const

export type BookingTombstoneWriteFields = {
  bookingId: string
  collection: TombstonedBookingCollection
  deletedBy: string
  deletedFrom: WritePlatform
  /**
   * 1.33.0 (PAYE overtime item f): only on a delete made by an overtime Return — the request that approved it, so the
   * rules can let the person's line manager delete that one booking. Absent on every other delete.
   */
  overtimeRequestId?: string
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** A document id the rules can match: no slash, not blank. */
function documentId(value: unknown): string {
  const id = trimmed(value)
  if (!id || id.includes('/')) return ''
  return id
}

export function isTombstonedBookingCollection(value: unknown): value is TombstonedBookingCollection {
  return (TOMBSTONED_BOOKING_COLLECTIONS as readonly string[]).includes(trimmed(value))
}

/**
 * `organizations/{orgId}/deletedBookings/{bookingId}`. The booking id is the stored document id
 * exactly (web writes upper-case UUIDs; an iOS `documentKey` keeps whatever case it was saved with).
 * Null when either id is blank.
 */
export function bookingTombstonePath(organizationId: unknown, bookingId: unknown): string | null {
  const org = documentId(organizationId)
  const id = documentId(bookingId)
  if (!org || !id) return null
  return `organizations/${org}/${BOOKING_TOMBSTONE_COLLECTION}/${id}`
}

/**
 * The tombstone written beside a booking delete. Null when any input is unusable. `overtimeRequestId` (1.33.0) is
 * written only when it is a usable document id; every other delete leaves it out.
 */
export function bookingTombstoneWriteFields(input: {
  bookingId: unknown
  collection: unknown
  deletedBy: unknown
  deletedFrom: unknown
  /** 1.33.0: the overtime request whose Return deletes the booking (a document id); omitted when blank. */
  overtimeRequestId?: unknown
}): BookingTombstoneWriteFields | null {
  const bookingId = documentId(input.bookingId)
  const collection = trimmed(input.collection)
  const deletedBy = trimmed(input.deletedBy)
  const deletedFrom = trimmed(input.deletedFrom).toLowerCase()
  if (!bookingId || !deletedBy) return null
  if (!isTombstonedBookingCollection(collection)) return null
  if (!(WRITE_PLATFORMS as readonly string[]).includes(deletedFrom)) return null
  const overtimeRequestId = documentId(input.overtimeRequestId)
  return {
    bookingId,
    collection,
    deletedBy,
    deletedFrom: deletedFrom as WritePlatform,
    ...(overtimeRequestId ? { overtimeRequestId } : {}),
  }
}

function errorCodeText(errorCode: unknown): string {
  return (typeof errorCode === 'number' ? String(errorCode) : trimmed(errorCode)).toLowerCase().replace(/^firestore\//, '')
}

/** What `bookingReplayRefusedIsFinal` reads when it is given more than the error code. */
export type BookingReplayRefusal = {
  /** The Firestore error code: web string (`permission-denied`, `not-found`) or the iOS `FirestoreErrorCode` number. */
  code: unknown
  /** True when the queued item creates the booking; false for an edit or a delete (1.33.0) of an existing booking. */
  isCreate?: boolean | null
}

/**
 * A queued offline booking save that the server refused is dropped, not retried, when the refusal is final:
 *   - permission-denied (`7` on iOS): the booking has a tombstone or the person may not write it;
 *   - not-found (`5` on iOS) on an edit or delete replay (`isCreate` false): the booking was deleted on another
 *     device, so the edit is never turned into a create. A queued delete that meets either goes through
 *     `offlineDeleteRefusalDecision` for what the device shows.
 * Pass the error code alone (the 1.1.0 shape; not-found is then not final because it is unknown whether the item
 * was a create) or `{ code, isCreate }`.
 */
export function bookingReplayRefusedIsFinal(refusal: unknown): boolean {
  const input =
    refusal && typeof refusal === 'object' && 'code' in (refusal as Record<string, unknown>)
      ? (refusal as BookingReplayRefusal)
      : { code: refusal, isCreate: null }
  const code = errorCodeText(input.code)
  if (code === 'permission-denied' || code === '7') return true
  if ((code === 'not-found' || code === '5') && input.isCreate === false) return true
  return false
}

export const BOOKING_REPLAY_REFUSED_MESSAGE = 'This booking was cancelled or deleted on another device.'

// MARK: - Offline delete (1.33.0, owner decision 4 Nov "Offline delete on iOS")

/** Shown when a queued delete is refused because the booking changed on another device after the offline delete. */
export const OFFLINE_DELETE_CHANGED_MESSAGE = 'Changed on another device — not deleted'
/** Shown when a queued delete is refused because the person may no longer delete the booking; the booking is back. */
export const OFFLINE_DELETE_REFUSED_MESSAGE = 'Not deleted — you can no longer delete this booking, so it is back on the schedule'
/** Deleting a booking on a day inside a signed timesheet warns but is allowed; the signed sheet never changes. */
export const BOOKING_DELETE_SIGNED_TIMESHEET_WARNING =
  'This day is on a signed timesheet. Deleting the booking does not change the signed timesheet.'

export const OFFLINE_DELETE_REPLAY_DECISIONS = ['apply', 'dropLocal', 'alreadyGone', 'refuseChanged', 'refusePermission'] as const
export type OfflineDeleteReplayDecision = (typeof OFFLINE_DELETE_REPLAY_DECISIONS)[number]

/** The booking fields `bookingDeleteFingerprint` reads (labour or manager schedule booking). */
export type BookingFingerprintInput = {
  collection?: string | null
  /** Labour: `operativeId`. */
  operativeId?: string | null
  /** Manager schedule: `userId`. */
  userId?: string | null
  /** Labour: the job id. */
  projectId?: string | null
  /** Manager schedule: `locationType`, `locationId`, `customLocationName`. */
  locationType?: string | null
  locationId?: string | null
  customLocationName?: string | null
  /** The organisation-zone day key; when missing it is read from `date` (Timestamp shape, Date, ms or ISO). */
  dayKey?: string | null
  date?: unknown
  timeSlot?: string | null
  workStartTime?: unknown
  workEndTime?: unknown
  isBreakRemoved?: boolean | null
  otMultiplierOverride?: number | string | null
  status?: string | null
  notes?: string | null
}

function fingerprintNumber(value: unknown): string {
  if (value == null || value === '') return ''
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? String(n) : ''
}

/**
 * Every field a booking edit can change, as one text both apps build the same way:
 * `collection|person|job|place|custom place|day|slot|start|finish|rate|break|status|notes` — ids without case, the
 * slot and status in their canonical spelling (status Confirmed when missing), clocks `HH:mm`, the day as an
 * organisation-zone key. An offline delete stores the fingerprint of the booking as last synced from the server (not
 * of a local edit still queued), and the replay compares it with the live booking.
 */
export function bookingDeleteFingerprint(booking: BookingFingerprintInput | null | undefined, timeZone?: string | null): string {
  if (!booking) return ''
  const collection = trimmed(booking.collection) === 'managerSiteBookings' ? 'managerSiteBookings' : trimmed(booking.collection) || 'bookings'
  const manager = collection === 'managerSiteBookings'
  const zone = zoneOrLondon(timeZone)
  let day = trimmed(booking.dayKey)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const ms = bookingDateMs(booking.date)
    day = ms == null ? '' : dayKeyInZone(new Date(ms), zone)
  }
  const slot = normalizeBookingTimeSlot(booking.timeSlot) ?? trimmed(booking.timeSlot).toUpperCase()
  const status = normalizeBookingStatus(booking.status) ?? (trimmed(booking.status) || 'Confirmed')
  return [
    collection,
    idKey(manager ? booking.userId : booking.operativeId),
    idKey(manager ? booking.locationId : booking.projectId),
    manager ? trimmed(booking.locationType).toLowerCase() : '',
    manager ? trimmed(booking.customLocationName) : '',
    day,
    slot,
    bookingClock(booking.workStartTime, zone) ?? '',
    bookingClock(booking.workEndTime, zone) ?? '',
    fingerprintNumber(booking.otMultiplierOverride),
    booking.isBreakRemoved === true ? 'nb' : '',
    status,
    trimmed(booking.notes),
  ].join('|')
}

/** A queued offline delete, as the device stored it. */
export type QueuedOfflineDelete = {
  bookingId: string
  collection: string
  /** `bookingDeleteFingerprint` of the booking as last synced when it was deleted offline. */
  fingerprint: string
  /** True when the booking's create is still in the device's outbox (it never reached the server). */
  createdOffline?: boolean | null
}

/**
 * 1.33.0: what replaying a queued offline delete does. The app reads the live booking and its tombstone in one
 * Firestore transaction and asks this before it writes:
 *   - `dropLocal` — the booking was created and deleted offline: the queued create and the delete are both removed and
 *     nothing is sent;
 *   - `alreadyGone` — the booking is missing or tombstoned on the server: the queued delete is removed, nothing is sent,
 *     the booking stays gone, no message;
 *   - `refusePermission` — `mayDelete` is false (the app's `canDeleteBooking` on the live booking and job): nothing is
 *     sent, the queued delete is removed, the booking reappears with `OFFLINE_DELETE_REFUSED_MESSAGE`;
 *   - `refuseChanged` — the live booking's `bookingDeleteFingerprint` differs from the queued one (changed on another
 *     device after the offline delete): nothing is sent, the booking reappears with `OFFLINE_DELETE_CHANGED_MESSAGE`;
 *   - `apply` — the delete and its tombstone (`bookingTombstoneWriteFields`) are written in that transaction.
 * A subcontractor booking is never queued (`bookingDeleteOfflineAction`); if one is, it reads `refusePermission`.
 */
export function offlineDeleteReplayDecision(input: {
  queued: QueuedOfflineDelete | null | undefined
  live: BookingFingerprintInput | null | undefined
  tombstoned?: boolean | null
  /** `canDeleteBooking` for the signed-in user on the live booking; missing is read as allowed (the rules still check). */
  mayDelete?: boolean | null
  timeZone?: string | null
}): OfflineDeleteReplayDecision {
  const queued = input?.queued
  if (!queued || !documentId(queued.bookingId)) return 'alreadyGone'
  if (queued.createdOffline === true) return 'dropLocal'
  const collection = trimmed(queued.collection)
  if (input.tombstoned === true || !input.live) return 'alreadyGone'
  if (collection !== 'bookings' && collection !== 'managerSiteBookings') return 'refusePermission'
  if (input.mayDelete === false) return 'refusePermission'
  const live = bookingDeleteFingerprint({ ...input.live, collection }, input.timeZone)
  if (trimmed(queued.fingerprint) !== live) return 'refuseChanged'
  return 'apply'
}

/**
 * 1.33.0: the server refused a queued delete that `offlineDeleteReplayDecision` let through (the transaction raced
 * another device). not-found → `alreadyGone`; permission-denied → `refusePermission` (the app re-reads the booking:
 * if it is now missing or tombstoned it is `alreadyGone` instead); anything else (offline, unavailable, aborted) →
 * `retry`, and the item stays queued.
 */
export function offlineDeleteRefusalDecision(code: unknown): 'alreadyGone' | 'refusePermission' | 'retry' {
  const text = errorCodeText(code)
  if (text === 'not-found' || text === '5') return 'alreadyGone'
  if (text === 'permission-denied' || text === '7') return 'refusePermission'
  return 'retry'
}

/** A timesheet of the booked person: its period and its stored status fields (the timesheet document). */
export type SignedTimesheetCandidate = {
  startDayKey: string
  endDayKey: string
} & Record<string, unknown>

/**
 * 1.33.0: `BOOKING_DELETE_SIGNED_TIMESHEET_WARNING` when `dayKey` falls inside one of the booked person's timesheets
 * that the person or their line manager has signed, or that was exported; null otherwise. The delete is still allowed
 * and the signed sheet is never changed. The caller passes that person's timesheets only.
 */
export function bookingDeleteSignedTimesheetWarning(
  dayKey: unknown,
  sheets: ReadonlyArray<SignedTimesheetCandidate> | null | undefined
): string | null {
  const day = trimmed(dayKey)
  for (const sheet of sheets || []) {
    if (!sheet || !timesheetPeriodContainsDay({ startDayKey: trimmed(sheet.startDayKey), endDayKey: trimmed(sheet.endDayKey) }, day)) continue
    const fields = parseTimesheetStatusFields(sheet)
    if (isTimesheetOperativeSigned(fields) || isTimesheetManagerSigned(fields) || isTimesheetExported(fields)) {
      return BOOKING_DELETE_SIGNED_TIMESHEET_WARNING
    }
  }
  return null
}
