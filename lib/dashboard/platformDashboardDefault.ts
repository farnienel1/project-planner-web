import { DEFAULT_HERO_METRICS } from '@/lib/dashboard/heroMetrics'
import type { DashboardLayoutConfig, TileId } from '@/lib/stores/dashboardStore'

/** Code fallback — used for new orgs when no platform config exists in Firestore yet. */
export const PLATFORM_DEFAULT_LAYOUT: TileId[] = [
  'tasks_open',
  'tasks_overdue',
  'bookings_total',
  'bookings_clashes',
  'projects_active',
  'bookings_trend',
  'projects_health',
]

export const PLATFORM_DEFAULT_DASHBOARD: DashboardLayoutConfig = {
  layout: [...PLATFORM_DEFAULT_LAYOUT],
  heroMetrics: [...DEFAULT_HERO_METRICS],
}
