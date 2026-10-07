import assert from 'node:assert/strict'
import test from 'node:test'
import { isPendingPerson, withoutPendingPeople } from './pendingPeople.ts'

test('a pending invitation stays out of operational people lists', () => {
  const pendingMembership = { id: 'morgan', status: 'pending', passwordSet: true }
  const pendingSignup = { id: 'test-user', passwordSet: false }
  const active = { id: 'ada', status: 'active', passwordSet: true }
  assert.equal(isPendingPerson(pendingMembership), true)
  assert.equal(isPendingPerson(pendingSignup), true)
  assert.equal(isPendingPerson(active), false)
  assert.deepEqual(
    withoutPendingPeople([pendingMembership, pendingSignup, active]).map((person) => person.id),
    ['ada']
  )
})
