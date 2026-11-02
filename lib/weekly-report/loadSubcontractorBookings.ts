import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { parseSubcontractorBookingDocument } from '@/lib/canonical/workDocumentReaders'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import type { SubcontractorBookingRow } from '@/lib/weekly-report/weeklyReportData'

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

export async function loadSubcontractorBookings(organizationId: string): Promise<SubcontractorBookingRow[]> {
  const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'subcontractorBookings'))
  const rows: SubcontractorBookingRow[] = []
  for (const docSnap of snapshot.docs) {
    const row = subcontractorBookingRowFromDocument(docSnap.id, docSnap.data() as Record<string, unknown>)
    if (row) rows.push(row)
  }
  return rows
}
