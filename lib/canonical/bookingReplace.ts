/**
 * Rulebook 1.41.0 §5 (owner decision 11 Nov, "Replace existing booking", build before launch).
 *
 * Every booking flow that lists an orange double-booking row (`bookingRequestClashIds`) offers three choices on it:
 *   - ✓ (`confirm`) book both — the overlap is then a clash warning, as before;
 *   - ✕ (`drop`) drop that day for that person;
 *   - Replace (`replace`) — the existing overlapping booking(s) are deleted and this booking is saved in their place.
 * Replace is offered only when the viewer may delete EVERY overlapping booking on that row (`canDeleteBooking`, passed
 * in as `mayDelete`) and each is a labour (`bookings`) or manager schedule (`managerSiteBookings`) booking
 * (`bookingReplaceOffer`). The save is ONE batch: the new booking (a create, or the edit being saved) and, for each
 * replaced booking, its delete and its tombstone (`bookingTombstoneWriteFields`) — `bookingReplaceWrites` gives the
 * document paths and tombstones; the booking's own fields are the app's usual create / edit write. Nothing is half
 * applied: the batch either saves the new booking and removes the old ones, or changes nothing.
 *
 * Offline (iOS, Android): Replace is online only (`offlineAvailability('booking.replace')`), disabled with
 * `OFFLINE_ONLINE_ONLY_MESSAGE`; ✓ and ✕ work offline as before. Web is online only anyway.
 */

import {
  BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT,
  bookingTombstonePath,
  bookingTombstoneWriteFields,
  type BookingTombstoneWriteFields,
} from './bookingTombstones'

export const BOOKING_CONFLICT_DECISIONS = ['confirm', 'drop', 'replace'] as const
export type BookingConflictDecisionValue = (typeof BOOKING_CONFLICT_DECISIONS)[number]

/** The third button on an orange double-booking row. */
export const BOOKING_REPLACE_LABEL = 'Replace'
/** Its accessible description and the row's text once chosen. */
export const BOOKING_REPLACE_HELP = 'Replace the existing booking with this one'
export const BOOKING_REPLACE_CHOSEN_TEXT = 'replaces the existing booking'
/** The collections a Replace may delete (the orange rows list labour and manager schedule bookings only). */
export const BOOKING_REPLACE_COLLECTIONS = ['bookings', 'managerSiteBookings'] as const
export type BookingReplaceCollection = (typeof BOOKING_REPLACE_COLLECTIONS)[number]

export type BookingReplaceRef = { collection: BookingReplaceCollection; bookingId: string }

export type BookingReplaceCandidate = {
  /** The existing booking's document id, exactly as stored. */
  bookingId?: string | null
  collection?: string | null
  /** `canDeleteBooking` for the viewer on this booking and its job. Anything but `true` withholds Replace. */
  mayDelete?: boolean | null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isReplaceCollection(value: unknown): value is BookingReplaceCollection {
  return (BOOKING_REPLACE_COLLECTIONS as readonly string[]).includes(text(value))
}

function refKey(collection: string, bookingId: string): string {
  return `${collection}/${bookingId.toLowerCase()}`
}

/**
 * Whether the row offers Replace, and which bookings it would remove (de-duplicated by collection and id without
 * case, stored spelling and input order kept). Offered only with at least one overlapping booking, every one of them
 * deletable by the viewer (`mayDelete === true`) and in `BOOKING_REPLACE_COLLECTIONS`. An unusable id withholds it.
 */
export function bookingReplaceOffer(input: { clashing: ReadonlyArray<BookingReplaceCandidate | null | undefined> | null | undefined } | null | undefined): {
  offered: boolean
  bookings: BookingReplaceRef[]
} {
  const out: BookingReplaceRef[] = []
  const seen = new Set<string>()
  const rows = input?.clashing || []
  if (rows.length === 0) return { offered: false, bookings: [] }
  for (const row of rows) {
    const bookingId = text(row?.bookingId)
    const collection = text(row?.collection)
    if (!row || !bookingId || bookingId.includes('/') || !isReplaceCollection(collection) || row.mayDelete !== true) {
      return { offered: false, bookings: [] }
    }
    const key = refKey(collection, bookingId)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ collection, bookingId })
  }
  return { offered: out.length > 0, bookings: out }
}

export type BookingReplaceDelete = {
  collection: BookingReplaceCollection
  bookingId: string
  /** `organizations/{orgId}/{collection}/{bookingId}`. */
  path: string
  /** `organizations/{orgId}/deletedBookings/{bookingId}` (`bookingTombstonePath`). */
  tombstonePath: string
  /** The tombstone's fields; the app adds its SDK server timestamp as `deletedAt`. */
  tombstone: BookingTombstoneWriteFields
}

export type BookingReplaceWritePlan = {
  /** The booking being saved: `organizations/{orgId}/{collection}/{bookingId}` (the app's create or edit fields). */
  bookingPath: string
  deletes: BookingReplaceDelete[]
}

/**
 * The one batch of a Replace. Null — nothing is written — when the organisation or the new booking's id is unusable,
 * nothing is replaced, a replaced booking is the booking being saved (same id without case), a collection is not one
 * Replace may delete, a tombstone cannot be built, or the batch would exceed the tombstone batch limit. Replaced
 * bookings are de-duplicated by collection and id without case.
 */
export function bookingReplaceWrites(input: {
  organizationId: unknown
  booking: { collection: unknown; bookingId: unknown } | null | undefined
  replaced: ReadonlyArray<{ collection?: unknown; bookingId?: unknown } | null | undefined> | null | undefined
  deletedBy: unknown
  deletedFrom: unknown
}): BookingReplaceWritePlan | null {
  const organizationId = text(input?.organizationId)
  const bookingCollection = text(input?.booking?.collection)
  const bookingId = text(input?.booking?.bookingId)
  if (!organizationId || organizationId.includes('/') || !bookingId || bookingId.includes('/')) return null
  if (!isReplaceCollection(bookingCollection)) return null
  const rows = input?.replaced || []
  if (rows.length === 0) return null
  const deletes: BookingReplaceDelete[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const collection = text(row?.collection)
    const id = text(row?.bookingId)
    if (!isReplaceCollection(collection) || !id) return null
    if (id.toLowerCase() === bookingId.toLowerCase()) return null
    const key = refKey(collection, id)
    if (seen.has(key)) continue
    seen.add(key)
    const tombstone = bookingTombstoneWriteFields({ bookingId: id, collection, deletedBy: input.deletedBy, deletedFrom: input.deletedFrom })
    const tombstonePath = bookingTombstonePath(organizationId, id)
    if (!tombstone || !tombstonePath) return null
    deletes.push({ collection, bookingId: id, path: `organizations/${organizationId}/${collection}/${id}`, tombstonePath, tombstone })
  }
  if (deletes.length > BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT) return null
  return { bookingPath: `organizations/${organizationId}/${bookingCollection}/${bookingId}`, deletes }
}
