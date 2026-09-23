import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatMembershipCreatedLabel,
  isSetupIncomplete,
  pickPendingOrganizationToReuse,
  pickReusablePendingOrganization,
  shouldSwitchUserToNewOrganization,
  shortOrganizationId,
  subscriptionStatusFromOrgData,
} from './pendingOrganizationReuse.ts'

test('isSetupIncomplete reads nested subscription.status pending', () => {
  assert.equal(isSetupIncomplete({ subscription: { status: 'pending' } }), true)
  assert.equal(isSetupIncomplete({ subscription: { status: 'active' } }), false)
  assert.equal(isSetupIncomplete({ subscriptionStatus: 'pending' }), true)
  assert.equal(isSetupIncomplete({ name: 'Acme' }), false)
})

test('subscriptionStatusFromOrgData prefers nested subscription.status', () => {
  assert.equal(
    subscriptionStatusFromOrgData({
      subscription: { status: 'active' },
      subscriptionStatus: 'pending',
    }),
    'active'
  )
})

test('pickReusablePendingOrganization returns newest same-name pending for the creator', () => {
  const picked = pickReusablePendingOrganization(
    [
      {
        id: 'OLD',
        name: 'Acme Ltd',
        creatorUserId: 'u1',
        subscriptionStatus: 'pending',
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'NEW',
        name: 'acme ltd',
        creatorUserId: 'u1',
        subscriptionStatus: 'pending',
        createdAt: new Date('2026-09-01'),
      },
      {
        id: 'OTHER',
        name: 'Acme Ltd',
        creatorUserId: 'u2',
        subscriptionStatus: 'pending',
        createdAt: new Date('2026-10-01'),
      },
      {
        id: 'PAID',
        name: 'Acme Ltd',
        creatorUserId: 'u1',
        subscriptionStatus: 'active',
        createdAt: new Date('2025-01-01'),
      },
    ],
    'u1',
    'Acme Ltd'
  )
  assert.equal(picked?.id, 'NEW')
})

test('pickPendingOrganizationToReuse prefers the resume id when that org is still pending', () => {
  const orgs = [
    {
      id: 'OLD',
      name: 'Acme Ltd',
      creatorUserId: 'u1',
      subscriptionStatus: 'pending',
      createdAt: new Date('2026-01-01'),
    },
    {
      id: 'RESUME',
      name: 'Other Ltd',
      creatorUserId: 'u1',
      subscriptionStatus: 'pending',
      createdAt: new Date('2026-02-01'),
    },
  ]
  assert.equal(pickPendingOrganizationToReuse(orgs, 'u1', 'Acme Ltd', 'RESUME')?.id, 'RESUME')
  assert.equal(pickPendingOrganizationToReuse(orgs, 'u1', 'Acme Ltd')?.id, 'OLD')
})

test('shouldSwitchUserToNewOrganization is false when the user already has a complete org', () => {
  assert.equal(
    shouldSwitchUserToNewOrganization({
      existingUser: { organizationId: 'LIVE' },
      currentOrgSubscriptionStatus: 'active',
    }),
    false
  )
  assert.equal(
    shouldSwitchUserToNewOrganization({
      existingUser: { organizationId: 'LIVE' },
      currentOrgSubscriptionStatus: 'trialing',
    }),
    false
  )
})

test('shouldSwitchUserToNewOrganization is true for first setup or a pending current org', () => {
  assert.equal(
    shouldSwitchUserToNewOrganization({
      existingUser: null,
      currentOrgSubscriptionStatus: null,
    }),
    true
  )
  assert.equal(
    shouldSwitchUserToNewOrganization({
      existingUser: { organizationId: '' },
      currentOrgSubscriptionStatus: null,
    }),
    true
  )
  assert.equal(
    shouldSwitchUserToNewOrganization({
      existingUser: { organizationId: 'PENDING' },
      currentOrgSubscriptionStatus: 'pending',
    }),
    true
  )
})

test('shortOrganizationId and created label distinguish same-name rows', () => {
  const formatted = formatMembershipCreatedLabel(new Date('2026-09-20T12:00:00Z'))
  assert.ok(formatted && /20 Sep/.test(formatted))
  assert.equal(shortOrganizationId('a1b2c3d4-e5f6-7890-abcd-ef1234567890'), 'A1B2C3D4')
})
