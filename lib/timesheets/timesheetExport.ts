/**
 * iOS parity: InvoicingView.TimesheetExportHelper / ResendEmailService.sendTimesheetExportEmail.
 */
import { timesheetSheetFields } from '@/lib/timesheets/timesheetAdjustments'
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import type { TimesheetPayrollSummary } from '@/lib/timesheets/timesheetPayrollCollector'
import { timesheetLabourDetails } from '@/lib/timesheets/timesheetPayrollCollector'
import { formatTimesheetHours } from '@/lib/timesheets/timesheetHours'
import { isClockSpanLabel, orgDayHours, payLineDisplay, roundPennies } from '@/lib/timesheets/payBasis'
import { signedLabourSlice } from '@/lib/weekly-report/weeklyReportPayroll'
import { formatAbbreviatedDayInZone, formatStampInZone } from '@/lib/orgTime/zoneTime'
import { londonDateParts, dayKey } from '@/lib/ios-parity/londonTime'
import type { Operative, User } from '@/types'
import { personRateHistoryIds } from '@/lib/pay/personRateHistoryIds'
import type { OperativeDayRateHistoryCollection, OperativeDayRateHistoryEntry } from '@/lib/timesheets/dayRateHistoryStorage'
import { formatMoney } from '@/lib/canonical/money'
import { parseMultipliedHoursText, timesheetLineClockText } from '@/lib/canonical/payrollHours'
import { timesheetInvoiceRows } from '@/lib/canonical/reportPay'
import { timesheetEntryFingerprintMap } from '@/lib/canonical/timesheetEntryReviews'
import { priceWorkJobNumberText } from '@/lib/canonical/priceWorkJobNumber'
import { emailDocument, emailHeading, emailLink, emailList, emailStrong, emailText } from '@/lib/email/emailTheme'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

export function paymentRunDateStamp(start: Date, end: Date, timeZone: string): string {
  const format = (date: Date) => {
    const parts = londonDateParts(date, timeZone)
    return `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}.${String(parts.year).slice(-2)}`
  }
  return `${format(start)} ${format(end)}`
}

export function timesheetExportFileName(userName: string, paymentRunStamp: string): string {
  return `${userName} timesheet for payment run date ${paymentRunStamp}.pdf`
}

export function signatureNotes(draft: TimesheetDraft, timeZone: string = organizationZoneOr()): string[] {
  const notes: string[] = []
  if (draft.operativeSignedByName && draft.operativeSignedAt) {
    notes.push(
      `Operative signed by ${draft.operativeSignedByName} on ${formatStampInZone(draft.operativeSignedAt, timeZone)}.`
    )
  }
  if (draft.managerSignedByName && draft.managerSignedAt) {
    notes.push(
      `Line manager counter-signed by ${draft.managerSignedByName} on ${formatStampInZone(draft.managerSignedAt, timeZone)}.`
    )
  }
  return notes
}

/** iOS InvoicePDFGenerationSupport.rateChangeNotes */
export function invoiceRateChangeNotes({
  history,
  user,
  operatives,
  periodStart,
  periodEnd,
  timeZone,
  currencyCode,
}: {
  history: OperativeDayRateHistoryCollection
  user: User
  operatives: Operative[]
  periodStart: Date
  periodEnd: Date
  timeZone: string
  /** Organisation currency (`formatMoney`). */
  currencyCode?: string
}): string[] {
  const startKey = dayKey(periodStart, timeZone)
  const endKey = dayKey(periodEnd, timeZone)
  const inPeriod = (effectiveAt: Date) => {
    const key = dayKey(effectiveAt, timeZone)
    return key >= startKey && key <= endKey
  }
  const notes = new Set<string>()
  // 1.36.0 (FU-5): every id the person's rate history may be filed under (`personRateHistoryIds`: `personIdSet`
  // and every `operatives` row on their email), compared without case — not only `user.id` and one catalogue row.
  const ids = personRateHistoryIds(user, operatives)
  const userKeys = new Set(ids.userIds.map((id) => id.toLowerCase()))
  const operativeKeys = new Set(ids.operativeIds.map((id) => id.toLowerCase()))
  // Each list notes a row once; a row stored with both ids is noted in both lists, as before.
  const entriesUnder = (byId: Record<string, OperativeDayRateHistoryEntry[]>, keys: Set<string>) => {
    const seen = new Set<string>()
    return Object.entries(byId)
      .filter(([key]) => keys.has(key.trim().toLowerCase()))
      .flatMap(([, entries]) => entries)
      .filter((entry) => inPeriod(entry.effectiveAt) && !seen.has(entry.id) && Boolean(seen.add(entry.id)))
  }
  for (const entry of entriesUnder(history.byUserId, userKeys)) {
    notes.add(
      entry.dayRate == null
        ? `Rate cleared from ${formatAbbreviatedDayInZone(entry.effectiveAt, timeZone)}.`
        : `Rate updated to ${formatMoney(entry.dayRate, currencyCode)}${entry.payBasis === 'hourly' ? '/hr' : '/day'} from ${formatAbbreviatedDayInZone(entry.effectiveAt, timeZone)}.`
    )
  }
  for (const entry of entriesUnder(history.byOperativeId, operativeKeys)) {
    notes.add(
      entry.dayRate == null
        ? `Operative rate cleared from ${formatAbbreviatedDayInZone(entry.effectiveAt, timeZone)}.`
        : `Operative rate updated to ${formatMoney(entry.dayRate, currencyCode)}${entry.payBasis === 'hourly' ? '/hr' : '/day'} from ${formatAbbreviatedDayInZone(entry.effectiveAt, timeZone)}.`
    )
  }
  return [...notes].sort((a, b) => a.localeCompare(b))
}

export type TimesheetInvoiceLine = {
  date: string
  jobNumber: string
  projectName: string
  details: string
  description: string
  amount: number
  /** Rulebook 1.45.0: the `timesheetInvoiceRows` row this line came from (kind and stored id), for the evidence pages. */
  kind?: 'labour' | 'priceWork' | 'expense'
  entryId?: string
}

function signedOverrideDetails(
  line: {
    paidHours: number
    days: number
    amount: number
    isOvertime: boolean
    payBasis?: string | null
    details?: string
  },
  standardDayHours: number,
  currencyCode?: string
): string {
  const standard = orgDayHours(standardDayHours)
  // 1.20.3: a signed overtime line with a break shows "6.5h × 2 − 0.5h break = 12.5h" as a live line does
  // (`parseMultipliedHoursText` on its stored text); other signed lines are shown as before.
  const parsed = line.isOvertime ? parseMultipliedHoursText(line.details) : null
  const slice = signedLabourSlice(line, standard, parsed?.multiplier ?? 1)
  const withBreak = Number(slice.breakHours) > 0
  const equation = payLineDisplay({
    payBasis: slice.payBasis,
    paidHours: slice.paidHours,
    // 1.44.0 §8: the signed line's own paid day (stored days), never today's.
    standardDayHours: slice.standardDayHours ?? standard,
    rate: slice.rate,
    pay: slice.pay,
    currencyCode,
    ...(withBreak
      ? { isOvertime: true, otMultiplier: slice.otMultiplier, clockHours: slice.clockHours ?? null, breakHours: slice.breakHours ?? null }
      : {}),
  }).equation
  // 1.43.0: the clock part only (`timesheetLineClockText`); the multiplied text is in the equation.
  const clockPart = timesheetLineClockText(line.details)
  const clock = clockPart && isClockSpanLabel(clockPart) ? `${clockPart} · ` : ''
  return `${clock}${equation}`
}

export function invoiceLinesForTimesheet({
  payroll,
  draft,
  timeZone,
  extrasMode,
  standardDayHours,
  standardDayHoursOn,
  currencyCode,
  timesheetDays,
}: {
  payroll: TimesheetPayrollSummary
  draft: TimesheetDraft
  timeZone: string
  extrasMode: 'raw' | 'export'
  /** 1.44.0: the organisation's paid day (`weekdayPaidHours`); required, no 8-hour default. */
  standardDayHours: number
  /**
   * Rulebook 1.19.0: the standard paid day in effect on a line's own day (`effectivePayrollTimePolicy`), for the day
   * units shown on a signed line. Display only — a signed line's amount is never re-priced. Missing → `standardDayHours`.
   */
  standardDayHoursOn?: (date: Date) => number
  /** Organisation currency (`formatMoney`). Leave rows are never on the invoice. */
  currencyCode?: string
  /** Rulebook 1.11.0 `timesheetDaysForPerson`: rows on another (PAYE) day are left out. */
  timesheetDays?: ReadonlyArray<string> | null
}): TimesheetInvoiceLine[] {
  // Rulebook 1.10.0 (H1): which rows and amounts are the rulebook's `timesheetInvoiceRows` — the signed snapshot
  // first, then live lines with their reviews and entry decisions; this function only formats them.
  const sheet = timesheetSheetFields(draft)
  const decided = timesheetInvoiceRows({
    sheet,
    payrollLines: payroll.lineItems,
    extrasMode: extrasMode === 'export' ? 'decided' : 'raw',
    timesheetDays: timesheetDays ?? null,
    timeZone,
    // Rulebook 1.45.0: the draft is the loaded copy; its entries carry the reader's fingerprints.
    entryFingerprints: timesheetEntryFingerprintMap([...draft.priceWorkEntries, ...draft.expenseEntries]),
  })
  const rows: TimesheetInvoiceLine[] = []
  for (const row of decided) {
    if (row.kind === 'labour') {
      const live = row.line
      const signed = row.source === 'override' ? (row.stored as unknown as SignedOverrideLine) : null
      const details = live
        ? timesheetLabourDetails(live, currencyCode)
        : signedOverrideDetails(
            signed as SignedOverrideLine,
            signed?.date && standardDayHoursOn ? standardDayHoursOn(new Date(signed.date as Date)) : standardDayHours,
            currencyCode
          )
      const jobNumber = row.source === 'override'
        ? (live?.jobNumber || signed?.jobNumber || '—').trim() || '—'
        : live?.jobNumber || '—'
      const projectName = live?.projectName || signed?.projectName || ''
      rows.push({
        date: formatAbbreviatedDayInZone((live?.date || (signed?.date as Date)), timeZone),
        jobNumber,
        projectName,
        details,
        description: `${row.source === 'override' ? jobNumber : live?.jobNumber} ${projectName} · ${details}`,
        amount: row.amount,
        kind: 'labour',
        entryId: row.id,
      })
      continue
    }
    const entry = (row.stored ?? {}) as { title?: string; date?: Date; startDate?: Date }
    const label = row.kind === 'priceWork' ? 'Price work' : 'Expense'
    const details = extraInvoiceDetails(String(entry.title ?? ''))
    // Rulebook 1.30.1: the row's job number (`timesheetInvoiceRows` → `jobNumber`); price work with none shows "—"
    // (`priceWorkJobNumberText`).
    const jobNumber =
      row.kind === 'priceWork'
        ? priceWorkJobNumberText(row.jobNumber)
        : row.source === 'live' && extrasMode === 'raw'
          ? '—'
          : row.jobNumber || '—'
    const date = row.source === 'override' ? entry.date : row.kind === 'priceWork' ? entry.startDate : entry.date
    rows.push({
      date: formatAbbreviatedDayInZone(date as Date, timeZone),
      jobNumber,
      projectName: label,
      details,
      description: `${jobNumber} ${label} · ${details}`,
      amount: row.amount,
      kind: row.kind === 'priceWork' ? 'priceWork' : 'expense',
      entryId: row.id,
    })
  }
  return rows
}

type SignedOverrideLine = Parameters<typeof signedOverrideDetails>[0] & {
  jobNumber?: string
  projectName?: string
  date?: Date
}

/**
 * iOS TimesheetExportHelper grandTotal = sum of export line amounts. 1.46.0: rounded to pennies (`roundPennies`), as
 * `timesheetTotals` rounds the same rows, so the export PDF total equals the timesheet total.
 */
export function invoiceLinesTotal(lines: TimesheetInvoiceLine[]): number {
  return roundPennies(lines.reduce((sum, line) => sum + line.amount, 0))
}

// Transactional: no marketing content
export function managerExportEmailHTML({
  recipientName,
  weekTitle,
  paymentRunStamp,
  organizationName,
  attachmentNames,
  downloadLinks = [],
  timesheetCount,
}: {
  recipientName: string
  weekTitle: string
  paymentRunStamp: string
  organizationName: string
  attachmentNames: string[]
  downloadLinks?: Array<{ fileName: string; url: string }>
  timesheetCount: number
}): string {
  const list =
    downloadLinks.length === 0
      ? attachmentNames.map((name) => escapeHtml(name))
      : downloadLinks.map((link) => emailLink(escapeHtml(link.url), escapeHtml(link.fileName)))
  const noun = timesheetCount === 1 ? 'is' : 'are'
  const pdfWord = timesheetCount === 1 ? '' : 's'
  const attachNote =
    downloadLinks.length === 0
      ? `${timesheetCount} signed-off timesheet PDF${pdfWord} for payment run ${emailStrong(escapeHtml(paymentRunStamp), 'ink')} (${escapeHtml(weekTitle)}) from ${emailStrong(escapeHtml(organizationName), 'ink')} ${noun} attached for your records.`
      : `${timesheetCount} signed-off timesheet PDF${pdfWord} for payment run ${emailStrong(escapeHtml(paymentRunStamp), 'ink')} (${escapeHtml(weekTitle)}) from ${emailStrong(escapeHtml(organizationName), 'ink')} ${noun} attached, with backup download links below.`
  return emailDocument({
    title: 'Signed timesheets for filing',
    maxWidth: 720,
    body: [
      emailHeading('Signed timesheets for filing'),
      emailText(`Hello ${escapeHtml(recipientName)},`),
      emailText(attachNote),
      emailText(`Each file is named: <em>User Name timesheet for payment run date ${escapeHtml(paymentRunStamp)}</em>.`),
      emailList(list),
      emailText(
        'These timesheets were counter-signed and exported from Operative Timesheets → Signed off.',
        'muted',
        'margin:0;'
      ),
    ].join('\n'),
  })
}

/** Browser/Node helper so Email and export can send the same PDF bytes iOS attaches. */
export function pdfBytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64')
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

/** iOS InvoicePDFGenerationSupport extras: details · 0h · rate not set */
function extraInvoiceDetails(title: string): string {
  return `${title} · ${formatTimesheetHours(0)}h · rate not set`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
