import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { serializeBooking } from './converters.ts'
import {
  DEFAULT_INVOICING,
  DEFAULT_PAYROLL_POLICY,
  invoicingToFirestore,
  parseInvoicing,
  parseWarningDetection,
  payrollPolicyToFirestore,
} from '../settings/organizationSettings.ts'
import { companyIdentityFirestoreFields } from '../orgSetup/orgSetupSettings.ts'
import { notificationPreferenceFieldPatch } from '../settings/notificationPreferences.ts'
import { permissionsForOperativeInvite } from '../orgSetup/accountPermissions.ts'
import { countHomeActiveProjects } from '../projects/homeActiveProjects.ts'
import { computeMissedMaterialOrderWarnings } from '../warnings/materialOrderWarnings.ts'
import { isOperativeSigned } from '../timesheets/timesheetApprovalPolicy.ts'
import { emptyTimesheetDraft } from '../timesheets/timesheetDraft.ts'
import {
  annualLeaveAllowance,
  leaveDayBlockedReason,
  leaveSubmitStatus,
} from '../annualLeave/leaveRequestDecision.ts'
import { payLineDisplay } from '../timesheets/payBasis.ts'
import type { Booking, Project, User, UserPermissions } from '../../types/index.ts'

function perms(partial: Partial<UserPermissions> = {}): UserPermissions {
  return {
    adminAccess: false,
    manager: false,
    operatives: false,
    skills: false,
    qualifications: false,
    materials: false,
    projects: false,
    smallWorks: false,
    operativeMode: false,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: false,
    subContractors: false,
    siteAudit: false,
    wholesalersOrderHistory: false,
    ...partial,
  }
}

test('a weekend hours save uses iOS payroll field names', () => {
  const payload = payrollPolicyToFirestore({
    ...DEFAULT_PAYROLL_POLICY,
    saturday: {
      ...DEFAULT_PAYROLL_POLICY.saturday,
      definedWindowStart: '08:00',
      definedWindowEnd: '13:00',
      countsAsStandardHours: 4,
      outsideWindowMultiplier: 2,
    },
    sunday: { ...DEFAULT_PAYROLL_POLICY.sunday, sameAsSaturday: true },
  })
  const saturday = payload.saturday as Record<string, unknown>
  assert.equal(saturday.customStandardStart, '08:00')
  assert.equal(saturday.countsAsHours, 4)
  assert.equal(saturday.outsideStandardWindowMultiplier, 2)
  assert.equal('definedWindowStart' in saturday, false)
  assert.equal('sameAsSaturday' in (payload.sunday as Record<string, unknown>), false)
  assert.equal(payload.sundaySameAsSaturday, true)
})

test('company address save writes flat iOS fields and keeps country and region', () => {
  const fields = companyIdentityFirestoreFields({
    addressLine1: '1 High Street',
    town: 'London',
    postcode: 'SW1A 1AA',
    currency: 'GBP',
    countryCode: 'GB',
    regionSelection: 'GB',
  })
  assert.equal(fields.officeAddressLine1, '1 High Street')
  assert.equal(fields.officeCity, 'London')
  assert.equal(fields.officePostcode, 'SW1A 1AA')
  assert.equal(fields.countryCode, 'GB')
  assert.equal(fields.bankHolidayRegionId, 'GB-ENG-WLS')
  assert.equal(fields.currencyCode, 'GBP')
})

test('notification save patch leaves bookingConflicts untouched', () => {
  const patch = notificationPreferenceFieldPatch({
    materialOrderCutOff: true,
    materialCutOffHour: 16,
    materialCutOffMinute: 30,
    materialCutOffOnSaturday: false,
    materialCutOffOnSunday: false,
  })
  assert.equal(patch['notificationPreferences.materialOrderCutOff'], true)
  assert.equal('notificationPreferences' in patch, false)
  assert.equal(Object.keys(patch).some((key) => key.includes('bookingConflicts')), false)
})

test('a web-invited operative starts with site audit, projects, small works, and timesheets on', () => {
  const permissions = permissionsForOperativeInvite()
  assert.equal(permissions.siteAudit, true)
  assert.equal(permissions.projects, true)
  assert.equal(permissions.smallWorks, true)
  assert.equal(permissions.operativeMode, true)
})

test('home active-project count is jobs whose dates include today', () => {
  const today = new Date('2026-06-10T12:00:00Z')
  const job = (id: string, start: string, end: string, extra: Partial<Project> = {}): Project =>
    ({
      id,
      jobNumber: '100',
      siteName: id,
      addressLine1: '',
      townCity: '',
      postcode: '',
      client: { id: 'c', name: 'C', createdAt: today, updatedAt: today },
      startDate: new Date(start),
      endDate: new Date(end),
      jobType: 'CAT A',
      manager: { name: 'M', email: '' },
      isLive: true,
      createdAt: today,
      updatedAt: today,
      ...extra,
    }) as Project
  const admin = {
    id: 'admin',
    email: 'a@x.com',
    firstName: 'A',
    surname: 'D',
    permissions: perms({ adminAccess: true }),
    isSuperAdmin: false,
    role: 'admin',
  } as User
  const count = countHomeActiveProjects({
    now: today,
    user: admin,
    projects: [
      job('live', '2026-06-01T00:00:00Z', '2026-06-20T00:00:00Z'),
      job('also', '2026-06-01T00:00:00Z', '2026-06-20T00:00:00Z', { jobNumber: '100' }),
      job('later', '2026-07-01T00:00:00Z', '2026-07-20T00:00:00Z'),
    ],
  })
  assert.equal(count, 2)
})

test('materials warning title and ordered lines after the cut-off', () => {
  const tomorrow = new Date('2026-06-11T12:00:00Z')
  const project = {
    id: 'P1',
    jobNumber: 'C1',
    siteName: 'Hall',
    jobType: 'CAT A',
    isLive: true,
  } as Project
  const booking = {
    id: 'B1',
    operativeId: 'OP',
    projectId: 'P1',
    date: tomorrow,
    timeSlot: 'FULL DAY',
    status: 'Confirmed',
    bookedBy: 'A',
    createdAt: tomorrow,
    updatedAt: tomorrow,
  } as Booking
  const afterCutoff = new Date('2026-06-10T16:45:00+01:00')
  const ordered = computeMissedMaterialOrderWarnings(
    [{ id: 'L1', projectId: 'P1', date: tomorrow, status: 'ordered', quantity: 1, unit: 'nr', material: 'Cable', addedBy: 'A' }],
    [],
    [project],
    [booking],
    { referenceDate: afterCutoff, cutOffHour: 16, cutOffMinute: 30 }
  )
  assert.equal(ordered.length, 0)
  const open = computeMissedMaterialOrderWarnings(
    [{ id: 'L1', projectId: 'P1', date: tomorrow, status: 'needed', quantity: 1, unit: 'nr', material: 'Cable', addedBy: 'A' }],
    [],
    [project],
    [booking],
    { referenceDate: afterCutoff, cutOffHour: 16, cutOffMinute: 30 }
  )
  assert.equal(open.length, 1)
  assert.equal(open[0].title, 'Material order not placed')
  assert.match(open[0].message, /16:30/)
  const empty = computeMissedMaterialOrderWarnings([], [], [project], [booking], {
    referenceDate: afterCutoff,
    cutOffHour: 16,
    cutOffMinute: 30,
  })
  assert.equal(empty.length, 1)
  assert.equal(empty[0].title, 'Material order not placed')
})

test('signed detection ignores a bare date and accepts a name after 2020', () => {
  assert.equal(isOperativeSigned({ ...emptyTimesheetDraft(), operativeSignedAt: new Date() }), false)
  assert.equal(
    isOperativeSigned({
      ...emptyTimesheetDraft(),
      operativeSignedAt: new Date('2026-03-02T09:00:00Z'),
      operativeSignedByName: 'Ada',
    }),
    true
  )
})

test('leave stays pending without self-book, blocks Saturday, and defaults to 25 days', () => {
  const manager = {
    permissions: perms({ manager: true, annualLeaveSelfBook: false }),
    assignedManagerUserIds: ['boss'],
  } as User
  assert.equal(leaveSubmitStatus(manager), 'pending')
  const saturday = new Date('2026-06-13T12:00:00Z')
  assert.match(leaveDayBlockedReason(saturday, false) || '', /not taken from the allowance/)
  assert.equal(annualLeaveAllowance(undefined), 25)
  assert.equal(annualLeaveAllowance(null), 25)
})

test('overtime rate type uses Hourly OT x1.5 when the multiplier is written', () => {
  const shown = payLineDisplay({
    payBasis: 'hourly',
    paidHours: 2,
    standardDayHours: 8,
    rate: 20,
    pay: 60,
    isOvertime: true,
    otMultiplier: 1.5,
  })
  assert.equal(shown.rateType, 'Hourly OT x1.5')
})

test('firestore rules keep operative history, variations, and web-only collections', () => {
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8')
  assert.match(rules, /operativeDayRateHistory/)
  assert.match(rules, /match \/variations\/\{variationId\}/)
  assert.match(rules, /variationTrackers/)
  assert.match(rules, /accountConfirmations/)
  assert.match(rules, /productFeedback/)
})

test('payment run write uses startDay and endDay, and a missing mode is date ranges', () => {
  const written = invoicingToFirestore(DEFAULT_INVOICING)
  const ranges = written.paymentRunDateRanges as Array<Record<string, unknown>>
  assert.equal(ranges[0].startDay, 1)
  assert.equal(ranges[0].endDay, 15)
  assert.equal(ranges[0].startDate, 1)
  assert.equal(ranges[0].endDate, 15)
  assert.equal(parseInvoicing({}).paymentRunMode, 'date_ranges')
  assert.equal(parseInvoicing({ paymentRunMode: 'recurring_timeframe' }).paymentRunMode, 'recurring_timeframe')
})

test('unbooked exclusions fall back when the iOS key is absent', () => {
  const parsed = parseWarningDetection({ excludedUserIds: ['U1'] })
  assert.deepEqual(parsed.excludedUserIdsFromUnbookedWarnings, ['U1'])
})

test('serializeBooking omits unread group fields', () => {
  const payload = serializeBooking({
    id: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
    operativeId: 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB',
    projectId: 'CCCCCCCC-CCCC-CCCC-CCCC-CCCCCCCCCCCC',
    date: new Date(),
    timeSlot: 'FULL DAY',
    bookedBy: 'Farnie',
    status: 'Confirmed',
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  assert.equal('bookingGroupId' in payload, false)
  assert.equal('otMultiplierOverride' in payload, false)
})
