/**
 * iOS parity: InvoicingView.TimesheetExportHelper (HTML substitute — Cloud Function
 * sendProjectPlannerEmail has no PDF attachments).
 */
import type { TimesheetDraft } from '@/lib/timesheets/timesheetDraft'
import {
  effectiveExpenseAmount,
  effectivePayrollAmount,
  effectivePriceWorkAmount,
} from '@/lib/timesheets/timesheetAdjustments'
import type { TimesheetPayrollLineItem, TimesheetPayrollSummary } from '@/lib/timesheets/timesheetPayrollCollector'
import { timesheetHoursRateLine } from '@/lib/timesheets/timesheetPayrollCollector'
import { formatAbbreviatedDayInZone } from '@/lib/orgTime/zoneTime'
import { londonDateParts } from '@/lib/ios-parity/londonTime'

export function paymentRunDateStamp(start: Date, end: Date, timeZone: string): string {
  const format = (date: Date) => {
    const parts = londonDateParts(date, timeZone)
    return `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}.${String(parts.year).slice(-2)}`
  }
  return `${format(start)} ${format(end)}`
}

export function timesheetExportFileName(userName: string, paymentRunStamp: string): string {
  return `${userName} timesheet for payment run date ${paymentRunStamp}.html`
}

export function signatureNotes(draft: TimesheetDraft): string[] {
  const notes: string[] = []
  if (draft.operativeSignedByName && draft.operativeSignedAt) {
    notes.push(
      `Operative signed by ${draft.operativeSignedByName} on ${draft.operativeSignedAt.toISOString()}.`
    )
  }
  if (draft.managerSignedByName && draft.managerSignedAt) {
    notes.push(
      `Line manager counter-signed by ${draft.managerSignedByName} on ${draft.managerSignedAt.toISOString()}.`
    )
  }
  return notes
}

export type TimesheetInvoiceLine = { date: string; description: string; amount: number }

export function invoiceLinesForTimesheet({
  payroll,
  draft,
  timeZone,
  managerHasSigned,
  applyLiveReview,
}: {
  payroll: TimesheetPayrollSummary
  draft: TimesheetDraft
  timeZone: string
  managerHasSigned: boolean
  applyLiveReview: boolean
}): TimesheetInvoiceLine[] {
  const rows: TimesheetInvoiceLine[] = payroll.lineItems.map((line: TimesheetPayrollLineItem) => ({
    date: formatAbbreviatedDayInZone(line.date, timeZone),
    description: `${line.jobNumber} ${line.projectName} · ${line.details} · ${timesheetHoursRateLine(line)}`,
    amount: effectivePayrollAmount(line, draft, managerHasSigned, applyLiveReview),
  }))
  for (const entry of draft.priceWorkEntries) {
    if (entry.managerDecision === 'declined' && (managerHasSigned || applyLiveReview)) continue
    rows.push({
      date: formatAbbreviatedDayInZone(entry.startDate, timeZone),
      description: `${entry.jobNumber || '—'} Price work · ${entry.title}`,
      amount: effectivePriceWorkAmount(entry, managerHasSigned, applyLiveReview),
    })
  }
  for (const entry of draft.expenseEntries) {
    if (entry.managerDecision === 'declined' && (managerHasSigned || applyLiveReview)) continue
    rows.push({
      date: formatAbbreviatedDayInZone(entry.date, timeZone),
      description: `${entry.jobNumber || '—'} Expense · ${entry.title}`,
      amount: effectiveExpenseAmount(entry, managerHasSigned, applyLiveReview),
    })
  }
  return rows
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
      ? `${timesheetCount} signed-off timesheet${pdfWord} for payment run <strong>${escapeHtml(paymentRunStamp)}</strong> (${escapeHtml(weekTitle)}) from <strong>${escapeHtml(organizationName)}</strong> ${noun} listed below for your records.`
      : `${timesheetCount} signed-off timesheet${pdfWord} for payment run <strong>${escapeHtml(paymentRunStamp)}</strong> (${escapeHtml(weekTitle)}) from <strong>${escapeHtml(organizationName)}</strong> ${noun} ready, with download links below.`
  return `<html><body style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;padding:20px;">
<h2 style="color:#0D67ED;">Signed timesheets for filing</h2>
<p>Hello ${escapeHtml(recipientName)},</p>
<p>${attachNote}</p>
<p>Each file is named: <em>User Name timesheet for payment run date ${escapeHtml(paymentRunStamp)}</em>.</p>
<p style="color:#666;font-size:13px;">Web exports are HTML invoices (the iOS app emails PDFs). Open a link and print to PDF if you need a file copy.</p>
<ul>${list}</ul>
<p style="color:#666;font-size:13px;">These timesheets were counter-signed and exported from User Timesheets → Signed off.</p>
</body></html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
