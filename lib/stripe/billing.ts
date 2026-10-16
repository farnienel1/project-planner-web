export type OrgBillingStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'incomplete_expired'
  | 'paused'
  | 'none'
  | 'pending'

export type OrgBilling = {
  stripeCustomerId?: string
  stripeSubscriptionId?: string | null
  stripePriceId?: string | null
  billingInterval?: 'month' | 'year' | null
  status: OrgBillingStatus
  trialStart?: Date | null
  trialEnd?: Date | null
  currentPeriodEnd?: Date | null
  cancelAtPeriodEnd?: boolean
  canceledAt?: Date | null
  lastPaymentAt?: Date | null
  lastPaymentFailedAt?: Date | null
  trialUsed?: boolean
  mrrPence?: number
  updatedAt?: Date
  lastStripeEventId?: string
}

export const PAYMENT_GRACE_MS = 7 * 24 * 60 * 60 * 1000
const LIVE_STATUSES: OrgBillingStatus[] = ['trialing', 'active']

function asDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date && Number.isFinite(value.getTime())) return value
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isFinite(parsed.getTime()) ? parsed : null
  }
  if (typeof value === 'object') {
    const record = value as { toDate?: () => Date; seconds?: number; _seconds?: number }
    if (typeof record.toDate === 'function') {
      const parsed = record.toDate()
      return parsed instanceof Date && Number.isFinite(parsed.getTime()) ? parsed : null
    }
    const seconds = typeof record.seconds === 'number' ? record.seconds : record._seconds
    if (typeof seconds === 'number') return new Date(seconds * 1000)
  }
  return null
}

function asStatus(value: unknown): OrgBillingStatus {
  const status = String(value || '').trim()
  if (
    status === 'trialing' ||
    status === 'active' ||
    status === 'past_due' ||
    status === 'canceled' ||
    status === 'unpaid' ||
    status === 'incomplete' ||
    status === 'incomplete_expired' ||
    status === 'paused' ||
    status === 'pending' ||
    status === 'none'
  ) {
    return status
  }
  return 'none'
}

export function parseOrgBilling(data: Record<string, unknown> | null | undefined): OrgBilling | null {
  if (!data) return null
  const raw = data.billing
  if (raw && typeof raw === 'object') {
    const billing = raw as Record<string, unknown>
    const interval = billing.billingInterval === 'year' ? 'year' : billing.billingInterval === 'month' ? 'month' : null
    return {
      stripeCustomerId: typeof billing.stripeCustomerId === 'string' ? billing.stripeCustomerId : undefined,
      stripeSubscriptionId: typeof billing.stripeSubscriptionId === 'string' ? billing.stripeSubscriptionId : null,
      stripePriceId: typeof billing.stripePriceId === 'string' ? billing.stripePriceId : null,
      billingInterval: interval,
      status: asStatus(billing.status),
      trialStart: asDate(billing.trialStart),
      trialEnd: asDate(billing.trialEnd),
      currentPeriodEnd: asDate(billing.currentPeriodEnd),
      cancelAtPeriodEnd: billing.cancelAtPeriodEnd === true,
      canceledAt: asDate(billing.canceledAt),
      lastPaymentAt: asDate(billing.lastPaymentAt),
      lastPaymentFailedAt: asDate(billing.lastPaymentFailedAt),
      trialUsed: billing.trialUsed === true,
      mrrPence: typeof billing.mrrPence === 'number' ? billing.mrrPence : 0,
      updatedAt: asDate(billing.updatedAt) || undefined,
      lastStripeEventId: typeof billing.lastStripeEventId === 'string' ? billing.lastStripeEventId : undefined,
    }
  }
  const subscription = data.subscription
  if (subscription && typeof subscription === 'object') {
    const sub = subscription as Record<string, unknown>
    const planKey = String(sub.planKey || '').toLowerCase()
    return {
      stripeCustomerId: typeof sub.stripeCustomerId === 'string' ? sub.stripeCustomerId : undefined,
      stripeSubscriptionId: typeof sub.stripeSubscriptionId === 'string' ? sub.stripeSubscriptionId : null,
      stripePriceId: typeof sub.stripePriceId === 'string' ? sub.stripePriceId : null,
      billingInterval: planKey === 'year' || planKey === 'annual' ? 'year' : planKey === 'month' ? 'month' : null,
      status: asStatus(sub.status),
      currentPeriodEnd: asDate(sub.currentPeriodEnd),
      trialUsed: false,
      mrrPence: 0,
    }
  }
  return null
}

/**
 * Full access while trialing/active, or past_due within 7 days of lastPaymentFailedAt.
 * Missing billing (legacy orgs that pre-date Stripe) and pending setup stay writable.
 */
export function hasAccess(billing: OrgBilling | null | undefined, now = Date.now()): boolean {
  if (!billing) return true
  if (billing.status === 'none' || billing.status === 'pending') return true
  if (LIVE_STATUSES.includes(billing.status)) return true
  if (billing.status === 'past_due') {
    if (!billing.lastPaymentFailedAt) return true
    return now - billing.lastPaymentFailedAt.getTime() < PAYMENT_GRACE_MS
  }
  return false
}

export function billingLabel(billing: OrgBilling | null | undefined): string {
  if (!billing || billing.status === 'none' || billing.status === 'pending') return 'None'
  if (billing.status === 'trialing') return 'Trial'
  if (billing.billingInterval === 'year') return 'Annual'
  if (billing.billingInterval === 'month') return 'Monthly'
  return billing.status
}

export function billingStatusLabel(billing: OrgBilling | null | undefined): string {
  if (!billing) return 'None'
  switch (billing.status) {
    case 'trialing':
      return billing.trialEnd ? `Trialing · ends ${billing.trialEnd.toLocaleDateString('en-GB')}` : 'Trialing'
    case 'active':
      return billing.cancelAtPeriodEnd && billing.currentPeriodEnd
        ? `Cancels on ${billing.currentPeriodEnd.toLocaleDateString('en-GB')}`
        : billing.currentPeriodEnd
          ? `Active · renews ${billing.currentPeriodEnd.toLocaleDateString('en-GB')}`
          : 'Active'
    case 'past_due':
      return 'Past due'
    case 'canceled':
      return 'Cancelled'
    case 'paused':
      return 'Paused'
    case 'pending':
      return 'Setup pending'
    default:
      return billing.status
  }
}

export function trialChargeDate(from = new Date(), days = 30): Date {
  const date = new Date(from)
  date.setDate(date.getDate() + days)
  return date
}

export function formatTrialChargeCopy(from = new Date()): string {
  return `Your 30-day free trial starts today. You won't be charged until ${trialChargeDate(from).toLocaleDateString('en-GB')}. Cancel any time before then.`
}

/** Legal subscribe/pay disclosure. Amounts stay £149 / £1,490 — do not read live Stripe prices here. */
export const SUBSCRIPTION_PRICE_DISCLOSURE =
  '£149 a month or £1,490 a year. VAT is not charged. After the 30-day free trial this renews automatically at that price until you cancel. Cancel any time from Settings → Billing → Manage billing. No email or phone needed.'

export const SUBSCRIPTION_RENEWAL_CONSENT =
  'I understand this subscription renews automatically after the trial until I cancel from Settings → Billing.'

export const PRICING_TRIAL_CTA = 'Start 30-day trial — renews until cancelled'

export const REVIEW_PAY_TRIAL_CTA = 'Start trial — renews until cancelled'

export const BILLING_PANEL_RENEWAL_COPY =
  'This renews automatically until you cancel. To cancel: Manage billing → cancel the plan. Access continues until the period end shown above.'

export const CHECKOUT_SUBMIT_MESSAGE =
  'After the 30-day free trial this renews automatically at that price until you cancel. Cancel any time from Settings → Billing → Manage billing.'

export function priceLabelForBillingInterval(interval?: 'month' | 'year' | null): string {
  return interval === 'year' ? '£1,490 a year' : '£149 a month'
}

export function checkoutPurchaseEmailKind(input: {
  userFound: boolean
  accountConfirmed?: boolean | null
}): 'billing' | 'founder' {
  if (!input.userFound) return 'founder'
  return input.accountConfirmed === false ? 'founder' : 'billing'
}

export function shouldSendCheckoutPurchaseEmail(kind: 'billing' | 'founder' | string | null | undefined): boolean {
  return kind === 'billing'
}

export function billingIntervalFromPlanKey(planKey?: string | null): 'month' | 'year' {
  return planKey === 'year' || planKey === 'annual' || planKey === 'yearly' ? 'year' : 'month'
}

export function billingIntervalFromStripeSubscription(subscription: {
  items?: { data?: Array<{ price?: { recurring?: { interval?: string | null } | null } | null }> }
}): 'month' | 'year' | null {
  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval
  if (interval === 'year') return 'year'
  if (interval === 'month') return 'month'
  return null
}
