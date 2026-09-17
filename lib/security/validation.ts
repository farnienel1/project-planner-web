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

export function clampString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return null
  return trimmed
}

export function isStripeCheckoutSessionId(value: string): boolean {
  return /^cs_(test|live)_[A-Za-z0-9]+$/.test(value.trim())
}
