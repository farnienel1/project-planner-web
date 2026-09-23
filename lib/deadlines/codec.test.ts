import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Timestamp } from 'firebase/firestore'
import { parseDeadline, serializeDeadline } from './codec.ts'
import type { Deadline } from './types.ts'

test('deadline codec writes empty strings and nulls, and reads them back', () => {
  const item: Deadline = {
    id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    title: '3rd Floor WC 1st Fix',
    location: null,
    trade: 'Plumbing & Gas',
    detail: '',
    start: null,
    due: new Date('2026-06-20T11:00:00Z'),
    completedAt: null,
    assignees: ['Ada Lowe'],
    assigneeUserIds: ['user-ada'],
    company: null,
    status: 'inProgress',
    progress: 0.45,
    isCritical: true,
    dependsOn: [],
    blockedReason: null,
    reminderDaysBefore: null,
    originalDue: null,
    history: [
      {
        id: 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        at: new Date('2026-06-11T11:00:00Z'),
        author: 'Farnie',
        kind: { type: 'created', due: new Date('2026-06-20T11:00:00Z') },
      },
    ],
    contextKind: 'Small Work',
    projectId: 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    createdByUserId: 'user-1',
    fileURL: null,
    fileName: null,
    siteAuditId: null,
    siteAuditTitle: null,
  }
  const map = serializeDeadline(item)
  assert.equal(map.location, '')
  assert.equal(map.detail, '')
  assert.equal(map.company, '')
  assert.equal(map.blockedReason, '')
  assert.equal(map.fileURL, '')
  assert.equal(map.siteAuditId, '')
  assert.equal(map.reminderDaysBefore, null)
  assert.equal(map.start, null)
  assert.equal(map.id, 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE')
  assert.ok(map.due instanceof Timestamp)
  assert.equal((map.history as Record<string, unknown>[])[0]?.type, 'created')

  const parsed = parseDeadline(map, item.projectId)
  assert.ok(parsed)
  assert.equal(parsed.location, null)
  assert.equal(parsed.reminderDaysBefore, null)
  assert.equal(parsed.trade, 'Plumbing & Gas')
  assert.equal(parsed.progress, 0.45)
  assert.equal(parsed.history[0]?.kind.type, 'created')
  assert.equal(parsed.contextKind, 'Small Work')
  assert.equal(parsed.id, 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE')
})

test('a deadline without a uuid id is dropped', () => {
  assert.equal(parseDeadline({ title: 'Nope' }, 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE'), null)
})
