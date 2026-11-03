/**
 * Whether an organisation still has product access from its Stripe billing map.
 *
 * Screens stay in each app. Both platforms call this instead of a local
 * status switch. Do not invent a second status enum — Stripe's stored
 * `billing.status` strings are the input. Monthly and annual use the same
 * rule. Cancel-at-period-end stays open while status is still `active`;
 * Stripe flips that to `canceled` when the period ends.
 *
 * Nested map: `organizations/{orgId}.billing`. Field names stay as written
 * (`status`, `lastPaymentFailedAt`, `cancelAtPeriodEnd`, `currentPeriodEnd`,
 * `billingInterval`). This module does not write Firestore.
 */

export const PAYMENT_GRACE_MS = 7 * 24 * 60 * 60 * 1000

const LIVE_STATUSES = new Set(['trialing', 'active'])

export type OrgBillingAccessInput = {
  status?: string | null
  lastPaymentFailedAt?: Date | number | string | { toDate?: () => Date; seconds?: number; _seconds?: number } | null
  cancelAtPeriodEnd?: boolean | null
  currentPeriodEnd?: Date | number | string | null
  billingInterval?: string | null
}

function timestampMs(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'object' && typeof (value as { getTime?: unknown }).getTime === 'function') {
    const ms = (value as Date).getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? Math.round(value * 1000) : Math.round(value)
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  if (typeof value === 'object') {
    const record = value as { toDate?: () => Date; seconds?: number; _seconds?: number }
    if (typeof record.toDate === 'function') {
      try {
        const parsed = record.toDate()
        const ms = timestampMs(parsed)
        if (ms != null) return ms
      } catch {
        // Fall through to seconds.
      }
    }
    const seconds = typeof record.seconds === 'number' ? record.seconds : record._seconds
    if (typeof seconds === 'number' && Number.isFinite(seconds)) return Math.round(seconds * 1000)
  }
  return null
}

/**
 * Full access while trialing/active, or past_due within 7 days of lastPaymentFailedAt.
 * Missing billing (legacy orgs that pre-date Stripe) and pending setup stay open.
 */
export function hasAccess(billing: OrgBillingAccessInput | null | undefined, now = Date.now()): boolean {
  if (!billing) return true
  if (billing.status === 'none' || billing.status === 'pending') return true
  if (typeof billing.status === 'string' && LIVE_STATUSES.has(billing.status)) return true
  if (billing.status === 'past_due') {
    if (!billing.lastPaymentFailedAt) return true
    const failedAt = timestampMs(billing.lastPaymentFailedAt)
    if (failedAt == null) return false
    return now - failedAt < PAYMENT_GRACE_MS
  }
  return false
}

/**
 * Rulebook 1.13.0 §19 (owner decisions round 4, Q3): a lapsed subscription blocks both apps. Nothing is deleted and
 * access returns as soon as `hasAccess` is true again (Stripe marks the subscription paid).
 */
export const SUBSCRIPTION_LAPSED_MESSAGE =
  "The organisation's Project Planner subscription has lapsed. Please contact your system administrator and ask them to renew."

/** Shown to an admin on the lapsed screen, under the message, where renewing is possible (web Settings → Billing). */
export const SUBSCRIPTION_LAPSED_ADMIN_NOTE = 'You are an admin: renew the subscription in Settings → Billing.'

/** On an app with no billing screen (iOS), what an admin is told. */
export const SUBSCRIPTION_LAPSED_ADMIN_WEB_NOTE =
  'You are an admin: renew the subscription in Settings → Billing on the Project Planner website.'

export type SubscriptionAccess = 'open' | 'adminBillingOnly' | 'blocked'

/**
 * What a signed-in person may open: `open` while `hasAccess`; when lapsed, `adminBillingOnly` for an admin or super
 * admin of the organisation (only the billing screen and sign out — web Settings → Billing), else `blocked` (only the
 * lapsed message and sign out). The platform owner is never blocked. Missing billing is open (trials, older orgs).
 */
export function subscriptionAccess(input: {
  billing: OrgBillingAccessInput | null | undefined
  viewerIsAdmin?: boolean | null
  viewerIsPlatformOwner?: boolean | null
  now?: number
}): SubscriptionAccess {
  if (input.viewerIsPlatformOwner === true) return 'open'
  if (hasAccess(input.billing, input.now ?? Date.now())) return 'open'
  return input.viewerIsAdmin === true ? 'adminBillingOnly' : 'blocked'
}

/**
 * Rulebook 1.13.0 §19: the two fields the Stripe webhook writes into `organizations/{orgId}.billing` beside the
 * Stripe status, for the security rules (which cannot run `hasAccess`): `accessOpen` = `hasAccess(billing, now)`, and
 * `accessClosesAtMs` = the end of the 7-day grace while a payment has failed (`past_due` with `lastPaymentFailedAt`),
 * else null. The webhook stores the instant as a Timestamp named `accessClosesAt`. The rules close the organisation
 * when `accessOpen` is false or `accessClosesAt` has passed.
 */
export function billingAccessFields(
  billing: OrgBillingAccessInput | null | undefined,
  now = Date.now()
): { accessOpen: boolean; accessClosesAtMs: number | null } {
  const accessOpen = hasAccess(billing, now)
  let accessClosesAtMs: number | null = null
  if (billing?.status === 'past_due' && billing.lastPaymentFailedAt) {
    const failedAt = timestampMs(billing.lastPaymentFailedAt)
    if (failedAt != null) accessClosesAtMs = failedAt + PAYMENT_GRACE_MS
  }
  return { accessOpen, accessClosesAtMs }
}
