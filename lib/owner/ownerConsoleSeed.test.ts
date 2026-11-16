/**
 * Owner console seed fixtures (spec §6.2 / §6.4): the directory helpers against figures worked out by hand
 * (scripts/owner-console-seed/expected.json). A failure means the code and the hand sums disagree.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildOwnerConsoleSeed, SEED_NOW_MS } from '../../scripts/owner-console-seed/seedData.mjs'
import { ownerOrgRows, ownerPeopleRows, ownerSearch, selectOwnerOrgs, selectOwnerPeople } from './directory.ts'
import { ownerCountsFromParts } from './ownerCounts.ts'

const expected = JSON.parse(readFileSync(new URL('../../scripts/owner-console-seed/expected.json', import.meta.url), 'utf8'))
const seed = buildOwnerConsoleSeed()
const orgRows = ownerOrgRows(seed.orgs, SEED_NOW_MS)
const peopleRows = ownerPeopleRows(seed.users, orgRows)

test('seed: organisation rows, with and without test data, and each filter', () => {
  const e = expected.organisations
  assert.equal(selectOwnerOrgs(orgRows, { includeTestData: true, limit: 200 }).total, e.rows)
  assert.equal(selectOwnerOrgs(orgRows, { includeTestData: false, limit: 200 }).total, e.rowsWithoutTest)
  assert.equal(selectOwnerOrgs(orgRows, { filter: 'test' }).total, e.test)
  assert.equal(selectOwnerOrgs(orgRows, { filter: 'scheduled' }).total, e.scheduled)
  assert.equal(selectOwnerOrgs(orgRows, { filter: 'lapsed' }).total, e.lapsed)
  assert.equal(selectOwnerOrgs(orgRows, { filter: 'unfinished' }).total, e.unfinished)
  assert.equal(orgRows.find((row) => row.id === 'org-large')?.memberCount, e.largeMembers)
  assert.equal(orgRows.some((row) => row.id === 'platform-owner'), false)
})

test('seed: people are one per email across organisations, every segment kept (guardrail 3)', () => {
  const e = expected.people
  const all = (filter: 'all' | 'active' | 'inactive' | 'pending' | 'test', includeTestData = true) =>
    selectOwnerPeople(peopleRows, { filter, includeTestData, limit: 200 }).total
  assert.equal(all('all'), e.rows)
  assert.equal(all('all', false), e.rowsWithoutTest)
  assert.equal(all('test'), e.test)
  assert.equal(all('active'), e.active)
  assert.equal(all('inactive'), e.inactive)
  assert.equal(all('pending'), e.pending)
  assert.equal(all('active', false), e.activeWithoutTest)
  const dee = peopleRows.find((row) => row.id === 'dual-1')
  assert.deepEqual(dee?.organizationIds, e.dualPersonOrganisations)
  assert.deepEqual(dee?.userIds, ['dual-1', 'dual-2'])
  assert.equal(peopleRows.some((row) => row.id === 'dual-2'), false)
  assert.equal(peopleRows.some((row) => row.id === 'owner-uid'), false)
})

test('seed: old shapes read (organisation stored as a path, createdAt as a map or text)', () => {
  const lou = peopleRows.find((row) => row.id === 'lap-2')
  assert.deepEqual(lou?.organizationIds, ['org-lapsed'])
  assert.equal(lou?.name, 'Lou Lapsed')
  assert.ok(lou?.createdAtMs)
  const contract = peopleRows.find((row) => row.id === 'contract-USER-IOS-1')
  assert.ok(contract?.createdAtMs)
})

test('seed: no response row carries a full email', () => {
  const page = selectOwnerPeople(peopleRows, { includeTestData: true, limit: 200 })
  for (const row of page.rows) {
    assert.equal(JSON.stringify(row).includes('@large.example') && !row.emailMasked.includes('•••'), false)
    assert.equal('_search' in row, false)
  }
})

test('seed: search by name, email and id', () => {
  for (const [query, wants] of Object.entries(expected.search) as [string, { organisations?: string[]; people?: string[] }][]) {
    const result = ownerSearch(orgRows, peopleRows, query, true)
    if (wants.organisations) assert.deepEqual(result.organisations.map((row) => row.id), wants.organisations, query)
    if (wants.people) assert.deepEqual(result.people.map((row) => row.id), wants.people, query)
  }
})

test('seed: headline counts (users documents, not folded people)', () => {
  const e = expected.counts
  const testOrgIds = orgRows.filter((row) => row.isTest).map((row) => row.id)
  const users = seed.users.filter((doc) => doc.data.organizationId !== 'platform-owner')
  const inTestOrg = (doc: { data: Record<string, unknown> }) =>
    testOrgIds.some((id) => doc.data.organizationId === id || doc.data.organizationId === `organizations/${id}`)
  const parts = {
    organisations: seed.orgs.length,
    sentinelOrganisation: 1,
    testInternal: seed.orgs.filter((o) => o.data.isInternal === true).length,
    testFlag: seed.orgs.filter((o) => o.data.isTest === true).length,
    testBoth: seed.orgs.filter((o) => o.data.isInternal === true && o.data.isTest === true).length,
    scheduled: seed.orgs.filter((o) => (o.data.deletion as { status?: string } | undefined)?.status === 'scheduled').length,
    accounts: seed.users.length,
    ownerAccounts: seed.users.length - users.length,
    inactiveAccounts: seed.users.filter((u) => u.data.isActive === false).length,
    internalAccounts: users.filter((u) => u.data.isInternal === true).length,
    accountsInTestOrgs: users.filter(inTestOrg).length,
    internalAccountsInTestOrgs: users.filter((u) => u.data.isInternal === true && inTestOrg(u)).length,
    pendingInvitations: seed.invitations.filter((i) => i.data.isUsed === false).length,
  }
  const withTest = ownerCountsFromParts(parts, true)
  const without = ownerCountsFromParts(parts, false)
  assert.equal(withTest.organisations, e.organisations)
  assert.equal(without.organisations, e.organisationsWithoutTest)
  assert.equal(withTest.testOrganisations, e.testOrganisations)
  assert.equal(withTest.scheduledForDeletion, e.scheduledForDeletion)
  assert.equal(withTest.accounts, e.accounts)
  assert.equal(without.accounts, e.accountsWithoutTest)
  assert.equal(withTest.testAccounts, e.testAccounts)
  assert.equal(withTest.inactiveAccounts, e.inactiveAccounts)
  assert.equal(withTest.pendingInvitations, e.pendingInvitations)
})
