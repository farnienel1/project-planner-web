/**
 * Web file-picker checks. The rule is the rulebook's (`uploadAllowed`, §24, 1.50.0): this file only maps the web's
 * picker families to the rulebook's upload kinds. `storage.rules` enforces the same types and caps on the server, and
 * every upload passes through `assertUploadAllowed` (`lib/security/uploadGuard.ts`), which also checks the bytes.
 */
import { storedFileObjectName } from '@/lib/canonical/storedFiles'
import {
  UPLOAD_ALLOWED_TYPES,
  photoPrepareRefusal,
  uploadAllowed,
  uploadFileExtension,
  type UploadKind,
} from '@/lib/canonical/uploadPolicy'

export const PROFILE_PHOTO_MAX_BYTES = UPLOAD_ALLOWED_TYPES.profile_photo.maxBytes
export const COMPANY_LOGO_MAX_BYTES = UPLOAD_ALLOWED_TYPES.company_logo.maxBytes
export const WORK_FILE_MAX_BYTES = UPLOAD_ALLOWED_TYPES.task_attachment.maxBytes
export const QUALIFICATION_CERT_MAX_BYTES = UPLOAD_ALLOWED_TYPES.qualification_certificate.maxBytes
/** 1.50.0: 10 MB (was 20 MB), like every other photo / PDF kind. */
export const VARIATION_EVIDENCE_MAX_BYTES = UPLOAD_ALLOWED_TYPES.variation_evidence.maxBytes
export const TIMESHEET_EXPORT_MAX_BYTES = UPLOAD_ALLOWED_TYPES.timesheet_export.maxBytes

/** Web picker families; each is one rulebook upload kind. */
export type UploadFamily = 'profile' | 'logo' | 'certificate' | 'siteAudit' | 'work' | 'variation' | 'claim'

const FAMILY_KIND: Record<UploadFamily, UploadKind> = {
  profile: 'profile_photo',
  logo: 'company_logo',
  certificate: 'qualification_certificate',
  siteAudit: 'site_audit_photo',
  work: 'task_attachment',
  variation: 'variation_evidence',
  claim: 'paye_claim_evidence',
}

export function uploadKindForFamily(family: UploadFamily): UploadKind {
  return FAMILY_KIND[family]
}

type NamedFile = { name: string; type?: string; size: number }

export function fileExtension(name: string): string {
  return uploadFileExtension(name)
}

/**
 * Rulebook 1.25.0 §24: every upload is a new object `{uid}_{unixMs}.{ext}` (`storedFileObjectName`), so a
 * replacement never overwrites the file it replaces and storage.rules can tell who uploaded it.
 */
export function generatedStorageFileName(originalName: string, uid: string, timestamp = Date.now()): string {
  const ext = fileExtension(originalName)
  const named = storedFileObjectName({ uid, unixMs: timestamp, extension: ext })
  if (named) return named
  const safeUid = uid.replace(/[^a-zA-Z0-9-]/g, '') || 'web'
  return storedFileObjectName({ uid: safeUid, unixMs: timestamp, extension: ext }) ?? `web_${timestamp}`
}

/** A photo by its claimed type or name (the bytes are checked at upload). */
export function isImageContent(file: { name: string; type?: string }): boolean {
  const type = (file.type || '').toLowerCase()
  if (type === 'image/svg+xml' || type === 'image/gif') return false
  if (type.startsWith('image/')) return true
  return ['jpg', 'jpeg', 'jpe', 'jfif', 'png', 'heic', 'heif', 'hif', 'webp'].includes(fileExtension(file.name))
}

/**
 * The rulebook's pick-time decision (names, types and size; the bytes are checked by `assertUploadAllowed` when the
 * file is uploaded). Null when allowed, else the rulebook's message.
 */
export function uploadLimitError(file: NamedFile, family: UploadFamily): string | null {
  const decision = uploadAllowed({
    kind: FAMILY_KIND[family],
    fileName: file.name,
    contentType: file.type ?? '',
    sizeBytes: file.size,
  })
  return decision.allowed ? null : decision.message
}

/** Photos are redrawn (GPS / EXIF dropped, large ones scaled down) before upload. */
export function shouldStripPhotoLocation(file: { name: string; type?: string }): boolean {
  return isImageContent(file)
}

/**
 * The check when a file is picked, before photos are redrawn: a photo's size is not judged yet, because the redraw
 * scales it down (`stripPhotoLocation`, `prepareAuditPhoto`); the redrawn file is checked with `uploadLimitError`.
 */
export function uploadPickError(file: NamedFile, family: UploadFamily): string | null {
  // 1.50.0 review L4: a photo over 40 MB is refused before it is redrawn.
  if (isImageContent(file)) {
    const refusal = photoPrepareRefusal({ sizeBytes: file.size })
    if (refusal) return refusal.message
  }
  const size = isImageContent(file) ? Math.min(file.size, 1) : file.size
  return uploadLimitError({ name: file.name, type: file.type, size: file.size > 0 ? size : 0 }, family)
}
