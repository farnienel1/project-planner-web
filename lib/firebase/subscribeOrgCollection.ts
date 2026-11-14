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
  getCountFromServer,
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
import { unsubscribeOrgPlansOutside } from '@/lib/firebase/subscribeOrgPlan'
import { cachedReplayAuthoritative, isMetadataOnlySnapshot, mergeOrgCollectionSnapshot, type OrgCollectionDoc } from '@/lib/firebase/orgCollectionMerge'

export type { OrgCollectionDoc } from '@/lib/firebase/orgCollectionMerge'

const unsubs = new Map<string, Unsubscribe>()
const orgs = new Map<string, string>()
const collectionNames = new Map<string, string>()
const queryIds = new Map<string, string>()
const queryConstraints = new Map<string, QueryConstraint[]>()
const lastDocs = new Map<string, OrgCollectionDoc[]>()
const removedDocIds = new Map<string, Set<string>>()
/** `{orgId}|{queryId}` of the listener that has delivered at least one snapshot, per key. */
const delivered = new Map<string, string>()
/** Keys whose listener the server refused (kept for the data check, rulebook 1.38.0 §27, until it re-attaches). */
const failedKeys = new Set<string>()
/**
 * Rulebook 1.38.0 §27 (the data check), per key: `{orgId}|{queryId}` of the listener that has delivered a server
 * (not cache) snapshot. Rows held from an earlier bound (the bookings window moved) or from the cache linger until
 * that server snapshot arrives, so the check waits for it instead of counting them.
 */
const serverDelivered = new Map<string, string>()
/** Per key: whether the last snapshot carried this device's unconfirmed writes, and which documents did. */
const pendingWrites = new Map<string, { any: boolean; ids: Set<string> }>()
const firstSnapshotWaiters = new Map<string, Array<{ resolve: () => void; reject: (error: unknown) => void }>>()
/**
 * How a published list was read. `authoritative` is true for a server snapshot or a server re-read: rows missing
 * from it are gone. A cache snapshot (or the remembered list replayed on re-attach) is not.
 */
export type OrgCollectionSnapshotMeta = { authoritative: boolean }
export type OrgCollectionDocsHandler = (docs: OrgCollectionDoc[], meta?: OrgCollectionSnapshotMeta) => void

const listeners = new Map<
  string,
  {
    onDocs: OrgCollectionDocsHandler
    onError?: (error: FirestoreError) => void
  }
>()

function cacheKey(key: string, organizationId: string): string {
  return `${key}:${organizationId}`
}

function emitDocs(
  snap: { docs: { id: string; data: () => Record<string, unknown> }[] },
  onDocs: OrgCollectionDocsHandler
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
  onDocs: OrgCollectionDocsHandler,
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
    // 1.43.0: the remembered list is the server's copy of THIS query only when the live listener is this query and
    // has had a server snapshot (the cache is keyed by key + organisation, not by query: a widened bound replays the
    // narrower rows first).
    const serverCopyOfThisQuery = cachedReplayAuthoritative({
      liveQueryId: orgs.get(key) === organizationId && unsubs.has(key) ? (queryIds.get(key) ?? '') : null,
      requestedQueryId: queryId,
      serverDeliveredQuery: serverDelivered.get(key) ?? null,
      organizationId,
    })
    onDocs(cached, { authoritative: serverCopyOfThisQuery })
  }

  if (!db) return
  const col = collection(db, 'organizations', organizationId, collectionName)
  const source: Query = constraints.length > 0 ? query(col, ...constraints) : col
  const emit = (snap: {
    docs: { id: string; data: () => Record<string, unknown>; metadata?: { hasPendingWrites: boolean } }[]
    metadata?: { fromCache: boolean; hasPendingWrites?: boolean }
  }) => {
    // A listener started for organisation A must not publish into the callback
    // that was replaced when the user switched to organisation B.
    if (orgs.get(key) !== organizationId) return
    const current = activeCallback(key)
    if (!current) return
    // An empty cache snapshot must not wipe bookings or the other live org collections, and a shorter one never
    // drops a row (rulebook 1.38.0 §27). A server snapshot is the collection: a row deleted on another device
    // (even the last one) leaves the list. The merge is pure (`mergeOrgCollectionSnapshot`) so the data-parity
    // fixture runs it in tests.
    const { docs: kept, authoritative } = mergeOrgCollectionSnapshot({
      previous: lastDocs.get(storedKey) ?? [],
      docs: snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> })),
      removedIds: removedDocIds.get(storedKey) ?? null,
      fromCache: snap.metadata ? snap.metadata.fromCache : null,
    })
    lastDocs.set(storedKey, kept)
    pendingWrites.set(key, {
      any: snap.metadata?.hasPendingWrites === true,
      ids: new Set(snap.docs.filter((entry) => entry.metadata?.hasPendingWrites === true).map((entry) => entry.id)),
    })
    current.onDocs(kept, { authoritative })
  }

  if (isOrgCollectionSubscribed(key, organizationId, queryId)) {
    return
  }

  unsubs.get(key)?.()
  unsubs.delete(key)
  delivered.delete(key)
  serverDelivered.delete(key)
  pendingWrites.delete(key)
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
      // Rulebook 1.26.0: a listener the server refused is dead. Forget it, so the next subscribe for this key (a re-plan
      // after a security switch changed, the Refresh button, reopening the screen) starts it again instead of
      // treating it as live.
      unsubs.get(key)?.()
      unsubs.delete(key)
      delivered.delete(key)
      failedKeys.add(key)
      activeCallback(key)?.onError?.(error)
      settleFirstSnapshot(key, error)
    }

    unsubs.get(key)?.()
    const unsub = onSnapshot(
      source,
      // Rulebook 1.38.0 §27: metadata changes only tell the data check the server answered (see below).
      { includeMetadataChanges: true },
      (snap) => {
        if (!stillThisQuery()) return
        failedKeys.delete(key)
        const thisQuery = `${organizationId}|${queryId}`
        const held = lastDocs.get(cacheKey(key, organizationId)) ?? []
        // A server confirmation while rows kept from a cache snapshot or an older bound are still held is published
        // (it is the collection, and drops them); otherwise a metadata-only snapshot only updates the flags.
        const heldIds = new Set(held.map((row) => row.id))
        const heldIsSnapshot = held.length === snap.docs.length && snap.docs.every((entry) => heldIds.has(entry.id))
        if (
          (snap.metadata.fromCache || heldIsSnapshot) &&
          isMetadataOnlySnapshot({ documentChangeCount: snap.docChanges().length, deliveredBefore: delivered.get(key) === thisQuery })
        ) {
          // The server confirmed the cached copy or acknowledged a write; no document changed. Flags only — the
          // store is not called, so it sees exactly the snapshots it saw before — except once, when this is the
          // query's first server answer: 1.43.0 re-publishes the same rows as authoritative, so a screen waiting for
          // the server (a timesheet's bookings, `timesheetSnapshotReady`) learns the held rows are complete.
          const firstServerAnswer = !snap.metadata.fromCache && serverDelivered.get(key) !== thisQuery
          if (!snap.metadata.fromCache) serverDelivered.set(key, thisQuery)
          pendingWrites.set(key, {
            any: snap.metadata.hasPendingWrites,
            ids: new Set(snap.docs.filter((entry) => entry.metadata.hasPendingWrites).map((entry) => entry.id)),
          })
          if (firstServerAnswer && heldIsSnapshot) activeCallback(key)?.onDocs(held, { authoritative: true })
          return
        }
        emit(snap)
        delivered.set(key, `${organizationId}|${queryId}`)
        if (!snap.metadata.fromCache) serverDelivered.set(key, `${organizationId}|${queryId}`)
        settleFirstSnapshot(key, null)
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
 * A document this device just created or changed whose write the server has not confirmed yet is not in a server
 * read: keep this device's copy (appended to `docs`), so a re-read never drops it — the listener's next snapshot
 * settles it. Documents this app deleted stay out.
 */
function withPendingLocalDocs(key: string, storedKey: string, docs: OrgCollectionDoc[]): void {
  const pendingIds = pendingWrites.get(key)?.ids
  if (!pendingIds || pendingIds.size === 0) return
  const removed = removedDocIds.get(storedKey)
  const fetched = new Set(docs.map((entry) => entry.id))
  for (const entry of lastDocs.get(storedKey) ?? []) {
    if (pendingIds.has(entry.id) && !fetched.has(entry.id) && !removed?.has(entry.id)) docs.push(entry)
  }
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
          withPendingLocalDocs(key, storedKey, docs)
          lastDocs.set(storedKey, docs)
          activeCallback(key)?.onDocs(docs, { authoritative: true })
        })
        .catch(() => {
          /* The live listener keeps what it has. */
        })
    )
  }
  await Promise.all(work)
}

/**
 * Rulebook 1.38.0 §27 (the data check): one listener's query and the documents this app holds for it, before any
 * rulebook filtering. Null until the listener has delivered a snapshot or been refused. `live` is false for a
 * listener the server refused (its last documents are still what the app shows).
 */
export function orgCollectionParitySource(
  key: string,
  organizationId: string
): {
  collectionName: string
  constraints: QueryConstraint[]
  docs: OrgCollectionDoc[]
  live: boolean
  /** A server snapshot of the current query has arrived (or the listener was refused: its rows are what is shown). */
  serverSnapshot: boolean
  /** The last snapshot carried this device's writes the server has not confirmed yet. */
  pendingWrites: boolean
} | null {
  const collectionName = collectionNames.get(key)
  if (!organizationId || orgs.get(key) !== organizationId || !collectionName) return null
  const queryId = queryIds.get(key) ?? ''
  const hasDelivered = delivered.get(key) === `${organizationId}|${queryId}`
  if (!hasDelivered && !failedKeys.has(key)) return null
  return {
    collectionName,
    constraints: queryConstraints.get(key) ?? [],
    docs: lastDocs.get(cacheKey(key, organizationId)) ?? [],
    live: unsubs.has(key),
    serverSnapshot: failedKeys.has(key) || serverDelivered.get(key) === `${organizationId}|${queryId}`,
    pendingWrites: pendingWrites.get(key)?.any === true,
  }
}

/** The server's `count()` of exactly the listener's query (server source); null when it cannot be read. */
export async function countOrgCollectionFromServer(key: string, organizationId: string): Promise<number | null> {
  const source = orgCollectionParitySource(key, organizationId)
  if (!db || !source) return null
  const col = collection(db, 'organizations', organizationId, source.collectionName)
  const counted: Query = source.constraints.length > 0 ? query(col, ...source.constraints) : col
  try {
    await waitForAuthToken()
    const snap = await getCountFromServer(counted)
    return snap.data().count
  } catch {
    return null
  }
}

/**
 * Self-heal for one listener (rulebook 1.38.0 §27): read its query from the server and publish it as authoritative,
 * and start the listener again when the server had refused it. Documents deleted in this app stay hidden.
 */
export async function reloadOrgCollectionFromServer(key: string, organizationId: string): Promise<boolean> {
  const collectionName = collectionNames.get(key)
  const current = activeCallback(key)
  if (!db || !organizationId || orgs.get(key) !== organizationId || !collectionName || !current) return false
  const storedKey = cacheKey(key, organizationId)
  const constraints = queryConstraints.get(key) ?? []
  const queryId = queryIds.get(key) ?? ''
  const col = collection(db, 'organizations', organizationId, collectionName)
  const source: Query = constraints.length > 0 ? query(col, ...constraints) : col
  try {
    await waitForAuthToken()
    const snap = await getDocsFromServer(source)
    if (orgs.get(key) !== organizationId || (queryIds.get(key) ?? '') !== queryId) return false
    const removed = removedDocIds.get(storedKey)
    const docs = snap.docs
      .filter((entry) => !removed?.has(entry.id))
      .map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> }))
    withPendingLocalDocs(key, storedKey, docs)
    lastDocs.set(storedKey, docs)
    activeCallback(key)?.onDocs(docs, { authoritative: true })
  } catch {
    return false
  }
  if (!unsubs.has(key)) {
    subscribeOrgCollection(key, organizationId, collectionName, current.onDocs, current.onError, { constraints, queryId })
  }
  return true
}

export function unsubscribeOrgCollection(key: string): void {
  failedKeys.delete(key)
  serverDelivered.delete(key)
  pendingWrites.delete(key)
  unsubs.get(key)?.()
  unsubs.delete(key)
  orgs.delete(key)
  queryIds.delete(key)
  queryConstraints.delete(key)
  listeners.delete(key)
  delivered.delete(key)
  settleFirstSnapshot(key, null)
}

function settleFirstSnapshot(key: string, error: unknown): void {
  const waiters = firstSnapshotWaiters.get(key)
  if (!waiters) return
  firstSnapshotWaiters.delete(key)
  for (const waiter of waiters) {
    if (error) waiter.reject(error)
    else waiter.resolve()
  }
}

/** True once this key's listener for this organisation (and bound) has delivered a snapshot. */
export function hasOrgCollectionSnapshot(key: string, organizationId: string, queryId = ''): boolean {
  return delivered.get(key) === `${organizationId}|${queryId}` && isOrgCollectionSubscribed(key, organizationId, queryId)
}

/**
 * Rulebook 1.9.0 §1 "Live screens" (`LIVE_COLLECTIONS`): the screen's load is the listener. Start (or re-attach to)
 * the live listener and resolve when its first snapshot has been applied — at once when the listener is already
 * live. The listener stays open, so later edits on any platform arrive without a reload. Rejects with the listener
 * error (after its own auth retries).
 */
export function subscribeOrgCollectionLoaded(
  key: string,
  organizationId: string,
  collectionName: string,
  onDocs: OrgCollectionDocsHandler,
  options?: SubscribeOrgCollectionOptions
): Promise<void> {
  if (!organizationId) return Promise.resolve()
  const queryId = options?.queryId ?? ''
  const promise = hasOrgCollectionSnapshot(key, organizationId, queryId) || !db
    ? Promise.resolve()
    : new Promise<void>((resolve, reject) => {
        const waiters = firstSnapshotWaiters.get(key) ?? []
        waiters.push({ resolve, reject })
        firstSnapshotWaiters.set(key, waiters)
      })
  subscribeOrgCollection(key, organizationId, collectionName, onDocs, undefined, options)
  return promise
}

/**
 * The open organisation changed (or the user signed out): stop every listener that belongs to another
 * organisation, so a store never receives that company's rows again (`adoptCurrentOrganization`).
 */
export function unsubscribeOrgCollectionsOutside(organizationId: string): void {
  // Rulebook 1.10.0 §17: read-plan listeners (several queries per store) close with the organisation too.
  unsubscribeOrgPlansOutside(organizationId)
  const keep = String(organizationId || '').trim().toLowerCase()
  for (const [key, org] of [...orgs]) {
    if (keep && String(org || '').trim().toLowerCase() === keep) continue
    unsubscribeOrgCollection(key)
  }
}
