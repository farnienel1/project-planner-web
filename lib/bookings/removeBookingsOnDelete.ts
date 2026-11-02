/**
 * Booking clean-up when a person or a job is deleted. Which bookings go is the
 * rulebook's decision (bookingsToRemoveOnOperativeDelete /
 * bookingsToRemoveOnProjectDelete): only those dated today or later in the
 * organisation zone. Past bookings stay. People are matched by id, never name.
 */

import { collection, doc, getDoc, getDocs, query, where, type Firestore } from 'firebase/firestore'
import { deleteBookingsWithTombstones } from '@/lib/bookings/bookingTombstoneWrite'
import {
  bookingsToRemoveOnOperativeDelete,
  jobDeleteBookingRemovals,
  parseBookingDocument,
  parseManagerSiteBookingDocument,
  parseSubcontractorBookingDocument,
  type JobDeleteBookingRow,
} from '@/lib/canonical'
import { ianaTimeZoneForCountry } from '@/lib/orgTime/orgTimeZone'

const IN_QUERY_LIMIT = 30

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

/** Each delete carries its `deletedBookings` tombstone (lib/canonical/bookingTombstones.ts). */
async function deleteBookings(db: Firestore, organizationId: string, ids: string[]): Promise<void> {
  await deleteBookingsWithTombstones(db, { organizationId, collection: 'bookings', bookingIds: ids })
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

async function rowsWhere(
  db: Firestore,
  organizationId: string,
  collectionName: 'subcontractorBookings' | 'managerSiteBookings',
  field: string,
  values: string[],
  read: (id: string, data: Record<string, unknown>) => JobDeleteBookingRow | null
): Promise<JobDeleteBookingRow[]> {
  const rows: JobDeleteBookingRow[] = []
  const ref = collection(db, 'organizations', organizationId, collectionName)
  for (let i = 0; i < values.length; i += IN_QUERY_LIMIT) {
    const snap = await getDocs(query(ref, where(field, 'in', values.slice(i, i + IN_QUERY_LIMIT))))
    for (const entry of snap.docs) {
      const row = read(entry.id, entry.data() as Record<string, unknown>)
      if (row) rows.push(row)
    }
  }
  return rows
}

/**
 * Remove a deleted job's bookings from today on (rulebook 1.10.0 `jobDeleteBookingRemovals`): its labour bookings,
 * subcontractor bookings and the manager site bookings at the job, each with its tombstone. Returns the ids removed.
 */
export async function removeFutureBookingsForProject(
  db: Firestore,
  input: { organizationId: string; projectId: string; now?: Date }
): Promise<string[]> {
  const projectId = input.projectId.trim()
  if (!input.organizationId || !projectId) return []
  const lookup = Array.from(new Set([projectId, projectId.toUpperCase(), projectId.toLowerCase()]))
  const [timeZone, rows, subRows, subRowsIos, siteRows] = await Promise.all([
    organizationTimeZone(db, input.organizationId),
    bookingRowsWhere(db, input.organizationId, 'projectId', lookup),
    rowsWhere(db, input.organizationId, 'subcontractorBookings', 'projectId', lookup, (id, data) => {
      const parsed = parseSubcontractorBookingDocument(id, data)
      return parsed ? { id, projectId: parsed.projectId, dateMs: parsed.dateMs } : null
    }),
    rowsWhere(db, input.organizationId, 'subcontractorBookings', 'projectID', lookup, (id, data) => {
      const parsed = parseSubcontractorBookingDocument(id, data)
      return parsed ? { id, projectId: parsed.projectId, dateMs: parsed.dateMs } : null
    }),
    rowsWhere(db, input.organizationId, 'managerSiteBookings', 'locationId', lookup, (id, data) => {
      const parsed = parseManagerSiteBookingDocument(id, data)
      return parsed.ok
        ? { id, locationType: parsed.booking.locationType, locationId: parsed.booking.locationId ?? null, dateMs: parsed.booking.dateMs }
        : null
    }),
  ])
  const subById = new Map([...subRows, ...subRowsIos].map((row) => [row.id, row]))
  const removals = jobDeleteBookingRemovals({
    projectId,
    bookings: rows,
    subcontractorBookings: Array.from(subById.values()),
    managerSiteBookings: siteRows,
    nowIso: (input.now ?? new Date()).toISOString(),
    timeZone,
  })
  await deleteBookings(db, input.organizationId, removals.bookings)
  await deleteBookingsWithTombstones(db, {
    organizationId: input.organizationId,
    collection: 'subcontractorBookings',
    bookingIds: removals.subcontractorBookings,
  })
  await deleteBookingsWithTombstones(db, {
    organizationId: input.organizationId,
    collection: 'managerSiteBookings',
    bookingIds: removals.managerSiteBookings,
  })
  return [...removals.bookings, ...removals.subcontractorBookings, ...removals.managerSiteBookings]
}
