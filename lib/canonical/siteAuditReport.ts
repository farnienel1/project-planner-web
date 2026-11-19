/**
 * Rulebook 1.68.0 §29 — the site audit report (owner decisions 17 Nov).
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
  /** Personal audits (review of #389: the job number and name were cut at 60 / 200 without a word). */
  jobNumber: 60,
  jobName: 200,
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
  jobNumber: 'Job number',
  jobName: 'Job name',
}

const isCombiningMark = (code: number) =>
  (code >= 0x0300 && code <= 0x036f) || (code >= 0x1ab0 && code <= 0x1aff) || (code >= 0x1dc0 && code <= 0x1dff) ||
  (code >= 0x20d0 && code <= 0x20ff) || (code >= 0xfe20 && code <= 0xfe2f)
/** Characters that never print on their own: variation selectors, joiners, skin tones, tags, BOM, zero-width space. */
const isInvisible = (code: number) =>
  (code >= 0xfe00 && code <= 0xfe0f) || (code >= 0xe0100 && code <= 0xe01ef) || (code >= 0x1f3fb && code <= 0x1f3ff) ||
  (code >= 0xe0020 && code <= 0xe007f) || code === 0x200b || code === 0x200c || code === 0x200d || code === 0x2060 ||
  code === 0xfeff || code === 0x20e3
const isRegionalIndicator = (code: number) => code >= 0x1f1e6 && code <= 0x1f1ff

/**
 * The text split into what a person sees as one character (a simple grapheme cluster rule, the same on every
 * platform — no dependence on `Intl.Segmenter`): a character with its combining marks, variation selectors, skin tone
 * and keycap mark; characters joined by a zero-width joiner (👨‍👩‍👧); a pair of regional indicators (a flag).
 */
export function siteAuditGraphemes(value: unknown): string[] {
  const out: string[] = []
  let joinNext = false
  let flagOpen = false
  for (const ch of Array.from(String(value ?? ''))) {
    const code = ch.codePointAt(0) ?? 0
    if (out.length > 0 && (joinNext || isCombiningMark(code) || (isInvisible(code) && code !== 0xfeff && code !== 0x200b && code !== 0x2060))) {
      out[out.length - 1] += ch
      joinNext = code === 0x200d
      continue
    }
    if (out.length > 0 && flagOpen && isRegionalIndicator(code)) {
      out[out.length - 1] += ch
      flagOpen = false
      continue
    }
    out.push(ch)
    joinNext = code === 0x200d
    flagOpen = isRegionalIndicator(code)
  }
  return out
}

/** Characters counted the way a person sees them (an emoji, a flag or a family is one), on both apps. */
export function siteAuditFieldLength(value: unknown): number {
  return siteAuditGraphemes(value).length
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
 * cannot draw replaced, one per character a person sees (`siteAuditGraphemes`): a variation selector, joiner or skin
 * tone is dropped when what is left can be drawn (©️ → ©); a compatibility form is written out (ﬁ → fi, full-width
 * letters → ASCII); an accented letter loses its accent; anything else is one "?" (❤️ → ?, 👨‍👩‍👧 → ?). A lone
 * zero-width space, word joiner or byte order mark prints nothing (it is invisible). No visible character is dropped.
 */
export function siteAuditReportText(value: unknown): string {
  const table = widthTable(false)
  const drawable = (text: string) => text.length > 0 && Array.from(text).every((c) => table.has(c.codePointAt(0) ?? 0))
  const source = String(value ?? '').normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ')
  let out = ''
  for (const cluster of siteAuditGraphemes(source)) {
    if (cluster === '\n') {
      out += cluster
      continue
    }
    const code = cluster.codePointAt(0) ?? 0
    if (cluster.length <= 2 && Array.from(cluster).length === 1 && code < 0x20) {
      out += ' '
      continue
    }
    if (drawable(cluster)) {
      out += cluster
      continue
    }
    const visible = Array.from(cluster)
      .filter((c) => !isInvisible(c.codePointAt(0) ?? 0))
      .join('')
    if (!visible) continue
    if (drawable(visible)) {
      out += visible
      continue
    }
    const mapped = EXTRA_LATIN[visible]
    if (mapped && drawable(mapped)) {
      out += mapped
      continue
    }
    const compatible = visible.normalize('NFKC')
    if (drawable(compatible)) {
      out += compatible
      continue
    }
    const base = visible.normalize('NFD').replace(/[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g, '')
    if (drawable(base)) {
      out += base
      continue
    }
    out += '?'
  }
  return out
}

/** One line of report text that must stay one line (the running footer): ends with "…" when it is wider. The full
 * text is printed in the body; only this repeat is shortened. */
export function siteAuditReportFitLine(value: unknown, size: number, maxWidth: number, bold = false): string {
  const text = siteAuditReportText(value).replace(/\n/g, ' ')
  if (siteAuditReportTextWidth(text, size, bold) <= maxWidth + 0.01) return text
  const chars = Array.from(text)
  while (chars.length > 0 && siteAuditReportTextWidth(chars.join('') + '…', size, bold) > maxWidth + 0.01) chars.pop()
  return chars.join('').trimEnd() + '…'
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
/** The navy header band is at most this tall; text beyond it continues in the body. */
const HEADER_MAX = 260
/** Item title lines in the card header; the rest continue in the card body. */
const ITEM_TITLE_HEADER_LINES = 3
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

/** One line of body text at `b.y`, starting a new page first when it would pass the bottom of the body. */
function flowLine(b: Builder, text: string, x: number, size: number, lineHeight: number, bold: boolean, color: string): void {
  if (b.y + lineHeight > BODY_BOTTOM) b.newPage()
  textOps(b.ops, [text], x, b.y, size, lineHeight, bold, color)
  b.y += lineHeight
}

/**
 * The company logo's box at the top right of the report header (owner request 17 Nov): the header's right-hand column,
 * 110 × 64 points, its right edge on the page margin. The logo is drawn on a white tile (so a dark or transparent logo
 * still shows on the navy header) with `SITE_AUDIT_REPORT_LOGO_PADDING` around it.
 */
export const SITE_AUDIT_REPORT_LOGO_BOX = Object.freeze({
  x: round(SITE_AUDIT_REPORT_PAGE.width - MARGIN - 110),
  y: 24,
  w: 110,
  h: 64,
})
export const SITE_AUDIT_REPORT_LOGO_PADDING = 6

/**
 * Where the logo goes: fitted whole inside the box less its padding (aspect ratio kept, never stretched or cropped,
 * scaled up or down to fit), placed at the top right of the box, on a white tile just big enough for it. Null when
 * there is no usable logo (none set, or the app could not load it): the report then shows the initials badge.
 */
export function siteAuditReportLogoPlacement(
  logo: { width: number; height: number } | null | undefined
): { tile: { x: number; y: number; w: number; h: number }; image: { x: number; y: number; w: number; h: number } } | null {
  if (!logo || !(logo.width > 0) || !(logo.height > 0) || !Number.isFinite(logo.width) || !Number.isFinite(logo.height)) return null
  const box = SITE_AUDIT_REPORT_LOGO_BOX
  const pad = SITE_AUDIT_REPORT_LOGO_PADDING
  const scale = Math.min((box.w - pad * 2) / logo.width, (box.h - pad * 2) / logo.height)
  const w = round(logo.width * scale)
  const h = round(logo.height * scale)
  const tileW = round(w + pad * 2)
  const tileH = round(h + pad * 2)
  const tileX = round(box.x + box.w - tileW)
  return {
    tile: { x: tileX, y: box.y, w: tileW, h: tileH },
    image: { x: round(tileX + pad), y: round(box.y + pad), w, h },
  }
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

  // Header band. A band at most HEADER_MAX tall; anything that does not fit in it (an enormous type, title or
  // company name) continues below the band in the body, flowing over pages — nothing is cut.
  const headerTextW = W - MARGIN - 150
  const subtitle = `${jobNumber} · ${str(input.siteAddress) || str(audit.projectName)}`
  type HeadLine = { text: string; size: number; lh: number; bold: boolean; color: string; gap: number }
  const leftLines: HeadLine[] = [{ text: 'SITE AUDIT REPORT', size: 9, lh: 14, bold: true, color: C.whiteSoft, gap: 0 }]
  wrapSiteAuditReportText(type, 22, headerTextW, true).forEach((text, i) => leftLines.push({ text, size: 22, lh: 26, bold: true, color: C.white, gap: i === 0 ? 2 : 0 }))
  wrapSiteAuditReportText(subtitle, 12, headerTextW).forEach((text, i) => leftLines.push({ text, size: 12, lh: 15, bold: false, color: C.whiteSoft, gap: i === 0 ? 4 : 0 }))
  if (str(audit.customTitle)) {
    wrapSiteAuditReportText(str(audit.customTitle), 10.5, headerTextW).forEach((text) => leftLines.push({ text, size: 10.5, lh: 13, bold: false, color: C.whiteSoft, gap: 0 }))
  }
  const orgLines = wrapSiteAuditReportText(orgName, 10, 110, true)
  const leftHeight = 24 + leftLines.reduce((sum, line) => sum + line.gap + line.lh, 0) + 20
  const rightHeight = 24 + 64 + 6 + orgLines.length * 12 + 16
  const headerH = round(Math.min(HEADER_MAX, Math.max(118, leftHeight, rightHeight)))
  const bandBottom = headerH - 16
  b.ops.push({ kind: 'rect', x: 0, y: 0, w: W, h: headerH, fill: C.navy })
  const overflow: { text: string; size: number; lh: number; bold: boolean; x: number }[] = []
  let hy = 24
  for (const line of leftLines) {
    hy += line.gap
    if (hy + line.lh <= bandBottom) textOps(b.ops, [line.text], MARGIN, hy, line.size, line.lh, line.bold, line.color)
    else overflow.push({ text: line.text, size: line.size, lh: line.lh, bold: line.bold, x: MARGIN })
    hy += line.lh
  }
  const logoBox = { x: W - 104, y: 24, w: 72, h: 64 }
  const placement = siteAuditReportLogoPlacement(input.logo)
  if (placement) {
    b.ops.push({ kind: 'rect', ...placement.tile, fill: C.white, radius: 6 })
    b.ops.push({ kind: 'image', ref: 'logo', ...placement.image })
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
  let oy = logoBox.y + logoBox.h + 6
  for (const line of orgLines) {
    if (oy + 12 <= bandBottom) textOps(b.ops, [line], W - MARGIN - 110, oy, 10, 12, true, C.white)
    else overflow.push({ text: line, size: 10, lh: 12, bold: true, x: MARGIN })
    oy += 12
  }
  b.y = headerH
  if (overflow.length > 0) {
    b.y += 10
    for (const line of overflow) flowLine(b, line.text, line.x, line.size, line.lh, line.bold, C.ink)
    b.y += 6
  }

  // Details grid: Project, Client / Author, Date / Type, Reference. Two columns on a soft band; a value longer than
  // the page flows onto the next page line by line (the band is drawn per page).
  const pairs: [string, string][] = [
    ['Project', `${jobNumber} ${str(audit.projectName)}`.trim() || '—'],
    ['Client', str(input.clientName) || '—'],
    ['Author', str(audit.authorName) || '—'],
    ['Date', dateText(audit.dateMs, zone)],
    ['Type', `${type} audit`],
    ['Reference', reference],
  ]
  const colW = (contentW - 18) / 2
  let band = { index: b.ops.length, top: b.y }
  const closeBand = (bottom: number) => {
    b.ops.splice(band.index, 0, { kind: 'rect', x: 0, y: round(band.top), w: W, h: round(bottom - band.top), fill: C.soft })
    b.ops.push({ kind: 'line', x1: 0, y1: round(bottom), x2: W, y2: round(bottom), color: C.border, width: 1 })
  }
  const breakBand = (bottom: number) => {
    closeBand(bottom)
    b.newPage()
    band = { index: b.ops.length, top: b.y }
    b.y += 12
  }
  b.y += 24
  for (let row = 0; row < 3; row += 1) {
    const cells = [0, 1].map((col) => wrapSiteAuditReportText(pairs[row * 2 + col][1], 12, colW))
    if (row > 0) b.y += 18
    if (b.y + 14 + 15 > BODY_BOTTOM) breakBand(b.y)
    ;[0, 1].forEach((col) => textOps(b.ops, [pairs[row * 2 + col][0].toUpperCase()], MARGIN + col * (colW + 18), b.y, 8, 11, true, C.muted))
    b.y += 14
    const count = Math.max(cells[0].length, cells[1].length)
    for (let i = 0; i < count; i += 1) {
      if (b.y + 15 > BODY_BOTTOM) breakBand(b.y)
      ;[0, 1].forEach((col) => {
        const line = cells[col][i]
        if (line !== undefined) textOps(b.ops, [line], MARGIN + col * (colW + 18), b.y, 12, 15, false, C.ink)
      })
      b.y += 15
    }
  }
  b.y += 24
  closeBand(b.y)
  b.y += 16

  // Section heading.
  const count = audit.items.length
  if (b.y + 36 + 120 > BODY_BOTTOM) b.newPage()
  b.ops.push({ kind: 'rect', x: MARGIN, y: round(b.y), w: 24, h: 3, fill: C.accent })
  textOps(b.ops, [`SITE OBSERVATIONS · ${count} ITEM${count === 1 ? '' : 'S'}`], MARGIN, b.y + 10, 13, 16, true, C.ink)
  b.y += 36

  // Items.
  audit.items.forEach((item, index) => layoutItem(b, item, index + 1, contentW, zone))

  // Signature block (needs 96 points; a long author name flows onto the next page).
  if (b.y + 96 > BODY_BOTTOM) b.newPage()
  const sy = b.y + 6
  const half = (contentW - 24) / 2
  b.ops.push({ kind: 'rect', x: MARGIN, y: round(sy), w: contentW, h: 2, fill: C.ink })
  textOps(b.ops, ['AUTHOR SIGNATURE'], MARGIN, sy + 12, 8, 11, true, C.muted)
  textOps(b.ops, ['CLIENT ACKNOWLEDGEMENT'], MARGIN + half + 24, sy + 12, 8, 11, true, C.muted)
  const signaturePage = b.pages.length
  b.y = sy + 28
  for (const line of wrapSiteAuditReportText(siteAuditAuthorSignature(audit.authorName), 16, half)) flowLine(b, line, MARGIN, 16, 20, false, C.navy2)
  let lineY = b.pages.length === signaturePage ? Math.max(b.y + 4, sy + 60) : b.y + 4
  if (lineY + 4 + 12 > BODY_BOTTOM) {
    b.newPage()
    lineY = b.y + 4
  }
  b.ops.push({ kind: 'line', x1: MARGIN, y1: round(lineY), x2: round(MARGIN + half * 0.7), y2: round(lineY), color: C.ink, width: 1 })
  b.ops.push({ kind: 'line', x1: round(MARGIN + half + 24), y1: round(lineY), x2: MARGIN + contentW, y2: round(lineY), color: C.ink, width: 1 })
  textOps(b.ops, ['Signed & dated'], MARGIN + half + 24, lineY + 4, 9, 12, false, C.muted)
  b.y = lineY + 4
  for (const line of wrapSiteAuditReportText(`${str(audit.authorName)} · ${dateText(audit.dateMs, zone)}`, 9, half)) flowLine(b, line, MARGIN, 9, 12, false, C.muted)

  // Footers, now that the page count is known (owner bug: "Page 2 of 2" on a 3-page report).
  const total = b.pages.length
  // The footer is a running repeat of text printed in full in the body (company name in the header, reference in
  // the details grid), so it is one line each, shortened with "…" when it would not fit.
  const footerOrg = siteAuditReportFitLine(orgName, 9, contentW * 0.55, true)
  const refText = siteAuditReportFitLine(reference, 8, contentW * 0.4)
  for (const page of b.pages) {
    page.ops.push({ kind: 'line', x1: 0, y1: FOOTER_TOP, x2: W, y2: FOOTER_TOP, color: C.border, width: 1 })
    textOps(page.ops, [footerOrg], MARGIN, FOOTER_TOP + 10, 9, 12, true, C.ink)
    const label = siteAuditReportPageLabel(page.number, total)
    textOps(page.ops, [label], W - MARGIN - siteAuditReportTextWidth(label, 9), FOOTER_TOP + 10, 9, 12, false, C.muted)
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
  const allTitleLines = wrapSiteAuditReportText(title, 12, titleW, true)
  const titleLines = allTitleLines.slice(0, ITEM_TITLE_HEADER_LINES)
  const headerH = Math.max(36, 12 + titleLines.length * 15)

  const lines: DetailLine[] = []
  // A title longer than the header continues as the first lines of the card body (each line re-wrapped to the body
  // width, never joined, so no character is added or lost).
  for (const rest of allTitleLines.slice(ITEM_TITLE_HEADER_LINES)) {
    for (const line of wrapSiteAuditReportText(rest, 12, detailW, true)) {
      lines.push({ text: line, size: 12, bold: true, color: C.ink, height: 15, gapBefore: 0, separator: false })
    }
  }
  const titleRest = lines.length
  siteAuditReportItemFields(item).forEach((field, fieldIndex) => {
    lines.push({ text: field.label.toUpperCase(), size: 8, bold: true, color: C.muted, height: 12, gapBefore: fieldIndex === 0 ? (titleRest > 0 ? 8 : 0) : 8, separator: fieldIndex > 0 || titleRest > 0 })
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

/** The box a stored photo keeps when the app could not load it (4 : 3), so the layout never depends on a download. */
export const SITE_AUDIT_REPORT_MISSING_PHOTO = Object.freeze({ width: 4, height: 3 })

/** The site address printed on the report: the job's address lines joined with ", " (never map coordinates). */
export function siteAuditReportSiteAddress(job: { addressLine1?: unknown; addressLine2?: unknown; townCity?: unknown; postcode?: unknown } | null | undefined): string {
  if (!job) return ''
  return [job.addressLine1, job.addressLine2, job.townCity, job.postcode].map(str).filter(Boolean).join(', ')
}

const validSize = (size: { width: number; height: number } | null | undefined) =>
  size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0
    ? { width: Number(size.width), height: Number(size.height) }
    : null

/**
 * The report's input, composed the same way on both apps from what each app holds (review of #389 / #262): the
 * audit's stored fields, the organisation name, the job (client and address lines, `siteAuditReportSiteAddress`),
 * the pixel size of each photo the app loaded and of the logo, and the organisation's time zone. A photo whose size
 * the app does not have (not loaded) keeps `SITE_AUDIT_REPORT_MISSING_PHOTO` when the item has a stored photo, so
 * the same audit gives the same pages whatever loaded; an item with no stored photo has none. An empty client or
 * address prints "—" / the project name. Both apps pass this to `siteAuditReportLayout`.
 */
export function siteAuditReportInput(args: {
  audit: {
    id?: string
    projectJobNumber?: unknown
    projectName?: unknown
    type?: unknown
    customTitle?: unknown
    authorName?: unknown
    dateMs?: number | null
    createdAtMs?: number | null
    items: ReadonlyArray<{
      id: string
      title?: unknown
      location?: unknown
      assignee?: unknown
      comments?: unknown
      annotations?: unknown
      imageURL?: unknown
      imageCapturedAtMs?: number | null
      createdAtMs?: number | null
    }>
  }
  organizationName?: string | null
  job?: { clientName?: unknown; addressLine1?: unknown; addressLine2?: unknown; townCity?: unknown; postcode?: unknown } | null
  photos?: Readonly<Record<string, { width: number; height: number } | null | undefined>> | null
  logo?: { width: number; height: number } | null
  timeZone?: string | null
}): SiteAuditReportInput {
  const { audit } = args
  return {
    timeZone: args.timeZone ?? null,
    organizationName: str(args.organizationName) || null,
    clientName: str(args.job?.clientName) || null,
    siteAddress: siteAuditReportSiteAddress(args.job) || null,
    logo: validSize(args.logo),
    audit: {
      id: audit.id,
      projectJobNumber: audit.projectJobNumber,
      projectName: audit.projectName,
      type: audit.type,
      customTitle: audit.customTitle,
      authorName: audit.authorName,
      dateMs: audit.dateMs ?? null,
      createdAtMs: audit.createdAtMs ?? null,
      items: audit.items.map((item) => ({
        id: item.id,
        title: item.title,
        location: item.location,
        assignee: item.assignee,
        comments: item.comments,
        annotations: item.annotations,
        imageCapturedAtMs: item.imageCapturedAtMs ?? null,
        createdAtMs: item.createdAtMs ?? null,
        photo: validSize(args.photos?.[item.id]) ?? (str(item.imageURL) ? { ...SITE_AUDIT_REPORT_MISSING_PHOTO } : null),
      })),
    },
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
