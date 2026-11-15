import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Booking, Operative, Project, User } from '../../types/index.ts'
import { buildWeeklyReportData } from './weeklyReportData.ts'

const day = new Date('2026-10-08T08:00:00Z')
const next = new Date('2026-10-09T08:00:00Z')

function person(): User {
  return {
    id: 'u1',
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
    createdAt: day,
    updatedAt: day,
    dayRate: 200,
    employmentType: 'self_employed',
  } as User
}

const operative: Operative = {
  id: 'op1',
  firstName: 'Ada',
  lastName: 'Booked',
  email: 'ada@x.com',
  startDate: day,
  hourlyRate: 0,
  dayRate: 200,
  skills: [],
  qualifications: [],
  isActive: true,
  createdAt: day,
  updatedAt: day,
}

const project: Project = {
  id: 'proj1',
  jobNumber: 'J-1',
  siteName: 'Site One',
  addressLine1: '1 Road',
  townCity: 'London',
  postcode: 'E1 1AA',
  client: { id: 'c1', name: 'Client', createdAt: day, updatedAt: day },
  startDate: day,
  endDate: next,
  jobType: 'CAT A',
  manager: { name: 'Custom', email: '' },
  isLive: true,
  createdAt: day,
  updatedAt: day,
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
    createdAt: day,
    updatedAt: day,
  }
}

test('a person with two bookings on one job is one project row', () => {
  const report = buildWeeklyReportData({ showAllPay: true,
    organizationName: 'Acme',
    period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
    bookings: [booking('b1', day), booking('b2', next)],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [operative],
    users: [person()],
    projects: [project],
    smallWorks: [],
    holidays: [],
    orgDetails: null,
  })
  const group = report.projectGroups[0]
  assert.equal(group?.rows.length, 1)
  assert.equal(group?.rows[0]?.person, 'Ada Booked')
  assert.equal(group?.rows[0]?.days, 2)
  assert.equal(group?.projectTotal, 2)
})

test('cancelled bookings are not counted, and bookings under a users id or former invite id are named', () => {
  const rehired: User = { ...person(), id: 'rehiredUid0001', email: 'rehired@x.com', firstName: 'Re', surname: 'Hired', formerUserIds: ['PLACEHOLDER-0001'] }
  const report = buildWeeklyReportData({ showAllPay: true,
    organizationName: 'Acme',
    period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
    bookings: [
      booking('kept', day),
      { ...booking('cancelled', next), status: 'Cancelled' },
      { ...booking('by-uid', day), operativeId: 'rehiredUid0001' },
      { ...booking('by-placeholder', next), operativeId: 'PLACEHOLDER-0001' },
    ],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [operative],
    users: [person(), rehired],
    projects: [project],
    smallWorks: [],
    holidays: [],
    orgDetails: null,
  })
  const rows = report.projectGroups[0]?.rows ?? []
  const ada = rows.find((row) => row.person === 'Ada Booked')
  const re = rows.find((row) => row.person === 'Re Hired')
  assert.equal(ada?.days, 1)
  assert.equal(re?.days, 2)
})

test('1.29.0: a PAYE person leaves the hours and pay rows and their overtime is in the PAYE overtime section', () => {
  const paye = { ...person(), id: 'u2', email: 'pat@x.com', firstName: 'Pat', surname: 'Paye', employmentType: 'paye' } as User
  const payeOperative: Operative = { ...operative, id: 'op2', firstName: 'Pat', lastName: 'Paye', email: 'pat@x.com' }
  const payeBooking = { ...booking('b3', day), operativeId: 'op2' }
  const payeOvertime = { ...booking('b4', next), operativeId: 'op2', timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00' }
  const input = {
    organizationName: 'Acme',
    period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
    bookings: [booking('b1', day), booking('b2', next), payeBooking, payeOvertime],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [operative, payeOperative],
    users: [person(), paye],
    projects: [project],
    smallWorks: [],
    holidays: [],
    orgDetails: null,
  }
  const report = buildWeeklyReportData({ ...input, showAllPay: true })
  assert.equal(report.paySummary.find((row) => row.person === 'Pat Paye'), undefined, 'PAYE person is not in the pay rows')
  const ada = report.paySummary.find((row) => row.person === 'Ada Booked')
  assert.equal(ada?.personTotal, 400)
  assert.equal(report.grandTotal, 400)
  const rows = report.projectGroups[0]?.rows ?? []
  assert.equal(rows.find((row) => row.person === 'Pat Paye'), undefined, 'PAYE person is not in the hours rows')
  assert.deepEqual(
    report.payeOvertimeRows.map((row) => [row.person, row.jobNumber, row.overtimeHours]),
    [['Pat Paye', project.jobNumber, 3]]
  )
  assert.equal(report.payeOvertimeTotal, 3)
})

test('a booking under the other same-email profile is named through the roster aliases, as on Daily Overview', () => {
  const manager: User = { ...person(), id: 'keptManagerUid', email: 'tm@x.com', firstName: 'Test', surname: 'Manager' }
  const input = {
    organizationName: 'Acme',
    period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
    // The roster lists only the kept account; the duplicate profile id is in its alias map.
    bookings: [{ ...booking('dup', day), operativeId: 'DUPLICATE-PROFILE-ID' }],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [],
    users: [manager],
    projects: [project],
    smallWorks: [],
    holidays: [],
    orgDetails: null,
  }
  assert.equal(buildWeeklyReportData({ ...input, showAllPay: true }).projectGroups[0]?.rows[0]?.person, 'Unknown')
  const named = buildWeeklyReportData({ showAllPay: true,
    ...input,
    userIdAliases: { keptManagerUid: 'keptManagerUid', 'duplicate-profile-id': 'keptManagerUid' },
  })
  assert.deepEqual(
    named.projectGroups[0]?.rows.map((row) => [row.person, row.days]),
    [['Test Manager', 1]]
  )
})

test('rulebook 1.10.0 §5: a dismissed clash is not open on the weekly report; an approved one is listed separately', async () => {
  const { clashPairKey } = await import('../canonical/scheduleSources.ts')
  const base = {
    organizationName: 'Acme',
    period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
    bookings: [booking('b1', day), booking('b2', day)],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [operative],
    users: [person()],
    projects: [project],
    smallWorks: [],
    holidays: [],
    orgDetails: { countryCode: 'GB', warningDetection: { detectClashes: true } } as never,
  }
  const open = buildWeeklyReportData({ showAllPay: true, ...base, warningDecisions: { resolvedKeys: [], approvedKeys: [], acceptedClashes: [] } })
  assert.equal(open.warnings.filter((row) => row.type === 'Booking clash').length, 1)
  const key = clashPairKey('b1', 'b2')
  const dismissed = buildWeeklyReportData({ showAllPay: true, ...base, warningDecisions: { resolvedKeys: [key], approvedKeys: [], acceptedClashes: [] } })
  assert.equal(dismissed.warnings.filter((row) => row.type === 'Booking clash').length, 0)
  assert.equal(dismissed.approvedClashes.length, 0)
  const approved = buildWeeklyReportData({ showAllPay: true, ...base, warningDecisions: { resolvedKeys: [key], approvedKeys: [key], acceptedClashes: [] } })
  assert.equal(approved.warnings.filter((row) => row.type === 'Booking clash').length, 0)
  assert.equal(approved.approvedClashes.length, 1)
})

test('pay uses the working hours in effect on each booking day, not today\'s (orgPayrollPolicyForDay)', async () => {
  const { DEFAULT_PAYROLL_POLICY } = await import('../settings/organizationSettings.ts')
  const nineHourDay = { ...DEFAULT_PAYROLL_POLICY, standardDayEnd: '17:00', standardPaidHours: 9 }
  const custom = { ...booking('c1', day), timeSlot: 'Custom', workStartTime: '07:30', workEndTime: '17:00' } as Booking
  const base = {
    organizationName: 'Acme',
    period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
    bookings: [custom],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [operative],
    users: [person()],
    projects: [project],
    smallWorks: [],
    holidays: [],
  }
  const before = buildWeeklyReportData({ showAllPay: true,
    ...base,
    orgDetails: { countryCode: 'GB', payrollTimePolicy: DEFAULT_PAYROLL_POLICY } as never,
  })
  // The 9-hour day applies from 20 Oct; the 8 Oct booking keeps the prior 8-hour rules.
  const changedLater = buildWeeklyReportData({ showAllPay: true,
    ...base,
    orgDetails: {
      countryCode: 'GB',
      payrollTimePolicy: nineHourDay,
      payrollTimePolicyPrior: DEFAULT_PAYROLL_POLICY,
      payrollTimePolicyEffectiveFrom: '2026-10-20',
    } as never,
  })
  const appliedBefore = buildWeeklyReportData({ showAllPay: true,
    ...base,
    orgDetails: {
      countryCode: 'GB',
      payrollTimePolicy: nineHourDay,
      payrollTimePolicyPrior: DEFAULT_PAYROLL_POLICY,
      payrollTimePolicyEffectiveFrom: '2026-10-01',
    } as never,
  })
  assert.equal(changedLater.grandTotal, before.grandTotal)
  assert.notEqual(appliedBefore.grandTotal, before.grandTotal)
})

test('pay rows are grouped by person, not by display name', () => {
  const twin = { ...person(), id: 'u9', email: 'other.ada@x.com' } as User
  const twinOperative: Operative = { ...operative, id: 'op9', email: 'other.ada@x.com', dayRate: 100 }
  const report = buildWeeklyReportData({ showAllPay: true,
    organizationName: 'Acme',
    period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
    bookings: [booking('b1', day), { ...booking('b9', day), operativeId: 'op9' }],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [operative, twinOperative],
    users: [person(), { ...twin, dayRate: 100 } as User],
    projects: [project],
    smallWorks: [],
    holidays: [],
    orgDetails: null,
  })
  const named = report.paySummary.filter((row) => row.person === 'Ada Booked')
  assert.equal(named.length, 2)
  assert.deepEqual(named.map((row) => row.personTotal).sort((a, b) => a - b), [100, 200])
})

test('1.29.0 review fix: PAYE days never reach hours, pay or additional-schedule rows from the timesheet feed or office bookings', () => {
  const paye = { ...person(), id: 'u2', email: 'pat@x.com', firstName: 'Pat', surname: 'Paye', employmentType: 'paye' } as User
  const feedLine = (id: string, locationKind: string) => ({
    id,
    bookingId: id,
    date: day,
    jobNumber: project.jobNumber,
    projectName: project.siteName,
    locationKind,
    details: '',
    paidHours: 8,
    days: 1,
    amount: 200,
    isOvertime: false,
    decision: 'approved',
    // 1.53.0 (A1): a signed line follows its own flag; the collector marks a PAYE day's line `isPayeDay`.
    isPayeDay: true,
  })
  const payeWeek = {
    userId: 'u2',
    personName: 'Pat Paye',
    role: 'Operative',
    trade: 'General',
    weekStart: new Date('2026-10-05T00:00:00Z'),
    weekEnd: new Date('2026-10-11T00:00:00Z'),
    override: {
      approvedAt: day,
      approvedByUserId: 'admin',
      approvedByName: 'Admin',
      selfSigned: false,
      lines: [feedLine('f1', 'project'), feedLine('f2', 'office')],
      priceWork: [],
      expenses: [],
    },
  }
  const office = {
    id: 'm1',
    userId: 'u2',
    date: day,
    timeSlot: 'CUSTOM_HOURS',
    locationType: 'office' as const,
    workStartTime: '07:30',
    workEndTime: '16:00',
    createdAt: day,
    updatedAt: day,
  }
  const base = {
    organizationName: 'Acme',
    period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
    bookings: [booking('b1', day), booking('b2', next)],
    managerSiteBookings: [],
    subcontractorBookings: [],
    subcontractors: [],
    operatives: [operative],
    users: [person(), paye],
    projects: [project],
    smallWorks: [],
    holidays: [],
    orgDetails: null,
  }
  const without = buildWeeklyReportData({ ...base, showAllPay: true })
  const withPaye = buildWeeklyReportData({ showAllPay: true,
    ...base,
    managerSiteBookings: [office],
    timesheetWeeks: [payeWeek] as never,
  })
  const named = (rows: Array<{ person: string }>) => rows.filter((row) => row.person === 'Pat Paye').length
  assert.equal(named(withPaye.paySummary), 0)
  assert.equal(named(withPaye.projectGroups.flatMap((group) => group.rows)), 0)
  assert.equal(named(withPaye.managerScheduleRows), 0)
  // Everyone else's totals are unchanged.
  assert.equal(withPaye.grandTotal, without.grandTotal)
  assert.equal(withPaye.allProjectWorkTotal, without.allProjectWorkTotal)
  assert.equal(withPaye.managerScheduleTotal, without.managerScheduleTotal)
})

// Rulebook 1.53.0 sweep fixes (web).
const base153 = () => ({
  organizationName: 'Acme',
  period: { start: new Date('2026-10-05T00:00:00Z'), end: new Date('2026-10-11T00:00:00Z'), label: 'week' },
  bookings: [booking('b1', day)],
  managerSiteBookings: [],
  subcontractorBookings: [],
  subcontractors: [],
  operatives: [operative],
  users: [person()],
  projects: [project],
  smallWorks: [],
  holidays: [],
  orgDetails: null,
  showAllPay: true,
})

test('1.53.0 B8 a manager site booking whose job was deleted (no locationId) is still priced, as "Deleted job"', () => {
  const admin = { ...person(), id: 'u9', email: 'm@x.com', firstName: 'Mo', surname: 'Manager', role: 'manager', permissions: { ...person().permissions, operativeMode: false, manager: true } } as User
  const orphan = { id: 'm1', userId: 'u9', date: day, timeSlot: 'FULL DAY', locationType: 'project' as const, createdAt: day, updatedAt: day }
  const data = buildWeeklyReportData({ ...base153(), users: [person(), admin], managerSiteBookings: [orphan] })
  const mo = data.paySummary.find((row) => row.person === 'Mo Manager')
  assert.ok(mo && mo.personTotal > 0, 'the orphan booking is paid')
  assert.ok(data.projectGroups.some((group) => group.projectName === 'Deleted job' && group.rows.some((row) => row.person === 'Mo Manager')))
})

test('1.53.0 B10 Role column is the user level (Admin / Manager / Operative)', () => {
  const data = buildWeeklyReportData(base153())
  assert.deepEqual(data.paySummary.map((row) => row.role), ['Operative'])
})

test('1.53.0 B14 Project Breakdown keeps two people with the same name apart', () => {
  const twin = { ...person(), id: 'u2', email: 'ada2@x.com' } as User
  const twinOp = { ...operative, id: 'op2', email: 'ada2@x.com' }
  const second = { ...booking('b2', day), operativeId: 'op2' }
  const data = buildWeeklyReportData({ ...base153(), users: [person(), twin], operatives: [operative, twinOp], bookings: [booking('b1', day), second] })
  const rows = data.projectGroups.flatMap((group) => group.rows).filter((row) => row.person === 'Ada Booked')
  assert.equal(rows.length, 2)
})

test('1.53.0 B9 price work rows sort by the real date, not the date text', () => {
  const week = {
    userId: 'u1',
    personName: 'Ada Booked',
    role: 'Operative',
    trade: 'General',
    weekStart: new Date('2026-10-05T00:00:00Z'),
    weekEnd: new Date('2026-10-11T00:00:00Z'),
    override: {
      approvedAt: day,
      approvedByUserId: 'admin',
      approvedByName: 'Admin',
      selfSigned: false,
      lines: [],
      priceWork: [
        { id: 'p1', date: new Date('2026-10-10T08:00:00Z'), amount: 10, title: 'Later', jobNumber: 'J', details: '' },
        { id: 'p2', date: new Date('2026-10-09T08:00:00Z'), amount: 10, title: 'Earlier', jobNumber: 'J', details: '' },
      ],
      expenses: [],
    },
  }
  const data = buildWeeklyReportData({ ...base153(), timesheetWeeks: [week] as never })
  // "10 Oct" sorts before "9 Oct" as text; by date 9 Oct comes first.
  assert.deepEqual(data.priceWorkRows.map((row) => row.title), ['Earlier', 'Later'])
})

test('1.53.0 B7 a bank holiday inside a week of leave is not a leave day on the report', () => {
  const holiday = {
    id: 'h1',
    userId: 'u1',
    startDate: new Date('2026-10-05T00:00:00Z'),
    endDate: new Date('2026-10-09T00:00:00Z'),
    startDayKey: '2026-10-05',
    endDayKey: '2026-10-09',
    timeSlot: 'FULL DAY',
    status: 'approved',
    createdAt: day,
    updatedAt: day,
  }
  const without = buildWeeklyReportData({ ...base153(), holidays: [holiday] as never })
  const withBank = buildWeeklyReportData({ ...base153(), holidays: [holiday] as never, bankHolidayDayKeys: ['2026-10-07'] })
  assert.equal(without.annualLeaveTotal, 5)
  assert.equal(withBank.annualLeaveTotal, 4)
})
