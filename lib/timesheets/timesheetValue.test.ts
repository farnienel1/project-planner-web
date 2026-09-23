import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeTimesheetValue, ratePenceFromPounds } from './timesheetValue.ts'

test('day-rate full and half days freeze the rate in force on that date', () => {
  const result = computeTimesheetValue({
    currentDayRatePence: 20000,
    history: [
      { effectiveAt: '2026-01-01', dayRatePence: 18000 },
      { effectiveAt: '2026-09-17', dayRatePence: 22000 },
    ],
    days: [
      { date: '2026-09-14', kind: 'full' },
      { date: '2026-09-15', kind: 'half' },
      { date: '2026-09-17', kind: 'full' },
    ],
  })
  assert.equal(result.valueBasis, 'day')
  assert.equal(result.valueDays, 2.5)
  assert.equal(result.valuePence, 18000 + 9000 + 22000)
  assert.equal(result.valueMissingRate, false)
})

test('hourly days use hours × hourly rate', () => {
  const result = computeTimesheetValue({
    currentHourlyRatePence: 2500,
    days: [{ date: '2026-09-14', kind: 'hours', hours: 7.5 }],
  })
  assert.equal(result.valueBasis, 'hour')
  assert.equal(result.valueHours, 7.5)
  assert.equal(result.valuePence, 18750)
})

test('missing rate counts as £0 and is flagged', () => {
  const result = computeTimesheetValue({
    days: [{ date: '2026-09-14', kind: 'full' }],
  })
  assert.equal(result.valuePence, 0)
  assert.equal(result.valueMissingRate, true)
  assert.equal(result.valueBasis, null)
})

test('custom hours on a day-rate operative cap at 1.5 days', () => {
  const result = computeTimesheetValue({
    currentDayRatePence: 10000,
    defaultDayLengthHours: 8,
    days: [{ date: '2026-09-14', kind: 'hours', hours: 20, dayLengthHours: 8 }],
  })
  assert.equal(result.valuePence, 15000)
})

test('pounds convert to integer pence', () => {
  assert.deepEqual(ratePenceFromPounds(180, 22.5), { dayRatePence: 18000, hourlyRatePence: 2250 })
})
