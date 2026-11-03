import type { TileId } from '@/lib/stores/dashboardStore'
import { isHeroEligible } from '@/lib/dashboard/tileCatalogue'

export const MAX_HERO_METRICS = 4

export const DEFAULT_HERO_METRICS: TileId[] = ['projects_active', 'bookings_total', 'tasks_open']

export type HeroMetricDisplay = {
  id: TileId
  value: string | number
  label: string
  href?: string
}

export { isHeroEligible }

export function sanitizeHeroMetrics(metrics: unknown): TileId[] {
  if (!Array.isArray(metrics)) return [...DEFAULT_HERO_METRICS]
  const cleaned = metrics.filter((id): id is TileId => typeof id === 'string' && isHeroEligible(id as TileId))
  const unique = [...new Set(cleaned)].slice(0, MAX_HERO_METRICS)
  return unique.length > 0 ? unique : [...DEFAULT_HERO_METRICS]
}

export function getHeroMetricPreview(id: TileId): HeroMetricDisplay | null {
  const meta = {
    tasks_open: { label: 'Open tasks', href: '/dashboard/tasks' },
    tasks_overdue: { label: 'Overdue tasks', href: '/dashboard/tasks' },
    tasks_completed: { label: 'Tasks completed', href: '/dashboard/tasks' },
    projects_active: { label: 'Active projects', href: '/dashboard/projects' },
    bookings_total: { label: 'Bookings', href: '/dashboard/daily-overview' },
    bookings_clashes: { label: 'Booking clashes', href: '/dashboard/warnings' },
    operatives_active: { label: 'Active operatives', href: '/dashboard/operatives' },
    leave_pending: { label: 'Leave approvals', href: '/dashboard/tasks' },
    audits_open: { label: 'Site audits', href: '/dashboard/site-audit' },
    small_works: { label: 'Small works', href: '/dashboard/small-works' },
    clients_total: { label: 'Clients', href: '/dashboard/clients' },
    warnings_active: { label: 'Active warnings', href: '/dashboard/warnings' },
    timesheets_submitted: { label: 'Bookings this week', href: '/dashboard/timesheets' },
  } as const

  if (!(id in meta)) return null
  const entry = meta[id as keyof typeof meta]
  return { id, value: 0, label: entry.label, href: entry.href }
}

export function resolveHeroMetricPreviews(ids: TileId[]): HeroMetricDisplay[] {
  return ids.map((id) => getHeroMetricPreview(id)).filter((m): m is HeroMetricDisplay => m != null)
}
