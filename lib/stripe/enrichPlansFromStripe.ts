import type { SubscriptionPlan } from '@/lib/stripe/plans'
import { getStripePriceId, getSubscriptionPlans } from '@/lib/stripe/plans'
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

function tierPriceLabel(tier: Stripe.Price.Tier, currency: string): string {
  if (tier.flat_amount != null) {
    return formatPrice(tier.flat_amount, currency)
  }
  if (tier.unit_amount != null) {
    return formatPrice(tier.unit_amount, currency)
  }
  return '—'
}

function tierDescription(tier: Stripe.Price.Tier, index: number, total: number): string {
  if (tier.up_to == null) {
    return index === total - 1 ? 'Top tier' : 'Unlimited'
  }
  if (index === 0) {
    return `Up to ${tier.up_to}`
  }
  return `Up to ${tier.up_to}`
}

export async function enrichPlansWithStripeDetails(
  plans: SubscriptionPlan[]
): Promise<SubscriptionPlan[]> {
  const priceId = getStripePriceId()
  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    return plans
  }

  const stripe = getStripe()

  try {
    const price = await stripe.prices.retrieve(priceId, {
      expand: ['product'],
    })

    const product =
      price.product && typeof price.product === 'object' && 'name' in price.product
        ? price.product
        : null

    const interval = price.recurring?.interval === 'year' ? 'year' : 'month'
    const currency = price.currency ?? 'gbp'

    if (price.billing_scheme === 'tiered' && price.tiers?.length) {
      return plans.map((plan, index) => {
        const tier = price.tiers![index] ?? price.tiers![price.tiers!.length - 1]
        const tierName = product?.name?.trim()
          ? `${product.name} — ${plan.name}`
          : plan.name

        return {
          ...plan,
          name: tierName,
          description: tierDescription(tier, index, price.tiers!.length),
          priceLabel: tierPriceLabel(tier, currency),
          interval,
          checkoutQuantity: tier.up_to ?? plan.checkoutQuantity ?? index + 1,
        }
      })
    }

    const amount = price.unit_amount
    const priceLabel =
      amount != null && price.currency ? formatPrice(amount, price.currency) : undefined

    return plans.map((plan) => ({
      ...plan,
      name: product?.name?.trim() ? `${product.name} — ${plan.name}` : plan.name,
      description: product?.description?.trim() || plan.description,
      priceLabel: priceLabel ?? plan.priceLabel,
      interval,
    }))
  } catch (error) {
    console.warn('[stripe] Could not load shared price details:', error)
    return plans
  }
}

export async function loadSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  return enrichPlansWithStripeDetails(getSubscriptionPlans())
}

export function isStripePriceConfigured(): boolean {
  return Boolean(getStripePriceId())
}
