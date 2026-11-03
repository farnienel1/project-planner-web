import type { Unsubscribe } from 'firebase/firestore'
import { watchOrgCollection } from '@/lib/firebase/watchOrgQuery'
import { collection, doc, getDocs, serverTimestamp, writeBatch, type WriteBatch } from 'firebase/firestore'
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

function acceptedClashFromDoc(entry: { id: string; data: Record<string, any> }): AcceptedBookingClash {
  const data = entry.data
  return {
    id: entry.id,
    bookingAId: String(data.bookingAId || ''),
    bookingBId: String(data.bookingBId || ''),
    acceptedAt: data.acceptedAt?.toDate?.() || new Date(),
    acceptedByUserId: String(data.acceptedByUserId || ''),
  }
}

export async function loadAcceptedBookingClashes(organizationId: string): Promise<AcceptedBookingClash[]> {
  const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'acceptedBookingClashes'))
  return snapshot.docs.map((entry) => acceptedClashFromDoc({ id: entry.id, data: entry.data() }))
}

/** Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): Warnings and the Home count listen to `acceptedBookingClashes` while open. */
export function watchAcceptedBookingClashes(
  organizationId: string,
  onRows: (rows: AcceptedBookingClash[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  return watchOrgCollection(organizationId, 'acceptedBookingClashes', (docs) => onRows(docs.map(acceptedClashFromDoc)), {
    onError: (error) => onError?.(error),
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
/** Both approval documents of one clash, added to `batch` (`clashApprovalWrites`). */
function addClashApproval(batch: WriteBatch, organizationId: string, clash: ClashApproval, approvedByUserId: string): void {
  const writes = clashApprovalWrites({ ...clash, approvedByUserId })
  if (!writes.acceptedClash || !writes.resolution) throw new Error('This clash cannot be approved.')
  const metadata = writeMetadataFields(approvedByUserId, 'web') ?? {}
  batch.set(doc(db, 'organizations', organizationId, 'acceptedBookingClashes', writes.acceptedClash.documentId), {
    ...writes.acceptedClash.fields,
    ...metadata,
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.set(doc(db, 'organizations', organizationId, 'warningResolutions', writes.resolution.documentId), {
    ...writes.resolution.fields,
    resolvedAt: serverTimestamp(),
  })
}

function addClashUnapproval(batch: WriteBatch, organizationId: string, clash: ClashApproval): void {
  const pairId = clashPairKey(clash.bookingAId, clash.bookingBId)
  const resolutionId = clashResolutionKey(clash)
  if (!clash.bookingAId || !clash.bookingBId || !resolutionId) throw new Error('This clash approval cannot be removed.')
  batch.delete(doc(db, 'organizations', organizationId, 'acceptedBookingClashes', pairId))
  batch.delete(doc(db, 'organizations', organizationId, 'warningResolutions', resolutionId))
}

/**
 * Approve a clash on both collections (the rulebook's `clashApprovalWrites`):
 * `acceptedBookingClashes/{clashPairKey}` and `warningResolutions/{clashResolutionKey}` with status `approved`, in
 * one batch (1.9.0), so a failure never leaves one without the other.
 *
 * `warningResolutions` rules accept exactly resolutionKey / status / resolvedByUserId / resolvedAt, so that
 * document carries no `updatedBy` / `updatedFrom` until the rules allow them.
 */
export async function approveBookingClash(
  organizationId: string,
  clash: ClashApproval,
  approvedByUserId: string
): Promise<void> {
  const batch = writeBatch(db)
  addClashApproval(batch, organizationId, clash, approvedByUserId)
  await batch.commit()
}

/**
 * Undo a clash approval: delete both documents in one batch. Admins and managers (`canAccessVariationsStaff`) may
 * delete the `acceptedBookingClashes` row; the `warningResolutions` row may be deleted by an admin or its approver.
 */
export async function unapproveBookingClash(organizationId: string, clash: ClashApproval): Promise<void> {
  const batch = writeBatch(db)
  addClashUnapproval(batch, organizationId, clash)
  await batch.commit()
}

/**
 * Approve an operative clash group (`operativeClashGroups`): every overlapping pair gets its own approval, so
 * `isClashGroupApproved` is true on both apps. One batch: all pairs or none.
 */
export async function approveBookingClashPairs(
  organizationId: string,
  pairs: ReadonlyArray<{ bookingAId: string; bookingBId: string }>,
  approvedByUserId: string
): Promise<void> {
  if (pairs.length === 0) throw new Error('This clash cannot be approved.')
  const batch = writeBatch(db)
  for (const pair of pairs) {
    addClashApproval(batch, organizationId, { bookingAId: pair.bookingAId, bookingBId: pair.bookingBId }, approvedByUserId)
  }
  await batch.commit()
}

/** Undo an operative clash group approval: every pair's two documents, in one batch. */
export async function unapproveBookingClashPairs(
  organizationId: string,
  pairs: ReadonlyArray<{ bookingAId: string; bookingBId: string }>
): Promise<void> {
  if (pairs.length === 0) throw new Error('This clash approval cannot be removed.')
  const batch = writeBatch(db)
  for (const pair of pairs) addClashUnapproval(batch, organizationId, { bookingAId: pair.bookingAId, bookingBId: pair.bookingBId })
  await batch.commit()
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
