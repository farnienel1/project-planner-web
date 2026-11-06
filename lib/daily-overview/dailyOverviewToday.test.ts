/**
 * Owner decision 5 (5 Nov 2026), guardrail 7: Daily Overview's set-up moved into `dailyOverviewToday.ts` so Home's
 * admin panels use the same one. This test proves the move changed no figure: the model built through the shared
 * functions equals, field for field, the model built with the wiring `DailyOverviewScreen.tsx` had before.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { effectivePayrollTimePolicy } from '@/lib/canonical'
import { dateFromDayKey, dayKey } from '@/lib/ios-parity/londonTime'
import { policyForBookingDate } from '@/lib/scheduling/bookingSlotRules'
import { DEFAULT_PAYROLL_POLICY, organizationDetailsFromData } from '@/lib/settings/organizationSettings'
import { buildDailyOverview } from './buildDailyOverview'
import {
  DEFAULT_DAILY_OVERVIEW_SETTINGS,
  dailyOverviewInput,
  dailyOverviewSettings,
  overviewHolidayName,
  overviewPersonName,
} from './dailyOverviewToday'

const ZONE = 'Europe/London'
const ORG = 'ORG-1'

const orgData = {
  name: 'Raccord MEP',
  countryCode: 'GB',
  payrollTimePolicy: {
    ...DEFAULT_PAYROLL_POLICY,
    standardDayStart: '07:30',
    standardDayEnd: '16:00',
    unpaidBreakMinutes: 30,
    breakWindowStart: '12:00',
    breakWindowEnd: '12:30',
    weekdayOvertimeMultiplier: 1.5,
  },
  warningDetection: {
    detectClashes: true,
    clashLookaheadMode: 'days',
    clashLookaheadDays: 7,
    includeWeekendsForUnbookedLabour: true,
    excludedUserIdsFromUnbookedWarnings: ['u-director'],
    weekendCoverage: { saturday: { enabled: true, start: '07:30', end: '13:00' }, sunday: { enabled: false, start: null, end: null } },
  },
}

function person(id: string, firstName: string, flags: Record<string, boolean>, extra: Record<string, unknown> = {}) {
  return {
    id,
    email: `${id}@site.test`,
    firstName,
    surname: 'Test',
    organizationId: ORG,
    role: flags.adminAccess ? 'admin' : flags.operativeMode ? 'operative' : 'manager',
    isActive: true,
    passwordSet: true,
    isSuperAdmin: false,
    permissions: { operativeMode: false, manager: false, adminAccess: false, ...flags },
    policyAccepted: true,
    ...extra,
  }
}

function fixture(dayKeyText: string) {
  const day = dateFromDayKey(dayKeyText)
  const users = [
    person('u-admin', 'Ada', { adminAccess: true }),
    person('u-mgr', 'Max', { manager: true }, { assignedManagerUserIds: ['u-admin'] }),
    person('u-op1', 'Olly', { operativeMode: true }, { assignedManagerUserIds: ['u-mgr'] }),
    person('u-op2', 'Pat', { operativeMode: true }, { assignedManagerUserIds: ['u-mgr'] }),
    person('u-op3', 'Rae', { operativeMode: true }, { assignedManagerUserIds: ['u-mgr'] }),
    person('u-director', 'Dee', { adminAccess: true }),
  ]
  const operatives = [{ id: 'OP-RAE', firstName: 'Rae', lastName: 'Test', email: 'u-op3@site.test' }]
  const project = { id: 'P1', jobNumber: 'C646', siteName: '1 Carnaby Street', jobType: 'CAT A', isLive: true, managerIds: ['u-mgr'] }
  const small = { id: 'S1', jobNumber: 'SW12', siteName: 'Kiosk', jobType: 'CAT A', isLive: true }
  const bookings = [
    { id: 'B1', operativeId: 'u-op1', projectId: 'P1', date: day, timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '18:00', status: 'Confirmed', bookedBy: 'a', createdAt: day, updatedAt: day },
    { id: 'B2', operativeId: 'U-OP2', projectId: 'S1', date: day, timeSlot: 'FULL DAY', status: 'Confirmed', bookedBy: 'a', createdAt: day, updatedAt: day },
  ]
  const managerSiteBookings = [
    { id: 'M1', userId: 'u-mgr', date: day, timeSlot: 'FULL_DAY', locationType: 'office', status: 'Confirmed' },
  ]
  const holidays = [
    { id: 'H1', userId: '', operativeId: 'OP-RAE', startDate: day, endDate: day, timeSlot: 'AM', status: 'approved', startDayKey: dayKeyText, endDayKey: dayKeyText },
  ]
  const subcontractorBookings = [
    { id: 'SB1', subcontractorId: 'SUB1', projectId: 'P1', date: day, timeSlot: 'CUSTOM_HOURS', workStartTime: '08:00', workEndTime: '16:00', status: 'Confirmed', bookedContactIds: ['C1'], bookedOperativeNames: [] },
  ]
  const subcontractors = [{ id: 'SUB1', name: 'Steele Roofing', contacts: [{ id: 'C1', name: 'Sam Steele' }] }]
  return { day, users, operatives, projects: [project], smallWorks: [small], bookings, managerSiteBookings, holidays, subcontractorBookings, subcontractors }
}

/** The wiring `DailyOverviewScreen.tsx` had before the move (state set from the live organisation document). */
function legacyModel(f: ReturnType<typeof fixture>, viewer: unknown) {
  let payrollPolicy = DEFAULT_PAYROLL_POLICY
  let includeWeekendsForUnbookedLabour = false
  let excludedUserIdsFromUnbookedWarnings: string[] = []
  let weekendCoverage: unknown = null
  const details = organizationDetailsFromData(ORG, orgData)
  payrollPolicy = effectivePayrollTimePolicy(orgData, dayKey(f.day, ZONE), ZONE) as typeof payrollPolicy
  includeWeekendsForUnbookedLabour = details.warningDetection.includeWeekendsForUnbookedLabour
  excludedUserIdsFromUnbookedWarnings = details.warningDetection.excludedUserIdsFromUnbookedWarnings ?? []
  weekendCoverage = details.warningDetection.weekendCoverage ?? null
  return buildDailyOverview({
    viewer: viewer as never,
    enforcedReads: false,
    day: f.day,
    today: f.day,
    projects: [...f.projects, ...f.smallWorks] as never,
    bookings: f.bookings as never,
    managerBookings: f.managerSiteBookings as never,
    holidays: f.holidays as never,
    users: f.users as never,
    userIdAliases: {},
    operatives: f.operatives as never,
    subcontractorBookings: f.subcontractorBookings as never,
    subcontractors: f.subcontractors,
    payrollPolicy: policyForBookingDate(f.day, payrollPolicy) ?? payrollPolicy,
    includeWeekendsForUnbookedLabour,
    excludedUserIdsFromUnbookedWarnings,
    weekendCoverage: weekendCoverage as never,
    timeZone: ZONE,
  })
}

function sharedModel(f: ReturnType<typeof fixture>, viewer: unknown) {
  const settings = dailyOverviewSettings({ organizationId: ORG, liveOrganizationId: ORG, data: orgData, day: f.day, timeZone: ZONE })
  assert.ok(settings)
  return buildDailyOverview(
    dailyOverviewInput({
      viewer: viewer as never,
      enforcedReads: false,
      day: f.day,
      today: f.day,
      projects: f.projects as never,
      smallWorks: f.smallWorks as never,
      bookings: f.bookings as never,
      managerSiteBookings: f.managerSiteBookings as never,
      holidays: f.holidays as never,
      users: f.users as never,
      userIdAliases: {},
      operatives: f.operatives as never,
      subcontractorBookings: f.subcontractorBookings as never,
      subcontractors: f.subcontractors,
      settings,
      timeZone: ZONE,
    })
  )
}

// `JobAccessViewer`s, as `webJobAccessViewer` builds them.
const adminViewer = { uid: 'u-admin', ids: ['u-admin'], email: 'u-admin@site.test', role: { isAdmin: true, isSuperAdmin: false, isOperativeMode: false, isManager: false } }
const managerViewer = { uid: 'u-mgr', ids: ['u-mgr'], email: 'u-mgr@site.test', role: { isAdmin: false, isSuperAdmin: false, isOperativeMode: false, isManager: true } }

for (const dayKeyText of ['2026-11-05', '2026-11-07', '2026-11-08']) {
  for (const [label, viewer] of [['admin', adminViewer], ['manager', managerViewer], ['no viewer', null]] as const) {
    test(`Daily Overview model is unchanged by the shared set-up (${dayKeyText}, ${label})`, () => {
      const f = fixture(dayKeyText)
      const before = legacyModel(f, viewer)
      const after = sharedModel(f, viewer)
      assert.deepEqual(after, before)
    })
  }
}

test('the shared set-up is not empty: the fixture shows booked people, hours, subcontractors, leave and office', () => {
  const f = fixture('2026-11-05')
  const model = sharedModel(f, adminViewer)
  assert.ok(model.labourHours > 0)
  assert.ok(model.bookedPeopleCount >= 2)
  assert.ok(model.projectCards.some((card) => card.people.some((row) => row.kind === 'subcontractor')))
  assert.equal(model.holidays.length, 1)
  assert.equal(model.officeBookings.length, 1)
})

test('settings are null until the live document is this organisation’s; defaults are what Daily Overview showed first', () => {
  const day = dateFromDayKey('2026-11-05')
  assert.equal(dailyOverviewSettings({ organizationId: ORG, liveOrganizationId: 'OTHER', data: orgData, day, timeZone: ZONE }), null)
  assert.equal(dailyOverviewSettings({ organizationId: ORG, liveOrganizationId: ORG, data: null, day, timeZone: ZONE }), null)
  assert.deepEqual(DEFAULT_DAILY_OVERVIEW_SETTINGS, {
    payrollPolicy: DEFAULT_PAYROLL_POLICY,
    includeWeekendsForUnbookedLabour: false,
    excludedUserIdsFromUnbookedWarnings: [],
    weekendCoverage: null,
  })
})

test('names on leave and office rows are read as Daily Overview read them', () => {
  const f = fixture('2026-11-05')
  assert.equal(overviewPersonName('u-mgr', f.users as never), 'Max Test')
  assert.equal(overviewHolidayName({ operativeId: 'op-rae' }, f.users as never, f.operatives), 'Rae Test')
  assert.equal(overviewHolidayName({ userId: 'nobody' }, f.users as never, f.operatives), 'Team member')
})

test('1.33.0 a manager\'s Daily Overview shows only their own team; admins see everyone and subcontractors', () => {
  const f = fixture('2026-11-05')
  // A non-report booked on the manager's job (P1) and a subcontractor there are not shown to the manager.
  const extra = { ...f, bookings: [...f.bookings, { ...f.bookings[0], id: 'B9', operativeId: 'u-director' }] }
  const manager = sharedModel(extra as never, managerViewer)
  const admin = sharedModel(extra as never, adminViewer)
  const people = (model: typeof manager) => model.projectCards.flatMap((card) => card.people.map((row) => row.operativeId ?? row.userId ?? row.kind))
  assert.deepEqual(people(manager).sort(), ['U-OP2', 'u-op1'])
  assert.ok(people(admin).includes('u-director'))
  assert.ok(admin.projectCards.some((card) => card.people.some((row) => row.kind === 'subcontractor')))
  assert.equal(manager.projectCards.some((card) => card.people.some((row) => row.kind === 'subcontractor')), false)
  assert.ok(manager.labourHours < admin.labourHours)
  // Leave (Rae, a report, on an operatives row on her email) and the manager's own office booking stay.
  assert.equal(manager.holidays.length, 1)
  assert.equal(manager.officeBookings.length, 1)
})
