import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldScopeScheduleToOperative } from './scheduleNavigation.ts'
import type { Operative, User } from '../../types/index.ts'

const viewer = (over: Partial<User> = {}): User =>
  ({
    id: 'u-ada',
    email: 'ada@example.com',
    firstName: 'Ada',
    surname: 'Site',
    formerUserIds: ['INVITE-OLD'],
    permissions: { manager: true },
    ...over,
  }) as unknown as User

const rows = [
  { id: 'op-ada-1', email: 'ada@example.com' },
  { id: 'op-ada-2', email: 'Ada@Example.com' },
  { id: 'op-bob', email: 'bob@example.com' },
] as Operative[]

test('1.36.0 FU-5: a booking filed under any of the viewer\'s ids is their own (not scoped)', () => {
  // Before 1.36.0 only one catalogue row on the email counted, with letter case.
  for (const id of ['op-ada-1', 'op-ada-2', 'OP-ADA-2', 'u-ada', 'U-ADA', 'invite-old']) {
    assert.equal(shouldScopeScheduleToOperative(viewer(), id, rows), false, id)
  }
})

test('1.36.0 FU-5: someone else\'s booking is scoped for every viewer', () => {
  assert.equal(shouldScopeScheduleToOperative(viewer(), 'op-bob', rows), true)
  assert.equal(shouldScopeScheduleToOperative(viewer({ permissions: {} as User['permissions'] }), 'op-bob', rows), true)
  assert.equal(shouldScopeScheduleToOperative(null, 'op-bob', rows), true)
})
