/**
 * iOS parity source: Views/HomeQuickActionRegistry.swift
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §6.18
 */

import type { User } from '@/types'
import {
  canAccessQualificationsHub,
  canAccessTimesheetsSurface,
  canAccessWholesalers,
  canManageMaterialCatalogue,
  canManageSubcontractors,
  canManageUsers,
  canManageWorkCatalogue,
  canViewDailyOverview,
  canViewManagers,
  canViewOperatives,
  canViewProjects,
  canViewSiteAudit,
  canViewWeeklyReports,
  hasAdminAccess,
  isActingManagerOperativeManagementOnly,
  isAnnualLeaveFeatureEnabled,
  isOperativeMode,
} from '@/lib/permissions'
import { getNavigationLabel } from '@/lib/navigation/sharedUiLabels'

export const BARRED_FROM_HOME = new Set([
  'account-reset-password',
  'account-sign-out',
  'staff-holiday',
  'staff-skills',
])

export type QuickActionChip = 'blue' | 'green' | 'amber' | 'purple' | 'rose' | 'coral' | 'grey'

export interface HomeQuickActionMeta {
  id: string
  title: string
  href: string
  chip: QuickActionChip
  icon: string
}

type NavSettings = Record<string, unknown> | undefined

function label(settings: NavSettings, key: string, fallback: string): string {
  return getNavigationLabel(settings, key, fallback.replace(/\n/g, ' '))
}

export function quickActionMeta(id: string, settings?: NavSettings): HomeQuickActionMeta | null {
  const map: Record<string, Omit<HomeQuickActionMeta, 'id'>> = {
    'op-projects': { title: label(settings, 'dashboard_projects', 'Projects'), href: '/dashboard/projects', chip: 'green', icon: 'folder' },
    'op-small': { title: label(settings, 'dashboard_small_works', 'Small\nworks'), href: '/dashboard/small-works', chip: 'amber', icon: 'hammer' },
    'op-leave': { title: 'Annual\nleave', href: '/dashboard/annual-leave', chip: 'coral', icon: 'sun' },
    'op-audit': { title: label(settings, 'site_audit', 'Site\naudit'), href: '/dashboard/site-audit', chip: 'blue', icon: 'scan' },
    'op-schedule': { title: label(settings, 'dashboard_schedule', 'My\nSchedule'), href: '/dashboard/my-schedule', chip: 'rose', icon: 'calendar' },
    'op-settings': { title: label(settings, 'dashboard_settings', 'Settings'), href: '/dashboard/settings', chip: 'grey', icon: 'cog' },
    'staff-weekly': { title: 'Weekly\nreport', href: '/dashboard/weekly-report', chip: 'blue', icon: 'chart' },
    'staff-daily': { title: 'Daily\noverview', href: '/dashboard/daily-overview', chip: 'purple', icon: 'clock-cal' },
    'staff-projects': { title: label(settings, 'dashboard_projects', 'Projects'), href: '/dashboard/projects', chip: 'green', icon: 'folder' },
    'staff-small': { title: label(settings, 'dashboard_small_works', 'Small\nworks'), href: '/dashboard/small-works', chip: 'amber', icon: 'hammer' },
    'staff-leave': { title: 'Annual\nleave', href: '/dashboard/annual-leave', chip: 'coral', icon: 'sun' },
    'staff-schedule': { title: label(settings, 'dashboard_schedule', 'My\nSchedule'), href: '/dashboard/my-schedule', chip: 'rose', icon: 'calendar' },
    'staff-audit': { title: label(settings, 'site_audit', 'Site\naudit'), href: '/dashboard/site-audit', chip: 'blue', icon: 'scan' },
    'staff-managers': { title: label(settings, 'dashboard_managers', 'Managers'), href: '/dashboard/managers', chip: 'purple', icon: 'shield' },
    'staff-operatives': { title: label(settings, 'dashboard_operatives', 'Operatives'), href: '/dashboard/operatives', chip: 'green', icon: 'users' },
    'staff-subs': { title: 'Sub\ncontractors', href: '/dashboard/sub-contractors', chip: 'grey', icon: 'handshake' },
    'staff-map': { title: 'Site\nmap', href: '/dashboard/site-map', chip: 'green', icon: 'map' },
    'staff-settings': { title: label(settings, 'dashboard_settings', 'Settings'), href: '/dashboard/settings', chip: 'grey', icon: 'cog' },
    'staff-clients': { title: 'Clients', href: '/dashboard/clients', chip: 'blue', icon: 'briefcase' },
    'staff-create-project': { title: 'Create\nproject', href: '/dashboard/projects/new', chip: 'green', icon: 'plus-square' },
    'staff-create-small': { title: 'Create\nsmall works', href: '/dashboard/small-works/new', chip: 'amber', icon: 'hammer' },
    'staff-qualifications': { title: 'Qualifi-\ncations', href: '/dashboard/qualifications', chip: 'blue', icon: 'grad' },
    'staff-my-qualifications': { title: 'My\nqualifications', href: '/dashboard/my-qualifications', chip: 'blue', icon: 'grad' },
    'staff-job-types': { title: 'Job\ntypes', href: '/dashboard/job-types', chip: 'green', icon: 'grid' },
    'staff-wholesalers': { title: 'Whole-\nsalers', href: '/dashboard/wholesalers', chip: 'grey', icon: 'building' },
    'staff-material-catalogue': { title: 'Material\ncatalogue', href: '/dashboard/materials', chip: 'blue', icon: 'box' },
    'staff-add-user': { title: 'Add\nuser', href: '/dashboard/settings/users/new', chip: 'purple', icon: 'user-plus' },
    'staff-manage-users': { title: 'Manage\nusers', href: '/dashboard/settings/users', chip: 'blue', icon: 'users' },
    'staff-help': { title: 'Help', href: '/dashboard/help', chip: 'grey', icon: 'help' },
    'staff-general-app': { title: 'General\napp', href: '/dashboard/settings', chip: 'purple', icon: 'sliders' },
    'staff-tasks': { title: 'Tasks', href: '/dashboard/tasks', chip: 'blue', icon: 'tasks' },
    'staff-invoicing': { title: 'Timesheets', href: '/dashboard/timesheets', chip: 'blue', icon: 'doc' },
  }
  const row = map[id]
  if (!row) return null
  return { id, ...row }
}

export function isQuickActionEligible(id: string, user: User, profileLoading = false): boolean {
  if (BARRED_FROM_HOME.has(id)) return false
  if (!quickActionMeta(id)) return false
  const op = isOperativeMode(user)

  switch (id) {
    case 'op-projects':
    case 'op-small':
    case 'op-schedule':
    case 'op-settings':
      return op
    case 'op-leave':
      return op && isAnnualLeaveFeatureEnabled(user)
    case 'op-audit':
      return op && (canViewSiteAudit(user, profileLoading) || profileLoading)
    case 'staff-weekly':
      return !op && canViewWeeklyReports(user, profileLoading)
    case 'staff-daily':
      return !op && canViewDailyOverview(user, profileLoading)
    case 'staff-projects':
    case 'staff-small':
      return !op && canViewProjects(user)
    case 'staff-leave':
      return !op && isAnnualLeaveFeatureEnabled(user) && (hasAdminAccess(user) || user.permissions.manager || profileLoading)
    case 'staff-schedule':
      return !op && canViewProjects(user)
    case 'staff-audit':
      return !op && (canViewSiteAudit(user, profileLoading) || profileLoading)
    case 'staff-managers':
      return !op && hasAdminAccess(user)
    case 'staff-operatives':
      return !op && canViewOperatives(user)
    case 'staff-subs':
      return !op && (canManageSubcontractors(user, profileLoading) || profileLoading)
    case 'staff-map':
      return !op && hasAdminAccess(user)
    case 'staff-settings':
      return !op
    case 'staff-clients':
      return !op
    case 'staff-create-project':
      return !op && canManageWorkCatalogue(user, 'projects')
    case 'staff-create-small':
      return !op && canManageWorkCatalogue(user, 'smallWorks')
    case 'staff-skills':
      return false
    case 'staff-qualifications':
      return !op && canAccessQualificationsHub(user)
    case 'staff-my-qualifications':
      return op
    case 'staff-job-types':
      return !op && hasAdminAccess(user)
    case 'staff-wholesalers':
      return canAccessWholesalers(user)
    case 'staff-material-catalogue':
      return canManageMaterialCatalogue(user)
    case 'staff-add-user':
    case 'staff-manage-users':
      return !op && (canManageUsers(user) || isActingManagerOperativeManagementOnly(user))
    case 'staff-help':
      return !op
    case 'staff-holiday':
      return isAnnualLeaveFeatureEnabled(user)
    case 'staff-general-app':
      return !op && hasAdminAccess(user)
    case 'staff-tasks':
      return !op
    case 'staff-invoicing':
      return canAccessTimesheetsSurface(user, profileLoading)
    default:
      return false
  }
}

export function defaultOrderedQuickActionIds(user: User, profileLoading = false): string[] {
  const eligible = (id: string) => isQuickActionEligible(id, user, profileLoading)
  if (isOperativeMode(user)) {
    const a = ['op-projects', 'op-small', 'op-leave']
    if (eligible('op-audit')) a.push('op-audit')
    if (eligible('staff-invoicing')) a.push('staff-invoicing')
    a.push('op-schedule', 'op-settings')
    return a.filter(eligible)
  }
  const items: string[] = []
  for (const id of [
    'staff-weekly',
    'staff-daily',
    'staff-tasks',
    'staff-projects',
    'staff-small',
    'staff-leave',
    'staff-schedule',
    'staff-audit',
    'staff-managers',
    'staff-operatives',
    'staff-subs',
    'staff-map',
    'staff-settings',
    'staff-invoicing',
  ]) {
    if (eligible(id)) items.push(id)
  }
  return items
}

export function allEligibleQuickActionIds(user: User, profileLoading = false): string[] {
  const ids = [
    'op-projects', 'op-small', 'op-leave', 'op-audit', 'op-schedule', 'op-settings',
    'staff-weekly', 'staff-daily', 'staff-projects', 'staff-small', 'staff-leave', 'staff-schedule',
    'staff-audit', 'staff-managers', 'staff-operatives', 'staff-subs', 'staff-map', 'staff-settings',
    'staff-clients', 'staff-create-project', 'staff-create-small', 'staff-qualifications',
    'staff-my-qualifications', 'staff-job-types', 'staff-wholesalers', 'staff-material-catalogue',
    'staff-add-user', 'staff-manage-users', 'staff-help', 'staff-general-app', 'staff-tasks', 'staff-invoicing',
  ]
  return ids.filter((id) => isQuickActionEligible(id, user, profileLoading)).sort()
}

export function quickActionOrderStorageKey(uid: string): string {
  return `homeQuickActionOrder.${uid}`
}

export function quickActionHintStorageKey(uid: string): string {
  return `homeQuickActionCustomizeHint.${uid}`
}

export function loadSavedQuickActionOrder(uid: string, user: User): string[] {
  const fallback = defaultOrderedQuickActionIds(user)
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(quickActionOrderStorageKey(uid))
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return fallback
    const eligible = parsed.filter((id): id is string => typeof id === 'string' && isQuickActionEligible(id, user))
    return eligible.length ? eligible : fallback
  } catch {
    return fallback
  }
}

export function saveQuickActionOrder(uid: string, ids: string[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(quickActionOrderStorageKey(uid), JSON.stringify(ids))
}
