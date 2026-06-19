import { NextResponse } from 'next/server'
import { getSubscriptionPlans } from '@/lib/stripe/plans'

export const runtime = 'nodejs'

export async function GET() {
  const plans = getSubscriptionPlans().map((plan) => ({
    key: plan.key,
    name: plan.name,
    description: plan.description,
    priceLabel: plan.priceLabel,
    interval: plan.interval,
    features: plan.features,
    recommended: plan.recommended ?? false,
    configured: Boolean(plan.priceId),
  }))

  return NextResponse.json({ plans })
}
