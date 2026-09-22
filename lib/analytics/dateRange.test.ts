import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveDateRange, percentChange } from './dateRange.ts'
import { dailyActiveUsers, relatedFeatureUsage, signupFunnel } from './aggregations.ts'
import type { ProductEvent } from './events.ts'

test('last 7 days range is inclusive of today and compares the previous 7', () => {
  const range = resolveDateRange('last_7', new Date('2026-09-22T12:00:00.000Z'))
  assert.equal(range.label, 'Last 7 days')
  assert.equal(range.end.getTime() > range.start.getTime(), true)
  assert.equal(range.start.getTime() - range.previousStart.getTime(), range.end.getTime() - range.previousEnd.getTime())
})

test('percent change is null when the previous period had no data', () => {
  assert.equal(percentChange(10, 0), null)
  assert.equal(percentChange(0, 0), 0)
  assert.equal(percentChange(12, 10), 20)
})

test('aggregations only count events inside the selected range', () => {
  const events: ProductEvent[] = [
    {
      id: '1',
      userId: 'a',
      eventName: 'dashboard_viewed',
      createdAt: new Date('2026-09-21T10:00:00.000Z'),
    },
    {
      id: '2',
      userId: 'b',
      eventName: 'dashboard_viewed',
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
    },
  ]
  const range = { start: new Date('2026-09-20T00:00:00.000Z'), end: new Date('2026-09-23T00:00:00.000Z') }
  assert.equal(dailyActiveUsers(events, range), 1)
  assert.equal(relatedFeatureUsage(events, 'dashboard', range).uses, 1)
})

test('funnel counts unique users per step', () => {
  const events: ProductEvent[] = [
    { id: '1', userId: 'a', eventName: 'user_signed_up', createdAt: new Date('2026-09-21T10:00:00.000Z') },
    { id: '2', userId: 'a', eventName: 'project_created', createdAt: new Date('2026-09-21T11:00:00.000Z') },
    { id: '3', userId: 'b', eventName: 'user_signed_up', createdAt: new Date('2026-09-21T10:00:00.000Z') },
  ]
  const range = { start: new Date('2026-09-20T00:00:00.000Z'), end: new Date('2026-09-23T00:00:00.000Z') }
  const funnel = signupFunnel(events, range)
  assert.equal(funnel[0].users, 2)
  assert.equal(funnel[1].users, 1)
})
