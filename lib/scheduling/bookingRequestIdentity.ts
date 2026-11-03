/**
 * Web glue for rulebook 1.20.2 `bookingRequestIdentity`: maps a stored booking (operative or manager site booking) and
 * a booking request to the canonical identity, so "already booked" never ignores custom-hours times.
 */
import { bookingRequestIdentity, type BookingRequestIdentityInput } from '@/lib/canonical/bookingSlots'
import { dayKey as orgDayKey } from '@/lib/ios-parity/londonTime'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { Booking } from '@/types'

export function managerBookingIdentityInput(
  booking: Pick<
    ManagerSiteBooking,
    'userId' | 'date' | 'timeSlot' | 'locationType' | 'locationId' | 'customLocationName' | 'workStartTime' | 'workEndTime' | 'isBreakRemoved'
  >,
  timeZone?: string
): BookingRequestIdentityInput {
  return {
    personId: booking.userId,
    dayKey: orgDayKey(booking.date instanceof Date ? booking.date : new Date(booking.date), timeZone),
    timeSlot: booking.timeSlot,
    locationType: booking.locationType,
    locationId: booking.locationId ?? null,
    customLocationName: booking.customLocationName ?? null,
    workStartTime: booking.workStartTime ?? null,
    workEndTime: booking.workEndTime ?? null,
    isBreakRemoved: booking.isBreakRemoved === true,
  }
}

export function operativeBookingIdentityInput(
  booking: Pick<Booking, 'operativeId' | 'projectId' | 'date' | 'timeSlot' | 'workStartTime' | 'workEndTime' | 'isBreakRemoved'>,
  timeZone?: string
): BookingRequestIdentityInput {
  return {
    personId: booking.operativeId,
    dayKey: orgDayKey(booking.date instanceof Date ? booking.date : new Date(booking.date), timeZone),
    timeSlot: String(booking.timeSlot ?? ''),
    locationId: booking.projectId ?? null,
    workStartTime: booking.workStartTime ?? null,
    workEndTime: booking.workEndTime ?? null,
    isBreakRemoved: booking.isBreakRemoved === true,
  }
}

export function managerBookingIdentity(
  booking: Parameters<typeof managerBookingIdentityInput>[0],
  timeZone?: string
): string {
  return bookingRequestIdentity(managerBookingIdentityInput(booking, timeZone))
}

export function operativeBookingIdentity(
  booking: Parameters<typeof operativeBookingIdentityInput>[0],
  timeZone?: string
): string {
  return bookingRequestIdentity(operativeBookingIdentityInput(booking, timeZone))
}

/** One row per stored document (by id, without case): two different bookings are never folded into one row. */
export function uniqueBookingsById<T extends { id: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const key = String(row.id || '').trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}
