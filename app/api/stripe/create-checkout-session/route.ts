import { NextRequest } from 'next/server'
import { getAppBaseUrl, getStripe } from '@/lib/stripe/stripe'
import { getResolvedSubscriptionPlan } from '@/lib/stripe/enrichPlansFromStripe'
import {
  PLAN_KEYS,
  TRIAL_DAYS,
  automaticTaxEnabled,
  getStripePortalConfigurationId,
  trialRequiresCard,
} from '@/lib/stripe/plans'
import {
  clientSafeMessage,
  enforceRateLimit,
  isFirebaseUser,
  jsonError,
  readJsonBody,
  requireFirebaseUser,
} from '@/lib/security/apiGuard'
import { clampString, isValidEmail, isValidUuid } from '@/lib/security/validation'
import { bearerToken, firestoreGet, firestorePatch, readString, restFieldsToPlain } from '@/lib/owner/firestoreRest'
import { parseOrgBilling } from '@/lib/stripe/billing'
import { firestoreValue } from '@/lib/stripe/writeOrgBilling'

export const runtime = 'nodejs'

type CheckoutBody = {
  planKey?: string
  organizationId?: string
  userId?: string
  email?: string
  organizationName?: string
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
    const organizationName = clampString(body.value.organizationName, 160)

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
    if (user.email && user.email.toLowerCase() !== email) {
      return jsonError('Checkout email must match the signed-in account', 403)
    }

    const token = bearerToken(request)
    const orgDoc = await firestoreGet(token, `organizations/${organizationId}`)
    if (!orgDoc) return jsonError('Organisation not found', 404)
    const orgData = restFieldsToPlain(orgDoc.fields)
    const members = (orgData.members || {}) as Record<string, unknown>
    const isAdmin = members[user.uid] === 'admin' || readString(orgDoc.fields, 'creatorUserId') === user.uid
    if (!isAdmin) return jsonError('Only the organisation admin can start checkout', 403)

    const billing = parseOrgBilling(orgData)
    const stripe = getStripe()
    if (billing?.stripeCustomerId && billing.stripeSubscriptionId) {
      const existing = await stripe.subscriptions
        .retrieve(billing.stripeSubscriptionId)
        .catch(() => null)
      if (existing && (existing.status === 'active' || existing.status === 'trialing')) {
        const portal = await stripe.billingPortal.sessions.create({
          customer: billing.stripeCustomerId,
          return_url: `${getAppBaseUrl()}/dashboard/settings/billing`,
          configuration: getStripePortalConfigurationId(),
        })
        return Response.json({ url: portal.url, portal: true })
      }
    }

    const plan = await getResolvedSubscriptionPlan(planKey)
    if (!plan?.priceId) {
      return jsonError('Selected plan is not available', 400)
    }
    const allowedIds = new Set(
      (await Promise.all(PLAN_KEYS.map((key) => getResolvedSubscriptionPlan(key)))).map((row) => row?.priceId).filter(Boolean)
    )
    if (!allowedIds.has(plan.priceId)) {
      return jsonError('Selected plan is not available', 400)
    }

    let customerId = billing?.stripeCustomerId || undefined
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email,
          name: organizationName || readString(orgDoc.fields, 'name') || undefined,
          metadata: { organization_id: organizationId, organizationId },
        },
        { idempotencyKey: `customer-create-${organizationId}` }
      )
      customerId = customer.id
      await firestorePatch(
        token,
        `organizations/${organizationId}`,
        {
          'subscription.stripeCustomerId': { stringValue: customerId },
          updatedAt: firestoreValue(new Date()),
        },
        ['subscription.stripeCustomerId', 'updatedAt']
      ).catch(() => undefined)
    }

    const trialUsed = billing?.trialUsed === true
    const requiresCard = trialRequiresCard()
    const baseUrl = getAppBaseUrl()
    const bucket = Math.floor(Date.now() / (15 * 60 * 1000))

    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: customerId,
        client_reference_id: organizationId,
        line_items: [{ price: plan.priceId, quantity: 1 }],
        allow_promotion_codes: false,
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        customer_update: { address: 'auto', name: 'auto' },
        automatic_tax: { enabled: automaticTaxEnabled() },
        payment_method_collection: requiresCard ? 'always' : 'if_required',
        metadata: {
          organizationId,
          organization_id: organizationId,
          userId: user.uid,
          planKey,
        },
        subscription_data: {
          trial_period_days: trialUsed ? undefined : TRIAL_DAYS,
          metadata: {
            organizationId,
            organization_id: organizationId,
            userId: user.uid,
            planKey,
          },
          trial_settings: {
            end_behavior: { missing_payment_method: requiresCard ? 'cancel' : 'pause' },
          },
        },
        success_url: `${baseUrl}/setup/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/setup?cancelled=1`,
      },
      { idempotencyKey: `checkout-${organizationId}-${planKey}-${bucket}` }
    )

    if (!session.url) {
      return jsonError('Stripe did not return a checkout URL', 500)
    }

    return Response.json({ url: session.url })
  } catch (error) {
    console.error('[stripe/create-checkout-session]', error)
    return jsonError(clientSafeMessage(error, 'Failed to create checkout session'), 500)
  }
}
