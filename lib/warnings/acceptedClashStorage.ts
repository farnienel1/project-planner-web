import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  clashApprovalWrites,
  clashPairKey,
  clashResolutionKey,
  isClashAccepted as canonicalIsClashAccepted,
  writeMetadataFields,
} from '@/lib/canonical'

export type AcceptedBookingClash = {
  id: string
  bookingAId: string
  bookingBId: string
  acceptedAt: Date
  acceptedByUserId: string
}

export { clashPairKey }

export async function loadAcceptedBookingClashes(organizationId: string): Promise<AcceptedBookingClash[]> {
  const snapshot = await getDocs(
    collection(db, 'organizations', organizationId, 'acceptedBookingClashes')
  )
  return snapshot.docs.map((entry) => {
    const data = entry.data()
    return {
      id: entry.id,
      bookingAId: String(data.bookingAId || ''),
      bookingBId: String(data.bookingBId || ''),
      acceptedAt: data.acceptedAt?.toDate?.() || new Date(),
      acceptedByUserId: String(data.acceptedByUserId || ''),
    }
  })
}

export type ClashApproval = {
  bookingAId: string
  bookingBId: string
  /** Manager/admin clash key (`mgr-clash-…`). Operative clashes leave it out and use `clashPairKey`. */
  resolutionKey?: string
}

/**
 * Approve a clash on both collections (the rulebook's `clashApprovalWrites`):
 * `acceptedBookingClashes/{clashPairKey}` and `warningResolutions/{clashResolutionKey}` with status `approved`.
 * iOS hides clashes from either collection and its weekly report lists `warningResolutions` approvals.
 *
 * `warningResolutions` rules accept exactly resolutionKey / status / resolvedByUserId / resolvedAt, so that
 * document carries no `updatedBy` / `updatedFrom` until the rules allow them.
 */
export async function approveBookingClash(
  organizationId: string,
  clash: ClashApproval,
  approvedByUserId: string
): Promise<void> {
  const writes = clashApprovalWrites({ ...clash, approvedByUserId })
  if (!writes.acceptedClash || !writes.resolution) throw new Error('This clash cannot be approved.')
  const metadata = writeMetadataFields(approvedByUserId, 'web') ?? {}
  await setDoc(doc(db, 'organizations', organizationId, 'acceptedBookingClashes', writes.acceptedClash.documentId), {
    ...writes.acceptedClash.fields,
    ...metadata,
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'organizations', organizationId, 'warningResolutions', writes.resolution.documentId), {
    ...writes.resolution.fields,
    resolvedAt: serverTimestamp(),
  })
}

/**
 * Undo a clash approval: delete both documents. Firestore lets an organisation admin delete the
 * `acceptedBookingClashes` row; the `warningResolutions` row may be deleted by an admin or its approver.
 */
export async function unapproveBookingClash(organizationId: string, clash: ClashApproval): Promise<void> {
  const pairId = clashPairKey(clash.bookingAId, clash.bookingBId)
  const resolutionId = clashResolutionKey(clash)
  if (!clash.bookingAId || !clash.bookingBId || !resolutionId) throw new Error('This clash approval cannot be removed.')
  await Promise.all([
    deleteDoc(doc(db, 'organizations', organizationId, 'acceptedBookingClashes', pairId)),
    deleteDoc(doc(db, 'organizations', organizationId, 'warningResolutions', resolutionId)),
  ])
}

/** @deprecated Use `approveBookingClash`, which also writes `warningResolutions`. */
export async function acceptBookingClash(
  organizationId: string,
  bookingAId: string,
  bookingBId: string,
  acceptedByUserId: string
): Promise<void> {
  await approveBookingClash(organizationId, { bookingAId, bookingBId }, acceptedByUserId)
}

/** The rulebook's `isClashAccepted`: the saved id or the two saved booking ids, in either order, without case. */
export function isClashAccepted(
  bookingAId: string,
  bookingBId: string,
  accepted: AcceptedBookingClash[]
): boolean {
  return canonicalIsClashAccepted(bookingAId, bookingBId, accepted)
}
