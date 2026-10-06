import type { Booking, Operative, Project, User } from '@/types'
import { operativeMatching } from '@/lib/access/workAccess'
import { hasAdminAccess, isOperativeMode } from '@/lib/permissions'
import { normalizeBookingStatus } from '@/lib/ios-parity/enums'
import { deriveWorkStatus } from '@/lib/projects/workStatus'

/**
 * Home “active projects”: live jobs whose dates include today.
 * Two jobs that share a job number both count. Admins see every such job.
 * Managers see those except jobs hidden from them. Operatives see jobs they
 * are booked on (Confirmed or Tentative), including the last day.
 */
export function countHomeActiveProjects(params: {
  projects: Project[]
  user: User | null
  operatives?: Operative[]
  bookings?: Booking[]
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
    if (!operative) return 0
    const booked = new Set(
      (params.bookings || [])
        .filter((booking) => {
          const status = normalizeBookingStatus(booking.status)
          return booking.operativeId === operative.id && (status === 'Confirmed' || status === 'Tentative')
        })
        .map((booking) => booking.projectId)
    )
    return todayJobs.filter((project) => booked.has(project.id)).length
  }
  if (user.permissions.manager) {
    return todayJobs.filter((project) => !(project.hiddenManagerUserIds ?? []).includes(user.id)).length
  }
  return todayJobs.length
}
