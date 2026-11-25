/**
 * Web side of rulebook 1.90.0 §8 (owner request 24 Nov): "Cancel changes" undoes what the line manager (or an admin)
 * changed while making changes to a timesheet. The plan is the rulebook's (`timesheetReviewerUndoPlan`, read from the
 * sheet and the bookings fresh); this file only writes it:
 * - a booking put back: one batch — the booking's edit fields and the removal of its record on the sheet;
 * - a removed booking: re-created under a NEW id (its old id stays tombstoned, §2) in one batch with the two records
 *   that stop the sheet reading as changed (`timesheetReviewerRestoredRecords`); refused by the security rules for a
 *   line manager who does not manage the job — reported, never retried another way;
 * - price work / expense decisions: put back (or removed) in one update with their records removed.
 * Every booking that cannot be undone safely is left as it is and named in the result. Each write runs in a transaction
 * that re-reads the sheet record, the booking and its tombstone (review of #457, finding 4).
 */
import { collection, deleteField, doc, FieldPath, getDoc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore'
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
  const records = timesheetReviewerSessionRecords(sheetSnap.data() as Record<string, unknown>)
  const metadata = writeMetadataFields(input.userId, 'web') ?? {}
  const metaPairs = ['updatedAt', serverTimestamp(), ...Object.entries(metadata).flat()]
  const refused: TimesheetReviewerUndoResult['refused'] = []
  let undone = 0
  // Review of #457 (finding 4): each booking is undone in its own transaction that re-reads the sheet, the booking and
  // its tombstone and plans again from them (`timesheetReviewerUndoPlan`), so a change made meanwhile is never
  // overwritten and two Cancel runs at once never re-create a booking twice (the second sees `restoredAs` and skips).
  for (const entry of records) {
    if (entry.kind !== 'booking') continue
    const collectionName = String(entry.value.collection || 'bookings')
    const bookingId = String(entry.value.bookingId || '')
    if (!bookingId) continue
    const bookingRef = orgRef(collectionName, bookingId)
    const tombstoneRef = orgRef(BOOKING_TOMBSTONE_COLLECTION, bookingId)
    let outcome: { kind: 'done' } | { kind: 'skip' } | { kind: 'refused'; message: string }
    try {
      outcome = await runTransaction(db, async (transaction) => {
        const [sheetNow, booking, tombstone] = await Promise.all([
          transaction.get(sheetRef),
          transaction.get(bookingRef),
          transaction.get(tombstoneRef),
        ])
        if (!sheetNow.exists()) return { kind: 'skip' as const }
        const sheet = sheetNow.data() as Record<string, unknown>
        const plan = timesheetReviewerUndoPlan({
          sheet,
          bookings: [
            {
              collection: collectionName,
              bookingId,
              data: booking.exists() ? (booking.data() as Record<string, unknown>) : null,
              tombstoned: tombstone.exists(),
            },
          ],
          timeZone: input.timeZone ?? null,
        })
        // Gone from the session (undone elsewhere, `restoredAs`, or the sheet was signed again): nothing to do.
        const action = plan.actions.find((a) => a.key === entry.key)
        if (!action) return { kind: 'skip' as const }
        if (action.kind === 'refuse') return { kind: 'refused' as const, message: action.message }
        if (action.kind === 'restore') {
          transaction.update(bookingRef, {
            ...firestoreUpdateFields({ set: action.set, remove: action.remove }),
            updatedAt: serverTimestamp(),
            ...metadata,
          })
          transaction.update(sheetRef, new FieldPath(TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD, action.key), deleteField(), ...metaPairs)
          return { kind: 'done' as const }
        }
        const newRef = doc(collection(db, 'organizations', input.organizationId, action.collection))
        const created = { ...action.data, id: newRef.id }
        const oldRecord = ((sheet[TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD] ?? {}) as Record<string, Record<string, unknown>>)[action.key] ?? {}
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
        if (!restored) return { kind: 'refused' as const, message: TIMESHEET_REVIEWER_UNDO_NOT_ALLOWED_MESSAGE }
        transaction.set(newRef, { ...created, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...metadata })
        transaction.update(
          sheetRef,
          new FieldPath(TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD, restored.old.key),
          restored.old.value,
          new FieldPath(TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD, restored.created.key),
          { ...restored.created.value, editedAt: serverTimestamp() },
          ...metaPairs
        )
        return { kind: 'done' as const }
      })
    } catch (error) {
      if (!isPermissionDenied(error)) throw error
      outcome = {
        kind: 'refused',
        message: entry.value.deleted === true ? TIMESHEET_REVIEWER_UNDO_NOT_ALLOWED_MESSAGE : 'You are not allowed to change this booking — not undone.',
      }
    }
    if (outcome.kind === 'done') undone += 1
    else if (outcome.kind === 'refused') refused.push({ bookingId, message: outcome.message })
  }
  // Price work / expense decisions and their records: one transaction, planned from the sheet read again.
  const reviewsUndone = await runTransaction(db, async (transaction) => {
    const sheetNow = await transaction.get(sheetRef)
    if (!sheetNow.exists()) return 0
    const plan = timesheetReviewerUndoPlan({ sheet: sheetNow.data() as Record<string, unknown>, bookings: [], timeZone: input.timeZone ?? null })
    const reviewKeys = plan.removeRecordKeys.filter((key) => !plan.actions.some((a) => a.key === key))
    const pairs: unknown[] = []
    for (const [path, value] of Object.entries(plan.reviews.set)) pairs.push(new FieldPath(...path.split(/\.(.+)/).filter(Boolean)), value)
    for (const path of plan.reviews.remove) pairs.push(new FieldPath(...path.split(/\.(.+)/).filter(Boolean)), deleteField())
    for (const key of reviewKeys) pairs.push(new FieldPath(TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD, key), deleteField())
    if (pairs.length === 0) return 0
    const [first, firstValue, ...rest] = pairs
    transaction.update(sheetRef, first as FieldPath, firstValue, ...rest, ...metaPairs)
    return plan.reviews.remove.length + Object.keys(plan.reviews.set).length
  })
  undone += reviewsUndone
  return { undone, refused }
}
