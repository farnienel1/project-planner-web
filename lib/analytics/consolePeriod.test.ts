import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dayKeyInZone, isoWeekdayInZone, LONDON_TIME_ZONE } from '../orgTime/zoneTime.ts'
import {
  consoleEventsCover,
  consoleEventsLoadCovers,
  consoleEventsSince,
  consoleEventsState,
  eventsLoadWindow,
  queuedEventsReload,
  rangeEventsSince,
  resolveConsolePeriod,
  widerEventsSince,
} from './consolePeriod.ts'

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

test('review #348 M2: a queued load keeps the widest window asked for', () => {
  const oct = new Date('2026-10-01T00:00:00Z')
  const nov = new Date('2026-11-01T00:00:00Z')
  assert.equal(widerEventsSince(undefined, nov), nov)
  assert.equal(widerEventsSince(nov, oct), oct)
  assert.equal(widerEventsSince(oct, nov), oct)
  assert.equal(widerEventsSince(oct, null), null)
  assert.equal(widerEventsSince(null, oct), null)
})

test('review #348 M2: the events state a page shows', () => {
  const oct = new Date('2026-10-01T00:00:00Z')
  const nov = new Date('2026-11-01T00:00:00Z')
  const base = { truncated: false, error: null, loading: false }
  assert.equal(consoleEventsState({ ...base, since: undefined }, oct), 'loading')
  assert.equal(consoleEventsState({ ...base, since: oct, error: 'x' }, oct), 'error')
  assert.equal(consoleEventsState({ ...base, since: nov }, oct), 'partial')
  assert.equal(consoleEventsState({ ...base, since: nov, loading: true }, oct), 'loading')
  assert.equal(consoleEventsState({ ...base, since: oct, truncated: true }, nov), 'cut_short')
  assert.equal(consoleEventsState({ ...base, since: oct }, nov), 'complete')
  assert.equal(consoleEventsState({ ...base, since: null }, null), 'complete')
  assert.equal(consoleEventsState({ ...base, since: oct }, null), 'partial')
  assert.equal(rangeEventsSince({ preset: 'all_time', start: oct, previousStart: oct }), null)
  assert.equal(rangeEventsSince({ preset: 'last_7', start: nov, previousStart: oct }), oct)
})

test('re-review of #348: Refresh and reloads keep the loaded window; a Refresh during a load reloads after it', () => {
  const oct = new Date('2026-10-01T00:00:00Z')
  const nov = new Date('2026-11-01T00:00:00Z')
  // No window asked for: keep the wider of what is loaded and the default.
  assert.equal(eventsLoadWindow(undefined, oct, nov), oct)
  assert.equal(eventsLoadWindow(undefined, null, nov), null)
  assert.equal(eventsLoadWindow(undefined, undefined, nov), nov)
  // An explicit window is used as given.
  assert.equal(eventsLoadWindow(nov, oct, nov), nov)
  // Queued: a Refresh always reloads; a narrower plain request does not; a wider one does.
  assert.equal(queuedEventsReload(undefined, false, oct), false)
  assert.equal(queuedEventsReload(oct, true, oct), true)
  assert.equal(queuedEventsReload(nov, false, oct), false)
  assert.equal(queuedEventsReload(oct, false, nov), true)
})
