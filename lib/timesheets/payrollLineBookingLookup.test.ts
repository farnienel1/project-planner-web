import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import type { TimesheetPayrollLineItem } from './timesheetPayrollCollector.ts'
import {
  bookingIdFromLineId,
  initialHoursChoice,
  revisedPayrollAmount,
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

test('revisedPayrollAmount scales the day line from edited hours', () => {
  const row = line({ id: 'op-b1-normal', paidHours: 8, amount: 200 })
  const halfDay = revisedPayrollAmount({
    row,
    startTime: '07:30',
    endTime: '12:00',
    breakRemoved: true,
    policy: DEFAULT_PAYROLL_POLICY,
  })
  assert.ok(halfDay < 200)
  assert.ok(halfDay > 0)
})
