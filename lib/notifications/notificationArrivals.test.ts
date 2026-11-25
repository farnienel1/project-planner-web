import assert from 'node:assert/strict'
import test from 'node:test'
import { notificationArrivals, withArrivals, NOTIFICATION_TOAST_MAX } from './notificationArrivals'

const since = Date.parse('2026-11-25T09:00:00Z')
const now = since + 60_000
const row = (id: string, createdOffsetMs: number, extra: Record<string, unknown> = {}) => ({
  id,
  userId: 'u1',
  createdAt: new Date(since + createdOffsetMs),
  isRead: false,
  type: 'task_created',
  ...extra,
})

test('only rows created after the page started listening pop up (first load and reconnect stay quiet)', () => {
  const rows = [row('old', -5_000), row('edge', 0), row('new', 1_000)]
  const out = notificationArrivals({ rows, seenIds: new Set(), sinceMs: since, ownerIds: ['u1'], nowMs: now })
  assert.deepEqual(out.map((r) => r.id), ['new'])
})

test('a row already seen, already read, or not addressed to the person never pops up', () => {
  const rows = [row('seen', 1_000), row('read', 2_000, { isRead: true }), row('other', 3_000, { userId: 'u2' }), row('ok', 4_000)]
  const out = notificationArrivals({ rows, seenIds: new Set(['seen']), sinceMs: since, ownerIds: ['u1'], nowMs: now })
  assert.deepEqual(out.map((r) => r.id), ['ok'])
})

test('a former id of the person counts (inboxNotificationVisibleToUser), and arrivals are oldest first', () => {
  const rows = [row('b', 3_000), row('a', 2_000, { userId: 'old-id' })]
  const out = notificationArrivals({ rows, seenIds: new Set(), sinceMs: since, ownerIds: ['u1', 'old-id'], nowMs: now })
  assert.deepEqual(out.map((r) => r.id), ['a', 'b'])
})

test('a scheduled row due later is not shown until its time (the centre rule)', () => {
  const rows = [row('later', 10 * 60_000, { type: 'deadline_reminder' })]
  assert.equal(notificationArrivals({ rows, seenIds: new Set(), sinceMs: since, ownerIds: ['u1'], nowMs: now }).length, 0)
})

test('at most three pop-ups, newest kept; the same row is never added twice', () => {
  const current = [{ id: '1' }, { id: '2' }]
  const next = withArrivals(current, [{ id: '2' }, { id: '3' }, { id: '4' }])
  assert.equal(next.length, NOTIFICATION_TOAST_MAX)
  assert.deepEqual(next.map((r) => r.id), ['2', '3', '4'])
})
