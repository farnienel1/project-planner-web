import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayKeyInZone, isoWeekdayInZone, LONDON_TIME_ZONE } from '../orgTime/zoneTime.ts'
import { resolveConsolePeriod } from './consolePeriod.ts'

test('this week starts Monday in Europe/London', () => {
  const now = new Date('2026-09-22T15:00:00Z')
  const range = resolveConsolePeriod('week', now)
  assert.equal(isoWeekdayInZone(range.start, LONDON_TIME_ZONE), 1)
  assert.equal(dayKeyInZone(range.start, LONDON_TIME_ZONE), '2026-09-21')
  assert.equal(range.end.toISOString(), now.toISOString())
})

test('today compares with the same weekday last week', () => {
  const now = new Date('2026-09-22T15:30:00Z')
  const range = resolveConsolePeriod('today', now)
  assert.equal(dayKeyInZone(range.start, LONDON_TIME_ZONE), '2026-09-22')
  assert.equal(dayKeyInZone(range.previousStart, LONDON_TIME_ZONE), '2026-09-15')
})

test('period boundaries survive the 2026 BST spring-forward', () => {
  const after = new Date('2026-03-30T12:00:00Z')
  const range = resolveConsolePeriod('today', after)
  assert.equal(dayKeyInZone(range.start, LONDON_TIME_ZONE), '2026-03-30')
  assert.equal(dayKeyInZone(range.previousStart, LONDON_TIME_ZONE), '2026-03-23')
  assert.ok(range.end.getTime() === after.getTime())
})
