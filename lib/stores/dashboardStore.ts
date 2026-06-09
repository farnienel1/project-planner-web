'use client'

import { create } from 'zustand'
import { DEFAULT_HERO_METRICS, sanitizeHeroMetrics } from '@/lib/dashboard/heroMetrics'
import {
  loadDashboardLayout,
  saveDashboardLayout,
  type SaveDashboardLayoutOptions,
} from '@/lib/dashboard/dashboardLayoutStorage'

export type TileId =
  | 'tasks_open'
  | 'tasks_overdue'
  | 'tasks_completed'
  | 'tasks_priority'
  | 'projects_active'
  | 'projects_pipeline'
  | 'projects_health'
  | 'bookings_total'
  | 'bookings_clashes'
  | 'bookings_trend'
  | 'operatives_active'
  | 'operatives_utilisation'
  | 'leave_pending'
  | 'leave_calendar'
  | 'audits_open'
  | 'audits_score'
  | 'small_works'
  | 'small_works_status'
  | 'timesheets_submitted'
  | 'timesheets_hours'
  | 'clients_total'
  | 'warnings_active'

export const DEFAULT_LAYOUT: TileId[] = [
  'tasks_open',
  'tasks_overdue',
  'bookings_total',
  'bookings_clashes',
  'projects_active',
  'bookings_trend',
  'projects_health',
]

export type DashboardLayoutConfig = {
  layout: TileId[]
  heroMetrics: TileId[]
}

interface DashboardStore {
  layout: TileId[]
  heroMetrics: TileId[]
  loading: boolean
  loadLayout: (userId: string, orgId: string) => Promise<void>
  saveLayout: (userId: string, orgId: string, config: DashboardLayoutConfig, options?: SaveDashboardLayoutOptions) => Promise<void>
  setLayout: (layout: TileId[]) => void
  setHeroMetrics: (heroMetrics: TileId[]) => void
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  layout: DEFAULT_LAYOUT,
  heroMetrics: DEFAULT_HERO_METRICS,
  loading: false,

  loadLayout: async (userId, orgId) => {
    set({ loading: true })
    try {
      const config = await loadDashboardLayout(userId, orgId)
      set({
        layout: config.layout,
        heroMetrics: config.heroMetrics,
      })
    } catch (err) {
      console.error('Failed to load dashboard layout', err)
    } finally {
      set({ loading: false })
    }
  },

  saveLayout: async (userId, orgId, config, options) => {
    const heroMetrics = sanitizeHeroMetrics(config.heroMetrics)
    const normalized = { layout: config.layout, heroMetrics }

    try {
      await saveDashboardLayout(userId, orgId, normalized, options)
      set(normalized)
    } catch (err) {
      console.error('Failed to save dashboard layout', err)
      throw err
    }
  },

  setLayout: (layout) => set({ layout }),
  setHeroMetrics: (heroMetrics) => set({ heroMetrics: sanitizeHeroMetrics(heroMetrics) }),
}))
