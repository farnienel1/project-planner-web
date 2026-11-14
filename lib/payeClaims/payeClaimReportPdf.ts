/**
 * Rulebook 1.30.0 §26: the price work / expenses report PDF and the frozen PDF copy of a personal site audit, laid out
 * with pdf-lib. The text is the rulebook's (`payeClaimReportRows`, `payeClaimEvidencePages`, `personalSiteAuditPdfRows`);
 * this file only draws it.
 *
 * Report (1.33.0): laid out like the invoice / timesheet PDF (`InvoiceFamilyPdf`) — see `buildPayeClaimReportPdf`.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib'
import { familyLogo, InvoiceFamilyPdf, type FamilyCell, type FamilyColumn } from '@/lib/pdf/invoiceFamilyPdf'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import {
  PAYE_CLAIM_EVIDENCE_NOT_DRAWN_NOTE,
  PAYE_CLAIM_EVIDENCE_UNREADABLE_NOTE,
  payeClaimEvidencePages,
  payeClaimReportRows,
  personalSiteAuditPdfRows,
  type PayeClaimEvidencePage,
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

/** Summary table column widths (fill the 539pt content width), as iOS `PayeClaimReportTable`. */
const PRICE_WORK_WIDTHS = [104, 80, 165, 100, 90]
const EXPENSE_WIDTHS = [96, 96, 252, 95]

/**
 * The report PDF built from a saved copy (1.33.0, owner 6 Nov: the invoice / timesheet family). Page 1 is the
 * summary: the title block with the logo (COMPANY / NAME / GENERATED / PERIOD), the item table (date, job number,
 * name, approver for price work, amount; the description and evidence note under the name), the ITEMS / EVIDENCE
 * counts and the navy total box. Then one page per piece of evidence, headed by its item (name, date, job number,
 * amount) and the evidence's own title — a JPEG / PNG drawn as large as the page allows, a PDF's own pages appended
 * after its heading page, anything else (or a file that cannot be read) listed with a note. Every text is
 * `payeClaimReportRows` / `payeClaimEvidencePages`. `readFile` fetches a stored evidence file (Storage rules apply).
 */
export async function buildPayeClaimReportPdf(
  snapshot: Pick<PayeClaimReportSnapshot, 'kind' | 'userName' | 'companyName' | 'rangeStart' | 'rangeEnd' | 'currency' | 'items' | 'totals'> &
    Partial<Pick<PayeClaimReportSnapshot, 'userId' | 'generatedBy'>> & { generatedAtMs?: number | null },
  options: { logoUrl?: string | null; readFile: (path: string) => Promise<Uint8Array>; timeZone?: string | null; generatedByName?: string | null }
): Promise<{ bytes: Uint8Array; notDrawn: number }> {
  const content = payeClaimReportRows(snapshot, {
    timeZone: options.timeZone || organizationZoneOr(),
    generatedByName: options.generatedByName,
    nowMs: Date.now(),
  })
  const priceWork = snapshot.kind === 'priceWork'
  const w = await InvoiceFamilyPdf.create({ currencyCode: snapshot.currency })
  const pdf = w.pdf
  const logo = await familyLogo(pdf, options.logoUrl)
  const widths = priceWork ? PRICE_WORK_WIDTHS : EXPENSE_WIDTHS
  const columns: FamilyColumn[] = content.columns.map((title, index) => ({
    title,
    width: widths[index] ?? 80,
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
  w.tableHeader(columns)
  if (content.rows.length === 0) {
    w.y += 8
    w.paragraph(content.empty, { size: 11, color: [0.3, 0.3, 0.3] })
  }
  for (const row of content.rows) {
    const under = [row.description, row.evidenceNote].filter(Boolean)
    const cells: FamilyCell[] = [
      { text: row.date, bold: true },
      { text: row.jobNumber || '—', size: 10, color: [0.36, 0.42, 0.5] },
      { text: row.name, bold: true, lines: under },
      ...(priceWork ? [{ text: row.approvedBy || '—', size: 10 }] : []),
      { text: row.amount, bold: true },
    ]
    w.row(columns, cells, () => undefined)
  }
  w.tableEnd()
  w.counts([
    ['ITEMS', String(content.itemCount)],
    ['EVIDENCE', String(content.evidenceCount)],
  ])
  w.totalBox(content.totalLabel, content.totalAmount)

  const notDrawn = await drawClaimEvidencePages(w, payeClaimEvidencePages(snapshot), {
    readFile: options.readFile,
    logo,
    approverLabel: priceWork ? 'Approved by' : null,
  })
  w.footers(content.footer)
  return { bytes: await w.save(), notDrawn }
}

/**
 * One page per piece of evidence (1.30.0 §26, 1.45.0 §8): headed by its item (name, date, job number, amount and, with
 * `approverLabel`, who approved or agreed it — shown only when set) and the evidence's own title, then the description;
 * a JPEG / PNG drawn as large as the page allows, a PDF's own pages appended after its heading page, anything else (or
 * a file that cannot be read) listed with the rulebook's note. `startOnCurrentPage` draws the first one on the writer's
 * current (empty) page. Returns how many could not be drawn.
 */
export async function drawClaimEvidencePages(
  w: InvoiceFamilyPdf,
  pages: ReadonlyArray<PayeClaimEvidencePage>,
  options: { readFile: (path: string) => Promise<Uint8Array>; logo: PDFImage | null; approverLabel: string | null; approverOnlyWhenSet?: boolean; startOnCurrentPage?: boolean }
): Promise<number> {
  const pdf = w.pdf
  let notDrawn = 0
  const note = (text: string) => w.paragraph(text, { size: 10.5, bold: true, color: [0.6, 0.3, 0] })
  let first = true
  for (const page of pages) {
    if (!(first && options.startOnCurrentPage)) w.newPage()
    first = false
    const meta: Array<[string, string]> = [
      ['Date', page.date],
      ['Job number', page.jobNumber],
      ['Amount', page.amount],
    ]
    // `approverOnlyWhenSet`: a timesheet entry shows who agreed it only when it names someone; PAYE price work always.
    if (options.approverLabel && (page.approvedBy || !options.approverOnlyWhenSet)) meta.push([options.approverLabel, page.approvedBy])
    w.titleBlock({ eyebrow: page.evidenceTitle, title: page.itemName, titleSize: 22, brand: false, logo: options.logo, meta, columns: meta.length })
    for (const line of page.notes) w.paragraph(line, { size: 10, color: [0.36, 0.42, 0.5] })
    w.y += 8
    if (page.drawAs === 'listed') {
      notDrawn += 1
      note(PAYE_CLAIM_EVIDENCE_NOT_DRAWN_NOTE)
      continue
    }
    let bytes: Uint8Array
    try {
      bytes = await options.readFile(page.path)
    } catch {
      notDrawn += 1
      note(PAYE_CLAIM_EVIDENCE_UNREADABLE_NOTE)
      continue
    }
    if (page.drawAs === 'image') {
      const image = await embedImage(pdf, bytes, page.contentType, page.name)
      if (image) w.image(image)
      else {
        notDrawn += 1
        note(PAYE_CLAIM_EVIDENCE_NOT_DRAWN_NOTE)
      }
      continue
    }
    try {
      const source = await PDFDocument.load(bytes, { ignoreEncryption: true })
      const copied = await pdf.copyPages(source, source.getPageIndices())
      w.paragraph(copied.length === 1 ? "The file's page follows." : `The file's ${copied.length} pages follow.`, { size: 10, color: [0.36, 0.42, 0.5] })
      for (const copy of copied) pdf.addPage(copy)
    } catch {
      notDrawn += 1
      note(PAYE_CLAIM_EVIDENCE_UNREADABLE_NOTE)
    }
  }
  return notDrawn
}

/**
 * Rulebook 1.45.0 §8: the timesheet invoice with its evidence pages after it — `invoiceBytes` (the invoice PDF as built)
 * followed by one page per piece of evidence (`timesheetEvidencePages`, drawn as the PAYE report draws them; price work
 * shows who agreed it). With no pages the invoice is returned unchanged.
 */
export async function appendTimesheetEvidencePages(
  invoiceBytes: Uint8Array,
  pages: ReadonlyArray<PayeClaimEvidencePage>,
  options: { readFile: (path: string) => Promise<Uint8Array>; currencyCode?: string | null; logoUrl?: string | null; footer: string }
): Promise<{ bytes: Uint8Array; notDrawn: number }> {
  if (pages.length === 0) return { bytes: invoiceBytes, notDrawn: 0 }
  const w = await InvoiceFamilyPdf.create({ currencyCode: options.currencyCode })
  const logo = await familyLogo(w.pdf, options.logoUrl)
  const notDrawn = await drawClaimEvidencePages(w, pages, { readFile: options.readFile, logo, approverLabel: 'Agreed with', approverOnlyWhenSet: true, startOnCurrentPage: true })
  w.footers(options.footer)
  const evidence = await PDFDocument.load(await w.save())
  const merged = await PDFDocument.load(invoiceBytes, { ignoreEncryption: true })
  const copied = await merged.copyPages(evidence, evidence.getPageIndices())
  for (const page of copied) merged.addPage(page)
  return { bytes: await merged.save(), notDrawn }
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
