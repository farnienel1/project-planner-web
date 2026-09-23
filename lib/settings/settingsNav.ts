export type SettingsPanel =
  | 'main'
  | 'profile'
  | 'password'
  | 'notifications'
  | 'organisation'
  | 'company-details'
  | 'working-hours'
  | 'annual-leave-defaults'
  | 'schedule-options'
  | 'warnings'
  | 'material-cutoff'
  | 'payment-runs'
  | 'roles'
  | 'billing'

export type SettingsNavItem = {
  id: Exclude<SettingsPanel, 'main'>
  label: string
  description: string
  href: string
  icon: string
  hue: string
  group: 'personal' | 'company'
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    id: 'profile',
    label: 'My profile',
    description: 'Name, photo, contact details',
    href: '/dashboard/settings/profile',
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    hue: 'blue',
    group: 'personal',
  },
  {
    id: 'password',
    label: 'Sign-in & password',
    description: 'Email, password, security',
    href: '/dashboard/settings/password',
    icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
    hue: 'daily',
    group: 'personal',
  },
  {
    id: 'notifications',
    label: 'My notifications',
    description: 'What you get pinged about',
    href: '/dashboard/settings/notifications',
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    hue: 'red',
    group: 'personal',
  },
  {
    id: 'company-details',
    label: 'Company details',
    description: 'Name, logo, office address, currency and region',
    href: '/dashboard/settings/company-details',
    icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
    hue: 'blue',
    group: 'company',
  },
  {
    id: 'working-hours',
    label: 'Working hours & overtime',
    description: 'Standard day, breaks and overtime rates',
    href: '/dashboard/settings/working-hours',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    hue: 'daily',
    group: 'company',
  },
  {
    id: 'annual-leave-defaults',
    label: 'Annual leave',
    description: 'Allowance and leave year for new staff',
    href: '/dashboard/settings/annual-leave-defaults',
    icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364-.707-.707M6.343 6.343l-.707-.707m12.728 0-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
    hue: 'leave',
    group: 'company',
  },
  {
    id: 'schedule-options',
    label: 'Schedule options',
    description: 'Office, WFH and extra locations',
    href: '/dashboard/settings/schedule-options',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    hue: 'sched',
    group: 'company',
  },
  {
    id: 'warnings',
    label: 'Warnings',
    description: 'Change and alter warning defaults',
    href: '/dashboard/settings/warnings',
    icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
    hue: 'warn',
    group: 'company',
  },
  {
    id: 'material-cutoff',
    label: 'Material cut-off',
    description: 'Daily reminder time for orders',
    href: '/dashboard/settings/material-cutoff',
    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    hue: 'sw',
    group: 'company',
  },
  {
    id: 'payment-runs',
    label: 'Payment runs and timesheets',
    description: 'Pay periods used on timesheets',
    href: '/dashboard/settings/payment-runs',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    hue: 'green',
    group: 'company',
  },
  {
    id: 'roles',
    label: 'Roles & permissions',
    description: 'Admin, manager and operative access',
    href: '/dashboard/settings/roles',
    icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    hue: 'user',
    group: 'company',
  },
  {
    id: 'billing',
    label: 'Billing',
    description: 'Plan, trial and invoices',
    href: '/dashboard/settings/billing',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    hue: 'green',
    group: 'company',
  },
]

const PANEL_BY_PATH: Record<string, SettingsPanel> = Object.fromEntries(
  SETTINGS_NAV.map((item) => [item.href, item.id])
) as Record<string, SettingsPanel>
PANEL_BY_PATH['/dashboard/settings'] = 'main'
PANEL_BY_PATH['/dashboard/settings/organisation'] = 'organisation'

export function settingsPanelFromPath(pathname: string | null): SettingsPanel | null {
  if (!pathname) return null
  if (PANEL_BY_PATH[pathname]) return PANEL_BY_PATH[pathname]
  return null
}

export function settingsHrefForPanel(panel: SettingsPanel): string {
  if (panel === 'main') return '/dashboard/settings'
  if (panel === 'organisation') return '/dashboard/settings/organisation'
  const item = SETTINGS_NAV.find((row) => row.id === panel)
  return item?.href || '/dashboard/settings'
}

export const PERSONAL_SETTINGS = SETTINGS_NAV.filter((item) => item.group === 'personal')
export const COMPANY_SETTINGS = SETTINGS_NAV.filter((item) => item.group === 'company')
