/**
 * Rulebook 1.29.0 §25: the overtime report PDF, rebuilt from the saved copy (`overtimeReports/{id}`) — company name and
 * logo, the person, the range, one line per day and job with the final figures (hours only) and the total. The text
 * is `overtimeReportRows`; this file only lays it out with pdf-lib.
 */
import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'pdf-lib'
import { overtimeReportRows, type OvertimeReportSnapshot } from '@/lib/canonical'

const A4: [number, number] = [595.28, 841.89]
const MARGIN = 48

/** Standard fonts cannot draw every character; keep the report readable whatever the job names hold. */
function pdfSafe(text: string): string {
  return String(text ?? '')
    .replace(/[–—]/g, '-')
    .replace(/×/g, 'x')
    .replace(/−/g, '-')
    .replace(/·/g, '|')
    .replace(/[^\x20-\x7E£]/g, '')
}

async function logoImage(pdf: PDFDocument, url: string | null | undefined): Promise<PDFImage | null> {
  if (!url) return null
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    const type = response.headers.get('content-type') || ''
    if (type.includes('png') || /\.png(\?|$)/i.test(url)) return await pdf.embedPng(bytes)
    return await pdf.embedJpg(bytes)
  } catch {
    return null
  }
}

export async function buildOvertimeReportPdf(
  snapshot: Pick<OvertimeReportSnapshot, 'userName' | 'companyName' | 'rangeStart' | 'rangeEnd' | 'lines' | 'totals'>,
  options?: { logoUrl?: string | null }
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const text = overtimeReportRows(snapshot)
  let page = pdf.addPage(A4)
  let y = A4[1] - MARGIN
  const logo = await logoImage(pdf, options?.logoUrl)
  if (logo) {
    const scale = Math.min(120 / logo.width, 48 / logo.height, 1)
    page.drawImage(logo, { x: A4[0] - MARGIN - logo.width * scale, y: y - logo.height * scale + 12, width: logo.width * scale, height: logo.height * scale })
  }
  page.drawText(pdfSafe(snapshot.companyName || ''), { x: MARGIN, y, size: 12, font: bold, color: rgb(0.2, 0.2, 0.2) })
  y -= 28
  page.drawText(pdfSafe(text.title), { x: MARGIN, y, size: 18, font: bold })
  y -= 20
  page.drawText(pdfSafe(text.subtitle), { x: MARGIN, y, size: 11, font, color: rgb(0.35, 0.35, 0.35) })
  y -= 28
  if (text.rows.length === 0) {
    page.drawText('No overtime in this range.', { x: MARGIN, y, size: 11, font })
    y -= 18
  }
  for (const row of text.rows) {
    if (y < MARGIN + 40) {
      page = pdf.addPage(A4)
      y = A4[1] - MARGIN
    }
    page.drawText(pdfSafe(row), { x: MARGIN, y, size: 10.5, font, maxWidth: A4[0] - MARGIN * 2 })
    y -= 18
  }
  y -= 10
  page.drawText(pdfSafe(text.total), { x: MARGIN, y, size: 12, font: bold })
  return pdf.save()
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
