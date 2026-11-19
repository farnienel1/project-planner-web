import { NextRequest } from 'next/server'
import { orgAdditionEmailSubject, buildOrgAdditionEmailHtml } from '@/lib/email/orgAdditionEmail'
import { bearerToken, firestoreGet, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { parseOrganizationName } from '@/lib/canonical'
import { apiObject, apiText, readApiBody } from '@/lib/security/apiBody'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import {
  clientSafeMessage,
  enforceRateLimit,
  jsonError,
} from '@/lib/security/apiGuard'
import { isValidEmail } from '@/lib/security/validation'
import { requireOrgAccess } from '@/lib/security/requireOrgAccess'

export const runtime = 'nodejs'

/**
 * Mass-assignment audit 17 Nov: only these keys are read. The organisation name in the email comes from the stored
 * organisation document, never from the request (an older page's `organizationName` is stripped).
 */
const sendBodySchema = apiObject({ organizationId: apiText(128), firstName: apiText(100), to: apiText(254) })

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'org-addition-email', 8, 10 * 60 * 1000)
  if (limited) return limited

  const body = await readApiBody(request, sendBodySchema)
  if (!body.ok) return body.response

  const access = await requireOrgAccess(request, body.value.organizationId, 'staff')
  if (!access.ok) return access.response

  const firstName = body.value.firstName
  const to = body.value.to
  if (!firstName || !to) {
    return jsonError('firstName and to are required', 400)
  }
  let organizationName = ''
  try {
    const orgDoc = await firestoreGet(bearerToken(request), `organizations/${access.organizationId}`)
    organizationName = parseOrganizationName(orgDoc ? restFieldsToPlain(orgDoc.fields) : undefined).slice(0, 200)
  } catch {
    return jsonError('Could not read your organisation. Try again.', 503)
  }
  if (!organizationName) return jsonError('Your organisation has no name yet. Set it in Settings → Company details.', 400)
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
      orgId: access.organizationId,
      idToken: bearerToken(request),
    })

    return Response.json({ ok: true })
  } catch (error) {
    console.error('[invites/send-org-addition-email]', error)
    return jsonError(clientSafeMessage(error, 'Failed to send org addition email'), 500)
  }
}
