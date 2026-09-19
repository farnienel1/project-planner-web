import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type Booking, type HolidayBooking, type Operative, type Project, type User } from '../../types/index.ts'
import { DEFAULT_PAYROLL_POLICY, DEFAULT_WARNING_DETECTION } from '../settings/organizationSettings.ts'
import { computeWarningCoverageWindow, formatNumberOfDaysScanSummary } from './warningLookahead.ts'
import { computeUnbookedLabourWarnings } from './unbookedLabourWarnings.ts'
import { computeOperativeBookingClashWarnings } from '../scheduling/bookingClashUtils.ts'
import { computeManagerBookingClashWarnings } from './managerClashWarnings.ts'
import { computeMissedMaterialOrderWarnings } from './materialOrderWarnings.ts'
import { generateOrgWarnings } from './generateOrgWarnings.ts'
import { londonMidnight, dayKey } from '../ios-parity/londonTime.ts'

const WED = new Date('2026-09-16T12:00:00+01:00')

function perms(partial: Partial<User['permissions']> = {}): User['permissions'] {
  return {
    adminAccess: false,
    manager: false,
    operatives: false,
    skills: false,
    qualifications: false,
    materials: true,
    projects: true,
    smallWorks: true,
    operativeMode: false,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: true,
    subContractors: false,
    siteAudit: true,
    wholesalersOrderHistory: true,
    ...partial,
  }
}

function user(partial: Partial<User> & { id: string; email: string }): User {
  return {
    firstName: 'Ada',
    surname: 'Lovelace',
    organizationId: 'org',
    role: UserRole.OPERATIVE,
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    policyAccepted: true,
    permissions: perms({ operativeMode: true }),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  } as User
}

function operative(partial: Partial<Operative> & { id: string; email: string }): Operative {
  return {
    firstName: 'Ada',
    lastName: 'Booked',
    phone: '',
    startDate: new Date('2026-01-01T00:00:00Z'),
    hourlyRate: 20,
    skills: [],
    qualifications: [],
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    organizationId: 'org',
    ...partial,
  } as Operative
}

function booking(partial: Partial<Booking> & { id: string; operativeId: string }): Booking {
  return {
    projectId: 'P1',
    date: WED,
    timeSlot: 'FULL DAY',
    bookedBy: 'admin',
    status: 'Confirmed',
    createdAt: WED,
    updatedAt: WED,
    ...partial,
  }
}

function project(id = 'P1'): Project {
  return {
    id,
    jobNumber: 'J-100',
    siteName: 'Riverside',
    addressLine1: '1 High St',
    townCity: 'London',
    postcode: 'E1 1AA',
    client: { id: 'c', name: 'Acme', createdAt: WED, updatedAt: WED },
    startDate: WED,
    endDate: WED,
    jobType: 'CAT A',
    manager: { name: 'Custom', email: '' },
    isLive: true,
    createdAt: WED,
    updatedAt: WED,
  } as Project
}

test('Full week coverage is Monday through Sunday, including past days', () => {
  const window = computeWarningCoverageWindow(WED, {
    ...DEFAULT_WARNING_DETECTION,
    clashLookaheadMode: 'endOfWorkingWeek',
  })
  assert.equal(dayKey(window.start), '2026-09-14')
  assert.equal(dayKey(window.end), '2026-09-20')
})

test('numberOfDays coverage starts today and is inclusive', () => {
  const window = computeWarningCoverageWindow(WED, {
    ...DEFAULT_WARNING_DETECTION,
    clashLookaheadMode: 'numberOfDays',
    clashLookaheadDays: 7,
  })
  assert.equal(londonMidnight(window.start).getTime(), londonMidnight(WED).getTime())
  assert.equal(londonMidnight(window.end).getTime(), londonMidnight(new Date('2026-09-22T12:00:00+01:00')).getTime())
})

test('2 days ahead is today and tomorrow, not two days after today', () => {
  const window = computeWarningCoverageWindow(WED, {
    ...DEFAULT_WARNING_DETECTION,
    clashLookaheadMode: 'numberOfDays',
    clashLookaheadDays: 2,
  })
  assert.equal(dayKey(window.start), '2026-09-16')
  assert.equal(dayKey(window.end), '2026-09-17')
  const summary = formatNumberOfDaysScanSummary(2, WED)
  assert.match(summary, /today and tomorrow/)
  assert.match(summary, /included/)
})

test('unbooked labour includes managers, unlinked roster, and under-hours AM bookings', () => {
  const detection = {
    ...DEFAULT_WARNING_DETECTION,
    clashLookaheadMode: 'numberOfDays' as const,
    clashLookaheadDays: 1,
  }
  const opUser = user({
    id: 'U-OP',
    email: 'ada@site.test',
    firstName: 'Ada',
    surname: 'Operative',
    permissions: perms({ operativeMode: true }),
  })
  const mgrUser = user({
    id: 'U-MGR',
    email: 'morgan@site.test',
    firstName: 'Morgan',
    surname: 'Manager',
    role: UserRole.MANAGER,
    permissions: perms({ manager: true, operativeMode: false }),
  })
  const linked = operative({ id: 'OP-ADA', email: 'ada@site.test', firstName: 'Ada', lastName: 'Operative' })
  const rosterOnly = operative({ id: 'OP-BOB', email: 'bob@site.test', firstName: 'Bob', lastName: 'Roster' })
  const amOnly = operative({ id: 'OP-CAM', email: 'cam@site.test', firstName: 'Cam', lastName: 'Half' })
  const camUser = user({
    id: 'U-CAM',
    email: 'cam@site.test',
    firstName: 'Cam',
    surname: 'Half',
    permissions: perms({ operativeMode: true }),
  })

  const warnings = computeUnbookedLabourWarnings({
    bookings: [
      booking({ id: 'B-AM', operativeId: 'OP-CAM', timeSlot: 'AM' }),
      booking({ id: 'B-FULL', operativeId: 'OP-ADA', timeSlot: 'FULL DAY' }),
    ],
    managerSiteBookings: [],
    operatives: [linked, rosterOnly, amOnly],
    users: [opUser, mgrUser, camUser],
    holidays: [] as HolidayBooking[],
    warningDetection: detection,
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
    referenceDate: WED,
  })

  const names = warnings.map((w) => w.operativeName).sort()
  assert.ok(names.includes('Morgan Manager'), `managers must be scanned: ${names.join(', ')}`)
  assert.ok(names.includes('Bob Roster'), `unlinked roster must be scanned: ${names.join(', ')}`)
  assert.ok(names.includes('Cam Half'), `AM-only is below a standard paid day: ${names.join(', ')}`)
  assert.ok(!names.includes('Ada Operative'), 'full-day booked operative is not unbooked')
  const cam = warnings.find((w) => w.operativeName === 'Cam Half')
  assert.equal(cam?.missingHours, 4)
})

test('approved holiday suppresses unbooked labour for that person-day', () => {
  const detection = {
    ...DEFAULT_WARNING_DETECTION,
    clashLookaheadMode: 'numberOfDays' as const,
    clashLookaheadDays: 1,
  }
  const opUser = user({ id: 'U-OP', email: 'ada@site.test' })
  const linked = operative({ id: 'OP-ADA', email: 'ada@site.test' })
  const warnings = computeUnbookedLabourWarnings({
    bookings: [],
    operatives: [linked],
    users: [opUser],
    holidays: [
      {
        id: 'H1',
        organizationId: 'org',
        userId: 'U-OP',
        operativeId: 'OP-ADA',
        startDate: WED,
        endDate: WED,
        status: 'approved',
        timeSlot: 'FULL DAY',
        createdAt: WED,
        updatedAt: WED,
      } as HolidayBooking,
    ],
    warningDetection: detection,
    referenceDate: WED,
  })
  assert.equal(warnings.length, 0)
})

test('operative clashes use clock intervals and skip manager-admin emails', () => {
  const op = operative({ id: 'OP1', email: 'ada@site.test', firstName: 'Ada', lastName: 'Op' })
  const mgrOp = operative({ id: 'OP2', email: 'boss@site.test', firstName: 'Boss', lastName: 'Mgr' })
  const managerUser = user({
    id: 'U-MGR',
    email: 'boss@site.test',
    permissions: perms({ manager: true, operativeMode: false }),
    role: UserRole.MANAGER,
  })
  const clashes = computeOperativeBookingClashWarnings(
    [
      booking({ id: 'A', operativeId: 'OP1', projectId: 'P1', timeSlot: 'FULL DAY' }),
      booking({ id: 'B', operativeId: 'OP1', projectId: 'P2', timeSlot: 'FULL DAY' }),
      booking({ id: 'C', operativeId: 'OP2', projectId: 'P1', timeSlot: 'FULL DAY' }),
      booking({ id: 'D', operativeId: 'OP2', projectId: 'P2', timeSlot: 'FULL DAY' }),
    ],
    [op, mgrOp],
    [project('P1'), project('P2')],
    { users: [managerUser], payrollPolicy: DEFAULT_PAYROLL_POLICY }
  )
  assert.equal(clashes.length, 1)
  assert.equal(clashes[0].operativeName, 'Ada Op')
  assert.equal(clashes[0].entries.length, 2)
  assert.equal(clashes[0].entries[0].startMinutes, 7 * 60 + 30)
  assert.equal(clashes[0].entries[0].endMinutes, 16 * 60)
})

test('AM and PM on the same day do not clash; manager dual-role merges operative bookings', () => {
  const amPm = computeOperativeBookingClashWarnings(
    [
      booking({ id: 'A', operativeId: 'OP1', projectId: 'P1', timeSlot: 'AM' }),
      booking({ id: 'B', operativeId: 'OP1', projectId: 'P2', timeSlot: 'PM' }),
    ],
    [operative({ id: 'OP1', email: 'ada@site.test' })],
    [project('P1'), project('P2')]
  )
  assert.equal(amPm.length, 0)

  const managerUser = user({
    id: 'U-MGR',
    email: 'boss@site.test',
    firstName: 'Boss',
    surname: 'Mgr',
    permissions: perms({ manager: true }),
    role: UserRole.MANAGER,
  })
  const mgrOp = operative({ id: 'OP-BOSS', email: 'boss@site.test', firstName: 'Boss', lastName: 'Mgr' })
  const merged = computeManagerBookingClashWarnings(
    [
      {
        id: 'M1',
        userId: 'U-MGR',
        date: WED,
        timeSlot: 'FULL_DAY',
        locationType: 'office',
        createdAt: WED,
        updatedAt: WED,
      },
    ],
    [managerUser],
    [project('P1')],
    {
      operativeBookings: [booking({ id: 'O1', operativeId: 'OP-BOSS', projectId: 'P1', timeSlot: 'FULL DAY' })],
      operatives: [mgrOp],
      payrollPolicy: DEFAULT_PAYROLL_POLICY,
    }
  )
  assert.equal(merged.length, 1)
  assert.equal(merged[0].personName, 'Boss Mgr')
  assert.equal(merged[0].entries.length, 2)
  assert.ok(merged[0].entries.some((entry) => entry.managerBookingId === 'M1'))
  assert.ok(merged[0].entries.some((entry) => entry.bookingId === 'O1' && !entry.managerBookingId))
})

test('materials cutoff fires after 16:00 for tomorrow bookings, including empty lists', () => {
  const afterCutoff = new Date('2026-09-16T16:30:00+01:00')
  const beforeCutoff = new Date('2026-09-16T15:00:00+01:00')
  const tomorrow = new Date('2026-09-17T08:00:00+01:00')
  const works = [project('P1')]
  const bookings = [booking({ id: 'B1', operativeId: 'OP1', date: tomorrow, projectId: 'P1' })]

  const noneYet = computeMissedMaterialOrderWarnings([], [], works, bookings, {
    enabled: true,
    referenceDate: afterCutoff,
  })
  assert.equal(noneYet.length, 1)
  assert.match(noneYet[0].message, /No materials have been ordered/)

  const tooEarly = computeMissedMaterialOrderWarnings([], [], works, bookings, {
    enabled: true,
    referenceDate: beforeCutoff,
  })
  assert.equal(tooEarly.length, 0)
})

test('materials cutoff uses the configured hour and minute, not a hardcoded 16:00', () => {
  const tomorrow = new Date('2026-09-17T08:00:00+01:00')
  const works = [project('P1')]
  const bookings = [booking({ id: 'B1', operativeId: 'OP1', date: tomorrow, projectId: 'P1' })]
  const atTwo = new Date('2026-09-16T14:00:00+01:00')
  const beforeTwo = new Date('2026-09-16T13:30:00+01:00')

  assert.equal(
    computeMissedMaterialOrderWarnings([], [], works, bookings, {
      enabled: true,
      cutOffHour: 14,
      cutOffMinute: 0,
      referenceDate: atTwo,
    }).length,
    1
  )
  assert.equal(
    computeMissedMaterialOrderWarnings([], [], works, bookings, {
      enabled: true,
      cutOffHour: 14,
      cutOffMinute: 0,
      referenceDate: beforeTwo,
    }).length,
    0
  )
})

test('generateOrgWarnings core count matches iOS (clashes + unbooked person-days + materials)', () => {
  const detection = {
    ...DEFAULT_WARNING_DETECTION,
    clashLookaheadMode: 'numberOfDays' as const,
    clashLookaheadDays: 1,
  }
  const opUser = user({ id: 'U-OP', email: 'ada@site.test' })
  const linked = operative({ id: 'OP-ADA', email: 'ada@site.test' })
  const result = generateOrgWarnings({
    bookings: [],
    managerSiteBookings: [],
    operatives: [linked],
    users: [opUser],
    projects: [project()],
    holidays: [],
    warningDetection: detection,
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
    referenceDate: new Date('2026-09-16T10:00:00+01:00'),
  })
  assert.equal(result.unbookedWarnings.length, 1)
  assert.equal(result.coreCount, 1)
  assert.equal(result.highCount, 1)
})
