/**
 * The one check every web upload passes (rulebook 1.50.0 §24): `uploadAllowed` for the Storage path's kind, with the
 * file's first bytes, before anything is sent. Returns the content type to write (the type read from the bytes),
 * never `application/octet-stream`. Called by `uploadFile` and `uploadVariationEvidenceFile`.
 */
import {
  UPLOAD_DIMENSION_HEAD_BYTES,
  UPLOAD_HEAD_BYTES,
  imageDimensionsFromHeader,
  photoPrepareRefusal,
  uploadAllowed,
  uploadKindForStoragePath,
  type UploadKind,
} from '@/lib/canonical/uploadPolicy'

export class UploadRefusedError extends Error {
  readonly reason: string
  constructor(message: string, reason: string) {
    super(message)
    this.name = 'UploadRefusedError'
    this.reason = reason
  }
}

async function headBytes(file: Blob): Promise<Uint8Array> {
  const slice = file.slice(0, UPLOAD_HEAD_BYTES)
  if (typeof slice.arrayBuffer === 'function') return new Uint8Array(await slice.arrayBuffer())
  return new Uint8Array(await new Response(slice).arrayBuffer())
}

/**
 * 1.50.0 review M1: the Storage rules live before 1.50.0 (`storage.rules` at fc1c5b9) stay live until iOS 1.50 ships
 * and `minimumIosBuild` is raised. Until then web sends only what those rules accept as well as what the rulebook
 * allows. The only difference is certificates: the old rules take PDF and JPEG only, so certificate photos are
 * redrawn to JPEG (`prepareClientUpload(file, 'certificate')`). Set to true (and delete the table) in the release
 * after the 1.50.0 Storage rules are published.
 */
export const STORAGE_RULES_1_50_PUBLISHED = false

const MB = 1024 * 1024
const PRE_150_WORK_TYPES = [
  'application/pdf',
  'application/octet-stream',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
]
type Pre150Rule = { anyImage: boolean; noSvg?: boolean; types: readonly string[]; maxBytes: number }
/** What the pre-1.50.0 Storage rules accept per path (declared type, size), read from storage.rules at fc1c5b9. */
export const PRE_150_STORAGE_RULES: Readonly<Record<Exclude<UploadKind, 'material_catalogue_import'>, Pre150Rule>> = {
  profile_photo: { anyImage: true, types: [], maxBytes: 2 * MB },
  company_logo: { anyImage: true, types: ['application/pdf'], maxBytes: 5 * MB },
  timesheet_export: { anyImage: false, types: ['application/pdf'], maxBytes: 10 * MB },
  qualification_certificate: { anyImage: false, types: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/pjpeg'], maxBytes: 10 * MB },
  variation_evidence: { anyImage: true, types: PRE_150_WORK_TYPES, maxBytes: 20 * MB },
  site_audit_photo: { anyImage: true, types: [], maxBytes: 10 * MB },
  task_attachment: { anyImage: true, types: PRE_150_WORK_TYPES, maxBytes: 10 * MB },
  health_safety: { anyImage: true, types: PRE_150_WORK_TYPES, maxBytes: 10 * MB },
  paye_claim_evidence: { anyImage: true, noSvg: true, types: ['application/pdf'], maxBytes: 10 * MB },
  personal_site_audit: { anyImage: true, noSvg: true, types: [], maxBytes: 10 * MB },
}

/** Whether the pre-1.50.0 Storage rules accept this upload (declared type and size). */
export function pre150RulesAccept(kind: UploadKind, contentType: string, sizeBytes: number): boolean {
  if (kind === 'material_catalogue_import') return false
  const rule = PRE_150_STORAGE_RULES[kind]
  const type = contentType.toLowerCase()
  if (sizeBytes > rule.maxBytes) return false
  if (rule.anyImage && type.startsWith('image/') && !(rule.noSvg && type === 'image/svg+xml')) return true
  return rule.types.includes(type)
}

export const CERTIFICATE_JPEG_OR_PDF_MESSAGE =
  'Certificates are saved as a PDF or a JPEG photo for now. Save this one as a JPEG or PDF and try again.'

function lastSegment(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || ''
}

/**
 * Throws `UploadRefusedError` (the rulebook's message) when the file may not go to this path; otherwise the content
 * type to upload with. The file's own name is checked when it has one (a `File`), else the object name.
 */
export async function assertUploadAllowed(storagePath: string, file: Blob, claimedContentType?: string | null): Promise<string> {
  const kind = uploadKindForStoragePath(storagePath)
  if (!kind) throw new UploadRefusedError('This file cannot be uploaded here.', 'unknown_kind')
  const ownName = typeof (file as File).name === 'string' ? (file as File).name : ''
  const decision = uploadAllowed({
    kind,
    fileName: ownName || lastSegment(storagePath),
    contentType: file.type || claimedContentType || '',
    sizeBytes: file.size,
    headBytes: await headBytes(file),
  })
  if (!decision.allowed) throw new UploadRefusedError(decision.message, decision.reason)
  if (!decision.contentType) throw new UploadRefusedError('This file could not be recognised.', 'content_unknown')
  if (!STORAGE_RULES_1_50_PUBLISHED && !pre150RulesAccept(kind, decision.contentType, file.size)) {
    throw new UploadRefusedError(
      kind === 'qualification_certificate' ? CERTIFICATE_JPEG_OR_PDF_MESSAGE : 'This file cannot be uploaded yet.',
      'type_not_allowed'
    )
  }
  return decision.contentType
}

/**
 * Rulebook 1.50.0 (review L4): refuse a photo before it is decoded when it is over 40 MB or its header says it is
 * over 50 megapixels (`photoPrepareRefusal`, `imageDimensionsFromHeader`). Throws `UploadRefusedError`.
 */
export async function assertPhotoPreparable(file: Blob): Promise<void> {
  const early = photoPrepareRefusal({ sizeBytes: file.size })
  if (early) throw new UploadRefusedError(early.message, early.reason)
  const head = file.slice(0, UPLOAD_DIMENSION_HEAD_BYTES)
  const bytes =
    typeof head.arrayBuffer === 'function' ? new Uint8Array(await head.arrayBuffer()) : new Uint8Array(await new Response(head).arrayBuffer())
  const size = imageDimensionsFromHeader(bytes)
  const refusal = photoPrepareRefusal({ sizeBytes: file.size, width: size?.width, height: size?.height })
  if (refusal) throw new UploadRefusedError(refusal.message, refusal.reason)
}

/** The same check on a decoded bitmap, for a format whose header did not say its size; call before drawing it. */
export function assertBitmapPreparable(width: number, height: number): void {
  const refusal = photoPrepareRefusal({ sizeBytes: 0, width, height })
  if (refusal) throw new UploadRefusedError(refusal.message, refusal.reason)
}
