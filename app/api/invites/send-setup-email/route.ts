import { NextRequest } from 'next/server'
import { inviteSetupEmailSubject, buildInviteSetupEmailHtml } from '@/lib/email/inviteSetupEmail'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import {
  clientSafeMessage,
  enforceRateLimit,
  jsonError,
  readJsonBody,
} from '@/lib/security/apiGuard'
import { clampString, isValidEmail, isValidUuid } from '@/lib/security/validation'
import { requireOrgAccess } from '@/lib/security/requireOrgAccess'
import { bearerToken, firestoreGet, readString } from '@/lib/owner/firestoreRest'

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
  const organizationName = clampString(body.value.organizationName, 200)
  const firstName = clampString(body.value.firstName, 100)
  const role = body.value.role
  const to = clampString(body.value.to, 254)

  if (!invitationId || !isValidUuid(invitationId) || !organizationName || !firstName || !role || !to) {
    return jsonError('invitationId, organizationName, firstName, role, and to are required', 400)
  }
  if (!ROLES.has(role) || !isValidEmail(to)) {
    return jsonError('Invalid invite details', 400)
  }

  try {
    const invitation = await firestoreGet(bearerToken(request), `invitations/${invitationId}`)
    if (!invitation) return jsonError('Invitation not found', 404)
    const invitationOrg = readString(invitation.fields, 'organizationId')
    const invitationEmail = readString(invitation.fields, 'email').toLowerCase()
    if (invitationOrg !== access.organizationId || invitationEmail !== to.trim().toLowerCase()) {
      return jsonError('Invitation does not belong to this organisation', 403)
    }
  } catch {
    return jsonError('Invitation not found', 404)
  }

  const email = to.trim().toLowerCase()

  try {
    await sendProjectPlannerEmail({
      to: email,
      subject: inviteSetupEmailSubject(organizationName),
      html: buildInviteSetupEmailHtml({
        to: email,
        firstName,
        organizationName,
        invitationId,
        role,
      }),
    })

    return Response.json({ ok: true })
  } catch (error) {
    console.error('[invites/send-setup-email]', error)
    return jsonError(clientSafeMessage(error, 'Failed to send invite email'), 500)
  }
}
