import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLATFORM_OWNER_EMAIL,
  hasCustomerOrganisation,
  isPlatformOwnerEmail,
  isPlatformOwnerSentinelOrg,
  isPlatformOwnerSession,
} from './owner.ts'

test('only info@projectplanner.us is the platform owner', () => {
  assert.equal(isPlatformOwnerEmail(PLATFORM_OWNER_EMAIL), true)
  assert.equal(isPlatformOwnerEmail('  Info@ProjectPlanner.us  '), true)
  assert.equal(isPlatformOwnerEmail('admin@contractor.com'), false)
  assert.equal(isPlatformOwnerEmail(''), false)
  assert.equal(isPlatformOwnerEmail(null), false)
})

test('sentinel org is not treated as a customer tenant', () => {
  assert.equal(isPlatformOwnerSentinelOrg('platform-owner'), true)
  assert.equal(hasCustomerOrganisation('platform-owner'), false)
  assert.equal(hasCustomerOrganisation('ORG-123'), true)
  assert.equal(hasCustomerOrganisation(''), false)
  assert.equal(isPlatformOwnerSession(PLATFORM_OWNER_EMAIL, null), true)
  assert.equal(isPlatformOwnerSession(null, 'platform-owner'), true)
  assert.equal(isPlatformOwnerSession('admin@contractor.com', 'ORG-123'), false)
})
