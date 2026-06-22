import type { SubscriptionPlan, SubscriptionPlanKey } from '@/lib/stripe/plans'
import { getStripePriceId, getSubscriptionPlans, PLAN_KEYS } from '@/lib/stripe/plans'
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

function planKeyFromPrice(price: Stripe.Price): SubscriptionPlanKey | null {
  const metaKey = (price.metadata?.planKey || price.metadata?.plan_key || '').toLowerCase()
  if (PLAN_KEYS.includes(metaKey as SubscriptionPlanKey)) return metaKey as SubscriptionPlanKey

  const nickname = (price.nickname || '').toLowerCase()
  for (const key of PLAN_KEYS) {
    if (nickname.includes(key)) return key
  }
  return null
}

function mergePricesByPlanKey(
  plans: SubscriptionPlan[],
  prices: Stripe.Price[]
): SubscriptionPlan[] | null {
  const byKey = new Map<SubscriptionPlanKey, Stripe.Price>()
  for (const price of prices) {
    const key = planKeyFromPrice(price)
    if (key && !byKey.has(key)) byKey.set(key, price)
  }
  if (byKey.size < 2) return null

  return plans.map((plan) => {
    const price = byKey.get(plan.key)
    if (!price) return plan
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

export type LoadSubscriptionPlansResult = {
  plans: SubscriptionPlan[]
  pricingLoaded: boolean
  pricingError?: string
}

export async function loadSubscriptionPlansWithStatus(): Promise<LoadSubscriptionPlansResult> {
  const plans = getSubscriptionPlans()
  const priceId = getStripePriceId()

  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return {
      plans,
      pricingLoaded: false,
      pricingError: 'Add STRIPE_SECRET_KEY to .env.local to load live tier prices.',
    }
  }

  if (!priceId) {
    return {
      plans,
      pricingLoaded: false,
      pricingError: 'Add STRIPE_PRICE_ID to .env.local.',
    }
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
      const merged = mergeTieredPriceToPlans(plans, anchorPrice)
      const hasPrices = merged.some((plan) => plan.priceLabel !== '—')
      return { plans: merged, pricingLoaded: hasPrices }
    }

    const productId = getProductId(anchorPrice)
    if (productId) {
      const productPrices = await listProductRecurringPrices(stripe, productId)
      const keyed = mergePricesByPlanKey(plans, productPrices)
      if (keyed) {
        const hasPrices = keyed.some((plan) => plan.priceLabel !== '—')
        return { plans: keyed, pricingLoaded: hasPrices }
      }
      if (productPrices.length >= 2) {
        const merged = mergeMultiplePricesToPlans(plans, productPrices.slice(0, plans.length))
        const hasPrices = merged.some((plan) => plan.priceLabel !== '—')
        return { plans: merged, pricingLoaded: hasPrices }
      }
    }

    const merged = mergeFlatPriceToPlans(plans, anchorPrice, product)
    const hasPrices = merged.some((plan) => plan.priceLabel !== '—')
    return { plans: merged, pricingLoaded: hasPrices }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe pricing request failed'
    console.warn('[stripe] Could not load subscription plans:', error)
    return { plans, pricingLoaded: false, pricingError: message }
  }
}

export async function loadSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const result = await loadSubscriptionPlansWithStatus()
  return result.plans
}

export async function getResolvedSubscriptionPlan(
  planKey: string
): Promise<SubscriptionPlan | undefined> {
  const plans = await loadSubscriptionPlans()
  return plans.find((plan) => plan.key === planKey)
}

export function isStripePriceConfigured(): boolean {
  return Boolean(getStripePriceId()?.trim() && process.env.STRIPE_SECRET_KEY?.trim())
}
