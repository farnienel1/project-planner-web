/**
 * Web side of Replace (rulebook 1.41.0 §5, `bookingReplaceWrites`): a booking create or edit and, in the SAME batch,
 * the delete of every booking it replaces with its tombstone. The rulebook gives the paths and tombstones; this file
 * only adds them to a Firestore batch.
 */

import { doc, serverTimestamp, writeBatch, type DocumentReference, type Firestore, type WriteBatch } from 'firebase/firestore'
import { auth } from '@/lib/firebase/config'
import { bookingReplaceWrites, type BookingReplaceRef } from '@/lib/canonical'

export const BOOKING_REPLACE_REFUSED_MESSAGE = 'This booking could not replace the existing one. Nothing was saved.'

function signedInUserId(): string {
  const uid = auth?.currentUser?.uid
  if (!uid) throw new Error('Sign in again to replace this booking.')
  return uid
}

/** Adds each replaced booking's delete and tombstone to `batch`. Throws (nothing written) when the plan is refused. */
export function addBookingReplaceToBatch(
  db: Firestore,
  batch: WriteBatch,
  input: {
    organizationId: string
    booking: { collection: 'bookings' | 'managerSiteBookings'; bookingId: string }
    replaced: ReadonlyArray<BookingReplaceRef>
  }
): BookingReplaceRef[] {
  const plan = bookingReplaceWrites({
    organizationId: input.organizationId,
    booking: input.booking,
    replaced: input.replaced,
    deletedBy: signedInUserId(),
    deletedFrom: 'web',
  })
  if (!plan) throw new Error(BOOKING_REPLACE_REFUSED_MESSAGE)
  for (const row of plan.deletes) {
    batch.delete(doc(db, row.path))
    batch.set(doc(db, row.tombstonePath), { ...row.tombstone, deletedAt: serverTimestamp() })
  }
  return plan.deletes.map((row) => ({ collection: row.collection, bookingId: row.bookingId }))
}

/** A fresh batch with the booking write (`write`) and the replaced deletes; committed as one. */
export async function commitBookingReplace(
  db: Firestore,
  input: {
    organizationId: string
    booking: { collection: 'bookings' | 'managerSiteBookings'; bookingId: string }
    replaced: ReadonlyArray<BookingReplaceRef>
    write: (batch: WriteBatch, ref: DocumentReference) => void
  }
): Promise<BookingReplaceRef[]> {
  const batch = writeBatch(db)
  const ref = doc(db, 'organizations', input.organizationId, input.booking.collection, input.booking.bookingId)
  input.write(batch, ref)
  const removed = addBookingReplaceToBatch(db, batch, input)
  await batch.commit()
  return removed
}

/** Drops replaced bookings from both booking stores at once (the live listeners confirm it). */
export async function forgetReplacedBookings(organizationId: string, removed: ReadonlyArray<BookingReplaceRef>): Promise<void> {
  if (removed.length === 0) return
  const [{ useBookingStore }, { useManagerScheduleStore }, { forgetOrgPlanDoc }, { forgetOrgCollectionDoc }] = await Promise.all([
    import('@/lib/stores/bookingStore'),
    import('@/lib/stores/managerScheduleStore'),
    import('@/lib/firebase/subscribeOrgPlan'),
    import('@/lib/firebase/subscribeOrgCollection'),
  ])
  const gone = (collection: string) => new Set(removed.filter((r) => r.collection === collection).map((r) => r.bookingId.toLowerCase()))
  const labour = gone('bookings')
  const manager = gone('managerSiteBookings')
  for (const row of removed) {
    forgetOrgPlanDoc(row.collection, organizationId, row.bookingId)
    forgetOrgCollectionDoc(row.collection, organizationId, row.bookingId)
  }
  if (labour.size > 0) {
    useBookingStore.setState({ bookings: useBookingStore.getState().bookings.filter((b) => !labour.has(String(b.id).toLowerCase())) })
  }
  if (manager.size > 0) {
    useManagerScheduleStore.setState({
      managerSiteBookings: useManagerScheduleStore.getState().managerSiteBookings.filter((b) => !manager.has(String(b.id).toLowerCase())),
    })
  }
}
