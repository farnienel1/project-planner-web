export type SubscriptionPlanKey = 'month' | 'year'

export type SubscriptionPlan = {
  key: SubscriptionPlanKey
  name: string
  description: string
  priceLabel: string
  amountPence: number
  interval: 'month' | 'year'
  features: string[]
  priceId: string | undefined
  lookupKey: string
  recommended?: boolean
}

export const PLAN_KEYS: SubscriptionPlanKey[] = ['month', 'year']

export const STRIPE_LOOKUP_MONTHLY = 'projectplanner_monthly_gbp'
export const STRIPE_LOOKUP_ANNUAL = 'projectplanner_annual_gbp'
export const STRIPE_PRODUCT_ID_DEFAULT = 'prod_VJRTsDgwXEkoIS'
export const STRIPE_PRICE_MONTHLY_DEFAULT = 'price_1UIoarDAbu1xyzaBw0yZNCnJ'
export const STRIPE_PRICE_ANNUAL_DEFAULT = 'price_1UIoasDAbu1xyzaB80igg3WU'
export const STRIPE_PORTAL_CONFIG_DEFAULT = 'bpc_1UIochDAbu1xyzaBGLeMkVKW'
export const TRIAL_DAYS = 30
export const MONTHLY_PENCE = 14_900
export const ANNUAL_PENCE = 149_000
export const ANNUAL_MRR_PENCE = Math.round(ANNUAL_PENCE / 12)

const FEATURES = [
  'Everything included',
  'Unlimited users',
  'Unlimited projects and small works',
  'Scheduling, timesheets, materials and H&S',
  'iOS, Android and web',
  'No feature tiers or paid add-ons',
]

const PLAN_DEFINITIONS: Omit<SubscriptionPlan, 'priceId'>[] = [
  {
    key: 'month',
    name: 'ProjectPlanner Monthly',
    description: '£149 a month. VAT is not charged. 30-day free trial, then billed monthly.',
    priceLabel: '£149',
    amountPence: MONTHLY_PENCE,
    interval: 'month',
    lookupKey: STRIPE_LOOKUP_MONTHLY,
    recommended: true,
    features: FEATURES,
  },
  {
    key: 'year',
    name: 'ProjectPlanner Annual',
    description: '£1,490 a year. VAT is not charged. Save £298 a year. 30-day free trial.',
    priceLabel: '£1,490',
    amountPence: ANNUAL_PENCE,
    interval: 'year',
    lookupKey: STRIPE_LOOKUP_ANNUAL,
    features: FEATURES,
  },
]

export function normalizePlanKey(value?: string | null): SubscriptionPlanKey {
  const key = (value || '').trim().toLowerCase()
  if (key === 'year' || key === 'annual' || key === 'yearly') return 'year'
  return 'month'
}

export function getStripePriceId(planKey: SubscriptionPlanKey = 'month'): string | undefined {
  if (planKey === 'year') {
    return process.env.STRIPE_PRICE_ANNUAL?.trim() || STRIPE_PRICE_ANNUAL_DEFAULT
  }
  return (
    process.env.STRIPE_PRICE_MONTHLY?.trim() ||
    process.env.STRIPE_PRICE_ID?.trim() ||
    STRIPE_PRICE_MONTHLY_DEFAULT
  )
}

export function getStripeProductId(): string {
  return process.env.STRIPE_PRODUCT_ID?.trim() || STRIPE_PRODUCT_ID_DEFAULT
}

export function getStripePortalConfigurationId(): string | undefined {
  return process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim() || STRIPE_PORTAL_CONFIG_DEFAULT
}

export function requireStripePriceId(planKey: SubscriptionPlanKey = 'month'): string {
  const priceId = getStripePriceId(planKey)
  if (!priceId) throw new Error('Stripe price is not configured.')
  return priceId
}

export function getSubscriptionPlans(): SubscriptionPlan[] {
  return PLAN_DEFINITIONS.map((plan) => ({
    ...plan,
    priceId: getStripePriceId(plan.key),
  }))
}

export type SubscriptionPlanDisplay = SubscriptionPlan & {
  configured: boolean
  recommended: boolean
}

export function getSubscriptionPlanDisplayOptions(configured = false): SubscriptionPlanDisplay[] {
  return getSubscriptionPlans().map((plan) => ({
    ...plan,
    configured,
    recommended: plan.recommended ?? false,
  }))
}

export function getSubscriptionPlan(planKey: string): SubscriptionPlan | undefined {
  return getSubscriptionPlans().find((plan) => plan.key === normalizePlanKey(planKey))
}

export function requireSubscriptionPlanPriceId(planKey: string): string {
  const plan = getSubscriptionPlan(planKey)
  if (plan?.priceId) return plan.priceId
  return requireStripePriceId(normalizePlanKey(planKey))
}

export function lookupKeyForPlan(planKey: SubscriptionPlanKey): string {
  return planKey === 'year' ? STRIPE_LOOKUP_ANNUAL : STRIPE_LOOKUP_MONTHLY
}

export function mrrPenceForInterval(interval: 'month' | 'year' | null | undefined): number {
  if (interval === 'year') return ANNUAL_MRR_PENCE
  if (interval === 'month') return MONTHLY_PENCE
  return 0
}

export function trialRequiresCard(): boolean {
  return (process.env.STRIPE_TRIAL_REQUIRES_CARD || 'true').trim().toLowerCase() !== 'false'
}

export function automaticTaxEnabled(): boolean {
  return (process.env.STRIPE_AUTOMATIC_TAX || '').trim().toLowerCase() === 'true'
}

export function stripeNotConfiguredMessage(): string {
  if (process.env.NODE_ENV === 'production') {
    return 'Stripe is not configured on the live site. Add STRIPE_SECRET_KEY (a sandbox test key) in Netlify → Site configuration → Environment variables, then redeploy. The live site does not read .env.local.'
  }
  return 'Stripe is not configured yet. Add STRIPE_SECRET_KEY to .env.local and restart the dev server.'
}
