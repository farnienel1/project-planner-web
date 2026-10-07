import assert from 'node:assert/strict'
import test from 'node:test'
import { dailyOverviewMayPublish } from './buildDailyOverview.ts'

test('an empty booking read still in flight is not an unbooked team', () => {
  assert.equal(
    dailyOverviewMayPublish({
      bookingsLoading: true,
      bookingCount: 0,
      managerLoading: true,
      managerBookingCount: 0,
    }),
    false
  )
  assert.equal(
    dailyOverviewMayPublish({
      bookingsLoading: false,
      bookingCount: 4,
      managerLoading: true,
      managerBookingCount: 0,
    }),
    false
  )
})

test('a finished empty read can publish, and rows already on screen can publish', () => {
  assert.equal(
    dailyOverviewMayPublish({
      bookingsLoading: false,
      bookingCount: 0,
      managerLoading: false,
      managerBookingCount: 0,
    }),
    true
  )
  assert.equal(
    dailyOverviewMayPublish({
      bookingsLoading: false,
      bookingCount: 2,
      managerLoading: false,
      managerBookingCount: 1,
    }),
    true
  )
})
