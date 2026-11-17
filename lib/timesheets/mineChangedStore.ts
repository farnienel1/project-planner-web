import { create } from 'zustand'

/**
 * Rulebook 1.47.0 §8 (owner decision 17 Nov): the web sidebar's Timesheets entry shows the same yellow triangle as the
 * hub's "My timesheets" card. The hub works it out once (`MineChangedIndicator`: `periodBookingChanges` over the last
 * `HUB_CHANGE_SCAN_RUNS` pay runs) and publishes which pay runs need the person (by their start day key); the sidebar
 * only reads it — never a second computation. When the person signs one of them again on its period page, that page
 * takes that pay run off (`resolvePeriod`, review of #363) so the sidebar clears without waiting for the hub.
 * Keyed by organisation and person, so another company or another signed-in person never shows it.
 */
export function mineChangedKey(organizationId: string | null | undefined, userId: string | null | undefined): string | null {
  const org = String(organizationId ?? '').trim()
  const user = String(userId ?? '').trim()
  return org && user ? `${org}|${user}` : null
}

type MineChangedState = {
  key: string | null
  /** Start day keys of the pay runs the hub found waiting for the person. */
  periods: string[]
  publish: (key: string | null, periods: ReadonlyArray<string>) => void
  resolvePeriod: (key: string | null, periodStartDayKey: string) => void
}

export const useMineChangedStore = create<MineChangedState>((set, get) => ({
  key: null,
  periods: [],
  publish: (key, periods) => set(key ? { key, periods: [...new Set(periods)] } : { key: null, periods: [] }),
  resolvePeriod: (key, periodStartDayKey) => {
    const state = get()
    if (!key || state.key !== key) return
    const periods = state.periods.filter((period) => period !== periodStartDayKey)
    if (periods.length !== state.periods.length) set({ periods })
  },
}))

/** Whether the sidebar shows the triangle for this organisation and person (the hub's last answer for them). */
export function mineChangedShown(state: Pick<MineChangedState, 'key' | 'periods'>, key: string | null): boolean {
  return Boolean(key) && state.key === key && state.periods.length > 0
}
