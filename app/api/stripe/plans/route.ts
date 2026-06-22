import { NextResponse } from 'next/server'
import { isStripePriceConfigured, loadSubscriptionPlans } from '@/lib/stripe/enrichPlansFromStripe'

export const runtime = 'nodejs'

export async function GET() {
  try {
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
  } catch (error) {
    console.error('[stripe/plans] Failed to load plans:', error)
    return NextResponse.json(
      { error: 'Could not load subscription plans', plans: [] },
      { status: 500 }
    )
  }
}
