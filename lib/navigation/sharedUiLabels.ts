export const DEFAULT_NAVIGATION_LABELS: Record<string, string> = {
  dashboard_home: 'Home',
  dashboard_projects: 'Projects',
  dashboard_small_works: 'Small works',
  dashboard_operatives: 'Operatives',
  dashboard_managers: 'Managers',
  dashboard_schedule: 'Schedule',
  dashboard_settings: 'Settings',
  site_audit: 'Site audit',
}

type OrganizationSettings = Record<string, any> | undefined

export function getNavigationLabel(
  settings: OrganizationSettings,
  key: string,
  fallback: string
): string {
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
