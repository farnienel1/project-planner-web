import { getFirebaseAuth } from '@/lib/firebase/ensureFirebase'

/** Browser helper — attach the signed-in user's ID token to same-origin API calls. */
export async function getClientAuthHeaders(): Promise<Record<string, string>> {
  try {
    const user = getFirebaseAuth().currentUser
    if (!user) return {}
    const token = await user.getIdToken()
    return { Authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

export async function jsonAuthHeaders(): Promise<Record<string, string>> {
  const authHeaders = await getClientAuthHeaders()
  return { 'Content-Type': 'application/json', ...authHeaders }
}
