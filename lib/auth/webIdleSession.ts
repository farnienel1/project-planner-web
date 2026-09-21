/**
 * Web-only idle session. Firebase keeps the login in the browser by default
 * (IndexedDB), so opening the site restores Home without clicking Sign in.
 * iOS is unchanged — this module is never shipped in the iPhone app.
 */

export const WEB_IDLE_TIMEOUT_MS = 30 * 60 * 1000
export const WEB_IDLE_TOUCH_THROTTLE_MS = 15_000
export const WEB_IDLE_STORAGE_KEY = 'webIdleSession.lastActivityAt.v1'
export const WEB_IDLE_EXPIRED_FLAG = 'webIdleSession.expired.v1'

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

export function readWebIdleLastActivity(): number | null {
  if (typeof window === 'undefined') return null
  try {
    return parseLastActivityAt(window.localStorage.getItem(WEB_IDLE_STORAGE_KEY))
  } catch {
    return null
  }
}

export function touchWebIdleActivity(now: number = Date.now()): boolean {
  if (typeof window === 'undefined') return false
  const last = readWebIdleLastActivity()
  if (!shouldTouchActivity(now, last)) return false
  try {
    window.localStorage.setItem(WEB_IDLE_STORAGE_KEY, String(now))
    window.sessionStorage.removeItem(WEB_IDLE_EXPIRED_FLAG)
    return true
  } catch {
    return false
  }
}

export function clearWebIdleActivity(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(WEB_IDLE_STORAGE_KEY)
  } catch {
    /* private mode */
  }
}

export function markWebIdleExpired(): void {
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
