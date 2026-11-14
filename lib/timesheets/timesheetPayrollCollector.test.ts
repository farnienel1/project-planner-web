import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { collectTimesheetPayroll, timesheetHoursRateLine, timesheetLabourDetails, timesheetRateAnnotation } from './timesheetPayrollCollector.ts'
import { paidBookedHours } from './timesheetHours.ts'
import { DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import type { OperativeDayRateHistoryCollection } from './dayRateHistoryStorage.ts'

function user(partial: Partial<User> & { id: string }): User {
  return {
    email: 'ada@x.com',
    firstName: 'Ada',
    surname: 'Booked',
    organizationId: 'org',
    role: 'operative',
    passwordSet: true,
    policyAccepted: true,
    permissions: {
      adminAccess: false,
      manager: false,
      operatives: false,
      skills: false,
      qualifications: false,
      materials: false,
      projects: false,
      smallWorks: false,
      operativeMode: true,
      annualLeaveSelfBook: false,
      weeklyReports: false,
      dailyOverview: true,
      subContractors: false,
      siteAudit: true,
      wholesalersOrderHistory: true,
    },
    isSuperAdmin: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    dayRate: 200,
    employmentType: 'self_employed',
    ...partial,
  } as User
}

const operative: Operative = {
  id: 'op1',
  firstName: 'Ada',
  lastName: 'Booked',
  email: 'ada@x.com',
  startDate: new Date(),
  hourlyRate: 0,
  dayRate: 200,
  skills: [],
  qualifications: [],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const project: Project = {
  id: 'proj1',
  jobNumber: 'J-1',
  siteName: 'Site One',
  addressLine1: '1 Road',
  townCity: 'London',
  postcode: 'E1 1AA',
  client: { id: 'c1', name: 'Client', createdAt: new Date(), updatedAt: new Date() },
  startDate: new Date(),
  endDate: new Date(),
  jobType: 'CAT A',
  manager: { name: 'Custom', email: '' },
  isLive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function booking(id: string, date: Date): Booking {
  return {
    id,
    operativeId: 'op1',
    projectId: 'proj1',
    date,
    timeSlot: 'FULL DAY',
    bookedBy: 'Ada',
    status: 'Confirmed',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

test('1.11.0: a PAYE day after an employment-type transition produces no timesheet line', () => {
  const subject = user({
    id: 'u1',
    employmentType: 'paye',
    employmentTypeTransitionFrom: 'self_employed',
    employmentTypeEffectiveAt: new Date('2026-10-01T00:00:00Z'),
  })
  const summary = collectTimesheetPayroll({
    user: subject,
    bookings: [booking('b1', new Date('2026-09-30T08:00:00Z')), booking('b2', new Date('2026-10-01T08:00:00Z'))],
    managerSiteBookings: [],
    operatives: [operative],
    projects: [project],
    smallWorks: [],
    periodStart: new Date('2026-09-16T00:00:00Z'),
    periodEnd: new Date('2026-10-15T00:00:00Z'),
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
    timeZone: 'Europe/London',
  })
  assert.equal(summary.lineItems.some((line) => line.id.startsWith('op-b1')), true)
  // Rulebook 1.11.0 `timesheetDaysForPerson`: the PAYE day is not on the timesheet at all.
  assert.equal(summary.lineItems.some((line) => line.id.startsWith('op-b2')), false)
  assert.equal(summary.lineItems.some((line) => line.isPayeDay), false)
})

test('payroll uses historic day rate including explicit £0', () => {
  const history: OperativeDayRateHistoryCollection = {
    byUserId: {
      u1: [
        {
          id: 'h1',
          userId: 'u1',
          operativeId: 'op1',
          dayRate: 0,
          effectiveAt: new Date('2026-01-01T00:00:00Z'),
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ],
    },
    byOperativeId: {},
  }
  const summary = collectTimesheetPayroll({
    user: user({ id: 'u1', dayRate: 250 }),
    bookings: [booking('b1', new Date('2026-09-21T08:00:00Z'))],
    managerSiteBookings: [],
    operatives: [operative],
    projects: [project],
    smallWorks: [],
    periodStart: new Date('2026-09-16T00:00:00Z'),
    periodEnd: new Date('2026-09-30T00:00:00Z'),
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
    timeZone: 'Europe/London',
    history,
  })
  const line = summary.lineItems.find((item) => item.id === 'op-b1-normal')
  assert.ok(line)
  assert.equal(line!.amount, 0)
  assert.equal(line!.dayRate, 0)
  assert.equal(line!.hasRate, true)
  assert.equal(timesheetRateAnnotation(line!), '£0.00/day')
})

test('payroll uses prior working-hours policy for days before effectiveFrom', () => {
  const withTimes = (id: string, date: Date): Booking => ({
    ...booking(id, date),
    workStartTime: '07:30',
    workEndTime: '16:00',
  })
  const current = { ...DEFAULT_PAYROLL_POLICY, unpaidBreakMinutes: 0, standardPaidHours: 8.5 }
  const prior = { ...DEFAULT_PAYROLL_POLICY, unpaidBreakMinutes: 30, standardPaidHours: 8 }
  const summary = collectTimesheetPayroll({
    user: user({ id: 'u1' }),
    bookings: [withTimes('old', new Date('2026-09-18T08:00:00Z')), withTimes('now', new Date('2026-09-21T08:00:00Z'))],
    managerSiteBookings: [],
    operatives: [operative],
    projects: [project],
    smallWorks: [],
    periodStart: new Date('2026-09-16T00:00:00Z'),
    periodEnd: new Date('2026-09-30T00:00:00Z'),
    payrollPolicy: current,
    payrollPolicyPrior: prior,
    payrollPolicyEffectiveFrom: '2026-09-21',
    timeZone: 'Europe/London',
  })
  const oldLine = summary.lineItems.find((item) => item.id === 'op-old-normal')
  const nowLine = summary.lineItems.find((item) => item.id === 'op-now-normal')
  assert.equal(oldLine?.paidHours, 8)
  assert.equal(nowLine?.paidHours, 8.5)
})

test('payroll includes a manager booking stored on another account with the same email', () => {
  const summary = collectTimesheetPayroll({
    user: user({ id: 'u1' }),
    bookings: [],
    managerSiteBookings: [
      {
        id: 'm-alias',
        userId: 'u-alias',
        date: new Date('2026-09-21T08:00:00Z'),
        timeSlot: 'FULL DAY',
        locationType: 'office',
        createdAt: new Date('2026-09-21T08:00:00Z'),
        updatedAt: new Date('2026-09-21T08:00:00Z'),
      },
    ],
    operatives: [operative],
    projects: [project],
    smallWorks: [],
    periodStart: new Date('2026-09-16T00:00:00Z'),
    periodEnd: new Date('2026-09-30T00:00:00Z'),
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
    timeZone: 'Europe/London',
    aliasUserIds: ['u1', 'u-alias'],
  })
  assert.equal(summary.lineItems.some((line) => line.id.startsWith('mgr-m-alias')), true)
  assert.ok(summary.totalHours >= 8)
})

test('15 minutes of clock time is 0.25 hours', () => {
  assert.equal(
    paidBookedHours('custom', '08:00', '08:15', { ...DEFAULT_PAYROLL_POLICY, unpaidBreakMinutes: 0 }),
    0.25
  )
})

test('a re-added person is paid for bookings under their users id, former invite id and old catalogue row', () => {
  const rehired = user({ id: 'rehiredUid0001', formerUserIds: ['PLACEHOLDER-0001'] })
  const base = booking('x', new Date('2026-10-20T08:00:00Z'))
  const summary = collectTimesheetPayroll({
    user: rehired,
    bookings: [
      { ...base, id: 'under-uid', operativeId: 'rehiredUid0001', date: new Date('2026-10-20T08:00:00Z') },
      { ...base, id: 'under-placeholder', operativeId: 'PLACEHOLDER-0001', date: new Date('2026-10-21T08:00:00Z') },
      { ...base, id: 'under-catalogue', operativeId: 'op1', date: new Date('2026-10-22T08:00:00Z') },
      { ...base, id: 'someone-else', operativeId: 'otherUid0001', date: new Date('2026-10-23T08:00:00Z') },
    ],
    managerSiteBookings: [],
    operatives: [operative],
    projects: [project],
    smallWorks: [],
    periodStart: new Date('2026-10-16T00:00:00Z'),
    periodEnd: new Date('2026-10-31T00:00:00Z'),
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
    timeZone: 'Europe/London',
  })
  const ids = summary.lineItems.map((line) => line.id)
  for (const id of ['under-uid', 'under-placeholder', 'under-catalogue']) {
    assert.ok(ids.some((line) => line.startsWith(`op-${id}`)), id)
  }
  assert.equal(ids.some((line) => line.startsWith('op-someone-else')), false)
})

test('timesheets count Completed bookings and skip Cancelled ones, as bookingOccupiesDay does', () => {
  const subject = user({ id: 'u1' })
  const base = booking('x', new Date('2026-10-20T08:00:00Z'))
  const summary = collectTimesheetPayroll({
    user: subject,
    bookings: [
      { ...base, id: 'done', status: 'Completed' },
      { ...base, id: 'off', status: 'Cancelled', date: new Date('2026-10-21T08:00:00Z') },
      { ...base, id: 'lower', status: 'confirmed' as Booking['status'], date: new Date('2026-10-22T08:00:00Z') },
    ],
    managerSiteBookings: [],
    operatives: [operative],
    projects: [project],
    smallWorks: [],
    periodStart: new Date('2026-10-16T00:00:00Z'),
    periodEnd: new Date('2026-10-31T00:00:00Z'),
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
    timeZone: 'Europe/London',
  })
  const ids = summary.lineItems.map((line) => line.id)
  assert.ok(ids.some((line) => line.startsWith('op-done')))
  assert.ok(ids.some((line) => line.startsWith('op-lower')))
  assert.equal(ids.some((line) => line.startsWith('op-off')), false)
})

test('1.19.0: a timesheet prices every day under the rules in effect on it — history and a change scheduled inside the run', async () => {
  const { parsePayrollTimePolicyState, payrollTimePolicyTimeline } = await import('../canonical/index.ts')
  const { payrollPolicyToFirestore } = await import('../canonical/organizationSettings.ts')
  const rawPolicy = (end: string) => payrollPolicyToFirestore({ ...DEFAULT_PAYROLL_POLICY, standardDayEnd: end })
  // 15:00 until 1 Nov (history), 16:00 from 1 Nov, 17:00 scheduled from 12 Nov (not promoted by any app).
  const doc = {
    countryCode: 'GB',
    payrollTimePolicy: rawPolicy('16:00'),
    payrollTimePolicyPrior: rawPolicy('15:00'),
    payrollTimePolicyEffectiveFrom: '2026-11-01',
    payrollTimePolicyHistory: [
      { effectiveFrom: '1970-01-01', policy: rawPolicy('14:00') },
      { effectiveFrom: '2026-10-20', policy: rawPolicy('15:00') },
      { effectiveFrom: '2026-11-01', policy: rawPolicy('16:00') },
    ],
    payrollTimePolicyScheduled: { policy: rawPolicy('17:00'), effectiveFrom: '2026-11-12' },
  }
  const state = payrollTimePolicyTimeline(parsePayrollTimePolicyState(doc, 'Europe/London'), '2026-11-03', 'Europe/London')
  const days = ['2026-10-15', '2026-10-21', '2026-11-10', '2026-11-12']
  const summary = collectTimesheetPayroll({
    user: user({ id: 'u1' }),
    bookings: days.map((day, index) => booking(`d${index}`, new Date(`${day}T08:00:00Z`))),
    managerSiteBookings: [],
    operatives: [operative],
    projects: [project],
    smallWorks: [],
    periodStart: new Date('2026-10-01T00:00:00Z'),
    periodEnd: new Date('2026-11-30T00:00:00Z'),
    payrollPolicy: state.current,
    payrollPolicyState: state,
    timeZone: 'Europe/London',
  })
  const hours = days.map((_, index) => summary.lineItems.find((item) => item.id === `op-d${index}-normal`)?.paidHours)
  // FULL DAY = the standard day less the 30-minute break: 07:30–14:00 = 6h, –15:00 = 7h, –16:00 = 8h, –17:00 = 9h.
  assert.deepEqual(hours, [6, 7, 8, 9])
})

test('1.19.0: a signed timesheet (weeklyReportOverride) is never re-priced when the working hours change', async () => {
  const { applyWeeklyReportOverride } = await import('./weeklyReportOverride.ts')
  const { emptyTimesheetDraft } = await import('./timesheetDraft.ts')
  const subject = user({ id: 'u1', permissions: { ...user({ id: 'x' }).permissions, adminAccess: true, operativeMode: false }, role: 'admin' })
  const signedLine = {
    id: 'op-b1-normal',
    date: new Date('2026-11-04T00:00:00Z'),
    jobNumber: 'J-1',
    projectName: 'Site One',
    locationKind: 'project',
    details: '07:30–16:00',
    paidHours: 8,
    days: 1,
    amount: 200,
    isOvertime: false,
    decision: 'approved' as const,
  }
  const draft = {
    ...emptyTimesheetDraft(),
    operativeSignedAt: new Date('2026-11-10T09:00:00Z'),
    operativeSignedByName: 'Ada Booked',
    managerSignedAt: new Date('2026-11-10T09:00:00Z'),
    managerSignedByName: 'Ada Booked',
    managerSignedByUserId: 'u1',
    weeklyReportOverride: {
      approvedAt: new Date('2026-11-10T09:00:00Z'),
      approvedByUserId: 'u1',
      approvedByName: 'Ada Booked',
      lines: [signedLine],
      priceWork: [],
      expenses: [],
    },
  }
  // The live booking would now pay 9h under a longer day; the signed line keeps 8h / £200.
  const longer = { ...DEFAULT_PAYROLL_POLICY, standardDayEnd: '17:00' }
  const next = applyWeeklyReportOverride({
    draft: draft as never,
    user: subject,
    users: [subject],
    weekStart: new Date('2026-11-01T00:00:00Z'),
    weekEnd: new Date('2026-11-15T00:00:00Z'),
    bookings: [booking('b1', new Date('2026-11-04T08:00:00Z'))],
    managerSiteBookings: [],
    operatives: [operative],
    projects: [project],
    smallWorks: [],
    payrollPolicy: longer,
    payrollPolicyState: { current: longer, prior: null, effectiveFrom: null, scheduled: null },
    timeZone: 'Europe/London',
  })
  const line = next.weeklyReportOverride?.lines[0]
  assert.deepEqual([line?.amount, line?.paidHours, line?.days], [200, 8, 1])
})

// Rulebook 1.20.3: an unpaid break worked in hours at a multiplier comes off after the multiplier as plain hours. The
// lines show the clock hours and the break ("6.5h × 2 − 0.5h break = 12.5h", `multipliedHoursText`), never the
// back-calculated "6.25h × 2"; amounts and totals are unchanged.
const r1203Policy = {
  ...DEFAULT_PAYROLL_POLICY,
  saturday: {
    ...DEFAULT_PAYROLL_POLICY.saturday,
    allHoursAtMultiplierMode: false,
    definedWindowStart: '07:30',
    definedWindowEnd: '11:00',
    countsAsStandardHours: 4,
    outsideWindowMultiplier: 2,
    breakPaid: false,
  },
  sunday: { ...DEFAULT_PAYROLL_POLICY.sunday, allHoursAtMultiplierMode: true, allHoursMultiplier: 2, sameAsSaturday: false, breakPaid: false },
}
function r1203Booking(id: string, date: string): Booking {
  return {
    ...booking(id, new Date(`${date}T10:00:00Z`)),
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: '07:30',
    workEndTime: '14:00',
  } as Booking
}
function r1203Summary(subject: User) {
  return collectTimesheetPayroll({
    user: subject,
    bookings: [r1203Booking('sat', '2026-11-07'), r1203Booking('sun', '2026-11-08')],
    managerSiteBookings: [],
    operatives: [{ ...operative, dayRate: subject.dayRate ?? 0, hourlyRate: subject.hourlyRate ?? 0 }],
    projects: [project],
    smallWorks: [],
    periodStart: new Date('2026-11-01T00:00:00Z'),
    periodEnd: new Date('2026-11-15T00:00:00Z'),
    payrollPolicy: r1203Policy,
    timeZone: 'Europe/London',
  })
}

test('1.20.3: overtime lines show clock hours and the break, never "6.25h × 2"; pay totals unchanged (hourly)', () => {
  const summary = r1203Summary(user({ id: 'u1', payBasis: 'hourly', hourlyRate: 20, dayRate: undefined } as Partial<User> & { id: string }))
  const sunOt = summary.lineItems.find((line) => line.id === 'op-sun-ot')
  const satOt = summary.lineItems.find((line) => line.id === 'op-sat-ot')
  const satStd = summary.lineItems.find((line) => line.id === 'op-sat-normal')
  assert.ok(sunOt && satOt && satStd)
  // Pay is the pay rule's: Sunday 6.5 × 2 − 0.5 = 12.5h × £20; Saturday 4h + (3 × 2 − 0.5) = 9.5h × £20.
  assert.deepEqual([sunOt.paidHours, sunOt.amount], [6.25, 250])
  assert.deepEqual([satStd.amount, satOt.paidHours, satOt.amount], [80, 2.75, 110])
  assert.equal(summary.baseAmount + summary.overtimeAmount, 440)
  // The text: clock hours × N, then the break as plain hours, at the base rate.
  // 1.43.0: the overtime line carries the overtime times first (`payrollLineClockRanges`).
  assert.equal(sunOt.details, '07:30–14:00 · OT 6.5h × 2 − 0.5h break = 12.5h')
  assert.equal(timesheetHoursRateLine(sunOt), '6.5h × 2 − 0.5h break = 12.5h × £20.00/hr = £250.00')
  // The live invoice line's details are the same text (`invoiceLinesForTimesheet` → `timesheetLabourDetails`).
  assert.equal(timesheetLabourDetails(sunOt), '07:30–14:00 · 6.5h × 2 − 0.5h break = 12.5h × £20.00/hr = £250.00')
  assert.equal(satOt.details, '11:00–14:00 · OT 3h × 2 − 0.5h break = 5.5h')
  // The standard line shows the set window's times, not the whole booking.
  assert.equal(satStd.details, '07:30–11:00')
  assert.equal(timesheetHoursRateLine(satOt), '3h × 2 − 0.5h break = 5.5h × £20.00/hr = £110.00')
  for (const line of summary.lineItems) assert.equal(/6\.25|2\.75/.test(timesheetHoursRateLine(line)), false, line.id)
  // The queue's OT figure is the clock hours at the multiplier (3 + 6.5), not the back-calculated 2.75 + 6.25.
  assert.equal(summary.overtimeHours, 9.5)
})

test('1.20.3: a day-rate overtime line with a break shows the hours that pay as days at the day rate; pay unchanged', () => {
  const summary = r1203Summary(user({ id: 'u1', dayRate: 200 }))
  const sunOt = summary.lineItems.find((line) => line.id === 'op-sun-ot')
  assert.ok(sunOt)
  // 6.25 / 8 × 2 × £200 = £312.50 = 12.5h / 8 × £200.
  assert.equal(sunOt.amount, 312.5)
  assert.equal(timesheetHoursRateLine(sunOt), '6.5h × 2 − 0.5h break = 12.5h = 1.56 days × £200.00/day = £312.50')
})

// Rulebook 1.43.0 (owner rule, `payrollLineClockRanges`): the standard line shows the standard-window times and the
// overtime line the overtime times; pay is unchanged.
test('1.43.0: timesheet lines show the standard window and the overtime times (owner example 07:00–19:00)', async () => {
  const { initialHoursChoice } = await import('./payrollLineBookingLookup.ts')
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
  const run = (start: string, end: string, extra: Partial<Booking> = {}) =>
    collectTimesheetPayroll({
      user: user({ id: 'u1' }),
      bookings: [{ ...booking('b1', new Date('2026-11-11T10:00:00Z')), timeSlot: 'CUSTOM_HOURS', workStartTime: start, workEndTime: end, ...extra } as Booking],
      managerSiteBookings: [],
      operatives: [operative],
      projects: [project],
      smallWorks: [],
      periodStart: new Date('2026-11-01T00:00:00Z'),
      periodEnd: new Date('2026-11-15T00:00:00Z'),
      payrollPolicy: policy,
      timeZone: 'Europe/London',
    })
  const summary = run('07:00', '19:00')
  const normal = summary.lineItems.find((line) => line.id === 'op-b1-normal')
  const ot = summary.lineItems.find((line) => line.id === 'op-b1-ot')
  assert.equal(normal?.details, '07:00–16:00')
  assert.equal(ot?.details, '16:00–19:00')
  // Pay unchanged: 8.5h standard, 3h at 1.5.
  assert.deepEqual([normal?.paidHours, ot?.paidHours, ot?.otMultiplier], [8.5, 3, 1.5])
  // An early start and a late finish: two overtime ranges; "no break" stays on the standard line.
  const both = run('05:00', '19:00', { isBreakRemoved: true })
  assert.equal(both.lineItems.find((line) => line.id === 'op-b1-ot')?.details, '05:00–07:00 + 16:00–19:00')
  assert.equal(both.lineItems.find((line) => line.id === 'op-b1-normal')?.details, '07:00–16:00 · no break')
  // A named slot keeps its name.
  const full = run('', '', { timeSlot: 'FULL DAY', workStartTime: undefined, workEndTime: undefined })
  assert.equal(full.lineItems.find((line) => line.id === 'op-b1-normal')?.details, 'FULL DAY')
  // Edit hours still opens on the whole booking when the live booking is not loaded — from the line's stored booking
  // times, never from its standard-window details (review r318).
  assert.deepEqual(initialHoursChoice({ row: normal!, operativeBooking: null, managerBooking: null, policy }), {
    startTime: '07:00',
    endTime: '19:00',
    breakRemoved: false,
  })
  assert.deepEqual(initialHoursChoice({ row: ot!, operativeBooking: null, managerBooking: null, policy }), {
    startTime: '07:00',
    endTime: '19:00',
    breakRemoved: false,
  })
})
