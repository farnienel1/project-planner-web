import { format } from 'date-fns'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { userDisplayName, userTradeLabel } from '@/lib/healthSafety/hsPeople'
import { stripPngDataUrl } from '@/lib/signature/signatureImage'
import type { HSToolboxIssue, HSToolboxSignature, HSToolboxTalk, User } from '@/types'

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 26

const NAVY = rgb(0.055, 0.122, 0.2)
const CYAN = rgb(0.169, 0.733, 0.937)
const AMBER = rgb(0.902, 0.624, 0.161)
const INK = rgb(0.086, 0.125, 0.18)
const SLATE = rgb(0.357, 0.42, 0.5)
const LINE = rgb(0.902, 0.933, 0.961)
const BODY = rgb(0.184, 0.243, 0.314)
const LABEL = rgb(0.604, 0.651, 0.706)
const PILL_BLUE_BG = rgb(0.91, 0.94, 1)
const PILL_BLUE = rgb(0.145, 0.388, 0.922)
const PILL_GREY_BG = rgb(0.933, 0.953, 0.976)
const PILL_GREEN_BG = rgb(0.894, 0.969, 0.933)
const PILL_GREEN = rgb(0.102, 0.647, 0.392)
const CARD_BG = rgb(0.965, 0.976, 0.988)
const WHITE = rgb(1, 1, 1)
const REF_MUTED = rgb(0.5, 0.6, 0.72)
const HEADER_MUTED = rgb(0.62, 0.7, 0.81)
const AWAIT = rgb(0.79, 0.635, 0.29)
const RULE = rgb(0.79, 0.84, 0.89)
const ZEBRA = rgb(0.98, 0.988, 0.996)

export type ToolboxTalkPdfInput = {
  talk: HSToolboxTalk
  issue?: HSToolboxIssue | null
  signatures?: HSToolboxSignature[]
  users?: User[]
  projectLabel?: string
}

/** WinAnsi-safe text for the standard PDF fonts. */
export function pdfText(value: string): string {
  return value
    .replace(/\u2018|\u2019|\u2032/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013|\u2014|\u2012/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '')
}

export function looksLikeSiteAuditFile(url: string): boolean {
  return /siteAudits|site-audit|site_audit|SiteAudit/i.test(url)
}

export function isCustomUploadedTalk(talk: Pick<HSToolboxTalk, 'source' | 'fileURL'>): boolean {
  const fileURL = (talk.fileURL || '').trim()
  return talk.source === 'uploaded' && fileURL.length > 0 && !looksLikeSiteAuditFile(fileURL)
}

export function toolboxTalkPdfFilename(talk: Pick<HSToolboxTalk, 'title' | 'id'>, now = Date.now()): string {
  const safe = pdfText(talk.title).replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]+/g, '') || talk.id
  return `ToolboxTalk-${safe}-${Math.floor(now / 1000)}.pdf`
}

export function customTalkDownloadName(fileURL: string, talk: Pick<HSToolboxTalk, 'title' | 'id'>): string {
  let path = fileURL.split('?')[0].split('#')[0]
  try {
    path = new URL(fileURL).pathname
  } catch {
    // Keep the raw path when the stored value is not an absolute URL.
  }
  let decoded = path
  try {
    decoded = decodeURIComponent(path)
  } catch {
    decoded = path
  }
  const last = decoded.split('/').filter(Boolean).pop() || ''
  if (last.includes('.')) return last
  return toolboxTalkPdfFilename(talk)
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = pdfText(text).split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines
}

function fitLine(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const clean = pdfText(text)
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean
  let out = clean
  while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > maxWidth) out = out.slice(0, -1)
  return `${out}...`
}

function decodeSignature(value: string | undefined): Uint8Array | null {
  const raw = stripPngDataUrl(value || '').trim()
  if (!raw) return null
  try {
    const binary = atob(raw)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

type Pen = {
  doc: PDFDocument
  page: PDFPage
  top: number
  font: PDFFont
  bold: PDFFont
}

function contentBottom(): number {
  return PAGE_H - 46
}

function continuePage(pen: Pen, talk: HSToolboxTalk) {
  drawFooter(pen, talk)
  pen.page = pen.doc.addPage([PAGE_W, PAGE_H])
  pen.page.drawRectangle({ x: 0, y: PAGE_H - 36, width: PAGE_W, height: 36, color: NAVY })
  pen.page.drawText('PROJECT ', {
    x: MARGIN,
    y: PAGE_H - 24,
    size: 11,
    font: pen.bold,
    color: WHITE,
  })
  const projectWidth = pen.bold.widthOfTextAtSize('PROJECT ', 11)
  pen.page.drawText('PLANNER', {
    x: MARGIN + projectWidth,
    y: PAGE_H - 24,
    size: 11,
    font: pen.bold,
    color: CYAN,
  })
  pen.top = 52
}

function ensure(pen: Pen, height: number, talk: HSToolboxTalk) {
  if (pen.top + height <= contentBottom()) return
  continuePage(pen, talk)
}

function drawFooter(pen: Pen, talk?: HSToolboxTalk) {
  const page = pen.page
  page.drawRectangle({ x: MARGIN, y: 32, width: PAGE_W - MARGIN * 2, height: 1, color: LINE })
  if (!talk) return
  page.drawText(pdfText(`Generated by Project Planner · ${talk.referenceCode || talk.id} · v${talk.version}`), {
    x: MARGIN,
    y: 16,
    size: 9.5,
    font: pen.font,
    color: LABEL,
  })
}

function drawSectionTitle(pen: Pen, title: string, talk: HSToolboxTalk) {
  ensure(pen, 28, talk)
  pen.page.drawText(title.toUpperCase(), {
    x: MARGIN,
    y: PAGE_H - pen.top - 11,
    size: 11,
    font: pen.bold,
    color: CYAN,
  })
  pen.top += 16
  pen.page.drawRectangle({ x: MARGIN, y: PAGE_H - pen.top - 2, width: PAGE_W - MARGIN * 2, height: 2, color: LINE })
  pen.top += 10
}

function drawPill(
  pen: Pen,
  text: string,
  x: number,
  top: number,
  fill: ReturnType<typeof rgb>,
  textColor: ReturnType<typeof rgb>
): number {
  const label = pdfText(text)
  const width = pen.bold.widthOfTextAtSize(label, 10.5) + 20
  const y = PAGE_H - top - 18
  pen.page.drawRectangle({ x, y, width, height: 18, color: fill })
  pen.page.drawText(label, { x: x + 10, y: y + 5, size: 10.5, font: pen.bold, color: textColor })
  return width
}

export async function buildToolboxTalkPdf(input: ToolboxTalkPdfInput): Promise<Uint8Array> {
  const { talk, issue, signatures = [], users = [] } = input
  const doc = await PDFDocument.create()
  doc.setTitle(pdfText(talk.title))
  doc.setAuthor('Project Planner')
  doc.setSubject(pdfText(`Toolbox talk ${talk.referenceCode || talk.id}`))
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([PAGE_W, PAGE_H])
  const pen: Pen = { doc, page, top: 0, font, bold }

  page.drawRectangle({ x: 0, y: PAGE_H - 92, width: PAGE_W, height: 92, color: NAVY })
  page.drawRectangle({ x: 0, y: PAGE_H - 96, width: PAGE_W, height: 4, color: AMBER })
  page.drawText('PROJECT ', { x: MARGIN, y: PAGE_H - 44, size: 13, font: bold, color: WHITE })
  const brandWidth = bold.widthOfTextAtSize('PROJECT ', 13)
  page.drawText('PLANNER', { x: MARGIN + brandWidth, y: PAGE_H - 44, size: 13, font: bold, color: CYAN })
  page.drawText('TOOLBOX TALK', { x: MARGIN, y: PAGE_H - 64, size: 11, font, color: HEADER_MUTED })
  const ref = pdfText(talk.referenceCode || talk.id)
  page.drawText('REF', { x: PAGE_W - 160, y: PAGE_H - 38, size: 10, font: bold, color: REF_MUTED })
  page.drawText(fitLine(ref, bold, 16, 134), { x: PAGE_W - 160, y: PAGE_H - 58, size: 16, font: bold, color: WHITE })

  pen.top = 114
  const titleLines = wrapLines(talk.title, bold, 22, PAGE_W - MARGIN * 2)
  for (const line of titleLines.slice(0, 3)) {
    ensure(pen, 28, talk)
    pen.page.drawText(line, { x: MARGIN, y: PAGE_H - pen.top - 22, size: 22, font: bold, color: INK })
    pen.top += 26
  }
  pen.top += 8

  const tradeLine = talk.isGeneral || talk.trades.length === 0 ? 'General H&S' : talk.trades.join(', ')
  const status = (talk.status || 'approved').trim()
  const statusLabel = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Approved'
  const pills: Array<[string, ReturnType<typeof rgb>, ReturnType<typeof rgb>]> = [
    [ref, PILL_BLUE_BG, PILL_BLUE],
    [tradeLine, PILL_GREY_BG, SLATE],
    [`v${talk.version || 1}`, PILL_GREY_BG, SLATE],
    [statusLabel, PILL_GREEN_BG, PILL_GREEN],
  ]
  let pillX = MARGIN
  const pillTop = pen.top
  for (const [label, fill, color] of pills) {
    const width = bold.widthOfTextAtSize(pdfText(label), 10.5) + 20
    if (pillX + width > PAGE_W - MARGIN) break
    drawPill(pen, label, pillX, pillTop, fill, color)
    pillX += width + 8
  }
  pen.top += 34

  const projectLabel = pdfText(input.projectLabel || (issue ? 'Project' : 'Library talk'))
  const weekLabel = issue ? `W/C ${format(issue.weekCommencing, 'd MMM yyyy')}` : 'W/C -'
  const cards: Array<[string, string]> = [
    ['PROJECT', projectLabel],
    ['WEEK COMMENCING', weekLabel],
    ['PRESENTED BY', 'Project Planner'],
  ]
  const cardW = (PAGE_W - MARGIN * 2 - 24) / 3
  ensure(pen, 70, talk)
  cards.forEach(([label, value], index) => {
    const x = MARGIN + index * (cardW + 12)
    const y = PAGE_H - pen.top - 58
    pen.page.drawRectangle({ x, y, width: cardW, height: 58, color: CARD_BG, borderColor: LINE, borderWidth: 1 })
    pen.page.drawText(label, { x: x + 10, y: y + 34, size: 9, font: bold, color: LABEL })
    pen.page.drawText(fitLine(value, bold, 12, cardW - 20), { x: x + 10, y: y + 14, size: 12, font: bold, color: INK })
  })
  pen.top += 74

  drawSectionTitle(pen, 'Purpose', talk)
  const purposeLines = wrapLines(talk.purpose || '-', font, 12.5, PAGE_W - MARGIN * 2)
  for (const line of purposeLines) {
    ensure(pen, 16, talk)
    pen.page.drawText(line, { x: MARGIN, y: PAGE_H - pen.top - 12, size: 12.5, font, color: BODY })
    pen.top += 16
  }
  pen.top += 8

  drawSectionTitle(pen, 'Key control points', talk)
  const points = talk.keyPoints.length ? talk.keyPoints : ['-']
  for (const point of points) {
    const lines = wrapLines(point, font, 12, PAGE_W - MARGIN * 2 - 20)
    ensure(pen, lines.length * 15 + 4, talk)
    pen.page.drawCircle({ x: MARGIN + 4, y: PAGE_H - pen.top - 8, size: 3.5, color: CYAN })
    lines.forEach((line, index) => {
      pen.page.drawText(line, {
        x: MARGIN + 16,
        y: PAGE_H - pen.top - 12 - index * 15,
        size: 12,
        font,
        color: BODY,
      })
    })
    pen.top += lines.length * 15 + 6
  }
  pen.top += 6

  drawSectionTitle(pen, 'References', talk)
  ensure(pen, 40, talk)
  const refY = PAGE_H - pen.top - 34
  pen.page.drawRectangle({
    x: MARGIN,
    y: refY,
    width: PAGE_W - MARGIN * 2,
    height: 34,
    color: CARD_BG,
  })
  pen.page.drawRectangle({ x: MARGIN, y: refY, width: 3, height: 34, color: AMBER })
  pen.page.drawText('Master RAMS  ·  Relevant legislation  ·  Permit to Work (where applicable)', {
    x: MARGIN + 12,
    y: refY + 12,
    size: 11,
    font,
    color: SLATE,
  })
  pen.top += 48

  ensure(pen, 24, talk)
  pen.page.drawText('ATTENDEE SIGN-OFF', {
    x: MARGIN,
    y: PAGE_H - pen.top - 12,
    size: 11,
    font: bold,
    color: INK,
  })
  pen.top += 20

  const tableW = PAGE_W - MARGIN * 2
  const colW = [tableW * 0.26, tableW * 0.2, tableW * 0.34, tableW * 0.2]
  const headers = ['NAME', 'TRADE', 'SIGNATURE', 'DATE & TIME']
  const rowH = 32

  const drawHeader = () => {
    ensure(pen, rowH + 4, talk)
    const y = PAGE_H - pen.top - rowH
    pen.page.drawRectangle({ x: MARGIN, y, width: tableW, height: rowH, color: NAVY })
    let hx = MARGIN + 8
    headers.forEach((header, index) => {
      pen.page.drawText(header, { x: hx, y: y + 11, size: 8.5, font: bold, color: WHITE })
      hx += colW[index]
    })
    pen.top += rowH
  }
  drawHeader()

  const sorted = [...signatures].sort((a, b) => (b.signedAt?.getTime() || 0) - (a.signedAt?.getTime() || 0))
  const rowCount = Math.max(sorted.length, 2)
  for (let index = 0; index < rowCount; index += 1) {
    if (pen.top + rowH > contentBottom()) {
      continuePage(pen, talk)
      drawHeader()
    }
    const y = PAGE_H - pen.top - rowH
    if (index % 2 === 1) {
      pen.page.drawRectangle({ x: MARGIN, y, width: tableW, height: rowH, color: ZEBRA })
    }
    pen.page.drawRectangle({
      x: MARGIN,
      y,
      width: tableW,
      height: rowH,
      borderColor: LINE,
      borderWidth: 0.6,
    })
    let cx = MARGIN
    for (const width of colW.slice(0, -1)) {
      cx += width
      pen.page.drawRectangle({ x: cx, y, width: 0.6, height: rowH, color: LINE })
    }
    const signature = sorted[index]
    if (signature) {
      const user = users.find((entry) => entry.id === signature.userId)
      const name = user ? userDisplayName(user) : signature.userId
      const trade = user ? userTradeLabel(user) : ''
      const tradeText = trade === 'General' && !user?.tradeTypePreset && !user?.tradeTypeCustom ? '' : trade === '—' ? '' : trade
      const signed = signature.status === 'signed'
      const when = signature.signedAt ? format(signature.signedAt, 'd MMM yyyy, HH:mm') : 'Awaiting'
      pen.page.drawText(fitLine(name, bold, 10, colW[0] - 14), {
        x: MARGIN + 8,
        y: y + 11,
        size: 10,
        font: bold,
        color: INK,
      })
      pen.page.drawText(fitLine(tradeText, font, 10, colW[1] - 14), {
        x: MARGIN + colW[0] + 8,
        y: y + 11,
        size: 10,
        font,
        color: SLATE,
      })
      const imageBytes = signed ? decodeSignature(signature.signatureImageBase64) : null
      if (imageBytes) {
        try {
          const image = await doc.embedPng(imageBytes)
          const maxW = colW[2] - 16
          const maxH = rowH - 8
          const scale = Math.min(maxW / image.width, maxH / image.height, 1)
          const w = image.width * scale
          const h = image.height * scale
          pen.page.drawImage(image, {
            x: MARGIN + colW[0] + colW[1] + 8,
            y: y + (rowH - h) / 2,
            width: w,
            height: h,
          })
        } catch {
          pen.page.drawRectangle({
            x: MARGIN + colW[0] + colW[1] + 8,
            y: y + rowH / 2,
            width: colW[2] - 16,
            height: 0.8,
            color: RULE,
          })
        }
      } else {
        pen.page.drawRectangle({
          x: MARGIN + colW[0] + colW[1] + 8,
          y: y + rowH / 2,
          width: colW[2] - 16,
          height: 0.8,
          color: RULE,
        })
      }
      pen.page.drawText(fitLine(when, font, 9, colW[3] - 12), {
        x: MARGIN + colW[0] + colW[1] + colW[2] + 6,
        y: y + 12,
        size: 9,
        font,
        color: signed ? SLATE : AWAIT,
      })
    }
    pen.top += rowH
  }

  const signedCount = sorted.filter((signature) => signature.status === 'signed').length
  ensure(pen, 20, talk)
  pen.page.drawText(`${signedCount} of ${Math.max(sorted.length, 1)} operatives signed.`, {
    x: MARGIN,
    y: PAGE_H - pen.top - 14,
    size: 10.5,
    font: bold,
    color: SLATE,
  })
  drawFooter(pen, talk)
  return doc.save()
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function downloadPdfFile(bytes: Uint8Array, filename: string): void {
  const copy = new Uint8Array(bytes)
  const blob = new Blob([copy.buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const name = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  triggerDownload(url, name)
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function downloadRemoteFile(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Could not fetch the file')
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    triggerDownload(objectUrl, filename)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
