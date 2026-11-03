/**
 * iOS parity source: Views/HomeOverviewCustomization.swift, Views/HomeView.swift HomeOverviewMetrics
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §3.4, §6.18
 */

import type { Booking, HolidayBooking, Manager, Operative, ProjectTask, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { homeOverviewMetrics } from '@/lib/canonical'
import { holidayBookingDayKeys } from '@/lib/annualLeave/holidayDayKeys'

export const HOME_OVERVIEW_METRIC_IDS = [
  'tasksDueTodayPersonal',
  'tasksDueWeekPersonal',
  'warnings',
  'operativesOnSite',
  'managersOnSite',
  'operativesOnAL',
  'managersOnAL',
  'outstandingTasksAllUsers',
] as const

export type HomeOverviewMetricID = (typeof HOME_OVERVIEW_METRIC_IDS)[number]

export const HOME_OVERVIEW_CATALOG_TITLES: Record<HomeOverviewMetricID, string> = {
  tasksDueTodayPersonal: 'Tasks Due Today (My Tasks)',
  tasksDueWeekPersonal: 'Tasks Due This Week (My Tasks)',
  warnings: 'Warnings',
  operativesOnSite: 'People on Site (Operatives + Managers)',
  managersOnSite: 'Managers on Site',
  operativesOnAL: 'Operatives on AL',
  managersOnAL: 'Managers on AL',
  outstandingTasksAllUsers: 'Open Tasks (All Users)',
}

export const HOME_OVERVIEW_PILL_TITLES: Record<HomeOverviewMetricID, string> = {
  tasksDueTodayPersonal: 'Tasks Due Today',
  tasksDueWeekPersonal: 'Tasks Due This Week',
  warnings: 'Warnings',
  operativesOnSite: 'People on Site',
  managersOnSite: 'Managers on Site',
  operativesOnAL: 'Operatives on AL',
  managersOnAL: 'Managers on AL',
  outstandingTasksAllUsers: 'Open Tasks (All Users)',
}

export const DEFAULT_ADMIN_OVERVIEW_METRICS: HomeOverviewMetricID[] = [
  'tasksDueTodayPersonal',
  'tasksDueWeekPersonal',
  'warnings',
]

export function homeOverviewMetricsStorageKey(uid: string): string {
  return `homeOverviewMetrics.v1.${uid}`
}

export interface HomeOverviewMetrics {
  liveProjectCount: number
  tasksDueToday: number
  tasksDueThisWeek: number
  tasksOverdue: number
  outstandingTasksAllUsers: number
  operativesOnSiteToday: number
  managersOnSiteToday: number
  peopleOnSiteToday: number
  operativesOnALToday: number
  managersOnALToday: number
}

/**
 * Rulebook 1.23.0 §23 `homeOverviewMetrics`: the figures on the organisation-zone day, each person once under all
 * their ids. This only maps the web stores to the rulebook's plain rows.
 */
export function computeHomeOverviewMetrics(params: {
  tasks: ProjectTask[]
  userId?: string | null
  userEmail?: string | null
  operatives: Operative[]
  managers: Manager[]
  bookings: Booking[]
  managerBookings: ManagerSiteBooking[]
  holidays: HolidayBooking[]
  organizationUsers: User[]
  liveProjectCount: number
  timeZone: string
  now?: Date
}): HomeOverviewMetrics {
  const now = params.now ?? new Date()
  const metrics = homeOverviewMetrics({
    nowMs: now.getTime(),
    timeZone: params.timeZone,
    viewer: { id: params.userId ?? null, email: params.userEmail ?? null },
    roster: params.organizationUsers.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      surname: user.surname,
      isActive: user.isActive,
      passwordSet: user.passwordSet,
      role: user.role ?? null,
      isSuperAdmin: user.isSuperAdmin ?? null,
      permissions: (user.permissions ?? null) as unknown as Record<string, unknown> | null,
      formerUserIds: user.formerUserIds ?? [],
    })),
    operatives: params.operatives.map((row) => ({ id: row.id, email: row.email ?? null, isActive: row.isActive ?? null })),
    managers: params.managers.map((row) => ({ id: row.id, email: row.email ?? null })),
    tasks: params.tasks.map((task) => ({
      status: task.status,
      dueDate: task.dueDate ?? null,
      assignedOperativeId: task.assignedOperativeId ?? null,
      assignedOperativeIds: task.assignedOperativeIds ?? [],
      assignedManagerId: task.assignedManagerId ?? null,
      assignedManagerIds: task.assignedManagerIds ?? [],
    })),
    bookings: params.bookings.map((booking) => ({
      operativeId: booking.operativeId,
      date: booking.date,
      status: String(booking.status ?? ''),
    })),
    managerSiteBookings: params.managerBookings.map((booking) => ({
      userId: booking.userId,
      date: booking.date,
      locationType: booking.locationType,
    })),
    holidays: params.holidays.map((holiday) => {
      const { startDayKey, endDayKey } = holidayBookingDayKeys(holiday, params.timeZone)
      return { userId: holiday.userId ?? null, operativeId: holiday.operativeId ?? null, startDayKey, endDayKey, status: holiday.status }
    }),
  })
  return {
    liveProjectCount: params.liveProjectCount,
    tasksDueToday: metrics.tasksDueToday,
    tasksDueThisWeek: metrics.tasksDueThisWeek,
    tasksOverdue: metrics.tasksOverdue,
    outstandingTasksAllUsers: metrics.outstandingTasksAllUsers,
    operativesOnSiteToday: metrics.operativesOnSiteToday,
    managersOnSiteToday: metrics.managersOnSiteToday,
    peopleOnSiteToday: metrics.peopleOnSiteToday,
    operativesOnALToday: metrics.operativesOnALToday,
    managersOnALToday: metrics.managersOnALToday,
  }
}

export function metricValue(
  id: HomeOverviewMetricID,
  metrics: HomeOverviewMetrics,
  warningCount: number
): number {
  switch (id) {
    case 'tasksDueTodayPersonal':
      return metrics.tasksDueToday
    case 'tasksDueWeekPersonal':
      return metrics.tasksDueThisWeek
    case 'warnings':
      return warningCount
    case 'operativesOnSite':
      return metrics.peopleOnSiteToday
    case 'managersOnSite':
      return metrics.managersOnSiteToday
    case 'operativesOnAL':
      return metrics.operativesOnALToday
    case 'managersOnAL':
      return metrics.managersOnALToday
    case 'outstandingTasksAllUsers':
      return metrics.outstandingTasksAllUsers
  }
}

export function loadSavedOverviewMetrics(uid: string): HomeOverviewMetricID[] {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_OVERVIEW_METRICS
  try {
    const raw = window.localStorage.getItem(homeOverviewMetricsStorageKey(uid))
    if (!raw) return DEFAULT_ADMIN_OVERVIEW_METRICS
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return DEFAULT_ADMIN_OVERVIEW_METRICS
    const ids = parsed.filter((id): id is HomeOverviewMetricID =>
      (HOME_OVERVIEW_METRIC_IDS as readonly string[]).includes(id)
    )
    return ids.slice(0, 3).length ? ids.slice(0, 3) : DEFAULT_ADMIN_OVERVIEW_METRICS
  } catch {
    return DEFAULT_ADMIN_OVERVIEW_METRICS
  }
}

export function saveOverviewMetrics(uid: string, ids: HomeOverviewMetricID[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(homeOverviewMetricsStorageKey(uid), JSON.stringify(ids.slice(0, 3)))
}
