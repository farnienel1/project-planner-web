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
  intervalsOverlap,
  invoicingPeriod,
  organizationContextStillCurrent,
  organizationIdsMatch,
  organizationScopedKey,
  paidHoursForNamedSlot,
  resetOrganizationContextForTests,
} from './engine.ts'

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

test('full week coverage is Monday through Sunday in the organisation zone', () => {
  const window = coverageWindow({
    referenceIso: '2026-09-16T12:00:00.000Z',
    timeZone: 'Europe/London',
    clashLookaheadMode: 'endOfWorkingWeek',
  })
  assert.equal(window.startDayKey, '2026-09-14')
  assert.equal(window.endDayKey, '2026-09-20')
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
  const sandbox: { ProjectPlannerCanonical?: { coverageWindow: (input: unknown) => { startDayKey: string; endDayKey: string } } } = {}
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
})
