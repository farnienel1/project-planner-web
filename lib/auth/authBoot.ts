/** First-login boot decisions. Kept pure so the splash-until-refresh race can be tested. */

const RETRYABLE_CODES = new Set([
  'permission-denied',
  'unauthenticated',
  'unavailable',
  'deadline-exceeded',
  'aborted',
  'cancelled',
  'resource-exhausted',
  'network-request-failed',
])

export function firestoreErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return ''
  return String((error as { code: unknown }).code)
    .replace(/^(firestore|auth)\//, '')
    .trim()
}

/**
 * The first Firestore read after sign-in often runs before Auth has handed the
 * ID token to Firestore. That looks like permission-denied or a timeout, and a
 * refresh then works because the token is already cached.
 */
export function isRetryableAuthLoadError(error: unknown): boolean {
  const code = firestoreErrorCode(error)
  if (RETRYABLE_CODES.has(code)) return true
  if (error instanceof Error && error.name === 'TimeoutError') return true
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return (
    message.includes('taking too long') ||
    message.includes('offline') ||
    message.includes('network') ||
    message.includes('unavailable')
  )
}

export function authLoadRetryDelayMs(attempt: number): number {
  return 400 * (attempt + 1)
}

/**
 * Firebase can emit a null user before IndexedDB persistence restores the
 * session. Clearing that callback sends a just-signed-in user back to login.
 */
export function shouldHoldSignedOutCallback(input: { authReady: boolean; hasCurrentUser: boolean }): boolean {
  return !input.authReady || input.hasCurrentUser
}
