import { format } from 'date-fns'
import type { TimesheetSubject } from '@/lib/timesheets/timesheetWeekUtils'

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
}): string {
  const invoiceDate = format(new Date(), 'd MMMM yyyy')
  const period = `${format(weekStart, 'd MMM')} – ${format(weekEnd, 'd MMM yyyy')}`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice — ${subject.name}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 40px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .muted { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { border-bottom: 1px solid #ddd; padding: 10px 8px; text-align: left; font-size: 14px; }
    th { background: #f8fafc; }
    .total { font-size: 18px; font-weight: bold; margin-top: 24px; }
  </style>
</head>
<body>
  <h1>Timesheet invoice</h1>
  <p class="muted">${organizationName}</p>
  <p><strong>Contractor:</strong> ${subject.name}</p>
  <p><strong>Period:</strong> ${period}</p>
  <p><strong>Invoice date:</strong> ${invoiceDate}</p>
  ${vatNumber ? `<p><strong>VAT number:</strong> ${vatNumber}</p>` : ''}
  ${utrNumber ? `<p><strong>UTR:</strong> ${utrNumber}</p>` : ''}
  <table>
    <thead>
      <tr><th>Description</th><th>Hours</th><th>Days (est.)</th><th>Amount</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Labour — week of ${format(weekStart, 'd MMM yyyy')}</td>
        <td>${totalHours.toFixed(1)}</td>
        <td>${totalDays.toFixed(1)}</td>
        <td>${amount != null ? `£${amount.toFixed(2)}` : '—'}</td>
      </tr>
    </tbody>
  </table>
  <p class="total">Total due: ${amount != null ? `£${amount.toFixed(2)}` : 'Rate not set'}</p>
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
