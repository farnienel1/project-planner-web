import {
  accountKindFromFlags,
  notificationDestination,
  type AccountKind,
  type NotificationDestination,
} from '@/lib/canonical'
import { dayKey } from '@/lib/ios-parity/londonTime'
import { timesheetsMineHref, timesheetsTeamHref } from '@/lib/timesheets/timesheetRoutes'
import type { AppInboxNotification } from '@/lib/ios-parity/converters'
import type { User } from '@/types'

const TIMESHEET_DESTINATION_KINDS = new Set([
  'timesheetMine',
  'timesheetTeamAwaiting',
  'timesheetTeamSigned',
])

export function accountKindForNotifications(user: User | null | undefined): AccountKind {
  if (!user) return 'manager'
  return accountKindFromFlags({
    isSuperAdmin: user.isSuperAdmin,
    role: user.role,
    adminAccess: user.permissions?.adminAccess,
    manager: user.permissions?.manager,
    operativeMode: user.permissions?.operativeMode,
  })
}

export function destinationFromInboxRow(
  row: Pick<AppInboxNotification, 'type' | 'relatedId' | 'deepLinkUserId' | 'deepLinkWeekStart'> & {
    dayKey?: string
    catalogue?: string
  },
  role: AccountKind,
  timeZone?: string
): NotificationDestination {
  const fromWeek = row.deepLinkWeekStart ? dayKey(row.deepLinkWeekStart, timeZone) : undefined
  return notificationDestination({
    type: row.type,
    relatedId: row.relatedId,
    dayKey: row.dayKey || fromWeek,
    catalogue: row.catalogue,
    role,
    deepLinkUserId: row.deepLinkUserId,
  })
}

/** Web path for a canonical destination kind. iOS maps the same kinds in Swift. */
export function hrefForNotificationDestination(dest: NotificationDestination): string {
  const id = dest.relatedId ? encodeURIComponent(dest.relatedId) : ''
  const date = dest.dayKey ? `?date=${encodeURIComponent(dest.dayKey)}` : ''
  switch (dest.kind) {
    case 'dailyOverviewDay':
      return dest.dayKey
        ? `/dashboard/daily-overview?date=${encodeURIComponent(dest.dayKey)}`
        : '/dashboard/daily-overview'
    case 'projectScheduling':
      return id ? `/dashboard/projects/${id}/schedule${date}` : '/dashboard/projects'
    case 'smallWorksScheduling':
      return id ? `/dashboard/small-works/${id}/schedule${date}` : '/dashboard/small-works'
    case 'mySchedule':
      return dest.dayKey ? `/dashboard/my-schedule?date=${encodeURIComponent(dest.dayKey)}` : '/dashboard/my-schedule'
    case 'annualLeave':
      return '/dashboard/annual-leave'
    case 'annualLeavePending':
      return '/dashboard/annual-leave?tab=team'
    // Rulebook 1.40.0: one person's annual leave page (`annual_leave_adjusted`).
    case 'annualLeavePerson':
      return dest.userId || dest.relatedId
        ? `/dashboard/annual-leave?tab=team&person=${encodeURIComponent(dest.userId || dest.relatedId || '')}`
        : '/dashboard/annual-leave?tab=team'
    case 'projectDetail':
      return id ? `/dashboard/projects/${id}` : '/dashboard/projects'
    case 'projectsList':
      return '/dashboard/projects'
    case 'smallWorksDetail':
      return id ? `/dashboard/small-works/${id}` : '/dashboard/small-works'
    case 'smallWorksList':
      return '/dashboard/small-works'
    case 'warnings':
      return '/dashboard/warnings'
    case 'materialOrders':
      return '/dashboard/wholesalers'
    // Rulebook 1.79.0: the job's Materials (relatedId the job id).
    case 'jobMaterials':
      return jobSectionHref(dest, 'materials')
    case 'clients':
      return id ? `/dashboard/clients/${id}` : '/dashboard/clients'
    case 'manageUsers':
      return '/dashboard/settings/users'
    case 'userEdit':
      return id ? `/dashboard/users/${id}/edit` : '/dashboard/settings/users'
    case 'tasks':
      return '/dashboard/tasks'
    // Rulebook 1.79.0: a toolbox talk notice opens the job's Health & safety (relatedId the job id).
    case 'healthSafety':
      return jobSectionHref(dest, 'health-safety')
    // 1.79.0: a variation notice opens that variation. Its job is read from the variation the Variations page already
    // loads (`?open=`), which then moves to the job's Variations with that variation open.
    case 'variationDetail':
      return id ? `/dashboard/variations?open=${id}` : '/dashboard/variations'
    // A job's variations (renumbered): that job's Variations page.
    case 'variations':
      return id ? jobSectionHref(dest, 'variations') : '/dashboard/variations'
    case 'timesheetMine':
      return timesheetsMineHref(dest.dayKey || null)
    case 'timesheetTeamAwaiting':
      return timesheetsTeamHref({ tab: 'awaiting', user: dest.userId || null, period: dest.dayKey || null })
    case 'timesheetTeamSigned':
      return timesheetsTeamHref({ tab: 'signed', user: dest.userId || null, period: dest.dayKey || null })
    case 'qualifications':
      return '/dashboard/qualifications'
    case 'home':
      return '/dashboard'
    // Rulebook 1.29.0 §25: the person's own Overtime page; Users' → that person → Overtime. 1.33.0: with the request
    // (`request`) and its first day (`at`) the screen opens that payrun (`overtimeNotificationRange`).
    case 'overtimeMine':
      return `/dashboard/timesheets/overtime?scope=mine&section=overtime${overtimeTarget(dest)}`
    case 'overtimeUser':
      return dest.userId
        ? `/dashboard/timesheets/overtime?scope=users&user=${encodeURIComponent(dest.userId)}&section=overtime${overtimeTarget(dest)}`
        : '/dashboard/timesheets/overtime?scope=users'
    case 'notifications':
    default:
      return '/dashboard/notifications'
  }
}

export function inboxNotificationHref(
  row: Pick<AppInboxNotification, 'type' | 'relatedId' | 'deepLinkUserId' | 'deepLinkWeekStart'> & {
    dayKey?: string
    catalogue?: string
  },
  user: User | null | undefined,
  timeZone?: string
): string {
  return hrefForNotificationDestination(destinationFromInboxRow(row, accountKindForNotifications(user), timeZone))
}

export function isTimesheetDestinationKind(kind: NotificationDestination['kind']): boolean {
  return TIMESHEET_DESTINATION_KINDS.has(kind)
}

/** Where a job section page lives on web, by the job's collection. */
export const NOTIFICATION_JOB_SECTIONS = ['health-safety', 'materials', 'variations'] as const
export type NotificationJobSection = (typeof NOTIFICATION_JOB_SECTIONS)[number]

export function jobSectionPath(collection: 'projects' | 'smallWorks', jobId: string, section: NotificationJobSection): string {
  const base = collection === 'smallWorks' ? '/dashboard/small-works' : '/dashboard/projects'
  return `${base}/${encodeURIComponent(jobId)}/${section}`
}

/**
 * Rulebook 1.79.0: a destination naming a job section. With the row's `catalogue` the job's page directly; without it
 * (older rows) `/dashboard/notifications/open`, which looks the job up in the jobs the app loads and moves there.
 */
function jobSectionHref(dest: NotificationDestination, section: NotificationJobSection): string {
  const jobId = dest.relatedId?.trim()
  if (!jobId) return section === 'materials' ? '/dashboard/wholesalers' : '/dashboard/projects'
  if (dest.catalogue === 'projects' || dest.catalogue === 'smallWorks') return jobSectionPath(dest.catalogue, jobId, section)
  return `/dashboard/notifications/open?job=${encodeURIComponent(jobId)}&section=${section}`
}

/** Rulebook 1.33.0 §25: `&request=…&at=…` for an overtime notice (the screen resolves the payrun). */
function overtimeTarget(dest: { relatedId?: string; dayKey?: string }): string {
  const parts: string[] = []
  if (dest.relatedId) parts.push(`request=${encodeURIComponent(dest.relatedId)}`)
  if (dest.dayKey) parts.push(`at=${encodeURIComponent(dest.dayKey)}`)
  return parts.length > 0 ? `&${parts.join('&')}` : ''
}
