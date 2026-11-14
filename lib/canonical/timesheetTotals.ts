/**
 * Rulebook 1.22.0 (§8, audit finding 6): the totals of one timesheet — hours, the standard / overtime split, labour
 * pay, price work, expenses and the total — on every list row, detail screen and sign sheet, on web and iOS.
 *
 * The money is the sum of the invoice rows (`timesheetInvoiceRows`), so a summary total equals the invoice total by
 * construction: a signed sheet's `weeklyReportOverride` wins; otherwise live labour lines (PAYE days and leave never)
 * with the line manager's review, and price work and expenses by `timesheetEntryDecision` in `decided` mode —
 * declined counts 0, an edited entry counts its revised amount, a stale review is pending and counts its own amount.
 * Before 1.22.0 list rows summed every entry at its own amount (a declined expense still counted) and each app
 * re-implemented the entry decision on its detail screen.
 *
 * Plain inputs only (the stored sheet, the payroll lines as plain rows), so iOS calls it through JavaScriptCore.
 */

import { roundPennies } from './payRate'
import { normalizeDocumentId } from './scheduleSources'
import { timesheetEntryDecision, timesheetTrustedFingerprint } from './timesheetEntryReviews'
import { timesheetInvoiceRows, type InvoiceLineInput, type TimesheetInvoiceRowsInput } from './reportPay'

/** One payroll line as each app's collector builds it (web `TimesheetPayrollLineItem`, iOS `TimesheetPayrollLine`). */
export type TimesheetTotalsLine = InvoiceLineInput & {
  id: string
  amount: number
  /** Standard hours (a standard line) or the hours outside the standard window (an overtime line). */
  paidHours?: number | null
  isOvertimeLine?: boolean | null
  otMultiplier?: number | null
  /** Overtime clock hours when an unpaid break came off them (`payrollMultipliedHours`); else `paidHours`. */
  otClockHours?: number | null
  /**
   * On the standard line of a booking: that booking's weighted paid hours (`payrollHoursResult.totalPaidHours`) and its
   * overtime clock hours. When missing, the weighted hours are `paidHours` (× `otMultiplier` on an overtime line).
   */
  bookingPaidHours?: number | null
  bookingOvertimeHours?: number | null
  /** 1.46.0: the booking the line comes from (web `op-{id}` / `mgr-{id}`); groups a booking's lines. */
  bookingId?: string | null
}

export type TimesheetTotalsInput<L extends TimesheetTotalsLine = TimesheetTotalsLine> = TimesheetInvoiceRowsInput<L>

export type TimesheetTotals = {
  /** Weighted paid hours (overtime at its multiplier), the figure the timesheet list shows as Hours. */
  hours: number
  /** Hours inside the standard window. */
  standardHours: number
  /** Overtime clock hours. */
  overtimeHours: number
  /** Labour pay: the invoice's labour rows. */
  labour: number
  standardLabour: number
  overtimeLabour: number
  priceWork: number
  expenses: number
  /** `priceWork + expenses`. */
  extras: number
  /** `labour + extras` — the invoice total for the same inputs. */
  total: number
  /** Price work, expenses and extras at the amounts the person entered, before any review. */
  submittedPriceWork: number
  submittedExpenses: number
  submittedExtras: number
  /** Price work and expense entries whose decision is `pending` (a stale review). */
  pendingEntries: number
  /** `override` when a signed snapshot (`weeklyReportOverride`) produced the money; else `live`. */
  source: 'override' | 'live'
  /** Number of invoice rows (labour, price work and expense) behind the money. */
  invoiceRowCount: number
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object') : []
}

function isLeaveLine(line: TimesheetTotalsLine): boolean {
  return line.isLeave === true || String(line.kind || '').trim().toLowerCase() === 'leave'
}

/**
 * The totals of one timesheet (§8). Takes exactly the input of `timesheetInvoiceRows` — `sheet`, `payrollLines`,
 * `extrasMode` (`decided`: an export, a signed sheet, a reviewer's screen, every list row; `raw`: the owner's draft
 * before review), `timesheetDays`, `timeZone`, `applyLabourReviews` — and sums its rows, so `total` is the invoice
 * total for the same inputs. Hours come from the live payroll lines (leave lines and lines on days outside
 * `timesheetDays` left out); a PAYE day has no line (`timesheetDaysForPerson`). Money is rounded to pennies.
 */
export function timesheetTotals<L extends TimesheetTotalsLine>(input: TimesheetTotalsInput<L>): TimesheetTotals {
  const sheet = (input.sheet && typeof input.sheet === 'object' ? input.sheet : {}) as Record<string, unknown>
  const rows = timesheetInvoiceRows(input)
  let labour = 0
  let standardLabour = 0
  let overtimeLabour = 0
  let priceWork = 0
  let expenses = 0
  for (const row of rows) {
    if (row.kind === 'labour') {
      labour += row.amount
      // 1.46.0: an Edit hours review splits its money into the standard and overtime parts it pays.
      const split = row.review && row.review.revisedStandardAmount != null && row.review.revisedStandardHours != null
      if (split) {
        const standardPart = roundPennies(Math.min(row.amount, Number(row.review?.revisedStandardAmount) || 0))
        standardLabour += standardPart
        overtimeLabour += row.amount - standardPart
        continue
      }
      const overtime = row.source === 'override' ? row.stored?.isOvertime === true : row.line?.isOvertimeLine === true
      if (overtime) overtimeLabour += row.amount
      else standardLabour += row.amount
    } else if (row.kind === 'priceWork') {
      priceWork += row.amount
    } else {
      expenses += row.amount
    }
  }

  const days = input.timesheetDays ? new Set(input.timesheetDays.map((day) => String(day).trim())) : null
  let hours = 0
  let standardHours = 0
  let overtimeHours = 0
  const byBookingStandard = new Set<string>()
  for (const line of input.payrollLines || []) {
    if (!line || isLeaveLine(line)) continue
    if (days && (days.size === 0 || (line.dayKey && !days.has(line.dayKey)))) continue
    if (line.isOvertimeLine !== true && line.bookingPaidHours != null) {
      byBookingStandard.add(normalizeDocumentId(line.id))
    }
  }
  const withBookingFigures = byBookingStandard.size > 0
  // 1.46.0: a booking with an Edit hours review counts the hours that review pays (its standard and overtime hours),
  // line by line, so the hours always match the money; its other lines count their live hours.
  const reviewedLines = new Map<string, NonNullable<(typeof rows)[number]['review']>>()
  for (const row of rows) {
    if (row.kind === 'labour' && row.source === 'live' && row.review && row.review.revisedStandardHours != null && row.review.revisedOvertimeHours != null) {
      reviewedLines.set(normalizeDocumentId(row.id), row.review)
    }
  }
  const groupOf = (line: TimesheetTotalsLine) =>
    normalizeDocumentId(line.bookingId ? String(line.bookingId) : String(line.id).replace(/-(?:normal|ot)$/i, ''))
  const reviewedGroups = new Set<string>()
  for (const line of input.payrollLines || []) {
    if (line && reviewedLines.has(normalizeDocumentId(line.id))) reviewedGroups.add(groupOf(line))
  }
  for (const line of input.payrollLines || []) {
    if (!line || isLeaveLine(line)) continue
    if (days && (days.size === 0 || (line.dayKey && !days.has(line.dayKey)))) continue
    const paid = finite(line.paidHours)
    if (reviewedGroups.size > 0 && reviewedGroups.has(groupOf(line))) {
      const review = reviewedLines.get(normalizeDocumentId(line.id))
      if (review) {
        const overtimeBase = finite(review.revisedOvertimeHours)
        const multiplier = finite(review.revisedOvertimeMultiplier) > 0 ? finite(review.revisedOvertimeMultiplier) : 1
        standardHours += finite(review.revisedStandardHours)
        overtimeHours += review.revisedOvertimeClockHours != null ? finite(review.revisedOvertimeClockHours) : overtimeBase
        hours += finite(review.revisedStandardHours) + overtimeBase * multiplier
      } else if (line.isOvertimeLine === true) {
        overtimeHours += line.otClockHours != null ? finite(line.otClockHours) : paid
        hours += paid * (finite(line.otMultiplier) > 0 ? finite(line.otMultiplier) : 1)
      } else {
        standardHours += paid
        hours += paid
      }
      continue
    }
    if (line.isOvertimeLine === true) {
      if (!withBookingFigures) {
        overtimeHours += line.otClockHours != null ? finite(line.otClockHours) : paid
        const multiplier = finite(line.otMultiplier) > 0 ? finite(line.otMultiplier) : 1
        hours += paid * multiplier
      }
      continue
    }
    standardHours += paid
    if (withBookingFigures) {
      hours += line.bookingPaidHours != null ? finite(line.bookingPaidHours) : paid
      overtimeHours += finite(line.bookingOvertimeHours)
    } else {
      hours += paid
    }
  }

  let submittedPriceWork = 0
  let submittedExpenses = 0
  let pendingEntries = 0
  for (const [key, add] of [
    ['priceWorkEntries', (amount: number) => (submittedPriceWork += amount)],
    ['expenseEntries', (amount: number) => (submittedExpenses += amount)],
  ] as const) {
    for (const entry of rowsOf(sheet[key])) {
      add(finite(entry.amount))
      const trusted = timesheetTrustedFingerprint(input.entryFingerprints, entry.id)
      if (timesheetEntryDecision(sheet, entry, key === 'priceWorkEntries' ? 'priceWork' : 'expense', trusted).decision === 'pending') pendingEntries += 1
    }
  }

  const round = (value: number) => roundPennies(value)
  const roundHours = (value: number) => Math.round(value * 100) / 100
  return {
    hours: roundHours(hours),
    standardHours: roundHours(standardHours),
    overtimeHours: roundHours(overtimeHours),
    labour: round(labour),
    standardLabour: round(standardLabour),
    overtimeLabour: round(overtimeLabour),
    priceWork: round(priceWork),
    expenses: round(expenses),
    extras: round(priceWork + expenses),
    total: round(labour + priceWork + expenses),
    submittedPriceWork: round(submittedPriceWork),
    submittedExpenses: round(submittedExpenses),
    submittedExtras: round(submittedPriceWork + submittedExpenses),
    pendingEntries,
    source: rows.some((row) => row.source === 'override') || hasOverride(sheet) ? 'override' : 'live',
    invoiceRowCount: rows.length,
  }
}

function hasOverride(sheet: Record<string, unknown>): boolean {
  const override = sheet.weeklyReportOverride
  return Boolean(override) && typeof override === 'object'
}
