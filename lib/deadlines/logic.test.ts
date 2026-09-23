import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyCreatedHistory,
  applyEditHistory,
  completeDeadline,
  daysRemaining,
  emptyDeadlineCopy,
  filterDeadlines,
  groupDeadlines,
  isAtRisk,
  mergeDeadlinesFirstWriterWins,
  pacingGap,
  rescheduleDeadline,
  riskBannerMessage,
  setDeadlineProgress,
  urgency,
  urgencyPhrase,
  urgencyPill,
} from './logic.ts'
import type { Deadline } from './types.ts'

const NOW = new Date('2026-06-11T11:00:00Z')

function item(partial: Partial<Deadline> & Pick<Deadline, 'id' | 'title' | 'due'>): Deadline {
  return {
    location: null,
    trade: null,
    detail: null,
    start: null,
    completedAt: null,
    assignees: [],
    assigneeUserIds: [],
    company: null,
    status: 'notStarted',
    progress: 0,
    isCritical: false,
    dependsOn: [],
    blockedReason: null,
    reminderDaysBefore: 2,
    originalDue: null,
    history: [],
    contextKind: 'Project',
    projectId: 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE',
    createdByUserId: 'user-1',
    fileURL: null,
    fileName: null,
    siteAuditId: null,
    siteAuditTitle: null,
    ...partial,
  }
}

test('urgency phrases match iOS for overdue, today, blocked and later weeks', () => {
  const overdue = item({ id: '1', title: 'Late', due: new Date('2026-06-08T11:00:00Z'), status: 'blocked' })
  assert.equal(daysRemaining(overdue, NOW), -3)
  assert.equal(urgencyPhrase(urgency(overdue, NOW)), '3 days overdue')
  assert.equal(urgencyPill(urgency(overdue, NOW)), '+3d')

  const today = item({ id: '2', title: 'Today', due: new Date('2026-06-11T18:00:00Z') })
  assert.equal(urgencyPhrase(urgency(today, NOW)), 'Due today')

  const held = item({ id: '3', title: 'Held', due: new Date('2026-06-14T11:00:00Z'), status: 'blocked' })
  assert.equal(urgency(held, NOW).kind, 'blocked')
  assert.equal(urgencyPill(urgency(held, NOW)), 'Held')
  assert.equal(isAtRisk(held, NOW), true)

  const heldLater = item({ id: '4', title: 'Held later', due: new Date('2026-06-25T11:00:00Z'), status: 'blocked' })
  assert.equal(isAtRisk(heldLater, NOW), false)

  const far = item({ id: '5', title: 'Far', due: new Date('2026-08-20T11:00:00Z') })
  const farDays = daysRemaining(far, NOW)
  assert.ok(farDays > 60)
  assert.equal(urgencyPhrase(urgency(far, NOW)), `Due in ${Math.floor(farDays / 7)} weeks`)
})

test('pace gap of more than 15 points marks an open deadline at risk', () => {
  const paced = item({
    id: 'p',
    title: '1st fix',
    start: new Date('2026-06-01T00:00:00Z'),
    due: new Date('2026-06-15T00:00:00Z'),
    status: 'inProgress',
    progress: 0.45,
  })
  assert.ok((pacingGap(paced, NOW) ?? 0) > 15)
  assert.equal(isAtRisk(paced, NOW), true)
  assert.equal(daysRemaining(paced, NOW), 4)
})

test('date buckets drop empty groups and keep overdue ahead of this week', () => {
  const rows = [
    item({ id: 'a', title: 'Late', due: new Date('2026-06-08T11:00:00Z'), status: 'inProgress' }),
    item({ id: 'b', title: 'Soon', due: new Date('2026-06-15T11:00:00Z'), status: 'notStarted' }),
    item({ id: 'c', title: 'Done', due: new Date('2026-06-01T11:00:00Z'), status: 'complete' }),
  ]
  const groups = groupDeadlines(rows, 'date', NOW)
  assert.deepEqual(
    groups.map((group) => group.title),
    ['Overdue', 'This week', 'Complete']
  )
  const week = filterDeadlines({ items: rows, filter: 'thisWeek', tradeFilter: 'All trades', search: '', now: NOW })
  assert.deepEqual(week.map((row) => row.id), ['b'])
})

test('reschedule requires a new date and a reason, and keeps the first due date', () => {
  const row = item({ id: 'r', title: 'Sign-off', due: new Date('2026-06-18T11:00:00Z') })
  assert.equal(rescheduleDeadline(row, row.due, 'Weather', 'Ada', NOW), null)
  assert.equal(rescheduleDeadline(row, new Date('2026-06-20T11:00:00Z'), '   ', 'Ada', NOW), null)
  const moved = rescheduleDeadline(row, new Date('2026-06-20T11:00:00Z'), 'Weather', 'Ada', NOW)
  assert.ok(moved)
  assert.equal(moved.originalDue?.toISOString(), row.due.toISOString())
  assert.equal(moved.history[0]?.kind.type, 'rescheduled')
  const again = rescheduleDeadline(moved, new Date('2026-06-22T11:00:00Z'), 'Access', 'Ada', NOW)
  assert.equal(again?.originalDue?.toISOString(), row.due.toISOString())
  assert.equal(again?.history[0]?.kind.type, 'rescheduled')
})

test('progress above zero starts a not-started deadline, and zero does not', () => {
  const row = item({ id: 'g', title: 'Board', due: new Date('2026-06-20T11:00:00Z') })
  const still = setDeadlineProgress(row, 0, 'Ada', NOW)
  assert.equal(still.status, 'notStarted')
  const started = setDeadlineProgress(row, 25, 'Ada', NOW)
  assert.equal(started.status, 'inProgress')
  assert.equal(started.progress, 0.25)
  const done = completeDeadline(started, 'Ada', NOW)
  assert.equal(done.status, 'complete')
  assert.equal(done.progress, 1)
  assert.equal(done.history[0]?.kind.type, 'completed')
})

test('create and edit history record assignment and a newly attached site audit', () => {
  const created = applyCreatedHistory(
    item({
      id: 'n',
      title: 'Handover',
      due: new Date('2026-06-20T11:00:00Z'),
      assignees: ['Ada Lowe'],
      assigneeUserIds: ['u-ada'],
    }),
    'Farnie',
    NOW
  )
  assert.deepEqual(
    created.history.map((row) => row.kind.type),
    ['assigned', 'created']
  )
  const edited = applyEditHistory(
    created,
    {
      ...created,
      siteAuditId: 'BBBBBBBB-BBBB-4CCC-8DDD-EEEEEEEEEEEE',
      siteAuditTitle: 'Weekly audit',
      assignees: ['Ada Lowe', 'Ben Cole'],
      assigneeUserIds: ['u-ada', 'u-ben'],
    },
    'Farnie',
    NOW
  )
  assert.equal(edited.history[0]?.kind.type, 'siteAuditAttached')
  assert.equal(edited.history[1]?.kind.type, 'assigned')
})

test('first writer wins keeps the remote copy and only adds local ids that are missing', () => {
  const remote = item({ id: 'shared', title: 'Remote', due: new Date('2026-06-12T11:00:00Z') })
  const localShared = item({ id: 'shared', title: 'Local', due: new Date('2026-06-12T11:00:00Z') })
  const localNew = item({ id: 'new', title: 'New', due: new Date('2026-06-18T11:00:00Z') })
  const merged = mergeDeadlinesFirstWriterWins([remote], [localShared, localNew])
  assert.deepEqual(
    merged.map((row) => row.title),
    ['Remote', 'New']
  )
})

test('empty copy matches the operative and manager programmes', () => {
  assert.match(emptyDeadlineCopy('all', true, 'Project').message, /first fix, sign-offs, handovers/)
  assert.match(emptyDeadlineCopy('all', false, 'Small Work').message, /assigned to you on this small work/)
  assert.equal(riskBannerMessage({ overdueCount: 2, atRiskCount: 1, criticalOpen: 1 }), '2 overdue, 1 on the critical path')
})
