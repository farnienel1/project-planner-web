import type { Booking, Operative, Project, User } from '@/types'
import { bookingIdsForAccount, bookingOccupiesDay } from '@/lib/canonical'
import { operativeMatching } from '@/lib/access/workAccess'
import { userCanSeeJob } from '@/lib/access/bookingAccess'
import { hasAdminAccess, isOperativeMode } from '@/lib/permissions'
import { normalizeBookingStatus } from '@/lib/ios-parity/enums'
import { deriveWorkStatus } from '@/lib/projects/workStatus'

/**
 * Home “active projects”: live jobs whose dates include today.
 * Two jobs that share a job number both count. Admins see every such job.
 * Managers see the ones they manage (`canSeeJob`, 1.10.0) except jobs hidden from them. Operatives see jobs they
 * are booked on (Confirmed or Tentative), including the last day.
 */
export function countHomeActiveProjects(params: {
  projects: Project[]
  user: User | null
  operatives?: Operative[]
  bookings?: Booking[]
  /** The managers list, for `canSeeJob` (a job's managerIds may name its rows). */
  managers?: ReadonlyArray<{ id: string; email?: string | null }>
  now?: Date
}): number {
  const now = params.now ?? new Date()
  const todayJobs = params.projects.filter((project) => deriveWorkStatus(project, now) === 'active')
  const user = params.user
  if (!user) return 0
  if (hasAdminAccess(user)) return todayJobs.length
  if (isOperativeMode(user)) {
    const operative = operativeMatching(user.email, params.operatives || [], {
      firstName: user.firstName,
      surname: user.surname,
    })
    // Catalogue rows on this email, the users id and former invite ids (web #189).
    const bookingIds = new Set(
      bookingIdsForAccount(
        { id: user.id, email: user.email, formerIds: user.formerUserIds ?? [] },
        params.operatives || []
      ).map((id) => id.toLowerCase())
    )
    if (operative) bookingIds.add(operative.id.toLowerCase())
    const booked = new Set(
      (params.bookings || [])
        .filter((booking) => {
          if (!booking.operativeId || !bookingIds.has(booking.operativeId.toLowerCase())) return false
          return bookingOccupiesDay(normalizeBookingStatus(booking.status) ?? booking.status)
        })
        .map((booking) => booking.projectId)
    )
    return todayJobs.filter((project) => booked.has(project.id)).length
  }
  if (user.permissions.manager || user.role === 'manager') {
    // Rulebook 1.10.0: a manager counts only the jobs they manage (`canSeeJob`).
    return todayJobs.filter(
      (project) => !(project.hiddenManagerUserIds ?? []).includes(user.id) && userCanSeeJob(user, project, params.managers)
    ).length
  }
  return todayJobs.length
}
