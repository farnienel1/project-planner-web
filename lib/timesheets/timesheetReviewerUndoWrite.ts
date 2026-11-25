/**
 * Web side of rulebook 1.90.0 §8 (owner request 24 Nov): "Cancel changes" undoes what the line manager (or an admin)
 * changed while making changes to a timesheet. The plan is the rulebook's (`timesheetReviewerUndoPlan`, read from the
 * sheet and the bookings fresh); this file only writes it:
 * - a booking put back: one batch — the booking's edit fields and the removal of its record on the sheet;
 * - a removed booking: re-created under a NEW id (its old id stays tombstoned, §2) in one batch with the two records
 *   that stop the sheet reading as changed (`timesheetReviewerRestoredRecords`); refused by the security rules for a
 *   line manager who does not manage the job — reported, never retried another way;
 * - price work / expense decisions: put back (or removed) in one update with their records removed.
 * Every booking that cannot be undone safely is left as it is and named in the result.
 */
import { collection, deleteField, doc, FieldPath, getDoc, serverTimestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import {
  BOOKING_TOMBSTONE_COLLECTION,
  TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD,
  TIMESHEET_REVIEWER_UNDO_NOT_ALLOWED_MESSAGE,
  timesheetReviewerRestoredRecords,
  timesheetReviewerSessionRecords,
  timesheetReviewerUndoPlan,
} from '@/lib/canonical'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import { firestoreUpdateFields } from '@/lib/firebase/partialWrite'

export type TimesheetReviewerUndoResult = {
  /** Changes undone. */
  undone: number
  /** Bookings left as they are, with the reason to show. */
  refused: Array<{ bookingId: string; message: string }>
}

function isPermissionDenied(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code
  return code === 'permission-denied' || (typeof code === 'string' && code.endsWith('permission-denied'))
}

export async function cancelTimesheetReviewerChanges(
  db: Firestore,
  input: { organizationId: string; userId: string; documentId: string; timeZone?: string | null }
): Promise<TimesheetReviewerUndoResult> {
  const orgRef = (...parts: string[]) => doc(db, 'organizations', input.organizationId, ...parts)
  const sheetRef = orgRef('settings', input.documentId)
  const sheetSnap = await getDoc(sheetRef)
  if (!sheetSnap.exists()) return { undone: 0, refused: [] }
  const sheet = sheetSnap.data() as Record<string, unknown>
  const records = timesheetReviewerSessionRecords(sheet)
  const bookings = await Promise.all(
    records
      .filter((r) => r.kind === 'booking')
      .map(async (r) => {
        const collectionName = String(r.value.collection || 'bookings')
        const bookingId = String(r.value.bookingId || '')
        if (!bookingId) return null
        const [booking, tombstone] = await Promise.all([
          getDoc(orgRef(collectionName, bookingId)).catch(() => null),
          getDoc(orgRef(BOOKING_TOMBSTONE_COLLECTION, bookingId)).catch(() => null),
        ])
        return {
          collection: collectionName,
          bookingId,
          data: booking?.exists() ? (booking.data() as Record<string, unknown>) : null,
          tombstoned: tombstone?.exists() === true,
        }
      })
  )
  const plan = timesheetReviewerUndoPlan({
    sheet,
    bookings: bookings.filter((b): b is NonNullable<typeof b> => b != null),
    timeZone: input.timeZone ?? null,
  })
  const metadata = writeMetadataFields(input.userId, 'web') ?? {}
  const metaPairs = ['updatedAt', serverTimestamp(), ...Object.entries(metadata).flat()]
  const refused: TimesheetReviewerUndoResult['refused'] = []
  let undone = 0
  for (const action of plan.actions) {
    if (action.kind === 'refuse') {
      refused.push({ bookingId: action.bookingId, message: action.message })
      continue
    }
    const batch = writeBatch(db)
    if (action.kind === 'restore') {
      batch.update(orgRef(action.collection, action.bookingId), {
        ...firestoreUpdateFields({ set: action.set, remove: action.remove }),
        updatedAt: serverTimestamp(),
        ...metadata,
      })
      batch.update(sheetRef, new FieldPath(TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD, action.key), deleteField(), ...metaPairs)
    } else {
      const newRef = doc(collection(db, 'organizations', input.organizationId, action.collection))
      const created = { ...action.data, id: newRef.id }
      const oldRecord = (sheet[TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD] as Record<string, Record<string, unknown>>)[action.key] ?? {}
      const restored = timesheetReviewerRestoredRecords({
        sheet,
        oldKey: action.key,
        oldRecord,
        collection: action.collection,
        newBookingId: newRef.id,
        createdDoc: created,
        editedBy: input.userId,
        timeZone: input.timeZone ?? null,
      })
      if (!restored) {
        refused.push({ bookingId: action.oldBookingId, message: TIMESHEET_REVIEWER_UNDO_NOT_ALLOWED_MESSAGE })
        continue
      }
      batch.set(newRef, { ...created, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...metadata })
      batch.update(
        sheetRef,
        new FieldPath(TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD, restored.old.key),
        restored.old.value,
        new FieldPath(TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD, restored.created.key),
        { ...restored.created.value, editedAt: serverTimestamp() },
        ...metaPairs
      )
    }
    try {
      await batch.commit()
      undone += 1
    } catch (error) {
      if (!isPermissionDenied(error)) throw error
      refused.push({
        bookingId: action.kind === 'restore' ? action.bookingId : action.oldBookingId,
        message: action.kind === 'restore' ? 'You are not allowed to change this booking — not undone.' : TIMESHEET_REVIEWER_UNDO_NOT_ALLOWED_MESSAGE,
      })
    }
  }
  // Price work / expense decisions and their records: one update.
  const reviewKeys = plan.removeRecordKeys.filter((key) => !plan.actions.some((a) => a.key === key))
  const reviewPairs: unknown[] = []
  for (const [path, value] of Object.entries(plan.reviews.set)) reviewPairs.push(new FieldPath(...path.split(/\.(.+)/).filter(Boolean)), value)
  for (const path of plan.reviews.remove) reviewPairs.push(new FieldPath(...path.split(/\.(.+)/).filter(Boolean)), deleteField())
  for (const key of reviewKeys) reviewPairs.push(new FieldPath(TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD, key), deleteField())
  if (reviewPairs.length > 0) {
    const [first, firstValue, ...rest] = reviewPairs
    await updateDoc(sheetRef, first as FieldPath, firstValue, ...rest, ...metaPairs)
    undone += plan.reviews.remove.length + Object.keys(plan.reviews.set).length
  }
  return { undone, refused }
}
