import type { Unsubscribe } from 'firebase/firestore'
import { watchOrgCollection } from '@/lib/firebase/watchOrgQuery'
/**
 * Dismissed warnings for one organisation.
 *
 * `organizations/{orgId}/dismissedWarnings/{dismissKey}`
 *   kind:            'qualification_expired'
 *   dismissKey:      the canonical key (qualificationDismissKey), also the document id
 *   operativeId, qualificationId, expiryDayKey
 *   dismissedAt, dismissedByUserId
 *
 * The document id is the canonical dismiss key so web and iOS hide the same row.
 * A renewed certificate has a new expiry day and therefore a new key, so it warns again.
 */

import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { writeMetadataFields } from '@/lib/canonical'

export type DismissedWarning = {
  dismissKey: string
  kind: string
  dismissedAt: Date
  dismissedByUserId: string
}

function dismissedWarningFromDoc(entry: { id: string; data: Record<string, any> }): DismissedWarning {
  const data = entry.data
  return {
    dismissKey: String(data.dismissKey || entry.id),
    kind: String(data.kind || ''),
    dismissedAt: data.dismissedAt?.toDate?.() || new Date(),
    dismissedByUserId: String(data.dismissedByUserId || ''),
  }
}

export async function loadDismissedWarnings(organizationId: string): Promise<DismissedWarning[]> {
  const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'dismissedWarnings'))
  return snapshot.docs.map((entry) => dismissedWarningFromDoc({ id: entry.id, data: entry.data() }))
}

/** Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): Warnings and the Home count listen to `dismissedWarnings` while open. */
export function watchDismissedWarnings(organizationId: string, onRows: (rows: DismissedWarning[]) => void): Unsubscribe {
  return watchOrgCollection(organizationId, 'dismissedWarnings', (docs) => onRows(docs.map(dismissedWarningFromDoc)))
}

export async function dismissQualificationWarning(input: {
  organizationId: string
  dismissKey: string
  operativeId: string
  qualificationId: string
  expiryDayKey: string
  dismissedByUserId: string
}): Promise<void> {
  await setDoc(
    doc(db, 'organizations', input.organizationId, 'dismissedWarnings', input.dismissKey),
    {
      kind: 'qualification_expired',
      dismissKey: input.dismissKey,
      operativeId: input.operativeId,
      qualificationId: input.qualificationId,
      expiryDayKey: input.expiryDayKey,
      dismissedAt: serverTimestamp(),
      dismissedByUserId: input.dismissedByUserId,
      ...(writeMetadataFields(input.dismissedByUserId, 'web') ?? {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  )
}
