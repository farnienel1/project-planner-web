import { NextResponse } from 'next/server'
import { getStripePriceId } from '@/lib/stripe/plans'
import { getStripe } from '@/lib/stripe/stripe'

export const runtime = 'nodejs'

/** Dev helper — shows how Stripe pricing is structured for the configured price. */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const priceId = getStripePriceId()
  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'STRIPE_PRICE_ID and STRIPE_SECRET_KEY required' }, { status: 400 })
  }

  try {
    const stripe = getStripe()
    const price = await stripe.prices.retrieve(priceId, { expand: ['product', 'tiers'] })
    const productId = typeof price.product === 'string' ? price.product : price.product?.id
    const siblingPrices = productId
      ? (
          await stripe.prices.list({
            product: productId,
            active: true,
            limit: 20,
          })
        ).data.map((entry) => ({
          id: entry.id,
          nickname: entry.nickname,
          unit_amount: entry.unit_amount,
          billing_scheme: entry.billing_scheme,
          tier_count: entry.tiers?.length ?? 0,
        }))
      : []

    return NextResponse.json({
      priceId: price.id,
      billing_scheme: price.billing_scheme,
      unit_amount: price.unit_amount,
      currency: price.currency,
      tier_count: price.tiers?.length ?? 0,
      tiers: price.tiers?.map((tier) => ({
        up_to: tier.up_to,
        flat_amount: tier.flat_amount,
        unit_amount: tier.unit_amount,
      })),
      sibling_prices_on_product: siblingPrices,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Inspect failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
