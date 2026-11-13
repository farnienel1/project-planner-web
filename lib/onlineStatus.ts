/**
 * When to show the "You're offline" banner (UI only; no rulebook rule — rulebook §2: web is online only).
 *
 * `navigator.onLine` can report false while the connection works (after sleep, with a VPN or a virtual
 * network adapter, or when the browser misses the 'online' event), and once false it may never flip back.
 * So the browser's word alone never shows the banner: it only starts a suspicion. The banner shows once the
 * browser has said offline for `OFFLINE_GRACE_MS` AND a real request to this app's own origin has failed;
 * any request that gets an answer hides it straight away.
 *
 * The transitions are the pure reducer `onlineStatusStep`; `lib/hooks/useOnlineStatus.ts` only wires it to
 * browser events, timers and `probeReachability`.
 */

/** How long the browser must say "offline" before the banner may show. */
export const OFFLINE_GRACE_MS = 4_000
/** How often to re-check while the banner shows. */
export const OFFLINE_RECHECK_MS = 10_000
/** Re-check intervals while the browser says offline but requests keep answering (a stuck flag): 10s, 30s, then 60s. */
export const STUCK_FLAG_BACKOFF_MS = [10_000, 30_000, 60_000] as const
/** A reachability request that has not answered by then counts as failed. */
export const REACHABILITY_TIMEOUT_MS = 5_000
/** Skipped by `middleware.ts`'s matcher, so the request never runs the MFA check; any HTTP answer (404 too) counts. */
export const REACHABILITY_PATH = '/favicon.ico'

export type ReachabilityProbe = 'ok' | 'failed'

export interface OfflineBannerInput {
  /** `navigator.onLine` now (true when unknown). */
  navigatorOnline: boolean
  /** When the browser started saying offline (ms), or null when it has not. */
  offlineSinceMs: number | null
  nowMs: number
  /** The latest reachability check made since `offlineSinceMs`, or null when none has finished. */
  probe: ReachabilityProbe | null
}

export function shouldShowOfflineBanner(input: OfflineBannerInput): boolean {
  if (input.navigatorOnline) return false
  if (input.probe !== 'failed') return false
  if (input.offlineSinceMs == null) return false
  return input.nowMs - input.offlineSinceMs >= OFFLINE_GRACE_MS
}

export interface OnlineStatusState {
  /** When the current offline suspicion started, or null when the browser says online. */
  offlineSinceMs: number | null
  probing: boolean
  showBanner: boolean
  /** Requests that answered in a row while the browser kept saying offline (drives the back-off). */
  okStreak: number
}

export const INITIAL_ONLINE_STATUS: OnlineStatusState = {
  offlineSinceMs: null,
  probing: false,
  showBanner: false,
  okStreak: 0,
}

export type OnlineStatusEvent =
  /** Mount, the window 'online' / 'offline' events, focus or the tab being shown: a fresh look. */
  | { type: 'recheck'; navigatorOnline: boolean; nowMs: number }
  /** The scheduled timer fired. */
  | { type: 'timer'; navigatorOnline: boolean; nowMs: number; hidden: boolean }
  | { type: 'probeResult'; probe: ReachabilityProbe; navigatorOnline: boolean; nowMs: number }

export interface OnlineStatusEffects {
  /** Start a reachability request now. */
  probe: boolean
  /** Set the timer to this many ms; null clears it; 'keep' leaves a pending timer alone. */
  schedule: number | null | 'keep'
}

function backOnline(): { state: OnlineStatusState; effects: OnlineStatusEffects } {
  return { state: INITIAL_ONLINE_STATUS, effects: { probe: false, schedule: null } }
}

export function onlineStatusStep(
  state: OnlineStatusState,
  event: OnlineStatusEvent
): { state: OnlineStatusState; effects: OnlineStatusEffects } {
  // A probe in flight keeps its `probing` flag even when the browser flips to online, so its result is not doubled up.
  if (event.navigatorOnline) {
    const reset = backOnline()
    return { ...reset, state: { ...reset.state, probing: state.probing && event.type !== 'probeResult' } }
  }
  switch (event.type) {
    case 'recheck': {
      if (state.offlineSinceMs == null) {
        return {
          state: { ...state, offlineSinceMs: event.nowMs, okStreak: 0 },
          effects: { probe: false, schedule: OFFLINE_GRACE_MS },
        }
      }
      if (state.probing) return { state, effects: { probe: false, schedule: 'keep' } }
      return { state: { ...state, probing: true }, effects: { probe: true, schedule: null } }
    }
    case 'timer': {
      const since = state.offlineSinceMs ?? event.nowMs
      // A hidden tab makes no scheduled requests; showing the tab again re-checks.
      if (event.hidden || state.probing) {
        return { state: { ...state, offlineSinceMs: since }, effects: { probe: false, schedule: null } }
      }
      return { state: { ...state, offlineSinceMs: since, probing: true }, effects: { probe: true, schedule: null } }
    }
    case 'probeResult': {
      if (event.probe === 'ok') {
        // The network works: hide now; the browser still says offline (a stuck flag), so look again later, backing off.
        const okStreak = state.okStreak + 1
        const wait = STUCK_FLAG_BACKOFF_MS[Math.min(okStreak, STUCK_FLAG_BACKOFF_MS.length) - 1]
        return {
          state: { offlineSinceMs: event.nowMs, probing: false, showBanner: false, okStreak },
          effects: { probe: false, schedule: wait },
        }
      }
      if (state.okStreak > 0) {
        // The first failure after a stuck-flag period starts a fresh grace period and needs a second failure.
        return {
          state: { offlineSinceMs: event.nowMs, probing: false, showBanner: false, okStreak: 0 },
          effects: { probe: false, schedule: OFFLINE_GRACE_MS },
        }
      }
      const offlineSinceMs = state.offlineSinceMs ?? event.nowMs
      const showBanner = shouldShowOfflineBanner({
        navigatorOnline: false,
        offlineSinceMs,
        nowMs: event.nowMs,
        probe: 'failed',
      })
      const graceLeft = offlineSinceMs + OFFLINE_GRACE_MS - event.nowMs
      return {
        state: { offlineSinceMs, probing: false, showBanner, okStreak: 0 },
        effects: { probe: false, schedule: showBanner || graceLeft <= 0 ? OFFLINE_RECHECK_MS : graceLeft },
      }
    }
  }
}

/**
 * One request to this app's own origin, never cached. Any HTTP answer (a redirect or an error status
 * included) means the network works; only a network error or the timeout counts as failed.
 */
export async function probeReachability(
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = REACHABILITY_TIMEOUT_MS
): Promise<ReachabilityProbe> {
  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    await fetchImpl(`${REACHABILITY_PATH}?_online=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
      redirect: 'manual',
      credentials: 'omit',
      signal: controller?.signal,
    })
    return 'ok'
  } catch {
    return 'failed'
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// The confirmed status, shared with code outside React (the data check, lib/dataParity/dataParityMonitor.ts).
let statusOwners = 0
let confirmedOffline = false

/** Called by `useOnlineStatus` on mount (true) and unmount (false). */
export function registerOnlineStatusOwner(active: boolean): void {
  statusOwners = Math.max(0, statusOwners + (active ? 1 : -1))
  if (statusOwners === 0) confirmedOffline = false
}

export function setConfirmedOffline(offline: boolean): void {
  confirmedOffline = offline
}

/**
 * Whether background work should treat the browser as online: the confirmed banner status while
 * `useOnlineStatus` is mounted, else `navigator.onLine` (true when unknown).
 */
export function browserOnlineForChecks(navigatorOnline: boolean | undefined): boolean {
  if (statusOwners > 0) return !confirmedOffline
  return navigatorOnline !== false
}
