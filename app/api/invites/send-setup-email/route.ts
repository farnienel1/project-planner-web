import { NextRequest } from 'next/server'
import {
  inviteSetupEmailSubject,
  buildInviteSetupEmailHtml,
  buildInviteSetupEmailText,
} from '@/lib/email/inviteSetupEmail'
import { resolveInviteSetupIdentity } from '@/lib/email/inviteSetupEmailFields'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import {
  clientSafeMessage,
  enforceRateLimit,
  jsonError,
  readJsonBody,
} from '@/lib/security/apiGuard'
import { clampString, isValidEmail, isValidUuid } from '@/lib/security/validation'
import { requireOrgAccess } from '@/lib/security/requireOrgAccess'
import { bearerToken, firestoreGet, readString, restFieldsToPlain } from '@/lib/owner/firestoreRest'

export const runtime = 'nodejs'

type SendBody = {
  organizationId?: string
  invitationId?: string
  organizationName?: string
  firstName?: string
  role?: 'manager' | 'operative' | 'admin'
  to?: string
}

const ROLES = new Set(['manager', 'operative', 'admin'])

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'invite-setup-email', 8, 10 * 60 * 1000)
  if (limited) return limited

  const body = await readJsonBody<SendBody>(request)
  if (!body.ok) return body.response

  const access = await requireOrgAccess(request, body.value.organizationId, 'staff')
  if (!access.ok) return access.response

  const invitationId = clampString(body.value.invitationId, 80)
  const role = body.value.role
  const to = clampString(body.value.to, 254)

  if (!invitationId || !isValidUuid(invitationId) || !role || !to) {
    return jsonError('invitationId, role, and to are required', 400)
  }
  if (!ROLES.has(role) || !isValidEmail(to)) {
    return jsonError('Invalid invite details', 400)
  }

  const token = bearerToken(request)
  let invitationFirstName = ''
  try {
    const invitation = await firestoreGet(token, `invitations/${invitationId}`)
    if (!invitation) return jsonError('Invitation not found', 404)
    const invitationOrg = readString(invitation.fields, 'organizationId')
    const invitationEmail = readString(invitation.fields, 'email').toLowerCase()
    invitationFirstName = readString(invitation.fields, 'firstName').trim()
    if (invitationOrg !== access.organizationId || invitationEmail !== to.trim().toLowerCase()) {
      return jsonError('Invitation does not belong to this organisation', 403)
    }
  } catch {
    return jsonError('Invitation not found', 404)
  }

  let organization: Record<string, unknown> | undefined
  try {
    const orgDoc = await firestoreGet(token, `organizations/${access.organizationId}`)
    organization = restFieldsToPlain(orgDoc?.fields)
  } catch {
    organization = undefined
  }
  const identity = resolveInviteSetupIdentity({
    invitationFirstName,
    fallbackFirstName: clampString(body.value.firstName, 100),
    organization,
    fallbackOrganizationName: clampString(body.value.organizationName, 200),
  })
  if (!identity) {
    return jsonError('Invitee name and organisation name are required', 400)
  }
  const { firstName, organizationName } = identity

  const email = to.trim().toLowerCase()
  const mail = {
    to: email,
    firstName,
    organizationName,
    invitationId,
    role,
  }

  try {
    await sendProjectPlannerEmail({
      to: email,
      subject: inviteSetupEmailSubject(organizationName),
      html: buildInviteSetupEmailHtml(mail),
      text: buildInviteSetupEmailText(mail),
    })

    return Response.json({ ok: true })
  } catch (error) {
    console.error('[invites/send-setup-email]', error)
    return jsonError(clientSafeMessage(error, 'Failed to send invite email'), 500)
  }
}
