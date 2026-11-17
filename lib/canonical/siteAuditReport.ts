/**
 * Rulebook 1.61.0 §29 — the site audit report (owner decisions 17 Nov).
 *
 * ONE layout for every platform: `siteAuditReportLayout` returns each page as a list of drawing operations (text at
 * a position, rectangles, lines, circles and photo boxes). Web draws them with pdf-lib and iOS with UIKit, both in
 * Helvetica / Helvetica-Bold, so the two PDFs have the same fields, labels, order, wrapped lines, page breaks, page
 * numbers and photo sizes. Lines are wrapped here with the standard Helvetica widths (`siteAuditReportFont.ts`).
 *
 * Nothing is ever clipped: cards grow to fit every field, a card taller than the space left flows onto the next page
 * line by line ("continued"), and a long unbroken word or URL breaks by character. Characters the standard PDF
 * fonts cannot draw (emoji, non-Latin scripts) print as "?" on both apps; accented Latin letters print as they are,
 * or without the accent where the font has no glyph (`siteAuditReportText`).
 *
 * Coordinates are PDF points with the origin at the TOP-left of the page and y growing down. A text op's `baseline`
 * is the y of its baseline; web draws at `pageHeight - baseline`, iOS at `baseline - font.ascender`.
 */
import { HELVETICA_BOLD_WIDTHS, HELVETICA_WIDTHS } from './siteAuditReportFont'
import { partsInZone } from '../orgTime/zoneTime'
import { zoneOrLondon } from './dayKeys'
import { SITE_AUDIT_REPORT_FIXTURE_INPUTS } from './siteAuditReportFixtureInputs'
import { SITE_AUDIT_REPORT_FIXTURE_EXPECTED } from './siteAuditReportFixture'

// MARK: - Field limits (owner decision 17 Nov: new edits only; stored text is never cut)

/** Maximum characters for a NEW edit of each field. Stored text that is longer is read and printed whole. */
export const SITE_AUDIT_FIELD_LIMITS = {
  title: 120,
  location: 120,
  assignee: 80,
  comments: 2000,
  annotations: 2000,
  customTitle: 120,
} as const

export type SiteAuditLimitedField = keyof typeof SITE_AUDIT_FIELD_LIMITS

/** The editor labels (owner decision 17 Nov, Q2: "Location" everywhere). */
export const SITE_AUDIT_FIELD_LABELS: Readonly<Record<SiteAuditLimitedField, string>> = {
  title: 'Title',
  location: 'Location',
  assignee: 'Assignee',
  comments: 'Comments',
  annotations: 'Annotations',
  customTitle: 'Title (optional)',
}

/** Characters counted the way a person sees them (an emoji is one), on both apps. */
export function siteAuditFieldLength(value: unknown): number {
  return Array.from(String(value ?? '')).length
}

/**
 * The live counter under an editor field: "34 / 120". `over` is true only when the text is longer than the limit;
 * `changed` false (an unchanged stored value) never blocks a save.
 */
export function siteAuditFieldCounter(
  field: SiteAuditLimitedField,
  value: unknown,
  options?: { stored?: unknown } | null
): { count: number; max: number; label: string; over: boolean; blocksSave: boolean } {
  const max = SITE_AUDIT_FIELD_LIMITS[field]
  const count = siteAuditFieldLength(value)
  const over = count > max
  const unchanged = options?.stored !== undefined && String(options.stored ?? '') === String(value ?? '')
  return { count, max, label: `${count} / ${max}`, over, blocksSave: over && !unchanged }
}

/**
 * Null when the edit may be saved, else the message. A field whose text is unchanged from what is stored passes
 * whatever its length (guardrail 3: older text is never refused or cut).
 */
export function siteAuditFieldLimitError(
  fields: Partial<Record<SiteAuditLimitedField, unknown>>,
  stored?: Partial<Record<SiteAuditLimitedField, unknown>> | null
): string | null {
  for (const field of Object.keys(SITE_AUDIT_FIELD_LIMITS) as SiteAuditLimitedField[]) {
    if (!(field in fields)) continue
    const counter = siteAuditFieldCounter(field, fields[field], stored && field in stored ? { stored: stored[field] } : null)
    if (counter.blocksSave) {
      return `${SITE_AUDIT_FIELD_LABELS[field]} can be up to ${counter.max} characters (${counter.count} now).`
    }
  }
  return null
}

// MARK: - Text and widths

function parseWidths(table: string): Map<number, number> {
  const map = new Map<number, number>()
  for (const pair of table.split(',')) {
    const [code, width] = pair.split(':')
    map.set(parseInt(code, 16), Number(width))
  }
  return map
}

let regularWidths: Map<number, number> | null = null
let boldWidths: Map<number, number> | null = null
function widthTable(bold: boolean): Map<number, number> {
  if (bold) return (boldWidths ??= parseWidths(HELVETICA_BOLD_WIDTHS))
  return (regularWidths ??= parseWidths(HELVETICA_WIDTHS))
}

const EXTRA_LATIN: Readonly<Record<string, string>> = { ł: 'l', Ł: 'L', đ: 'd', Đ: 'D', ħ: 'h', Ħ: 'H', ı: 'i', ø: 'ø', Ø: 'Ø' }

/**
 * Text as the report prints it: NFC, line breaks kept, tabs as a space, and every character the standard PDF fonts
 * cannot draw replaced — an accented letter by its base letter, anything else by "?". Never drops a character.
 */
export function siteAuditReportText(value: unknown): string {
  const table = widthTable(false)
  const source = String(value ?? '').normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ')
  let out = ''
  for (const ch of Array.from(source)) {
    if (ch === '\n') {
      out += ch
      continue
    }
    const code = ch.codePointAt(0) ?? 0
    if (code < 0x20) {
      out += ' '
      continue
    }
    if (table.has(code)) {
      out += ch
      continue
    }
    const mapped = EXTRA_LATIN[ch]
    if (mapped && table.has(mapped.codePointAt(0) ?? 0)) {
      out += mapped
      continue
    }
    const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
    if (base && Array.from(base).every((c) => table.has(c.codePointAt(0) ?? 0))) {
      out += base
      continue
    }
    out += '?'
  }
  return out
}

/** Width in points of report text (already passed through `siteAuditReportText`). */
export function siteAuditReportTextWidth(text: string, size: number, bold = false): number {
  const table = widthTable(bold)
  let units = 0
  for (const ch of Array.from(text)) units += table.get(ch.codePointAt(0) ?? 0) ?? 556
  return (units * size) / 1000
}

/**
 * Wrap report text to `maxWidth`: words greedily, a word wider than the line broken by character, every line break
 * and blank line kept. Never returns fewer characters than it was given (spaces at a wrap point are the only thing
 * not printed). An empty text is one empty line.
 */
export function wrapSiteAuditReportText(value: unknown, size: number, maxWidth: number, bold = false): string[] {
  const text = siteAuditReportText(value)
  const fits = (line: string) => siteAuditReportTextWidth(line, size, bold) <= maxWidth + 0.01
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ')
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (fits(candidate)) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      line = ''
      if (fits(word)) {
        line = word
        continue
      }
      // A word or URL longer than the line: break it by character.
      let piece = ''
      for (const ch of Array.from(word)) {
        if (piece && !fits(piece + ch)) {
          lines.push(piece)
          piece = ch
        } else {
          piece += ch
        }
      }
      line = piece
    }
    lines.push(line)
  }
  return lines
}

// MARK: - Layout

/** The header of a card's next part when its fields flow onto another page (the title is printed in full on the first part). */
export const SITE_AUDIT_REPORT_CONTINUED = 'Continued from the previous page'

export const SITE_AUDIT_REPORT_PAGE = { width: 595.28, height: 841.89 } as const

const MARGIN = 32
const CONTENT_TOP = 28
const FOOTER_TOP = SITE_AUDIT_REPORT_PAGE.height - 60
const BODY_BOTTOM = FOOTER_TOP - 10
const PHOTO_COLUMN = 200
const PHOTO_MAX = 240
const ASCENT = 0.718

export const SITE_AUDIT_REPORT_COLORS = {
  ink: '#0B1020',
  muted: '#6B7280',
  white: '#FFFFFF',
  whiteSoft: '#D9DCE3',
  navy: '#0B1020',
  navy2: '#1A2447',
  accent: '#185FA5',
  border: '#EEF0F3',
  soft: '#F7F8FA',
} as const

export type SiteAuditReportOp =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; fill?: string; stroke?: string; radius?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; color: string; width: number; dash?: [number, number] }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string }
  | { kind: 'text'; x: number; baseline: number; size: number; bold: boolean; color: string; text: string }
  /** A photo (or the logo) drawn whole into this box: the box already has the image's aspect ratio. */
  | { kind: 'image'; ref: string; x: number; y: number; w: number; h: number }

export type SiteAuditReportPage = { number: number; ops: SiteAuditReportOp[] }

export type SiteAuditReportItemInput = {
  id: string
  title?: unknown
  location?: unknown
  assignee?: unknown
  comments?: unknown
  annotations?: unknown
  imageCapturedAtMs?: number | null
  createdAtMs?: number | null
  /** The photo's pixel size; null when the item has no photo or it could not be loaded. */
  photo?: { width: number; height: number } | null
}

export type SiteAuditReportInput = {
  audit: {
    id?: string
    projectJobNumber?: unknown
    projectName?: unknown
    type?: unknown
    customTitle?: unknown
    authorName?: unknown
    dateMs?: number | null
    createdAtMs?: number | null
    items: ReadonlyArray<SiteAuditReportItemInput>
  }
  organizationName?: string | null
  clientName?: string | null
  siteAddress?: string | null
  logo?: { width: number; height: number } | null
  timeZone?: string | null
}

export type SiteAuditReportLayout = {
  page: { width: number; height: number }
  pages: SiteAuditReportPage[]
  fileName: string
  reference: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')
const str = (value: unknown) => (typeof value === 'string' ? value : value == null ? '' : String(value)).trim()

function dateText(ms: number | null | undefined, zone: string, withTime = false): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  const p = partsInZone(new Date(ms), zone)
  const day = `${p.d} ${MONTHS[p.m - 1]} ${p.y}`
  return withTime ? `${day}, ${pad(p.h)}:${pad(p.min)}` : day
}

/** `SA-{job number without spaces}-{created seconds}` — the reference both apps print. */
export function siteAuditReferenceCode(audit: { projectJobNumber?: unknown; createdAtMs?: number | null; dateMs?: number | null }): string {
  const job = str(audit.projectJobNumber).replace(/\s/g, '')
  const ms = audit.createdAtMs ?? audit.dateMs ?? 0
  return `SA-${job}-${Math.floor(ms / 1000)}`
}

/** "A. Name" from "Ann Name" (first initial, then the rest of the name). */
export function siteAuditAuthorSignature(name: unknown): string {
  const parts = str(name).split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`
  return str(name)
}

/** The rows printed for one item, in order (owner decision 17 Nov, Q3 and Q5). */
export function siteAuditReportItemFields(item: SiteAuditReportItemInput): { label: string; value: string; muted: boolean }[] {
  const annotations = str(item.annotations)
  return [
    { label: 'Location', value: str(item.location) || '—', muted: !str(item.location) },
    { label: 'Assignee', value: str(item.assignee) || '—', muted: !str(item.assignee) },
    { label: 'Comments', value: str(item.comments) || '—', muted: !str(item.comments) },
    { label: 'Annotations', value: annotations || 'None', muted: !annotations },
  ]
}

/** The taken time printed on an item: the photo's (`imageCapturedAt`), else the item's created time (Q1). */
export function siteAuditItemTakenMs(item: Pick<SiteAuditReportItemInput, 'imageCapturedAtMs' | 'createdAtMs'>): number | null {
  return item.imageCapturedAtMs ?? item.createdAtMs ?? null
}

export function siteAuditReportPageLabel(page: number, total: number): string {
  return `Page ${page} of ${total}`
}

/** The photo box for a picture of this size: the whole picture, at most 200 points wide and 240 points tall. */
export function siteAuditReportPhotoBox(photo: { width: number; height: number } | null | undefined): { w: number; h: number } | null {
  if (!photo || !(photo.width > 0) || !(photo.height > 0)) return null
  let w = PHOTO_COLUMN
  let h = (PHOTO_COLUMN * photo.height) / photo.width
  if (h > PHOTO_MAX) {
    h = PHOTO_MAX
    w = (PHOTO_MAX * photo.width) / photo.height
  }
  return { w: round(w), h: round(h) }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

type Builder = {
  pages: SiteAuditReportPage[]
  ops: SiteAuditReportOp[]
  y: number
  newPage: () => void
}

function textOps(
  ops: SiteAuditReportOp[],
  lines: string[],
  x: number,
  top: number,
  size: number,
  lineHeight: number,
  bold: boolean,
  color: string
): number {
  lines.forEach((line, index) => {
    if (line.length > 0) ops.push({ kind: 'text', x: round(x), baseline: round(top + index * lineHeight + size * ASCENT + (lineHeight - size) / 2), size, bold, color, text: line })
  })
  return top + lines.length * lineHeight
}

/**
 * The whole report, page by page. Pure: the same input gives the same pages on every platform. Photos and the logo
 * are referred to by `ref` (the item id, or 'logo'); the app draws its own copy of each picture into the box.
 */
export function siteAuditReportLayout(input: SiteAuditReportInput): SiteAuditReportLayout {
  const zone = zoneOrLondon(input.timeZone)
  const audit = input.audit
  const W = SITE_AUDIT_REPORT_PAGE.width
  const C = SITE_AUDIT_REPORT_COLORS
  const contentW = W - MARGIN * 2
  const reference = siteAuditReferenceCode(audit)
  const jobNumber = str(audit.projectJobNumber)
  const type = str(audit.type) || 'General'
  const orgName = str(input.organizationName) || 'Site Audit'

  const b: Builder = {
    pages: [],
    ops: [],
    y: CONTENT_TOP,
    newPage() {
      this.ops = []
      this.pages.push({ number: this.pages.length + 1, ops: this.ops })
      this.y = CONTENT_TOP
    },
  }
  b.newPage()

  // Header band.
  const headerTextW = W - MARGIN - 150
  const subtitle = `${jobNumber} · ${str(input.siteAddress) || str(audit.projectName)}`
  const titleLines = wrapSiteAuditReportText(type, 22, headerTextW, true)
  const subtitleLines = wrapSiteAuditReportText(subtitle, 12, headerTextW)
  const customLines = str(audit.customTitle) ? wrapSiteAuditReportText(str(audit.customTitle), 10.5, headerTextW) : []
  const orgLines = wrapSiteAuditReportText(orgName, 10, 110, true)
  const leftHeight = 26 + 14 + titleLines.length * 26 + 4 + subtitleLines.length * 15 + customLines.length * 13 + 20
  const rightHeight = 24 + 64 + 6 + orgLines.length * 12 + 16
  const headerH = round(Math.max(118, leftHeight, rightHeight))
  b.ops.push({ kind: 'rect', x: 0, y: 0, w: W, h: headerH, fill: C.navy })
  let hy = textOps(b.ops, ['SITE AUDIT REPORT'], MARGIN, 24, 9, 14, true, C.whiteSoft)
  hy = textOps(b.ops, titleLines, MARGIN, hy + 2, 22, 26, true, C.white)
  hy = textOps(b.ops, subtitleLines, MARGIN, hy + 4, 12, 15, false, C.whiteSoft)
  textOps(b.ops, customLines, MARGIN, hy, 10.5, 13, false, C.whiteSoft)
  const logoBox = { x: W - 104, y: 24, w: 72, h: 64 }
  if (input.logo && input.logo.width > 0 && input.logo.height > 0) {
    const scale = Math.min(logoBox.w / input.logo.width, logoBox.h / input.logo.height)
    const w = input.logo.width * scale
    const h = input.logo.height * scale
    b.ops.push({ kind: 'image', ref: 'logo', x: round(logoBox.x + (logoBox.w - w) / 2), y: round(logoBox.y + (logoBox.h - h) / 2), w: round(w), h: round(h) })
  } else {
    b.ops.push({ kind: 'rect', ...logoBox, fill: C.accent, radius: 10 })
    const initials = siteAuditReportText(
      orgName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('')
    )
    const iw = siteAuditReportTextWidth(initials, 20, true)
    textOps(b.ops, [initials], logoBox.x + (logoBox.w - iw) / 2, logoBox.y + 20, 20, 24, true, C.white)
  }
  textOps(b.ops, orgLines, W - MARGIN - 110, logoBox.y + logoBox.h + 6, 10, 12, true, C.white)
  b.y = headerH

  // Meta grid: Project, Client / Author, Date / Type, Reference.
  const pairs: [string, string][] = [
    ['Project', `${jobNumber} ${str(audit.projectName)}`.trim() || '—'],
    ['Client', str(input.clientName) || '—'],
    ['Author', str(audit.authorName) || '—'],
    ['Date', dateText(audit.dateMs, zone)],
    ['Type', `${type} audit`],
    ['Reference', reference],
  ]
  const colW = (contentW - 18) / 2
  const metaRows: { lines: string[][]; h: number }[] = []
  for (let row = 0; row < 3; row += 1) {
    const cells = [0, 1].map((col) => wrapSiteAuditReportText(pairs[row * 2 + col][1], 12, colW))
    metaRows.push({ lines: cells, h: 14 + Math.max(...cells.map((cell) => cell.length)) * 15 })
  }
  const metaH = 24 + metaRows.reduce((sum, row) => sum + row.h, 0) + 18 * 2 + 24
  b.ops.push({ kind: 'rect', x: 0, y: round(b.y), w: W, h: round(metaH), fill: C.soft })
  b.ops.push({ kind: 'line', x1: 0, y1: round(b.y + metaH), x2: W, y2: round(b.y + metaH), color: C.border, width: 1 })
  let my = b.y + 24
  metaRows.forEach((row, rowIndex) => {
    ;[0, 1].forEach((col) => {
      const x = MARGIN + col * (colW + 18)
      textOps(b.ops, [pairs[rowIndex * 2 + col][0].toUpperCase()], x, my, 8, 11, true, C.muted)
      textOps(b.ops, row.lines[col], x, my + 14, 12, 15, false, C.ink)
    })
    my += row.h + 18
  })
  b.y += metaH + 16

  // Section heading.
  const count = audit.items.length
  b.ops.push({ kind: 'rect', x: MARGIN, y: round(b.y), w: 24, h: 3, fill: C.accent })
  textOps(b.ops, [`SITE OBSERVATIONS · ${count} ITEM${count === 1 ? '' : 'S'}`], MARGIN, b.y + 10, 13, 16, true, C.ink)
  b.y += 36

  // Items.
  audit.items.forEach((item, index) => layoutItem(b, item, index + 1, contentW, zone))

  // Signature block (needs 96 points).
  if (b.y + 96 > BODY_BOTTOM) b.newPage()
  const sy = b.y + 6
  b.ops.push({ kind: 'rect', x: MARGIN, y: round(sy), w: contentW, h: 2, fill: C.ink })
  const half = (contentW - 24) / 2
  textOps(b.ops, ['AUTHOR SIGNATURE'], MARGIN, sy + 12, 8, 11, true, C.muted)
  textOps(b.ops, ['CLIENT ACKNOWLEDGEMENT'], MARGIN + half + 24, sy + 12, 8, 11, true, C.muted)
  const signature = wrapSiteAuditReportText(siteAuditAuthorSignature(audit.authorName), 16, half)
  const afterSig = textOps(b.ops, signature, MARGIN, sy + 28, 16, 20, false, C.navy2)
  const lineY = Math.max(afterSig + 4, sy + 60)
  b.ops.push({ kind: 'line', x1: MARGIN, y1: round(lineY), x2: round(MARGIN + half * 0.7), y2: round(lineY), color: C.ink, width: 1 })
  b.ops.push({ kind: 'line', x1: round(MARGIN + half + 24), y1: round(lineY), x2: MARGIN + contentW, y2: round(lineY), color: C.ink, width: 1 })
  const foot = wrapSiteAuditReportText(`${str(audit.authorName)} · ${dateText(audit.dateMs, zone)}`, 9, half)
  textOps(b.ops, foot, MARGIN, lineY + 4, 9, 12, false, C.muted)
  textOps(b.ops, ['Signed & dated'], MARGIN + half + 24, lineY + 4, 9, 12, false, C.muted)

  // Footers, now that the page count is known (owner bug: "Page 2 of 2" on a 3-page report).
  const total = b.pages.length
  const footerOrg = wrapSiteAuditReportText(orgName, 9, contentW / 2, true)
  for (const page of b.pages) {
    page.ops.push({ kind: 'line', x1: 0, y1: FOOTER_TOP, x2: W, y2: FOOTER_TOP, color: C.border, width: 1 })
    textOps(page.ops, footerOrg, MARGIN, FOOTER_TOP + 10, 9, 12, true, C.ink)
    const label = siteAuditReportPageLabel(page.number, total)
    textOps(page.ops, [label], W - MARGIN - siteAuditReportTextWidth(label, 9), FOOTER_TOP + 10, 9, 12, false, C.muted)
    const refText = siteAuditReportText(reference)
    textOps(page.ops, [refText], W - MARGIN - siteAuditReportTextWidth(refText, 8), FOOTER_TOP + 22, 8, 11, false, C.muted)
  }

  const fileDate = (() => {
    if (audit.dateMs == null) return 'undated'
    const p = partsInZone(new Date(audit.dateMs), zone)
    return `${p.d}${MONTHS[p.m - 1]}${String(p.y).slice(2)}`
  })()
  const safe = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, '')
  return {
    page: { ...SITE_AUDIT_REPORT_PAGE },
    pages: b.pages,
    fileName: `SiteAudit_${safe(jobNumber)}_${safe(type)}_${fileDate}.pdf`,
    reference,
  }
}

type DetailLine = { text: string; size: number; bold: boolean; color: string; height: number; gapBefore: number; separator: boolean }

function layoutItem(b: Builder, item: SiteAuditReportItemInput, number: number, contentW: number, zone: string): void {
  const C = SITE_AUDIT_REPORT_COLORS
  const x = MARGIN
  const photo = siteAuditReportPhotoBox(item.photo)
  const pad = 14
  const detailX = photo ? x + pad + PHOTO_COLUMN + pad : x + pad
  const detailW = photo ? contentW - PHOTO_COLUMN - pad * 3 : contentW - pad * 2
  const taken = `Taken ${dateText(siteAuditItemTakenMs(item), zone, true)}`
  const takenW = siteAuditReportTextWidth(siteAuditReportText(taken), 9)
  const titleW = contentW - 44 - pad - takenW - 10
  const title = str(item.title) || 'Untitled item'
  const titleLines = wrapSiteAuditReportText(title, 12, titleW, true)
  const headerH = Math.max(36, 12 + titleLines.length * 15)

  const lines: DetailLine[] = []
  siteAuditReportItemFields(item).forEach((field, fieldIndex) => {
    lines.push({ text: field.label.toUpperCase(), size: 8, bold: true, color: C.muted, height: 12, gapBefore: fieldIndex === 0 ? 0 : 8, separator: fieldIndex > 0 })
    for (const line of wrapSiteAuditReportText(field.value, 10.5, detailW)) {
      lines.push({ text: line, size: 10.5, bold: false, color: field.muted ? C.muted : C.ink, height: 14, gapBefore: 0, separator: false })
    }
  })

  const linesHeight = (from: number, to: number) => lines.slice(from, to).reduce((sum, line) => sum + line.gapBefore + line.height, 0)
  const freshSpace = BODY_BOTTOM - CONTENT_TOP
  const fullHeight = headerH + pad + Math.max(photo?.h ?? 0, linesHeight(0, lines.length)) + pad

  // The whole card on this page, else on a fresh page; only a card taller than a page flows across pages.
  if (b.y + fullHeight > BODY_BOTTOM && fullHeight <= freshSpace) b.newPage()
  else if (fullHeight > freshSpace && b.y + headerH + pad + (photo?.h ?? 14) + pad > BODY_BOTTOM) b.newPage()

  let next = 0
  let segment = 0
  while (segment === 0 || next < lines.length) {
    const top = b.y
    const continued = segment > 0
    const segHeaderH = continued ? 30 : headerH
    const bodyTop = top + segHeaderH + pad
    const room = BODY_BOTTOM - pad - bodyTop
    let end = next
    while (end < lines.length && linesHeight(next, end + 1) <= room) end += 1
    if (end === next && next < lines.length) end = next + 1 // never stall: one line always fits a fresh page
    const bodyH = Math.max(segment === 0 ? photo?.h ?? 0 : 0, linesHeight(next, end))
    const cardH = segHeaderH + pad + bodyH + pad

    b.ops.push({ kind: 'rect', x, y: round(top), w: contentW, h: round(cardH), fill: C.white, stroke: C.border, radius: 8 })
    b.ops.push({ kind: 'rect', x, y: round(top), w: contentW, h: round(segHeaderH), fill: C.soft, radius: 8 })
    b.ops.push({ kind: 'line', x1: x, y1: round(top + segHeaderH), x2: x + contentW, y2: round(top + segHeaderH), color: C.border, width: 1 })
    b.ops.push({ kind: 'circle', cx: x + 25, cy: round(top + Math.min(18, segHeaderH / 2)), r: 11, fill: C.accent })
    const num = String(number)
    textOps(b.ops, [num], x + 25 - siteAuditReportTextWidth(num, 10, true) / 2, top + Math.min(18, segHeaderH / 2) - 7, 10, 14, true, C.white)
    if (continued) {
      textOps(b.ops, [SITE_AUDIT_REPORT_CONTINUED], x + 44, top + 8, 11, 14, true, C.ink)
    } else {
      textOps(b.ops, titleLines, x + 44, top + 10, 12, 15, true, C.ink)
      textOps(b.ops, [siteAuditReportText(taken)], x + contentW - pad - takenW, top + 11, 9, 12, false, C.muted)
      if (photo) b.ops.push({ kind: 'image', ref: item.id, x: x + pad, y: round(bodyTop), w: photo.w, h: photo.h })
    }
    let ly = bodyTop
    for (let i = next; i < end; i += 1) {
      const line = lines[i]
      if (line.separator && i !== next) {
        ly += line.gapBefore / 2
        b.ops.push({ kind: 'line', x1: round(detailX), y1: round(ly), x2: round(detailX + detailW), y2: round(ly), color: C.border, width: 0.75, dash: [2, 2] })
        ly += line.gapBefore / 2
      } else if (i !== next) {
        ly += line.gapBefore
      }
      textOps(b.ops, [line.text], detailX, ly, line.size, line.height, line.bold, line.color)
      ly += line.height
    }
    b.y = top + cardH + 14
    next = end
    segment += 1
    if (next < lines.length) b.newPage()
  }
}

/** The report's text, page by page, in drawing order — what the shared fixture and both apps' tests compare. */
export function siteAuditReportTextLines(layout: SiteAuditReportLayout): string[][] {
  return layout.pages.map((page) => page.ops.flatMap((op) => (op.kind === 'text' ? [op.text] : [])))
}

/** The shared fixture for the apps' tests (iOS reads it through the packed script): inputs and expected pages. */
export function siteAuditReportFixtureForApps(): { inputs: typeof SITE_AUDIT_REPORT_FIXTURE_INPUTS; expected: typeof SITE_AUDIT_REPORT_FIXTURE_EXPECTED } {
  return { inputs: SITE_AUDIT_REPORT_FIXTURE_INPUTS, expected: SITE_AUDIT_REPORT_FIXTURE_EXPECTED }
}
