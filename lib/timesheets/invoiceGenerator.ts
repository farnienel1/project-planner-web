/**
 * iOS parity source: Views/InvoicingView.swift InvoicePDFBuilder (HTML/print stand-in).
 * Web cannot attach a native PDF through sendProjectPlannerEmail; this document
 * matches the iOS invoice page layout so Print → Save as PDF is the same content.
 */
import { formatCurrency } from '@/lib/weekly-report/weeklyReportPayroll'
import { formatPaymentPeriodLine } from '@/lib/timesheets/paymentRunCopy'
import { formatStampInZone } from '@/lib/orgTime/zoneTime'
import type { TimesheetSubject } from '@/lib/timesheets/timesheetWeekUtils'
import type { TimesheetInvoiceLine } from '@/lib/timesheets/timesheetExport'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function timesheetInvoiceFileName(userName: string, generatedAt: Date = new Date()): string {
  const cleaned = userName.replace(/[/\\:?%*|<>"]/g, '-').replace(/\s+/g, '_').trim() || 'Timesheet'
  return `Invoice-${cleaned}-${Math.floor(generatedAt.getTime() / 1000)}.html`
}

export function buildTimesheetInvoiceHtml({
  organizationName,
  subject,
  weekStart,
  weekEnd,
  totalHours,
  totalDays,
  amount,
  vatNumber,
  utrNumber,
  lines,
  timeZone = 'Europe/London',
  generatedAt = new Date(),
  documentTitle = 'Invoice',
  periodMetaLabel = 'INVOICE PERIOD',
  totalLabel = 'Total invoice amount',
  notes = [],
}: {
  organizationName: string
  subject: TimesheetSubject
  weekStart: Date
  weekEnd: Date
  totalHours: number
  totalDays: number
  amount: number | null
  vatNumber?: string
  utrNumber?: string
  lines?: TimesheetInvoiceLine[]
  timeZone?: string
  generatedAt?: Date
  documentTitle?: string
  periodMetaLabel?: string
  totalLabel?: string
  notes?: string[]
}): string {
  const period = formatPaymentPeriodLine(weekStart, weekEnd, timeZone)
  const generated = formatStampInZone(generatedAt, timeZone)
  const totalText = amount != null ? formatCurrency(amount) : 'Rate not set'
  const rows =
    lines && lines.length > 0
      ? lines
          .map(
            (line) => `<tr>
      <td>
        <div class="date">${escapeHtml(line.date)}</div>
        <div class="muted">${escapeHtml(line.jobNumber || '—')}</div>
      </td>
      <td>
        <div class="project">${escapeHtml(line.projectName || line.description)}</div>
        <div class="muted">${escapeHtml(line.details || line.description)}</div>
      </td>
      <td class="amount">${escapeHtml(formatCurrency(line.amount))}</td>
    </tr>`
          )
          .join('')
      : `<tr>
      <td>
        <div class="date">${escapeHtml(period)}</div>
        <div class="muted">Labour</div>
      </td>
      <td>
        <div class="project">Hours ${totalHours.toFixed(1)} · Days ${totalDays.toFixed(2)}</div>
      </td>
      <td class="amount">${amount != null ? escapeHtml(formatCurrency(amount)) : '—'}</td>
    </tr>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(documentTitle)} — ${escapeHtml(subject.name)}</title>
  <style>
    @page { size: A4; margin: 28px; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0E1F33;
      margin: 0;
      font-size: 12px;
      line-height: 1.4;
    }
    h1 { font-size: 31px; font-weight: 700; margin: 0; }
    .brand { font-size: 10px; font-weight: 700; color: #2BBBEF; margin-top: 8px; }
    .rule { height: 1.6px; background: #0E1F33; margin: 12px 0; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; margin-bottom: 18px; }
    .label { font-size: 9px; font-weight: 700; letter-spacing: 0.04em; color: #8A8A8E; text-transform: uppercase; }
    .value { font-size: 12.5px; font-weight: 600; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: #0E1F33;
      color: #fff;
      font-size: 9.5px;
      font-weight: 700;
      text-align: left;
      padding: 7px 10px;
    }
    td { vertical-align: top; padding: 8px 10px; border-top: 0.8px solid #EDEDED; }
    .date { font-size: 10.5px; font-weight: 700; }
    .project { font-size: 11.5px; font-weight: 600; }
    .muted { font-size: 9.5px; color: #5C6B80; margin-top: 2px; }
    .amount { text-align: right; font-size: 11.5px; font-weight: 700; white-space: nowrap; width: 90px; }
    .total {
      margin-top: 14px;
      background: linear-gradient(90deg, #13263E, #0A1527);
      color: #fff;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 15px;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(documentTitle)}</h1>
  <div class="brand">Project Planner</div>
  <div class="rule"></div>
  <div class="meta">
    <div><div class="label">Company</div><div class="value">${escapeHtml(organizationName)}</div></div>
    <div><div class="label">Name</div><div class="value">${escapeHtml(subject.name)}</div></div>
    <div><div class="label">Generated</div><div class="value">${escapeHtml(generated)}</div></div>
    <div><div class="label">${escapeHtml(periodMetaLabel)}</div><div class="value">${escapeHtml(period)}</div></div>
    ${vatNumber ? `<div><div class="label">VAT number</div><div class="value">${escapeHtml(vatNumber)}</div></div>` : ''}
    ${utrNumber ? `<div><div class="label">UTR number</div><div class="value">${escapeHtml(utrNumber)}</div></div>` : ''}
  </div>
  <table>
    <thead>
      <tr><th>Date / Project</th><th>Details</th><th style="text-align:right">Amount</th></tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="3">No work entries were found for this invoice period.</td></tr>`}
    </tbody>
  </table>
  <div class="total"><span>${escapeHtml(totalLabel)}</span><span>${escapeHtml(totalText)}</span></div>
  ${
    notes.length
      ? `<h2 style="font-size:12px;margin:18px 0 8px;">Rate change notes</h2>${notes
          .map((note) => `<p class="muted">• ${escapeHtml(note)}</p>`)
          .join('')}`
      : ''
  }
</body>
</html>`
}

export function downloadTimesheetInvoice(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function printTimesheetInvoice(html: string): void {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700')
  if (!printWindow) {
    downloadTimesheetInvoice(html, 'Invoice.html')
    return
  }
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.onload = () => printWindow.print()
}
