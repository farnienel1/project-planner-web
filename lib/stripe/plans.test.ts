import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getStripePriceId, getSubscriptionPlanDisplayOptions } from './plans'

test('price IDs come from env only — no live Stripe defaults', () => {
  const monthly = process.env.STRIPE_PRICE_MONTHLY
  const annual = process.env.STRIPE_PRICE_ANNUAL
  const legacy = process.env.STRIPE_PRICE_ID
  delete process.env.STRIPE_PRICE_MONTHLY
  delete process.env.STRIPE_PRICE_ANNUAL
  delete process.env.STRIPE_PRICE_ID
  try {
    assert.equal(getStripePriceId('month'), undefined)
    assert.equal(getStripePriceId('year'), undefined)
    assert.equal(getSubscriptionPlanDisplayOptions(false)[0]?.priceId, undefined)
  } finally {
    if (monthly == null) delete process.env.STRIPE_PRICE_MONTHLY
    else process.env.STRIPE_PRICE_MONTHLY = monthly
    if (annual == null) delete process.env.STRIPE_PRICE_ANNUAL
    else process.env.STRIPE_PRICE_ANNUAL = annual
    if (legacy == null) delete process.env.STRIPE_PRICE_ID
    else process.env.STRIPE_PRICE_ID = legacy
  }
})
