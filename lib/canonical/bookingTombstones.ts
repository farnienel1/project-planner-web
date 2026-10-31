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
 */

import { WRITE_PLATFORMS, type WritePlatform } from './writeMetadata'

export const BOOKING_TOMBSTONE_COLLECTION = 'deletedBookings'
export const TOMBSTONED_BOOKING_COLLECTIONS = ['bookings', 'managerSiteBookings'] as const
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

/**
 * A queued offline save that the server refused because the booking has a tombstone (or was
 * cancelled elsewhere) is dropped, not retried. Pass the Firestore error code (web string, or the
 * iOS `FirestoreErrorCode` number 7).
 */
export function bookingReplayRefusedIsFinal(errorCode: unknown): boolean {
  const code = (typeof errorCode === 'number' ? String(errorCode) : trimmed(errorCode)).toLowerCase()
  return code === 'permission-denied' || code === 'firestore/permission-denied' || code === '7'
}

export const BOOKING_REPLAY_REFUSED_MESSAGE = 'This booking was cancelled or deleted on another device.'
