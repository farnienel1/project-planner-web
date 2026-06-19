export type SubscriptionPlanKey = 'starter' | 'team' | 'professional' | 'enterprise'

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
    description: 'For solo operators and very small teams.',
    priceLabel: '—',
    interval: 'month',
    features: [
      'Core project management',
      'Projects & small works',
      'Operative scheduling',
      'iOS & web access',
    ],
  },
  {
    key: 'team',
    name: 'Team',
    description: 'For small teams starting to scale.',
    priceLabel: '—',
    interval: 'month',
    features: [
      'More operatives & managers',
      'Everything in Starter',
      'Materials catalogue',
      'Annual leave',
    ],
  },
  {
    key: 'professional',
    name: 'Professional',
    description: 'For growing contractors who need the full toolkit.',
    priceLabel: '—',
    interval: 'month',
    recommended: true,
    features: [
      'Larger operative roster',
      'Everything in Team',
      'Site audits & health & safety',
      'Wholesalers & order history',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    description: 'For larger organisations with advanced needs.',
    priceLabel: '—',
    interval: 'month',
    features: [
      'Highest limits',
      'Everything in Professional',
      'Sub-contractor scheduling',
      'Priority support',
    ],
  },
]

export const PRICE_ENV_KEYS: Record<SubscriptionPlanKey, string> = {
  starter: 'STRIPE_PRICE_STARTER',
  team: 'STRIPE_PRICE_TEAM',
  professional: 'STRIPE_PRICE_PROFESSIONAL',
  enterprise: 'STRIPE_PRICE_ENTERPRISE',
}

export function getSubscriptionPlans(): SubscriptionPlan[] {
  return PLAN_DEFINITIONS.map((plan) => ({
    ...plan,
    priceId: process.env[PRICE_ENV_KEYS[plan.key]]?.trim() || undefined,
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
      `Stripe price ID is not configured for plan "${planKey}". Add ${envKey} to your .env.local file.`
    )
  }
  return plan.priceId
}
