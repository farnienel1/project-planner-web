import assert from 'node:assert/strict'
import test from 'node:test'
import { dateFromDayKey } from '@/lib/ios-parity/londonTime.ts'
import { countBookingsOnSiteDay } from './siteDayBookings.ts'

test('London midnight and a manager booking both count on that site day', () => {
  const day = dateFromDayKey('2026-10-07')
  const londonMidnight = new Date('2026-10-06T23:00:00.000Z')
  const previousLondonDay = new Date('2026-10-06T12:00:00.000Z')
  assert.equal(
    countBookingsOnSiteDay({
      siteId: 'C984',
      day,
      operativeBookings: [{ projectId: 'C984', date: londonMidnight }],
      managerBookings: [
        { locationType: 'project', locationId: 'C984', date: londonMidnight },
        { locationType: 'office', locationId: 'C984', date: londonMidnight },
        { locationType: 'project', locationId: 'OTHER', date: londonMidnight },
        { locationType: 'project', locationId: 'C984', date: previousLondonDay },
      ],
    }),
    2
  )
})
