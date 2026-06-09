import { collection, doc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

export type AcceptedBookingClash = {
  id: string
  bookingAId: string
  bookingBId: string
  acceptedAt: Date
  acceptedByUserId: string
}

export function clashPairKey(bookingAId: string, bookingBId: string): string {
  return [bookingAId, bookingBId].sort().join('|')
}

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

export async function acceptBookingClash(
  organizationId: string,
  bookingAId: string,
  bookingBId: string,
  acceptedByUserId: string
): Promise<void> {
  const id = clashPairKey(bookingAId, bookingBId)
  await setDoc(doc(db, 'organizations', organizationId, 'acceptedBookingClashes', id), {
    bookingAId,
    bookingBId,
    acceptedAt: Timestamp.now(),
    acceptedByUserId,
  })
}

export function isClashAccepted(
  bookingAId: string,
  bookingBId: string,
  accepted: AcceptedBookingClash[]
): boolean {
  const key = clashPairKey(bookingAId, bookingBId)
  return accepted.some((a) => a.id === key)
}
