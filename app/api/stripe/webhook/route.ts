import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/stripe'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET is not configured' }, { status: 500 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret)

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      console.info('[stripe webhook] checkout.session.completed', {
        sessionId: session.id,
        organizationId: session.metadata?.organizationId,
        planKey: session.metadata?.planKey,
      })
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object
      console.info(`[stripe webhook] ${event.type}`, {
        subscriptionId: subscription.id,
        status: subscription.status,
        organizationId: subscription.metadata?.organizationId,
      })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook verification failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
