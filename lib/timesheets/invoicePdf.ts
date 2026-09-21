/**
 * iOS parity source: Views/InvoicingView.swift InvoicePDFBuilder.makePDF
 * Produces a real PDF 1.4 document (A4) so Generate Invoice and manager export
 * download .pdf files the same way iOS does.
 */
import { formatCurrency } from '@/lib/weekly-report/weeklyReportPayroll'
import { formatPaymentPeriodLine } from '@/lib/timesheets/paymentRunCopy'
import { formatStampInZone } from '@/lib/orgTime/zoneTime'
import type { TimesheetSubject } from '@/lib/timesheets/timesheetWeekUtils'
import type { TimesheetInvoiceLine } from '@/lib/timesheets/timesheetExport'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 28

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
}

export function timesheetInvoicePdfFileName(userName: string, generatedAt: Date = new Date()): string {
  const cleaned = userName.replace(/[/\\:?%*|<>"]/g, '-').replace(/\s+/g, '_').trim() || 'Timesheet'
  return `Invoice-${cleaned}-${Math.floor(generatedAt.getTime() / 1000)}.pdf`
}

export function timesheetExportPdfFileName(userName: string, paymentRunStamp: string): string {
  return `${userName} timesheet for payment run date ${paymentRunStamp}.pdf`
}

export function buildTimesheetInvoicePdf(input: InvoicePdfContext): Uint8Array {
  const timeZone = input.timeZone || 'Europe/London'
  const generatedAt = input.generatedAt || new Date()
  const title = input.documentTitle || 'Invoice'
  const period = formatPaymentPeriodLine(input.weekStart, input.weekEnd, timeZone)
  const generated = formatStampInZone(generatedAt, timeZone)
  const totalText = input.amount != null ? formatCurrency(input.amount) : 'Rate not set'
  const lines = input.lines || []
  const notes = input.notes || []

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

  stream += fill(0.055, 0.122, 0.2)
  stream += text(title, MARGIN, (y += 31), 31, true)
  stream += fill(0.169, 0.733, 0.937)
  stream += text('Project Planner', MARGIN, (y += 14), 10, true)
  y += 12
  stream += fill(0.055, 0.122, 0.2)
  stream += rect(MARGIN, top(y), PAGE_W - MARGIN * 2, 1.6, true)
  y += 16

  const col = (PAGE_W - MARGIN * 2 - 14) / 2
  const meta = (
    label: string,
    value: string,
    x: number,
    rowY: number
  ) => {
    let chunk = fill(0.54, 0.54, 0.56)
    chunk += text(label.toUpperCase(), x, rowY, 9, true)
    chunk += fill(0.055, 0.122, 0.2)
    chunk += text(value, x, rowY + 14, 12.5, true, col)
    return chunk
  }

  stream += meta('Company', input.organizationName, MARGIN, y)
  stream += meta('Name', input.subject.name, MARGIN + col + 14, y)
  y += 40
  stream += meta('Generated', generated, MARGIN, y)
  stream += meta(input.periodMetaLabel || 'INVOICE PERIOD', period, MARGIN + col + 14, y)
  y += 40
  if (input.vatNumber) stream += meta('VAT number', input.vatNumber, MARGIN, y)
  if (input.utrNumber) stream += meta('UTR number', input.utrNumber, MARGIN + col + 14, y)
  if (input.vatNumber || input.utrNumber) y += 40
  y += 8

  const tableWidth = PAGE_W - MARGIN * 2
  stream += fill(0.055, 0.122, 0.2)
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
      ensure(50)
      stream += fill(0.93, 0.93, 0.93)
      stream += rect(MARGIN, top(y + 0.8), tableWidth, 0.8, true)
      stream += fill(0.055, 0.122, 0.2)
      stream += text(line.date, MARGIN + 10, y + 18, 10.5, true)
      stream += fill(0.36, 0.42, 0.5)
      stream += text(line.jobNumber || '—', MARGIN + 10, y + 32, 9.5)
      stream += fill(0.055, 0.122, 0.2)
      stream += text(line.projectName || line.description, MARGIN + 84, y + 18, 11.5, true, 190)
      stream += fill(0.36, 0.42, 0.5)
      stream += text(line.details || line.description, MARGIN + 84, y + 34, 9.5, false, 190)
      stream += fill(0.055, 0.122, 0.2)
      stream += text(formatCurrency(line.amount), MARGIN + tableWidth - 64, y + 26, 11.5, true, 56)
      y += 50
    }
  }

  y += 12
  ensure(46)
  stream += fill(0.071, 0.149, 0.243)
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
  const clipped = maxWidth ? clip(value, maxWidth, size) : value
  const y = PAGE_H - fromTop
  const font = bold ? '/F2' : '/F1'
  return `BT ${font} ${n(size)} Tf ${n(x)} ${n(y)} Td (${pdfString(clipped)}) Tj ET\n`
}

function clip(value: string, maxWidth: number, size: number): string {
  const maxChars = Math.max(8, Math.floor(maxWidth / (size * 0.5)))
  if (value.length <= maxChars) return value
  return `${value.slice(0, maxChars - 1)}…`
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
    const code = char.codePointAt(0) || 32
    if (char === '£') {
      out += String.fromCharCode(0xa3)
      continue
    }
    if (char === '–' || char === '—') {
      out += '-'
      continue
    }
    if (char === '•') {
      out += String.fromCharCode(0xb7)
      continue
    }
    if (code === 0x2026) {
      out += '...'
      continue
    }
    if (code >= 32 && code <= 126) {
      out += char
      continue
    }
    if (code >= 160 && code <= 255) {
      out += String.fromCharCode(code)
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
  const font1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const font2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')
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
