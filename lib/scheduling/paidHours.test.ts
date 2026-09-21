import { test } from 'node:test'
import assert from 'node:assert/strict'
import { customHoursRangeLabel, estimatedPaidHours, formatHoursLabel, parseMinutes } from './paidHours.ts'

test('parseMinutes reads clock strings, AM/PM, ISO, and hour numbers', () => {
  assert.equal(parseMinutes('07:30'), 7 * 60 + 30)
  assert.equal(parseMinutes('7:30 AM'), 7 * 60 + 30)
  assert.equal(parseMinutes('5:00 PM'), 17 * 60)
  assert.equal(parseMinutes('08:00:00'), 8 * 60)
  assert.equal(parseMinutes('2026-09-21T16:00:00.000Z'), 16 * 60)
  assert.equal(parseMinutes(8), 8 * 60)
  assert.equal(parseMinutes(8.5), 8 * 60 + 30)
  assert.equal(parseMinutes(480), 8 * 60)
})

test('custom hours subtract the unpaid lunch break', () => {
  assert.equal(
    estimatedPaidHours({
      timeSlot: 'CUSTOM_HOURS',
      workStartTime: '07:30',
      workEndTime: '16:00',
    }),
    8
  )
  assert.equal(
    estimatedPaidHours({
      timeSlot: 'CUSTOM_HOURS',
      workStartTime: '07:30',
      workEndTime: '16:00',
      isBreakRemoved: true,
    }),
    8.5
  )
})

test('custom hours never fall back to a flat 8h when start and end are present', () => {
  assert.equal(
    estimatedPaidHours({
      timeSlot: 'CUSTOM_HOURS',
      workStartTime: '06:00',
      workEndTime: '18:00',
    }),
    11.5
  )
  assert.equal(formatHoursLabel(11.5), '11.5')
  assert.equal(
    customHoursRangeLabel({ timeSlot: 'CUSTOM_HOURS', workStartTime: '06:00', workEndTime: '18:00' }),
    '06:00–18:00'
  )
})

test('AM/PM slots stay at 4h and full day at 8h', () => {
  assert.equal(estimatedPaidHours({ timeSlot: 'AM' }), 4)
  assert.equal(estimatedPaidHours({ timeSlot: 'FULL DAY' }), 8)
})
