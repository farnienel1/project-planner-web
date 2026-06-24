import { format, isSameDay, startOfDay } from 'date-fns'
import type { Project, User } from '@/types'
import { timeSlotsOverlap } from '@/lib/scheduling/bookingClashUtils'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { managerSiteBookingDisplayTitle } from '@/lib/scheduling/managerSiteBookingUtils'

export interface ManagerBookingClashWarning {
  id: string
  userId: string
  personName: string
  date: Date
  bookingAId: string
  bookingBId: string
  locationALabel: string
  locationBLabel: string
  message: string
}

function projectsByIdMap(projects: Project[]): Map<string, string> {
  return new Map(projects.map((p) => [p.id, `${p.jobNumber} ${p.siteName}`.trim()]))
}

function personName(userId: string, usersById: Map<string, User>): string {
  const user = usersById.get(userId)
  if (!user) return 'Manager'
  return `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email || 'Manager'
}

export function computeManagerBookingClashWarnings(
  managerSiteBookings: ManagerSiteBooking[],
  users: User[],
  projects: Project[]
): ManagerBookingClashWarning[] {
  const usersById = new Map(users.map((u) => [u.id, u]))
  const projectsById = projectsByIdMap(projects)
  const warnings: ManagerBookingClashWarning[] = []
  const seen = new Set<string>()

  const byUserDay = new Map<string, ManagerSiteBooking[]>()
  for (const booking of managerSiteBookings) {
    const key = `${booking.userId}|${startOfDay(booking.date).toISOString()}`
    const list = byUserDay.get(key) || []
    list.push(booking)
    byUserDay.set(key, list)
  }

  for (const [, dayBookings] of byUserDay) {
    if (dayBookings.length < 2) continue
    const sorted = [...dayBookings].sort((a, b) => a.id.localeCompare(b.id))

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i]
        const b = sorted[j]
        if (a.locationId && b.locationId && a.locationId === b.locationId) continue

        if (
          !timeSlotsOverlap(
            String(a.timeSlot),
            String(b.timeSlot),
            a.workStartTime,
            a.workEndTime,
            b.workStartTime,
            b.workEndTime
          )
        ) {
          continue
        }

        const pairKey = [a.id, b.id].sort().join('|')
        if (seen.has(pairKey)) continue
        seen.add(pairKey)

        const locationALabel = managerSiteBookingDisplayTitle(a, projectsById)
        const locationBLabel = managerSiteBookingDisplayTitle(b, projectsById)
        const name = personName(a.userId, usersById)

        warnings.push({
          id: pairKey,
          userId: a.userId,
          personName: name,
          date: startOfDay(a.date),
          bookingAId: a.id,
          bookingBId: b.id,
          locationALabel,
          locationBLabel,
          message: `${name} has overlapping manager bookings (${locationALabel} & ${locationBLabel}) on ${format(a.date, 'd MMM yyyy')}.`,
        })
      }
    }
  }

  return warnings.sort((a, b) => a.date.getTime() - b.date.getTime())
}
