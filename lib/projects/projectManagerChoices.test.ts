import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignableProjectManagers,
  choiceIdForRoster,
  projectManagerChoiceSelected,
  projectManagerChoices,
  projectManagerIdsWith,
  projectManagerIdsWithout,
  projectManagerSelectedEntries,
  projectManagerSelectionIds,
  stableManagerDocumentId,
} from './projectManagerChoices.ts'

const org = 'org-1'

function account(partial: {
  id: string
  firstName: string
  surname: string
  email: string
  isActive?: boolean
  passwordSet?: boolean
  status?: string
  organizationId?: string
  role?: string
  isSuperAdmin?: boolean
  permissions?: { manager?: boolean; adminAccess?: boolean; operativeMode?: boolean }
}) {
  return {
    isActive: true,
    passwordSet: true,
    organizationId: org,
    permissions: { manager: true, adminAccess: false, operativeMode: false },
    ...partial,
  }
}

const admin = account({
  id: 'admin-id',
  firstName: 'Test',
  surname: 'Admin',
  email: 'admin@raccord.test',
  permissions: { manager: true, adminAccess: true, operativeMode: false },
})
const manager = account({
  id: 'mgr-auth',
  firstName: 'Test',
  surname: 'Manager',
  email: 'manager@raccord.test',
})
const inactive = account({
  id: 'pn-user',
  firstName: 'P',
  surname: 'N',
  email: 'pn@raccord.test',
  isActive: false,
})
const pending = account({
  id: 'pending-id',
  firstName: 'Pat',
  surname: 'Pending',
  email: 'pat@raccord.test',
  passwordSet: false,
  status: 'pending',
})
const operative = account({
  id: 'op-id',
  firstName: 'Olivia',
  surname: 'Operative',
  email: 'olivia@raccord.test',
  permissions: { manager: false, operativeMode: true },
})
const otherOrg = account({
  id: 'other-id',
  firstName: 'Oscar',
  surname: 'Other',
  email: 'oscar@elsewhere.test',
  organizationId: 'org-2',
})

const roster = [
  { id: 'admin-id', firstName: 'Test', lastName: 'Admin', email: 'admin@raccord.test', isActive: true, organizationId: org },
  { id: 'mgr-user', firstName: 'Test', lastName: 'Manager', email: 'manager@raccord.test', isActive: true, organizationId: org },
  { id: 'pn-user', firstName: 'P', lastName: 'N', email: 'pn@raccord.test', isActive: true, organizationId: org },
  { id: 'pending-id', firstName: 'Pat', lastName: 'Pending', email: 'pat@raccord.test', isActive: true, organizationId: org },
  { id: 'op-id', firstName: 'Olivia', lastName: 'Operative', email: 'olivia@raccord.test', isActive: true, organizationId: org },
  { id: 'other-id', firstName: 'Oscar', lastName: 'Other', email: 'oscar@elsewhere.test', isActive: true, organizationId: org },
  { id: 'old-id', firstName: 'Ex', lastName: 'Employee', email: 'ex@raccord.test', isActive: false, organizationId: org },
  { id: 'C24730B1-1D6D-4AB4-BB24-946917F3918D', firstName: 'P', lastName: 'N', email: 'p@ekecteic.con', isActive: true, organizationId: org },
]

const users = [admin, manager, inactive, pending, operative, otherOrg]

test('stable manager ids match iOS for UUID documents and hashed user ids', () => {
  assert.equal(stableManagerDocumentId('a1b2c3d4-e5f6-7890-abcd-ef1234567890'), 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890')
  assert.equal(stableManagerDocumentId('pn-user'), 'DD8C7C5F-2767-5C04-BDD7-CE2F83530CCE')
})

test('the project manager picker omits inactive, pending, operative, and other-org people', () => {
  const labels = projectManagerChoices(roster, users, org).map((choice) => choice.label)
  assert.deepEqual(labels, ['Test Admin', 'Test Manager'])
  assert.equal(assignableProjectManagers(roster, users, org).some((row) => row.email === 'pn@raccord.test'), false)
  assert.equal(assignableProjectManagers(roster, users, org).some((row) => row.email === 'p@ekecteic.con'), false)
})

test('a deactivated assignment is dropped and every other assignment is kept', () => {
  const ids = projectManagerSelectionIds(
    {
      managerId: 'admin-id',
      managerIds: ['admin-id', 'pn-user', stableManagerDocumentId('mgr-user'), 'not-loaded-yet'],
    },
    roster,
    users,
    org
  )
  assert.equal(ids.includes('pn-user'), false)
  assert.equal(ids.includes(choiceIdForRoster('admin-id')), true)
  assert.equal(ids.includes(stableManagerDocumentId('mgr-user')), true)
  assert.equal(ids.includes('not-loaded-yet'), true)
})

// Rulebook 1.30.3 (owner bug 4 Nov): a manager hidden on web, listed on iOS, after repeated Change user type saves.
test('a live manager is offered even when a stale admin invite copy shares their email', () => {
  const live = account({ id: 'sam-live', firstName: 'Sam', surname: 'Lee', email: 'sam@raccord.test' })
  const stale = account({
    id: 'sam-old',
    firstName: 'Sam',
    surname: 'Lee',
    email: 'Sam@raccord.test',
    passwordSet: false,
    role: 'admin',
    permissions: { manager: true, adminAccess: true, operativeMode: false },
  })
  const choices = projectManagerChoices([], [stale, live], org)
  assert.deepEqual(choices.map((choice) => [choice.label, choice.userId, choice.levelLabel]), [['Sam Lee', 'sam-live', 'Manager']])
  assert.equal(choices[0].id, 'user:sam-live')
})

test('the picker badges admins and managers and stores a catalogue row id when there is one', () => {
  const choices = projectManagerChoices(roster, users, org)
  assert.deepEqual(choices.map((choice) => [choice.label, choice.levelLabel, choice.id]), [
    ['Test Admin', 'Admin', choiceIdForRoster('admin-id')],
    ['Test Manager', 'Manager', choiceIdForRoster('mgr-user')],
  ])
})

test('assigned managers who are no longer candidates are shown with a note, then left out on save', () => {
  const demoted = account({
    id: 'dee',
    firstName: 'Dee',
    surname: 'Demoted',
    email: 'dee@raccord.test',
    role: 'operative',
    permissions: { manager: false, adminAccess: false, operativeMode: true },
  })
  const ids = ['admin-id', 'user:dee', 'pn-user', 'not-loaded-yet']
  const entries = projectManagerSelectedEntries(ids, roster, [...users, demoted], org)
  assert.deepEqual(entries.map((entry) => [entry.id, entry.state, entry.note]), [
    ['admin-id', 'current', null],
    ['user:dee', 'former', 'Former manager — no longer a manager'],
    ['pn-user', 'former', 'Former manager — inactive'],
    ['not-loaded-yet', 'unknown', null],
  ])
  assert.deepEqual(projectManagerSelectionIds({ managerIds: ids }, roster, [...users, demoted], org), [
    choiceIdForRoster('admin-id'),
    'not-loaded-yet',
  ])
  const adminChoice = projectManagerChoices(roster, users, org)[0]
  assert.equal(projectManagerChoiceSelected(adminChoice, entries, roster, users, org), true)
})

test('1.42.0 a job takes several managers: each pick is added, the same person twice is not, removing one keeps the rest', () => {
  const [adminChoice, managerChoice] = projectManagerChoices(roster, users, org)
  let ids: string[] = []
  ids = projectManagerIdsWith(ids, adminChoice, roster, users, org)
  ids = projectManagerIdsWith(ids, managerChoice, roster, users, org)
  assert.deepEqual(ids, [adminChoice.id, managerChoice.id])
  assert.deepEqual(projectManagerIdsWith(ids, adminChoice, roster, users, org), ids, 'the same person is never added twice')
  assert.equal(projectManagerSelectedEntries(ids, roster, users, org).length, 2)
  // Edit: an id stored for the same person in another form still counts as picked.
  assert.deepEqual(projectManagerIdsWith(['user:mgr-auth'], managerChoice, roster, users, org), ['user:mgr-auth'])
  assert.deepEqual(projectManagerIdsWithout(ids, adminChoice.id, roster, users, org), [managerChoice.id])
  assert.deepEqual(projectManagerSelectionIds({ managerIds: ids }, roster, users, org), ids)
})
