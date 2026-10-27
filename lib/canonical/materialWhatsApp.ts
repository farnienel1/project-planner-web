/**
 * Send via WhatsApp on a job's material list. One row per recipient with the
 * prepared message, the wa.me number, or the reason the number cannot open
 * WhatsApp (missing, too short or long, a UK landline). Web
 * (`MaterialsSendListSheet`) and iOS (`MaterialWhatsAppRulebook`, through
 * `CanonicalBusinessEngine.objectRows`) build no message text and normalise no
 * phone number themselves. Nothing is sent: the user presses Send in WhatsApp.
 *
 * Required delivery is `materialOrderIncludesDeliveryRequired` /
 * `formatMaterialDeliveryRequired`, so a quote never names a day or time.
 */

import { formatMaterialDeliveryRequired, materialOrderIncludesDeliveryRequired } from './materialDelivery'

/** Lines listed in the message; the rest are summarised as "…and N more items". */
export const MATERIAL_WHATSAPP_ITEM_LIMIT = 30

export type MaterialWhatsAppLine = {
  material: string
  quantity: number
  unit: string
  brand?: string | null
  productCode?: string | null
  notes?: string | null
  lengthDisplay?: string | null
}

export type MaterialWhatsAppRecipient = {
  /** Wholesaler contact id. */
  id: string
  name: string
  wholesalerName?: string | null
  /** `wholesalers/{id}.contacts[].phone`, as typed. */
  phone?: string | null
}

export type MaterialWhatsAppInput = {
  requestType: 'quote' | 'order' | string
  organisationName?: string | null
  requestingUserName?: string | null
  jobNumber?: string | null
  projectName?: string | null
  projectAddress?: string | null
  /** Required delivery instant (ISO string or Date). Ignored on a quote. */
  deliveryAt?: string | Date | null
  /** `organizations/{orgId}.countryCode` (ISO-2). Missing is GB. */
  countryCode?: string | null
  /** Zone the delivery day and time are written in. Missing is Europe/London. */
  timeZone?: string | null
  materials: readonly MaterialWhatsAppLine[]
  recipients: readonly MaterialWhatsAppRecipient[]
}

export type MaterialWhatsAppRow = {
  recipientId: string
  message: string
  ok: boolean
  /** wa.me digits (no +), or null when `ok` is false. */
  digits: string | null
  /** Why WhatsApp cannot open this number, or null when `ok`. */
  reason: string | null
  /** `https://wa.me/{digits}?text=…`, or null when `ok` is false. */
  url: string | null
}

/** ITU calling codes for organisation countries (the same ISO keys as the org time zones). */
const CALLING_CODES: Record<string, string> = {
  GB: '44', UK: '44', 'GB-ENG': '44', 'GB-SCT': '44', 'GB-NIR': '44', IE: '353', IM: '44', JE: '44', GG: '44',
  AD: '376', AL: '355', AM: '374', AO: '244', AR: '54', AT: '43', AU: '61', AW: '297', AX: '358', BA: '387',
  BB: '1246', BD: '880', BE: '32', BG: '359', BJ: '229', BO: '591', BR: '55', BS: '1242', BW: '267', BY: '375',
  BZ: '501', CA: '1', CD: '243', CG: '242', CH: '41', CL: '56', CN: '86', CO: '57', CR: '506', CU: '53',
  CY: '357', CZ: '420', DE: '49', DK: '45', DM: '1767', DO: '1809', EC: '593', EE: '372', EG: '20', ES: '34',
  FI: '358', FO: '298', FR: '33', GA: '241', GD: '1473', GE: '995', GH: '233', GI: '350', GL: '299', GM: '220',
  GP: '590', GR: '30', GT: '502', GY: '592', HK: '852', HN: '504', HR: '385', HT: '509', HU: '36', ID: '62',
  IN: '91', IS: '354', IT: '39', JM: '1876', JP: '81', KE: '254', KR: '82', KY: '1345', KZ: '7', LC: '1758',
  LI: '423', LS: '266', LT: '370', LU: '352', LV: '371', MA: '212', MC: '377', MD: '373', ME: '382', MG: '261',
  MK: '389', MN: '976', MQ: '596', MS: '1664', MT: '356', MX: '52', MZ: '258', NA: '264', NE: '227', NG: '234',
  NI: '505', NL: '31', NO: '47', NZ: '64', PA: '507', PE: '51', PG: '675', PH: '63', PL: '48', PR: '1',
  PT: '351', PY: '595', RO: '40', RS: '381', RU: '7', SC: '248', SE: '46', SG: '65', SI: '386', SJ: '47',
  SK: '421', SM: '378', SR: '597', SV: '503', TN: '216', TR: '90', UA: '380', UG: '256', US: '1', UY: '598',
  VA: '379', VE: '58', VN: '84', ZA: '27', ZW: '263',
}

const MIN_E164_LEN = 8
const MAX_E164_LEN = 15

function trim(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

function callingCodeForCountry(countryCode?: string | null): string {
  const code = (trim(countryCode) || 'GB').toUpperCase()
  return CALLING_CODES[code] || '44'
}

/** Singular or plural unit name the material emails and WhatsApp message print. */
export function materialQuantityLabel(unit: string, quantity: number): string {
  const raw = trim(unit) || 'Number'
  const key = raw.toLowerCase()
  const plural = Math.abs(quantity) !== 1
  if (key === 'number') return plural ? 'Numbers' : 'Number'
  if (key === 'box') return plural ? 'Boxes' : 'Box'
  if (key === 'length') return plural ? 'Lengths' : 'Length'
  if (key === 'drum') return plural ? 'Drums' : 'Drum'
  if (key === 'pallet') return plural ? 'Pallets' : 'Pallet'
  return raw
}

type WhatsAppNumber = { ok: true; digits: string } | { ok: false; reason: string }

/**
 * A stored contact number as wa.me digits. A national number (leading 0) takes
 * the organisation's calling code; `+` or `00` numbers stay international.
 * UK `07700 900123` with GB → `447700900123`.
 */
function whatsAppNumber(raw: string | null | undefined, countryCode?: string | null): WhatsAppNumber {
  const trimmed = trim(raw)
  if (!trimmed) return { ok: false, reason: 'No mobile number is saved for this contact.' }

  let working = trimmed.replace(/[^\d+]/g, '')
  if (working.startsWith('00')) working = `+${working.slice(2)}`

  const orgCalling = callingCodeForCountry(countryCode)
  let digits: string
  if (working.startsWith('+')) digits = working.slice(1).replace(/^0+/, '')
  else if (working.startsWith('0')) digits = `${orgCalling}${working.replace(/^0+/, '')}`
  else if (working.startsWith(orgCalling)) digits = working
  else digits = `${orgCalling}${working}`
  digits = digits.replace(/\D/g, '')

  if (digits.length < MIN_E164_LEN) return { ok: false, reason: 'This number is too short to open WhatsApp.' }
  if (digits.length > MAX_E164_LEN) return { ok: false, reason: 'This number is too long to open WhatsApp.' }
  if (digits.startsWith('44') && digits.length >= 3 && digits[2] !== '7') {
    return { ok: false, reason: 'This looks like a landline. WhatsApp needs a mobile number.' }
  }
  return { ok: true, digits }
}

function orderItemLines(materials: readonly MaterialWhatsAppLine[]): string {
  if (materials.length === 0) return '• (No materials listed)'
  const shown = materials.slice(0, MATERIAL_WHATSAPP_ITEM_LIMIT)
  const lines = shown.map((item) => {
    const qty = `${item.quantity} × ${item.material}`
    const extras = [
      trim(item.brand),
      trim(item.productCode) ? `Code ${trim(item.productCode)}` : '',
      trim(item.lengthDisplay),
      trim(item.notes),
    ].filter(Boolean)
    const unit = materialQuantityLabel(item.unit, item.quantity)
    const unitBit = unit && unit.toLowerCase() !== 'number' && unit.toLowerCase() !== 'numbers' ? ` (${unit})` : ''
    return extras.length ? `• ${qty}${unitBit} — ${extras.join(' · ')}` : `• ${qty}${unitBit}`
  })
  const remaining = materials.length - shown.length
  if (remaining > 0) {
    lines.push(`• …and ${remaining} more item${remaining === 1 ? '' : 's'}. We can send the full list by email.`)
  }
  return lines.join('\n')
}

function deliveryDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function whatsAppMessage(input: MaterialWhatsAppInput, recipient: MaterialWhatsAppRecipient): string {
  const isQuote = String(input.requestType).toLowerCase() === 'quote'
  const contact = trim(recipient.name) || 'there'
  const orgName = trim(input.organisationName)
  const org = orgName || 'our company'
  const lead = isQuote
    ? `Please see the following quote request from ${org}.`
    : `Please see the following material order from ${org}.`
  const confirm = isQuote
    ? 'Please can you confirm availability, pricing and the expected delivery date? This is only a quote request.'
    : 'Please can you confirm availability and the expected delivery date?'

  const lines: string[] = [`Hi ${contact},`, '', lead, '', isQuote ? 'QUOTE REQUEST' : 'MATERIAL ORDER']
  if (trim(input.jobNumber)) lines.push(`Job: ${trim(input.jobNumber)}`)
  if (trim(input.projectName)) lines.push(`Project: ${trim(input.projectName)}`)
  const address = trim(input.projectAddress)
  if (address) {
    lines.push('Project address:')
    lines.push(address)
  }
  if (trim(recipient.wholesalerName)) lines.push(`Supplier: ${trim(recipient.wholesalerName)}`)
  const delivery = deliveryDate(input.deliveryAt)
  if (materialOrderIncludesDeliveryRequired(isQuote ? 'quote' : 'order') && delivery) {
    lines.push(`Required delivery: ${formatMaterialDeliveryRequired(delivery, input.timeZone)}`)
  }
  lines.push('', 'ORDER DETAILS', orderItemLines(input.materials), '', confirm, '', 'Thanks,')
  lines.push(trim(input.requestingUserName) || 'Project Planner')
  if (orgName) lines.push(orgName)
  return lines.join('\n')
}

/** One row per recipient, in the order given. */
export function materialWhatsAppRows(input: MaterialWhatsAppInput): MaterialWhatsAppRow[] {
  return (input.recipients ?? []).map((recipient) => {
    const message = whatsAppMessage(input, recipient)
    const number = whatsAppNumber(recipient.phone, input.countryCode)
    if (!number.ok) {
      return { recipientId: recipient.id, message, ok: false, digits: null, reason: number.reason, url: null }
    }
    return {
      recipientId: recipient.id,
      message,
      ok: true,
      digits: number.digits,
      reason: null,
      url: `https://wa.me/${number.digits}?text=${encodeURIComponent(message)}`,
    }
  })
}
