import { test } from 'node:test'
import assert from 'node:assert/strict'
import { penceForSignedTimesheet, userIdFromTimesheetDoc } from '../timesheets/signedSheetPence.ts'

test('reads the Firebase uid from the timesheet document id when userId is missing', () => {
  assert.equal(
    userIdFromTimesheetDoc('timesheet_abcUID123_1710000000', {}),
    'abcUID123'
  )
  assert.equal(
    userIdFromTimesheetDoc('timesheet_abcUID123_2026-09-01', { userId: ' stored-id ' }),
    'stored-id'
  )
  assert.equal(userIdFromTimesheetDoc('jobTypes', {}), '')
})

test('uses frozen timesheet value when stored', () => {
  const result = penceForSignedTimesheet({
    storedValuePence: 54_000,
    extrasPounds: 20,
    hoursByDate: [{ date: '2026-09-14', hours: 8 }],
    dayRatePence: 18000,
  })
  assert.equal(result.valuePence, 54_000)
  assert.equal(result.missingRate, false)
})

test('computes labour plus extras from booked hours and rates', () => {
  const result = penceForSignedTimesheet({
    extrasPounds: 25,
    hoursByDate: [
      { date: '2026-09-14', hours: 8 },
      { date: '2026-09-15', hours: 4 },
    ],
    dayRatePence: 20000,
  })
  assert.equal(result.valuePence, 20000 + 10000 + 2500)
  assert.equal(result.missingRate, false)
})

test('flags missing rates when there is work but no £ rate', () => {
  const result = penceForSignedTimesheet({
    extrasPounds: 0,
    hoursByDate: [{ date: '2026-09-14', hours: 8 }],
  })
  assert.equal(result.valuePence, 0)
  assert.equal(result.missingRate, true)
})
