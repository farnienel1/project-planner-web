/**
 * Web side of rulebook 1.72.0 §8 (owner decisions 23 Nov, A and B): the line manager's ⚙ and ✕ on a timesheet line
 * under review write the BOOKING, never a `payrollLineReviews` entry.
 *
 * - ⚙: `timesheetReviewBookingEditWrites` on the stored booking (read fresh, never a stale copy), written as a partial
 *   update with write metadata. An edit of a booking deleted elsewhere is refused (`MissingDocumentError`).
 * - ✕: `timesheetReviewBookingDelete` — the delete and its tombstone in one batch; a booking already deleted elsewhere
 *   (its tombstone exists) is treated as done (`commitBookingDeleteTolerantly`).
 *
 * 1.74.0 (owner decision 23 Nov): every write also records the edit on the sheet in the same batch
 * (`timesheetReviewerBookingEditRecord`, `reviewerBookingEdits.{key}`), so the sheet stays with the reviewer — they make
 * as many changes as they like and their counter-signature builds the snapshot from the live bookings. Without a sheet
 * to record on (`sheetRecord` missing, or nothing to record) the booking is written alone and the 1.47.0 rule sends the
 * sheet back to the person, as 1.72.0.
 */
import { deleteDoc, doc, FieldPath, getDoc, serverTimestamp, updateDoc, writeBatch, type Firestore, type WriteBatch } from 'firebase/firestore'
import {
  BOOKING_TOMBSTONE_COLLECTION,
  TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD,
  timesheetReviewBookingAfterEdit,
  timesheetReviewBookingDocument,
  timesheetReviewerBookingEditKey,
  timesheetReviewerBookingEditRecord,
  timesheetReviewerEditBefore,
  type SignedTimesheetBookingDocument,
  type SignedTimesheetSheet,
  type TimesheetReviewerBookingEdit,
  timesheetReviewBookingDelete,
  timesheetReviewBookingEditWrites,
  timesheetReviewOvertimeStrike,
  type TimesheetReviewBookingCollection,
  type TimesheetReviewOvertimeStrike,
} from '@/lib/canonical'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import { firestoreUpdateFields, MissingDocumentError } from '@/lib/firebase/partialWrite'
import { commitBookingDeleteTolerantly } from '@/lib/bookings/bookingTombstoneWrite'
import { timesheetLineBooking } from '@/lib/timesheets/payrollLineBookingLookup'

/** The booking a timesheet line comes from (moved to `payrollLineBookingLookup`, which has no Firebase imports). */
export { timesheetLineBooking }

/** The sheet a reviewer's booking write is recorded on (1.74.0). */
export type TimesheetReviewSheetRecord = {
  /** The stored sheet document id (`settings/{id}`): the version the review page shows. */
  documentId: string
  /** The sheet as loaded (its `operativeSignedAt` decides which signature the edit belongs to). */
  sheet: SignedTimesheetSheet
}

/** What was recorded on the sheet (null when nothing could be). */
export type RecordedReviewerEdit = { key: string; value: TimesheetReviewerBookingEdit } | null

function recordOf(
  record: TimesheetReviewSheetRecord | null | undefined,
  booking: { bookingId: string; collection: TimesheetReviewBookingCollection },
  /** The stored booking read fresh, and the write; null for a delete. */
  change: { stored: Record<string, unknown>; set: Record<string, unknown>; remove: string[]; timeZone: string | null } | null,
  userId: string,
  /** 1.90.0: the stored booking read fresh before a delete (its before-values, so Cancel changes can re-create it). */
  storedBeforeDelete?: Record<string, unknown> | null
): RecordedReviewerEdit {
  if (!record || !record.documentId || record.documentId.includes('/')) return null
  let after: SignedTimesheetBookingDocument | null = null
  if (change) {
    const before = timesheetReviewBookingDocument({ collection: booking.collection, id: booking.bookingId, data: change.stored, timeZone: change.timeZone })
    if (!before) return null
    after = timesheetReviewBookingAfterEdit(before as unknown as Record<string, unknown>, change) as unknown as SignedTimesheetBookingDocument
  }
  // 1.90.0 (Cancel changes): the booking's values before this edit, and the record already stored for it (whose
  // before-values are kept within the same session).
  const before = timesheetReviewerEditBefore({ data: change ? change.stored : storedBeforeDelete ?? null, deleted: change == null })
  const key = timesheetReviewerBookingEditKey(booking.collection, booking.bookingId)
  const edits = record.sheet.reviewerBookingEdits
  const existing = key && edits && typeof edits === 'object' ? (edits as Record<string, unknown>)[key] : undefined
  return timesheetReviewerBookingEditRecord({ sheet: record.sheet, booking, after, deleted: change == null, editedBy: userId, before, existing })
}

function addRecord(
  batch: WriteBatch,
  db: Firestore,
  input: { organizationId: string; userId: string; record: TimesheetReviewSheetRecord },
  recorded: NonNullable<RecordedReviewerEdit>
): void {
  const sheetRef = doc(db, 'organizations', input.organizationId, 'settings', input.record.documentId)
  batch.update(
    sheetRef,
    new FieldPath(TIMESHEET_REVIEWER_BOOKING_EDITS_FIELD, recorded.key),
    { ...recorded.value, editedAt: serverTimestamp() },
    'updatedAt',
    serverTimestamp(),
    ...Object.entries(writeMetadataFields(input.userId, 'web') ?? {}).flat()
  )
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
    /** 1.74.0: the sheet under review, so the edit is recorded on it in the same batch. */
    sheetRecord?: TimesheetReviewSheetRecord | null
  }
): Promise<{ changed: boolean; recorded: RecordedReviewerEdit }> {
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
  if (!edit.changed) return { changed: false, recorded: null }
  const fields = {
    ...firestoreUpdateFields({ set: edit.set, remove: edit.remove }),
    updatedAt: serverTimestamp(),
    ...(writeMetadataFields(input.userId, 'web') ?? {}),
  }
  const recorded = recordOf(
    input.sheetRecord,
    input.booking,
    { stored: snap.data() as Record<string, unknown>, set: edit.set, remove: edit.remove, timeZone: input.timeZone ?? null },
    input.userId
  )
  if (!recorded || !input.sheetRecord) {
    await updateDoc(ref, fields)
    return { changed: true, recorded: null }
  }
  // 1.74.0: the booking and the sheet's record in one batch — both or neither.
  const batch = writeBatch(db)
  batch.update(ref, fields)
  addRecord(batch, db, { organizationId: input.organizationId, userId: input.userId, record: input.sheetRecord }, recorded)
  await batch.commit()
  return { changed: true, recorded }
}

/** ✕: delete the booking with its tombstone in one batch. */
export async function deleteTimesheetReviewBooking(
  db: Firestore,
  input: {
    organizationId: string
    userId: string
    booking: { bookingId: string; collection: TimesheetReviewBookingCollection }
    /** 1.74.0: the sheet under review, so the delete is recorded on it in the same batch. */
    sheetRecord?: TimesheetReviewSheetRecord | null
  }
): Promise<{ result: 'deleted' | 'alreadyDeleted'; recorded: RecordedReviewerEdit }> {
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
  // 1.90.0: read the booking before deleting it, so its values are recorded for Cancel changes.
  const storedSnap = input.sheetRecord ? await getDoc(bookingRef).catch(() => null) : null
  const storedBeforeDelete = storedSnap?.exists() ? (storedSnap.data() as Record<string, unknown>) : null
  const recorded = recordOf(input.sheetRecord, input.booking, null, input.userId, storedBeforeDelete)
  if (recorded && input.sheetRecord) {
    addRecord(batch, db, { organizationId: input.organizationId, userId: input.userId, record: input.sheetRecord }, recorded)
  }
  let committed = false
  const result = await commitBookingDeleteTolerantly({
    commit: async () => {
      await batch.commit()
      committed = true
    },
    tombstoneExists: async () => (await getDoc(tombstoneRef)).exists(),
    bookingExists: async () => (await getDoc(bookingRef)).exists(),
    deleteAlone: () => deleteDoc(bookingRef),
  })
  // Only the batch carries the record; a delete that went another way (already deleted elsewhere) records nothing.
  return { result, recorded: committed ? recorded : null }
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
  input: {
    organizationId: string
    userId: string
    strike: Extract<TimesheetReviewOvertimeStrike, { kind: 'trim' }>
    /** 1.74.0: the sheet under review, so the trim is recorded on it in the same batch. */
    sheetRecord?: TimesheetReviewSheetRecord | null
    timeZone?: string | null
  }
): Promise<{ recorded: RecordedReviewerEdit }> {
  const ref = doc(db, 'organizations', input.organizationId, input.strike.collection, input.strike.bookingId)
  if (Object.keys(input.strike.set).length === 0 && input.strike.remove.length === 0) return { recorded: null }
  const fields = {
    ...firestoreUpdateFields({ set: input.strike.set, remove: input.strike.remove }),
    updatedAt: serverTimestamp(),
    ...(writeMetadataFields(input.userId, 'web') ?? {}),
  }
  const booking = { bookingId: input.strike.bookingId, collection: input.strike.collection }
  let recorded: RecordedReviewerEdit = null
  if (input.sheetRecord) {
    const snap = await getDoc(ref)
    if (!snap.exists()) throw new MissingDocumentError(ref.path)
    recorded = recordOf(
      input.sheetRecord,
      booking,
      { stored: snap.data() as Record<string, unknown>, set: input.strike.set, remove: input.strike.remove, timeZone: input.timeZone ?? null },
      input.userId
    )
  }
  if (!recorded || !input.sheetRecord) {
    await updateDoc(ref, fields)
    return { recorded: null }
  }
  const batch = writeBatch(db)
  batch.update(ref, fields)
  addRecord(batch, db, { organizationId: input.organizationId, userId: input.userId, record: input.sheetRecord }, recorded)
  await batch.commit()
  return { recorded }
}
