import { format } from 'date-fns'
import type { Booking, Operative, Project, User } from '@/types'
import { UserRole } from '@/types'
import { dayKey, londonMidnight } from '@/lib/ios-parity/londonTime'
import { isSmallWorksJobType } from '@/lib/ios-parity/enums'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import {
  clockText,
  formatWarningHours,
  managerClashInterval,
  paidHoursForOperativeBooking,
} from '@/lib/warnings/clashIntervals'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { managerSiteBookingDisplayTitle } from '@/lib/scheduling/managerSiteBookingUtils'
import type { ClashTimelineEntry } from '@/lib/warnings/clashTimeline'
import { clashEntryFromOperativeBooking } from '@/lib/scheduling/bookingClashUtils'
import { ORPHAN_BOOKING_LABEL, managerClashGroups, rosterAliasIdsFor, type BookingPersonInput } from '@/lib/canonical'

export interface ManagerBookingClashWarning {
  id: string
  /** The rulebook's `managerClashGroups` key, shared with iOS for `warningResolutions`. */
  resolutionKey: string
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
  if (!project) return ORPHAN_BOOKING_LABEL
  return `${project.jobNumber} ${project.siteName}`.trim()
}

/**
 * Who a booking belongs to, for the rulebook: each roster account with its former invite ids and the
 * same-email ids the roster folded into it (`userIdAliases`), plus the operatives catalogue.
 */
export function bookingPeopleForRoster(
  users: readonly User[],
  operatives: readonly Operative[],
  userIdAliases?: Readonly<Record<string, string>> | null
): BookingPersonInput {
  return {
    accounts: users.map((user) => ({
      id: user.id,
      email: user.email,
      formerIds: user.formerUserIds ?? [],
      aliasIds: rosterAliasIdsFor(user.id, userIdAliases),
    })),
    operatives: operatives.map((operative) => ({ id: operative.id, email: operative.email })),
  }
}

/**
 * Manager and admin double bookings: the rulebook's `managerClashGroups` (its `personDayItems` reads each
 * stored id through `resolveBookingPerson`, so a booking under a folded same-email id, a sign-in uid with
 * no catalogue row, or a former invite id is theirs). Rows, labels and timelines stay here.
 */
export function computeManagerBookingClashWarnings(
  managerSiteBookings: ManagerSiteBooking[],
  users: User[],
  projects: Project[],
  options?: {
    operativeBookings?: Booking[]
    operatives?: Operative[]
    payrollPolicy?: OrgPayrollTimePolicy
    /** Folded same-email `users` id → the id the roster kept. */
    userIdAliases?: Readonly<Record<string, string>> | null
  }
): ManagerBookingClashWarning[] {
  const usersById = new Map(users.map((u) => [u.id, u]))
  const projectsById = new Map(projects.map((p) => [p.id, p]))
  const projectTitles = new Map(projects.map((p) => [p.id, projectLabel(p)]))
  const payrollPolicy = options?.payrollPolicy ?? DEFAULT_PAYROLL_POLICY
  const operativeBookings = options?.operativeBookings || []

  const groups = managerClashGroups({
    managerIds: users.filter(isManagerOrAdminUser).map((user) => user.id),
    people: bookingPeopleForRoster(users, options?.operatives || [], options?.userIdAliases),
    day: payrollPolicy,
    managerBookings: managerSiteBookings.map((booking) => ({
      id: booking.id,
      userId: booking.userId,
      dayKey: dayKey(booking.date),
      timeSlot: String(booking.timeSlot ?? ''),
      workStartTime: clockText(booking.workStartTime),
      workEndTime: clockText(booking.workEndTime),
    })),
    operativeBookings: operativeBookings.map((booking) => ({
      id: booking.id,
      operativeId: booking.operativeId,
      dayKey: dayKey(booking.date),
      timeSlot: String(booking.timeSlot ?? ''),
      workStartTime: clockText(booking.workStartTime),
      workEndTime: clockText(booking.workEndTime),
      status: String(booking.status ?? ''),
    })),
  })

  return groups
    .map((group) => {
      const rows = group.items.map((item) => {
        if (item.kind === 'manager') {
          const booking = managerSiteBookings[item.index]
          const locationLabel = managerSiteBookingDisplayTitle(booking, projectTitles)
          const project = booking.locationId ? projectsById.get(booking.locationId) : undefined
          return {
            date: booking.date,
            locationLabel,
            entry: clashEntryFromManagerBooking(booking, project, locationLabel, payrollPolicy),
          }
        }
        const booking = operativeBookings[item.index]
        const project = projectsById.get(booking.projectId)
        return {
          date: booking.date,
          locationLabel: projectLabel(project),
          entry: clashEntryFromOperativeBooking(booking, project, payrollPolicy),
        }
      })
      const name = personName(group.userId, usersById)
      const place = rows.length === 2 ? 'two' : String(rows.length)
      const day = londonMidnight(rows[0].date)
      return {
        id: group.pairKey,
        resolutionKey: group.resolutionKey,
        userId: group.userId,
        personName: name,
        date: day,
        bookingAId: group.bookingAId,
        bookingBId: group.bookingBId,
        locationALabel: rows[0].locationLabel,
        locationBLabel: rows[1].locationLabel,
        message: `${name} is booked in ${place} places on ${format(day, 'd MMM yyyy')}. Approve if it's intentional and it'll be noted on the weekly report.`,
        entries: rows.map((row) => row.entry),
      }
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
}
