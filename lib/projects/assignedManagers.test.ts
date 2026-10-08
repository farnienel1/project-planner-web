import assert from 'node:assert/strict'
import test from 'node:test'
import { assignedManagerLabel, assignedManagerNames } from './assignedManagers.ts'
import { stableManagerDocumentId } from './projectManagerChoices.ts'

const roster = [
  { id: 'mgr-1', firstName: 'Ada', lastName: 'North' },
  { id: 'mgr-2', firstName: 'Ben', lastName: 'South' },
]

test('project details list every assigned manager, not only the legacy name', () => {
  const names = assignedManagerNames(
    { managerId: 'mgr-1', managerIds: ['mgr-1', 'mgr-2'], manager: { name: 'Ada North', email: '' } },
    roster
  )
  assert.deepEqual(names, ['Ada North', 'Ben South'])
  assert.equal(
    assignedManagerLabel({ managerId: 'mgr-1', managerIds: ['mgr-1', 'mgr-2'], manager: { name: 'Custom', email: '' } }, roster),
    'Ada North, Ben South'
  )
})

test('a roster id still shows when the stored manager name was never set', () => {
  assert.deepEqual(
    assignedManagerNames({ managerId: 'mgr-2', managerIds: ['mgr-2'], manager: { name: 'Custom', email: '' } }, roster),
    ['Ben South']
  )
  assert.deepEqual(assignedManagerNames({ manager: { name: '', email: '' } }, roster), [])
  assert.deepEqual(assignedManagerNames({ manager: { name: 'Project Manager', email: '' } }, roster), [])
})

test('an inactive catalogue manager is not shown, and the other assigned managers still are', () => {
  const inactiveId = 'pn-user'
  const names = assignedManagerNames(
    {
      managerId: 'admin-id',
      managerIds: ['admin-id', inactiveId, 'mgr-user'],
      manager: { name: 'P N', email: '' },
    },
    [
      { id: 'admin-id', firstName: 'Test', lastName: 'Admin', email: 'admin@raccord.test', isActive: true },
      { id: inactiveId, firstName: 'P', lastName: 'N', email: 'pn@raccord.test', isActive: true },
      { id: 'mgr-user', firstName: 'Test', lastName: 'Manager', email: 'manager@raccord.test', isActive: true },
    ],
    [
      {
        id: 'admin-id',
        firstName: 'Test',
        surname: 'Admin',
        email: 'admin@raccord.test',
        isActive: true,
        passwordSet: true,
        organizationId: 'org-1',
        permissions: { adminAccess: true, manager: true, operativeMode: false },
      },
      {
        id: inactiveId,
        firstName: 'P',
        surname: 'N',
        email: 'pn@raccord.test',
        isActive: false,
        passwordSet: true,
        organizationId: 'org-1',
        permissions: { manager: true, operativeMode: false },
      },
      {
        id: 'mgr-auth',
        firstName: 'Test',
        surname: 'Manager',
        email: 'manager@raccord.test',
        isActive: true,
        passwordSet: true,
        organizationId: 'org-1',
        permissions: { manager: true, operativeMode: false },
      },
    ],
    'org-1'
  )
  assert.deepEqual(names, ['Test Admin', 'Test Manager'])
})

test('a manager saved under the iOS document hash still shows beside the other manager', () => {
  const names = assignedManagerNames(
    {
      managerId: 'ADMIN-ID',
      managerIds: ['ADMIN-ID', stableManagerDocumentId('mgr-user')],
      manager: { name: 'Test Admin', email: '' },
    },
    [
      { id: 'admin-id', firstName: 'Test', lastName: 'Admin', email: 'admin@raccord.test', isActive: true },
      { id: 'mgr-user', firstName: 'Test', lastName: 'Manager', email: 'manager@raccord.test', isActive: true },
    ],
    [
      {
        id: 'mgr-auth',
        firstName: 'Test',
        surname: 'Manager',
        email: 'manager@raccord.test',
        isActive: true,
        passwordSet: true,
        permissions: { manager: true },
      },
    ]
  )
  assert.deepEqual(names, ['Test Admin', 'Test Manager'])
})

test('both managers show when one id differs by case or was saved as a user account', () => {
  const adaId = 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890'
  assert.deepEqual(
    assignedManagerNames(
      {
        managerId: adaId.toLowerCase().replace(/-/g, ''),
        managerIds: [adaId.toLowerCase().replace(/-/g, ''), 'user:acct-2'],
        manager: { name: 'Ada North', email: '' },
      },
      [{ id: adaId, firstName: 'Ada', lastName: 'North' }],
      [{ id: 'acct-2', firstName: 'Ben', surname: 'South', email: 'ben@example.com' }]
    ),
    ['Ada North', 'Ben South']
  )
})
