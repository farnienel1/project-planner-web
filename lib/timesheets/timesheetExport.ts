/**
 * iOS parity: InvoicingView.TimesheetExportHelper / ResendEmailService.sendTimesheetExportEmail.
 */
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import type { TimesheetPayrollSummary } from '@/lib/timesheets/timesheetPayrollCollector'
import { timesheetLabourDetails } from '@/lib/timesheets/timesheetPayrollCollector'
import { formatTimesheetHours } from '@/lib/timesheets/timesheetHours'
import { isClockSpanLabel, orgDayHours, payLineDisplay } from '@/lib/timesheets/payBasis'
import { signedLabourSlice } from '@/lib/weekly-report/weeklyReportPayroll'
import { formatAbbreviatedDayInZone, formatStampInZone } from '@/lib/orgTime/zoneTime'
import { londonDateParts, dayKey } from '@/lib/ios-parity/londonTime'
import type { Operative, User } from '@/types'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import type { OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'
import { formatMoney } from '@/lib/canonical/money'
import { timesheetInvoiceRows } from '@/lib/canonical/reportPay'

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

export function signatureNotes(draft: TimesheetDraft, timeZone: string = 'Europe/London'): string[] {
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
  for (const entry of (history.byUserId[user.id] || []).filter((row) => inPeriod(row.effectiveAt))) {
    notes.add(
      entry.dayRate == null
        ? `Rate cleared from ${formatAbbreviatedDayInZone(entry.effectiveAt, timeZone)}.`
        : `Rate updated to ${formatMoney(entry.dayRate, currencyCode)}${entry.payBasis === 'hourly' ? '/hr' : '/day'} from ${formatAbbreviatedDayInZone(entry.effectiveAt, timeZone)}.`
    )
  }
  const matched = operatives.filter(
    (operative) => operative.email.trim().toLowerCase() === user.email.trim().toLowerCase()
  )
  const linked = findOperativeForUser(user, operatives)
  const ids = new Set(matched.map((row) => row.id))
  if (linked) ids.add(linked.id)
  for (const operativeId of ids) {
    for (const entry of (history.byOperativeId[operativeId] || []).filter((row) => inPeriod(row.effectiveAt))) {
      notes.add(
        entry.dayRate == null
          ? `Operative rate cleared from ${formatAbbreviatedDayInZone(entry.effectiveAt, timeZone)}.`
          : `Operative rate updated to ${formatMoney(entry.dayRate, currencyCode)}${entry.payBasis === 'hourly' ? '/hr' : '/day'} from ${formatAbbreviatedDayInZone(entry.effectiveAt, timeZone)}.`
      )
    }
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
  const slice = signedLabourSlice(line, standard, 1)
  const equation = payLineDisplay({
    payBasis: slice.payBasis,
    paidHours: slice.paidHours,
    standardDayHours: standard,
    rate: slice.rate,
    pay: slice.pay,
    currencyCode,
  }).equation
  const clock = line.details && isClockSpanLabel(line.details) ? `${line.details} · ` : ''
  return `${clock}${equation}`
}

export function invoiceLinesForTimesheet({
  payroll,
  draft,
  timeZone,
  extrasMode,
  standardDayHours = 8,
  currencyCode,
}: {
  payroll: TimesheetPayrollSummary
  draft: TimesheetDraft
  timeZone: string
  extrasMode: 'raw' | 'export'
  standardDayHours?: number
  /** Organisation currency (`formatMoney`). Leave rows are never on the invoice. */
  currencyCode?: string
}): TimesheetInvoiceLine[] {
  // Rulebook 1.10.0 (H1): which rows and amounts are the rulebook's `timesheetInvoiceRows` — the signed snapshot
  // first, then live lines with their reviews and entry decisions; this function only formats them.
  const sheet: Record<string, unknown> = {
    weeklyReportOverride: draft.weeklyReportOverride ?? null,
    payrollLineReviews: draft.payrollLineReviews,
    extraEntryReviews: draft.extraEntryReviews ?? null,
    priceWorkEntries: draft.priceWorkEntries,
    expenseEntries: draft.expenseEntries,
    managerSignedAt: draft.managerSignedAt ?? null,
  }
  const decided = timesheetInvoiceRows({
    sheet,
    payrollLines: payroll.lineItems,
    extrasMode: extrasMode === 'export' ? 'decided' : 'raw',
  })
  const rows: TimesheetInvoiceLine[] = []
  for (const row of decided) {
    if (row.kind === 'labour') {
      const live = row.line
      const signed = row.source === 'override' ? (row.stored as unknown as SignedOverrideLine) : null
      const details = live
        ? timesheetLabourDetails(live, currencyCode)
        : signedOverrideDetails(signed as SignedOverrideLine, standardDayHours, currencyCode)
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
      })
      continue
    }
    const entry = (row.stored ?? {}) as { title?: string; jobNumber?: string; date?: Date; startDate?: Date }
    const label = row.kind === 'priceWork' ? 'Price work' : 'Expense'
    const details = extraInvoiceDetails(String(entry.title ?? ''))
    const jobNumber =
      row.kind === 'expense' && row.source === 'live' && extrasMode === 'raw' ? '—' : String(entry.jobNumber ?? '').trim() || '—'
    const date = row.source === 'override' ? entry.date : row.kind === 'priceWork' ? entry.startDate : entry.date
    rows.push({
      date: formatAbbreviatedDayInZone(date as Date, timeZone),
      jobNumber,
      projectName: label,
      details,
      description: `${jobNumber} ${label} · ${details}`,
      amount: row.amount,
    })
  }
  return rows
}

type SignedOverrideLine = Parameters<typeof signedOverrideDetails>[0] & {
  jobNumber?: string
  projectName?: string
  date?: Date
}

/** iOS TimesheetExportHelper grandTotal = sum of export line amounts. */
export function invoiceLinesTotal(lines: TimesheetInvoiceLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0)
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
      ? attachmentNames.map((name) => `<li>${escapeHtml(name)}</li>`).join('')
      : downloadLinks
          .map(
            (link) =>
              `<li><a href="${escapeHtml(link.url)}">${escapeHtml(link.fileName)}</a></li>`
          )
          .join('')
  const noun = timesheetCount === 1 ? 'is' : 'are'
  const pdfWord = timesheetCount === 1 ? '' : 's'
  const attachNote =
    downloadLinks.length === 0
      ? `${timesheetCount} signed-off timesheet PDF${pdfWord} for payment run <strong>${escapeHtml(paymentRunStamp)}</strong> (${escapeHtml(weekTitle)}) from <strong>${escapeHtml(organizationName)}</strong> ${noun} attached for your records.`
      : `${timesheetCount} signed-off timesheet PDF${pdfWord} for payment run <strong>${escapeHtml(paymentRunStamp)}</strong> (${escapeHtml(weekTitle)}) from <strong>${escapeHtml(organizationName)}</strong> ${noun} attached, with backup download links below.`
  return `<html><body style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:20px;">
<h2 style="color:#0D67ED;">Signed timesheets for filing</h2>
<p>Hello ${escapeHtml(recipientName)},</p>
<p>${attachNote}</p>
<p>Each file is named: <em>User Name timesheet for payment run date ${escapeHtml(paymentRunStamp)}</em>.</p>
<ul>${list}</ul>
<p style="color:#666;font-size:13px;">These timesheets were counter-signed and exported from Operative Timesheets → Signed off.</p>
</body></html>`
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
