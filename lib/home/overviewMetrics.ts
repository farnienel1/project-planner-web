/**
 * iOS parity source: Views/HomeOverviewCustomization.swift, Views/HomeView.swift HomeOverviewMetrics
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §3.4, §6.18
 */

import type { Booking, HolidayBooking, Manager, Operative, ProjectTask, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { isSameLondonDay, londonMidnight, addLondonDays } from '@/lib/ios-parity/londonTime'
import { isActiveBookingStatus } from '@/lib/ios-parity/enums'
import { isTaskAssignedToUser } from '@/lib/access/workAccess'

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

export function computeHomeOverviewMetrics(params: {
  tasks: ProjectTask[]
  userEmail?: string | null
  isOperativeMode: boolean
  operatives: Operative[]
  managers: Manager[]
  bookings: Booking[]
  managerBookings: ManagerSiteBooking[]
  holidays: HolidayBooking[]
  organizationUsers: User[]
  liveProjectCount: number
  now?: Date
}): HomeOverviewMetrics {
  const now = params.now ?? new Date()
  const today = londonMidnight(now)
  const weekEnd = addLondonDays(today, 7)

  let tasksDueToday = 0
  let tasksDueThisWeek = 0
  let tasksOverdue = 0
  let outstandingTasksAllUsers = 0

  for (const task of params.tasks) {
    if (task.status === 'Completed') continue
    outstandingTasksAllUsers += 1
    if (!task.dueDate) continue
    const assigned = isTaskAssignedToUser({
      task,
      userEmail: params.userEmail,
      operatives: params.operatives,
      managers: params.managers,
      isOperativeMode: params.isOperativeMode,
    })
    if (!assigned) continue
    const d0 = londonMidnight(task.dueDate)
    if (isSameLondonDay(task.dueDate, today)) tasksDueToday += 1
    if (d0.getTime() >= today.getTime() && d0.getTime() < weekEnd.getTime()) {
      tasksDueThisWeek += 1
    }
    if (d0.getTime() < today.getTime()) tasksOverdue += 1
  }

  const operativeIds = new Set(
    params.bookings
      .filter((b) => isSameLondonDay(b.date, today) && isActiveBookingStatus(b.status))
      .map((b) => b.operativeId)
  )
  const managerIds = new Set(
    params.managerBookings
      .filter(
        (b) =>
          isSameLondonDay(b.date, today) &&
          (b.locationType === 'project' || b.locationType === 'small_work')
      )
      .map((b) => b.userId)
  )

  const approvedHolidays = params.holidays.filter((holiday) => {
    if (holiday.status !== 'approved') return false
    const start = londonMidnight(holiday.startDate)
    const end = londonMidnight(holiday.endDate)
    return today.getTime() >= start.getTime() && today.getTime() <= end.getTime()
  })

  const operativeALKeys = new Set<string>()
  const managerALSeen = new Set<string>()
  for (const h of approvedHolidays) {
    if (h.operativeId) operativeALKeys.add(`op:${h.operativeId}`)
    const uid = h.userId?.trim()
    if (!uid) continue
    const u = params.organizationUsers.find((user) => user.id === uid)
    if (!u) continue
    if (u.permissions.operativeMode) {
      operativeALKeys.add(`u:${uid}`)
    }
    if (
      !u.permissions.operativeMode &&
      !u.isSuperAdmin &&
      !u.permissions.adminAccess &&
      u.permissions.manager &&
      u.isActive
    ) {
      managerALSeen.add(uid)
    }
  }

  return {
    liveProjectCount: params.liveProjectCount,
    tasksDueToday,
    tasksDueThisWeek,
    tasksOverdue,
    outstandingTasksAllUsers,
    operativesOnSiteToday: operativeIds.size,
    managersOnSiteToday: managerIds.size,
    peopleOnSiteToday: operativeIds.size + managerIds.size,
    operativesOnALToday: operativeALKeys.size,
    managersOnALToday: managerALSeen.size,
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
