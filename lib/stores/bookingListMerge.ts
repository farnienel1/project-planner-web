/**
 * The pure part of the labour bookings listener (`bookingStore`): a listener snapshot → the bookings the store
 * holds. No Firebase write import, so the data-parity fixture (rulebook 1.38.0 §27) runs this exact code in tests.
 */
import type { Booking } from '@/types'
import { logSkippedDocument, parseBooking } from '@/lib/ios-parity/converters'
import { retainParsedRows } from '@/lib/staff/rosterRetain'
import type { OrgCollectionDoc } from '@/lib/firebase/orgCollectionMerge'

/**
 * Each document read with `parseBooking` (`parseBookingDocument`); a document the reader refuses is logged, never
 * guessed. When every document failed to read the bookings already on screen stay (`retainParsedRows`).
 * `previous` is the store's list for this organisation.
 */
export function bookingsFromListenerDocs(input: {
  organizationId: string
  docs: readonly OrgCollectionDoc[]
  previous: readonly Booking[]
}): Booking[] {
  const bookings: Booking[] = []
  for (const entry of input.docs) {
    const parsed = parseBooking(entry.id, entry.data, input.organizationId)
    if (parsed.ok) bookings.push(parsed.value)
    else logSkippedDocument('bookings', entry.id, parsed.errors)
  }
  return retainParsedRows(input.docs.length, input.previous, bookings)
}
