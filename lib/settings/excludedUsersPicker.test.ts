import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EXCLUDED_REMOVED_USER_LABEL,
  excludedCurrentPeopleCount,
  excludedIdsAfterToggle,
  excludedUsersPickerRows,
  filterExcludedUsersPickerRows,
} from './excludedUsersPicker.ts'
import { UserRole, type User, type UserPermissions } from '../../types/index.ts'

const permissions = {
  adminAccess: false,
  manager: false,
  operatives: false,
  skills: false,
  qualifications: false,
  materials: true,
  projects: false,
  smallWorks: false,
  operativeMode: true,
  siteAudit: true,
  subContractors: false,
  wholesalersOrderHistory: false,
} as UserPermissions

function user(partial: Partial<User> & Pick<User, 'id' | 'email' | 'firstName'>): User {
  return {
    surname: 'Test',
    organizationId: 'org',
    role: UserRole.OPERATIVE,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-06-01'),
    permissions,
    ...partial,
  }
}

const ada = user({ id: 'u-ada', email: 'ada@site.com', firstName: 'Ada' })
const bob = user({ id: 'u-bob', email: 'bob@site.com', firstName: 'Bob' })
// A pending invite (has not finished sign-up) — the owner's bug: it was listed while active.
const pending = user({ id: 'u-pending', email: 'pat@site.com', firstName: 'Pat', passwordSet: false })
const inactive = user({ id: 'u-ina', email: 'ina@site.com', firstName: 'Ina', isActive: false })
const deleted = user({ id: 'u-del', email: '', firstName: 'Deleted', surname: 'user' })

test('the picker lists only current people (no pending invites, inactive or deleted profiles)', () => {
  const rows = excludedUsersPickerRows({
    users: [ada, bob, pending, inactive, deleted],
    claimedEmails: ['pat@site.com'],
    excludedIds: [],
  })
  assert.deepEqual(
    rows.map((row) => [row.kind, row.title]),
    [
      ['person', 'Ada Test'],
      ['person', 'Bob Test'],
    ]
  )
})

test('a stored id that names nobody current reads "Removed user" and can be unticked', () => {
  const excludedIds = ['u-bob', 'gone-id']
  const rows = excludedUsersPickerRows({ users: [ada, bob], excludedIds })
  const removed = rows.find((row) => row.kind === 'stored')
  assert.ok(removed)
  assert.equal(removed.title, EXCLUDED_REMOVED_USER_LABEL)
  assert.equal(removed.excluded, true)
  // The badge counts only current people.
  assert.equal(excludedCurrentPeopleCount(rows), 1)
  // Unticking removes only that id; nothing else changes.
  assert.deepEqual(excludedIdsAfterToggle(excludedIds, removed), ['u-bob'])
})

test('a stored id of a pending or inactive person keeps their name with the status', () => {
  const rows = excludedUsersPickerRows({
    users: [ada, pending, inactive, deleted],
    claimedEmails: ['pat@site.com'],
    excludedIds: ['u-pending', 'U-INA', 'u-del'],
  })
  const stored = rows.filter((row) => row.kind === 'stored').map((row) => [row.title, row.subtitle])
  assert.deepEqual(stored, [
    ['Pat Test', 'Pending'],
    ['Ina Test', 'Inactive'],
    [EXCLUDED_REMOVED_USER_LABEL, 'No longer in this organisation'],
  ])
})

test('a person is excluded under any id they go by, without case', () => {
  const withFormer = { ...ada, formerUserIds: ['old-invite'] }
  const rows = excludedUsersPickerRows({ users: [withFormer], excludedIds: ['OLD-INVITE'] })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].kind, 'person')
  assert.equal(rows[0].excluded, true)
  assert.deepEqual(excludedIdsAfterToggle(['OLD-INVITE', 'x'], rows[0]), ['x'])
  assert.deepEqual(excludedIdsAfterToggle([], rows[0]), ['u-ada'])
})

test('search matches name or email', () => {
  const rows = excludedUsersPickerRows({ users: [ada, bob], excludedIds: [] })
  assert.deepEqual(
    filterExcludedUsersPickerRows(rows, 'BOB@').map((row) => row.primaryId),
    ['u-bob']
  )
})
