import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { HolidayBooking } from '../../types/index.ts'
import {
  annualLeaveReport,
  annualLeaveReportDaysText,
  annualLeaveReportYears,
  annualLeaveReportYearTitle,
} from './annualLeaveReport.ts'
import { userLeaveBalance } from './leaveBalance.ts'

const ZONE = 'Europe/London'

function leave(partial: Partial<HolidayBooking> & { id: string; startDayKey: string; endDayKey: string }): HolidayBooking {
  return {
    organizationId: 'org',
    userId: 'u1',
    startDate: new Date(`${partial.startDayKey}T00:00:00Z`),
    endDate: new Date(`${partial.endDayKey}T00:00:00Z`),
    dayKeyTimeZone: ZONE,
    timeSlot: 'FULL DAY',
    status: 'approved',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...partial,
  } as HolidayBooking
}

// An April–March leave year (organisation `annualLeaveDefaults.startMonth` 4).
const bookings: HolidayBooking[] = [
  // Mon 2 – Fri 6 Nov 2026: 5 days.
  leave({ id: 'a', startDayKey: '2026-11-02', endDayKey: '2026-11-06' }),
  // Thu 24 – Tue 29 Dec 2026 across Christmas: Thu, Tue only (Fri 25 / Mon 28 bank holidays, weekend out) → 2 days.
  leave({ id: 'b', startDayKey: '2026-12-24', endDayKey: '2026-12-29' }),
  // A half day filed under the person's operatives row id in upper case.
  leave({ id: 'c', userId: undefined, operativeId: 'OP-1', startDayKey: '2027-01-15', endDayKey: '2027-01-15', timeSlot: 'AM' }),
  // Pending and rejected never count; someone else's never counts.
  leave({ id: 'd', startDayKey: '2027-02-01', endDayKey: '2027-02-01', status: 'pending' }),
  leave({ id: 'e', startDayKey: '2027-02-02', endDayKey: '2027-02-02', status: 'rejected' }),
  leave({ id: 'f', userId: 'someone-else', startDayKey: '2027-02-03', endDayKey: '2027-02-03' }),
  // The year before: not in this report.
  leave({ id: 'g', startDayKey: '2026-03-02', endDayKey: '2026-03-02' }),
]
const bankHolidays = ['2026-12-25', '2026-12-28']

test('annual leave report: approved leave in the organisation leave year, under every id, bank holidays out', () => {
  const report = annualLeaveReport({
    bookings,
    personIds: ['u1', 'op-1'],
    onDayKey: '2026-04-01',
    startMonth: 4,
    timeZone: ZONE,
    nonWorkingDayKeys: bankHolidays,
  })
  assert.equal(report.startDayKey, '2026-04-01')
  assert.equal(report.endDayKey, '2027-03-31')
  assert.deepEqual(
    report.rows.map((row) => [row.id, row.days]),
    [
      ['c', 0.5],
      ['b', 2],
      ['a', 5],
    ]
  )
  assert.equal(report.totalDays, 7.5)
})

test('annual leave report total equals annualLeaveBalance.taken for the same year', () => {
  const now = new Date('2027-03-15T12:00:00Z')
  const balance = userLeaveBalance({
    user: { annualLeaveEnabled: true, annualLeaveYearStartMonth: 4, annualLeaveYearEndMonth: 3 } as never,
    // `annualLeaveBalance` takes the person's own records (the screen passes `leaveRecordsForAccount`'s rows).
    bookings: bookings.filter((row) => row.userId === 'u1' || row.operativeId === 'OP-1'),
    employment: null,
    orgDefaults: { daysPerYear: 25, startMonth: 4, endMonth: 3, carriesOver: false },
    now,
    bankHolidayDayKeys: bankHolidays,
    timeZone: ZONE,
  })
  const report = annualLeaveReport({
    bookings,
    personIds: ['u1', 'op-1'],
    onDayKey: balance.startDayKey,
    startMonth: 4,
    timeZone: ZONE,
    nonWorkingDayKeys: bankHolidays,
  })
  assert.equal(balance.startDayKey, report.startDayKey)
  assert.equal(report.totalDays, balance.taken)
})

test('annual leave report years: from the earliest of start date and first record to today, newest first', () => {
  const years = annualLeaveReportYears({
    bookings,
    employmentStartDayKey: '2026-05-10',
    todayDayKey: '2026-11-16',
    startMonth: 4,
    timeZone: ZONE,
  })
  assert.deepEqual(
    years.map((year) => year.startDayKey),
    ['2026-04-01', '2025-04-01']
  )
  assert.equal(annualLeaveReportYearTitle(years[0]), '2026/27')
  assert.equal(annualLeaveReportYearTitle({ startDayKey: '2026-01-01', endDayKey: '2026-12-31' }), '2026')
})

test('annual leave report wording matches iOS', () => {
  assert.equal(annualLeaveReportDaysText(1), '1 day')
  assert.equal(annualLeaveReportDaysText(0), '0 days')
  assert.equal(annualLeaveReportDaysText(7.5), '7.5 days')
})
