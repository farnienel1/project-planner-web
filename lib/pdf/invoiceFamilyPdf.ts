/**
 * Rulebook 1.33.0 (owner 6 Nov: "reports must look like the invoice / timesheet report"): a pdf-lib page writer that
 * draws the invoice / timesheet PDF family's look (`INVOICE_PDF_STYLE` in `lib/timesheets/invoicePdf.ts`) — the title
 * block with the logo, the COMPANY / NAME / GENERATED / PERIOD labels, a navy table header repeated after each page
 * break, hairline rows, the navy total box and a footer with page numbers. The overtime, price work and expenses report
 * PDFs use it; it only places text the rulebook already wrote (no figure, date or label is worked out here).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import { INVOICE_PDF_STYLE, pdfMoneyText, winAnsiCanDraw } from '@/lib/timesheets/invoicePdf'

const S = INVOICE_PDF_STYLE
const PAGE: [number, number] = [S.pageWidth, S.pageHeight]
const FOOTER_SPACE = 30

type Color = readonly [number, number, number]

/** Keeps every character the standard fonts can draw (WinAnsi: £, €, –, ’ …); anything else becomes "?". */
export function familyPdfText(value: string, currencyCode?: string | null): string {
  let out = ''
  for (const char of String(value ?? '').replace(/[\r\t]/g, ' ')) out += char === '\n' || winAnsiCanDraw(char) ? char : '?'
  return currencyCode ? pdfMoneyText(out, currencyCode) : out
}

export type FamilyColumn = { title: string; width: number; align?: 'left' | 'right' }
export type FamilyCell = { text: string; bold?: boolean; size?: number; color?: Color; lines?: string[] }

/** Embeds a PNG or JPEG logo from a URL; null when it cannot be read (the PDF is made without it). */
export async function familyLogo(pdf: PDFDocument, url: string | null | undefined): Promise<PDFImage | null> {
  if (!url) return null
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    const type = response.headers.get('content-type') || ''
    if (type.includes('png') || /\.png(\?|$)/i.test(url) || (bytes[0] === 0x89 && bytes[1] === 0x50)) return await pdf.embedPng(bytes)
    return await pdf.embedJpg(bytes)
  } catch {
    return null
  }
}

export class InvoiceFamilyPdf {
  page!: PDFPage
  /** Distance from the top of the page. */
  y = 0
  /** Pages this writer drew (appended evidence pages get no footer). */
  private readonly ownPages = new Set<PDFPage>()
  private constructor(
    readonly pdf: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
    readonly currencyCode: string | null
  ) {}

  static async create(options?: { currencyCode?: string | null }): Promise<InvoiceFamilyPdf> {
    const pdf = await PDFDocument.create()
    const writer = new InvoiceFamilyPdf(pdf, await pdf.embedFont(StandardFonts.Helvetica), await pdf.embedFont(StandardFonts.HelveticaBold), options?.currencyCode ?? null)
    writer.newPage()
    return writer
  }

  get width(): number {
    return S.pageWidth - S.margin * 2
  }

  get bottom(): number {
    return S.pageHeight - S.margin - FOOTER_SPACE
  }

  newPage(): void {
    this.page = this.pdf.addPage(PAGE)
    this.ownPages.add(this.page)
    this.y = S.margin
  }

  safe(value: string): string {
    return familyPdfText(value, this.currencyCode)
  }

  /** Draws one line of text with its baseline `size` below `top`, clipped with "…" to `maxWidth`. */
  text(value: string, x: number, top: number, options?: { size?: number; bold?: boolean; color?: Color; maxWidth?: number; align?: 'left' | 'right' }) {
    const size = options?.size ?? 10.5
    const font = options?.bold ? this.bold : this.font
    let line = this.safe(value).replace(/\n/g, ' ')
    const maxWidth = options?.maxWidth
    if (maxWidth && font.widthOfTextAtSize(line, size) > maxWidth) {
      while (line.length > 1 && font.widthOfTextAtSize(`${line}…`, size) > maxWidth) line = line.slice(0, -1)
      line = `${line}…`
    }
    const width = font.widthOfTextAtSize(line, size)
    const left = options?.align === 'right' && maxWidth ? x + maxWidth - width : x
    const color = options?.color ?? S.navy
    this.page.drawText(line, { x: left, y: S.pageHeight - top - size, size, font, color: rgb(color[0], color[1], color[2]) })
  }

  /** Word-wrapped lines of `value` at `size` within `width`. */
  wrap(value: string, width: number, options?: { size?: number; bold?: boolean }): string[] {
    const size = options?.size ?? 10.5
    const font = options?.bold ? this.bold : this.font
    const out: string[] = []
    for (const paragraph of this.safe(value).split('\n')) {
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

  rect(x: number, top: number, width: number, height: number, color: Color) {
    this.page.drawRectangle({ x, y: S.pageHeight - top - height, width, height, color: rgb(color[0], color[1], color[2]) })
  }

  /**
   * The invoice title block: the big navy title (with an eyebrow above it when given), "Project Planner", the navy
   * rule and the meta labels in `columns` columns (two for the summary page: COMPANY, NAME / GENERATED, PERIOD).
   */
  titleBlock(input: { title: string; eyebrow?: string; titleSize?: number; brand?: boolean; logo?: PDFImage | null; meta: Array<[string, string]>; columns?: number }) {
    const left = S.margin
    const logo = input.logo
    let logoWidth = 0
    if (logo) {
      const scale = Math.min(150 / logo.width, 44 / logo.height, 1)
      logoWidth = logo.width * scale
      const h = logo.height * scale
      this.page.drawImage(logo, { x: left + this.width - logoWidth, y: S.pageHeight - this.y - (48 + h) / 2, width: logoWidth, height: h })
    }
    const titleWidth = this.width - (logo ? logoWidth + 10 : 0)
    if (input.eyebrow) {
      this.text(input.eyebrow, left, this.y, { size: 10, bold: true, color: S.slate, maxWidth: titleWidth })
      this.y += 16
    }
    const titleSize = input.titleSize ?? S.titleSize
    this.text(input.title, left, this.y, { size: titleSize, bold: true, color: S.navy, maxWidth: titleWidth })
    this.y += titleSize + 5
    if (input.brand !== false) {
      this.text('Project Planner', left, this.y, { size: S.brandSize, bold: true, color: S.cyan })
      this.y += 14
    }
    this.y += 6
    this.rect(left, this.y, this.width, S.ruleHeight, S.navy)
    this.y += 14
    const columns = Math.max(1, input.columns ?? 2)
    const gap = 14
    const columnWidth = (this.width - gap * (columns - 1)) / columns
    input.meta.forEach(([label, value], index) => {
      const column = index % columns
      const x = left + column * (columnWidth + gap)
      this.text(label.toUpperCase(), x, this.y, { size: S.metaLabelSize, bold: true, color: S.metaLabel, maxWidth: columnWidth })
      this.text(value || '—', x, this.y + 13, { size: S.metaValueSize, bold: true, color: S.navy, maxWidth: columnWidth })
      if (column === columns - 1 || index === input.meta.length - 1) this.y += S.metaRowHeight
    })
    this.y += 6
  }

  /** A full-width note band (e.g. the out-of-date mark). */
  banner(value: string, color: Color = [0.7, 0.2, 0.15]) {
    const lines = this.wrap(value, this.width - 20, { size: 10, bold: true })
    const height = lines.length * 14 + 12
    this.rect(S.margin, this.y, this.width, height, [1, 0.94, 0.92])
    lines.forEach((line, index) => this.text(line, S.margin + 10, this.y + 6 + index * 14, { size: 10, bold: true, color }))
    this.y += height + 10
  }

  tableHeader(columns: ReadonlyArray<FamilyColumn>) {
    this.rect(S.margin, this.y, this.width, S.tableHeaderHeight, S.navy)
    let x = S.margin
    for (const column of columns) {
      this.text(column.title, x + 8, this.y + 7.5, { size: S.tableHeaderSize, bold: true, color: [1, 1, 1], maxWidth: column.width - 16, align: column.align })
      x += column.width
    }
    this.y += S.tableHeaderHeight
  }

  /**
   * One hairline row; each cell wraps in its column and may carry smaller grey lines under it. Starts a new page (with
   * the running heading and the table header again) when it does not fit.
   */
  row(columns: ReadonlyArray<FamilyColumn>, cells: ReadonlyArray<FamilyCell>, onNewPage: () => void) {
    const pad = 8
    const laid = cells.map((cell, index) => {
      const width = (columns[index]?.width ?? 60) - pad * 2
      const size = cell.size ?? 10.5
      const main = cell.text ? this.wrap(cell.text, width, { size, bold: cell.bold }) : []
      const extra = (cell.lines ?? []).flatMap((line) => this.wrap(line, width, { size: 9 }))
      return { cell, width, size, main, extra, height: main.length * (size + 3) + extra.length * 12 }
    })
    const height = Math.max(30, Math.max(...laid.map((entry) => entry.height), 0) + 18)
    if (this.y + height > this.bottom) {
      this.newPage()
      onNewPage()
      this.tableHeader(columns)
    }
    this.rect(S.margin, this.y, this.width, 0.8, S.hairline)
    let x = S.margin
    laid.forEach((entry, index) => {
      let top = this.y + 9
      const align = columns[index]?.align
      for (const line of entry.main) {
        this.text(line, x + pad, top, { size: entry.size, bold: entry.cell.bold, color: entry.cell.color ?? S.navy, maxWidth: entry.width, align })
        top += entry.size + 3
      }
      for (const line of entry.extra) {
        this.text(line, x + pad, top, { size: 9, color: S.slate, maxWidth: entry.width, align })
        top += 12
      }
      x += columns[index]?.width ?? 60
    })
    this.y += height
  }

  /** The closing hairline under the last row. */
  tableEnd() {
    this.rect(S.margin, this.y, this.width, 0.8, S.hairline)
    this.y += 12
  }

  /** Small boxes side by side ("ITEMS 3", "EVIDENCE 4"). */
  counts(cells: Array<[string, string]>) {
    const height = 46
    if (this.y + height > this.bottom) this.newPage()
    const gap = 10
    const width = (this.width - gap * (cells.length - 1)) / Math.max(1, cells.length)
    cells.forEach(([label, value], index) => {
      const x = S.margin + index * (width + gap)
      this.rect(x, this.y, width, height, [0.96, 0.97, 0.98])
      this.text(label, x + 14, this.y + 8, { size: 9, bold: true, color: S.metaLabel, maxWidth: width - 28 })
      this.text(value, x + 14, this.y + 21, { size: 15, bold: true, color: S.navy, maxWidth: width - 28 })
    })
    this.y += height + 10
  }

  /** The navy total box: label on the left, the figure on the right. */
  totalBox(label: string, value: string) {
    if (this.y + S.totalBoxHeight > this.bottom) this.newPage()
    this.rect(S.margin, this.y, this.width, S.totalBoxHeight, S.totalBox)
    this.text(label, S.margin + 14, this.y + 16, { size: 11, color: [0.62, 0.72, 0.82], maxWidth: this.width * 0.55 })
    this.text(value, S.margin + this.width * 0.4, this.y + 12, { size: 20, bold: true, color: [1, 1, 1], maxWidth: this.width * 0.6 - 14, align: 'right' })
    this.y += S.totalBoxHeight + 12
  }

  /** Paragraph text that wraps across pages. */
  paragraph(value: string, options?: { size?: number; bold?: boolean; color?: Color }) {
    const size = options?.size ?? 10.5
    for (const line of this.wrap(value, this.width, { size, bold: options?.bold })) {
      if (this.y + size + 4 > this.bottom) this.newPage()
      this.text(line, S.margin, this.y, { size, bold: options?.bold, color: options?.color ?? S.navy })
      this.y += size + 5
    }
  }

  /** Draws an image as large as the rest of the page allows (a new page when little is left), with a hairline frame. */
  image(image: PDFImage) {
    let room = this.bottom - this.y
    if (room < 200) {
      this.newPage()
      room = this.bottom - this.y
    }
    const scale = Math.min(this.width / image.width, room / image.height, 1)
    const w = image.width * scale
    const h = image.height * scale
    const x = S.margin + (this.width - w) / 2
    this.page.drawRectangle({ x: x - 1, y: S.pageHeight - this.y - h - 1, width: w + 2, height: h + 2, borderColor: rgb(...S.hairline), borderWidth: 1 })
    this.page.drawImage(image, { x, y: S.pageHeight - this.y - h, width: w, height: h })
    this.y += h + 12
  }

  /** Writes the footer (left text and "Page n of N") on every page; call last. */
  footers(left: string) {
    const pages = this.pdf.getPages()
    pages.forEach((page, index) => {
      if (!this.ownPages.has(page)) return
      const previous = this.page
      this.page = page
      const top = S.pageHeight - S.margin - 12
      this.rect(S.margin, top - 6, this.width, 0.8, S.hairline)
      this.text(left, S.margin, top, { size: 8.5, color: [0.5, 0.5, 0.5], maxWidth: this.width * 0.7 })
      this.text(`Page ${index + 1} of ${pages.length}`, S.margin + this.width * 0.7, top, { size: 8.5, bold: true, color: [0.5, 0.5, 0.5], maxWidth: this.width * 0.3, align: 'right' })
      this.page = previous
    })
  }

  save(): Promise<Uint8Array> {
    return this.pdf.save()
  }
}
