/**
 * Rulebook 1.35.0 §12 (owner decisions 7 Nov): `myProfileSummary`, `bookedWorkedHours` and `organizationWeekDayKeys`.
 * Old document shapes (guardrail 3): leave and bookings under a second same-email users id, an id in another letter
 * case, tasks with no due date, a person with no `operatives` row.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_PAYROLL_POLICY,
  annualLeaveBankHolidayRange,
  bookedWorkedHours,
  myProfileBankHolidayRange,
  myProfileSummary,
  organizationWeekDayKeys,
  parsePayrollTimePolicyState,
  type MyProfileSummaryInput,
} from './index'

const LONDON = 'Europe/London'
// Wednesday 4 November 2026, midday in London.
const WED = Date.parse('2026-11-04T12:00:00Z')

const policyDoc = {
  payrollTimePolicy: {
    ...DEFAULT_PAYROLL_POLICY,
    standardDayStart: '07:30',
    standardDayEnd: '16:00',
    breakWindowStart: '12:00',
    breakWindowEnd: '12:30',
    unpaidBreakMinutes: 30,
    breakPaid: false,
  },
}

const roster = [
  { id: 'U1', email: 'sam@site.test', firstName: 'Sam', surname: 'Smith', isActive: true },
  // A second users document on the same email (older invite / iOS copy), another letter case.
  { id: 'u2-old', email: 'Sam@Site.test', firstName: 'Sam', surname: 'Smith', isActive: true },
  { id: 'LM1', email: 'lee@site.test', firstName: 'Lee', surname: 'Line', isActive: true, manager: true },
  { id: 'LM2', email: 'kim@site.test', firstName: 'Kim', surname: 'Kerr', isActive: true, manager: true },
  { id: 'OTHER', email: 'other@site.test', firstName: 'Olly', surname: 'Other', isActive: true },
]

function base(overrides: Partial<MyProfileSummaryInput> = {}): MyProfileSummaryInput {
  return {
    nowMs: WED,
    timeZone: LONDON,
    viewer: { id: 'U1', email: 'sam@site.test' },
    user: {
      id: 'U1',
      email: 'sam@site.test',
      annualLeaveEnabled: true,
      annualLeaveDaysPerYear: 25,
      assignedManagerUserIds: ['LM1'],
    },
    roster,
    operatives: [],
    managers: [],
    leaveDefaults: { daysPerYear: 25, startMonth: 1, endMonth: 12, carriesOver: false, maxCarryOverDays: null },
    holidays: [],
    nonWorkingDayKeys: [],
    tasks: [],
    bookings: [],
    managerSiteBookings: [],
    policyState: parsePayrollTimePolicyState(policyDoc, LONDON),
    ...overrides,
  }
}

test('1.35.0 organizationWeekDayKeys: Monday–Sunday in the organisation zone', () => {
  assert.deepEqual(organizationWeekDayKeys('2026-11-04', LONDON), {
    startDayKey: '2026-11-02',
    endDayKey: '2026-11-08',
    dayKeys: ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'],
  })
  // A Sunday belongs to the week that started the Monday before; a Monday starts its own.
  assert.equal(organizationWeekDayKeys('2026-11-08', LONDON).startDayKey, '2026-11-02')
  assert.equal(organizationWeekDayKeys('2026-11-09', LONDON).startDayKey, '2026-11-09')
  // Across the March clock change.
  assert.equal(organizationWeekDayKeys('2027-03-28', LONDON).endDayKey, '2027-03-28')
  assert.equal(organizationWeekDayKeys('not a day', LONDON).dayKeys.length, 0)
})

test('1.35.0 bookedWorkedHours: clock less the unpaid break, overlaps once, never multiplied, no paid-day cap', () => {
  const policy = parsePayrollTimePolicyState(policyDoc, LONDON).current
  const run = (dayKey: string, bookings: Array<Record<string, unknown>>) => bookedWorkedHours({ bookings, dayKey, policy, timeZone: LONDON })
  // Weekday overlap 08:00–13:00 + 11:00–14:00 → one block 08:00–14:00, break once → 5.5h.
  assert.equal(run('2026-11-02', [
    { timeSlot: 'CUSTOM', workStartTime: '08:00', workEndTime: '13:00' },
    { timeSlot: 'CUSTOM', workStartTime: '11:00', workEndTime: '14:00' },
  ]), 5.5)
  // A long weekday is its real hours, not the 8h paid day (managerCoverageHours.paidHours caps it).
  assert.equal(run('2026-11-02', [{ timeSlot: 'CUSTOM', workStartTime: '06:00', workEndTime: '18:00' }]), 11.5)
  assert.equal(run('2026-11-02', [{ timeSlot: 'FULL DAY' }]), 8)
  // Sunday pays every hour ×2: 08:00–12:00 is 4 worked hours (8 paid).
  assert.equal(run('2026-11-08', [{ timeSlot: 'CUSTOM', workStartTime: '08:00', workEndTime: '12:00' }]), 4)
  // "No unpaid break" keeps the break.
  assert.equal(run('2026-11-02', [{ timeSlot: 'CUSTOM', workStartTime: '07:30', workEndTime: '16:00', isBreakRemoved: true }]), 8.5)
  assert.equal(run('2026-11-02', []), 0)
})

test('1.35.0 myProfileSummary hours: this week only, every id, cancelled left out, multiplier never applied', () => {
  const summary = myProfileSummary(base({
    bookings: [
      { operativeId: 'U1', dayKey: '2026-11-02', status: 'Confirmed', timeSlot: 'CUSTOM', workStartTime: '08:00', workEndTime: '13:00' },
      // Same day, overlapping, filed under the second same-email id in another letter case.
      { operativeId: 'U2-OLD', dayKey: '2026-11-02', status: 'Confirmed', timeSlot: 'CUSTOM', workStartTime: '11:00', workEndTime: '14:00' },
      // Later this week: included (Q2).
      { operativeId: 'U1', dayKey: '2026-11-06', status: 'Tentative', timeSlot: 'FULL DAY' },
      // Sunday at ×2: 4 worked hours, not 8.
      { operativeId: 'U1', dayKey: '2026-11-08', status: 'Confirmed', timeSlot: 'CUSTOM', workStartTime: '08:00', workEndTime: '12:00' },
      // Next Monday: excluded.
      { operativeId: 'U1', dayKey: '2026-11-09', status: 'Confirmed', timeSlot: 'FULL DAY' },
      // Cancelled (older builds): excluded.
      { operativeId: 'U1', dayKey: '2026-11-03', status: 'Cancelled', timeSlot: 'FULL DAY' },
      // Someone else's.
      { operativeId: 'OTHER', dayKey: '2026-11-03', status: 'Confirmed', timeSlot: 'FULL DAY' },
    ],
    managerSiteBookings: [{ userId: 'U1', dayKey: '2026-11-05', timeSlot: 'CUSTOM', workStartTime: '09:00', workEndTime: '11:00' }],
  }))
  assert.equal(summary.dayKey, '2026-11-04')
  assert.equal(summary.hoursThisWeek.startDayKey, '2026-11-02')
  assert.equal(summary.hoursThisWeek.endDayKey, '2026-11-08')
  const byDay = Object.fromEntries(summary.hoursThisWeek.days.map((row) => [row.dayKey, row.hours]))
  assert.equal(byDay['2026-11-02'], 5.5)
  assert.equal(byDay['2026-11-03'], 0)
  assert.equal(byDay['2026-11-05'], 2)
  assert.equal(byDay['2026-11-06'], 8)
  assert.equal(byDay['2026-11-08'], 4)
  assert.equal(summary.hoursThisWeek.hours, 19.5)
})

test('1.35.0 myProfileSummary hours: the week follows the organisation zone, not UTC (Pacific/Auckland)', () => {
  // Sunday 8 Nov 12:00 UTC is Monday 9 Nov 01:00 in Auckland.
  const nowMs = Date.parse('2026-11-08T12:00:00Z')
  const summary = myProfileSummary(base({
    nowMs,
    timeZone: 'Pacific/Auckland',
    bookings: [
      { operativeId: 'U1', dayKey: '2026-11-09', status: 'Confirmed', timeSlot: 'CUSTOM', workStartTime: '08:00', workEndTime: '10:00' },
      { operativeId: 'U1', dayKey: '2026-11-08', status: 'Confirmed', timeSlot: 'CUSTOM', workStartTime: '08:00', workEndTime: '10:00' },
    ],
    policyState: parsePayrollTimePolicyState(policyDoc, 'Pacific/Auckland'),
  }))
  assert.equal(summary.dayKey, '2026-11-09')
  assert.equal(summary.hoursThisWeek.startDayKey, '2026-11-09')
  assert.equal(summary.hoursThisWeek.endDayKey, '2026-11-15')
  assert.equal(summary.hoursThisWeek.hours, 2)
})

test('1.35.0 myProfileSummary leave: remaining after pending, bank holiday inside a record, second same-email id', () => {
  const summary = myProfileSummary(base({
    holidays: [
      // Fri 28 Aug – Tue 1 Sep 2026; Mon 31 Aug is the summer bank holiday → 2 days, filed under the old id.
      { userId: 'u2-old', startDayKey: '2026-08-28', endDayKey: '2026-09-01', timeSlot: 'FULL DAY', status: 'approved' },
      { userId: 'U1', startDayKey: '2026-12-01', endDayKey: '2026-12-01', timeSlot: 'AM', status: 'pending' },
      // Someone else's.
      { userId: 'OTHER', startDayKey: '2026-10-01', endDayKey: '2026-10-02', timeSlot: 'FULL DAY', status: 'approved' },
      // Stored with the email as userId by older iOS builds.
      { userId: 'SAM@site.test', startDayKey: '2026-10-05', endDayKey: '2026-10-05', timeSlot: 'FULL DAY', status: 'approved' },
    ],
    nonWorkingDayKeys: ['2026-08-31'],
  }))
  assert.equal(summary.leave.hasAllowance, true)
  assert.equal(summary.leave.taken, 3)
  assert.equal(summary.leave.pending, 0.5)
  assert.equal(summary.leave.remaining, 21.5)
})

test('1.35.0 myProfileSummary leave: no allowance, pro rata and the carry-over cap', () => {
  const none = myProfileSummary(base({
    user: { id: 'U1', email: 'sam@site.test', annualLeaveEnabled: false },
    holidays: [{ userId: 'U1', startDayKey: '2026-03-02', endDayKey: '2026-03-02', timeSlot: 'FULL DAY', status: 'approved' }],
  }))
  assert.equal(none.leave.hasAllowance, false)
  assert.equal(none.leave.remaining, null)
  assert.equal(none.leave.usedThisYear, 1)

  const joined = myProfileSummary(base({
    user: { id: 'U1', email: 'sam@site.test', annualLeaveEnabled: true, annualLeaveDaysPerYear: 25, employmentStartDate: '2026-07-01' },
  }))
  assert.equal(joined.leave.proRata, true)
  assert.equal(joined.leave.yearEntitlement, 13)
  assert.equal(joined.leave.remaining, 13)

  const capped = myProfileSummary(base({
    user: { id: 'U1', email: 'sam@site.test', annualLeaveEnabled: true, annualLeaveDaysPerYear: 25, annualLeaveCarriesOver: true },
    leaveDefaults: { daysPerYear: 25, startMonth: 1, endMonth: 12, carriesOver: true, maxCarryOverDays: 5 },
  }))
  assert.equal(capped.leave.carriedForward, 5)
  assert.equal(capped.leave.remaining, 30)
})

test('1.35.0 myProfileSummary tasks: undated count as open, overdue, someone else\'s left out', () => {
  const summary = myProfileSummary(base({
    tasks: [
      { status: 'To Do', dueDate: null, assignedOperativeIds: ['U1'] },
      { status: 'In Progress', dueDate: '2026-11-01', assignedManagerId: 'u2-old' },
      { status: 'To Do', dueDate: '2026-11-05', assignedOperativeId: 'U1' },
      { status: 'Completed', dueDate: '2026-10-01', assignedOperativeId: 'U1' },
      { status: 'To Do', dueDate: '2026-10-01', assignedOperativeId: 'OTHER' },
    ],
  }))
  assert.deepEqual(summary.tasks, { open: 3, overdue: 1, dueThisWeek: 1 })
})

test('1.35.0 myProfileSummary qualifications: own operatives row only; none → 0', () => {
  const expiries = [
    { qualificationId: 'q1', name: 'CSCS', expiryIso: '2026-11-14T00:00:00Z' },
    { qualificationId: 'q2', name: 'IPAF', expiryIso: '2026-10-01T00:00:00Z' },
    { qualificationId: 'q3', name: 'PASMA', expiryIso: '2027-06-01T00:00:00Z' },
  ]
  const summary = myProfileSummary(base({
    operatives: [
      { id: 'op-sam', email: 'SAM@site.test', isActive: true, name: 'Sam Smith', expiries },
      { id: 'op-other', email: 'other@site.test', isActive: true, name: 'Olly', expiries },
    ],
  }))
  assert.deepEqual(summary.qualifications, { expired: 1, expiringSoon: 1, total: 2 })
  assert.deepEqual(myProfileSummary(base()).qualifications, { expired: 0, expiringSoon: 0, total: 0 })
})

test('1.35.0 myProfileSummary line manager: every name, No line manager, Unknown person', () => {
  const two = myProfileSummary(base({ user: { id: 'U1', email: 'sam@site.test', assignedManagerUserIds: ['LM1', 'LM2'] } }))
  assert.deepEqual(two.lineManager.ids.map((row) => row.name), ['Lee Line', 'Kim Kerr'])
  const noneSet = myProfileSummary(base({ user: { id: 'U1', email: 'sam@site.test', hasNoLineManager: true } }))
  assert.equal(noneSet.lineManager.label, 'No line manager')
  assert.equal(noneSet.lineManager.ids.length, 0)
  const unknown = myProfileSummary(base({ user: { id: 'U1', email: 'sam@site.test', assignedManagerUserIds: ['GONE'] } }))
  assert.deepEqual(unknown.lineManager.ids, [{ id: 'GONE', name: 'Unknown person', resolved: false }])
})

test('1.35.0 annualLeaveBankHolidayRange: previous leave year start to current leave year end', () => {
  // January leave year, 4 Nov 2026: 1 Jan 2025 – 31 Dec 2026.
  assert.deepEqual(
    annualLeaveBankHolidayRange({ annualLeaveEnabled: true, startMonth: 1, endMonth: 12, onDayKey: '2026-11-04', timeZone: LONDON }),
    { startDayKey: '2025-01-01', endDayKey: '2026-12-31', years: [2025, 2026] }
  )
  // April leave year on 10 Feb 2026 (still the 2025–26 year): 1 Apr 2024 – 31 Mar 2026.
  assert.deepEqual(
    annualLeaveBankHolidayRange({ annualLeaveEnabled: true, startMonth: 4, endMonth: 3, onDayKey: '2026-02-10', timeZone: LONDON }),
    { startDayKey: '2024-04-01', endDayKey: '2026-03-31', years: [2024, 2025, 2026] }
  )
  // No allowance: the organisation's leave year (April), whatever the person's own months say.
  assert.deepEqual(
    annualLeaveBankHolidayRange({
      annualLeaveEnabled: false, startMonth: 1, endMonth: 12, orgStartMonth: 4, orgEndMonth: 3, onDayKey: '2026-11-04', timeZone: LONDON,
    }),
    { startDayKey: '2025-04-01', endDayKey: '2027-03-31', years: [2025, 2026, 2027] }
  )
  // myProfileBankHolidayRange reads the same user and leaveDefaults as myProfileSummary.
  const range = myProfileBankHolidayRange(base({
    user: { id: 'U1', email: 'sam@site.test', annualLeaveEnabled: true, annualLeaveYearStartMonth: 4, annualLeaveYearEndMonth: 3 },
  }))
  assert.equal(range.startDayKey, '2025-04-01')
  assert.equal(range.endDayKey, '2027-03-31')
})

test('1.35.0 carry-over needs last leave year\'s bank holidays (Easter Monday 2025)', () => {
  // April leave year; 2025–26 had a Fri 18 Apr – Tue 22 Apr 2025 record over Good Friday and Easter Monday.
  const input = base({
    user: {
      id: 'U1', email: 'sam@site.test', annualLeaveEnabled: true, annualLeaveDaysPerYear: 25, annualLeaveCarriesOver: true,
      annualLeaveYearStartMonth: 4, annualLeaveYearEndMonth: 3,
    },
    leaveDefaults: { daysPerYear: 25, startMonth: 4, endMonth: 3, carriesOver: true, maxCarryOverDays: null },
    holidays: [{ userId: 'U1', startDayKey: '2025-04-17', endDayKey: '2025-04-22', timeSlot: 'FULL DAY', status: 'approved' }],
  })
  // Without the 2025 bank holidays the record counts Thu, Fri, Mon, Tue = 4 days taken last year → 21 carried.
  const without = myProfileSummary({ ...input, nonWorkingDayKeys: [] })
  assert.equal(without.leave.carriedForward, 21)
  // With the range's years loaded, Good Friday and Easter Monday are not leave: 2 days → 23 carried.
  const range = myProfileBankHolidayRange(input)
  assert.ok(range.years.includes(2025))
  const withBank = myProfileSummary({ ...input, nonWorkingDayKeys: ['2025-04-18', '2025-04-21', '2026-04-03', '2026-04-06'] })
  assert.equal(withBank.leave.carriedForward, 23)
  assert.equal(withBank.leave.remaining, 48)
})
