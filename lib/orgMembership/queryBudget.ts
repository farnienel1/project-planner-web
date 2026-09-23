import { withTimeout } from '@/lib/client/withTimeout'

/** Bound a Firestore query so Switch organisation is not blocked on a slow collection scan. */
export async function queryWithin<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  try {
    return await withTimeout(promise, ms, 'org-membership-query')
  } catch {
    return null
  }
}
