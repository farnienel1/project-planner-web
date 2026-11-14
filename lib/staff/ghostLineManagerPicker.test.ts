/**
 * Add user → Ghost account: every line manager the picker offers must pass the ghost save check.
 * The picker is `lineManagerCandidates(inviteDraft, lineManagerPickerRoster(users))` (AddUserScreen); the save check is `ghostCreateError`
 * with the roster `lineManagerPickerRoster(users)` gives (AddUserScreen and `createGhostOperative`). Both read the same
 * users rows, so the lists cannot disagree.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { User } from '../../types/index.ts'
import {
  ghostCreateError,
  inviteDraftLineManagerSubject,
  lineManagerCandidates,
  GHOST_LINE_MANAGER_INVALID_MESSAGE,
} from '../canonical/index.ts'
import { lineManagerPickerRoster, rulebookRoster } from './rulebookPeople.ts'

function user(id: string, fields: Partial<User> & { permissions?: Record<string, boolean> }): User {
  return {
    id,
    email: `${id}@example.com`,
    firstName: id,
    surname: 'Test',
    isActive: true,
    passwordSet: true,
    organizationId: 'org-1',
    ...fields,
    permissions: { ...(fields.permissions ?? {}) },
  } as unknown as User
}

const users: User[] = [
  // The organisation's Super Admin (creator), flag stored.
  user('super-1', { isSuperAdmin: true, role: 'admin', permissions: { adminAccess: true } } as never),
  // A manager with two users documents on one email (left by Change user type saves).
  user('mgr-a', { email: 'sam@example.com', role: 'manager', permissions: { manager: true } } as never),
  user('MGR-B', { email: 'Sam@Example.com', role: 'manager', permissions: { manager: true } } as never),
  // A manager whose account still lists a former invite id.
  user('mgr-c', { role: 'manager', permissions: { manager: true }, formerUserIds: ['invite-c'] } as never),
  // A legacy manager with no level flag and no manager role (rulebook 1.23.1: reads as manager level).
  user('mgr-flagless', { role: 'member' } as never),
  // An operative: never a candidate.
  user('op-1', { role: 'operative', permissions: { operativeMode: true } } as never),
]

const draft = (lineManagerIds: string[]) => ({
  firstName: 'Ghost',
  surname: 'Person',
  dayRate: 150,
  payBasis: 'day' as const,
  lineManagerIds,
})

const offered = lineManagerCandidates(
  inviteDraftLineManagerSubject({ email: '', level: 'operative' }),
  lineManagerPickerRoster(users) as never
)

test('the picker offers the Super Admin, both managers once, and the flagless legacy manager', () => {
  const ids = offered.map((row) => row.id).sort()
  assert.deepEqual(ids, ['mgr-a', 'mgr-c', 'mgr-flagless', 'super-1'])
})

test('every id the picker offers passes ghostCreateError with the roster the save uses', () => {
  const roster = lineManagerPickerRoster(users)
  for (const candidate of offered) {
    assert.equal(ghostCreateError(draft([candidate.id]), { roster: roster as never }), null, candidate.id)
  }
})

test('regression: the folded rulebookRoster refused the flagless legacy manager the picker offered', () => {
  // `rulebookPerson` turns `role` into the `staffAccountRole` object, whose `isManager` needs the manager flag or role;
  // `levelOf` reads that object as operative, while the picker (raw users, `permissionLevelOf`) reads manager.
  assert.equal(
    ghostCreateError(draft(['mgr-flagless']), { roster: rulebookRoster(users) as never }),
    GHOST_LINE_MANAGER_INVALID_MESSAGE
  )
})

test('an operative or an unknown id is still refused', () => {
  const roster = lineManagerPickerRoster(users)
  assert.equal(ghostCreateError(draft(['op-1']), { roster: roster as never }), GHOST_LINE_MANAGER_INVALID_MESSAGE)
  assert.equal(ghostCreateError(draft(['nobody']), { roster: roster as never }), GHOST_LINE_MANAGER_INVALID_MESSAGE)
})
