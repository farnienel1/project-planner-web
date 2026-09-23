import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/stripe'
import { billingFromSubscription, writeOrgBilling } from '@/lib/stripe/writeOrgBilling'
import type { OrgBilling } from '@/lib/stripe/billing'

export function organizationIdFromStripeObject(object: {
  client_reference_id?: string | null
  metadata?: Stripe.Metadata | null
}): string {
  return (
    object.metadata?.organizationId ||
    object.metadata?.organization_id ||
    object.client_reference_id ||
    ''
  ).trim()
}

export async function syncSubscriptionToOrg(
  subscriptionId: string,
  extras: {
    organizationId?: string
    stripeCustomerId?: string
    lastStripeEventId?: string
    lastPaymentAt?: Date | null
    lastPaymentFailedAt?: Date | null
    idToken?: string
  } = {}
): Promise<{ organizationId: string; billing: OrgBilling } | null> {
  const stripe = getStripe()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price'],
  })
  const organizationId = extras.organizationId || organizationIdFromStripeObject(subscription)
  if (!organizationId) return null
  const billing = billingFromSubscription(subscription, {
    stripeCustomerId: extras.stripeCustomerId,
    lastStripeEventId: extras.lastStripeEventId,
    lastPaymentAt: extras.lastPaymentAt,
    lastPaymentFailedAt: extras.lastPaymentFailedAt,
    trialUsed: Boolean(subscription.trial_start || subscription.trial_end),
  })
  await writeOrgBilling(organizationId, billing, extras.idToken)
  return { organizationId, billing }
}
