import { format } from 'date-fns'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { formatReportPeriodLabel } from '@/lib/weekly-report/invoicingPeriodUtils'
import { formatCurrency, formatDays } from '@/lib/weekly-report/weeklyReportPayroll'
import type { WeeklyReportData } from '@/lib/weekly-report/weeklyReportData'

const PAGE_W = 842
const PAGE_H = 595
const MARGIN = 28
const NAVY = rgb(0.059, 0.153, 0.267)
const BLUE = rgb(0.114, 0.306, 0.847)
const WHITE = rgb(1, 1, 1)
const INK = rgb(0.08, 0.11, 0.16)
const GREEN = rgb(0.08, 0.33, 0.18)
const ROW = rgb(0.973, 0.98, 0.988)
const LINE = rgb(0.86, 0.89, 0.93)

function pdfText(value: string): string {
  return value
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
}

type Draw = {
  doc: PDFDocument
  page: PDFPage
  y: number
  font: PDFFont
  bold: PDFFont
}

function addPage(draw: Draw): void {
  draw.page = draw.doc.addPage([PAGE_W, PAGE_H])
  draw.y = PAGE_H - MARGIN
}

function ensure(draw: Draw, height: number): void {
  if (draw.y - height < MARGIN) addPage(draw)
}

function section(draw: Draw, title: string): void {
  ensure(draw, 28)
  draw.y -= 22
  draw.page.drawRectangle({
    x: MARGIN,
    y: draw.y - 4,
    width: PAGE_W - MARGIN * 2,
    height: 18,
    color: BLUE,
  })
  draw.page.drawText(pdfText(title), {
    x: MARGIN + 8,
    y: draw.y,
    size: 10,
    font: draw.bold,
    color: WHITE,
  })
  draw.y -= 16
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = pdfText(text)
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean
  let clipped = clean
  while (clipped.length > 1 && font.widthOfTextAtSize(`${clipped}...`, size) > maxWidth) {
    clipped = clipped.slice(0, -1)
  }
  return clipped ? `${clipped}...` : ''
}

function table(draw: Draw, headers: string[], rows: string[][]): void {
  const width = PAGE_W - MARGIN * 2
  const col = width / Math.max(headers.length, 1)
  const rowHeight = 14
  const textWidth = Math.max(col - 6, 8)

  const paintHeader = () => {
    ensure(draw, rowHeight + 4)
    draw.page.drawRectangle({
      x: MARGIN,
      y: draw.y - rowHeight + 4,
      width,
      height: rowHeight,
      color: NAVY,
    })
    headers.forEach((header, index) => {
      draw.page.drawText(fitText(header, draw.bold, 7, textWidth), {
        x: MARGIN + index * col + 3,
        y: draw.y - 7,
        size: 7,
        font: draw.bold,
        color: WHITE,
      })
    })
    draw.y -= rowHeight
  }

  paintHeader()
  rows.forEach((row, rowIndex) => {
    if (row.every((cell) => cell === '')) {
      draw.y -= 10
      return
    }
    if (draw.y - rowHeight < MARGIN) {
      addPage(draw)
      paintHeader()
    }
    const total = row.some((cell) => /total/i.test(cell))
    if (rowIndex % 2 === 1 || total) {
      draw.page.drawRectangle({
        x: MARGIN,
        y: draw.y - rowHeight + 4,
        width,
        height: rowHeight,
        color: total ? rgb(0.9, 0.97, 0.93) : ROW,
      })
    }
    row.forEach((cell, index) => {
      const clipped = fitText(cell, total ? draw.bold : draw.font, 8, textWidth)
      draw.page.drawText(clipped, {
        x: MARGIN + index * col + 3,
        y: draw.y - 7,
        size: 8,
        font: total ? draw.bold : draw.font,
        color: total ? GREEN : INK,
      })
    })
    draw.page.drawLine({
      start: { x: MARGIN, y: draw.y - rowHeight + 4 },
      end: { x: PAGE_W - MARGIN, y: draw.y - rowHeight + 4 },
      thickness: 0.4,
      color: LINE,
    })
    draw.y -= rowHeight
  })
}

export async function buildWeeklyReportPdf(data: WeeklyReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const draw: Draw = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    y: PAGE_H - MARGIN,
    font,
    bold,
  }

  const periodLabel = formatReportPeriodLabel(data.reportPeriod.start, data.reportPeriod.end)
  const generatedLabel = format(data.generatedAt, "d MMM yyyy 'at' HH:mm")
  draw.page.drawRectangle({ x: 0, y: PAGE_H - 78, width: PAGE_W, height: 78, color: NAVY })
  draw.page.drawText('PROJECTPLANNER', { x: MARGIN, y: PAGE_H - 22, size: 8, font: bold, color: rgb(0.58, 0.77, 0.99) })
  draw.page.drawText(pdfText(data.organizationName || 'Weekly report'), {
    x: MARGIN,
    y: PAGE_H - 40,
    size: 16,
    font: bold,
    color: WHITE,
  })
  draw.page.drawText('WEEKLY REPORT', { x: MARGIN, y: PAGE_H - 56, size: 9, font: bold, color: rgb(0.75, 0.86, 0.99) })
  draw.page.drawText(pdfText(`Period: ${periodLabel}    Invoicing period: ${data.invoicingPeriodLabel}`), {
    x: MARGIN,
    y: PAGE_H - 70,
    size: 8,
    font,
    color: WHITE,
  })
  draw.y = PAGE_H - 96
  draw.page.drawText(pdfText(`Generated ${generatedLabel}`), {
    x: MARGIN,
    y: draw.y,
    size: 8,
    font,
    color: INK,
  })
  draw.y -= 8

  section(draw, 'Warnings Summary')
  table(
    draw,
    ['Status', 'Priority', 'Type', 'Date', 'Description', 'Detail', 'For'],
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
  )

  section(draw, 'Project Breakdown')
  if (data.projectGroups.length === 0) {
    table(draw, ['Project', 'Job No.', 'Person', 'Trade', 'Role', 'Days'], [['No project labour in this period', '', '', '', '', '']])
  } else {
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
      table(draw, ['Project', 'Job No.', 'Person', 'Trade', 'Role', 'Days'], rows)
    }
  }
  table(draw, ['All Project Work', 'Days'], [['All Project Work', formatDays(data.allProjectWorkTotal)]])

  section(draw, 'Sub Contractors')
  const subRows =
    data.subContractorRows.length === 0
      ? [['No sub contractor labour in this period', '', '', '', '', '', '']]
      : data.subContractorRows.map((row) => [
          row.projectName,
          row.jobNumber,
          row.subContractor,
          row.people || '-',
          row.type,
          row.time,
          formatDays(row.days),
        ])
  subRows.push(['', '', '', '', '', 'Sub Contractor total', formatDays(data.subContractorTotal)])
  table(draw, ['Project', 'Job No.', 'Sub Contractor', 'People', 'Type', 'Time', 'Days'], subRows)

  section(draw, 'Annual Leave')
  table(
    draw,
    ['Person', 'Role', 'Days', 'Type'],
    data.annualLeaveRows.length === 0
      ? [['No annual leave in this period', '', '', '']]
      : [
          ...data.annualLeaveRows.map((row) => [row.person, row.role, formatDays(row.days), row.type]),
          ['', 'Annual Leave Total', formatDays(data.annualLeaveTotal), ''],
        ]
  )

  section(draw, 'Manager / Admin Additional Schedule')
  table(
    draw,
    ['Person', 'Role', 'Location', 'Time', 'Days'],
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
  )

  section(draw, 'Price Work')
  table(
    draw,
    ['Person', 'Title', 'Job Number', 'Date', 'Details', 'Amount'],
    data.priceWorkRows.length === 0
      ? [['No price work in this period', '', '', '', '', '']]
      : [
          ...data.priceWorkRows.map((row) => [
            row.person,
            row.title,
            row.jobNumber,
            row.date,
            row.details,
            formatCurrency(row.amount),
          ]),
          ['', '', '', '', 'Price Work Total', formatCurrency(data.priceWorkTotal)],
        ]
  )

  section(draw, 'Expenses')
  table(
    draw,
    ['Person', 'Title', 'Job Number', 'Date', 'Details', 'Amount'],
    data.expenseRows.length === 0
      ? [['No expenses in this period', '', '', '', '', '']]
      : [
          ...data.expenseRows.map((row) => [
            row.person,
            row.title,
            row.jobNumber,
            row.date,
            row.details,
            formatCurrency(row.amount),
          ]),
          ['', '', '', '', 'Expenses Total', formatCurrency(data.expenseTotal)],
        ]
  )

  section(draw, 'Pay Summary')
  const payRows: string[][] = []
  for (const person of data.paySummary) {
    for (const line of person.lines) {
      payRows.push([
        person.person,
        person.role,
        line.rateType,
        line.quantityText ?? formatDays(line.days),
        line.rateText ?? formatCurrency(line.rate),
        formatCurrency(line.pay),
      ])
    }
    payRows.push([`${person.person} total`, '', '', '', '', formatCurrency(person.personTotal)])
    payRows.push(['', '', '', '', '', ''])
  }
  if (data.paySummary.length === 0) {
    payRows.push(['No pay data for this period', '', '', '', '', ''])
  }
  payRows.push(['', '', '', '', 'Grand Total', formatCurrency(data.grandTotal)])
  table(draw, ['Person', 'Role', 'Rate Type', 'Hours / Days', 'Rate', 'Pay'], payRows)

  return doc.save()
}

export function downloadWeeklyReportPdf(bytes: Uint8Array, filename: string): void {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
