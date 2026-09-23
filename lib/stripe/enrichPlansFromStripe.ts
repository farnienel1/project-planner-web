import type { SubscriptionPlan } from '@/lib/stripe/plans'
import {
  getStripePriceId,
  getSubscriptionPlans,
  lookupKeyForPlan,
  normalizePlanKey,
  PLAN_KEYS,
  STRIPE_LOOKUP_ANNUAL,
  STRIPE_LOOKUP_MONTHLY,
  stripeNotConfiguredMessage,
} from '@/lib/stripe/plans'
import { getStripe } from '@/lib/stripe/stripe'
import type Stripe from 'stripe'

function formatPrice(amount: number, currency: string): string {
  const code = currency.toUpperCase()
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount / 100)
  } catch {
    return `${code} ${(amount / 100).toFixed(2)}`
  }
}

function priceAmountCents(price: Stripe.Price): number | null {
  if (price.unit_amount != null) return price.unit_amount
  if (price.unit_amount_decimal != null) return Math.round(Number(price.unit_amount_decimal))
  return null
}

let cached: { at: number; plans: SubscriptionPlan[] } | null = null
const CACHE_MS = 10 * 60 * 1000

export async function loadSubscriptionPlansWithStatus(): Promise<{
  plans: SubscriptionPlan[]
  pricingLoaded: boolean
  pricingError?: string
}> {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return {
      plans: getSubscriptionPlans(),
      pricingLoaded: false,
      pricingError: stripeNotConfiguredMessage(),
    }
  }
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return { plans: cached.plans, pricingLoaded: true }
  }
  try {
    const stripe = getStripe()
    const listed = await stripe.prices.list({
      lookup_keys: [STRIPE_LOOKUP_MONTHLY, STRIPE_LOOKUP_ANNUAL],
      active: true,
      limit: 10,
    })
    const byKey = new Map<string, Stripe.Price>()
    for (const price of listed.data) {
      const lookup = price.lookup_key || ''
      if (lookup) byKey.set(lookup, price)
    }
    const plans = getSubscriptionPlans().map((plan) => {
      const live = byKey.get(lookupKeyForPlan(plan.key))
      const amount = live ? priceAmountCents(live) : null
      return {
        ...plan,
        priceId: live?.id || plan.priceId,
        priceLabel: amount != null ? formatPrice(amount, live?.currency || 'gbp') : plan.priceLabel,
        amountPence: amount ?? plan.amountPence,
      }
    })
    cached = { at: Date.now(), plans }
    return { plans, pricingLoaded: true }
  } catch (error) {
    console.warn('[stripe] Could not load subscription plans:', error)
    return {
      plans: getSubscriptionPlans(),
      pricingLoaded: false,
      pricingError: error instanceof Error ? error.message : 'Could not load Stripe prices.',
    }
  }
}

export async function getResolvedSubscriptionPlan(planKey: string) {
  const key = normalizePlanKey(planKey)
  const { plans } = await loadSubscriptionPlansWithStatus()
  return plans.find((plan) => plan.key === key) || getSubscriptionPlans().find((plan) => plan.key === key)
}

export function isStripePriceConfigured(): boolean {
  return Boolean(getStripePriceId('month') && process.env.STRIPE_SECRET_KEY?.trim())
}

export { PLAN_KEYS }
