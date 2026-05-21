import type { User } from '@/types'

export type DashboardQuickAction = {
  id: string
  href: string
  label: string
  subtitle: string
  iconPath: string
  tileClasses: string
}

const ALL_ACTIONS: DashboardQuickAction[] = [
  {
    id: 'dashboard_home',
    href: '/dashboard',
    label: 'Home',
    subtitle: 'Overview and live metrics',
    iconPath: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    tileClasses: 'bg-slate-100 text-slate-700',
  },
  {
    id: 'dashboard_projects',
    href: '/dashboard/projects',
    label: 'Projects',
    subtitle: 'Main project pipeline',
    iconPath: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    tileClasses: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'dashboard_small_works',
    href: '/dashboard/small-works',
    label: 'Small works',
    subtitle: 'Reactive and ad-hoc jobs',
    iconPath: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    tileClasses: 'bg-amber-50 text-amber-700',
  },
  {
    id: 'dashboard_operatives',
    href: '/dashboard/operatives',
    label: 'Operatives',
    subtitle: 'People and availability',
    iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    tileClasses: 'bg-violet-50 text-violet-700',
  },
  {
    id: 'dashboard_managers',
    href: '/dashboard/managers',
    label: 'Managers',
    subtitle: 'Leadership and ownership',
    iconPath: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    tileClasses: 'bg-fuchsia-50 text-fuchsia-700',
  },
  {
    id: 'dashboard_schedule',
    href: '/dashboard/schedule',
    label: 'Schedule',
    subtitle: 'Bookings and timelines',
    iconPath: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    tileClasses: 'bg-blue-50 text-blue-700',
  },
  {
    id: 'dashboard_settings',
    href: '/dashboard/settings',
    label: 'Settings',
    subtitle: 'App and account controls',
    iconPath: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    tileClasses: 'bg-slate-100 text-slate-700',
  },
]

export function getDashboardQuickActions(user: User): DashboardQuickAction[] {
  return ALL_ACTIONS.filter((item) => {
    if (item.id === 'dashboard_projects' || item.id === 'dashboard_small_works') {
      return user.permissions?.projects
    }

    if (item.id === 'dashboard_operatives') {
      return user.permissions?.operatives
    }

    if (item.id === 'dashboard_managers') {
      return user.permissions?.adminAccess
    }

    return true
  })
}
