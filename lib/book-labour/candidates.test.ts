import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UserRole, type Booking, type HolidayBooking, type Operative, type User } from '../../types/index.ts'
import {
  DEFAULT_MY_SCHEDULE,
  DEFAULT_PAYROLL_POLICY,
  DEFAULT_WARNING_DETECTION,
  enabledScheduleLocationPicks,
  oneOffCustomLocationPick,
} from '../settings/organizationSettings.ts'
import { bookLabourListPhase, bookLabourUserForRow, buildBookLabourCandidates } from './candidates.ts'
import { bookingWriteFields } from '../canonical/index.ts'
import { orgWarningScope } from '../warnings/warningScopeRoster.ts'
import { jobAccessViewer } from '../access/bookingAccess.ts'
import { computeUnbookedLabourWarningsForDateRange } from '../warnings/unbookedLabourWarnings.ts'

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

const WED = '2026-09-16'
const SAT = '2026-09-19'
const WED_DATE = new Date('2026-09-16T12:00:00+01:00')
const WEEKDAYS_ONLY = { ...DEFAULT_WARNING_DETECTION, includeWeekendsForUnbookedLabour: false }

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
    dayKey: SAT,
    warningDetection: WEEKDAYS_ONLY,
    users: [opUser, mgr],
    operatives: [linked],
    bookings: [],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(weekend.length, 0)

  const weekday = buildBookLabourCandidates({
    dayKey: WED,
    warningDetection: WEEKDAYS_ONLY,
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
    dayKey: WED,
    warningDetection: WEEKDAYS_ONLY,
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
    dayKey: WED,
    warningDetection: WEEKDAYS_ONLY,
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
  // Never linked by name (two people can share a name): no same-email catalogue row → booked under the users id.
  const named_ = people.find((row) => row.id === 'U-NAME')
  assert.equal(named_?.linkedOperative, undefined)
  assert.equal(named_?.bookingOperativeId, 'U-NAME')
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
    dayKey: WED,
    warningDetection: WEEKDAYS_ONLY,
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
        date: WED_DATE,
        timeSlot: 'FULL DAY',
        locationType: 'office',
        workStartTime: '08:00',
        workEndTime: '16:00',
        createdAt: WED_DATE,
        updatedAt: WED_DATE,
      },
    ],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(fullDayWithLeftoverClocks.length, 0)

  const morningOnly = buildBookLabourCandidates({
    dayKey: WED,
    warningDetection: WEEKDAYS_ONLY,
    users: [opUser],
    operatives: [linked],
    bookings: [booking({ id: 'B-AM', operativeId: 'OP-ADA', timeSlot: 'AM' })],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(morningOnly.some((row) => row.id === 'U-OP'), true)
})

test('book labour treats every profile with the same email as one person', () => {
  const live = user({ id: 'U-OP', email: 'ada@site.test' })
  const duplicateAccount = user({
    id: 'U-OP-DUP',
    email: 'ada@site.test',
    passwordSet: false,
  })
  const emptyProfile = operative({ id: 'OP-EMPTY', email: 'ada@site.test' })
  const bookedProfile = operative({ id: 'OP-BOOKED', email: 'ada@site.test' })
  const covered = buildBookLabourCandidates({
    dayKey: WED,
    warningDetection: WEEKDAYS_ONLY,
    users: [duplicateAccount, live],
    operatives: [emptyProfile, bookedProfile],
    bookings: [booking({ id: 'B-OTHER', operativeId: 'OP-BOOKED' })],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(covered.some((row) => row.email === 'ada@site.test' || row.user.email === 'ada@site.test'), false)

  const partial = buildBookLabourCandidates({
    dayKey: WED,
    warningDetection: WEEKDAYS_ONLY,
    users: [live, duplicateAccount],
    operatives: [emptyProfile, bookedProfile],
    bookings: [booking({ id: 'B-AM', operativeId: 'OP-BOOKED', timeSlot: 'AM' })],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(partial.length, 1)
  assert.equal(partial[0]?.id, 'U-OP')
  // The catalogue row is the rulebook row's `operativeId` (one of the same-email profiles), as on iOS.
  assert.ok(['OP-EMPTY', 'OP-BOOKED'].includes(partial[0]?.linkedOperative?.id ?? ''))

  const managerLive = user({
    id: 'U-MGR',
    email: 'boss@site.test',
    firstName: 'Boss',
    surname: 'Mgr',
    role: UserRole.MANAGER,
    permissions: perms({ manager: true }),
  })
  const managerAlias = user({
    id: 'U-MGR-ALIAS',
    email: 'boss@site.test',
    firstName: 'Boss',
    surname: 'Alias',
    role: UserRole.MANAGER,
    permissions: perms({ manager: true }),
  })
  const managerCovered = buildBookLabourCandidates({
    dayKey: WED,
    warningDetection: WEEKDAYS_ONLY,
    users: [managerLive, managerAlias],
    operatives: [],
    bookings: [],
    managerSiteBookings: [
      {
        id: 'M-ALIAS',
        userId: 'U-MGR-ALIAS',
        date: WED_DATE,
        timeSlot: 'FULL DAY',
        locationType: 'office',
        createdAt: WED_DATE,
        updatedAt: WED_DATE,
      },
    ],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(managerCovered.length, 0)
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

test('book labour never lists pending users or booked people, focused or not (rulebook §5)', () => {
  const pending = user({
    id: 'U-PEND',
    email: 'pat@site.test',
    firstName: 'Pat',
    surname: 'Pending',
    passwordSet: false,
  })
  const live = user({ id: 'U-LIVE', email: 'ada@site.test', firstName: 'Ada', surname: 'Live' })
  const linked = operative({ id: 'OP-ADA', email: 'ada@site.test' })
  const open = buildBookLabourCandidates({
    dayKey: WED,
    warningDetection: WEEKDAYS_ONLY,
    users: [pending, live],
    operatives: [linked],
    bookings: [],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.deepEqual(
    open.map((row) => row.id),
    ['U-LIVE']
  )

  const focusedPending = buildBookLabourCandidates({
    dayKey: WED,
    warningDetection: WEEKDAYS_ONLY,
    users: [pending, live],
    operatives: [linked],
    bookings: [booking({ id: 'B1', operativeId: 'OP-ADA' })],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
    focusedUserIds: ['U-PEND'],
  })
  // `unbookedLabourRows`: pending invitees are never unbooked, and a warning focus does not add anyone.
  assert.deepEqual(focusedPending, [])

  const focusedOperative = buildBookLabourCandidates({
    dayKey: WED,
    warningDetection: WEEKDAYS_ONLY,
    users: [live],
    operatives: [linked],
    bookings: [booking({ id: 'B1', operativeId: 'OP-ADA' })],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
    focusedUserIds: ['OP-ADA'],
  })
  assert.deepEqual(focusedOperative, [])
})

test('an anonymised Deleted user is not a book-labour candidate', () => {
  const deleted = user({
    id: 'QAlPe29vLLP4spK554UtpaBLW7N2',
    email: '',
    firstName: 'Deleted',
    surname: 'user',
  })
  const live = user({ id: 'U-LIVE', email: 'ada@site.test' })
  const rows = buildBookLabourCandidates({
    dayKey: WED,
    warningDetection: WEEKDAYS_ONLY,
    users: [deleted, live],
    operatives: [
      operative({ id: 'OP-DEL', email: '', firstName: 'Deleted', lastName: 'user' }),
      operative({ id: 'OP-ADA', email: 'ada@site.test' }),
    ],
    bookings: [],
    managerSiteBookings: [],
    holidays: [],
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(rows.some((row) => row.displayName === 'Deleted user' || row.id === deleted.id), false)
  assert.equal(rows.some((row) => row.id === 'U-LIVE'), true)
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

// Owner report: Warnings listed two unbooked people on Sunday 15 November 2026 (include weekends on), and Book labour
// for that day said "Everyone is booked". Book labour must list exactly the Warnings / Daily Overview people.
const SUN = '2026-11-15'
const SUN_DATE = new Date('2026-11-15T12:00:00Z')
const WEEKENDS_ON = { ...DEFAULT_WARNING_DETECTION, includeWeekendsForUnbookedLabour: true }

function ownerRoster(): User[] {
  return [
    user({
      id: 'U-FARNIE',
      email: 'farnie@site.test',
      firstName: 'Farnie',
      surname: 'Nel',
      role: UserRole.ADMIN,
      isSuperAdmin: true,
      permissions: perms({ adminAccess: true, manager: true }),
    }),
    user({
      id: 'U-TESTMGR',
      email: 'test.manager@site.test',
      firstName: 'Test',
      surname: 'Manager',
      role: UserRole.MANAGER,
      permissions: perms({ manager: true }),
    }),
  ]
}

function warningsNamesOn(dayKey: string, detection: typeof WEEKENDS_ON, extra: Partial<Parameters<typeof computeUnbookedLabourWarningsForDateRange>[0]> = {}) {
  return computeUnbookedLabourWarningsForDateRange({
    bookings: [],
    operatives: [],
    users: ownerRoster(),
    holidays: [],
    warningDetection: detection,
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
    periodStart: new Date(`${dayKey}T12:00:00Z`),
    periodEnd: new Date(`${dayKey}T12:00:00Z`),
    startDayKey: dayKey,
    endDayKey: dayKey,
    timeZone: 'Europe/London',
    ...extra,
  })
    .map((row) => row.operativeName)
    .sort()
}

test('Sunday with include weekends on: Book labour lists the same two people as Warnings', () => {
  const warnings = warningsNamesOn(SUN, WEEKENDS_ON)
  assert.deepEqual(warnings, ['Farnie Nel', 'Test Manager'])
  const rows = buildBookLabourCandidates({
    dayKey: SUN,
    timeZone: 'Europe/London',
    users: ownerRoster(),
    operatives: [],
    bookings: [],
    managerSiteBookings: [],
    holidays: [],
    warningDetection: WEEKENDS_ON,
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
    focusedUserIds: ['U-TESTMGR'],
  })
  assert.deepEqual(
    rows.map((row) => row.displayName).sort(),
    warnings
  )
  // Warning people come first; managers and admins book through manager site bookings.
  assert.equal(rows[0]?.id, 'U-TESTMGR')
  assert.ok(rows.every((row) => !row.usesOperativeProjectBookings))
})

test('Sunday with include weekends off: neither Warnings nor Book labour list anyone', () => {
  assert.deepEqual(warningsNamesOn(SUN, WEEKDAYS_ONLY), [])
  const rows = buildBookLabourCandidates({
    dayKey: SUN,
    timeZone: 'Europe/London',
    users: ownerRoster(),
    operatives: [],
    bookings: [],
    managerSiteBookings: [],
    holidays: [],
    warningDetection: WEEKDAYS_ONLY,
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.deepEqual(rows, [])
})

test('Book labour leaves out excluded users, as Warnings does', () => {
  const detection = { ...WEEKENDS_ON, excludedUserIdsFromUnbookedWarnings: ['u-farnie'] }
  assert.deepEqual(warningsNamesOn(SUN, detection), ['Test Manager'])
  const rows = buildBookLabourCandidates({
    dayKey: SUN,
    timeZone: 'Europe/London',
    users: ownerRoster(),
    operatives: [],
    bookings: [],
    managerSiteBookings: [],
    holidays: [],
    warningDetection: detection,
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.deepEqual(rows.map((row) => row.id), ['U-TESTMGR'])
})

test('Book labour leaves out people on approved annual leave, as Warnings does', () => {
  const leave: HolidayBooking = {
    id: 'H1',
    organizationId: 'org',
    userId: 'U-TESTMGR',
    startDate: SUN_DATE,
    endDate: SUN_DATE,
    startDayKey: SUN,
    endDayKey: SUN,
    dayKeyTimeZone: 'Europe/London',
    status: 'approved',
    timeSlot: 'FULL DAY',
    createdAt: SUN_DATE,
    updatedAt: SUN_DATE,
  } as HolidayBooking
  assert.deepEqual(warningsNamesOn(SUN, WEEKENDS_ON, { holidays: [leave] }), ['Farnie Nel'])
  const rows = buildBookLabourCandidates({
    dayKey: SUN,
    timeZone: 'Europe/London',
    users: ownerRoster(),
    operatives: [],
    bookings: [],
    managerSiteBookings: [],
    holidays: [leave],
    warningDetection: WEEKENDS_ON,
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.deepEqual(rows.map((row) => row.id), ['U-FARNIE'])
  // A pending request does not cover the day.
  const pending = buildBookLabourCandidates({
    dayKey: SUN,
    timeZone: 'Europe/London',
    users: ownerRoster(),
    operatives: [],
    bookings: [],
    managerSiteBookings: [],
    holidays: [{ ...leave, status: 'pending' } as HolidayBooking],
    warningDetection: WEEKENDS_ON,
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.equal(pending.length, 2)
})

test('two people with the same name never share a catalogue row', () => {
  const john1 = user({ id: 'U-JS1', email: 'john1@site.test', firstName: 'John', surname: 'Smith' })
  const john2 = user({ id: 'U-JS2', email: 'john2@site.test', firstName: 'John', surname: 'Smith' })
  const rows = buildBookLabourCandidates({
    dayKey: WED,
    users: [john1, john2],
    operatives: [operative({ id: 'OP-JS2', email: 'john2@site.test', firstName: 'John', lastName: 'Smith' })],
    bookings: [],
    managerSiteBookings: [],
    holidays: [],
    warningDetection: WEEKDAYS_ONLY,
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  const one = rows.find((row) => row.id === 'U-JS1')
  const two = rows.find((row) => row.id === 'U-JS2')
  assert.equal(one?.linkedOperative, undefined)
  assert.equal(one?.bookingOperativeId, 'U-JS1')
  assert.equal(two?.linkedOperative?.id, 'OP-JS2')
  assert.equal(two?.bookingOperativeId, 'OP-JS2')
})

test('an operative with no catalogue row is booked under their users id, which the rulebook counts', () => {
  const solo = user({ id: 'uidSoloOperative01', email: 'solo@site.test', firstName: 'Solo', surname: 'Op' })
  const input = {
    dayKey: WED,
    timeZone: 'Europe/London',
    users: [solo],
    operatives: [],
    managerSiteBookings: [],
    holidays: [],
    warningDetection: WEEKDAYS_ONLY,
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  }
  const before = buildBookLabourCandidates({ ...input, bookings: [] })
  assert.equal(before.length, 1)
  assert.equal(before[0].usesOperativeProjectBookings, true)
  assert.equal(before[0].linkedOperative, undefined)
  assert.equal(before[0].bookingOperativeId, 'uidSoloOperative01')

  // The write the save path makes is a valid booking (`bookingWriteFields`) …
  const written = bookingWriteFields({
    id: 'B-SOLO',
    operativeId: before[0].bookingOperativeId,
    projectId: 'P1',
    dateMs: WED_DATE.getTime(),
    timeSlot: 'FULL DAY',
    status: 'Confirmed',
    bookedBy: 'admin',
    notes: '',
    isBreakRemoved: false,
    createdAtMs: WED_DATE.getTime(),
    updatedAtMs: WED_DATE.getTime(),
  })
  assert.equal(written.ok, true)
  // … and once saved the person is booked: gone from Book labour and from Warnings.
  const saved = booking({ id: 'B-SOLO', operativeId: before[0].bookingOperativeId })
  assert.deepEqual(buildBookLabourCandidates({ ...input, bookings: [saved] }), [])
  assert.deepEqual(
    computeUnbookedLabourWarningsForDateRange({
      bookings: [saved],
      operatives: [],
      users: [solo],
      holidays: [],
      warningDetection: WEEKDAYS_ONLY,
      payrollPolicy: DEFAULT_PAYROLL_POLICY,
      periodStart: WED_DATE,
      periodEnd: WED_DATE,
      startDayKey: WED,
      endDayKey: WED,
      timeZone: 'Europe/London',
    }),
    []
  )
})

test('a rulebook row maps to its users account without case, through same-email and former ids', () => {
  const kept = user({ id: 'u-kept', email: 'kept@site.test', formerUserIds: ['OLD-INVITE-ID'] })
  const aliases = { 'DUP-ACCOUNT': 'u-kept' }
  assert.equal(bookLabourUserForRow([kept], ['U-KEPT'], aliases)?.id, 'u-kept')
  assert.equal(bookLabourUserForRow([kept], ['', 'dup-account'], aliases)?.id, 'u-kept')
  assert.equal(bookLabourUserForRow([kept], ['old-invite-id'], aliases)?.id, 'u-kept')
  assert.equal(bookLabourUserForRow([kept], ['someone-else'], aliases), undefined)
})

test('the day is read in the organisation zone, not London', () => {
  const zone = 'Australia/Sydney'
  const people = ownerRoster()
  // 09:00 on Sunday 15 November in Sydney is Saturday 14 November in London.
  const sydneyMorning = new Date('2026-11-14T22:00:00Z')
  const rows = buildBookLabourCandidates({
    dayKey: SUN,
    timeZone: zone,
    users: people,
    operatives: [],
    bookings: [],
    managerSiteBookings: [
      {
        id: 'M-SYD',
        userId: 'U-TESTMGR',
        date: sydneyMorning,
        timeSlot: 'FULL DAY',
        locationType: 'office',
        createdAt: sydneyMorning,
        updatedAt: sydneyMorning,
      },
    ],
    holidays: [],
    warningDetection: WEEKENDS_ON,
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
  })
  assert.deepEqual(rows.map((row) => row.id), ['U-FARNIE'])
})

test('Book labour waits for every source and shows an error instead of "Everyone is booked"', () => {
  const ready = { ready: true }
  assert.equal(bookLabourListPhase({ organization: ready, holidays: ready }), 'ready')
  assert.equal(bookLabourListPhase({ organization: { ready: false }, holidays: ready }), 'loading')
  assert.equal(bookLabourListPhase({ organization: ready, holidays: { ready: false } }), 'loading')
  assert.equal(bookLabourListPhase({ organization: { ready: false, error: 'permission-denied' }, holidays: ready }), 'error')
  assert.equal(bookLabourListPhase({ organization: ready, holidays: { ready: true, error: 'offline' } }), 'error')
})

test('owner decision: Book labour is scoped like the Warnings unbooked list (manager: self + reports; admin: all)', () => {
  const admin = user({
    id: 'U-ADMIN',
    email: 'admin@site.test',
    firstName: 'Ann',
    surname: 'Admin',
    role: UserRole.ADMIN,
    permissions: perms({ adminAccess: true }),
  })
  const manager = user({
    id: 'U-MGR',
    email: 'mgr@site.test',
    firstName: 'Max',
    surname: 'Manager',
    role: UserRole.MANAGER,
    permissions: perms({ manager: true }),
    assignedManagerUserIds: ['U-ADMIN'],
  })
  const report1 = user({ id: 'U-R1', email: 'r1@site.test', firstName: 'Rae', surname: 'One', assignedManagerUserIds: ['U-MGR'] })
  const report2 = user({ id: 'U-R2', email: 'r2@site.test', firstName: 'Rob', surname: 'Two', assignedManagerUserIds: ['U-MGR'] })
  const other = user({ id: 'U-OTHER', email: 'other@site.test', firstName: 'Ola', surname: 'Other', assignedManagerUserIds: ['U-ADMIN'] })
  const users = [admin, manager, report1, report2, other]
  const listsFor = (viewer: User) => {
    const scope = orgWarningScope({ viewer: jobAccessViewer(viewer), projects: [], users, operatives: [] })
    const warnings = computeUnbookedLabourWarningsForDateRange({
      bookings: [],
      operatives: [],
      users,
      holidays: [],
      warningDetection: WEEKDAYS_ONLY,
      payrollPolicy: DEFAULT_PAYROLL_POLICY,
      periodStart: WED_DATE,
      periodEnd: WED_DATE,
      startDayKey: WED,
      endDayKey: WED,
      timeZone: 'Europe/London',
      scope,
    })
      .map((row) => row.userId)
      .sort()
    const bookLabour = buildBookLabourCandidates({
      dayKey: WED,
      timeZone: 'Europe/London',
      users,
      operatives: [],
      bookings: [],
      managerSiteBookings: [],
      holidays: [],
      warningDetection: WEEKDAYS_ONLY,
      payrollPolicy: DEFAULT_PAYROLL_POLICY,
      scope,
    })
      .map((row) => row.id)
      .sort()
    return { warnings, bookLabour }
  }
  const asManager = listsFor(manager)
  assert.deepEqual(asManager.warnings, ['U-MGR', 'U-R1', 'U-R2'])
  assert.deepEqual(asManager.bookLabour, asManager.warnings)
  const asAdmin = listsFor(admin)
  assert.deepEqual(asAdmin.warnings, ['U-ADMIN', 'U-MGR', 'U-OTHER', 'U-R1', 'U-R2'])
  assert.deepEqual(asAdmin.bookLabour, asAdmin.warnings)
})
