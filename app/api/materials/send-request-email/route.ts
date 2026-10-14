import { NextRequest } from 'next/server'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { buildMaterialRequestEmail } from '@/lib/email/materialRequestEmail'
import {
  defaultMaterialDeliveryRequiredAt,
  formatMaterialDeliveryRequired,
  materialOrderIncludesDeliveryRequired,
} from '@/lib/canonical'
import {
  clientSafeMessage,
  enforceRateLimit,
  jsonError,
  readJsonBody,
} from '@/lib/security/apiGuard'
import { clampString, isValidEmail } from '@/lib/security/validation'
import { requireOrgAccess } from '@/lib/security/requireOrgAccess'

export const runtime = 'nodejs'

type RecipientBody = { name?: string; email?: string }
type MaterialBody = {
  material?: string
  quantity?: number
  unit?: string
  brand?: string
  productCode?: string
  notes?: string
  lengthDisplay?: string
}

type SendBody = {
  organizationId?: string
  requestType?: 'quote' | 'order'
  sendAsPlainText?: boolean
  jobNumber?: string
  siteName?: string
  siteAddress?: string
  senderName?: string
  senderEmail?: string
  senderPhone?: string
  senderCompany?: string
  companyLogoURL?: string
  recipients?: RecipientBody[]
  materials?: MaterialBody[]
  deliveryRequiredAt?: string
}

function parseMaterials(rows: MaterialBody[] | undefined) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  if (rows.length > 250) return null
  const materials = []
  for (const row of rows) {
    const material = clampString(row.material, 200)
    if (!material) return null
    const quantity = typeof row.quantity === 'number' && Number.isFinite(row.quantity) ? row.quantity : 1
    materials.push({
      material,
      quantity,
      unit: clampString(row.unit, 40) || 'Number',
      brand: clampString(row.brand, 120) || undefined,
      productCode: clampString(row.productCode, 80) || undefined,
      notes: clampString(row.notes, 500) || undefined,
      lengthDisplay: clampString(row.lengthDisplay, 80) || undefined,
    })
  }
  return materials
}

function parseRecipients(rows: RecipientBody[] | undefined) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  if (rows.length > 40) return null
  const recipients = []
  for (const row of rows) {
    const name = clampString(row.name, 120)
    const email = clampString(row.email, 254)
    if (!name || !email || !isValidEmail(email)) return null
    recipients.push({ name, email: email.toLowerCase() })
  }
  return recipients
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'material-send-email', 20, 10 * 60 * 1000)
  if (limited) return limited

  const body = await readJsonBody<SendBody>(request, 400_000)
  if (!body.ok) return body.response

  const access = await requireOrgAccess(request, body.value.organizationId, 'member')
  if (!access.ok) return access.response

  const requestType = body.value.requestType
  if (requestType !== 'quote' && requestType !== 'order') {
    return jsonError('requestType must be quote or order', 400)
  }

  const jobNumber = clampString(body.value.jobNumber, 80)
  const senderName = clampString(body.value.senderName, 120)
  const senderEmail = clampString(body.value.senderEmail, 254)
  const senderCompany = clampString(body.value.senderCompany, 200)
  if (!jobNumber || !senderName || !senderEmail || !isValidEmail(senderEmail) || !senderCompany) {
    return jsonError('jobNumber, senderName, senderEmail, and senderCompany are required', 400)
  }

  const recipients = parseRecipients(body.value.recipients)
  const materials = parseMaterials(body.value.materials)
  if (!recipients || !materials) {
    return jsonError('At least one valid recipient and material line is required', 400)
  }

  const sendAsPlainText = Boolean(body.value.sendAsPlainText)
  const isQuote = requestType === 'quote'
  const sentAt = new Date()
  const parsedRequired = Date.parse(String(body.value.deliveryRequiredAt || ''))
  const deliveryRequiredAt = materialOrderIncludesDeliveryRequired(requestType)
    ? Number.isFinite(parsedRequired)
      ? new Date(parsedRequired)
      : defaultMaterialDeliveryRequiredAt(sentAt.toISOString())
    : null
  const deliveryRequiredLabel = deliveryRequiredAt
    ? formatMaterialDeliveryRequired(deliveryRequiredAt)
    : undefined
  const failed: string[] = []
  let sent = 0
  let copies = 0

  for (const recipient of recipients) {
    const { subject, html } = buildMaterialRequestEmail({
      context: {
        supplierName: recipient.name,
        userName: senderName,
        userEmail: senderEmail.toLowerCase(),
        userPhone: clampString(body.value.senderPhone, 40),
        userCompany: senderCompany,
        jobNumber,
        siteName: clampString(body.value.siteName, 200),
        deliveryAddress: clampString(body.value.siteAddress, 400),
        companyLogoURL: clampString(body.value.companyLogoURL, 500),
        materials,
        sentAt,
        deliveryRequiredLabel,
      },
      isQuote,
      sendAsPlainText,
      contactName: recipient.name,
    })

    try {
      await sendProjectPlannerEmail({
        to: recipient.email,
        subject,
        html,
        replyTo: senderEmail.toLowerCase(),
        fromName: `${senderName} (via Project Planner)`,
      })
      sent += 1
    } catch (error) {
      console.error('[materials/send-request-email]', recipient.email, error)
      failed.push(recipient.email)
      continue
    }

    try {
      await sendProjectPlannerEmail({
        to: senderEmail.toLowerCase(),
        subject: `Copy: ${subject}`,
        html,
        replyTo: senderEmail.toLowerCase(),
        fromName: `${senderName} (via Project Planner)`,
      })
      copies += 1
    } catch (error) {
      console.error('[materials/send-request-email] user copy', senderEmail, error)
    }
  }

  if (sent === 0) {
    return jsonError(clientSafeMessage(new Error('All recipient emails failed'), 'Failed to send material list'), 500)
  }

  return Response.json({
    ok: true,
    sent,
    copies,
    failed,
    deliveryRequiredAt: deliveryRequiredAt?.toISOString() ?? null,
  })
}
