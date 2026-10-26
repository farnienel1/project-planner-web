/**
 * Booking clean-up when a person or a job is deleted. Which bookings go is the
 * rulebook's decision (bookingsToRemoveOnOperativeDelete /
 * bookingsToRemoveOnProjectDelete): only those dated today or later in the
 * organisation zone. Past bookings stay. People are matched by id, never name.
 */

import { collection, doc, getDoc, getDocs, query, where, writeBatch, type Firestore } from 'firebase/firestore'
import {
  bookingsToRemoveOnOperativeDelete,
  bookingsToRemoveOnProjectDelete,
  parseBookingDocument,
} from '@/lib/canonical'
import { ianaTimeZoneForCountry } from '@/lib/orgTime/orgTimeZone'

const IN_QUERY_LIMIT = 30
const BATCH_LIMIT = 400

async function organizationTimeZone(db: Firestore, organizationId: string): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'organizations', organizationId))
    const country = snap.exists() ? String(snap.data().countryCode || '') : ''
    return ianaTimeZoneForCountry(country || 'GB')
  } catch {
    return ianaTimeZoneForCountry('GB')
  }
}

async function bookingRowsWhere(
  db: Firestore,
  organizationId: string,
  field: 'operativeId' | 'projectId',
  values: string[]
): Promise<Array<{ id: string; operativeId: string; projectId: string; dateMs: number }>> {
  const rows: Array<{ id: string; operativeId: string; projectId: string; dateMs: number }> = []
  const bookings = collection(db, 'organizations', organizationId, 'bookings')
  for (let i = 0; i < values.length; i += IN_QUERY_LIMIT) {
    const chunk = values.slice(i, i + IN_QUERY_LIMIT)
    const snap = await getDocs(query(bookings, where(field, 'in', chunk)))
    for (const entry of snap.docs) {
      const parsed = parseBookingDocument(entry.id, entry.data())
      if (!parsed.ok) continue
      rows.push({
        id: entry.id,
        operativeId: parsed.booking.operativeId,
        projectId: parsed.booking.projectId,
        dateMs: parsed.booking.dateMs,
      })
    }
  }
  return rows
}

async function deleteBookings(db: Firestore, organizationId: string, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (const id of ids.slice(i, i + BATCH_LIMIT)) {
      batch.delete(doc(db, 'organizations', organizationId, 'bookings', id))
    }
    await batch.commit()
  }
}

/** Remove a deleted person's bookings from today on. Returns the ids removed. */
export async function removeFutureBookingsForPerson(
  db: Firestore,
  input: { organizationId: string; operativeIds: string[]; now?: Date }
): Promise<string[]> {
  const operativeIds = Array.from(new Set(input.operativeIds.map((id) => id.trim()).filter(Boolean)))
  if (!input.organizationId || operativeIds.length === 0) return []
  const lookup = Array.from(new Set(operativeIds.flatMap((id) => [id, id.toUpperCase(), id.toLowerCase()])))
  const [timeZone, rows] = await Promise.all([
    organizationTimeZone(db, input.organizationId),
    bookingRowsWhere(db, input.organizationId, 'operativeId', lookup),
  ])
  const ids = bookingsToRemoveOnOperativeDelete({
    bookings: rows,
    operativeIds,
    nowIso: (input.now ?? new Date()).toISOString(),
    timeZone,
  })
  await deleteBookings(db, input.organizationId, ids)
  return ids
}

/** Remove a deleted job's bookings from today on. Returns the ids removed. */
export async function removeFutureBookingsForProject(
  db: Firestore,
  input: { organizationId: string; projectId: string; now?: Date }
): Promise<string[]> {
  const projectId = input.projectId.trim()
  if (!input.organizationId || !projectId) return []
  const lookup = Array.from(new Set([projectId, projectId.toUpperCase(), projectId.toLowerCase()]))
  const [timeZone, rows] = await Promise.all([
    organizationTimeZone(db, input.organizationId),
    bookingRowsWhere(db, input.organizationId, 'projectId', lookup),
  ])
  const ids = bookingsToRemoveOnProjectDelete({
    bookings: rows,
    projectId,
    nowIso: (input.now ?? new Date()).toISOString(),
    timeZone,
  })
  await deleteBookings(db, input.organizationId, ids)
  return ids
}
