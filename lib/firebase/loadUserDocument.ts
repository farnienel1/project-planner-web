import { doc, getDoc, type DocumentSnapshot } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'

/** Org setup writes the Auth user before the Firestore user doc — retry briefly to avoid a race. */
export async function loadUserDocumentWithRetry(
  userId: string,
  attempts = 8
): Promise<DocumentSnapshot> {
  const db = getFirebaseDb()

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const snap = await getDoc(doc(db, 'users', userId))
    if (snap.exists()) return snap
    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
    }
  }

  return getDoc(doc(db, 'users', userId))
}
