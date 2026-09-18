import { NextRequest } from 'next/server'
import {
  confirmAccountEmailSubject,
  buildConfirmAccountEmailHtml,
} from '@/lib/email/confirmAccountEmail'
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
  confirmationToken?: string
  organizationName?: string
  firstName?: string
  to?: string
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'org-confirm-email', 8, 10 * 60 * 1000)
  if (limited) return limited

  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user

  const body = await readJsonBody<SendBody>(request)
  if (!body.ok) return body.response

  const confirmationToken = clampString(body.value.confirmationToken, 80)
  const organizationName = clampString(body.value.organizationName, 200)
  const firstName = clampString(body.value.firstName, 100)
  const to = clampString(body.value.to, 254)

  if (!confirmationToken || !isValidUuid(confirmationToken) || !organizationName || !firstName || !to) {
    return jsonError('confirmationToken, organizationName, firstName, and to are required', 400)
  }
  if (!isValidEmail(to)) {
    return jsonError('Invalid email', 400)
  }
  if (user.email && user.email !== to.trim().toLowerCase()) {
    return jsonError('Confirmation email must go to the signed-in account', 403)
  }

  const email = to.trim().toLowerCase()

  try {
    await sendResendEmail({
      to: email,
      subject: confirmAccountEmailSubject(organizationName),
      html: buildConfirmAccountEmailHtml({
        to: email,
        firstName,
        organizationName,
        confirmationToken,
      }),
    })

    return Response.json({ ok: true })
  } catch (error) {
    console.error('[org-setup/send-confirm-email]', error)
    return jsonError(clientSafeMessage(error, 'Failed to send confirmation email'), 500)
  }
}
