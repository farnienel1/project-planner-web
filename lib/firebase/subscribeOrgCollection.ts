/**
 * Live org subcollection listener. iOS uses onSnapshot for bookings, managerSiteBookings,
 * notifications (inbox), materials (per project), and the organisation document.
 */

import { collection, onSnapshot, type FirestoreError, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

const unsubs = new Map<string, Unsubscribe>()
const orgs = new Map<string, string>()

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
  const unsub = onSnapshot(
    collection(db, 'organizations', organizationId, collectionName),
    (snap) => {
      onDocs(snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> })))
    },
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
