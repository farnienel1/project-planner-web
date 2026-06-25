import { format } from 'date-fns'
import { formatReportPeriodLabel } from '@/lib/weekly-report/invoicingPeriodUtils'
import type { WeeklyReportData } from '@/lib/weekly-report/weeklyReportData'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderDaySchedule(data: WeeklyReportData): string {
  const groups = data.dayGroups.filter((group) => group.bookings.length > 0)
  if (groups.length === 0) {
    return '<p class="empty">No bookings in this period.</p>'
  }

  return groups
    .map(
      (group) => `
      <section class="day-block">
        <h3>${escapeHtml(group.label)}</h3>
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Project / location</th>
              <th>Time</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            ${group.bookings
              .map(
                (booking) => `
              <tr>
                <td>${escapeHtml(booking.personName)}</td>
                <td>${escapeHtml(booking.projectLabel)}</td>
                <td>${escapeHtml(booking.timeRange || booking.timeSlot)}</td>
                <td>${booking.personKind === 'manager' ? 'Manager' : 'Operative'}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </section>`
    )
    .join('')
}

function renderWarnings(data: WeeklyReportData): string {
  const sections: string[] = []

  if (data.operativeClashes.length > 0) {
    sections.push(`
      <h3>Operative booking clashes</h3>
      <ul>
        ${data.operativeClashes.map((warning) => `<li>${escapeHtml(warning.message)}</li>`).join('')}
      </ul>`)
  }

  if (data.managerClashes.length > 0) {
    sections.push(`
      <h3>Manager / admin overlaps</h3>
      <ul>
        ${data.managerClashes.map((warning) => `<li>${escapeHtml(warning.message)}</li>`).join('')}
      </ul>`)
  }

  if (data.unbookedWarnings.length > 0) {
    sections.push(`
      <h3>Unbooked labour</h3>
      <ul>
        ${data.unbookedWarnings.map((warning) => `<li>${escapeHtml(warning.message)}</li>`).join('')}
      </ul>`)
  }

  if (sections.length === 0) {
    return '<p class="empty">No warnings for this period.</p>'
  }

  return sections.join('')
}

export function buildWeeklyReportHtml(data: WeeklyReportData): string {
  const periodLabel = formatReportPeriodLabel(data.period.start, data.period.end)
  const generatedLabel = format(data.generatedAt, "d MMMM yyyy 'at' HH:mm")
  const logo = data.companyLogoURL
    ? `<img src="${escapeHtml(data.companyLogoURL)}" alt="" class="logo" />`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Weekly report — ${escapeHtml(data.organizationName)}</title>
  <style>
    @page { margin: 18mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 32px;
      line-height: 1.45;
      background: #fff;
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 24px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .logo { max-height: 56px; max-width: 180px; object-fit: contain; }
    h1 { font-size: 28px; margin: 0 0 6px; }
    .subtitle { color: #64748b; font-size: 14px; margin: 0; }
    .meta { text-align: right; font-size: 13px; color: #64748b; }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .stat {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      background: #f8fafc;
    }
    .stat strong { display: block; font-size: 22px; color: #1d4ed8; }
    .stat span { font-size: 12px; color: #64748b; }
    h2 {
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
      margin: 28px 0 12px;
    }
    h3 { font-size: 15px; margin: 18px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td {
      border-bottom: 1px solid #e2e8f0;
      padding: 8px 6px;
      text-align: left;
      font-size: 12px;
      vertical-align: top;
    }
    th { background: #f8fafc; color: #475569; font-weight: 600; }
    ul { margin: 0; padding-left: 18px; }
    li { margin-bottom: 6px; font-size: 12px; }
    .empty { color: #94a3b8; font-size: 13px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 8px;
    }
    .summary-card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px;
    }
    .summary-card h4 { margin: 0 0 8px; font-size: 13px; }
    .summary-card p { margin: 0 0 4px; font-size: 12px; color: #334155; }
    @media print {
      body { padding: 0; }
      .day-block { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div>
      ${logo}
      <h1>Weekly report</h1>
      <p class="subtitle">${escapeHtml(data.organizationName)}</p>
    </div>
    <div class="meta">
      <div><strong>Period</strong><br />${escapeHtml(periodLabel)}</div>
      <div style="margin-top: 10px;"><strong>Generated</strong><br />${escapeHtml(generatedLabel)}</div>
    </div>
  </header>

  <section class="stats">
    <div class="stat"><strong>${data.stats.totalBookings}</strong><span>Total bookings</span></div>
    <div class="stat"><strong>${data.stats.peopleBooked}</strong><span>People booked</span></div>
    <div class="stat"><strong>${data.stats.projectsUsed}</strong><span>Projects used</span></div>
    <div class="stat"><strong>${data.stats.operativeClashes + data.stats.managerOverlaps + data.stats.unbookedLabour}</strong><span>Warnings</span></div>
  </section>

  <h2>Schedule by day</h2>
  ${renderDaySchedule(data)}

  <h2>People summary</h2>
  <div class="summary-grid">
    ${data.people.length === 0
      ? '<p class="empty">No people booked in this period.</p>'
      : data.people
          .map(
            (person) => `
        <div class="summary-card">
          <h4>${escapeHtml(person.name)} <span style="color:#64748b;font-weight:normal;">(${person.kind === 'manager' ? 'Manager' : 'Operative'})</span></h4>
          <p>${person.bookingCount} booking${person.bookingCount === 1 ? '' : 's'}</p>
          <p>${escapeHtml(person.projectLabels.slice(0, 4).join(' · '))}${person.projectLabels.length > 4 ? '…' : ''}</p>
        </div>`
          )
          .join('')}
  </div>

  <h2>Projects</h2>
  ${
    data.projects.length === 0
      ? '<p class="empty">No project activity in this period.</p>'
      : `<table>
      <thead>
        <tr><th>Project</th><th>Bookings</th><th>People</th></tr>
      </thead>
      <tbody>
        ${data.projects
          .map(
            (project) => `
          <tr>
            <td>${escapeHtml(project.label)}</td>
            <td>${project.bookingCount}</td>
            <td>${project.peopleCount}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`
  }

  <h2>Warnings</h2>
  ${renderWarnings(data)}
</body>
</html>`
}

export function downloadWeeklyReport(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function printWeeklyReport(html: string): void {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768')
  if (!printWindow) {
    downloadWeeklyReport(html, 'weekly-report.html')
    return
  }
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.onload = () => {
    printWindow.print()
  }
}
