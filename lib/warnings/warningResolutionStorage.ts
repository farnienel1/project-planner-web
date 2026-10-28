import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { resolvedWarningKeys } from '@/lib/canonical'

/**
 * Keys of warnings approved or removed on any device: `organizations/{orgId}/warningResolutions`,
 * read through the rulebook's `resolvedWarningKeys`.
 */
export async function loadResolvedWarningKeys(organizationId: string): Promise<string[]> {
  const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'warningResolutions'))
  return resolvedWarningKeys(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })))
}
