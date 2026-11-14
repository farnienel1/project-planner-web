/**
 * Web side of Replace (rulebook 1.41.0 §5, `bookingReplaceWrites`): a booking create or edit and, in the SAME
 * Firestore transaction, the delete of every booking it replaces with its tombstone. The rulebook gives the paths and
 * tombstones; this file only writes them. Review 1.41:
 *   - #3 the transaction re-reads each replaced booking and its tombstone first: one gone or tombstoned refuses with
 *     `BOOKING_REPLACE_ALREADY_GONE_MESSAGE`, one whose `bookingDeleteFingerprint` differs from the fingerprint stamped
 *     when the person was shown the row refuses with `BOOKING_REPLACE_CHANGED_MESSAGE`, a ref with none refuses with
 *     `BOOKING_REPLACE_NOT_SHOWN_MESSAGE`; a server refusal reads `BOOKING_REPLACE_REFUSED_MESSAGE`.
 *   - #2 a replaced booking on a signed or exported timesheet asks first (`bookingDeleteSignedTimesheetWarning`).
 *   - #1 each replaced booking sends the PAYE overtime reopen notice, as a normal delete does.
 */

import {
  doc,
  runTransaction,
  serverTimestamp,
  type DocumentReference,
  type Firestore,
  type Transaction,
} from 'firebase/firestore'
import { auth } from '@/lib/firebase/config'
import { MissingDocumentError } from '@/lib/firebase/partialWrite'
import { storedReplaceFingerprint, type SeenBookingReplaceRef } from '@/lib/bookings/bookingReplaceSeen'
import { bookingReplaceWrites, type BookingReplaceRef } from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

export const BOOKING_REPLACE_REFUSED_MESSAGE = 'Not replaced — you can no longer remove the existing booking.'
export const BOOKING_REPLACE_CHANGED_MESSAGE = 'Changed on another device — not replaced.'
export const BOOKING_REPLACE_ALREADY_GONE_MESSAGE = 'The existing booking was already removed on another device — not replaced.'
export const BOOKING_REPLACE_NOT_SAVED_MESSAGE = 'This booking could not replace the existing one. Nothing was saved.'
export const BOOKING_REPLACE_CANCELLED_MESSAGE = 'Not replaced — nothing was saved.'
/** The same words as iOS (`BookingReplaceMessages.notOnThisPhone`). */
export const BOOKING_REPLACE_NOT_SHOWN_MESSAGE = 'The existing booking is no longer on this phone — refresh and try again. Nothing was saved.'

export class BookingReplaceError extends Error {}

function signedInUserId(): string {
  const uid = auth?.currentUser?.uid
  if (!uid) throw new BookingReplaceError('Sign in again to replace this booking.')
  return uid
}

/** A replaced booking as this screen holds it (its stored shape), for the re-check, the warning and the notice. */
type ReplacedCopy = {
  ref: BookingReplaceRef
  personId: string | null
  dayKey: string | null
  notify: (() => void) | null
}

async function replacedCopies(organizationId: string, refs: ReadonlyArray<BookingReplaceRef>): Promise<ReplacedCopy[]> {
  const [labourStore, managerStore, { dayKey }] = await Promise.all([
    import('@/lib/stores/bookingStore'),
    import('@/lib/stores/managerScheduleStore'),
    import('@/lib/ios-parity/londonTime'),
  ])
  const zone = organizationZoneOr()
  return refs.map((ref): ReplacedCopy => {
    const id = ref.bookingId.toLowerCase()
    if (ref.collection === 'bookings') {
      const row = labourStore.useBookingStore.getState().bookings.find((b) => String(b.id).toLowerCase() === id)
      return {
        ref,
        personId: row ? String(row.operativeId || '') || null : null,
        dayKey: row ? dayKey(new Date(row.date), zone) : null,
        notify: row ? () => labourStore.notifyOvertimeReopenedSoon(row, null) : null,
      }
    }
    const row = managerStore.useManagerScheduleStore.getState().managerSiteBookings.find((b) => String(b.id).toLowerCase() === id)
    return {
      ref,
      personId: row ? row.userId : null,
      dayKey: row ? dayKey(new Date(row.date), zone) : null,
      notify: row ? () => managerStore.notifyOvertimeReopenedSoon(organizationId, row, null) : null,
    }
  })
}

/**
 * Rulebook 1.33.0 `bookingDeleteSignedTimesheetWarning` for the replaced bookings, on exactly the inputs the delete
 * notice uses (platform guardrail 1): every id the booked person goes by (`bookedPersonTimesheetUserIds`) and their
 * `settings/timesheet_*` documents, sheets stored without `userId` included (`personTimesheetDocs`). A sheet this
 * viewer cannot read gives no warning. The text, or null.
 */
async function signedTimesheetWarning(db: Firestore, organizationId: string, copies: ReadonlyArray<ReplacedCopy>): Promise<string | null> {
  const [{ useOrgUserStore }, { useOperativeStore }, { personTimesheetDocs }, { signedTimesheetWarningForBookings }] = await Promise.all([
    import('@/lib/stores/siteAuditStore'),
    import('@/lib/stores/operativeStore'),
    import('@/lib/bookings/signedTimesheetDeleteNotice'),
    import('@/lib/bookings/signedTimesheetDeleteWarning'),
  ])
  const { users, userIdAliases } = useOrgUserStore.getState()
  return signedTimesheetWarningForBookings({
    bookings: copies,
    users,
    operatives: useOperativeStore.getState().operatives,
    userIdAliases,
    timeZone: organizationZoneOr(),
    loadDocs: (userIds) => personTimesheetDocs(organizationId, userIds, db),
  })
}

function errorCode(error: unknown): string {
  return String((error as { code?: unknown } | null)?.code ?? '').replace(/^firestore\//, '')
}

/**
 * The booking write (`write`: a create or a partial edit on the transaction) and, for each replaced booking, its
 * delete and tombstone — every replaced booking re-read first, all in one transaction. `existing` (an edit): the
 * booking being saved must still exist (`MissingDocumentError` otherwise, as a normal edit). Throws
 * `BookingReplaceError` with a plain message when nothing was written. Returns the replaced refs.
 */
export async function commitBookingReplace(
  db: Firestore,
  input: {
    organizationId: string
    booking: { collection: 'bookings' | 'managerSiteBookings'; bookingId: string }
    /** Re-review 1.41 #3: each with the fingerprint of the booking as the person was shown it (`stampShownReplaceRefs`). */
    replaced: ReadonlyArray<SeenBookingReplaceRef>
    write: (tx: Transaction, ref: DocumentReference) => void | Promise<void>
    existing?: boolean
  }
): Promise<BookingReplaceRef[]> {
  const plan = bookingReplaceWrites({
    organizationId: input.organizationId,
    booking: input.booking,
    replaced: input.replaced,
    deletedBy: signedInUserId(),
    deletedFrom: 'web',
  })
  if (!plan) throw new BookingReplaceError(BOOKING_REPLACE_NOT_SAVED_MESSAGE)
  // The fingerprint each replaced booking had when the person was shown it; none (not on this screen) refuses, fail closed.
  const shown = new Map(input.replaced.map((ref) => [`${ref.collection}/${ref.bookingId.toLowerCase()}`, ref.fingerprint ?? '']))
  const expected = plan.deletes.map((row) => shown.get(`${row.collection}/${row.bookingId.toLowerCase()}`) ?? '')
  if (expected.some((fingerprint) => !fingerprint)) throw new BookingReplaceError(BOOKING_REPLACE_NOT_SHOWN_MESSAGE)
  const copies = await replacedCopies(
    input.organizationId,
    plan.deletes.map((d) => ({ collection: d.collection, bookingId: d.bookingId }))
  )
  const warning = await signedTimesheetWarning(db, input.organizationId, copies)
  if (warning && typeof window !== 'undefined' && !window.confirm(`${warning}\n\nReplace the booking anyway?`)) {
    throw new BookingReplaceError(BOOKING_REPLACE_CANCELLED_MESSAGE)
  }
  const ref = doc(db, plan.bookingPath)
  try {
    await runTransaction(db, async (tx) => {
      // An edit of a booking deleted on another device is refused, never re-created (rulebook §1).
      if (input.existing && !(await tx.get(ref)).exists()) throw new MissingDocumentError(ref.path)
      for (const [index, row] of plan.deletes.entries()) {
        const live = await tx.get(doc(db, row.path))
        const tomb = await tx.get(doc(db, row.tombstonePath))
        if (!live.exists() || tomb.exists()) throw new BookingReplaceError(BOOKING_REPLACE_ALREADY_GONE_MESSAGE)
        const now = storedReplaceFingerprint(row.collection, live.data() as Record<string, unknown>)
        if (!now || now !== expected[index]) throw new BookingReplaceError(BOOKING_REPLACE_CHANGED_MESSAGE)
      }
      await input.write(tx, ref)
      for (const row of plan.deletes) {
        tx.delete(doc(db, row.path))
        tx.set(doc(db, row.tombstonePath), { ...row.tombstone, deletedAt: serverTimestamp() })
      }
    })
  } catch (error) {
    if (error instanceof BookingReplaceError || error instanceof MissingDocumentError) throw error
    const code = errorCode(error)
    if (code === 'permission-denied') throw new BookingReplaceError(BOOKING_REPLACE_REFUSED_MESSAGE)
    if (code === 'not-found') throw new BookingReplaceError(BOOKING_REPLACE_ALREADY_GONE_MESSAGE)
    throw error
  }
  // Rulebook 1.33.0 §25 reopen: each replaced booking's PAYE overtime line, as after a normal delete.
  for (const copy of copies) copy.notify?.()
  return plan.deletes.map((row) => ({ collection: row.collection, bookingId: row.bookingId }))
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
  const gone = (name: string) => new Set(removed.filter((r) => r.collection === name).map((r) => r.bookingId.toLowerCase()))
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
