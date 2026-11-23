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
import { withTimeout } from '@/lib/client/withTimeout'

export { QUALIFICATION_CERT_MAX_BYTES }

/**
 * How long a qualification save waits for the server to confirm a write (owner issue 16, 23 Nov: renewing a
 * certificate left Save on "Saving…"). Firestore keeps a write it cannot send queued and retries it for ever, so an
 * unbounded `await setDoc(...)` never settles on a poor link and the screen never comes back. After this long the
 * save stops waiting and says so; the write may still arrive (the live list then shows it).
 */
export const QUALIFICATION_SAVE_CONFIRM_MS = 20_000

export const QUALIFICATION_SAVE_UNCONFIRMED_MESSAGE =
  'The server has not confirmed this save yet. Check your connection — the change may still arrive. Reload the page before saving again.'

/** A qualification write, waited for at most `ms` (rejects with `QUALIFICATION_SAVE_UNCONFIRMED_MESSAGE`). */
export function confirmQualificationWrite<T>(write: Promise<T>, ms: number = QUALIFICATION_SAVE_CONFIRM_MS): Promise<T> {
  return withTimeout(write, ms, QUALIFICATION_SAVE_UNCONFIRMED_MESSAGE)
}

/** Rulebook 1.50.0 §24: a PDF or a photo (JPEG, PNG, HEIC, WebP); the file is still checked by `uploadAllowed`. */
export const QUALIFICATION_CERT_ACCEPT = uploadAcceptAttribute('qualification_certificate')

export const QUALIFICATION_CERT_HINT = uploadAllowedHint('qualification_certificate')

type NamedFile = { name: string; type?: string; size: number }

export function qualificationCertificateFileError(file: NamedFile): string | null {
  return uploadLimitError(file, 'certificate')
}

/**
 * The stored certificate URLs less every key a save is replacing — the same qualification id in another letter case
 * (iOS stores upper-case UUIDs). Keys the save does not name are kept, so a partial draft never wipes other
 * certificates. Display/merge input only; `mergeOperativeQualificationWrite` still decides the write.
 */
export function certificateUrlsWithoutReplaced(
  stored: Record<string, string> | undefined,
  next: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!stored) return stored
  const replaced = new Map<string, string>()
  for (const [key, value] of Object.entries(next || {})) {
    if (typeof value === 'string' && value.trim()) replaced.set(key.toLowerCase(), key)
  }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(stored)) {
    const nextKey = replaced.get(key.toLowerCase())
    if (nextKey !== undefined && nextKey !== key) continue
    out[key] = value
  }
  return out
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
 * Thrown when one or more certificates uploaded but their links were not saved (the link write failed or timed out,
 * or a later upload failed). Carries the links so the screen keeps them as "uploaded, waiting for the server": the
 * next Save writes the links and never uploads the same file again (review of #415).
 */
export class CertificatesNotLinkedError extends Error {
  readonly certificateUrls: Record<string, string>
  readonly uploadedIds: string[]
  readonly cause: unknown
  constructor(certificateUrls: Record<string, string>, uploadedIds: string[], cause: unknown) {
    super(CERTIFICATE_UPLOADED_NOT_LINKED_MESSAGE)
    this.name = 'CertificatesNotLinkedError'
    this.certificateUrls = certificateUrls
    this.uploadedIds = uploadedIds
    this.cause = cause
  }
}

export const CERTIFICATE_UPLOADED_NOT_LINKED_MESSAGE =
  'The certificate uploaded, but the server has not confirmed it on this profile yet. Press Save again to finish — the file will not be uploaded again.'

/**
 * Persist the assignment first. Certificate upload runs after and must not
 * prevent that write. A failed upload leaves pending files for retry; files that did upload are reported with
 * `CertificatesNotLinkedError` so they are never uploaded twice.
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
  for (const file of Object.values(args.pending)) {
    const error = qualificationCertificateFileError(file)
    if (error) throw new Error(error)
  }
  const uploaded: Record<string, string> = {}
  try {
    for (const [qualificationId, file] of Object.entries(args.pending)) {
      uploaded[qualificationId] = await args.uploadOne(qualificationId, file)
    }
  } catch (error) {
    if (Object.keys(uploaded).length === 0) throw error
    throw new CertificatesNotLinkedError(mergeQualificationCertificateUrls(existing, uploaded), Object.keys(uploaded), error)
  }
  const certificateUrls = mergeQualificationCertificateUrls(existing, uploaded)
  try {
    await args.saveCertificateUrls(certificateUrls)
  } catch (error) {
    throw new CertificatesNotLinkedError(certificateUrls, Object.keys(uploaded), error)
  }
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
