/**
 * Review 1.41 (re-review #3): a Replace compares the live booking with the copy the person was SHOWN. Each replace ref
 * is stamped with `bookingDeleteFingerprint` of the booking as this screen holds it at the moment the orange row is
 * built (or Replace is tapped); `commitBookingReplace` refuses when the live document differs, or when a ref carries no
 * fingerprint (the booking was not on this screen). App plumbing only; the fingerprint is the rulebook's.
 */

import { bookingDeleteFingerprint, type BookingReplaceRef } from '@/lib/canonical'
import { createWritePayload } from '@/lib/firebase/partialWrite'
import { serializeBooking, serializeManagerSiteBooking } from '@/lib/ios-parity/converters'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { useBookingStore } from '@/lib/stores/bookingStore'
import { useManagerScheduleStore } from '@/lib/stores/managerScheduleStore'

/** A replace ref with the fingerprint of the booking the person was shown (missing: not on this screen). */
export type SeenBookingReplaceRef = BookingReplaceRef & { fingerprint?: string }

/** `bookingDeleteFingerprint` of a stored-shape booking copy (delete markers stripped), in the organisation zone. */
export function storedReplaceFingerprint(
  collection: BookingReplaceRef['collection'],
  data: Record<string, unknown>
): string {
  return bookingDeleteFingerprint({ ...createWritePayload(data), collection }, organizationZoneOr())
}

/** The fingerprint of the booking `ref` names as the booking stores hold it now, or null when it is not loaded. */
export function shownReplaceFingerprint(ref: BookingReplaceRef): string | null {
  const id = ref.bookingId.toLowerCase()
  if (ref.collection === 'bookings') {
    const row = useBookingStore.getState().bookings.find((b) => String(b.id).toLowerCase() === id)
    return row ? storedReplaceFingerprint('bookings', serializeBooking(row)) : null
  }
  const row = useManagerScheduleStore.getState().managerSiteBookings.find((b) => String(b.id).toLowerCase() === id)
  if (!row) return null
  const organizationId = String((row as { organizationId?: unknown }).organizationId ?? '') || 'organization'
  return storedReplaceFingerprint('managerSiteBookings', serializeManagerSiteBooking({ ...row, organizationId }))
}

/** Each ref stamped with the fingerprint of the booking as shown now (a ref not loaded stays without one). */
export function stampShownReplaceRefs(refs: ReadonlyArray<BookingReplaceRef>): SeenBookingReplaceRef[] {
  return refs.map((ref) => {
    const fingerprint = shownReplaceFingerprint(ref)
    return fingerprint ? { ...ref, fingerprint } : { ...ref }
  })
}
