const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidEmail(value: string): boolean {
  const email = value.trim()
  return email.length > 0 && email.length <= 254 && EMAIL_PATTERN.test(email)
}

export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim())
}

/**
 * A Firestore document id the server may put in a path: 1–128 letters, digits, `_` or `-` (Firebase Auth uids,
 * UUIDs, auto ids). Never a `/`, `.` or `..`, so a body value can never point a read or write at another path.
 */
const DOCUMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

export function isValidDocumentId(value: unknown): value is string {
  return typeof value === 'string' && DOCUMENT_ID_PATTERN.test(value)
}

export function clampString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return null
  return trimmed
}

export function isStripeCheckoutSessionId(value: string): boolean {
  return /^cs_(test|live)_[A-Za-z0-9]+$/.test(value.trim())
}
