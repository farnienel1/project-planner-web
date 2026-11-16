import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changeEmailOrganizations, claimBelongsToSomeoneElse, oldClaimIsTheirs, rosterRowsOnEmail } from './changeEmailPlan.ts'

test('scan 16 Nov: claims move in the home company (id, path or reference id) and every membership', () => {
  assert.deepEqual(changeEmailOrganizations('org-a', ['org-b', 'org-a']), ['org-a', 'org-b'])
  assert.deepEqual(changeEmailOrganizations('organizations/org-a', ['org-c']), ['org-a', 'org-c'])
  assert.deepEqual(changeEmailOrganizations(null, ['org-c']), ['org-c'])
  assert.deepEqual(changeEmailOrganizations('', ['bad/id', 'org-d']), ['org-d'])
})

test('a new-email claim naming someone else refuses the change; empty or own claims do not', () => {
  assert.equal(claimBelongsToSomeoneElse('placeholder-id', 'uid-1'), true)
  assert.equal(claimBelongsToSomeoneElse('uid-1', 'uid-1'), false)
  assert.equal(claimBelongsToSomeoneElse('', 'uid-1'), false)
  assert.equal(claimBelongsToSomeoneElse(null, 'uid-1'), false)
})

test('the old claim is deleted only where it names this person', () => {
  assert.equal(oldClaimIsTheirs('uid-1', 'uid-1'), true)
  assert.equal(oldClaimIsTheirs('someone', 'uid-1'), false)
  assert.equal(oldClaimIsTheirs('', 'uid-1'), false)
})

test('roster rows on the old email match without case', () => {
  const rows = [{ id: 'a', email: 'Old@X.com' }, { id: 'b', email: 'old@x.com' }, { id: 'c', email: 'new@x.com' }, { id: 'd', email: '' }]
  assert.deepEqual(rosterRowsOnEmail(rows, 'old@x.com').map((row) => row.id), ['a', 'b'])
  assert.deepEqual(rosterRowsOnEmail(rows, ''), [])
})
