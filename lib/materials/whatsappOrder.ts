import { format } from 'date-fns'
import { quantityLabel, supplierGreeting } from '@/lib/materials/sendListLogic'
import { buildWhatsAppClickToChatUrl, toWhatsAppDigits } from '@/lib/phone/whatsappE164'

export const WHATSAPP_ITEM_LIMIT = 30

export type WhatsAppOrderLine = {
  material: string
  quantity: number
  unit: string
  brand?: string
  productCode?: string
  notes?: string
  lengthDisplay?: string
}

export type WhatsAppOrderContext = {
  requestType: 'quote' | 'order'
  organisationName: string
  requestingUserName: string
  contactName: string
  supplierName?: string
  jobNumber: string
  projectName?: string
  projectAddress?: string
  deliveryDate?: Date | null
  materials: WhatsAppOrderLine[]
}

function trim(value?: string | null): string {
  return (value || '').trim()
}

export function formatWhatsAppDeliveryDate(date?: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return 'To be confirmed'
  return format(date, 'EEEE, d MMMM yyyy')
}

export function formatWhatsAppOrderItems(materials: WhatsAppOrderLine[]): string {
  if (materials.length === 0) return '• (No materials listed)'
  const shown = materials.slice(0, WHATSAPP_ITEM_LIMIT)
  const lines = shown.map((item) => {
    const qty = `${item.quantity} × ${item.material}`
    const extras = [
      trim(item.brand),
      trim(item.productCode) ? `Code ${trim(item.productCode)}` : '',
      trim(item.lengthDisplay),
      trim(item.notes),
    ].filter(Boolean)
    const unit = quantityLabel(item.unit, item.quantity)
    const unitBit = unit && unit.toLowerCase() !== 'number' && unit.toLowerCase() !== 'numbers' ? ` (${unit})` : ''
    return extras.length ? `• ${qty}${unitBit} — ${extras.join(' · ')}` : `• ${qty}${unitBit}`
  })
  const remaining = materials.length - shown.length
  if (remaining > 0) {
    lines.push(`• …and ${remaining} more item${remaining === 1 ? '' : 's'}. We can send the full list by email.`)
  }
  return lines.join('\n')
}

export function buildMaterialWhatsAppMessage(context: WhatsAppOrderContext): string {
  const contact = supplierGreeting(context.contactName, true)
  const org = trim(context.organisationName) || 'our company'
  const isQuote = context.requestType === 'quote'
  const lead = isQuote
    ? `Please see the following quote request from ${org}.`
    : `Please see the following material order from ${org}.`
  const confirm = isQuote
    ? 'Please can you confirm availability, pricing and the expected delivery date? This is only a quote request.'
    : 'Please can you confirm availability and the expected delivery date?'

  const lines: string[] = [`Hi ${contact},`, '', lead, '']
  if (isQuote) lines.push('QUOTE REQUEST')
  else lines.push('MATERIAL ORDER')
  if (trim(context.jobNumber)) lines.push(`Job: ${trim(context.jobNumber)}`)
  if (trim(context.projectName)) lines.push(`Project: ${trim(context.projectName)}`)
  const address = trim(context.projectAddress)
  if (address) {
    lines.push('Project address:')
    lines.push(address)
  }
  if (trim(context.supplierName)) lines.push(`Supplier: ${trim(context.supplierName)}`)
  lines.push(`Required delivery: ${formatWhatsAppDeliveryDate(context.deliveryDate)}`)
  lines.push('')
  lines.push('ORDER DETAILS')
  lines.push(formatWhatsAppOrderItems(context.materials))
  lines.push('')
  lines.push(confirm)
  lines.push('')
  lines.push('Thanks,')
  lines.push(trim(context.requestingUserName) || 'Project Planner')
  if (trim(context.organisationName)) lines.push(trim(context.organisationName))
  return lines.join('\n')
}

export function openWhatsAppClickToChat(digits: string, message: string): { url: string; opened: boolean } {
  const url = buildWhatsAppClickToChatUrl(digits, message)
  if (typeof window === 'undefined') return { url, opened: false }
  const popup = window.open(url, '_blank', 'noopener,noreferrer')
  return { url, opened: Boolean(popup) }
}

export { buildWhatsAppClickToChatUrl, toWhatsAppDigits }
