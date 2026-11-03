/**
 * Web side of the deleted-booking tombstone (lib/canonical/bookingTombstones.ts).
 * A booking delete and its `deletedBookings/{bookingId}` tombstone go in one batch, so an
 * offline device cannot bring the booking back by replaying a queued save.
 */

import { deleteDoc, doc, getDoc, serverTimestamp, writeBatch, type Firestore, type WriteBatch } from 'firebase/firestore'
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

/**
 * Commit a booking delete, treating "already deleted elsewhere" as done. A tombstone is never updated (rules
 * `allow update: if false`), so deleting a booking another device already deleted — a row still on screen — fails
 * the batch. Only when the tombstone already exists: a booking document that is gone is a no-op success, and one
 * still there is deleted alone (it is already tombstoned). Without a tombstone the original error stands, so a
 * booking is never deleted without one.
 */
export async function commitBookingDeleteTolerantly(steps: {
  commit: () => Promise<void>
  tombstoneExists: () => Promise<boolean>
  bookingExists: () => Promise<boolean>
  deleteAlone: () => Promise<void>
}): Promise<'deleted' | 'alreadyDeleted'> {
  try {
    await steps.commit()
    return 'deleted'
  } catch (error) {
    try {
      if (!(await steps.tombstoneExists())) throw error
      if (await steps.bookingExists()) await steps.deleteAlone()
      return 'alreadyDeleted'
    } catch {
      throw error
    }
  }
}

export async function deleteBookingWithTombstone(
  db: Firestore,
  input: { organizationId: string; collection: TombstonedBookingCollection; bookingId: string }
): Promise<void> {
  const batch = writeBatch(db)
  addBookingDeleteWithTombstone(db, batch, { ...input, deletedBy: signedInUserId() })
  const bookingRef = doc(db, 'organizations', input.organizationId, input.collection, input.bookingId)
  const tombstoneRef = doc(db, 'organizations', input.organizationId, BOOKING_TOMBSTONE_COLLECTION, input.bookingId)
  await commitBookingDeleteTolerantly({
    commit: () => batch.commit(),
    tombstoneExists: async () => (await getDoc(tombstoneRef)).exists(),
    bookingExists: async () => (await getDoc(bookingRef)).exists(),
    deleteAlone: () => deleteDoc(bookingRef),
  })
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
    try {
      await batch.commit()
    } catch {
      // One booking in the chunk was already deleted elsewhere (its tombstone cannot be rewritten): delete the
      // chunk one by one, each tolerating "already deleted".
      for (const bookingId of input.bookingIds.slice(i, i + BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT)) {
        await deleteBookingWithTombstone(db, { organizationId: input.organizationId, collection: input.collection, bookingId })
      }
    }
  }
}
