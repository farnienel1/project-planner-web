/**
 * Live org subcollection listener. iOS uses onSnapshot for bookings, managerSiteBookings,
 * notifications (inbox), materials (per project), and the organisation document.
 *
 * Navigating between dashboard pages must not re-download the whole collection. Keep the
 * last snapshot in memory and skip getDocs when a listener is already live.
 */

import { collection, getDocs, onSnapshot, type FirestoreError, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

export type OrgCollectionDoc = { id: string; data: Record<string, unknown> }

const unsubs = new Map<string, Unsubscribe>()
const orgs = new Map<string, string>()
const lastDocs = new Map<string, OrgCollectionDoc[]>()
const listeners = new Map<
  string,
  {
    onDocs: (docs: OrgCollectionDoc[]) => void
    onError?: (error: FirestoreError) => void
  }
>()

function cacheKey(key: string, organizationId: string): string {
  return `${key}:${organizationId}`
}

function emitDocs(
  snap: { docs: { id: string; data: () => Record<string, unknown> }[] },
  onDocs: (docs: OrgCollectionDoc[]) => void
) {
  onDocs(snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> })))
}

function activeCallback(key: string) {
  return listeners.get(key)
}

/** True when this org already has a live listener — callers must not flip loading true. */
export function isOrgCollectionSubscribed(key: string, organizationId: string): boolean {
  return orgs.get(key) === organizationId && unsubs.has(key)
}

export function peekOrgCollectionCache(key: string, organizationId: string): OrgCollectionDoc[] | null {
  return lastDocs.get(cacheKey(key, organizationId)) ?? null
}

export function subscribeOrgCollection(
  key: string,
  organizationId: string,
  collectionName: string,
  onDocs: (docs: OrgCollectionDoc[]) => void,
  onError?: (error: FirestoreError) => void
): void {
  listeners.set(key, { onDocs, onError })
  if (!organizationId) return

  const storedKey = cacheKey(key, organizationId)
  const cached = lastDocs.get(storedKey)
  if (cached) {
    onDocs(cached)
  }

  if (!db) return
  const col = collection(db, 'organizations', organizationId, collectionName)
  const emit = (snap: {
    docs: { id: string; data: () => Record<string, unknown> }[]
    metadata?: { fromCache: boolean }
  }) => {
    const current = activeCallback(key)
    if (!current) return
    const docs = snap.docs.map((entry) => ({
      id: entry.id,
      data: entry.data() as Record<string, unknown>,
    }))
    const previous = lastDocs.get(storedKey)
    // An empty from-cache snapshot after reconnect would briefly wipe bookings
    // and make unbooked-labour warnings explode. Keep the last good set.
    if (docs.length === 0 && previous && previous.length > 0 && snap.metadata?.fromCache) {
      current.onDocs(previous)
      return
    }
    lastDocs.set(storedKey, docs)
    current.onDocs(docs)
  }
  const fail = (error: FirestoreError) => {
    activeCallback(key)?.onError?.(error)
  }

  if (isOrgCollectionSubscribed(key, organizationId)) {
    return
  }

  // Skip the extra getDocs round-trip when this session already has a snapshot.
  if (!cached) {
    getDocs(col).then(emit).catch(fail)
  }

  unsubs.get(key)?.()
  unsubs.delete(key)
  orgs.set(key, organizationId)
  const unsub = onSnapshot(col, emit, fail)
  unsubs.set(key, unsub)
}

export function unsubscribeOrgCollection(key: string): void {
  unsubs.get(key)?.()
  unsubs.delete(key)
  orgs.delete(key)
  listeners.delete(key)
}
