import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyJobTaskFilter,
  emptyCopyForScope,
  filterTasksForScope,
  isAssignedToUser,
  isTaskOverdue,
  jobTaskFilterDescription,
  taskStatCounts,
} from './projectTaskFilters.ts'
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

test('isAssignedToUser matches operative catalogue id by email', () => {
  const row = task({
    id: '1',
    title: 'Fit board',
    assignedOperativeId: 'OP-1',
  })
  assert.equal(
    isAssignedToUser(row, 'op@example.com', [{ id: 'OP-1', email: 'op@example.com' }], [], true),
    true
  )
  assert.equal(
    isAssignedToUser(row, 'other@example.com', [{ id: 'OP-1', email: 'op@example.com' }], [], true),
    false
  )
})

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

test('empty copy matches iOS job-tile wording', () => {
  assert.equal(emptyCopyForScope('assignedToMe').title, 'Nothing assigned to you')
  assert.equal(emptyCopyForScope('active').title, 'No active tasks')
  assert.equal(emptyCopyForScope('overdue').title, 'No overdue tasks')
  assert.equal(emptyCopyForScope('completed').title, 'No completed tasks')
})

test('scopes and stats follow iOS To do / In progress / Overdue / Done', () => {
  const now = new Date('2026-09-20T12:00:00')
  const tasks = [
    task({ id: '1', title: 'Mine', assignedManagerId: 'MGR-1', status: 'To Do' }),
    task({ id: '2', title: 'Doing', status: 'In Progress', dueDate: new Date('2026-09-18') }),
    task({ id: '3', title: 'Done', status: 'Completed' }),
  ]
  const opts = {
    userEmail: 'mgr@example.com',
    user: { email: 'mgr@example.com', firstName: 'Ada', surname: 'Lovelace' },
    operatives: [],
    managers: [{ id: 'MGR-1', email: 'mgr@example.com' }],
    operativeMode: false,
    now,
  }
  assert.equal(filterTasksForScope(tasks, 'assignedToMe', opts).map((row) => row.id).join(), '1')
  assert.equal(filterTasksForScope(tasks, 'active', opts).length, 2)
  assert.equal(filterTasksForScope(tasks, 'overdue', opts).map((row) => row.id).join(), '2')
  const stats = taskStatCounts(tasks, now)
  assert.equal(stats.todo, 1)
  assert.equal(stats.inProgress, 1)
  assert.equal(stats.overdue, 1)
  assert.equal(stats.done, 1)
})

test('assigned to me excludes completed tasks like iOS', () => {
  const opts = {
    userEmail: 'mgr@example.com',
    user: { email: 'mgr@example.com', firstName: 'Ada', surname: 'Lovelace' },
    operatives: [],
    managers: [{ id: 'MGR-1', email: 'mgr@example.com' }],
    operativeMode: false,
  }
  const tasks = [
    task({ id: 'open', title: 'Open', assignedManagerId: 'MGR-1', status: 'To Do' }),
    task({ id: 'done', title: 'Done', assignedManagerId: 'MGR-1', status: 'Completed' }),
  ]
  assert.deepEqual(
    filterTasksForScope(tasks, 'assignedToMe', opts).map((row) => row.id),
    ['open']
  )
})

test('job task filter matches operative, manager, and date range', () => {
  const tasks = [
    task({
      id: '1',
      title: 'A',
      assignedOperativeId: 'OP-1',
      dueDate: new Date('2026-09-21'),
    }),
    task({
      id: '2',
      title: 'B',
      assignedManagerId: 'MGR-1',
      dueDate: new Date('2026-09-22'),
    }),
  ]
  assert.deepEqual(
    applyJobTaskFilter(tasks, { type: 'operative', operativeId: 'OP-1' }).map((row) => row.id),
    ['1']
  )
  assert.deepEqual(
    applyJobTaskFilter(tasks, { type: 'manager', managerId: 'MGR-1' }).map((row) => row.id),
    ['2']
  )
  assert.deepEqual(
    applyJobTaskFilter(tasks, {
      type: 'dateRange',
      dateStart: new Date('2026-09-21'),
      dateEnd: new Date('2026-09-21'),
    }).map((row) => row.id),
    ['1']
  )
  assert.equal(jobTaskFilterDescription({ type: 'all' }, [], []), 'Showing all tasks')
})

