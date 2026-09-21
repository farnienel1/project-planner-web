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
  managerHasSigned,
  applyLiveReview,
}: {
  payroll: TimesheetPayrollSummary
  draft: TimesheetDraft
  timeZone: string
  managerHasSigned: boolean
  applyLiveReview: boolean
}): TimesheetInvoiceLine[] {
  const rows: TimesheetInvoiceLine[] = payroll.lineItems.map((line: TimesheetPayrollLineItem) => {
    const details = `${line.details} · ${timesheetHoursRateLine(line)}`
    return {
      date: formatAbbreviatedDayInZone(line.date, timeZone),
      jobNumber: line.jobNumber || '—',
      projectName: line.projectName,
      details,
      description: `${line.jobNumber} ${line.projectName} · ${details}`,
      amount: effectivePayrollAmount(line, draft, managerHasSigned, applyLiveReview),
    }
  })
  for (const entry of draft.priceWorkEntries) {
    if (entry.managerDecision === 'declined' && (managerHasSigned || applyLiveReview)) continue
    const details = `Price work · ${entry.title}`
    rows.push({
      date: formatAbbreviatedDayInZone(entry.startDate, timeZone),
      jobNumber: entry.jobNumber || '—',
      projectName: entry.title,
      details,
      description: `${entry.jobNumber || '—'} ${details}`,
      amount: effectivePriceWorkAmount(entry, managerHasSigned, applyLiveReview),
    })
  }
  for (const entry of draft.expenseEntries) {
    if (entry.managerDecision === 'declined' && (managerHasSigned || applyLiveReview)) continue
    const details = `Expense · ${entry.title}`
    rows.push({
      date: formatAbbreviatedDayInZone(entry.date, timeZone),
      jobNumber: entry.jobNumber || '—',
      projectName: entry.title,
      details,
      description: `${entry.jobNumber || '—'} ${details}`,
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
<p style="color:#666;font-size:13px;">Each download is a PDF timesheet. The email function cannot attach files, so use the links below — the same PDFs iOS would send as attachments.</p>
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
