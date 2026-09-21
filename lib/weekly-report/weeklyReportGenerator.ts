import { format } from 'date-fns'
import { formatReportPeriodLabel } from '@/lib/weekly-report/invoicingPeriodUtils'
import { formatCurrency, formatDays } from '@/lib/weekly-report/weeklyReportPayroll'
import type { WeeklyReportData } from '@/lib/weekly-report/weeklyReportData'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderTable(headers: string[], rows: string[][], emptyMessage: string): string {
  if (rows.length === 0) {
    return `<p class="empty">${escapeHtml(emptyMessage)}</p>`
  }
  return `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
          .join('')}
      </tbody>
    </table>`
}

export function buildWeeklyReportHtml(data: WeeklyReportData): string {
  const periodLabel = formatReportPeriodLabel(data.reportPeriod.start, data.reportPeriod.end)
  const generatedLabel = format(data.generatedAt, "d MMM yyyy 'at' HH:mm")

  const warningRows =
    data.warnings.length === 0
      ? [['No warnings in period', '', '', '', '', '', '']]
      : data.warnings.map((warning) => [
          escapeHtml(warning.status),
          escapeHtml(warning.priority),
          escapeHtml(warning.type),
          escapeHtml(warning.date),
          escapeHtml(warning.description),
          escapeHtml(warning.detail),
          escapeHtml(warning.forPerson),
        ])

  const projectSections = data.projectGroups
    .map((group) => {
      const rows = group.rows.map((row) => [
        escapeHtml(group.projectName),
        escapeHtml(group.jobNumber),
        escapeHtml(row.person),
        escapeHtml(row.trade),
        escapeHtml(row.role),
        formatDays(row.days),
      ])
      rows.push(['', '', '', '', '<strong>Project Total</strong>', `<strong>${formatDays(group.projectTotal)}</strong>`])
      return renderTable(
        ['Project', 'Job No.', 'Person', 'Trade', 'Role', 'Days'],
        rows,
        ''
      )
    })
    .join('')

  const subRows =
    data.subContractorRows.length === 0
      ? [['—', '—', '—', '—', '—', '—', '—']]
      : data.subContractorRows.map((row) => [
          escapeHtml(row.projectName),
          escapeHtml(row.jobNumber),
          escapeHtml(row.subContractor),
          escapeHtml(row.people || '—'),
          escapeHtml(row.type),
          escapeHtml(row.time),
          formatDays(row.days),
        ])

  const leaveRows =
    data.annualLeaveRows.length === 0
      ? []
      : [
          ...data.annualLeaveRows.map((row) => [
            escapeHtml(row.person),
            escapeHtml(row.role),
            formatDays(row.days),
            escapeHtml(row.type),
          ]),
          ['', '', `<strong>${formatDays(data.annualLeaveTotal)}</strong>`, '<strong>Annual Leave Total</strong>'],
        ]

  const managerRows =
    data.managerScheduleRows.length === 0
      ? []
      : [
          ...data.managerScheduleRows.map((row) => [
            escapeHtml(row.person),
            escapeHtml(row.role),
            escapeHtml(row.location),
            escapeHtml(row.time),
            formatDays(row.days),
          ]),
          ['', '', '', '<strong>Total</strong>', `<strong>${formatDays(data.managerScheduleTotal)}</strong>`],
        ]

  const payRows: string[][] = []
  for (const person of data.paySummary) {
    for (const line of person.lines) {
      payRows.push([
        escapeHtml(person.person),
        escapeHtml(person.role),
        escapeHtml(line.rateType),
        formatDays(line.days),
        formatCurrency(line.rate),
        formatCurrency(line.pay),
      ])
    }
    payRows.push([
      `<strong>${escapeHtml(person.person)} total</strong>`,
      '',
      '',
      '',
      '',
      `<strong>${formatCurrency(person.personTotal)}</strong>`,
    ])
  }
  payRows.push(['', '', '', '', '<strong>Grand Total</strong>', `<strong>${formatCurrency(data.grandTotal)}</strong>`])

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Weekly Report — ${escapeHtml(data.organizationName)}</title>
  <style>
    @page { margin: 14mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      margin: 0;
      padding: 28px;
      font-size: 11px;
      line-height: 1.35;
    }
    .brand { font-size: 10px; font-weight: 700; letter-spacing: 0.18em; color: #64748b; }
    .org { font-size: 18px; font-weight: 700; margin: 4px 0 2px; }
    .title { font-size: 14px; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 10px; }
    .meta { margin-bottom: 18px; color: #334155; }
    .meta strong { color: #0f172a; }
    h2 {
      font-size: 12px;
      margin: 22px 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td {
      border: 1px solid #dbe3ee;
      padding: 6px 7px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
    .empty { color: #94a3b8; font-style: italic; }
    .footer { margin-top: 24px; font-size: 10px; color: #64748b; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="brand">PROJECTPLANNER</div>
  <div class="org">${escapeHtml(data.organizationName)}</div>
  <div class="title">WEEKLY REPORT</div>
  <div class="meta">
    <div><strong>Period:</strong> ${escapeHtml(periodLabel)}</div>
    <div><strong>Invoicing period</strong> ${escapeHtml(data.invoicingPeriodLabel)}</div>
    <div><strong>Generated:</strong> ${escapeHtml(generatedLabel)}</div>
  </div>

  <h2>⚠ Warnings Summary</h2>
  ${renderTable(
    ['Status', 'Priority', 'Type', 'Date', 'Description', 'Detail', 'For'],
    warningRows,
    'No warnings in period'
  )}

  <h2>🏗 Project Breakdown</h2>
  ${projectSections || '<p class="empty">No project bookings in this period.</p>'}
  <table>
    <tbody>
      <tr>
        <td colspan="5"><strong>All Project Work</strong></td>
        <td><strong>${formatDays(data.allProjectWorkTotal)}</strong></td>
      </tr>
    </tbody>
  </table>

  <h2>🔧 Sub Contractors</h2>
  ${renderTable(
    ['Project', 'Job No.', 'Sub Contractor', 'People', 'Type', 'Time', 'Days'],
    subRows,
    'No sub contractor bookings'
  )}
  <table><tbody><tr><td colspan="6"><strong>Sub Contractor</strong></td><td><strong>${formatDays(data.subContractorTotal)}</strong></td></tr></tbody></table>

  <h2>🌴 Annual Leave</h2>
  ${renderTable(['Person', 'Role', 'Days', 'Type'], leaveRows, 'No annual leave in this period')}

  <h2>📅 Manager / Admin Additional Schedule</h2>
  ${renderTable(['Person', 'Role', 'Location', 'Time', 'Days'], managerRows, 'No additional manager schedule in this period')}

  <h2>💷 Pay Summary</h2>
  ${renderTable(['Person', 'Role', 'Rate Type', 'Days', 'Rate', 'Pay'], payRows, 'No pay data for this period')}

  <div class="footer">Generated by Project Planner</div>
</body>
</html>`
}

export function downloadWeeklyReport(html: string, filename: string): void {
  downloadTextFile(html, filename, 'text/html;charset=utf-8')
}

export function downloadWeeklyReportWorkbook(xml: string, filename: string): void {
  downloadTextFile(xml, filename, 'application/vnd.ms-excel;charset=utf-8')
}

function downloadTextFile(contents: string, filename: string, mime: string): void {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function spreadsheetRow(cells: string[]): string {
  return `<Row>${cells
    .map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`)
    .join('')}</Row>`
}

function spreadsheetTable(headers: string[], rows: string[][]): string {
  const body = rows.length === 0 ? [spreadsheetRow(headers.map(() => ''))] : rows.map((row) => spreadsheetRow(row))
  return `${spreadsheetRow(headers)}${body.join('')}`
}

/** Excel SpreadsheetML matching the iOS weekly report sections and columns. */
export function buildWeeklyReportSpreadsheetXml(data: WeeklyReportData): string {
  const periodLabel = formatReportPeriodLabel(data.reportPeriod.start, data.reportPeriod.end)
  const generatedLabel = format(data.generatedAt, "d MMM yyyy 'at' HH:mm")

  const warningRows =
    data.warnings.length === 0
      ? [['No warnings in period', '', '', '', '', '', '']]
      : data.warnings.map((warning) => [
          warning.status,
          warning.priority,
          warning.type,
          warning.date,
          warning.description,
          warning.detail,
          warning.forPerson,
        ])

  const projectChunks: string[] = []
  for (const group of data.projectGroups) {
    const rows = group.rows.map((row) => [
      group.projectName,
      group.jobNumber,
      row.person,
      row.trade,
      row.role,
      formatDays(row.days),
    ])
    rows.push(['', '', '', '', 'Project Total', formatDays(group.projectTotal)])
    projectChunks.push(
      spreadsheetRow([`Project Breakdown — ${group.projectName}`]),
      spreadsheetTable(['Project', 'Job No.', 'Person', 'Trade', 'Role', 'Days'], rows)
    )
  }
  projectChunks.push(spreadsheetRow(['All Project Work', formatDays(data.allProjectWorkTotal)]))

  const subRows =
    data.subContractorRows.length === 0
      ? [['—', '—', '—', '—', '—', '—', '—']]
      : data.subContractorRows.map((row) => [
          row.projectName,
          row.jobNumber,
          row.subContractor,
          row.people || '—',
          row.type,
          row.time,
          formatDays(row.days),
        ])
  subRows.push(['', '', '', '', '', 'Sub Contractor total', formatDays(data.subContractorTotal)])

  const leaveRows =
    data.annualLeaveRows.length === 0
      ? [['No annual leave in this period', '', '', '']]
      : [
          ...data.annualLeaveRows.map((row) => [row.person, row.role, formatDays(row.days), row.type]),
          ['', 'Annual Leave Total', formatDays(data.annualLeaveTotal), ''],
        ]

  const managerRows =
    data.managerScheduleRows.length === 0
      ? [['No additional manager schedule', '', '', '', '']]
      : [
          ...data.managerScheduleRows.map((row) => [
            row.person,
            row.role,
            row.location,
            row.time,
            formatDays(row.days),
          ]),
          ['', '', '', 'Total', formatDays(data.managerScheduleTotal)],
        ]

  const payRows: string[][] = []
  for (const person of data.paySummary) {
    for (const line of person.lines) {
      payRows.push([
        person.person,
        person.role,
        line.rateType,
        formatDays(line.days),
        formatCurrency(line.rate),
        formatCurrency(line.pay),
      ])
    }
    payRows.push([`${person.person} total`, '', '', '', '', formatCurrency(person.personTotal)])
  }
  payRows.push(['', '', '', '', 'Grand Total', formatCurrency(data.grandTotal)])

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Weekly Report">
  <Table>
   ${spreadsheetRow(['PROJECT PLANNER'])}
   ${spreadsheetRow([data.organizationName])}
   ${spreadsheetRow(['WEEKLY REPORT'])}
   ${spreadsheetRow(['Period', periodLabel])}
   ${spreadsheetRow(['Invoicing period', data.invoicingPeriodLabel])}
   ${spreadsheetRow(['Generated', generatedLabel])}
   ${spreadsheetRow([''])}
   ${spreadsheetRow(['Warnings Summary'])}
   ${spreadsheetTable(['Status', 'Priority', 'Type', 'Date', 'Description', 'Detail', 'For'], warningRows)}
   ${spreadsheetRow([''])}
   ${spreadsheetRow(['Project Breakdown'])}
   ${projectChunks.join('')}
   ${spreadsheetRow([''])}
   ${spreadsheetRow(['Sub Contractors'])}
   ${spreadsheetTable(
     ['Project', 'Job No.', 'Sub Contractor', 'People', 'Type', 'Time', 'Days'],
     subRows
   )}
   ${spreadsheetRow([''])}
   ${spreadsheetRow(['Annual Leave'])}
   ${spreadsheetTable(['Person', 'Role', 'Days', 'Type'], leaveRows)}
   ${spreadsheetRow([''])}
   ${spreadsheetRow(['Manager / Admin Additional Schedule'])}
   ${spreadsheetTable(['Person', 'Role', 'Location', 'Time', 'Days'], managerRows)}
   ${spreadsheetRow([''])}
   ${spreadsheetRow(['Pay Summary'])}
   ${spreadsheetTable(['Person', 'Role', 'Rate Type', 'Days', 'Rate', 'Pay'], payRows.length ? payRows : [['No pay data for this period', '', '', '', '', '']])}
  </Table>
 </Worksheet>
</Workbook>`
}

export function printWeeklyReport(html: string): void {
  try {
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768')
    if (!printWindow) return
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.onload = () => {
      printWindow.print()
    }
  } catch {
    /* popup blocked — on-page report + download still work */
  }
}
