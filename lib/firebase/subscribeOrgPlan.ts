/**
 * Rulebook 1.10.0 §17 (rules-compatible reads): a viewer who may not read a whole job or booking collection runs
 * the queries of the rulebook's plan (`jobQueryPlan` / `bookingQueryPlan`) instead — several bounded queries or
 * single documents — and the store shows their merged result. Firestore rules are not filters: a whole-collection
 * listener for such a viewer is refused outright, so the store must never fall back to one.
 *
 * Each part is its own live listener. Parts that leave the plan (a job removed from the manager) are closed and
 * their rows dropped at once; there is no retain-on-empty here, because each part is an exact query.
 */

import {
  collection,
  doc,
  getCountFromServer,
  onSnapshot,
  query,
  type FirestoreError,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { waitForAuthToken } from '@/lib/firebase/waitForAuthToken'
import type { OrgCollectionDoc } from '@/lib/firebase/subscribeOrgCollection'
import {
  isMetadataOnlySnapshot,
  mergeOrgCollectionSnapshot,
  orgPlanAuthoritative,
  republishHeldAsAuthoritative,
} from '@/lib/firebase/orgCollectionMerge'

/** One query of a plan: `constraints` on the collection, or one `documentId`. `id` names it stably. */
export type OrgPlanPart = { id: string; constraints?: QueryConstraint[]; documentId?: string }

type PartState = {
  unsub: Unsubscribe | null
  docs: OrgCollectionDoc[]
  settled: boolean
  failed?: boolean
  /** Rulebook 1.38.0 §27: a server (not cache) snapshot of this part has arrived. */
  serverSnapshot?: boolean
  /** The last snapshot carried this device's writes the server has not confirmed yet. */
  pendingWrites?: boolean
  /**
   * Restarted by the data check (`restartOrgPlan`): `docs` are the old part's documents, kept on screen until this
   * part's first server snapshot; a cache snapshot before it only adds and updates (`mergeOrgCollectionSnapshot`).
   */
  seeded?: boolean
  /** A snapshot of this part has been published (its first is never metadata-only). */
  delivered?: boolean
  /**
   * 1.43.0 (review r318): this part's rows as published now are the server's answer — set by each delivered snapshot
   * (not from cache) and by a server confirmation of unchanged rows; a cached change clears it (`serverSnapshot` above
   * stays true once the server has ever answered, for the data check).
   */
  currentFromServer?: boolean
}
type PlanState = {
  organizationId: string
  collectionName: string
  parts: Map<string, PartState>
  onDocs: (docs: OrgCollectionDoc[], meta?: { authoritative: boolean }) => void
  onError?: (error: FirestoreError) => void
  waiters: Array<() => void>
  removed: Set<string>
}

const plans = new Map<string, PlanState>()
/** Each plan's part definitions, for the data check's counts and restart (rulebook 1.38.0 §27). */
const planPartDefinitions = new Map<string, Map<string, OrgPlanPart>>()

function emit(state: PlanState) {
  const byId = new Map<string, OrgCollectionDoc>()
  for (const part of state.parts.values()) {
    for (const entry of part.docs) {
      if (!state.removed.has(entry.id)) byId.set(entry.id, entry)
    }
  }
  // 1.43.0: the merged rows are complete only when every part has had a server answer (none refused). The first
  // publish, before any part answered, and a cache snapshot are not (a timesheet must not be signed on them).
  const parts = [...state.parts.values()].map((part) => ({ settled: part.settled, failed: part.failed, serverSnapshot: part.currentFromServer === true }))
  state.onDocs([...byId.values()], { authoritative: orgPlanAuthoritative(parts) })
}

function settle(state: PlanState) {
  if ([...state.parts.values()].some((part) => !part.settled)) return
  const waiters = state.waiters.splice(0)
  for (const resolve of waiters) resolve()
}

function startPart(key: string, state: PlanState, part: OrgPlanPart, seed?: readonly OrgCollectionDoc[]): PartState {
  const partState: PartState = { unsub: null, docs: seed ? [...seed] : [], settled: false, seeded: Boolean(seed) }
  if (!db) {
    partState.settled = true
    return partState
  }
  const firestore = db
  const live = () => plans.get(key) === state && state.parts.get(part.id) === partState
  void waitForAuthToken().finally(() => {
    if (!live()) return
    const onError = (error: FirestoreError) => {
      if (!live()) return
      partState.seeded = false
      partState.docs = []
      partState.settled = true
      partState.failed = true
      state.onError?.(error)
      emit(state)
      settle(state)
    }
    if (part.documentId) {
      partState.unsub = onSnapshot(
        doc(firestore, 'organizations', state.organizationId, state.collectionName, part.documentId),
        (snap) => {
          if (!live()) return
          partState.docs = snap.exists() ? [{ id: snap.id, data: (snap.data() ?? {}) as Record<string, unknown> }] : []
          partState.seeded = false
          partState.serverSnapshot = partState.serverSnapshot || !snap.metadata.fromCache
          partState.currentFromServer = !snap.metadata.fromCache
          partState.pendingWrites = snap.metadata.hasPendingWrites
          partState.settled = true
          emit(state)
          settle(state)
        },
        onError
      )
      return
    }
    const col = collection(firestore, 'organizations', state.organizationId, state.collectionName)
    const source = part.constraints?.length ? query(col, ...part.constraints) : col
    partState.unsub = onSnapshot(
      source,
      // Rulebook 1.38.0 §27: metadata changes only tell the data check the server answered.
      { includeMetadataChanges: true },
      (snap) => {
        if (!live()) return
        if (
          !partState.seeded &&
          isMetadataOnlySnapshot({ documentChangeCount: snap.docChanges().length, deliveredBefore: partState.delivered === true })
        ) {
          const republish = republishHeldAsAuthoritative({
            fromCache: snap.metadata.fromCache,
            hasPendingWrites: snap.metadata.hasPendingWrites,
            heldIsSnapshot: true,
            lastPublishAuthoritative: partState.currentFromServer === true,
          })
          partState.serverSnapshot = partState.serverSnapshot || !snap.metadata.fromCache
          partState.pendingWrites = snap.metadata.hasPendingWrites
          // 1.43.0 (review r318): a server confirmation of this part's unchanged rows after its first answer or a
          // cached change is published, so the plan can turn (back) authoritative.
          if (republish) {
            partState.currentFromServer = true
            emit(state)
          }
          return
        }
        partState.delivered = true
        const docs = snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> }))
        if (partState.seeded && snap.metadata.fromCache) {
          // Restarted by the data check: until the server answers, a cache snapshot never drops a row on screen.
          partState.docs = mergeOrgCollectionSnapshot({ previous: partState.docs, docs, fromCache: true }).docs
        } else {
          partState.docs = docs
          partState.seeded = false
        }
        partState.serverSnapshot = partState.serverSnapshot || !snap.metadata.fromCache
        partState.currentFromServer = !snap.metadata.fromCache
        partState.pendingWrites = snap.metadata.hasPendingWrites
        partState.settled = true
        emit(state)
        settle(state)
      },
      onError
    )
  })
  return partState
}

/**
 * Listen to the plan's parts for `key` and publish the merged rows. Calling again with a new part list keeps the
 * parts that are still in it, opens the new ones and closes the rest. Resolves when every part has delivered its
 * first snapshot (or failed).
 */
export function subscribeOrgPlan(
  key: string,
  organizationId: string,
  collectionName: string,
  parts: ReadonlyArray<OrgPlanPart>,
  onDocs: (docs: OrgCollectionDoc[], meta?: { authoritative: boolean }) => void,
  onError?: (error: FirestoreError) => void
): Promise<void> {
  let state = plans.get(key)
  if (!state || state.organizationId !== organizationId || state.collectionName !== collectionName) {
    unsubscribeOrgPlan(key)
    state = { organizationId, collectionName, parts: new Map(), onDocs, onError, waiters: [], removed: new Set() }
    plans.set(key, state)
  }
  state.onDocs = onDocs
  state.onError = onError
  const wanted = new Map(parts.map((part) => [part.id, part]))
  planPartDefinitions.set(key, wanted)
  for (const [id, part] of [...state.parts]) {
    if (wanted.has(id)) continue
    part.unsub?.()
    state.parts.delete(id)
  }
  for (const [id, part] of wanted) {
    const existing = state.parts.get(id)
    // Rulebook 1.26.0: a part the server refused is started again (a re-plan after a security switch changed).
    if (existing?.failed) {
      existing.unsub?.()
      state.parts.delete(id)
    }
    if (!state.parts.has(id)) state.parts.set(id, startPart(key, state, part))
  }
  emit(state)
  const current = state
  return new Promise<void>((resolve) => {
    current.waiters.push(resolve)
    settle(current)
  })
}

export function isOrgPlanSubscribed(key: string, organizationId: string): boolean {
  return plans.get(key)?.organizationId === organizationId
}

/** The app deleted this document: drop it from the merged rows. */
export function forgetOrgPlanDoc(key: string, organizationId: string, id: string): void {
  const state = plans.get(key)
  if (!state || state.organizationId !== organizationId || !id) return
  state.removed.add(id)
  emit(state)
}

export function unsubscribeOrgPlan(key: string): void {
  const state = plans.get(key)
  if (!state) return
  for (const part of state.parts.values()) part.unsub?.()
  plans.delete(key)
  planPartDefinitions.delete(key)
  for (const resolve of state.waiters.splice(0)) resolve()
}

/** The open organisation changed: close every plan of another organisation. */
export function unsubscribeOrgPlansOutside(organizationId: string): void {
  const keep = String(organizationId || '').trim().toLowerCase()
  for (const [key, state] of [...plans]) {
    if (keep && state.organizationId.trim().toLowerCase() === keep) continue
    unsubscribeOrgPlan(key)
  }
}

/**
 * Rulebook 1.38.0 §27 (the data check): the plan's parts and the merged documents this app holds for it. A plan
 * with a part read by document id (an operative's jobs) is not counted (`documentReads`).
 */
export function orgPlanParitySource(
  key: string,
  organizationId: string
): {
  collectionName: string
  documentReads: boolean
  docs: OrgCollectionDoc[]
  settled: boolean
  /** Every query part has had a server answer (or was refused). */
  serverSnapshot: boolean
  pendingWrites: boolean
} | null {
  const state = plans.get(key)
  if (!state || state.organizationId !== organizationId) return null
  const byId = new Map<string, OrgCollectionDoc>()
  for (const part of state.parts.values()) {
    for (const entry of part.docs) if (!state.removed.has(entry.id)) byId.set(entry.id, entry)
  }
  const parts = [...state.parts.values()]
  return {
    collectionName: state.collectionName,
    documentReads: [...state.parts.keys()].some((id) => planPartDefinitions.get(key)?.get(id)?.documentId),
    docs: [...byId.values()],
    settled: parts.every((part) => part.settled),
    serverSnapshot: parts.every((part) => part.failed === true || part.serverSnapshot === true),
    pendingWrites: parts.some((part) => part.pendingWrites === true),
  }
}

/** The server count of each part (summed by the caller with `dataParitySumCounts`); null for a part not counted. */
export async function countOrgPlanPartsFromServer(key: string, organizationId: string): Promise<Array<number | null>> {
  const state = plans.get(key)
  const definitions = planPartDefinitions.get(key)
  if (!db || !state || state.organizationId !== organizationId || !definitions) return [null]
  const firestore = db
  await waitForAuthToken()
  return Promise.all(
    [...state.parts.keys()].map(async (id) => {
      const part = definitions.get(id)
      if (!part || part.documentId) return null
      const col = collection(firestore, 'organizations', organizationId, state.collectionName)
      try {
        const snap = await getCountFromServer(part.constraints?.length ? query(col, ...part.constraints) : col)
        return snap.data().count
      } catch {
        return null
      }
    })
  )
}

/**
 * Self-heal (rulebook 1.38.0 §27): close and start again every part of the plan. Each new part starts with the old
 * part's documents and keeps them until its own first server snapshot, so nothing on screen empties or flickers
 * while the parts re-attach (nothing is published until a new part answers).
 */
export function restartOrgPlan(key: string, organizationId: string): boolean {
  const state = plans.get(key)
  const definitions = planPartDefinitions.get(key)
  if (!state || state.organizationId !== organizationId || !definitions) return false
  for (const [id, part] of [...state.parts]) {
    part.unsub?.()
    state.parts.delete(id)
    const definition = definitions.get(id)
    if (definition) state.parts.set(id, startPart(key, state, definition, part.failed ? undefined : part.docs))
  }
  return true
}
