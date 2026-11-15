/**
 * Home "Up next": which bookings, in which order, on which day is the rulebook's `homeUpNextRows` (1.53.0, §23) —
 * every id the viewer goes by, organisation-zone days, today's bookings kept all day, Completed kept. This file only
 * adds the titles (job, place, booker) and the day headings.
 */

import type { Booking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { managerSiteBookingDisplayTitle } from '@/lib/scheduling/managerSiteBookingUtils'
import { dayHeadingWithOrdinal } from '@/lib/ios-parity/londonTime'
import { dateFromDayKeyInZone } from '@/lib/orgTime/zoneTime'
import {
  bookingJobLabel,
  homeUpNextRows,
  rosterAliasIdsFor,
  type PayrollTimePolicyState,
} from '@/lib/canonical'

export interface HomeUpNextRow {
  id: string
  title: string
  subtitle: string
  dayKey: string
  accent: 'blue' | 'purple'
}

export interface HomeUpNextDaySection {
  id: string
  heading: string
  rows: HomeUpNextRow[]
}

function displayName(userId: string, users: User[]): string {
  const u = users.find((user) => user.id === userId)
  if (!u) return ''
  const full = `${u.firstName} ${u.surname}`.trim()
  if (full) return full
  return u.email.split('@')[0] || ''
}

export function upcomingDaySections(params: {
  minDistinctDays?: number
  mergeRowLimit?: number
  now: Date
  timeZone: string
  viewer: Pick<User, 'id' | 'email' | 'formerUserIds'> | null | undefined
  /** Folded same-email `users` id → the id the roster kept. */
  userIdAliases?: Readonly<Record<string, string>> | null
  operatives: Operative[]
  bookings: Booking[]
  managerBookings: ManagerSiteBooking[]
  allProjects: Project[]
  organizationUsers: User[]
  /** The organisation's working-hours state (each booking's own day is read under the rules in effect then). */
  policyState?: PayrollTimePolicyState | null
}): HomeUpNextDaySection[] {
  const viewer = params.viewer
  if (!viewer?.id) return []
  const result = homeUpNextRows({
    nowMs: params.now.getTime(),
    timeZone: params.timeZone,
    viewer: {
      id: viewer.id,
      email: viewer.email,
      formerUserIds: viewer.formerUserIds ?? [],
      sameEmailUserIds: rosterAliasIdsFor(viewer.id, params.userIdAliases ?? null),
    },
    roster: params.organizationUsers.map((user) => ({
      id: user.id,
      email: user.email,
      formerUserIds: user.formerUserIds ?? [],
    })),
    operatives: params.operatives.map((operative) => ({ id: operative.id, email: operative.email })),
    bookings: params.bookings.map((booking) => ({
      id: booking.id,
      personId: booking.operativeId,
      date: booking.date,
      status: booking.status,
      timeSlot: booking.timeSlot,
      workStartTime: booking.workStartTime,
      workEndTime: booking.workEndTime,
    })),
    managerSiteBookings: params.managerBookings.map((booking) => ({
      id: booking.id,
      personId: booking.userId,
      date: booking.date,
      timeSlot: booking.timeSlot,
      workStartTime: booking.workStartTime,
      workEndTime: booking.workEndTime,
    })),
    policy: params.policyState ?? null,
    limit: params.mergeRowLimit ?? 48,
    minDistinctDays: params.minDistinctDays ?? 2,
  })
  const labourById = new Map(params.bookings.map((booking) => [booking.id, booking]))
  const managerById = new Map(params.managerBookings.map((booking) => [booking.id, booking]))
  const projectsById = new Map(params.allProjects.map((project) => [project.id, project]))
  const siteNames = new Map(params.allProjects.map((project) => [project.id, project.siteName]))
  return result.days.map((day) => ({
    id: day.dayKey,
    heading: dayHeadingWithOrdinal(dateFromDayKeyInZone(day.dayKey, params.timeZone), params.timeZone),
    rows: day.rows.map((row): HomeUpNextRow => {
      if (row.kind === 'manager') {
        const booking = managerById.get(row.id)!
        return {
          id: row.id,
          title: managerSiteBookingDisplayTitle(booking, siteNames),
          subtitle: `${row.startText} · ${row.timeRange || String(booking.timeSlot)}`,
          dayKey: row.dayKey,
          accent: 'purple',
        }
      }
      const booking = labourById.get(row.id)!
      const project = projectsById.get(booking.projectId)
      const booker = displayName(booking.bookedBy, params.organizationUsers)
      const subtitle = [row.startText, project?.jobNumber, booker].filter(Boolean).join(' · ')
      return {
        id: row.id,
        title: bookingJobLabel(project ? project.siteName || 'Scheduled work' : null),
        subtitle,
        dayKey: row.dayKey,
        accent: 'blue',
      }
    }),
  }))
}
