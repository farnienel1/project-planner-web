import { NextRequest, NextResponse } from 'next/server'
import { getAppBaseUrl, getStripe } from '@/lib/stripe/stripe'
import { getResolvedSubscriptionPlan } from '@/lib/stripe/enrichPlansFromStripe'

export const runtime = 'nodejs'

type CheckoutBody = {
  planKey?: string
  organizationId?: string
  userId?: string
  email?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CheckoutBody
    const { planKey, organizationId, userId, email } = body

    if (!planKey || !organizationId || !userId || !email) {
      return NextResponse.json(
        { error: 'planKey, organizationId, userId, and email are required' },
        { status: 400 }
      )
    }

    const plan = await getResolvedSubscriptionPlan(planKey)
    if (!plan?.priceId) {
      return NextResponse.json(
        { error: 'Selected plan is not available. Check STRIPE_PRICE_ID and your Stripe product pricing.' },
        { status: 400 }
      )
    }

    const stripe = getStripe()
    const baseUrl = getAppBaseUrl()
    const quantity = plan.checkoutQuantity ?? 1

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: plan.priceId, quantity }],
      allow_promotion_codes: true,
      metadata: {
        organizationId,
        userId,
        planKey,
      },
      subscription_data: {
        metadata: {
          organizationId,
          userId,
          planKey,
        },
      },
      success_url: `${baseUrl}/setup/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/setup/cancel`,
    })

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create checkout session'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
