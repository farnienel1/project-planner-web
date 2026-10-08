import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { collectTimesheetPayroll, timesheetHoursRateLine, timesheetRateAnnotation } from './timesheetPayrollCollector.ts'
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

test('payroll skips PAYE days after an employment-type transition', () => {
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
  const paye = summary.lineItems.find((line) => line.id === 'op-b2-normal')
  assert.ok(paye)
  assert.equal(paye.isPayeDay, true)
  assert.equal(paye.amount, 0)
  assert.ok(paye.paidHours > 0)
  assert.match(timesheetHoursRateLine(paye), /hours = £0\.00/)
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
    bookings: [withTimes('old', new Date('2026-09-20T08:00:00Z')), withTimes('now', new Date('2026-09-21T08:00:00Z'))],
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
