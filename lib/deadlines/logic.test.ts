import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyCreatedHistory,
  applyEditHistory,
  completeDeadline,
  daysRemaining,
  deadlineView,
  emptyDeadlineCopy,
  filterDeadlines,
  groupDeadlines,
  historyLine,
  mergeDeadlinesFirstWriterWins,
  scopedDeadlines,
  timelineItems,
  rescheduleDeadline,
  setDeadlineProgress,
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

test('1.94.0: a deadline reads through deadlineDisplay (overdue, today, blocked, far)', () => {
  const overdue = item({ id: '1', title: 'Late', due: new Date('2026-06-08T11:00:00Z'), status: 'blocked' })
  assert.equal(daysRemaining(overdue, NOW), -3)
  assert.equal(deadlineView(overdue, NOW).dueText, '3 days overdue')
  assert.equal(deadlineView(overdue, NOW).pill, '+3d')
  assert.equal(deadlineView(overdue, NOW).tone, 'red')

  const today = item({ id: '2', title: 'Today', due: new Date('2026-06-11T18:00:00Z') })
  assert.equal(deadlineView(today, NOW).dueText, 'Due today')

  const held = item({ id: '3', title: 'Held', due: new Date('2026-06-14T11:00:00Z'), status: 'blocked' })
  assert.equal(deadlineView(held, NOW).status, 'blocked')
  assert.equal(deadlineView(held, NOW).group, 'thisWeek')

  const far = item({ id: '5', title: 'Far', due: new Date('2026-08-20T11:00:00Z') })
  assert.equal(deadlineView(far, NOW).group, 'later')
  assert.equal(deadlineView(far, NOW).tone, 'primary')
})

test('1.94.0: behind pace is more than 10 points below the straight line, with the expected figure', () => {
  const paced = item({
    id: 'p',
    title: '1st fix',
    start: new Date('2026-06-01T00:00:00Z'),
    due: new Date('2026-06-15T00:00:00Z'),
    status: 'inProgress',
    progress: 0.45,
  })
  const view = deadlineView(paced, NOW)
  assert.equal(view.status, 'behindPace')
  assert.equal(view.expectedPercent, 71)
  assert.equal(view.paceText, '45% · expected 71%')
  assert.ok(view.tabs.includes('behindPace'))
})

test('1.94.0: date groups follow DEADLINE_GROUPS and drop empty ones', () => {
  const rows = [
    item({ id: 'a', title: 'Late', due: new Date('2026-06-08T11:00:00Z'), status: 'inProgress' }),
    item({ id: 'b', title: 'Soon', due: new Date('2026-06-13T11:00:00Z'), status: 'notStarted' }),
    item({ id: 'c', title: 'Done', due: new Date('2026-06-01T11:00:00Z'), status: 'complete' }),
  ]
  const groups = groupDeadlines(rows, 'date', NOW)
  assert.deepEqual(
    groups.map((group) => group.title),
    ['Overdue', 'This week', 'Completed']
  )
  const week = filterDeadlines({ items: rows, tab: 'thisWeek', tradeFilter: 'All trades', search: '', now: NOW })
  assert.deepEqual(week.map((row) => row.id), ['b'])
})

test('1.94.0: a reschedule history line says "1 day", never "1 days"', () => {
  const line = historyLine({
    id: 'h',
    at: NOW,
    author: 'Sam',
    kind: { type: 'rescheduled', from: new Date('2026-11-27T12:00:00Z'), to: new Date('2026-11-28T12:00:00Z'), reason: 'Preceding trade' },
  })
  assert.equal(line, 'Moved 1 day from 27 Nov → 28 Nov · Preceding trade')
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
})


test('owner 25 Nov: All lists every deadline, past, this week, future and completed', () => {
  const rows = [
    item({ id: 'past', title: 'Past', due: new Date('2026-05-01T09:00:00Z') }),
    item({ id: 'week', title: 'Week', due: new Date('2026-06-13T09:00:00Z') }),
    item({ id: 'later', title: 'Later', due: new Date('2026-09-01T09:00:00Z') }),
    item({ id: 'done', title: 'Done', due: new Date('2026-06-12T09:00:00Z'), status: 'complete' }),
  ]
  const all = filterDeadlines({ items: rows, tab: 'all', tradeFilter: 'All trades', search: '', now: NOW })
  assert.deepEqual(all.map((row) => row.id).sort(), ['done', 'later', 'past', 'week'])
  const listed = groupDeadlines(all, 'date', NOW).flatMap((group) => group.items.map((row) => row.id))
  assert.deepEqual(listed.sort(), ['done', 'later', 'past', 'week'])
  const week = filterDeadlines({ items: rows, tab: 'thisWeek', tradeFilter: 'All trades', search: '', now: NOW })
  assert.deepEqual(week.map((row) => row.id), ['week'])
  const complete = filterDeadlines({ items: rows, tab: 'completed', tradeFilter: 'All trades', search: '', now: NOW })
  assert.deepEqual(complete.map((row) => row.id), ['done'])
})

test('owner 25 Nov: the timeline keeps completed deadlines the filter keeps', () => {
  const rows = [
    item({ id: 'open', title: 'Open', due: new Date('2026-06-20T09:00:00Z') }),
    item({ id: 'done', title: 'Done', due: new Date('2026-06-12T09:00:00Z'), status: 'complete' }),
  ]
  assert.deepEqual(timelineItems(rows).map((row) => row.id), ['done', 'open'])
})

test('1.93.0: a deadline on several floors is listed once under Multiple floors and found by any', () => {
  const rows = [
    item({ id: 'f', title: 'First fix', due: new Date('2026-06-20T09:00:00Z'), location: 'Ground Floor', locations: ['Ground Floor', '2nd Floor'] }),
    item({ id: 'g', title: 'Second fix', due: new Date('2026-06-20T09:00:00Z'), location: 'Ground Floor', locations: ['Ground Floor'] }),
  ]
  const groups = groupDeadlines(rows, 'location', NOW)
  assert.deepEqual(groups.map((group) => [group.title, group.items.map((row) => row.id)]).sort(), [['Ground Floor', ['g']], ['Multiple floors', ['f']]])
  const found = filterDeadlines({ items: rows, tab: 'all', tradeFilter: 'All trades', search: '2nd floor', now: NOW })
  assert.equal(found.length, 1)
})

test('owner 25 Nov: a person sees deadlines under every id they go by, without case', () => {
  const rows = [
    item({ id: 'a', title: 'A', due: NOW, assigneeUserIds: ['GHOST-1'] }),
    item({ id: 'b', title: 'B', due: NOW, assigneeUserIds: ['other'] }),
  ]
  assert.deepEqual(scopedDeadlines(rows, ['user-1', 'ghost-1']).map((row) => row.id), ['a'])
  assert.equal(scopedDeadlines(rows, null).length, 2)
})

test('owner 25 Nov: the save keeps the person own edit when the stored list moved on', () => {
  const remote = item({ id: 'x', title: 'Old', due: NOW })
  const local = item({ id: 'x', title: 'New', due: NOW, fileURL: 'https://example.test/f' })
  assert.equal(mergeDeadlinesFirstWriterWins([remote], [local])[0].title, 'Old')
  const kept = mergeDeadlinesFirstWriterWins([remote], [local], ['x'])[0]
  assert.equal(kept.title, 'New')
  assert.equal(kept.fileURL, 'https://example.test/f')
})
