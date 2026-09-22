import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activityLanes, directoryActiveUsers, directoryDateChart, lastSeenRetention, organisationActivityRows, orgSizeBuckets, roleMix } from './aggregations.ts'
import type { ProductEvent } from './events.ts'
import { resolveDateRange } from './dateRange.ts'

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

test('directory charts count live signups and last-seen without product events', () => {
  const range = resolveDateRange('last_7', new Date('2026-09-22T12:00:00Z'))
  const points = directoryDateChart(
    [
      { id: 'u1', createdAt: new Date('2026-09-21T10:00:00Z') },
      { id: 'u2', createdAt: new Date('2026-09-21T18:00:00Z') },
      { id: 'u3', createdAt: new Date('2026-08-01T10:00:00Z'), lastSeenAt: new Date('2026-09-21T12:00:00Z') },
    ],
    range,
    'createdAt'
  )
  const day = points.find((point) => point.day === '2026-09-21')
  assert.equal(day?.value, 2)
  const seen = directoryDateChart(
    [
      { id: 'u1', createdAt: new Date('2026-08-01T10:00:00Z'), lastSeenAt: new Date('2026-09-21T12:00:00Z') },
      { id: 'u2', createdAt: new Date('2026-08-01T10:00:00Z') },
    ],
    range,
    'lastSeenAt'
  )
  assert.equal(seen.find((point) => point.day === '2026-09-21')?.value, 1)
})

test('last-seen retention uses account records, not product events', () => {
  const now = new Date('2026-09-22T12:00:00Z')
  const users = [
    { id: 'a', createdAt: new Date('2026-08-01T00:00:00Z'), lastSeenAt: new Date('2026-09-20T00:00:00Z') },
    { id: 'b', createdAt: new Date('2026-08-01T00:00:00Z'), lastSeenAt: new Date('2026-08-02T00:00:00Z') },
    { id: 'c', createdAt: new Date('2026-08-01T00:00:00Z'), lastSeenAt: new Date('2026-09-10T00:00:00Z') },
    { id: 'd', createdAt: new Date('2026-08-01T00:00:00Z'), lastSeenAt: new Date('2026-09-15T00:00:00Z') },
    { id: 'e', createdAt: new Date('2026-08-01T00:00:00Z'), lastSeenAt: new Date('2026-09-18T00:00:00Z') },
  ]
  const day30 = lastSeenRetention(users, now).find((row) => row.label === 'Day 30')
  assert.equal(day30?.size, 5)
  assert.equal(day30?.retained, 4)
  assert.equal(roleMix([{ role: 'admin', permissions: { adminAccess: true } }, { role: 'operative', permissions: { operativeMode: true } }])[0].count, 1)
})

test('activity lanes and org size buckets use live account records', () => {
  const now = new Date('2026-09-22T12:00:00Z')
  const lanes = activityLanes(
    [
      { lastSeenAt: new Date('2026-09-22T10:00:00Z') },
      { lastSeenAt: new Date('2026-09-18T10:00:00Z') },
      { lastSeenAt: new Date('2026-06-01T10:00:00Z') },
      {},
    ],
    now
  )
  assert.equal(lanes.find((row) => row.id === 'today')?.count, 1)
  assert.equal(lanes.find((row) => row.id === 'week')?.count, 2)
  assert.equal(lanes.find((row) => row.id === 'never')?.count, 1)
  assert.equal(lanes.find((row) => row.id === 'stale')?.count, 1)
  const sizes = orgSizeBuckets(
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    [
      { organizationId: 'A' },
      { organizationId: 'A' },
      { organizationId: 'B' },
      { organizationId: 'C' },
      { organizationId: 'C' },
      { organizationId: 'C' },
      { organizationId: 'C' },
      { organizationId: 'C' },
      { organizationId: 'C' },
    ]
  )
  assert.equal(sizes.find((row) => row.id === '1')?.count, 1)
  assert.equal(sizes.find((row) => row.id === '2-5')?.count, 1)
  assert.equal(sizes.find((row) => row.id === '6-20')?.count, 1)
})

