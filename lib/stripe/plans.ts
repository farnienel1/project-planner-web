export type SubscriptionPlanKey = 'starter' | 'team' | 'professional' | 'enterprise'

export type SubscriptionPlan = {
  key: SubscriptionPlanKey
  name: string
  description: string
  priceLabel: string
  interval: 'month' | 'year'
  features: string[]
  priceId: string | undefined
  /** Quantity sent to Stripe Checkout for tiered prices (defaults to 1). */
  checkoutQuantity?: number
  recommended?: boolean
}

export const PLAN_KEYS: SubscriptionPlanKey[] = ['starter', 'team', 'professional', 'enterprise']

const PLAN_DEFINITIONS: Omit<SubscriptionPlan, 'priceId'>[] = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'For solo operators and very small teams.',
    priceLabel: '—',
    interval: 'month',
    checkoutQuantity: 1,
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
    checkoutQuantity: 2,
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
    checkoutQuantity: 3,
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
    checkoutQuantity: 4,
    features: [
      'Highest limits',
      'Everything in Professional',
      'Sub-contractor scheduling',
      'Priority support',
    ],
  },
]

/** Single Stripe price used for all subscription tiers. */
export function getStripePriceId(): string | undefined {
  return process.env.STRIPE_PRICE_ID?.trim() || undefined
}

export function requireStripePriceId(): string {
  const priceId = getStripePriceId()
  if (!priceId) {
    throw new Error('STRIPE_PRICE_ID is not configured. Add it to your .env.local file.')
  }
  return priceId
}

export function getSubscriptionPlans(): SubscriptionPlan[] {
  const priceId = getStripePriceId()
  return PLAN_DEFINITIONS.map((plan) => ({
    ...plan,
    priceId,
  }))
}

export function getSubscriptionPlan(planKey: string): SubscriptionPlan | undefined {
  return getSubscriptionPlans().find((plan) => plan.key === planKey)
}

export function requireSubscriptionPlanPriceId(_planKey: string): string {
  return requireStripePriceId()
}
