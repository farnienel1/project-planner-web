import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { bearerToken, firestoreCreateServerTime, firestoreGet, firestoreListCollection, firestoreQueryEqual, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { defaultMaterialRequestSendDeps, sendMaterialRequestMessages } from '@/lib/email/materialRequestSend'
import { MATERIAL_EMAIL_UNCONFIRMED_MESSAGE } from '@/lib/email/resendClient'
import { buildMaterialRequestEmail } from '@/lib/email/materialRequestEmail'
import {
  defaultMaterialDeliveryRequiredAt,
  formatMaterialDeliveryRequired,
  materialOrderIncludesDeliveryRequired,
  organizationLevelFor,
  parseWholesalerDocument,
} from '@/lib/canonical'
import { materialContactCreateFields, materialContactPath, materialRequestSafeSenderNotice } from '@/lib/canonical/materialSafeSender'
import {
  MATERIAL_ORDER_SEND_REFUSED_MESSAGE,
  canSendMaterialOrders,
  materialOrderRecipientCheck,
  materialRequestEmailEnvelope,
  materialRequestJobCheck,
  materialRequestJobViewer,
  MATERIAL_REQUEST_JOB_NOT_VISIBLE_MESSAGE,
} from '@/lib/canonical/materialOrderAccess'
import { clientSafeMessage, enforceRateLimit, jsonError } from '@/lib/security/apiGuard'
import { apiFlag, apiNumber, apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { z } from 'zod'
import { clampString, isValidEmail } from '@/lib/security/validation'
import { requireOrgAccess } from '@/lib/security/requireOrgAccess'
import { materialRequestSender } from '@/lib/materials/materialRequestSender'

import { parseJobDocument } from '@/lib/canonical/workDocumentReaders'
import { formatSiteAddress } from '@/lib/maps/siteAddress'

export const runtime = 'nodejs'

/**
 * The request body (mass-assignment audit 17 Nov): only these keys reach the route; anything else is dropped.
 * The sender's name, email, phone and company and the company logo are never taken from the request — they come from
 * the caller's own users document and the stored organisation document (rulebook §16, `materialRequestEmailEnvelope`).
 * Older web pages still send `senderName` / `senderEmail` / `senderCompany` / `senderPhone` / `companyLogoURL`; they
 * are stripped, never read.
 */
const recipientSchema = apiObject({ name: apiText(120), email: apiText(254) })
const materialSchema = apiObject({
  material: apiText(200),
  quantity: apiNumber(),
  unit: apiText(40),
  brand: apiText(120),
  productCode: apiText(80),
  notes: apiText(500),
  lengthDisplay: apiText(80),
  /** Rulebook 1.48.0 §28: the order unit and what is in one (`materialLineText`). */
  orderUnit: apiText(20),
  contentAmount: apiNumber(),
  contentMeasure: apiText(10),
})
const sendBodySchema = apiObject({
  organizationId: apiText(128),
  requestType: z.unknown().optional(),
  sendAsPlainText: apiFlag(),
  /** Rulebook 1.27.0: the job's document id (project or small works). Optional for older clients. */
  jobId: z.unknown().optional(),
  jobNumber: apiText(80),
  siteName: apiText(200),
  siteAddress: apiText(400),
  recipients: z.array(recipientSchema).max(40).optional(),
  materials: z.array(materialSchema).max(250).optional(),
  deliveryRequiredAt: apiText(64),
  /**
   * One id per Send press (the sheet makes it), reused if the same request reaches this route again. Passed to the
   * email function as `requestId`, which never sends the same request to the same recipient twice
   * (functions/email/requestDedupe.js). Optional: without it a new one is made here.
   */
  requestId: apiText(128),
})
type RecipientBody = z.infer<typeof recipientSchema>
type MaterialBody = z.infer<typeof materialSchema>

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/

function parseMaterials(rows: MaterialBody[] | undefined) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  if (rows.length > 250) return null
  const materials = []
  for (const row of rows) {
    const material = clampString(row.material, 200)
    if (!material) return null
    const quantity = typeof row.quantity === 'number' ? row.quantity : 1
    materials.push({
      material,
      quantity,
      unit: clampString(row.unit, 40) || 'Number',
      brand: clampString(row.brand, 120) || undefined,
      productCode: clampString(row.productCode, 80) || undefined,
      notes: clampString(row.notes, 500) || undefined,
      lengthDisplay: clampString(row.lengthDisplay, 80) || undefined,
      orderUnit: clampString(row.orderUnit, 20) || undefined,
      contentAmount:
        typeof row.contentAmount === 'number' && Number.isFinite(row.contentAmount) && row.contentAmount > 0
          ? row.contentAmount
          : undefined,
      contentMeasure: clampString(row.contentMeasure, 10) || undefined,
    })

  }
  return materials
}

function parseRecipients(rows: RecipientBody[] | undefined) {
  if (!Array.isArray(rows) || rows.length === 0) return null
  if (rows.length > 40) return null
  const recipients: Array<{ name: string; email: string }> = []
  for (const row of rows) {
    const name = clampString(row.name, 120)
    const email = clampString(row.email, 254)
    if (!name || !email || !isValidEmail(email)) return null
    // The same address twice (two wholesalers sharing a contact, a typed address that is also saved) gets one email.
    if (recipients.some((row) => row.email === email.toLowerCase())) continue
    recipients.push({ name, email: email.toLowerCase() })
  }
  return recipients
}

async function plainDoc(idToken: string, path: string): Promise<Record<string, unknown> | null> {
  const row = await firestoreGet(idToken, path)
  return row ? restFieldsToPlain(row.fields) : null
}

/** `materialRequestJobCheck` for the signed-in sender: job read, level and toggles from their own documents. */
async function materialJobCheck(
  idToken: string,
  organizationId: string,
  user: { uid: string; email?: string | null },
  membership: { role: string; isCreator: boolean },
  jobId: string,
  jobNumber: string,
  /** The caller's users document, already read by the route (null when it could not be read). */
  callerDoc: Record<string, unknown> | null
): Promise<{ ok: true; job: Record<string, unknown> | null } | { ok: false; status: number; message: string }> {
  const email = (user.email || '').trim().toLowerCase()
  // The sender's own documents and managers-list rows do not depend on the job: read them while the job is read.
  const callerReads = Promise.all([
    Promise.resolve(callerDoc),
    plainDoc(idToken, `users/${user.uid}/orgMemberships/${organizationId}`).catch(() => null),
    email
      ? firestoreQueryEqual(idToken, `organizations/${organizationId}`, 'managers', 'email', email).catch(() => [] as string[])
      : Promise.resolve([] as string[]),
  ])
  let job: Record<string, unknown> | null = null
  let kind: 'projects' | 'smallWorks' | null = null
  try {
    job = await plainDoc(idToken, `organizations/${organizationId}/projects/${jobId}`)
    kind = job ? 'projects' : null
    if (!job) {
      job = await plainDoc(idToken, `organizations/${organizationId}/smallWorks/${jobId}`)
      kind = job ? 'smallWorks' : null
    }
  } catch {
    // The rules refused the read: this sender may not see the job.
    return { ok: false, status: 403, message: MATERIAL_REQUEST_JOB_NOT_VISIBLE_MESSAGE }
  }
  const [userDoc, membershipDoc, managerPaths] = await callerReads
  const level = organizationLevelFor({
    organizationId,
    userId: user.uid,
    user: userDoc,
    membership: membershipDoc,
    membersRole: membership.role === 'none' ? undefined : membership.role,
    creatorUserId: membership.isCreator ? user.uid : '',
  })
  const list = (value: unknown) => (Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [])
  const viewer = materialRequestJobViewer({
    userId: user.uid,
    email,
    level: level.level,
    isSuperAdmin: level.isSuperAdmin,
    permissionSource: level.source === 'users' ? userDoc : { permissions: (membershipDoc?.permissions as Record<string, unknown>) || {} },
    formerUserIds: list(userDoc?.formerUserIds),
    sameEmailUserIds: list(userDoc?.sameEmailUserIds),
  })
  const result = materialRequestJobCheck({
    viewer,
    job,
    kind,
    managers: managerPaths.map((path) => ({ id: path.split('/').pop() || '', email })),
    jobNumber,
  })
  return result.ok ? { ok: true, job } : { ok: false, status: result.status, message: result.message }
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'material-send-email', 20, 10 * 60 * 1000)
  if (limited) return limited

  const body = await readApiBody(request, sendBodySchema, { maxBytes: 400_000 })
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

  const jobNumber = body.value.jobNumber
  // Mass-assignment audit 17 Nov (rulebook §16, `materialRequestEmailEnvelope`): the sender's name and phone come
  // from the caller's own users document and the company and logo from the stored organisation document, never from
  // the request. The sender's copy goes to the signed-in account's email only.
  // Rulebook 1.82.0 §11 (review of #442): the sender's name is their name in this organisation (`memberNames`).
  const [callerDoc, orgDoc, memberNameDoc] = await Promise.all([
    plainDoc(bearerToken(request), `users/${access.user.uid}`).catch(() => null),
    plainDoc(bearerToken(request), `organizations/${access.organizationId}`).catch(() => null),
    plainDoc(bearerToken(request), `organizations/${access.organizationId}/memberNames/${access.user.uid}`).catch(() => null),
  ])
  const sender = materialRequestSender({ tokenEmail: access.user.email, callerDoc, orgDoc, memberNameDoc, userId: access.user.uid })
  const { name: senderName, email: senderEmail, phone: senderPhone, company: senderCompany, logoURL: companyLogoURL } =
    sender
  if (!jobNumber) return jsonError('jobNumber is required', 400)
  if (!senderEmail || !isValidEmail(senderEmail)) return jsonError('Your account has no valid email address', 400)
  if (!senderCompany) return jsonError('Could not read your organisation. Try again.', 503)

  // Rulebook 1.27.0 (§16, §17, owner decision 2) `materialRequestJobCheck`: when the request names its job, the sender
  // must see that job (`canSeeJob`, the same rule as the email function's `material_request`) and the job number must
  // be the stored one. Read with the caller's own token, so the security rules apply too.
  // The organisation's wholesalers (for `materialOrderRecipientCheck` below) do not depend on the job check, so
  // they are read at the same time; the job check still decides first.
  const wholesalerRows = firestoreListCollection(bearerToken(request), `organizations/${access.organizationId}/wholesalers`)
  wholesalerRows.catch(() => {})

  const rawJobId = typeof body.value.jobId === 'string' ? body.value.jobId.trim() : ''
  // Review of #391: with a job, the site name and delivery address are the stored job's, never the request's. Older
  // clients that send no `jobId` keep the typed values (the job check cannot run for them either).
  let siteName = body.value.siteName
  let deliveryAddress = body.value.siteAddress
  if (body.value.jobId != null && body.value.jobId !== '') {
    if (!rawJobId || rawJobId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(rawJobId)) return jsonError('jobId is not valid', 400)
    const check = await materialJobCheck(bearerToken(request), access.organizationId, access.user, membership, rawJobId, jobNumber, callerDoc)
    if (!check.ok) return jsonError(check.message, check.status)
    const job = parseJobDocument(rawJobId, check.job)
    siteName = job?.siteName || ''
    deliveryAddress = job
      ? formatSiteAddress({
          addressLine1: job.addressLine1,
          addressLine2: job.addressLine2 ?? undefined,
          townCity: job.townCity,
          postcode: job.postcode ?? undefined,
          latitude: job.latitude ?? undefined,
          longitude: job.longitude ?? undefined,
          usesMapPinForLocation: job.usesMapPinForLocation,
          siteAddress: job.siteAddress,
        })
      : ''
  }

  const recipients = parseRecipients(body.value.recipients)
  const materials = parseMaterials(body.value.materials)
  if (!recipients || !materials) {
    return jsonError('At least one valid recipient and material line is required', 400)
  }
  // Rulebook 1.15.0 `materialOrderRecipientCheck`: saved wholesaler contacts, plus at most 3 typed addresses.
  let savedContactEmails: string[] = []
  try {
    const rows = await wholesalerRows
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

  const sendAsPlainText = body.value.sendAsPlainText
  const isQuote = requestType === 'quote'
  const sentAt = new Date()
  const parsedRequired = Date.parse(body.value.deliveryRequiredAt)
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
  // name and CC from the verified caller). Every recipient goes in one call to the function (below). A function
  // deployed before CC support ignores `ccCaller`; the route then sends the user's copy as before.
  // Rulebook 1.24.0 `materialRequestEmailEnvelope`: the subject and Reply-To / CC address, shared with the email
  // function's `material_request`. The From name ("<user> via Project Planner") and the CC are applied by the email
  // function from the verified caller (`fromCaller` / `ccCaller`), never from this request.
  const envelope = materialRequestEmailEnvelope({
    requestType,
    jobNumber,
    companyName: senderCompany,
    caller: { name: senderName, email: senderEmail },
  })
  const idToken = bearerToken(request)
  const givenRequestId = body.value.requestId
  if (givenRequestId && !REQUEST_ID_PATTERN.test(givenRequestId)) return jsonError('requestId is not valid', 400)
  const requestId = givenRequestId || randomUUID()
  // Every recipient's message is rendered here (each greets its own contact), then all of them go to the email
  // function in ONE call (`sendMaterialRequestMessages`): one cold start, one rate-limit count and one Resend batch,
  // instead of one call per recipient at the same time.
  // Rulebook 1.59.0 §16 (owner decision 17 Nov; review of #370, L2) `materialRequestSafeSenderNotice`: the first email
  // the organisation sends to an address carries the red safe-sender box. One read per recipient of its
  // `materialContacts` document (`materialContactPath`) — the same read the email function makes. A failed read shows
  // no box; the send goes ahead either way.
  const contactKnown = new Map<string, boolean | null>()
  await Promise.all(
    recipients.map(async (recipient) => {
      const path = materialContactPath(access.organizationId, recipient.email)
      const known = path ? await firestoreGet(idToken, path).then((doc) => doc !== null).catch(() => null) : null
      contactKnown.set(recipient.email, known)
    })
  )
  const messages = recipients.map((recipient) => {
    const { html } = buildMaterialRequestEmail({
      safeSenderNotice: materialRequestSafeSenderNotice(recipient.email, contactKnown.get(recipient.email) ?? null),
      context: {
        supplierName: recipient.name,
        userName: senderName,
        userEmail: senderEmail.toLowerCase(),
        userPhone: senderPhone,
        userCompany: senderCompany,
        jobNumber,
        siteName,
        deliveryAddress,
        companyLogoURL,
        materials,
        sentAt,
        deliveryRequiredLabel,
      },
      isQuote,
      sendAsPlainText,
      contactName: recipient.name,
    })
    return { to: recipient.email, subject: envelope.subject, html }
  })
  const outcome = await sendMaterialRequestMessages(
    {
      messages,
      senderEmail,
      replyTo: envelope.replyTo,
      orgId: access.organizationId,
      idToken,
      requestId,
    },
    {
      ...defaultMaterialRequestSendDeps,
      reason: (message) => clientSafeMessage(new Error(message), 'The email was not sent'),
      log: (event, details) => console.info('[materials/send-request-email]', event, details),
    }
  )
  const { sent, copies, failed, failures, messageIds } = outcome
  // Review of #370 (L2): every address that was sent to now has its `materialContacts` document (created once, never
  // changed), so later sends carry no box. Best effort: a refused or failed write only means a box next time.
  const failedEmails = new Set(failures.map((row) => row.email.trim().toLowerCase()))
  await Promise.all(
    recipients
      .filter((recipient) => contactKnown.get(recipient.email) === false && !failedEmails.has(recipient.email.trim().toLowerCase()))
      .map((recipient) => {
        const path = materialContactPath(access.organizationId, recipient.email)
        return path
          ? firestoreCreateServerTime(idToken, path, materialContactCreateFields().serverTimestampFields).catch(() => false)
          : false
      })
  )
  if (outcome.unconfirmed) {
    // It may have gone: never "Email not sent". The same request id is never sent twice by the function.
    return Response.json({ ok: false, unconfirmed: true, error: MATERIAL_EMAIL_UNCONFIRMED_MESSAGE }, { status: 502 })
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
