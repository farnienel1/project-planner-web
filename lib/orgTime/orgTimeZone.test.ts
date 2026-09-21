import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COUNTRY_TIME_ZONES, ianaTimeZoneForCountry } from './orgTimeZone.ts'
import { BANK_HOLIDAY_REGIONS } from '../settings/bankHolidayRegions.ts'
import { daysInZoneMonth, unixStartOfDayInZone, dayKeyInZone, midnightInZone } from './zoneTime.ts'

test('org origin country maps to an IANA zone; unknown falls back to London', () => {
  assert.equal(ianaTimeZoneForCountry('GB'), 'Europe/London')
  assert.equal(ianaTimeZoneForCountry('ie'), 'Europe/Dublin')
  assert.equal(ianaTimeZoneForCountry('AU'), 'Australia/Sydney')
  assert.equal(ianaTimeZoneForCountry('JP'), 'Asia/Tokyo')
  assert.equal(ianaTimeZoneForCountry('GB-SCT'), 'Europe/London')
  assert.equal(ianaTimeZoneForCountry(''), 'Europe/London')
  assert.equal(ianaTimeZoneForCountry('ZZ'), 'Europe/London')
})

test('every organisation signup region has a mapped zone, not a silent London fallback', () => {
  const missing = BANK_HOLIDAY_REGIONS.filter((region) => !COUNTRY_TIME_ZONES[region.code])
  assert.deepEqual(missing, [])
  for (const region of BANK_HOLIDAY_REGIONS) {
    const zone = ianaTimeZoneForCountry(region.code)
    assert.match(zone, /\//, region.code)
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en-GB', { timeZone: zone }).format(new Date()))
  }
})

test('month length is the calendar month in the org zone, not the host UTC month', () => {
  const midSeptember = new Date(Date.UTC(2026, 8, 21, 12, 0, 0))
  assert.equal(daysInZoneMonth(midSeptember, 'Europe/London'), 30)
  assert.equal(daysInZoneMonth(midSeptember, 'Australia/Sydney'), 30)
})

test('a user a day ahead of London still gets the GB org calendar day', () => {
  // 21 Sep 2026 23:30 UTC = 22 Sep 09:30 in Sydney, still 22 Sep 00:30 in London? 
  // 21 Sep 23:30 UTC = 22 Sep 00:30 BST (London) and 22 Sep 09:30 Sydney.
  // Pick 21 Sep 10:00 UTC = 21 Sep 11:00 London, 21 Sep 20:00 Sydney — same date.
  // Pick 21 Sep 14:00 UTC = 21 Sep 15:00 London, 22 Sep 00:00 Sydney — Sydney is a day ahead.
  const instant = new Date(Date.UTC(2026, 8, 21, 14, 0, 0))
  assert.equal(dayKeyInZone(instant, 'Europe/London'), '2026-09-21')
  assert.equal(dayKeyInZone(instant, 'Australia/Sydney'), '2026-09-22')
  const londonStamp = unixStartOfDayInZone(instant, 'Europe/London')
  const sydneyStamp = unixStartOfDayInZone(instant, 'Australia/Sydney')
  assert.notEqual(londonStamp, sydneyStamp)
  assert.equal(dayKeyInZone(midnightInZone(instant, 'Europe/London'), 'Europe/London'), '2026-09-21')
})
