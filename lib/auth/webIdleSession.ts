/**
 * Web-only idle session. Firebase keeps the login in the browser by default
 * (IndexedDB), so opening the site restores Home without clicking Sign in.
 * iOS is unchanged — this module is never shipped in the iPhone app.
 */

export const WEB_IDLE_TIMEOUT_MS = 30 * 60 * 1000
export const WEB_IDLE_TOUCH_THROTTLE_MS = 15_000
export const WEB_IDLE_STORAGE_KEY = 'webIdleSession.lastActivityAt.v1'
export const WEB_IDLE_EXPIRED_FLAG = 'webIdleSession.expired.v1'

/**
 * Newest interaction in this tab. Storage writes are throttled, so the
 * sign-out check must follow this clock or a busy session still expires
 * 30 minutes after login.
 */
let memoryLastActivityAt: number | null = null

export type IdleSessionEvent = { at: number; type: 'login' | 'activity' }

export function parseLastActivityAt(raw: string | null | undefined): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function isWebIdleExpired(
  now: number,
  lastActivityAt: number | null,
  timeoutMs: number = WEB_IDLE_TIMEOUT_MS
): boolean {
  if (lastActivityAt == null) return false
  return now - lastActivityAt >= timeoutMs
}

/** Skip a write if we already stamped activity within the throttle window. */
export function shouldTouchActivity(
  now: number,
  lastActivityAt: number | null,
  throttleMs: number = WEB_IDLE_TOUCH_THROTTLE_MS
): boolean {
  if (lastActivityAt == null) return true
  return now - lastActivityAt >= throttleMs
}

function readStoredLastActivity(): number | null {
  if (typeof window === 'undefined') return null
  try {
    return parseLastActivityAt(window.localStorage.getItem(WEB_IDLE_STORAGE_KEY))
  } catch {
    return null
  }
}

export function readWebIdleLastActivity(): number | null {
  const stored = readStoredLastActivity()
  if (memoryLastActivityAt == null) return stored
  if (stored == null) return memoryLastActivityAt
  return Math.max(stored, memoryLastActivityAt)
}

/**
 * Idle sign-out follows the latest login or user interaction.
 * Activity before the deadline moves the deadline. A gap of `timeoutMs`
 * with no activity signs out, including when that gap ends on the
 * original login clock.
 */
export function replayIdleSession(
  events: IdleSessionEvent[],
  now: number,
  timeoutMs: number = WEB_IDLE_TIMEOUT_MS
): { signedOut: boolean; lastActivityAt: number | null } {
  let last: number | null = null
  const ordered = [...events].sort((a, b) => a.at - b.at)
  for (const event of ordered) {
    if (event.at > now) continue
    if (last != null && isWebIdleExpired(event.at, last, timeoutMs)) {
      return { signedOut: true, lastActivityAt: last }
    }
    last = event.at
  }
  return {
    signedOut: isWebIdleExpired(now, last, timeoutMs),
    lastActivityAt: last,
  }
}

export function touchWebIdleActivity(now: number = Date.now()): boolean {
  if (typeof window === 'undefined') return false
  const last = readStoredLastActivity()
  if (!shouldTouchActivity(now, last)) return false
  try {
    window.localStorage.setItem(WEB_IDLE_STORAGE_KEY, String(now))
    window.sessionStorage.removeItem(WEB_IDLE_EXPIRED_FLAG)
    return true
  } catch {
    return false
  }
}

/** Remember real use immediately. Storage is only the throttled copy. */
export function noteWebIdleActivity(now: number = Date.now()): boolean {
  if (typeof window === 'undefined') return false
  if (memoryLastActivityAt == null || now >= memoryLastActivityAt) {
    memoryLastActivityAt = now
  }
  return touchWebIdleActivity(now)
}

export function clearWebIdleActivity(): void {
  memoryLastActivityAt = null
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(WEB_IDLE_STORAGE_KEY)
  } catch {
    /* private mode */
  }
}

export function markWebIdleExpired(): void {
  memoryLastActivityAt = null
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(WEB_IDLE_EXPIRED_FLAG, '1')
    window.localStorage.removeItem(WEB_IDLE_STORAGE_KEY)
  } catch {
    /* private mode */
  }
}

export function consumeWebIdleExpiredFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const flagged = window.sessionStorage.getItem(WEB_IDLE_EXPIRED_FLAG) === '1'
    if (flagged) window.sessionStorage.removeItem(WEB_IDLE_EXPIRED_FLAG)
    return flagged
  } catch {
    return false
  }
}
