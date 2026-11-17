/**
 * Owner report (17 Nov 2026): Daily Overview lists the day's "Half-day leave not covered" rows (`leaveCoverageRows`),
 * the same rows Warnings shows, in the viewer's Daily Overview scope.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDailyOverview } from './buildDailyOverview.ts'
import { DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import { leaveWarningAnnualLeaveHref } from '../warnings/leaveCoverageWarnings.ts'

const ZONE = 'Europe/London'
const MON = new Date('2026-11-23T12:00:00Z')
const admin = {
  id: 'U-TA',
  email: 'test.admin@site.test',
  firstName: 'Test',
  surname: 'Admin',
  organizationId: 'org',
  role: 'admin',
  isActive: true,
  passwordSet: true,
  permissions: { adminAccess: true, manager: false, operativeMode: false },
}
const amLeave = {
  id: 'H-AM',
  organizationId: 'org',
  userId: 'U-TA',
  startDate: MON,
  endDate: MON,
  startDayKey: '2026-11-23',
  endDayKey: '2026-11-23',
  dayKeyTimeZone: ZONE,
  status: 'approved',
  timeSlot: 'AM',
}

function model(bookings: unknown[]) {
  return buildDailyOverview({
    day: MON,
    today: MON,
    projects: [],
    bookings: bookings as never,
    managerBookings: [],
    holidays: [amLeave] as never,
    users: [admin] as never,
    operatives: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
    includeWeekendsForUnbookedLabour: false,
    excludedUserIdsFromUnbookedWarnings: [],
    timeZone: ZONE,
  })
}

test('Daily Overview lists half-day leave not covered for the day', () => {
  const rows = model([]).leaveCoverRows
  assert.deepEqual(rows.map((row) => [row.personName, row.leaveLabel, row.kind]), [['Test Admin', 'AM', 'leave_cover']])
  assert.ok(rows[0].missingHours > 0)
})

test('Daily Overview drops the row once the other half is booked', () => {
  const rows = model([
    {
      id: 'B1',
      operativeId: 'U-TA',
      projectId: 'P1',
      date: MON,
      timeSlot: 'PM',
      status: 'Confirmed',
    },
  ]).leaveCoverRows
  assert.deepEqual(rows, [])
})

test('the warning card Annual leave button opens the person (or My leave for the viewer)', () => {
  const row = { userId: 'U-TA', operativeId: undefined, personKey: 'U-TA' }
  assert.equal(leaveWarningAnnualLeaveHref(row, { id: 'u-ta' }), '/dashboard/annual-leave')
  assert.equal(leaveWarningAnnualLeaveHref(row, { id: 'U-BOSS' }), '/dashboard/annual-leave?tab=team&person=U-TA')
})
