import { test } from 'node:test'
import assert from 'node:assert/strict'
import { londonMidnight } from '../ios-parity/londonTime.ts'
import { LONDON_TIME_ZONE, formatAbbreviatedDayInZone } from './zoneTime.ts'

test('a London calendar day keeps its weekday when the instant is the previous UTC evening', () => {
  const day = londonMidnight(new Date('2026-10-06T10:00:00Z'))
  const label = formatAbbreviatedDayInZone(day, LONDON_TIME_ZONE)
  assert.match(label, /Tue/)
  assert.match(label, /6/)
  assert.match(label, /Oct/)
  assert.equal(label.includes('5 Oct'), false)
})
