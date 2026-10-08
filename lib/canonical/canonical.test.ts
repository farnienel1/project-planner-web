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
import { qualificationExpiryRows, unbookedLabourRows, unverifiedOperativeRows } from './warningRows.ts'

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
