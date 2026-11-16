import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayKeyInZone, isoWeekdayInZone, LONDON_TIME_ZONE } from '../orgTime/zoneTime.ts'
import { consoleEventsCover, consoleEventsLoadCovers, consoleEventsSince, resolveConsolePeriod } from './consolePeriod.ts'

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

test('PR 1: events load from the start of the comparison period, never all of time unless To date', () => {
  const now = new Date('2026-11-16T12:00:00Z')
  assert.equal(dayKeyInZone(consoleEventsSince('month', now)!, LONDON_TIME_ZONE), '2026-10-01')
  assert.equal(dayKeyInZone(consoleEventsSince('week', now)!, LONDON_TIME_ZONE), '2026-11-09')
  assert.equal(dayKeyInZone(consoleEventsSince('today', now)!, LONDON_TIME_ZONE), '2026-11-09')
  assert.equal(dayKeyInZone(consoleEventsSince('year', now)!, LONDON_TIME_ZONE), '2025-01-01')
  assert.equal(consoleEventsSince('to_date', now), null)
})

test('PR 1: a capped or later load never claims to cover an earlier day', () => {
  const since = new Date('2026-10-01T00:00:00Z')
  assert.equal(consoleEventsCover({ since, truncated: false }, new Date('2026-10-05T00:00:00Z')), true)
  assert.equal(consoleEventsCover({ since, truncated: false }, new Date('2026-09-05T00:00:00Z')), false)
  assert.equal(consoleEventsCover({ since: null, truncated: true }, new Date('2026-10-05T00:00:00Z')), false)
  assert.equal(consoleEventsCover(null, since), false)
  assert.equal(consoleEventsLoadCovers(undefined, since), false)
  assert.equal(consoleEventsLoadCovers(null, since), true)
  assert.equal(consoleEventsLoadCovers(since, null), false)
  assert.equal(consoleEventsLoadCovers(since, new Date('2026-10-02T00:00:00Z')), true)
})
