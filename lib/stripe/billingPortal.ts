import type Stripe from 'stripe'
import { getStripePortalConfigurationId } from '@/lib/stripe/plans'

function missingPortalConfiguration(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '')
  return /no such configuration|resource_missing/i.test(message)
}

export async function createBillingPortalSession(
  stripe: Stripe,
  customer: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const configuration = getStripePortalConfigurationId()
  const base = { customer, return_url: returnUrl }
  if (!configuration) return stripe.billingPortal.sessions.create(base)
  try {
    return await stripe.billingPortal.sessions.create({ ...base, configuration })
  } catch (error) {
    if (missingPortalConfiguration(error)) {
      return stripe.billingPortal.sessions.create(base)
    }
    throw error
  }
}
