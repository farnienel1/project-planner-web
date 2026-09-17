import { NextRequest } from 'next/server'
import { inviteSetupEmailSubject, buildInviteSetupEmailHtml } from '@/lib/email/inviteSetupEmail'
import { sendResendEmail } from '@/lib/email/resendClient'
import {
  clientSafeMessage,
  enforceRateLimit,
  isFirebaseUser,
  jsonError,
  readJsonBody,
  requireFirebaseUser,
} from '@/lib/security/apiGuard'
import { clampString, isValidEmail, isValidUuid } from '@/lib/security/validation'

export const runtime = 'nodejs'

type SendBody = {
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

  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user

  const body = await readJsonBody<SendBody>(request)
  if (!body.ok) return body.response

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

  const email = to.trim().toLowerCase()

  try {
    await sendResendEmail({
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
