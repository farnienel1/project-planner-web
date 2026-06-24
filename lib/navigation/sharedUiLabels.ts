export const DEFAULT_NAVIGATION_LABELS: Record<string, string> = {
  dashboard_home: 'Home',
  dashboard_clients: 'Clients',
  dashboard_projects: 'Projects',
  dashboard_small_works: 'Small works',
  dashboard_operatives: 'Operatives',
  dashboard_managers: 'Managers',
  dashboard_schedule: 'My Schedule',
  dashboard_daily_overview: 'Daily overview',
  dashboard_weekly_report: 'Weekly report',
  dashboard_warnings: 'Warnings',
  dashboard_tasks: 'Tasks',
  dashboard_annual_leave: 'Annual leave',
  dashboard_site_map: 'Site map',
  dashboard_site_audit: 'Site audit',
  dashboard_timesheets: 'Timesheets',
  dashboard_skills: 'Skills',
  dashboard_qualifications: 'Qualifications',
  dashboard_job_types: 'Job types',
  dashboard_wholesalers: 'Wholesalers',
  dashboard_materials: 'Material catalogue',
  dashboard_sub_contractors: 'Sub contractor',
  dashboard_add_user: 'Add user',
  dashboard_manage_users: 'Manage users',
  dashboard_settings: 'Settings',
  dashboard_help: 'Help & support',
  dashboard_reset_password: 'Reset password',
  site_audit: 'Site audit',
}

type OrganizationSettings = Record<string, any> | undefined

/** Renamed nav labels — always use these on web (overrides legacy org "Schedule" in Firestore). */
const FORCED_NAVIGATION_LABELS: Record<string, string> = {
  dashboard_schedule: 'My Schedule',
  dashboard_daily_overview: 'Daily overview',
}

export function getNavigationLabel(
  settings: OrganizationSettings,
  key: string,
  fallback: string
): string {
  if (FORCED_NAVIGATION_LABELS[key]) {
    return FORCED_NAVIGATION_LABELS[key]
  }

  const value = settings?.uiLabels?.navigationLabels?.[key]
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }

  return fallback
}

export function withSeededNavigationLabels(settings: OrganizationSettings): {
  settings: Record<string, any>
  changed: boolean
  navigationLabels: Record<string, string>
} {
  const safeSettings = settings ?? {}
  const existing = safeSettings.uiLabels?.navigationLabels ?? {}

  const merged: Record<string, string> = { ...DEFAULT_NAVIGATION_LABELS }
  Object.entries(existing).forEach(([key, value]) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      merged[key] = value.trim()
    }
  })

  const changed = Object.keys(DEFAULT_NAVIGATION_LABELS).some((key) => {
    const value = existing[key]
    return typeof value !== 'string' || value.trim().length === 0
  })

  return {
    settings: {
      ...safeSettings,
      uiLabels: {
        ...(safeSettings.uiLabels ?? {}),
        navigationLabels: merged,
      },
    },
    changed,
    navigationLabels: merged,
  }
}
