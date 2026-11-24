/**
 * Rulebook 1.50.0 §24 (owner decisions 15 Nov): what may be uploaded, per stored-file kind, and which stored or
 * typed URLs may be opened as a link.
 *
 * - Photos (JPEG, PNG, HEIC/HEIF, WebP) and PDFs only, per kind (`UPLOAD_ALLOWED_TYPES`); CSV only for the material
 *   catalogue import (read in the browser, never stored). No SVG, no GIF, no Word, Excel (macro or not), ZIP or
 *   `application/octet-stream` anywhere.
 * - A size cap per kind.
 * - The file's real type is read from its first bytes (`detectUploadContentType`, magic numbers) and must match
 *   the type it claims and its file extension. The upload is written with the detected type, never
 *   `application/octet-stream`.
 * - `safeExternalUrl`: a URL read from Firestore or typed by a user is put on a link only when it is `https:` or
 *   `http:`; `javascript:`, `data:`, `vbscript:`, `file:` and anything else read as no link.
 *
 * `storage.rules` enforces the same types and caps on the server (it cannot read the bytes: the magic-number check
 * runs in the apps). Plain data only, so iOS calls it through `CanonicalBusinessEngine`.
 */

import { MATERIAL_CATALOGUE_CSV_MAX_BYTES } from './materialCatalogueCsv'
import { storedFileKind, STORED_FILE_KINDS, type StoredFileKind } from './storedFiles'

/** Every upload the apps make: each stored-file kind, plus the catalogue CSV import (read in the browser only). */
export const UPLOAD_KINDS = [...STORED_FILE_KINDS, 'material_catalogue_import'] as const
export type UploadKind = (typeof UPLOAD_KINDS)[number]

export const UPLOAD_PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp'] as const
export const UPLOAD_PDF_CONTENT_TYPE = 'application/pdf'
export const UPLOAD_CSV_CONTENT_TYPE = 'text/csv'
export type UploadContentType =
  | (typeof UPLOAD_PHOTO_CONTENT_TYPES)[number]
  | typeof UPLOAD_PDF_CONTENT_TYPE
  | typeof UPLOAD_CSV_CONTENT_TYPE

const PHOTO_EXTENSIONS = ['jpg', 'jpeg', 'jpe', 'jfif', 'png', 'heic', 'heif', 'hif', 'webp'] as const
const PDF_EXTENSIONS = ['pdf'] as const
const CSV_EXTENSIONS = ['csv'] as const

/** How many leading bytes an app passes as `headBytes` (a PDF header may start up to 1024 bytes in). */
export const UPLOAD_HEAD_BYTES = 1024

const MB = 1024 * 1024

/** The cap every photo and PDF kind shares unless it says otherwise (10 MB). */
export const UPLOAD_DEFAULT_MAX_BYTES = 10 * MB

export type UploadKindPolicy = {
  /** Content types written on upload (the detected type is one of these). */
  contentTypes: readonly UploadContentType[]
  /** File extensions a name may end in (lower case, no dot). A name with no extension is judged by its bytes. */
  extensions: readonly string[]
  maxBytes: number
  /** "a photo (JPEG, PNG, HEIC or WebP) or a PDF" — used in messages. */
  accepts: string
}

const PHOTOS = UPLOAD_PHOTO_CONTENT_TYPES
const PHOTO_ACCEPTS = 'a photo (JPEG, PNG, HEIC or WebP)'
const PHOTO_OR_PDF_ACCEPTS = 'a photo (JPEG, PNG, HEIC or WebP) or a PDF'

function photosAndPdf(maxBytes: number): UploadKindPolicy {
  return {
    contentTypes: [...PHOTOS, UPLOAD_PDF_CONTENT_TYPE],
    extensions: [...PHOTO_EXTENSIONS, ...PDF_EXTENSIONS],
    maxBytes,
    accepts: PHOTO_OR_PDF_ACCEPTS,
  }
}

function photosOnly(maxBytes: number): UploadKindPolicy {
  return { contentTypes: [...PHOTOS], extensions: [...PHOTO_EXTENSIONS], maxBytes, accepts: PHOTO_ACCEPTS }
}

/**
 * What each kind accepts (owner decisions 15 Nov). `storage.rules` carries the same lists and caps per path.
 * 1.50.0: variation evidence goes from 20 MB to 10 MB like every other photo / PDF kind; certificates take every
 * photo type (they took PDF and JPEG only).
 */
export const UPLOAD_ALLOWED_TYPES: Readonly<Record<UploadKind, UploadKindPolicy>> = {
  profile_photo: photosOnly(2 * MB),
  company_logo: photosAndPdf(5 * MB),
  timesheet_export: {
    contentTypes: [UPLOAD_PDF_CONTENT_TYPE],
    extensions: [...PDF_EXTENSIONS],
    maxBytes: 10 * MB,
    accepts: 'a PDF',
  },
  qualification_certificate: photosAndPdf(10 * MB),
  variation_evidence: photosAndPdf(10 * MB),
  site_audit_photo: photosOnly(10 * MB),
  task_attachment: photosAndPdf(10 * MB),
  health_safety: photosAndPdf(10 * MB),
  paye_claim_evidence: photosAndPdf(10 * MB),
  personal_site_audit: photosOnly(10 * MB),
  // 1.80.0: subcontractor insurance and RAMS documents.
  subcontractor_document: photosAndPdf(10 * MB),
  // 1.83.0 (§31): organisation insurance and accreditation certificates.
  org_compliance_document: photosAndPdf(10 * MB),
  // The 1.48.0 §28 catalogue import (`materialCatalogueCsvFileError` / `materialCatalogueCsvTextError` keep their own
  // messages on the import screens); listed here so the one table names every upload.
  material_catalogue_import: {
    contentTypes: [UPLOAD_CSV_CONTENT_TYPE],
    extensions: [...CSV_EXTENSIONS],
    maxBytes: MATERIAL_CATALOGUE_CSV_MAX_BYTES,
    accepts: 'a CSV file',
  },
}

export function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === 'string' && (UPLOAD_KINDS as readonly string[]).includes(value)
}

/** The upload kind for a Storage path (`storedFileKind`); null for a path no rule allows. */
export function uploadKindForStoragePath(storagePath: string | null | undefined): StoredFileKind | null {
  return storedFileKind(storagePath)?.kind ?? null
}

function megabytes(bytes: number): string {
  const value = bytes / MB
  return Number.isInteger(value) ? `${value} MB` : `${value.toFixed(1)} MB`
}

/** "Photo (JPEG, PNG, HEIC or WebP) or PDF · up to 10 MB" — the hint under a file picker. */
export function uploadAllowedHint(kind: UploadKind): string {
  const policy = UPLOAD_ALLOWED_TYPES[kind]
  if (!policy) return ''
  const what = policy.accepts.replace(/^an? /, '').replace(/ or an? /, ' or ')
  return `${what.charAt(0).toUpperCase()}${what.slice(1)} · up to ${megabytes(policy.maxBytes)}`
}

/** The `accept` attribute for a web file input of this kind (extensions and content types). */
export function uploadAcceptAttribute(kind: UploadKind): string {
  const policy = UPLOAD_ALLOWED_TYPES[kind]
  if (!policy) return ''
  return [...policy.extensions.map((ext) => `.${ext}`), ...policy.contentTypes].join(',')
}

/** Lower-case extension after the last dot ('' when none). */
export function uploadFileExtension(fileName: string | null | undefined): string {
  const name = typeof fileName === 'string' ? fileName.trim() : ''
  const slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'))
  const base = slash >= 0 ? name.slice(slash + 1) : name
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return ''
  return base.slice(dot + 1).toLowerCase()
}

const EXTENSION_TYPES: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  hif: 'image/heif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  csv: 'text/csv',
  // Named only so the refusal can say what the file is; never allowed.
  svg: 'image/svg+xml',
  svgz: 'image/svg+xml',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroenabled.12',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  docm: 'application/vnd.ms-word.document.macroenabled.12',
  zip: 'application/zip',
}

/** Claimed types that say nothing about the file: judged by the extension and the bytes instead. */
const UNINFORMATIVE_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream', 'application/x-unknown', 'application/unknown'])

/**
 * A claimed content type in the rulebook's spelling: lower case, parameters dropped, aliases folded
 * (`image/jpg` / `image/pjpeg` → `image/jpeg`, `application/x-pdf` → `application/pdf`, …). '' for a type that says
 * nothing (`application/octet-stream`, blank). For the CSV import, the types browsers report for a `.csv` on
 * Windows (`application/vnd.ms-excel`, `text/plain`, `application/csv`) read as `text/csv`.
 */
export function normalizeUploadContentType(contentType: string | null | undefined, kind?: UploadKind | null): string {
  const raw = (typeof contentType === 'string' ? contentType : '').split(';')[0].trim().toLowerCase()
  if (UNINFORMATIVE_TYPES.has(raw)) return ''
  switch (raw) {
    case 'image/jpg':
    case 'image/pjpeg':
      return 'image/jpeg'
    case 'image/x-png':
      return 'image/png'
    case 'image/heic-sequence':
      return 'image/heic'
    case 'image/heif-sequence':
      return 'image/heif'
    case 'application/x-pdf':
    case 'application/acrobat':
      return 'application/pdf'
    case 'text/comma-separated-values':
    case 'application/csv':
    case 'text/x-csv':
      return 'text/csv'
    case 'application/vnd.ms-excel':
    case 'text/plain':
      return kind === 'material_catalogue_import' ? 'text/csv' : raw
    default:
      return raw
  }
}

function headArray(headBytes: unknown): number[] | null {
  if (headBytes == null) return null
  if (typeof ArrayBuffer !== 'undefined' && headBytes instanceof ArrayBuffer) return Array.from(new Uint8Array(headBytes))
  if (typeof headBytes === 'object' && typeof (headBytes as ArrayLike<number>).length === 'number') {
    const like = headBytes as ArrayLike<number>
    const out: number[] = []
    const n = Math.min(like.length, UPLOAD_HEAD_BYTES)
    for (let i = 0; i < n; i += 1) out.push(Number(like[i]) & 0xff)
    return out
  }
  return null
}

function ascii(bytes: number[], start: number, length: number): string {
  let out = ''
  for (let i = start; i < start + length && i < bytes.length; i += 1) out += String.fromCharCode(bytes[i])
  return out
}

function startsWith(bytes: number[], signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false
  return signature.every((value, index) => bytes[offset + index] === value)
}

const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs'])
const HEIF_BRANDS = new Set(['mif1', 'msf1', 'heif'])

/**
 * The real type of a file from its first bytes (magic numbers): `image/jpeg`, `image/png`, `image/webp`,
 * `image/heic`, `image/heif`, `application/pdf`; also the types it must never be (`image/gif`, `image/svg+xml`,
 * `application/zip` — which is every .docx, .xlsx and .xlsm —, `application/x-ole-storage` — .doc / .xls —,
 * `text/html`), so a refusal can say so. For the CSV import, text with no NUL byte and no markup reads as
 * `text/csv`. Null when nothing is recognised.
 */
export function detectUploadContentType(headBytes: unknown, kind?: UploadKind | null): string | null {
  const bytes = headArray(headBytes)
  if (!bytes || bytes.length === 0) return null
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp'
  if (ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4).toLowerCase()
    if (HEIC_BRANDS.has(brand)) return 'image/heic'
    if (HEIF_BRANDS.has(brand)) return 'image/heif'
    return 'video/mp4'
  }
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return 'image/gif'
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06])) return 'application/zip'
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return 'application/x-ole-storage'
  if (startsWith(bytes, [0x42, 0x4d])) return 'image/bmp'
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return 'image/tiff'
  const text = ascii(bytes, 0, bytes.length)
  // Markup first (1.50.0 review L2): a file whose first non-blank character is "<" is HTML / SVG / XML, never a PDF,
  // even when "%PDF-" appears further in (an HTML/PDF polyglot).
  const lead = text.replace(/^(\uFEFF|\xEF\xBB\xBF)/, '').trimStart().toLowerCase()
  if (lead.startsWith('<')) {
    return lead.includes('<svg') ? 'image/svg+xml' : 'text/html'
  }
  // PDF: "%PDF-" in the first 1024 bytes (the spec lets a header start after some leading bytes), with no "<" before it.
  const pdfAt = text.indexOf('%PDF-')
  if (pdfAt >= 0 && !text.slice(0, pdfAt).includes('<')) return 'application/pdf'
  if (!bytes.includes(0)) {
    if (lead.includes('<svg')) return 'image/svg+xml'
    if (lead.includes('<html') || lead.includes('<script')) return 'text/html'
    if (kind === 'material_catalogue_import') return 'text/csv'
  }
  return null
}

const SAME_FAMILY: Readonly<Record<string, string>> = {
  'image/heic': 'heif',
  'image/heif': 'heif',
}

function family(type: string): string {
  return SAME_FAMILY[type] ?? type
}

export type UploadRefusalReason =
  | 'unknown_kind'
  | 'empty'
  | 'too_large'
  | 'type_not_allowed'
  | 'content_unknown'
  | 'content_mismatch'

export type UploadDecision =
  | {
      allowed: true
      reason: null
      message: null
      /**
       * The type to write as upload metadata: the type read from the bytes (the claimed spelling kept when it is the
       * same type), never `application/octet-stream`. Null only when no bytes were given and neither the claimed
       * type nor the extension names one (a pick-time check; the upload passes the bytes).
       */
      contentType: string | null
      /** Whether `headBytes` were checked. Every upload passes them; a pick-time check may not. */
      contentChecked: boolean
    }
  | {
      allowed: false
      reason: UploadRefusalReason
      message: string
      contentType: null
      contentChecked: boolean
    }

export type UploadAllowedInput = {
  kind: UploadKind | string | null | undefined
  fileName?: string | null
  contentType?: string | null
  sizeBytes: number
  /** The file's first bytes (`UPLOAD_HEAD_BYTES`; fewer for a smaller file). Leave out only for a pick-time check. */
  headBytes?: ArrayLike<number> | ArrayBuffer | null
}

/** The refusal message for a kind (shown as is under the picker or on the save). */
export function uploadRefusalMessage(kind: UploadKind, reason: UploadRefusalReason): string {
  const policy = UPLOAD_ALLOWED_TYPES[kind]
  const tail = policy ? `Use ${policy.accepts}, up to ${megabytes(policy.maxBytes)}.` : ''
  switch (reason) {
    case 'unknown_kind':
      return 'This file cannot be uploaded here.'
    case 'empty':
      return `This file is empty. ${tail}`
    case 'too_large':
      return `This file is too large. ${tail}`
    case 'type_not_allowed':
      return `This type of file cannot be uploaded. ${tail}`
    case 'content_unknown':
      return `This file could not be recognised. ${tail}`
    case 'content_mismatch':
      return `This file is not the type its name says. ${tail}`
  }
}

/**
 * Whether a file may be uploaded as `kind` (rulebook §24, 1.50.0). Checks, in order: the kind, the size (above 0,
 * at most the kind's cap), the claimed type and the extension (each, when given, one the kind allows), then the
 * bytes: the type read from `headBytes` must be one the kind allows and the same as the claimed type and the
 * extension's type (HEIC and HEIF count as one). `contentType` on an allowed result is what the upload writes.
 */
export function uploadAllowed(input: UploadAllowedInput): UploadDecision {
  const checked = input.headBytes != null
  const refuse = (reason: UploadRefusalReason, kind: UploadKind | null): UploadDecision => ({
    allowed: false,
    reason,
    message: kind ? uploadRefusalMessage(kind, reason) : uploadRefusalMessage('task_attachment', 'unknown_kind'),
    contentType: null,
    contentChecked: checked,
  })
  if (!isUploadKind(input.kind)) return refuse('unknown_kind', null)
  const kind = input.kind
  const policy = UPLOAD_ALLOWED_TYPES[kind]
  const size = Number(input.sizeBytes)
  if (!Number.isFinite(size) || size <= 0) return refuse('empty', kind)
  if (size > policy.maxBytes) return refuse('too_large', kind)

  const allowedTypes = policy.contentTypes as readonly string[]
  const claimed = normalizeUploadContentType(input.contentType, kind)
  if (claimed && !allowedTypes.includes(claimed)) return refuse('type_not_allowed', kind)
  const extension = uploadFileExtension(input.fileName)
  const extensionType = extension ? EXTENSION_TYPES[extension] ?? null : null
  if (extension && (!policy.extensions.includes(extension) || !extensionType)) return refuse('type_not_allowed', kind)

  if (!checked) {
    return { allowed: true, reason: null, message: null, contentType: claimed || extensionType || null, contentChecked: false }
  }
  const detected = detectUploadContentType(input.headBytes, kind)
  if (!detected) return refuse('content_unknown', kind)
  if (!allowedTypes.includes(detected)) {
    return refuse(claimed || extensionType ? 'content_mismatch' : 'type_not_allowed', kind)
  }
  if (claimed && family(claimed) !== family(detected)) return refuse('content_mismatch', kind)
  if (extensionType && family(extensionType) !== family(detected)) return refuse('content_mismatch', kind)
  const contentType = claimed && family(claimed) === family(detected) ? claimed : detected
  return { allowed: true, reason: null, message: null, contentType, contentChecked: true }
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * A URL that may be put on a link (`href`, `window.open`), else null (1.50.0; review L3, owner brief: https only).
 * - `https:` with a host: always.
 * - `http:` only to `localhost`, `127.0.0.1` or `[::1]` (the Storage emulator's download URLs), or anywhere when
 *   `allowHttp` is set — used only for a material line's supplier `websiteURL`, which people type.
 * - Anything else — `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, a bare domain — is no link.
 */
export function safeExternalUrl(url: unknown, options: { allowHttp?: boolean } = {}): string | null {
  if (typeof url !== 'string') return null
  // Browsers drop ASCII tab / newline anywhere in a URL and leading control characters, so test what they will see.
  const cleaned = url.replace(/[\t\n\r]/g, '').replace(/^[\u0000-\u0020]+/, '').trim()
  if (!cleaned) return null
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i.exec(cleaned)
  if (!match) return null
  const scheme = match[1].toLowerCase()
  const authority = match[2]
  const hostPort = authority.includes('@') ? authority.slice(authority.lastIndexOf('@') + 1) : authority
  if (!hostPort || /[\s<>"\\]/.test(hostPort)) return null
  const host = (hostPort.startsWith('[') ? hostPort.slice(0, hostPort.indexOf(']') + 1) : hostPort.split(':')[0]).toLowerCase()
  if (!host) return null
  if (scheme === 'https') return cleaned
  if (scheme === 'http' && (options.allowHttp === true || LOOPBACK_HOSTS.has(host))) return cleaned
  return null
}

/**
 * Photos are redrawn on the device before upload (EXIF / GPS dropped, scaled down). Before that redraw, a photo is
 * refused when it is over `UPLOAD_PHOTO_PICK_MAX_BYTES` or over `UPLOAD_PHOTO_MAX_PIXELS` (read from its header, so a
 * decompression bomb is never decoded) — 1.50.0 review L4.
 */
export const UPLOAD_PHOTO_PICK_MAX_BYTES = 40 * MB
export const UPLOAD_PHOTO_MAX_PIXELS = 50_000_000
/** How many leading bytes to read for `imageDimensionsFromHeader` (a JPEG's frame header can sit after a large EXIF block). */
export const UPLOAD_DIMENSION_HEAD_BYTES = 512 * 1024

export const PHOTO_TOO_LARGE_TO_PREPARE_MESSAGE =
  'This photo is over 40 MB, too large to prepare. Use a smaller photo (JPEG, PNG, HEIC or WebP).'
export const PHOTO_TOO_MANY_PIXELS_MESSAGE =
  'This photo is over 50 megapixels, too large to prepare. Use a smaller photo (JPEG, PNG, HEIC or WebP).'

function u16be(b: number[], i: number): number {
  return ((b[i] << 8) | b[i + 1]) >>> 0
}
function u32be(b: number[], i: number): number {
  return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
}
function u16le(b: number[], i: number): number {
  return (b[i] | (b[i + 1] << 8)) >>> 0
}
function u24le(b: number[], i: number): number {
  return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)) >>> 0
}

function headArrayAll(headBytes: unknown, limit: number): number[] | null {
  if (headBytes == null) return null
  const view =
    typeof ArrayBuffer !== 'undefined' && headBytes instanceof ArrayBuffer ? new Uint8Array(headBytes) : (headBytes as ArrayLike<number>)
  if (typeof view !== 'object' || typeof view.length !== 'number') return null
  const n = Math.min(view.length, limit)
  const out = new Array<number>(n)
  for (let i = 0; i < n; i += 1) out[i] = Number(view[i]) & 0xff
  return out
}

/**
 * A photo's width and height from its header, without decoding it: PNG (IHDR), JPEG (the first SOF marker), WebP
 * (VP8 / VP8L / VP8X) and HEIC / HEIF (the largest `ispe` box). Null when the header does not say (or is not in the
 * bytes given — pass `UPLOAD_DIMENSION_HEAD_BYTES`).
 */
export function imageDimensionsFromHeader(headBytes: unknown): { width: number; height: number } | null {
  const b = headArrayAll(headBytes, UPLOAD_DIMENSION_HEAD_BYTES)
  if (!b || b.length < 12) return null
  const ok = (width: number, height: number) => (width > 0 && height > 0 ? { width, height } : null)
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47]) && b.length >= 24 && ascii(b, 12, 4) === 'IHDR') return ok(u32be(b, 16), u32be(b, 20))
  if (startsWith(b, [0xff, 0xd8])) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i += 1
        continue
      }
      const marker = b[i + 1]
      if (marker === 0xff) {
        i += 1
        continue
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2
        continue
      }
      const length = u16be(b, i + 2)
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isSof) return ok(u16be(b, i + 7), u16be(b, i + 5))
      if (length < 2) return null
      i += 2 + length
    }
    return null
  }
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP' && b.length >= 30) {
    const chunk = ascii(b, 12, 4)
    if (chunk === 'VP8X') return ok(u24le(b, 24) + 1, u24le(b, 27) + 1)
    if (chunk === 'VP8 ') return ok(u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff)
    if (chunk === 'VP8L') {
      const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0
      return ok((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)
    }
    return null
  }
  if (ascii(b, 4, 4) === 'ftyp') {
    // ispe: size(4) "ispe" version/flags(4) width(4) height(4). A HEIC holds one per image item (the grid and its
    // tiles); the largest is the picture.
    let best: { width: number; height: number } | null = null
    for (let i = 4; i + 16 <= b.length; i += 1) {
      if (b[i] === 0x69 && b[i + 1] === 0x73 && b[i + 2] === 0x70 && b[i + 3] === 0x65) {
        const width = u32be(b, i + 8)
        const height = u32be(b, i + 12)
        if (width > 0 && height > 0 && (!best || width * height > best.width * best.height)) best = { width, height }
      }
    }
    return best
  }
  return null
}

/**
 * Whether a photo may be redrawn for upload: refused over `UPLOAD_PHOTO_PICK_MAX_BYTES`, or over
 * `UPLOAD_PHOTO_MAX_PIXELS` when its size is known. Null when it may be prepared.
 */
export function photoPrepareRefusal(input: {
  sizeBytes: number
  width?: number | null
  height?: number | null
}): { reason: 'photo_too_large' | 'photo_too_many_pixels'; message: string } | null {
  const size = Number(input.sizeBytes)
  if (Number.isFinite(size) && size > UPLOAD_PHOTO_PICK_MAX_BYTES) {
    return { reason: 'photo_too_large', message: PHOTO_TOO_LARGE_TO_PREPARE_MESSAGE }
  }
  const width = Number(input.width)
  const height = Number(input.height)
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 && width * height > UPLOAD_PHOTO_MAX_PIXELS) {
    return { reason: 'photo_too_many_pixels', message: PHOTO_TOO_MANY_PIXELS_MESSAGE }
  }
  return null
}
