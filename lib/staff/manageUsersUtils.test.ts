import assert from 'node:assert/strict'
import test from 'node:test'
import { manageUsersListPhase } from './manageUsersUtils.ts'

test('manage users stays on loading until the roster load for this organisation finishes', () => {
  assert.equal(
    manageUsersListPhase({
      organizationId: 'org-1',
      rosterLoadedOrgId: null,
      userCount: 0,
      filteredCount: 0,
      error: null,
    }),
    'loading'
  )
  assert.equal(
    manageUsersListPhase({
      organizationId: null,
      rosterLoadedOrgId: null,
      userCount: 0,
      filteredCount: 0,
      error: null,
    }),
    'loading'
  )
})

test('a failed load is an error even before the roster is marked settled', () => {
  assert.equal(
    manageUsersListPhase({
      organizationId: 'org-1',
      rosterLoadedOrgId: null,
      userCount: 0,
      filteredCount: 0,
      error: 'Failed to load users',
    }),
    'error'
  )
})

test('a settled empty roster is the empty state, and a failed load is an error', () => {
  assert.equal(
    manageUsersListPhase({
      organizationId: 'org-1',
      rosterLoadedOrgId: 'org-1',
      userCount: 0,
      filteredCount: 0,
      error: null,
    }),
    'empty'
  )
  assert.equal(
    manageUsersListPhase({
      organizationId: 'org-1',
      rosterLoadedOrgId: 'org-1',
      userCount: 0,
      filteredCount: 0,
      error: 'Failed to load users',
    }),
    'error'
  )
})

test('people already in memory stay on the list while a refresh is still unmarked', () => {
  assert.equal(
    manageUsersListPhase({
      organizationId: 'org-1',
      rosterLoadedOrgId: null,
      userCount: 4,
      filteredCount: 2,
      error: null,
    }),
    'ready'
  )
  assert.equal(
    manageUsersListPhase({
      organizationId: 'org-1',
      rosterLoadedOrgId: 'org-1',
      userCount: 4,
      filteredCount: 0,
      error: null,
    }),
    'empty'
  )
})
