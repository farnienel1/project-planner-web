/**
 * Add user → Ghost account: every line manager the picker offers must pass the ghost save check.
 * The picker reads the stored users rows (`lineManagerCandidates(inviteDraft, users)`, AddUserScreen); the save check
 * reads `rulebookRoster(users)` (`createGhostOperative`), whose `role` is the `staffAccountRole` object. Rulebook 1.44.0
 * (`levelOf` = `permissionLevelOf` for every role shape) makes both read a flagless legacy manager as manager level.
 * Ported from draft PR #320, whose web-only workaround (`lineManagerPickerRoster`) this canonical fix replaces.
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
import { rulebookRoster } from './rulebookPeople.ts'

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
  user('super-1', { isSuperAdmin: true, role: 'admin', permissions: { adminAccess: true } } as never),
  user('mgr-a', { email: 'sam@example.com', role: 'manager', permissions: { manager: true } } as never),
  user('MGR-B', { email: 'Sam@Example.com', role: 'manager', permissions: { manager: true } } as never),
  user('mgr-c', { role: 'manager', permissions: { manager: true }, formerUserIds: ['invite-c'] } as never),
  // A legacy manager with no level flag and no manager role (rulebook 1.23.1: reads as manager level).
  user('mgr-flagless', { role: 'member' } as never),
  user('op-1', { role: 'operative', permissions: { operativeMode: true } } as never),
]

const draft = (lineManagerIds: string[]) => ({
  firstName: 'Ghost',
  surname: 'Person',
  dayRate: 150,
  payBasis: 'day' as const,
  lineManagerIds,
})

const subject = inviteDraftLineManagerSubject({ email: '', level: 'operative' })

test('the picker offers the Super Admin, both managers once, and the flagless legacy manager — from either roster shape', () => {
  const fromUsers = lineManagerCandidates(subject, users as never).map((row) => row.id).sort()
  const fromRulebook = lineManagerCandidates(subject, rulebookRoster(users) as never).map((row) => row.id).sort()
  assert.deepEqual(fromUsers, ['mgr-a', 'mgr-c', 'mgr-flagless', 'super-1'])
  assert.deepEqual(fromRulebook, fromUsers)
})

test('every id the picker offers passes ghostCreateError with the roster the save uses (rulebookRoster)', () => {
  const roster = rulebookRoster(users)
  for (const candidate of lineManagerCandidates(subject, users as never)) {
    assert.equal(ghostCreateError(draft([candidate.id]), { roster: roster as never }), null, candidate.id)
  }
})

test('an operative or an unknown id is still refused', () => {
  const roster = rulebookRoster(users)
  assert.equal(ghostCreateError(draft(['op-1']), { roster: roster as never }), GHOST_LINE_MANAGER_INVALID_MESSAGE)
  assert.equal(ghostCreateError(draft(['nobody']), { roster: roster as never }), GHOST_LINE_MANAGER_INVALID_MESSAGE)
})
