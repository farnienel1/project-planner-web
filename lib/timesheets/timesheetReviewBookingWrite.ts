/**
 * Web side of rulebook 1.72.0 §8 (owner decisions 23 Nov, A and B): the line manager's ⚙ and ✕ on a timesheet line
 * under review write the BOOKING, never a `payrollLineReviews` entry.
 *
 * - ⚙: `timesheetReviewBookingEditWrites` on the stored booking (read fresh, never a stale copy), written as a partial
 *   update with write metadata. An edit of a booking deleted elsewhere is refused (`MissingDocumentError`).
 * - ✕: `timesheetReviewBookingDelete` — the delete and its tombstone in one batch; a booking already deleted elsewhere
 *   (its tombstone exists) is treated as done (`commitBookingDeleteTolerantly`).
 *
 * The 1.47.0 rule (`signedTimesheetBookingChanges`) then reads the signed sheet as changed and the live listener sends it
 * back to the person; the 1.54.0 Cloud Functions send them "Your signed timesheet has changed".
 */
import { deleteDoc, doc, getDoc, serverTimestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import {
  BOOKING_TOMBSTONE_COLLECTION,
  timesheetReviewBookingDelete,
  timesheetReviewBookingEditWrites,
  timesheetReviewOvertimeStrike,
  type TimesheetReviewBookingCollection,
  type TimesheetReviewOvertimeStrike,
} from '@/lib/canonical'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import { firestoreUpdateFields, MissingDocumentError } from '@/lib/firebase/partialWrite'
import { commitBookingDeleteTolerantly } from '@/lib/bookings/bookingTombstoneWrite'
import { bookingIdFromLineId } from '@/lib/timesheets/payrollLineBookingLookup'

/** The booking a timesheet line comes from: its collection and id (`op-{id}-normal|ot` / `mgr-{id}-normal|ot`). */
export function timesheetLineBooking(line: { id: string; bookingId?: string; bookingCollection?: string }): {
  bookingId: string
  collection: TimesheetReviewBookingCollection
} | null {
  const bookingId = line.bookingId || bookingIdFromLineId(line.id) || ''
  if (!bookingId) return null
  const stated = line.bookingCollection
  const collection: TimesheetReviewBookingCollection =
    stated === 'managerSiteBookings' || (!stated && line.id.startsWith('mgr-')) ? 'managerSiteBookings' : 'bookings'
  return { bookingId, collection }
}

/** ⚙: change the booking itself. Returns false when nothing changed. */
export async function saveTimesheetReviewBookingEdit(
  db: Firestore,
  input: {
    organizationId: string
    userId: string
    booking: { bookingId: string; collection: TimesheetReviewBookingCollection }
    startTime: string
    endTime: string
    isBreakRemoved: boolean
    /** The rate box: typed on save, shown when opened, the organisation's that day (`timesheetReviewOvertimeRate`). */
    overtimeRate?: { typed: unknown; opened: unknown; organizationMultiplier: unknown } | null
    slotWindow?: { start: string; end: string } | null
    timeZone?: string | null
  }
): Promise<boolean> {
  const ref = doc(db, 'organizations', input.organizationId, input.booking.collection, input.booking.bookingId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new MissingDocumentError(ref.path)
  const edit = timesheetReviewBookingEditWrites({
    booking: { ...(snap.data() as Record<string, unknown>), id: snap.id, collection: input.booking.collection },
    startTime: input.startTime,
    endTime: input.endTime,
    isBreakRemoved: input.isBreakRemoved,
    overtimeRate: input.overtimeRate ?? null,
    slotWindow: input.slotWindow,
    timeZone: input.timeZone ?? null,
  })
  if (!edit.ok) throw new Error(edit.error)
  if (!edit.changed) return false
  await updateDoc(ref, {
    ...firestoreUpdateFields({ set: edit.set, remove: edit.remove }),
    updatedAt: serverTimestamp(),
    ...(writeMetadataFields(input.userId, 'web') ?? {}),
  })
  return true
}

/** ✕: delete the booking with its tombstone in one batch. */
export async function deleteTimesheetReviewBooking(
  db: Firestore,
  input: { organizationId: string; userId: string; booking: { bookingId: string; collection: TimesheetReviewBookingCollection } }
): Promise<'deleted' | 'alreadyDeleted'> {
  const plan = timesheetReviewBookingDelete({
    booking: { id: input.booking.bookingId, collection: input.booking.collection },
    deletedBy: input.userId,
    platform: 'web',
  })
  if (!plan) throw new Error('This booking cannot be removed.')
  const bookingRef = doc(db, 'organizations', input.organizationId, plan.collection, plan.bookingId)
  const tombstoneRef = doc(db, 'organizations', input.organizationId, BOOKING_TOMBSTONE_COLLECTION, plan.bookingId)
  const batch = writeBatch(db)
  batch.delete(bookingRef)
  batch.set(tombstoneRef, { ...plan.tombstone, deletedAt: serverTimestamp() })
  return commitBookingDeleteTolerantly({
    commit: () => batch.commit(),
    tombstoneExists: async () => (await getDoc(tombstoneRef)).exists(),
    bookingExists: async () => (await getDoc(bookingRef)).exists(),
    deleteAlone: () => deleteDoc(bookingRef),
  })
}

/**
 * ✕ on an overtime line (owner answer 23 Nov, #416 Q3): what removing the overtime does to the stored booking (read
 * fresh). `trim` → confirm, then `applyTimesheetReviewOvertimeTrim`; `delete` → the ordinary delete warning and delete.
 */
export async function planTimesheetReviewOvertimeStrike(
  db: Firestore,
  input: {
    organizationId: string
    booking: { bookingId: string; collection: TimesheetReviewBookingCollection }
    dayKey: string
    organization: unknown
    timeZone: string | null
    summary: string
  }
): Promise<TimesheetReviewOvertimeStrike> {
  const ref = doc(db, 'organizations', input.organizationId, input.booking.collection, input.booking.bookingId)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new MissingDocumentError(ref.path)
  return timesheetReviewOvertimeStrike({
    booking: { ...(snap.data() as Record<string, unknown>), id: snap.id, collection: input.booking.collection, dayKey: input.dayKey },
    organization: input.organization,
    timeZone: input.timeZone,
    summary: input.summary,
  })
}

/** Writes a confirmed overtime trim: times and slot only, as a partial update with write metadata. */
export async function applyTimesheetReviewOvertimeTrim(
  db: Firestore,
  input: { organizationId: string; userId: string; strike: Extract<TimesheetReviewOvertimeStrike, { kind: 'trim' }> }
): Promise<void> {
  const ref = doc(db, 'organizations', input.organizationId, input.strike.collection, input.strike.bookingId)
  if (Object.keys(input.strike.set).length === 0 && input.strike.remove.length === 0) return
  await updateDoc(ref, {
    ...firestoreUpdateFields({ set: input.strike.set, remove: input.strike.remove }),
    updatedAt: serverTimestamp(),
    ...(writeMetadataFields(input.userId, 'web') ?? {}),
  })
}
