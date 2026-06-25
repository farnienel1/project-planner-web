import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
import type { SubcontractorBookingRow } from '@/lib/weekly-report/weeklyReportData'

export async function loadSubcontractorBookings(organizationId: string): Promise<SubcontractorBookingRow[]> {
  const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'subcontractorBookings'))
  const rows: SubcontractorBookingRow[] = []
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as Record<string, unknown>
    const date = parseFirestoreDate(data.date)
    if (!date) continue
    rows.push({
      id: docSnap.id,
      subcontractorId: String(data.subcontractorId || ''),
      projectId: String(data.projectId || ''),
      date,
      timeSlot: String(data.timeSlot || 'FULL DAY'),
      workStartTime: data.workStartTime ? String(data.workStartTime) : undefined,
      workEndTime: data.workEndTime ? String(data.workEndTime) : undefined,
    })
  }
  return rows
}
