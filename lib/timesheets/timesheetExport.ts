/**
 * iOS parity: InvoicingView.TimesheetExportHelper / ResendEmailService.sendTimesheetExportEmail.
 */
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import type { TimesheetPayrollSummary } from '@/lib/timesheets/timesheetPayrollCollector'
import { timesheetHoursRateLine } from '@/lib/timesheets/timesheetPayrollCollector'
import { formatTimesheetHours } from '@/lib/timesheets/timesheetHours'
import { formatAbbreviatedDayInZone, formatStampInZone } from '@/lib/orgTime/zoneTime'
import { londonDateParts, dayKey } from '@/lib/ios-parity/londonTime'
import type { Operative, User } from '@/types'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import type { OperativeDayRateHistoryCollection } from '@/lib/timesheets/dayRateHistoryStorage'

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
}: {
  history: OperativeDayRateHistoryCollection
  user: User
  operatives: Operative[]
  periodStart: Date
  periodEnd: Date
  timeZone: string
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
      `Rate updated to £${entry.dayRate.toFixed(2)} from ${formatAbbreviatedDayInZone(entry.effectiveAt, timeZone)}.`
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
        `Operative rate updated to £${entry.dayRate.toFixed(2)} from ${formatAbbreviatedDayInZone(entry.effectiveAt, timeZone)}.`
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

export function invoiceLinesForTimesheet({
  payroll,
  draft,
  timeZone,
  extrasMode,
}: {
  payroll: TimesheetPayrollSummary
  draft: TimesheetDraft
  timeZone: string
  extrasMode: 'raw' | 'export'
}): TimesheetInvoiceLine[] {
  const rows: TimesheetInvoiceLine[] = []
  for (const line of payroll.lineItems) {
    const details = `${line.details} · ${timesheetHoursRateLine(line)}`
    rows.push({
      date: formatAbbreviatedDayInZone(line.date, timeZone),
      jobNumber: line.jobNumber || '—',
      projectName: line.projectName,
      details,
      description: `${line.jobNumber} ${line.projectName} · ${details}`,
      amount: line.amount,
    })
  }
  for (const entry of draft.priceWorkEntries) {
    if (extrasMode === 'export' && entry.managerDecision === 'declined') continue
    const amount =
      extrasMode === 'export' ? entry.managerRevisedAmount ?? entry.amount : entry.amount
    const details = extraInvoiceDetails(entry.title)
    const jobNumber = entry.jobNumber.trim() || '—'
    rows.push({
      date: formatAbbreviatedDayInZone(entry.startDate, timeZone),
      jobNumber,
      projectName: 'Price work',
      details,
      description: `${jobNumber} Price work · ${details}`,
      amount,
    })
  }
  for (const entry of draft.expenseEntries) {
    if (extrasMode === 'export' && entry.managerDecision === 'declined') continue
    const amount =
      extrasMode === 'export' ? entry.managerRevisedAmount ?? entry.amount : entry.amount
    const details = extraInvoiceDetails(entry.title)
    const jobNumber = extrasMode === 'raw' ? '—' : entry.jobNumber.trim() || '—'
    rows.push({
      date: formatAbbreviatedDayInZone(entry.date, timeZone),
      jobNumber,
      projectName: 'Expense',
      details,
      description: `${jobNumber} Expense · ${details}`,
      amount,
    })
  }
  return rows
}

/** iOS TimesheetExportHelper grandTotal = sum of export line amounts. */
export function invoiceLinesTotal(lines: TimesheetInvoiceLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0)
}

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
