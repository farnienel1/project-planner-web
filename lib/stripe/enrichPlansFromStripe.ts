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

function tierAmountCents(tier: Stripe.Price.Tier): number | null {
  if (tier.flat_amount != null) return tier.flat_amount
  if (tier.unit_amount != null) return tier.unit_amount
  if (tier.flat_amount_decimal != null) return Math.round(Number(tier.flat_amount_decimal))
  if (tier.unit_amount_decimal != null) return Math.round(Number(tier.unit_amount_decimal))
  return null
}

function priceAmountCents(price: Stripe.Price): number | null {
  if (price.unit_amount != null) return price.unit_amount
  if (price.unit_amount_decimal != null) return Math.round(Number(price.unit_amount_decimal))
  return null
}

function getProductId(price: Stripe.Price): string | null {
  if (typeof price.product === 'string') return price.product
  if (price.product && typeof price.product === 'object' && 'id' in price.product) {
    return price.product.id
  }
  return null
}

function recurringInterval(price: Stripe.Price): 'month' | 'year' {
  return price.recurring?.interval === 'year' ? 'year' : 'month'
}

function tierCheckoutQuantity(
  tier: Stripe.Price.Tier,
  index: number,
  previousUpTo: number | null
): number {
  if (index === 0) return 1
  if (previousUpTo != null) return previousUpTo + 1
  return index + 1
}

function mergeTieredPriceToPlans(
  plans: SubscriptionPlan[],
  price: Stripe.Price
): SubscriptionPlan[] {
  const tiers = price.tiers ?? []
  const currency = price.currency ?? 'gbp'
  const interval = recurringInterval(price)

  return plans.map((plan, index) => {
    const tier = tiers[index] ?? tiers[tiers.length - 1]
    const previousUpTo = index > 0 ? tiers[index - 1]?.up_to ?? null : null
    const amount = tierAmountCents(tier)

    return {
      ...plan,
      name: plan.name,
      description: plan.description,
      priceLabel: amount != null ? formatPrice(amount, currency) : plan.priceLabel,
      interval,
      priceId: price.id,
      checkoutQuantity: tierCheckoutQuantity(tier, index, previousUpTo),
    }
  })
}

async function listProductRecurringPrices(
  stripe: Stripe,
  productId: string
): Promise<Stripe.Price[]> {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 20,
    expand: ['data.tiers'],
  })

  return prices.data
    .filter((entry) => entry.type === 'recurring')
    .sort((a, b) => (priceAmountCents(a) ?? 0) - (priceAmountCents(b) ?? 0))
}

function mergeMultiplePricesToPlans(
  plans: SubscriptionPlan[],
  prices: Stripe.Price[]
): SubscriptionPlan[] {
  return plans.map((plan, index) => {
    const price = prices[index] ?? prices[prices.length - 1]
    const amount = priceAmountCents(price)

    return {
      ...plan,
      name: price.nickname?.trim() || plan.name,
      description: price.metadata?.description?.trim() || plan.description,
      priceLabel:
        amount != null && price.currency ? formatPrice(amount, price.currency) : plan.priceLabel,
      interval: recurringInterval(price),
      priceId: price.id,
      checkoutQuantity: 1,
    }
  })
}

function mergeFlatPriceToPlans(
  plans: SubscriptionPlan[],
  price: Stripe.Price,
  product: Stripe.Product | null
): SubscriptionPlan[] {
  const amount = priceAmountCents(price)
  const priceLabel =
    amount != null && price.currency ? formatPrice(amount, price.currency) : undefined
  const interval = recurringInterval(price)

  return plans.map((plan) => ({
    ...plan,
    name: price.nickname?.trim() || product?.name?.trim() || plan.name,
    description: product?.description?.trim() || plan.description,
    priceLabel: priceLabel ?? plan.priceLabel,
    interval,
    priceId: price.id,
    checkoutQuantity: 1,
  }))
}

export async function enrichPlansWithStripeDetails(
  plans: SubscriptionPlan[]
): Promise<SubscriptionPlan[]> {
  return loadSubscriptionPlans()
}

export async function loadSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const plans = getSubscriptionPlans()
  const priceId = getStripePriceId()

  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    return plans
  }

  const stripe = getStripe()

  try {
    const anchorPrice = await stripe.prices.retrieve(priceId, {
      expand: ['product', 'tiers'],
    })

    const product =
      anchorPrice.product && typeof anchorPrice.product === 'object' && 'name' in anchorPrice.product
        ? anchorPrice.product
        : null

    if (anchorPrice.billing_scheme === 'tiered' && (anchorPrice.tiers?.length ?? 0) >= 2) {
      return mergeTieredPriceToPlans(plans, anchorPrice)
    }

    const productId = getProductId(anchorPrice)
    if (productId) {
      const productPrices = await listProductRecurringPrices(stripe, productId)
      if (productPrices.length >= 2) {
        return mergeMultiplePricesToPlans(plans, productPrices.slice(0, plans.length))
      }
    }

    return mergeFlatPriceToPlans(plans, anchorPrice, product)
  } catch (error) {
    console.warn('[stripe] Could not load subscription plans:', error)
    return plans
  }
}

export async function getResolvedSubscriptionPlan(
  planKey: string
): Promise<SubscriptionPlan | undefined> {
  const plans = await loadSubscriptionPlans()
  return plans.find((plan) => plan.key === planKey)
}

export function isStripePriceConfigured(): boolean {
  return Boolean(getStripePriceId())
}
