import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { formatReportPeriodLabel } from '@/lib/weekly-report/invoicingPeriodUtils'
import { currencySymbol } from '@/lib/canonical'
import { weeklyReportGeneratedLabel, weeklyReportSections } from '@/lib/weekly-report/weeklyReportSections'
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
    .replace(/\u2713/g, 'OK')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF\u20AC]/g, '')
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

const AMBER = rgb(0.996, 0.953, 0.78)
const AMBER_INK = rgb(0.57, 0.25, 0.05)

function table(draw: Draw, headers: string[], rows: string[][], options: { weights?: number[]; tones?: ReadonlyArray<string | null> } = {}): void {
  const width = PAGE_W - MARGIN * 2
  const weights = options.weights && options.weights.length === headers.length ? options.weights : headers.map(() => 1)
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  const widths = weights.map((weight) => (width * weight) / sum)
  const xs = widths.map((_, index) => MARGIN + widths.slice(0, index).reduce((a, b) => a + b, 0))
  const rowHeight = 14
  const textWidthOf = (index: number) => Math.max(widths[index] - 6, 8)

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
      draw.page.drawText(fitText(header, draw.bold, 7, textWidthOf(index)), {
        x: xs[index] + 3,
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
    const tone = options.tones?.[rowIndex] ?? null
    const total = tone === 'total' || (!options.tones && row.some((cell) => /total/i.test(cell)))
    const warn = tone === 'warn'
    if (rowIndex % 2 === 1 || total || warn) {
      draw.page.drawRectangle({
        x: MARGIN,
        y: draw.y - rowHeight + 4,
        width,
        height: rowHeight,
        color: warn ? AMBER : total ? rgb(0.9, 0.97, 0.93) : ROW,
      })
    }
    row.forEach((cell, index) => {
      // A check line spans the row from its cell (it is the only text on the row).
      const spans = warn || tone === 'good' ? row.slice(index + 1).every((rest) => rest === '') : false
      const room = spans ? PAGE_W - MARGIN - xs[index] - 6 : textWidthOf(index)
      const clipped = fitText(cell, total || warn ? draw.bold : draw.font, 8, room)
      draw.page.drawText(clipped, {
        x: xs[index] + 3,
        y: draw.y - 7,
        size: 8,
        font: total || warn ? draw.bold : draw.font,
        color: warn ? AMBER_INK : total || tone === 'good' ? GREEN : INK,
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
  const symbol = currencySymbol(data.currencyCode)
  const drawable = /^[\x20-\x7E\xA0-\xFF\u20AC]+$/.test(symbol)
  // Organisation money (`formatMoney`) as Helvetica can draw it : an undrawable symbol becomes the code.
  const pdfCell = (cell: string) => (drawable || !symbol ? cell : cell.split(symbol).join(`${String(data.currencyCode).toUpperCase()} `))
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
  const generatedLabel = weeklyReportGeneratedLabel(data)
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

  // Rulebook 1.51.0 (Q4f): the same sections and rows as the screen, the HTML and the Excel file.
  for (const part of weeklyReportSections(data)) {
    section(draw, part.title)
    const rows = part.rows.length ? part.rows : [[part.empty, ...part.headers.slice(1).map(() => '')]]
    table(draw, part.headers, rows.map((row) => row.map(pdfCell)), { weights: part.weights, tones: part.rows.length ? part.tones : undefined })
    if (part.note) table(draw, [''], [[part.note]])
  }

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
