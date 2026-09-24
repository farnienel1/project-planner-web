/**
 * iOS parity: FirebaseBackend.swift timesheetStateDocumentRef / saveTimesheetState,
 * InvoicingView.swift TimesheetDraftStore asFirestoreMap.
 *
 * Doc id: timesheet_{userId}_{unixStartOfDay} using the organisation origin-country zone.
 * Legacy yyyy-MM-dd / ISO-week keys are still read so older web drafts are not lost.
 */
import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { newUuid, parseFirestoreDate as parseSharedFirestoreDate, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
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
  type WeeklyReportLabourLine,
  type WeeklyReportMoneyLine,
  type WeeklyReportOverride,
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
  const parsed = parseSharedFirestoreDate(value)
  if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) return parsed
  if (value && typeof value === 'object' && 'seconds' in value) {
    const seconds = Number((value as { seconds: unknown }).seconds)
    if (Number.isFinite(seconds)) return new Date(seconds * 1000)
  }
  return undefined
}

/**
 * iOS TimesheetDraftStore.fromFirestoreMap only reads `exportedAt`.
 * Generate Invoice must not move a sheet to Exported — that is Email and export.
 * Older web builds wrote `invoiceGeneratedAt` and (briefly) copied it onto `exportedAt`.
 * Treat near-simultaneous stamps as leftover generate, not a manager email export.
 */
const INVOICE_EXPORT_LEFTOVER_MS = 60_000

export function resolveTimesheetExportedAt(data: Record<string, unknown>): Date | null {
  const exportedAt = parseFirestoreDate(data.exportedAt) || null
  if (!exportedAt) return null
  const invoiceGeneratedAt = parseFirestoreDate(data.invoiceGeneratedAt)
  if (
    invoiceGeneratedAt &&
    Math.abs(exportedAt.getTime() - invoiceGeneratedAt.getTime()) <= INVOICE_EXPORT_LEFTOVER_MS
  ) {
    return null
  }
  return exportedAt
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

function finiteNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : 0
}

function mapMoneyLine(row: Record<string, unknown>): WeeklyReportMoneyLine | null {
  const id = typeof row.id === 'string' ? row.id : ''
  if (!id) return null
  return {
    id,
    title: typeof row.title === 'string' ? row.title : '',
    details: typeof row.details === 'string' ? row.details : '',
    jobNumber: typeof row.jobNumber === 'string' ? row.jobNumber : '',
    date: parseFirestoreDate(row.date) || new Date(),
    amount: finiteNumber(row.amount),
    decision: asDecision(row.decision),
  }
}

function mapLabourLine(row: Record<string, unknown>): WeeklyReportLabourLine | null {
  const id = typeof row.id === 'string' ? row.id : ''
  if (!id) return null
  const bookingId = typeof row.bookingId === 'string' ? row.bookingId.trim() : ''
  return {
    id,
    date: parseFirestoreDate(row.date) || new Date(),
    jobNumber: typeof row.jobNumber === 'string' ? row.jobNumber : '',
    projectName: typeof row.projectName === 'string' ? row.projectName : '',
    locationKind: typeof row.locationKind === 'string' && row.locationKind ? row.locationKind : 'project',
    details: typeof row.details === 'string' ? row.details : '',
    paidHours: finiteNumber(row.paidHours),
    days: finiteNumber(row.days),
    amount: finiteNumber(row.amount),
    isOvertime: row.isOvertime === true,
    decision: asDecision(row.decision),
    bookingId,
  }
}

export function weeklyReportOverrideFromFirestore(raw: unknown): WeeklyReportOverride | null {
  if (!raw || typeof raw !== 'object') return null
  const map = raw as Record<string, unknown>
  const lines = Array.isArray(map.lines)
    ? map.lines
        .map((row) => mapLabourLine((row || {}) as Record<string, unknown>))
        .filter((row): row is WeeklyReportLabourLine => Boolean(row))
    : []
  const money = (key: 'priceWork' | 'expenses') =>
    Array.isArray(map[key])
      ? (map[key] as unknown[])
          .map((row) => mapMoneyLine((row || {}) as Record<string, unknown>))
          .filter((row): row is WeeklyReportMoneyLine => Boolean(row))
      : []
  return {
    approvedAt: parseFirestoreDate(map.approvedAt) || new Date(),
    approvedByUserId: typeof map.approvedByUserId === 'string' ? map.approvedByUserId : '',
    approvedByName: typeof map.approvedByName === 'string' ? map.approvedByName : '',
    selfSigned: map.selfSigned === true,
    lines,
    priceWork: money('priceWork'),
    expenses: money('expenses'),
  }
}

export function weeklyReportOverrideToFirestore(override: WeeklyReportOverride): Record<string, unknown> {
  const money = (line: WeeklyReportMoneyLine) => ({
    id: line.id,
    title: line.title,
    details: line.details,
    jobNumber: line.jobNumber,
    date: Timestamp.fromDate(line.date),
    amount: line.amount,
    decision: line.decision,
  })
  return {
    approvedAt: Timestamp.fromDate(override.approvedAt),
    approvedByUserId: override.approvedByUserId,
    approvedByName: override.approvedByName,
    selfSigned: override.selfSigned,
    lines: override.lines.map((line) => ({
      id: line.id,
      date: Timestamp.fromDate(line.date),
      jobNumber: line.jobNumber,
      projectName: line.projectName,
      locationKind: line.locationKind,
      details: line.details,
      paidHours: line.paidHours,
      days: line.days,
      amount: line.amount,
      isOvertime: line.isOvertime,
      decision: line.decision,
      bookingId: line.bookingId || '',
    })),
    priceWork: override.priceWork.map(money),
    expenses: override.expenses.map(money),
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

export function draftFromFirestoreMap(
  data: Record<string, unknown>,
  options?: { includeSignatures?: boolean }
): TimesheetDraft {
  const includeSignatures = options?.includeSignatures !== false
  const operativeSignedBy = typeof data.operativeSignedByName === 'string' ? data.operativeSignedByName.trim() : ''
  const operativeSignature =
    includeSignatures && typeof data.operativeSignatureImageBase64 === 'string'
      ? data.operativeSignatureImageBase64.trim()
      : ''
  const managerSignedBy = typeof data.managerSignedByName === 'string' ? data.managerSignedByName.trim() : ''
  const managerSignedByUserId =
    typeof data.managerSignedByUserId === 'string' ? data.managerSignedByUserId.trim() : ''
  const managerSignature =
    includeSignatures && typeof data.managerSignatureImageBase64 === 'string'
      ? data.managerSignatureImageBase64.trim()
      : ''

  const submittedAt = parseFirestoreDate(data.submittedAt)
  const approvedAt = parseFirestoreDate(data.approvedAt)

  return {
    managerNote: typeof data.managerNote === 'string' ? data.managerNote : '',
    operativeSignedAt: parseFirestoreDate(data.operativeSignedAt) || submittedAt || null,
    operativeSignedByName: operativeSignedBy || null,
    operativeSignatureImageBase64: operativeSignature || null,
    managerSignedAt: parseFirestoreDate(data.managerSignedAt) || approvedAt || null,
    managerSignedByName: managerSignedBy || (typeof data.approvedByName === 'string' ? data.approvedByName : null),
    managerSignedByUserId: managerSignedByUserId || null,
    managerSignatureImageBase64: managerSignature || null,
    exportedAt: resolveTimesheetExportedAt(data),
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
    weeklyReportOverride: weeklyReportOverrideFromFirestore(data.weeklyReportOverride),
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
    weeklyReportOverride: draft.weeklyReportOverride
      ? weeklyReportOverrideToFirestore(draft.weeklyReportOverride)
      : null,
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function readDoc(organizationId: string, docId: string): Promise<Record<string, unknown> | null> {
  try {
    const snap = await getDoc(doc(db, 'organizations', organizationId, 'settings', docId))
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null
  } catch {
    await delay(350)
    const snap = await getDoc(doc(db, 'organizations', organizationId, 'settings', docId))
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null
  }
}

const PAY_PERIOD_START_SKEW_MS = 36 * 60 * 60 * 1000

/** iOS stores start-of-day in the device calendar. Treat London, UTC, and the org zone as the same pay-period start. */
export function samePayPeriodStart(stored: Date, periodStart: Date, timeZone: string): boolean {
  const zones = Array.from(new Set([timeZone, LONDON_TIME_ZONE, 'UTC']))
  for (const zone of zones) {
    if (dayKey(stored, zone) === dayKey(periodStart, zone)) return true
  }
  return Math.abs(stored.getTime() - periodStart.getTime()) <= PAY_PERIOD_START_SKEW_MS
}

export function timesheetDraftHasActivity(draft: TimesheetDraft): boolean {
  return Boolean(
    draft.operativeSignedAt ||
      draft.managerSignedAt ||
      draft.exportedAt ||
      draft.expenseEntries.length ||
      draft.priceWorkEntries.length ||
      draft.managerNote.trim() ||
      draft.weeklyReportOverride
  )
}

export type TimesheetPeriodCandidate = {
  weekStart: Date
  draft: TimesheetDraft
  documentId?: string
}

/**
 * Prefer the pay-period document. If that doc is empty but another sheet in the
 * same pay run is signed, use the signed one — a mismatched week start was hiding
 * operative signatures from Awaiting sign-off.
 */
export function pickTimesheetDraftForPeriod(
  rows: TimesheetPeriodCandidate[],
  periodStart: Date,
  periodEnd: Date,
  timeZone: string
): TimesheetPeriodCandidate | null {
  if (rows.length === 0) return null
  const exact = rows.filter((row) => samePayPeriodStart(row.weekStart, periodStart, timeZone))
  const signedExact = exact.find((row) => timesheetDraftHasActivity(row.draft))
  if (signedExact) return signedExact
  const startKey = dayKey(periodStart, timeZone)
  const endKey = dayKey(periodEnd, timeZone)
  const inside = rows
    .filter((row) => {
      const key = dayKey(row.weekStart, timeZone)
      return key >= startKey && key <= endKey
    })
    .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
  const signedInside = inside.find((row) => timesheetDraftHasActivity(row.draft))
  if (signedInside) return signedInside
  if (exact[0]) return exact[0]
  return inside[0] || null
}

function weekStartMatches(data: Record<string, unknown>, weekStart: Date, timeZone: string): boolean {
  const target = dayKey(weekStart, timeZone)
  if (typeof data.weekStartKey === 'string' && data.weekStartKey === target) return true
  const stored = parseFirestoreDate(data.weekStart)
  if (stored && samePayPeriodStart(stored, weekStart, timeZone)) return true
  return false
}

const sourceDocumentIds = new WeakMap<TimesheetDraft, string>()

export function timesheetSourceDocumentId(draft: TimesheetDraft): string | null {
  return sourceDocumentIds.get(draft) || null
}

function rememberSource(draft: TimesheetDraft, documentId: string | null | undefined): TimesheetDraft {
  if (documentId) sourceDocumentIds.set(draft, documentId)
  return draft
}

const LIST_DRAFT_OPTIONS = { includeSignatures: false } as const

async function mapInBatches<T, R>(items: T[], batchSize: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const output: R[] = []
  for (let index = 0; index < items.length; index += batchSize) {
    const chunk = items.slice(index, index + batchSize)
    output.push(...(await Promise.all(chunk.map(mapper))))
  }
  return output
}

async function loadTimesheetDraftByCandidates(
  organizationId: string,
  userId: string,
  weekStart: Date,
  timeZone: string,
  includeSignatures = true
): Promise<TimesheetDraft | null> {
  const unique = [...new Set(candidateTimesheetDocIds(userId, weekStart, timeZone))]
  const hits = await Promise.all(unique.map(async (id) => ({ id, data: await readDoc(organizationId, id) })))
  const hit = hits.find((row) => row.data)
  return hit?.data ? rememberSource(draftFromFirestoreMap(hit.data, { includeSignatures }), hit.id) : null
}

function timesheetStateFromDoc(
  documentId: string,
  data: Record<string, unknown>,
  includeSignatures: boolean
): TimesheetPeriodCandidate | null {
  if (!documentId.startsWith('timesheet_')) return null
  const weekStart = parseFirestoreDate(data.weekStart)
  if (!weekStart) return null
  return {
    documentId,
    weekStart,
    draft: rememberSource(draftFromFirestoreMap(data, { includeSignatures }), documentId),
  }
}

const USER_ID_QUERY_CHUNK = 10

/** One settings query per chunk, instead of a full history read per person. */
async function loadTimesheetCandidatesByUserIds(
  organizationId: string,
  userIds: string[],
  includeSignatures: boolean
): Promise<Map<string, TimesheetPeriodCandidate[]>> {
  const grouped = new Map<string, TimesheetPeriodCandidate[]>()
  for (const userId of userIds) grouped.set(userId, [])
  for (let index = 0; index < userIds.length; index += USER_ID_QUERY_CHUNK) {
    const chunk = userIds.slice(index, index + USER_ID_QUERY_CHUNK)
    if (chunk.length === 0) continue
    const snap = await getDocs(
      query(collection(db, 'organizations', organizationId, 'settings'), where('userId', 'in', chunk))
    )
    for (const entry of snap.docs) {
      const data = entry.data() as Record<string, unknown>
      const userId = typeof data.userId === 'string' ? data.userId : ''
      if (!grouped.has(userId)) continue
      const row = timesheetStateFromDoc(entry.id, data, includeSignatures)
      if (row) grouped.get(userId)?.push(row)
    }
  }
  return grouped
}

export async function loadTimesheetDraft(
  organizationId: string,
  userId: string,
  weekStart: Date,
  timeZone: string = LONDON_TIME_ZONE,
  periodEnd?: Date
): Promise<TimesheetDraft> {
  const fromCandidates = await loadTimesheetDraftByCandidates(organizationId, userId, weekStart, timeZone)
  if (fromCandidates) return fromCandidates
  try {
    const key = dayKey(weekStart, timeZone)
    const snap = await getDocs(
      query(collection(db, 'organizations', organizationId, 'settings'), where('weekStartKey', '==', key))
    )
    for (const entry of snap.docs) {
      const data = entry.data() as Record<string, unknown>
      if (data.userId === userId) return rememberSource(draftFromFirestoreMap(data), entry.id)
      if (weekStartMatches(data, weekStart, timeZone) && entry.id.includes(userId)) {
        return rememberSource(draftFromFirestoreMap(data), entry.id)
      }
    }
  } catch {
    // Permission or missing index — try the broader user query next.
  }
  const end = periodEnd || weekStart
  try {
    const grouped = await loadTimesheetCandidatesByUserIds(organizationId, [userId], true)
    const picked = pickTimesheetDraftForPeriod(grouped.get(userId) || [], weekStart, end, timeZone)
    if (picked) return picked.draft
  } catch (error) {
    if (fromCandidates) return fromCandidates
    throw error
  }
  return fromCandidates || emptyTimesheetDraft()
}

async function loadTimesheetDraftsOnce(
  organizationId: string,
  userIds: string[],
  weekStart: Date,
  timeZone: string,
  periodEnd?: Date
): Promise<Map<string, TimesheetDraft>> {
  const wanted = new Set(userIds)
  const results = new Map<string, TimesheetDraft>()
  if (userIds.length === 0) return results

  try {
    const key = dayKey(weekStart, timeZone)
    const snap = await getDocs(
      query(collection(db, 'organizations', organizationId, 'settings'), where('weekStartKey', '==', key))
    )
    for (const entry of snap.docs) {
      const data = entry.data() as Record<string, unknown>
      const userId = typeof data.userId === 'string' ? data.userId : ''
      if (!wanted.has(userId) || results.has(userId)) continue
      results.set(userId, rememberSource(draftFromFirestoreMap(data, LIST_DRAFT_OPTIONS), entry.id))
    }
  } catch {
    // iOS docs often have no weekStartKey. Direct ids and the userId query follow.
  }

  let missing = userIds.filter((id) => !results.has(id))
  if (missing.length > 0) {
    const canonical = await Promise.all(
      missing.map(async (userId) => {
        const id = timesheetDocId(userId, weekStart, timeZone)
        return { userId, id, data: await readDoc(organizationId, id) }
      })
    )
    for (const hit of canonical) {
      if (!hit.data) continue
      results.set(hit.userId, rememberSource(draftFromFirestoreMap(hit.data, LIST_DRAFT_OPTIONS), hit.id))
    }
  }

  missing = userIds.filter((id) => !results.has(id))
  if (missing.length > 0) {
    const extras = await mapInBatches(missing, 12, async (userId) => {
      const draft = await loadTimesheetDraftByCandidates(organizationId, userId, weekStart, timeZone, false)
      return [userId, draft] as const
    })
    for (const [userId, draft] of extras) {
      if (draft) results.set(userId, draft)
    }
  }

  missing = userIds.filter((id) => !results.has(id))
  if (missing.length > 0) {
    const grouped = await loadTimesheetCandidatesByUserIds(organizationId, missing, false)
    const end = periodEnd || weekStart
    for (const userId of missing) {
      const picked = pickTimesheetDraftForPeriod(grouped.get(userId) || [], weekStart, end, timeZone)
      if (picked) results.set(userId, picked.draft)
    }
  }

  for (const userId of userIds) {
    if (!results.has(userId)) results.set(userId, emptyTimesheetDraft())
  }
  return results
}

export async function loadTimesheetDrafts(
  organizationId: string,
  userIds: string[],
  weekStart: Date,
  timeZone: string = LONDON_TIME_ZONE,
  periodEnd?: Date
): Promise<Map<string, TimesheetDraft>> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await loadTimesheetDraftsOnce(organizationId, userIds, weekStart, timeZone, periodEnd)
    } catch (error) {
      lastError = error
      if (attempt === 0) await delay(400)
    }
  }
  throw lastError
}

/** Load many pay periods for one person with a single userId query, then fill gaps. */
export async function loadTimesheetDraftsForStarts(
  organizationId: string,
  userId: string,
  weekStarts: Date[],
  timeZone: string = LONDON_TIME_ZONE
): Promise<Map<string, TimesheetDraft>> {
  const results = new Map<string, TimesheetDraft>()
  if (weekStarts.length === 0) return results
  const wanted = new Set(weekStarts.map((start) => dayKey(start, timeZone)))
  const rows = await listTimesheetStates(organizationId, userId, 400)
  for (const row of rows) {
    const key = dayKey(row.weekStart, timeZone)
    if (!wanted.has(key) || results.has(key)) continue
    results.set(key, row.draft)
  }
  const missing = weekStarts.filter((start) => !results.has(dayKey(start, timeZone)))
  // listTimesheetStates already loaded every cloud doc for this user. Only probe
  // canonical ids when that query returned nothing (permission/index miss).
  const probe = rows.length === 0 ? missing.slice(0, 24) : []
  if (probe.length > 0) {
    const extras = await Promise.all(
      probe.map(async (start) => {
        const draft = await loadTimesheetDraftByCandidates(organizationId, userId, start, timeZone)
        return [dayKey(start, timeZone), draft || emptyTimesheetDraft()] as const
      })
    )
    for (const [key, draft] of extras) results.set(key, draft)
  }
  for (const start of weekStarts) {
    const key = dayKey(start, timeZone)
    if (!results.has(key)) results.set(key, emptyTimesheetDraft())
  }
  return results
}

export async function saveTimesheetDraft({
  organizationId,
  userId,
  weekStart,
  draft,
  timeZone = LONDON_TIME_ZONE,
  documentId = null,
}: {
  organizationId: string
  userId: string
  weekStart: Date
  draft: TimesheetDraft
  timeZone?: string
  documentId?: string | null
}): Promise<void> {
  const canonicalId = timesheetDocId(userId, weekStart, timeZone)
  const ids = Array.from(
    new Set(
      [canonicalId, documentId || timesheetSourceDocumentId(draft)].filter((id): id is string => Boolean(id))
    )
  )
  const payload = sanitizeForFirestore({
    ...draftToFirestoreMap(draft),
    userId,
    weekStart: Timestamp.fromDate(weekStart),
    weekStartKey: dayKey(weekStart, timeZone),
    updatedAt: Timestamp.now(),
  }) as Record<string, unknown>
  await Promise.all(
    ids.map((id) => setDoc(doc(db, 'organizations', organizationId, 'settings', id), payload, { merge: true }))
  )
}

export type TimesheetStateRow = {
  documentId: string
  userId: string
  weekStart: Date
  draft: TimesheetDraft
}

/** iOS FirebaseBackend.listTimesheetStates — query by userId, sort weekStart desc. */
export async function listTimesheetStates(
  organizationId: string,
  userId: string,
  limit = 400
): Promise<TimesheetStateRow[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'organizations', organizationId, 'settings'), where('userId', '==', userId))
    )
    const rows: TimesheetStateRow[] = []
    for (const entry of snap.docs) {
      if (!entry.id.startsWith('timesheet_')) continue
      const data = entry.data() as Record<string, unknown>
      const weekStart = parseFirestoreDate(data.weekStart)
      if (!weekStart) continue
      rows.push({
        documentId: entry.id,
        userId,
        weekStart,
        draft: draftFromFirestoreMap(data, LIST_DRAFT_OPTIONS),
      })
    }
    rows.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
    return rows.slice(0, Math.max(1, limit))
  } catch {
    return []
  }
}

export type ExportedTimesheetHistoryRow = {
  id: string
  user: import('@/types').User
  weekStart: Date
  draft: TimesheetDraft
}

function ingestExportedRow(
  byId: Map<string, ExportedTimesheetHistoryRow>,
  member: import('@/types').User,
  weekStart: Date,
  draft: TimesheetDraft
) {
  if (!draft.exportedAt) return
  const id = `${member.id}|${Math.floor(weekStart.getTime() / 1000)}`
  byId.set(id, { id, user: member, weekStart, draft })
}

export async function loadExportedTimesheetHistory({
  organizationId,
  users,
}: {
  organizationId: string
  users: import('@/types').User[]
}): Promise<ExportedTimesheetHistoryRow[]> {
  const byId = new Map<string, ExportedTimesheetHistoryRow>()
  if (users.length === 0) return []
  const byUserId = new Map(users.map((user) => [user.id, user]))

  const ingestData = (member: import('@/types').User, weekStart: Date, data: Record<string, unknown>) => {
    ingestExportedRow(byId, member, weekStart, draftFromFirestoreMap(data, LIST_DRAFT_OPTIONS))
  }

  try {
    const snap = await getDocs(
      query(collection(db, 'organizations', organizationId, 'settings'), where('exportedAt', '!=', null))
    )
    for (const entry of snap.docs) {
      if (!entry.id.startsWith('timesheet_')) continue
      const data = entry.data() as Record<string, unknown>
      const userId = typeof data.userId === 'string' ? data.userId : ''
      const member = byUserId.get(userId)
      const weekStart = parseFirestoreDate(data.weekStart)
      if (!member || !weekStart) continue
      ingestData(member, weekStart, data)
    }
    if (byId.size > 0) {
      return Array.from(byId.values()).sort((a, b) => {
        const left = a.draft.exportedAt?.getTime() || 0
        const right = b.draft.exportedAt?.getTime() || 0
        if (left !== right) return right - left
        const an = `${a.user.firstName} ${a.user.surname}`.trim()
        const bn = `${b.user.firstName} ${b.user.surname}`.trim()
        return an.localeCompare(bn)
      })
    }
  } catch {
    // Missing index or rules — fall back to per-user list.
  }

  const batches = await mapInBatches(users, 8, async (member) => {
    const rows = await listTimesheetStates(organizationId, member.id, 400)
    return { member, rows }
  })
  for (const { member, rows } of batches) {
    for (const row of rows) ingestExportedRow(byId, member, row.weekStart, row.draft)
  }

  return Array.from(byId.values()).sort((a, b) => {
    const left = a.draft.exportedAt?.getTime() || 0
    const right = b.draft.exportedAt?.getTime() || 0
    if (left !== right) return right - left
    const an = `${a.user.firstName} ${a.user.surname}`.trim()
    const bn = `${b.user.firstName} ${b.user.surname}`.trim()
    return an.localeCompare(bn)
  })
}
