import type { TileId } from '@/lib/stores/dashboardStore'

export const DASHBOARD_TILE_DRAG_KEY = 'application/x-dashboard-tile'

export type DashboardTileDragSource = 'grid' | 'catalogue' | 'hero'

export type HeroTileDrop = {
  id: TileId
  source: DashboardTileDragSource
}

export function setDashboardTileDrag(
  e: React.DragEvent,
  id: TileId,
  source: DashboardTileDragSource
) {
  e.dataTransfer.setData(DASHBOARD_TILE_DRAG_KEY, JSON.stringify({ id, source }))
  if (source === 'hero') {
    e.dataTransfer.setData('text/hero-metric', id)
  } else if (source === 'grid') {
    e.dataTransfer.setData('text/grid-tile', id)
  } else {
    e.dataTransfer.setData('text/tile-id', id)
  }
}

export function getDashboardTileDrag(
  e: React.DragEvent | DragEvent
): { id: TileId; source: DashboardTileDragSource } | null {
  const dt = e.dataTransfer
  if (!dt) return null

  const raw = dt.getData(DASHBOARD_TILE_DRAG_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { id: TileId; source: DashboardTileDragSource }
      if (parsed.id) return parsed
    } catch {
      // fall through to legacy keys
    }
  }

  const hero = dt.getData('text/hero-metric')
  if (hero) return { id: hero as TileId, source: 'hero' }

  const grid = dt.getData('text/grid-tile')
  if (grid) return { id: grid as TileId, source: 'grid' }

  const catalogue = dt.getData('text/tile-id')
  if (catalogue) return { id: catalogue as TileId, source: 'catalogue' }

  return null
}
