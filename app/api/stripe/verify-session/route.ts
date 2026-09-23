import { NextRequest } from 'next/server'
import { getStripe } from '@/lib/stripe/stripe'
import { clientSafeMessage, enforceRateLimit, jsonError } from '@/lib/security/apiGuard'
import { isStripeCheckoutSessionId } from '@/lib/security/validation'
import { organizationIdFromStripeObject, syncSubscriptionToOrg } from '@/lib/stripe/syncOrgBilling'
import { billingFromSubscription } from '@/lib/stripe/writeOrgBilling'
import { normalizePlanKey } from '@/lib/stripe/plans'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, 'stripe-verify', 20, 10 * 60 * 1000)
  if (limited) return limited

  try {
    const sessionId = request.nextUrl.searchParams.get('session_id')?.trim()
    if (!sessionId || !isStripeCheckoutSessionId(sessionId)) {
      return jsonError('session_id is required', 400)
    }

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return jsonError('Checkout session is not complete', 400)
    }

    const subscription =
      typeof session.subscription === 'string'
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription

    if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trialing')) {
      return jsonError('Subscription is not active', 400)
    }

    const organizationId = organizationIdFromStripeObject(session)
    const planKey = normalizePlanKey(session.metadata?.planKey)
    const userId = session.metadata?.userId

    if (!organizationId || !userId) {
      return jsonError('Checkout session is missing organization metadata', 400)
    }

    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    await syncSubscriptionToOrg(subscription.id, {
      organizationId,
      stripeCustomerId: customerId,
    }).catch(() => undefined)

    const billing = billingFromSubscription(subscription, { stripeCustomerId: customerId })
    const priceId = subscription.items.data[0]?.price?.id
    const currentPeriodEnd = billing.currentPeriodEnd

    return Response.json({
      organizationId,
      userId,
      planKey,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      currentPeriodEnd: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
      status: subscription.status === 'trialing' ? 'trialing' : 'active',
      trialEnd: billing.trialEnd ? billing.trialEnd.toISOString() : null,
    })
  } catch (error) {
    console.error('[stripe/verify-session]', error)
    return jsonError(clientSafeMessage(error, 'Failed to verify checkout session'), 500)
  }
}
