import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth'
import { withTimeout } from '@/lib/client/withTimeout'
import { getFirebaseAuth } from '@/lib/firebase/ensureFirebase'
import { isEmailInUseError } from '@/lib/orgSetup/authSetupErrors'

const AUTH_STATE_READY_MS = 3000
const AUTH_SIGN_IN_MS = 15000

async function waitForAuthSession(auth: Auth): Promise<void> {
  const ready = (auth as Auth & { authStateReady?: () => Promise<void> }).authStateReady
  if (typeof ready !== 'function') return
  try {
    await withTimeout(ready.call(auth) as Promise<void>, AUTH_STATE_READY_MS, 'auth-ready')
  } catch {
    // IndexedDB / private-mode can leave authStateReady pending. Continue with currentUser.
  }
}

function signedInUserId(auth: Auth): string | null {
  return auth.currentUser?.uid ?? null
}

/**
 * Reuse the signed-in account when creating another organisation.
 * Never treat an existing email as a hard stop — one login can own many orgs.
 */
export async function resolveAuthUserIdForOrgSetup(
  email: string,
  password: string | undefined
): Promise<string> {
  const auth = getFirebaseAuth()
  await waitForAuthSession(auth)
  const existingSessionId = signedInUserId(auth)
  if (existingSessionId) {
    return existingSessionId
  }

  const emailLower = email.toLowerCase().trim()
  if (!password) {
    throw new Error(
      'Please sign in with your existing Project Planner password, then use Change organisation to set up another organisation.'
    )
  }

  const authBusyMessage =
    'Signing in is taking too long. Check your connection, refresh this page, then click Activate again.'

  try {
    const created = await withTimeout(
      createUserWithEmailAndPassword(auth, emailLower, password),
      AUTH_SIGN_IN_MS,
      authBusyMessage
    )
    return created.user.uid
  } catch (error) {
    if (!isEmailInUseError(error)) throw error
    const existingAfterCreate = signedInUserId(auth)
    if (existingAfterCreate) return existingAfterCreate
    try {
      const signedIn = await withTimeout(
        signInWithEmailAndPassword(auth, emailLower, password),
        AUTH_SIGN_IN_MS,
        authBusyMessage
      )
      return signedIn.user.uid
    } catch (signInError) {
      const existingAfterSignIn = signedInUserId(auth)
      if (existingAfterSignIn) return existingAfterSignIn
      throw signInError
    }
  }
}
