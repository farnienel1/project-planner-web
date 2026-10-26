/**
 * Reads and writes users/{uid}/private/taxIds. Who may see them, the masking,
 * and the legacy fallback come from lib/canonical/sensitiveProfile.ts.
 */

import { deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import {
  resolveSensitiveProfile,
  sensitiveProfileDocPath,
  sensitiveProfileWriteFields,
  type SensitiveProfile,
} from '@/lib/canonical'

/** Private document first, then any value still on the users document. */
export async function loadTaxIds(
  userId: string,
  legacyUser?: { utrNumber?: string | null; vatNumber?: string | null } | null
): Promise<SensitiveProfile> {
  const db = getFirebaseDb()
  const snap = await getDoc(doc(db, sensitiveProfileDocPath(userId)))
  return resolveSensitiveProfile({
    privateDoc: snap.exists() ? (snap.data() as Record<string, unknown>) : null,
    legacyUser: legacyUser ?? null,
  })
}

/**
 * Write the private document, then remove any legacy copy from the users
 * document. `stripLegacy: false` for a placeholder that never had one.
 */
export async function saveTaxIds(
  userId: string,
  values: { utrNumber?: string | null; vatNumber?: string | null },
  updatedByUserId: string,
  options: { stripLegacy?: boolean } = {}
): Promise<void> {
  const result = sensitiveProfileWriteFields({ ...values, updatedByUserId })
  if (!result.ok) throw new Error(result.error === 'too_long' ? 'UTR and VAT numbers are 20 characters at most.' : 'Not signed in.')
  const db = getFirebaseDb()
  await setDoc(doc(db, sensitiveProfileDocPath(userId)), { ...result.fields, updatedAt: serverTimestamp() })
  if (options.stripLegacy !== false) {
    await updateDoc(doc(db, 'users', userId), { utrNumber: deleteField(), vatNumber: deleteField() }).catch(() => undefined)
  }
}

/** Invite completion: copy the placeholder's tax ids to the new account, then remove the placeholder copy. */
export async function moveTaxIds(fromUserId: string, toUserId: string): Promise<void> {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return
  const db = getFirebaseDb()
  const from = doc(db, sensitiveProfileDocPath(fromUserId))
  const snap = await getDoc(from)
  if (!snap.exists()) return
  const resolved = resolveSensitiveProfile({ privateDoc: snap.data() as Record<string, unknown> })
  if (resolved.utrNumber || resolved.vatNumber) {
    await saveTaxIds(toUserId, resolved, toUserId, { stripLegacy: false })
  }
  await deleteDoc(from).catch(() => undefined)
}

export async function deleteTaxIds(userId: string): Promise<void> {
  await deleteDoc(doc(getFirebaseDb(), sensitiveProfileDocPath(userId))).catch(() => undefined)
}
