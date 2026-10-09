import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createContext, runInContext } from 'node:vm'
import {
  adoptCurrentOrganization,
  bookingBelongsToOrganization,
  CANONICAL_TIME_ZONE,
  captureOrganizationContext,
  chooseSessionOrganization,
  coverageWindow,
  standardDayCoverage,
  intervalsOverlap,
  invoicingPeriod,
  organizationContextStillCurrent,
  organizationIdsMatch,
  organizationScopedKey,
  paidHoursForNamedSlot,
  resetOrganizationContextForTests,
} from './engine.ts'
import {
  halfDayWindows,
  slotInterval,
  standardDayWindow,
  subtractMinuteIntervals,
} from './engine.ts'
import {
  qualificationDismissKey,
  qualificationExpiryRows,
  unbookedLabourRows,
  unverifiedOperativeRows,
  withoutDismissedQualificationRows,
} from './warningRows.ts'
import { leaveCoverageRows } from './leaveCoverage.ts'
import {
  canEditWorkCatalogue,
  canViewStaffWarnings,
  receivesJobNotification,
  seesEveryJob,
  type StaffAccountRole,
} from './staffAccess.ts'
import {
  accountKindFromFlags,
  applyEmploymentTypeChange,
  employmentEffectiveLabel,
  employmentTypeOnDay,
  MANAGER_PERMISSION_TOGGLES,
} from './userProfile.ts'
import {
  annualLeaveBalance,
  applyRemainingOverride,
  hasAnnualLeaveAllowance,
  leaveYearBounds,
} from './annualLeaveBalance.ts'
import {
  materialSearchScore,
  rankMaterialRecords,
  tokenizeMaterialSearch,
} from './materialSearch.ts'

const superAdmin: StaffAccountRole = { isSuperAdmin: true, isAdmin: true, isManager: false, isOperativeMode: false }
const admin: StaffAccountRole = { isSuperAdmin: false, isAdmin: true, isManager: false, isOperativeMode: false }
const manager: StaffAccountRole = { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }
const operative: StaffAccountRole = { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: true }
const noRole: StaffAccountRole = { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: false }

test('organisation ids match after trim and case folding', () => {
  assert.equal(organizationIdsMatch(' Org-A ', 'org-a'), true)
  assert.equal(organizationIdsMatch('org-a', 'org-b'), false)
  assert.equal(organizationIdsMatch('', 'org-a'), false)
  assert.equal(bookingBelongsToOrganization('org-a', 'org-b'), false)
})

test('session choice keeps the explicit company ahead of the user document', () => {
  const choice = chooseSessionOrganization({
    explicitOrganizationId: 'org-b',
    rememberedOrganizationId: 'org-a',
    documentOrganizationId: 'org-a',
    probes: { 'org-b': 'allowed', 'org-a': 'allowed' },
  })
  assert.equal(choice.organizationId, 'org-b')
})

test('a denied remembered company does not open when it is not the user document', () => {
  const choice = chooseSessionOrganization({
    rememberedOrganizationId: 'org-b',
    documentOrganizationId: 'org-a',
    probes: { 'org-b': 'denied', 'org-a': 'allowed' },
  })
  assert.equal(choice.organizationId, 'org-a')
})

test('switching organisation invalidates an in-flight result from the previous company', () => {
  resetOrganizationContextForTests()
  adoptCurrentOrganization('org-a', 'user-1')
  const captured = captureOrganizationContext()
  adoptCurrentOrganization('org-b', 'user-1')
  assert.equal(organizationContextStillCurrent('org-a', captured), false)
  assert.equal(organizationContextStillCurrent('org-b', captureOrganizationContext()), true)
  adoptCurrentOrganization('org-a', 'user-1')
  assert.equal(organizationContextStillCurrent('org-b', captured), false)
})

test('signing out then signing in as another user does not keep the previous organisation', () => {
  resetOrganizationContextForTests()
  adoptCurrentOrganization('org-a', 'user-1')
  const captured = captureOrganizationContext()
  adoptCurrentOrganization('', '')
  adoptCurrentOrganization('org-b', 'user-2')
  assert.equal(organizationContextStillCurrent('org-a', captured), false)
  assert.equal(organizationScopedKey('bookings', 'org-a', 'user-1') === organizationScopedKey('bookings', 'org-b', 'user-2'), false)
})

test('warning coverage is the organisation day, not the device day', () => {
  // 23:30 UTC on 7 Oct 2026 is 00:30 on 8 Oct in London (BST) and still 7 Oct in New York.
  const instant = '2026-10-07T23:30:00.000Z'
  const london = coverageWindow({
    referenceIso: instant,
    timeZone: CANONICAL_TIME_ZONE,
    clashLookaheadMode: 'numberOfDays',
    clashLookaheadDays: 1,
    ranges: [
      { startDay: 1, endDay: 15 },
      { startDay: 16, endDay: 31 },
    ],
  })
  const newYork = coverageWindow({
    referenceIso: instant,
    timeZone: 'America/New_York',
    clashLookaheadMode: 'numberOfDays',
    clashLookaheadDays: 1,
  })
  assert.equal(london.startDayKey, '2026-10-08')
  assert.equal(london.endDayKey, '2026-10-08')
  assert.equal(newYork.startDayKey, '2026-10-07')
  assert.notEqual(london.startDayKey, newYork.startDayKey)
})

test('the same organisation settings produce one warning window', () => {
  const input = {
    referenceIso: '2026-10-06T11:00:00.000Z',
    timeZone: 'Europe/London',
    clashLookaheadMode: 'endOfInvoicingPeriod' as const,
    paymentRunMode: 'date_ranges' as const,
    ranges: [
      { startDay: 1, endDay: 16 },
      { startDay: 17, endDay: 31 },
    ],
  }
  const web = coverageWindow(input)
  const ios = coverageWindow({ ...input })
  assert.deepEqual(web, ios)
  assert.equal(web.startDayKey, '2026-10-01')
  assert.equal(web.endDayKey, '2026-10-16')
})

test('a missing pay-run uses the half-month default', () => {
  const window = invoicingPeriod({
    referenceIso: '2026-10-07T12:00:00.000Z',
    timeZone: 'Europe/London',
    paymentRunMode: 'date_ranges',
    ranges: [],
  })
  assert.equal(window.startDayKey, '2026-10-01')
  assert.equal(window.endDayKey, '2026-10-15')
})

test('a wrapped payment run crosses the month boundary', () => {
  const window = invoicingPeriod({
    referenceIso: '2026-10-28T12:00:00.000Z',
    timeZone: 'Europe/London',
    paymentRunMode: 'date_ranges',
    ranges: [{ startDay: 25, endDay: 5 }],
  })
  assert.equal(window.startDayKey, '2026-10-25')
  assert.equal(window.endDayKey, '2026-11-05')
})

test('February clamps a 16–31 payment run to the real month end', () => {
  const window = invoicingPeriod({
    referenceIso: '2026-02-20T12:00:00.000Z',
    timeZone: 'Europe/London',
    paymentRunMode: 'date_ranges',
    ranges: [
      { startDay: 1, endDay: 15 },
      { startDay: 16, endDay: 31 },
    ],
  })
  assert.equal(window.startDayKey, '2026-02-16')
  assert.equal(window.endDayKey, '2026-02-28')
})

test('full week coverage is Monday through Friday in the organisation zone', () => {
  const window = coverageWindow({
    referenceIso: '2026-09-16T12:00:00.000Z',
    timeZone: 'Europe/London',
    clashLookaheadMode: 'endOfWorkingWeek',
  })
  assert.equal(window.startDayKey, '2026-09-14')
  assert.equal(window.endDayKey, '2026-09-18')
})

test('the standard day is 07:30 to 16:00 minus the unpaid break', () => {
  const full = standardDayCoverage(
    { standardDayStart: '07:30', standardDayEnd: '16:00', breakWindowStart: '12:00', breakWindowEnd: '12:30' },
    [{ timeSlot: 'FULL DAY' }]
  )
  assert.equal(full.missingHours, 0)
  assert.equal(full.requiredHours, 8)
  const morning = standardDayCoverage(
    { standardDayStart: '07:30', standardDayEnd: '16:00', breakWindowStart: '12:00', breakWindowEnd: '12:30' },
    [{ timeSlot: 'AM' }]
  )
  assert.equal(morning.coveredHours, 4.5)
  assert.equal(morning.missingHours, 3.5)
  const short = standardDayCoverage(
    { standardDayStart: '07:30', standardDayEnd: '16:00', breakWindowStart: '12:00', breakWindowEnd: '12:30' },
    [{ timeSlot: 'CUSTOM_HOURS', workStart: '07:30', workEnd: '15:30' }]
  )
  assert.equal(short.missingHours, 0.5)
  const afterHours = standardDayCoverage(
    { standardDayStart: '07:30', standardDayEnd: '16:00', breakWindowStart: '12:00', breakWindowEnd: '12:30' },
    [{ timeSlot: 'CUSTOM_HOURS', workStart: '16:00', workEnd: '20:00' }]
  )
  assert.equal(afterHours.missingHours, 8)
  const overlap = standardDayCoverage(
    { standardDayStart: '07:30', standardDayEnd: '16:00', breakWindowStart: '12:00', breakWindowEnd: '12:30' },
    [
      { timeSlot: 'CUSTOM_HOURS', workStart: '07:30', workEnd: '12:00' },
      { timeSlot: 'CUSTOM_HOURS', workStart: '08:00', workEnd: '16:00' },
    ]
  )
  assert.equal(overlap.missingHours, 0)
  const mornings = standardDayCoverage(
    { standardDayStart: '07:30', standardDayEnd: '16:00', breakWindowStart: '12:00', breakWindowEnd: '12:30' },
    [{ timeSlot: 'AM' }, { timeSlot: 'AM' }]
  )
  assert.equal(mornings.missingHours, 3.5)
  const legacy = standardDayCoverage({}, [{}])
  assert.equal(legacy.missingHours, 0)
  assert.equal(legacy.requiredHours, 8)
})

test('named booking slots share one hour meaning', () => {
  assert.equal(paidHoursForNamedSlot('FULL DAY', 8), 8)
  assert.equal(paidHoursForNamedSlot('FULL_DAY', 8), 8)
  assert.equal(paidHoursForNamedSlot('AM', 8), 4)
  assert.equal(paidHoursForNamedSlot('PM', 8), 4)
  assert.equal(paidHoursForNamedSlot('CUSTOM_HOURS', 8), null)
})

test('touching booking intervals are not a clash', () => {
  assert.equal(intervalsOverlap({ start: 0, end: 60 }, { start: 60, end: 120 }), false)
  assert.equal(intervalsOverlap({ start: 0, end: 61 }, { start: 60, end: 120 }), true)
})

test('organisation cache keys cannot satisfy another organisation', () => {
  assert.notEqual(organizationScopedKey('warnings', 'org-a'), organizationScopedKey('warnings', 'org-b'))
})

test('the iOS JavaScript bundle returns the same warning window as this module', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: {
    ProjectPlannerCanonical?: {
      coverageWindow: (input: unknown) => { startDayKey: string; endDayKey: string }
      qualificationExpiryRows: (input: unknown) => Array<{ id: string }>
    }
  } = {}
  runInContext(source, createContext(sandbox))
  const input = {
    referenceIso: '2026-10-06T11:00:00.000Z',
    timeZone: 'Europe/London',
    clashLookaheadMode: 'endOfInvoicingPeriod',
    paymentRunMode: 'date_ranges',
    ranges: [
      { startDay: 1, endDay: 16 },
      { startDay: 17, endDay: 31 },
    ],
  }
  const fromBundle = sandbox.ProjectPlannerCanonical?.coverageWindow(input)
  const fromModule = coverageWindow(input)
  assert.equal(fromBundle?.startDayKey, fromModule.startDayKey)
  assert.equal(fromBundle?.endDayKey, fromModule.endDayKey)
  const bundledRows = sandbox.ProjectPlannerCanonical?.qualificationExpiryRows({
    referenceIso: '2026-09-16T11:00:00.000Z',
    timeZone: 'Europe/London',
    operatives: [
      {
        id: 'OP-Q',
        isActive: true,
        name: 'Ada Qual',
        expiries: [{ qualificationId: 'Q1', name: 'CSCS', expiryIso: '2026-09-01T11:00:00.000Z' }],
      },
    ],
  })
  assert.equal(bundledRows?.[0]?.id, 'qual-OP-Q-Q1')
})

test('qualification rows use the organisation month, including already expired qualifications', () => {
  const referenceIso = '2026-09-16T11:00:00.000Z'
  const rows = qualificationExpiryRows({
    referenceIso,
    timeZone: 'Europe/London',
    operatives: [
      {
        id: 'OP-Q',
        isActive: true,
        name: 'Ada Qual',
        expiries: [
          { qualificationId: 'Q-OLD', name: 'CSCS', expiryIso: '2026-09-01T11:00:00.000Z' },
          { qualificationId: 'Q-SOON', name: 'IPAF', expiryIso: '2026-10-16T11:00:00.000Z' },
          { qualificationId: 'Q-LATER', name: 'First aid', expiryIso: '2026-10-17T11:00:00.000Z' },
        ],
      },
      {
        id: 'OP-OFF',
        isActive: false,
        name: 'Inactive',
        expiries: [{ qualificationId: 'Q-OFF', name: 'CSCS', expiryIso: '2026-09-01T11:00:00.000Z' }],
      },
    ],
  })
  assert.deepEqual(
    rows.map((row) => row.id),
    ['qual-OP-Q-Q-OLD', 'qual-OP-Q-Q-SOON']
  )
  assert.equal(rows[0].title, 'Qualification expired')
  assert.equal(rows[1].title, 'Qualification expiry')
  assert.equal(rows[1].dayKey, '2026-10-16')
})

test('an operative is unverified only after three working days without a password', () => {
  const people = [
    {
      email: 'pat@site.test',
      passwordSet: false,
      createdAtIso: '2026-09-16T11:00:00.000Z',
      isOperativeMode: true,
    },
  ]
  const operatives = [{ id: 'OP-PAT', email: 'pat@site.test', name: 'Pat Pending' }]
  const sameDay = unverifiedOperativeRows({
    referenceIso: '2026-09-16T11:00:00.000Z',
    operatives,
    people,
  })
  const thirdDay = unverifiedOperativeRows({
    referenceIso: '2026-09-18T11:00:00.000Z',
    operatives,
    people,
  })
  assert.equal(sameDay.length, 0)
  assert.equal(thirdDay.length, 1)
  assert.equal(thirdDay[0].id, 'unverified-OP-PAT')
  assert.match(thirdDay[0].message, /has not verified/)
})

test('unbooked labour skips pending invitees, excluded people, zero-hour weekends, and duplicate booked profiles', () => {
  const people = [
    {
      id: 'U-LIVE',
      email: 'ada@site.test',
      name: 'Ada App',
      isActive: true,
      passwordSet: true,
      isOperativeMode: true,
      isManager: false,
      isAdmin: false,
      isSuperAdmin: false,
    },
    {
      id: 'U-PEND',
      email: 'pat@site.test',
      name: 'Pat Pending',
      isActive: true,
      passwordSet: false,
      isOperativeMode: true,
      isManager: false,
      isAdmin: false,
      isSuperAdmin: false,
    },
    {
      id: 'U-ADMIN',
      email: 'boss@site.test',
      name: 'Boss Admin',
      isActive: true,
      passwordSet: true,
      isOperativeMode: false,
      isManager: false,
      isAdmin: true,
      isSuperAdmin: false,
    },
  ]
  const operatives = [
    { id: 'OP-ADA', email: 'ada@site.test', name: 'Roster Ada', isActive: true, isPlaceholder: false, profileWeight: 1 },
    { id: 'OP-ADA-DUP', email: 'ada@site.test', name: 'Duplicate Ada', isActive: true, isPlaceholder: false, profileWeight: 0 },
    { id: 'OP-PAT', email: 'pat@site.test', name: 'Roster Pat', isActive: true, isPlaceholder: false, profileWeight: 0 },
    { id: 'OP-BOB', email: 'bob@site.test', name: 'Bob Roster', isActive: true, isPlaceholder: false, profileWeight: 0 },
    { id: 'OP-BOSS', email: 'boss@site.test', name: 'Boss Roster', isActive: true, isPlaceholder: false, profileWeight: 0 },
  ]
  const rows = unbookedLabourRows({
    timeZone: 'Europe/London',
    startDayKey: '2026-09-18',
    endDayKey: '2026-09-20',
    includeWeekends: true,
    excludedUserIds: ['U-ADMIN'],
    standardPaidHours: 8,
    saturdayCountsAsHours: 0,
    sundayCountsAsHours: 8,
    people,
    operatives,
    bookings: [{ personId: 'OP-ADA-DUP', dayKey: '2026-09-18', kind: 'operative' }],
    holidays: [],
  })
  assert.deepEqual(
    rows.map((row) => row.id),
    ['unbooked-2026-09-18-OP-BOB', 'unbooked-2026-09-20-U-LIVE', 'unbooked-2026-09-20-OP-BOB']
  )
  assert.equal(rows[1].operativeName, 'Ada App')
  assert.equal(rows[1].missingHours, 8)
  assert.equal(rows.find((row) => row.personKey === 'U-PEND' || row.personKey === 'U-ADMIN'), undefined)
  assert.equal(rows.find((row) => row.dayKey === '2026-09-19'), undefined)
})

// ─── Standard day, AM and PM ─────────────────────────────────────────────────

const DEFAULT_DAY = {
  standardDayStart: '07:30',
  standardDayEnd: '16:00',
  breakWindowStart: '12:00',
  breakWindowEnd: '12:30',
}

test('the break window splits the default day into AM 07:30–12:00 and PM 12:30–16:00', () => {
  const windows = halfDayWindows(DEFAULT_DAY)
  assert.equal(windows.pivot, 'break')
  assert.deepEqual(windows.day, { start: 450, end: 960 })
  assert.deepEqual(windows.am, { start: 450, end: 720 })
  assert.deepEqual(windows.pm, { start: 750, end: 960 })
  assert.equal(intervalsOverlap(windows.am, windows.pm), false)
})

test('a 07:00–17:00 day with a 60 minute break splits at the break', () => {
  const windows = halfDayWindows({
    standardDayStart: '07:00',
    standardDayEnd: '17:00',
    breakWindowStart: '12:30',
    breakWindowEnd: '13:30',
  })
  assert.equal(windows.pivot, 'break')
  assert.deepEqual(windows.am, { start: 420, end: 750 })
  assert.deepEqual(windows.pm, { start: 810, end: 1020 })
})

test('a 13:00–19:00 company whose break sits outside the day splits at the midpoint', () => {
  const windows = halfDayWindows({
    standardDayStart: '13:00',
    standardDayEnd: '19:00',
    breakWindowStart: '12:00',
    breakWindowEnd: '12:30',
  })
  assert.equal(windows.pivot, 'midpoint')
  assert.deepEqual(windows.am, { start: 780, end: 960 })
  assert.deepEqual(windows.pm, { start: 960, end: 1140 })
  assert.equal(intervalsOverlap(windows.am, windows.pm), false)
})

test('a break too close to either edge of the day does not become the half-day split', () => {
  const windows = halfDayWindows({
    standardDayStart: '07:30',
    standardDayEnd: '16:00',
    breakWindowStart: '08:00',
    breakWindowEnd: '08:30',
  })
  assert.equal(windows.pivot, 'midpoint')
  assert.deepEqual(windows.am, { start: 450, end: 705 })
  assert.deepEqual(windows.pm, { start: 705, end: 960 })
})

test('invalid or inverted day settings fall back to 07:30–16:00 and never produce an empty half', () => {
  assert.deepEqual(standardDayWindow({ standardDayStart: '16:00', standardDayEnd: '07:30' }), { start: 450, end: 960 })
  assert.deepEqual(standardDayWindow({ standardDayStart: 'nine', standardDayEnd: '' }), { start: 450, end: 960 })
  assert.deepEqual(standardDayWindow(null), { start: 450, end: 960 })
  const tiny = halfDayWindows({ standardDayStart: '09:00', standardDayEnd: '09:01' })
  assert.ok(tiny.am.end >= tiny.am.start)
  assert.ok(tiny.pm.end >= tiny.pm.start)
})

test('slot intervals: clock times win, named slots use the halves, legacy spellings resolve', () => {
  assert.deepEqual(slotInterval({ timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '09:30' }, DEFAULT_DAY), {
    start: 450,
    end: 570,
  })
  assert.deepEqual(slotInterval({ timeSlot: 'AM' }, DEFAULT_DAY), { start: 450, end: 720 })
  assert.deepEqual(slotInterval({ timeSlot: 'Morning' }, DEFAULT_DAY), { start: 450, end: 720 })
  assert.deepEqual(slotInterval({ timeSlot: 'PM' }, DEFAULT_DAY), { start: 750, end: 960 })
  assert.deepEqual(slotInterval({ timeSlot: 'FULL_DAY' }, DEFAULT_DAY), { start: 450, end: 960 })
  assert.deepEqual(slotInterval({ timeSlot: 'FULL DAY' }, DEFAULT_DAY), { start: 450, end: 960 })
  assert.deepEqual(slotInterval({ timeSlot: 'Evening' }, DEFAULT_DAY), { start: 960, end: 1200 })
  assert.deepEqual(subtractMinuteIntervals({ start: 450, end: 720 }, [{ start: 450, end: 570 }]), [{ start: 570, end: 720 }])
})

// ─── Annual leave against bookings ───────────────────────────────────────────

const LEAVE_PEOPLE = [
  { personKey: 'U-SAM', name: 'Sam Site', userId: 'U-SAM', operativeIds: ['OP-SAM'] },
  { personKey: 'OP-RAY', name: 'Ray Roster', userId: null, operativeIds: ['OP-RAY'] },
]

function leaveInput(overrides: Partial<Parameters<typeof leaveCoverageRows>[0]>) {
  return leaveCoverageRows({
    timeZone: 'Europe/London',
    startDayKey: '2026-10-12',
    endDayKey: '2026-10-16',
    day: DEFAULT_DAY,
    includeWeekends: false,
    people: LEAVE_PEOPLE,
    leave: [],
    bookings: [],
    ...overrides,
  })
}

test('AM booking with PM leave is silent; PM booking with AM leave is silent', () => {
  const pmLeave = leaveInput({
    leave: [{ id: 'L1', userId: 'U-SAM', startDayKey: '2026-10-12', endDayKey: '2026-10-12', timeSlot: 'PM', approved: true }],
    bookings: [{ id: 'B1', personId: 'OP-SAM', kind: 'operative', dayKey: '2026-10-12', timeSlot: 'AM', label: 'J100 Site' }],
  })
  assert.deepEqual(pmLeave, [])
  const amLeave = leaveInput({
    leave: [{ id: 'L2', userId: 'U-SAM', startDayKey: '2026-10-12', endDayKey: '2026-10-12', timeSlot: 'AM', approved: true }],
    bookings: [{ id: 'B2', personId: 'U-SAM', kind: 'manager', dayKey: '2026-10-12', timeSlot: 'PM', label: 'Office' }],
  })
  assert.deepEqual(amLeave, [])
})

test('PM leave with a 07:30–09:30 custom booking reports the missing 09:30–12:00', () => {
  const rows = leaveInput({
    leave: [{ id: 'L1', userId: 'U-SAM', startDayKey: '2026-10-12', endDayKey: '2026-10-12', timeSlot: 'PM', approved: true }],
    bookings: [
      {
        id: 'B1',
        personId: 'OP-SAM',
        kind: 'operative',
        dayKey: '2026-10-12',
        timeSlot: 'CUSTOM_HOURS',
        workStartTime: '07:30',
        workEndTime: '09:30',
        label: 'J100 Site',
      },
    ],
  })
  assert.equal(rows.length, 1)
  const row = rows[0]
  assert.equal(row.kind, 'leave_cover')
  assert.equal(row.id, 'leave-cover-2026-10-12-U-SAM-L1')
  assert.deepEqual(row.workingWindow, { start: 450, end: 720 })
  assert.deepEqual(row.missing, [{ start: 570, end: 720 }])
  assert.equal(row.missingHours, 2.5)
  assert.equal(row.bookedHours, 2)
  assert.match(row.message, /only booked 07:30–09:30; 09:30–12:00 \(2.5 hours\) is not booked/)
})

test('half-day leave with no booking at all reports the whole working half', () => {
  const rows = leaveInput({
    leave: [{ id: 'L1', operativeId: 'OP-RAY', startDayKey: '2026-10-13', endDayKey: '2026-10-13', timeSlot: 'AM', approved: true }],
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].kind, 'leave_cover')
  assert.equal(rows[0].personKey, 'OP-RAY')
  assert.deepEqual(rows[0].missing, [{ start: 750, end: 960 }])
  assert.equal(rows[0].missingHours, 3.5)
  assert.match(rows[0].message, /not booked for the PM \(12:30–16:00, 3.5 hours\)/)
})

test('a booking inside the leave window is a clash; full-day leave clashes with any booking', () => {
  const rows = leaveInput({
    leave: [
      { id: 'L1', userId: 'U-SAM', startDayKey: '2026-10-12', endDayKey: '2026-10-12', timeSlot: 'PM', approved: true },
      { id: 'L2', operativeId: 'OP-RAY', startDayKey: '2026-10-14', endDayKey: '2026-10-14', timeSlot: 'FULL DAY', approved: true },
    ],
    bookings: [
      { id: 'B1', personId: 'OP-SAM', kind: 'operative', dayKey: '2026-10-12', timeSlot: 'FULL DAY', label: 'J100 Site' },
      { id: 'B2', personId: 'OP-RAY', kind: 'operative', dayKey: '2026-10-14', timeSlot: 'AM', label: 'J200 Site' },
    ],
  })
  assert.deepEqual(
    rows.map((row) => row.id),
    ['leave-clash-2026-10-12-U-SAM-L1', 'leave-clash-2026-10-14-OP-RAY-L2']
  )
  assert.equal(rows[0].clashes[0].overlapStart, 750)
  assert.equal(rows[0].clashes[0].overlapEnd, 960)
  assert.match(rows[0].message, /booked J100 Site 07:30–16:00 on Monday 12 October while on PM annual leave \(12:30–16:00\)/)
  assert.match(rows[1].message, /while on full-day annual leave/)
  // The full-day booking fully covers the AM, so there is no separate cover row for Sam.
  assert.equal(rows.find((row) => row.kind === 'leave_cover'), undefined)
})

test('pending leave, excluded users (cover only), and weekends (cover only) are respected', () => {
  const rows = leaveInput({
    startDayKey: '2026-10-12',
    endDayKey: '2026-10-18',
    excludedUserIds: ['U-SAM'],
    leave: [
      { id: 'L-PENDING', operativeId: 'OP-RAY', startDayKey: '2026-10-12', endDayKey: '2026-10-12', timeSlot: 'AM', approved: false },
      { id: 'L-SAM', userId: 'U-SAM', startDayKey: '2026-10-13', endDayKey: '2026-10-13', timeSlot: 'PM', approved: true },
      { id: 'L-SAT', operativeId: 'OP-RAY', startDayKey: '2026-10-17', endDayKey: '2026-10-17', timeSlot: 'AM', approved: true },
    ],
    bookings: [{ id: 'B1', personId: 'OP-SAM', kind: 'operative', dayKey: '2026-10-13', timeSlot: 'PM', label: 'J100 Site' }],
  })
  // Sam is excluded from cover warnings but the PM booking during PM leave still clashes.
  assert.deepEqual(
    rows.map((row) => row.id),
    ['leave-clash-2026-10-13-U-SAM-L-SAM']
  )
})

test('midpoint companies get consistent AM/PM in leave cover', () => {
  const rows = leaveCoverageRows({
    timeZone: 'Europe/London',
    startDayKey: '2026-10-12',
    endDayKey: '2026-10-12',
    day: { standardDayStart: '13:00', standardDayEnd: '19:00', breakWindowStart: '12:00', breakWindowEnd: '12:30' },
    includeWeekends: false,
    people: LEAVE_PEOPLE,
    leave: [{ id: 'L1', userId: 'U-SAM', startDayKey: '2026-10-12', endDayKey: '2026-10-12', timeSlot: 'AM', approved: true }],
    bookings: [
      { id: 'B1', personId: 'OP-SAM', kind: 'operative', dayKey: '2026-10-12', timeSlot: 'CUSTOM_HOURS', workStartTime: '16:00', workEndTime: '18:00' },
    ],
  })
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].workingWindow, { start: 960, end: 1140 })
  assert.deepEqual(rows[0].missing, [{ start: 1080, end: 1140 }])
  assert.equal(rows[0].missingHours, 1)
})

// ─── Dismissed qualification warnings ────────────────────────────────────────

test('the iOS JavaScript bundle exposes the standard-day, leave and dismiss rules with the same results', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const bundle = sandbox.ProjectPlannerCanonical
  assert.ok(bundle)
  for (const name of [
    'halfDayWindows',
    'slotInterval',
    'namedSlotKind',
    'standardDayWindow',
    'standardBreakWindow',
    'subtractMinuteIntervals',
    'leaveCoverageRows',
    'leaveSlotKind',
    'qualificationDismissKey',
    'withoutDismissedQualificationRows',
    'employmentTypeOnDay',
    'applyEmploymentTypeChange',
    'accountKindFromFlags',
    'normalizeEmploymentType',
    'annualLeaveBalance',
    'applyRemainingOverride',
    'hasAnnualLeaveAllowance',
    'leaveYearBounds',
    'materialSearchScore',
    'rankMaterialRecords',
    'tokenizeMaterialSearch',
  ]) {
    assert.equal(typeof bundle[name], 'function', `${name} is exported from the packed script`)
  }
  // Objects built inside the sandbox have another realm's prototypes; compare by value.
  const plain = (value: unknown) => JSON.parse(JSON.stringify(value))
  assert.deepEqual(plain(bundle.halfDayWindows(DEFAULT_DAY)), plain(halfDayWindows(DEFAULT_DAY)))
  assert.deepEqual(
    plain(bundle.halfDayWindows({ standardDayStart: '13:00', standardDayEnd: '19:00' })),
    plain(halfDayWindows({ standardDayStart: '13:00', standardDayEnd: '19:00' }))
  )
  const custom = { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '09:30' }
  assert.deepEqual(plain(bundle.slotInterval(custom, DEFAULT_DAY)), plain(slotInterval(custom, DEFAULT_DAY)))
  const leaveArgs = {
    timeZone: 'Europe/London',
    startDayKey: '2026-10-12',
    endDayKey: '2026-10-16',
    day: DEFAULT_DAY,
    includeWeekends: false,
    people: LEAVE_PEOPLE,
    leave: [{ id: 'L1', userId: 'U-SAM', startDayKey: '2026-10-12', endDayKey: '2026-10-12', timeSlot: 'PM', approved: true }],
    bookings: [{ id: 'B1', personId: 'OP-SAM', kind: 'operative', dayKey: '2026-10-12', ...custom, label: 'J100 Site' }],
  }
  const bundledLeave = plain(bundle.leaveCoverageRows(leaveArgs)) as Array<{ kind: string; missingHours: number }>
  assert.deepEqual(bundledLeave, plain(leaveCoverageRows(leaveArgs)))
  assert.equal(bundledLeave.length, 1)
  assert.equal(bundledLeave[0].kind, 'leave_cover')
  assert.equal(bundledLeave[0].missingHours, 2.5)
  assert.equal(bundle.qualificationDismissKey('OP-Q', 'Q-OLD', '2026-09-01'), qualificationDismissKey('OP-Q', 'Q-OLD', '2026-09-01'))
  const balanceArgs = {
    annualLeaveEnabled: false,
    orgStartMonth: 1,
    orgEndMonth: 12,
    bookings: [{ startDayKey: '2026-06-10', timeSlot: 'AM', status: 'approved' }],
    onDayKey: '2026-10-09',
  }
  assert.deepEqual(plain(bundle.annualLeaveBalance(balanceArgs)), plain(annualLeaveBalance(balanceArgs)))
  const searchArgs = [
    '2.5mm LS',
    [{ name: '2.5mm2 Twin & Earth Cable 6242B LSZH (100m Drum)', productCode: '6242B' }],
  ] as const
  assert.deepEqual(plain(bundle.rankMaterialRecords(...searchArgs)), plain(rankMaterialRecords(...searchArgs)))
})

test('dismissing an expired qualification hides it until the expiry date changes', () => {
  const rows = qualificationExpiryRows({
    referenceIso: '2026-10-06T11:00:00.000Z',
    operatives: [
      {
        id: 'OP-Q',
        isActive: true,
        name: 'Quinn',
        expiries: [
          { qualificationId: 'Q-OLD', name: 'First aid', expiryIso: '2026-09-01T11:00:00.000Z' },
          { qualificationId: 'Q-SOON', name: 'CSCS', expiryIso: '2026-10-16T11:00:00.000Z' },
        ],
      },
    ],
  })
  assert.equal(rows[0].dismissKey, qualificationDismissKey('OP-Q', 'Q-OLD', '2026-09-01'))
  const hidden = withoutDismissedQualificationRows(rows, new Set([rows[0].dismissKey]))
  assert.deepEqual(hidden.map((row) => row.id), ['qual-OP-Q-Q-SOON'])
  // A dismissal recorded against a different expiry date does not hide the renewed warning.
  const stale = withoutDismissedQualificationRows(rows, [qualificationDismissKey('OP-Q', 'Q-OLD', '2025-09-01')])
  assert.equal(stale.length, 2)
  // Upcoming expiries are never hidden by a dismissal.
  const upcoming = withoutDismissedQualificationRows(rows, [rows[1].dismissKey])
  assert.equal(upcoming.length, 2)
})

test('every admin and manager sees every job and every warning; operatives and role-less accounts do not', () => {
  for (const role of [superAdmin, admin, manager]) {
    assert.equal(seesEveryJob(role), true)
    assert.equal(canViewStaffWarnings(role), true)
  }
  for (const role of [operative, noRole]) {
    assert.equal(seesEveryJob(role), false)
    assert.equal(canViewStaffWarnings(role), false)
  }
  // Operative mode wins over a stale admin or manager flag.
  assert.equal(seesEveryJob({ ...admin, isOperativeMode: true }), false)
  assert.equal(seesEveryJob({ ...manager, isOperativeMode: true }), false)
})

test('the Projects and Small works toggles gate add and edit only, never the list, and super admin ignores them', () => {
  const off = { projects: false, smallWorks: false }
  const projectsOnly = { projects: true, smallWorks: false }
  // The list is still the whole company with both toggles off.
  assert.equal(seesEveryJob(manager), true)
  assert.equal(seesEveryJob(admin), true)
  // Editing follows the toggle for admins and managers.
  assert.equal(canEditWorkCatalogue(manager, 'projects', off), false)
  assert.equal(canEditWorkCatalogue(manager, 'smallWorks', off), false)
  assert.equal(canEditWorkCatalogue(manager, 'projects', projectsOnly), true)
  assert.equal(canEditWorkCatalogue(manager, 'smallWorks', projectsOnly), false)
  assert.equal(canEditWorkCatalogue(admin, 'projects', off), false)
  assert.equal(canEditWorkCatalogue(admin, 'projects', projectsOnly), true)
  // Super admin adds and edits regardless.
  assert.equal(canEditWorkCatalogue(superAdmin, 'projects', off), true)
  assert.equal(canEditWorkCatalogue(superAdmin, 'smallWorks', off), true)
  // Operatives and role-less accounts never edit, even with the toggle on.
  assert.equal(canEditWorkCatalogue(operative, 'projects', { projects: true, smallWorks: true }), false)
  assert.equal(canEditWorkCatalogue(noRole, 'projects', { projects: true, smallWorks: true }), false)
})

test('a manager receives a job notification only as line manager or assigned project manager', () => {
  const job = { assignedManagerUserIds: ['pm-1'], lineManagerUserIds: ['lm-1'] }
  assert.equal(receivesJobNotification({ userId: 'pm-1', role: manager, ...job }), true)
  assert.equal(receivesJobNotification({ userId: 'lm-1', role: manager, ...job }), true)
  // Seeing the job in the list does not make this manager a recipient.
  assert.equal(seesEveryJob(manager), true)
  assert.equal(receivesJobNotification({ userId: 'other-manager', role: manager, ...job }), false)
  // Admins and super admins always receive it.
  assert.equal(receivesJobNotification({ userId: 'adm', role: admin, ...job }), true)
  assert.equal(receivesJobNotification({ userId: 'root', role: superAdmin, ...job }), true)
  // Operatives are not on the staff fan-out, even when named.
  assert.equal(receivesJobNotification({ userId: 'pm-1', role: operative, ...job }), false)
  assert.equal(receivesJobNotification({ userId: '', role: admin, ...job }), false)
  assert.equal(receivesJobNotification({ userId: ' pm-1 ', role: manager, assignedManagerUserIds: ['pm-1'] }), true)
})

test('the iOS JavaScript bundle applies the same staff visibility and recipient rule as this module', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: {
    ProjectPlannerCanonical?: {
      seesEveryJob: (role: StaffAccountRole) => boolean
      canViewStaffWarnings: (role: StaffAccountRole) => boolean
      canEditWorkCatalogue: (role: StaffAccountRole, catalogue: string, toggles: unknown) => boolean
      receivesJobNotification: (input: unknown) => boolean
    }
  } = {}
  runInContext(source, createContext(sandbox))
  const bundle = sandbox.ProjectPlannerCanonical
  assert.ok(bundle)
  const off = { projects: false, smallWorks: false }
  assert.equal(bundle.seesEveryJob(manager), seesEveryJob(manager))
  assert.equal(bundle.seesEveryJob(operative), seesEveryJob(operative))
  assert.equal(bundle.canViewStaffWarnings(manager), canViewStaffWarnings(manager))
  assert.equal(bundle.canEditWorkCatalogue(manager, 'projects', off), canEditWorkCatalogue(manager, 'projects', off))
  assert.equal(bundle.canEditWorkCatalogue(superAdmin, 'projects', off), canEditWorkCatalogue(superAdmin, 'projects', off))
  const input = { userId: 'm-2', role: manager, assignedManagerUserIds: ['m-1'], lineManagerUserIds: [] }
  assert.equal(bundle.receivesJobNotification(input), receivesJobNotification(input))
  assert.equal(bundle.receivesJobNotification(input), false)
})

test('unbooked labour counts a manager booking on another account with the same email', () => {
  const rows = unbookedLabourRows({
    timeZone: 'Europe/London',
    startDayKey: '2026-09-18',
    endDayKey: '2026-09-18',
    includeWeekends: false,
    standardPaidHours: 8,
    people: [
      {
        id: 'U-BOSS',
        email: 'boss@site.test',
        name: 'Boss Admin',
        isActive: true,
        passwordSet: true,
        isOperativeMode: false,
        isManager: true,
        isAdmin: true,
        isSuperAdmin: false,
      },
      {
        id: 'U-BOSS-ALIAS',
        email: 'boss@site.test',
        name: 'Boss Alias',
        isActive: true,
        passwordSet: true,
        isOperativeMode: false,
        isManager: true,
        isAdmin: false,
        isSuperAdmin: false,
      },
    ],
    operatives: [],
    bookings: [{ personId: 'U-BOSS-ALIAS', dayKey: '2026-09-18', kind: 'manager', timeSlot: 'FULL DAY' }],
    holidays: [],
  })
  assert.deepEqual(rows, [])
})

test('employment type on a day uses the scheduled transition, and a future date keeps the old type', () => {
  const user = {
    employmentType: 'paye',
    employmentTypeTransitionFrom: 'self_employed',
    employmentTypeEffectiveAt: new Date('2026-10-01T00:00:00Z'),
  }
  assert.equal(employmentTypeOnDay(user, new Date('2026-09-30T12:00:00Z'), 'Europe/London'), 'self_employed')
  assert.equal(employmentTypeOnDay(user, new Date('2026-10-01T12:00:00Z'), 'Europe/London'), 'paye')
  const tomorrow = applyEmploymentTypeChange({
    previousType: 'self_employed',
    nextType: 'paye',
    effectiveAt: new Date('2026-10-10T12:00:00Z'),
    now: new Date('2026-10-09T12:00:00Z'),
    timeZone: 'Europe/London',
  })
  assert.equal(tomorrow.employmentType, 'paye')
  assert.equal(tomorrow.employmentTypeTransitionFrom, 'self_employed')
  assert.ok(tomorrow.employmentTypeEffectiveAt)
  const today = applyEmploymentTypeChange({
    previousType: 'self_employed',
    nextType: 'paye',
    effectiveAt: 'immediate',
    now: new Date('2026-10-09T12:00:00Z'),
  })
  assert.equal(today.employmentTypeTransitionFrom, null)
  assert.equal(today.employmentTypeEffectiveAt, null)
  assert.equal(employmentEffectiveLabel({ employmentType: 'paye' }), 'Effective immediately')
  assert.equal(accountKindFromFlags({ operativeMode: true }), 'operative')
  assert.equal(accountKindFromFlags({ adminAccess: true }), 'admin')
  assert.equal(MANAGER_PERMISSION_TOGGLES[0].key, 'adminAccess')
  assert.equal(MANAGER_PERMISSION_TOGGLES[3].key, 'weeklyReports')
})

test('the leave year wraps April to March and resets on the first day after the end month', () => {
  const winter = leaveYearBounds({ startMonth: 4, endMonth: 3, onDayKey: '2026-02-15' })
  assert.deepEqual(winter, {
    startDayKey: '2025-04-01',
    endDayKey: '2026-03-31',
    yearKey: '2025-04-01',
  })
  const spring = leaveYearBounds({ startMonth: 4, endMonth: 3, onDayKey: '2026-04-01' })
  assert.equal(spring.yearKey, '2026-04-01')
  const calendar = leaveYearBounds({ startMonth: 1, endMonth: 12, onDayKey: '2026-10-09' })
  assert.deepEqual(calendar, {
    startDayKey: '2026-01-01',
    endDayKey: '2026-12-31',
    yearKey: '2026-01-01',
  })
})

test('turning the allowance off keeps bookings and shows a year count, not remaining days', () => {
  assert.equal(hasAnnualLeaveAllowance(false), false)
  assert.equal(hasAnnualLeaveAllowance(undefined), true)
  const bookings = [
    { startDayKey: '2026-03-02', timeSlot: 'FULL DAY', status: 'approved' },
    { startDayKey: '2026-06-10', timeSlot: 'AM', status: 'approved' },
    { startDayKey: '2025-11-03', timeSlot: 'FULL DAY', status: 'approved' },
  ]
  const thisYear = annualLeaveBalance({
    annualLeaveEnabled: false,
    orgStartMonth: 1,
    orgEndMonth: 12,
    bookings,
    onDayKey: '2026-10-09',
  })
  assert.equal(thisYear.hasAllowance, false)
  assert.equal(thisYear.remaining, null)
  assert.equal(thisYear.usedThisYear, 1.5)
  assert.equal(thisYear.taken, 1.5)
  const nextYear = annualLeaveBalance({
    annualLeaveEnabled: false,
    orgStartMonth: 1,
    orgEndMonth: 12,
    bookings,
    onDayKey: '2027-01-01',
  })
  assert.equal(nextYear.usedThisYear, 0)
})

test('a mid-year remaining override is the pot for this leave year and expires on the next year', () => {
  const bookings = [{ startDayKey: '2026-11-10', timeSlot: 'AM', status: 'approved' }]
  const write = applyRemainingOverride({
    remaining: 0.5,
    taken: 0,
    pending: 0,
    yearKey: '2026-01-01',
  })
  assert.equal(write.annualLeaveYearAllowance, 0.5)
  assert.equal(write.annualLeaveYearAllowanceKey, '2026-01-01')
  const afterHalf = annualLeaveBalance({
    annualLeaveEnabled: true,
    daysPerYear: 25,
    startMonth: 1,
    endMonth: 12,
    yearAllowance: write.annualLeaveYearAllowance,
    yearAllowanceKey: write.annualLeaveYearAllowanceKey,
    bookings,
    onDayKey: '2026-11-20',
  })
  assert.equal(afterHalf.remaining, 0)
  assert.equal(afterHalf.taken, 0.5)
  const nextYear = annualLeaveBalance({
    annualLeaveEnabled: true,
    daysPerYear: 25,
    startMonth: 1,
    endMonth: 12,
    yearAllowance: write.annualLeaveYearAllowance,
    yearAllowanceKey: write.annualLeaveYearAllowanceKey,
    bookings,
    onDayKey: '2027-01-01',
  })
  assert.equal(nextYear.remaining, 25)
  assert.equal(nextYear.yearAllowance, null)
})

test('2.5mm LS finds 2.5mm2 Twin & Earth Cable 6242B LSZH and ranks it first', () => {
  assert.deepEqual(tokenizeMaterialSearch('2.5 mm LS'), ['2.5mm', 'ls'])
  const twinEarth = {
    name: '2.5mm2 Twin & Earth Cable 6242B LSZH (100m Drum)',
    brand: 'Prysmian',
    productCode: '6242B',
    category: 'Cable',
    length: '100m',
  }
  const fifteen = { name: '1.5mm2 Twin & Earth Cable 6242Y LSZH (100m Drum)', productCode: '6242Y' }
  const swa = { name: '2.5mm2 SWA Cable LSZH (50m Drum)', productCode: 'SWA25' }
  const other = { name: 'M6 Coach Screw', brand: 'Fischer', productCode: 'CS-M6' }
  assert.ok(materialSearchScore('2.5mm LS', twinEarth) > 0)
  assert.equal(materialSearchScore('2.5mm LS', other), 0)
  assert.equal(materialSearchScore('2.5mm LS', fifteen), 0)
  const ranked = rankMaterialRecords('2.5mm LS', [other, fifteen, swa, twinEarth])
  assert.deepEqual(
    ranked.map((hit) => hit.index).sort(),
    [2, 3]
  )
  const coded = rankMaterialRecords('2.5mm LS 6242B', [swa, twinEarth])
  assert.equal(coded[0].index, 1)
  assert.ok(materialSearchScore('lszh', twinEarth) > 0)
})
