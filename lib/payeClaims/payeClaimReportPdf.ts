/**
 * Rulebook 1.30.0 §26: the price work / expenses report PDF and the frozen PDF copy of a personal site audit, laid out
 * with pdf-lib. The text is the rulebook's (`payeClaimReportRows`, `payeClaimEvidencePages`, `personalSiteAuditPdfRows`);
 * this file only draws it.
 *
 * Report: page 1 is the summary (company name and logo, the person, the range, every item with its figure, the
 * total); then one page per piece of evidence with its heading and details at the top — a JPEG / PNG drawn as large
 * as the page allows, a PDF's own pages appended after its heading page, anything else (or a file that cannot be read)
 * listed with a note.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import {
  PAYE_CLAIM_EVIDENCE_NOT_DRAWN_NOTE,
  PAYE_CLAIM_EVIDENCE_UNREADABLE_NOTE,
  payeClaimEvidencePages,
  payeClaimReportRows,
  personalSiteAuditPdfRows,
  type PayeClaimReportSnapshot,
  type PersonalSiteAudit,
} from '@/lib/canonical'

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 48

/** Standard fonts cannot draw every character; keep the PDF readable whatever the names hold. */
export function pdfSafe(text: string): string {
  return String(text ?? '')
    .replace(/[–—]/g, '-')
    .replace(/×/g, 'x')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/·/g, '|')
    .replace(/€/g, 'EUR ')
    .replace(/[^\x20-\x7E£]/g, '')
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = []
  for (const paragraph of pdfSafe(text).split(/\n/)) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next
      else {
        out.push(line)
        line = word
      }
    }
    out.push(line)
  }
  return out
}

class Writer {
  page: PDFPage
  y: number
  constructor(
    readonly pdf: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont
  ) {
    this.page = pdf.addPage(A4)
    this.y = A4[1] - MARGIN
  }
  newPage() {
    this.page = this.pdf.addPage(A4)
    this.y = A4[1] - MARGIN
  }
  text(value: string, options?: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number }) {
    const size = options?.size ?? 10.5
    const font = options?.bold ? this.bold : this.font
    for (const line of wrap(value, font, size, A4[0] - MARGIN * 2)) {
      if (this.y < MARGIN + size) this.newPage()
      this.page.drawText(line, { x: MARGIN, y: this.y, size, font, color: rgb(...(options?.color ?? [0, 0, 0])) })
      this.y -= size + 5
    }
    this.y -= options?.gap ?? 0
  }
  /** Draws an image scaled to fit the space left on the page (a new page when little is left). */
  image(image: PDFImage) {
    let room = this.y - MARGIN
    if (room < 200) {
      this.newPage()
      room = this.y - MARGIN
    }
    const width = A4[0] - MARGIN * 2
    const scale = Math.min(width / image.width, room / image.height, 1)
    const w = image.width * scale
    const h = image.height * scale
    this.page.drawImage(image, { x: MARGIN, y: this.y - h, width: w, height: h })
    this.y -= h + 12
  }
}

async function embedImage(pdf: PDFDocument, bytes: Uint8Array, contentType: string, name: string): Promise<PDFImage | null> {
  try {
    const png = contentType.includes('png') || /\.png$/i.test(name) || (bytes[0] === 0x89 && bytes[1] === 0x50)
    return png ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
  } catch {
    return null
  }
}

async function logoImage(pdf: PDFDocument, url: string | null | undefined): Promise<PDFImage | null> {
  if (!url) return null
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    return await embedImage(pdf, bytes, response.headers.get('content-type') || '', url)
  } catch {
    return null
  }
}

/** The report PDF built from a saved copy. `readFile` fetches a stored evidence file (Storage rules apply). */
export async function buildPayeClaimReportPdf(
  snapshot: Pick<PayeClaimReportSnapshot, 'kind' | 'userName' | 'companyName' | 'rangeStart' | 'rangeEnd' | 'currency' | 'items' | 'totals'>,
  options: { logoUrl?: string | null; readFile: (path: string) => Promise<Uint8Array> }
): Promise<{ bytes: Uint8Array; notDrawn: number }> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const w = new Writer(pdf, font, bold)
  const text = payeClaimReportRows(snapshot)
  const logo = await logoImage(pdf, options.logoUrl)
  if (logo) {
    const scale = Math.min(120 / logo.width, 48 / logo.height, 1)
    w.page.drawImage(logo, { x: A4[0] - MARGIN - logo.width * scale, y: w.y - logo.height * scale + 12, width: logo.width * scale, height: logo.height * scale })
  }
  w.text(snapshot.companyName || '', { size: 12, bold: true, color: [0.2, 0.2, 0.2], gap: 10 })
  w.text(text.title, { size: 18, bold: true })
  w.text(text.subtitle, { size: 11, color: [0.35, 0.35, 0.35], gap: 14 })
  if (text.rows.length === 0) w.text(text.empty)
  for (const row of text.rows) {
    w.text(`${row.heading}   ${row.figure}`, { bold: true })
    for (const line of row.lines) w.text(line, { size: 9.5, color: [0.3, 0.3, 0.3] })
    w.y -= 6
  }
  w.y -= 6
  w.text(text.total, { size: 12, bold: true })

  let notDrawn = 0
  for (const page of payeClaimEvidencePages(snapshot)) {
    w.newPage()
    w.text(page.heading, { size: 13, bold: true })
    for (const line of page.details) w.text(line, { size: 10, color: [0.3, 0.3, 0.3] })
    w.y -= 8
    if (page.drawAs === 'listed') {
      notDrawn += 1
      w.text(PAYE_CLAIM_EVIDENCE_NOT_DRAWN_NOTE, { color: [0.6, 0.3, 0] })
      continue
    }
    let bytes: Uint8Array
    try {
      bytes = await options.readFile(page.path)
    } catch {
      notDrawn += 1
      w.text(PAYE_CLAIM_EVIDENCE_UNREADABLE_NOTE, { color: [0.6, 0.3, 0] })
      continue
    }
    if (page.drawAs === 'image') {
      const image = await embedImage(pdf, bytes, page.contentType, page.name)
      if (image) w.image(image)
      else {
        notDrawn += 1
        w.text(PAYE_CLAIM_EVIDENCE_NOT_DRAWN_NOTE, { color: [0.6, 0.3, 0] })
      }
      continue
    }
    try {
      const source = await PDFDocument.load(bytes, { ignoreEncryption: true })
      const copied = await pdf.copyPages(source, source.getPageIndices())
      for (const copy of copied) pdf.addPage(copy)
    } catch {
      notDrawn += 1
      w.text(PAYE_CLAIM_EVIDENCE_UNREADABLE_NOTE, { color: [0.6, 0.3, 0] })
    }
  }
  return { bytes: await pdf.save(), notDrawn }
}

/** The frozen PDF copy of a personal site audit (attached as evidence). `readFile` fetches each photo by path. */
export async function buildPersonalSiteAuditPdf(
  audit: PersonalSiteAudit,
  options: { timeZone?: string | null; readFile: (path: string) => Promise<Uint8Array> }
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const w = new Writer(pdf, font, bold)
  const rows = personalSiteAuditPdfRows(audit, { timeZone: options.timeZone })
  w.text(rows.title, { size: 18, bold: true, gap: 6 })
  for (const line of rows.lines) w.text(line, { size: 11 })
  for (const item of rows.items) {
    w.y -= 10
    w.text(item.heading, { size: 12, bold: true })
    for (const line of item.lines) w.text(line, { size: 10, color: [0.3, 0.3, 0.3] })
    if (!item.imagePath) continue
    try {
      const bytes = await options.readFile(item.imagePath)
      const image = await embedImage(pdf, bytes, '', item.imagePath)
      if (image) w.image(image)
    } catch {
      w.text(PAYE_CLAIM_EVIDENCE_UNREADABLE_NOTE, { size: 9, color: [0.6, 0.3, 0] })
    }
  }
  return pdf.save()
}
