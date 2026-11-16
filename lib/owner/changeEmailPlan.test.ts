import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  changeEmailOrganizations,
  claimBelongsToSomeoneElse,
  claimMoves,
  oldClaimIsTheirs,
  readMembershipIds,
  rosterRowsOnEmail,
} from './changeEmailPlan.ts'

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

test('review H1: the membership list is read with the server key; a refused list falls back to the home company', async () => {
  const refused = async (): Promise<string[]> => {
    throw new Error('Missing or insufficient permissions')
  }
  assert.deepEqual(await readMembershipIds([async () => ['org-b'], refused]), { ids: ['org-b'], complete: true })
  assert.deepEqual(await readMembershipIds([refused, async () => ['org-c']]), { ids: ['org-c'], complete: true })
  const none = await readMembershipIds([refused, refused])
  assert.deepEqual(none, { ids: [], complete: false })
  assert.deepEqual(changeEmailOrganizations('org-home', none.ids), ['org-home'])
})

test('review M1: the new claim is written only in the home company and where the old claim names this person', () => {
  const moves = claimMoves({
    uid: 'u1',
    homeOrgId: 'home',
    claims: [
      { orgId: 'home', oldOwner: null, newOwner: null },
      { orgId: 'mine', oldOwner: 'u1', newOwner: null },
      { orgId: 'placeholder', oldOwner: 'invite-placeholder', newOwner: null },
      { orgId: 'no-claim', oldOwner: null, newOwner: null },
    ],
  })
  assert.deepEqual(moves, { refuse: false, writes: ['home', 'mine'], deletes: ['mine'] })
})

test('review M1: a taken new claim refuses only where it would be written', () => {
  assert.equal(
    claimMoves({ uid: 'u1', homeOrgId: 'home', claims: [{ orgId: 'home', oldOwner: 'u1', newOwner: 'someone' }] }).refuse,
    true
  )
  assert.equal(
    claimMoves({ uid: 'u1', homeOrgId: 'home', claims: [{ orgId: 'other', oldOwner: null, newOwner: 'someone' }] }).refuse,
    false
  )
})
