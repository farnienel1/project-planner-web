/**
 * iOS parity source: FirebaseBackend.swift mergePlaceholderUserDocOntoAuthUidIfNeeded ~L3319
 * Spec: docs/ios-parity/01-data-model.md §2, Blueprint §1.3
 *
 * Invited users live at users/{uppercase UUID} until first sign-in. Copy fields onto users/{authUid}.
 */

import { collection, deleteDoc, doc, getDocs, limit, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import { ageConfirmationWriteFields } from '@/lib/legal/ageConfirmation'

export function placeholderMergeFields(
  placeholderData: Record<string, unknown>,
  authEmail: string,
  organizationId: string
): Record<string, unknown> {
  const now = Timestamp.now()
  return {
    ...placeholderData,
    email: authEmail.toLowerCase().trim(),
    organizationId,
    updatedAt: now,
    passwordSet: true,
    ...ageConfirmationWriteFields(now),
  }
}

export async function mergePlaceholderUserDocOntoAuthUidIfNeeded(
  authUid: string,
  rawEmail: string
): Promise<boolean> {
  const email = rawEmail.trim()
  if (!authUid || !email) return false

  const db = getFirebaseDb()
  const variants = Array.from(new Set([email, email.toLowerCase()].filter(Boolean)))

  for (const variant of variants) {
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', variant), limit(8)))
    for (const placeholder of snap.docs) {
      if (placeholder.id === authUid) continue
      const data = placeholder.data() as Record<string, unknown>
      const orgId = typeof data.organizationId === 'string' ? data.organizationId.trim() : ''
      if (!orgId) continue
      const merged = placeholderMergeFields(data, email, orgId)
      // Self-create is allowed only when this email pointer is missing or already this uid.
      await setDoc(
        doc(db, 'organizations', orgId, 'userEmails', email.toLowerCase()),
        { userId: authUid },
        { merge: true }
      )
      await setDoc(doc(db, 'users', authUid), merged, { merge: true })
      try {
        await deleteDoc(placeholder.ref)
      } catch (error) {
        console.warn('Invite placeholder left in place after merge', placeholder.id, error)
      }
      return true
    }
  }
  return false
}
