import { create } from 'zustand'

/**
 * Rulebook 1.47.0 §8 (owner decision 17 Nov): the web sidebar's Timesheets entry shows the same yellow triangle as the
 * hub's "My timesheets" card. The hub works it out once (`MineChangedIndicator`: `periodBookingChanges` over the last
 * `HUB_CHANGE_SCAN_RUNS` pay runs) and publishes the answer here; the sidebar only reads it — never a second
 * computation. Keyed by organisation and person, so another company or another signed-in person never shows it.
 */
export function mineChangedKey(organizationId: string | null | undefined, userId: string | null | undefined): string | null {
  const org = String(organizationId ?? '').trim()
  const user = String(userId ?? '').trim()
  return org && user ? `${org}|${user}` : null
}

type MineChangedState = {
  key: string | null
  show: boolean
  publish: (key: string | null, show: boolean) => void
}

export const useMineChangedStore = create<MineChangedState>((set) => ({
  key: null,
  show: false,
  publish: (key, show) => set(key ? { key, show } : { key: null, show: false }),
}))

/** Whether the sidebar shows the triangle for this organisation and person (the hub's last answer for them). */
export function mineChangedShown(state: Pick<MineChangedState, 'key' | 'show'>, key: string | null): boolean {
  return Boolean(key) && state.key === key && state.show
}
