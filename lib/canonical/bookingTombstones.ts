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
 * bookings on the jobs they manage, operatives never. Deleting is online-only (`offlineAvailability('booking.delete')`).
 * Subcontractor bookings (`subcontractorBookings`) are tombstoned too from 1.10.0.
 */

import { WRITE_PLATFORMS, type WritePlatform } from './writeMetadata'

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

/** The tombstone written beside a booking delete. Null when any input is unusable. */
export function bookingTombstoneWriteFields(input: {
  bookingId: unknown
  collection: unknown
  deletedBy: unknown
  deletedFrom: unknown
}): BookingTombstoneWriteFields | null {
  const bookingId = documentId(input.bookingId)
  const collection = trimmed(input.collection)
  const deletedBy = trimmed(input.deletedBy)
  const deletedFrom = trimmed(input.deletedFrom).toLowerCase()
  if (!bookingId || !deletedBy) return null
  if (!isTombstonedBookingCollection(collection)) return null
  if (!(WRITE_PLATFORMS as readonly string[]).includes(deletedFrom)) return null
  return {
    bookingId,
    collection,
    deletedBy,
    deletedFrom: deletedFrom as WritePlatform,
  }
}

function errorCodeText(errorCode: unknown): string {
  return (typeof errorCode === 'number' ? String(errorCode) : trimmed(errorCode)).toLowerCase().replace(/^firestore\//, '')
}

/** What `bookingReplayRefusedIsFinal` reads when it is given more than the error code. */
export type BookingReplayRefusal = {
  /** The Firestore error code: web string (`permission-denied`, `not-found`) or the iOS `FirestoreErrorCode` number. */
  code: unknown
  /** True when the queued item creates the booking; false for an edit or cancel of an existing booking. */
  isCreate?: boolean | null
}

/**
 * A queued offline booking save that the server refused is dropped, not retried, when the refusal is final:
 *   - permission-denied (`7` on iOS): the booking has a tombstone, was cancelled elsewhere, or the person may not
 *     write it;
 *   - not-found (`5` on iOS) on an edit or cancel replay (`isCreate` false): the booking was deleted on another
 *     device, so the edit is never turned into a create.
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
