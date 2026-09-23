import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getAppBaseUrl, getStripe } from '@/lib/stripe/stripe'
import { organizationIdFromStripeObject, syncSubscriptionToOrg } from '@/lib/stripe/syncOrgBilling'
import { adminFirestoreCreateNamed, adminFirestoreGet, firestoreValue } from '@/lib/stripe/writeOrgBilling'
import { sendProjectPlannerEmail } from '@/lib/email/resendClient'
import { getStripePortalConfigurationId } from '@/lib/stripe/plans'
import { escapeHtml } from '@/lib/security/htmlEscape'
import { readString } from '@/lib/owner/firestoreRest'

export const runtime = 'nodejs'

function subscriptionIdFromEvent(event: Stripe.Event): string | null {
  const object = event.data.object as { id?: string; subscription?: string | { id?: string } | null }
  if (event.type.startsWith('customer.subscription.') && object.id) return object.id
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    if (typeof session.subscription === 'string') return session.subscription
    if (session.subscription && typeof session.subscription === 'object') return session.subscription.id
  }
  if (event.type.startsWith('invoice.')) {
    const invoice = event.data.object as Stripe.Invoice & { subscription?: string | { id?: string } | null }
    if (typeof invoice.subscription === 'string') return invoice.subscription
    if (invoice.subscription && typeof invoice.subscription === 'object' && invoice.subscription.id) {
      return invoice.subscription.id
    }
    const parent = (invoice as { parent?: { subscription_details?: { subscription?: string } } }).parent
    if (parent?.subscription_details?.subscription) return parent.subscription_details.subscription
  }
  return null
}

async function claimStripeEvent(event: Stripe.Event): Promise<boolean> {
  const result = await adminFirestoreCreateNamed('stripeEvents', event.id, {
    type: firestoreValue(event.type),
    createdAt: firestoreValue(new Date()),
  })
  return result === 'created'
}

async function orgAdminEmail(organizationId: string): Promise<string | null> {
  const org = await adminFirestoreGet(`organizations/${organizationId}`).catch(() => null)
  const name = readString(org?.fields, 'name')
  const members = (org?.fields?.members as { mapValue?: { fields?: Record<string, { stringValue?: string }> } } | undefined)
    ?.mapValue?.fields
  const adminUid = members
    ? Object.entries(members).find(([, role]) => role.stringValue === 'admin')?.[0]
    : undefined
  if (!adminUid) return null
  const user = await adminFirestoreGet(`users/${adminUid}`).catch(() => null)
  const email = readString(user?.fields, 'email')
  return email || null
}

async function sendBillingEmail(organizationId: string, subject: string, html: string) {
  const to = await orgAdminEmail(organizationId).catch(() => null)
  if (!to) return
  await sendProjectPlannerEmail({ to, subject, html }).catch((error) => {
    console.warn('[stripe webhook] email failed', error)
  })
}

async function portalLink(customerId?: string | null): Promise<string> {
  const base = getAppBaseUrl()
  if (!customerId) return `${base}/dashboard/settings/billing`
  try {
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${base}/dashboard/settings/billing`,
      configuration: getStripePortalConfigurationId(),
    })
    return session.url || `${base}/dashboard/settings/billing`
  } catch {
    return `${base}/dashboard/settings/billing`
  }
}

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

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook verification failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const first = await claimStripeEvent(event)
    if (!first) return NextResponse.json({ received: true, duplicate: true })

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const organizationId = organizationIdFromStripeObject(session)
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      if (subscriptionId) {
        await syncSubscriptionToOrg(subscriptionId, {
          organizationId,
          stripeCustomerId: customerId,
          lastStripeEventId: event.id,
        })
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted' ||
      event.type === 'customer.subscription.paused' ||
      event.type === 'customer.subscription.resumed'
    ) {
      const subscriptionId = subscriptionIdFromEvent(event)
      if (subscriptionId) {
        await syncSubscriptionToOrg(subscriptionId, { lastStripeEventId: event.id })
      }
    }

    if (event.type === 'customer.subscription.trial_will_end') {
      const subscription = event.data.object as Stripe.Subscription
      const organizationId = organizationIdFromStripeObject(subscription)
      const end = subscription.trial_end ? new Date(subscription.trial_end * 1000).toLocaleDateString('en-GB') : 'soon'
      if (organizationId) {
        await sendBillingEmail(
          organizationId,
          'Your Project Planner trial ends in 3 days',
          `<p>Your 30-day Project Planner trial ends on ${escapeHtml(end)}.</p><p>If a card is on file we will charge then. You can update billing or cancel from Settings → Billing.</p>`
        )
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = subscriptionIdFromEvent(event)
      const paidAt = invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : new Date()
      if (subscriptionId) {
        await syncSubscriptionToOrg(subscriptionId, {
          lastStripeEventId: event.id,
          lastPaymentAt: paidAt,
          lastPaymentFailedAt: null,
        })
      }
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = subscriptionIdFromEvent(event)
      if (subscriptionId) {
        const synced = await syncSubscriptionToOrg(subscriptionId, {
          lastStripeEventId: event.id,
          lastPaymentFailedAt: new Date(),
        })
        if (synced?.organizationId) {
          const customerId =
            typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
          const link = await portalLink(customerId)
          await sendBillingEmail(
            synced.organizationId,
            'Project Planner payment failed',
            `<p>We could not take the latest Project Planner payment.</p><p><a href="${escapeHtml(link)}">Update your payment method</a></p><p>Access stays open for 7 days.</p>`
          )
        }
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[stripe webhook]', event.type, error)
    return NextResponse.json({ received: true, error: 'processing_failed' }, { status: 200 })
  }
}
