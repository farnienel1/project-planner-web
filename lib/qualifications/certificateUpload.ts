/**
 * My Qualifications certificate pick/save helpers.
 * iOS: OperativeQualificationsEditorView — PDF/JPEG max 10MB, persist on Save
 * to qualificationCertificateURLs / qualificationExpiryDates on the operative.
 */

export const QUALIFICATION_CERT_MAX_BYTES = 10 * 1024 * 1024

/** Broad enough for OS file pickers; the file is still validated as PDF/JPEG. */
export const QUALIFICATION_CERT_ACCEPT =
  '.pdf,.jpg,.jpeg,application/pdf,image/jpeg,image/jpg,image/pjpeg,image/*'

export const QUALIFICATION_CERT_HINT = 'PDF or JPEG only · max 10MB'

type NamedFile = { name: string; type?: string; size: number }

function fileExtension(name: string): string {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

export function isQualificationCertificateJpeg(file: NamedFile): boolean {
  const type = (file.type || '').toLowerCase()
  const ext = fileExtension(file.name)
  return (
    type === 'image/jpeg' ||
    type === 'image/jpg' ||
    type === 'image/pjpeg' ||
    ext === 'jpg' ||
    ext === 'jpeg'
  )
}

export function isQualificationCertificatePdf(file: NamedFile): boolean {
  const type = (file.type || '').toLowerCase()
  const ext = fileExtension(file.name)
  return type === 'application/pdf' || ext === 'pdf'
}

export function qualificationCertificateFileError(file: NamedFile): string | null {
  if (file.size > QUALIFICATION_CERT_MAX_BYTES) return QUALIFICATION_CERT_HINT
  if (isQualificationCertificatePdf(file) || isQualificationCertificateJpeg(file)) return null
  return QUALIFICATION_CERT_HINT
}

export function qualificationCertificateContentType(file: NamedFile): string {
  if (isQualificationCertificatePdf(file)) return 'application/pdf'
  return 'image/jpeg'
}

export function mergeCertificateUrls(
  existing: Record<string, string> | undefined,
  uploaded: Record<string, string>
): Record<string, string> {
  return { ...(existing || {}), ...uploaded }
}

export async function uploadPendingCertificates<T extends NamedFile>(args: {
  pending: Record<string, T>
  existingUrls?: Record<string, string>
  uploadOne: (qualificationId: string, file: T) => Promise<string>
}): Promise<Record<string, string>> {
  const next = { ...(args.existingUrls || {}) }
  for (const [qualificationId, file] of Object.entries(args.pending)) {
    const error = qualificationCertificateFileError(file)
    if (error) throw new Error(error)
    next[qualificationId] = await args.uploadOne(qualificationId, file)
  }
  return next
}

export function formatCertificateSaveError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err || '')
  const code =
    typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : ''
  const text = `${code} ${raw}`.toLowerCase()
  if (
    text.includes('unauthorized') ||
    text.includes('permission-denied') ||
    text.includes('storage/unauthorized')
  ) {
    return 'Could not upload the certificate. Storage permissions blocked this file. Stay signed in and try a PDF or JPEG under 10MB.'
  }
  if (text.includes('storage/retry-limit-exceeded') || text.includes('network-request-failed')) {
    return 'Could not upload the certificate. Check your connection and try again.'
  }
  if (raw.trim()) return raw
  return 'Could not save qualifications. Try again.'
}
