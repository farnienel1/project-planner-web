export type SubscriptionPlanKey = 'starter' | 'professional' | 'enterprise'

export type SubscriptionPlan = {
  key: SubscriptionPlanKey
  name: string
  description: string
  priceLabel: string
  interval: 'month' | 'year'
  features: string[]
  priceId: string | undefined
  recommended?: boolean
}

const PLAN_DEFINITIONS: Omit<SubscriptionPlan, 'priceId'>[] = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'For small teams getting started with Project Planner.',
    priceLabel: '£29',
    interval: 'month',
    features: [
      'Up to 5 operatives',
      'Projects & small works',
      'Operative scheduling',
      'iOS & web access',
    ],
  },
  {
    key: 'professional',
    name: 'Professional',
    description: 'For growing contractors who need the full toolkit.',
    priceLabel: '£79',
    interval: 'month',
    recommended: true,
    features: [
      'Up to 25 operatives',
      'Everything in Starter',
      'Materials & wholesalers',
      'Site audits & health & safety',
      'Annual leave management',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description: 'For larger organisations with advanced needs.',
    priceLabel: '£149',
    interval: 'month',
    features: [
      'Unlimited operatives',
      'Everything in Professional',
      'Sub-contractor scheduling',
      'Priority support',
      'Custom onboarding',
    ],
  },
]

const PRICE_ENV_KEYS: Record<SubscriptionPlanKey, string> = {
  starter: 'STRIPE_PRICE_STARTER',
  professional: 'STRIPE_PRICE_PROFESSIONAL',
  enterprise: 'STRIPE_PRICE_ENTERPRISE',
}

export function getSubscriptionPlans(): SubscriptionPlan[] {
  return PLAN_DEFINITIONS.map((plan) => ({
    ...plan,
    priceId: process.env[PRICE_ENV_KEYS[plan.key]],
  }))
}

export function getSubscriptionPlan(planKey: string): SubscriptionPlan | undefined {
  return getSubscriptionPlans().find((plan) => plan.key === planKey)
}

export function requireSubscriptionPlanPriceId(planKey: string): string {
  const plan = getSubscriptionPlan(planKey)
  if (!plan?.priceId) {
    const envKey = PRICE_ENV_KEYS[planKey as SubscriptionPlanKey] ?? 'STRIPE_PRICE_*'
    throw new Error(
      `Stripe price ID is not configured for plan "${planKey}". Add ${envKey} to your environment.`
    )
  }
  return plan.priceId
}
