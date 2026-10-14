import { NextRequest } from 'next/server'
import { orgAdditionEmailSubject, buildOrgAdditionEmailHtml } from '@/lib/email/orgAdditionEmail'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import {
  clientSafeMessage,
  enforceRateLimit,
  jsonError,
  readJsonBody,
} from '@/lib/security/apiGuard'
import { clampString, isValidEmail } from '@/lib/security/validation'
import { requireOrgAccess } from '@/lib/security/requireOrgAccess'

export const runtime = 'nodejs'

type SendBody = {
  organizationId?: string
  organizationName?: string
  firstName?: string
  to?: string
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'org-addition-email', 8, 10 * 60 * 1000)
  if (limited) return limited

  const body = await readJsonBody<SendBody>(request)
  if (!body.ok) return body.response

  const access = await requireOrgAccess(request, body.value.organizationId, 'staff')
  if (!access.ok) return access.response

  const organizationName = clampString(body.value.organizationName, 200)
  const firstName = clampString(body.value.firstName, 100)
  const to = clampString(body.value.to, 254)

  if (!organizationName || !firstName || !to) {
    return jsonError('organizationName, firstName, and to are required', 400)
  }
  if (!isValidEmail(to)) {
    return jsonError('Invalid email address', 400)
  }

  const email = to.trim().toLowerCase()

  try {
    await sendProjectPlannerEmail({
      to: email,
      subject: orgAdditionEmailSubject(organizationName),
      html: buildOrgAdditionEmailHtml({
        to: email,
        firstName,
        organizationName,
      }),
    })

    return Response.json({ ok: true })
  } catch (error) {
    console.error('[invites/send-org-addition-email]', error)
    return jsonError(clientSafeMessage(error, 'Failed to send org addition email'), 500)
  }
}
