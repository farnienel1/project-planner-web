/**
 * iOS parity: FirebaseBackend.swift timesheetStateDocumentRef / saveTimesheetState,
 * InvoicingView.swift TimesheetDraftStore asFirestoreMap.
 *
 * Doc id: timesheet_{userId}_{unixStartOfDay} using the organisation origin-country zone.
 * Legacy yyyy-MM-dd / ISO-week keys are still read so older web drafts are not lost.
 */
import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { LONDON_TIME_ZONE, unixStartOfDay, dayKey } from '@/lib/ios-parity/londonTime'
import { weekStartKey } from '@/lib/timesheets/timesheetWeekUtils'
import { periodStartKey } from '@/lib/timesheets/paymentRunCopy'
import {
  emptyTimesheetDraft,
  type TimesheetDraft,
  type TimesheetExpenseEntry,
  type TimesheetManagerDecision,
  type TimesheetPayrollLineReview,
  type TimesheetPriceWorkEntry,
} from '@/lib/timesheets/timesheetDraft'

export function timesheetDocId(userId: string, weekStart: Date, timeZone: string = LONDON_TIME_ZONE): string {
  return `timesheet_${userId}_${unixStartOfDay(weekStart, timeZone)}`
}

/** iOS uses Calendar.current midnight; web uses org zone. Try both plus UTC. */
export function candidateTimesheetDocIds(
  userId: string,
  weekStart: Date,
  timeZone: string = LONDON_TIME_ZONE
): string[] {
  const stamps = new Set<number>([
    unixStartOfDay(weekStart, timeZone),
    unixStartOfDay(weekStart, LONDON_TIME_ZONE),
    unixStartOfDay(weekStart, 'UTC'),
  ])
  const key = dayKey(weekStart, timeZone)
  const [year, month, day] = key.split('-').map(Number)
  stamps.add(Math.floor(Date.UTC(year, month - 1, day) / 1000))
  return [
    ...Array.from(stamps).map((stamp) => `timesheet_${userId}_${stamp}`),
    legacyPeriodDocId(userId, weekStart, timeZone),
    legacyWeekDocId(userId, weekStart),
  ]
}

function legacyPeriodDocId(userId: string, weekStart: Date, timeZone: string): string {
  return `timesheet_${userId}_${periodStartKey(weekStart, timeZone)}`
}

function legacyWeekDocId(userId: string, weekStart: Date): string {
  return `timesheet_${userId}_${weekStartKey(weekStart)}`
}

function parseFirestoreDate(value: unknown): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const date = (value as { toDate?: () => Date }).toDate?.()
    return date instanceof Date ? date : undefined
  }
  return undefined
}

function asDecision(value: unknown): TimesheetManagerDecision {
  if (value === 'pending' || value === 'approved' || value === 'declined' || value === 'edited') return value
  return 'approved'
}

function mapExpense(row: Record<string, unknown>): TimesheetExpenseEntry | null {
  const id = typeof row.id === 'string' && row.id.trim() ? row.id : newUuid()
  const title = typeof row.title === 'string' ? row.title : ''
  if (!title) return null
  return {
    id,
    title,
    details: typeof row.details === 'string' ? row.details : '',
    jobNumber: typeof row.jobNumber === 'string' ? row.jobNumber : '',
    date: parseFirestoreDate(row.date) || new Date(),
    amount: typeof row.amount === 'number' ? row.amount : 0,
    receiptName: typeof row.receiptName === 'string' ? row.receiptName : null,
    managerDecision: asDecision(row.managerDecision),
    managerRevisedAmount: typeof row.managerRevisedAmount === 'number' ? row.managerRevisedAmount : null,
  }
}

function mapPriceWork(row: Record<string, unknown>): TimesheetPriceWorkEntry | null {
  const id = typeof row.id === 'string' && row.id.trim() ? row.id : newUuid()
  const title = typeof row.title === 'string' ? row.title : ''
  if (!title) return null
  return {
    id,
    title,
    details: typeof row.details === 'string' ? row.details : '',
    jobNumber: typeof row.jobNumber === 'string' ? row.jobNumber : '',
    agreedManagerName: typeof row.agreedManagerName === 'string' ? row.agreedManagerName : 'Manager',
    startDate: parseFirestoreDate(row.startDate) || new Date(),
    endDate: parseFirestoreDate(row.endDate) || null,
    amount: typeof row.amount === 'number' ? row.amount : 0,
    managerDecision: asDecision(row.managerDecision),
    managerRevisedAmount: typeof row.managerRevisedAmount === 'number' ? row.managerRevisedAmount : null,
  }
}

function mapReviews(raw: unknown): Record<string, TimesheetPayrollLineReview> {
  if (!raw || typeof raw !== 'object') return {}
  const output: Record<string, TimesheetPayrollLineReview> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const row = (value || {}) as Record<string, unknown>
    output[key] = {
      decision: asDecision(row.decision),
      revisedAmount: typeof row.revisedAmount === 'number' ? row.revisedAmount : null,
    }
  }
  return output
}

export function draftFromFirestoreMap(data: Record<string, unknown>): TimesheetDraft {
  const operativeSignedBy = typeof data.operativeSignedByName === 'string' ? data.operativeSignedByName.trim() : ''
  const operativeSignature =
    typeof data.operativeSignatureImageBase64 === 'string' ? data.operativeSignatureImageBase64.trim() : ''
  const managerSignedBy = typeof data.managerSignedByName === 'string' ? data.managerSignedByName.trim() : ''
  const managerSignedByUserId =
    typeof data.managerSignedByUserId === 'string' ? data.managerSignedByUserId.trim() : ''
  const managerSignature =
    typeof data.managerSignatureImageBase64 === 'string' ? data.managerSignatureImageBase64.trim() : ''

  const submittedAt = parseFirestoreDate(data.submittedAt)
  const approvedAt = parseFirestoreDate(data.approvedAt)
  const invoiceGeneratedAt = parseFirestoreDate(data.invoiceGeneratedAt)

  return {
    managerNote: typeof data.managerNote === 'string' ? data.managerNote : '',
    operativeSignedAt: parseFirestoreDate(data.operativeSignedAt) || submittedAt || null,
    operativeSignedByName: operativeSignedBy || null,
    operativeSignatureImageBase64: operativeSignature || null,
    managerSignedAt: parseFirestoreDate(data.managerSignedAt) || approvedAt || null,
    managerSignedByName: managerSignedBy || (typeof data.approvedByName === 'string' ? data.approvedByName : null),
    managerSignedByUserId: managerSignedByUserId || null,
    managerSignatureImageBase64: managerSignature || null,
    exportedAt: parseFirestoreDate(data.exportedAt) || invoiceGeneratedAt || null,
    expenseEntries: Array.isArray(data.expenseEntries)
      ? data.expenseEntries
          .map((row) => mapExpense((row || {}) as Record<string, unknown>))
          .filter((row): row is TimesheetExpenseEntry => Boolean(row))
      : [],
    priceWorkEntries: Array.isArray(data.priceWorkEntries)
      ? data.priceWorkEntries
          .map((row) => mapPriceWork((row || {}) as Record<string, unknown>))
          .filter((row): row is TimesheetPriceWorkEntry => Boolean(row))
      : [],
    payrollLineReviews: mapReviews(data.payrollLineReviews),
  }
}

export function draftToFirestoreMap(draft: TimesheetDraft): Record<string, unknown> {
  return {
    managerNote: draft.managerNote,
    operativeSignedAt: draft.operativeSignedAt ? Timestamp.fromDate(draft.operativeSignedAt) : null,
    operativeSignedByName: draft.operativeSignedByName || '',
    operativeSignatureImageBase64: draft.operativeSignatureImageBase64 || '',
    managerSignedAt: draft.managerSignedAt ? Timestamp.fromDate(draft.managerSignedAt) : null,
    managerSignedByName: draft.managerSignedByName || '',
    managerSignedByUserId: draft.managerSignedByUserId || '',
    managerSignatureImageBase64: draft.managerSignatureImageBase64 || '',
    exportedAt: draft.exportedAt ? Timestamp.fromDate(draft.exportedAt) : null,
    expenseEntries: draft.expenseEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      details: entry.details,
      jobNumber: entry.jobNumber,
      date: Timestamp.fromDate(entry.date),
      amount: entry.amount,
      receiptName: entry.receiptName || '',
      managerDecision: entry.managerDecision,
      managerRevisedAmount: entry.managerRevisedAmount ?? null,
    })),
    priceWorkEntries: draft.priceWorkEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      details: entry.details,
      jobNumber: entry.jobNumber,
      agreedManagerName: entry.agreedManagerName,
      startDate: Timestamp.fromDate(entry.startDate),
      endDate: entry.endDate ? Timestamp.fromDate(entry.endDate) : null,
      amount: entry.amount,
      managerDecision: entry.managerDecision,
      managerRevisedAmount: entry.managerRevisedAmount ?? null,
    })),
    payrollLineReviews: Object.fromEntries(
      Object.entries(draft.payrollLineReviews).map(([key, review]) => [
        key,
        { decision: review.decision, revisedAmount: review.revisedAmount ?? null },
      ])
    ),
  }
}

async function readDoc(organizationId: string, docId: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'organizations', organizationId, 'settings', docId))
  return snap.exists() ? (snap.data() as Record<string, unknown>) : null
}

function weekStartMatches(data: Record<string, unknown>, weekStart: Date, timeZone: string): boolean {
  const target = dayKey(weekStart, timeZone)
  if (typeof data.weekStartKey === 'string' && data.weekStartKey === target) return true
  const stored = parseFirestoreDate(data.weekStart)
  if (stored && dayKey(stored, timeZone) === target) return true
  return false
}

export async function loadTimesheetDraft(
  organizationId: string,
  userId: string,
  weekStart: Date,
  timeZone: string = LONDON_TIME_ZONE
): Promise<TimesheetDraft> {
  const unique = [...new Set(candidateTimesheetDocIds(userId, weekStart, timeZone))]
  for (const id of unique) {
    const data = await readDoc(organizationId, id)
    if (data) return draftFromFirestoreMap(data)
  }
  try {
    const snap = await getDocs(
      query(collection(db, 'organizations', organizationId, 'settings'), where('userId', '==', userId))
    )
    for (const entry of snap.docs) {
      const data = entry.data() as Record<string, unknown>
      if (weekStartMatches(data, weekStart, timeZone)) return draftFromFirestoreMap(data)
      const suffix = entry.id.split('_').pop()
      if (suffix && unique.some((id) => id.endsWith(`_${suffix}`))) {
        return draftFromFirestoreMap(data)
      }
    }
  } catch {
    // Permission or missing index — fall back to an empty draft.
  }
  return emptyTimesheetDraft()
}

export async function loadTimesheetDrafts(
  organizationId: string,
  userIds: string[],
  weekStart: Date,
  timeZone: string = LONDON_TIME_ZONE
): Promise<Map<string, TimesheetDraft>> {
  const results = await Promise.all(
    userIds.map(async (userId) => {
      const draft = await loadTimesheetDraft(organizationId, userId, weekStart, timeZone)
      return [userId, draft] as const
    })
  )
  return new Map(results)
}

export async function saveTimesheetDraft({
  organizationId,
  userId,
  weekStart,
  draft,
  timeZone = LONDON_TIME_ZONE,
}: {
  organizationId: string
  userId: string
  weekStart: Date
  draft: TimesheetDraft
  timeZone?: string
}): Promise<void> {
  const ref = doc(db, 'organizations', organizationId, 'settings', timesheetDocId(userId, weekStart, timeZone))
  await setDoc(
    ref,
    sanitizeForFirestore({
      ...draftToFirestoreMap(draft),
      userId,
      weekStart: Timestamp.fromDate(weekStart),
      weekStartKey: dayKey(weekStart, timeZone),
      updatedAt: Timestamp.now(),
    }) as Record<string, unknown>,
    { merge: true }
  )
}
