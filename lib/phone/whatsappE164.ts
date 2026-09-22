import { callingCodeForCountry } from '@/lib/phone/callingCodes'

export type WhatsAppNumberResult =
  | { ok: true; digits: string; display: string }
  | { ok: false; reason: string }

const MIN_E164_LEN = 8
const MAX_E164_LEN = 15

function stripToDigitsAndPlus(raw: string): string {
  return raw.replace(/[^\d+]/g, '')
}

function stripLeadingZeros(digits: string): string {
  return digits.replace(/^0+/, '')
}

/**
 * Convert a stored supplier/contact telephone number into wa.me digits
 * (no +, spaces, brackets or hyphens).
 *
 * UK `07700 900123` with org country GB → `447700900123`.
 * Numbers that already include + / 00 / a country code are left international.
 */
export function toWhatsAppDigits(
  raw: string | null | undefined,
  countryCode?: string | null
): WhatsAppNumberResult {
  const trimmed = (raw || '').trim()
  if (!trimmed) {
    return { ok: false, reason: 'No mobile number is saved for this contact.' }
  }

  let working = stripToDigitsAndPlus(trimmed)
  if (working.startsWith('00')) working = `+${working.slice(2)}`

  const orgCalling = callingCodeForCountry(countryCode)
  let digits = ''

  if (working.startsWith('+')) {
    digits = stripLeadingZeros(working.slice(1))
  } else if (working.startsWith('0')) {
    digits = `${orgCalling}${stripLeadingZeros(working)}`
  } else if (working.startsWith(orgCalling)) {
    digits = working
  } else {
    digits = `${orgCalling}${working}`
  }

  digits = digits.replace(/\D/g, '')

  if (digits.length < MIN_E164_LEN) {
    return { ok: false, reason: 'This number is too short to open WhatsApp.' }
  }
  if (digits.length > MAX_E164_LEN) {
    return { ok: false, reason: 'This number is too long to open WhatsApp.' }
  }

  if (digits.startsWith('44') && digits.length >= 3 && digits[2] !== '7') {
    return {
      ok: false,
      reason: 'This looks like a landline. WhatsApp needs a mobile number.',
    }
  }

  return { ok: true, digits, display: trimmed }
}

export function buildWhatsAppClickToChatUrl(digits: string, message: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
