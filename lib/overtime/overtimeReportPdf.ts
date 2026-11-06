/**
 * Rulebook 1.33.0 §25 (owner 6 Nov): the overtime report PDF in the invoice / timesheet family — the title block with
 * the logo (COMPANY / NAME / GENERATED / PERIOD), a navy table header (Day, Job, Start–Finish, Overtime) repeated after
 * each page break, hairline rows, the navy total box and page numbers. Rebuilt from the saved copy
 * (`overtimeReports/{id}`). Every text is `overtimeReportRows` (header, table, a declined line's "Declined by {name}",
 * the out-of-date mark); this file only lays it out (`InvoiceFamilyPdf`). Same layout as iOS `OvertimeReportPDFLayout`.
 */
import { overtimeReportRows, type OvertimeReportRowsExtras, type OvertimeReportSnapshot } from '@/lib/canonical'
import { familyLogo, InvoiceFamilyPdf, type FamilyColumn } from '@/lib/pdf/invoiceFamilyPdf'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

/** Column widths: Day, Job, Start–Finish, Overtime (fills the 539pt content width, as iOS). */
const WIDTHS = [112, 205, 92, 130]
const DECLINED: readonly [number, number, number] = [0.6, 0.2, 0.15]

export async function buildOvertimeReportPdf(
  snapshot: Pick<OvertimeReportSnapshot, 'userName' | 'companyName' | 'rangeStart' | 'rangeEnd' | 'lines' | 'totals'> & OvertimeReportRowsExtras,
  options?: { logoUrl?: string | null; timeZone?: string | null; generatedByName?: string | null }
): Promise<Uint8Array> {
  const content = overtimeReportRows(snapshot, {
    timeZone: options?.timeZone || organizationZoneOr(),
    generatedByName: options?.generatedByName,
    nowMs: Date.now(),
  })
  const w = await InvoiceFamilyPdf.create()
  const logo = await familyLogo(w.pdf, options?.logoUrl)
  const columns: FamilyColumn[] = content.columns.map((title, index) => ({
    title,
    width: WIDTHS[index] ?? 100,
    align: index === content.columns.length - 1 ? 'right' : 'left',
  }))
  w.titleBlock({
    title: content.documentTitle,
    logo,
    meta: [
      ['Company', content.companyName],
      ['Name', content.personName],
      ['Generated', content.generated],
      ['Period', content.period],
    ],
  })
  if (content.outOfDate) w.banner(content.outOfDateNote)
  const runningHeading = () => {
    w.text([content.documentTitle, content.personName, content.period].filter(Boolean).join(' · '), 28, w.y, {
      size: 10,
      bold: true,
      color: [0.36, 0.42, 0.5],
      maxWidth: w.width,
    })
    w.y += 24
  }
  w.tableHeader(columns)
  if (content.table.length === 0) {
    w.y += 8
    w.paragraph(content.emptyMessage, { size: 11, color: [0.3, 0.3, 0.3] })
  }
  for (const row of content.table) {
    w.row(
      columns,
      [
        { text: row.day, bold: true },
        { text: row.job || '—', bold: true, lines: row.note ? [row.note] : [] },
        { text: row.time || '—', size: 10, color: [0.36, 0.42, 0.5] },
        { text: row.overtime, bold: true, color: row.declined ? DECLINED : undefined },
      ],
      runningHeading
    )
  }
  w.tableEnd()
  w.totalBox(content.totalLabel, content.totalValue)
  w.footers(content.footer)
  return w.save()
}

export function downloadPdf(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5_000)
}
