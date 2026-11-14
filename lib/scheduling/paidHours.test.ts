import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bookingPayrollHours,
  customHoursRangeLabel,
  estimatedPaidHours,
  formatHoursLabel,
  formatOvertimeEquation,
  hoursBreakdown,
  parseMinutes,
} from './paidHours.ts'
import { DEFAULT_PAYROLL_POLICY } from '../canonical/organizationSettings.ts'

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
    // payrollHoursResult: 8h standard + 3.5h outside × 1.5, the figure iOS shows.
    13.25
  )
  assert.equal(formatHoursLabel(11.5), '11.5')
  assert.equal(formatHoursLabel(19.25), '19.25')
  assert.equal(formatHoursLabel(8), '8')
  assert.equal(
    customHoursRangeLabel({ timeSlot: 'CUSTOM_HOURS', workStartTime: '06:00', workEndTime: '18:00' }),
    '06:00–18:00'
  )
})

test('AM/PM slots stay at 4h with leftover custom times; a FULL DAY with stored clocks pays those clocks', () => {
  assert.equal(estimatedPaidHours({ timeSlot: 'AM' }), 4)
  assert.equal(estimatedPaidHours({ timeSlot: 'FULL DAY' }), 8)
  assert.equal(
    estimatedPaidHours({
      timeSlot: 'AM',
      workStartTime: '07:30',
      workEndTime: '16:00',
    }),
    4
  )
  assert.equal(
    estimatedPaidHours({
      timeSlot: 'PM',
      workStartTime: '06:00',
      workEndTime: '18:00',
    }),
    4
  )
  assert.equal(
    estimatedPaidHours({
      timeSlot: 'FULL DAY',
      workStartTime: '06:00',
      workEndTime: '18:00',
    }),
    // `slotInterval`: stored clock times win over the named slot, on web and iOS alike.
    13.25
  )
  assert.equal(
    customHoursRangeLabel({ timeSlot: 'AM', workStartTime: '07:30', workEndTime: '16:00' }),
    null
  )
})

test('overtime copy uses raw hours × multiplier = equivalent, not equivalent × multiplier', () => {
  assert.equal(hoursBreakdown({ timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '17:00' }).overtimeRawHours, 1)
  assert.equal(hoursBreakdown({ timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00' }).overtimeRawHours, 2)
  assert.equal(formatOvertimeEquation(1, 1.5), '1 × 1.5 = 1.5')
  assert.equal(formatOvertimeEquation(2, 1.5), '2 × 1.5 = 3')
  assert.equal(hoursBreakdown({ timeSlot: 'AM', workStartTime: '07:30', workEndTime: '18:00' }).overtimeRawHours, 0)
})

test('1.43.0: Edit booking prices the booking\'s own overtime rate (owner example: 07:00–19:00 at ×2 = 14.5h)', () => {
  const policy = {
    ...DEFAULT_PAYROLL_POLICY,
    standardDayStart: '07:00',
    standardDayEnd: '16:00',
    unpaidBreakMinutes: 30,
    breakWindowStart: '12:00',
    breakWindowEnd: '12:30',
    breakPaid: false,
    weekdayOutsideStandardMultiplier: 1.5,
  }
  const own = hoursBreakdown({ timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '19:00', otMultiplierOverride: 2, policy, dayKey: '2026-11-11' })
  assert.equal(own.totalPaidHours, 14.5)
  assert.equal(own.overtimeMultiplier, 2)
  assert.equal(own.overtimeLine, '16:00–19:00 = 3 × 2 = 6')
  const org = hoursBreakdown({ timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '19:00', policy, dayKey: '2026-11-11' })
  assert.equal(org.totalPaidHours, 13)
})

test('hours breakdown for half day does not mention leftover full-day hours', () => {
  const am = hoursBreakdown({
    timeSlot: 'AM',
    workStartTime: '07:30',
    workEndTime: '16:00',
  })
  assert.equal(am.paidHours, 4)
  assert.equal(am.detail, 'Morning (AM) = 4 paid hours')
  assert.equal(am.overtimeEquation, null)

  const full = hoursBreakdown({ timeSlot: 'FULL DAY' })
  assert.equal(full.detail, 'Full day = 8 paid hours')

  const custom = hoursBreakdown({
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: '07:30',
    workEndTime: '18:00',
  })
  assert.equal(custom.overtimeEquation, '2 × 1.5 = 3')
  assert.match(custom.detail, /2 × 1\.5 = 3/)
  assert.equal(custom.totalPaidHours, 11)
})

test('custom hours 06:00-22:00 uses standard window, break, OT multiplier, then total paid', () => {
  const breakdown = hoursBreakdown({
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: '06:00',
    workEndTime: '22:00',
    overtimeMultiplier: 1.5,
  })
  assert.equal(breakdown.workingRangeLabel, '06:00 - 22:00')
  assert.equal(breakdown.standardRangeLabel, '07:30 - 16:00')
  assert.equal(breakdown.breakHours, 0.5)
  assert.equal(breakdown.overtimeRawHours, 7.5)
  assert.equal(breakdown.overtimeEquivalentHours, 11.25)
  assert.equal(breakdown.overtimeSegmentsLabel, '06:00–07:30 + 16:00–22:00')
  assert.equal(breakdown.overtimeLine, '06:00–07:30 + 16:00–22:00 = 7.5 × 1.5 = 11.25')
  assert.equal(breakdown.clockPaidHours, 15.5)
  assert.equal(breakdown.totalPaidHours, 19.25)
  assert.equal(breakdown.headline, 'Total paid hours 19.25')
  assert.equal(breakdown.lines.find((line) => line.kind === 'break')?.value, '-0.5')
  assert.equal(breakdown.lines.find((line) => line.kind === 'total')?.value, '19.25')
})

test('bookingPayrollHours reads the booking day in the organisation zone, not London', () => {
  // 14:00 UTC on Fri 9 Oct 2026 is already Saturday 10 Oct in Sydney.
  const date = new Date('2026-10-09T14:00:00Z')
  const london = bookingPayrollHours({ timeSlot: 'FULL DAY', date })
  const sydney = bookingPayrollHours({ timeSlot: 'FULL DAY', date, timeZone: 'Australia/Sydney' })
  const saturday = bookingPayrollHours({ timeSlot: 'FULL DAY', dayKey: '2026-10-10' })
  const friday = bookingPayrollHours({ timeSlot: 'FULL DAY', dayKey: '2026-10-09' })
  assert.deepEqual(london, friday)
  assert.deepEqual(sydney, saturday)
  assert.notDeepEqual(saturday, friday)
})

test('parseMinutes reads a stored Timestamp clock in the organisation zone, not the browser zone', async () => {
  const { parseMinutes } = await import('./paidHours.ts')
  const { Timestamp } = await import('firebase/firestore')
  const { setActiveOrganizationTimeZone } = await import('../orgTime/activeOrganizationZone.ts')
  const previousTz = process.env.TZ
  // 07:30 UTC on a BST day is 08:30 in London and 03:30 in New York.
  const stored = Timestamp.fromDate(new Date('2026-10-14T07:30:00Z'))
  try {
    process.env.TZ = 'America/New_York'
    setActiveOrganizationTimeZone('Europe/London')
    assert.equal(new Date('2026-10-14T07:30:00Z').getHours(), 3, 'the browser zone really is New York here')
    assert.equal(parseMinutes(stored as never), 8 * 60 + 30)
    assert.equal(parseMinutes(stored.toDate()), 8 * 60 + 30)
    setActiveOrganizationTimeZone('Pacific/Auckland')
    assert.equal(parseMinutes(stored as never), 20 * 60 + 30)
  } finally {
    setActiveOrganizationTimeZone(null)
    if (previousTz === undefined) delete process.env.TZ
    else process.env.TZ = previousTz
  }
})
