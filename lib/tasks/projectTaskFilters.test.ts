import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allAssignedOperativeIds, isTaskOverdue } from './projectTaskFilters.ts'
import type { ProjectTask } from '../../types/index.ts'

function task(partial: Partial<ProjectTask> & { id: string; title: string }): ProjectTask {
  return {
    organizationId: 'org',
    projectId: 'job',
    createdBy: 'Ada Lovelace',
    status: 'To Do',
    priority: 'Normal',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...partial,
  }
}

test('isTaskOverdue is exclusive of today and completed', () => {
  const now = new Date('2026-09-20T12:00:00')
  assert.equal(
    isTaskOverdue(task({ id: '1', title: 'A', dueDate: new Date('2026-09-19') }), now),
    true
  )
  assert.equal(
    isTaskOverdue(task({ id: '2', title: 'B', dueDate: new Date('2026-09-20') }), now),
    false
  )
  assert.equal(
    isTaskOverdue(
      task({ id: '3', title: 'C', dueDate: new Date('2026-09-19'), status: 'Completed' }),
      now
    ),
    false
  )
})

test('a legacy single assignee is listed with the list, once', () => {
  assert.deepEqual(allAssignedOperativeIds(task({ id: '1', title: 'A', assignedOperativeIds: ['a'], assignedOperativeId: 'b' })), ['a', 'b'])
  assert.deepEqual(allAssignedOperativeIds(task({ id: '1', title: 'A', assignedOperativeIds: ['a'], assignedOperativeId: 'a' })), ['a'])
})
