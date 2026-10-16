/** Client checks that match storage.rules. Does not change Canonical or stored field names. */

export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024
export const COMPANY_LOGO_MAX_BYTES = 5 * 1024 * 1024
export const WORK_FILE_MAX_BYTES = 10 * 1024 * 1024
export const QUALIFICATION_CERT_MAX_BYTES = 10 * 1024 * 1024
export const VARIATION_EVIDENCE_MAX_BYTES = 20 * 1024 * 1024
export const TIMESHEET_EXPORT_MAX_BYTES = 10 * 1024 * 1024

export type UploadFamily = 'profile' | 'logo' | 'certificate' | 'siteAudit' | 'work' | 'variation'

type NamedFile = { name: string; type?: string; size: number }

const WORK_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
])

const WORK_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'heif',
  'bmp',
  'tif',
  'tiff',
  'pdf',
  'xls',
  'xlsx',
  'xlsm',
  'doc',
  'docx',
  'csv',
  'zip',
])

const CERT_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg'])

export function fileExtension(name: string): string {
  const trimmed = name.trim()
  const dot = trimmed.lastIndexOf('.')
  if (dot <= 0 || dot === trimmed.length - 1) return ''
  return trimmed.slice(dot + 1).toLowerCase()
}

export function generatedStorageFileName(originalName: string, uid: string, timestamp = Date.now()): string {
  const ext = fileExtension(originalName)
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, '') || 'web'
  return ext ? `${safeUid}_${timestamp}.${ext}` : `${safeUid}_${timestamp}`
}

export function isImageContent(file: NamedFile): boolean {
  const type = (file.type || '').toLowerCase()
  if (type.startsWith('image/')) return true
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tif', 'tiff'].includes(fileExtension(file.name))
}

export function isPdfContent(file: NamedFile): boolean {
  return (file.type || '').toLowerCase() === 'application/pdf' || fileExtension(file.name) === 'pdf'
}

export function isCertificateType(file: NamedFile): boolean {
  const type = (file.type || '').toLowerCase()
  if (type === 'application/pdf' || type === 'image/jpeg' || type === 'image/jpg' || type === 'image/pjpeg') {
    return true
  }
  return CERT_EXTENSIONS.has(fileExtension(file.name))
}

/** Rules allow octet-stream as a hatch. Client only uses it for known work extensions. */
export function isWorkFileType(file: NamedFile): boolean {
  const type = (file.type || '').toLowerCase()
  if (type.startsWith('image/')) return true
  if (WORK_TYPES.has(type)) return true
  if (type === 'application/octet-stream' && WORK_EXTENSIONS.has(fileExtension(file.name))) return true
  return WORK_EXTENSIONS.has(fileExtension(file.name))
}

export function uploadLimitError(file: NamedFile, family: UploadFamily): string | null {
  switch (family) {
    case 'profile':
      if (!isImageContent(file) || file.size > PROFILE_PHOTO_MAX_BYTES) return 'Image only · max 2MB'
      return null
    case 'logo':
      if (!isImageContent(file) && !isPdfContent(file)) return 'Logo must be a JPEG, PNG or PDF file.'
      if (file.size > COMPANY_LOGO_MAX_BYTES) return 'Logo must be 5 MB or smaller.'
      return null
    case 'certificate':
      if (file.size > QUALIFICATION_CERT_MAX_BYTES || !isCertificateType(file)) return 'PDF or JPEG only · max 10MB'
      return null
    case 'siteAudit':
      if (!isImageContent(file) || file.size > WORK_FILE_MAX_BYTES) return 'Photos only · max 10MB'
      return null
    case 'work':
      if (!isWorkFileType(file) || file.size > WORK_FILE_MAX_BYTES) {
        return 'Use an image, PDF, Word, Excel, CSV or ZIP file up to 10MB.'
      }
      return null
    case 'variation':
      if (!isWorkFileType(file) || file.size > VARIATION_EVIDENCE_MAX_BYTES) {
        return 'Use an image, PDF, Word, Excel, CSV or ZIP file up to 20MB.'
      }
      return null
    default:
      return 'That file cannot be uploaded.'
  }
}

export function shouldStripPhotoLocation(file: NamedFile): boolean {
  const type = (file.type || '').toLowerCase()
  if (type === 'image/svg+xml' || type === 'image/gif') return false
  return isImageContent(file)
}
