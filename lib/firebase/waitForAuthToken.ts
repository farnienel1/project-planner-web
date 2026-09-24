import { authLoadRetryDelayMs, isRetryableAuthLoadError } from '@/lib/auth/authBoot'
import { withTimeout } from '@/lib/client/withTimeout'
import { getFirebaseAuth } from '@/lib/firebase/ensureFirebase'

const TOKEN_WAIT_MS = 8_000

/**
 * Firestore listens for the ID token asynchronously. Reads issued in the same
 * turn as the first auth callback can fail; waiting for the token closes that gap.
 */
export async function waitForAuthToken(): Promise<void> {
  try {
    const user = getFirebaseAuth().currentUser
    if (!user) return
    await withTimeout(user.getIdToken(), TOKEN_WAIT_MS, 'auth-token')
  } catch {
    /* The read itself will retry if the token is still settling. */
  }
}

/** Run a Firestore read after the ID token exists, and retry the first-login race. */
export async function withAuthReadRetry<T>(read: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await waitForAuthToken()
      return await read()
    } catch (error) {
      lastError = error
      if (attempt === 2 || !isRetryableAuthLoadError(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, authLoadRetryDelayMs(attempt)))
    }
  }
  throw lastError
}
