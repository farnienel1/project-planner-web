import { signInWithEmailAndPassword, type Auth, type User } from 'firebase/auth'
import { isTimeoutError, withTimeout } from '@/lib/client/withTimeout'

/** First wait. Firebase Auth often needs longer than 8s on a cold web client. */
export const AUTH_SIGN_IN_MS = 20_000
/** Extra wait for the same in-flight call after the first timeout. */
export const AUTH_SIGN_IN_GRACE_MS = 20_000

export const SIGN_IN_SLOW_MESSAGE =
  'Sign in is taking too long. Check your connection, refresh this page, then try again.'

export async function waitForAuthSession(auth: Auth, ms = 2500): Promise<void> {
  const ready = (auth as Auth & { authStateReady?: () => Promise<void> }).authStateReady
  if (typeof ready !== 'function') return
  try {
    await withTimeout(ready.call(auth) as Promise<void>, ms, 'auth-ready')
  } catch {
    // IndexedDB / private-mode can leave authStateReady pending. Continue with currentUser.
  }
}

export function matchingAuthUser(auth: Pick<Auth, 'currentUser'>, email: string): User | null {
  const emailLower = email.trim().toLowerCase()
  const current = auth.currentUser
  if (current?.email && current.email.trim().toLowerCase() === emailLower) return current
  return null
}

/**
 * Sign in with email/password without aborting a request that is still running.
 * `withTimeout` rejects while Firebase keeps going — that is why a second click
 * used to work after “taking too long”.
 */
export async function completeEmailSignIn(auth: Auth, email: string, password: string): Promise<User> {
  const emailLower = email.trim().toLowerCase()
  await waitForAuthSession(auth)
  const existing = matchingAuthUser(auth, emailLower)
  if (existing) return existing

  const pending = signInWithEmailAndPassword(auth, emailLower, password)
  try {
    return (await withTimeout(pending, AUTH_SIGN_IN_MS, SIGN_IN_SLOW_MESSAGE)).user
  } catch (error) {
    const after = matchingAuthUser(auth, emailLower)
    if (after) return after
    if (!isTimeoutError(error)) throw error
    try {
      return (await withTimeout(pending, AUTH_SIGN_IN_GRACE_MS, SIGN_IN_SLOW_MESSAGE)).user
    } catch (graceError) {
      const late = matchingAuthUser(auth, emailLower)
      if (late) return late
      throw graceError
    }
  }
}
