import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignableProjectManagers,
  choiceIdForRoster,
  projectManagerChoices,
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
