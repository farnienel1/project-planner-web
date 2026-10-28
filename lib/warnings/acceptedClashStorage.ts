import { collection, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  acceptedClashWriteFields,
  clashPairKey,
  isClashAccepted as canonicalIsClashAccepted,
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

/** `organizations/{orgId}/acceptedBookingClashes/{clashPairKey}`, shaped by the rulebook's `acceptedClashWriteFields`. */
export async function acceptBookingClash(
  organizationId: string,
  bookingAId: string,
  bookingBId: string,
  acceptedByUserId: string
): Promise<void> {
  const write = acceptedClashWriteFields({ bookingAId, bookingBId, acceptedByUserId })
  if (!write) throw new Error('This clash cannot be approved.')
  await setDoc(doc(db, 'organizations', organizationId, 'acceptedBookingClashes', write.documentId), {
    ...write.fields,
    acceptedAt: Timestamp.now(),
  })
}

/** The rulebook's `isClashAccepted`: the saved id or the two saved booking ids, in either order, without case. */
export function isClashAccepted(
  bookingAId: string,
  bookingBId: string,
  accepted: AcceptedBookingClash[]
): boolean {
  return canonicalIsClashAccepted(bookingAId, bookingBId, accepted)
}
