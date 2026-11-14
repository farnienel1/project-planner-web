import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import type { TimesheetPayrollLineItem } from './timesheetPayrollCollector.ts'
import {
  bookingIdFromLineId,
  initialHoursChoice,
  payrollLineEdit,
  timesFromPayrollLineDetails,
} from './payrollLineBookingLookup.ts'

function line(partial: Partial<TimesheetPayrollLineItem> & { id: string }): TimesheetPayrollLineItem {
  return {
    date: new Date('2026-09-21T08:00:00Z'),
    jobNumber: 'J-1',
    projectName: 'Site One',
    details: '07:30–16:00',
    paidHours: 8,
    payrollBasis: 'day',
    dayRate: 200,
    amount: 200,
    isPayeDay: false,
    isOvertimeLine: false,
    hasRate: true,
    ...partial,
  }
}

test('bookingIdFromLineId keeps hyphenated booking ids', () => {
  assert.equal(
    bookingIdFromLineId('op-550e8400-e29b-41d4-a716-446655440000-normal'),
    '550e8400-e29b-41d4-a716-446655440000'
  )
  assert.equal(bookingIdFromLineId('mgr-abc-ot'), 'abc')
  assert.equal(bookingIdFromLineId('other-id'), null)
})

test('timesFromPayrollLineDetails reads start, end and no-break', () => {
  assert.deepEqual(timesFromPayrollLineDetails('07:30–16:00'), {
    startTime: '07:30',
    endTime: '16:00',
    breakRemoved: false,
  })
  assert.deepEqual(timesFromPayrollLineDetails('08:00-17:00 · no break'), {
    startTime: '08:00',
    endTime: '17:00',
    breakRemoved: true,
  })
  assert.equal(timesFromPayrollLineDetails('OT 2h'), null)
})

test('initialHoursChoice prefers the live booking then the line details', () => {
  const fromBooking = initialHoursChoice({
    row: line({ id: 'op-b1-normal', details: 'OT 2h' }),
    operativeBooking: {
      id: 'b1',
      operativeId: 'op1',
      projectId: 'p1',
      date: new Date('2026-09-21T08:00:00Z'),
      timeSlot: 'FULL DAY',
      bookedBy: 'Ada',
      status: 'Confirmed',
      workStartTime: '08:00',
      workEndTime: '17:00',
      isBreakRemoved: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    policy: DEFAULT_PAYROLL_POLICY,
  })
  assert.deepEqual(fromBooking, {
    startTime: '08:00',
    endTime: '17:00',
    breakRemoved: true,
  })

  const fromDetails = initialHoursChoice({
    row: line({ id: 'op-b1-normal' }),
    policy: DEFAULT_PAYROLL_POLICY,
  })
  assert.deepEqual(fromDetails, {
    startTime: '07:30',
    endTime: '16:00',
    breakRemoved: false,
  })
})

// Rulebook 1.46.0 owner case: working day 07:00–16:00, 30 min unpaid 12:00–12:30, booking ×2, £250 a day.
const OWNER_POLICY = {
  ...DEFAULT_PAYROLL_POLICY,
  standardDayStart: '07:00',
  standardDayEnd: '16:00',
  unpaidBreakMinutes: 30,
  breakWindowStart: '12:00',
  breakWindowEnd: '12:30',
  breakPaid: false,
  paidHoursDerived: true,
  standardPaidHours: 8.5,
}

test('payrollLineEdit re-prices the booking: 07:00–16:00 edited to 07:00–19:00 pays the overtime (1.46.0)', () => {
  const row = line({
    id: 'op-b1-normal',
    dayKey: '2026-11-18',
    paidHours: 8.5,
    dayRate: 250,
    amount: 250,
    standardDayHours: 8.5,
    bookingOtMultiplierOverride: 2,
  })
  const edit = payrollLineEdit({
    row,
    lines: [row],
    startTime: '07:00',
    endTime: '19:00',
    breakRemoved: false,
    policy: OWNER_POLICY,
    timeZone: 'Europe/London',
  })
  assert.equal(edit.amounts.standardAmount, 250)
  assert.equal(edit.amounts.overtimeAmount, 176.47)
  // No overtime line on the sheet: the standard line carries the overtime.
  assert.deepEqual(edit.revisedByLineId, { 'op-b1-normal': 426.47 })
  assert.equal(edit.amounts.total, 426.47)
})

test('payrollLineEdit writes each line of a booking that has an overtime line, at the standard line rate', () => {
  const normal = line({ id: 'op-b2-normal', dayKey: '2026-11-18', paidHours: 8.5, dayRate: 250, amount: 250, bookingOtMultiplierOverride: 2 })
  const ot = line({
    id: 'op-b2-ot',
    dayKey: '2026-11-18',
    paidHours: 1,
    dayRate: 500,
    otMultiplier: 2,
    amount: 58.82,
    isOvertimeLine: true,
    bookingOtMultiplierOverride: 2,
  })
  const edit = payrollLineEdit({
    row: ot,
    lines: [normal, ot],
    startTime: '07:00',
    endTime: '19:00',
    breakRemoved: false,
    policy: OWNER_POLICY,
    timeZone: 'Europe/London',
  })
  assert.deepEqual(edit.revisedByLineId, { 'op-b2-normal': 250, 'op-b2-ot': 176.47 })
})

test('payrollLineEdit shortens the day to a part day', () => {
  const row = line({ id: 'op-b1-normal', dayKey: '2026-09-21', paidHours: 8, amount: 200 })
  const edit = payrollLineEdit({
    row,
    lines: [row],
    startTime: '07:30',
    endTime: '12:00',
    breakRemoved: true,
    policy: DEFAULT_PAYROLL_POLICY,
    timeZone: 'Europe/London',
  })
  assert.ok(edit.amounts.total < 200)
  assert.ok(edit.amounts.total > 0)
  assert.equal(edit.amounts.total, Math.round(edit.amounts.total * 100) / 100)
})
