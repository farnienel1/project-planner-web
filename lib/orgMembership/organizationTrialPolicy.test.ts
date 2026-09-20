import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TRIAL_BLOCKED_LOGIN_MESSAGE,
  blockedMessage,
  isAccessBlocked,
  isTrialOrganization,
  loginBlockMessage,
  membershipSummary,
  roleDisplayName,
  sortMemberships,
} from './organizationTrialPolicy.ts'

test('roleDisplayName matches iOS Admin/Manager/Member mapping', () => {
  assert.equal(roleDisplayName('admin'), 'Admin')
  assert.equal(roleDisplayName('manager'), 'Manager')
  assert.equal(roleDisplayName('member'), 'Member')
  assert.equal(roleDisplayName('operative'), 'Operative')
})

test('isTrialOrganization reads isTrial and status strings', () => {
  assert.equal(isTrialOrganization({ isTrial: true }), true)
  assert.equal(isTrialOrganization({ subscriptionStatus: 'Trial' }), true)
  assert.equal(isTrialOrganization({ billingStatus: 'trial' }), true)
  assert.equal(isTrialOrganization({ name: 'Acme' }), false)
})

test('blockedMessage prefers custom copy then default unlock email', () => {
  assert.equal(
    blockedMessage({ trialAccessBlockedMessage: 'Call the office' }),
    'Call the office'
  )
  assert.equal(blockedMessage({}), TRIAL_BLOCKED_LOGIN_MESSAGE)
})

test('loginBlockMessage blocks extra trial orgs that are not the earliest', () => {
  const older = membershipSummary('ORG-A', { name: 'First', isTrial: true }, 'admin')
  older.createdAt = new Date('2024-01-01')
  const newer = membershipSummary('ORG-B', { name: 'Second', isTrial: true }, 'member')
  newer.createdAt = new Date('2025-01-01')
  assert.equal(
    loginBlockMessage({
      organizationId: 'ORG-B',
      orgData: { isTrial: true },
      memberships: [older, newer],
    }),
    TRIAL_BLOCKED_LOGIN_MESSAGE
  )
  assert.equal(
    loginBlockMessage({
      organizationId: 'ORG-A',
      orgData: { isTrial: true },
      memberships: [older, newer],
    }),
    null
  )
})

test('explicit lock always blocks', () => {
  assert.equal(isAccessBlocked({ trialAccessBlocked: true }), true)
  assert.equal(
    loginBlockMessage({
      organizationId: 'ORG-Z',
      orgData: { accessBlocked: true, accessBlockedMessage: 'Locked by billing' },
      memberships: [],
    }),
    'Locked by billing'
  )
})

test('sortMemberships puts the active org first then name', () => {
  const sorted = sortMemberships(
    [
      { id: 'b', name: 'Beta' },
      { id: 'a', name: 'Alpha' },
      { id: 'c', name: 'Current' },
    ],
    'c'
  )
  assert.deepEqual(
    sorted.map((row) => row.id),
    ['c', 'a', 'b']
  )
})
