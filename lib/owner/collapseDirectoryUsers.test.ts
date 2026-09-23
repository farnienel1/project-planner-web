import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collapseDirectoryUsers } from './collapseDirectoryUsers.ts'
import type { User } from '../../types/index.ts'

function stub(partial: Partial<User> & Pick<User, 'id' | 'email'>): User {
  return {
    firstName: 'A',
    surname: 'B',
    organizationId: 'ORG',
    role: 'manager',
    isActive: true,
    passwordSet: false,
    isSuperAdmin: false,
    permissions: {} as User['permissions'],
    createdAt: new Date(0),
    updatedAt: new Date(0),
    policyAccepted: true,
    ...partial,
  } as User
}

test('keeps the signed-in account and hides the leftover invite placeholder', () => {
  const live = stub({
    id: 'firebaseAuthUid123456789012',
    email: 'farn@raccordmep.co.uk',
    firstName: 'Test',
    surname: 'Manager',
    passwordSet: true,
    lastSeenAt: new Date('2026-09-21T13:54:00Z'),
  })
  const leftover = stub({
    id: 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE',
    email: 'farn@raccordmep.co.uk',
    firstName: 'Manager',
    surname: 'Tester',
  })
  const result = collapseDirectoryUsers([leftover, live])
  assert.equal(result.users.length, 1)
  assert.equal(result.users[0].id, live.id)
  assert.equal(result.hiddenLeftovers[0].id, leftover.id)
})
