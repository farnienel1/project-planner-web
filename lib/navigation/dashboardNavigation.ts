import type { Organization, User } from '@/types'
import { getNavigationLabel } from '@/lib/navigation/sharedUiLabels'
import {
  canAccessTeamSection,
  canAccessTimesheets,
  canAccessWholesalers,
  canManageJobTypes,
  canManageMaterialCatalogue,
  canManageQualifications,
  canManageSkills,
  canManageSubcontractors,
  canManageUsers,
  canManageOperativesOnly,
  canViewClients,
  canViewHelp,
  canViewManagers,
  canViewMyQualifications,
  canViewOperatives,
  canViewProjects,
  canViewDailyOverview,
  canViewMySchedule,
  canViewSchedule,
  canViewSiteAudit,
  canViewSiteMap,
  getAddUserLabel,
  getManageUsersLabel,
  hasAdminAccess,
  isAnnualLeaveFeatureEnabled,
  isOperativeMode,
} from '@/lib/navigation/menuPermissions'

export type NavSection = 'home' | 'navigate' | 'tools' | 'team' | 'account'

export type DashboardNavItem = {
  id: string
  href: string
  label: string
  subtitle: string
  navigationLabelKey: string
  iconPath: string
  tileClasses: string
  section: NavSection
}

const ALL_NAV_ITEMS: DashboardNavItem[] = [
  {
    id: 'dashboard_home',
    href: '/dashboard',
    label: 'Home',
    subtitle: 'Overview and live metrics',
    navigationLabelKey: 'dashboard_home',
    iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    tileClasses: 'bg-indigo-50 text-indigo-700',
    section: 'home',
  },
  {
    id: 'dashboard_clients',
    href: '/dashboard/clients',
    label: 'Clients',
    subtitle: 'Customer directory',
    navigationLabelKey: 'dashboard_clients',
    iconPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    tileClasses: 'bg-cyan-50 text-cyan-700',
    section: 'navigate',
  },
  {
    id: 'dashboard_projects',
    href: '/dashboard/projects',
    label: 'Projects',
    subtitle: 'Main project pipeline',
    navigationLabelKey: 'dashboard_projects',
    iconPath: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    tileClasses: 'bg-emerald-50 text-emerald-700',
    section: 'navigate',
  },
  {
    id: 'dashboard_small_works',
    href: '/dashboard/small-works',
    label: 'Small works',
    subtitle: 'Reactive and ad-hoc jobs',
    navigationLabelKey: 'dashboard_small_works',
    iconPath: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    tileClasses: 'bg-amber-50 text-amber-700',
    section: 'navigate',
  },
  {
    id: 'dashboard_operatives',
    href: '/dashboard/operatives',
    label: 'Operatives',
    subtitle: 'People and availability',
    navigationLabelKey: 'dashboard_operatives',
    iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    tileClasses: 'bg-violet-50 text-violet-700',
    section: 'navigate',
  },
  {
    id: 'dashboard_managers',
    href: '/dashboard/managers',
    label: 'Managers',
    subtitle: 'Leadership and ownership',
    navigationLabelKey: 'dashboard_managers',
    iconPath: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    tileClasses: 'bg-fuchsia-50 text-fuchsia-700',
    section: 'navigate',
  },
  {
    id: 'dashboard_daily_overview',
    href: '/dashboard/daily-overview',
    label: 'Daily overview',
    subtitle: 'All bookings across the organisation',
    navigationLabelKey: 'dashboard_daily_overview',
    iconPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    tileClasses: 'bg-sky-50 text-sky-700',
    section: 'navigate',
  },
  {
    id: 'dashboard_schedule',
    href: '/dashboard/my-schedule',
    label: 'My Schedule',
    subtitle: 'Your personal bookings and assignments',
    navigationLabelKey: 'dashboard_schedule',
    iconPath: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    tileClasses: 'bg-blue-50 text-blue-700',
    section: 'navigate',
  },
  {
    id: 'dashboard_warnings',
    href: '/dashboard/warnings',
    label: 'Warnings',
    subtitle: 'Booking clashes and alerts',
    navigationLabelKey: 'dashboard_warnings',
    iconPath: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    tileClasses: 'bg-amber-50 text-amber-700',
    section: 'navigate',
  },
  {
    id: 'dashboard_tasks',
    href: '/dashboard/tasks',
    label: 'Tasks',
    subtitle: 'All tasks and leave approvals',
    navigationLabelKey: 'dashboard_tasks',
    iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    tileClasses: 'bg-indigo-50 text-indigo-700',
    section: 'navigate',
  },
  {
    id: 'dashboard_annual_leave',
    href: '/dashboard/annual-leave',
    label: 'Annual leave',
    subtitle: 'Leave requests and approvals',
    navigationLabelKey: 'dashboard_annual_leave',
    iconPath: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
    tileClasses: 'bg-orange-50 text-orange-700',
    section: 'navigate',
  },
  {
    id: 'dashboard_site_map',
    href: '/dashboard/site-map',
    label: 'Site map',
    subtitle: 'Site locations and plans',
    navigationLabelKey: 'dashboard_site_map',
    iconPath: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
    tileClasses: 'bg-teal-50 text-teal-700',
    section: 'navigate',
  },
  {
    id: 'dashboard_site_audit',
    href: '/dashboard/site-audit',
    label: 'Site audit',
    subtitle: 'Audits and compliance checks',
    navigationLabelKey: 'dashboard_site_audit',
    iconPath: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    tileClasses: 'bg-lime-50 text-lime-700',
    section: 'navigate',
  },
  {
    id: 'dashboard_timesheets',
    href: '/dashboard/timesheets',
    label: 'Timesheets',
    subtitle: 'Hours and submissions',
    navigationLabelKey: 'dashboard_timesheets',
    iconPath: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    tileClasses: 'bg-sky-50 text-sky-700',
    section: 'navigate',
  },
  {
    id: 'dashboard_skills',
    href: '/dashboard/skills',
    label: 'Skills',
    subtitle: 'Trades and skill catalogue',
    navigationLabelKey: 'dashboard_skills',
    iconPath: 'M13 10V3L4 14h7v7l9-11h-7z',
    tileClasses: 'bg-yellow-50 text-yellow-700',
    section: 'tools',
  },
  {
    id: 'dashboard_qualifications',
    href: '/dashboard/qualifications',
    label: 'Qualifications',
    subtitle: 'Certs and expiry tracking',
    navigationLabelKey: 'dashboard_qualifications',
    iconPath: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824 2.998 12.078 12.078 0 01.665-6.479L12 14z',
    tileClasses: 'bg-rose-50 text-rose-700',
    section: 'tools',
  },
  {
    id: 'dashboard_my_qualifications',
    href: '/dashboard/my-qualifications',
    label: 'My qualifications',
    subtitle: 'Your certs and expiry dates',
    navigationLabelKey: 'dashboard_my_qualifications',
    iconPath: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824 2.998 12.078 12.078 0 01.665-6.479L12 14z',
    tileClasses: 'bg-red-50 text-red-700',
    section: 'tools',
  },
  {
    id: 'dashboard_job_types',
    href: '/dashboard/job-types',
    label: 'Job types',
    subtitle: 'Job categories and templates',
    navigationLabelKey: 'dashboard_job_types',
    iconPath: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
    tileClasses: 'bg-pink-50 text-pink-700',
    section: 'tools',
  },
  {
    id: 'dashboard_wholesalers',
    href: '/dashboard/wholesalers',
    label: 'Wholesalers',
    subtitle: 'Supplier contacts',
    navigationLabelKey: 'dashboard_wholesalers',
    iconPath: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
    tileClasses: 'bg-amber-100 text-amber-800',
    section: 'tools',
  },
  {
    id: 'dashboard_materials',
    href: '/dashboard/materials',
    label: 'Material catalogue',
    subtitle: 'Organisation materials library',
    navigationLabelKey: 'dashboard_materials',
    iconPath: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    tileClasses: 'bg-blue-100 text-blue-800',
    section: 'tools',
  },
  {
    id: 'dashboard_sub_contractors',
    href: '/dashboard/sub-contractors',
    label: 'Sub contractors',
    subtitle: 'Subcontractor directory',
    navigationLabelKey: 'dashboard_sub_contractors',
    iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    tileClasses: 'bg-purple-50 text-purple-700',
    section: 'tools',
  },
  {
    id: 'dashboard_add_user',
    href: '/dashboard/settings/users/new',
    label: 'Add user',
    subtitle: 'Invite a new team member',
    navigationLabelKey: 'dashboard_add_user',
    iconPath: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
    tileClasses: 'bg-green-50 text-green-700',
    section: 'team',
  },
  {
    id: 'dashboard_manage_users',
    href: '/dashboard/settings/users',
    label: 'Manage users',
    subtitle: 'Permissions and accounts',
    navigationLabelKey: 'dashboard_manage_users',
    iconPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    tileClasses: 'bg-fuchsia-100 text-fuchsia-800',
    section: 'team',
  },
  {
    id: 'dashboard_change_organisation',
    href: '/dashboard/change-organisation',
    label: 'Change organisation',
    subtitle: 'Switch between your organisations',
    navigationLabelKey: 'dashboard_change_organisation',
    iconPath: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
    tileClasses: 'bg-indigo-100 text-indigo-800',
    section: 'account',
  },
  {
    id: 'dashboard_settings',
    href: '/dashboard/settings',
    label: 'Settings',
    subtitle: 'App and account controls',
    navigationLabelKey: 'dashboard_settings',
    iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    tileClasses: 'bg-violet-100 text-violet-800',
    section: 'account',
  },
  {
    id: 'dashboard_help',
    href: '/dashboard/help',
    label: 'Help & support',
    subtitle: 'Guides and contact',
    navigationLabelKey: 'dashboard_help',
    iconPath: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    tileClasses: 'bg-cyan-100 text-cyan-800',
    section: 'account',
  },
  {
    id: 'dashboard_reset_password',
    href: '/dashboard/settings/password',
    label: 'Reset password',
    subtitle: 'Change your password',
    navigationLabelKey: 'dashboard_reset_password',
    iconPath: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
    tileClasses: 'bg-orange-100 text-orange-800',
    section: 'account',
  },
]

function canSeeNavItem(item: DashboardNavItem, user: User): boolean {
  if (user.isSuperAdmin) return item.id !== 'dashboard_my_qualifications'

  switch (item.id) {
    case 'dashboard_clients':
      return canViewClients(user)
    case 'dashboard_projects':
    case 'dashboard_small_works':
      return canViewProjects(user) && !isOperativeMode(user)
    case 'dashboard_operatives':
      return canViewOperatives(user)
    case 'dashboard_managers':
      return canViewManagers(user)
    case 'dashboard_daily_overview':
      return canViewDailyOverview(user)
    case 'dashboard_schedule':
      return canViewMySchedule(user)
    case 'dashboard_warnings':
      return canViewDailyOverview(user)
    case 'dashboard_tasks':
      return true
    case 'dashboard_annual_leave':
      return isAnnualLeaveFeatureEnabled(user)
    case 'dashboard_site_map':
      return canViewSiteMap(user)
    case 'dashboard_site_audit':
      return canViewSiteAudit(user)
    case 'dashboard_timesheets':
      return canAccessTimesheets(user)
    case 'dashboard_skills':
      return canManageSkills(user)
    case 'dashboard_qualifications':
      return canManageQualifications(user)
    case 'dashboard_my_qualifications':
      return canViewMyQualifications(user)
    case 'dashboard_job_types':
      return canManageJobTypes(user)
    case 'dashboard_wholesalers':
      return canAccessWholesalers(user)
    case 'dashboard_materials':
      return canManageMaterialCatalogue(user)
    case 'dashboard_sub_contractors':
      return canManageSubcontractors(user)
    case 'dashboard_add_user':
    case 'dashboard_manage_users':
      return canManageUsers(user)
    case 'dashboard_help':
      return canViewHelp(user)
    default:
      return true
  }
}

function withLabels(items: DashboardNavItem[], organization: Organization | null, user: User | null): DashboardNavItem[] {
  return items.map((item) => {
    let label = getNavigationLabel(organization?.settings, item.navigationLabelKey, item.label)
    if (user) {
      if (item.id === 'dashboard_add_user') label = getAddUserLabel(user)
      if (item.id === 'dashboard_manage_users') label = getManageUsersLabel(user, organization)
    }
    return { ...item, label }
  })
}

export function getDashboardNavItems(user: User, organization: Organization | null): DashboardNavItem[] {
  return withLabels(
    ALL_NAV_ITEMS.filter((item) => canSeeNavItem(item, user)),
    organization,
    user
  )
}

export function getDashboardNavBySection(
  user: User,
  organization: Organization | null,
  section: NavSection
): DashboardNavItem[] {
  return getDashboardNavItems(user, organization).filter((item) => item.section === section)
}

export function isDashboardNavActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getDashboardQuickActions(user: User, organization: Organization | null) {
  return getDashboardNavItems(user, organization).filter(
    (item) => item.section === 'navigate' || item.section === 'tools'
  )
}

export function hasTeamNav(user: User): boolean {
  return canAccessTeamSection(user)
}
