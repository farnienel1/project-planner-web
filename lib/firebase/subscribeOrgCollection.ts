/**
 * Live org subcollection listener. iOS uses onSnapshot for bookings, managerSiteBookings,
 * notifications (inbox), materials (per project), and the organisation document.
 */

import { collection, getDocs, onSnapshot, type FirestoreError, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

const unsubs = new Map<string, Unsubscribe>()
const orgs = new Map<string, string>()
const listeners = new Map<
  string,
  {
    onDocs: (docs: { id: string; data: Record<string, unknown> }[]) => void
    onError?: (error: FirestoreError) => void
  }
>()

function emitDocs(
  snap: { docs: { id: string; data: () => Record<string, unknown> }[] },
  onDocs: (docs: { id: string; data: Record<string, unknown> }[]) => void
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

export function subscribeOrgCollection(
  key: string,
  organizationId: string,
  collectionName: string,
  onDocs: (docs: { id: string; data: Record<string, unknown> }[]) => void,
  onError?: (error: FirestoreError) => void
): void {
  listeners.set(key, { onDocs, onError })
  if (!db) return
  const col = collection(db, 'organizations', organizationId, collectionName)
  const emit = (snap: { docs: { id: string; data: () => Record<string, unknown> }[] }) => {
    const current = activeCallback(key)
    if (current) emitDocs(snap, current.onDocs)
  }
  const fail = (error: FirestoreError) => {
    activeCallback(key)?.onError?.(error)
  }
  // Always re-seed. If Home already has onSnapshot, Daily Overview / Weekly Report
  // still need getDocs so they do not sit empty waiting for a snapshot that already fired.
  getDocs(col).then(emit).catch(fail)

  if (isOrgCollectionSubscribed(key, organizationId)) return

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
