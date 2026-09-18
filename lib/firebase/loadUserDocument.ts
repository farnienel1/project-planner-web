import { doc, getDoc, type DocumentSnapshot } from 'firebase/firestore'
import { withTimeout } from '@/lib/client/withTimeout'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'

const PROFILE_GET_MS = 3500
const PROFILE_TIMEOUT_MESSAGE =
  'Loading your profile is taking too long. Check your connection, then try Sign in again.'

/** Org setup writes the Auth user before the Firestore user doc — retry briefly to avoid a race. */
export async function loadUserDocumentWithRetry(
  userId: string,
  attempts = 3
): Promise<DocumentSnapshot> {
  const db = getFirebaseDb()
  let last: DocumentSnapshot | undefined

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      last = await withTimeout(
        getDoc(doc(db, 'users', userId)),
        PROFILE_GET_MS,
        PROFILE_TIMEOUT_MESSAGE
      )
      if (last.exists()) return last
    } catch (error) {
      if (attempt === attempts - 1) throw error
    }
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
    }
  }

  if (last) return last
  return withTimeout(getDoc(doc(db, 'users', userId)), PROFILE_GET_MS, PROFILE_TIMEOUT_MESSAGE)
}
