import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasAccess, parseOrgBilling, billingLabel } from './billing'
import { normalizePlanKey, mrrPenceForInterval, TRIAL_DAYS } from './plans'
import { assertStripeTestKey } from './stripe'

test('hasAccess is true for trialing, active, pending and missing billing', () => {
  assert.equal(hasAccess(null), true)
  assert.equal(hasAccess({ status: 'pending' }), true)
  assert.equal(hasAccess({ status: 'trialing' }), true)
  assert.equal(hasAccess({ status: 'active' }), true)
  assert.equal(hasAccess({ status: 'canceled' }), false)
})

test('past_due stays in access during the 7-day grace', () => {
  const now = Date.now()
  assert.equal(hasAccess({ status: 'past_due', lastPaymentFailedAt: new Date(now - 2 * 24 * 60 * 60 * 1000) }, now), true)
  assert.equal(hasAccess({ status: 'past_due', lastPaymentFailedAt: new Date(now - 8 * 24 * 60 * 60 * 1000) }, now), false)
})

test('billing labels follow interval and trial', () => {
  assert.equal(billingLabel({ status: 'trialing', billingInterval: 'month' }), 'Trial')
  assert.equal(billingLabel({ status: 'active', billingInterval: 'year' }), 'Annual')
  assert.equal(billingLabel({ status: 'active', billingInterval: 'month' }), 'Monthly')
})

test('parseOrgBilling reads nested billing then subscription fallback', () => {
  const billing = parseOrgBilling({
    billing: { status: 'trialing', billingInterval: 'month', mrrPence: 14900, stripeCustomerId: 'cus_x' },
  })
  assert.equal(billing?.status, 'trialing')
  assert.equal(billing?.mrrPence, 14900)
  const fallback = parseOrgBilling({ subscription: { status: 'active', planKey: 'year', stripeCustomerId: 'cus_y' } })
  assert.equal(fallback?.billingInterval, 'year')
})

test('plan keys and MRR match the sandbox catalogue', () => {
  assert.equal(normalizePlanKey('professional'), 'month')
  assert.equal(normalizePlanKey('annual'), 'year')
  assert.equal(mrrPenceForInterval('month'), 14900)
  assert.equal(mrrPenceForInterval('year'), Math.round(149000 / 12))
  assert.equal(TRIAL_DAYS, 30)
})

test('test-mode guard refuses live secret keys', () => {
  const previous = process.env.STRIPE_MODE
  process.env.STRIPE_MODE = 'test'
  assert.throws(() => assertStripeTestKey('sk_live_example'))
  assert.doesNotThrow(() => assertStripeTestKey('sk_test_example'))
  if (previous == null) delete process.env.STRIPE_MODE
  else process.env.STRIPE_MODE = previous
})
