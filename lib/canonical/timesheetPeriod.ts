/**
 * Timesheet period identity, list status, and sign-off / export write shape.
 *
 * Both apps persist `organizations/{orgId}/settings/timesheet_{userId}_{unixStart}`.
 * Status is not a second enum in a screen: Awaiting / Signed off / Exported come
 * from `timesheetListBucket`. Submit deadline and reminder stay in
 * `timesheetSubmission.ts` — call those, do not rewrite them here.
 *
 * First divergence this locks: web used to treat any signed leftover inside the
 * current pay-run window as that period's sheet, and it wrote `managerSignedAt`
 * without the `approvedAt` alias iOS still reads. After a 1–7 → 1–15 change the
 * platforms then disagreed (signed on web, awaiting on iOS). Period identity is
 * start+end day keys; a historical window is never remapped through the live
 * org setting.
 */

import {
  CANONICAL_TIME_ZONE,
  invoicingPeriod,
  normalizePaymentRunRange,
  organizationIdsMatch,
  type PaymentRunMode,
  type PaymentRunRangeInput,
} from './engine'
import {
  addDaysInZone,
  dateFromDayKeyInZone,
  dayKeyInZone,
  unixStartOfDayInZone,
} from '../orgTime/zoneTime'

export const TIMESHEET_DOCUMENT_PREFIX = 'timesheet_'
export const TIMESHEET_SETTINGS_COLLECTION = 'organizations/{orgId}/settings'
export const TIMESHEET_EXPORT_STORAGE_FOLDER = 'timesheetExports'
export const TIMESHEET_SIGNED_AFTER_MS = Date.parse('2020-01-01T00:00:00.000Z')
export const TIMESHEET_INVOICE_EXPORT_LEFTOVER_MS = 60_000

export const TIMESHEET_LIST_BUCKETS = ['awaiting', 'signed', 'exported', 'unsigned'] as const
export type TimesheetListBucket = (typeof TIMESHEET_LIST_BUCKETS)[number]

export const TIMESHEET_DOCUMENT_FIELDS = [
  'userId',
  'weekStart',
  'weekStartKey',
  'weekEnd',
  'weekEndKey',
  'updatedAt',
  'managerNote',
  'operativeSignedAt',
  'operativeSignedByName',
  'operativeSignatureImageBase64',
  'managerSignedAt',
  'managerSignedByName',
  'managerSignedByUserId',
  'managerSignatureImageBase64',
  'approvedAt',
  'approvedByName',
  'exportedAt',
  'expenseEntries',
  'priceWorkEntries',
  'payrollLineReviews',
  'weeklyReportOverride',
] as const

export type TimesheetPeriodIdentity = {
  organizationId: string
  userId: string
  startDayKey: string
  endDayKey: string
}

export type TimesheetPaymentRunWindow = {
  paymentRunMode: PaymentRunMode
  ranges?: readonly PaymentRunRangeInput[] | null
  recurringRunStartDay?: string | null
  recurringRunEndDay?: string | null
}

export type TimesheetPaymentRunPeriod = {
  startDayKey: string
  endDayKey: string
  source: 'current' | 'historical' | 'observed'
}

export type PaymentRunHistoryWindow = TimesheetPaymentRunWindow & {
  recordedAtDayKey: string
}

export type TimesheetStatusFields = {
  operativeSignedAtMs: number | null
  operativeSignedByName: string
  operativeSignatureImageBase64: string
  managerSignedAtMs: number | null
  managerSignedByName: string
  managerSignedByUserId: string
  managerSignatureImageBase64: string
  exportedAtMs: number | null
}

function zoneOf(timeZone?: string | null): string {
  return String(timeZone || '').trim() || CANONICAL_TIME_ZONE
}

function trimmed(value: unknown): string {
  return String(value ?? '').trim()
}

function isDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Firestore Timestamp, Date, ISO string, or epoch seconds/ms → epoch ms. */
export function timesheetTimestampMs(value: unknown): number | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isNaN(ms) ? null : ms
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value)
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? null : ms
  }
  if (typeof value === 'object') {
    const row = value as { toDate?: () => Date; seconds?: unknown; _seconds?: unknown }
    if (typeof row.toDate === 'function') {
      try {
        const date = row.toDate()
        if (date instanceof Date && !Number.isNaN(date.getTime())) return date.getTime()
      } catch {
        // Fall through to seconds.
      }
    }
    const seconds = Number(row.seconds ?? row._seconds)
    if (Number.isFinite(seconds)) return Math.round(seconds * 1000)
  }
  return null
}

function realSignatureMs(value: unknown): number | null {
  const ms = timesheetTimestampMs(value)
  if (ms == null || ms <= TIMESHEET_SIGNED_AFTER_MS) return null
  return ms
}

/**
 * Document id both apps load and save for a pay-run period.
 * `{unix}` is organisation-zone midnight of `startDayKey`, never the device zone
 * and never an ISO-week Monday unless that Monday is the period start.
 */
export function timesheetDocumentId(userId: string, startDayKey: string, timeZone?: string | null): string {
  const uid = trimmed(userId)
  if (!uid || !isDayKey(startDayKey)) return ''
  const stamp = unixStartOfDayInZone(dateFromDayKeyInZone(startDayKey, zoneOf(timeZone)), zoneOf(timeZone))
  return `${TIMESHEET_DOCUMENT_PREFIX}${uid}_${stamp}`
}

/**
 * Rulebook 1.31.0: the users id a timesheet document id names (`timesheet_{uid}_{unix}`, `timesheetDocumentId`), or
 * '' when the id is not a timesheet id. Used when a stored sheet has no `userId` field (older builds), so it is never
 * dropped from a list that matches sheets to people.
 */
export function timesheetDocumentSubjectId(documentId: unknown): string {
  const id = typeof documentId === 'string' ? documentId.trim() : ''
  if (!id.startsWith(TIMESHEET_DOCUMENT_PREFIX)) return ''
  // 1.55.0: a revision id (`…_rev{N}`, §8) names the same person as the original it corrects.
  const match = /^(.+)_(-?\d+)$/.exec(id.slice(TIMESHEET_DOCUMENT_PREFIX.length).replace(/_rev[1-9]\d*$/, ''))
  return match ? match[1] : ''
}

export function timesheetPeriodKey(period: Pick<TimesheetPeriodIdentity, 'startDayKey' | 'endDayKey'>): string {
  return `${period.startDayKey}|${period.endDayKey}`
}

export function timesheetPeriodFromInvoicing(
  input: TimesheetPaymentRunWindow & { referenceDayKey: string; timeZone?: string | null }
): { startDayKey: string; endDayKey: string } {
  const timeZone = zoneOf(input.timeZone)
  const reference = dateFromDayKeyInZone(input.referenceDayKey, timeZone)
  return invoicingPeriod({
    referenceIso: reference.toISOString(),
    timeZone,
    paymentRunMode: input.paymentRunMode,
    ranges: input.ranges,
    recurringRunStartDay: input.recurringRunStartDay,
    recurringRunEndDay: input.recurringRunEndDay,
  })
}

export function timesheetPeriodContainsDay(
  period: Pick<TimesheetPeriodIdentity, 'startDayKey' | 'endDayKey'>,
  dayKey: string
): boolean {
  if (!isDayKey(period.startDayKey) || !isDayKey(period.endDayKey) || !isDayKey(dayKey)) return false
  return dayKey >= period.startDayKey && dayKey <= period.endDayKey
}

/**
 * Stored start+end win. A leftover start-only row matches the live period only
 * when its start is that period's start — it is never remapped onto a wider
 * window after a 1–7 → 1–15 (or recurring ↔ date-range) change.
 */
export function resolveTimesheetPeriod(input: {
  storedStartDayKey: string
  storedEndDayKey?: string | null
  currentPeriod: { startDayKey: string; endDayKey: string }
}): { startDayKey: string; endDayKey: string } {
  const start = trimmed(input.storedStartDayKey)
  const end = trimmed(input.storedEndDayKey)
  if (isDayKey(start) && isDayKey(end)) return { startDayKey: start, endDayKey: end }
  if (isDayKey(start) && start === input.currentPeriod.startDayKey) return { ...input.currentPeriod }
  if (isDayKey(start)) return { startDayKey: start, endDayKey: start }
  return { ...input.currentPeriod }
}

export function timesheetPeriodMatches(
  stored: { startDayKey: string; endDayKey?: string | null },
  period: { startDayKey: string; endDayKey: string }
): boolean {
  const start = trimmed(stored.startDayKey)
  const end = trimmed(stored.endDayKey)
  if (start !== period.startDayKey) return false
  if (isDayKey(end)) return end === period.endDayKey
  return true
}

export function timesheetBelongsToOrganization(
  storedOrganizationId: string | null | undefined,
  organizationId: string
): boolean {
  return organizationIdsMatch(storedOrganizationId, organizationId)
}

export function isTimesheetOperativeSigned(fields: Pick<
  TimesheetStatusFields,
  'operativeSignedAtMs' | 'operativeSignedByName' | 'operativeSignatureImageBase64'
>): boolean {
  if (fields.operativeSignedAtMs == null || fields.operativeSignedAtMs <= TIMESHEET_SIGNED_AFTER_MS) return false
  return Boolean(trimmed(fields.operativeSignedByName) || trimmed(fields.operativeSignatureImageBase64))
}

export function timesheetRequiresManagerCounterSign(hasLineManager: boolean): boolean {
  return hasLineManager === true
}

export function isTimesheetManagerSigned(fields: Pick<TimesheetStatusFields, 'managerSignedAtMs'>): boolean {
  return fields.managerSignedAtMs != null && fields.managerSignedAtMs > TIMESHEET_SIGNED_AFTER_MS
}

export function isTimesheetFullySigned(fields: TimesheetStatusFields, hasLineManager: boolean): boolean {
  if (!isTimesheetOperativeSigned(fields)) return false
  if (timesheetRequiresManagerCounterSign(hasLineManager)) return isTimesheetManagerSigned(fields)
  return true
}

export function isTimesheetAwaitingSignOff(fields: TimesheetStatusFields, hasLineManager: boolean): boolean {
  return (
    timesheetRequiresManagerCounterSign(hasLineManager) &&
    isTimesheetOperativeSigned(fields) &&
    !isTimesheetManagerSigned(fields)
  )
}

/**
 * Generate Invoice must not set `exportedAt`. Email and export does.
 * A leftover web build copied `invoiceGeneratedAt` onto `exportedAt` within a
 * minute — that is not an export.
 */
export function resolveTimesheetExportedAtMs(data: Record<string, unknown>): number | null {
  const exportedAt = realSignatureMs(data.exportedAt)
  if (exportedAt == null) return null
  const invoiceGeneratedAt = timesheetTimestampMs(data.invoiceGeneratedAt)
  if (
    invoiceGeneratedAt != null &&
    Math.abs(exportedAt - invoiceGeneratedAt) <= TIMESHEET_INVOICE_EXPORT_LEFTOVER_MS
  ) {
    return null
  }
  return exportedAt
}

export function isTimesheetExported(fields: Pick<TimesheetStatusFields, 'exportedAtMs'>): boolean {
  return fields.exportedAtMs != null && fields.exportedAtMs > TIMESHEET_SIGNED_AFTER_MS
}

/**
 * Awaiting / Signed off / Exported. Rulebook 1.47.0 §8: pass the sheet's `signedTimesheetBookingChanges` as `change`
 * — a reopened sheet waiting for the person reads `unsigned` (back with them to sign again), one waiting for the line
 * manager `awaiting` (counter-sign again); an exported sheet stays `exported` whatever its bookings say. Without
 * `change` the result is exactly as before 1.47.0.
 */
export function timesheetListBucket(
  fields: TimesheetStatusFields,
  hasLineManager: boolean,
  change?: { reopened?: boolean | null; waitingFor?: 'person' | 'lineManager' | null } | null
): TimesheetListBucket {
  if (isTimesheetExported(fields)) return 'exported'
  if (change?.reopened === true && isTimesheetOperativeSigned(fields)) {
    return change.waitingFor === 'lineManager' && hasLineManager ? 'awaiting' : 'unsigned'
  }
  if (isTimesheetFullySigned(fields, hasLineManager)) return 'signed'
  if (isTimesheetAwaitingSignOff(fields, hasLineManager)) return 'awaiting'
  return 'unsigned'
}

export function parseTimesheetStatusFields(data: Record<string, unknown> | null | undefined): TimesheetStatusFields {
  const row = data && typeof data === 'object' ? data : {}
  const managerSignedAtMs = realSignatureMs(row.managerSignedAt) ?? realSignatureMs(row.approvedAt)
  return {
    operativeSignedAtMs: realSignatureMs(row.operativeSignedAt),
    operativeSignedByName: trimmed(row.operativeSignedByName),
    operativeSignatureImageBase64: trimmed(row.operativeSignatureImageBase64),
    managerSignedAtMs,
    managerSignedByName: trimmed(row.managerSignedByName) || trimmed(row.approvedByName),
    managerSignedByUserId: trimmed(row.managerSignedByUserId),
    managerSignatureImageBase64: trimmed(row.managerSignatureImageBase64),
    exportedAtMs: resolveTimesheetExportedAtMs(row),
  }
}

/**
 * Fields both apps persist when someone signs. Manager sign dual-writes
 * `approvedAt` / `approvedByName` so a reader that still decodes the alias
 * agrees with `managerSignedAt`.
 */
export function timesheetSignOffWriteFields(input: {
  role: 'operative' | 'manager'
  signedAtMs: number
  signedByName: string
  signedByUserId?: string
  signatureImageBase64?: string
}): Record<string, unknown> {
  const signedAtMs = Number(input.signedAtMs)
  const name = trimmed(input.signedByName)
  const signature = trimmed(input.signatureImageBase64)
  if (input.role === 'operative') {
    return {
      operativeSignedAtMs: signedAtMs,
      operativeSignedByName: name,
      operativeSignatureImageBase64: signature,
    }
  }
  return {
    managerSignedAtMs: signedAtMs,
    managerSignedByName: name,
    managerSignedByUserId: trimmed(input.signedByUserId),
    managerSignatureImageBase64: signature,
    approvedAtMs: signedAtMs,
    approvedByName: name,
  }
}

export function timesheetExportWriteFields(exportedAtMs: number): Record<string, unknown> {
  return { exportedAtMs: Number(exportedAtMs) }
}

export function timesheetPeriodWriteFields(input: {
  userId: string
  startDayKey: string
  endDayKey: string
}): Record<string, unknown> {
  return {
    userId: trimmed(input.userId),
    weekStartKey: trimmed(input.startDayKey),
    weekEndKey: trimmed(input.endDayKey),
  }
}

/** Storage object iOS already writes: `organizations/{orgId}/timesheetExports/{stamp}_{file}`. */
export function timesheetExportStoragePath(
  organizationId: string,
  fileName: string,
  stampSeconds: number
): string {
  const org = trimmed(organizationId)
  const safe = trimmed(fileName).replace(/\s+/g, '_')
  const stamp = Math.max(0, Math.floor(Number(stampSeconds) || 0))
  return `organizations/${org}/${TIMESHEET_EXPORT_STORAGE_FOLDER}/${stamp}_${safe}`
}

export function timesheetStatusWriteFields(fields: TimesheetStatusFields): Record<string, unknown> {
  const managerMs = fields.managerSignedAtMs
  return {
    operativeSignedAtMs: fields.operativeSignedAtMs,
    operativeSignedByName: trimmed(fields.operativeSignedByName),
    operativeSignatureImageBase64: trimmed(fields.operativeSignatureImageBase64),
    managerSignedAtMs: managerMs,
    managerSignedByName: trimmed(fields.managerSignedByName),
    managerSignedByUserId: trimmed(fields.managerSignedByUserId),
    managerSignatureImageBase64: trimmed(fields.managerSignatureImageBase64),
    approvedAtMs: managerMs,
    approvedByName: trimmed(fields.managerSignedByName),
    exportedAtMs: fields.exportedAtMs,
  }
}

export type TimesheetPeriodCandidateRow = {
  startDayKey: string
  endDayKey?: string | null
  hasActivity?: boolean
  /** 1.55.0: the stored document id, so revisions (`…_rev{N}`, §8) of one sheet are read as one row. */
  documentId?: string | null
  /** 1.55.0: `exportedAt` stored (only read with `versions: 'reports'`). */
  exported?: boolean | null
  /** 1.55.0: signed off (only read with `versions: 'reports'`). */
  signedOff?: boolean | null
}

/**
 * 1.55.0 §8: of the rows that are versions of one sheet (an original and its `…_rev{N}` revisions), only one stays a
 * candidate — the latest version (`latest`, lists and the period page), or the latest exported or signed-off version
 * (`reports`, the weekly report and Payrun Snapshot; `timesheetReportVersion`). Rows without a document id, and sheets
 * without revisions, are untouched.
 */
function versionCandidateIndexes(rows: readonly TimesheetPeriodCandidateRow[], versions: 'latest' | 'reports'): Set<number> {
  const keep = new Set<number>()
  const chains = new Map<string, Array<{ index: number; revision: number }>>()
  rows.forEach((row, index) => {
    const id = trimmed(row.documentId)
    const match = /^(timesheet_.+)_rev([1-9]\d*)$/.exec(id)
    if (!id) {
      keep.add(index)
      return
    }
    const base = match ? match[1] : id
    const revision = match ? Number(match[2]) : 0
    const chain = chains.get(base) ?? []
    chain.push({ index, revision })
    chains.set(base, chain)
  })
  for (const chain of chains.values()) {
    chain.sort((a, b) => a.revision - b.revision)
    let picked = chain[chain.length - 1]
    if (versions === 'reports') {
      for (let at = chain.length - 1; at >= 0; at -= 1) {
        const row = rows[chain[at].index]
        if (chain[at].revision === 0 || row.exported === true || row.signedOff === true) {
          picked = chain[at]
          break
        }
      }
    }
    keep.add(picked.index)
  }
  return keep
}

/**
 * Which stored row is this pay-run period. Exact start+end wins. A start-only
 * leftover matches only the period that still starts on that day. A sheet whose
 * stored end disagrees (historical 1–7 vs live 1–15) is never promoted.
 * 1.55.0: rows that are versions of one sheet count as one row (`versions`, default the latest).
 */
export function pickTimesheetRowForPeriod(
  rows: readonly TimesheetPeriodCandidateRow[],
  period: { startDayKey: string; endDayKey: string },
  options?: { versions?: 'latest' | 'reports' } | null
): number {
  if (rows.length === 0) return -1
  const candidates = versionCandidateIndexes(rows, options?.versions === 'reports' ? 'reports' : 'latest')
  const exact: number[] = []
  const startOnly: number[] = []
  for (let index = 0; index < rows.length; index += 1) {
    if (!candidates.has(index)) continue
    const row = rows[index]
    if (trimmed(row.startDayKey) !== period.startDayKey) continue
    const end = trimmed(row.endDayKey)
    if (isDayKey(end)) {
      if (end === period.endDayKey) exact.push(index)
      continue
    }
    startOnly.push(index)
  }
  const withActivity = (indexes: number[]) => indexes.find((index) => rows[index]?.hasActivity === true)
  return withActivity(exact) ?? exact[0] ?? withActivity(startOnly) ?? startOnly[0] ?? -1
}

function paymentRunWindowFingerprint(window: TimesheetPaymentRunWindow): string {
  if (String(window.paymentRunMode || '') === 'recurring_timeframe') {
    return `recurring:${trimmed(window.recurringRunStartDay).toLowerCase() || 'monday'}:${trimmed(window.recurringRunEndDay).toLowerCase() || 'sunday'}`
  }
  const ranges = (window.ranges ?? [])
    .map((row) => normalizePaymentRunRange(row))
    .filter((row): row is { startDay: number; endDay: number } => row != null)
    .map((row) => `${row.startDay}-${row.endDay}`)
  return `dates:${ranges.join('|')}`
}

export function paymentRunHistoryAfterChange(input: {
  previous: TimesheetPaymentRunWindow
  next: TimesheetPaymentRunWindow
  existingHistory?: readonly PaymentRunHistoryWindow[] | null
  recordedAtDayKey: string
}): PaymentRunHistoryWindow[] {
  const existing = [...(input.existingHistory ?? [])]
  if (paymentRunWindowFingerprint(input.previous) === paymentRunWindowFingerprint(input.next)) {
    return existing
  }
  const snapshot: PaymentRunHistoryWindow = {
    paymentRunMode: input.previous.paymentRunMode === 'recurring_timeframe' ? 'recurring_timeframe' : 'date_ranges',
    ranges: (input.previous.ranges ?? [])
      .map((row) => normalizePaymentRunRange(row))
      .filter((row): row is { startDay: number; endDay: number } => row != null),
    recurringRunStartDay: trimmed(input.previous.recurringRunStartDay) || 'monday',
    recurringRunEndDay: trimmed(input.previous.recurringRunEndDay) || 'sunday',
    recordedAtDayKey: trimmed(input.recordedAtDayKey),
  }
  const fingerprint = paymentRunWindowFingerprint(snapshot)
  const rest = existing.filter((row) => paymentRunWindowFingerprint(row) !== fingerprint)
  return [snapshot, ...rest].slice(0, 24)
}

export function timesheetPaymentRunPeriodsFromWindow(input: TimesheetPaymentRunWindow & {
  referenceDayKey: string
  lookbackCount?: number
  includeCurrent?: boolean
  timeZone?: string | null
}): Array<{ startDayKey: string; endDayKey: string }> {
  const timeZone = zoneOf(input.timeZone)
  const lookback = Math.max(0, Math.min(Number(input.lookbackCount) || 0, 240))
  const current = timesheetPeriodFromInvoicing(input)
  const periods: Array<{ startDayKey: string; endDayKey: string }> = input.includeCurrent === false ? [] : [current]
  let cursor = current.startDayKey
  for (let step = 0; step < lookback; step += 1) {
    const previousRef = addDaysInZone(dateFromDayKeyInZone(cursor, timeZone), -1, timeZone)
    const previous = invoicingPeriod({
      referenceIso: previousRef.toISOString(),
      timeZone,
      paymentRunMode: input.paymentRunMode,
      ranges: input.ranges,
      recurringRunStartDay: input.recurringRunStartDay,
      recurringRunEndDay: input.recurringRunEndDay,
    })
    if (previous.startDayKey === cursor) break
    periods.push(previous)
    cursor = previous.startDayKey
  }
  return periods
}

/**
 * Payment runs a timesheet picker may show: live settings, snapshots kept when
 * the window/mode changed, and start+end pairs already stored on timesheet docs.
 * A 1–7 historical run stays selectable after payroll becomes 1–15 or 1–5.
 */
export function selectableTimesheetPaymentRunPeriods(input: {
  current: TimesheetPaymentRunWindow
  historicalWindows?: readonly PaymentRunHistoryWindow[] | null
  observedPeriods?: ReadonlyArray<{ startDayKey: string; endDayKey: string }> | null
  referenceDayKey: string
  lookbackCount?: number
  timeZone?: string | null
}): TimesheetPaymentRunPeriod[] {
  const lookback = input.lookbackCount ?? 120
  const seen = new Set<string>()
  const periods: TimesheetPaymentRunPeriod[] = []
  const add = (period: { startDayKey: string; endDayKey: string }, source: TimesheetPaymentRunPeriod['source']) => {
    if (!isDayKey(period.startDayKey) || !isDayKey(period.endDayKey)) return
    const key = timesheetPeriodKey(period)
    if (seen.has(key)) return
    seen.add(key)
    periods.push({ startDayKey: period.startDayKey, endDayKey: period.endDayKey, source })
  }
  for (const period of timesheetPaymentRunPeriodsFromWindow({
    ...input.current,
    referenceDayKey: input.referenceDayKey,
    lookbackCount: lookback,
    timeZone: input.timeZone,
  })) {
    add(period, 'current')
  }
  for (const window of input.historicalWindows ?? []) {
    for (const period of timesheetPaymentRunPeriodsFromWindow({
      paymentRunMode: window.paymentRunMode,
      ranges: window.ranges,
      recurringRunStartDay: window.recurringRunStartDay,
      recurringRunEndDay: window.recurringRunEndDay,
      referenceDayKey: input.referenceDayKey,
      lookbackCount: lookback,
      timeZone: input.timeZone,
    })) {
      add(period, 'historical')
    }
  }
  for (const period of input.observedPeriods ?? []) {
    add(period, 'observed')
  }
  periods.sort((left, right) => {
    if (left.startDayKey !== right.startDayKey) return right.startDayKey.localeCompare(left.startDayKey)
    return right.endDayKey.localeCompare(left.endDayKey)
  })
  return periods
}

export function parsePaymentRunHistory(raw: unknown): PaymentRunHistoryWindow[] {
  if (!Array.isArray(raw)) return []
  const rows: PaymentRunHistoryWindow[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const data = entry as Record<string, unknown>
    const mode = String(data.paymentRunMode || '') === 'recurring_timeframe' ? 'recurring_timeframe' : 'date_ranges'
    const rangeRows = Array.isArray(data.paymentRunDateRanges)
      ? data.paymentRunDateRanges
      : Array.isArray(data.ranges)
        ? data.ranges
        : []
    const ranges = rangeRows
      .map((row) => normalizePaymentRunRange((row || {}) as PaymentRunRangeInput))
      .filter((row): row is { startDay: number; endDay: number } => row != null)
    const recordedAtDayKey = trimmed(data.recordedAtDayKey)
    rows.push({
      paymentRunMode: mode,
      ranges,
      recurringRunStartDay: trimmed(data.recurringRunStartDay) || 'monday',
      recurringRunEndDay: trimmed(data.recurringRunEndDay) || 'sunday',
      recordedAtDayKey: isDayKey(recordedAtDayKey) ? recordedAtDayKey : '',
    })
  }
  return rows
}

export function paymentRunHistoryToFirestore(history: readonly PaymentRunHistoryWindow[]): Record<string, unknown>[] {
  return history.map((window) => ({
    paymentRunMode: window.paymentRunMode,
    paymentRunDateRanges: (window.ranges ?? []).map((range) => {
      const normalized = normalizePaymentRunRange(range) ?? { startDay: 0, endDay: 0 }
      return {
        startDay: normalized.startDay,
        endDay: normalized.endDay,
        startDate: normalized.startDay,
        endDate: normalized.endDay,
      }
    }),
    recurringRunStartDay: window.recurringRunStartDay || 'monday',
    recurringRunEndDay: window.recurringRunEndDay || 'sunday',
    recordedAtDayKey: window.recordedAtDayKey,
  }))
}

/** Calendar day of a stored `weekStart` in the organisation zone. */
export function timesheetStoredStartDayKey(weekStart: unknown, timeZone?: string | null): string {
  const ms = timesheetTimestampMs(weekStart)
  if (ms == null) return ''
  return dayKeyInZone(new Date(ms), zoneOf(timeZone))
}
