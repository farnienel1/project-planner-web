/**
 * Live org subcollection listener. iOS uses onSnapshot for bookings, managerSiteBookings,
 * notifications (inbox), materials (per project), and the organisation document.
 *
 * Navigating between dashboard pages must not re-download the whole collection. Keep the
 * last snapshot in memory and skip re-subscribing when a listener is already live.
 *
 * The listener's first snapshot is the initial load. There is no separate getDocs: running
 * both on a cold load downloaded the whole collection twice.
 *
 * A caller may bound the listener with query constraints (bookings from a start day, like
 * iOS `whereField("date", isGreaterThanOrEqualTo:)`). `queryId` names that bound; a new
 * `queryId` for the same key replaces the listener and keeps the rows already on screen
 * until the new first snapshot arrives.
 */

import {
  collection,
  getDocsFromServer,
  onSnapshot,
  query,
  type FirestoreError,
  type Query,
  type QueryConstraint,
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
const queryIds = new Map<string, string>()
const queryConstraints = new Map<string, QueryConstraint[]>()
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

/**
 * True when this org already has a live listener — callers must not flip loading true.
 * With `queryId`, the live listener must also be the same bound.
 */
export function isOrgCollectionSubscribed(key: string, organizationId: string, queryId?: string): boolean {
  if (orgs.get(key) !== organizationId || !unsubs.has(key)) return false
  if (queryId === undefined) return true
  return (queryIds.get(key) ?? '') === queryId
}

export type SubscribeOrgCollectionOptions = {
  /** Constraints for a bounded listener (for example `where('date', '>=', start)`). */
  constraints?: QueryConstraint[]
  /** Stable name for the bound. Empty or missing means the whole collection. */
  queryId?: string
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
  onError?: (error: FirestoreError) => void,
  options?: SubscribeOrgCollectionOptions
): void {
  listeners.set(key, { onDocs, onError })
  const queryId = options?.queryId ?? ''
  const constraints = options?.constraints ?? []
  if (!organizationId) return

  const storedKey = cacheKey(key, organizationId)
  const cached = lastDocs.get(storedKey)
  if (cached) {
    onDocs(cached)
  }

  if (!db) return
  const col = collection(db, 'organizations', organizationId, collectionName)
  const source: Query = constraints.length > 0 ? query(col, ...constraints) : col
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

  if (isOrgCollectionSubscribed(key, organizationId, queryId)) {
    return
  }

  unsubs.get(key)?.()
  unsubs.delete(key)
  orgs.set(key, organizationId)
  collectionNames.set(key, collectionName)
  queryIds.set(key, queryId)
  queryConstraints.set(key, constraints)
  const stillThisQuery = () => orgs.get(key) === organizationId && (queryIds.get(key) ?? '') === queryId

  const listen = (attempt: number) => {
    const fail = (error: FirestoreError) => {
      if (!stillThisQuery()) return
      if (attempt < 3 && isRetryableAuthLoadError(error)) {
        globalThis.setTimeout(() => {
          if (!stillThisQuery()) return
          void waitForAuthToken().finally(() => listen(attempt + 1))
        }, authLoadRetryDelayMs(attempt))
        return
      }
      activeCallback(key)?.onError?.(error)
    }

    unsubs.get(key)?.()
    const unsub = onSnapshot(
      source,
      (snap) => {
        if (!stillThisQuery()) return
        emit(snap)
      },
      fail
    )
    unsubs.set(key, unsub)
  }

  void waitForAuthToken().finally(() => {
    if (!stillThisQuery()) return
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
    const constraints = queryConstraints.get(key) ?? []
    const queryId = queryIds.get(key) ?? ''
    const col = collection(firestore, 'organizations', organizationId, collectionName)
    const source: Query = constraints.length > 0 ? query(col, ...constraints) : col
    work.push(
      waitForAuthToken()
        .then(() => getDocsFromServer(source))
        .then((snap) => {
          if (orgs.get(key) !== organizationId || (queryIds.get(key) ?? '') !== queryId) return
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
  queryIds.delete(key)
  queryConstraints.delete(key)
  listeners.delete(key)
}
