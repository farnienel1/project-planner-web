import type { Booking } from '@/types'
import {
  managerSiteBookingToScheduleBooking,
  type ManagerSiteBooking,
} from '@/lib/scheduling/managerSiteBookingUtils'

/** Merge operative bookings with all org manager site bookings for daily overview / reports. */
export function buildOrgScheduleBookings(
  operativeBookings: Booking[],
  managerSiteBookings: ManagerSiteBooking[],
  projectsById: Map<string, string>,
  organizationId?: string
): Booking[] {
  const merged: Booking[] = operativeBookings.map((booking) => ({
    ...booking,
    source: booking.source || 'operative',
  }))

  for (const managerBooking of managerSiteBookings) {
    merged.push(managerSiteBookingToScheduleBooking(managerBooking, projectsById, organizationId))
  }

  return merged.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function buildPeopleNameMap(
  operatives: Array<{ id: string; firstName: string; lastName: string; email?: string }>,
  users: Array<{ id: string; firstName: string; surname: string; email: string }>
): Map<string, string> {
  const map = new Map<string, string>()
  for (const operative of operatives) {
    map.set(
      operative.id,
      `${operative.firstName || ''} ${operative.lastName || ''}`.trim() || operative.email || operative.id
    )
  }
  for (const user of users) {
    map.set(user.id, `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email || user.id)
  }
  return map
}
