import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dataQualityTestOrgSections, filterMarkableOrgs, settledMarkOverrides } from './dataQualityTestOrgs.ts'
import { isTestOrganisation } from './testData.ts'

const orgs = [
  { id: 'b', name: 'Beta Builders' },
  { id: 'a', name: 'Acme Demo', isInternal: true },
  { id: 'u', name: 'Unfinished setup', unfinishedSetup: true },
  { id: 'c', name: 'Charlie Electrical' },
]

test('owner bug 17 Nov: the old list (isTestOrganisation) only ever offered Mark internal on already-marked organisations', () => {
  const old = orgs.filter((org) => isTestOrganisation(org))
  assert.deepEqual(old.map((org) => org.id), ['a'])
  assert.ok(old.every((org) => org.isInternal === true), 'every row the old button sat on was already flagged')
})

test('sections: flagged organisations are marked; every other organisation with a document can be marked', () => {
  const { marked, unmarked } = dataQualityTestOrgSections(orgs)
  assert.deepEqual(marked.map((org) => org.id), ['a'])
  assert.deepEqual(unmarked.map((org) => org.id), ['b', 'c'])
})

test('sections: an Unfinished setup row (no organisation document) is never offered', () => {
  assert.equal(dataQualityTestOrgSections(orgs).unmarked.some((org) => org.id === 'u'), false)
})

test('sections: a successful click moves the row before the reload catches up, both ways', () => {
  const { marked, unmarked } = dataQualityTestOrgSections(orgs, { b: true, a: false })
  assert.deepEqual(marked.map((org) => org.id), ['b'])
  assert.deepEqual(unmarked.map((org) => org.id), ['a', 'c'])
})

test('filter: by name or id, trimmed and without case', () => {
  const { unmarked } = dataQualityTestOrgSections(orgs)
  assert.deepEqual(filterMarkableOrgs(unmarked, '  CHAR ').map((org) => org.id), ['c'])
  assert.deepEqual(filterMarkableOrgs(unmarked, 'b').map((org) => org.id), ['b'])
  assert.equal(filterMarkableOrgs(unmarked, '').length, 2)
})

test('settled overrides: dropped once the reloaded data agrees, kept while it does not', () => {
  assert.deepEqual(settledMarkOverrides(orgs, { a: true, b: true }), { b: true })
  assert.deepEqual(settledMarkOverrides([{ id: 'b', name: 'Beta', isInternal: true }], { b: true }), {})
})
