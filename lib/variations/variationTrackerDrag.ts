import { VARIATION_PINNED_MESSAGE, VARIATION_STATUS_LABELS, variationIsPinned } from '@/lib/canonical'

/**
 * Display helpers for the VO tracker's drag and drop (owner 23 Nov, UI batch 3). They decide nothing about numbers:
 * the order and numbers are always `variationRenumberPlan`, and a pinned variation is `variationIsPinned` (status
 * only, rulebook 1.63.0).
 */

/** The message shown when someone tries to move a Submitted or Closed variation, built on `VARIATION_PINNED_MESSAGE`. */
export function variationPinnedMoveText(row: { voNumber?: string | null; status?: string | null }): string {
  const label = VARIATION_STATUS_LABELS[String(row.status || '').toLowerCase()]
  const name = String(row.voNumber || '').trim() || 'This variation'
  return label && label !== 'Open' ? `${name} is ${label.toLowerCase()} and locked. ${VARIATION_PINNED_MESSAGE}` : VARIATION_PINNED_MESSAGE
}

/**
 * The open order after moving `fromId` to the place of `toId`. Only open variations are in `openIds`, so a pinned row
 * is never a target and never moves; null when nothing changes (same row, or an id not in the open order).
 */
export function trackerOrderAfterMove(openIds: readonly string[], fromId: string, toId: string): string[] | null {
  if (fromId === toId) return null
  const from = openIds.indexOf(fromId)
  const to = openIds.indexOf(toId)
  if (from < 0 || to < 0) return null
  const next = [...openIds]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** Whether a row may be picked up: the tracker allows dragging and the row is not pinned. */
export function trackerRowMovable(row: { status?: string | null }, canDrag: boolean): boolean {
  return canDrag && !variationIsPinned(row)
}

/**
 * Touch / pen drag by the handle, as plain state so it does not depend on React's render closures or on the handle
 * keeping pointer capture while its row moves in the page (review of #420). `order` is the open order on screen.
 */
export type TrackerTouchDrag = { id: string; pointerId: number; order: string[]; moved: boolean }

export function trackerTouchDragStart(openIds: readonly string[], id: string, pointerId: number): TrackerTouchDrag | null {
  if (!openIds.includes(id)) return null
  return { id, pointerId, order: [...openIds], moved: false }
}

/** The finger is over row `targetId` (or no row): the new state, or the same object when nothing changes. */
export function trackerTouchDragMove(state: TrackerTouchDrag, targetId: string | null): TrackerTouchDrag {
  if (!targetId) return state
  const next = trackerOrderAfterMove(state.order, state.id, targetId)
  return next ? { ...state, order: next, moved: true } : state
}

/** Finger lifted: the order to save, or null when the row never moved (nothing is written). */
export function trackerTouchDragEnd(state: TrackerTouchDrag | null): string[] | null {
  return state && state.moved ? state.order : null
}

/** Auto-scroll while a finger is near the top or bottom edge: pixels to scroll this frame (negative = up), else 0. */
export function trackerEdgeScrollDelta(y: number, top: number, bottom: number, edge = 64, max = 16): number {
  if (!(bottom > top) || !Number.isFinite(y)) return 0
  if (y < top + edge) return -Math.ceil(max * Math.min(1, (top + edge - y) / edge))
  if (y > bottom - edge) return Math.ceil(max * Math.min(1, (y - (bottom - edge)) / edge))
  return 0
}
