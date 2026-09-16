import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type Booking, type Operative, type User } from '../../types/index.ts'
import { DEFAULT_PAYROLL_POLICY } from '../settings/organizationSettings.ts'
import { enabledScheduleLocationPicks } from '../settings/organizationSettings.ts'
import { buildBookLabourCandidates } from './candidates.ts'

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
    date: new Date('2026-09-16T12:00:00+01:00'),
    timeSlot: 'FULL DAY',
    bookedBy: 'admin',
    status: 'Confirmed',
    createdAt: new Date('2026-09-16T12:00:00+01:00'),
    updatedAt: new Date('2026-09-16T12:00:00+01:00'),
    ...partial,
  }
}

const WED = new Date('2026-09-16T12:00:00+01:00')
const SAT = new Date('2026-09-19T12:00:00+01:00')

test('book labour candidates skip weekends and fully booked operatives', () => {
  const opUser = user({ id: 'U-OP', email: 'ada@site.test' })
  const linked = operative({ id: 'OP-ADA', email: 'ada@site.test' })
  const mgr = user({
    id: 'U-MGR',
    email: 'boss@site.test',
    firstName: 'Boss',
    surname: 'Mgr',
    role: UserRole.MANAGER,
    permissions: perms({ manager: true }),
  })

  const weekend = buildBookLabourCandidates({
    day: SAT,
    users: [opUser, mgr],
    operatives: [linked],
    bookings: [],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(weekend.length, 0)

  const weekday = buildBookLabourCandidates({
    day: WED,
    users: [opUser, mgr],
    operatives: [linked],
    bookings: [],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(weekday.length, 2)
  assert.ok(weekday.some((row) => row.id === 'U-OP' && row.usesOperativeProjectBookings))
  assert.ok(weekday.some((row) => row.id === 'U-MGR' && row.canBookOtherLocations))

  const booked = buildBookLabourCandidates({
    day: WED,
    users: [opUser, mgr],
    operatives: [linked],
    bookings: [booking({ id: 'B1', operativeId: 'OP-ADA' })],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(
    booked.some((row) => row.id === 'U-OP'),
    false
  )
  assert.equal(
    booked.some((row) => row.id === 'U-MGR'),
    true
  )
})

test('enabledScheduleLocationPicks matches iOS Other locations', () => {
  const picks = enabledScheduleLocationPicks({
    showOffice: true,
    showWorkingFromHome: false,
    showSiteSurvey: true,
    customItems: ['Yard'],
    customItemEnabled: {},
  })
  assert.deepEqual(
    picks.map((p) => p.title),
    ['Office', 'Site survey', 'Yard']
  )
})
