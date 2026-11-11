/**
 * Rulebook 1.41.0 §5: whether an orange double-booking row offers Replace — `bookingReplaceOffer` over the row's
 * overlapping bookings, each with `mayDelete` = `bookingRemoveAction(...) === 'delete'` (`canDeleteBooking`) for the
 * signed-in user on the booking's job. The screens build the overlapping bookings; this only maps them to the rule.
 */

import { bookingReplaceOffer, type BookingReplaceRef } from '@/lib/canonical'
import { userBookingRemoveAction } from '@/lib/access/bookingAccess'

type Job = { id: string } & Record<string, unknown>

export function rowReplaceOffer(input: {
  user: Parameters<typeof userBookingRemoveAction>[0]
  managers: ReadonlyArray<{ id: string; email?: string | null }> | null | undefined
  jobs: ReadonlyArray<Job>
  labour: ReadonlyArray<{ id: string; projectId?: string | null }>
  manager: ReadonlyArray<{ id: string; userId: string; locationType?: string | null; locationId?: string | null }>
}): { replace?: { bookings: BookingReplaceRef[] } } {
  const jobFor = (id: unknown) =>
    (input.jobs.find((job) => String(job.id).toLowerCase() === String(id ?? '').toLowerCase()) ?? null) as Parameters<typeof userBookingRemoveAction>[2]
  const clashing = [
    ...input.labour.map((booking) => ({
      bookingId: booking.id,
      collection: 'bookings',
      mayDelete:
        userBookingRemoveAction(input.user, { collection: 'bookings', projectId: booking.projectId ?? undefined }, jobFor(booking.projectId), input.managers) ===
        'delete',
    })),
    ...input.manager.map((booking) => ({
      bookingId: booking.id,
      collection: 'managerSiteBookings',
      mayDelete:
        userBookingRemoveAction(
          input.user,
          {
            collection: 'managerSiteBookings',
            userId: booking.userId,
            locationType: booking.locationType ?? undefined,
            locationId: booking.locationId ?? null,
          },
          jobFor(booking.locationId),
          input.managers
        ) === 'delete',
    })),
  ]
  const offer = bookingReplaceOffer({ clashing })
  return offer.offered ? { replace: { bookings: offer.bookings } } : {}
}
