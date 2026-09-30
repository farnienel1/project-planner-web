import assert from 'node:assert/strict'
import test from 'node:test'
import { holidayMatchesRegion, holidayNameOn, countHolidaysInRange } from './bankHolidays.ts'

const easter: Parameters<typeof holidayMatchesRegion>[0] = {
  date: '2026-04-06',
  localName: 'Easter Monday',
  countryCode: 'GB',
  global: false,
  counties: ['GB-ENG', 'GB-WLS', 'GB-NIR'],
}

const andrew: Parameters<typeof holidayMatchesRegion>[0] = {
  date: '2026-11-30',
  localName: "Saint Andrew's Day",
  countryCode: 'GB',
  global: false,
  counties: ['GB-SCT'],
}

test('England and a bare GB setting share England and Wales dates', () => {
  assert.equal(holidayMatchesRegion(easter, 'GB'), true)
  assert.equal(holidayMatchesRegion(easter, 'GB-ENG'), true)
  assert.equal(holidayMatchesRegion(andrew, 'GB'), false)
  assert.equal(holidayMatchesRegion(andrew, 'GB-SCT'), true)
  assert.equal(holidayMatchesRegion(easter, 'GB-SCT'), false)
})

test('a named holiday is found on its date and counted inside the leave year', () => {
  const holidays = [{ date: '2026-04-06', name: 'Easter Monday' }]
  assert.equal(holidayNameOn(holidays, new Date(2026, 3, 6)), 'Easter Monday')
  assert.equal(holidayNameOn(holidays, new Date(2026, 3, 7)), null)
  assert.equal(countHolidaysInRange(holidays, new Date(2026, 0, 1), new Date(2026, 11, 31)), 1)
})
