import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import { weekStartKey } from '@/lib/timesheets/timesheetWeekUtils'

export type TimesheetWeekStatus = 'draft' | 'submitted' | 'approved'

export type TimesheetWeekRecord = {
  userId: string
  weekStart: string
  status: TimesheetWeekStatus
  totalHours?: number
  submittedAt?: Date
  submittedByUserId?: string
  approvedAt?: Date
  approvedByUserId?: string
  approvedByName?: string
  invoiceGeneratedAt?: Date
}

function timesheetDocId(userId: string, weekStart: Date): string {
  return `timesheet_${userId}_${weekStartKey(weekStart)}`
}

function parseFirestoreDate(value: unknown): Date | undefined {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.()
    return date instanceof Date ? date : undefined
  }
  return undefined
}

function mapRecord(data: Record<string, unknown>, userId: string, weekStart: string): TimesheetWeekRecord {
  return {
    userId,
    weekStart,
    status: (data.status as TimesheetWeekStatus) || 'draft',
    totalHours: typeof data.totalHours === 'number' ? data.totalHours : undefined,
    submittedAt: parseFirestoreDate(data.submittedAt),
    submittedByUserId: typeof data.submittedByUserId === 'string' ? data.submittedByUserId : undefined,
    approvedAt: parseFirestoreDate(data.approvedAt),
    approvedByUserId: typeof data.approvedByUserId === 'string' ? data.approvedByUserId : undefined,
    approvedByName: typeof data.approvedByName === 'string' ? data.approvedByName : undefined,
    invoiceGeneratedAt: parseFirestoreDate(data.invoiceGeneratedAt),
  }
}

export async function loadTimesheetWeekRecord(
  organizationId: string,
  userId: string,
  weekStart: Date
): Promise<TimesheetWeekRecord | null> {
  const weekKey = weekStartKey(weekStart)
  const ref = doc(db, 'organizations', organizationId, 'settings', timesheetDocId(userId, weekStart))
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    return { userId, weekStart: weekKey, status: 'draft' }
  }
  return mapRecord(snap.data() as Record<string, unknown>, userId, weekKey)
}

export async function loadTimesheetWeekRecords(
  organizationId: string,
  userIds: string[],
  weekStart: Date
): Promise<Map<string, TimesheetWeekRecord>> {
  const results = await Promise.all(
    userIds.map(async (userId) => {
      const record = await loadTimesheetWeekRecord(organizationId, userId, weekStart)
      return [userId, record] as const
    })
  )
  return new Map(results.filter(([, record]) => record !== null) as Array<[string, TimesheetWeekRecord]>)
}

export async function submitTimesheetWeek({
  organizationId,
  userId,
  weekStart,
  totalHours,
  submittedByUserId,
}: {
  organizationId: string
  userId: string
  weekStart: Date
  totalHours: number
  submittedByUserId: string
}): Promise<void> {
  const ref = doc(db, 'organizations', organizationId, 'settings', timesheetDocId(userId, weekStart))
  await setDoc(
    ref,
    sanitizeForFirestore({
      userId,
      weekStart: weekStartKey(weekStart),
      status: 'submitted',
      totalHours,
      submittedAt: Timestamp.now(),
      submittedByUserId,
      updatedAt: Timestamp.now(),
    }) as Record<string, unknown>,
    { merge: true }
  )
}

export async function approveTimesheetWeek({
  organizationId,
  userId,
  weekStart,
  approvedByUserId,
  approvedByName,
}: {
  organizationId: string
  userId: string
  weekStart: Date
  approvedByUserId: string
  approvedByName: string
}): Promise<void> {
  const ref = doc(db, 'organizations', organizationId, 'settings', timesheetDocId(userId, weekStart))
  await setDoc(
    ref,
    sanitizeForFirestore({
      status: 'approved',
      approvedAt: Timestamp.now(),
      approvedByUserId,
      approvedByName,
      updatedAt: Timestamp.now(),
    }) as Record<string, unknown>,
    { merge: true }
  )
}

export async function markTimesheetInvoiceGenerated(
  organizationId: string,
  userId: string,
  weekStart: Date
): Promise<void> {
  const ref = doc(db, 'organizations', organizationId, 'settings', timesheetDocId(userId, weekStart))
  await setDoc(
    ref,
    sanitizeForFirestore({
      invoiceGeneratedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }) as Record<string, unknown>,
    { merge: true }
  )
}
