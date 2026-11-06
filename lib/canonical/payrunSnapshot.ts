/**
 * Payrun Snapshot (rulebook §7, 1.33.0, owner decisions 6 Nov "Payrun Snapshot: build it", spec B).
 *
 * Weekly report (admins only, `canOpenWeeklyReport`) → Payrun Snapshot: one row per person showing, for one period,
 * where each person's pay paperwork stands. Read-only; nothing is stored; no export.
 *
 * Period (`payrunSnapshotPeriods`): the current PAYE payrun (`payePayrunPeriod`, §4.5), the current payment run that
 * self-employed timesheets use (`activePaymentRunSummary`, §8), or a custom range (`payrunSnapshotCustomPeriod`).
 *
 * Rows (`payrunSnapshotRows`): every active person (`rosterSegment` "active"), self-employed and PAYE, whatever period
 * is picked. An inactive, pending or deleted person is listed only when they have a timesheet, overtime request or
 * report, expense, price work item or claim report in the period. One row per person: roster rows that are the same
 * person (`personIdSet`) are one row, and every id they go by is matched.
 *
 * Columns: name; user level (`permissionLevelOf`: Admin / Manager / Operative, the Super Admin "Admin (Super Admin)");
 * employment type on the period's last day (`weeklyReportPayeDay`, with a note when it differed on the first day);
 * then four cells, each `{ state, label, tone, link }`:
 *   - Timesheet (self-employed): Not started / Submitted / Signed (`timesheetListBucket` with `hasActiveLineManager`;
 *     unsigned = Not started, awaiting the line manager = Submitted, fully signed or exported = Signed). Several pay
 *     runs in the period: the least-advanced state with a count ("Submitted · 2 of 4 signed"). PAYE: red "PAYE".
 *   - Overtime (PAYE): with an active line manager, Not started / Submitted (a request waiting for them) / Returned;
 *     with none, "Report generated: Yes / No" (a report marked out of date does not count). Self-employed: red
 *     "Self Employed".
 *   - Expenses and Price work (PAYE): "Report generated: Yes" when a saved report of that kind overlaps the period,
 *     else the item count ("2 items, no report" / "No items", `payeClaimsInRange`). Self-employed: red "Self Employed".
 * A cell's `link` names the page it opens — the person's timesheet for that pay run, or Users' Overtime / Expenses /
 * Price work for that person and range; the red cells have none. Both apps only render these rows.
 */

import { dateFromDayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { hasActiveLineManager, isSuperAdminAccount, type LeaveSelfBookUser } from './leaveRequests'
import { parseInvoicing } from './organizationSettings'
import {
  overtimePersonIds,
  overtimeReportIsOutOfDate,
  overtimeReportOutOfDate,
  payeOvertimeLines,
  weeklyReportPayeDay,
  type OvertimeBookingInput,
  type OvertimeOrganization,
  type OvertimeReportSnapshot,
  type OvertimeRequestRecord,
  type OvertimeReviewRecord,
} from './payeOvertime'
import { payeClaimsInRange, type ExpenseItem, type PayeClaimKind, type PriceWorkItem } from './payeClaims'
import { PAYE_PAYDAY_NOT_SET_MESSAGE, payeCustomRange, payePayrunLabel, payePayrunPeriod } from './payePayrun'
import { activePaymentRunSummary, formatPaymentRunDay } from './paymentRuns'
import { permissionLevelOf, type PermissionLevel } from './permissionLevels'
import { idKey, personIdSet } from './personIds'
import {
  parseTimesheetStatusFields,
  pickTimesheetRowForPeriod,
  timesheetListBucket,
  timesheetPaymentRunPeriodsFromWindow,
  timesheetStoredStartDayKey,
  type TimesheetStatusFields,
} from './timesheetPeriod'
import { isAnonymisedDeletedProfile, rosterPersonName, rosterSegment } from './userRosterSegment'

// MARK: - Copy

export const PAYRUN_SNAPSHOT_LABEL = 'Payrun Snapshot'
export const PAYRUN_SNAPSHOT_COLUMNS: ReadonlyArray<string> = ['Name', 'User level', 'Employment type', 'Timesheet', 'Overtime', 'Expenses', 'Price work']
export const PAYRUN_SNAPSHOT_PERIOD_LABELS = {
  paye: 'Current PAYE period',
  paymentRun: 'Current payment run period',
  custom: 'Custom range',
} as const
export const PAYRUN_SNAPSHOT_EMPLOYMENT_NOTE = 'Employment type is taken on the last day of the period.'
export const PAYRUN_SNAPSHOT_NO_PAYMENT_RUN_MESSAGE = 'Payment runs are not set up yet. Set them in Settings → Payment runs and timesheets.'
export const PAYRUN_SNAPSHOT_CUSTOM_INVALID_MESSAGE = 'Choose a start and end date.'
export const PAYRUN_SNAPSHOT_EMPTY_MESSAGE = 'Nobody to show for this period.'
export const PAYRUN_SNAPSHOT_LEVEL_LABELS: Readonly<Record<PermissionLevel, string>> = {
  admin: 'Admin',
  manager: 'Manager',
  operative: 'Operative',
}
export const PAYRUN_SNAPSHOT_SUPER_ADMIN_LABEL = 'Admin (Super Admin)'
export const PAYRUN_SNAPSHOT_EMPLOYMENT_LABELS = { paye: 'PAYE', selfEmployed: 'Self-employed' } as const
export const PAYRUN_SNAPSHOT_PAYE_CELL = 'PAYE'
export const PAYRUN_SNAPSHOT_SELF_EMPLOYED_CELL = 'Self Employed'
export const PAYRUN_SNAPSHOT_STATE_LABELS = {
  notStarted: 'Not started',
  submitted: 'Submitted',
  signed: 'Signed',
  returned: 'Returned',
  reportYes: 'Report generated: Yes',
  reportNo: 'Report generated: No',
  reportOutOfDate: 'Report generated: No (out of date)',
  noItems: 'No items',
} as const

// MARK: - Types

export type PayrunSnapshotPeriodKind = 'paye' | 'paymentRun' | 'custom'
export type PayrunSnapshotPeriod = { kind: PayrunSnapshotPeriodKind; start: string; end: string; label: string }

export type PayrunSnapshotTone = 'neutral' | 'good' | 'warn' | 'blocked'
export type PayrunSnapshotLinkKind = 'timesheet' | 'overtime' | 'expenses' | 'priceWork'
export type PayrunSnapshotLink = { kind: PayrunSnapshotLinkKind; personId: string; start: string; end: string }
export type PayrunSnapshotCellState =
  | 'notStarted'
  | 'submitted'
  | 'signed'
  | 'returned'
  | 'reportYes'
  | 'reportNo'
  | 'reportOutOfDate'
  | 'itemsNoReport'
  | 'noItems'
  | 'notApplicable'
export type PayrunSnapshotCell = {
  state: PayrunSnapshotCellState
  label: string
  tone: PayrunSnapshotTone
  link: PayrunSnapshotLink | null
}

/** A roster row (a users document, as `rulebookPerson` gives it): ids, name, status, level flags, employment, line managers. */
export type PayrunSnapshotPerson = LeaveSelfBookUser & {
  id: string
  email?: string | null
  firstName?: string | null
  surname?: string | null
  lastName?: string | null
  name?: string | null
  displayName?: string | null
  passwordSet?: boolean | null
  isActive?: boolean | null
  employmentType?: string | null
  employmentTypeTransitionFrom?: string | null
  employmentTypeEffectiveAt?: unknown
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
}

/** One self-employed timesheet document (`settings/timesheet_*`), as `parsePayrunSnapshotSheet` reads it. */
export type PayrunSnapshotSheet = { userId: string; startDayKey: string; endDayKey: string; status: TimesheetStatusFields }

/** The request fields the Snapshot reads (`parseOvertimeRequestDocument`). */
export type PayrunSnapshotOvertimeRequest = { userId: string; rangeStart: string; rangeEnd: string; status: string }
/** The report fields the Snapshot reads (`parseOvertimeReportDocument`, plus the 1.33.0 out-of-date mark). */
export type PayrunSnapshotOvertimeReport = {
  userId: string
  rangeStart: string
  rangeEnd: string
  outOfDate?: boolean | null
  outOfDateAtMs?: number | null
  /** The saved lines (`parseOvertimeReportDocument`): compared with the live lines when `bookings` are passed. */
  lines?: OvertimeReportSnapshot['lines'] | null
}
/** The claim report fields the Snapshot reads (`parsePayeClaimReportDocument`). */
export type PayrunSnapshotClaimReport = { userId: string; kind: PayeClaimKind; rangeStart: string; rangeEnd: string }

export type PayrunSnapshotInput = {
  roster: ReadonlyArray<PayrunSnapshotPerson> | null | undefined
  /** The organisation document (or its `invoicing` map): the payment run window for self-employed timesheets. */
  organization: unknown
  period: { start: string; end: string } | null | undefined
  sheets?: ReadonlyArray<PayrunSnapshotSheet> | null
  overtimeRequests?: ReadonlyArray<PayrunSnapshotOvertimeRequest> | null
  overtimeReports?: ReadonlyArray<PayrunSnapshotOvertimeReport> | null
  payeClaimReports?: ReadonlyArray<PayrunSnapshotClaimReport> | null
  priceWork?: ReadonlyArray<PriceWorkItem> | null
  expenses?: ReadonlyArray<ExpenseItem> | null
  timeZone?: string | null
  /**
   * 1.33.0 (owner 6 Nov, reopen): the live overtime inputs. A saved report is never rewritten, so whether it is out of
   * date is worked out from the live lines of its range (`overtimeReportOutOfDate` over `payeOvertimeLines`, the rule
   * the person's Overtime page uses). Pass every booking of the organisation (labour and manager site bookings,
   * `OvertimeBookingInput`), every overtime review and the operatives rows. Without `bookings` only a stored
   * `outOfDate` / `outOfDateAtMs` mark counts.
   */
  bookings?: ReadonlyArray<OvertimeBookingInput> | null
  overtimeReviews?: ReadonlyArray<OvertimeReviewRecord> | null
  operatives?: ReadonlyArray<{ id?: string | null; email?: string | null }> | null
}

export type PayrunSnapshotRow = {
  personId: string
  name: string
  level: PermissionLevel
  levelLabel: string
  employment: 'paye' | 'selfEmployed'
  employmentLabel: string
  /** Set when the employment type on the first day of the period differs ("Self-employed at the start of the period"). */
  employmentNote: string
  /** False for an inactive, pending or deleted person listed because of their records. */
  active: boolean
  cells: { timesheet: PayrunSnapshotCell; overtime: PayrunSnapshotCell; expenses: PayrunSnapshotCell; priceWork: PayrunSnapshotCell }
}

// MARK: - Helpers

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

function text(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function overlaps(range: { start: string; end: string }, start: string, end: string): boolean {
  if (!DAY_KEY.test(start)) return false
  const last = DAY_KEY.test(end) ? end : start
  return start <= range.end && last >= range.start
}

function rangeText(start: string, end: string): string {
  return `${formatPaymentRunDay(start)} – ${formatPaymentRunDay(end)}`
}

function invoicingOf(organization: unknown): Record<string, unknown> | null {
  const row = record(organization)
  if (!row) return null
  return record(row.invoicing) ?? ('paymentRunMode' in row || 'paymentRunDateRanges' in row ? row : null)
}

function cell(state: PayrunSnapshotCellState, label: string, tone: PayrunSnapshotTone, link: PayrunSnapshotLink | null): PayrunSnapshotCell {
  return { state, label, tone, link }
}

// MARK: - Periods

/**
 * The three choices of the period picker: the current PAYE payrun (null with `payeMessage` while no PAYE payday is
 * set), the current payment run (null with `paymentRunMessage` while the organisation has no invoicing settings), and
 * the custom range (built with `payrunSnapshotCustomPeriod`). `todayKey` is the organisation-zone day.
 */
export function payrunSnapshotPeriods(input: { organization: unknown; todayKey: string; timeZone?: string | null }): {
  paye: PayrunSnapshotPeriod | null
  payeMessage: string | null
  paymentRun: PayrunSnapshotPeriod | null
  paymentRunMessage: string | null
} {
  const zone = zoneOrLondon(input.timeZone)
  const run = payePayrunPeriod(input.organization, input.todayKey)
  const paye: PayrunSnapshotPeriod | null = run ? { kind: 'paye', start: run.start, end: run.end, label: payePayrunLabel(run) } : null
  let paymentRun: PayrunSnapshotPeriod | null = null
  const invoicing = invoicingOf(input.organization)
  if (invoicing && DAY_KEY.test(text(input.todayKey))) {
    // Midday of today in the organisation zone, so the run containing today is found whatever the zone offset.
    const midday = new Date(dateFromDayKeyInZone(input.todayKey, zone).getTime() + 12 * 3_600_000)
    const summary = activePaymentRunSummary(invoicing, midday, zone)
    if (!summary.notConfigured) paymentRun = { kind: 'paymentRun', start: summary.start, end: summary.end, label: `Payment run: ${summary.label}` }
  }
  return {
    paye,
    payeMessage: paye ? null : PAYE_PAYDAY_NOT_SET_MESSAGE,
    paymentRun,
    paymentRunMessage: paymentRun ? null : PAYRUN_SNAPSHOT_NO_PAYMENT_RUN_MESSAGE,
  }
}

/** A custom range (the two days in order), or null when either is not a day key. */
export function payrunSnapshotCustomPeriod(start: unknown, end: unknown): PayrunSnapshotPeriod | null {
  const range = payeCustomRange(start, end)
  return range ? { kind: 'custom', start: range.start, end: range.end, label: `Custom: ${rangeText(range.start, range.end)}` } : null
}

// MARK: - Inputs

/**
 * Reads one `organizations/{orgId}/settings/{id}` document as a Snapshot timesheet (null for anything that is not a
 * `timesheet_*` document with a readable start): its person (`userId`), its pay run (`weekStartKey` / `weekStart`,
 * `weekEndKey` / `weekEnd`, organisation zone) and its sign-off fields (`parseTimesheetStatusFields`).
 */
export function parsePayrunSnapshotSheet(docId: string, data: Record<string, unknown> | null | undefined, timeZone?: string | null): PayrunSnapshotSheet | null {
  if (!text(docId).startsWith('timesheet_')) return null
  const row = record(data) ?? {}
  const userId = text(row.userId)
  const startKey = text(row.weekStartKey)
  const startDayKey = DAY_KEY.test(startKey) ? startKey : timesheetStoredStartDayKey(row.weekStart, timeZone)
  if (!userId || !DAY_KEY.test(startDayKey)) return null
  const endKey = text(row.weekEndKey)
  const endDayKey = DAY_KEY.test(endKey) ? endKey : timesheetStoredStartDayKey(row.weekEnd, timeZone)
  return { userId, startDayKey, endDayKey: DAY_KEY.test(endDayKey) ? endDayKey : '', status: parseTimesheetStatusFields(row) }
}

// MARK: - Rows

const TIMESHEET_ORDER = { notStarted: 0, submitted: 1, signed: 2 } as const
type TimesheetState = keyof typeof TIMESHEET_ORDER

/** The payment runs of the organisation's current window that overlap the period, plus pay runs already on sheets. */
function payRunsInPeriod(
  organization: unknown,
  period: { start: string; end: string },
  sheets: ReadonlyArray<PayrunSnapshotSheet>,
  timeZone: string
): Array<{ startDayKey: string; endDayKey: string }> {
  const out: Array<{ startDayKey: string; endDayKey: string }> = []
  const seen = new Set<string>()
  const add = (startDayKey: string, endDayKey: string) => {
    const key = `${startDayKey}|${endDayKey}`
    if (seen.has(key) || !overlaps(period, startDayKey, endDayKey)) return
    seen.add(key)
    out.push({ startDayKey, endDayKey })
  }
  const invoicing = invoicingOf(organization)
  if (invoicing) {
    const settings = parseInvoicing(invoicing)
    const runs = timesheetPaymentRunPeriodsFromWindow({
      paymentRunMode: settings.paymentRunMode,
      ranges: settings.paymentRunDateRanges,
      recurringRunStartDay: settings.recurringRunStartDay,
      recurringRunEndDay: settings.recurringRunEndDay,
      referenceDayKey: period.end,
      lookbackCount: 120,
      timeZone,
    })
    for (const run of runs) {
      if (run.endDayKey < period.start) break
      add(run.startDayKey, run.endDayKey)
    }
  }
  for (const sheet of sheets) if (sheet.endDayKey) add(sheet.startDayKey, sheet.endDayKey)
  return out.sort((a, b) => a.startDayKey.localeCompare(b.startDayKey))
}

function timesheetCell(
  person: PayrunSnapshotPerson,
  ids: ReadonlySet<string>,
  roster: ReadonlyArray<PayrunSnapshotPerson>,
  sheets: ReadonlyArray<PayrunSnapshotSheet>,
  runs: ReadonlyArray<{ startDayKey: string; endDayKey: string }>,
  period: { start: string; end: string }
): PayrunSnapshotCell {
  const theirs = sheets.filter((sheet) => ids.has(idKey(sheet.userId)))
  const lineManager = hasActiveLineManager(person, roster as never)
  const states = runs.map((run) => {
    const index = pickTimesheetRowForPeriod(
      theirs.map((sheet) => ({ startDayKey: sheet.startDayKey, endDayKey: sheet.endDayKey || null })),
      run
    )
    const bucket = index < 0 ? 'unsigned' : timesheetListBucket(theirs[index].status, lineManager)
    const state: TimesheetState = bucket === 'signed' || bucket === 'exported' ? 'signed' : bucket === 'awaiting' ? 'submitted' : 'notStarted'
    return { run, state }
  })
  const link = (run?: { startDayKey: string; endDayKey: string }): PayrunSnapshotLink => ({
    kind: 'timesheet',
    personId: person.id,
    start: run?.startDayKey ?? period.start,
    end: run?.endDayKey ?? period.end,
  })
  if (states.length === 0) return cell('notStarted', PAYRUN_SNAPSHOT_STATE_LABELS.notStarted, 'neutral', link())
  const least = states.reduce((a, b) => (TIMESHEET_ORDER[b.state] < TIMESHEET_ORDER[a.state] ? b : a))
  const tone: PayrunSnapshotTone = least.state === 'signed' ? 'good' : least.state === 'submitted' ? 'warn' : 'neutral'
  const base = PAYRUN_SNAPSHOT_STATE_LABELS[least.state]
  const signed = states.filter((entry) => entry.state === 'signed').length
  const label = states.length > 1 ? `${base} · ${signed} of ${states.length} signed` : base
  return cell(least.state, label, tone, link(least.run))
}

/** A request the line manager has returned. 1.33.0 Return writes `approved` (the plan's name); `returned` is read the same. */
function requestReturned(status: string): boolean {
  const value = text(status).toLowerCase()
  return value === 'approved' || value === 'returned'
}

/** A request waiting for the line manager (`pending`, the plan's "Submitted"). Withdrawn requests are ignored. */
function requestWaiting(status: string): boolean {
  const value = text(status).toLowerCase()
  return value === 'pending' || value === 'submitted'
}

function overtimeCell(
  person: PayrunSnapshotPerson,
  ids: ReadonlySet<string>,
  roster: ReadonlyArray<PayrunSnapshotPerson>,
  requests: ReadonlyArray<PayrunSnapshotOvertimeRequest>,
  reports: ReadonlyArray<PayrunSnapshotOvertimeReport>,
  period: { start: string; end: string },
  reportOutOfDate: (report: PayrunSnapshotOvertimeReport) => boolean
): PayrunSnapshotCell {
  const link: PayrunSnapshotLink = { kind: 'overtime', personId: person.id, start: period.start, end: period.end }
  if (hasActiveLineManager(person, roster as never)) {
    const theirs = requests.filter((request) => ids.has(idKey(request.userId)) && overlaps(period, request.rangeStart, request.rangeEnd))
    if (theirs.some((request) => requestWaiting(request.status))) return cell('submitted', PAYRUN_SNAPSHOT_STATE_LABELS.submitted, 'warn', link)
    if (theirs.some((request) => requestReturned(request.status))) return cell('returned', PAYRUN_SNAPSHOT_STATE_LABELS.returned, 'good', link)
    return cell('notStarted', PAYRUN_SNAPSHOT_STATE_LABELS.notStarted, 'neutral', link)
  }
  const theirs = reports.filter((report) => ids.has(idKey(report.userId)) && overlaps(period, report.rangeStart, report.rangeEnd))
  if (theirs.some((report) => !reportOutOfDate(report))) return cell('reportYes', PAYRUN_SNAPSHOT_STATE_LABELS.reportYes, 'good', link)
  if (theirs.length > 0) return cell('reportOutOfDate', PAYRUN_SNAPSHOT_STATE_LABELS.reportOutOfDate, 'warn', link)
  return cell('reportNo', PAYRUN_SNAPSHOT_STATE_LABELS.reportNo, 'neutral', link)
}

/**
 * 1.33.0: whether a saved overtime report is out of date — a stored mark, or (when the caller passes `bookings`) its
 * live lines no longer match it (`overtimeReportOutOfDate`): a line reopened, changed or waiting again since it was
 * generated. Declined lines (0h, "Declined by {name}") and deleted lines count as finished, so a report that lists them
 * stays up to date while nothing changes.
 */
function overtimeSnapshotReportOutOfDate(
  report: PayrunSnapshotOvertimeReport,
  person: PayrunSnapshotPerson,
  roster: ReadonlyArray<PayrunSnapshotPerson>,
  input: PayrunSnapshotInput,
  timeZone: string
): boolean {
  if (overtimeReportIsOutOfDate(report)) return true
  if (!input.bookings) return false
  const personIds = overtimePersonIds({ person, roster: roster as never, operatives: input.operatives ?? [] })
  const lines = payeOvertimeLines({
    personIds,
    bookings: input.bookings,
    organization: input.organization as OvertimeOrganization,
    timeZone,
    range: { start: report.rangeStart, end: report.rangeEnd },
    reviews: input.overtimeReviews ?? [],
    requests: (input.overtimeRequests ?? []) as ReadonlyArray<OvertimeRequestRecord>,
  })
  return overtimeReportOutOfDate({ report: { lines: report.lines ?? [] }, lines })
}

function claimCell(
  kind: PayeClaimKind,
  person: PayrunSnapshotPerson,
  ids: ReadonlySet<string>,
  reports: ReadonlyArray<PayrunSnapshotClaimReport>,
  items: ReadonlyArray<PriceWorkItem | ExpenseItem>,
  period: { start: string; end: string }
): PayrunSnapshotCell {
  const link: PayrunSnapshotLink = { kind: kind === 'expense' ? 'expenses' : 'priceWork', personId: person.id, start: period.start, end: period.end }
  if (reports.some((report) => report.kind === kind && ids.has(idKey(report.userId)) && overlaps(period, report.rangeStart, report.rangeEnd))) {
    return cell('reportYes', PAYRUN_SNAPSHOT_STATE_LABELS.reportYes, 'good', link)
  }
  const count = payeClaimsInRange(
    items.filter((item) => item.kind === kind && ids.has(idKey(item.userId))),
    period
  ).length
  if (count === 0) return cell('noItems', PAYRUN_SNAPSHOT_STATE_LABELS.noItems, 'neutral', link)
  return cell('itemsNoReport', `${count} ${count === 1 ? 'item' : 'items'}, no report`, 'warn', link)
}

/** Whether a person has any record in the period (an inactive, pending or deleted person is listed only then). */
function hasRecords(ids: ReadonlySet<string>, input: PayrunSnapshotInput, period: { start: string; end: string }): boolean {
  const mine = (userId: string) => ids.has(idKey(userId))
  return (
    (input.sheets ?? []).some((sheet) => mine(sheet.userId) && overlaps(period, sheet.startDayKey, sheet.endDayKey)) ||
    (input.overtimeRequests ?? []).some((row) => mine(row.userId) && text(row.status).toLowerCase() !== 'withdrawn' && overlaps(period, row.rangeStart, row.rangeEnd)) ||
    (input.overtimeReports ?? []).some((row) => mine(row.userId) && overlaps(period, row.rangeStart, row.rangeEnd)) ||
    (input.payeClaimReports ?? []).some((row) => mine(row.userId) && overlaps(period, row.rangeStart, row.rangeEnd)) ||
    payeClaimsInRange([...(input.priceWork ?? []), ...(input.expenses ?? [])].filter((item) => mine(item.userId)), period).length > 0
  )
}

function rosterActive(person: PayrunSnapshotPerson): boolean {
  return !isAnonymisedDeletedProfile(person) && rosterSegment(person) === 'active'
}

/**
 * The Snapshot's rows for one period, sorted by name. See the file header for every column. Records are matched to a
 * person through every id they go by (`personIdSet` over the roster).
 */
export function payrunSnapshotRows(input: PayrunSnapshotInput): PayrunSnapshotRow[] {
  const period = input.period ? payeCustomRange(input.period.start, input.period.end) : null
  if (!period) return []
  const zone = zoneOrLondon(input.timeZone)
  const roster = (input.roster ?? []).filter((person) => person && text(person.id))
  // Active rows first, so a person with several documents is shown under their live one.
  const ordered = [...roster].sort((a, b) => Number(rosterActive(b)) - Number(rosterActive(a)))
  const used = new Set<string>()
  const sheets = input.sheets ?? []
  const out: PayrunSnapshotRow[] = []
  for (const person of ordered) {
    if (used.has(idKey(person.id))) continue
    const idList = personIdSet(person, roster as never)
    const ids = new Set(idList.map(idKey))
    // Same-person rows (aliases, same email) are this row.
    for (const member of roster) if (ids.has(idKey(member.id))) used.add(idKey(member.id))
    const active = roster.some((member) => ids.has(idKey(member.id)) && rosterActive(member))
    if (!active && !hasRecords(ids, input, period)) continue
    const paye = weeklyReportPayeDay(person as never, period.end, zone)
    const payeAtStart = weeklyReportPayeDay(person as never, period.start, zone)
    const level = permissionLevelOf(person)
    const levelLabel = level === 'admin' && isSuperAdminAccount(person) ? PAYRUN_SNAPSHOT_SUPER_ADMIN_LABEL : PAYRUN_SNAPSHOT_LEVEL_LABELS[level]
    const theirSheets = sheets.filter((sheet) => ids.has(idKey(sheet.userId)))
    const blocked = (label: string): PayrunSnapshotCell => cell('notApplicable', label, 'blocked', null)
    const cells = paye
      ? {
          timesheet: blocked(PAYRUN_SNAPSHOT_PAYE_CELL),
          overtime: overtimeCell(person, ids, roster, input.overtimeRequests ?? [], input.overtimeReports ?? [], period, (report) =>
            overtimeSnapshotReportOutOfDate(report, person, roster, input, zone)
          ),
          expenses: claimCell('expense', person, ids, input.payeClaimReports ?? [], input.expenses ?? [], period),
          priceWork: claimCell('priceWork', person, ids, input.payeClaimReports ?? [], input.priceWork ?? [], period),
        }
      : {
          timesheet: timesheetCell(person, ids, roster, theirSheets, payRunsInPeriod(input.organization, period, theirSheets, zone), period),
          overtime: blocked(PAYRUN_SNAPSHOT_SELF_EMPLOYED_CELL),
          expenses: blocked(PAYRUN_SNAPSHOT_SELF_EMPLOYED_CELL),
          priceWork: blocked(PAYRUN_SNAPSHOT_SELF_EMPLOYED_CELL),
        }
    out.push({
      personId: text(person.id),
      name: rosterPersonName(person) || text(person.email) || 'Unknown person',
      level,
      levelLabel,
      employment: paye ? 'paye' : 'selfEmployed',
      employmentLabel: paye ? PAYRUN_SNAPSHOT_EMPLOYMENT_LABELS.paye : PAYRUN_SNAPSHOT_EMPLOYMENT_LABELS.selfEmployed,
      employmentNote:
        paye === payeAtStart ? '' : `${payeAtStart ? PAYRUN_SNAPSHOT_EMPLOYMENT_LABELS.paye : PAYRUN_SNAPSHOT_EMPLOYMENT_LABELS.selfEmployed} at the start of the period`,
      active,
      cells,
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.personId.localeCompare(b.personId))
}
