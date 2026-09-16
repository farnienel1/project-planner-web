import { format } from 'date-fns'
import type { Booking, Operative, Project, User } from '@/types'
import { UserRole } from '@/types'
import { dayKey, londonMidnight } from '@/lib/ios-parity/londonTime'
import { isActiveBookingStatus, isSmallWorksJobType } from '@/lib/ios-parity/enums'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import {
  formatWarningHours,
  intervalsOverlap,
  managerClashInterval,
  operativeClashInterval,
  overlappingClusters,
  paidHoursForOperativeBooking,
} from '@/lib/warnings/clashIntervals'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { managerSiteBookingDisplayTitle } from '@/lib/scheduling/managerSiteBookingUtils'
import type { ClashTimelineEntry } from '@/lib/warnings/clashTimeline'
import { clashEntryFromOperativeBooking } from '@/lib/scheduling/bookingClashUtils'

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
  entries: ClashTimelineEntry[]
}

type PersonDayItem = {
  userId: string
  date: Date
  sortKey: string
  bookingId: string
  locationLabel: string
  interval: { start: number; end: number } | null
  entry: ClashTimelineEntry
}

export function clashEntryFromManagerBooking(
  booking: ManagerSiteBooking,
  project: Project | undefined,
  locationLabel: string,
  payrollPolicy: OrgPayrollTimePolicy
): ClashTimelineEntry {
  const iv = managerClashInterval(booking, payrollPolicy) ?? { start: 8 * 60, end: 17 * 60 }
  const hours = paidHoursForOperativeBooking(booking, payrollPolicy)
  const clock =
    booking.workStartTime?.trim() && booking.workEndTime?.trim()
      ? `${booking.workStartTime}–${booking.workEndTime}`
      : String(booking.timeSlot).replace('_', ' ')
  const isProject = booking.locationType === 'project' || booking.locationType === 'small_work'
  return {
    bookingId: booking.id,
    managerBookingId: booking.id,
    jobNumber: isProject ? project?.jobNumber : undefined,
    siteName: isProject ? project?.siteName : undefined,
    isSmallWorks: isProject && project ? isSmallWorksJobType(project.jobType) : false,
    locationLabel,
    timeLabel: clock,
    startMinutes: iv.start,
    endMinutes: iv.end,
    hoursLabel: `${formatWarningHours(hours)}h`,
  }
}

function isManagerOrAdminUser(user: User): boolean {
  return Boolean(
    user.isActive &&
      (user.permissions?.manager ||
        user.permissions?.adminAccess ||
        user.isSuperAdmin ||
        user.role === UserRole.ADMIN)
  )
}

function personName(userId: string, usersById: Map<string, User>): string {
  const user = usersById.get(userId)
  if (!user) return 'Manager'
  return `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email || 'Manager'
}

function projectLabel(project: Project | undefined): string {
  if (!project) return 'Project'
  return `${project.jobNumber} ${project.siteName}`.trim()
}

/**
 * iOS managerPersonDayItems: manager/admin users' site bookings plus any
 * operative bookings linked by email, clustered by clock interval overlap.
 */
export function computeManagerBookingClashWarnings(
  managerSiteBookings: ManagerSiteBooking[],
  users: User[],
  projects: Project[],
  options?: {
    operativeBookings?: Booking[]
    operatives?: Operative[]
    payrollPolicy?: OrgPayrollTimePolicy
  }
): ManagerBookingClashWarning[] {
  const usersById = new Map(users.map((u) => [u.id, u]))
  const projectsById = new Map(projects.map((p) => [p.id, p]))
  const projectTitles = new Map(projects.map((p) => [p.id, projectLabel(p)]))
  const payrollPolicy = options?.payrollPolicy ?? DEFAULT_PAYROLL_POLICY
  const managerAdminUsers = users.filter(isManagerOrAdminUser)
  const managerAdminUserIds = new Set(managerAdminUsers.map((user) => user.id))
  const emailToUserId = new Map<string, string>()
  for (const user of managerAdminUsers) {
    const email = user.email.trim().toLowerCase()
    if (email) emailToUserId.set(email, user.id)
  }
  const operativesById = new Map((options?.operatives || []).map((operative) => [operative.id, operative]))

  const itemsByPersonDay = new Map<string, PersonDayItem[]>()
  const pushItem = (item: PersonDayItem) => {
    const key = `${item.userId}|${dayKey(item.date)}`
    const list = itemsByPersonDay.get(key) || []
    list.push(item)
    itemsByPersonDay.set(key, list)
  }

  for (const booking of managerSiteBookings) {
    if (!managerAdminUserIds.has(booking.userId)) continue
    const interval = managerClashInterval(booking, payrollPolicy)
    const locationLabel = managerSiteBookingDisplayTitle(booking, projectTitles)
    const project = booking.locationId ? projectsById.get(booking.locationId) : undefined
    pushItem({
      userId: booking.userId,
      date: booking.date,
      sortKey: `m-${booking.id}`,
      bookingId: booking.id,
      locationLabel,
      interval,
      entry: clashEntryFromManagerBooking(booking, project, locationLabel, payrollPolicy),
    })
  }

  for (const booking of options?.operativeBookings || []) {
    if (!isActiveBookingStatus(booking.status)) continue
    const operative = operativesById.get(booking.operativeId)
    if (!operative) continue
    const userId = emailToUserId.get(operative.email.trim().toLowerCase())
    if (!userId) continue
    const project = projectsById.get(booking.projectId)
    pushItem({
      userId,
      date: booking.date,
      sortKey: `o-${booking.id}`,
      bookingId: booking.id,
      locationLabel: projectLabel(project),
      interval: operativeClashInterval(booking, payrollPolicy),
      entry: clashEntryFromOperativeBooking(booking, project, payrollPolicy),
    })
  }

  const warnings: ManagerBookingClashWarning[] = []
  const seen = new Set<string>()

  for (const [, items] of itemsByPersonDay) {
    if (items.length < 2) continue
    const clusters = overlappingClusters(items, (a, b) => {
      if (!a.interval || !b.interval) return false
      return intervalsOverlap(a.interval, b.interval)
    })
    for (const cluster of clusters) {
      const sorted = [...cluster].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      const pairKey = sorted.map((item) => item.sortKey).join('|')
      if (seen.has(pairKey)) continue
      seen.add(pairKey)
      const name = personName(sorted[0].userId, usersById)
      const place = sorted.length === 2 ? 'two' : String(sorted.length)
      warnings.push({
        id: pairKey,
        userId: sorted[0].userId,
        personName: name,
        date: londonMidnight(sorted[0].date),
        bookingAId: sorted[0].bookingId,
        bookingBId: sorted[1].bookingId,
        locationALabel: sorted[0].locationLabel,
        locationBLabel: sorted[1].locationLabel,
        message: `${name} is booked in ${place} places on ${format(londonMidnight(sorted[0].date), 'd MMM yyyy')}. Approve if it's intentional and it'll be noted on the weekly report.`,
        entries: sorted.map((item) => item.entry),
      })
    }
  }

  return warnings.sort((a, b) => a.date.getTime() - b.date.getTime())
}
