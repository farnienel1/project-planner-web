import { NextResponse } from 'next/server'
import { isStripePriceConfigured, loadSubscriptionPlans } from '@/lib/stripe/enrichPlansFromStripe'

export const runtime = 'nodejs'

export async function GET() {
  const plans = await loadSubscriptionPlans()
  const configured = isStripePriceConfigured()

  return NextResponse.json({
    plans: plans.map((plan) => ({
      key: plan.key,
      name: plan.name,
      description: plan.description,
      priceLabel: plan.priceLabel,
      interval: plan.interval,
      features: plan.features,
      recommended: plan.recommended ?? false,
      configured,
    })),
  })
}
