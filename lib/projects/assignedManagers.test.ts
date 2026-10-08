import assert from 'node:assert/strict'
import test from 'node:test'
import { assignedManagerLabel, assignedManagerNames } from './assignedManagers.ts'

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
