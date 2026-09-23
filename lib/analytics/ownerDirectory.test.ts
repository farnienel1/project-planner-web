import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isPermissionDenied,
  matchesOwnerSearch,
  mergeOrganisationsFromUsers,
  ownerPersonName,
  parseOwnerConsoleOrganisation,
  parseOwnerConsoleUser,
  readOrganizationId,
} from './ownerDirectory.ts'

test('readOrganizationId accepts strings, org paths and document refs', () => {
  assert.equal(readOrganizationId('abc-123'), 'abc-123')
  assert.equal(readOrganizationId('organizations/abc-123'), 'abc-123')
  assert.equal(readOrganizationId({ id: 'org9', path: 'organizations/org9' }), 'org9')
  assert.equal(readOrganizationId(''), '')
})

test('parseOwnerConsoleUser keeps live tenant accounts even when the strict parser would skip', () => {
  const user = parseOwnerConsoleUser('u1', {
    email: 'sam@contractor.com',
    organizationId: { id: 'ORG-1', path: 'organizations/ORG-1' },
    firstName: 'Sam',
    surname: 'Lee',
    role: 'admin',
    lastSeenAt: new Date('2026-09-20T10:00:00Z'),
  })
  assert.equal(user?.organizationId, 'ORG-1')
  assert.equal(user?.email, 'sam@contractor.com')
  assert.equal(parseOwnerConsoleUser('owner', { email: 'info@projectplanner.us', organizationId: 'platform-owner' }), null)
})

test('mergeOrganisationsFromUsers recovers tenants that only exist on user records', () => {
  const rows = mergeOrganisationsFromUsers(
    [{ id: 'A', name: 'Alpha Ltd', memberCount: 1 }],
    [{ organizationId: 'A' }, { organizationId: 'A' }, { organizationId: 'B', email: 'user@unknown.user' }, { organizationId: 'platform-owner' }]
  )
  assert.equal(rows.length, 2)
  assert.equal(rows.find((row) => row.id === 'A')?.memberCount, 2)
  assert.equal(rows.find((row) => row.id === 'B')?.name, 'Unfinished setup · u•••@unknown.user')
  assert.equal(rows.find((row) => row.id === 'B')?.memberCount, 1)
})

test('parseOwnerConsoleOrganisation skips the owner sentinel', () => {
  assert.equal(parseOwnerConsoleOrganisation('platform-owner', { name: 'Owner' }), null)
  assert.equal(parseOwnerConsoleOrganisation('Z', { name: 'Zed Ltd', members: { a: 'admin', b: 'user' } })?.memberCount, 2)
})

test('permission helper and search helpers', () => {
  assert.equal(isPermissionDenied(new Error('Missing or insufficient permissions.')), true)
  assert.equal(isPermissionDenied({ code: 'permission-denied' }), true)
  assert.equal(isPermissionDenied(new Error('network')), false)
  assert.equal(matchesOwnerSearch(['Alpha Ltd', 'abc'], 'alpha'), true)
  assert.equal(matchesOwnerSearch(['Alpha Ltd'], 'zzz'), false)
  assert.equal(ownerPersonName({ firstName: 'Sam', surname: 'Lee', email: 'sam@x.com' }), 'Sam Lee')
})
