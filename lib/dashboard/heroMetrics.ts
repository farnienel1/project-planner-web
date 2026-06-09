import { endOfWeek, isWithinInterval, startOfWeek } from 'date-fns'
import type { TileId } from '@/lib/stores/dashboardStore'
import { isHeroEligible } from '@/lib/dashboard/tileCatalogue'
import { isTaskOverdue } from '@/lib/tasks/taskUtils'
import type { DashboardTileData } from '@/components/dashboard/DashboardTiles'

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

export function resolveHeroMetric(id: TileId, data: DashboardTileData): HeroMetricDisplay | null {
  if (!isHeroEligible(id)) return null

  switch (id) {
    case 'tasks_open':
      return {
        id,
        value: data.tasks.filter((t) => t.status !== 'Completed').length + data.pendingLeaveCount,
        label: 'Open tasks',
        href: '/dashboard/tasks',
      }
    case 'tasks_overdue':
      return {
        id,
        value: data.tasks.filter((t) => isTaskOverdue(t)).length,
        label: 'Overdue tasks',
        href: '/dashboard/tasks',
      }
    case 'tasks_completed':
      return {
        id,
        value: data.tasks.filter((t) => t.status === 'Completed').length,
        label: 'Tasks completed',
        href: '/dashboard/tasks',
      }
    case 'projects_active':
      return {
        id,
        value: data.projects.filter((p) => p.isLive).length,
        label: 'Active projects',
        href: '/dashboard/projects',
      }
    case 'bookings_total':
      return { id, value: data.bookings.length, label: 'Bookings', href: '/dashboard/daily-overview' }
    case 'bookings_clashes':
      return {
        id,
        value: data.warnings.length,
        label: 'Booking clashes',
        href: '/dashboard/warnings',
      }
    case 'operatives_active':
      return {
        id,
        value: data.activeOperativesCount || data.operatives.length,
        label: 'Active operatives',
        href: '/dashboard/operatives',
      }
    case 'leave_pending':
      return {
        id,
        value: data.pendingLeaveCount,
        label: 'Leave approvals',
        href: '/dashboard/tasks',
      }
    case 'audits_open':
      return { id, value: data.audits.length, label: 'Site audits', href: '/dashboard/site-audit' }
    case 'small_works':
      return {
        id,
        value: data.smallWorks.filter((p) => p.isLive).length,
        label: 'Small works',
        href: '/dashboard/small-works',
      }
    case 'clients_total':
      return { id, value: data.clients.length, label: 'Clients', href: '/dashboard/clients' }
    case 'warnings_active':
      return {
        id,
        value: data.warnings.length,
        label: 'Active warnings',
        href: '/dashboard/warnings',
      }
    case 'timesheets_submitted': {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 })
      const end = endOfWeek(start, { weekStartsOn: 1 })
      const weekBookings = data.bookings.filter((b) =>
        isWithinInterval(new Date(b.date), { start, end })
      )
      return {
        id,
        value: weekBookings.length,
        label: 'Bookings this week',
        href: '/dashboard/timesheets',
      }
    }
    default:
      return null
  }
}

export function resolveHeroMetrics(ids: TileId[], data: DashboardTileData): HeroMetricDisplay[] {
  return ids
    .map((id) => resolveHeroMetric(id, data))
    .filter((m): m is HeroMetricDisplay => m != null)
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
