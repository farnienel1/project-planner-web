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
