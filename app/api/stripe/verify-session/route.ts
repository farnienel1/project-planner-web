import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/stripe'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id')
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    }

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    })

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return NextResponse.json({ error: 'Checkout session is not complete' }, { status: 400 })
    }

    const subscription =
      typeof session.subscription === 'string'
        ? await stripe.subscriptions.retrieve(session.subscription)
        : session.subscription

    if (!subscription || subscription.status !== 'active' && subscription.status !== 'trialing') {
      return NextResponse.json({ error: 'Subscription is not active' }, { status: 400 })
    }

    const organizationId = session.metadata?.organizationId
    const planKey = session.metadata?.planKey
    const userId = session.metadata?.userId

    if (!organizationId || !planKey || !userId) {
      return NextResponse.json({ error: 'Checkout session is missing organization metadata' }, { status: 400 })
    }

    const priceId = subscription.items.data[0]?.price?.id
    const currentPeriodEnd = subscription.items.data[0]?.current_period_end

    return NextResponse.json({
      organizationId,
      userId,
      planKey,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      currentPeriodEnd: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000).toISOString()
        : null,
      status: 'active',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify checkout session'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
