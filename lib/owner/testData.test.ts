import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTestOrganisation, isTestPerson, personOrganisationIds, testOrganisationIds } from './testData.ts'

test('D12: an organisation is test only by its flags', () => {
  assert.equal(isTestOrganisation({ isInternal: true }), true)
  assert.equal(isTestOrganisation({ isTest: true }), true)
  assert.equal(isTestOrganisation({}), false)
  assert.equal(isTestOrganisation({ isInternal: 'true' }), false)
  assert.equal(isTestOrganisation(null), false)
})

test('D12 / audit O5d: a real person or company with "test" in the name is never test data', () => {
  // The old isTestRecord name guess hid these; guardrail 3 — they reappear.
  const orgs = [{ id: 'o1', name: 'Test Valley Electrical' }]
  const ids = testOrganisationIds(orgs)
  assert.equal(ids.size, 0)
  assert.equal(isTestPerson({ organizationId: 'o1' }, ids), false)
})

test('a person is test when flagged, or when every organisation they belong to is test', () => {
  const ids = new Set(['test-org'])
  assert.equal(isTestPerson({ isInternal: true, organizationId: 'real' }, ids), true)
  assert.equal(isTestPerson({ organizationId: 'test-org' }, ids), true)
  assert.equal(isTestPerson({ organizationId: 'test-org', organizationIds: ['real'] }, ids), false)
  assert.equal(isTestPerson({ organizationId: 'test-org', organizationIds: ['test-org', ' '] }, ids), true)
  assert.equal(isTestPerson({}, ids), false)
  assert.equal(isTestPerson(null, ids), false)
})

test('personOrganisationIds trims and folds', () => {
  assert.deepEqual(personOrganisationIds({ organizationId: ' a ', organizationIds: ['a', 'b', null, ''] }), ['a', 'b'])
})
