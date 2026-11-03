/**
 * Web glue for subcontractor booking writes. The stored shape is the rulebook's (§1):
 * `subcontractorBookingCreateFields` for a new booking (document id = the `id` field, an upper-case UUID, status
 * Confirmed, `isBreakRemoved` always written) and `subcontractorBookingWriteFields` for an edit (changed fields
 * only; an edit never re-creates a booking deleted elsewhere).
 */
import { doc, serverTimestamp, setDoc, Timestamp, type Firestore } from 'firebase/firestore'
import {
  subcontractorBookingCreateFields,
  subcontractorBookingWriteFields,
  type SubcontractorBookingCreateInput,
} from '@/lib/canonical/workDocumentReaders'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import { savePartialDocument } from '@/lib/firebase/partialWrite'
import { newUppercaseUuid } from '@/lib/ios-parity/uuid'
import { resolveBookingJobCollection } from '@/lib/bookings/jobCollection'

export async function createSubcontractorBooking(
  firestore: Firestore,
  organizationId: string,
  input: Omit<SubcontractorBookingCreateInput, 'id' | 'createdAtMs'> & { id?: string },
  options?: { userId?: string | null }
): Promise<string> {
  const id = (input.id?.trim() || newUppercaseUuid()).trim()
  // Rulebook 1.11.0: the booking carries its job's collection (`jobCollection`).
  const jobCollection = input.jobCollection ?? (await resolveBookingJobCollection(organizationId, input.projectId))
  const written = subcontractorBookingCreateFields({ ...input, id, jobCollection, createdAtMs: Date.now() })
  if (!written.ok) throw new Error(`Invalid subcontractor booking: ${written.errors.join(', ')}`)
  const fields = written.fields
  await setDoc(doc(firestore, 'organizations', organizationId, 'subcontractorBookings', id), {
    ...fields,
    date: Timestamp.fromMillis(Number(fields.date)),
    createdAt: Timestamp.fromMillis(Number(fields.createdAt)),
    updatedAt: serverTimestamp(),
    ...(writeMetadataFields(options?.userId, 'web') ?? {}),
  })
  return id
}

export async function updateSubcontractorBooking(
  firestore: Firestore,
  organizationId: string,
  bookingId: string,
  changes: Record<string, unknown>,
  options?: { userId?: string | null },
  projectId?: string | null
): Promise<boolean> {
  // Rulebook 1.11.0: an edit also writes the job's collection (adds it to a booking saved before 1.11.0).
  const jobCollection = changes.jobCollection ?? (projectId ? await resolveBookingJobCollection(organizationId, projectId) : null)
  return savePartialDocument(
    doc(firestore, 'organizations', organizationId, 'subcontractorBookings', bookingId),
    jobCollection ? { ...changes, jobCollection } : changes,
    subcontractorBookingWriteFields,
    { userId: options?.userId ?? null, missing: 'refuse' }
  )
}
