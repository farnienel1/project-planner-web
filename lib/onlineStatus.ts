/**
 * When to show the "You're offline" banner (UI only; no rulebook rule — rulebook §2: web is online only).
 *
 * `navigator.onLine` can report false while the connection works (after sleep, with a VPN or a virtual
 * network adapter, or when the browser misses the 'online' event), and once false it may never flip back.
 * So the browser's word alone never shows the banner: it only starts a suspicion. The banner shows once the
 * browser has said offline for `OFFLINE_GRACE_MS` AND a real request to this app's own origin has failed;
 * any request that gets an answer hides it straight away.
 */

/** How long the browser must say "offline" before the banner may show. */
export const OFFLINE_GRACE_MS = 4_000
/** How often to re-check while offline is suspected or shown. */
export const OFFLINE_RECHECK_MS = 10_000
/** A reachability request that has not answered by then counts as failed. */
export const REACHABILITY_TIMEOUT_MS = 5_000

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
    await fetchImpl(`/?_online=${Date.now()}`, {
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
