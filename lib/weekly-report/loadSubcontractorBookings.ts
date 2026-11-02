import { collection, getDocs, query, type Unsubscribe } from 'firebase/firestore'
import { bookingPlanInputs, bookingPlanParts, webJobAccessViewer } from '@/lib/access/readPlan'
import { subscribeOrgPlan, unsubscribeOrgPlan } from '@/lib/firebase/subscribeOrgPlan'
import { useAuthStore } from '@/lib/stores/authStore'
import { db } from '@/lib/firebase/config'
import { parseSubcontractorBookingDocument } from '@/lib/canonical/workDocumentReaders'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import type { SubcontractorBookingRow } from '@/lib/weekly-report/weeklyReportData'
import { watchOrgCollection } from '@/lib/firebase/watchOrgQuery'

/**
 * One stored `subcontractorBookings` document as a web row. Reading is the rulebook's
 * `parseSubcontractorBookingDocument` (§1): the document id in stored case, a missing status is Confirmed, a
 * missing slot FULL DAY, and the date is read in the organisation zone. Null when the reader refuses it.
 */
export function subcontractorBookingRowFromDocument(
  docId: string,
  data: Record<string, unknown> | null | undefined,
  timeZone?: string | null
): SubcontractorBookingRow | null {
  const parsed = parseSubcontractorBookingDocument(docId, data, { timeZone: organizationZoneOr(timeZone) })
  if (!parsed) return null
  const row: SubcontractorBookingRow = {
    id: parsed.id,
    subcontractorId: parsed.subcontractorId,
    projectId: parsed.projectId,
    date: new Date(parsed.dateMs),
    timeSlot: parsed.timeSlot,
    status: parsed.status,
    bookedContactIds: parsed.bookedContactIds,
    bookedOperativeNames: parsed.bookedOperativeNames,
  }
  if (parsed.workStartTime) row.workStartTime = parsed.workStartTime
  if (parsed.workEndTime) row.workEndTime = parsed.workEndTime
  if (parsed.isBreakRemoved) row.isBreakRemoved = true
  return row
}

/** Rulebook 1.10.0 §17: the subcontractor-booking parts of `bookingQueryPlan` for the signed-in user (null = all). */
function subcontractorPlanParts() {
  const inputs = bookingPlanInputs()
  return bookingPlanParts(
    webJobAccessViewer(useAuthStore.getState().user),
    'subcontractorBookings',
    inputs.visibleJobIds,
    inputs.ownBookingIds
  )
}

export async function loadSubcontractorBookings(organizationId: string): Promise<SubcontractorBookingRow[]> {
  const col = collection(db, 'organizations', organizationId, 'subcontractorBookings')
  const parts = subcontractorPlanParts()
  const snapshots = parts === null
    ? [await getDocs(col)]
    : await Promise.all(parts.map((part) => getDocs(query(col, ...(part.constraints ?? [])))))
  const rows: SubcontractorBookingRow[] = []
  const seen = new Set<string>()
  for (const snapshot of snapshots) {
    for (const docSnap of snapshot.docs) {
      if (seen.has(docSnap.id)) continue
      seen.add(docSnap.id)
      const row = subcontractorBookingRowFromDocument(docSnap.id, docSnap.data() as Record<string, unknown>)
      if (row) rows.push(row)
    }
  }
  return rows
}

let watchSequence = 0

/**
 * Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): scheduling grids, the weekly overview and Daily Overview listen to
 * subcontractor bookings while open, so a booking made on another device appears without a refresh.
 */
export function watchSubcontractorBookings(
  organizationId: string,
  onRows: (rows: SubcontractorBookingRow[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  const parts = subcontractorPlanParts()
  if (parts !== null) {
    const key = `subcontractorBookings:watch:${(watchSequence += 1)}`
    void subscribeOrgPlan(key, organizationId, 'subcontractorBookings', parts, (docs) => {
      const rows: SubcontractorBookingRow[] = []
      for (const entry of docs) {
        const row = subcontractorBookingRowFromDocument(entry.id, entry.data)
        if (row) rows.push(row)
      }
      onRows(rows)
    }, onError)
    return () => unsubscribeOrgPlan(key)
  }
  return watchOrgCollection(
    organizationId,
    'subcontractorBookings',
    (docs) => {
      const rows: SubcontractorBookingRow[] = []
      for (const entry of docs) {
        const row = subcontractorBookingRowFromDocument(entry.id, entry.data)
        if (row) rows.push(row)
      }
      onRows(rows)
    },
    { onError }
  )
}
