import { NextRequest } from 'next/server'
import { getAppBaseUrl, getStripe } from '@/lib/stripe/stripe'
import { createBillingPortalSession } from '@/lib/stripe/billingPortal'
import {
  clientSafeMessage,
  enforceRateLimit,
  isFirebaseUser,
  jsonError,
  readJsonBody,
  requireFirebaseUser,
} from '@/lib/security/apiGuard'
import { clampString, isValidUuid } from '@/lib/security/validation'
import { bearerToken, firestoreGet, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { requireOrgAccessForUser } from '@/lib/security/requireOrgAccess'
import { parseOrgBilling } from '@/lib/stripe/billing'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'stripe-portal', 12, 10 * 60 * 1000)
  if (limited) return limited
  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user

  try {
    const body = await readJsonBody<{ organizationId?: string }>(request)
    if (!body.ok) return body.response
    const organizationId = clampString(body.value.organizationId, 80)
    if (!organizationId || !isValidUuid(organizationId)) {
      return jsonError('organisation is required', 400)
    }

    const access = await requireOrgAccessForUser(request, user, organizationId, 'admin')
    if (!access.ok) {
      if (access.response.status === 403) return jsonError('Only organisation admins can manage billing', 403)
      return access.response
    }
    const token = bearerToken(request)
    const orgDoc = await firestoreGet(token, `organizations/${organizationId}`)
    if (!orgDoc) return jsonError('Organisation not found', 404)
    const orgData = restFieldsToPlain(orgDoc.fields)

    const billing = parseOrgBilling(orgData)
    const customerId = billing?.stripeCustomerId
    if (!customerId) return jsonError('This organisation does not have a Stripe customer yet.', 400)

    const stripe = getStripe()
    const session = await createBillingPortalSession(
      stripe,
      customerId,
      `${getAppBaseUrl()}/dashboard/settings/billing`
    )
    if (!session.url) return jsonError('Stripe did not return a portal URL', 500)
    return Response.json({ url: session.url })
  } catch (error) {
    console.error('[stripe/create-portal-session]', error)
    return jsonError(clientSafeMessage(error, 'Failed to open billing portal'), 500)
  }
}
