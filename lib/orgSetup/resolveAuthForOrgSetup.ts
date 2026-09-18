import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  type Auth,
} from 'firebase/auth'
import { getFirebaseAuth } from '@/lib/firebase/ensureFirebase'
import { isEmailInUseError } from '@/lib/orgSetup/authSetupErrors'

async function waitForAuthSession(auth: Auth): Promise<void> {
  const ready = (auth as Auth & { authStateReady?: () => Promise<void> }).authStateReady
  if (typeof ready === 'function') {
    await ready.call(auth)
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

  try {
    const created = await createUserWithEmailAndPassword(auth, emailLower, password)
    return created.user.uid
  } catch (error) {
    if (!isEmailInUseError(error)) throw error
    const existingAfterCreate = signedInUserId(auth)
    if (existingAfterCreate) return existingAfterCreate
    try {
      const signedIn = await signInWithEmailAndPassword(auth, emailLower, password)
      return signedIn.user.uid
    } catch (signInError) {
      const existingAfterSignIn = signedInUserId(auth)
      if (existingAfterSignIn) return existingAfterSignIn
      throw signInError
    }
  }
}
