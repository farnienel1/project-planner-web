import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { DEFAULT_INVOICING, DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import { emptyTimesheetDraft } from './timesheetDraft.ts'
import { applyWeeklyReportOverride } from './weeklyReportOverride.ts'
import { weeklyReportOverrideFromFirestore, weeklyReportOverrideToFirestore } from './timesheetStorage.ts'
import { payPeriodsOverlapping } from './timesheetPayrollPolicy.ts'
import { invoiceLinesForTimesheet } from './timesheetExport.ts'
import { buildWeeklyReportData } from '../weekly-report/weeklyReportData.ts'
import type { ApprovedTimesheetWeek } from '../weekly-report/timesheetFeed.ts'
import type { TimesheetPayrollSummary } from './timesheetPayrollCollector.ts'

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
    assignedManagerUserId: 'mgr',
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

const day = new Date('2026-09-16T08:00:00Z')

function booking(partial: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    operativeId: 'op1',
    projectId: 'proj1',
    date: day,
    timeSlot: 'FULL DAY',
    bookedBy: 'Ada',
    status: 'Confirmed',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  }
}

const base = {
  user: user({ id: 'u1' }),
  weekStart: new Date('2026-09-14T00:00:00Z'),
  weekEnd: new Date('2026-09-20T00:00:00Z'),
  bookings: [booking()],
  managerSiteBookings: [],
  operatives: [operative],
  projects: [project],
  smallWorks: [],
  payrollPolicy: DEFAULT_PAYROLL_POLICY,
  timeZone: 'Europe/London',
}

test('full approval snapshots a half-day booking and does not require a full paid day', () => {
  const draft = applyWeeklyReportOverride({
    ...base,
    bookings: [booking({ timeSlot: 'AM' })],
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: day,
      operativeSignedByName: 'Ada Booked',
      managerSignedAt: day,
      managerSignedByUserId: 'mgr',
      managerSignedByName: 'Morgan Manager',
    },
  })
  const line = draft.weeklyReportOverride?.lines.find((row) => row.id === 'op-b1-normal')
  assert.ok(line)
  assert.equal(line.decision, 'approved')
  assert.ok(line.days > 0 && line.days < 1)
  assert.equal(line.locationKind, 'project')
  assert.equal(line.bookingId, 'b1')
  assert.equal(draft.weeklyReportOverride?.selfSigned, false)
  assert.equal(draft.weeklyReportOverride?.approvedByUserId, 'mgr')
})

test('a declined labour line stays on the snapshot with zero days and amount', () => {
  const draft = applyWeeklyReportOverride({
    ...base,
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: day,
      managerSignedAt: day,
      managerSignedByUserId: 'mgr',
      payrollLineReviews: { 'op-b1-normal': { decision: 'declined' } },
    },
  })
  const line = draft.weeklyReportOverride?.lines.find((row) => row.id === 'op-b1-normal')
  assert.equal(line?.decision, 'declined')
  assert.equal(line?.days, 0)
  assert.equal(line?.amount, 0)
})

test('later schedule changes do not rebuild stored labour lines', () => {
  const first = applyWeeklyReportOverride({
    ...base,
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: day,
      managerSignedAt: day,
      managerSignedByName: 'Morgan Manager',
      priceWorkEntries: [
        {
          id: 'pw1',
          title: 'Extra',
          details: 'First fix',
          jobNumber: 'J-1',
          agreedManagerName: 'Morgan',
          startDate: day,
          amount: 80,
          managerDecision: 'pending',
        },
      ],
      expenseEntries: [
        {
          id: 'ex1',
          title: 'Parking',
          details: '',
          jobNumber: 'J-1',
          date: day,
          amount: 12,
          managerDecision: 'declined',
        },
      ],
    },
  })
  assert.equal(first.weeklyReportOverride?.priceWork[0].decision, 'approved')
  assert.equal(first.weeklyReportOverride?.priceWork[0].amount, 80)
  assert.equal(first.weeklyReportOverride?.expenses[0].decision, 'declined')
  assert.equal(first.weeklyReportOverride?.expenses[0].amount, 0)

  const second = applyWeeklyReportOverride({
    ...base,
    bookings: [booking({ projectId: 'other' })],
    projects: [{ ...project, id: 'other', siteName: 'Moved Site', jobNumber: 'J-9' }],
    draft: {
      ...first,
      payrollLineReviews: { 'op-b1-normal': { decision: 'edited', revisedAmount: 50 } },
      priceWorkEntries: first.priceWorkEntries.map((entry) => ({
        ...entry,
        managerDecision: 'edited' as const,
        managerRevisedAmount: 40,
      })),
    },
  })
  const line = second.weeklyReportOverride?.lines.find((row) => row.id === 'op-b1-normal')
  assert.equal(line?.projectName, 'Site One')
  assert.equal(line?.decision, 'edited')
  assert.equal(line?.amount, 50)
  assert.equal(second.weeklyReportOverride?.priceWork[0].amount, 40)
  assert.equal(second.weeklyReportOverride?.priceWork[0].decision, 'edited')
})

test('no line manager: own signature is full approval and selfSigned', () => {
  const solo = user({ id: 'solo', hasNoLineManager: true, assignedManagerUserId: undefined })
  const draft = applyWeeklyReportOverride({
    ...base,
    user: solo,
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: day,
      operativeSignedByName: 'Ada Booked',
    },
  })
  assert.equal(draft.weeklyReportOverride?.selfSigned, true)
  assert.equal(draft.weeklyReportOverride?.approvedByName, 'Ada Booked')
})

test('clearing approval removes the override', () => {
  const approved = applyWeeklyReportOverride({
    ...base,
    draft: { ...emptyTimesheetDraft(), operativeSignedAt: day, managerSignedAt: day },
  })
  const cleared = applyWeeklyReportOverride({
    ...base,
    draft: { ...approved, operativeSignedAt: null, managerSignedAt: null },
  })
  assert.equal(cleared.weeklyReportOverride, null)
})

test('firestore map uses the shared weeklyReportOverride field names', () => {
  const approved = applyWeeklyReportOverride({
    ...base,
    draft: { ...emptyTimesheetDraft(), operativeSignedAt: day, managerSignedAt: day, managerSignedByUserId: 'mgr' },
  })
  const encoded = weeklyReportOverrideToFirestore(approved.weeklyReportOverride!)
  assert.equal(encoded.selfSigned, false)
  assert.ok(Array.isArray(encoded.lines))
  const line = (encoded.lines as Array<Record<string, unknown>>)[0]
  assert.equal(typeof line.locationKind, 'string')
  assert.equal(line.bookingId, 'b1')
  assert.equal('isOvertime' in line, true)
  const decoded = weeklyReportOverrideFromFirestore({
    ...encoded,
    approvedAt: { toDate: () => day },
    lines: (encoded.lines as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      date: { toDate: () => day },
    })),
    priceWork: [],
    expenses: [],
  })
  assert.equal(decoded?.lines[0].bookingId, 'b1')
  assert.equal(decoded?.approvedByUserId, 'mgr')
})

test('weekly report replaces live days with the agreed snapshot and includes price work', () => {
  const approved = applyWeeklyReportOverride({
    ...base,
    draft: {
      ...emptyTimesheetDraft(),
      operativeSignedAt: day,
      managerSignedAt: day,
      priceWorkEntries: [
        {
          id: 'pw1',
          title: 'Extra',
          details: 'First fix',
          jobNumber: 'J-1',
          agreedManagerName: 'Morgan',
          startDate: day,
          amount: 40,
          managerDecision: 'approved',
        },
      ],
    },
  })
  const normal = approved.weeklyReportOverride!.lines.find((row) => row.id === 'op-b1-normal')!
  normal.amount = 150
  const week: ApprovedTimesheetWeek = {
    userId: 'u1',
    personName: 'Ada Booked',
    role: 'Operative',
    trade: 'General',
    weekStart: base.weekStart,
    weekEnd: base.weekEnd,
    override: approved.weeklyReportOverride!,
  }
  const report = buildWeeklyReportData({
    organizationName: 'Acme',
    period: { start: base.weekStart, end: base.weekEnd, label: 'week' },
    bookings: [booking()],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [operative],
    users: [base.user],
    projects: [project],
    smallWorks: [],
    holidays: [],
    orgDetails: null,
    timesheetWeeks: [week],
  })
  const days = report.projectGroups.reduce((sum, group) => sum + group.projectTotal, 0)
  assert.ok(Math.abs(days - normal.days) < 0.02)
  assert.equal(report.priceWorkRows.length, 1)
  assert.equal(report.priceWorkTotal, 40)
  const pay = report.paySummary.find((row) => row.person === 'Ada Booked')
  assert.ok(pay)
  assert.ok(pay.lines.some((line) => line.rateType === 'Timesheet' && line.pay === 150))
  assert.ok(pay.lines.some((line) => line.rateType === 'Price work' && line.pay === 40))
  assert.equal(pay.lines.some((line) => line.rateType === 'Normal'), false)
})

test('export PDF lines skip declined override rows', () => {
  const payroll: TimesheetPayrollSummary = {
    totalHours: 8,
    overtimeHours: 0,
    shiftCount: 1,
    baseAmount: 200,
    overtimeAmount: 0,
    workAmount: 200,
    lineItems: [],
  }
  const lines = invoiceLinesForTimesheet({
    payroll,
    timeZone: 'Europe/London',
    extrasMode: 'export',
    draft: {
      ...emptyTimesheetDraft(),
      weeklyReportOverride: {
        approvedAt: day,
        approvedByUserId: 'mgr',
        approvedByName: 'Morgan',
        selfSigned: false,
        lines: [
          {
            id: 'op-b1-normal',
            date: day,
            jobNumber: 'J-1',
            projectName: 'Site One',
            locationKind: 'project',
            details: 'Full day',
            paidHours: 8,
            days: 1,
            amount: 200,
            isOvertime: false,
            decision: 'approved',
            bookingId: 'b1',
          },
          {
            id: 'op-b2-normal',
            date: day,
            jobNumber: 'J-1',
            projectName: 'Site One',
            locationKind: 'project',
            details: 'Cancelled',
            paidHours: 8,
            days: 0,
            amount: 0,
            isOvertime: false,
            decision: 'declined',
            bookingId: 'b2',
          },
        ],
        priceWork: [],
        expenses: [
          {
            id: 'ex1',
            title: 'Parking',
            details: '',
            jobNumber: 'J-1',
            date: day,
            amount: 0,
            decision: 'declined',
          },
        ],
      },
    },
  })
  assert.equal(lines.length, 1)
  assert.equal(lines[0].projectName, 'Site One')
  assert.equal(lines[0].amount, 200)
})

test('pay periods overlapping a midweek report stay on that pay run', () => {
  const periods = payPeriodsOverlapping(
    new Date('2026-09-16T12:00:00Z'),
    new Date('2026-09-16T12:00:00Z'),
    DEFAULT_INVOICING,
    'Europe/London'
  )
  assert.equal(periods.length, 1)
  assert.equal(periods[0].start.toISOString().slice(0, 10) <= '2026-09-16', true)
  assert.equal(periods[0].end.toISOString().slice(0, 10) >= '2026-09-16', true)
})
