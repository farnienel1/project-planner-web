/**
 * Timesheets hub and nested screens are separate paths.
 * A link to the same pathname does not clear ?surface= / ?user= in the App Router,
 * which left the left-menu Timesheets item and the in-page Timesheets control
 * stuck on User Timesheets.
 */
export const TIMESHEETS_HUB_PATH = '/dashboard/timesheets'
export const TIMESHEETS_MINE_PATH = '/dashboard/timesheets/mine'
export const TIMESHEETS_TEAM_PATH = '/dashboard/timesheets/team'

export type TimesheetRouteSurface = 'hub' | 'mine' | 'team'

export function timesheetSurfaceFromPath(pathname: string): TimesheetRouteSurface {
  if (pathname === TIMESHEETS_MINE_PATH || pathname.startsWith(`${TIMESHEETS_MINE_PATH}/`)) return 'mine'
  if (pathname === TIMESHEETS_TEAM_PATH || pathname.startsWith(`${TIMESHEETS_TEAM_PATH}/`)) return 'team'
  return 'hub'
}

export function timesheetsMineHref(period?: string | null, periodEnd?: string | null): string {
  if (!period) return TIMESHEETS_MINE_PATH
  const params = new URLSearchParams({ period })
  if (periodEnd) params.set('periodEnd', periodEnd)
  return `${TIMESHEETS_MINE_PATH}?${params.toString()}`
}

/** Period detail goes to its list. The list goes to the hub. */
export function timesheetNestedParentHref(input: {
  surface: 'mine' | 'team'
  hasDetail: boolean
  tab?: string | null
}): string {
  if (input.surface === 'mine') return input.hasDetail ? TIMESHEETS_MINE_PATH : TIMESHEETS_HUB_PATH
  return input.hasDetail ? timesheetsTeamHref({ tab: input.tab || 'awaiting' }) : TIMESHEETS_HUB_PATH
}

export function timesheetsTeamHref(options?: {
  tab?: string | null
  user?: string | null
  period?: string | null
  periodEnd?: string | null
}): string {
  const params = new URLSearchParams()
  if (options?.tab) params.set('tab', options.tab)
  if (options?.user) params.set('user', options.user)
  if (options?.period) params.set('period', options.period)
  if (options?.periodEnd) params.set('periodEnd', options.periodEnd)
  const query = params.toString()
  return query ? `${TIMESHEETS_TEAM_PATH}?${query}` : TIMESHEETS_TEAM_PATH
}

/** Old inbox and help links used ?surface= on the hub path. */
export function legacyTimesheetRedirect(surface: string | null, search: string): string | null {
  if (surface !== 'mine' && surface !== 'team') return null
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  params.delete('surface')
  const query = params.toString()
  const path = surface === 'mine' ? TIMESHEETS_MINE_PATH : TIMESHEETS_TEAM_PATH
  return query ? `${path}?${query}` : path
}

/**
 * The App Router keeps the current query when a link stays on the same pathname.
 * Child routes (/mine, /team) change the pathname, so the left menu reaches the hub.
 * A hard navigation is only needed when the pathname would not change.
 */
export function timesheetLinkShouldHardReset(pathname: string, search: string, href: string): boolean {
  const target = new URL(href, 'https://timesheets.local')
  if (pathname !== target.pathname) return false
  const current = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  current.sort()
  target.searchParams.sort()
  return current.toString() !== target.searchParams.toString()
}
