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

export type WarningResolutionDoc = { id: string; resolutionKey: string; status: string; resolvedAt: Date | null }

/** Every `warningResolutions` row, for screens that list approvals (the weekly report's Approved clashes). */
export async function loadWarningResolutions(organizationId: string): Promise<WarningResolutionDoc[]> {
  const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'warningResolutions'))
  return snapshot.docs.map((entry) => {
    const data = entry.data()
    return {
      id: entry.id,
      resolutionKey: String(data.resolutionKey || entry.id),
      status: String(data.status || ''),
      resolvedAt: data.resolvedAt?.toDate?.() ?? null,
    }
  })
}
