import { createUserWithEmailAndPassword, type Auth } from 'firebase/auth'
import { withTimeout } from '@/lib/client/withTimeout'
import { completeEmailSignIn, waitForAuthSession } from '@/lib/auth/completeEmailSignIn'
import { getFirebaseAuth } from '@/lib/firebase/ensureFirebase'
import { isEmailInUseError, shouldAttemptCreateUserAfterSignInFailure } from '@/lib/orgSetup/authSetupErrors'

const AUTH_CREATE_MS = 20_000

function signedInUserId(auth: Auth): string | null {
  return auth.currentUser?.uid ?? null
}

/**
 * Reuse the signed-in account when creating another organisation.
 * Sign in first so an existing email never hits createUser (that call can hang).
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
    const signedIn = await completeEmailSignIn(auth, emailLower, password)
    return signedIn.uid
  } catch (signInError) {
    const existingAfterSignIn = signedInUserId(auth)
    if (existingAfterSignIn) return existingAfterSignIn
    if (!shouldAttemptCreateUserAfterSignInFailure(signInError)) throw signInError

    try {
      const created = await withTimeout(
        createUserWithEmailAndPassword(auth, emailLower, password),
        AUTH_CREATE_MS,
        authBusyMessage
      )
      return created.user.uid
    } catch (createError) {
      const existingAfterCreate = signedInUserId(auth)
      if (existingAfterCreate) return existingAfterCreate
      if (isEmailInUseError(createError)) throw signInError
      throw createError
    }
  }
}
