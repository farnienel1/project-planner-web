/**
 * Live org subcollection listener. iOS uses onSnapshot for bookings, managerSiteBookings,
 * notifications (inbox), materials (per project), and the organisation document.
 */

import { collection, getDocs, onSnapshot, type FirestoreError, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

const unsubs = new Map<string, Unsubscribe>()
const orgs = new Map<string, string>()

function emitDocs(
  snap: { docs: { id: string; data: () => Record<string, unknown> }[] },
  onDocs: (docs: { id: string; data: Record<string, unknown> }[]) => void
) {
  onDocs(snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> })))
}

export function subscribeOrgCollection(
  key: string,
  organizationId: string,
  collectionName: string,
  onDocs: (docs: { id: string; data: Record<string, unknown> }[]) => void,
  onError?: (error: FirestoreError) => void
): void {
  if (orgs.get(key) === organizationId && unsubs.has(key)) return
  unsubs.get(key)?.()
  unsubs.delete(key)
  orgs.set(key, organizationId)
  if (!db) return
  const col = collection(db, 'organizations', organizationId, collectionName)
  // Seed with getDocs so Daily Overview / schedule paint even if onSnapshot is delayed.
  getDocs(col)
    .then((snap) => emitDocs(snap, onDocs))
    .catch((error) => onError?.(error as FirestoreError))
  const unsub = onSnapshot(
    col,
    (snap) => emitDocs(snap, onDocs),
    (error) => {
      onError?.(error)
    }
  )
  unsubs.set(key, unsub)
}

export function unsubscribeOrgCollection(key: string): void {
  unsubs.get(key)?.()
  unsubs.delete(key)
  orgs.delete(key)
}
