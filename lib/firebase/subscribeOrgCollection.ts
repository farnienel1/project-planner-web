/**
 * Live org subcollection listener. iOS uses onSnapshot for bookings, managerSiteBookings,
 * notifications (inbox), materials (per project), and the organisation document.
 *
 * Navigating between dashboard pages must not re-download the whole collection. Keep the
 * last snapshot in memory and skip getDocs when a listener is already live.
 */

import {
  collection,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { isRetryableAuthLoadError, authLoadRetryDelayMs } from '@/lib/auth/authBoot'
import { waitForAuthToken } from '@/lib/firebase/waitForAuthToken'
import { retainLoadedRows } from '@/lib/staff/rosterRetain'

export type OrgCollectionDoc = { id: string; data: Record<string, unknown> }

const unsubs = new Map<string, Unsubscribe>()
const orgs = new Map<string, string>()
const collectionNames = new Map<string, string>()
const lastDocs = new Map<string, OrgCollectionDoc[]>()
const removedDocIds = new Map<string, Set<string>>()
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

/** The app deleted this document. Drop it from the retained snapshot so an empty listener cannot put it back. */
export function forgetOrgCollectionDoc(key: string, organizationId: string, id: string): void {
  if (!id) return
  const storedKey = cacheKey(key, organizationId)
  const removed = removedDocIds.get(storedKey) ?? new Set<string>()
  removed.add(id)
  removedDocIds.set(storedKey, removed)
  const previous = lastDocs.get(storedKey)
  if (previous) lastDocs.set(storedKey, previous.filter((entry) => entry.id !== id))
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
    // A listener started for organisation A must not publish into the callback
    // that was replaced when the user switched to organisation B.
    if (orgs.get(key) !== organizationId) return
    const current = activeCallback(key)
    if (!current) return
    const removed = removedDocIds.get(storedKey)
    const docs = snap.docs
      .filter((entry) => !removed?.has(entry.id))
      .map((entry) => ({
        id: entry.id,
        data: entry.data() as Record<string, unknown>,
      }))
    const previous = (lastDocs.get(storedKey) ?? []).filter((entry) => !removed?.has(entry.id))
    // An empty snapshot must not wipe bookings or the other live org collections.
    // A real delete is recorded with forgetOrgCollectionDoc first.
    const kept = retainLoadedRows(previous, docs)
    lastDocs.set(storedKey, kept)
    current.onDocs(kept)
  }

  if (isOrgCollectionSubscribed(key, organizationId)) {
    return
  }

  unsubs.get(key)?.()
  unsubs.delete(key)
  orgs.set(key, organizationId)
  collectionNames.set(key, collectionName)

  const listen = (attempt: number) => {
    const fail = (error: FirestoreError) => {
      if (orgs.get(key) !== organizationId) return
      if (attempt < 3 && isRetryableAuthLoadError(error)) {
        globalThis.setTimeout(() => {
          if (orgs.get(key) !== organizationId) return
          void waitForAuthToken().finally(() => listen(attempt + 1))
        }, authLoadRetryDelayMs(attempt))
        return
      }
      activeCallback(key)?.onError?.(error)
    }

    if (!cached && attempt === 0) {
      void waitForAuthToken()
        .then(() => getDocs(col))
        .then(emit)
        .catch((error) => fail(error as FirestoreError))
    }

    unsubs.get(key)?.()
    const unsub = onSnapshot(col, emit, fail)
    unsubs.set(key, unsub)
  }

  void waitForAuthToken().finally(() => {
    if (orgs.get(key) !== organizationId) return
    listen(0)
  })
}

/**
 * Re-read every live collection for this organisation from the server and publish it.
 * Used by the global Refresh button: onSnapshot normally keeps these current, but a
 * listener that stalled or a write from another device that has not arrived yet is
 * caught up here. Deleted documents recorded with forgetOrgCollectionDoc stay hidden.
 */
export async function refreshOrgCollections(organizationId: string): Promise<void> {
  if (!db || !organizationId) return
  const firestore = db
  const work: Promise<void>[] = []
  for (const [key, subscribedOrg] of orgs) {
    if (subscribedOrg !== organizationId) continue
    const collectionName = collectionNames.get(key)
    const current = activeCallback(key)
    if (!collectionName || !current) continue
    const storedKey = cacheKey(key, organizationId)
    work.push(
      waitForAuthToken()
        .then(() => getDocsFromServer(collection(firestore, 'organizations', organizationId, collectionName)))
        .then((snap) => {
          if (orgs.get(key) !== organizationId) return
          const removed = removedDocIds.get(storedKey)
          const docs = snap.docs
            .filter((entry) => !removed?.has(entry.id))
            .map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> }))
          lastDocs.set(storedKey, docs)
          activeCallback(key)?.onDocs(docs)
        })
        .catch(() => {
          /* The live listener keeps what it has. */
        })
    )
  }
  await Promise.all(work)
}

export function unsubscribeOrgCollection(key: string): void {
  unsubs.get(key)?.()
  unsubs.delete(key)
  orgs.delete(key)
  listeners.delete(key)
}
