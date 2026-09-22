import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LONDON_TIME_ZONE } from '../orgTime/zoneTime.ts'
import { calendarDayOffset, programmeProgressPercent } from './programmeDates.ts'
import { daysLeftCaption, deriveWorkStatus, timelineProgressPercent } from './workStatus.ts'

test('calendar days left ignore the time of day in London', () => {
  const now = new Date('2026-09-22T15:49:00.000Z')
  const endMidnightUtc = new Date('2026-09-24T00:00:00.000Z')
  assert.equal(calendarDayOffset(endMidnightUtc, now, LONDON_TIME_ZONE), 2)
})

test('days left caption uses calendar days, not 24-hour periods', () => {
  const now = new Date('2026-09-22T15:49:00.000Z')
  const end = new Date('2026-09-24T00:00:00.000Z')
  assert.equal(daysLeftCaption(end, 'active', now, LONDON_TIME_ZONE), '2 days left')
  assert.equal(daysLeftCaption(now, 'active', now, LONDON_TIME_ZONE), 'Ends today')
  assert.equal(
    daysLeftCaption(new Date('2026-09-23T00:00:00.000Z'), 'active', now, LONDON_TIME_ZONE),
    '1 day left'
  )
})

test('programme percent tracks calendar span when the end date moves', () => {
  const now = new Date('2026-09-22T12:00:00.000Z')
  const start = new Date('2026-09-01T00:00:00.000Z')
  const earlyEnd = new Date('2026-09-24T00:00:00.000Z')
  const laterEnd = new Date('2026-10-01T00:00:00.000Z')
  const early = programmeProgressPercent(start, earlyEnd, now, LONDON_TIME_ZONE)
  const later = programmeProgressPercent(start, laterEnd, now, LONDON_TIME_ZONE)
  assert.equal(early > later, true)
  assert.equal(timelineProgressPercent(start, earlyEnd, 'active', now, LONDON_TIME_ZONE), early)
  assert.equal(timelineProgressPercent(start, laterEnd, 'completed', now, LONDON_TIME_ZONE), 100)
})

test('live jobs stay active through the programme end calendar day', () => {
  const now = new Date('2026-09-24T15:00:00.000Z')
  const project = {
    isLive: true,
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    endDate: new Date('2026-09-24T00:00:00.000Z'),
  }
  assert.equal(deriveWorkStatus(project, now, LONDON_TIME_ZONE), 'active')
  assert.equal(
    deriveWorkStatus(project, new Date('2026-09-25T08:00:00.000Z'), LONDON_TIME_ZONE),
    'completed'
  )
})
