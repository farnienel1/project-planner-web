/**
 * Pay cells on the weekly report and its exports. A PAYE person stays on the
 * report with every booking and hour, but their pay is never shown and never
 * added to a pay total: the cell reads PAYE instead of £0. Self-employed lines
 * show their pay and count toward the totals. Web and iOS both call these;
 * neither decides in a screen or export whether a pay figure is shown.
 *
 * Whether a person is PAYE on a day is `employmentTypeOnDay` (userProfile.ts).
 */

import { normalizeEmploymentType } from './userProfile'
import { canViewPersonPay } from './payProfile'
import { permissionLevelOf } from './permissionLevels'
import { dayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { documentInstantMs } from './peopleDocuments'
import { roundPennies } from './payRate'
import { normalizeDocumentId } from './scheduleSources'
import { parseTimesheetStatusFields } from './timesheetPeriod'
import { payrollLineReview, timesheetEntryDecision, timesheetEntryEffectiveAmount, timesheetTrustedFingerprint, type PayrollLineReview } from './timesheetEntryReviews'

/** Text in a PAYE person's pay cell, on screen and in every export. */
export const PAYE_PAY_CELL_LABEL = 'PAYE'

export type ReportPayLineInput = {
  /** True when `employmentTypeOnDay` is `paye` for the day(s) on this line. */
  isPaye?: boolean | null
  /** Stored employment type, used only when `isPaye` is not given. */
  employmentType?: string | null
  pay?: number | null
}

export type ReportPayCell = {
  /** The figure to show, or null when the cell shows `label` (or nothing). */
  pay: number | null
  /** `PAYE` for a PAYE line; null otherwise. */
  label: string | null
  countsTowardPayTotal: boolean
}


function lineIsPaye(line: ReportPayLineInput): boolean {
  if (line.isPaye === true) return true
  if (line.isPaye === false) return false
  if (line.employmentType == null || String(line.employmentType).trim() === '') return false
  return normalizeEmploymentType(line.employmentType) === 'paye'
}

/** One pay line. PAYE shows the label and no figure; a missing or non-finite pay shows nothing. */
export function reportPayCell(line: ReportPayLineInput): ReportPayCell {
  if (lineIsPaye(line)) return { pay: null, label: PAYE_PAY_CELL_LABEL, countsTowardPayTotal: false }
  const pay = typeof line.pay === 'number' && Number.isFinite(line.pay) ? roundPennies(line.pay) : null
  return { pay, label: null, countsTowardPayTotal: pay != null }
}

/** Sum of the lines that count toward pay, in pence-rounded pounds. PAYE lines add nothing. */
export function reportPayTotal(lines: ReadonlyArray<ReportPayLineInput>): number {
  let total = 0
  for (const line of lines) {
    const cell = reportPayCell(line)
    if (cell.countsTowardPayTotal && cell.pay != null) total += cell.pay
  }
  return roundPennies(total)
}

/**
 * A person's total row. When every line is PAYE the total reads PAYE too.
 * A person who changed type inside the period totals only the self-employed lines.
 */
export function reportPersonPayCell(lines: ReadonlyArray<ReportPayLineInput>): ReportPayCell {
  if (lines.length > 0 && lines.every(lineIsPaye)) {
    return { pay: null, label: PAYE_PAY_CELL_LABEL, countsTowardPayTotal: false }
  }
  return { pay: reportPayTotal(lines), label: null, countsTowardPayTotal: true }
}

export type InvoiceLineInput = ReportPayLineInput & {
  /** iOS payroll line name for a PAYE day. */
  isPayeDay?: boolean | null
  /** An annual-leave information line (`timesheetLeaveLines`). */
  isLeave?: boolean | null
  kind?: string | null
  /** The line's organisation-zone day key; with `timesheetDays` a line on another day is left out (1.11.0). */
  dayKey?: string | null
  /**
   * 1.46.0: the line's booking as it is now (`overtimeBookingFingerprint`), so an Edit hours review made against an
   * older version of the booking is stale (`payrollLineReview`). Missing = not checked.
   */
  bookingFingerprint?: string | null
}

/**
 * Whether a timesheet line goes on a generated invoice. A PAYE day (rate 0, `isPaye` / `isPayeDay`, or a PAYE
 * `employmentType`) and an annual-leave information line (`isLeave`, or `kind` `leave`) never do — on the live
 * invoice and on the signed-sheet (`weeklyReportOverride`) invoice alike. They stay on the timesheet itself.
 */
export function isInvoiceLine(line: InvoiceLineInput | null | undefined): boolean {
  if (!line) return false
  if (line.isPayeDay === true || lineIsPaye(line)) return false
  if (line.isLeave === true || String(line.kind || '').trim().toLowerCase() === 'leave') return false
  return true
}

/** The lines of a generated invoice, in input order (`isInvoiceLine`). */
export function invoiceLines<T extends InvoiceLineInput>(lines: ReadonlyArray<T> | null | undefined): T[] {
  return (lines || []).filter((line) => isInvoiceLine(line))
}

// MARK: - The rows of a generated timesheet invoice (1.10.0, H1)

const INVOICE_AMOUNT_EPSILON = 0.0001

export type TimesheetInvoiceRowKind = 'labour' | 'priceWork' | 'expense'

/** One invoice row: what is paid and where it came from. The app formats date, job and description. */
export type TimesheetInvoiceRow<L> = {
  kind: TimesheetInvoiceRowKind
  /** The line or entry id as stored. */
  id: string
  amount: number
  /** `override`: the signed snapshot (`weeklyReportOverride`); `live`: the live payroll lines and entries. */
  source: 'override' | 'live'
  /** The live payroll line (labour rows; on an override row when the live line still exists). */
  line: L | null
  /** The stored override row (override rows) or price work / expense entry (live rows). */
  stored: Record<string, unknown> | null
  /**
   * 1.30.1: the row's stored job number, trimmed ('' when none): the override row's, else the live line's for labour;
   * the entry's for price work and expenses. A price work row with none (stored before 1.30.1) is shown as "—"
   * (`priceWorkJobNumberText`); never rewritten.
   */
  jobNumber: string
  /**
   * 1.46.0: the line manager's review applied to a live labour row (`payrollLineReview` against the live line's
   * `bookingFingerprint`), so totals can split an edited row into its standard and overtime parts. Null otherwise.
   */
  review?: PayrollLineReview | null
}

export type TimesheetInvoiceRowsInput<L extends InvoiceLineInput & { id: string; amount: number }> = {
  /** The stored timesheet document (`weeklyReportOverride`, `payrollLineReviews`, `extraEntryReviews`,
   *  `priceWorkEntries`, `expenseEntries`, `managerSignedAt`). */
  sheet: Record<string, unknown> | null | undefined
  /** The live payroll lines the app built for the period (`id`, `amount`, PAYE / leave flags). */
  payrollLines: ReadonlyArray<L> | null | undefined
  /**
   * `decided` (an export, or after the line manager signed): price work and expenses carry their decision
   * (`timesheetEntryDecision`, declined left out) and labour lines their review (`payrollLineReview`) once the line
   * manager has signed. `raw` (the owner's draft invoice before review): every entry at its own amount.
   */
  extrasMode: 'raw' | 'decided'
  /**
   * The days that count on this person's sheet (`timesheetDaysForPerson`, 1.11.0). When given, a labour line whose
   * `dayKey` is not one of them, and a price work or expense entry dated (`date` / `startDate`, organisation zone)
   * on another day, are left out — a PAYE day never produces an invoice row. An empty list leaves no rows.
   */
  timesheetDays?: ReadonlyArray<string> | null
  /** The organisation zone for entry dates (with `timesheetDays`). */
  timeZone?: string | null
  /**
   * 1.22.0: whether the line manager's labour reviews (`payrollLineReview`) apply to live lines in `decided` mode.
   * Missing or null = once the line manager has signed (the invoice). `true` while the line manager is reviewing
   * before they sign, so their on-screen total is the invoice their signature will produce (`timesheetTotals`).
   */
  applyLabourReviews?: boolean | null
  /**
   * 1.45.0 (review #322): when `sheet` is the app's loaded copy rather than the stored document, the fingerprints the
   * reader computed for it (`timesheetEntryFingerprintMap` of `parseTimesheetEntries` entries). Without it each entry
   * row is fingerprinted as stored. A `reviewFingerprint` on a row is never read.
   */
  entryFingerprints?: Record<string, string> | null
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object') : []
}

function jobNumberOf(...values: unknown[]): string {
  for (const value of values) {
    const job = typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value.trim() : ''
    if (job) return job
  }
  return ''
}

function amountOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * The rows of a generated invoice for one timesheet, on every platform (rulebook §8):
 *   1. A signed sheet's snapshot (`weeklyReportOverride` `{ lines, priceWork, expenses }`) wins: its rows at their
 *      signed amounts, declined rows and rows of 0 left out, and a labour row whose live line is a PAYE day or a
 *      leave line (`isInvoiceLine`) left out.
 *   2. Otherwise the live lines: labour `invoiceLines(payrollLines)` (PAYE days and leave never), with the line
 *      manager's review once they have signed (`payrollLineReview`: declined left out, edited at the revised amount)
 *      in `decided` mode; then price work and expenses — in `decided` mode by `timesheetEntryDecision` (declined left
 *      out, edited at the revised amount), in `raw` mode at their own amounts.
 * 1.11.0: with `timesheetDays`, rows on a day the person was PAYE are left out (the PAYE-extras path is removed;
 * owner decisions round 3). Ids compare without case.
 */
export function timesheetInvoiceRows<L extends InvoiceLineInput & { id: string; amount: number }>(
  input: TimesheetInvoiceRowsInput<L>
): TimesheetInvoiceRow<L>[] {
  const sheet = input.sheet && typeof input.sheet === 'object' ? input.sheet : {}
  const lines = input.payrollLines || []
  const liveById = new Map(lines.map((line) => [normalizeDocumentId(line.id), line]))
  const override = (sheet as Record<string, unknown>).weeklyReportOverride
  const rows: TimesheetInvoiceRow<L>[] = []
  const days = input.timesheetDays ? new Set(input.timesheetDays.map((day) => String(day).trim())) : null
  const zone = zoneOrLondon(input.timeZone)
  if (days && days.size === 0) return rows
  const onCountedDay = (dayKey: string | null | undefined): boolean => !days || !dayKey || days.has(dayKey)
  const entryDay = (entry: Record<string, unknown>): string | null => {
    const ms = documentInstantMs(entry.date) ?? documentInstantMs(entry.startDate)
    return ms == null ? null : dayKeyInZone(new Date(ms), zone)
  }

  if (override && typeof override === 'object') {
    const snapshot = override as Record<string, unknown>
    for (const row of rowsOf(snapshot.lines)) {
      // 1.46.0: an edited snapshot row stored before 1.46.0 may hold an unrounded revised amount; it counts in pennies
      // (rounding only — a signed line is never re-priced).
      const stored = amountOf(row.amount)
      const amount = row.decision === 'edited' ? roundPennies(stored) : stored
      if (row.decision === 'declined' || amount <= INVOICE_AMOUNT_EPSILON) continue
      const id = String(row.id ?? '').trim()
      const live = liveById.get(normalizeDocumentId(id)) ?? null
      if (live && !isInvoiceLine(live)) continue
      if (!onCountedDay(live?.dayKey ?? null)) continue
      rows.push({ kind: 'labour', id, amount, source: 'override', line: live, stored: row, jobNumber: jobNumberOf(live && (live as unknown as Record<string, unknown>).jobNumber, row.jobNumber) })
    }
    for (const [kind, key] of [['priceWork', 'priceWork'], ['expense', 'expenses']] as const) {
      for (const row of rowsOf(snapshot[key])) {
        const amount = amountOf(row.amount)
        if (row.decision === 'declined' || amount <= INVOICE_AMOUNT_EPSILON) continue
        if (!onCountedDay(entryDay(row))) continue
        rows.push({ kind, id: String(row.id ?? '').trim(), amount, source: 'override', line: null, stored: row, jobNumber: jobNumberOf(row.jobNumber) })
      }
    }
    return rows
  }

  const decided = input.extrasMode === 'decided'
  const managerSigned = parseTimesheetStatusFields(sheet).managerSignedAtMs != null
  const labourReviews = input.applyLabourReviews == null ? managerSigned : input.applyLabourReviews === true
  for (const line of invoiceLines(lines)) {
    if (!onCountedDay(line.dayKey)) continue
    let amount = line.amount
    let applied: PayrollLineReview | null = null
    if (decided && labourReviews) {
      // 1.46.0: a review made against a booking that has changed since is stale (null): the line at its live amount.
      const review = payrollLineReview(sheet, line.id, line)
      if (review?.decision === 'declined') continue
      // 1.46.0: the revised amount in pennies (`roundPennies`), so the invoice rows add up to the invoice total.
      if (review?.decision === 'edited' && review.revisedAmount != null) {
        amount = roundPennies(review.revisedAmount)
        applied = review
      }
    }
    rows.push({ kind: 'labour', id: line.id, amount, source: 'live', line, stored: null, jobNumber: jobNumberOf((line as unknown as Record<string, unknown>).jobNumber), review: applied })
  }
  for (const [kind, key] of [['priceWork', 'priceWorkEntries'], ['expense', 'expenseEntries']] as const) {
    for (const entry of rowsOf((sheet as Record<string, unknown>)[key])) {
      if (!onCountedDay(entryDay(entry))) continue
      const own = amountOf(entry.amount)
      let amount = own
      if (decided) {
        const decision = timesheetEntryDecision(sheet, entry, kind, timesheetTrustedFingerprint(input.entryFingerprints, entry.id))
        if (decision.decision === 'declined') continue
        amount = timesheetEntryEffectiveAmount(decision.decision, decision.revisedAmount, own)
      }
      rows.push({ kind, id: String(entry.id ?? '').trim(), amount, source: 'live', line: null, stored: entry, jobNumber: jobNumberOf(entry.jobNumber) })
    }
  }
  return rows
}

// MARK: - 1.32.0: pay on the weekly report follows `canViewPersonPay` (owner decisions 5 Nov, §7, §8)

/** The rate and pay cells of a person whose pay the viewer may not see (hours stay). */
export const PAY_HIDDEN_CELL_LABEL = '—'
/** The note under the pay summary when some people's pay is hidden; the grand total covers the people shown. */
export const PAY_HIDDEN_NOTE = 'Rates and pay are shown only for people whose pay you may see; the grand total covers those people only.'

type ReportPayPersonRow = {
  lines: ReadonlyArray<{ rate: number; pay: number; rateText?: string; payLabel?: string | null; isPaye?: boolean }>
  personTotal: number
  personTotalLabel?: string | null
  paySubject?: Record<string, unknown> | null
}

/**
 * The weekly report pay summary for one viewer (rulebook §7, §8, 1.32.0): each person's rate and pay are shown only when
 * `canViewPersonPay(viewer, person, roster)` (default context — the weekly report is not a timesheet review): admins
 * every person; a manager with the Operatives toggle operatives; everyone the person themself. Anyone else sees the
 * hours with the rate and pay cells `PAY_HIDDEN_CELL_LABEL`. The grand total is `reportPayTotal` over the visible rows
 * only, so a hidden figure never leaks through a total; `hiddenPeople` counts the rows hidden (show `PAY_HIDDEN_NOTE`).
 * A row with no known person (`paySubject` missing) is visible to admins only.
 */
export function reportPayForViewer<T extends ReportPayPersonRow>(
  rows: ReadonlyArray<T>,
  input: { viewer: Record<string, unknown> | null | undefined; roster?: ReadonlyArray<Record<string, unknown>> | null }
): { rows: T[]; grandTotal: number; hiddenPeople: number } {
  const viewer = input.viewer ?? null
  const viewerIsAdmin = Boolean(viewer) && viewer?.isActive !== false && (viewer?.isPlatformOwner === true || permissionLevelOf(viewer) === 'admin')
  const canView = (subject: Record<string, unknown>) => canViewPersonPay(viewer as never, subject as never, (input.roster || []) as never)
  let hiddenPeople = 0
  const out: T[] = []
  const visibleLines: ReportPayLineInput[] = []
  for (const row of rows || []) {
    const visible = row.paySubject ? viewerIsAdmin || canView(row.paySubject) : viewerIsAdmin
    if (visible) {
      out.push(row)
      for (const line of row.lines) visibleLines.push({ isPaye: line.isPaye === true, pay: line.pay })
      continue
    }
    hiddenPeople += 1
    out.push({
      ...row,
      lines: row.lines.map((line) => ({ ...line, rate: 0, pay: 0, rateText: PAY_HIDDEN_CELL_LABEL, payLabel: PAY_HIDDEN_CELL_LABEL })),
      personTotal: 0,
      personTotalLabel: PAY_HIDDEN_CELL_LABEL,
    })
  }
  return { rows: out, grandTotal: reportPayTotal(visibleLines), hiddenPeople }
}
