import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activePeopleForAssignment, peopleForTaskPicker } from './taskAssigneePeople.ts'
import type { Manager, Operative } from '../../types/index.ts'

function manager(partial: Partial<Manager> & { id: string; email: string }): Manager {
  return {
    organizationId: 'ORG',
    firstName: 'Pat',
    lastName: 'Lee',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  }
}

function operative(partial: Partial<Operative> & { id: string; email: string }): Operative {
  return {
    organizationId: 'ORG',
    firstName: 'Pat',
    lastName: 'Lee',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  }
}

test('combined picker shows a manager once, not again as an operative', () => {
  const result = peopleForTaskPicker(
    [manager({ id: 'm1', email: 'pat@site.com', firstName: 'Pat', lastName: 'Lee' })],
    [operative({ id: 'o1', email: 'pat@site.com', firstName: 'Pat', lastName: 'Lee' })],
    'combined'
  )
  assert.equal(result.managers.length, 1)
  assert.equal(result.operatives.length, 0)
})

test('combined picker drops duplicate operative emails and keeps a true operative', () => {
  const result = peopleForTaskPicker(
    [manager({ id: 'm1', email: 'admin@site.com', firstName: 'Ada', lastName: 'Admin' })],
    [
      operative({ id: 'o1', email: 'op@site.com', firstName: 'Ollie', lastName: 'Op' }),
      operative({ id: 'o2', email: 'op@site.com', firstName: 'Ollie', lastName: 'Op' }),
      operative({ id: 'o3', email: 'admin@site.com', firstName: 'Ada', lastName: 'Admin' }),
    ],
    'combined'
  )
  assert.equal(result.managers.map((row) => row.email).join(','), 'admin@site.com')
  assert.equal(result.operatives.length, 1)
  assert.equal(result.operatives[0].email, 'op@site.com')
})

test('an anonymised Deleted user is not a task assignee', () => {
  const deletedOp = operative({ id: 'OP-DEL', email: '', firstName: 'Deleted', lastName: 'user' })
  const liveOp = operative({ id: 'OP-LIVE', email: 'op@site.com', firstName: 'Ollie', lastName: 'Op' })
  const deletedMgr = manager({ id: 'M-DEL', email: '', firstName: 'Deleted', lastName: 'user' })
  const picker = peopleForTaskPicker([deletedMgr], [deletedOp, liveOp], 'combined')
  assert.equal(picker.managers.length, 0)
  assert.equal(picker.operatives.map((row) => row.id).join(','), 'OP-LIVE')
  assert.deepEqual(
    activePeopleForAssignment([deletedOp, liveOp]).map((row) => row.id),
    ['OP-LIVE']
  )
})
