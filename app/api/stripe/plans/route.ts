import { NextResponse } from 'next/server'
import { enrichPlansWithStripeDetails } from '@/lib/stripe/enrichPlansFromStripe'
import { getSubscriptionPlans } from '@/lib/stripe/plans'

export const runtime = 'nodejs'

export async function GET() {
  const plans = await enrichPlansWithStripeDetails(getSubscriptionPlans())

  return NextResponse.json({
    plans: plans.map((plan) => ({
      key: plan.key,
      name: plan.name,
      description: plan.description,
      priceLabel: plan.priceLabel,
      interval: plan.interval,
      features: plan.features,
      recommended: plan.recommended ?? false,
      configured: Boolean(plan.priceId),
    })),
  })
}
