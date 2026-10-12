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
    case 'clients':
      return id ? `/dashboard/clients/${id}` : '/dashboard/clients'
    case 'manageUsers':
      return '/dashboard/settings/users'
    case 'userEdit':
      return id ? `/dashboard/users/${id}/edit` : '/dashboard/settings/users'
    case 'tasks':
      return '/dashboard/tasks'
    case 'healthSafety':
      return '/dashboard'
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
