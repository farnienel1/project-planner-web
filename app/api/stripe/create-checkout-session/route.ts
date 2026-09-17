import { NextRequest } from 'next/server'
import { getAppBaseUrl, getStripe } from '@/lib/stripe/stripe'
import { getResolvedSubscriptionPlan } from '@/lib/stripe/enrichPlansFromStripe'
import { PLAN_KEYS } from '@/lib/stripe/plans'
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

type CheckoutBody = {
  planKey?: string
  organizationId?: string
  userId?: string
  email?: string
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, 'stripe-checkout', 8, 10 * 60 * 1000)
  if (limited) return limited

  const user = await requireFirebaseUser(request)
  if (!isFirebaseUser(user)) return user

  try {
    const body = await readJsonBody<CheckoutBody>(request)
    if (!body.ok) return body.response

    const planKey = clampString(body.value.planKey, 40)
    const organizationId = clampString(body.value.organizationId, 80)
    const userId = clampString(body.value.userId, 128)
    const email = clampString(body.value.email, 254)?.toLowerCase()

    if (!planKey || !organizationId || !userId || !email) {
      return jsonError('planKey, organizationId, userId, and email are required', 400)
    }
    if (!PLAN_KEYS.includes(planKey as (typeof PLAN_KEYS)[number])) {
      return jsonError('Selected plan is not available', 400)
    }
    if (!isValidUuid(organizationId) || !isValidEmail(email)) {
      return jsonError('Invalid checkout details', 400)
    }
    if (userId !== user.uid) {
      return jsonError('Sign in required', 403)
    }
    if (user.email && user.email !== email) {
      return jsonError('Checkout email must match the signed-in account', 403)
    }

    const plan = await getResolvedSubscriptionPlan(planKey)
    if (!plan?.priceId) {
      return jsonError('Selected plan is not available', 400)
    }

    const stripe = getStripe()
    const baseUrl = getAppBaseUrl()
    const quantity = plan.checkoutQuantity ?? 1

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: plan.priceId, quantity }],
      allow_promotion_codes: true,
      client_reference_id: user.uid,
      metadata: {
        organizationId,
        userId: user.uid,
        planKey,
      },
      subscription_data: {
        metadata: {
          organizationId,
          userId: user.uid,
          planKey,
        },
      },
      success_url: `${baseUrl}/setup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/setup/cancel`,
    })

    if (!session.url) {
      return jsonError('Stripe did not return a checkout URL', 500)
    }

    return Response.json({ url: session.url })
  } catch (error) {
    console.error('[stripe/create-checkout-session]', error)
    return jsonError(clientSafeMessage(error, 'Failed to create checkout session'), 500)
  }
}
