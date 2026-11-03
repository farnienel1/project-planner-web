import { test } from 'node:test'
import assert from 'node:assert/strict'
import { billingEmailRecipientUids, processStripeEventOnce } from './webhookProcessing'

test('processStripeEventOnce: success returns 200 and keeps the claim', async () => {
  let released = false
  const out = await processStripeEventOnce({
    claim: async () => true,
    process: async () => {},
    release: async () => {
      released = true
    },
  })
  assert.equal(out.status, 200)
  assert.deepEqual(out.body, { received: true })
  assert.equal(released, false)
})

test('processStripeEventOnce: a duplicate is 200 and is not processed', async () => {
  let processed = false
  const out = await processStripeEventOnce({
    claim: async () => false,
    process: async () => {
      processed = true
    },
    release: async () => {},
  })
  assert.equal(out.status, 200)
  assert.deepEqual(out.body, { received: true, duplicate: true })
  assert.equal(processed, false)
})

test('processStripeEventOnce: a processing failure releases the claim and returns 500 so Stripe retries', async () => {
  let released = 0
  const errors: unknown[] = []
  const out = await processStripeEventOnce({
    claim: async () => true,
    process: async () => {
      throw new Error('firestore down')
    },
    release: async () => {
      released += 1
    },
    onError: (error) => errors.push(error),
  })
  assert.equal(out.status, 500)
  assert.equal(released, 1)
  assert.equal(errors.length, 1)
})

test('processStripeEventOnce: a failed release still returns 500', async () => {
  const out = await processStripeEventOnce({
    claim: async () => true,
    process: async () => {
      throw new Error('boom')
    },
    release: async () => {
      throw new Error('release failed')
    },
  })
  assert.equal(out.status, 500)
})

test('processStripeEventOnce: a failed claim returns 500 and releases nothing', async () => {
  let released = false
  const out = await processStripeEventOnce({
    claim: async () => {
      throw new Error('cannot claim')
    },
    process: async () => {},
    release: async () => {
      released = true
    },
  })
  assert.equal(out.status, 500)
  assert.equal(released, false)
})

test('billingEmailRecipientUids: creator (super admin) first, then admins, never managers or operatives', () => {
  const uids = billingEmailRecipientUids({
    organizationId: 'org-1',
    creatorUserId: 'creator',
    members: { 'admin-a': 'admin', 'mgr-b': 'manager', creator: 'admin', 'op-c': 'operative', 'admin-d': 'super_admin' },
  })
  assert.deepEqual(uids, ['creator', 'admin-a', 'admin-d'])
})

test('billingEmailRecipientUids: no creator falls back to the admins', () => {
  assert.deepEqual(
    billingEmailRecipientUids({ organizationId: 'org-1', creatorUserId: null, members: { m: 'manager', a: 'admin' } }),
    ['a']
  )
  assert.deepEqual(billingEmailRecipientUids({ organizationId: 'org-1' }), [])
})
