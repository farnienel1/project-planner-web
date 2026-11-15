/**
 * My Qualifications certificate pick/save helpers.
 * iOS: OperativeQualificationsEditorView — PDF/JPEG max 10MB, persist on Save
 * to qualificationCertificateURLs / qualificationExpiryDates on the operative.
 *
 * Assignment write shape and URL merge live in lib/canonical/operativeQualifications.
 * Save the assignment first; upload must not block that write.
 */
import {
  mergeQualificationCertificateUrls,
  qualificationCertificateUrl,
} from '@/lib/canonical/operativeQualifications'
import { QUALIFICATION_CERT_MAX_BYTES, uploadLimitError } from '@/lib/security/uploadLimits'
import { uploadAcceptAttribute, uploadAllowedHint } from '@/lib/canonical/uploadPolicy'

export { QUALIFICATION_CERT_MAX_BYTES }

/** Rulebook 1.50.0 §24: a PDF or a photo (JPEG, PNG, HEIC, WebP); the file is still checked by `uploadAllowed`. */
export const QUALIFICATION_CERT_ACCEPT = uploadAcceptAttribute('qualification_certificate')

export const QUALIFICATION_CERT_HINT = uploadAllowedHint('qualification_certificate')

type NamedFile = { name: string; type?: string; size: number }

export function qualificationCertificateFileError(file: NamedFile): string | null {
  return uploadLimitError(file, 'certificate')
}

export function mergeCertificateUrls(
  existing: Record<string, string> | undefined,
  uploaded: Record<string, string>
): Record<string, string> {
  return mergeQualificationCertificateUrls(existing, uploaded)
}

/** iOS keys this map by qualification UUID. Match ignoring case so a stored URL still shows. */
export function certificateUrlForQualification(
  urls: Record<string, string> | undefined,
  qualificationId: string
): string | undefined {
  return qualificationCertificateUrl(urls, qualificationId)
}

/**
 * Rewrite URL keys onto the qualification ids iOS already stores.
 * Other keys are kept so a profile is not stripped of certificates the web list does not show.
 */
export function canonicalCertificateUrls(
  qualifications: { id: string }[],
  urls: Record<string, string> | undefined
): Record<string, string> {
  const next: Record<string, string> = {}
  const used = new Set<string>()
  for (const qual of qualifications) {
    const id = qual.id?.trim()
    if (!id) continue
    const url = certificateUrlForQualification(urls, id)
    if (!url) continue
    next[id] = url
    used.add(id.toLowerCase())
  }
  for (const [key, value] of Object.entries(urls || {})) {
    if (!value?.trim() || used.has(key.toLowerCase())) continue
    next[key] = value
  }
  return next
}

export async function uploadPendingCertificates<T extends NamedFile>(args: {
  pending: Record<string, T>
  existingUrls?: Record<string, string>
  uploadOne: (qualificationId: string, file: T) => Promise<string>
}): Promise<Record<string, string>> {
  const uploaded: Record<string, string> = {}
  for (const [qualificationId, file] of Object.entries(args.pending)) {
    const error = qualificationCertificateFileError(file)
    if (error) throw new Error(error)
    uploaded[qualificationId] = await args.uploadOne(qualificationId, file)
  }
  return mergeQualificationCertificateUrls(args.existingUrls, uploaded)
}

/**
 * Persist the assignment first. Certificate upload runs after and must not
 * prevent that write. A failed upload leaves pending files for retry.
 */
export async function persistQualificationsThenCertificates<T extends NamedFile>(args: {
  pending: Record<string, T>
  existingUrls?: Record<string, string>
  saveAssignment: () => Promise<void>
  uploadOne: (qualificationId: string, file: T) => Promise<string>
  saveCertificateUrls: (urls: Record<string, string>) => Promise<void>
}): Promise<{ certificateUrls: Record<string, string> }> {
  await args.saveAssignment()
  const existing = mergeQualificationCertificateUrls(args.existingUrls, {})
  if (Object.keys(args.pending).length === 0) {
    return { certificateUrls: existing }
  }
  const certificateUrls = await uploadPendingCertificates({
    pending: args.pending,
    existingUrls: existing,
    uploadOne: args.uploadOne,
  })
  await args.saveCertificateUrls(certificateUrls)
  return { certificateUrls }
}

export function localDateInputValue(date?: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateFromLocalInputValue(value: string): Date | undefined {
  if (!value) return undefined
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
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
    return 'Could not upload the certificate. Storage permissions blocked this file. Stay signed in and try a PDF or photo under 10 MB.'
  }
  if (text.includes('storage/retry-limit-exceeded') || text.includes('network-request-failed')) {
    return 'Could not upload the certificate. Check your connection and try again.'
  }
  if (raw.trim()) return raw
  return 'Could not save qualifications. Try again.'
}
