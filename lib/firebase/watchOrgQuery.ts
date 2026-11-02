/**
 * Screen-scoped live listeners (rulebook 1.9.0 §1 "Live screens", `LIVE_COLLECTIONS`). A screen that shows shared
 * data attaches one of these in an effect and returns the unsubscribe as the cleanup, so the listener lives exactly
 * while the screen is open and is replaced when the open organisation changes. Results for an organisation that is
 * no longer open are dropped (`liveResultStillCurrent`).
 *
 * Long-lived store data (projects, operatives, annual leave…) uses `subscribeOrgCollectionLoaded` instead.
 */

import {
  collection,
  doc,
  onSnapshot,
  query,
  type FirestoreError,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { liveResultStillCurrent } from '@/lib/firebase/liveResult'
import type { OrgCollectionDoc } from '@/lib/firebase/subscribeOrgCollection'

const noop: Unsubscribe = () => {}

/** Listen to `organizations/{orgId}/{collectionName}` (optionally bounded). */
export function watchOrgCollection(
  organizationId: string,
  collectionName: string,
  onDocs: (docs: OrgCollectionDoc[]) => void,
  options?: { constraints?: QueryConstraint[]; onError?: (error: FirestoreError) => void }
): Unsubscribe {
  if (!db || !organizationId || !collectionName) return noop
  const col = collection(db, 'organizations', organizationId, collectionName)
  const source = options?.constraints?.length ? query(col, ...options.constraints) : col
  return onSnapshot(
    source,
    (snap) => {
      if (!liveResultStillCurrent(organizationId)) return
      onDocs(snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> })))
    },
    (error) => options?.onError?.(error)
  )
}

/** What a document listener reports with each snapshot. */
export type WatchedDocumentMeta = {
  exists: boolean
  /** True while this device's own write has not reached the server (latency compensation). */
  hasPendingWrites: boolean
}

/** Listen to one organisation document, `organizations/{orgId}/{...segments}`. */
export function watchOrgDocument(
  organizationId: string,
  segments: string[],
  onData: (data: Record<string, unknown> | null, meta: WatchedDocumentMeta) => void,
  options?: { onError?: (error: FirestoreError) => void }
): Unsubscribe {
  if (!db || !organizationId || segments.length === 0 || segments.length % 2 !== 0) return noop
  const ref = doc(db, 'organizations', organizationId, ...segments)
  return onSnapshot(
    ref,
    (snap) => {
      if (!liveResultStillCurrent(organizationId)) return
      onData(snap.exists() ? (snap.data() as Record<string, unknown>) : null, {
        exists: snap.exists(),
        hasPendingWrites: snap.metadata.hasPendingWrites,
      })
    },
    (error) => options?.onError?.(error)
  )
}
