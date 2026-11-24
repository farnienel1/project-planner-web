/**
 * iOS parity: FirebaseBackend.swift timesheetStateDocumentRef / saveTimesheetState,
 * InvoicingView.swift TimesheetDraftStore asFirestoreMap.
 *
 * Doc id: timesheet_{userId}_{unixStartOfDay} using the organisation origin-country zone.
 * Legacy yyyy-MM-dd / ISO-week keys are still read so older web drafts are not lost.
 */
import { collection, doc, documentId, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/config'
import { privatePayFor, securitySwitchesLoaded, securitySwitchesReady } from '@/lib/access/securitySwitches'
import { writeMetadataFields } from '@/lib/canonical/writeMetadata'
import { parseFirestoreDate as parseSharedFirestoreDate, sanitizeForFirestore } from '@/lib/firebase/firestoreUtils'
import { changedFirestoreFields } from '@/lib/firebase/changedFields'
import { firestoreUpdateFields } from '@/lib/firebase/partialWrite'
import { timesheetChangedFields } from '@/lib/canonical/timesheetEntryReviews'
import { timesheetDocumentSubjectId } from '@/lib/canonical/timesheetPeriod'
import { urlDocumentId } from '@/lib/firebase/urlDocumentId'
import { timesheetSheetHasActivity } from '@/lib/canonical/userTimesheetQueue'
import { LONDON_TIME_ZONE, unixStartOfDay, dayKey } from '@/lib/ios-parity/londonTime'
import { weekStartKey } from '@/lib/timesheets/timesheetWeekUtils'
import { periodStartKey } from '@/lib/timesheets/paymentRunCopy'
import { queryIdsSkippingRefused, timesheetMemberIds, timesheetOwnerResolver } from '@/lib/timesheets/timesheetQueue'
import { newestFirstOwnIdLast, personTimesheetDocs, timesheetLookupPlan, timesheetDocumentOwnerId } from '@/lib/timesheets/personTimesheetDocs'
import { UNKNOWN_BOOKING_PERSON_LABEL, bookingPersonIdHint, formerPersonForId, formerPersonLabel, type FormerPerson } from '@/lib/canonical'
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
  timesheetExportedFieldSet,
  timesheetLateExtrasSummary,
  parseTimesheetLateExtras,
  TIMESHEET_LATE_EXTRAS_FIELD,
  TIMESHEET_ENTRY_REVIEWS_FIELD,
  isTimesheetRevisionDocId,
  parseTimesheetRevisionDocId,
  timesheetLatestVersion,
  timesheetRevisionCreateFields,
  timesheetRevisionDocId,
  timesheetVersionsForPeriod,
  type TimesheetVersion,
  normalizeDocumentId,
} from '@/lib/canonical'
import { draftEntryFingerprints, draftReviewEntries, draftStoredExported } from '@/lib/timesheets/timesheetAdjustments'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import {
  emptyTimesheetDraft,
  type TimesheetDraft,
  type TimesheetExpenseEntry,
  type TimesheetLateExtra,
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

/** Rulebook 1.54.0 §8: `lateExtras` through `parseTimesheetLateExtras` (the late decision, never an inline one). */
function mapLateExtras(
  data: Record<string, unknown>,
  sheetDocId: string,
  timeZone: string,
  ownerUserIds: ReadonlyArray<string> = []
): TimesheetLateExtra[] | undefined {
  if (!Array.isArray(data[TIMESHEET_LATE_EXTRAS_FIELD])) return undefined
  return parseTimesheetLateExtras(sheetDocId, data, { timeZone, ownerUserIds }).map((entry): TimesheetLateExtra => {
    const common = {
      id: entry.id,
      title: entry.title,
      details: entry.details,
      jobNumber: entry.jobNumber,
      amount: entry.amount,
      evidence: entry.evidence,
      reviewFingerprint: entry.reviewFingerprint,
      managerDecision: decisionOf(entry.managerDecision),
      managerRevisedAmount: entry.managerRevisedAmount,
      // Third review of #337: an ignored late extra (id taken) is shown, never offered for review or paid.
      lateState: entry.lateDecision.state,
      lateReason: entry.lateDecision.reason,
    }
    if (entry.kind === 'priceWork') {
      return {
        ...common,
        kind: 'priceWork',
        agreedManagerName: entry.agreedManagerName,
        startDate: entry.startMs != null ? new Date(entry.startMs) : new Date(),
        endDate: entry.endMs != null ? new Date(entry.endMs) : null,
      }
    }
    return {
      ...common,
      kind: 'expense',
      date: entry.dateMs != null ? new Date(entry.dateMs) : new Date(),
      receiptName: entry.receiptName,
    }
  })
}

/**
 * The stored `lateExtras` rows the reader did not return (16 Nov scan), kept exactly as stored so the next save writes
 * them back. A row counts as read only when it passes the reader's own tests (`parseTimesheetLateExtras`): a kind and
 * an id, and — per id, without case, in stored order — the first row whose kind's entries hold a row of that id with a
 * title (`parseTimesheetEntries` keeps titled rows only), which is the row returned. Every other row (a blank title,
 * no id, no kind, a later copy of an id) is kept. `read` (the entries the reader returned) is a safety net: a row whose
 * id was not returned is never counted as read.
 */
export function unreadLateExtraRows(data: Record<string, unknown>, read: ReadonlyArray<{ id: string }>): Record<string, unknown>[] {
  const { rows, readIndexes } = lateExtraReadIndexes(data, read)
  return rows.flatMap((row, index) => (row && !readIndexes.has(index) ? [row] : []))
}

/** A kept late-extra row's identity for `lateExtrasLayout` (its stored content; identical rows are interchangeable). */
export function lateExtraRowKey(row: Record<string, unknown>): string {
  return JSON.stringify(row)
}

/**
 * Review of #347: the stored order of `lateExtras` — each stored row in place, as a read row (its id without case) or a
 * kept row (`lateExtraRowKey`). Not-a-record entries are left out (they were never kept).
 */
export function lateExtrasStoredLayout(
  data: Record<string, unknown>,
  read: ReadonlyArray<{ id: string }>
): Array<{ read: string } | { unread: string }> {
  const { rows, readIndexes } = lateExtraReadIndexes(data, read)
  return rows.flatMap((row, index) => {
    if (!row) return []
    return [readIndexes.has(index) ? { read: normalizeDocumentId(row.id) } : { unread: lateExtraRowKey(row) }]
  })
}

/**
 * Review of #347: the `lateExtras` list a save writes — read rows and kept rows each in their own stored slot
 * (`layout`), a row the person deleted left out, and new rows appended after. Without a layout: shown rows, then kept.
 */
export function lateExtrasForWrite(
  shown: ReadonlyArray<Record<string, unknown>>,
  unread: ReadonlyArray<Record<string, unknown>>,
  layout: ReadonlyArray<{ read: string } | { unread: string }> | null | undefined
): Record<string, unknown>[] {
  if (!layout || layout.length === 0) return [...shown, ...unread]
  const shownLeft = [...shown]
  const unreadLeft = [...unread]
  const out: Record<string, unknown>[] = []
  for (const slot of layout) {
    if ('read' in slot) {
      const at = shownLeft.findIndex((row) => normalizeDocumentId(row.id) === slot.read)
      if (at >= 0) out.push(...shownLeft.splice(at, 1))
    } else {
      const at = unreadLeft.findIndex((row) => lateExtraRowKey(row) === slot.unread)
      if (at >= 0) out.push(...unreadLeft.splice(at, 1))
    }
  }
  return [...out, ...shownLeft, ...unreadLeft]
}

function lateExtraReadIndexes(
  data: Record<string, unknown>,
  read: ReadonlyArray<{ id: string }>
): { rows: Array<Record<string, unknown> | null>; readIndexes: Set<number> } {
  const stored = data[TIMESHEET_LATE_EXTRAS_FIELD]
  if (!Array.isArray(stored)) return { rows: [], readIndexes: new Set() }
  const returned = new Set(read.map((entry) => normalizeDocumentId(entry.id)))
  const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
  const kindOf = (row: Record<string, unknown>) => (row.kind === 'priceWork' || row.kind === 'expense' ? row.kind : null)
  const rows = stored.map((raw) => (raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null))
  const readIndexes = new Set<number>()
  const seen = new Set<string>()
  rows.forEach((row) => {
    if (!row) return
    const kind = kindOf(row)
    const id = str(row.id)
    if (!kind || !id) return
    const key = normalizeDocumentId(id)
    if (seen.has(key) || !returned.has(key)) return
    const index = rows.findIndex(
      (other) => other != null && kindOf(other) === kind && str(other.id) !== '' && normalizeDocumentId(other.id) === key && str(other.title) !== ''
    )
    if (index < 0) return
    readIndexes.add(index)
    seen.add(key)
  })
  return { rows, readIndexes }
}

/**
 * 16 Nov scan (review of #347): the kept rows after the person's late-extras change from `before` to `next` — a kept row
 * that shares an id (without case) with a late extra the person deleted in that change goes with it, so a hidden copy
 * never comes back as a visible late extra.
 */
export function lateExtrasUnreadAfter(
  unread: ReadonlyArray<Record<string, unknown>> | null | undefined,
  before: ReadonlyArray<{ id: string }> | null | undefined,
  next: ReadonlyArray<{ id: string }>
): Record<string, unknown>[] {
  const kept = new Set(next.map((entry) => normalizeDocumentId(entry.id)))
  const deleted = new Set((before ?? []).map((entry) => normalizeDocumentId(entry.id)).filter((key) => key && !kept.has(key)))
  // Second review of #347: only a kept row the reader could later show goes (kind exactly priceWork / expense, a string
  // id, a non-blank title); a row it can never show (blank title, no or padded kind, no string id) is kept as stored.
  const couldShow = (row: Record<string, unknown>) =>
    (row.kind === 'priceWork' || row.kind === 'expense') &&
    typeof row.id === 'string' &&
    row.id.trim() !== '' &&
    typeof row.title === 'string' &&
    row.title.trim() !== ''
  return (unread ?? []).filter((row) => !(couldShow(row) && deleted.has(normalizeDocumentId(row.id))))
}

/**
 * Rulebook 1.54.0: the owner's late extras follow the entry rules (job number, evidence), checked by kind against the
 * sheet as this editor loaded it (`base`; none: every late extra counts as new). Review of #347: only the person's own
 * late extras (the draft's), never the rows kept as stored (`lateExtrasUnread`) — they are written back untouched and
 * are not the person's edit (a second stored copy of an id would otherwise always read as an edit and refuse the save).
 */
export function ownerLateExtrasError(input: {
  base: TimesheetDraft | null
  draft: TimesheetDraft
  organizationId: string
  ownerUserIds: ReadonlyArray<string>
}): string | null {
  const lateOf = (rows: Record<string, unknown>[] | undefined, kind: string) => (rows ?? []).filter((row) => row.kind === kind)
  const previousLate = input.base ? (input.base.lateExtras ?? []).map(lateExtraToFirestore) : undefined
  const nextLate = (input.draft.lateExtras ?? []).map(lateExtraToFirestore)
  return timesheetOwnerEntriesError({
    previous: { priceWorkEntries: lateOf(previousLate, 'priceWork'), expenseEntries: lateOf(previousLate, 'expense') },
    next: { priceWorkEntries: lateOf(nextLate, 'priceWork'), expenseEntries: lateOf(nextLate, 'expense') },
    organizationId: input.organizationId,
    ownerUserIds: [...input.ownerUserIds],
  })
}

/** Rulebook 1.54.0: a late extra as stored — the entry's own fields and kind, never a decision. */
export function lateExtraToFirestore(entry: TimesheetLateExtra): Record<string, unknown> {
  const evidence = entry.evidence && entry.evidence.length > 0 ? { evidence: timesheetEntryEvidenceWriteFields(entry.evidence) } : {}
  if (entry.kind === 'priceWork') {
    return {
      kind: 'priceWork',
      id: entry.id,
      title: entry.title,
      details: entry.details,
      jobNumber: entry.jobNumber,
      agreedManagerName: entry.agreedManagerName,
      startDate: Timestamp.fromDate(entry.startDate),
      endDate: entry.endDate ? Timestamp.fromDate(entry.endDate) : null,
      amount: entry.amount,
      ...evidence,
    }
  }
  return {
    kind: 'expense',
    id: entry.id,
    title: entry.title,
    details: entry.details,
    jobNumber: entry.jobNumber,
    date: Timestamp.fromDate(entry.date),
    amount: entry.amount,
    ...evidence,
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
    // Rulebook 1.54.0: an approved late extra's row (and its fingerprint when approved).
    ...(row.lateExtra === true ? { lateExtra: true } : {}),
    ...(typeof row.entryFingerprint === 'string' && row.entryFingerprint ? { entryFingerprint: row.entryFingerprint } : {}),
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
    ...(typeof row.otBaseDayRate === 'number' && row.otBaseDayRate > 0 ? { otBaseDayRate: row.otBaseDayRate } : {}),
    ...(typeof row.otDayRateHours === 'number' && row.otDayRateHours > 0 ? { otDayRateHours: row.otDayRateHours } : {}),
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
    ...(line.lateExtra === true ? { lateExtra: true } : {}),
    ...(line.entryFingerprint ? { entryFingerprint: line.entryFingerprint } : {}),
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
      ...(line.isOvertime && line.otBaseDayRate != null ? { otBaseDayRate: line.otBaseDayRate } : {}),
      ...(line.isOvertime && line.otDayRateHours != null ? { otDayRateHours: line.otDayRateHours } : {}),
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

/** Rulebook 1.47.0 §8: `operativeSignedBookings` as stored (null when missing or not a list; bad rows dropped). */
function parseOperativeSignedBookings(raw: unknown): TimesheetDraft['operativeSignedBookings'] {
  if (!Array.isArray(raw)) return null
  return raw
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    .map((row) => ({
      bookingId: typeof row.bookingId === 'string' ? row.bookingId : '',
      collection: typeof row.collection === 'string' ? row.collection : 'bookings',
      fingerprint: typeof row.fingerprint === 'string' ? row.fingerprint : '',
      personId: typeof row.personId === 'string' ? row.personId : '',
      // Second review #325 item 4: where the booking was when signed (missing on records written before it).
      ...(typeof row.place === 'string' ? { place: row.place } : {}),
    }))
    .filter((row) => row.bookingId !== '')
}

/** `reviewerBookingEdits` with Firestore instants read as epoch ms (the rulebook compares numbers). */
function reviewerBookingEditsOf(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue
    const row = { ...(value as Record<string, unknown>) }
    if (row.forSignedAtMs != null && typeof row.forSignedAtMs !== 'number') {
      row.forSignedAtMs = parseSharedFirestoreDate(row.forSignedAtMs)?.getTime() ?? null
    }
    delete row.editedAt
    out[key] = row
  }
  return out
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
    // Rulebook 1.47.0 §8: what the person signed (missing before 1.47.0).
    operativeSignedBookings: parseOperativeSignedBookings(data.operativeSignedBookings),
    operativeSignedBookingsAt: parseSharedFirestoreDate(data.operativeSignedBookingsAt) ?? null,
    operativeSignedBookingsSignedAt: parseSharedFirestoreDate(data.operativeSignedBookingsSignedAt) ?? null,
    // Rulebook 1.74.0: the reviewer's own booking edits (read only; never written by a draft save).
    ...(data.reviewerBookingEdits && typeof data.reviewerBookingEdits === 'object' && !Array.isArray(data.reviewerBookingEdits)
      ? { reviewerBookingEdits: reviewerBookingEditsOf(data.reviewerBookingEdits as Record<string, unknown>) }
      : {}),
    managerSignedAt: status.managerSignedAtMs ? new Date(status.managerSignedAtMs) : null,
    managerSignedByName: status.managerSignedByName || null,
    managerSignedByUserId: status.managerSignedByUserId || null,
    managerSignatureImageBase64: includeSignatures ? status.managerSignatureImageBase64 || null : null,
    exportedAt: status.exportedAtMs ? new Date(status.exportedAtMs) : null,
    exportedAtStored: timesheetExportedFieldSet(data.exportedAt),
    expenseEntries: entries.expenseEntries,
    priceWorkEntries: entries.priceWorkEntries,
    ...(() => {
      const lateExtras = mapLateExtras(data, options?.sheetDocId?.trim() || '', organizationZoneOr(options?.timeZone), options?.ownerUserIds ?? [])
      if (!lateExtras) return {}
      const lateExtrasUnread = unreadLateExtraRows(data, lateExtras)
      return lateExtrasUnread.length > 0
        ? { lateExtras, lateExtrasUnread, lateExtrasLayout: lateExtrasStoredLayout(data, lateExtras) }
        : { lateExtras }
    })(),
    payrollLineReviews: mapReviews(data.payrollLineReviews),
    weeklyReportOverride: weeklyReportOverrideFromFirestore(data.weeklyReportOverride),
    extraEntryReviews: parseTimesheetEntryReviews(data),
    // Rulebook 1.55.0: REV N read from the document id (0 for the original); never written.
    ...(options?.sheetDocId ? { revision: parseTimesheetRevisionDocId(options.sheetDocId)?.revision ?? 0 } : {}),
  }
}

export function draftToFirestoreMap(draft: TimesheetDraft): Record<string, unknown> {
  return {
    managerNote: draft.managerNote,
    operativeSignedAt: draft.operativeSignedAt ? Timestamp.fromDate(draft.operativeSignedAt) : null,
    operativeSignedByName: draft.operativeSignedByName || '',
    operativeSignatureImageBase64: draft.operativeSignatureImageBase64 || '',
    // Rulebook 1.47.0: written only when the draft has it, so a sheet signed before 1.47.0 keeps its stored shape.
    ...(Array.isArray(draft.operativeSignedBookings)
      ? { operativeSignedBookings: draft.operativeSignedBookings.map((row) => ({ ...row })) }
      : draft.operativeSignedBookings === null
        ? { operativeSignedBookings: null }
        : {}),
    // `operativeSignedBookingsAt` is server time: written by `saveTimesheetDraft` with `serverTimestamp()` when the
    // draft marks it pending, never from this device's clock.
    ...(draft.operativeSignedBookingsAtPending
      ? {}
      : draft.operativeSignedBookingsAt instanceof Date
        ? { operativeSignedBookingsAt: Timestamp.fromDate(draft.operativeSignedBookingsAt) }
        : draft.operativeSignedBookingsAt === null
          ? { operativeSignedBookingsAt: null }
          : {}),
    ...(draft.operativeSignedBookingsSignedAt instanceof Date
      ? { operativeSignedBookingsSignedAt: Timestamp.fromDate(draft.operativeSignedBookingsSignedAt) }
      : draft.operativeSignedBookingsSignedAt === null
        ? { operativeSignedBookingsSignedAt: null }
        : {}),
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
    // Rulebook 1.54.0: written only when the draft has the list, so a sheet without late extras keeps its stored shape.
    // 16 Nov scan: rows the reader skipped (`lateExtrasUnread`) are written back exactly as stored, never dropped.
    ...(Array.isArray(draft.lateExtras) || (draft.lateExtrasUnread?.length ?? 0) > 0
      ? {
          // Review of #347: every row back in its own stored slot (new rows appended), so an unrelated save never
          // reorders the list (the reader takes a late extra's decision from the first stored row of an id).
          [TIMESHEET_LATE_EXTRAS_FIELD]: lateExtrasForWrite(
            (draft.lateExtras ?? []).map(lateExtraToFirestore),
            draft.lateExtrasUnread ?? [],
            draft.lateExtrasLayout
          ),
        }
      : {}),
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

/** Rulebook 1.66.0 §8 `timesheetSheetHasActivity` (one rule with iOS) over the web draft's fields. */
export function timesheetDraftHasActivity(draft: TimesheetDraft): boolean {
  return timesheetSheetHasActivity({
    operativeSignedAt: draft.operativeSignedAt,
    managerSignedAt: draft.managerSignedAt,
    exportedAt: draft.exportedAt,
    expenseEntries: draft.expenseEntries,
    priceWorkEntries: draft.priceWorkEntries,
    lateExtras: draft.lateExtras ?? [],
    managerNote: draft.managerNote,
    weeklyReportOverride: draft.weeklyReportOverride ?? null,
  })
}

export type TimesheetPeriodCandidate = {
  weekStart: Date
  endDayKey?: string | null
  draft: TimesheetDraft
  documentId?: string
  /** Rulebook 1.55.0: the stored document (for the version chain); optional. */
  data?: Record<string, unknown>
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
      // Rulebook 1.55.0: an original and its revisions count as one row; the latest version wins.
      documentId: row.documentId ?? null,
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
/** Rulebook 1.55.0 §8: every stored version of the draft's pay run (original, REV 1, …), oldest first. */
const versionChains = new WeakMap<TimesheetDraft, TimesheetVersion[]>()

/** Rulebook 1.55.0: the same chains by every version's document id (a copied draft loses the WeakMap entry). */
const versionChainsById = new Map<string, TimesheetVersion[]>()

/** The stored versions of the period the draft was loaded for (oldest first); [] when not loaded. */
export function timesheetVersionChain(draft: TimesheetDraft): TimesheetVersion[] {
  return versionChains.get(draft) || []
}

/** The stored versions of the period one of whose documents is `documentId` (as last loaded); [] when not loaded. */
export function timesheetVersionChainFor(documentId: string | null | undefined): TimesheetVersion[] {
  return (documentId && versionChainsById.get(documentId)) || []
}

/**
 * Rulebook 1.55.0 §8: the versions of the sheet stored at `documentId` — its original and every revision
 * (`{original}_rev1`, `_rev2`, … read until one is missing). Reads nothing more for a sheet that was never exported
 * (only an exported version can have a revision).
 */
async function readVersionChain(organizationId: string, documentId: string, data: Record<string, unknown>): Promise<TimesheetVersion[]> {
  const ref = parseTimesheetRevisionDocId(documentId)
  if (!ref) return []
  const docs: Array<{ documentId: string; data: Record<string, unknown> }> = [{ documentId, data }]
  if (ref.revision === 0 && !timesheetExportedFieldSet(data.exportedAt)) return timesheetVersionsForPeriod(docs)[0] ?? []
  if (ref.revision > 0) {
    for (let n = 0; n < ref.revision; n += 1) {
      const id = timesheetRevisionDocId(ref.baseDocumentId, n)
      const stored = id ? await readDoc(organizationId, id) : null
      if (stored) docs.push({ documentId: id, data: stored })
    }
  }
  for (let n = ref.revision + 1; ; n += 1) {
    const id = timesheetRevisionDocId(ref.baseDocumentId, n)
    if (!id) break
    const stored = await readDoc(organizationId, id)
    if (!stored) break
    docs.push({ documentId: id, data: stored })
  }
  return timesheetVersionsForPeriod(docs)[0] ?? []
}

/**
 * The draft of the LATEST version of the sheet stored at `documentId` (the period page and lists show it), with its
 * version chain remembered (`timesheetVersionChain`).
 */
async function latestVersionDraft(
  organizationId: string,
  documentId: string,
  data: Record<string, unknown>,
  options: { includeSignatures?: boolean; timeZone?: string | null; ownerUserIds?: ReadonlyArray<string> | null }
): Promise<TimesheetDraft> {
  const chain = await readVersionChain(organizationId, documentId, data)
  const latest = timesheetLatestVersion(chain)
  const id = latest?.documentId || documentId
  const draft = rememberSource(draftFromFirestoreMap(latest?.data || data, { ...options, sheetDocId: id }), id)
  if (chain.length > 0) {
    versionChains.set(draft, chain)
    for (const version of chain) versionChainsById.set(version.documentId, chain)
  }
  return draft
}

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
    // Rulebook 1.55.0: the latest version (a revision of an exported sheet), with the period's version chain.
    return { draft: await latestVersionDraft(organizationId, hit.id, hit.data, { includeSignatures, timeZone, ownerUserIds }), allMissing: false }
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
    data,
  }
}

const USER_ID_QUERY_CHUNK = 10

/** One settings query per chunk, instead of a full history read per person. */
async function loadTimesheetCandidatesByUserIds(
  organizationId: string,
  userIds: string[],
  includeSignatures: boolean,
  // 1.43.0 (guardrail 2): stored end days are read in the organisation's zone, never London by default.
  timeZone: string,
  /**
   * Review of #368 (S1): when the rules refuse a chunk, ask for each id on its own and skip the refused ones (a former
   * invite id whose users document is gone is unreadable to a line manager under `privatePay`). Off: a refused chunk
   * throws, as before.
   */
  skipRefused = false
): Promise<Map<string, TimesheetPeriodCandidate[]>> {
  const grouped = new Map<string, TimesheetPeriodCandidate[]>()
  for (const userId of userIds) grouped.set(userId, [])
  const runChunk = async (chunk: string[]) =>
    (await getDocs(query(collection(db, 'organizations', organizationId, 'settings'), where('userId', 'in', chunk)))).docs
  const docs = skipRefused
    ? (await queryIdsSkippingRefused(userIds, USER_ID_QUERY_CHUNK, runChunk)).rows
    : (
        await Promise.all(
          Array.from({ length: Math.ceil(userIds.length / USER_ID_QUERY_CHUNK) }, (_, index) =>
            runChunk(userIds.slice(index * USER_ID_QUERY_CHUNK, (index + 1) * USER_ID_QUERY_CHUNK))
          )
        )
      ).flat()
  for (const entry of docs) {
    const data = entry.data() as Record<string, unknown>
    const userId = typeof data.userId === 'string' ? data.userId : ''
    if (!grouped.has(userId)) continue
    const row = timesheetStateFromDoc(entry.id, data, includeSignatures, timeZone)
    if (row) grouped.get(userId)?.push(row)
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
  ownerUserIds: ReadonlyArray<string> = [userId],
  /**
   * Rulebook 1.79.0: a stored sheet to open first (a Payrun Snapshot cell names the version it reports). Used only when
   * it exists, is a timesheet of this period and belongs to one of `ownerUserIds`; otherwise the usual lookup runs.
   */
  preferredDocumentId?: string | null
): Promise<TimesheetDraft> {
  // Taken from a URL: refused when empty, a path ("/") or over 200 characters.
  const preferred = urlDocumentId(preferredDocumentId) ?? ''
  if (preferred && preferred.startsWith('timesheet_')) {
    try {
      const snap = await getDoc(doc(db, 'organizations', organizationId, 'settings', preferred))
      if (snap.exists()) {
        const data = snap.data() as Record<string, unknown>
        const owners = new Set([userId, ...ownerUserIds].map(normalizeDocumentId).filter(Boolean))
        // The person the document id names (`timesheet_{uid}_…`, a revision included) must be one of the owner's ids,
        // without case; a stored `userId`, when there is one, too.
        const subject = normalizeDocumentId(timesheetDocumentSubjectId(preferred))
        const stored = typeof data.userId === 'string' ? normalizeDocumentId(data.userId) : ''
        if (subject && owners.has(subject) && (!stored || owners.has(stored))) {
          if (weekStartMatches(data, weekStart, timeZone)) {
            return await latestVersionDraft(organizationId, snap.id, data, { timeZone, ownerUserIds })
          }
        }
      }
    } catch {
      // Not readable by this viewer, or no longer there: the usual lookup below.
    }
  }
  const direct = await loadTimesheetDraftByCandidates(organizationId, userId, weekStart, timeZone, true, ownerUserIds)
  if (direct.draft) return direct.draft
  // 17 Nov follow-up (guardrail 1): a sheet filed under another id the person goes by (a former invite id, a second
  // users document on their email). A read the rules refuse (the person themself reading an alias's document) is
  // skipped, never an error.
  const aliases = [...new Set(ownerUserIds.filter((id) => id && id.toLowerCase() !== userId.toLowerCase()))]
  for (const alias of aliases) {
    try {
      const hit = await loadTimesheetDraftByCandidates(organizationId, alias, weekStart, timeZone, true, ownerUserIds)
      if (hit.draft) return hit.draft
    } catch {
      /* not readable by this viewer */
    }
  }
  const ownerKeys = new Set([userId, ...aliases].map((id) => id.toLowerCase()))
  try {
    const key = dayKey(weekStart, timeZone)
    const snap = await getDocs(
      query(collection(db, 'organizations', organizationId, 'settings'), where('weekStartKey', '==', key))
    )
    for (const entry of snap.docs) {
      const data = entry.data() as Record<string, unknown>
      if (
        (typeof data.userId === 'string' && ownerKeys.has(data.userId.toLowerCase())) ||
        (weekStartMatches(data, weekStart, timeZone) && entry.id.includes(userId))
      ) {
        return await latestVersionDraft(organizationId, entry.id, data, { timeZone, ownerUserIds })
      }
    }
  } catch {
    // Permission or missing index — try the broader user query next.
  }
  const end = periodEnd || weekStart
  try {
    const grouped = await loadTimesheetCandidatesByUserIds(organizationId, [userId], true, timeZone)
    const picked = pickTimesheetDraftForPeriod(grouped.get(userId) || [], weekStart, end, timeZone)
    if (picked?.documentId && picked.data) return await latestVersionDraft(organizationId, picked.documentId, picked.data, { timeZone, ownerUserIds })
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
    if (!wanted.has(userId) || !laterVersion(results.get(userId), entry.id)) continue
    results.set(userId, rememberSource(draftFromFirestoreMap(data, { ...LIST_DRAFT_OPTIONS, sheetDocId: entry.id }), entry.id))
  }
}

/**
 * Rulebook 1.55.0: whether the document at `documentId` should replace the draft already listed for a person — only a
 * later version of the same sheet (a revision) does; otherwise the first one listed stays, as before.
 */
function laterVersion(current: TimesheetDraft | undefined, documentId: string): boolean {
  if (!current) return true
  const held = parseTimesheetRevisionDocId(timesheetSourceDocumentId(current))
  const next = parseTimesheetRevisionDocId(documentId)
  return Boolean(held && next && held.baseDocumentId === next.baseDocumentId && next.revision > held.revision)
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
 * The latest version of the sheet stored at `documentId` (17 Nov follow-up): Export re-reads exactly the document the
 * list showed — a sheet filed under a former invite id or a second users document is never missed by re-deriving its id
 * from the person's current users id. Null when the document is gone.
 */
export async function loadTimesheetDraftAt(
  organizationId: string,
  documentId: string,
  timeZone: string,
  ownerUserIds: ReadonlyArray<string>
): Promise<TimesheetDraft | null> {
  const data = await readDoc(organizationId, documentId)
  if (!data) return null
  return latestVersionDraft(organizationId, documentId, data, { includeSignatures: true, timeZone, ownerUserIds })
}

export type TimesheetQueueStoredSheet = {
  /** The stored document id (an original or a `…_rev{N}` revision). */
  documentId: string
  /** The stored `userId` (any id the person goes by). */
  userId: string
  weekStart: Date
  /** `weekEndKey` / `weekEnd` in the organisation zone; null when the document has none. */
  endDayKey: string | null
  draft: TimesheetDraft
}

const UUID_SHAPED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The other letter-case spellings of a UUID-shaped id that are not already asked for (an iPhone stores
 * `UUID.uuidString` upper case, web lower case). Firestore `in` matches exactly, so the queue asks for these too.
 * Other ids (Firebase Auth uids are mixed case) are asked for as stored only.
 */
export function timesheetQueueCaseVariants(userIds: ReadonlyArray<string>): string[] {
  const asked = new Set(userIds)
  const out: string[] = []
  for (const id of userIds) {
    if (!UUID_SHAPED.test(id)) continue
    for (const variant of [id.toUpperCase(), id.toLowerCase()]) {
      if (asked.has(variant)) continue
      asked.add(variant)
      out.push(variant)
    }
  }
  return out
}

/**
 * Rulebook 1.66.0 §8 (owner decision 17 Nov): every stored timesheet of `userIds` (each id every listed person goes by),
 * however old — every version, so the rulebook (`userTimesheetQueue`) decides which one is a pay run's sheet. One batched
 * `userId in` query per 10 ids; a chunk the rules refuse is asked id by id and only the refused ids are skipped (review of
 * #368 S1). Any other failure throws (the list shows its error, never an empty queue).
 *
 * Case (guardrail 3): Firestore `in` is exact. A UUID-shaped id is also asked for in upper and lower case (a second pass,
 * its own chunks, so a variant the rules refuse never refuses a real id), and the rulebook matches the stored `userId`
 * without case. For an admin (`recentRunStartDayKeys` given), the recent pay runs are also read by `weekStartKey` and
 * every timesheet of a listed person — its `userId` (or, with none, the id in its document id) matched without case — is
 * kept, so a sheet stored under a mixed-case id in another spelling, or with no `userId`, stays visible for those runs.
 * Older runs, and everyone who is not an admin, keep the known limit (§8): such a sheet is not loaded.
 */
export async function loadTimesheetQueueSheets(input: {
  organizationId: string
  userIds: ReadonlyArray<string>
  timeZone: string
  /** Admins only: the start day keys of the recent pay runs to also read by `weekStartKey`. */
  recentRunStartDayKeys?: ReadonlyArray<string>
}): Promise<TimesheetQueueStoredSheet[]> {
  const userIds = [...new Set(input.userIds.filter(Boolean))]
  if (userIds.length === 0) return []
  const variants = timesheetQueueCaseVariants(userIds)
  const [grouped, variantGrouped, recent] = await Promise.all([
    loadTimesheetCandidatesByUserIds(input.organizationId, userIds, false, input.timeZone, true),
    variants.length > 0
      ? loadTimesheetCandidatesByUserIds(input.organizationId, variants, false, input.timeZone, true)
      : Promise.resolve(new Map<string, TimesheetPeriodCandidate[]>()),
    loadRecentRunTimesheetsForIds(input.organizationId, userIds, input.recentRunStartDayKeys ?? [], input.timeZone),
  ])
  const out: TimesheetQueueStoredSheet[] = []
  const seen = new Set<string>()
  for (const [userId, rows] of [...grouped, ...variantGrouped, ...recent]) {
    for (const row of rows) {
      if (!row.documentId || seen.has(row.documentId)) continue
      seen.add(row.documentId)
      out.push({ documentId: row.documentId, userId, weekStart: row.weekStart, endDayKey: row.endDayKey ?? null, draft: row.draft })
    }
  }
  return out
}

/**
 * Rulebook 1.66.0 §8 (admins): the timesheets of `startDayKeys` read by `weekStartKey`, kept when their `userId` — or,
 * with none, the id in the document id — is one of `userIds` without case. Grouped by the id the sheet is stored under.
 */
async function loadRecentRunTimesheetsForIds(
  organizationId: string,
  userIds: ReadonlyArray<string>,
  startDayKeys: ReadonlyArray<string>,
  timeZone: string
): Promise<Map<string, TimesheetPeriodCandidate[]>> {
  const grouped = new Map<string, TimesheetPeriodCandidate[]>()
  const keys = [...new Set(startDayKeys.filter(Boolean))]
  if (keys.length === 0) return grouped
  const wanted = new Set(userIds.map((id) => id.toLowerCase()))
  // One query per key; a key the rules refuse is skipped (as iOS and §8), any other failure still fails the list.
  const { rows: docs } = await queryIdsSkippingRefused(keys, 1, async ([key]) =>
    (await getDocs(query(collection(db, 'organizations', organizationId, 'settings'), where('weekStartKey', '==', key)))).docs
  )
  for (const entry of docs) {
    const data = entry.data() as Record<string, unknown>
    const stored = typeof data.userId === 'string' && data.userId.trim() ? data.userId : timesheetDocumentSubjectId(entry.id)
    if (!stored || !wanted.has(stored.toLowerCase())) continue
    const row = timesheetStateFromDoc(entry.id, data, false, timeZone)
    if (!row) continue
    const list = grouped.get(stored) ?? []
    list.push(row)
    grouped.set(stored, list)
  }
  return grouped
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
  const sourceId = documentId || timesheetSourceDocumentId(draft)
  // Rulebook 1.55.0: a revision is saved on its own document only. Review of #368 (B1): a sheet filed under another id
  // the person goes by is saved on that document only, under its own `userId` — never forked to the current id.
  const target = timesheetSaveTarget({ userId, weekStart, timeZone, sourceId })
  const ids = target.ids
  const subjectUserId = target.subjectUserId
  const canonicalId = timesheetDocId(subjectUserId, weekStart, timeZone)
  const end = weekEnd || weekStart
  const periodFields = timesheetPeriodWriteFields({
    userId: subjectUserId,
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
      userId: subjectUserId,
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
    const ownerUserIds = timesheetEvidenceOwnerIds(canonicalId, { userId: subjectUserId }, [writerId, userId])
    const entriesError = timesheetOwnerEntriesError({
      previous,
      next: { priceWorkEntries: next.priceWorkEntries as unknown[], expenseEntries: next.expenseEntries as unknown[] },
      organizationId,
      // The uploader is the signed-in owner; the sheet's own ids count as theirs too.
      ownerUserIds,
    })
    if (entriesError) throw new Error(entriesError)
    // Rulebook 1.54.0: late extras follow the same entry rules (job number, evidence), checked by kind.
    const lateError = ownerLateExtrasError({ base: base ?? null, draft, organizationId, ownerUserIds })
    if (lateError) throw new Error(lateError)
  }
  // Who and where (`writeMetadataFields`) plus the server time, on every timesheet save.
  const metadata = {
    ...(writeMetadataFields(writerId, 'web') ?? {}),
    updatedAt: serverTimestamp(),
    // Rulebook 1.47.0 (second review #325 item 3): the record of what was signed carries the server time.
    ...(draft.operativeSignedBookingsAtPending ? { operativeSignedBookingsAt: serverTimestamp() } : {}),
  }
  // Rulebook 1.54.0 (third review of #337): a reviewer's entry decisions (`extraEntryReviews`, a late extra's with
  // `lateExtra: true`) go in the SAME write as the sheet — the snapshot that adds an approved late extra and the review
  // that approves it are never written apart. An ignored late extra (id taken) is never decided
  // (`draftReviewEntries`), and an exported sheet's late extras are frozen (`exported`).
  const reviewFields = reviewer
    ? timesheetEntryReviewWriteFields({
        stored: draft.extraEntryReviews ?? null,
        entries: draftReviewEntries(draft),
        reviewedByUserId: writerId,
        reviewedAtMs: Date.now(),
        exported: draftStoredExported(draft),
        // Fourth review of #337: the writer derives the signed ids itself (the loaded entries carry their derived ids).
        sheet: { priceWorkEntries: draft.priceWorkEntries, expenseEntries: draft.expenseEntries, lateExtras: draft.lateExtras ?? [] },
      })
    : {}
  const hasReviewFields = Object.keys(reviewFields).length > 0
  // The same reviews as one nested map, for a sheet created by this save (a merge never reads a dotted key as a path).
  const nestedReviewFields = () => {
    const prefix = `${TIMESHEET_ENTRY_REVIEWS_FIELD}.`
    const map: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(reviewFields)) if (key.startsWith(prefix)) map[key.slice(prefix.length)] = value
    return Object.keys(map).length > 0 ? { [TIMESHEET_ENTRY_REVIEWS_FIELD]: map } : {}
  }
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
        await setDoc(ref, { ...sheetPayload(Boolean(draft.managerSignedAt), draft), ...nestedReviewFields(), ...metadata }, { merge: true })
        return
      }
      // 1.9.0: whether the line manager has signed comes from the stored copy, never from a stale local draft.
      const managerSigned = Boolean(draftFromFirestoreMap(stored, { includeSignatures: false }).managerSignedAt)
      // Review of #368 (B1): a stored `userId` is never rewritten (another letter case, or an alias sheet).
      const keepStoredUserId = (fields: Record<string, unknown>) => {
        if (typeof stored.userId === 'string' && stored.userId.trim()) fields.userId = stored.userId
        return fields
      }
      const payload = keepStoredUserId(sheetPayload(managerSigned, draft))
      if (base) {
        const write = timesheetChangedFields(
          keepStoredUserId(sanitizeForFirestore(sheetPayload(managerSigned, base)) as Record<string, unknown>),
          payload
        )
        // The period identity is always kept current; everything else only when this editor changed it.
        for (const key of Object.keys(periodFields)) {
          if (payload[key] !== undefined && stored[key] === undefined) write.set[key] = payload[key]
        }
        if (Object.keys(write.set).length === 0 && write.remove.length === 0 && !hasReviewFields) return
        await updateDoc(ref, { ...firestoreUpdateFields(write), ...reviewFields, ...metadata })
        return
      }
      const changed = changedFirestoreFields(payload, stored)
      if (Object.keys(changed).length === 0 && !hasReviewFields) return
      await updateDoc(ref, { ...changed, ...reviewFields, ...metadata })
    })
  )
  if (!reviewer) return draft.extraEntryReviews ?? null
  if (!hasReviewFields) return draft.extraEntryReviews ?? null
  return timesheetEntryReviewsAfterWrite(draft.extraEntryReviews ?? null, reviewFields)
}

/**
 * Where a save or an export stamp of a sheet goes (review of #368, B1 and its re-check). When the sheet was loaded from a
 * stored document — under the person's id, another id they go by (a former invite id, a second users document on their
 * email), another letter case, an older stamp or any older id format, or a revision — it is written to THAT document
 * only (its exact id), never also to a canonical id, so a save can never create a second copy. Only a brand-new sheet
 * (no stored document) goes to the canonical id. `subjectUserId` is the id the document names (the person's id when it
 * names none); an update keeps the document's stored `userId` (`saveTimesheetDraft`).
 */
export function timesheetSaveTarget(input: {
  userId: string
  weekStart: Date
  timeZone: string
  sourceId: string | null | undefined
}): { ids: string[]; subjectUserId: string } {
  const sourceId = typeof input.sourceId === 'string' ? input.sourceId.trim() : ''
  if (sourceId) return { ids: [sourceId], subjectUserId: timesheetDocumentSubjectId(sourceId) || input.userId }
  return { ids: [timesheetDocId(input.userId, input.weekStart, input.timeZone)], subjectUserId: input.userId }
}

/** Why `stampTimesheetExport` did not stamp a sheet. */
export type TimesheetExportStampResult = 'stamped' | 'already-exported' | 'late-extras-waiting' | 'missing'

/**
 * Rulebook 1.54.0 (third review of #337): Export's stamp. In one transaction it re-reads the stored sheet (every copy
 * `saveTimesheetDraft` would write) and writes ONLY the export fields — the signed snapshot and `exportedAt` — never a
 * whole sheet from the copy Export loaded, so a late extra the person added, edited or deleted meanwhile is never written
 * back over. It refuses (writes nothing) when the stored sheet is already exported, or when its late extras now wait for
 * the line manager with the snapshot about to be written (`timesheetLateExtrasSummary`).
 */
export async function stampTimesheetExport({
  organizationId,
  userId,
  weekStart,
  draft,
  timeZone,
  documentId = null,
}: {
  organizationId: string
  userId: string
  weekStart: Date
  /** The prepared sheet: its `weeklyReportOverride` and `exportedAt` are written. */
  draft: TimesheetDraft
  /** The organisation's business time zone (required: never a London default). */
  timeZone: string
  documentId?: string | null
}): Promise<TimesheetExportStampResult> {
  const writerId = auth?.currentUser?.uid || ''
  if (!draft.exportedAt || !draft.weeklyReportOverride) return 'missing'
  const sourceId = documentId || timesheetSourceDocumentId(draft)
  // Rulebook 1.55.0: a revision is stamped on its own document only (its original is already exported). Review of #368
  // (B1): a sheet filed under another id the person goes by is stamped on that document only.
  const { ids } = timesheetSaveTarget({ userId, weekStart, timeZone, sourceId })
  const fields = sanitizeForFirestore({
    weeklyReportOverride: weeklyReportOverrideToFirestore(draft.weeklyReportOverride),
    exportedAt: Timestamp.fromDate(draft.exportedAt),
  }) as Record<string, unknown>
  return runTransaction(db, async (transaction) => {
    const refs = ids.map((id) => doc(db, 'organizations', organizationId, 'settings', id))
    const snaps = await Promise.all(refs.map((ref) => transaction.get(ref)))
    const present = snaps.map((snap, index) => ({ snap, ref: refs[index] })).filter((row) => row.snap.exists())
    if (present.length === 0) return 'missing'
    for (const { snap } of present) {
      const stored = snap.data() as Record<string, unknown>
      if (timesheetExportedFieldSet(stored.exportedAt)) return 'already-exported'
      const loaded = draftFromFirestoreMap(stored, { includeSignatures: false, sheetDocId: snap.id, timeZone })
      const late = timesheetLateExtrasSummary(
        { ...stored, weeklyReportOverride: fields.weeklyReportOverride },
        { entryFingerprints: draftEntryFingerprints(loaded), exportedAtStored: false, sheetDocId: snap.id }
      )
      if (late.waitingForLineManager) return 'late-extras-waiting'
    }
    const metadata = { ...(writeMetadataFields(writerId, 'web') ?? {}), updatedAt: serverTimestamp() }
    for (const { ref } of present) transaction.update(ref, { ...fields, ...metadata })
    return 'stamped'
  })
}

/** Why `createTimesheetRevision` did not create one. */
export type TimesheetRevisionCreateResult =
  | { status: 'created'; documentId: string; revision: number }
  | { status: 'exists' | 'not-exported' | 'missing'; documentId: string | null; revision: number | null }

/**
 * Rulebook 1.55.0 §8: create the next revision of the sheet whose latest version is `previousDocumentId` — the person's
 * own write when a booking change made one due ("Review and sign again"), or a reviewer's ("Create revision"). One
 * transaction re-reads the version it corrects (it must be exported) and the target (it must not exist), and creates
 * ONLY the new document (`timesheetRevisionCreateFields` + the server time + write metadata). Nothing else is written.
 */
export async function createTimesheetRevision({
  organizationId,
  previousDocumentId,
  liveLines,
  writerIsSubject = false,
}: {
  organizationId: string
  previousDocumentId: string
  /** Review of #344 (M1): the person's own revision copies `payrollLineReviews` exactly (the rules require it). */
  writerIsSubject?: boolean
  /**
   * Owner decision 16 Nov (finding 6 = a): the period's live payroll lines — labour decisions are kept only for bookings
   * unchanged since the previous version (`timesheetRevisionLabourReviews`).
   */
  liveLines: ReadonlyArray<{ id: string; bookingFingerprint?: string | null; amount?: number | null; paidHours?: number | null }>
}): Promise<TimesheetRevisionCreateResult> {
  const writerId = auth?.currentUser?.uid || ''
  return runTransaction(db, async (transaction) => {
    const previousRef = doc(db, 'organizations', organizationId, 'settings', previousDocumentId)
    const previous = await transaction.get(previousRef)
    if (!previous.exists()) return { status: 'missing', documentId: null, revision: null }
    const made = timesheetRevisionCreateFields({
      previous: { documentId: previous.id, data: previous.data() as Record<string, unknown> },
      writerUserId: writerId,
      writerIsSubject,
      liveLines,
    })
    if (!made) return { status: 'not-exported', documentId: null, revision: null }
    const targetRef = doc(db, 'organizations', organizationId, 'settings', made.documentId)
    const target = await transaction.get(targetRef)
    if (target.exists()) return { status: 'exists', documentId: made.documentId, revision: made.revision }
    transaction.set(targetRef, {
      ...made.fields,
      revisionCreatedAt: serverTimestamp(),
      ...(writeMetadataFields(writerId, 'web') ?? {}),
      updatedAt: serverTimestamp(),
    })
    return { status: 'created', documentId: made.documentId, revision: made.revision }
  })
}

/**
 * Rulebook 1.55.0: one row per pay run of each original — its latest version (lists, the weekly report and the Payrun
 * Snapshot; owner decision 16 Nov J4: whether it counts as approved is `timesheetRevisionReportState`).
 */
function collapseVersionRows<T extends { documentId: string }>(rows: T[], dataOf: (row: T) => Record<string, unknown>): T[] {
  const chains = timesheetVersionsForPeriod(rows.map((row) => ({ documentId: row.documentId, data: dataOf(row) })))
  const keep = new Set<string>()
  for (const chain of chains) {
    const picked = timesheetLatestVersion(chain)
    if (picked) keep.add(picked.documentId)
  }
  return rows.filter((row) => keep.has(row.documentId) || !parseTimesheetRevisionDocId(row.documentId))
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
      return [userId, await latestVersionDraft(organizationId, id, data, LIST_DRAFT_OPTIONS)] as const
    }
    return null
  })
  for (const hit of hits) {
    if (hit) results.set(hit[0], hit[1])
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

/**
 * The person's timesheet rows from a `settings` query on their `userId` (one read or a live listener, 17 Nov follow-up):
 * timesheet documents only, each with its stored id remembered on the draft; `latest` keeps one row per pay run (its
 * latest version). Unsorted.
 */
export function timesheetStateRowsFromDocs(
  userId: string,
  docs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>,
  versions: 'latest' | 'all' = 'latest'
): TimesheetStateRow[] {
  const stored = new Map<string, Record<string, unknown>>()
  const rows: TimesheetStateRow[] = []
  for (const entry of docs) {
    if (!entry.id.startsWith('timesheet_')) continue
    const data = entry.data
    const weekStart = parseFirestoreDate(data.weekStart)
    if (!weekStart) continue
    stored.set(entry.id, data)
    rows.push({
      documentId: entry.id,
      userId,
      weekStart,
      endDayKey: storedEndDayKey(data, LONDON_TIME_ZONE),
      // 1.55.0 (review of #344): the stored id travels with the draft (`timesheetSourceDocumentId`).
      draft: rememberSource(draftFromFirestoreMap(data, { ...LIST_DRAFT_OPTIONS, sheetDocId: entry.id }), entry.id),
    })
  }
  return versions === 'all' ? rows : collapseVersionRows(rows, (row) => stored.get(row.documentId) || {})
}

/** iOS FirebaseBackend.listTimesheetStates — query by userId, sort weekStart desc. */
export async function listTimesheetStates(
  organizationId: string,
  userId: string,
  limit = 400,
  /** Rulebook 1.55.0: `latest` (one row per pay run, default) or `all` (every stored version, e.g. exported history). */
  versions: 'latest' | 'all' = 'latest'
): Promise<TimesheetStateRow[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'organizations', organizationId, 'settings'), where('userId', '==', userId))
    )
    const collapsed = timesheetStateRowsFromDocs(
      userId,
      snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> })),
      versions
    )
    collapsed.sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
    return collapsed.slice(0, Math.max(1, limit))
  } catch (error) {
    // 1.43.0: never an error on screen; logged so a refused query (rules) is visible in the console.
    console.warn('[timesheets] listTimesheetStates query failed', error)
    return []
  }
}

/**
 * Final review of #386: the `privatePay` switch as the timesheet lookups read it (`timesheetLookupPlan`) — on until
 * `platformConfig/app` has been read, so no query the rules might refuse is sent before the switch is known. Screens
 * re-plan when the config arrives (`onPlatformConfigChange`), so a non-admin's list widens when it turns out off.
 */
export function timesheetLookupPrivatePay(organizationId: string): boolean {
  return !securitySwitchesLoaded() || privatePayFor(organizationId)
}

/** The end of a Firestore document-id prefix range: U+F8FF, the highest code point used in ids. */
const DOCUMENT_ID_PREFIX_END = '\uf8ff'

/**
 * Guardrail 1 (`w-timesheet-lookups`): a person's timesheet rows under every id they go by (`personIdSet` →
 * `timesheetMemberIds`), plus sheets stored without `userId` whose document id names one of those ids
 * (`timesheetDocumentSubjectId`). `ids[0]` is the person's own id; each row's `userId` is the id it is filed under.
 * Sorted newest pay run first; within one pay run the row filed under the own id comes last, so a screen keying one
 * row per pay run keeps that one (`newestFirstOwnIdLast`). A refused query is skipped, never an error. An operative's
 * screen passes only their own id (the rules refuse an operative's alias and document-id queries).
 */
export async function listPersonTimesheetStates(
  organizationId: string,
  ids: ReadonlyArray<string>,
  limit = 400,
  versions: 'latest' | 'all' = 'latest',
  /**
   * Review of #386 (N1): ask the document-id prefix (sheets stored without `userId`) only when the viewer may run it —
   * the rules refuse it to an operative (`tests/timesheetLookups.rules.test.ts`), so for them it only logged warnings.
   */
  includeDocumentPrefix = true
): Promise<TimesheetStateRow[]> {
  const settings = collection(db, 'organizations', organizationId, 'settings')
  const toDocs = (snap: Awaited<ReturnType<typeof getDocs>>) =>
    snap.docs.map((entry) => ({ id: entry.id, data: entry.data() as Record<string, unknown> }))
  const docs = await personTimesheetDocs(ids, {
    byUserIds: async (chunk) =>
      toDocs(
        await getDocs(
          chunk.length === 1 ? query(settings, where('userId', '==', chunk[0])) : query(settings, where('userId', 'in', chunk))
        )
      ),
    byDocumentPrefix: includeDocumentPrefix
      ? async (id) => {
          const prefix = `timesheet_${id}_`
          return toDocs(
            await getDocs(query(settings, where(documentId(), '>=', prefix), where(documentId(), '<', prefix + DOCUMENT_ID_PREFIX_END)))
          )
        }
      : null,
    warn: (message, detail) => console.warn(`[timesheets] ${message}`, detail),
  })
  const ownerOf = new Map(docs.map((entry) => [entry.id, timesheetDocumentOwnerId(entry)]))
  const rows = timesheetStateRowsFromDocs(ids[0] ?? '', docs, versions).map((row) => ({
    ...row,
    userId: ownerOf.get(row.documentId) || row.userId,
  }))
  return newestFirstOwnIdLast(rows, ids[0] ?? '').slice(0, Math.max(1, limit))
}

export type ExportedTimesheetHistoryRow = {
  id: string
  user: import('@/types').User
  weekStart: Date
  endDayKey?: string | null
  draft: TimesheetDraft
  /** Rulebook 1.55.0: the stored document of this version. */
  documentId?: string
  /** Rulebook 1.55.0: the earlier exported versions of the same pay run, newest first (shown read-only under it). */
  earlierVersions?: Array<{ documentId: string; revision: number; draft: TimesheetDraft }>
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
  endDayKey?: string | null,
  documentId?: string | null
) {
  if (!draft.exportedAt) return
  const id = `${member.id}|${Math.floor(weekStart.getTime() / 1000)}`
  // Rulebook 1.55.0: one row per pay run showing the latest exported version; the earlier ones go under it.
  const revision = documentId ? parseTimesheetRevisionDocId(documentId)?.revision ?? 0 : 0
  const held = byId.get(id)
  const version = { documentId: documentId || '', revision, draft }
  if (held) {
    const heldVersion = { documentId: held.documentId || '', revision: held.draft.revision ?? 0, draft: held.draft }
    const [latest, earlier] = revision > heldVersion.revision ? [version, heldVersion] : [heldVersion, version]
    const earlierVersions = [...(held.earlierVersions || []), earlier].sort((a, b) => b.revision - a.revision)
    byId.set(id, { id, user: member, weekStart, endDayKey, draft: latest.draft, documentId: latest.documentId || undefined, earlierVersions })
    return
  }
  byId.set(id, { id, user: member, weekStart, endDayKey, draft, documentId: documentId || undefined })
}

/**
 * 17 Nov follow-up (guardrail 3): an exported sheet whose stored `userId` names nobody in the organisation is listed as
 * "Unknown person · <id hint>" (the rulebook's `UNKNOWN_BOOKING_PERSON_LABEL` and `bookingPersonIdHint`), never dropped.
 */
const unresolvedPeople = new WeakSet<object>()

/** Whether `user` is a stand-in made by `unresolvedTimesheetPerson` (no profile to open). */
export function isUnresolvedTimesheetPerson(user: object | null | undefined): boolean {
  return Boolean(user && unresolvedPeople.has(user))
}

/**
 * 23 Nov (owner, issue 20 web part): a stand-in whose stored id a former-person record names (`deletedPeople`,
 * `formerPersonForId`) reads "Former: Jane Smith" (`formerPersonLabel`) instead of "Unknown person · …". Display only.
 */
const formerStandIns = new WeakSet<object>()

/** Whether `user` is a stand-in named from a former-person record. */
export function isFormerTimesheetPerson(user: object | null | undefined): boolean {
  return Boolean(user && formerStandIns.has(user))
}

export function unresolvedTimesheetPerson(
  storedUserId: string,
  organizationId: string,
  formerPeople: ReadonlyArray<FormerPerson> = []
): import('@/types').User {
  const hint = bookingPersonIdHint(storedUserId)
  const former = formerPersonForId(storedUserId, formerPeople)
  const person = {
    id: storedUserId,
    email: '',
    firstName: former ? formerPersonLabel(former.displayName) : UNKNOWN_BOOKING_PERSON_LABEL,
    surname: former ? '' : hint ? `· ${hint}` : '',
    organizationId,
    role: 'operative',
    passwordSet: false,
    policyAccepted: false,
    isSuperAdmin: false,
    isActive: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  } as unknown as import('@/types').User
  unresolvedPeople.add(person)
  if (former) formerStandIns.add(person)
  return person
}

/**
 * Review of #386 (owner data, Raccord MEP): who an exported sheet is listed under. `users` are the people on the viewer's
 * Exported list, `roster` every users document of the organisation.
 *   - The sheet's stored person id (its `userId`, else the id its document id names) is matched to a listed person under
 *     every id they go by (`timesheetOwnerResolver` over `personIdSet`).
 *   - Several users documents of ONE person (a second record on the same email, a former invite id) are one person
 *     (`personIdSet`): every sheet is listed under one record of that person — the active, signed-up one, else the
 *     first listed — so the Exported list shows them once, not once per record.
 *   - An id nobody in the organisation goes by (a deleted person) is "Unknown person · <hint>" when `includeUnresolved`
 *     (admins, once the roster has loaded), one stand-in per stored id; otherwise null.
 */
export function exportedSheetOwnerResolver({
  users,
  roster,
  includeUnresolved,
  organizationId,
  formerPeople = [],
}: {
  users: ReadonlyArray<import('@/types').User>
  roster: ReadonlyArray<import('@/types').User>
  includeUnresolved: boolean
  organizationId: string
  /** 23 Nov: the organisation's former-person records; a matching id reads "Former: <name>". Missing: none. */
  formerPeople?: ReadonlyArray<FormerPerson>
}): (storedUserId: string | null | undefined) => import('@/types').User | null {
  const fullRoster = roster.length > 0 ? roster : users
  const ownerOf = timesheetOwnerResolver(users, fullRoster)
  const rosterOwnerOf = timesheetOwnerResolver(fullRoster, fullRoster)
  const rank = (member: import('@/types').User) => (member.isActive === false ? 2 : 0) + (member.passwordSet === false ? 1 : 0)
  const primaryById = new Map<string, import('@/types').User>()
  for (const member of users) {
    const key = normalizeDocumentId(member.id)
    if (primaryById.has(key)) continue
    const ids = new Set(timesheetMemberIds(member, fullRoster).map((id) => normalizeDocumentId(id)))
    const records = users.filter((other) => ids.has(normalizeDocumentId(other.id)))
    const primary = records.reduce((best, other) => (rank(other) < rank(best) ? other : best), records[0] ?? member)
    for (const other of records) primaryById.set(normalizeDocumentId(other.id), primary)
    primaryById.set(key, primaryById.get(key) ?? primary)
  }
  const unknown = new Map<string, import('@/types').User>()
  return (storedUserId) => {
    const stored = (storedUserId ?? '').trim()
    if (!stored) return null
    const member = ownerOf(stored)
    if (member) return primaryById.get(normalizeDocumentId(member.id)) ?? member
    if (!includeUnresolved || rosterOwnerOf(stored)) return null
    const key = normalizeDocumentId(stored)
    let stand = unknown.get(key)
    if (!stand) {
      stand = unresolvedTimesheetPerson(stored, organizationId, formerPeople)
      unknown.set(key, stand)
    }
    return stand
  }
}

export async function loadExportedTimesheetHistory({
  organizationId,
  users,
  roster,
  includeUnresolved: includeUnresolvedAsked = false,
  rosterLoaded = false,
  viewerIsOperative = false,
  viewerIsAdmin = false,
  formerPeople = [],
}: {
  organizationId: string
  users: import('@/types').User[]
  /**
   * 17 Nov follow-up: the whole organisation roster — a sheet stored under a former invite id or a second users document
   * of a listed person is matched to them (`personIdSet`), and a stored id nobody goes by is known to be nobody's.
   * Missing: `users`.
   */
  roster?: ReadonlyArray<import('@/types').User>
  /**
   * List an exported sheet whose stored person is nobody in the organisation as "Unknown person · …" (admins). Review
   * of #386 (S5): only once the whole roster has loaded (`rosterLoaded` and a non-empty `roster`), so a person still
   * loading is never shown as unknown.
   */
  includeUnresolved?: boolean
  rosterLoaded?: boolean
  /** Review of #386 (N1): the viewer is at the operative level (the rules refuse them the document-id prefix query). */
  viewerIsOperative?: boolean
  /**
   * Final review of #386: the viewer is an admin of this organisation. While `privatePay` is on only admins may ask a
   * person's other ids and the document-id prefix (`timesheetLookupPlan`).
   */
  viewerIsAdmin?: boolean
  /**
   * 23 Nov (owner, issue 20 web part): the organisation's `deletedPeople` records (`parseFormerPersonDocument`), so an
   * unresolved row of a deleted person reads "Former: <name>". Display only; the rows listed never change. A failed
   * read passes none and the row keeps "Unknown person · …".
   */
  formerPeople?: ReadonlyArray<FormerPerson>
}): Promise<ExportedTimesheetHistoryRow[]> {
  const includeUnresolved = includeUnresolvedAsked && rosterLoaded && (roster?.length ?? 0) > 0
  if (users.length === 0 && !includeUnresolved) return []
  const cacheKey = `${exportedHistoryCacheKey(organizationId, users)}|${includeUnresolved ? 'u' : ''}|${(roster ?? []).length}|${viewerIsOperative ? 'o' : ''}|${viewerIsAdmin ? 'a' : ''}|${formerPeople.length > 0 ? 'f' : ''}`
  const now = Date.now()
  if (exportedHistoryMemo && exportedHistoryMemo.key === cacheKey && now - exportedHistoryMemo.at < EXPORTED_HISTORY_TTL_MS) {
    return exportedHistoryMemo.rows
  }
  const byId = new Map<string, ExportedTimesheetHistoryRow>()
  const fullRoster = roster && roster.length > 0 ? roster : users
  const sheetOwner = exportedSheetOwnerResolver({ users, roster: fullRoster, includeUnresolved, organizationId, formerPeople })

  const ingestData = (member: import('@/types').User, weekStart: Date, data: Record<string, unknown>, documentId: string) => {
    ingestExportedRow(
      byId,
      member,
      weekStart,
      draftFromFirestoreMap(data, { ...LIST_DRAFT_OPTIONS, sheetDocId: documentId }),
      storedEndDayKey(data, LONDON_TIME_ZONE),
      documentId
    )
  }

  // Review of #386 (S3): the per-person reads below run only when this company-wide read is REFUSED (or fails) — a
  // read that answers with no exported sheets is the answer, never a reason to ask person by person.
  let companyWide: Awaited<ReturnType<typeof getDocs>> | null = null
  try {
    companyWide = await getDocs(
      query(collection(db, 'organizations', organizationId, 'settings'), where('exportedAt', '!=', null))
    )
  } catch {
    // Missing index or rules — fall back to the per-person reads.
  }
  if (companyWide) {
    const snap = companyWide
    for (const entry of snap.docs) {
      if (!entry.id.startsWith('timesheet_')) continue
      const data = entry.data() as Record<string, unknown>
      // Rulebook 1.31.0: a sheet stored without `userId` (older builds) is matched by its document id
      // (`timesheetDocumentSubjectId`), never dropped by this fast path.
      const userId =
        (typeof data.userId === 'string' && data.userId.trim()) || timesheetDocumentSubjectId(entry.id)
      const weekStart = parseFirestoreDate(data.weekStart)
      if (!weekStart) continue
      // 17 Nov follow-up (guardrail 1): the person under every id they go by, never one exact id.
      // Review of #386: one person under every id and every record (`exportedSheetOwnerResolver`).
      const member = sheetOwner(userId)
      if (!member) continue
      ingestData(member, weekStart, data, entry.id)
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

  // One read per person (their records fold into one, `exportedSheetOwnerResolver`).
  const people = [...new Set(users.map((member) => sheetOwner(member.id) ?? member))]
  await securitySwitchesReady()
  const privatePay = timesheetLookupPrivatePay(organizationId)
  const batches = await mapInBatches(people, 8, async (member) => {
    // Guardrail 1: every id the person goes by (a former invite id, a second users document on their email), and
    // sheets stored without `userId` whose document id names them — when this viewer's rules allow those queries
    // (`timesheetLookupPlan`: not for an operative; while `privatePay` is on, admins only).
    const plan = timesheetLookupPlan({ ids: timesheetMemberIds(member, fullRoster), viewerIsOperative, viewerIsAdmin, privatePay })
    const rows = await listPersonTimesheetStates(organizationId, plan.ids, 400, 'all', plan.includeDocumentPrefix)
    return { member, rows }
  })
  for (const { member, rows } of batches) {
    for (const row of rows) {
      // A sheet filed under an id two listed documents share goes to the one it names exactly (`timesheetOwnerResolver`).
      if (sheetOwner(row.userId) !== member) continue
      ingestExportedRow(byId, member, row.weekStart, row.draft, row.endDayKey, row.documentId)
    }
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
