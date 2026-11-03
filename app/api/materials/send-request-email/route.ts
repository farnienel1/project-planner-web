import { NextRequest } from 'next/server'
import { bearerToken, firestoreListCollection, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { buildMaterialRequestEmail } from '@/lib/email/materialRequestEmail'
import {
  defaultMaterialDeliveryRequiredAt,
  formatMaterialDeliveryRequired,
  materialOrderIncludesDeliveryRequired,
  parseWholesalerDocument,
} from '@/lib/canonical'
import {
  MATERIAL_ORDER_SEND_REFUSED_MESSAGE,
  canSendMaterialOrders,
  materialOrderRecipientCheck,
} from '@/lib/canonical/materialOrderAccess'
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
  // Rulebook 1.15.0 `canSendMaterialOrders`: admins, super admins (the creator) and managers; never an operative.
  const membership = access.membership
  if (
    !canSendMaterialOrders({
      isSuperAdmin: membership.isCreator,
      isAdmin: membership.role === 'admin',
      isManager: membership.role === 'manager',
      isOperativeMode: membership.role === 'operative' && !membership.isCreator,
    })
  ) {
    return jsonError(MATERIAL_ORDER_SEND_REFUSED_MESSAGE, 403)
  }

  const requestType = body.value.requestType
  if (requestType !== 'quote' && requestType !== 'order') {
    return jsonError('requestType must be quote or order', 400)
  }

  const jobNumber = clampString(body.value.jobNumber, 80)
  const senderName = clampString(body.value.senderName, 120)
  // The sender's copy goes to the signed-in account's email only (never an address the request names).
  const senderEmail = (access.user.email || clampString(body.value.senderEmail, 254) || '').trim().toLowerCase()
  const senderCompany = clampString(body.value.senderCompany, 200)
  if (!jobNumber || !senderName || !senderEmail || !isValidEmail(senderEmail) || !senderCompany) {
    return jsonError('jobNumber, senderName, senderEmail, and senderCompany are required', 400)
  }

  const recipients = parseRecipients(body.value.recipients)
  const materials = parseMaterials(body.value.materials)
  if (!recipients || !materials) {
    return jsonError('At least one valid recipient and material line is required', 400)
  }
  // Rulebook 1.15.0 `materialOrderRecipientCheck`: saved wholesaler contacts, plus at most 3 typed addresses.
  let savedContactEmails: string[] = []
  try {
    const rows = await firestoreListCollection(bearerToken(request), `organizations/${access.organizationId}/wholesalers`)
    savedContactEmails = rows.flatMap((row) => {
      const firm = parseWholesalerDocument(row.id, restFieldsToPlain(row.fields))
      return firm ? firm.contacts.map((contact) => contact.email) : []
    })
  } catch {
    return jsonError('Could not read your wholesalers. Try again.', 503)
  }
  const recipientCheck = materialOrderRecipientCheck({
    recipients: recipients.map((row) => row.email),
    savedContactEmails,
    senderEmail,
  })
  if (!recipientCheck.ok) return jsonError(recipientCheck.message, 400)

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
  // Owner (3 Nov): one email per recipient — the recipient in To and the sending user in CC — sent as
  // "<user> via Project Planner" from the verified address with Reply-To the user (the email function decides the
  // name and CC from the verified caller). All recipients are sent at once, not one after another. A function
  // deployed before CC support ignores `ccCaller`; the route then sends the user's copy as before.
  const idToken = bearerToken(request)
  const failed: string[] = []
  const failures: Array<{ email: string; reason: string }> = []
  const messageIds: string[] = []
  let sent = 0
  let copies = 0

  const outcomes = await Promise.all(
    recipients.map(async (recipient) => {
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
        const result = await sendProjectPlannerEmail({
          to: recipient.email,
          subject,
          html,
          replyTo: senderEmail.toLowerCase(),
          orgId: access.organizationId,
          idToken,
          fromCaller: true,
          ccCaller: true,
        })
        return { recipient, subject, html, result, error: null as string | null }
      } catch (error) {
        return { recipient, subject, html, result: null, error: error instanceof Error ? error.message : String(error) }
      }
    })
  )

  for (const outcome of outcomes) {
    if (!outcome.result) {
      console.error('[materials/send-request-email] failed', outcome.recipient.email, outcome.error)
      failed.push(outcome.recipient.email)
      failures.push({
        email: outcome.recipient.email,
        reason: clientSafeMessage(new Error(outcome.error || ''), 'The email was not sent'),
      })
      continue
    }
    sent += 1
    messageIds.push(...outcome.result.ids)
    console.info('[materials/send-request-email] sent', {
      to: outcome.recipient.email,
      resendIds: outcome.result.ids,
      cc: outcome.result.cc,
    })
    if (outcome.result.cc.length > 0) {
      copies += 1
      continue
    }
    // Older function deploy without CC: the user's separate copy, as before.
    try {
      await sendProjectPlannerEmail({
        to: senderEmail.toLowerCase(),
        subject: `Copy: ${outcome.subject}`,
        html: outcome.html,
        replyTo: senderEmail.toLowerCase(),
        orgId: access.organizationId,
        idToken,
      })
      copies += 1
    } catch (error) {
      console.error('[materials/send-request-email] user copy', senderEmail, error)
    }
  }

  if (sent === 0) {
    const reason = failures[0]?.reason ? `: ${failures[0].reason}` : ''
    return Response.json(
      { ok: false, error: clientSafeMessage(new Error(`Email not sent${reason}`), 'Failed to send material list'), failed, failures },
      { status: 502 }
    )
  }

  return Response.json({
    ok: true,
    sent,
    copies,
    failed,
    failures,
    messageIds,
    deliveryRequiredAt: deliveryRequiredAt?.toISOString() ?? null,
  })
}
