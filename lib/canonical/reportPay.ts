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
import { dayKeyInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { documentInstantMs } from './peopleDocuments'
import { roundPennies } from './payRate'
import { normalizeDocumentId } from './scheduleSources'
import { parseTimesheetStatusFields } from './timesheetPeriod'
import { payrollLineReview, timesheetEntryDecision, timesheetEntryEffectiveAmount } from './timesheetEntryReviews'

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
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object') : []
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
      const amount = amountOf(row.amount)
      if (row.decision === 'declined' || amount <= INVOICE_AMOUNT_EPSILON) continue
      const id = String(row.id ?? '').trim()
      const live = liveById.get(normalizeDocumentId(id)) ?? null
      if (live && !isInvoiceLine(live)) continue
      if (!onCountedDay(live?.dayKey ?? null)) continue
      rows.push({ kind: 'labour', id, amount, source: 'override', line: live, stored: row })
    }
    for (const [kind, key] of [['priceWork', 'priceWork'], ['expense', 'expenses']] as const) {
      for (const row of rowsOf(snapshot[key])) {
        const amount = amountOf(row.amount)
        if (row.decision === 'declined' || amount <= INVOICE_AMOUNT_EPSILON) continue
        if (!onCountedDay(entryDay(row))) continue
        rows.push({ kind, id: String(row.id ?? '').trim(), amount, source: 'override', line: null, stored: row })
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
    if (decided && labourReviews) {
      const review = payrollLineReview(sheet, line.id)
      if (review?.decision === 'declined') continue
      if (review?.decision === 'edited' && review.revisedAmount != null) amount = review.revisedAmount
    }
    rows.push({ kind: 'labour', id: line.id, amount, source: 'live', line, stored: null })
  }
  for (const [kind, key] of [['priceWork', 'priceWorkEntries'], ['expense', 'expenseEntries']] as const) {
    for (const entry of rowsOf((sheet as Record<string, unknown>)[key])) {
      if (!onCountedDay(entryDay(entry))) continue
      const own = amountOf(entry.amount)
      let amount = own
      if (decided) {
        const decision = timesheetEntryDecision(sheet, entry)
        if (decision.decision === 'declined') continue
        amount = timesheetEntryEffectiveAmount(decision.decision, decision.revisedAmount, own)
      }
      rows.push({ kind, id: String(entry.id ?? '').trim(), amount, source: 'live', line: null, stored: entry })
    }
  }
  return rows
}
