/**
 * iOS parity: FirebaseBackend.swift timesheetStateDocumentRef / saveTimesheetState,
 * InvoicingView.swift TimesheetDraftStore asFirestoreMap.
 *
 * Doc id: timesheet_{userId}_{unixStartOfDay} using the organisation origin-country zone.
 * Legacy yyyy-MM-dd / ISO-week keys are still read so older web drafts are not lost.
 */
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/config'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import { parseFirestoreDate as parseSharedFirestoreDate, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import { changedFirestoreFields } from '@/lib/firebase/changedFields'
import { firestoreUpdateFields } from '@/lib/firebase/partialWrite'
import { timesheetChangedFields } from '@/lib/canonical/timesheetEntryReviews'
import { timesheetDocumentSubjectId } from '@/lib/canonical/timesheetPeriod'
import { LONDON_TIME_ZONE, unixStartOfDay, dayKey } from '@/lib/ios-parity/londonTime'
import { weekStartKey } from '@/lib/timesheets/timesheetWeekUtils'
import { periodStartKey } from '@/lib/timesheets/paymentRunCopy'
import {
  parseTimesheetEntries,
  parseTimesheetEntryReviews,
  parseTimesheetStatusFields,
  pickTimesheetRowForPeriod,
  resolveTimesheetExportedAtMs,
  timesheetEntryReviewWriteFields,
  timesheetEntryReviewsAfterWrite,
  timesheetOwnerWriteFields,
  timesheetPeriodWriteFields,
  timesheetEntryEvidenceWriteFields,
  timesheetEvidenceOwnerIds,
  timesheetOwnerEntriesError,
  timesheetStoredStartDayKey,
  type TimesheetEntryDecision,
  type TimesheetEntryReview,
} from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
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
export function resolveTimesheetExportedAt(data: Record<string, unknown>): Date | null {
  const ms = resolveTimesheetExportedAtMs(data)
  return ms == null ? null : new Date(ms)
}

function asDecision(value: unknown): TimesheetManagerDecision {
  if (value === 'pending' || value === 'approved' || value === 'declined' || value === 'edited') return value
  return 'approved'
}

function decisionOf(value: TimesheetEntryDecision): TimesheetManagerDecision {
  return value
}

/**
 * Price work and expense entries through the rulebook reader `parseTimesheetEntries` (§1, §8): every entry with a
 * title is kept whatever its id, a stored id keeps its stored case, and an entry stored without one gets the
 * shared deterministic `timesheetEntryId` (never a fresh random id), so `extraEntryReviews[entryId]` finds it on
 * every read and every platform. The decision in effect is `timesheetEntryDecision` for that id.
 */
function mapEntries(
  data: Record<string, unknown>,
  sheetDocId: string,
  timeZone: string,
  /** Rulebook 1.45.0: every id the sheet's person goes by (`personIdSet`), so evidence they uploaded under their
   *  current id is kept on a sheet filed under an older one. */
  ownerUserIds: ReadonlyArray<string> = []
): { expenseEntries: TimesheetExpenseEntry[]; priceWorkEntries: TimesheetPriceWorkEntry[] } {
  const parsed = parseTimesheetEntries(sheetDocId, data, { timeZone, ownerUserIds })
  return {
    expenseEntries: parsed.expenseEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      details: entry.details,
      jobNumber: entry.jobNumber,
      date: entry.dateMs != null ? new Date(entry.dateMs) : new Date(),
      amount: entry.amount,
      receiptName: entry.receiptName,
      evidence: entry.evidence,
      reviewFingerprint: entry.reviewFingerprint,
      managerDecision: decisionOf(entry.managerDecision),
      managerRevisedAmount: entry.managerRevisedAmount,
    })),
    priceWorkEntries: parsed.priceWorkEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      details: entry.details,
      jobNumber: entry.jobNumber,
      agreedManagerName: entry.agreedManagerName,
      startDate: entry.startMs != null ? new Date(entry.startMs) : new Date(),
      endDate: entry.endMs != null ? new Date(entry.endMs) : null,
      amount: entry.amount,
      evidence: entry.evidence,
      reviewFingerprint: entry.reviewFingerprint,
      managerDecision: decisionOf(entry.managerDecision),
      managerRevisedAmount: entry.managerRevisedAmount,
    })),
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
    payBasis: row.payBasis === 'hourly' ? 'hourly' : row.payBasis === 'day' ? 'day' : undefined,
    isPayeDay: row.isPayeDay === true,
    isLeave: row.isLeave === true,
    isOvertime: row.isOvertime === true,
    otMultiplier: typeof row.otMultiplier === 'number' ? row.otMultiplier : null,
    decision: asDecision(row.decision),
    bookingId,
    // 1.46.0: the booking as signed, so a later Edit hours review of another version never re-prices the line.
    ...(typeof row.bookingFingerprint === 'string' && row.bookingFingerprint ? { bookingFingerprint: row.bookingFingerprint } : {}),
    ...(typeof row.bookingHadOvertimeLine === 'boolean' ? { bookingHadOvertimeLine: row.bookingHadOvertimeLine } : {}),
    ...(typeof row.appliedReviewKey === 'string' ? { appliedReviewKey: row.appliedReviewKey } : {}),
    ...(typeof row.reviewPartOf === 'string' && row.reviewPartOf ? { reviewPartOf: row.reviewPartOf } : {}),
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
      ...(line.payBasis === 'hourly' || line.payBasis === 'day' ? { payBasis: line.payBasis } : {}),
      // 1.46.0: the signed row's own PAYE / leave flags, on every line written.
      isPayeDay: line.isPayeDay === true,
      isLeave: line.isLeave === true,
      isOvertime: line.isOvertime,
      ...(line.isOvertime && line.otMultiplier != null ? { otMultiplier: line.otMultiplier } : {}),
      decision: line.decision,
      bookingId: line.bookingId || '',
      ...(line.bookingFingerprint ? { bookingFingerprint: line.bookingFingerprint } : {}),
      ...(line.bookingHadOvertimeLine != null ? { bookingHadOvertimeLine: line.bookingHadOvertimeLine } : {}),
      ...(line.appliedReviewKey != null ? { appliedReviewKey: line.appliedReviewKey } : {}),
      ...(line.reviewPartOf ? { reviewPartOf: line.reviewPartOf } : {}),
    })),
    priceWork: override.priceWork.map(money),
    expenses: override.expenses.map(money),
  }
}

const PAYROLL_LINE_EDIT_NUMBER_FIELDS = [
  'revisedStandardHours',
  'revisedOvertimeHours',
  'revisedOvertimeClockHours',
  'revisedOvertimeMultiplier',
  'revisedStandardAmount',
  'revisedOvertimeAmount',
] as const

/** Rulebook 1.46.0: the Edit hours fields of a review, only those stored (an older review gets none). */
function payrollLineEditFieldsOf(row: Record<string, unknown> | TimesheetPayrollLineReview): Partial<TimesheetPayrollLineReview> {
  const source = row as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of PAYROLL_LINE_EDIT_NUMBER_FIELDS) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
    else if (value === null && key === 'revisedOvertimeMultiplier' && typeof source.revisedStandardHours === 'number') out[key] = null
  }
  if (typeof source.reviewedBookingFingerprint === 'string') out.reviewedBookingFingerprint = source.reviewedBookingFingerprint
  return out as Partial<TimesheetPayrollLineReview>
}

function mapReviews(raw: unknown): Record<string, TimesheetPayrollLineReview> {
  if (!raw || typeof raw !== 'object') return {}
  const output: Record<string, TimesheetPayrollLineReview> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const row = (value || {}) as Record<string, unknown>
    output[key] = {
      decision: asDecision(row.decision),
      revisedAmount: typeof row.revisedAmount === 'number' ? row.revisedAmount : null,
      // 1.46.0: Edit hours keeps its hours, parts and booking fingerprint (`PayrollLineEditReviewFields`).
      ...payrollLineEditFieldsOf(row),
    }
  }
  return output
}

export function draftFromFirestoreMap(
  data: Record<string, unknown>,
  options?: { includeSignatures?: boolean; sheetDocId?: string | null; timeZone?: string | null; ownerUserIds?: ReadonlyArray<string> | null }
): TimesheetDraft {
  const includeSignatures = options?.includeSignatures !== false
  const status = parseTimesheetStatusFields(data)
  const entries = mapEntries(data, options?.sheetDocId?.trim() || '', organizationZoneOr(options?.timeZone), options?.ownerUserIds ?? [])

  return {
    managerNote: typeof data.managerNote === 'string' ? data.managerNote : '',
    operativeSignedAt: status.operativeSignedAtMs ? new Date(status.operativeSignedAtMs) : null,
    operativeSignedByName: status.operativeSignedByName || null,
    operativeSignatureImageBase64: includeSignatures ? status.operativeSignatureImageBase64 || null : null,
    managerSignedAt: status.managerSignedAtMs ? new Date(status.managerSignedAtMs) : null,
    managerSignedByName: status.managerSignedByName || null,
    managerSignedByUserId: status.managerSignedByUserId || null,
    managerSignatureImageBase64: includeSignatures ? status.managerSignatureImageBase64 || null : null,
    exportedAt: status.exportedAtMs ? new Date(status.exportedAtMs) : null,
    expenseEntries: entries.expenseEntries,
    priceWorkEntries: entries.priceWorkEntries,
    payrollLineReviews: mapReviews(data.payrollLineReviews),
    weeklyReportOverride: weeklyReportOverrideFromFirestore(data.weeklyReportOverride),
    extraEntryReviews: parseTimesheetEntryReviews(data),
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
    approvedAt: draft.managerSignedAt ? Timestamp.fromDate(draft.managerSignedAt) : null,
    approvedByName: draft.managerSignedByName || '',
    exportedAt: draft.exportedAt ? Timestamp.fromDate(draft.exportedAt) : null,
    expenseEntries: draft.expenseEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      details: entry.details,
      jobNumber: entry.jobNumber,
      date: Timestamp.fromDate(entry.date),
      amount: entry.amount,
      receiptName: entry.receiptName || '',
      // Rulebook 1.45.0 §8: written only when the entry has evidence, so an older entry's stored shape is unchanged.
      ...(entry.evidence && entry.evidence.length > 0 ? { evidence: timesheetEntryEvidenceWriteFields(entry.evidence) } : {}),
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
      ...(entry.evidence && entry.evidence.length > 0 ? { evidence: timesheetEntryEvidenceWriteFields(entry.evidence) } : {}),
      managerDecision: entry.managerDecision,
      managerRevisedAmount: entry.managerRevisedAmount ?? null,
    })),
    payrollLineReviews: Object.fromEntries(
      Object.entries(draft.payrollLineReviews).map(([key, review]) => [
        key,
        { decision: review.decision, revisedAmount: review.revisedAmount ?? null, ...payrollLineEditFieldsOf(review) },
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
  endDayKey?: string | null
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
  const period = { startDayKey: dayKey(periodStart, timeZone), endDayKey: dayKey(periodEnd, timeZone) }
  const index = pickTimesheetRowForPeriod(
    rows.map((row) => ({
      startDayKey: timesheetStoredStartDayKey(row.weekStart, timeZone) || dayKey(row.weekStart, timeZone),
      endDayKey: row.endDayKey || null,
      hasActivity: timesheetDraftHasActivity(row.draft),
    })),
    period
  )
  return index >= 0 ? rows[index] || null : null
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

/**
 * Reads every document id the period's sheet can be stored under (`candidateTimesheetDocIds`). `allMissing` is true
 * only when every one of those reads answered and none exists — never when a read failed (`readDoc` throws then, and
 * so does this).
 */
async function loadTimesheetDraftByCandidates(
  organizationId: string,
  userId: string,
  weekStart: Date,
  timeZone: string,
  includeSignatures = true,
  ownerUserIds: ReadonlyArray<string> = [userId]
): Promise<{ draft: TimesheetDraft | null; allMissing: boolean }> {
  const unique = [...new Set(candidateTimesheetDocIds(userId, weekStart, timeZone))]
  const hits = await Promise.all(unique.map(async (id) => ({ id, data: await readDoc(organizationId, id) })))
  const hit = hits.find((row) => row.data)
  if (hit?.data) {
    return { draft: rememberSource(draftFromFirestoreMap(hit.data, { includeSignatures, sheetDocId: hit.id, timeZone, ownerUserIds }), hit.id), allMissing: false }
  }
  return { draft: null, allMissing: unique.length > 0 && hits.every((row) => row.data == null) }
}

function storedEndDayKey(data: Record<string, unknown>, timeZone: string): string | null {
  if (typeof data.weekEndKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.weekEndKey)) return data.weekEndKey
  const weekEnd = parseFirestoreDate(data.weekEnd)
  return weekEnd ? dayKey(weekEnd, timeZone) : null
}

function timesheetStateFromDoc(
  documentId: string,
  data: Record<string, unknown>,
  includeSignatures: boolean,
  timeZone: string = LONDON_TIME_ZONE
): TimesheetPeriodCandidate | null {
  if (!documentId.startsWith('timesheet_')) return null
  const weekStart = parseFirestoreDate(data.weekStart)
  if (!weekStart) return null
  return {
    documentId,
    weekStart,
    endDayKey: storedEndDayKey(data, timeZone),
    draft: rememberSource(draftFromFirestoreMap(data, { includeSignatures, sheetDocId: documentId, timeZone }), documentId),
  }
}

const USER_ID_QUERY_CHUNK = 10

/** One settings query per chunk, instead of a full history read per person. */
async function loadTimesheetCandidatesByUserIds(
  organizationId: string,
  userIds: string[],
  includeSignatures: boolean,
  // 1.43.0 (guardrail 2): stored end days are read in the organisation's zone, never London by default.
  timeZone: string
): Promise<Map<string, TimesheetPeriodCandidate[]>> {
  const grouped = new Map<string, TimesheetPeriodCandidate[]>()
  for (const userId of userIds) grouped.set(userId, [])
  const chunks: string[][] = []
  for (let index = 0; index < userIds.length; index += USER_ID_QUERY_CHUNK) {
    const chunk = userIds.slice(index, index + USER_ID_QUERY_CHUNK)
    if (chunk.length > 0) chunks.push(chunk)
  }
  const snaps = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, 'organizations', organizationId, 'settings'), where('userId', 'in', chunk)))
    )
  )
  for (const snap of snaps) {
    for (const entry of snap.docs) {
      const data = entry.data() as Record<string, unknown>
      const userId = typeof data.userId === 'string' ? data.userId : ''
      if (!grouped.has(userId)) continue
      const row = timesheetStateFromDoc(entry.id, data, includeSignatures, timeZone)
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
  periodEnd?: Date,
  /** Rulebook 1.45.0: every id of the person (`personIdSet`); their own id when not given. */
  ownerUserIds: ReadonlyArray<string> = [userId]
): Promise<TimesheetDraft> {
  const direct = await loadTimesheetDraftByCandidates(organizationId, userId, weekStart, timeZone, true, ownerUserIds)
  if (direct.draft) return direct.draft
  try {
    const key = dayKey(weekStart, timeZone)
    const snap = await getDocs(
      query(collection(db, 'organizations', organizationId, 'settings'), where('weekStartKey', '==', key))
    )
    for (const entry of snap.docs) {
      const data = entry.data() as Record<string, unknown>
      if (data.userId === userId) return rememberSource(draftFromFirestoreMap(data, { sheetDocId: entry.id, timeZone, ownerUserIds }), entry.id)
      if (weekStartMatches(data, weekStart, timeZone) && entry.id.includes(userId)) {
        return rememberSource(draftFromFirestoreMap(data, { sheetDocId: entry.id, timeZone, ownerUserIds }), entry.id)
      }
    }
  } catch {
    // Permission or missing index — try the broader user query next.
  }
  const end = periodEnd || weekStart
  try {
    const grouped = await loadTimesheetCandidatesByUserIds(organizationId, [userId], true, timeZone)
    const picked = pickTimesheetDraftForPeriod(grouped.get(userId) || [], weekStart, end, timeZone)
    if (picked) return picked.draft
  } catch (error) {
    // 1.43.0 (review r318, 2nd round): a failed history query is shown as an error with Retry
    // (`TIMESHEET_HISTORY_LOAD_FAILED_MESSAGE` on the period page) — never an empty new sheet, because a sheet may be
    // stored under an id the direct reads did not try, and a save would then create a second one.
    console.warn('[timesheets] history query failed', { allExpectedIdsMissing: direct.allMissing, error })
    throw error
  }
  return emptyTimesheetDraft()
}

function applyKeyedTimesheetDocs(
  results: Map<string, TimesheetDraft>,
  wanted: Set<string>,
  snap: Awaited<ReturnType<typeof getDocs>> | null
) {
  if (!snap) return
  for (const entry of snap.docs) {
    const data = entry.data() as Record<string, unknown>
    const userId = typeof data.userId === 'string' ? data.userId : ''
    if (!wanted.has(userId) || results.has(userId)) continue
    results.set(userId, rememberSource(draftFromFirestoreMap(data, { ...LIST_DRAFT_OPTIONS, sheetDocId: entry.id }), entry.id))
  }
}

/** Current pay-run sheets from each person's history — one batched userId query, no per-user getDoc waterfall. */
export async function loadTimesheetDraftsByUserHistory(
  organizationId: string,
  userIds: string[],
  weekStart: Date,
  timeZone: string,
  periodEnd?: Date
): Promise<Map<string, TimesheetDraft>> {
  const results = new Map<string, TimesheetDraft>()
  if (userIds.length === 0) return results
  const grouped = await loadTimesheetCandidatesByUserIds(organizationId, userIds, false, timeZone)
  const end = periodEnd || weekStart
  for (const userId of userIds) {
    const picked = pickTimesheetDraftForPeriod(grouped.get(userId) || [], weekStart, end, timeZone)
    if (picked) results.set(userId, picked.draft)
  }
  return results
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

  // Wave 1: this period's weekStartKey plus one userId-in history query.
  // Do not getDoc every canonical / candidate id up front — that was the hub N+1.
  const key = dayKey(weekStart, timeZone)
  const end = periodEnd || weekStart
  const [keyed, grouped] = await Promise.all([
    getDocs(query(collection(db, 'organizations', organizationId, 'settings'), where('weekStartKey', '==', key))).catch(
      () => null // iOS docs often have no weekStartKey. The userId query covers them.
    ),
    loadTimesheetCandidatesByUserIds(organizationId, userIds, false, timeZone).catch(() => null),
  ])
  applyKeyedTimesheetDocs(results, wanted, keyed)
  if (grouped) {
    for (const userId of userIds) {
      if (results.has(userId)) continue
      const picked = pickTimesheetDraftForPeriod(grouped.get(userId) || [], weekStart, end, timeZone)
      if (picked) results.set(userId, picked.draft)
    }
  }

  // Wave 2: only when the batched history query failed — probe other id spellings.
  const missing = userIds.filter((id) => !results.has(id))
  if (missing.length > 0 && !grouped) {
    const extras = await mapInBatches(missing, 12, async (userId) => {
      const { draft } = await loadTimesheetDraftByCandidates(organizationId, userId, weekStart, timeZone, false)
      return [userId, draft] as const
    })
    for (const [userId, draft] of extras) {
      if (draft) results.set(userId, draft)
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
        const { draft } = await loadTimesheetDraftByCandidates(organizationId, userId, start, timeZone)
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

/**
 * Save a timesheet. Edits to a stored sheet are partial updates of the changed fields only.
 * `access.reviewer` is `timesheetWriterIsReviewer` (line manager or admin);
 * without it, a write by anyone other than the subject is the reviewer's, since only a reviewer
 * may write someone else's sheet. The owner's save drops the reviewer-only parts
 * (`timesheetOwnerWriteFields`); a reviewer's save also writes changed entry decisions to
 * `extraEntryReviews` as a dotted update (`timesheetEntryReviewWriteFields`).
 * Returns the stored entry reviews after the save.
 */
export async function saveTimesheetDraft({
  organizationId,
  userId,
  weekStart,
  draft,
  timeZone = LONDON_TIME_ZONE,
  documentId = null,
  weekEnd = null,
  access,
  base = null,
}: {
  organizationId: string
  userId: string
  weekStart: Date
  draft: TimesheetDraft
  timeZone?: string
  documentId?: string | null
  weekEnd?: Date | null
  access?: { reviewer?: boolean; subjectHasLineManager?: boolean }
  /**
   * Rulebook 1.9.0 `timesheetChangedFields`: the sheet as this editor loaded it. Only fields that differ from it are
   * written, so changes saved on another device since the load (an owner's signature, expenses, price work) stay.
   */
  base?: TimesheetDraft | null
}): Promise<Record<string, TimesheetEntryReview> | null> {
  const writerId = auth?.currentUser?.uid || ''
  const reviewer = access?.reviewer ?? Boolean(writerId && writerId !== userId)
  const canonicalId = timesheetDocId(userId, weekStart, timeZone)
  const ids = Array.from(
    new Set(
      [canonicalId, documentId || timesheetSourceDocumentId(draft)].filter((id): id is string => Boolean(id))
    )
  )
  const end = weekEnd || weekStart
  const periodFields = timesheetPeriodWriteFields({
    userId,
    startDayKey: dayKey(weekStart, timeZone),
    endDayKey: dayKey(end, timeZone),
  })
  const sheetPayload = (managerSigned: boolean, source: TimesheetDraft) => {
    const sheetFields = reviewer
      ? draftToFirestoreMap(source)
      : timesheetOwnerWriteFields(draftToFirestoreMap(source), {
          // Unknown counts as having one: the snapshot is then left to the line manager.
          subjectHasLineManager: access?.subjectHasLineManager !== false,
          managerSigned,
        })
    return sanitizeForFirestore({
      ...sheetFields,
      ...periodFields,
      userId,
      weekStart: Timestamp.fromDate(weekStart),
      weekEnd: Timestamp.fromDate(end),
    }) as Record<string, unknown>
  }
  // Rulebook 1.30.1 / 1.45.0 (`timesheetOwnerEntriesError`): the owner's new or edited entries are checked — price work
  // needs a job number, an expense at least one piece of evidence, and evidence must be in the owner's own claim folder.
  // Entries they did not touch — older ones without a job number or with only a receipt name — never block a save.
  // Compared with the sheet as this editor loaded it, else as stored. A reviewer's save never asks.
  if (!reviewer) {
    let previous: { priceWorkEntries?: unknown[]; expenseEntries?: unknown[] } | null = null
    if (base) {
      const loaded = draftToFirestoreMap(base)
      previous = { priceWorkEntries: loaded.priceWorkEntries as unknown[], expenseEntries: loaded.expenseEntries as unknown[] }
    } else {
      for (const id of ids) {
        try {
          const stored = await readDoc(organizationId, id)
          if (stored) {
            previous = {
              priceWorkEntries: Array.isArray(stored.priceWorkEntries) ? stored.priceWorkEntries : [],
              expenseEntries: Array.isArray(stored.expenseEntries) ? stored.expenseEntries : [],
            }
            break
          }
        } catch {
          // Unreadable: compared with nothing, so every entry counts as new.
        }
      }
    }
    const next = draftToFirestoreMap(draft)
    const entriesError = timesheetOwnerEntriesError({
      previous,
      next: { priceWorkEntries: next.priceWorkEntries as unknown[], expenseEntries: next.expenseEntries as unknown[] },
      organizationId,
      // The uploader is the signed-in owner; the sheet's own ids count as theirs too.
      ownerUserIds: timesheetEvidenceOwnerIds(canonicalId, { userId }, [writerId]),
    })
    if (entriesError) throw new Error(entriesError)
  }
  // Who and where (`writeMetadataFields`) plus the server time, on every timesheet save.
  const metadata = { ...(writeMetadataFields(writerId, 'web') ?? {}), updatedAt: serverTimestamp() }
  // Partial writes (rulebook §1): an existing sheet gets only the fields that changed (`updateDoc`), so stored
  // manager values the owner may not send (`timesheetOwnerWriteFields`) are never resent. A new sheet is created.
  await Promise.all(
    ids.map(async (id) => {
      const ref = doc(db, 'organizations', organizationId, 'settings', id)
      let stored: Record<string, unknown> | null | undefined
      try {
        stored = await readDoc(organizationId, id)
      } catch {
        stored = undefined
      }
      if (stored === null || stored === undefined) {
        // No stored sheet (or it could not be read): create / merge, which never deletes a stored field.
        await setDoc(ref, { ...sheetPayload(Boolean(draft.managerSignedAt), draft), ...metadata }, { merge: true })
        return
      }
      // 1.9.0: whether the line manager has signed comes from the stored copy, never from a stale local draft.
      const managerSigned = Boolean(draftFromFirestoreMap(stored, { includeSignatures: false }).managerSignedAt)
      const payload = sheetPayload(managerSigned, draft)
      if (base) {
        const write = timesheetChangedFields(sanitizeForFirestore(sheetPayload(managerSigned, base)) as Record<string, unknown>, payload)
        // The period identity is always kept current; everything else only when this editor changed it.
        for (const key of Object.keys(periodFields)) {
          if (payload[key] !== undefined && stored[key] === undefined) write.set[key] = payload[key]
        }
        if (Object.keys(write.set).length === 0 && write.remove.length === 0) return
        await updateDoc(ref, { ...firestoreUpdateFields(write), ...metadata })
        return
      }
      const changed = changedFirestoreFields(payload, stored)
      if (Object.keys(changed).length === 0) return
      await updateDoc(ref, { ...changed, ...metadata })
    })
  )
  if (!reviewer) return draft.extraEntryReviews ?? null
  const reviewFields = timesheetEntryReviewWriteFields({
    stored: draft.extraEntryReviews ?? null,
    entries: [...draft.expenseEntries, ...draft.priceWorkEntries],
    reviewedByUserId: writerId,
    reviewedAtMs: Date.now(),
  })
  if (Object.keys(reviewFields).length === 0) return draft.extraEntryReviews ?? null
  await Promise.all(
    ids.map((id) => updateDoc(doc(db, 'organizations', organizationId, 'settings', id), reviewFields))
  )
  return timesheetEntryReviewsAfterWrite(draft.extraEntryReviews ?? null, reviewFields)
}

export type TimesheetStateRow = {
  documentId: string
  userId: string
  weekStart: Date
  endDayKey?: string | null
  draft: TimesheetDraft
}

/**
 * Timesheet documents for one pay period. This is the list query.
 * It does not read every person's history.
 */
/**
 * Direct timesheet document ids for this pay period. iOS often omits weekStartKey,
 * so the indexed list query misses them. This does not read each person's history.
 */
export async function loadCanonicalTimesheetDrafts(
  organizationId: string,
  userIds: string[],
  weekStart: Date,
  timeZone: string = LONDON_TIME_ZONE
): Promise<Map<string, TimesheetDraft>> {
  const results = new Map<string, TimesheetDraft>()
  const hits = await mapInBatches(userIds, 12, async (userId) => {
    for (const id of candidateTimesheetDocIds(userId, weekStart, timeZone)) {
      const data = await readDoc(organizationId, id)
      if (!data) continue
      return [userId, rememberSource(draftFromFirestoreMap(data, { ...LIST_DRAFT_OPTIONS, sheetDocId: id }), id)] as const
    }
    return null
  })
  for (const hit of hits) {
    if (hit) results.set(hit[0], hit[1])
  }
  return results
}

export async function loadPayPeriodTimesheetDrafts(
  organizationId: string,
  weekStart: Date,
  timeZone: string = LONDON_TIME_ZONE
): Promise<Map<string, TimesheetDraft>> {
  const results = new Map<string, TimesheetDraft>()
  const key = dayKey(weekStart, timeZone)
  const snap = await getDocs(
    query(collection(db, 'organizations', organizationId, 'settings'), where('weekStartKey', '==', key))
  )
  for (const entry of snap.docs) {
    if (!entry.id.startsWith('timesheet_')) continue
    const data = entry.data() as Record<string, unknown>
    const userId = typeof data.userId === 'string' ? data.userId : ''
    if (!userId || results.has(userId)) continue
    results.set(userId, rememberSource(draftFromFirestoreMap(data, { ...LIST_DRAFT_OPTIONS, sheetDocId: entry.id }), entry.id))
  }
  return results
}

/** Add later rows without dropping timesheets the list already showed. */
export function mergeListedTimesheetDrafts(
  current: ReadonlyMap<string, TimesheetDraft>,
  incoming: ReadonlyMap<string, TimesheetDraft>
): Map<string, TimesheetDraft> {
  const next = new Map(current)
  for (const [userId, draft] of incoming) {
    if (!draft.operativeSignedAt && !draft.managerSignedAt && !draft.exportedAt) continue
    next.set(userId, draft)
  }
  return next
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
        endDayKey: storedEndDayKey(data, LONDON_TIME_ZONE),
        draft: draftFromFirestoreMap(data, { ...LIST_DRAFT_OPTIONS, sheetDocId: entry.id }),
      })
    }
    rows.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
    return rows.slice(0, Math.max(1, limit))
  } catch (error) {
    // 1.43.0: never an error on screen; logged so a refused query (rules) is visible in the console.
    console.warn('[timesheets] listTimesheetStates query failed', error)
    return []
  }
}

export type ExportedTimesheetHistoryRow = {
  id: string
  user: import('@/types').User
  weekStart: Date
  endDayKey?: string | null
  draft: TimesheetDraft
}

const EXPORTED_HISTORY_TTL_MS = 20_000
let exportedHistoryMemo: { key: string; rows: ExportedTimesheetHistoryRow[]; at: number } | null = null

function exportedHistoryCacheKey(organizationId: string, users: Array<{ id: string }>): string {
  return `${organizationId}|${users.map((user) => user.id).slice().sort().join(',')}`
}

export function forgetExportedTimesheetHistory(): void {
  exportedHistoryMemo = null
}

function ingestExportedRow(
  byId: Map<string, ExportedTimesheetHistoryRow>,
  member: import('@/types').User,
  weekStart: Date,
  draft: TimesheetDraft,
  endDayKey?: string | null
) {
  if (!draft.exportedAt) return
  const id = `${member.id}|${Math.floor(weekStart.getTime() / 1000)}`
  byId.set(id, { id, user: member, weekStart, endDayKey, draft })
}

export async function loadExportedTimesheetHistory({
  organizationId,
  users,
}: {
  organizationId: string
  users: import('@/types').User[]
}): Promise<ExportedTimesheetHistoryRow[]> {
  if (users.length === 0) return []
  const cacheKey = exportedHistoryCacheKey(organizationId, users)
  const now = Date.now()
  if (exportedHistoryMemo && exportedHistoryMemo.key === cacheKey && now - exportedHistoryMemo.at < EXPORTED_HISTORY_TTL_MS) {
    return exportedHistoryMemo.rows
  }
  const byId = new Map<string, ExportedTimesheetHistoryRow>()
  const byUserId = new Map(users.map((user) => [user.id, user]))

  const ingestData = (member: import('@/types').User, weekStart: Date, data: Record<string, unknown>) => {
    ingestExportedRow(
      byId,
      member,
      weekStart,
      draftFromFirestoreMap(data, LIST_DRAFT_OPTIONS),
      storedEndDayKey(data, LONDON_TIME_ZONE)
    )
  }

  try {
    const snap = await getDocs(
      query(collection(db, 'organizations', organizationId, 'settings'), where('exportedAt', '!=', null))
    )
    for (const entry of snap.docs) {
      if (!entry.id.startsWith('timesheet_')) continue
      const data = entry.data() as Record<string, unknown>
      // Rulebook 1.31.0: a sheet stored without `userId` (older builds) is matched by its document id
      // (`timesheetDocumentSubjectId`), never dropped by this fast path.
      const userId =
        (typeof data.userId === 'string' && data.userId.trim()) || timesheetDocumentSubjectId(entry.id)
      const member = byUserId.get(userId) ?? users.find((row) => row.id.toLowerCase() === userId.toLowerCase())
      const weekStart = parseFirestoreDate(data.weekStart)
      if (!member || !weekStart) continue
      ingestData(member, weekStart, data)
    }
    if (byId.size > 0) {
      const rows = Array.from(byId.values()).sort((a, b) => {
        const left = a.draft.exportedAt?.getTime() || 0
        const right = b.draft.exportedAt?.getTime() || 0
        if (left !== right) return right - left
        const an = `${a.user.firstName} ${a.user.surname}`.trim()
        const bn = `${b.user.firstName} ${b.user.surname}`.trim()
        return an.localeCompare(bn)
      })
      exportedHistoryMemo = { key: cacheKey, rows, at: now }
      return rows
    }
  } catch {
    // Missing index or rules — fall back to per-user list.
  }

  const batches = await mapInBatches(users, 8, async (member) => {
    const rows = await listTimesheetStates(organizationId, member.id, 400)
    return { member, rows }
  })
  for (const { member, rows } of batches) {
    for (const row of rows) ingestExportedRow(byId, member, row.weekStart, row.draft, row.endDayKey)
  }

  const rows = Array.from(byId.values()).sort((a, b) => {
    const left = a.draft.exportedAt?.getTime() || 0
    const right = b.draft.exportedAt?.getTime() || 0
    if (left !== right) return right - left
    const an = `${a.user.firstName} ${a.user.surname}`.trim()
    const bn = `${b.user.firstName} ${b.user.surname}`.trim()
    return an.localeCompare(bn)
  })
  exportedHistoryMemo = { key: cacheKey, rows, at: now }
  return rows
}
