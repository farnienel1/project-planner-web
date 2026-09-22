import { test } from 'node:test'
import assert from 'node:assert/strict'
import { directoryActiveUsers, organisationActivityRows } from './aggregations.ts'
import type { ProductEvent } from './events.ts'

test('organisation activity rolls up users, events and ideas across tenants', () => {
  const now = new Date('2026-09-22T12:00:00Z')
  const start = new Date('2026-09-15T00:00:00Z')
  const events: ProductEvent[] = [
    { id: 'e1', userId: 'u1', organizationId: 'A', eventName: 'dashboard_viewed', createdAt: now },
    { id: 'e2', userId: 'u2', organizationId: 'A', eventName: 'task_created', createdAt: now },
    { id: 'e3', userId: 'u3', organizationId: 'B', eventName: 'user_logged_in', createdAt: now },
  ]
  const rows = organisationActivityRows({
    organisations: [
      { id: 'A', name: 'Alpha Ltd', createdAt: start },
      { id: 'B', name: 'Beta Ltd', createdAt: start },
    ],
    users: [
      { id: 'u1', organizationId: 'A' },
      { id: 'u2', organizationId: 'A' },
      { id: 'u3', organizationId: 'B' },
    ],
    events,
    ideas: [{ organizationId: 'A' }, { organizationId: 'A' }, { organizationId: 'B' }],
    range: { start, end: new Date('2026-09-23T00:00:00Z') },
  })
  assert.equal(rows[0].id, 'A')
  assert.equal(rows[0].userCount, 2)
  assert.equal(rows[0].activeUsers, 2)
  assert.equal(rows[0].ideaCount, 2)
  assert.equal(rows[1].id, 'B')
  assert.equal(rows[1].userCount, 1)
})

test('activity includes organisations only seen on users or events', () => {
  const start = new Date('2026-09-15T00:00:00Z')
  const now = new Date('2026-09-22T12:00:00Z')
  const rows = organisationActivityRows({
    organisations: [],
    users: [{ id: 'u9', organizationId: 'C' }],
    events: [{ id: 'e9', userId: 'u9', organizationId: 'C', eventName: 'dashboard_viewed', createdAt: now }],
    ideas: [{ organizationId: 'C' }],
    range: { start, end: new Date('2026-09-23T00:00:00Z') },
  })
  assert.equal(rows[0].id, 'C')
  assert.equal(rows[0].name, 'Unknown organisation')
  assert.equal(rows[0].ideaCount, 1)
  assert.equal(rows[0].activeUsers, 1)
})

test('lastSeenAt counts as activity when product events are missing', () => {
  const start = new Date('2026-09-15T00:00:00Z')
  const seen = new Date('2026-09-20T12:00:00Z')
  const rows = organisationActivityRows({
    organisations: [{ id: 'A', name: 'Alpha Ltd' }],
    users: [
      { id: 'u1', organizationId: 'A', lastSeenAt: seen },
      { id: 'u2', organizationId: 'A' },
    ],
    events: [],
    ideas: [],
    range: { start, end: new Date('2026-09-23T00:00:00Z') },
  })
  assert.equal(rows[0].userCount, 2)
  assert.equal(rows[0].activeUsers, 1)
  assert.equal(rows[0].lastActivityAt?.toISOString(), seen.toISOString())
  assert.equal(directoryActiveUsers(rows[0] ? [{ id: 'u1', lastSeenAt: seen }, { id: 'u2' }] : [], { start, end: new Date('2026-09-23T00:00:00Z') }), 1)
})

test('extra organisations are recovered from users even with no events', () => {
  const start = new Date('2026-09-15T00:00:00Z')
  const rows = organisationActivityRows({
    organisations: [{ id: 'A', name: 'Alpha Ltd' }],
    users: [
      { id: 'u1', organizationId: 'A' },
      { id: 'u9', organizationId: 'C', lastSeenAt: new Date('2026-09-21T10:00:00Z') },
    ],
    events: [],
    ideas: [],
    range: { start, end: new Date('2026-09-23T00:00:00Z') },
  })
  assert.equal(rows.length, 2)
  const extra = rows.find((row) => row.id === 'C')
  assert.equal(extra?.name, 'Unknown organisation')
  assert.equal(extra?.userCount, 1)
  assert.equal(extra?.activeUsers, 1)
})
