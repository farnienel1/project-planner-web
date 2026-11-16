import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { HolidayBooking } from '../../types/index.ts'
import {
  annualLeaveReport,
  annualLeaveReportDaysText,
  annualLeaveReportYears,
  annualLeaveReportYearTitle,
  annualLeaveReportLeaveState,
  ANNUAL_LEAVE_REPORT_LOAD_ERROR,
} from './annualLeaveReport.ts'
import { userLeaveBalance, userLeaveReportYearMonths } from './leaveBalance.ts'

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

test('1.54.0: the report counts the same leave year as the balance on the page (userLeaveReportYearMonths)', () => {
  // Review of #335: an April–March person in a January–December company, leave on 2 Feb, 4 May and 2 Nov 2026.
  const now = new Date('2026-11-16T12:00:00Z')
  const own = [
    leave({ id: 'x1', startDayKey: '2026-02-02', endDayKey: '2026-02-02' }),
    leave({ id: 'x2', startDayKey: '2026-05-04', endDayKey: '2026-05-04' }),
    leave({ id: 'x3', startDayKey: '2026-11-02', endDayKey: '2026-11-02' }),
  ]
  const user = { annualLeaveEnabled: true, annualLeaveYearStartMonth: 4, annualLeaveYearEndMonth: 3 } as never
  const orgDefaults = { daysPerYear: 25, startMonth: 1, endMonth: 12, carriesOver: false }
  const months = userLeaveReportYearMonths({ user, employment: null, orgDefaults, now, timeZone: ZONE })
  assert.deepEqual(months, { startMonth: 4, endMonth: 3 })
  const balance = userLeaveBalance({ user, bookings: own, employment: null, orgDefaults, now, timeZone: ZONE })
  const report = annualLeaveReport({
    bookings: own,
    personIds: ['u1'],
    onDayKey: balance.startDayKey,
    startMonth: months.startMonth,
    timeZone: ZONE,
  })
  assert.equal(report.startDayKey, balance.startDayKey)
  assert.equal(report.totalDays, 2)
  assert.equal(report.totalDays, balance.taken)

  // No allowance: the organisation's leave year.
  const noAllowance = { annualLeaveEnabled: false, annualLeaveYearStartMonth: 4, annualLeaveYearEndMonth: 3 } as never
  assert.deepEqual(
    userLeaveReportYearMonths({ user: noAllowance, employment: null, orgDefaults, now, timeZone: ZONE }),
    { startMonth: 1, endMonth: 12 }
  )
})

test('annual leave report waits for the leave records: never 0 days while loading or after a failed load', () => {
  // Nothing loaded yet for this organisation (or another company's records still in the store).
  assert.deepEqual(annualLeaveReportLeaveState({ organizationId: 'org', loading: false, error: null, loadedOrgId: null }), { status: 'loading' })
  assert.deepEqual(annualLeaveReportLeaveState({ organizationId: 'org', loading: true, error: null, loadedOrgId: 'other' }), { status: 'loading' })
  assert.deepEqual(annualLeaveReportLeaveState({ organizationId: null, loading: false, error: null, loadedOrgId: null }), { status: 'loading' })
  // A failed load is an error, never an empty report.
  const failed = { status: 'error', message: ANNUAL_LEAVE_REPORT_LOAD_ERROR }
  assert.deepEqual(annualLeaveReportLeaveState({ organizationId: 'org', loading: false, error: 'denied', loadedOrgId: 'org' }), failed)
  assert.deepEqual(annualLeaveReportLeaveState({ organizationId: 'org', loading: false, error: 'denied', loadedOrgId: null }), failed)
  // Reloading the same organisation.
  assert.deepEqual(annualLeaveReportLeaveState({ organizationId: 'org', loading: true, error: null, loadedOrgId: 'org' }), { status: 'loading' })
  assert.deepEqual(annualLeaveReportLeaveState({ organizationId: 'org', loading: false, error: null, loadedOrgId: 'org' }), { status: 'ready' })
})
