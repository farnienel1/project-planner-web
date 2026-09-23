import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type Booking, type Operative, type User } from '../../types/index.ts'
import {
  DEFAULT_MY_SCHEDULE,
  DEFAULT_PAYROLL_POLICY,
  enabledScheduleLocationPicks,
  oneOffCustomLocationPick,
} from '../settings/organizationSettings.ts'
import { buildBookLabourCandidates } from './candidates.ts'
import { listUnbookedLabour } from '../daily-overview/buildDailyOverview.ts'

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
  assert.ok(weekday.some((row) => row.id === 'U-OP' && row.usesOperativeProjectBookings && row.canBookOtherLocations))
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

test('book labour includes unlinked operative users and name-matched roster', () => {
  const unlinked = user({
    id: 'U-UNLINKED',
    email: 'no-match@site.test',
    firstName: 'Una',
    surname: 'Linked',
  })
  const named = user({
    id: 'U-NAME',
    email: 'alias@site.test',
    firstName: 'Cam',
    surname: 'Half',
  })
  const roster = operative({ id: 'OP-CAM', email: 'cam@site.test', firstName: 'Cam', lastName: 'Half' })

  const people = buildBookLabourCandidates({
    day: WED,
    users: [unlinked, named],
    operatives: [roster],
    bookings: [],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.ok(
    people.some((row) => row.id === 'U-UNLINKED' && !row.linkedOperative),
    'unlinked operative users must still appear so Daily overview Book labour is not empty'
  )
  assert.ok(
    people.some((row) => row.id === 'U-NAME' && row.linkedOperative?.id === 'OP-CAM'),
    'name match should link an operative when emails differ'
  )
})

test('book labour hides people who are already booked for the day', () => {
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

  const fullDayWithLeftoverClocks = buildBookLabourCandidates({
    day: WED,
    users: [opUser, mgr],
    operatives: [linked],
    bookings: [
      booking({
        id: 'B-CLOCK',
        operativeId: 'OP-ADA',
        timeSlot: 'FULL DAY',
        workStartTime: '08:00',
        workEndTime: '16:00',
      }),
    ],
    managerSiteBookings: [
      {
        id: 'M-OFFICE',
        userId: 'U-MGR',
        date: WED,
        timeSlot: 'FULL DAY',
        locationType: 'office',
        workStartTime: '08:00',
        workEndTime: '16:00',
        createdAt: WED,
        updatedAt: WED,
      },
    ],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(fullDayWithLeftoverClocks.length, 0)

  const morningOnly = buildBookLabourCandidates({
    day: WED,
    users: [opUser],
    operatives: [linked],
    bookings: [booking({ id: 'B-AM', operativeId: 'OP-ADA', timeSlot: 'AM' })],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(morningOnly.some((row) => row.id === 'U-OP'), true)
})

test('book labour matches the daily overview unbooked list when payroll hours are higher', () => {
  const bookedUser = user({ id: 'U-OP', email: 'ada@site.test' })
  const freeUser = user({
    id: 'U-FREE',
    email: 'free@site.test',
    firstName: 'Bea',
    surname: 'Free',
  })
  const linked = operative({ id: 'OP-ADA', email: 'ada@site.test' })
  const input = {
    day: WED,
    users: [bookedUser, freeUser],
    operatives: [linked],
    bookings: [
      booking({
        id: 'B-CLOCK',
        operativeId: 'op-ada',
        timeSlot: 'FULL DAY',
        workStartTime: '07:30',
        workEndTime: '16:00',
      }),
    ],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: { ...DEFAULT_PAYROLL_POLICY, standardPaidHours: 9 },
  }
  const candidates = buildBookLabourCandidates(input)
  const overviewIds = listUnbookedLabour({
    day: WED,
    users: input.users,
    operatives: input.operatives,
    bookings: input.bookings,
    managerBookings: [],
    holidays: [],
  }).map((row) => row.userId)
  assert.deepEqual(
    candidates.map((row) => row.id),
    ['U-FREE']
  )
  assert.deepEqual(overviewIds, ['U-FREE'])
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

test('default Other custom items do not seed Training', () => {
  assert.deepEqual(DEFAULT_MY_SCHEDULE.customItems, [])
  const picks = enabledScheduleLocationPicks({
    ...DEFAULT_MY_SCHEDULE,
    customItemEnabled: {},
  })
  assert.equal(
    picks.some((pick) => pick.title.toLowerCase() === 'training'),
    false
  )
  const custom = oneOffCustomLocationPick('Training')
  assert.equal(custom?.locationType, 'custom')
  assert.equal(custom?.customLocationName, 'Training')
})
