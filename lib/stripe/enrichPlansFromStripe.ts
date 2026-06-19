import type { SubscriptionPlan } from '@/lib/stripe/plans'
import { getStripe } from '@/lib/stripe/stripe'

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

export async function enrichPlansWithStripeDetails(
  plans: SubscriptionPlan[]
): Promise<SubscriptionPlan[]> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return plans
  }

  const stripe = getStripe()

  return Promise.all(
    plans.map(async (plan) => {
      if (!plan.priceId) return plan

      try {
        const price = await stripe.prices.retrieve(plan.priceId, {
          expand: ['product'],
        })

        const product =
          price.product && typeof price.product === 'object' && 'name' in price.product
            ? price.product
            : null

        const amount = price.unit_amount
        const priceLabel =
          amount != null && price.currency ? formatPrice(amount, price.currency) : plan.priceLabel

        const interval = price.recurring?.interval === 'year' ? 'year' : 'month'

        return {
          ...plan,
          name: product?.name?.trim() || plan.name,
          description: product?.description?.trim() || plan.description,
          priceLabel,
          interval,
        }
      } catch (error) {
        console.warn(`[stripe] Could not load price details for ${plan.key}:`, error)
        return plan
      }
    })
  )
}
