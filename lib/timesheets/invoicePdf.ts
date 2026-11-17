/**
 * iOS parity source: Views/InvoicingView.swift InvoicePDFBuilder.makePDF
 * Produces a real PDF 1.4 document (A4) so Generate Invoice and manager export
 * download .pdf files the same way iOS does.
 */
import { formatCurrency } from '@/lib/weekly-report/weeklyReportPayroll'
import { currencySymbol, normalizeCurrencyCode } from '@/lib/canonical/money'
import { currentOrganizationCurrency } from '@/lib/stores/organizationDocumentStore'
import { formatPaymentPeriodLine } from '@/lib/timesheets/paymentRunCopy'
import { formatStampInZone } from '@/lib/orgTime/zoneTime'
import type { TimesheetSubject } from '@/lib/timesheets/timesheetWeekUtils'
import type { TimesheetInvoiceLine } from '@/lib/timesheets/timesheetExport'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 28

/**
 * The invoice / timesheet PDF family's look (rulebook 1.33.0, owner 6 Nov): A4 with a 28pt margin, a big navy title
 * over the cyan "Project Planner" line and a navy rule, grey COMPANY / NAME / GENERATED / PERIOD labels, a navy table
 * header, hairline rows and the navy total box. The overtime, price work and expenses report PDFs
 * (`lib/pdf/invoiceFamilyPdf.ts`) draw with these same values so every report reads as one family.
 */
export const INVOICE_PDF_STYLE = {
  pageWidth: PAGE_W,
  pageHeight: PAGE_H,
  margin: MARGIN,
  navy: [0.055, 0.122, 0.2] as const,
  cyan: [0.169, 0.733, 0.937] as const,
  metaLabel: [0.54, 0.54, 0.56] as const,
  slate: [0.36, 0.42, 0.5] as const,
  hairline: [0.93, 0.93, 0.93] as const,
  totalBox: [0.071, 0.149, 0.243] as const,
  muted: [0.3, 0.3, 0.3] as const,
  titleSize: 31,
  brandSize: 10,
  ruleHeight: 1.6,
  metaLabelSize: 9,
  metaValueSize: 12.5,
  metaRowHeight: 40,
  tableHeaderHeight: 24,
  tableHeaderSize: 9.5,
  totalBoxHeight: 46,
} as const

const rgbOf = (color: readonly [number, number, number]) => fill(color[0], color[1], color[2])

export type InvoicePdfContext = {
  organizationName: string
  subject: TimesheetSubject
  weekStart: Date
  weekEnd: Date
  amount: number | null
  vatNumber?: string
  utrNumber?: string
  lines?: TimesheetInvoiceLine[]
  notes?: string[]
  timeZone?: string
  generatedAt?: Date
  documentTitle?: string
  periodMetaLabel?: string
  totalLabel?: string
  emptyStateMessage?: string
  /** Organisation currency (`formatMoney`). Defaults to the open company's. */
  currencyCode?: string
  /** Rulebook 1.55.0: `timesheetInvoiceNumberForRevision` ("TS-20261101-6A9632-REV1"). */
  invoiceNumber?: string
  /** Rulebook 1.55.0: "REV 1 · +£44.12 from the previous version". */
  revisionNote?: string
}

/**
 * Unicode → WinAnsiEncoding (CP1252) byte, the encoding the standard Helvetica fonts are declared with.
 * Latin-1 (160–255) maps to itself; these are the CP1252 extras in 0x80–0x9F.
 */
const WIN_ANSI_EXTRAS: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  'ƒ': 0x83,
  '„': 0x84,
  '…': 0x85,
  '†': 0x86,
  '‡': 0x87,
  'ˆ': 0x88,
  '‰': 0x89,
  'Š': 0x8a,
  '‹': 0x8b,
  'Œ': 0x8c,
  'Ž': 0x8e,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '˜': 0x98,
  '™': 0x99,
  'š': 0x9a,
  '›': 0x9b,
  'œ': 0x9c,
  'ž': 0x9e,
  'Ÿ': 0x9f,
}

function winAnsiByte(char: string): number | null {
  const code = char.codePointAt(0) ?? 32
  if (code >= 32 && code <= 126) return code
  if (code >= 160 && code <= 255) return code
  return WIN_ANSI_EXTRAS[char] ?? null
}

/** True when every character can be drawn by the standard PDF fonts. */
export function winAnsiCanDraw(value: string): boolean {
  for (const char of value) if (winAnsiByte(char) == null) return false
  return true
}

/**
 * £, €, $, CA$, A$, NZ$ and kr draw as-is. A symbol the font cannot draw (zł, د.إ) is replaced by the
 * ISO code: "zł 10.00" → "PLN 10.00".
 */
export function pdfMoneyText(value: string, currencyCode: string): string {
  const code = normalizeCurrencyCode(currencyCode) ?? 'GBP'
  const symbol = currencySymbol(code)
  if (winAnsiCanDraw(symbol)) return value
  const spaced = /\p{L}$/u.test(symbol) ? `${symbol} ` : symbol
  return value.split(spaced).join(`${code} `).split(symbol).join(`${code} `)
}

export function timesheetInvoicePdfFileName(userName: string, generatedAt: Date = new Date()): string {
  const cleaned = userName.replace(/[/\\:?%*|<>"]/g, '-').replace(/\s+/g, '_').trim() || 'Timesheet'
  return `Invoice-${cleaned}-${Math.floor(generatedAt.getTime() / 1000)}.pdf`
}

export function timesheetExportPdfFileName(userName: string, paymentRunStamp: string): string {
  return `${userName} timesheet for payment run date ${paymentRunStamp}.pdf`
}

export function buildTimesheetInvoicePdf(input: InvoicePdfContext): Uint8Array {
  const timeZone = input.timeZone || organizationZoneOr()
  const generatedAt = input.generatedAt || new Date()
  const title = input.documentTitle || 'Invoice'
  const period = formatPaymentPeriodLine(input.weekStart, input.weekEnd, timeZone)
  const generated = formatStampInZone(generatedAt, timeZone)
  const currencyCode = input.currencyCode || currentOrganizationCurrency()
  const money = (value: string) => pdfMoneyText(value, currencyCode)
  const totalText = input.amount != null ? money(formatCurrency(input.amount, currencyCode)) : 'Rate not set'
  const lines = (input.lines || []).map((line) => ({
    ...line,
    details: money(line.details),
    description: money(line.description),
  }))
  const notes = (input.notes || []).map(money)

  const pages: string[] = []
  let stream = ''
  let y = MARGIN

  const flushPage = () => {
    pages.push(stream)
    stream = ''
    y = MARGIN
  }

  const ensure = (need: number) => {
    if (y + need > PAGE_H - 40) flushPage()
  }

  const top = (fromTop: number) => PAGE_H - fromTop

  stream += rgbOf(INVOICE_PDF_STYLE.navy)
  stream += text(title, MARGIN, (y += 31), 31, true)
  stream += rgbOf(INVOICE_PDF_STYLE.cyan)
  stream += text('Project Planner', MARGIN, (y += 14), 10, true)
  y += 12
  stream += rgbOf(INVOICE_PDF_STYLE.navy)
  stream += rect(MARGIN, top(y), PAGE_W - MARGIN * 2, 1.6, true)
  y += 16

  const col = (PAGE_W - MARGIN * 2 - 14) / 2
  const meta = (
    label: string,
    value: string,
    x: number,
    rowY: number
  ) => {
    let chunk = rgbOf(INVOICE_PDF_STYLE.metaLabel)
    chunk += text(label.toUpperCase(), x, rowY, 9, true)
    chunk += rgbOf(INVOICE_PDF_STYLE.navy)
    chunk += text(value, x, rowY + 14, 12.5, true, col)
    return chunk
  }

  stream += meta('Company', input.organizationName, MARGIN, y)
  stream += meta('Name', input.subject.name, MARGIN + col + 14, y)
  y += 40
  stream += meta('Generated', generated, MARGIN, y)
  stream += meta(input.periodMetaLabel || 'INVOICE PERIOD', period, MARGIN + col + 14, y)
  y += 40
  if (input.invoiceNumber || input.revisionNote) {
    if (input.invoiceNumber) stream += meta('Invoice no.', input.invoiceNumber, MARGIN, y)
    if (input.revisionNote) stream += meta('Revision', money(input.revisionNote), MARGIN + col + 14, y)
    y += 40
  }
  if (input.vatNumber) stream += meta('VAT number', input.vatNumber, MARGIN, y)
  if (input.utrNumber) stream += meta('UTR number', input.utrNumber, MARGIN + col + 14, y)
  if (input.vatNumber || input.utrNumber) y += 40
  y += 8

  const tableWidth = PAGE_W - MARGIN * 2
  stream += rgbOf(INVOICE_PDF_STYLE.navy)
  stream += rect(MARGIN, top(y + 24), tableWidth, 24, true)
  stream += fill(1, 1, 1)
  stream += text('Date / Project', MARGIN + 10, y + 16, 9.5, true)
  stream += text('Details', MARGIN + 156, y + 16, 9.5, true)
  stream += text('Amount', MARGIN + tableWidth - 54, y + 16, 9.5, true)
  y += 24

  if (lines.length === 0) {
    y += 12
    stream += fill(0.3, 0.3, 0.3)
    stream += text(input.emptyStateMessage || 'No work entries were found for this invoice period.', MARGIN, y + 12, 11)
    y += 24
  } else {
    for (const line of lines) {
      // 17 Nov (owner): the details wrap onto as many lines as they need — never cut off with "…", so the sum
      // ("0.29 days × £225.00/day = £66.18") is always readable.
      const nameLines = wrapPdfText(line.projectName || line.description, INVOICE_DETAILS_WIDTH, 11.5, true)
      const detailLines = wrapPdfText(line.details || line.description, INVOICE_DETAILS_WIDTH, 9.5)
      // The project name wraps too (review of #363: never over the amount); the details start under its last line.
      const detailsOffset = 34 + 14 * (nameLines.length - 1)
      const rowHeight = Math.max(50, detailsOffset + 12 * (detailLines.length - 1) + 16)
      ensure(rowHeight)
      const detailsTop = y + detailsOffset
      stream += rgbOf(INVOICE_PDF_STYLE.hairline)
      stream += rect(MARGIN, top(y + 0.8), tableWidth, 0.8, true)
      stream += rgbOf(INVOICE_PDF_STYLE.navy)
      stream += text(line.date, MARGIN + 10, y + 18, 10.5, true)
      stream += rgbOf(INVOICE_PDF_STYLE.slate)
      stream += text(line.jobNumber || '—', MARGIN + 10, y + 32, 9.5, false, 70)
      stream += rgbOf(INVOICE_PDF_STYLE.navy)
      nameLines.forEach((name, index) => {
        stream += text(name, MARGIN + 84, y + 18 + 14 * index, 11.5, true)
      })
      stream += rgbOf(INVOICE_PDF_STYLE.slate)
      detailLines.forEach((detail, index) => {
        stream += text(detail, MARGIN + 84, detailsTop + 12 * index, 9.5)
      })
      stream += rgbOf(INVOICE_PDF_STYLE.navy)
      stream += text(money(formatCurrency(line.amount, currencyCode)), MARGIN + tableWidth - 64, y + 26, 11.5, true, 56)
      y += rowHeight
    }
  }

  y += 12
  ensure(46)
  stream += rgbOf(INVOICE_PDF_STYLE.totalBox)
  stream += rect(MARGIN, top(y + 46), tableWidth, 46, true)
  stream += fill(1, 1, 1)
  stream += text(input.totalLabel || 'Total invoice amount', MARGIN + 16, y + 28, 12, true)
  stream += text(totalText, MARGIN + tableWidth - 90, y + 28, 14, true, 74)
  y += 58

  if (notes.length > 0) {
    ensure(24)
    stream += fill(0, 0, 0)
    stream += text('Rate change notes', MARGIN, y + 14, 12, true)
    y += 20
    for (const note of notes) {
      ensure(20)
      stream += fill(0.3, 0.3, 0.3)
      stream += text(`• ${note}`, MARGIN, y + 12, 10, false, tableWidth)
      y += 20
    }
  }

  pages.push(stream)
  return assemblePdf(pages)
}

function fill(r: number, g: number, b: number): string {
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg\n`
}

function rect(x: number, y: number, w: number, h: number, fillShape: boolean): string {
  return `${n(x)} ${n(y)} ${n(w)} ${n(h)} re ${fillShape ? 'f' : 'S'}\n`
}

function text(value: string, x: number, fromTop: number, size: number, bold = false, maxWidth?: number): string {
  const clipped = maxWidth ? clip(value, maxWidth, size, bold) : value
  const y = PAGE_H - fromTop
  const font = bold ? '/F2' : '/F1'
  return `BT ${font} ${n(size)} Tf ${n(x)} ${n(y)} Td (${pdfString(clipped)}) Tj ET\n`
}

/**
 * The width the project name and the details may use: from the details column (x = MARGIN + 84) to 10 pt before the
 * amount (x = MARGIN + tableWidth − 64), less a further 11 pt margin (review of #363: text never runs into the amount).
 */
const INVOICE_DETAILS_WIDTH = 370

/** Helvetica / Helvetica-Bold advance widths (Adobe AFM, 1/1000 em) for ASCII 32–126. */
const HELVETICA_WIDTHS = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584]
const HELVETICA_BOLD_WIDTHS = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584]
/** WinAnsi characters outside ASCII the invoice prints (both weights); anything else is measured as a full em. */
const HELVETICA_EXTRA_WIDTHS: Record<string, number> = { '£': 556, '–': 556, '—': 1000, '×': 584, '…': 1000, '·': 278, '€': 556, '’': 222, '‘': 222 }

/** The printed width in points of `value` at font `size` (Helvetica, or Helvetica-Bold), from the font's own metrics. */
export function pdfTextWidth(value: string, size: number, bold = false): number {
  const table = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS
  let units = 0
  for (const char of String(value ?? '')) {
    const code = char.codePointAt(0) ?? 0
    units += code >= 32 && code <= 126 ? table[code - 32] : HELVETICA_EXTRA_WIDTHS[char] ?? 1000
  }
  return (units * size) / 1000
}

/**
 * Splits text into lines that fit `maxWidth` at font `size`, measured with the font's own metrics (`pdfTextWidth`),
 * at spaces where it can; a word longer than a line is split by character. Never drops a character.
 */
export function wrapPdfText(value: string, maxWidth: number, size: number, bold = false): string[] {
  const fits = (line: string) => pdfTextWidth(line, size, bold) <= maxWidth
  const words = String(value ?? '').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const joined = current ? `${current} ${word}` : word
    if (fits(joined)) {
      current = joined
      continue
    }
    if (current) lines.push(current)
    current = ''
    let rest = word
    while (!fits(rest)) {
      let cut = 1
      while (cut < rest.length && fits(rest.slice(0, cut + 1))) cut += 1
      lines.push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    current = rest
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

function clip(value: string, maxWidth: number, size: number, bold = false): string {
  if (pdfTextWidth(value, size, bold) <= maxWidth) return value
  let cut = value.length
  while (cut > 1 && pdfTextWidth(`${value.slice(0, cut)}…`, size, bold) > maxWidth) cut -= 1
  return `${value.slice(0, cut)}…`
}

function n(value: number): string {
  return value.toFixed(2)
}

function pdfString(value: string): string {
  return winAnsi(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function winAnsi(value: string): string {
  let out = ''
  for (const char of value) {
    const byte = winAnsiByte(char)
    if (byte != null) {
      out += String.fromCharCode(byte)
      continue
    }
    out += '?'
  }
  return out
}

function assemblePdf(pageStreams: string[]): Uint8Array {
  const objects: string[] = []
  const add = (body: string) => {
    objects.push(body)
    return objects.length
  }
  const font1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const font2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const contentIds = pageStreams.map((content) =>
    add(`<< /Length ${latin1(content).length} >>\nstream\n${content}endstream`)
  )
  const pagePlaceholders: number[] = []
  for (let i = 0; i < pageStreams.length; i++) {
    pagePlaceholders.push(
      add(
        `<< /Type /Page /Parent PAGES_ID 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentIds[i]} 0 R /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> >>`
      )
    )
  }
  const pagesId = add(
    `<< /Type /Pages /Kids [ ${pagePlaceholders.map((id) => `${id} 0 R`).join(' ')} ] /Count ${pageStreams.length} >>`
  )
  for (const pageId of pagePlaceholders) {
    objects[pageId - 1] = objects[pageId - 1].replace('PAGES_ID', String(pagesId))
  }
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)

  const chunks: Uint8Array[] = [latin1('%PDF-1.4\n')]
  const offsets = [0]
  let size = chunks[0].length
  for (let i = 0; i < objects.length; i++) {
    offsets.push(size)
    const body = latin1(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`)
    chunks.push(body)
    size += body.length
  }
  const xrefAt = size
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer << /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`
  chunks.push(latin1(xref))
  return concat(chunks)
}

function latin1(value: string): Uint8Array {
  const out = new Uint8Array(value.length)
  for (let i = 0; i < value.length; i++) out[i] = value.charCodeAt(i) & 0xff
  return out
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export function timesheetPdfBlob(bytes: Uint8Array): Blob {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  return new Blob([copy], { type: 'application/pdf' })
}

export function downloadTimesheetPdf(bytes: Uint8Array, filename: string): void {
  const url = URL.createObjectURL(timesheetPdfBlob(bytes))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** iOS InvoiceGeneratedSuccessSheet → UIActivityViewController; download if share is unavailable. */
export async function shareTimesheetPdf(bytes: Uint8Array, filename: string): Promise<void> {
  const file = new File([timesheetPdfBlob(bytes)], filename, { type: 'application/pdf' })
  const data = { files: [file], title: filename }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const allowed = typeof navigator.canShare === 'function' ? navigator.canShare(data) : true
    if (allowed) {
      try {
        await navigator.share(data)
        return
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
      }
    }
  }
  downloadTimesheetPdf(bytes, filename)
}
