/**
 * Web side of the deleted-booking tombstone (lib/canonical/bookingTombstones.ts).
 * A booking delete and its `deletedBookings/{bookingId}` tombstone go in one batch, so an
 * offline device cannot bring the booking back by replaying a queued save.
 */

import { doc, serverTimestamp, writeBatch, type Firestore, type WriteBatch } from 'firebase/firestore'
import { auth } from '@/lib/firebase/config'
import {
  BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT,
  BOOKING_TOMBSTONE_COLLECTION,
  bookingTombstoneWriteFields,
  type TombstonedBookingCollection,
} from '@/lib/canonical'

function signedInUserId(): string {
  const uid = auth?.currentUser?.uid
  if (!uid) throw new Error('Sign in again to remove this booking.')
  return uid
}

/** Adds the delete and its tombstone to `batch`. */
export function addBookingDeleteWithTombstone(
  db: Firestore,
  batch: WriteBatch,
  input: { organizationId: string; collection: TombstonedBookingCollection; bookingId: string; deletedBy: string }
): void {
  const fields = bookingTombstoneWriteFields({
    bookingId: input.bookingId,
    collection: input.collection,
    deletedBy: input.deletedBy,
    deletedFrom: 'web',
  })
  if (!fields) throw new Error('This booking cannot be removed.')
  batch.delete(doc(db, 'organizations', input.organizationId, input.collection, fields.bookingId))
  batch.set(doc(db, 'organizations', input.organizationId, BOOKING_TOMBSTONE_COLLECTION, fields.bookingId), {
    ...fields,
    deletedAt: serverTimestamp(),
  })
}

export async function deleteBookingWithTombstone(
  db: Firestore,
  input: { organizationId: string; collection: TombstonedBookingCollection; bookingId: string }
): Promise<void> {
  const batch = writeBatch(db)
  addBookingDeleteWithTombstone(db, batch, { ...input, deletedBy: signedInUserId() })
  await batch.commit()
}

/** Many deletes in one collection, chunked so each batch stays under 500 writes. */
export async function deleteBookingsWithTombstones(
  db: Firestore,
  input: { organizationId: string; collection: TombstonedBookingCollection; bookingIds: string[] }
): Promise<void> {
  if (input.bookingIds.length === 0) return
  const deletedBy = signedInUserId()
  for (let i = 0; i < input.bookingIds.length; i += BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT) {
    const batch = writeBatch(db)
    for (const bookingId of input.bookingIds.slice(i, i + BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT)) {
      addBookingDeleteWithTombstone(db, batch, {
        organizationId: input.organizationId,
        collection: input.collection,
        bookingId,
        deletedBy,
      })
    }
    await batch.commit()
  }
}
