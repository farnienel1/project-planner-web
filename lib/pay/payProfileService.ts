/**
 * Rulebook 1.13.0 §8 / §16 (Q1): web reads and writes of `organizations/{orgId}/payProfiles/{subjectId}`. Rules are
 * the rulebook's (`canViewPersonPay`, `parsePayProfileDocument`, `overlayPayProfile`,
 * `payProfileWriteFieldsFromProfileWrite`); this file only talks to Firestore.
 */
import { doc, getDoc, serverTimestamp, type WriteBatch } from 'firebase/firestore'
import { getFirebaseDb } from '@/lib/firebase/ensureFirebase'
import {
  PAY_PROFILES_COLLECTION,
  parsePayProfileDocument,
  payProfileWriteFieldsFromProfileWrite,
  writeMetadataFields,
  type PayProfileDocument,
} from '@/lib/canonical'

/** The pay profile, or null when it does not exist or this viewer may not read it (the rules decide). */
export async function loadPayProfile(organizationId: string, subjectId: string): Promise<PayProfileDocument | null> {
  if (!organizationId || !subjectId) return null
  try {
    const snap = await getDoc(doc(getFirebaseDb(), 'organizations', organizationId, PAY_PROFILES_COLLECTION, subjectId))
    return snap.exists() ? parsePayProfileDocument(snap.id, snap.data() as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export type PayProfileReadResult = {
  status: 'found' | 'missing' | 'refused' | 'failed'
  profile: PayProfileDocument | null
}

/** As `loadPayProfile`, but says whether the document is missing, the read was refused, or it failed (offline). */
export async function readPayProfile(organizationId: string, subjectId: string): Promise<PayProfileReadResult> {
  if (!organizationId || !subjectId) return { status: 'missing', profile: null }
  try {
    const snap = await getDoc(doc(getFirebaseDb(), 'organizations', organizationId, PAY_PROFILES_COLLECTION, subjectId))
    return snap.exists()
      ? { status: 'found', profile: parsePayProfileDocument(snap.id, snap.data() as Record<string, unknown>) }
      : { status: 'missing', profile: null }
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code
    return { status: code === 'permission-denied' ? 'refused' : 'failed', profile: null }
  }
}

/**
 * Adds the pay-profile half of a profile save to `batch` (merge of the changed pay fields only). Returns false when the
 * save changes no pay field. During the 1.13.0 move both apps write pay to the profile document and to the pay profile.
 */
export function addPayProfileWrite(
  batch: WriteBatch,
  organizationId: string,
  subjectId: string,
  profileWrite: Record<string, unknown>,
  writerId: string
): boolean {
  const fields = payProfileWriteFieldsFromProfileWrite(subjectId, profileWrite)
  if (!organizationId || !fields) return false
  const metadata = writeMetadataFields(writerId, 'web')
  batch.set(
    doc(getFirebaseDb(), 'organizations', organizationId, PAY_PROFILES_COLLECTION, subjectId),
    { ...fields, ...(metadata || {}), updatedAt: serverTimestamp() },
    { merge: true }
  )
  return true
}
