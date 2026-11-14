import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { createContext, runInContext } from 'node:vm'
import * as R112 from './index'
import { dateFromDayKeyInZone as zoneMidnight112, dayKeyInZone as zoneDayKey112 } from '../orgTime/zoneTime'
import { parsePayrollPolicy as parsePolicy112 } from './organizationSettings'
import { payrollPolicyToFirestore as policyToFirestore119 } from './organizationSettings'
import { warningDetectionFirestoreFields as wdFields119 } from './organizationSettings'
import {
  adoptCurrentOrganization,
  bookingBelongsToOrganization,
  CANONICAL_TIME_ZONE,
  captureOrganizationContext,
  chooseSessionOrganization,
  coverageWindow,
  IOS_SESSION_ORGANIZATION_STORAGE_KEY,
  orgAccessProbeFromReads,
  rememberedOrganizationSurvivesSignOut,
  sessionMembershipIds,
  shouldClearRememberedOrganization,
  webSessionOrganizationStorageKey,
  standardDayCoverage,
  intervalsOverlap,
  invoicingPeriod,
  normalizePaymentRunRange,
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
  bookingOccupiesDay,
  formerIdAliases,
  labourBookingKind,
  labourPersonIds,
  qualificationDismissKey,
  qualificationExpiryRows,
  unbookedLabourRows,
  unbookedLabourRowsOnDay,
  unverifiedOperativeRows,
  withoutDismissedQualificationRows,
} from './warningRows.ts'
import {
  DEFAULT_WARNINGS_SORT_DIRECTION,
  compareWarningDayKeys,
  parseWarningsSortDirection,
  sortWarningsByDate,
} from './warningSort.ts'
import { eachDayKey } from './dayKeys.ts'
import { leaveCoverageRows } from './leaveCoverage.ts'
import {
  canEditWorkCatalogue,
  canManageVariationTracker,
  canReviewUserTimesheets,
  canSeeVariations,
  canViewStaffWarnings,
  receivesJobNotification,
  seesEveryJob,
  seesEveryUserTimesheet,
  type StaffAccountRole,
} from './staffAccess.ts'
import {
  DEFAULT_INVOICING,
  DEFAULT_PAYMENT_RUN_DATE_RANGES,
  DEFAULT_WARNING_DETECTION,
  coalesceOrganizationName,
  displayOrganizationName,
  invoicingToFirestore,
  organizationNameToFirestore,
  organizationNameWriteFields,
  formatMaterialCutOffClock,
  parseInvoicing,
  parseMaterialCutOff,
  parseOrganizationName,
  parsePaymentRunDateRanges,
  parseWarningDetection,
  resolveMaterialCutOffClock,
  paymentRunShowsMonthCoverage,
  starterCollectionShouldSeed,
  missingStarterQualificationCodes,
} from './organizationSettings.ts'
import { MANAGER_PERMISSION_TOGGLES } from './permissionLevels.ts'
import {
  accountKindFromFlags,
  applyEmploymentTypeChange,
  employmentEffectiveLabel,
  employmentTypeOnDay,
  USER_DOCUMENT_FIELDS,
  USER_FORMER_IDS_FIELD,
  USER_SELF_CREATE_AGE_FIELDS,
  inviteMigrationFormerIdWriteFields,
  parseFormerUserIds,
  userCreateRequiresAgeConfirmation,
} from './userProfile.ts'
import {
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND,
  compareInboxNotificationsByCreatedAt,
  devicePushNotificationTypes,
  inboxNotificationVisibleToUser,
  notificationDeliversDevicePush,
  notificationDestination,
  notificationPreferenceAllowsDelivery,
  notificationPreferenceCopy,
  visibleNotificationPreferenceKeys,
  parseUserNotificationPreferences,
  unreadNotificationBadgeCount,
  userNotificationPreferenceFieldPatch,
  userNotificationPreferencesToFirestore,
} from './notificationPreferences.ts'
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
import {
  QUALIFICATION_FILTER_ALL,
  qualificationLibraryFilterChips,
  qualificationMatchesSection,
  qualificationSearchScore,
  rankQualificationRecords,
  tokenizeQualificationSearch,
} from './qualificationSearch.ts'
import {
  assignedQualificationWriteFields,
  mergeOperativeQualificationWrite,
  mergeQualificationCertificateUrls,
  qualificationCertificateStoragePath,
  qualificationCertificateUrl,
  removedQualificationCertificateIds,
} from './operativeQualifications.ts'
import {
  DEFAULT_MATERIAL_DELIVERY_CLOCK,
  DEFAULT_MATERIAL_DELIVERY_MINUTES,
  defaultMaterialDeliveryDayKey,
  defaultMaterialDeliveryRequiredAt,
  formatMaterialDeliveryRequired,
  materialOrderIncludesDeliveryRequired,
} from './materialDelivery.ts'
import {
  canViewSensitiveProfile,
  exportIncludesSensitiveFields,
  maskSensitiveValue,
  resolveSensitiveProfile,
  sensitiveProfileDocPath,
  sensitiveProfileWriteFields,
} from './sensitiveProfile.ts'
import { legalPackNeedsAcceptance } from './legalPack.ts'
import {
  FILE_REPORT_DETAILS_MAX,
  canReviewFileReports,
  fileReportCollectionPath,
  fileReportReasonCopy,
  fileReportReviewWriteFields,
  fileReportStoragePath,
  fileReportWriteFields,
} from './fileReports.ts'
import {
  ORPHAN_BOOKING_LABEL,
  bookingHealthRows,
  bookingJobLabel,
  bookingJobState,
  bookingWriteFields,
  bookingsToRemoveOnOperativeDelete,
  bookingsToRemoveOnProjectDelete,
  parseBookingDocument,
} from './bookings.ts'
import {
  TIMESHEET_CLOSE_OF_PLAY_HOUR,
  TIMESHEET_NOTIFY_HOUR,
  defaultTimesheetSubmissionFromPaymentDay,
  defaultTimesheetSubmissionFromPaymentWeekday,
  dueTimesheetSubmissionNotices,
  monthDayOffsetBefore,
  paymentDateAfterPeriodEnd,
  timesheetSubmissionAfterPaymentDayChange,
  timesheetSubmissionNoticeCopy,
  weekdayOffsetBefore,
} from './timesheetSubmission.ts'
import {
  isTimesheetAwaitingSignOff,
  isTimesheetFullySigned,
  parseTimesheetStatusFields,
  paymentRunHistoryAfterChange,
  pickTimesheetRowForPeriod,
  resolveTimesheetExportedAtMs,
  resolveTimesheetPeriod,
  selectableTimesheetPaymentRunPeriods,
  timesheetDocumentId,
  timesheetExportStoragePath,
  timesheetListBucket,
  timesheetPeriodContainsDay,
  timesheetPeriodFromInvoicing,
  timesheetPeriodMatches,
  timesheetSignOffWriteFields,
} from './timesheetPeriod.ts'
import { PAYMENT_GRACE_MS, hasAccess } from './billingAccess.ts'
import {
  isAnonymisedDeletedProfile,
  isIdentifiablePendingLeftover,
  listedCurrentLabourPeople,
  listedRosterUsers,
  matchesRosterSegment,
  rosterSegment,
} from './userRosterSegment.ts'
import {
  inviteEmailHasLiveClaim,
  inviteEmailOrgLookupConstraints,
  invitePlaceholderUserWriteFields,
  inviteWritesOperativeProfile,
  resolveInviteEmailClaim,
} from './inviteEmailClaim.ts'
import { PAYE_PAY_CELL_LABEL, reportPayCell, reportPayTotal, reportPersonPayCell } from './reportPay.ts'
import { payrollHoursResult, reportDayValue, subcontractorDayValue } from './payrollHours.ts'
import { overlappingIntervalGroups } from './engine.ts'
import { DEFAULT_PAYROLL_POLICY, parsePayrollPolicy } from './organizationSettings.ts'

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
  assert.equal(choice.persistOrganizationId, null)
})

test('a remembered company wins over a different user-document company', () => {
  for (const probe of ['allowed', 'unknown'] as const) {
    const choice = chooseSessionOrganization({
      rememberedOrganizationId: 'org-phone',
      documentOrganizationId: 'org-other',
      probes: { 'org-phone': probe, 'org-other': 'allowed' },
    })
    assert.equal(choice.organizationId, 'org-phone')
    assert.equal(choice.persistOrganizationId, 'org-phone')
  }
})

test('a remount with remembered A and user-document B keeps A and does not persist B', () => {
  const choice = chooseSessionOrganization({
    rememberedOrganizationId: 'org-a',
    documentOrganizationId: 'org-b',
    probes: { 'org-a': 'unknown', 'org-b': 'allowed' },
  })
  assert.equal(choice.organizationId, 'org-a')
  assert.equal(choice.persistOrganizationId, 'org-a')
  assert.notEqual(choice.persistOrganizationId, 'org-b')
})

test('a first-tick miss of the remember key does not persist the user-document fallback', () => {
  const choice = chooseSessionOrganization({
    rememberedOrganizationId: '',
    documentOrganizationId: 'org-b',
    probes: { 'org-b': 'allowed' },
  })
  assert.equal(choice.organizationId, 'org-b')
  assert.equal(choice.persistOrganizationId, null)
})

test('an unconfirmed first-tick membership read is unknown, not denied', () => {
  const probe = orgAccessProbeFromReads({
    orgRead: 'loaded',
    membershipRead: 'missing',
    listed: false,
    isCreator: false,
    unconfirmed: true,
  })
  assert.equal(probe, 'unknown')
  const denied = orgAccessProbeFromReads({
    orgRead: 'loaded',
    membershipRead: 'missing',
    listed: false,
    isCreator: false,
  })
  assert.equal(denied, 'denied')
})

test('a slow or unknown membership read does not drop the remembered company', () => {
  const unknown = orgAccessProbeFromReads({
    orgRead: 'failed',
    membershipRead: 'failed',
    listed: false,
    isCreator: false,
  })
  assert.equal(unknown, 'unknown')
  const choice = chooseSessionOrganization({
    rememberedOrganizationId: 'org-remembered',
    documentOrganizationId: 'org-document',
    probes: { 'org-remembered': unknown, 'org-document': 'allowed' },
  })
  assert.equal(choice.organizationId, 'org-remembered')
  assert.equal(choice.persistOrganizationId, 'org-remembered')
})

test('an explicit switch persists that company as the remembered key', () => {
  const choice = chooseSessionOrganization({
    explicitOrganizationId: 'org-b',
    rememberedOrganizationId: 'org-a',
    documentOrganizationId: 'org-a',
    probes: { 'org-b': 'allowed', 'org-a': 'allowed' },
  })
  assert.equal(choice.organizationId, 'org-b')
  assert.equal(choice.persistOrganizationId, 'org-b')
})

test('same-user sign-out keeps the remembered company; a different account does not inherit it', () => {
  assert.equal(rememberedOrganizationSurvivesSignOut(), true)
  assert.equal(shouldClearRememberedOrganization({ signedOutUserId: 'user-1', nextUserId: '' }), false)
  assert.equal(shouldClearRememberedOrganization({ signedOutUserId: 'user-1', nextUserId: 'user-1' }), false)
  assert.equal(shouldClearRememberedOrganization({ signedOutUserId: 'user-1', nextUserId: 'user-2' }), true)
  assert.equal(webSessionOrganizationStorageKey('user-1'), 'pp.webActiveOrg:user-1')
  assert.equal(IOS_SESSION_ORGANIZATION_STORAGE_KEY, 'cached_organizationId')
})

test('a finished membership query still keeps the remembered company on the switcher list', () => {
  const complete = sessionMembershipIds({
    discoveredIds: ['org-document'],
    rememberedOrganizationId: 'org-remembered',
    documentOrganizationId: 'org-document',
    discoveryIncomplete: false,
  })
  assert.deepEqual(complete, ['org-document', 'org-remembered'])
  const incomplete = sessionMembershipIds({
    discoveredIds: ['org-document'],
    previousIds: ['org-document'],
    rememberedOrganizationId: 'org-remembered',
    documentOrganizationId: 'org-document',
    discoveryIncomplete: true,
  })
  assert.deepEqual(incomplete, ['org-document', 'org-remembered'])
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

test('end-of-invoicing-period scan for a 1–15 firm stops on the 15th and never lists the 16th', () => {
  const window = coverageWindow({
    referenceIso: '2026-10-09T12:00:00+01:00',
    timeZone: 'Europe/London',
    clashLookaheadMode: 'endOfInvoicingPeriod',
    paymentRunMode: 'date_ranges',
    ranges: [
      { startDay: 1, endDay: 15 },
      { startDay: 16, endDay: 31 },
    ],
  })
  assert.equal(window.startDayKey, '2026-10-01')
  assert.equal(window.endDayKey, '2026-10-15')
  const days = eachDayKey(window.startDayKey, window.endDayKey, 'Europe/London')
  assert.equal(days.includes('2026-10-15'), true)
  assert.equal(days.includes('2026-10-16'), false)
  assert.equal(days.at(-1), '2026-10-15')
  const unbooked = unbookedLabourRows({
    timeZone: 'Europe/London',
    startDayKey: window.startDayKey,
    endDayKey: window.endDayKey,
    includeWeekends: false,
    standardPaidHours: 8,
    people: [
      {
        id: 'U-SAM',
        email: 'sam@site.test',
        name: 'Sam Booked',
        isActive: true,
        passwordSet: true,
        isOperativeMode: true,
        isManager: false,
        isAdmin: false,
        isSuperAdmin: false,
      },
    ],
    operatives: [],
    bookings: [],
    holidays: [],
  })
  const unbookedDays = [...new Set(unbooked.map((row) => row.dayKey))]
  assert.equal(unbookedDays.includes('2026-10-15'), true)
  assert.equal(unbookedDays.includes('2026-10-16'), false)
})

test('the invoicing window has no extra day on the default or iOS-saved 1–15 run', () => {
  const oct6 = '2026-10-06T11:00:00.000Z'
  const empty = invoicingPeriod({
    referenceIso: oct6,
    timeZone: 'Europe/London',
    paymentRunMode: 'date_ranges',
    ranges: [],
  })
  assert.equal(empty.startDayKey, '2026-10-01')
  assert.equal(empty.endDayKey, '2026-10-15')
  const fromIosFields = coverageWindow({
    referenceIso: oct6,
    timeZone: 'Europe/London',
    clashLookaheadMode: 'endOfInvoicingPeriod',
    paymentRunMode: 'date_ranges',
    ranges: [
      { startDate: 1, endDate: 15 },
      { startDate: 16, endDate: 31 },
    ],
  })
  assert.equal(fromIosFields.startDayKey, '2026-10-01')
  assert.equal(fromIosFields.endDayKey, '2026-10-15')
  const leftoverWebDefault = invoicingPeriod({
    referenceIso: oct6,
    timeZone: 'Europe/London',
    paymentRunMode: 'date_ranges',
    ranges: [
      { startDay: 1, endDay: 16, startDate: 1, endDate: 15 },
      { startDay: 17, endDay: 31, startDate: 16, endDate: 31 },
    ],
  })
  assert.equal(leftoverWebDefault.endDayKey, '2026-10-15')
  const savedSixteen = invoicingPeriod({
    referenceIso: oct6,
    timeZone: 'Europe/London',
    paymentRunMode: 'date_ranges',
    ranges: [
      { startDay: 1, endDay: 16 },
      { startDay: 17, endDay: 31 },
    ],
  })
  assert.equal(savedSixteen.endDayKey, '2026-10-16')
  assert.deepEqual(normalizePaymentRunRange({ startDay: 0, endDay: 0, startDate: 1, endDate: 15 }), {
    startDay: 1,
    endDay: 15,
  })
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
  const fullAlias = standardDayCoverage(
    { standardDayStart: '07:30', standardDayEnd: '16:00', breakWindowStart: '12:00', breakWindowEnd: '12:30' },
    [{ timeSlot: 'FULL_DAY', workStartTime: '09:00', workEndTime: '10:00' }]
  )
  assert.equal(fullAlias.missingHours, 0)
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

test('unbooked labour skips pending invitees, excluded people, a weekend day switched off, and duplicate booked profiles', () => {
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
    // 1.19.0: Saturday is switched off; Sunday must cover 07:30–15:30 (8h), no break window given.
    weekendCoverage: { saturday: { enabled: false, start: null, end: null }, sunday: { enabled: true, start: '07:30', end: '15:30' } },
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

test('weekend unbooked rows appear only when the org toggle is on; excluded users never appear', () => {
  const people = [
    {
      id: 'U-SAM',
      email: 'sam@site.test',
      name: 'Sam Site',
      isActive: true,
      passwordSet: true,
      isOperativeMode: true,
      isManager: false,
      isAdmin: false,
      isSuperAdmin: false,
    },
    {
      id: 'U-EX',
      email: 'ex@site.test',
      name: 'Excluded User',
      isActive: true,
      passwordSet: true,
      isOperativeMode: true,
      isManager: false,
      isAdmin: false,
      isSuperAdmin: false,
    },
  ]
  const saturday = {
    timeZone: 'Europe/London' as const,
    standardPaidHours: 8,
    saturdayCountsAsHours: 8,
    sundayCountsAsHours: 8,
    people,
    operatives: [] as const,
    bookings: [] as const,
    holidays: [] as const,
  }
  const toggleOff = unbookedLabourRows({
    ...saturday,
    startDayKey: '2026-10-17',
    endDayKey: '2026-10-17',
    includeWeekends: false,
  })
  assert.deepEqual(toggleOff, [])

  const toggleOn = unbookedLabourRows({
    ...saturday,
    startDayKey: '2026-10-17',
    endDayKey: '2026-10-17',
    includeWeekends: true,
  })
  assert.deepEqual(
    toggleOn.map((row) => row.personKey),
    ['U-EX', 'U-SAM']
  )
  assert.ok(toggleOn.every((row) => row.dayKey === '2026-10-17'))

  const overviewDay = unbookedLabourRowsOnDay({
    ...saturday,
    dayKey: '2026-10-17',
    includeWeekends: true,
  })
  assert.deepEqual(
    overviewDay.map((row) => row.id),
    toggleOn.map((row) => row.id)
  )

  const excludedWeekend = unbookedLabourRowsOnDay({
    ...saturday,
    dayKey: '2026-10-17',
    includeWeekends: true,
    excludedUserIds: ['U-EX'],
  })
  assert.deepEqual(
    excludedWeekend.map((row) => row.personKey),
    ['U-SAM']
  )
  assert.equal(excludedWeekend.find((row) => row.personKey === 'U-EX' || row.userId === 'U-EX'), undefined)

  const excludedWeekday = unbookedLabourRows({
    ...saturday,
    startDayKey: '2026-10-12',
    endDayKey: '2026-10-12',
    includeWeekends: false,
    excludedUserIds: ['U-EX'],
  })
  assert.deepEqual(
    excludedWeekday.map((row) => row.personKey),
    ['U-SAM']
  )
  assert.equal(excludedWeekday.find((row) => row.personKey === 'U-EX'), undefined)
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

test('PM leave with a 07:30–09:30 custom booking reports the missing 09:30–11:45 (1.20.0: leave halves at the midpoint)', () => {
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
  assert.deepEqual(row.workingWindow, { start: 450, end: 705 })
  assert.deepEqual(row.missing, [{ start: 570, end: 705 }])
  assert.equal(row.missingHours, 2.25)
  assert.equal(row.bookedHours, 2)
  assert.match(row.message, /only booked 07:30–09:30; 09:30–11:45 \(2.25 hours\) is not booked/)
})

test('half-day leave with no booking at all reports the whole working half', () => {
  const rows = leaveInput({
    leave: [{ id: 'L1', operativeId: 'OP-RAY', startDayKey: '2026-10-13', endDayKey: '2026-10-13', timeSlot: 'AM', approved: true }],
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].kind, 'leave_cover')
  assert.equal(rows[0].personKey, 'OP-RAY')
  // 1.20.0: the lunch-break window (12:00–12:30) never needs covering.
  assert.deepEqual(rows[0].missing, [{ start: 705, end: 720 }, { start: 750, end: 960 }])
  assert.equal(rows[0].missingHours, 3.75)
  assert.match(rows[0].message, /not booked for the PM \(11:45–16:00, 3.75 hours\)/)
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
  assert.equal(rows[0].clashes[0].overlapStart, 705)
  assert.equal(rows[0].clashes[0].overlapEnd, 960)
  assert.match(rows[0].message, /booked J100 Site 07:30–16:00 on Monday 12 October while on PM annual leave \(11:45–16:00\)/)
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
    'unbookedLabourRows',
    'unbookedLabourRowsOnDay',
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
    'qualificationSearchScore',
    'rankQualificationRecords',
    'tokenizeQualificationSearch',
    'qualificationLibraryFilterChips',
    'qualificationMatchesSection',
    'starterCollectionShouldSeed',
    'missingStarterQualificationCodes',
    'assignedQualificationWriteFields',
    'mergeOperativeQualificationWrite',
    'mergeQualificationCertificateUrls',
    'qualificationCertificateStoragePath',
    'defaultTimesheetSubmissionFromPaymentDay',
    'defaultTimesheetSubmissionFromPaymentWeekday',
    'timesheetSubmissionNoticeCopy',
    'dueTimesheetSubmissionNotices',
    'monthDayOffsetBefore',
    'paymentDateAfterPeriodEnd',
    'chooseSessionOrganization',
    'provisionalOrganizationId',
    'orgAccessProbeFromReads',
    'sessionMembershipIds',
    'organizationNameToFirestore',
    'organizationNameWriteFields',
    'coalesceOrganizationName',
    'parseOrganizationName',
    'shouldClearRememberedOrganization',
    'webSessionOrganizationStorageKey',
    'selectableTimesheetPaymentRunPeriods',
    'resolveMaterialCutOffClock',
    'parseMaterialCutOff',
    'formatMaterialCutOffClock',
    'timesheetListBucket',
    'timesheetDocumentId',
    'parseTimesheetStatusFields',
    'paymentRunHistoryAfterChange',
    'pickTimesheetRowForPeriod',
    'canReviewUserTimesheets',
    'seesEveryUserTimesheet',
    'inboxNotificationVisibleToUser',
    'compareInboxNotificationsByCreatedAt',
    'unreadNotificationBadgeCount',
    'hasAccess',
    'isAnonymisedDeletedProfile',
    'rosterSegment',
    'matchesRosterSegment',
    'isIdentifiablePendingLeftover',
    'listedRosterUsers',
    'listedCurrentLabourPeople',
    'resolveInviteEmailClaim',
    'inviteEmailHasLiveClaim',
    'inviteEmailOrgLookupConstraints',
    'invitePlaceholderUserWriteFields',
    'inviteWritesOperativeProfile',
    'userCreateRequiresAgeConfirmation',
  ]) {
    assert.equal(typeof bundle[name], 'function', `${name} is exported from the packed script`)
  }
  const packedClock = bundle.resolveMaterialCutOffClock({
    organizationMaterialCutOff: { materialCutOffHour: 15, materialCutOffMinute: 30 },
    userNotificationPreferences: { materialCutOffHour: 16, materialCutOffMinute: 0 },
  }) as { materialCutOffHour: number; materialCutOffMinute: number }
  assert.equal(packedClock.materialCutOffHour, 15)
  assert.equal(packedClock.materialCutOffMinute, 30)
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
  assert.equal(bundledLeave[0].missingHours, 2.25) // 1.20.0: AM leave half 07:30–11:45
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
  const qualArgs = [
    'ccn1',
    [{ name: 'CCN1 Core Domestic Gas Safety (includes CPA1)', code: 'GAS-CCN1', section: 'Gas' }],
  ] as const
  assert.deepEqual(plain(bundle.rankQualificationRecords(...qualArgs)), plain(rankQualificationRecords(...qualArgs)))
  const sessionChoice = {
    rememberedOrganizationId: 'org-phone',
    documentOrganizationId: 'org-other',
    probes: { 'org-phone': 'unknown', 'org-other': 'allowed' },
  }
  assert.deepEqual(plain(bundle.chooseSessionOrganization(sessionChoice)), plain(chooseSessionOrganization(sessionChoice)))
  assert.deepEqual(
    plain(
      bundle.sessionMembershipIds({
        discoveredIds: ['org-document'],
        rememberedOrganizationId: 'org-remembered',
        documentOrganizationId: 'org-document',
        discoveryIncomplete: false,
      })
    ),
    ['org-document', 'org-remembered']
  )
  assert.deepEqual(plain(bundle.organizationNameToFirestore('')), {})
  assert.equal(bundle.webSessionOrganizationStorageKey('user-1'), 'pp.webActiveOrg:user-1')
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

test('every admin and manager opens the warning list and (1.33.0) sees every job; operatives and role-less accounts do not', () => {
  for (const role of [superAdmin, admin, manager]) {
    assert.equal(seesEveryJob(role), true)
    assert.equal(canViewStaffWarnings(role), true)
    assert.equal(canSeeVariations(role), true)
    assert.equal(canReviewUserTimesheets(role), true)
  }
  for (const role of [operative, noRole]) {
    assert.equal(seesEveryJob(role), false)
    assert.equal(canViewStaffWarnings(role), false)
    assert.equal(canSeeVariations(role), false)
    assert.equal(canReviewUserTimesheets(role), false)
    assert.equal(seesEveryUserTimesheet(role), false)
  }
  assert.equal(seesEveryUserTimesheet(admin), true)
  assert.equal(seesEveryUserTimesheet(superAdmin), true)
  assert.equal(seesEveryUserTimesheet(manager), false)
  // Operative mode wins over a stale admin or manager flag.
  assert.equal(seesEveryJob({ ...admin, isOperativeMode: true }), false)
  assert.equal(seesEveryJob({ ...manager, isOperativeMode: true }), false)
  assert.equal(canSeeVariations({ ...manager, isOperativeMode: true }), false)
  assert.equal(canManageVariationTracker(admin), true)
  assert.equal(canManageVariationTracker(manager), false)
})

test('the Projects and Small works toggles gate manager add and edit; admins and super admins ignore them', () => {
  const off = { projects: false, smallWorks: false }
  const projectsOnly = { projects: true, smallWorks: false }
  // The admin list is still the whole company with both toggles off (managers: canSeeJob, 1.10.0).
  assert.equal(seesEveryJob(admin), true)
  // Editing follows the toggle for managers.
  assert.equal(canEditWorkCatalogue(manager, 'projects', off), false)
  assert.equal(canEditWorkCatalogue(manager, 'smallWorks', off), false)
  assert.equal(canEditWorkCatalogue(manager, 'projects', projectsOnly), true)
  assert.equal(canEditWorkCatalogue(manager, 'smallWorks', projectsOnly), false)
  // 1.10.0 round 2: admins always add and edit, whatever the toggles.
  assert.equal(canEditWorkCatalogue(admin, 'projects', off), true)
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
  // Seeing the job does not make this manager a recipient.
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
      canSeeVariations: (role: StaffAccountRole) => boolean
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
  assert.equal(bundle.canSeeVariations(manager), canSeeVariations(manager))
  assert.equal(bundle.canSeeVariations(operative), canSeeVariations(operative))
  assert.equal(bundle.canEditWorkCatalogue(manager, 'projects', off), canEditWorkCatalogue(manager, 'projects', off))
  assert.equal(bundle.canEditWorkCatalogue(superAdmin, 'projects', off), canEditWorkCatalogue(superAdmin, 'projects', off))
  const input = { userId: 'm-2', role: manager, assignedManagerUserIds: ['m-1'], lineManagerUserIds: [] }
  assert.equal(bundle.receivesJobNotification(input), receivesJobNotification(input))
  assert.equal(bundle.receivesJobNotification(input), false)
})

test('a FULL DAY booking that covers the standard day is not unbooked labour', () => {
  const person = {
    id: 'U-SAM',
    email: 'sam@site.test',
    name: 'Sam Booked',
    isActive: true,
    passwordSet: true,
    isOperativeMode: true,
    isManager: false,
    isAdmin: false,
    isSuperAdmin: false,
  }
  const base = {
    timeZone: 'Europe/London',
    startDayKey: '2026-10-15',
    endDayKey: '2026-10-16',
    includeWeekends: false,
    standardPaidHours: 8,
    standardDayStart: '07:30',
    standardDayEnd: '16:00',
    breakWindowStart: '12:00',
    breakWindowEnd: '12:30',
    people: [person],
    operatives: [{ id: 'OP-SAM', email: 'sam@site.test', name: 'Sam Booked', isActive: true, isPlaceholder: false, profileWeight: 1 }],
    holidays: [],
  }
  const space = unbookedLabourRows({
    ...base,
    bookings: [{ personId: 'OP-SAM', dayKey: '2026-10-15', kind: 'operative', timeSlot: 'FULL DAY' }],
  })
  assert.equal(space.find((row) => row.dayKey === '2026-10-15'), undefined)
  const underscore = unbookedLabourRows({
    ...base,
    bookings: [{ personId: 'OP-SAM', dayKey: '2026-10-15', kind: 'operative', timeSlot: 'FULL_DAY' }],
  })
  assert.equal(underscore.find((row) => row.dayKey === '2026-10-15'), undefined)
  const noClock = unbookedLabourRows({
    ...base,
    bookings: [
      {
        personId: 'U-SAM',
        dayKey: '2026-10-15',
        kind: 'operative',
        timeSlot: 'FULL DAY',
        workStartTime: '',
        workEndTime: '',
      },
    ],
  })
  assert.equal(noClock.find((row) => row.dayKey === '2026-10-15'), undefined)
  const extraDay = coverageWindow({
    referenceIso: '2026-10-06T11:00:00.000Z',
    timeZone: 'Europe/London',
    clashLookaheadMode: 'endOfInvoicingPeriod',
    paymentRunMode: 'date_ranges',
    ranges: [],
  })
  assert.equal(extraDay.endDayKey, '2026-10-15')
  const inDefaultWindow = unbookedLabourRows({
    ...base,
    startDayKey: extraDay.startDayKey,
    endDayKey: extraDay.endDayKey,
    bookings: [
      { personId: 'OP-SAM', dayKey: '2026-10-01', kind: 'operative', timeSlot: 'FULL DAY' },
      { personId: 'OP-SAM', dayKey: '2026-10-02', kind: 'operative', timeSlot: 'FULL DAY' },
      { personId: 'OP-SAM', dayKey: '2026-10-05', kind: 'operative', timeSlot: 'FULL DAY' },
      { personId: 'OP-SAM', dayKey: '2026-10-06', kind: 'operative', timeSlot: 'FULL DAY' },
      { personId: 'OP-SAM', dayKey: '2026-10-07', kind: 'operative', timeSlot: 'FULL DAY' },
      { personId: 'OP-SAM', dayKey: '2026-10-08', kind: 'operative', timeSlot: 'FULL DAY' },
      { personId: 'OP-SAM', dayKey: '2026-10-09', kind: 'operative', timeSlot: 'FULL DAY' },
      { personId: 'OP-SAM', dayKey: '2026-10-12', kind: 'operative', timeSlot: 'FULL DAY' },
      { personId: 'OP-SAM', dayKey: '2026-10-13', kind: 'operative', timeSlot: 'FULL DAY' },
      { personId: 'OP-SAM', dayKey: '2026-10-14', kind: 'operative', timeSlot: 'FULL DAY' },
      { personId: 'OP-SAM', dayKey: '2026-10-15', kind: 'operative', timeSlot: 'FULL DAY' },
    ],
  })
  assert.deepEqual(inDefaultWindow, [])
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
    timeZone: 'Europe/London',
  })
  // 1.40.0 (owner decision 13 Nov, item 18): "immediately" stores today (organisation midnight) and the old type, so
  // every earlier day keeps it.
  assert.equal(today.employmentTypeTransitionFrom, 'self_employed')
  assert.equal(today.employmentTypeEffectiveAt?.toISOString(), '2026-10-08T23:00:00.000Z')
  assert.equal(employmentTypeOnDay(today, new Date('2026-10-08T12:00:00Z'), 'Europe/London'), 'self_employed')
  assert.equal(employmentTypeOnDay(today, new Date('2026-10-09T12:00:00Z'), 'Europe/London'), 'paye')
  // A backdated date stores today as well (past days never change).
  const backdated = applyEmploymentTypeChange({
    previousType: 'self_employed',
    nextType: 'paye',
    effectiveAt: new Date('2026-09-01T12:00:00Z'),
    now: new Date('2026-10-09T12:00:00Z'),
    timeZone: 'Europe/London',
  })
  assert.equal(backdated.employmentTypeEffectiveAt?.toISOString(), '2026-10-08T23:00:00.000Z')
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

test('qualification search ranks by name and code and still works with a section chip', () => {
  assert.deepEqual(tokenizeQualificationSearch('ECS Gold'), ['ecs', 'gold'])
  const gold = {
    name: 'ECS Installation Electrician (Gold Card)',
    code: 'EL-ECS-IE',
    awardingBody: 'ECS / JIB',
    section: 'Electrical',
    subsection: 'ECS Cards & JIB Grades',
  }
  const ccn1 = {
    name: 'CCN1 Core Domestic Gas Safety (includes CPA1)',
    code: 'GAS-CCN1',
    awardingBody: 'ACS',
    section: 'Gas',
  }
  const custom = { name: 'Site induction', section: '' }
  assert.ok(qualificationSearchScore('ecs gold', gold) > 0)
  assert.equal(qualificationSearchScore('ecs gold', ccn1), 0)
  assert.ok(qualificationSearchScore('GAS-CCN1', ccn1) > 0)
  const ranked = rankQualificationRecords('ccn1', [gold, ccn1, custom])
  assert.equal(ranked.length, 1)
  assert.equal(ranked[0].index, 1)
  const electrical = rankQualificationRecords('ecs', [gold, ccn1], null, 'Electrical')
  assert.deepEqual(electrical.map((hit) => hit.index), [0])
  const allHits = rankQualificationRecords('', [gold, ccn1, custom], null, QUALIFICATION_FILTER_ALL)
  assert.deepEqual(allHits.map((hit) => hit.index), [0, 1, 2])
  assert.equal(qualificationMatchesSection(custom, 'Other'), true)
  assert.equal(qualificationMatchesSection(gold, 'Gas'), false)
  const chips = qualificationLibraryFilterChips([gold, ccn1, custom])
  assert.equal(chips[0].key, QUALIFICATION_FILTER_ALL)
  assert.equal(chips[0].count, 3)
  assert.deepEqual(
    chips.slice(1).map((chip) => chip.key),
    ['Electrical', 'Gas', 'Other']
  )
})

test('payment run rows write both web and iOS day fields and empty ranges use 1–15 then 16–31', () => {
  assert.deepEqual(DEFAULT_PAYMENT_RUN_DATE_RANGES, [
    { startDay: 1, endDay: 15 },
    { startDay: 16, endDay: 31 },
  ])
  const fromIos = parsePaymentRunDateRanges({
    paymentRunDateRanges: [
      { startDate: 1, endDate: 15 },
      { startDate: 16, endDate: 31 },
    ],
  })
  assert.deepEqual(fromIos, DEFAULT_PAYMENT_RUN_DATE_RANGES)
  const fromWeb = parsePaymentRunDateRanges({
    paymentRunDateRanges: [
      { startDay: 1, endDay: 16 },
      { startDay: 17, endDay: 31 },
    ],
  })
  assert.equal(fromWeb[0].endDay, 16)
  assert.equal(fromWeb[1].startDay, 17)
  const leftover = parsePaymentRunDateRanges({
    paymentRunDateRanges: [{ startDay: 1, endDay: 16, startDate: 1, endDate: 15 }],
  })
  assert.equal(leftover[0].endDay, 15)
  const written = invoicingToFirestore(parseInvoicing({}))
  const row = (written.paymentRunDateRanges as Record<string, number>[])[0]
  assert.equal(row.startDay, 1)
  assert.equal(row.endDay, 15)
  assert.equal(row.startDate, 1)
  assert.equal(row.endDate, 15)
  assert.equal(parseInvoicing({}).paymentRunMode, 'date_ranges')
  assert.equal(parseInvoicing({}).paymentDateMode, 'specific_dates')
})

test('organisation name round-trips on the shared name field', () => {
  assert.equal(parseOrganizationName({ name: 'Raccord MEP' }), 'Raccord MEP')
  assert.equal(parseOrganizationName({ organizationName: 'Alias Ltd' }), 'Alias Ltd')
  assert.equal(parseOrganizationName({ name: '  ', companyName: 'From companyName' }), 'From companyName')
  assert.equal(parseOrganizationName({ settings: { name: 'Nested' } }), 'Nested')
  assert.equal(parseOrganizationName({ name: 'Shared', organizationName: 'Other' }), 'Shared')
  assert.deepEqual(organizationNameToFirestore('  Acme  '), { name: 'Acme' })
  assert.deepEqual(organizationNameToFirestore(''), {})
  assert.deepEqual(organizationNameToFirestore('   '), {})
  assert.deepEqual(organizationNameWriteFields('', 'Raccord MEP'), {})
  assert.deepEqual(organizationNameWriteFields('  Acme  ', 'Raccord MEP'), { name: 'Acme' })
  assert.equal(coalesceOrganizationName('', '  ', 'Raccord MEP'), 'Raccord MEP')
  assert.equal(coalesceOrganizationName('', ''), '')
  assert.equal(displayOrganizationName(''), 'Organisation')
  assert.equal(displayOrganizationName('  '), 'Organisation')
  assert.equal(displayOrganizationName('Acme'), 'Acme')
})

test('organisation materialCutOff is the only cut-off clock', () => {
  const saved = resolveMaterialCutOffClock({
    organizationMaterialCutOff: { materialCutOffHour: 15, materialCutOffMinute: 30 },
    userNotificationPreferences: { materialCutOffHour: 16, materialCutOffMinute: 0 },
  })
  assert.equal(saved.materialCutOffHour, 15)
  assert.equal(saved.materialCutOffMinute, 30)
  assert.equal(formatMaterialCutOffClock(saved), '15:30')

  const missingHour = resolveMaterialCutOffClock({
    organizationMaterialCutOff: { materialCutOffMinute: 0, materialOrderCutOff: true },
    userNotificationPreferences: { materialCutOffHour: 14, materialCutOffMinute: 30 },
  })
  assert.equal(missingHour.materialCutOffHour, 16)
  assert.equal(missingHour.materialCutOffMinute, 0)

  const weekends = resolveMaterialCutOffClock({
    organizationMaterialCutOff: {
      materialCutOffHour: 15,
      materialCutOffMinute: 30,
      materialCutOffOnSaturday: true,
      materialCutOffOnSunday: false,
    },
    userNotificationPreferences: {
      materialCutOffOnSaturday: false,
      materialCutOffOnSunday: true,
    },
  })
  assert.equal(weekends.materialCutOffOnSaturday, true)
  assert.equal(weekends.materialCutOffOnSunday, false)

  const empty = parseMaterialCutOff(undefined)
  assert.equal(empty.materialCutOffHour, 16)
  assert.equal(empty.materialCutOffMinute, 0)
  assert.equal(empty.materialCutOffOnSaturday, false)
  assert.equal(empty.materialCutOffOnSunday, false)

  const fromSettings = resolveMaterialCutOffClock({
    organizationSettings: {
      materialCutOff: {
        materialCutOffHour: 15,
        materialCutOffMinute: 30,
        materialCutOffOnSaturday: true,
      },
    },
    userNotificationPreferences: { materialCutOffHour: 16 },
  })
  assert.equal(fromSettings.materialCutOffHour, 15)
  assert.equal(fromSettings.materialCutOffOnSaturday, true)
})

test('parseInvoicing does not coerce date-range firms onto recurring pay', () => {
  const leftover = parseInvoicing({
    paymentRunMode: 'date_ranges',
    paymentDateMode: 'recurring_date',
    paymentDates: [20, 5],
    paymentRunDateRanges: [
      { startDate: 1, endDate: 15 },
      { startDate: 16, endDate: 31 },
    ],
  })
  assert.equal(leftover.paymentRunMode, 'date_ranges')
  assert.equal(leftover.paymentDateMode, 'specific_dates')
  assert.equal(paymentRunShowsMonthCoverage(leftover), true)
  assert.deepEqual(leftover.paymentRunDateRanges, [
    { startDay: 1, endDay: 15 },
    { startDay: 16, endDay: 31 },
  ])

  const missingMode = parseInvoicing({
    paymentRunDateRanges: [
      { startDay: 1, endDay: 15 },
      { startDay: 16, endDay: 31 },
    ],
    paymentDates: ['20', '5'],
  })
  assert.equal(missingMode.paymentRunMode, 'date_ranges')
  assert.equal(missingMode.paymentDateMode, 'specific_dates')
  assert.equal(paymentRunShowsMonthCoverage(missingMode), true)

  const recurring = parseInvoicing({
    paymentRunMode: 'recurring_timeframe',
    paymentDateMode: 'recurring_date',
    recurringRunStartDay: 'monday',
    recurringRunEndDay: 'sunday',
    recurringPaymentDay: 'friday',
  })
  assert.equal(recurring.paymentRunMode, 'recurring_timeframe')
  assert.equal(recurring.paymentDateMode, 'recurring_date')
  assert.equal(paymentRunShowsMonthCoverage(recurring), false)
  assert.equal(DEFAULT_INVOICING.paymentDateMode, 'specific_dates')
})

test('starter catalogue seeds only when the collection is empty', () => {
  assert.equal(starterCollectionShouldSeed(0), true)
  assert.equal(starterCollectionShouldSeed(1), false)
  assert.equal(starterCollectionShouldSeed(272), false)
})

test('qualification library merges missing codes and is not blocked by a custom row', () => {
  const library = ['EL-ECS-IE', 'GAS-GSR', 'PRO-IOSH']
  assert.deepEqual(missingStarterQualificationCodes([], library), library)
  assert.deepEqual(missingStarterQualificationCodes(['custom-uuid'], library), library)
  assert.deepEqual(missingStarterQualificationCodes(['EL-ECS-IE', 'custom-uuid'], library), [
    'GAS-GSR',
    'PRO-IOSH',
  ])
  assert.deepEqual(missingStarterQualificationCodes(library, library), [])
})

test('assigned qualification write keeps iOS fields and strips library extras', () => {
  const created = '2026-01-02T00:00:00.000Z'
  const write = assignedQualificationWriteFields({
    id: 'EL-ECS-IE',
    name: 'ECS Gold Card',
    hasEndDate: false,
    createdAtIso: created,
    updatedAtIso: created,
  })
  assert.deepEqual(write, {
    id: 'EL-ECS-IE',
    name: 'ECS Gold Card',
    hasEndDate: false,
    createdAtIso: created,
    updatedAtIso: created,
  })
  assert.equal(assignedQualificationWriteFields({ id: '', name: 'CSCS' }), null)
  assert.equal(assignedQualificationWriteFields({ id: 'Q1', name: '' }), null)
})

test('operative qualification merge writes a new assignment without dropping other quals or certificate URLs', () => {
  const created = '2026-01-02T00:00:00.000Z'
  const merged = mergeOperativeQualificationWrite({
    previous: {
      qualifications: [
        { id: 'Q-OLD', name: 'CSCS', hasEndDate: false, createdAtIso: created, updatedAtIso: created },
      ],
      qualificationExpiryDates: { 'Q-OLD': '2026-09-01T00:00:00.000Z' },
      qualificationCertificateURLs: { 'Q-OLD': 'https://files.example/cscs.pdf' },
    },
    next: {
      qualifications: [
        { id: 'Q-NEW', name: 'First aid', hasEndDate: false, createdAtIso: created, updatedAtIso: created },
      ],
      qualificationExpiryDates: { 'Q-NEW': '2027-03-01T00:00:00.000Z' },
      qualificationCertificateURLs: { 'Q-NEW': 'https://files.example/first-aid.pdf' },
    },
  })
  assert.equal(merged.qualifications.length, 2)
  assert.equal(merged.qualifications.find((row) => row.id === 'Q-OLD')?.name, 'CSCS')
  assert.equal(merged.qualifications.find((row) => row.id === 'Q-NEW')?.name, 'First aid')
  assert.equal(merged.qualificationExpiryDates['Q-OLD'], '2026-09-01T00:00:00.000Z')
  assert.equal(merged.qualificationExpiryDates['Q-NEW'], '2027-03-01T00:00:00.000Z')
  assert.equal(merged.qualificationCertificateURLs['Q-OLD'], 'https://files.example/cscs.pdf')
  assert.equal(merged.qualificationCertificateURLs['Q-NEW'], 'https://files.example/first-aid.pdf')
})

test('certificate URL merge keeps prior files and only removes an id this save cleared', () => {
  assert.deepEqual(
    mergeQualificationCertificateUrls({ q1: 'a', q2: 'b' }, { q3: 'c' }),
    { q1: 'a', q2: 'b', q3: 'c' }
  )
  assert.deepEqual(
    mergeQualificationCertificateUrls({ q1: 'a', q2: 'b' }, {}, ['q2']),
    { q1: 'a' }
  )
  assert.equal(qualificationCertificateUrl({ 'ABC-1': 'https://files.example/old.pdf' }, 'abc-1'), 'https://files.example/old.pdf')
  assert.deepEqual(
    removedQualificationCertificateIds({ q1: 'a', q2: 'b' }, { q1: 'a' }, ['q1', 'q2']),
    ['q2']
  )
  assert.deepEqual(
    removedQualificationCertificateIds({ q1: 'a', OTHER: 'keep' }, { q1: 'a' }, ['q1']),
    []
  )
})

test('qualification certificate storage path matches the iOS object prefix', () => {
  assert.equal(
    qualificationCertificateStoragePath({
      organizationId: 'ORG1',
      operativeId: 'OP1',
      qualificationId: 'Q1',
      fileName: 'uid_1_cscs.pdf',
    }),
    'organizations/ORG1/operatives/OP1/qualifications/Q1/certificates/uid_1_cscs.pdf'
  )
  assert.equal(
    qualificationCertificateStoragePath({ organizationId: '', operativeId: 'OP1', qualificationId: 'Q1', fileName: 'a.pdf' }),
    null
  )
})

test('warning detection defaults to seven days and reads the iOS top-level map', () => {
  assert.equal(DEFAULT_WARNING_DETECTION.clashLookaheadMode, 'numberOfDays')
  assert.equal(DEFAULT_WARNING_DETECTION.clashLookaheadDays, 7)
  const parsed = parseWarningDetection({
    clashLookaheadMode: 'endOfInvoicingPeriod',
    excludedUserIds: ['U1'],
  })
  assert.equal(parsed.clashLookaheadMode, 'endOfInvoicingPeriod')
  assert.deepEqual(parsed.excludedUserIdsFromUnbookedWarnings, ['U1'])
})

test('sortWarningsByDate orders by coverage dayKey and keeps every row', () => {
  assert.equal(DEFAULT_WARNINGS_SORT_DIRECTION, 'oldest')
  assert.equal(parseWarningsSortDirection(undefined), 'oldest')
  assert.equal(parseWarningsSortDirection('newest'), 'newest')
  assert.equal(parseWarningsSortDirection('created-at'), 'oldest')

  const rows = [
    { id: 'later-clash', dayKey: '2026-10-12' },
    { id: 'earlier-unbooked', dayKey: '2026-10-10' },
    { id: 'same-day-leave', dayKey: '2026-10-10' },
    { id: 'expiry', dayKey: '2026-09-01' },
    { id: 'unverified', dayKey: '' },
    { id: 'invalid', dayKey: 'not-a-day' },
  ]

  const oldest = sortWarningsByDate(rows, 'oldest')
  assert.deepEqual(
    oldest.map((row) => row.id),
    ['expiry', 'earlier-unbooked', 'same-day-leave', 'later-clash', 'unverified', 'invalid']
  )
  const newest = sortWarningsByDate(rows, 'newest')
  assert.deepEqual(
    newest.map((row) => row.id),
    ['later-clash', 'earlier-unbooked', 'same-day-leave', 'expiry', 'unverified', 'invalid']
  )
  assert.equal(oldest.length, rows.length)
  assert.equal(newest.length, rows.length)
  assert.equal(compareWarningDayKeys('2026-10-10', '2026-10-12', 'oldest') < 0, true)
  assert.equal(compareWarningDayKeys('2026-10-10', '2026-10-12', 'newest') > 0, true)
})

test('timesheet submission defaults are 3 days before pay at 08:00 and close of play the day before', () => {
  const pay20 = defaultTimesheetSubmissionFromPaymentDay(20)
  assert.equal(pay20.notifyDay, 17)
  assert.equal(pay20.notifyHour, TIMESHEET_NOTIFY_HOUR)
  assert.equal(pay20.notifyMinute, 0)
  assert.equal(pay20.timesheetDeadlineDay, 19)
  assert.equal(pay20.timesheetDeadlineHour, TIMESHEET_CLOSE_OF_PLAY_HOUR)
  assert.equal(pay20.timesheetDeadlineMinute, 0)
  assert.equal(pay20.notifyCustomised, false)

  const pay5 = defaultTimesheetSubmissionFromPaymentDay(5)
  assert.equal(pay5.notifyDay, 2)
  assert.equal(pay5.timesheetDeadlineDay, 4)

  assert.equal(monthDayOffsetBefore(1, 1), 31)
  assert.equal(monthDayOffsetBefore(2, 3), 30)
  assert.equal(paymentDateAfterPeriodEnd('2026-10-31', [5], 'Europe/London'), '2026-11-05')
  assert.equal(paymentDateAfterPeriodEnd('2026-02-28', [31], 'Europe/London'), '2026-02-28')
  assert.equal(paymentDateAfterPeriodEnd('2026-02-15', [31], 'Europe/London'), '2026-02-28')

  const customised = { ...pay20, notifyDay: 10, notifyCustomised: true }
  assert.equal(timesheetSubmissionAfterPaymentDayChange(customised, 5).notifyDay, 10)
  assert.equal(timesheetSubmissionAfterPaymentDayChange(pay20, 5).notifyDay, 2)

  assert.equal(
    timesheetSubmissionNoticeCopy({
      mode: 'date_ranges',
      deadlineDay: 19,
      paymentDay: 20,
    }),
    'Timesheets need to be submitted by close of play on the 19th for payment on the 20th.'
  )
  assert.equal(
    timesheetSubmissionNoticeCopy({
      mode: 'date_ranges',
      deadlineDay: 4,
      paymentDay: 5,
    }),
    'Timesheets need to be submitted by close of play on the 4th for payment on the 5th.'
  )

  const mondayFriday = defaultTimesheetSubmissionFromPaymentWeekday('friday')
  assert.equal(mondayFriday.notifyWeekday, 'tuesday')
  assert.equal(mondayFriday.timesheetDeadlineWeekday, 'thursday')
  assert.equal(weekdayOffsetBefore('friday', 3), 'tuesday')
  assert.equal(weekdayOffsetBefore('friday', 1), 'thursday')
  assert.equal(
    timesheetSubmissionNoticeCopy({
      mode: 'recurring_timeframe',
      deadlineWeekday: 'thursday',
      paymentWeekday: 'friday',
    }),
    'Please issue timesheets for the previous payment run by close of play Thursday, to be paid on Friday.'
  )
  assert.equal(
    timesheetSubmissionNoticeCopy({
      mode: 'recurring_timeframe',
      deadlineWeekday: 'tuesday',
      paymentWeekday: 'friday',
    }),
    'Please issue timesheets for the previous payment run by close of play Tuesday, to be paid on Friday.'
  )

  const halfMonth = {
    paymentRunMode: 'date_ranges' as const,
    paymentRunDateRanges: [
      { startDay: 1, endDay: 15 },
      { startDay: 16, endDay: 31 },
    ],
    paymentDates: [20, 5],
    timesheetSubmission: [pay20, pay5],
  }
  const midOctober = dueTimesheetSubmissionNotices({
    ...halfMonth,
    referenceIso: '2026-10-17T08:00:00+01:00',
    timeZone: 'Europe/London',
  })
  const octoberPay20 = midOctober.find((row) => row.paymentDayKey === '2026-10-20')
  assert.ok(octoberPay20)
  assert.equal(octoberPay20.notifyDayKey, '2026-10-17')
  assert.equal(octoberPay20.deadlineDayKey, '2026-10-19')
  assert.equal(
    octoberPay20.message,
    'Timesheets need to be submitted by close of play on the 19th for payment on the 20th.'
  )

  const tooEarly = dueTimesheetSubmissionNotices({
    ...halfMonth,
    referenceIso: '2026-10-17T07:59:00+01:00',
    timeZone: 'Europe/London',
  })
  assert.equal(
    tooEarly.some((row) => row.paymentDayKey === '2026-10-20'),
    false
  )

  const afterMonthWrap = dueTimesheetSubmissionNotices({
    ...halfMonth,
    referenceIso: '2026-11-02T08:00:00+00:00',
    timeZone: 'Europe/London',
  })
  const novemberPay5 = afterMonthWrap.find((row) => row.paymentDayKey === '2026-11-05')
  assert.ok(novemberPay5)
  assert.equal(novemberPay5.notifyDayKey, '2026-11-02')
  assert.equal(novemberPay5.deadlineDayKey, '2026-11-04')
  assert.equal(
    novemberPay5.message,
    'Timesheets need to be submitted by close of play on the 4th for payment on the 5th.'
  )

  const shortMonth = dueTimesheetSubmissionNotices({
    paymentRunMode: 'date_ranges',
    paymentRunDateRanges: [{ startDay: 1, endDay: 31 }],
    paymentDates: [31],
    timesheetSubmission: [defaultTimesheetSubmissionFromPaymentDay(31)],
    referenceIso: '2026-02-25T08:00:00+00:00',
    timeZone: 'Europe/London',
  })
  const febPay = shortMonth.find((row) => row.paymentDayKey === '2026-02-28')
  assert.ok(febPay)
  assert.equal(febPay.notifyDayKey, '2026-02-25')
  assert.equal(febPay.deadlineDayKey, '2026-02-27')

  const recurringFriday = dueTimesheetSubmissionNotices({
    paymentRunMode: 'recurring_timeframe',
    recurringRunStartDay: 'monday',
    recurringRunEndDay: 'sunday',
    recurringPaymentDay: 'friday',
    timesheetSubmission: [mondayFriday],
    referenceIso: '2026-10-13T08:00:00+01:00',
    timeZone: 'Europe/London',
  })
  const fridayPay = recurringFriday.find((row) => row.paymentDayKey === '2026-10-16')
  assert.ok(fridayPay)
  assert.equal(fridayPay.notifyDayKey, '2026-10-13')
  assert.equal(fridayPay.deadlineDayKey, '2026-10-15')

  const wedTue = dueTimesheetSubmissionNotices({
    paymentRunMode: 'recurring_timeframe',
    recurringRunStartDay: 'wednesday',
    recurringRunEndDay: 'tuesday',
    recurringPaymentDay: 'friday',
    timesheetSubmission: [
      {
        ...mondayFriday,
        notifyWeekday: 'monday',
        timesheetDeadlineWeekday: 'tuesday',
        notifyCustomised: true,
      },
    ],
    referenceIso: '2026-10-12T08:00:00+01:00',
    timeZone: 'Europe/London',
  })
  const customRecurring = wedTue.find((row) => row.paymentDayKey === '2026-10-16')
  assert.ok(customRecurring)
  assert.equal(customRecurring.notifyDayKey, '2026-10-12')
  assert.equal(customRecurring.deadlineDayKey, '2026-10-13')
  assert.equal(
    customRecurring.message,
    'Please issue timesheets for the previous payment run by close of play Tuesday, to be paid on Friday.'
  )

  const written = invoicingToFirestore(
    parseInvoicing({
      paymentRunMode: 'date_ranges',
      paymentDates: [20, 5],
      paymentRunDateRanges: [
        { startDay: 1, endDay: 15, startDate: 1, endDate: 15 },
        { startDay: 16, endDay: 31, startDate: 16, endDate: 31 },
      ],
    })
  )
  assert.equal(written.noteToUsers, DEFAULT_INVOICING.noteToUsers)
  assert.equal(written.paymentRunMode, 'date_ranges')
  const firstRange = (written.paymentRunDateRanges as Record<string, unknown>[])[0]
  assert.equal(firstRange.startDay, 1)
  assert.equal(firstRange.startDate, 1)
  assert.equal(firstRange.notifyDay, 17)
  assert.equal(firstRange.timesheetDeadlineDay, 19)
  const saved = written.timesheetSubmission as Record<string, unknown>[]
  assert.equal(saved[0].notifyDay, 17)
  assert.equal(saved[1].notifyDay, 2)
})

test('material order defaults to tomorrow 08:00 and Monday 08:00 on a weekend send', () => {
  assert.equal(materialOrderIncludesDeliveryRequired('order'), true)
  assert.equal(materialOrderIncludesDeliveryRequired('Order'), true)
  assert.equal(materialOrderIncludesDeliveryRequired('quote'), false)
  assert.equal(materialOrderIncludesDeliveryRequired('Quote'), false)
  assert.equal(DEFAULT_MATERIAL_DELIVERY_CLOCK, '08:00')
  assert.equal(DEFAULT_MATERIAL_DELIVERY_MINUTES, 8 * 60)

  assert.equal(defaultMaterialDeliveryDayKey('2026-10-09T15:00:00+01:00'), '2026-10-10')
  assert.equal(defaultMaterialDeliveryDayKey('2026-10-10T09:30:00+01:00'), '2026-10-12')
  assert.equal(defaultMaterialDeliveryDayKey('2026-10-11T22:00:00+01:00'), '2026-10-12')
  assert.equal(defaultMaterialDeliveryDayKey('2026-10-12T07:00:00+01:00'), '2026-10-13')

  const mondayFromSaturday = defaultMaterialDeliveryRequiredAt('2026-10-10T09:30:00+01:00')
  assert.equal(formatMaterialDeliveryRequired(mondayFromSaturday), 'Monday 12 October at 08:00')
  const tomorrowFromFriday = defaultMaterialDeliveryRequiredAt('2026-10-09T15:00:00+01:00')
  assert.equal(formatMaterialDeliveryRequired(tomorrowFromFriday), 'Saturday 10 October at 08:00')
})

test('the iOS JavaScript bundle applies the same warning date order as this module', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: {
    ProjectPlannerCanonical?: {
      DEFAULT_WARNINGS_SORT_DIRECTION: string
      parseWarningsSortDirection: (value: unknown) => string
      sortWarningsByDate: (rows: ReadonlyArray<{ id: string; dayKey: string }>, direction: unknown) => Array<{
        id: string
        dayKey: string
      }>
      defaultMaterialDeliveryDayKey: (referenceIso: string, timeZone?: string | null) => string
      materialOrderIncludesDeliveryRequired: (requestType: string | null | undefined) => boolean
      formatMaterialDeliveryRequired: (at: Date, timeZone?: string | null) => string
      defaultMaterialDeliveryRequiredAt: (referenceIso: string, timeZone?: string | null) => Date
      notificationDestination: (input: {
        type: string
        relatedId?: string
        dayKey?: string
        catalogue?: string
        role: string
      }) => { kind: string; relatedId?: string; dayKey?: string }
      parseUserNotificationPreferences: (raw: Record<string, unknown> | undefined) => { bookingClashes: boolean }
      visibleNotificationPreferenceKeys: (audience: {
        role: { isSuperAdmin: boolean; isAdmin: boolean; isManager: boolean; isOperativeMode: boolean }
        catalogue: { projects: boolean; smallWorks: boolean }
        canManagePeople?: boolean
        canManageClients?: boolean
        canManageMaterials?: boolean
      }) => string[]
      notificationPreferenceCopy: (key: string) => { label: string; description: string }
      notificationDeliversDevicePush: (type: string) => boolean
      devicePushNotificationTypes: () => string[]
      unreadNotificationBadgeCount: (
        notifications: ReadonlyArray<{ userId?: string; isRead?: boolean }>,
        userId: string
      ) => number
      NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND: boolean
    }
  } = {}
  runInContext(source, createContext(sandbox))
  const bundle = sandbox.ProjectPlannerCanonical
  assert.ok(bundle)
  const rows = [
    { id: 'b', dayKey: '2026-10-12' },
    { id: 'a', dayKey: '2026-10-10' },
    { id: 'undated', dayKey: '' },
  ]
  assert.equal(bundle.DEFAULT_WARNINGS_SORT_DIRECTION, DEFAULT_WARNINGS_SORT_DIRECTION)
  assert.equal(bundle.parseWarningsSortDirection('newest'), 'newest')
  assert.deepEqual(
    bundle.sortWarningsByDate(rows, 'oldest').map((row) => row.id),
    sortWarningsByDate(rows, 'oldest').map((row) => row.id)
  )
  assert.deepEqual(
    bundle.sortWarningsByDate(rows, 'newest').map((row) => row.id),
    sortWarningsByDate(rows, 'newest').map((row) => row.id)
  )
  assert.equal(bundle.materialOrderIncludesDeliveryRequired('order'), true)
  assert.equal(bundle.materialOrderIncludesDeliveryRequired('quote'), false)
  assert.equal(
    bundle.defaultMaterialDeliveryDayKey('2026-10-10T09:30:00+01:00'),
    defaultMaterialDeliveryDayKey('2026-10-10T09:30:00+01:00')
  )
  assert.equal(
    bundle.formatMaterialDeliveryRequired(bundle.defaultMaterialDeliveryRequiredAt('2026-10-10T09:30:00+01:00')),
    formatMaterialDeliveryRequired(defaultMaterialDeliveryRequiredAt('2026-10-10T09:30:00+01:00'))
  )
  assert.equal(bundle.parseUserNotificationPreferences(undefined).bookingClashes, true)
  assert.equal(
    bundle.notificationDestination({
      type: 'booking_created',
      relatedId: 'JOB-1',
      dayKey: '2026-10-12',
      catalogue: 'projects',
      role: 'admin',
    }).kind,
    'dailyOverviewDay'
  )
  assert.equal(bundle.notificationDeliversDevicePush('booking_created'), true)
  assert.equal(bundle.notificationDeliversDevicePush('material_order_cut_off'), false)
  assert.ok(bundle.devicePushNotificationTypes().includes('timesheet_submission_reminder'))
  assert.equal(
    bundle.unreadNotificationBadgeCount(
      [
        { userId: 'u1', isRead: false },
        { userId: 'u2', isRead: false },
      ],
      'u1'
    ),
    1
  )
  assert.equal(bundle.NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND, true)
  const operativeAudience = {
    role: { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: true },
    catalogue: { projects: true, smallWorks: true },
    canManagePeople: false,
    canManageClients: false,
    canManageMaterials: true,
  }
  assert.equal(bundle.visibleNotificationPreferenceKeys(operativeAudience).includes('projectCreated'), false)
  assert.equal(bundle.visibleNotificationPreferenceKeys(operativeAudience).includes('annualLeaveDecision'), true)
  assert.equal(
    bundle.notificationPreferenceCopy('annualLeaveDecision').description,
    'When your annual leave is approved or declined.'
  )
})

test('user notification preferences parse defaults, aliases, and dotted writes', () => {
  assert.ok(USER_DOCUMENT_FIELDS.includes('notificationPreferences'))
  assert.ok(USER_DOCUMENT_FIELDS.includes('invitationId'))
  const empty = parseUserNotificationPreferences(undefined)
  assert.equal(empty.bookingClashes, true)
  assert.equal(empty.timesheetSubmissionReminder, true)
  assert.equal(empty.materialOrderCutOff, true)
  const fromLegacy = parseUserNotificationPreferences({ bookingConflicts: false })
  assert.equal(fromLegacy.bookingClashes, false)
  const explicitWins = parseUserNotificationPreferences({
    bookingConflicts: false,
    bookingClashes: true,
    timesheetSignOff: false,
  })
  assert.equal(explicitWins.bookingClashes, true)
  assert.equal(explicitWins.timesheetSignOff, false)
  const written = userNotificationPreferencesToFirestore(DEFAULT_USER_NOTIFICATION_PREFERENCES)
  assert.equal(written.timesheetSubmissionReminder, true)
  assert.equal('bookingConflicts' in written, false)
  const patch = userNotificationPreferenceFieldPatch({ bookingClashes: false })
  assert.equal(patch['notificationPreferences.bookingClashes'], false)
  assert.equal('notificationPreferences' in patch, false)
  assert.equal(Object.keys(patch).some((key) => key.includes('bookingConflicts')), false)
  assert.equal(Object.keys(patch).length, 1)
})

test('My notifications rows follow role and catalogue toggles', () => {
  const operative = {
    role: { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: true },
    catalogue: { projects: true, smallWorks: true },
    canManagePeople: false,
    canManageClients: false,
    canManageMaterials: true,
  }
  const managerProjectsOnly = {
    role: { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false },
    catalogue: { projects: true, smallWorks: false },
    canManagePeople: false,
    canManageClients: true,
    canManageMaterials: true,
  }
  const managerBothCatalogues = {
    ...managerProjectsOnly,
    catalogue: { projects: true, smallWorks: true },
    canManagePeople: true,
  }
  const hiddenFromOperative = [
    'annualLeaveRequested',
    'projectCreated',
    'smallWorksCreated',
    'bookingClashes',
    'materialOrderPlaced',
    'operativeCreated',
    'managerCreated',
    'clientCreated',
    'lineManagerPeerUpdates',
    'warningDismissed',
    'timesheetSignOff',
  ]
  const operativeKeys = visibleNotificationPreferenceKeys(operative)
  for (const key of hiddenFromOperative) {
    assert.equal(operativeKeys.includes(key as (typeof operativeKeys)[number]), false, key)
  }
  assert.ok(operativeKeys.includes('annualLeaveDecision'))
  assert.ok(operativeKeys.includes('bookedOntoJob'))
  assert.ok(operativeKeys.includes('timesheetSubmissionReminder'))
  assert.equal(
    notificationPreferenceCopy('annualLeaveDecision', operative).description,
    'When your annual leave is approved or declined.'
  )
  const managerKeys = visibleNotificationPreferenceKeys(managerProjectsOnly)
  // 1.4.0: the six per-type "created / dismissed" rows are retired; their types are `companyActivity` (admins only).
  for (const retired of ['projectCreated', 'smallWorksCreated', 'operativeCreated', 'managerCreated', 'clientCreated', 'warningDismissed']) {
    assert.equal(managerKeys.includes(retired as (typeof managerKeys)[number]), false, retired)
    assert.equal(visibleNotificationPreferenceKeys(managerBothCatalogues).includes(retired as (typeof managerKeys)[number]), false, retired)
  }
  assert.equal(managerKeys.includes('companyActivity'), false)
  assert.equal(managerKeys.includes('annualLeaveRequested'), true)
})

test('a preference only gates its own inbox types and never widens fan-out', () => {
  const off = parseUserNotificationPreferences({ bookedOntoJob: false, timesheetSubmissionReminder: false })
  assert.equal(notificationPreferenceAllowsDelivery(off, 'booking_created'), false)
  assert.equal(notificationPreferenceAllowsDelivery(off, 'timesheet_submission_reminder'), false)
  assert.equal(notificationPreferenceAllowsDelivery(off, 'client_created'), true)
  assert.equal(notificationPreferenceAllowsDelivery(off, 'variation'), true)
  assert.equal(notificationPreferenceAllowsDelivery(DEFAULT_USER_NOTIFICATION_PREFERENCES, 'booking_created'), true)
})

test('booking destinations follow admin Daily Overview vs manager scheduling', () => {
  const day = { type: 'booking_created', relatedId: 'JOB-1', dayKey: '2026-10-12', catalogue: 'projects' as const }
  assert.deepEqual(notificationDestination({ ...day, role: 'admin' }), {
    kind: 'dailyOverviewDay',
    dayKey: '2026-10-12',
  })
  assert.deepEqual(notificationDestination({ ...day, role: 'manager' }), {
    kind: 'projectScheduling',
    relatedId: 'JOB-1',
    dayKey: '2026-10-12',
  })
  assert.deepEqual(
    notificationDestination({
      type: 'booking_created',
      relatedId: 'SW-9',
      dayKey: '2026-10-12',
      catalogue: 'smallWorks',
      role: 'manager',
    }),
    { kind: 'smallWorksScheduling', relatedId: 'SW-9', dayKey: '2026-10-12' }
  )
  assert.deepEqual(notificationDestination({ ...day, role: 'operative' }), {
    kind: 'mySchedule',
    dayKey: '2026-10-12',
  })
})

test('a booking without a related id falls back, and an unknown type opens notifications', () => {
  assert.deepEqual(
    notificationDestination({ type: 'booking_created', dayKey: '2026-10-12', role: 'manager' }),
    { kind: 'dailyOverviewDay', dayKey: '2026-10-12' }
  )
  assert.deepEqual(
    notificationDestination({ type: 'project_created', role: 'admin' }),
    { kind: 'projectsList' }
  )
  assert.deepEqual(
    notificationDestination({ type: 'small_works_created', relatedId: 'SW-1', role: 'manager' }),
    { kind: 'smallWorksDetail', relatedId: 'SW-1' }
  )
  assert.deepEqual(notificationDestination({ type: 'not_a_real_type', role: 'admin' }), { kind: 'notifications' })
  assert.deepEqual(
    notificationDestination({ type: 'timesheet_submission_reminder', dayKey: '2026-10-17', role: 'operative' }),
    { kind: 'timesheetMine', dayKey: '2026-10-17' }
  )
})

test('device push uses existing inbox types and leaves on-device clocks local', () => {
  const push = devicePushNotificationTypes()
  for (const type of [
    'booking_created',
    'booked_onto_job',
    'booking_clash',
    'task_created',
    'task_completed',
    'deadline_assigned',
    'holiday_request_submitted',
    'holiday_request_approved',
    'holiday_request_declined',
    'timesheet_pending_manager_signoff',
    'timesheet_signed_by_manager',
    'toolbox_talk_issued',
    'hs_toolbox_reminder',
    'material_order_placed',
    'material_order_created',
    'variation',
    'warning_removed',
    'operative_created',
    'manager_created',
    'client_created',
    'project_created',
    'small_works_created',
    'timesheet_submission_reminder',
  ]) {
    assert.equal(notificationDeliversDevicePush(type), true, type)
    assert.ok(push.includes(type), type)
  }
  for (const type of [
    'material_order_cut_off',
    'qualification_expiry',
    'deadline_reminder',
    'deadline_due',
  ]) {
    assert.equal(notificationDeliversDevicePush(type), false, type)
    assert.equal(push.includes(type), false, type)
  }
  assert.equal(notificationDeliversDevicePush('line_manager_peer_update'), false)
  assert.equal(notificationDeliversDevicePush('not_a_real_type'), false)
  assert.equal(NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND, true)
})

test('unread notification badge counts only that user and leaves read rows out', () => {
  const rows = [
    { userId: 'u1', isRead: false },
    { userId: 'u1', isRead: true },
    { userId: 'u2', isRead: false },
    { userId: '', isRead: false },
    { userId: 'u1' },
  ]
  assert.equal(inboxNotificationVisibleToUser({ userId: 'u1' }, 'u1'), true)
  assert.equal(inboxNotificationVisibleToUser({ userId: 'u2' }, 'u1'), false)
  // 1.3.0: an ownerless row is not an inbox row (neither app lists it), so it never counts.
  assert.equal(inboxNotificationVisibleToUser({ userId: '' }, 'u1'), false)
  assert.equal(unreadNotificationBadgeCount(rows, 'u1'), 2)
  assert.equal(unreadNotificationBadgeCount(rows, 'u2'), 1)
  // Every id of the person counts (personIdSet), without case.
  assert.equal(unreadNotificationBadgeCount(rows, ['old-invite', 'U1']), 2)
  assert.equal(unreadNotificationBadgeCount(rows, []), 0)
  assert.equal(unreadNotificationBadgeCount(rows, ''), 0)
  assert.equal(unreadNotificationBadgeCount(undefined, 'u1'), 0)
  const newest = { createdAt: new Date('2026-10-13T10:00:00.000Z') }
  const oldest = { createdAt: new Date('2026-10-12T10:00:00.000Z') }
  assert.ok(compareInboxNotificationsByCreatedAt(newest, oldest) < 0)
  assert.deepEqual([oldest, newest].sort(compareInboxNotificationsByCreatedAt), [newest, oldest])
})

test('timesheet status is signed only after a real operative sign and manager counter-sign when required', () => {
  const unsigned = parseTimesheetStatusFields({})
  assert.equal(timesheetListBucket(unsigned, true), 'unsigned')
  const awaiting = parseTimesheetStatusFields({
    operativeSignedAt: '2026-10-02T09:00:00.000Z',
    operativeSignedByName: 'Ada',
  })
  assert.equal(isTimesheetAwaitingSignOff(awaiting, true), true)
  assert.equal(isTimesheetFullySigned(awaiting, true), false)
  assert.equal(timesheetListBucket(awaiting, true), 'awaiting')
  const signed = parseTimesheetStatusFields({
    operativeSignedAt: '2026-10-02T09:00:00.000Z',
    operativeSignedByName: 'Ada',
    managerSignedAt: '2026-10-03T09:00:00.000Z',
    managerSignedByName: 'Pat',
  })
  assert.equal(timesheetListBucket(signed, true), 'signed')
  const exported = parseTimesheetStatusFields({
    operativeSignedAt: '2026-10-02T09:00:00.000Z',
    operativeSignedByName: 'Ada',
    managerSignedAt: '2026-10-03T09:00:00.000Z',
    managerSignedByName: 'Pat',
    exportedAt: '2026-10-04T09:00:00.000Z',
  })
  assert.equal(timesheetListBucket(exported, true), 'exported')
  const selfSigned = parseTimesheetStatusFields({
    operativeSignedAt: '2026-10-02T09:00:00.000Z',
    operativeSignedByName: 'Ada',
  })
  assert.equal(isTimesheetFullySigned(selfSigned, false), true)
  assert.equal(timesheetListBucket(selfSigned, false), 'signed')
  assert.equal(timesheetListBucket(parseTimesheetStatusFields({ operativeSignedAt: '2019-12-31T00:00:00.000Z', operativeSignedByName: 'Old' }), false), 'unsigned')
})

test('web managerSignedAt and iOS approvedAt are the same signed-off status', () => {
  const fromWeb = parseTimesheetStatusFields({
    operativeSignedAt: '2026-10-02T09:00:00.000Z',
    operativeSignedByName: 'Ada',
    managerSignedAt: '2026-10-03T10:00:00.000Z',
    managerSignedByName: 'Pat',
  })
  const fromIosAlias = parseTimesheetStatusFields({
    operativeSignedAt: '2026-10-02T09:00:00.000Z',
    operativeSignedByName: 'Ada',
    approvedAt: '2026-10-03T10:00:00.000Z',
    approvedByName: 'Pat',
  })
  assert.equal(timesheetListBucket(fromWeb, true), 'signed')
  assert.equal(timesheetListBucket(fromIosAlias, true), 'signed')
  assert.equal(fromWeb.managerSignedAtMs, fromIosAlias.managerSignedAtMs)
  const written = timesheetSignOffWriteFields({
    role: 'manager',
    signedAtMs: Date.parse('2026-10-03T10:00:00.000Z'),
    signedByName: 'Pat',
    signedByUserId: 'mgr',
  })
  assert.equal(written.managerSignedAtMs, written.approvedAtMs)
  assert.equal(written.approvedByName, 'Pat')
})

test('invoiceGeneratedAt leftover is not exported; a later exportedAt is', () => {
  const generated = Date.parse('2026-10-03T10:00:00.000Z')
  assert.equal(resolveTimesheetExportedAtMs({ invoiceGeneratedAt: generated }), null)
  assert.equal(
    resolveTimesheetExportedAtMs({ exportedAt: generated, invoiceGeneratedAt: generated }),
    null
  )
  assert.equal(
    resolveTimesheetExportedAtMs({
      exportedAt: Date.parse('2026-10-03T12:00:00.000Z'),
      invoiceGeneratedAt: generated,
    }),
    Date.parse('2026-10-03T12:00:00.000Z')
  )
})

test('timesheet period identity stays on the stored window after a pay-run mode change', () => {
  const firstToSeventh = timesheetPeriodFromInvoicing({
    paymentRunMode: 'date_ranges',
    ranges: [
      { startDay: 1, endDay: 7, startDate: 1, endDate: 7 },
      { startDay: 8, endDay: 31, startDate: 8, endDate: 31 },
    ],
    referenceDayKey: '2026-10-03',
    timeZone: 'Europe/London',
  })
  assert.deepEqual(firstToSeventh, { startDayKey: '2026-10-01', endDayKey: '2026-10-07' })
  const liveHalfMonth = timesheetPeriodFromInvoicing({
    paymentRunMode: 'date_ranges',
    ranges: [
      { startDay: 1, endDay: 15, startDate: 1, endDate: 15 },
      { startDay: 16, endDay: 31, startDate: 16, endDate: 31 },
    ],
    referenceDayKey: '2026-10-03',
    timeZone: 'Europe/London',
  })
  assert.deepEqual(liveHalfMonth, { startDayKey: '2026-10-01', endDayKey: '2026-10-15' })
  const kept = resolveTimesheetPeriod({
    storedStartDayKey: '2026-10-01',
    storedEndDayKey: '2026-10-07',
    currentPeriod: liveHalfMonth,
  })
  assert.deepEqual(kept, firstToSeventh)
  assert.equal(timesheetPeriodMatches(kept, firstToSeventh), true)
  assert.equal(timesheetPeriodMatches(kept, liveHalfMonth), false)
  assert.equal(timesheetPeriodContainsDay(firstToSeventh, '2026-10-07'), true)
  assert.equal(timesheetPeriodContainsDay(firstToSeventh, '2026-10-08'), false)
  assert.equal(
    pickTimesheetRowForPeriod(
      [
        { startDayKey: '2026-10-01', endDayKey: '2026-10-07', hasActivity: true },
        { startDayKey: '2026-10-01', endDayKey: '2026-10-15', hasActivity: false },
      ],
      liveHalfMonth
    ),
    1
  )
  assert.equal(
    pickTimesheetRowForPeriod(
      [{ startDayKey: '2026-10-07', endDayKey: '2026-10-13', hasActivity: true }],
      liveHalfMonth
    ),
    -1
  )
  assert.ok(timesheetDocumentId('u1', '2026-10-01', 'Europe/London').startsWith('timesheet_u1_'))
  assert.equal(
    timesheetExportStoragePath('org-1', 'Ada Booked timesheet.pdf', 1_775_000_000),
    'organizations/org-1/timesheetExports/1775000000_Ada_Booked_timesheet.pdf'
  )
})

test('selectable payment runs keep the old window after a mode or range change', () => {
  const current = {
    paymentRunMode: 'date_ranges' as const,
    ranges: [
      { startDay: 1, endDay: 15, startDate: 1, endDate: 15 },
      { startDay: 16, endDay: 31, startDate: 16, endDate: 31 },
    ],
  }
  const previous = {
    paymentRunMode: 'date_ranges' as const,
    ranges: [
      { startDay: 1, endDay: 7, startDate: 1, endDate: 7 },
      { startDay: 8, endDay: 31, startDate: 8, endDate: 31 },
    ],
  }
  const history = paymentRunHistoryAfterChange({
    previous,
    next: current,
    existingHistory: [],
    recordedAtDayKey: '2026-10-12',
  })
  assert.equal(history.length, 1)
  assert.deepEqual(history[0].ranges, [
    { startDay: 1, endDay: 7 },
    { startDay: 8, endDay: 31 },
  ])
  const selectable = selectableTimesheetPaymentRunPeriods({
    current,
    historicalWindows: history,
    observedPeriods: [{ startDayKey: '2026-09-01', endDayKey: '2026-09-07' }],
    referenceDayKey: '2026-10-12',
    lookbackCount: 6,
    timeZone: 'Europe/London',
  })
  const keys = selectable.map((row) => `${row.startDayKey}|${row.endDayKey}`)
  assert.ok(keys.includes('2026-10-01|2026-10-15'), 'new 1–15 window appears')
  assert.ok(keys.includes('2026-10-01|2026-10-07'), 'historical 1–7 window remains')
  assert.ok(keys.includes('2026-09-01|2026-09-07'), 'observed stored period remains')
  const recurringHistory = paymentRunHistoryAfterChange({
    previous: { paymentRunMode: 'recurring_timeframe', recurringRunStartDay: 'monday', recurringRunEndDay: 'sunday' },
    next: current,
    existingHistory: history,
    recordedAtDayKey: '2026-10-12',
  })
  const afterRecurring = selectableTimesheetPaymentRunPeriods({
    current,
    historicalWindows: recurringHistory,
    referenceDayKey: '2026-10-12',
    lookbackCount: 4,
    timeZone: 'Europe/London',
  })
  assert.ok(afterRecurring.some((row) => row.startDayKey === '2026-10-05' && row.endDayKey === '2026-10-11'))
})

test('hasAccess opens missing/none/pending/trialing/active and past_due within 7 days, including cancel-at-period-end', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: {
    ProjectPlannerCanonical?: {
      PAYMENT_GRACE_MS: number
      hasAccess: (billing: unknown, now?: number) => boolean
    }
  } = {}
  runInContext(source, createContext(sandbox))
  const packed = sandbox.ProjectPlannerCanonical
  assert.ok(packed)
  assert.equal(typeof packed.hasAccess, 'function')
  assert.equal(packed.PAYMENT_GRACE_MS, PAYMENT_GRACE_MS)
  assert.equal(PAYMENT_GRACE_MS, 7 * 24 * 60 * 60 * 1000)

  const now = Date.parse('2026-10-16T12:00:00.000Z')
  const withinGrace = new Date(now - 2 * 24 * 60 * 60 * 1000)
  const afterGrace = new Date(now - 8 * 24 * 60 * 60 * 1000)
  const periodEnd = new Date(now + 10 * 24 * 60 * 60 * 1000)

  const cases: Array<{ billing: unknown; expected: boolean; label: string }> = [
    { billing: null, expected: true, label: 'missing' },
    { billing: undefined, expected: true, label: 'undefined' },
    { billing: { status: 'none' }, expected: true, label: 'none' },
    { billing: { status: 'pending' }, expected: true, label: 'pending' },
    { billing: { status: 'trialing' }, expected: true, label: 'trialing' },
    { billing: { status: 'active' }, expected: true, label: 'active' },
    { billing: { status: 'active', billingInterval: 'month' }, expected: true, label: 'active monthly' },
    { billing: { status: 'active', billingInterval: 'year' }, expected: true, label: 'active annual' },
    {
      billing: { status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: periodEnd, billingInterval: 'month' },
      expected: true,
      label: 'cancel-at-period-end monthly still active',
    },
    {
      billing: { status: 'active', cancelAtPeriodEnd: true, currentPeriodEnd: periodEnd, billingInterval: 'year' },
      expected: true,
      label: 'cancel-at-period-end annual still active',
    },
    { billing: { status: 'past_due' }, expected: true, label: 'past_due without lastPaymentFailedAt' },
    { billing: { status: 'past_due', lastPaymentFailedAt: withinGrace }, expected: true, label: 'past_due within 7 days' },
    {
      billing: { status: 'past_due', lastPaymentFailedAt: withinGrace.getTime() },
      expected: true,
      label: 'past_due within 7 days (ms)',
    },
    { billing: { status: 'past_due', lastPaymentFailedAt: afterGrace }, expected: false, label: 'past_due after 7 days' },
    { billing: { status: 'canceled' }, expected: false, label: 'canceled' },
    {
      billing: { status: 'canceled', cancelAtPeriodEnd: true, currentPeriodEnd: periodEnd },
      expected: false,
      label: 'canceled after period end',
    },
    { billing: { status: 'unpaid' }, expected: false, label: 'unpaid' },
    { billing: { status: 'paused' }, expected: false, label: 'paused' },
    { billing: { status: 'incomplete' }, expected: false, label: 'incomplete' },
  ]

  for (const row of cases) {
    assert.equal(hasAccess(row.billing as never, now), row.expected, `module ${row.label}`)
    assert.equal(packed.hasAccess(row.billing, now), row.expected, `packed ${row.label}`)
  }
})

test('an anonymised Deleted user is Inactive even when passwordSet and isActive are true', () => {
  const deleted = {
    email: '',
    firstName: 'Deleted',
    surname: 'user',
    name: 'Deleted user',
    displayName: 'Deleted user',
    passwordSet: true,
    isActive: true,
  }
  assert.equal(isAnonymisedDeletedProfile(deleted), true)
  assert.equal(rosterSegment(deleted), 'inactive')
  assert.equal(matchesRosterSegment(deleted, 'inactive'), true)
  assert.equal(matchesRosterSegment(deleted, 'active'), false)
  assert.equal(matchesRosterSegment(deleted, 'pending'), false)

  const singleName = { email: '  ', firstName: 'Deleted user', passwordSet: true, isActive: true }
  assert.equal(isAnonymisedDeletedProfile(singleName), true)
  assert.equal(rosterSegment(singleName), 'inactive')

  const namedEmptyEmail = { email: '', firstName: 'Pat', surname: 'Stone', passwordSet: true, isActive: true }
  assert.equal(isAnonymisedDeletedProfile(namedEmptyEmail), false)
  assert.equal(rosterSegment(namedEmptyEmail), 'active')

  const homonym = {
    email: 'deleted.user@site.com',
    firstName: 'Deleted',
    surname: 'user',
    passwordSet: true,
    isActive: true,
  }
  assert.equal(isAnonymisedDeletedProfile(homonym), false)
  assert.equal(rosterSegment(homonym), 'active')
})

test('an anonymised Deleted user is never a current labour or warning candidate', () => {
  const deleted = {
    id: 'QAlPe29vLLP4spK554UtpaBLW7N2',
    email: '',
    firstName: 'Deleted',
    surname: 'user',
    name: 'Deleted user',
    displayName: 'Deleted user',
    passwordSet: true,
    isActive: true,
    isOperativeMode: true,
    isManager: false,
    isAdmin: false,
    isSuperAdmin: false,
  }
  assert.equal(rosterSegment(deleted), 'inactive')
  assert.deepEqual(listedCurrentLabourPeople([deleted]), [])
  assert.equal(listedRosterUsers([deleted], []).length, 1)

  const live = {
    id: 'U-LIVE',
    email: 'ada@site.test',
    name: 'Ada App',
    isActive: true,
    passwordSet: true,
    isOperativeMode: true,
    isManager: false,
    isAdmin: false,
    isSuperAdmin: false,
  }
  const unbooked = unbookedLabourRows({
    timeZone: 'Europe/London',
    startDayKey: '2026-10-12',
    endDayKey: '2026-10-12',
    includeWeekends: false,
    standardPaidHours: 8,
    saturdayCountsAsHours: 0,
    sundayCountsAsHours: 0,
    people: [deleted, live],
    operatives: [
      {
        id: 'OP-DEL',
        email: '',
        name: 'Deleted user',
        isActive: true,
        isPlaceholder: false,
        profileWeight: 1,
      },
    ],
    bookings: [],
    holidays: [],
  })
  assert.deepEqual(
    unbooked.map((row) => row.personKey),
    ['U-LIVE']
  )
  assert.equal(
    unbooked.some((row) => row.operativeName === 'Deleted user' || row.personKey === deleted.id),
    false
  )

  const unverified = unverifiedOperativeRows({
    referenceIso: '2026-10-16T11:00:00.000Z',
    timeZone: 'Europe/London',
    operatives: [{ id: 'OP-DEL', email: '', name: 'Deleted user' }],
    people: [
      {
        email: '',
        passwordSet: false,
        createdAtIso: '2026-10-01T11:00:00.000Z',
        isOperativeMode: true,
      },
    ],
  })
  assert.deepEqual(unverified, [])

  const quals = qualificationExpiryRows({
    referenceIso: '2026-10-16T11:00:00.000Z',
    timeZone: 'Europe/London',
    operatives: [
      {
        id: 'OP-DEL',
        isActive: true,
        name: 'Deleted user',
        email: '',
        expiries: [{ qualificationId: 'Q1', name: 'CSCS', expiryIso: '2026-10-01T11:00:00.000Z' }],
      },
    ],
  })
  assert.deepEqual(quals, [])
})

test('a UUID placeholder stays Pending only while userEmails still claims the live email', () => {
  const placeholder = {
    email: 'new.operative@site.com',
    firstName: 'New',
    surname: 'Operative',
    passwordSet: false,
    mobileNumber: '07700900456',
  }
  const leftover = {
    email: 'farnienel@hotmail.com',
    firstName: 'Test',
    surname: 'Operative',
    passwordSet: false,
    mobileNumber: '07700900123',
  }
  const deleted = {
    email: '',
    firstName: 'Deleted',
    surname: 'user',
    passwordSet: true,
    isActive: true,
  }
  const claimed = ['new.operative@site.com']

  assert.equal(rosterSegment(placeholder), 'pending')
  assert.equal(isIdentifiablePendingLeftover(placeholder, claimed), false)
  assert.equal(isIdentifiablePendingLeftover(leftover, claimed), true)
  assert.equal(isIdentifiablePendingLeftover(leftover, null), false)

  const listed = listedRosterUsers([deleted, leftover, placeholder], claimed)
  assert.deepEqual(listed.map((row) => row.email), ['', 'new.operative@site.com'])
  assert.equal(listed.some((row) => row.firstName === 'Test' && row.surname === 'Operative'), false)
  assert.equal(listed.some((row) => rosterSegment(row) === 'pending' && row.firstName === 'Test'), false)
  assert.equal(listed.filter((row) => rosterSegment(row) === 'inactive').length, 1)

  const afterDelete = listedRosterUsers([leftover], [])
  assert.deepEqual(afterDelete, [])
  assert.equal(isIdentifiablePendingLeftover(leftover, []), true)

  const phoneOnly = { email: '', firstName: 'Test', surname: 'Operative', passwordSet: false, mobileNumber: '07700' }
  assert.equal(isIdentifiablePendingLeftover(phoneOnly, null), true)
  assert.deepEqual(listedRosterUsers([phoneOnly], null), [])
})

test('the packed roster-segment functions match this module', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: {
    ProjectPlannerCanonical?: {
      rosterSegment: (profile: unknown) => string
      matchesRosterSegment: (profile: unknown, segment: string) => boolean
      listedRosterUsers: (users: unknown[], claimed?: string[] | null) => Array<{ email?: string }>
      listedCurrentLabourPeople: (users: unknown[]) => unknown[]
    }
  } = {}
  runInContext(source, createContext(sandbox))
  const packed = sandbox.ProjectPlannerCanonical
  assert.ok(packed)
  const deleted = {
    email: '',
    firstName: 'Deleted',
    surname: 'user',
    passwordSet: true,
    isActive: true,
  }
  assert.equal(packed.rosterSegment(deleted), 'inactive')
  assert.equal(packed.matchesRosterSegment(deleted, 'active'), false)
  assert.deepEqual(packed.listedCurrentLabourPeople([deleted]), [])
  const leftover = { email: 'farnienel@hotmail.com', firstName: 'Test', surname: 'Operative', passwordSet: false }
  assert.deepEqual(packed.listedRosterUsers([leftover], []), [])
  assert.equal(packed.listedRosterUsers([leftover], ['farnienel@hotmail.com']).length, 1)
})

test('re-invite is blocked only by a live email claim, not a leftover or tombstone', () => {
  const inviteEmail = 'farnienel@hotmail.com'
  const leftover = {
    userId: '57CC31FC-1111-4222-8333-ABCDEF123456',
    email: inviteEmail,
    firstName: 'Test',
    surname: 'Operative',
    passwordSet: false,
    mobileNumber: '07700900123',
  }
  const tombstone = {
    userId: 'QAlPe29vLLP4spK554UtpaBLW7N2',
    email: '',
    firstName: 'Deleted',
    surname: 'user',
    name: 'Deleted user',
    passwordSet: true,
    isActive: true,
  }
  const liveMember = {
    userId: 'auth-live',
    email: inviteEmail,
    firstName: 'Pat',
    surname: 'Live',
    passwordSet: true,
    isActive: true,
  }
  const pendingClaimed = {
    userId: 'UUID-PENDING',
    email: inviteEmail,
    firstName: 'New',
    surname: 'Invite',
    passwordSet: false,
  }

  assert.deepEqual(
    resolveInviteEmailClaim({
      inviteEmail,
      existingUsers: [leftover, tombstone],
      emailPointer: { exists: false },
    }),
    { action: 'allow', reuseUserId: leftover.userId }
  )
  assert.equal(
    inviteEmailHasLiveClaim({
      inviteEmail,
      existingUsers: [leftover, tombstone],
      emailPointer: { exists: false },
    }),
    false
  )

  assert.deepEqual(
    resolveInviteEmailClaim({
      inviteEmail,
      existingUsers: [tombstone],
      emailPointer: {
        exists: true,
        pointedUserId: tombstone.userId,
        pointedUser: tombstone,
      },
    }),
    { action: 'allow' }
  )

  assert.deepEqual(
    resolveInviteEmailClaim({
      inviteEmail,
      existingUsers: [],
      emailPointer: { exists: true, pointedUserId: 'dead-placeholder', pointedUser: null },
    }),
    { action: 'allow', reuseUserId: 'dead-placeholder' }
  )

  assert.deepEqual(
    resolveInviteEmailClaim({
      inviteEmail,
      existingUsers: [],
      emailPointer: { exists: false },
    }),
    { action: 'allow' }
  )

  assert.deepEqual(
    resolveInviteEmailClaim({
      inviteEmail,
      existingUsers: [liveMember],
      emailPointer: { exists: false },
    }),
    { action: 'block' }
  )

  assert.deepEqual(
    resolveInviteEmailClaim({
      inviteEmail,
      existingUsers: [pendingClaimed],
      emailPointer: {
        exists: true,
        pointedUserId: pendingClaimed.userId,
        pointedUser: pendingClaimed,
      },
    }),
    { action: 'block' }
  )

  assert.deepEqual(
    resolveInviteEmailClaim({
      inviteEmail,
      existingUsers: [{ userId: 'other', email: 'other@site.com', passwordSet: true }],
      emailPointer: {
        exists: true,
        pointedUserId: 'other',
        pointedUser: { userId: 'other', email: 'other@site.com', passwordSet: true },
      },
    }),
    { action: 'allow' }
  )

  assert.deepEqual(
    resolveInviteEmailClaim({
      inviteEmail,
      existingUsers: [leftover],
      emailPointer: null,
    }),
    { action: 'block' }
  )
})

test('admin invite placeholders omit age confirmation and only look up the email in this org', () => {
  assert.equal(
    userCreateRequiresAgeConfirmation({ creatorUserId: 'admin-uid', targetUserId: 'placeholder-uuid' }),
    false
  )
  assert.equal(
    userCreateRequiresAgeConfirmation({ creatorUserId: 'self-uid', targetUserId: 'self-uid' }),
    true
  )
  assert.equal(userCreateRequiresAgeConfirmation({ creatorUserId: '', targetUserId: 'self-uid' }), false)
  assert.deepEqual(USER_SELF_CREATE_AGE_FIELDS, ['ageConfirmed', 'ageConfirmedAt', 'ageConfirmedYears'])
  assert.equal(USER_DOCUMENT_FIELDS.includes('ageConfirmed'), false)
  const placeholder = invitePlaceholderUserWriteFields()
  assert.equal(placeholder.passwordSet, false)
  assert.equal(placeholder.isActive, true)
  assert.equal(placeholder.isSuperAdmin, false)
  assert.equal(placeholder.policyAccepted, false)
  assert.equal('ageConfirmed' in placeholder, false)
  assert.deepEqual(inviteEmailOrgLookupConstraints(' Org-1 ', 'Pat@Site.COM'), {
    organizationId: 'Org-1',
    email: 'pat@site.com',
  })
  assert.equal(inviteWritesOperativeProfile(), false)
})

test('the packed invite-email claim matches this module', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: {
    ProjectPlannerCanonical?: {
      resolveInviteEmailClaim: (input: unknown) => { action: string; reuseUserId?: string }
      inviteEmailHasLiveClaim: (input: unknown) => boolean
      inviteEmailOrgLookupConstraints: (
        organizationId: string,
        email: string
      ) => { organizationId: string; email: string }
      invitePlaceholderUserWriteFields: () => { passwordSet: boolean }
      inviteWritesOperativeProfile: () => boolean
      userCreateRequiresAgeConfirmation: (input: unknown) => boolean
    }
  } = {}
  runInContext(source, createContext(sandbox))
  const packed = sandbox.ProjectPlannerCanonical
  assert.ok(packed)
  const leftover = {
    userId: '57CC31FC-1111-4222-8333-ABCDEF123456',
    email: 'farnienel@hotmail.com',
    firstName: 'Test',
    surname: 'Operative',
    passwordSet: false,
  }
  const input = {
    inviteEmail: 'farnienel@hotmail.com',
    existingUsers: [leftover],
    emailPointer: { exists: false },
  }
  const plain = (value: unknown) => JSON.parse(JSON.stringify(value))
  assert.deepEqual(plain(packed.resolveInviteEmailClaim(input)), resolveInviteEmailClaim(input))
  assert.equal(packed.inviteEmailHasLiveClaim(input), false)
  assert.equal(
    packed.inviteEmailHasLiveClaim({
      inviteEmail: 'farnienel@hotmail.com',
      existingUsers: [{ ...leftover, passwordSet: true }],
      emailPointer: { exists: false },
    }),
    true
  )
  assert.deepEqual(
    plain(packed.inviteEmailOrgLookupConstraints('org-a', 'Pat@Site.com')),
    inviteEmailOrgLookupConstraints('org-a', 'Pat@Site.com')
  )
  assert.equal(packed.invitePlaceholderUserWriteFields().passwordSet, false)
  assert.equal(packed.inviteWritesOperativeProfile(), false)
  assert.equal(
    packed.userCreateRequiresAgeConfirmation({ creatorUserId: 'admin', targetUserId: leftover.userId }),
    false
  )
})

const REPORT_ORG = 'ORG-REPORT'
const REPORT_PATH = `organizations/${REPORT_ORG}/siteAudits/AUDIT-1/photo 1.jpg`

test('a file report stores the Storage path from a download URL, never the token', () => {
  const url =
    'https://firebasestorage.googleapis.com/v0/b/project-planner-f986c.appspot.com/o/' +
    encodeURIComponent(REPORT_PATH) +
    '?alt=media&token=SECRET-TOKEN'
  assert.equal(fileReportStoragePath(url), REPORT_PATH)
  assert.equal(fileReportStoragePath(`gs://project-planner-f986c.appspot.com/${REPORT_PATH}`), REPORT_PATH)
  assert.equal(fileReportStoragePath(REPORT_PATH), REPORT_PATH)
  assert.equal(fileReportStoragePath('https://example.com/file.jpg'), null)
  assert.equal(fileReportStoragePath(''), null)
})

test('a file report is open, scoped to this organisation, and caps details', () => {
  const result = fileReportWriteFields({
    organizationId: REPORT_ORG,
    storagePath: REPORT_PATH,
    surface: 'site_audit',
    parentId: 'AUDIT-1',
    reason: 'copyright',
    reportedByUserId: 'USER-1',
    details: `  ${'x'.repeat(FILE_REPORT_DETAILS_MAX + 50)}  `,
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.fields.status, 'open')
  assert.equal(result.fields.fileName, 'photo 1.jpg')
  assert.equal(result.fields.details.length, FILE_REPORT_DETAILS_MAX)
  assert.equal(Object.keys(result.fields).includes('createdAt'), false)
  assert.equal(fileReportCollectionPath(REPORT_ORG), 'organizations/ORG-REPORT/fileReports')
})

test('a file report refuses another organisation’s path, an unknown reason, or a missing parent', () => {
  const base = {
    organizationId: REPORT_ORG,
    storagePath: REPORT_PATH,
    surface: 'site_audit',
    parentId: 'AUDIT-1',
    reason: 'offensive',
    reportedByUserId: 'USER-1',
  }
  assert.deepEqual(fileReportWriteFields({ ...base, storagePath: 'organizations/OTHER/siteAudits/a.jpg' }), {
    ok: false,
    error: 'bad_path',
  })
  assert.deepEqual(fileReportWriteFields({ ...base, storagePath: `organizations/${REPORT_ORG}/../x` }), {
    ok: false,
    error: 'bad_path',
  })
  assert.deepEqual(fileReportWriteFields({ ...base, reason: 'spam' }), { ok: false, error: 'bad_reason' })
  assert.deepEqual(fileReportWriteFields({ ...base, surface: 'profile_photo' }), { ok: false, error: 'bad_surface' })
  assert.deepEqual(fileReportWriteFields({ ...base, parentId: ' ' }), { ok: false, error: 'missing_parent' })
  assert.equal(fileReportReasonCopy('spam'), fileReportReasonCopy('other'))
})

test('only admins and super admins review file reports', () => {
  const role = { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: false }
  assert.equal(canReviewFileReports({ ...role, isAdmin: true }), true)
  assert.equal(canReviewFileReports({ ...role, isSuperAdmin: true }), true)
  assert.equal(canReviewFileReports({ ...role, isManager: true }), false)
  assert.equal(canReviewFileReports({ ...role, isAdmin: true, isOperativeMode: true }), false)
  assert.deepEqual(fileReportReviewWriteFields({ status: 'removed', reviewedByUserId: 'ADMIN' }), {
    status: 'removed',
    reviewedByUserId: 'ADMIN',
  })
  assert.equal(fileReportReviewWriteFields({ status: 'open', reviewedByUserId: 'ADMIN' }), null)
})

test('the iOS JavaScript bundle builds the same file report fields', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const input = {
    organizationId: REPORT_ORG,
    storagePath: REPORT_PATH,
    surface: 'task_attachment',
    parentId: 'TASK-1',
    reason: 'personal_data',
    reportedByUserId: 'USER-1',
    details: 'Shows a passport',
  }
  assert.deepEqual(
    JSON.parse(JSON.stringify(sandbox.ProjectPlannerCanonical?.fileReportWriteFields(input))),
    fileReportWriteFields(input)
  )
})

// ─── Scheduling → Daily Overview → Warnings share one booking identity ───────

const labourBase = {
  isActive: true,
  passwordSet: true,
  isOperativeMode: false,
  isManager: false,
  isAdmin: false,
  isSuperAdmin: false,
}

function oneDayUnbooked(input: {
  people: Parameters<typeof unbookedLabourRows>[0]['people']
  bookings?: Parameters<typeof unbookedLabourRows>[0]['bookings']
  holidays?: Parameters<typeof unbookedLabourRows>[0]['holidays']
  excludedUserIds?: string[]
}) {
  return unbookedLabourRows({
    timeZone: 'Europe/London',
    startDayKey: '2026-10-27',
    endDayKey: '2026-10-27',
    includeWeekends: false,
    excludedUserIds: input.excludedUserIds,
    standardPaidHours: 8,
    saturdayCountsAsHours: 8,
    sundayCountsAsHours: 8,
    people: input.people,
    operatives: [],
    bookings: input.bookings ?? [],
    holidays: input.holidays ?? [],
  })
}

test('a booking made while the person was a pending invite still covers them after sign-up', () => {
  const placeholder = 'A1B2C3D4-0000-4000-8000-000000000001'
  const person = {
    ...labourBase,
    id: 'authUidAfterSignUp',
    email: 'pat@site.test',
    name: 'Pat Invited',
    isOperativeMode: true,
    formerIds: [placeholder],
  }
  const booked = oneDayUnbooked({
    people: [person],
    bookings: [{ personId: placeholder, dayKey: '2026-10-27', kind: 'operative', timeSlot: 'FULL DAY' }],
  })
  assert.deepEqual(booked, [])
  // Without the former id the same booking matches nobody and Pat is flagged.
  const orphaned = oneDayUnbooked({
    people: [{ ...person, formerIds: [] }],
    bookings: [{ personId: placeholder, dayKey: '2026-10-27', kind: 'operative', timeSlot: 'FULL DAY' }],
  })
  assert.equal(orphaned.length, 1)
  // Leave and an exclusion saved under the placeholder id also follow the person.
  assert.deepEqual(
    oneDayUnbooked({
      people: [person],
      holidays: [{ userId: placeholder, startDayKey: '2026-10-27', endDayKey: '2026-10-27', approved: true }],
    }),
    []
  )
  assert.deepEqual(oneDayUnbooked({ people: [person], excludedUserIds: [placeholder] }), [])
  assert.deepEqual(formerIdAliases([person]), { [placeholder]: 'authUidAfterSignUp' })
  assert.deepEqual(labourPersonIds(person), ['authUidAfterSignUp', placeholder])
})

test('who can be booked is who can be flagged as unbooked labour', () => {
  const people = [
    { ...labourBase, id: 'op', email: 'op@site.test', name: 'Op', isOperativeMode: true },
    { ...labourBase, id: 'mgr', email: 'mgr@site.test', name: 'Mgr', isManager: true },
    { ...labourBase, id: 'admin', email: 'admin@site.test', name: 'Admin', isAdmin: true },
    { ...labourBase, id: 'owner', email: 'owner@site.test', name: 'Owner', isSuperAdmin: true },
    { ...labourBase, id: 'plain', email: 'plain@site.test', name: 'Plain' },
    { ...labourBase, id: 'gone', email: 'gone@site.test', name: 'Gone', isOperativeMode: true, isActive: false },
  ]
  assert.deepEqual(
    people.map((person) => labourBookingKind(person)),
    ['operative', 'manager', 'manager', 'manager', null, null]
  )
  const flagged = new Set(oneDayUnbooked({ people }).map((row) => row.personKey))
  const bookable = new Set(people.filter((person) => labourBookingKind(person) !== null).map((person) => person.id))
  assert.deepEqual([...flagged].sort(), [...bookable].sort())
})

test('a completed booking still occupies the day; a cancelled one does not', () => {
  assert.equal(bookingOccupiesDay('Confirmed'), true)
  assert.equal(bookingOccupiesDay('Tentative'), true)
  assert.equal(bookingOccupiesDay('confirmed'), true)
  assert.equal(bookingOccupiesDay('Completed'), true)
  assert.equal(bookingOccupiesDay('Cancelled'), false)
  assert.equal(bookingOccupiesDay('canceled'), false)
  assert.equal(bookingOccupiesDay(undefined), false)
})

test('accepting an invite records the placeholder id on users/{authUid}.formerUserIds', () => {
  assert.equal(USER_FORMER_IDS_FIELD, 'formerUserIds')
  assert.equal((USER_DOCUMENT_FIELDS as readonly string[]).includes('formerUserIds'), true)
  assert.deepEqual(
    inviteMigrationFormerIdWriteFields({ placeholderId: 'PLACEHOLDER-1', authUid: 'auth-1', existing: {} }),
    { formerUserIds: ['PLACEHOLDER-1'] }
  )
  assert.deepEqual(
    inviteMigrationFormerIdWriteFields({
      placeholderId: 'PLACEHOLDER-2',
      authUid: 'auth-1',
      existing: { formerUserIds: ['PLACEHOLDER-1', ' ', 7] },
    }),
    { formerUserIds: ['PLACEHOLDER-1', 'PLACEHOLDER-2'] }
  )
  assert.deepEqual(inviteMigrationFormerIdWriteFields({ placeholderId: 'auth-1', authUid: 'auth-1' }), {})
  assert.deepEqual(parseFormerUserIds({ formerUserIds: 'not-a-list' }), [])
})

test('the iOS bundle exposes the booking identity rules', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const bundle = sandbox.ProjectPlannerCanonical
  assert.ok(bundle)
  for (const name of [
    'bookingOccupiesDay',
    'labourBookingKind',
    'labourPersonIds',
    'formerIdAliases',
    'inviteMigrationFormerIdWriteFields',
    'parseFormerUserIds',
  ]) {
    assert.equal(typeof bundle[name], 'function', name)
  }
  assert.equal(bundle.bookingOccupiesDay('Completed'), true)
  assert.equal(
    bundle.labourBookingKind({ ...labourBase, id: 'plain', email: '', name: 'Plain' }),
    null
  )
})

const BK_OP = '11111111-2222-4333-8444-555555555555'
const BK_JOB = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE'
const BK_DATE = { seconds: Date.UTC(2026, 9, 26) / 1000 - 3600, nanoseconds: 0 }

function bookingDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    operativeId: BK_OP,
    projectId: BK_JOB,
    date: BK_DATE,
    timeSlot: 'FULL DAY',
    bookedBy: 'Ada Admin',
    status: 'Confirmed',
    notes: '',
    ...overrides,
  }
}

function readBooking(overrides: Record<string, unknown> = {}) {
  const result = parseBookingDocument('BOOKING-1', bookingDoc(overrides))
  assert.equal(result.ok, true, JSON.stringify(result))
  if (!result.ok) throw new Error('refused')
  return result
}

test('a clean booking reads with no repairs', () => {
  const result = readBooking()
  assert.deepEqual(result.repairs, [])
  assert.equal(result.booking.dateMs, BK_DATE.seconds * 1000)
  assert.equal(result.booking.operativeIdIsUuid, true)
})

test('booking aliases read and each is reported as a repair', () => {
  const cases: Array<[Record<string, unknown>, string, string, unknown]> = [
    [{ status: 'confirmed' }, 'status_alias', 'status', 'Confirmed'],
    [{ status: 'pending' }, 'status_alias', 'status', 'Tentative'],
    [{ status: 'canceled' }, 'status_alias', 'status', 'Cancelled'],
    [{ timeSlot: undefined }, 'slot_missing_full_day', 'timeSlot', 'FULL DAY'],
    [{ timeSlot: 'FULL_DAY' }, 'slot_alias', 'timeSlot', 'FULL DAY'],
    [{ timeSlot: 'MORNING' }, 'slot_alias', 'timeSlot', 'AM'],
    [{ timeSlot: 'evening' }, 'slot_alias', 'timeSlot', 'Evening'],
    [{ operativeId: undefined, operativeID: BK_OP }, 'operative_id_alias', 'operativeId', BK_OP],
    [{ projectId: undefined, projectID: BK_JOB }, 'project_id_alias', 'projectId', BK_JOB],
    [{ bookedBy: undefined }, 'booked_by_missing', 'bookedBy', ''],
    [{ date: BK_DATE.seconds * 1000 }, 'date_not_timestamp', 'dateMs', BK_DATE.seconds * 1000],
    [{ date: new Date(BK_DATE.seconds * 1000).toISOString() }, 'date_not_timestamp', 'dateMs', BK_DATE.seconds * 1000],
    [{ date: { _seconds: BK_DATE.seconds, _nanoseconds: 0 } }, '', 'dateMs', BK_DATE.seconds * 1000],
  ]
  for (const [overrides, repair, field, expected] of cases) {
    const result = readBooking(overrides)
    if (repair) assert.ok(result.repairs.includes(repair as never), `${JSON.stringify(overrides)} → ${repair}`)
    else assert.deepEqual(result.repairs, [])
    assert.equal((result.booking as unknown as Record<string, unknown>)[field], expected, JSON.stringify(overrides))
  }
})

test('a booking is refused, with the reason, when a required field is missing or unknown', () => {
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ operativeId: '' }, 'missing_operative_id'],
    [{ projectId: undefined }, 'missing_project_id'],
    [{ date: undefined }, 'missing_date'],
    [{ date: 'not a date' }, 'missing_date'],
    [{ status: 'Booked' }, 'bad_status'],
    [{ timeSlot: 'Lunch' }, 'bad_time_slot'],
  ]
  for (const [overrides, error] of cases) {
    const result = parseBookingDocument('BOOKING-1', bookingDoc(overrides))
    assert.equal(result.ok, false, JSON.stringify(overrides))
    if (!result.ok) assert.ok(result.errors.includes(error as never), `${JSON.stringify(overrides)} → ${error}`)
  }
})

test('a non-UUID operative id still reads but is flagged for iOS', () => {
  const result = readBooking({ operativeId: 'firebaseUid123' })
  assert.equal(result.booking.operativeIdIsUuid, false)
})

test('the booking write shape reads back as the same booking', () => {
  const dateMs = BK_DATE.seconds * 1000
  const written = bookingWriteFields({
    id: 'BOOKING-1',
    operativeId: BK_OP,
    projectId: BK_JOB,
    dateMs,
    timeSlot: 'full_day',
    status: 'pending',
    bookedBy: 'Ada Admin',
    workStartTime: '7:30 AM',
    workEndTime: '16:00:00',
    createdAtMs: dateMs,
    updatedAtMs: dateMs,
  })
  assert.equal(written.ok, true)
  if (!written.ok) return
  assert.equal(written.fields.timeSlot, 'FULL DAY')
  assert.equal(written.fields.status, 'Tentative')
  assert.equal(written.fields.workStartTime, '07:30')
  const read = parseBookingDocument('BOOKING-1', written.fields)
  assert.equal(read.ok, true)
  if (!read.ok) return
  assert.deepEqual(read.repairs, ['date_not_timestamp'])
  assert.equal(read.booking.dateMs, dateMs)
  assert.equal(read.booking.workEndTime, '16:00')
  assert.deepEqual(bookingWriteFields({ ...written.fields, id: '', dateMs, createdAtMs: dateMs, updatedAtMs: dateMs } as never).ok, false)
})

test('deleting a person removes only their bookings from today on, matched by id not name', () => {
  const now = '2026-10-26T09:00:00.000Z'
  const londonMidnight = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d) - 3600 * 1000
  const bookings = [
    { id: 'past', operativeId: BK_OP, dateMs: londonMidnight(2026, 10, 25) },
    { id: 'today', operativeId: BK_OP, dateMs: Date.UTC(2026, 9, 26) },
    { id: 'future', operativeId: BK_OP.toLowerCase(), dateMs: Date.UTC(2026, 10, 3) },
    { id: 'alias', operativeId: 'USER-UID', dateMs: Date.UTC(2026, 10, 3) },
    { id: 'someone-else', operativeId: 'OTHER', dateMs: Date.UTC(2026, 10, 3) },
  ]
  assert.deepEqual(
    bookingsToRemoveOnOperativeDelete({ bookings, operativeIds: [BK_OP, 'USER-UID'], nowIso: now, timeZone: 'Europe/London' }),
    ['today', 'future', 'alias']
  )
  assert.deepEqual(bookingsToRemoveOnOperativeDelete({ bookings, operativeIds: [], nowIso: now }), [])
})

test('the delete boundary is London midnight across the clock change', () => {
  // BST ends on Sunday 25 October 2026: London midnight that day is 23:00 UTC on the 24th.
  const saturdayLateBst = Date.UTC(2026, 9, 24, 22, 59)
  const sundayMidnightBst = Date.UTC(2026, 9, 24, 23, 0)
  const bookings = [
    { id: 'sat', projectId: BK_JOB, dateMs: saturdayLateBst },
    { id: 'sun', projectId: BK_JOB, dateMs: sundayMidnightBst },
  ]
  assert.deepEqual(
    bookingsToRemoveOnProjectDelete({ bookings, projectId: BK_JOB, nowIso: '2026-10-25T08:00:00.000Z', timeZone: 'Europe/London' }),
    ['sun']
  )
})

test('a booking whose job is gone is shown as Deleted job, not skipped', () => {
  assert.equal(bookingJobState(BK_JOB, [BK_JOB.toLowerCase()]), 'live')
  assert.equal(bookingJobState(BK_JOB, new Set(['OTHER'])), 'deleted_job')
  assert.equal(bookingJobLabel(undefined), ORPHAN_BOOKING_LABEL)
  assert.equal(bookingJobLabel(' 71 Broadwick St '), '71 Broadwick St')
})

test('booking health lists refused, repaired, orphaned and iOS-unreadable rows', () => {
  const rows = bookingHealthRows({
    docs: [
      { id: 'ok', data: bookingDoc() },
      { id: 'refused', data: bookingDoc({ status: 'Booked' }) },
      { id: 'repaired', data: bookingDoc({ status: 'pending' }) },
      { id: 'no-person', data: bookingDoc({ operativeId: '99999999-2222-4333-8444-555555555555' }) },
      { id: 'no-job', data: bookingDoc({ projectId: '99999999-BBBB-4CCC-8DDD-EEEEEEEEEEEE' }) },
      { id: 'uid', data: bookingDoc({ operativeId: 'firebaseUid123' }) },
    ],
    operativeIds: [BK_OP],
    userIds: ['firebaseUid123'],
    projectIds: [BK_JOB],
  })
  const kinds = rows.map((row) => `${row.id}:${row.kind}`)
  assert.deepEqual(kinds, ['refused:refused', 'repaired:repaired', 'no-person:missing_operative', 'no-job:missing_job', 'uid:ios_cannot_read'])
})

test('the iOS JavaScript bundle reads a booking the same way', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const data = bookingDoc({ status: 'pending', timeSlot: 'FULL_DAY', operativeID: BK_OP, operativeId: undefined })
  assert.deepEqual(
    JSON.parse(JSON.stringify(sandbox.ProjectPlannerCanonical?.parseBookingDocument('BOOKING-1', data))),
    JSON.parse(JSON.stringify(parseBookingDocument('BOOKING-1', data)))
  )
})

test('booking clocks stored as instants read in the organisation zone', () => {
  const start = { seconds: Date.UTC(2026, 8, 16, 6, 0) / 1000, nanoseconds: 0 }
  const result = readBooking({ timeSlot: 'CUSTOM_HOURS', workStartTime: start, workEndTime: '4:30 PM' })
  assert.equal(result.booking.workStartTime, '07:00')
  assert.equal(result.booking.workEndTime, '16:30')
  const utc = parseBookingDocument('B', bookingDoc({ workStartTime: start }), { timeZone: 'UTC' })
  assert.equal(utc.ok && utc.booking.workStartTime, '06:00')
})

test('a new legal pack version asks everyone to accept again', () => {
  assert.equal(legalPackNeedsAcceptance({ policyAccepted: false, acceptedVersion: '1.1', currentVersion: '1.1' }), true)
  assert.equal(legalPackNeedsAcceptance({ policyAccepted: true, acceptedVersion: '1.0', currentVersion: '1.1' }), true)
  assert.equal(legalPackNeedsAcceptance({ policyAccepted: true, acceptedVersion: undefined, currentVersion: '1.1' }), true)
  assert.equal(legalPackNeedsAcceptance({ policyAccepted: true, acceptedVersion: ' 1.1 ', currentVersion: '1.1' }), false)
})

const ROLE_NONE = { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: false }

test('only the person and admins see tax identifiers', () => {
  const subject = 'USER-1'
  assert.equal(canViewSensitiveProfile({ viewerRole: { ...ROLE_NONE, isOperativeMode: true }, viewerUserId: subject, subjectUserId: subject }), true)
  assert.equal(canViewSensitiveProfile({ viewerRole: { ...ROLE_NONE, isAdmin: true }, viewerUserId: 'ADMIN', subjectUserId: subject }), true)
  assert.equal(canViewSensitiveProfile({ viewerRole: { ...ROLE_NONE, isSuperAdmin: true }, viewerUserId: 'OWNER', subjectUserId: subject }), true)
  assert.equal(canViewSensitiveProfile({ viewerRole: { ...ROLE_NONE, isManager: true }, viewerUserId: 'MANAGER', subjectUserId: subject }), false)
  assert.equal(canViewSensitiveProfile({ viewerRole: { ...ROLE_NONE, isOperativeMode: true }, viewerUserId: 'OP-2', subjectUserId: subject }), false)
  assert.equal(canViewSensitiveProfile({ viewerRole: { ...ROLE_NONE, isAdmin: true, isOperativeMode: true }, viewerUserId: 'X', subjectUserId: subject }), false)
  assert.equal(sensitiveProfileDocPath(' USER-1 '), 'users/USER-1/private/taxIds')
})

test('tax identifiers mask to the last four characters', () => {
  assert.equal(maskSensitiveValue('12345 67890'), '•••• 7890')
  assert.equal(maskSensitiveValue('GB123456789'), '•••• 6789')
  assert.equal(maskSensitiveValue('1234'), '••••')
  assert.equal(maskSensitiveValue('  '), '')
})

test('the private tax document wins over the legacy user fields, even when cleared', () => {
  assert.deepEqual(resolveSensitiveProfile({ privateDoc: { utrNumber: '', vatNumber: 'GB1' }, legacyUser: { utrNumber: '999' } }), {
    utrNumber: '',
    vatNumber: 'GB1',
    source: 'private',
  })
  assert.deepEqual(resolveSensitiveProfile({ privateDoc: null, legacyUser: { utrNumber: ' 1234567890 ' } }), {
    utrNumber: '1234567890',
    vatNumber: '',
    source: 'legacy',
  })
  assert.equal(resolveSensitiveProfile({}).source, 'none')
})

test('tax identifier writes trim, cap length and need the writer', () => {
  assert.deepEqual(sensitiveProfileWriteFields({ utrNumber: ' 123 ', vatNumber: null, updatedByUserId: 'ADMIN' }), {
    ok: true,
    fields: { utrNumber: '123', vatNumber: '', updatedByUserId: 'ADMIN' },
  })
  assert.deepEqual(sensitiveProfileWriteFields({ utrNumber: 'x'.repeat(21), updatedByUserId: 'ADMIN' }), { ok: false, error: 'too_long' })
  assert.deepEqual(sensitiveProfileWriteFields({ utrNumber: '1', updatedByUserId: ' ' }), { ok: false, error: 'missing_user' })
})

test('exports leave tax identifiers out unless asked for by someone who may see them', () => {
  assert.equal(exportIncludesSensitiveFields({ canView: true }), false)
  assert.equal(exportIncludesSensitiveFields({ requested: true, canView: false }), false)
  assert.equal(exportIncludesSensitiveFields({ requested: true, canView: true }), true)
})

test('the iOS JavaScript bundle masks and resolves tax identifiers the same way', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  assert.equal(sandbox.ProjectPlannerCanonical?.maskSensitiveValue('1234567890'), maskSensitiveValue('1234567890'))
  const input = { privateDoc: null, legacyUser: { vatNumber: 'GB123456789' } }
  assert.deepEqual(
    JSON.parse(JSON.stringify(sandbox.ProjectPlannerCanonical?.resolveSensitiveProfile(input))),
    resolveSensitiveProfile(input)
  )
})

// ---------------------------------------------------------------------------
// Booking chain: Scheduling → Daily Overview → Warnings → Weekly Report.
// The same scenarios run in ProjectPlannerTests/BookingChainCanonicalTests.swift.

const CHAIN_USER = {
  id: 'Xy7AbcFirebaseUid0123456789',
  email: 'pat@site.test',
  name: 'Pat Login',
  isActive: true,
  passwordSet: true,
  isOperativeMode: true,
  isManager: false,
  isAdmin: false,
  isSuperAdmin: false,
}

const chainDay = (bookings: Array<Record<string, unknown>>, dayKey = '2026-10-27') =>
  unbookedLabourRowsOnDay({
    timeZone: 'Europe/London',
    dayKey,
    includeWeekends: false,
    excludedUserIds: [],
    standardPaidHours: 8,
    standardDayStart: '07:30',
    standardDayEnd: '16:00',
    breakWindowStart: '12:00',
    breakWindowEnd: '12:30',
    people: [CHAIN_USER],
    operatives: [],
    bookings: bookings as never,
    holidays: [],
  } as never)

test('regression: a booking stored under a Firebase user id is read and covers that person', () => {
  // Web books an Operatives-list user with no operative record under users/{uid}. iOS used to
  // require a UUID operativeId and dropped the document, so the person showed as unbooked.
  const parsed = parseBookingDocument('B-UID', {
    operativeId: CHAIN_USER.id,
    projectId: '11111111-2222-3333-4444-555555555555',
    date: { seconds: Date.UTC(2026, 9, 27, 0, 0) / 1000, nanoseconds: 0 },
    timeSlot: 'FULL DAY',
    status: 'confirmed',
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.booking.operativeId, CHAIN_USER.id)
  assert.equal(parsed.booking.operativeIdIsUuid, false)
  assert.equal(parsed.booking.status, 'Confirmed')
  assert.deepEqual(chainDay([{ personId: parsed.booking.operativeId, dayKey: '2026-10-27', kind: 'operative', timeSlot: 'FULL DAY' }]), [])
  // Without the booking the same person is a gap: the coverage answer comes from the data, not the screen.
  assert.equal(chainDay([]).length, 1)
})

test('coverage is the union across a project and a small works job; back-to-back is full', () => {
  const am = { personId: CHAIN_USER.id, dayKey: '2026-10-27', kind: 'operative', timeSlot: 'CUSTOM_HOURS', workStart: '07:30', workEnd: '12:00' }
  const pm = { ...am, workStart: '12:00', workEnd: '16:00' }
  assert.equal(chainDay([am])[0]?.missingHours, 3.5)
  assert.deepEqual(chainDay([am, pm]), [])
  // Overlap does not double count and still covers.
  assert.deepEqual(chainDay([am, { ...pm, workStart: '11:00' }]), [])
  // Named AM + PM is the whole day.
  assert.deepEqual(
    chainDay([
      { personId: CHAIN_USER.id, dayKey: '2026-10-27', kind: 'operative', timeSlot: 'AM' },
      { personId: CHAIN_USER.id, dayKey: '2026-10-27', kind: 'operative', timeSlot: 'PM' },
    ]),
    []
  )
  // Custom hours starting before and ending after company hours still cover it.
  assert.deepEqual(chainDay([{ ...am, workStart: '06:00', workEnd: '18:00' }]), [])
  // A manager-schedule booking under the same id covers too.
  assert.deepEqual(chainDay([{ ...am, kind: 'manager', timeSlot: 'FULL DAY' }]), [])
})

test('back-to-back bookings are not a clash; overlapping ones are', () => {
  assert.equal(intervalsOverlap({ start: 450, end: 720 }, { start: 720, end: 960 }), false)
  assert.equal(intervalsOverlap({ start: 450, end: 720 }, { start: 660, end: 960 }), true)
})

test('invoicing periods hold at the 15th, the 16th, the 31st, and a leap-year February', () => {
  const run = (iso: string) =>
    invoicingPeriod({
      referenceIso: iso,
      timeZone: 'Europe/London',
      paymentRunMode: 'date_ranges',
      ranges: [
        { startDay: 1, endDay: 15 },
        { startDay: 16, endDay: 31 },
      ],
    })
  assert.deepEqual([run('2026-10-15T12:00:00Z').startDayKey, run('2026-10-15T12:00:00Z').endDayKey], ['2026-10-01', '2026-10-15'])
  assert.deepEqual([run('2026-10-16T12:00:00Z').startDayKey, run('2026-10-16T12:00:00Z').endDayKey], ['2026-10-16', '2026-10-31'])
  assert.deepEqual([run('2026-10-31T12:00:00Z').startDayKey, run('2026-10-31T12:00:00Z').endDayKey], ['2026-10-16', '2026-10-31'])
  assert.deepEqual([run('2026-11-20T12:00:00Z').startDayKey, run('2026-11-20T12:00:00Z').endDayKey], ['2026-11-16', '2026-11-30'])
  assert.deepEqual([run('2028-02-20T12:00:00Z').startDayKey, run('2028-02-20T12:00:00Z').endDayKey], ['2028-02-16', '2028-02-29'])
  // 23:30 UTC on 15 October is 00:30 on the 16th in London: the organisation day decides.
  assert.equal(run('2026-10-15T23:30:00Z').startDayKey, '2026-10-16')
})

test('the full-week window turns over at Sunday midnight in London, across the clock change', () => {
  const week = (iso: string) =>
    coverageWindow({ referenceIso: iso, timeZone: 'Europe/London', clashLookaheadMode: 'endOfWorkingWeek', paymentRunMode: 'date_ranges', ranges: [] })
  // Sunday 25 October 2026 is the last Sunday of October (BST ends).
  assert.deepEqual(week('2026-10-25T22:30:00Z'), { startDayKey: '2026-10-19', endDayKey: '2026-10-23' })
  assert.deepEqual(week('2026-10-26T00:30:00Z'), { startDayKey: '2026-10-26', endDayKey: '2026-10-30' })
  // Sunday 29 March 2026 (BST starts): 23:30 UTC is already Monday in London.
  assert.deepEqual(week('2026-03-29T23:30:00Z'), { startDayKey: '2026-03-30', endDayKey: '2026-04-03' })
  const days = coverageWindow({ referenceIso: '2026-10-24T12:00:00Z', timeZone: 'Europe/London', clashLookaheadMode: 'numberOfDays', clashLookaheadDays: 3, paymentRunMode: 'date_ranges', ranges: [] })
  assert.deepEqual(days, { startDayKey: '2026-10-24', endDayKey: '2026-10-26' })
})

test('weekend days are only checked for unbooked labour when the toggle is on; exclusion silences only unbooked', () => {
  const base = {
    timeZone: 'Europe/London',
    startDayKey: '2026-10-30',
    endDayKey: '2026-11-02',
    excludedUserIds: [] as string[],
    standardPaidHours: 8,
    standardDayStart: '07:30',
    standardDayEnd: '16:00',
    breakWindowStart: '12:00',
    breakWindowEnd: '12:30',
    people: [CHAIN_USER],
    operatives: [],
    bookings: [],
    holidays: [],
  }
  const off = unbookedLabourRows({ ...base, includeWeekends: false } as never).map((row) => row.dayKey)
  assert.deepEqual(off, ['2026-10-30', '2026-11-02'])
  const on = unbookedLabourRows({ ...base, includeWeekends: true, saturdayCountsAsHours: 8, sundayCountsAsHours: 8 } as never).map((row) => row.dayKey)
  assert.deepEqual(on, ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  assert.deepEqual(unbookedLabourRows({ ...base, includeWeekends: false, excludedUserIds: [CHAIN_USER.id] } as never), [])
  // Included again: the rows come back.
  assert.equal(unbookedLabourRows({ ...base, includeWeekends: false, excludedUserIds: [] } as never).length, 2)
})

test('a PAYE pay line shows PAYE, never £0, and adds nothing to the pay total', () => {
  assert.deepEqual(reportPayCell({ isPaye: true, pay: 0 }), { pay: null, label: PAYE_PAY_CELL_LABEL, countsTowardPayTotal: false })
  assert.deepEqual(reportPayCell({ isPaye: true, pay: 120 }), { pay: null, label: 'PAYE', countsTowardPayTotal: false })
  assert.deepEqual(reportPayCell({ employmentType: 'paye', pay: 50 }).label, 'PAYE')
  assert.deepEqual(reportPayCell({ isPaye: false, pay: 150.004 }), { pay: 150, label: null, countsTowardPayTotal: true })
  // No rate set: no figure and nothing counted, but not labelled PAYE either.
  assert.deepEqual(reportPayCell({ isPaye: false, pay: null }), { pay: null, label: null, countsTowardPayTotal: false })
  assert.equal(reportPayTotal([{ isPaye: false, pay: 150 }, { isPaye: true, pay: 120 }, { pay: 75.5 }]), 225.5)
  assert.deepEqual(reportPersonPayCell([{ isPaye: true, pay: 0 }, { isPaye: true, pay: 0 }]), { pay: null, label: 'PAYE', countsTowardPayTotal: false })
  // Changed type inside the period: only the self-employed days total.
  assert.deepEqual(reportPersonPayCell([{ isPaye: true, pay: 0 }, { isPaye: false, pay: 200 }]), { pay: 200, label: null, countsTowardPayTotal: true })
  // Employment type on the day decides, so a future change keeps the old type until that day.
  const user = { employmentType: 'paye', employmentTypeTransitionFrom: 'self_employed', employmentTypeEffectiveAt: '2026-10-28T00:00:00Z' }
  assert.equal(employmentTypeOnDay(user, new Date('2026-10-27T12:00:00Z'), 'Europe/London'), 'self_employed')
  assert.equal(employmentTypeOnDay(user, new Date('2026-10-28T12:00:00Z'), 'Europe/London'), 'paye')
})

test('the iOS JavaScript bundle gives the same booking-chain and PAYE answers', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const bundle = sandbox.ProjectPlannerCanonical!
  const json = (value: unknown) => JSON.parse(JSON.stringify(value))
  const doc = { operativeId: CHAIN_USER.id, projectId: 'P', date: 1793059200000, status: 'canceled' }
  assert.deepEqual(json(bundle.parseBookingDocument('B', doc, { timeZone: 'Europe/London' })), json(parseBookingDocument('B', doc, { timeZone: 'Europe/London' })))
  assert.deepEqual(json(bundle.reportPayCell({ isPaye: true, pay: 0 })), reportPayCell({ isPaye: true, pay: 0 }))
  assert.equal(bundle.reportPayTotal([{ isPaye: false, pay: 150 }, { isPaye: true, pay: 120 }]), 150)
  assert.deepEqual(json(bundle.reportPersonPayCell([{ isPaye: true, pay: 0 }])), reportPersonPayCell([{ isPaye: true, pay: 0 }]))
})

// ---------------------------------------------------------------------------
// Paid hours: one calculation for Daily Overview, the weekly report, timesheets and invoicing.
// Values are the iOS PayrollHoursEngine answers for the same bookings.

const WED = '2026-10-21'
const SAT = '2026-10-24'
const SUN = '2026-10-25'
const hoursOn = (dayKey: string, booking: Record<string, unknown>, policy = parsePayrollPolicy(undefined)) =>
  payrollHoursResult({ dayKey, booking, policy, timeZone: 'Europe/London' })

test('hours worked are never multiplied: Daily Overview and My Schedule show them, pay screens show paid hours', () => {
  const late = hoursOn(WED, { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00' })
  assert.deepEqual([late.totalPaidHours, late.workedHours], [11, 10])
  const allHours = parsePayrollPolicy({ saturday: { allHoursAtMultiplierMode: true, allHoursMultiplier: 1.5 } })
  const saturday = hoursOn(SAT, { timeSlot: 'CUSTOM_HOURS', workStartTime: '08:00', workEndTime: '16:00' }, allHours)
  assert.deepEqual([saturday.totalPaidHours, saturday.workedHours], [12, 8])
  // A defined weekend window credits 8 standard hours; the time worked is the clock time.
  const window = hoursOn(SAT, { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '16:00' })
  assert.deepEqual([window.standardHours, window.workedHours], [8, 8.5])
  const am = hoursOn(WED, { timeSlot: 'AM' })
  assert.equal(am.workedHours, am.totalPaidHours)
})

test('weekday paid hours: standard window less the break, outside hours at the multiplier', () => {
  const full = hoursOn(WED, { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '16:00' })
  assert.deepEqual([full.totalPaidHours, full.standardHours, full.outsideHours], [8, 8, 0])
  const late = hoursOn(WED, { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00' })
  assert.deepEqual([late.totalPaidHours, late.standardHours, late.outsideHours, late.outsideMultiplier], [11, 8, 2, 1.5])
  // The 21/10 web Daily Overview booking: 06:00–17:45 custom hours.
  const early = hoursOn(WED, { timeSlot: 'CUSTOM_HOURS', workStartTime: '06:00', workEndTime: '17:45' })
  assert.deepEqual([early.standardHours, early.outsideHours], [8, 3.25])
  assert.equal(early.totalPaidHours, 8 + 3.25 * 1.5)
  const noBreak = hoursOn(WED, { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '16:00', isBreakRemoved: true })
  assert.equal(noBreak.totalPaidHours, 8.5)
  const override = hoursOn(WED, { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00', otMultiplierOverride: 2 })
  assert.equal(override.totalPaidHours, 12)
})

test('named slots: AM and PM pay half the standard day, FULL DAY the whole day; custom weekday hours pay the clock (1.44.0)', () => {
  assert.equal(hoursOn(WED, { timeSlot: 'AM' }).totalPaidHours, 4)
  assert.equal(hoursOn(WED, { timeSlot: 'PM' }).totalPaidHours, 4)
  assert.equal(hoursOn(WED, { timeSlot: 'FULL DAY' }).totalPaidHours, 8)
  assert.equal(hoursOn(WED, { timeSlot: 'FULL_DAY' }).totalPaidHours, 8)
  // 1.44.0 (owner decision 14 Nov, question A option 1): no half-day snap for any policy — 07:40–12:00 is 4h20m.
  assert.equal(hoursOn(WED, { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:40', workEndTime: '12:00' }).totalPaidHours, 13 / 3)
  assert.equal(hoursOn(WED, { timeSlot: 'AM' }).totalPaidHours + hoursOn(WED, { timeSlot: 'PM' }).totalPaidHours, 8)
})

test('weekend paid hours follow that day\'s rule; overnight runs past midnight', () => {
  const policy = {
    ...DEFAULT_PAYROLL_POLICY,
    saturday: { allHoursAtMultiplierMode: false, allHoursMultiplier: 2, definedWindowStart: '07:30', definedWindowEnd: '13:00', countsAsStandardHours: 8, outsideWindowMultiplier: 2 },
    sunday: { allHoursAtMultiplierMode: true, allHoursMultiplier: 2, sameAsSaturday: false },
  }
  const sat = hoursOn(SAT, { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '13:00' }, policy)
  assert.deepEqual([sat.totalPaidHours, sat.standardHours], [8, 8])
  const satLate = hoursOn(SAT, { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '15:00' }, policy)
  assert.deepEqual([satLate.standardHours, satLate.outsideHours, satLate.totalPaidHours], [8, 2, 12])
  const satPart = hoursOn(SAT, { timeSlot: 'CUSTOM_HOURS', workStartTime: '10:15', workEndTime: '13:00' }, policy)
  assert.equal(satPart.standardHours, 4)
  const sun = hoursOn(SUN, { timeSlot: 'CUSTOM_HOURS', workStartTime: '08:00', workEndTime: '12:00' }, policy)
  assert.deepEqual([sun.outsideHours, sun.totalPaidHours, sun.standardHours], [4, 8, 0])
  // 1.13.0 (Q5): an overnight booking is paid at its start day's rules — 22:00–02:00 on a Wednesday is 4 hours
  // outside the standard day, at the weekday multiplier.
  const night = hoursOn(WED, { timeSlot: 'CUSTOM_HOURS', workStartTime: '22:00', workEndTime: '02:00' })
  assert.deepEqual([night.workedHours, night.outsideHours, night.totalPaidHours], [4, 4, 6])
})

test('weekly-report day units: weighted hours over the standard day, capped at 1.5; subcontractors 1 or 0.5', () => {
  assert.equal(reportDayValue({ totalPaidHours: 4, standardPaidHours: 8 }), 0.5)
  assert.equal(reportDayValue({ totalPaidHours: 8, standardPaidHours: 8 }), 1)
  assert.equal(reportDayValue({ totalPaidHours: 11, standardPaidHours: 8 }), 1.375)
  assert.equal(reportDayValue({ totalPaidHours: 20, standardPaidHours: 8 }), 1.5)
  assert.equal(subcontractorDayValue('FULL DAY'), 1)
  assert.equal(subcontractorDayValue('AM'), 0.5)
  assert.equal(subcontractorDayValue('CUSTOM_HOURS'), 0.5)
})

test('the iOS JavaScript bundle returns the same paid hours', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const bundle = sandbox.ProjectPlannerCanonical!
  const policy = JSON.parse(JSON.stringify(bundle.parsePayrollPolicy({ standardDayStart: '07:30' })))
  const input = { dayKey: WED, booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: '06:00', workEndTime: '17:45' }, policy }
  assert.deepEqual(JSON.parse(JSON.stringify(bundle.payrollHoursResult(input))), JSON.parse(JSON.stringify(payrollHoursResult(input))))
  assert.equal(bundle.bookingOccupiesDay('Completed'), true)
  assert.equal(bundle.bookingOccupiesDay('Cancelled'), false)
})

test('clash groups: overlap chains join, back-to-back does not clash, order is stable', () => {
  const am = { start: 450, end: 720 }
  const pm = { start: 720, end: 960 }
  const middle = { start: 660, end: 780 }
  assert.deepEqual(overlappingIntervalGroups([am, pm]), [])
  assert.deepEqual(overlappingIntervalGroups([am, pm, middle]), [[0, 1, 2]])
  assert.deepEqual(overlappingIntervalGroups([pm, null, { start: 900, end: 1000 }, am, { start: 500, end: 600 }]), [[0, 2], [3, 4]])
})

// --- Booking person: one answer to "whose booking is this" for every screen, web and iOS ---

import { bookingIdsForAccount, bookingIdsForPerson, bookingPersonKey, resolveBookingPerson } from './bookingPerson.ts'
import { normalizeManagerBookingTimeSlot, parseManagerSiteBookingDocument } from './bookings.ts'

const BP_CATALOGUE_OLD = 'F05FE02E-0F7C-4F44-A3A8-FCF6F43D2995'
const BP_PLACEHOLDER = '7A27FFF5-65FD-4563-8A0D-D074647C2739'
const BP_AUTH = 'rehiredOperativeUid0001'

const bpRehired = {
  id: BP_AUTH,
  email: 'Rehired@Test.com',
  formerIds: [BP_PLACEHOLDER],
  aliasIds: ['oldSameEmailUid0001'],
}
const bpInput = {
  accounts: [bpRehired, { id: 'adminUid0001', email: 'admin@test.com' }],
  operatives: [
    { id: BP_CATALOGUE_OLD, email: 'rehired@test.com' },
    { id: 'DE1D3201-7929-4843-B5C8-883ED49FFC43', email: '' },
  ],
}

test('a deleted then re-added person owns bookings under every id they have had', () => {
  const ids = bookingIdsForAccount(bpRehired, bpInput.operatives)
  assert.deepEqual(ids, [BP_AUTH, BP_PLACEHOLDER, 'oldSameEmailUid0001', BP_CATALOGUE_OLD])
  for (const stored of [BP_AUTH, BP_PLACEHOLDER, 'oldsameemailuid0001', BP_CATALOGUE_OLD.toLowerCase()]) {
    const person = resolveBookingPerson(stored, bpInput)
    assert.equal(person.accountId, BP_AUTH, stored)
    assert.equal(person.operativeId, BP_CATALOGUE_OLD, stored)
    assert.equal(person.email, 'rehired@test.com', stored)
  }
})

test('an anonymised catalogue row with no email never names a live account', () => {
  const person = resolveBookingPerson('DE1D3201-7929-4843-B5C8-883ED49FFC43', bpInput)
  assert.equal(person.accountId, null)
  assert.equal(person.operativeId, 'DE1D3201-7929-4843-B5C8-883ED49FFC43')
  assert.equal(person.email, null)
})

test('an unknown or blank operative id resolves to nobody', () => {
  assert.deepEqual(resolveBookingPerson('nobody', bpInput), { accountId: null, operativeId: null, email: null })
  assert.deepEqual(resolveBookingPerson('  ', bpInput), { accountId: null, operativeId: null, email: null })
})

test('a user-only account with no catalogue row still owns its own bookings', () => {
  const lone = { id: 'loneUid0001', email: 'lone@test.com' }
  assert.deepEqual(bookingIdsForAccount(lone, []), ['loneUid0001'])
  assert.deepEqual(resolveBookingPerson('loneUid0001', { accounts: [lone], operatives: [] }), {
    accountId: 'loneUid0001',
    operativeId: null,
    email: 'lone@test.com',
  })
})

test('manager site bookings read the same on web and iOS', () => {
  const date = { seconds: Date.UTC(2026, 9, 21) / 1000 - 3600, nanoseconds: 0 }
  const ok = parseManagerSiteBookingDocument('MGR-1', { userId: 'u1', date, timeSlot: 'FULL DAY' })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.booking.timeSlot, 'FULL_DAY')
    assert.equal(ok.booking.locationType, 'project')
    assert.ok(ok.repairs.includes('location_type_missing'))
    assert.ok(ok.repairs.includes('slot_alias'))
  }
  const text = parseManagerSiteBookingDocument('MGR-2', { userId: 'u1', date: '2026-10-21T00:00:00Z', timeSlot: 'AM', locationType: 'office' })
  assert.equal(text.ok, true)
  if (text.ok) assert.ok(text.repairs.includes('date_not_timestamp'))
  assert.deepEqual(parseManagerSiteBookingDocument('MGR-3', { date, timeSlot: 'AM' }), { ok: false, errors: ['missing_user_id'] })
  assert.equal(normalizeManagerBookingTimeSlot('custom hours'), 'CUSTOM_HOURS')
  assert.equal(normalizeManagerBookingTimeSlot('Evening'), null)
})

test('the iOS bundle exposes the booking person and manager booking rules', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const bundle = sandbox.ProjectPlannerCanonical
  assert.ok(bundle)
  for (const name of ['bookingIdsForAccount', 'bookingIdsForPerson', 'bookingPersonKey', 'resolveBookingPerson', 'parseManagerSiteBookingDocument', 'parseBookingDocument']) {
    assert.equal(typeof bundle[name], 'function', name)
  }
})

test('every id a re-added person has had groups under one person key', () => {
  const key = bookingPersonKey(BP_AUTH, bpInput)
  assert.equal(key, `account:${BP_AUTH.toLowerCase()}`)
  for (const stored of [BP_PLACEHOLDER, BP_CATALOGUE_OLD, BP_CATALOGUE_OLD.toLowerCase(), 'oldSameEmailUid0001']) {
    assert.equal(bookingPersonKey(stored, bpInput), key, stored)
  }
  assert.equal(bookingPersonKey('DE1D3201-7929-4843-B5C8-883ED49FFC43', bpInput), 'operative:de1d3201-7929-4843-b5c8-883ed49ffc43')
  assert.equal(bookingPersonKey('nobodyUid', bpInput), 'id:nobodyuid')
})

test('organisation setup placeholder bookings are not bookings on either app', () => {
  const date = { seconds: Date.UTC(2025, 10, 3) / 1000, nanoseconds: 0 }
  assert.deepEqual(
    parseBookingDocument('INITIAL-PLACEHOLDER', { operativeId: 'x', projectId: 'y', date, timeSlot: 'morning', status: 'tentative' }),
    { ok: false, errors: ['legacy_placeholder'] }
  )
  assert.deepEqual(
    parseManagerSiteBookingDocument('initial-placeholder', { userId: 'u', date, timeSlot: 'AM' }),
    { ok: false, errors: ['legacy_placeholder'] }
  )
})

test("picking any of a re-added person's ids finds all of them", () => {
  const all = [BP_CATALOGUE_OLD, BP_AUTH, BP_PLACEHOLDER, 'oldSameEmailUid0001']
  for (const start of all) assert.deepEqual(new Set(bookingIdsForPerson(start, bpInput)), new Set(all), start)
  assert.deepEqual(bookingIdsForPerson('nobodyUid', bpInput), ['nobodyUid'])
  assert.deepEqual(bookingIdsForPerson('', bpInput), [])
})


import { canOpenUserTimesheets, userTimesheetSubjects, type UserTimesheetMember } from './userTimesheetAccess.ts'
import { MATERIAL_WHATSAPP_ITEM_LIMIT, materialQuantityLabel, materialWhatsAppRows } from './materialWhatsApp.ts'
import { materialOrderRecipients } from './materialOrderRecipients.ts'
import { notificationDeliversDevicePush as deliversPush, notificationPreferenceKeyForType } from './notificationPreferences.ts'

const UT_ADMIN = { isSuperAdmin: false, isAdmin: true, isManager: false, isOperativeMode: false }
const UT_MANAGER = { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }
const UT_OPERATIVE = { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: true }

function utMember(id: string, extra: Partial<UserTimesheetMember> = {}): UserTimesheetMember {
  return { id, email: `${id}@test.com`, isActive: true, role: UT_OPERATIVE, ...extra }
}

test('User Timesheets: a manager sees the active people they line-manage, under any of their ids', () => {
  const viewer = { id: 'manager-1', formerIds: ['manager-old'], aliasIds: ['manager-alias'], role: UT_MANAGER }
  const members = [
    utMember('op-1', { assignedManagerUserIds: ['manager-1'] }),
    utMember('op-gone', { isActive: false, assignedManagerUserIds: ['manager-1'] }),
    utMember('op-other', { assignedManagerUserIds: ['manager-2'] }),
    utMember('op-former', { assignedManagerUserIds: ['MANAGER-OLD'] }),
    utMember('op-legacy', { assignedManagerUserId: 'manager-alias' }),
    utMember('op-none', { assignedManagerUserIds: ['manager-1'], hasNoLineManager: true }),
    // The reported iOS fault: a report not in operative mode.
    utMember('staff-1', { role: UT_MANAGER, assignedManagerUserIds: ['manager-1'] }),
  ]
  assert.deepEqual(
    userTimesheetSubjects({ viewer, members }).map((row) => row.userId),
    ['op-1', 'op-former', 'op-legacy', 'staff-1']
  )
  assert.equal(canOpenUserTimesheets({ viewer, members }), true)
})

test('User Timesheets: the legacy single line manager counts only when the list is empty', () => {
  const viewer = { id: 'm1', role: UT_MANAGER }
  const members = [utMember('op-1', { assignedManagerUserIds: ['m2'], assignedManagerUserId: 'm1' })]
  assert.deepEqual(userTimesheetSubjects({ viewer, members }), [])
})

test('User Timesheets: a same-email document named by the manager brings in the other document', () => {
  const viewer = { id: 'mgr', role: UT_MANAGER }
  const members = [
    utMember('invite', { email: 'ada@test.com', assignedManagerUserId: 'mgr' }),
    utMember('auth', { email: 'ADA@test.com ' }),
    utMember('stranger', { email: '' }),
  ]
  assert.deepEqual(
    userTimesheetSubjects({ viewer, members }).map((row) => row.userId),
    ['invite', 'auth']
  )
})

test('User Timesheets: admins see every active timesheet user and always have the screen', () => {
  const viewer = { id: 'admin-1', role: UT_ADMIN }
  const members = [
    utMember('op-1'),
    utMember('mgr-1', { role: UT_MANAGER }),
    utMember('op-gone', { isActive: false }),
    utMember('no-role', { role: { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: false } }),
    { id: 'legacy-active', role: UT_OPERATIVE },
  ]
  assert.deepEqual(
    userTimesheetSubjects({ viewer, members }).map((row) => row.userId),
    ['op-1', 'mgr-1', 'legacy-active']
  )
  assert.equal(canOpenUserTimesheets({ viewer, members: [] }), true)
  assert.equal(canOpenUserTimesheets({ viewer: { id: 'sa', role: { ...UT_MANAGER, isSuperAdmin: true } }, members: [] }), true)
})

test('User Timesheets: operatives never get the screen; a manager keeps it while the roster loads', () => {
  const operative = { id: 'op-1', role: UT_OPERATIVE }
  assert.deepEqual(userTimesheetSubjects({ viewer: operative, members: [utMember('op-2', { assignedManagerUserId: 'op-1' })] }), [])
  assert.equal(canOpenUserTimesheets({ viewer: operative, members: [], rosterLoading: true }), false)
  const manager = { id: 'm1', role: UT_MANAGER }
  assert.equal(canOpenUserTimesheets({ viewer: manager, members: [] }), false)
  assert.equal(canOpenUserTimesheets({ viewer: manager, members: [], rosterLoading: true }), true)
  assert.equal(canOpenUserTimesheets({ viewer: { id: '', role: UT_ADMIN }, members: [] }), false)
})

const WA_BASE = {
  requestType: 'order',
  organisationName: 'TEST-Org',
  requestingUserName: 'TEST-User',
  jobNumber: 'J-1',
  projectName: 'TEST-Kitchen refit',
  projectAddress: '1 Test Street',
  deliveryAt: '2026-10-28T08:00:00.000Z',
  countryCode: 'GB',
  materials: [{ material: 'Pipe', quantity: 2, unit: 'Length', brand: null, productCode: 'P1', notes: null, lengthDisplay: '3 m' }],
  recipients: [{ id: 'c1', name: 'Sam Smith', wholesalerName: 'TEST-Supplies', phone: '07700 900123' }],
}

test('materialWhatsAppRows writes the order message and the wa.me number per recipient', () => {
  const [row] = materialWhatsAppRows(WA_BASE)
  assert.equal(row.recipientId, 'c1')
  assert.equal(row.ok, true)
  assert.equal(row.digits, '447700900123')
  assert.equal(row.reason, null)
  assert.equal(
    row.message,
    [
      'Hi Sam Smith,',
      '',
      'Please see the following material order from TEST-Org.',
      '',
      'MATERIAL ORDER',
      'Job: J-1',
      'Project: TEST-Kitchen refit',
      'Project address:',
      '1 Test Street',
      'Supplier: TEST-Supplies',
      'Required delivery: Wednesday 28 October at 08:00',
      '',
      'ORDER DETAILS',
      '• 2 × Pipe (Lengths) — Code P1 · 3 m',
      '',
      'Please can you confirm availability and the expected delivery date?',
      '',
      'Thanks,',
      'TEST-User',
      'TEST-Org',
    ].join('\n')
  )
  assert.equal(row.url, `https://wa.me/447700900123?text=${encodeURIComponent(row.message)}`)
})

test('materialWhatsAppRows: a quote never names a delivery day; numbers follow the organisation country', () => {
  const rows = materialWhatsAppRows({
    ...WA_BASE,
    requestType: 'quote',
    countryCode: 'IE',
    recipients: [
      { id: 'ie', name: '', phone: '087 123 4567' },
      { id: 'intl', name: 'Al', phone: '+1 (415) 555-2671' },
      { id: 'zeros', name: 'Zed', phone: '0044 7700 900123' },
      { id: 'none', name: 'No', phone: '' },
      { id: 'short', name: 'Sh', phone: '+12 34' },
    ],
  })
  assert.ok(rows[0].message.startsWith('Hi there,'))
  assert.ok(rows[0].message.includes('QUOTE REQUEST'))
  assert.ok(!rows[0].message.includes('Required delivery'))
  assert.equal(rows[0].digits, '353871234567')
  assert.equal(rows[1].digits, '14155552671')
  assert.equal(rows[2].digits, '447700900123')
  assert.deepEqual([rows[3].ok, rows[3].reason, rows[3].url], [false, 'No mobile number is saved for this contact.', null])
  assert.equal(rows[4].reason, 'This number is too short to open WhatsApp.')
})

test('materialWhatsAppRows refuses a UK landline and summarises a long list', () => {
  const materials = Array.from({ length: MATERIAL_WHATSAPP_ITEM_LIMIT + 2 }, (_, index) => ({
    material: `Item ${index}`,
    quantity: 1,
    unit: 'Number',
  }))
  const [row] = materialWhatsAppRows({
    ...WA_BASE,
    deliveryAt: null,
    materials,
    recipients: [{ id: 'c1', name: 'Sam', phone: '020 7946 0958' }],
  })
  assert.equal(row.ok, false)
  assert.equal(row.reason, 'This looks like a landline. WhatsApp needs a mobile number.')
  assert.ok(!row.message.includes('Required delivery'))
  assert.ok(row.message.includes('• 1 × Item 0\n'))
  assert.ok(row.message.includes('• …and 2 more items. We can send the full list by email.'))
  assert.equal(materialQuantityLabel('box', 2), 'Boxes')
  assert.equal(materialQuantityLabel('', 1), 'Number')
})

test('a new material line is the pushed material_order_placed type with its own toggle', () => {
  assert.equal(deliversPush('material_order_placed'), true)
  assert.equal(notificationPreferenceKeyForType('material_order_placed'), 'materialOrderPlaced')
  assert.equal(deliversPush('material_added'), false)
})

test("materialOrderRecipients notifies the job's active managers, never the adder or other admins", () => {
  const rows = materialOrderRecipients({
    jobManagerIds: ['MGR-ROW-1', 'acct-direct'],
    managers: [
      { id: 'mgr-row-1', email: 'Pat@Test.com' },
      { id: 'mgr-row-2', email: 'other@test.com' },
    ],
    accounts: [
      { id: 'admin-1', email: 'admin@test.com', role: UT_ADMIN },
      { id: 'pat', email: 'pat@test.com', role: UT_MANAGER },
      { id: 'acct', formerIds: ['acct-direct'], role: UT_MANAGER },
      { id: 'other', email: 'other@test.com', role: UT_MANAGER },
      { id: 'gone', email: 'pat@test.com', isActive: false, role: UT_MANAGER },
      { id: 'op', email: 'pat@test.com', role: UT_OPERATIVE },
    ],
    adderIds: [],
  })
  assert.deepEqual(rows.map((row) => row.userId), ['pat', 'acct'])
  const withoutAdder = materialOrderRecipients({
    jobManagerIds: ['mgr-row-1'],
    managers: [{ id: 'mgr-row-1', email: 'pat@test.com' }],
    accounts: [{ id: 'pat', email: 'pat@test.com', aliasIds: ['pat-old'], role: UT_MANAGER }],
    adderIds: ['pat-old'],
  })
  assert.deepEqual(withoutAdder, [])
  assert.deepEqual(materialOrderRecipients({ jobManagerIds: [], managers: [], accounts: [], adderIds: null }), [])
})

test('the iOS bundle answers userTimesheetSubjects, materialWhatsAppRows and materialOrderRecipients like this module', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (input: unknown) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const sandboxBundle = sandbox.ProjectPlannerCanonical
  assert.ok(sandboxBundle)
  // Results cross the script boundary as JSON, as iOS reads them.
  const bundle = (name: string, input: unknown) => JSON.parse(JSON.stringify(sandboxBundle[name](input)))
  // iOS sends JSON: nulls, Bool isActive, capitalised ids.
  const timesheetInput = JSON.parse(
    JSON.stringify({
      viewer: { id: 'manager-1', formerIds: ['manager-old'], aliasIds: [], role: UT_MANAGER },
      members: [
        { ...utMember('op-1'), assignedManagerUserIds: ['manager-old'], assignedManagerUserId: null, hasNoLineManager: false },
        { ...utMember('op-2'), assignedManagerUserIds: [], assignedManagerUserId: null, hasNoLineManager: false },
      ],
    })
  )
  assert.deepEqual(bundle('userTimesheetSubjects', timesheetInput), userTimesheetSubjects(timesheetInput))
  assert.deepEqual(bundle('userTimesheetSubjects', timesheetInput), [{ userId: 'op-1' }])
  assert.equal(bundle('canOpenUserTimesheets', timesheetInput), true)
  const whatsAppInput = JSON.parse(JSON.stringify(WA_BASE))
  assert.deepEqual(bundle('materialWhatsAppRows', whatsAppInput), materialWhatsAppRows(whatsAppInput))
  const recipientsInput = {
    jobManagerIds: ['row'],
    managers: [{ id: 'row', email: 'pat@test.com' }],
    accounts: [{ id: 'pat', email: 'pat@test.com', isActive: true, formerIds: [], aliasIds: [], role: UT_MANAGER }],
    adderIds: ['op-1'],
  }
  assert.deepEqual(bundle('materialOrderRecipients', recipientsInput), [{ userId: 'pat' }])
})

import { canViewMaterialOrderHistory } from './staffAccess.ts'

test('job quote and order history is every admin and manager, never operative mode, and not the Wholesalers toggle', () => {
  assert.equal(canViewMaterialOrderHistory(UT_ADMIN), true)
  assert.equal(canViewMaterialOrderHistory({ ...UT_OPERATIVE, isOperativeMode: false, isSuperAdmin: true }), true)
  // The role input carries no wholesalersOrderHistory flag: a manager without that toggle still sees it.
  assert.equal(canViewMaterialOrderHistory(UT_MANAGER), true)
  assert.equal(canViewMaterialOrderHistory(UT_OPERATIVE), false)
  assert.equal(canViewMaterialOrderHistory({ ...UT_ADMIN, isOperativeMode: true }), false)
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (input: unknown) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  assert.equal(sandbox.ProjectPlannerCanonical?.canViewMaterialOrderHistory(UT_MANAGER), true)
  assert.equal(sandbox.ProjectPlannerCanonical?.canViewMaterialOrderHistory(UT_OPERATIVE), false)
})

import { DEFAULT_SATURDAY_PAYROLL, DEFAULT_SUNDAY_PAYROLL } from './organizationSettings.ts'
import { isOpenBookingStatus } from './bookings.ts'

test('a weekend day the company never saved uses the iOS default: Saturday 07:30–13:00 then 2×, Sunday every hour 2×', () => {
  for (const policy of [parsePayrollPolicy(undefined), parsePayrollPolicy({ standardDayStart: '07:30' }), DEFAULT_PAYROLL_POLICY]) {
    assert.deepEqual(
      [policy.saturday.definedWindowEnd, policy.saturday.countsAsStandardHours, policy.saturday.outsideWindowMultiplier],
      ['13:00', 8, 2]
    )
    assert.deepEqual([policy.sunday.allHoursAtMultiplierMode, policy.sunday.allHoursMultiplier, policy.sunday.sameAsSaturday], [true, 2, false])
    const sunday = hoursOn(SUN, { timeSlot: 'CUSTOM_HOURS', workStartTime: '08:00', workEndTime: '12:00' }, policy)
    assert.equal(sunday.totalPaidHours, 8)
    const saturday = hoursOn(SAT, { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '15:00' }, policy)
    assert.deepEqual([saturday.standardHours, saturday.outsideHours, saturday.totalPaidHours], [8, 2, 12])
  }
  // A saved day map that leaves a field out reads it like iOS OrgWeekendDayPayrollSettings.fromFirestore.
  const partial = parsePayrollPolicy({ sunday: { allHoursAtMultiplierMode: false } })
  assert.deepEqual([partial.sunday.allHoursAtMultiplierMode, partial.sunday.definedWindowEnd, partial.sunday.outsideWindowMultiplier], [false, '16:00', 1.5])
  // Sunday same as Saturday still follows the saved flag.
  assert.equal(parsePayrollPolicy({ sundaySameAsSaturday: true }).sunday.sameAsSaturday, true)
  assert.deepEqual(DEFAULT_PAYROLL_POLICY.saturday, DEFAULT_SATURDAY_PAYROLL)
  assert.deepEqual(DEFAULT_PAYROLL_POLICY.sunday, DEFAULT_SUNDAY_PAYROLL)
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (input: unknown) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  assert.deepEqual(
    JSON.parse(JSON.stringify(sandbox.ProjectPlannerCanonical?.parsePayrollPolicy(undefined))),
    JSON.parse(JSON.stringify(parsePayrollPolicy(undefined)))
  )
})

test('an open booking is Confirmed or Tentative; Cancelled, Completed and unreadable are not', () => {
  assert.equal(isOpenBookingStatus('Confirmed'), true)
  assert.equal(isOpenBookingStatus('tentative'), true)
  assert.equal(isOpenBookingStatus('Cancelled'), false)
  assert.equal(isOpenBookingStatus('Completed'), false)
  assert.equal(isOpenBookingStatus(undefined), false)
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (input: unknown) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  assert.equal(sandbox.ProjectPlannerCanonical?.isOpenBookingStatus('Tentative'), true)
  assert.equal(sandbox.ProjectPlannerCanonical?.isOpenBookingStatus('Completed'), false)
})

import { rosterAliasIdsFor } from './bookingPerson.ts'

test('roster aliases: the other same-email profile ids folded into an account become its aliasIds', () => {
  const aliases = { kept: 'kept', 'DUP-1': 'KEPT', dup2: 'kept', other: 'other' }
  assert.deepEqual(rosterAliasIdsFor('kept', aliases), ['DUP-1', 'dup2'])
  assert.deepEqual(rosterAliasIdsFor('other', aliases), [])
  assert.deepEqual(rosterAliasIdsFor('kept', undefined), [])
  const accounts = [{ id: 'kept', email: 'tm@x.com', aliasIds: rosterAliasIdsFor('kept', aliases) }]
  assert.equal(resolveBookingPerson('dup-1', { accounts, operatives: [] }).accountId, 'kept')
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.ProjectPlannerCanonical?.rosterAliasIdsFor('kept', aliases))), ['DUP-1', 'dup2'])
})

import { workedHoursSplit } from './payrollHours.ts'

test('worked hours split into inside and outside the standard window, adding up to workedHours', () => {
  const late = hoursOn(WED, { timeSlot: 'CUSTOM_HOURS', workStartTime: '06:00', workEndTime: '17:45' })
  assert.deepEqual(workedHoursSplit(late), { standardWorkedHours: 8, outsideWorkedHours: 3.25 })
  assert.equal(late.workedHours, 11.25)
  const sunday = hoursOn(SUN, { timeSlot: 'CUSTOM_HOURS', workStartTime: '08:00', workEndTime: '12:00' })
  assert.deepEqual(workedHoursSplit(sunday), { standardWorkedHours: 0, outsideWorkedHours: 4 })
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  assert.deepEqual(
    JSON.parse(JSON.stringify(sandbox.ProjectPlannerCanonical?.workedHoursSplit(JSON.parse(JSON.stringify(late))))),
    { standardWorkedHours: 8, outsideWorkedHours: 3.25 }
  )
})

import * as scheduleSources from './scheduleSources.ts'
import * as bundleSurface from './bundleEntry.ts'

type ParityCase = { name: string; function: string; args: unknown[]; expected: unknown }

const SCHEDULE_SOURCE_FUNCTIONS = [
  'rosterPeople',
  'bookingLoadStart',
  'workDocuments',
  'isWorkLiveOn',
  'personDayItems',
  'managerClashGroups',
  'clashPairKey',
  'isClashAccepted',
  'acceptedClashWriteFields',
  'warningResolutionWriteFields',
  'resolvedWarningKeys',
  'isWarningActive',
]

function parityCases(): ParityCase[] {
  const fixture = JSON.parse(readFileSync(new URL('./parity-fixture.json', import.meta.url), 'utf8'))
  assert.equal(fixture.version, 1)
  return fixture.cases as ParityCase[]
}

function plain(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

test('the shared parity fixture passes on this module and covers every schedule-source function', () => {
  const cases = parityCases()
  for (const name of SCHEDULE_SOURCE_FUNCTIONS) {
    assert.ok(cases.some((entry) => entry.function === name), `${name} has a parity case`)
  }
  // Every case names a function the packed script exports (bundleEntry.ts), not only schedule sources.
  const functions = bundleSurface as unknown as Record<string, (...args: unknown[]) => unknown>
  for (const entry of cases) {
    assert.equal(typeof functions[entry.function], 'function', `${entry.function} exists`)
    assert.deepEqual(plain(functions[entry.function](...(plain(entry.args) as unknown[]))), entry.expected, entry.name)
  }
})

test('the shared parity fixture passes through the packed iOS script', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const bundle = sandbox.ProjectPlannerCanonical
  assert.ok(bundle)
  for (const entry of parityCases()) {
    assert.equal(typeof bundle[entry.function], 'function', `${entry.function} is exported from the packed script`)
    assert.deepEqual(plain(bundle[entry.function](...(plain(entry.args) as unknown[]))), entry.expected, entry.name)
  }
})

test('22 Oct: a manager booked twice under their folded sign-in uid is one clash (web missed it)', () => {
  const kept = 'INVITED-ID'
  const signIn = 'signInUid'
  const groups = scheduleSources.managerClashGroups({
    managerIds: [kept],
    people: {
      accounts: [{ id: kept, email: 'm@example.com', aliasIds: [signIn] }],
      operatives: [],
    },
    managerBookings: [{ id: 'MB', userId: signIn, dayKey: '2026-10-22', timeSlot: 'AM' }],
    operativeBookings: [
      { id: 'OB', operativeId: signIn, dayKey: '2026-10-22', timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '19:15', status: 'Confirmed' },
    ],
  })
  assert.equal(groups.length, 1)
  assert.equal(groups[0].userId, kept)
  assert.deepEqual([groups[0].bookingAId, groups[0].bookingBId], ['MB', 'OB'])
  // Without the folded id on the account, neither booking is theirs: the old web result.
  const before = scheduleSources.managerClashGroups({
    managerIds: [kept],
    people: { accounts: [{ id: kept, email: 'm@example.com' }], operatives: [] },
    managerBookings: [{ id: 'MB', userId: signIn, dayKey: '2026-10-22', timeSlot: 'AM' }],
    operativeBookings: [{ id: 'OB', operativeId: signIn, dayKey: '2026-10-22', timeSlot: 'FULL DAY' }],
  })
  assert.equal(before.length, 0)
})

test('rosterPeople keeps a former invite id on the person and two same-email documents on one row', () => {
  const { people, userIdAliases } = scheduleSources.rosterPeople([
    { id: 'stub', email: 'a@example.com', passwordSet: false },
    { id: 'real', email: 'A@example.com', passwordSet: true, formerUserIds: ['old'] },
  ])
  assert.deepEqual(people.map((row) => [row.id, row.sameEmailUserIds, row.formerUserIds]), [['real', ['stub'], ['old']]])
  assert.deepEqual(userIdAliases, { stub: 'real' })
})

test('acceptedClashWriteFields keeps the pair key the web already saved', () => {
  const write = scheduleSources.acceptedClashWriteFields({ bookingAId: 'B', bookingBId: 'A', acceptedByUserId: 'u' })
  assert.equal(write?.documentId, ['B', 'A'].sort().join('|'))
  assert.equal(scheduleSources.isClashAccepted('a', 'b', [write!.documentId]), true)
  assert.equal(scheduleSources.warningResolutionWriteFields({ resolutionKey: 'k', status: 'dismissed', resolvedByUserId: '' }), null)
})

test('isWarningActive: the warning total counts only rows no device approved, removed or accepted', () => {
  const resolvedKeys = scheduleSources.resolvedWarningKeys([
    { id: 'unbooked-2026-10-22-u1', status: 'dismissed' },
    { id: 'ignored', status: 'pending' },
  ])
  const decisions = { resolvedKeys, acceptedClashes: [{ id: 'x', bookingAId: 'b2', bookingBId: 'b1' }] }
  const rows = [
    { resolutionKey: 'unbooked-2026-10-22-u1' },
    { resolutionKey: 'unbooked-2026-10-22-u2' },
    { resolutionKey: 'mgr-clash-m-2026-10-22-0', bookingAId: 'b1', bookingBId: 'b2' },
    { resolutionKey: 'mgr-clash-m-2026-10-23-0', bookingAId: 'b3', bookingBId: 'b4' },
  ]
  assert.deepEqual(
    rows.filter((row) => scheduleSources.isWarningActive(row, decisions)).map((row) => row.resolutionKey),
    ['unbooked-2026-10-22-u2', 'mgr-clash-m-2026-10-23-0']
  )
  assert.equal(scheduleSources.isWarningActive(null, decisions), false)
  assert.equal(scheduleSources.isWarningActive({ resolutionKey: 'k' }, null), true)
})

import * as money from './money.ts'
import { writeMetadataFields } from './writeMetadata.ts'
import { organizationTimeZone } from './organizationTimeZone.ts'

test('organisation currency: saved code wins, then nested, legacy, literal dotted key, country default', () => {
  assert.equal(money.resolveOrganizationCurrency({ currencyCode: 'eur', settings: { currencyCode: 'USD' } }), 'EUR')
  assert.equal(money.resolveOrganizationCurrency({ settings: { currencyCode: 'USD' } }), 'USD')
  assert.equal(money.resolveOrganizationCurrency({ currency: 'AUD' }), 'AUD')
  assert.equal(money.resolveOrganizationCurrency({ 'settings.currencyCode': 'CAD' }), 'CAD')
  assert.equal(money.resolveOrganizationCurrency({ countryCode: 'IE' }), 'EUR')
  assert.equal(money.resolveOrganizationCurrency({ countryCode: 'GB-ENG' }), 'GBP')
  assert.equal(money.resolveOrganizationCurrency({ currencyCode: 'XYZ', countryCode: 'US' }), 'USD')
  assert.equal(money.resolveOrganizationCurrency(null), 'GBP')
  assert.equal(money.CURRENCY_OPTIONS.length, 11)
})

test('organisation currency write is a dotted partial update of every read field', () => {
  assert.deepEqual(money.organizationCurrencyWriteFields(' nzd '), {
    currencyCode: 'NZD',
    currency: 'NZD',
    'settings.currencyCode': 'NZD',
  })
  assert.equal(money.organizationCurrencyWriteFields('XYZ'), null)
})

test('formatMoney uses the organisation symbol with grouping and two decimals', () => {
  assert.equal(money.formatMoney(1234.5, 'GBP'), '£1,234.50')
  assert.equal(money.formatMoney(-5, 'EUR'), '-€5.00')
  assert.equal(money.formatMoney(0, 'CAD'), 'CA$0.00')
  assert.equal(money.formatMoney(99.999, 'SEK'), 'kr 100.00')
  assert.equal(money.formatMoney(-0.001, 'GBP'), '£0.00')
  assert.equal(money.formatMoney(Number.NaN, 'USD'), '$0.00')
  assert.equal(money.formatMoney(1500, 'PLN', { decimals: 0 }), 'zł 1,500')
  assert.equal(money.formatMoney(10, 'nope'), '£10.00')
})

test('write metadata names the editor and the platform', () => {
  assert.deepEqual(writeMetadataFields(' u1 ', 'IOS'), { updatedBy: 'u1', updatedFrom: 'ios' })
  assert.equal(writeMetadataFields('', 'web'), null)
  assert.equal(writeMetadataFields('u1', 'desktop'), null)
})

test('organisation time zone comes from the country, London when unknown', () => {
  assert.equal(organizationTimeZone('GB'), 'Europe/London')
  assert.equal(organizationTimeZone('IE'), 'Europe/Dublin')
  assert.equal(organizationTimeZone(null), 'Europe/London')
  assert.equal(organizationTimeZone('ZZ'), 'Europe/London')
})

test('packed script carries the docs/RULEBOOK.md version and sha256', async () => {
  const { createHash } = await import('node:crypto')
  const rulebook = readFileSync(new URL('../../docs/RULEBOOK.md', import.meta.url))
  const version = /^Version:\s*(\S+)\s*$/m.exec(rulebook.toString('utf8'))?.[1]
  assert.ok(version, 'docs/RULEBOOK.md has a Version line')
  const manifest = JSON.parse(readFileSync(new URL('./dist/canonical-manifest.json', import.meta.url), 'utf8'))
  assert.equal(manifest.rulebookVersion, version)
  assert.equal(manifest.rulebookSha256, createHash('sha256').update(rulebook).digest('hex'))
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: { rulebookStamp: () => { version: string; sha256: string } } } = {}
  createContext(sandbox)
  runInContext(source, sandbox)
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.ProjectPlannerCanonical?.rulebookStamp())), {
    version,
    sha256: manifest.rulebookSha256,
  })
})

// MARK: - Pay rate on a day, overlapping bookings, leave lines, leave requests

import { payRateOnDay as payRateOnDayRule } from './payRate.ts'
import {
  holidayDecisionWriteFields as holidayDecisionWriteFieldsRule,
  holidayRequestRanges as holidayRequestRangesRule,
  holidayRequestWriteFields as holidayRequestWriteFieldsRule,
  leaveApproverIds as leaveApproverIdsRule,
  leaveRecordDayKeys as leaveRecordDayKeysRule,
  parseHolidayDecisionNote as parseHolidayDecisionNoteRule,
} from './leaveRequests.ts'
import {
  overlappingBookingIds as overlappingBookingIdsRule,
  timesheetLeaveLines as timesheetLeaveLinesRule,
} from './timesheetLines.ts'
import { annualLeaveBalance as annualLeaveBalanceRule } from './annualLeaveBalance.ts'

test('payRateOnDay: history on or before the org day wins, explicit 0 is real, PAYE is 0', () => {
  const history = [
    { id: 'h1', userId: 'u1', dayRate: 180, effectiveAt: '2026-01-01T00:00:00Z' },
    { id: 'h2', userId: 'u1', dayRate: 0, effectiveAt: '2026-09-01T00:00:00Z' },
    // 23:30 UTC on 30 Sep is 1 Oct in London: effective from 1 Oct, not 30 Sep.
    { id: 'h3', userId: 'u1', dayRate: 220, effectiveAt: '2026-09-30T23:30:00Z' },
    { id: 'other', userId: 'u2', dayRate: 999, effectiveAt: '2026-01-01T00:00:00Z' },
  ]
  const user = { id: 'u1', dayRate: 250, employmentType: 'self_employed' }
  const on = (dayKey: string) => payRateOnDayRule({ user, history, dayKey, timeZone: 'Europe/London' })
  assert.equal(on('2026-08-15').rate, 180)
  assert.equal(on('2026-09-15').rate, 0)
  assert.equal(on('2026-09-15').hasRate, true)
  assert.equal(on('2026-09-30').rate, 0)
  assert.equal(on('2026-10-01').rate, 220)
  assert.equal(on('2026-10-01').source, 'history')
  const noHistory = payRateOnDayRule({ user, history: [], dayKey: '2026-10-01' })
  assert.deepEqual([noHistory.payBasis, noHistory.rate, noHistory.source], ['day', 250, 'profile'])
  const hourly = payRateOnDayRule({ user: { id: 'u3', payBasis: 'hourly', hourlyRate: 18.5 }, dayKey: '2026-10-01' })
  assert.deepEqual([hourly.payBasis, hourly.rate], ['hourly', 18.5])
  const unset = payRateOnDayRule({ user: { id: 'u4' }, dayKey: '2026-10-01' })
  assert.deepEqual([unset.rate, unset.hasRate, unset.source], [null, false, 'none'])
  const paye = payRateOnDayRule({
    user: {
      id: 'u1',
      dayRate: 250,
      employmentType: 'paye',
      employmentTypeTransitionFrom: 'self_employed',
      employmentTypeEffectiveAt: '2026-10-05T00:00:00Z',
    },
    history,
    dayKey: '2026-10-05',
    timeZone: 'Europe/London',
  })
  assert.deepEqual([paye.isPaye, paye.rate, paye.employmentType], [true, 0, 'paye'])
  const before = payRateOnDayRule({ user: { ...paye, id: 'u1', employmentType: 'paye', employmentTypeTransitionFrom: 'self_employed', employmentTypeEffectiveAt: '2026-10-05T00:00:00Z' }, history, dayKey: '2026-10-02' })
  assert.deepEqual([before.isPaye, before.rate], [false, 220])
})

test('payRateOnDay: an hourly row keeps covering until a later-day day-rate row', () => {
  const history = [
    { id: 'a', userId: 'u1', dayRate: 20, payBasis: 'hourly', effectiveAt: '2026-10-05T00:00:00Z', createdAt: '2026-10-05T09:00:00Z' },
    { id: 'b', userId: 'u1', dayRate: 200, payBasis: 'day', effectiveAt: '2026-10-05T00:00:00Z', createdAt: '2026-10-05T10:00:00Z' },
    { id: 'c', userId: 'u1', dayRate: 210, payBasis: 'day', effectiveAt: '2026-10-07T00:00:00Z' },
  ]
  const user = { id: 'u1', payBasis: 'hourly', hourlyRate: 22 }
  assert.deepEqual(
    [payRateOnDayRule({ user, history, dayKey: '2026-10-06' }).payBasis, payRateOnDayRule({ user, history, dayKey: '2026-10-06' }).rate],
    ['hourly', 20]
  )
  assert.equal(payRateOnDayRule({ user, history, dayKey: '2026-10-07' }).rate, 210)
})

test('overlappingBookingIds flags every booking that overlaps another on the same day; touching does not', () => {
  const ids = overlappingBookingIdsRule([
    { id: 'am', dayKey: '2026-10-12', timeSlot: 'AM' },
    { id: 'pm', dayKey: '2026-10-12', timeSlot: 'PM' },
    { id: 'x', dayKey: '2026-10-12', timeSlot: 'CUSTOM', workStartTime: '11:00', workEndTime: '14:00' },
    { id: 'other-day', dayKey: '2026-10-13', timeSlot: 'FULL DAY' },
    { id: 't1', dayKey: '2026-10-14', workStartTime: '08:00', workEndTime: '12:00' },
    { id: 't2', dayKey: '2026-10-14', workStartTime: '12:00', workEndTime: '16:00' },
  ])
  assert.deepEqual(ids, ['am', 'pm', 'x'])
})

test('timesheetLeaveLines lists approved leave days in the period only, skipping weekends in a range', () => {
  const lines = timesheetLeaveLinesRule(
    [
      { id: 'L1', startDayKey: '2026-10-09', endDayKey: '2026-10-13', timeSlot: 'FULL DAY', status: 'approved' },
      { id: 'L2', startDayKey: '2026-10-15', endDayKey: '2026-10-15', timeSlot: 'AM', status: 'approved' },
      { id: 'L3', startDayKey: '2026-10-14', endDayKey: '2026-10-14', timeSlot: 'PM', status: 'pending' },
      { id: 'L4', startDayKey: '2026-10-30', endDayKey: '2026-10-30', timeSlot: 'PM' },
    ],
    { startDayKey: '2026-10-10', endDayKey: '2026-10-16' },
    'Europe/London'
  )
  assert.deepEqual(
    lines.map((line) => [line.dayKey, line.label]),
    [
      ['2026-10-12', 'Annual leave (full day)'],
      ['2026-10-13', 'Annual leave (full day)'],
      ['2026-10-15', 'Annual leave (AM)'],
    ]
  )
})

test('leave requests: one document per consecutive same-slot run; decision fields; note parsing', () => {
  const ranges = holidayRequestRangesRule(
    [
      { dayKey: '2026-10-14', timeSlot: 'FULL DAY' },
      { dayKey: '2026-10-12', timeSlot: 'FULL DAY' },
      { dayKey: '2026-10-13', timeSlot: 'FULL DAY' },
      { dayKey: '2026-10-15', timeSlot: 'AM' },
      { dayKey: '2026-10-19', timeSlot: 'FULL DAY' },
    ],
    'Europe/London'
  )
  assert.deepEqual(ranges, [
    { startDayKey: '2026-10-12', endDayKey: '2026-10-14', timeSlot: 'FULL DAY' },
    { startDayKey: '2026-10-15', endDayKey: '2026-10-15', timeSlot: 'AM' },
    { startDayKey: '2026-10-19', endDayKey: '2026-10-19', timeSlot: 'FULL DAY' },
  ])
  const write = holidayRequestWriteFieldsRule({
    id: 'H1',
    organizationId: 'org',
    userId: 'u1',
    startDayKey: '2026-10-12',
    endDayKey: '2026-10-14',
    timeSlot: 'FULL DAY',
    status: 'pending',
    approvedByUserId: 'ignored',
    timeZone: 'Europe/London',
  })
  assert.ok(write)
  assert.equal(write.status, 'pending')
  assert.equal(write.approvedByUserId, null)
  assert.equal(new Date(write.startDateMs).toISOString(), '2026-10-11T23:00:00.000Z')
  assert.equal(new Date(write.endDateMs).toISOString(), '2026-10-13T23:00:00.000Z')
  assert.equal(holidayRequestWriteFieldsRule({ id: 'H2', organizationId: 'org', startDayKey: '2026-10-12' }), null)
  assert.deepEqual(holidayDecisionWriteFieldsRule({ status: 'rejected', approverUid: 'm1', decisionNote: '  Short staffed  ' }), {
    status: 'rejected',
    approvedByUserId: 'm1',
    decisionNote: 'Short staffed',
  })
  assert.equal(holidayDecisionWriteFieldsRule({ status: 'approved', approverUid: 'm1', decisionNote: '   ' })?.decisionNote, null)
  assert.equal(holidayDecisionWriteFieldsRule({ status: 'pending', approverUid: 'm1' }), null)
  assert.equal(parseHolidayDecisionNoteRule(null), null)
  assert.equal(parseHolidayDecisionNoteRule(' ok '), 'ok')
})

test('leave days: a multi-day record counts working days only and splits across leave years', () => {
  assert.deepEqual(leaveRecordDayKeysRule({ startDayKey: '2026-10-09', endDayKey: '2026-10-13' }, 'Europe/London'), [
    '2026-10-09',
    '2026-10-12',
    '2026-10-13',
  ])
  assert.deepEqual(
    leaveRecordDayKeysRule({ startDayKey: '2026-12-24', endDayKey: '2026-12-29' }, 'Europe/London', ['2026-12-25', '2026-12-28']),
    ['2026-12-24', '2026-12-29']
  )
  // A single-day record keeps counting as before.
  assert.deepEqual(leaveRecordDayKeysRule({ startDayKey: '2026-10-10' }, 'Europe/London'), ['2026-10-10'])
  const bookings = [
    { startDayKey: '2026-12-30', endDayKey: '2027-01-05', timeSlot: 'FULL DAY', status: 'approved' },
    { startDayKey: '2026-10-12', endDayKey: '2026-10-16', timeSlot: 'AM', status: 'pending' },
  ]
  const thisYear = annualLeaveBalanceRule({ annualLeaveEnabled: true, daysPerYear: 25, bookings, onDayKey: '2026-11-01' })
  assert.equal(thisYear.taken, 2)
  assert.equal(thisYear.pending, 2.5)
  const nextYear = annualLeaveBalanceRule({
    annualLeaveEnabled: true,
    daysPerYear: 25,
    bookings,
    onDayKey: '2027-02-01',
    nonWorkingDayKeys: ['2027-01-01'],
  })
  // Fri 1 Jan is a bank holiday; 4 and 5 Jan count.
  assert.equal(nextYear.taken, 2)
})

test('leaveApproverIds: every current line manager, else admins; never the requester', () => {
  const role = (r: Partial<{ isSuperAdmin: boolean; isAdmin: boolean; isManager: boolean; isOperativeMode: boolean }>) => ({
    isSuperAdmin: false,
    isAdmin: false,
    isManager: false,
    isOperativeMode: false,
    ...r,
  })
  const roster = [
    { id: 'm1', role: role({ isManager: true }) },
    { id: 'm2', role: role({ isManager: true }) },
    { id: 'gone', isActive: false, role: role({ isManager: true }) },
    { id: 'a1', role: role({ isAdmin: true }) },
    { id: 's1', role: role({ isSuperAdmin: true }) },
    { id: 'op', role: role({ isOperativeMode: true }) },
  ]
  assert.deepEqual(leaveApproverIdsRule({ id: 'u', assignedManagerUserIds: ['m1', 'm2'], assignedManagerUserId: 'm9' }, roster), ['m1', 'm2'])
  assert.deepEqual(leaveApproverIdsRule({ id: 'u', assignedManagerUserIds: [], assignedManagerUserId: 'm2' }, roster), ['m2'])
  assert.deepEqual(leaveApproverIdsRule({ id: 'u', assignedManagerUserIds: ['gone'] }, roster), ['a1', 's1'])
  assert.deepEqual(leaveApproverIdsRule({ id: 'u', assignedManagerUserIds: ['m1'], hasNoLineManager: true }, roster), ['a1', 's1'])
  assert.deepEqual(leaveApproverIdsRule({ id: 'a1' }, roster), ['s1'])
})

import {
  BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT as tombstoneBatchLimit,
  bookingReplayRefusedIsFinal as bookingReplayRefusedIsFinalRule,
  bookingTombstonePath as bookingTombstonePathRule,
  bookingTombstoneWriteFields as bookingTombstoneWriteFieldsRule,
} from './bookingTombstones.ts'

test('booking tombstone: path and write shape for a deleted labour or schedule booking', () => {
  assert.equal(bookingTombstonePathRule('org-1', 'ABC-1'), 'organizations/org-1/deletedBookings/ABC-1')
  assert.equal(bookingTombstonePathRule(' org-1 ', ' abc-1 '), 'organizations/org-1/deletedBookings/abc-1')
  assert.equal(bookingTombstonePathRule('', 'ABC-1'), null)
  assert.equal(bookingTombstonePathRule('org-1', 'a/b'), null)
  assert.deepEqual(
    bookingTombstoneWriteFieldsRule({ bookingId: 'ABC-1', collection: 'bookings', deletedBy: 'u1', deletedFrom: 'web' }),
    { bookingId: 'ABC-1', collection: 'bookings', deletedBy: 'u1', deletedFrom: 'web' }
  )
  assert.deepEqual(
    bookingTombstoneWriteFieldsRule({ bookingId: 'x', collection: 'managerSiteBookings', deletedBy: 'u1', deletedFrom: 'iOS' }),
    { bookingId: 'x', collection: 'managerSiteBookings', deletedBy: 'u1', deletedFrom: 'ios' }
  )
  // Only the two booking collections, a signed-in uid, and a known platform.
  assert.equal(bookingTombstoneWriteFieldsRule({ bookingId: 'x', collection: 'holidayBookings', deletedBy: 'u1', deletedFrom: 'web' }), null)
  assert.equal(bookingTombstoneWriteFieldsRule({ bookingId: 'x', collection: 'bookings', deletedBy: ' ', deletedFrom: 'web' }), null)
  assert.equal(bookingTombstoneWriteFieldsRule({ bookingId: 'x', collection: 'bookings', deletedBy: 'u1', deletedFrom: 'desktop' }), null)
  assert.equal(bookingTombstoneWriteFieldsRule({ bookingId: '', collection: 'bookings', deletedBy: 'u1', deletedFrom: 'web' }), null)
  // Two writes per delete stay under the 500-write batch cap.
  assert.ok(tombstoneBatchLimit * 2 <= 500)
  // A replay refused by the rules is dropped, not retried.
  assert.equal(bookingReplayRefusedIsFinalRule('permission-denied'), true)
  assert.equal(bookingReplayRefusedIsFinalRule(7), true)
  assert.equal(bookingReplayRefusedIsFinalRule('7'), true)
  assert.equal(bookingReplayRefusedIsFinalRule('unavailable'), false)
})

import * as companyDetails from './companyDetails.ts'
import * as payrollSchedule from './payrollPolicySchedule.ts'
import * as paymentRuns from './paymentRuns.ts'
import * as scheduleOptions from './scheduleOptions.ts'
import { validatePaymentRunDateRanges as validateRunSplit, parsePayrollPolicy as parsePolicy } from './organizationSettings.ts'

test('company details read flat fields, fall back to the nested map, and saves remove blanks', () => {
  const legacy = companyDetails.parseCompanyDetails({
    name: 'Acme',
    countryCode: 'ie',
    officeAddress: { addressLine1: '1 Old St', town: 'Cork', county: 'Cork', postcode: 'T12' },
  })
  assert.equal(legacy.hasOfficeAddress, true)
  assert.equal(legacy.officeAddressLine1, '1 Old St')
  assert.equal(legacy.officeCity, 'Cork')
  assert.equal(legacy.officeCounty, 'Cork')
  assert.equal(legacy.countryCode, 'IE')
  // No saved region: the country's default (1.4.0), not England & Wales.
  assert.equal(legacy.bankHolidayRegionId, 'IE')
  const flatWins = companyDetails.parseCompanyDetails({
    officeAddressLine1: '2 New St',
    officeCity: 'London',
    officeAddress: { addressLine1: '1 Old St', town: 'Cork' },
    documentAbbreviation: 'r-m',
  })
  assert.equal(flatWins.officeAddressLine1, '2 New St')
  assert.equal(flatWins.officeCity, 'London')
  assert.equal(flatWins.documentAbbreviation, 'RM')
  assert.equal(flatWins.countryCode, 'GB')

  const write = companyDetails.companyDetailsWriteFields({
    name: '  ',
    hasOfficeAddress: true,
    officeAddressLine1: ' 2 New St ',
    officeCity: 'London',
    officeAddressLine2: '',
    officeCounty: 'Greater London',
    officePostcode: '',
    countryCode: 'gb',
    documentAbbreviation: '',
    companyLogoURL: null,
    bankHolidayRegionId: 'GB-SCT',
  })
  assert.equal('name' in write.set, false, 'a blank name is never written')
  assert.equal(write.set.officeAddressLine1, '2 New St')
  assert.equal(write.set.officeCounty, 'Greater London')
  assert.equal(write.set.countryCode, 'GB')
  assert.equal(write.set['settings.bankHolidayRegionId'], 'GB-SCT')
  assert.deepEqual(
    [...write.remove].sort(),
    ['companyLogoURL', 'documentAbbreviation', 'officeAddress', 'officeAddressLine2', 'officePostcode'].sort()
  )
  assert.equal('defaultLatitude' in write.set, false, 'no coordinate leaves the saved pin alone')

  const noOffice = companyDetails.companyDetailsWriteFields({
    name: 'Acme',
    hasOfficeAddress: false,
    countryCode: 'US',
    documentAbbreviation: 'ac',
    defaultLatitude: 40.7,
    defaultLongitude: -74,
  })
  assert.equal(noOffice.set.name, 'Acme')
  assert.equal(noOffice.set.documentAbbreviation, 'AC')
  assert.equal(noOffice.set.defaultLatitude, 40.7)
  assert.equal('companyLogoURL' in noOffice.set || noOffice.remove.includes('companyLogoURL'), false)
  for (const field of ['officeAddress', 'officeAddressLine1', 'officeAddressLine2', 'officeCity', 'officeCounty', 'officePostcode']) {
    assert.ok(noOffice.remove.includes(field), field)
  }
  assert.equal(
    companyDetails.companyDetailsValidationError({ name: 'A', hasOfficeAddress: true, officeAddressLine1: 'x', countryCode: 'GB' }),
    'Name, country, address line 1 and town are required.'
  )
  assert.equal(companyDetails.companyDetailsValidationError({ name: 'A', hasOfficeAddress: false, countryCode: 'GB' }), null)
})

test('effective working hours: prior before effectiveFrom, scheduled from its day, writes keep a future schedule', () => {
  const policy = (start: string) => ({ ...parsePolicy(undefined), standardDayStart: start })
  const doc = {
    countryCode: 'GB',
    payrollTimePolicy: { standardDayStart: '08:00' },
    payrollTimePolicyPrior: { standardDayStart: '07:00' },
    payrollTimePolicyEffectiveFrom: '2026-10-01',
    payrollTimePolicyScheduled: { policy: { standardDayStart: '09:00' }, effectiveFrom: '2026-11-02' },
  }
  assert.equal(payrollSchedule.effectivePayrollTimePolicy(doc, '2026-09-30').standardDayStart, '07:00')
  assert.equal(payrollSchedule.effectivePayrollTimePolicy(doc, '2026-10-31').standardDayStart, '08:00')
  assert.equal(payrollSchedule.effectivePayrollTimePolicy(doc, '2026-11-02').standardDayStart, '09:00')
  assert.equal(payrollSchedule.effectivePayrollTimePolicy({}, '2026-11-02').standardDayStart, '07:30')

  // Not yet due: the timeline keeps the schedule pending.
  const pending = payrollSchedule.payrollTimePolicyTimeline(doc, '2026-10-31', 'Europe/London')
  assert.equal(pending.current.standardDayStart, '08:00')
  assert.equal(pending.scheduled?.effectiveFrom, '2026-11-02')
  // Due but never promoted by any app: counted anyway.
  const due = payrollSchedule.payrollTimePolicyTimeline(doc, '2026-11-03', 'Europe/London')
  assert.equal(due.current.standardDayStart, '09:00')
  assert.equal(due.prior?.standardDayStart, '08:00')
  assert.equal(due.effectiveFrom, '2026-11-02')
  assert.equal(due.scheduled, null)

  // Apply from today keeps a future iOS-scheduled change (never writes payrollTimePolicyScheduled).
  const applyNow = payrollSchedule.payrollTimePolicyApplyNowWriteFields({
    orgDoc: doc,
    policy: policy('06:00'),
    todayKey: '2026-10-31',
    timeZone: 'Europe/London',
  })
  assert.equal('payrollTimePolicyScheduled' in applyNow, false)
  assert.equal(applyNow.payrollTimePolicyEffectiveFrom, '2026-10-31')
  assert.equal((applyNow.payrollTimePolicyPrior as Record<string, unknown>).standardDayStart, '08:00')
  // Second save the same day keeps yesterday's rules as prior.
  const sameDay = payrollSchedule.payrollTimePolicyApplyNowWriteFields({
    orgDoc: { ...doc, payrollTimePolicy: { standardDayStart: '06:00' }, payrollTimePolicyEffectiveFrom: '2026-10-31', payrollTimePolicyScheduled: null },
    policy: policy('05:00'),
    todayKey: '2026-10-31',
  })
  assert.equal((sameDay.payrollTimePolicyPrior as Record<string, unknown>).standardDayStart, '07:00')
  // Applying after a due schedule consumes it.
  const afterDue = payrollSchedule.payrollTimePolicyApplyNowWriteFields({ orgDoc: doc, policy: policy('06:00'), todayKey: '2026-11-05' })
  assert.equal(afterDue.payrollTimePolicyScheduled, null)
  assert.equal((afterDue.payrollTimePolicyPrior as Record<string, unknown>).standardDayStart, '09:00')

  assert.equal(payrollSchedule.payrollTimePolicyScheduleWriteFields({ orgDoc: doc, policy: policy('06:00'), effectiveFrom: '2026-10-31', todayKey: '2026-10-31' }), null)
  const scheduled = payrollSchedule.payrollTimePolicyScheduleWriteFields({
    orgDoc: doc,
    policy: policy('06:00'),
    effectiveFrom: '2026-12-01',
    todayKey: '2026-11-05',
  })!
  // The due 09:00 change is promoted first, then the new one queued.
  assert.equal((scheduled.payrollTimePolicy as Record<string, unknown>).standardDayStart, '09:00')
  assert.equal(scheduled.payrollTimePolicyEffectiveFrom, '2026-11-02')
  assert.deepEqual(
    Object.keys(scheduled.payrollTimePolicyScheduled as Record<string, unknown>).sort(),
    ['effectiveFrom', 'policy']
  )
  assert.equal(payrollSchedule.payrollDayKeyFromValue({ seconds: Date.UTC(2026, 5, 30, 23, 30) / 1000 }, 'Europe/London'), '2026-07-01')
})

test('working-hours limits are one set: paid hours 1–12, break 0–120 minutes, multipliers 1–3', () => {
  const base = parsePolicy(undefined)
  assert.equal(payrollSchedule.validatePayrollTimePolicy(base), null)
  // 1.44.0: the paid day is always derived — 07:30–20:30 less 30 min unpaid is 12.5h, over the limit; a stored
  // `standardPaidHours` is no longer checked (never read for pay).
  assert.match(payrollSchedule.validatePayrollTimePolicy({ ...base, standardDayEnd: '20:30' }) ?? '', /between 1 and 12/)
  assert.equal(payrollSchedule.validatePayrollTimePolicy({ ...base, standardPaidHours: 12.5 }), null)
  assert.match(payrollSchedule.validatePayrollTimePolicy({ ...base, unpaidBreakMinutes: 121 }) ?? '', /0 and 120/)
  assert.match(payrollSchedule.validatePayrollTimePolicy({ ...base, weekdayOutsideStandardMultiplier: 0.5 }) ?? '', /×1 and ×3/)
  assert.match(
    payrollSchedule.validatePayrollTimePolicy({ ...base, saturday: { ...base.saturday, outsideWindowMultiplier: 3.5 } }) ?? '',
    /Saturday/
  )
  assert.equal(
    payrollSchedule.validatePayrollTimePolicy({ ...base, sunday: { ...base.sunday, allHoursMultiplier: 9, sameAsSaturday: true } }),
    null,
    'Sunday that follows Saturday is not checked on its own'
  )
  assert.equal(payrollSchedule.isStandardWorkingWeekday(5), true)
  assert.equal(payrollSchedule.isStandardWorkingWeekday(6), false)
})

test('payment runs: active run contains today, paid in arrears on the pay day after it ends', () => {
  const recurring = {
    paymentRunMode: 'recurring_timeframe',
    paymentDateMode: 'recurring_date',
    recurringRunStartDay: 'monday',
    recurringRunEndDay: 'sunday',
    recurringPaymentDay: 'friday',
  }
  // Saturday 31 Oct 2026: run Mon 26 Oct – Sun 1 Nov, paid Fri 6 Nov.
  const active = paymentRuns.activePaymentRunSummary(recurring, '2026-10-31T12:00:00Z', 'Europe/London')
  assert.deepEqual(active, {
    notConfigured: false,
    start: '2026-10-26',
    end: '2026-11-01',
    payDate: '2026-11-06',
    label: 'Mon 26 Oct – Sun 1 Nov · paid Fri 6 Nov',
  })
  // A Friday pay day after a Monday–Friday run is the following Friday, never the run's own last day.
  const monFri = paymentRuns.activePaymentRunSummary({ ...recurring, recurringRunEndDay: 'friday' }, '2026-10-28T12:00:00Z', 'Europe/London')
  assert.equal(monFri.notConfigured === false && monFri.payDate, '2026-11-06')

  const ranges = {
    paymentRunMode: 'date_ranges',
    paymentRunDateRanges: [
      { startDay: 1, endDay: 15 },
      { startDay: 16, endDay: 31 },
    ],
    paymentDates: [20, 5],
  }
  const second = paymentRuns.activePaymentRunSummary(ranges, '2026-02-20T12:00:00Z', 'Europe/London')
  assert.equal(second.notConfigured === false && second.end, '2026-02-28', '16th–31st ends on the last day of a short month')
  assert.equal(second.notConfigured === false && second.payDate, '2026-03-05')
  const first = paymentRuns.activePaymentRunSummary(ranges, '2026-02-03T12:00:00Z', 'Europe/London')
  assert.equal(first.notConfigured === false && first.payDate, '2026-02-20')
  const noPayDay = paymentRuns.activePaymentRunSummary({ ...ranges, paymentDates: [] }, '2026-02-03T12:00:00Z', 'Europe/London')
  assert.equal(noPayDay.notConfigured === false && noPayDay.payDate, null)
  assert.deepEqual(paymentRuns.activePaymentRunSummary(null, '2026-02-03T12:00:00Z'), { notConfigured: true })

  assert.match(
    validateRunSplit([
      { startDay: 1, endDay: 28 },
      { startDay: 29, endDay: 31 },
    ]) ?? '',
    /on or before the 27th/
  )
  assert.equal(
    validateRunSplit([
      { startDay: 1, endDay: 27 },
      { startDay: 28, endDay: 31 },
    ]),
    null
  )
})

test('schedule locations honour customItemEnabled; a save de-duplicates and never resurrects', () => {
  const locations = scheduleOptions.enabledScheduleLocations({
    showOffice: true,
    showWorkingFromHome: false,
    showSiteSurvey: true,
    customItems: ['Yard', 'Depot', ' yard '],
    customItemEnabled: { Yard: true, Depot: false },
  })
  assert.deepEqual(
    locations.map((row) => row.id),
    ['office', 'survey', 'custom:Yard']
  )
  const written = scheduleOptions.scheduleOptionsWriteFields({
    showOffice: true,
    showWorkingFromHome: true,
    showSiteSurvey: false,
    customItems: ['Yard', 'YARD', '', 'Depot'],
    customItemEnabled: { Yard: false, Gone: true },
  })
  assert.deepEqual(written.customItems, ['Yard', 'Depot'])
  assert.deepEqual(written.customItemEnabled, { Yard: false, Depot: true })
  assert.equal(written.showSiteSurvey, false)
})

// --- Warnings detection period, material cut-off rows, clash approvals, variations toggle ---
import { clashScanDays as clashScanDaysRule, coverageWindow as coverageWindowRule } from './engine.ts'
import { parseWarningDetection as parseDetectionRule } from './organizationSettings.ts'
import { materialCutOffWarningRows as materialRowsRule, materialLineCountsAsOrdered as lineOrderedRule } from './materialCutOffWarnings.ts'
import {
  clashApprovalWrites as clashApprovalWritesRule,
  clashResolutionKey as clashResolutionKeyRule,
  isClashApproved as isClashApprovedRule,
  isWarningActive as isWarningActiveRule,
} from './scheduleSources.ts'
import {
  notificationPreferenceAllowsDelivery as allowsDeliveryRule,
  notificationPreferenceKeyForType as keyForTypeRule,
  parseUserNotificationPreferences as parsePrefsRule,
  visibleNotificationPreferenceKeys as visiblePrefsRule,
} from './notificationPreferences.ts'

test('set number of days: N includes today; a missing or invalid N scans 7 days and says why', () => {
  const base = { referenceIso: '2026-10-28T09:00:00Z', timeZone: 'Europe/London', clashLookaheadMode: 'numberOfDays' }
  assert.deepEqual(coverageWindowRule({ ...base, clashLookaheadDays: 2 }), { startDayKey: '2026-10-28', endDayKey: '2026-10-29' })
  const missing = coverageWindowRule({ ...base, clashLookaheadDays: null })
  assert.equal(missing.endDayKey, '2026-11-03')
  assert.equal(missing.fallbackReason, 'lookaheadDaysMissing')
  const invalid = coverageWindowRule({ ...base, clashLookaheadDays: 0 })
  assert.equal(invalid.endDayKey, '2026-11-03')
  assert.equal(invalid.fallbackReason, 'lookaheadDaysInvalid')
  assert.equal(parseDetectionRule({ clashLookaheadMode: 'numberOfDays', clashLookaheadDays: 'abc' }).clashLookaheadDaysFallback, 'lookaheadDaysInvalid')
  const blank = parseDetectionRule({ clashLookaheadMode: 'numberOfDays' })
  assert.equal(blank.clashLookaheadDays, 7)
  assert.equal(blank.clashLookaheadDaysFallback, 'lookaheadDaysMissing')
  assert.equal(parseDetectionRule({ clashLookaheadMode: 'numberOfDays', clashLookaheadDays: 3 }).clashLookaheadDaysFallback, undefined)
  // Full week needs no N, so a missing N is not a notice there.
  assert.equal(parseDetectionRule({ clashLookaheadMode: 'endOfWorkingWeek' }).clashLookaheadDaysFallback, undefined)
})

test('clash days: Full week is Mon–Fri plus a weekend day of this week that has a booking', () => {
  // Wednesday 28 Oct 2026.
  const input = { referenceIso: '2026-10-28T09:00:00Z', timeZone: 'Europe/London', clashLookaheadMode: 'endOfWorkingWeek' }
  assert.deepEqual(coverageWindowRule(input), { startDayKey: '2026-10-26', endDayKey: '2026-10-30' })
  const sundayBooked = clashScanDaysRule({ ...input, bookedDayKeys: ['2026-10-27', '2026-11-01'] })
  assert.deepEqual(sundayBooked.dayKeys, ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-11-01'])
  assert.equal(sundayBooked.endDayKey, '2026-11-01')
  const noWeekend = clashScanDaysRule({ ...input, bookedDayKeys: ['2026-10-27'] })
  assert.equal(noWeekend.dayKeys.length, 5)
  // Without booking days, both weekend days of this week are checked (a clash row only exists on a booked day).
  assert.equal(clashScanDaysRule(input).dayKeys.length, 7)
  // Set number of days is calendar days: a weekend inside it is already checked.
  const days = clashScanDaysRule({ ...input, clashLookaheadMode: 'numberOfDays', clashLookaheadDays: 5, bookedDayKeys: [] })
  assert.deepEqual(days.dayKeys, ['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
})

test('material cut-off rows: after the clock, tomorrow-booked jobs warn; order send records count as ordered', () => {
  const projects = [{ id: 'P1', jobNumber: 'J-100', siteName: 'High St' }, { id: 'P2', jobNumber: '', siteName: 'Mill' }]
  const bookings = [
    { projectId: 'P1', status: 'confirmed', dayKey: '2026-10-29' },
    { projectId: 'P2', status: 'cancelled', dayKey: '2026-10-29' },
  ]
  const materials = [
    { id: 'm1', projectId: 'P1', status: 'draft', dayKey: '2026-10-29' },
    { id: 'm2', projectId: 'P1', status: 'ordered', dayKey: '2026-10-29' },
  ]
  const base = { timeZone: 'Europe/London', cutOff: { materialCutOffHour: 15, materialCutOffMinute: 30 }, projects, bookings, materials }
  // 15:29 London (GMT on 28 Oct 2026) is before the clock.
  assert.equal(materialRowsRule({ ...base, now: '2026-10-28T15:29:00Z' }).length, 0)
  const rows = materialRowsRule({ ...base, now: '2026-10-28T15:30:00Z' })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].id, 'materials-P1-2026-10-29')
  assert.equal(rows[0].resolutionKey, rows[0].id)
  assert.equal(rows[0].unorderedCount, 1)
  assert.match(rows[0].message, /not fully ordered by the cut-off 15:30/)
  // An order send record listing m1 makes every line ordered.
  const sent = materialRowsRule({ ...base, now: '2026-10-28T16:00:00Z', sendRecords: [{ requestType: 'order', materialIds: ['m1'] }] })
  assert.equal(sent.length, 0)
  assert.equal(lineOrderedRule({ id: 'm1', status: 'draft' }, [{ requestType: 'quote', materialIds: ['m1'] }]), false)
  // No lines for tomorrow still warns.
  const empty = materialRowsRule({ ...base, materials: [], now: '2026-10-28T16:00:00Z' })
  assert.equal(empty[0].unorderedCount, 0)
  assert.match(empty[0].message, /^No materials have been ordered for J-100/)
  // Friday evening: Saturday tomorrow is skipped unless its flag is on.
  const sat = { ...base, bookings: [{ projectId: 'P1', status: 'confirmed', dayKey: '2026-10-31' }], materials: [] }
  assert.equal(materialRowsRule({ ...sat, now: '2026-10-30T17:00:00Z' }).length, 0)
  assert.equal(
    materialRowsRule({ ...sat, cutOff: { ...base.cutOff, materialCutOffOnSaturday: true }, now: '2026-10-30T17:00:00Z' }).length,
    1
  )
  // Turned off.
  assert.equal(materialRowsRule({ ...base, cutOff: { materialOrderCutOff: false }, now: '2026-10-28T20:00:00Z' }).length, 0)
})

test('clash approval writes both collections; operative clashes key by the booking pair', () => {
  const writes = clashApprovalWritesRule({ bookingAId: 'b2', bookingBId: 'b1', approvedByUserId: 'u1' })
  assert.equal(writes.acceptedClash?.documentId, 'b1|b2')
  assert.equal(writes.resolution?.documentId, 'b1|b2')
  assert.deepEqual(writes.resolution?.fields, { resolutionKey: 'b1|b2', status: 'approved', resolvedByUserId: 'u1' })
  const manager = clashApprovalWritesRule({
    bookingAId: 'm1',
    bookingBId: 'm2',
    resolutionKey: 'mgr-clash-u9-2026-10-28-0',
    approvedByUserId: 'u1',
  })
  assert.equal(manager.acceptedClash?.documentId, 'm1|m2')
  assert.equal(manager.resolution?.documentId, 'mgr-clash-u9-2026-10-28-0')
  assert.equal(clashResolutionKeyRule({ bookingAId: 'B', bookingBId: 'A' }), 'A|B')
  // Approved on either collection.
  assert.equal(isClashApprovedRule({ bookingAId: 'b1', bookingBId: 'b2' }, { resolvedKeys: ['b1|b2'] }), true)
  assert.equal(isClashApprovedRule({ bookingAId: 'b1', bookingBId: 'b2' }, { acceptedClashes: ['b2|b1'] }), true)
  assert.equal(isClashApprovedRule({ bookingAId: 'b1', bookingBId: 'b2' }, { resolvedKeys: [] }), false)
  assert.equal(isWarningActiveRule({ resolutionKey: 'b1|b2', bookingAId: 'b1', bookingBId: 'b2' }, { resolvedKeys: ['b1|b2'] }), false)
})

test('variations notifications have a toggle (default on) that only variation viewers see', () => {
  for (const type of ['variation', 'variation_renumbered', 'variation_added', 'variation_from_tracker', 'variation_numbers_updated']) {
    assert.equal(keyForTypeRule(type), 'variations')
  }
  const prefs = parsePrefsRule({})
  assert.equal(prefs.variations, true)
  assert.equal(allowsDeliveryRule(parsePrefsRule({ variations: false }), 'variation'), false)
  const catalogue = { projects: true, smallWorks: true }
  const manager = { role: { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }, catalogue }
  const operative = { role: { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: true }, catalogue }
  assert.ok(visiblePrefsRule(manager).includes('variations'))
  assert.ok(!visiblePrefsRule(operative).includes('variations'))
})

import {
  DEVELOPER_PASSWORD_MIN_LENGTH as DEVELOPER_PASSWORD_MIN_LENGTH_RULE,
  PASSWORD_MIN_LENGTH as PASSWORD_MIN_LENGTH_RULE,
  passwordMinLength as passwordMinLengthRule,
  passwordPolicyError as passwordPolicyErrorRule,
} from './passwordPolicy.ts'

test('password policy: 8 characters for every account, 10 for the developer account', () => {
  assert.equal(PASSWORD_MIN_LENGTH_RULE, 8)
  assert.equal(DEVELOPER_PASSWORD_MIN_LENGTH_RULE, 10)
  assert.equal(passwordMinLengthRule(), 8)
  assert.equal(passwordMinLengthRule({ developerAccount: true }), 10)
  assert.equal(passwordPolicyErrorRule('1234567'), 'Password must be at least 8 characters.')
  assert.equal(passwordPolicyErrorRule('12345678'), null)
  assert.equal(passwordPolicyErrorRule('123456789', { developerAccount: true }), 'Password must be at least 10 characters.')
  assert.equal(passwordPolicyErrorRule('1234567890', { developerAccount: true }), null)
  // iOS ChangePasswordView used 6: a six-character password is refused.
  assert.equal(passwordPolicyErrorRule('abcdef'), 'Password must be at least 8 characters.')
  assert.equal(passwordPolicyErrorRule(undefined), 'Password must be at least 8 characters.')
})

test('booking download start: launch bound, earlier week reload, never later (bookingLoadStart contract)', () => {
  // Launch: earlier of this Monday and the warning window start.
  assert.deepEqual(
    scheduleSources.bookingLoadStart({ loadedFromDayKey: null, neededDayKeys: ['2026-10-26', '2026-10-16'] }),
    { startDayKey: '2026-10-16', reload: false }
  )
  // A screen showing an earlier week moves the start back and reloads.
  assert.deepEqual(
    scheduleSources.bookingLoadStart({ loadedFromDayKey: '2026-10-16', neededDayKeys: ['2026-10-26', '2026-09-07'] }),
    { startDayKey: '2026-09-07', reload: true }
  )
  // A later day never narrows the download.
  assert.deepEqual(
    scheduleSources.bookingLoadStart({ loadedFromDayKey: '2026-09-07', neededDayKeys: ['2026-10-26'] }),
    { startDayKey: '2026-09-07', reload: false }
  )
  assert.deepEqual(scheduleSources.bookingLoadStart({ fullHistory: true, neededDayKeys: ['2026-10-26'] }), {
    startDayKey: null,
    reload: false,
  })
})

test('notification toggles stop the device push only, never the inbox row', async () => {
  const prefsModule = await import('./notificationPreferences.ts')
  const off = prefsModule.parseUserNotificationPreferences({ bookedOntoJob: false, variations: false })
  assert.equal(prefsModule.NOTIFICATION_TOGGLE_HIDES_INBOX_ROW, false)
  assert.equal(prefsModule.notificationShowsInInbox(off, 'booking_created'), true)
  assert.equal(prefsModule.devicePushAllowed(off, 'booking_created'), false)
  assert.equal(prefsModule.devicePushAllowed(prefsModule.DEFAULT_USER_NOTIFICATION_PREFERENCES, 'booking_created'), true)
  for (const type of ['variation', 'variation_renumbered', 'variation_added', 'variation_from_tracker', 'variation_numbers_updated']) {
    assert.equal(prefsModule.notificationDeliversDevicePush(type), true, type)
    assert.equal(prefsModule.devicePushAllowed(off, type), false, type)
  }
  assert.equal(prefsModule.devicePushAllowed(off, 'material_order_cut_off'), false)
})

import {
  parseTimesheetEntryReviews,
  timesheetEntryDecision,
  timesheetEntryReviewWriteFields,
  timesheetEntryReviewsAfterWrite,
  timesheetOwnerWriteFields,
  timesheetWriterIsReviewer,
} from './timesheetEntryReviews.ts'
import { canChangePersonPay } from './payAccess.ts'

test('timesheet entry decisions: the reviewer map wins; the owner-written inline value only lowers pay', () => {
  const signedAt = new Date('2026-10-16T10:00:00Z')
  const entry = { id: 'e1', amount: 50, managerDecision: 'approved', managerRevisedAmount: null }
  const reviewed = (review: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    extraEntryReviews: { e1: review },
    ...extra,
  })

  // Map era: the reviewer's decline stands even when the owner rewrites the inline value.
  assert.deepEqual(
    timesheetEntryDecision(reviewed({ decision: 'declined', reviewedAmount: 50 }), { ...entry, managerDecision: 'approved' }),
    { decision: 'declined', revisedAmount: null, source: 'review' }
  )
  // An inline "edited" up is ignored; the reviewer's edit down stands.
  assert.deepEqual(
    timesheetEntryDecision(reviewed({ decision: 'edited', revisedAmount: 30, reviewedAmount: 50 }), {
      ...entry,
      managerDecision: 'edited',
      managerRevisedAmount: 999,
    }),
    { decision: 'edited', revisedAmount: 30, source: 'review' }
  )
  // A review made against another amount is stale: pending until the manager looks again.
  assert.equal(
    timesheetEntryDecision(reviewed({ decision: 'approved', reviewedAmount: 50 }), { ...entry, amount: 500 }).decision,
    'pending'
  )
  // Not reviewed yet: approved at its own amount, as both apps create entries.
  assert.equal(timesheetEntryDecision({ extraEntryReviews: {} }, entry).decision, 'approved')
  // The inline value may lower pay (an old iOS manager build that only writes inline).
  assert.deepEqual(
    timesheetEntryDecision({ extraEntryReviews: {} }, { ...entry, managerDecision: 'declined' }),
    { decision: 'declined', revisedAmount: null, source: 'inline-lower' }
  )
  // Legacy sheet (no map), not manager-signed: an inline "edited" up does not count.
  assert.deepEqual(
    timesheetEntryDecision({}, { ...entry, managerDecision: 'edited', managerRevisedAmount: 999 }),
    { decision: 'approved', revisedAmount: null, source: 'unreviewed' }
  )
  // Legacy sheet the line manager signed: inline is what they signed (rules freeze the owner's entries).
  assert.deepEqual(
    timesheetEntryDecision({ managerSignedAt: signedAt }, { ...entry, managerDecision: 'edited', managerRevisedAmount: 70 }),
    { decision: 'edited', revisedAmount: 70, source: 'legacy-inline' }
  )
  assert.equal(parseTimesheetEntryReviews({}), null)
  assert.deepEqual(parseTimesheetEntryReviews({ extraEntryReviews: {} }), {})
})

test('timesheet entry reviews are written as dotted fields, only for entries that changed', () => {
  const entries = [
    { id: 'e1', amount: 50, managerDecision: 'declined' as const, managerRevisedAmount: null },
    { id: 'e2', amount: 20, managerDecision: 'approved' as const, managerRevisedAmount: null },
  ]
  // Legacy sheet: every entry moves into the map.
  const first = timesheetEntryReviewWriteFields({ stored: null, entries, reviewedByUserId: 'lm', reviewedAtMs: 1000 })
  assert.deepEqual(Object.keys(first).sort(), ['extraEntryReviews.e1', 'extraEntryReviews.e2'])
  assert.deepEqual(first['extraEntryReviews.e1'], {
    decision: 'declined',
    revisedAmount: null,
    reviewedAmount: 50,
    reviewedByUserId: 'lm',
    reviewedAtMs: 1000,
  })
  const stored = timesheetEntryReviewsAfterWrite(null, first)
  // Nothing changed: nothing written.
  assert.deepEqual(timesheetEntryReviewWriteFields({ stored, entries, reviewedByUserId: 'lm', reviewedAtMs: 2000 }), {})
  // One edit: one field.
  const edited = timesheetEntryReviewWriteFields({
    stored,
    entries: [entries[0], { ...entries[1], managerDecision: 'edited', managerRevisedAmount: 15 }],
    reviewedByUserId: 'lm',
    reviewedAtMs: 3000,
  })
  assert.deepEqual(Object.keys(edited), ['extraEntryReviews.e2'])
  assert.equal(edited['extraEntryReviews.e2'].revisedAmount, 15)
})

test('timesheet owner save drops the reviewer-only parts', () => {
  const full = {
    managerNote: 'Please check Tuesday',
    payrollLineReviews: { a: { decision: 'declined' } },
    extraEntryReviews: {},
    'extraEntryReviews.e1': { decision: 'approved' },
    weeklyReportOverride: { lines: [] },
    expenseEntries: [],
    priceWorkEntries: [],
    operativeSignedByName: 'Rae',
  }
  assert.deepEqual(timesheetOwnerWriteFields(full, { subjectHasLineManager: true, managerSigned: false }), {
    managerNote: 'Please check Tuesday',
    expenseEntries: [],
    priceWorkEntries: [],
    operativeSignedByName: 'Rae',
  })
  // Self-signed (no line manager): the owner writes the approved snapshot.
  assert.ok('weeklyReportOverride' in timesheetOwnerWriteFields(full, { subjectHasLineManager: false, managerSigned: false }))
  // Manager-signed: the entries are frozen for the owner.
  const signed = timesheetOwnerWriteFields(full, { subjectHasLineManager: true, managerSigned: true })
  assert.equal('expenseEntries' in signed, false)
  assert.equal('priceWorkEntries' in signed, false)
  assert.equal(signed.managerNote, 'Please check Tuesday')

  assert.equal(timesheetWriterIsReviewer({ writerUserId: 'op', subjectUserId: 'op', subjectLineManagerIds: ['op'] }), false)
  assert.equal(timesheetWriterIsReviewer({ writerUserId: 'lm', subjectUserId: 'op', subjectLineManagerIds: ['LM'] }), true)
  assert.equal(timesheetWriterIsReviewer({ writerUserId: 'new', writerFormerIds: ['old'], subjectUserId: 'op', subjectLineManagerIds: ['old'] }), true)
  assert.equal(timesheetWriterIsReviewer({ writerUserId: 'other', subjectUserId: 'op', subjectLineManagerIds: ['lm'] }), false)
  // 1.30.2: an admin is never the reviewer of their own sheet, under any of their ids.
  assert.equal(timesheetWriterIsReviewer({ writerUserId: 'admin', subjectUserId: 'admin', writerIsAdmin: true }), false)
  assert.equal(timesheetWriterIsReviewer({ writerUserId: 'admin', subjectUserId: 'other', writerIsAdmin: true }), true)
})

test('pay access: a person never changes their own pay; admins and operatives managers do', () => {
  const operative = { userId: 'op', isOperative: true }
  assert.equal(canChangePersonPay({ userId: 'op', isOperativeMode: true }, operative), false)
  assert.equal(canChangePersonPay({ userId: 'mgr', isManager: true, hasOperativesAccess: true }, operative), true)
  assert.equal(canChangePersonPay({ userId: 'mgr', isManager: true }, operative), false)
  assert.equal(canChangePersonPay({ userId: 'mgr', isManager: true, hasOperativesAccess: true }, { userId: 'mgr2', isOperative: false }), false)
  assert.equal(canChangePersonPay({ userId: 'mgr', isManager: true, hasOperativesAccess: true }, { userId: 'mgr', isOperative: true }), false)
  assert.equal(canChangePersonPay({ userId: 'admin', isAdmin: true }, { userId: 'admin' }), true)
  assert.equal(canChangePersonPay({ userId: '' , isAdmin: true }, operative), false)
})

// ─── Rulebook 1.2.0 (iOS alignment hand-off) ────────────────────────────────

import * as rulebook from './index.ts'

test('1.2.0 D2: self-book is the permission only; self-book off needs a current active line manager', () => {
  assert.equal(rulebook.canSelfBookAnnualLeave({ id: 'm', permissions: { annualLeaveSelfBook: true } }), true)
  assert.equal(rulebook.canSelfBookAnnualLeave({ id: 'm', annualLeaveSelfBook: true, permissions: { operativeMode: true } }), false)
  assert.equal(rulebook.canSelfBookAnnualLeave({ id: 'm', hasNoLineManager: true }), false)
  assert.equal(rulebook.canSelfBookAnnualLeave(null), false)

  const roster = [{ id: 'LM' }, { id: 'OLD', isActive: false }]
  assert.equal(rulebook.lineManagerRequiredError({ id: 'op' }), rulebook.LINE_MANAGER_REQUIRED_MESSAGE)
  assert.equal(rulebook.lineManagerRequiredError({ id: 'op', assignedManagerUserId: 'LM' }), null)
  assert.equal(rulebook.lineManagerRequiredError({ id: 'op', assignedManagerUserIds: ['OLD'] }, roster), rulebook.LINE_MANAGER_REQUIRED_MESSAGE)
  assert.equal(rulebook.lineManagerRequiredError({ id: 'op', assignedManagerUserIds: ['op'] }), rulebook.LINE_MANAGER_REQUIRED_MESSAGE)
  // Switching self-book off on someone with no line manager is refused; an inactive person passes.
  assert.notEqual(rulebook.lineManagerRequiredError({ id: 'm', annualLeaveSelfBook: false }), null)
  assert.equal(rulebook.lineManagerRequiredError({ id: 'm', isActive: false }), null)
  // 1.3.0: annual leave switched off no longer exempts anyone (timesheets still need approval).
  assert.notEqual(rulebook.lineManagerRequiredError({ id: 'm', annualLeaveEnabled: false }), null)

  // Existing people in that state are listed for admins, and their leave still reaches the admins.
  const role = (r: Partial<{ isAdmin: boolean; isManager: boolean; isOperativeMode: boolean }>) => ({
    isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: false, ...r,
  })
  const people = [
    { id: 'A', role: role({ isAdmin: true }), annualLeaveSelfBook: true },
    { id: 'OP', role: role({ isOperativeMode: true }) },
    { id: 'OP2', role: role({ isOperativeMode: true }), assignedManagerUserIds: ['A'] },
  ]
  // 1.28.0: an admin with Annual Leave Management but Timesheet self-sign off needs a line manager too.
  assert.deepEqual(rulebook.usersMissingLineManager(people), ['A', 'OP'])
  assert.deepEqual(rulebook.usersMissingLineManager([{ ...people[0], timesheetSelfSign: true }, ...people.slice(1)]), ['OP'])
  assert.deepEqual(rulebook.leaveApproverIds(people[1], people), ['A'])
})

test('1.2.0 D3: leave decisions — never your own; admins any; otherwise the approvers', () => {
  const role = (r: Partial<{ isAdmin: boolean; isSuperAdmin: boolean; isManager: boolean; isOperativeMode: boolean }>) => ({
    isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: false, ...r,
  })
  const roster = [
    { id: 'SA', role: role({ isSuperAdmin: true }) },
    { id: 'LM', role: role({ isManager: true }) },
    { id: 'M2', role: role({ isManager: true }) },
    { id: 'OP', role: role({ isOperativeMode: true }), assignedManagerUserIds: ['LM'] },
    { id: 'NOLM', role: role({ isOperativeMode: true }) },
  ]
  const viewer = (id: string) => ({ id, role: roster.find((m) => m.id === id)!.role })
  assert.equal(rulebook.canDecideLeave(viewer('SA'), { id: 'SA' }, roster), false)
  assert.equal(rulebook.canDecideLeave(viewer('SA'), roster[3], roster), true)
  assert.equal(rulebook.canDecideLeave(viewer('LM'), roster[3], roster), true)
  assert.equal(rulebook.canDecideLeave(viewer('M2'), roster[3], roster), false)
  // No line manager: the admins, not any manager.
  assert.equal(rulebook.canDecideLeave(viewer('M2'), roster[4], roster), false)
  assert.equal(rulebook.canDecideLeave(viewer('SA'), roster[4], roster), true)
  assert.equal(rulebook.canDecideLeave({ id: '', role: role({ isAdmin: true }) }, roster[3], roster), false)

  const requests = [
    { id: 'r1', userId: 'OP', status: 'pending' },
    { id: 'r2', userId: 'NOLM', status: 'pending' },
    { id: 'r3', userId: 'SA', status: 'pending' },
    { id: 'r4', userId: 'OP', status: 'approved', cancellationRequestedAt: { seconds: 1 } },
    { id: 'r5', userId: 'OP', status: 'approved', cancellationRequestedAt: null },
    { id: 'r6', operativeId: 'NOT-ON-ROSTER', status: 'pending' },
  ]
  assert.deepEqual(rulebook.leaveDecisionQueue(viewer('LM'), requests, roster).map((r) => r.id), ['r1', 'r4'])
  assert.deepEqual(rulebook.leaveDecisionQueue(viewer('SA'), requests, roster).map((r) => r.id), ['r1', 'r2', 'r4', 'r6'])
  assert.deepEqual(rulebook.leaveDecisionQueue(viewer('M2'), requests, roster), [])
})

test('1.2.0 D4: operative clash groups match managerClashGroups semantics and key every overlapping pair', () => {
  const people = { accounts: [{ id: 'U1', email: 'u1@example.com', formerIds: ['OLD'] }], operatives: [{ id: 'O1', email: 'U1@example.com' }] }
  const groups = rulebook.operativeClashGroups({
    people,
    operativeBookings: [
      // Under the catalogue id, the account id and a former invite id: one person.
      { id: 'b3', operativeId: 'O1', dayKey: '2026-10-22', timeSlot: 'FULL DAY' },
      { id: 'b1', operativeId: 'U1', dayKey: '2026-10-22', timeSlot: 'AM' },
      { id: 'b2', operativeId: 'old', dayKey: '2026-10-22', timeSlot: 'PM' },
      // Touching times do not clash.
      { id: 't1', operativeId: 'O1', dayKey: '2026-10-23', timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '12:00' },
      { id: 't2', operativeId: 'O1', dayKey: '2026-10-23', timeSlot: 'CUSTOM_HOURS', workStartTime: '12:00', workEndTime: '16:00' },
    ],
  })
  assert.equal(groups.length, 1)
  const [group] = groups
  assert.deepEqual(group.bookingIds, ['b1', 'b2', 'b3'])
  assert.equal(group.personKey, 'account:u1')
  // AM and PM do not overlap each other; each overlaps the full day.
  assert.deepEqual(group.pairs.map((pair) => pair.clashPairKey), ['b1|b3', 'b2|b3'])
  assert.deepEqual(group.pairs.map((pair) => pair.clashResolutionKey), ['b1|b3', 'b2|b3'])
  assert.equal(group.resolutionKey, rulebook.clashResolutionKey({ bookingAId: 'b1', bookingBId: 'b2' }))

  // Approving the group writes every pair; one pair approved is not enough.
  const writes = group.pairs.map((pair) => rulebook.clashApprovalWrites({ ...pair, approvedByUserId: 'mgr' }))
  assert.deepEqual(writes.map((write) => write.acceptedClash?.documentId), ['b1|b3', 'b2|b3'])
  assert.equal(rulebook.isClashGroupApproved(group, { acceptedClashes: ['b1|b3'] }), false)
  assert.equal(rulebook.isClashGroupApproved(group, { acceptedClashes: ['B1|B3'], approvedKeys: ['b2|b3'] }), true)
  assert.equal(rulebook.isClashGroupApproved({ pairs: [] }, { approvedKeys: ['x'] }), false)

  // A manager or admin's own days are left to managerClashGroups.
  assert.deepEqual(
    rulebook.operativeClashGroups({
      people,
      managerIds: ['U1'],
      operativeBookings: [
        { id: 'b1', operativeId: 'O1', dayKey: '2026-10-22', timeSlot: 'AM' },
        { id: 'b2', operativeId: 'O1', dayKey: '2026-10-22', timeSlot: 'FULL DAY' },
      ],
    }),
    []
  )
})

test('1.2.0 D6 + D19: approvals only count as approved; keys compare without case; stored keys keep their case', () => {
  const records = [
    { id: 'B1|B2', status: 'dismissed' },
    { id: 'mgr-clash-u-2026-10-22-0', status: 'approved' },
  ]
  assert.deepEqual(rulebook.resolvedWarningKeys(records), ['B1|B2', 'mgr-clash-u-2026-10-22-0'])
  assert.deepEqual(rulebook.approvedWarningKeys(records), ['mgr-clash-u-2026-10-22-0'])
  const decisions = { resolvedKeys: rulebook.resolvedWarningKeys(records), approvedKeys: rulebook.approvedWarningKeys(records) }
  // Dismissed: hidden, not approved.
  assert.equal(rulebook.isWarningActive({ resolutionKey: 'b1|b2', bookingAId: 'b1', bookingBId: 'b2' }, decisions), false)
  assert.equal(rulebook.isClashApproved({ bookingAId: 'B1', bookingBId: 'B2' }, decisions), false)
  // Approved (any case).
  assert.equal(rulebook.isClashApproved({ bookingAId: 'x', bookingBId: 'y', resolutionKey: 'MGR-CLASH-U-2026-10-22-0' }, decisions), true)
  // The 1.1.0 call shape (approvals passed as resolvedKeys) still answers the same.
  assert.equal(rulebook.isClashApproved({ bookingAId: 'B1', bookingBId: 'B2' }, { resolvedKeys: ['b1|b2'] }), true)
  // Writers keep the stored case.
  assert.equal(rulebook.clashPairKey('B2', 'B1'), 'B1|B2')
  assert.equal(rulebook.normalizeDocumentId(' AbC '), 'abc')
  assert.equal(rulebook.normalizeDocumentId(null), '')
})

test('1.2.0 D19: a timesheet entry review is found under either letter case; the exact key wins', () => {
  const sheet = {
    extraEntryReviews: {
      'e1': { decision: 'declined', reviewedAmount: 10 },
      'E2': { decision: 'edited', revisedAmount: 5, reviewedAmount: 10 },
      'e2': { decision: 'declined', reviewedAmount: 10 },
    },
  }
  assert.equal(rulebook.timesheetEntryDecision(sheet, { id: 'E1', amount: 10 }).decision, 'declined')
  assert.equal(rulebook.timesheetEntryDecision(sheet, { id: 'E2', amount: 10 }).decision, 'edited')
  assert.equal(rulebook.timesheetEntryDecision(sheet, { id: 'E3', amount: 10 }).source, 'unreviewed')
})

test('1.2.0 D20: timesheetOwnerWriteFields drops sign-off and export fields itself', () => {
  const owner = rulebook.timesheetOwnerWriteFields(
    {
      managerNote: 'n',
      operativeSignedAt: 1,
      operativeSignedAtMs: 1,
      managerSignedAt: 5,
      managerSignedAtMs: 5,
      'managerSignedAt.seconds': 5,
      managerSignedByName: 'Lee',
      managerSignedByUserId: 'lm',
      managerSignatureImageBase64: 'x',
      approvedAt: 5,
      approvedAtMs: 5,
      approvedByName: 'Lee',
      exportedAt: 6,
      exportedAtMs: 6,
    },
    { subjectHasLineManager: true, managerSigned: true }
  )
  assert.deepEqual(owner, { managerNote: 'n', operativeSignedAt: 1, operativeSignedAtMs: 1 })
  for (const key of rulebook.TIMESHEET_MANAGER_SIGN_OFF_FIELDS) assert.equal(key in owner, false)
})

test('1.2.0 D9: a not-found edit replay is final; the old call shape is unchanged', () => {
  assert.equal(rulebook.bookingReplayRefusedIsFinal('permission-denied'), true)
  assert.equal(rulebook.bookingReplayRefusedIsFinal('firestore/permission-denied'), true)
  assert.equal(rulebook.bookingReplayRefusedIsFinal(7), true)
  assert.equal(rulebook.bookingReplayRefusedIsFinal('not-found'), false)
  assert.equal(rulebook.bookingReplayRefusedIsFinal({ code: 'firestore/not-found', isCreate: false }), true)
  assert.equal(rulebook.bookingReplayRefusedIsFinal({ code: 5, isCreate: false }), true)
  assert.equal(rulebook.bookingReplayRefusedIsFinal({ code: 5 }), false)
  assert.equal(rulebook.bookingReplayRefusedIsFinal({ code: 'unavailable', isCreate: false }), false)
  assert.equal(rulebook.bookingReplayRefusedIsFinal({ code: 'permission-denied', isCreate: true }), true)
})

test('1.2.0 D1 + D7 + D8 + D10 (1.33.0): the offline table matches iOS OfflinePolicy ids; delete is queued, no cancel', () => {
  const ids = Object.keys(rulebook.OFFLINE_ACTIONS)
  assert.equal(ids.length, 32) // 1.41.0: booking.replace (online only)
  const allowed = ids.filter((id) => rulebook.offlineAvailability(id) === 'allowedOffline')
  assert.deepEqual(allowed, ['booking.create', 'booking.edit', 'booking.delete', 'annual_leave.request', 'profile.own_fields', 'notifications.own_toggles'])
  assert.equal(rulebook.offlineAvailability('booking.delete'), 'allowedOffline')
  assert.equal(rulebook.offlineAvailability('booking.delete_subcontractor'), 'onlineOnly')
  assert.equal(rulebook.offlineAvailability('booking.replace'), 'onlineOnly')
  assert.equal(rulebook.offlineAvailability('booking.cancel'), 'onlineOnly')
  assert.deepEqual(
    ids.filter((id) => rulebook.offlineAvailability(id) === 'readOnlyOffline'),
    ['view.daily_overview', 'view.warnings', 'view.weekly_report', 'view.my_schedule']
  )
  assert.equal(rulebook.offlineAvailability(' booking.edit '), 'allowedOffline')
  assert.equal(rulebook.offlineAvailability(undefined), 'onlineOnly')
  assert.equal(rulebook.OFFLINE_ONLINE_ONLY_MESSAGE, 'Connect to the internet to change this')
  assert.equal(rulebook.OFFLINE_PENDING_SYNC_LABEL, 'Pending sync')
  assert.equal(rulebook.offlineLastUpdatedLabel(Date.parse('2026-10-24T13:05:00Z'), 'Europe/London'), 'Last updated 24 Oct 2026, 14:05')
  assert.equal(rulebook.offlineLastUpdatedLabel(new Date('2026-09-01T00:00:00Z'), null), 'Last updated 1 Sep 2026, 01:00')
  assert.equal(rulebook.offlineLastUpdatedLabel('not a date', 'Europe/London'), null)

  // The iOS table: every id in OfflinePolicy.swift is here (1.33.0: no `booking.cancel`, a `booking.delete_subcontractor`).
  // Only when the iOS repo is checked out beside this one (local runs); CI has web alone, and iOS checks
  // the same ids from its side (OfflineBookingTombstoneTests).
  const swiftUrl = new URL('../../../project-planner-ios/Project Planner/Core/Offline/OfflinePolicy.swift', import.meta.url)
  if (existsSync(swiftUrl)) {
    const swift = readFileSync(swiftUrl, 'utf8')
    const swiftIds = [...swift.matchAll(/case \w+ = "([a-z_]+\.[a-z_]+)"/g)].map((match) => match[1])
    if (swiftIds.length > 0) assert.deepEqual([...swiftIds].sort(), [...ids].sort())
  }

  // Tombstones carry only their own fields (no write metadata).
  const tombstone = rulebook.bookingTombstoneWriteFields({ bookingId: 'B', collection: 'bookings', deletedBy: 'u', deletedFrom: 'ios' })
  assert.deepEqual(Object.keys(tombstone || {}).sort(), ['bookingId', 'collection', 'deletedBy', 'deletedFrom'])
})

test('1.2.0 D11: unbookedScanDays matches the unbooked loop in every mode', () => {
  const base = { referenceIso: '2026-10-28T10:00:00.000Z', timeZone: 'Europe/London' }
  const fullOff = rulebook.unbookedScanDays({ ...base, clashLookaheadMode: 'endOfWorkingWeek' })
  assert.deepEqual(fullOff.dayKeys, ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'])
  const fullOn = rulebook.unbookedScanDays({ ...base, clashLookaheadMode: 'endOfWorkingWeek', includeWeekends: true })
  assert.equal(fullOn.endDayKey, '2026-11-01')
  assert.equal(fullOn.dayKeys.length, 7)
  const invoicing = rulebook.unbookedScanDays({ ...base, clashLookaheadMode: 'endOfInvoicingPeriod', includeWeekends: false })
  const window = rulebook.coverageWindow({ ...base, clashLookaheadMode: 'endOfInvoicingPeriod' })
  assert.equal(invoicing.startDayKey, window.startDayKey)
  assert.equal(invoicing.endDayKey, window.endDayKey)
  assert.ok(invoicing.dayKeys.every((key) => ![6, 7].includes(new Date(`${key}T12:00:00Z`).getUTCDay() || 7)))

  // The days unbookedLabourRows reports on are exactly these days for a person never booked.
  const rowsFor = (scan: { startDayKey: string; endDayKey: string }, includeWeekends: boolean) =>
    rulebook.unbookedLabourRows({
      timeZone: 'Europe/London',
      startDayKey: scan.startDayKey,
      endDayKey: scan.endDayKey,
      includeWeekends,
      standardPaidHours: 8,
      saturdayCountsAsHours: 8,
      sundayCountsAsHours: 8,
      people: [{ id: 'u1', email: 'u1@example.com', firstName: 'U', surname: 'One', isActive: true, passwordSet: true, isOperativeMode: true } as never],
      operatives: [],
      bookings: [],
      holidays: [],
    }).map((row) => row.dayKey)
  assert.deepEqual(rowsFor(fullOn, true), fullOn.dayKeys)
  assert.deepEqual(rowsFor(fullOff, false), fullOff.dayKeys)
})

test('1.2.0 D12 + D13: lookahead notice copy and the platform owner email', () => {
  assert.match(rulebook.warningLookaheadFallbackNotice('lookaheadDaysMissing') || '', /^No number of days is saved/)
  assert.match(rulebook.warningLookaheadFallbackNotice('lookaheadDaysInvalid') || '', /not valid/)
  assert.equal(rulebook.warningLookaheadFallbackNotice(undefined), null)
  assert.equal(rulebook.isPlatformOwnerEmail('INFO@projectplanner.us'), true)
  assert.equal(rulebook.isPlatformOwnerEmail(''), false)
  assert.equal(rulebook.isPlatformOwnerEmail(null), false)
  assert.equal(rulebook.passwordMinLength(), 8)
  assert.equal(rulebook.passwordMinLength({ developerAccount: true }), 10)
  assert.equal(rulebook.passwordMinLength({ email: 'someone@example.com' }), 8)
  assert.equal(rulebook.passwordPolicyError('123456789', { email: 'info@projectplanner.us' }), 'Password must be at least 10 characters.')
})

test('1.2.0 D15 + D23: a cleared rate is "rate not set" from its day; history days are organisation-zone midnight', () => {
  const user = { id: 'U', employmentType: 'self_employed' }
  const history = [
    { id: 'h', userId: 'U', dayRate: 20, payBasis: 'hourly', effectiveAt: Date.parse('2026-10-01T00:00:00+01:00') },
    { id: 'c', userId: 'U', dayRate: null, payBasis: null, effectiveAt: Date.parse('2026-10-10T00:00:00+01:00') },
    { id: 'd', userId: 'U', dayRate: 180, payBasis: 'day', effectiveAt: Date.parse('2026-10-20T00:00:00+01:00') },
  ]
  const on = (dayKey: string) => rulebook.payRateOnDay({ user: { ...user, payBasis: 'hourly', hourlyRate: 20 }, history, dayKey, timeZone: 'Europe/London' })
  assert.equal(on('2026-10-09').rate, 20)
  // The clear ends the hourly row too.
  assert.deepEqual([on('2026-10-10').rate, on('2026-10-10').hasRate], [null, false])
  assert.equal(on('2026-10-19').hasRate, false)
  assert.equal(on('2026-10-20').rate, 180)

  const bst = rulebook.payRateHistoryWriteFields({ userId: 'U', rate: 0, payBasis: 'day', effective: '2026-10-21', timeZone: 'Europe/London' })
  assert.equal(bst?.dayRate, 0)
  assert.equal(bst?.effectiveAtMs, Date.parse('2026-10-20T23:00:00Z'))
  const gmt = rulebook.payRateHistoryWriteFields({ operativeId: 'O', rate: 200, effective: new Date('2026-11-02T15:00:00Z'), timeZone: 'Europe/London' })
  assert.equal(gmt?.effectiveAtMs, Date.parse('2026-11-02T00:00:00Z'))
  assert.equal(gmt?.payBasis, 'day')
  const cleared = rulebook.payRateHistoryWriteFields({ userId: 'U', rate: null, payBasis: 'hourly', effective: '2026-10-21' })
  assert.deepEqual([cleared?.dayRate, cleared?.payBasis], [null, null])
  assert.equal(rulebook.payRateHistoryWriteFields({ rate: 1, effective: '2026-10-21' }), null)
  assert.equal(rulebook.payRateHistoryWriteFields({ userId: 'U', rate: 1, effective: 'soon' }), null)
})

test('1.2.0 D16 + D17: document shapes are in the packed surface; profilePhotoUpdatedAt is a user field', () => {
  const surface = bundleSurface as unknown as Record<string, unknown>
  assert.ok(Array.isArray(surface.ORGANIZATION_DOCUMENT_FIELDS))
  assert.ok(Array.isArray(surface.USER_DOCUMENT_FIELDS))
  assert.equal(typeof surface.OPERATIONAL_COLLECTION_PATHS, 'object')
  assert.ok((rulebook.USER_DOCUMENT_FIELDS as readonly string[]).includes('profilePhotoUpdatedAt'))
})

test('1.2.0 D22: PAYE days and leave lines never go on an invoice, live or signed-sheet', () => {
  const lines = [
    { id: 'a', pay: 100 },
    { id: 'b', isPaye: true, pay: 0 },
    { id: 'c', employmentType: 'paye' },
    { id: 'd', isLeave: true },
    { id: 'e', isPayeDay: true },
  ]
  assert.deepEqual(rulebook.invoiceLines(lines).map((line) => line.id), ['a'])
  assert.equal(rulebook.isInvoiceLine(null), false)
  assert.deepEqual(rulebook.invoiceLines(null), [])
})

// ─── Rulebook 1.3.0 (line managers and notification recipients) ─────────────

function role130(r: Partial<{ isSuperAdmin: boolean; isAdmin: boolean; isManager: boolean; isOperativeMode: boolean }>) {
  return { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: false, ...r }
}

const roster130 = [
  { id: 'ADMIN', email: 'admin@example.com', role: role130({ isAdmin: true }) },
  { id: 'ADMIN_LM', email: 'admin-lm@example.com', role: role130({ isAdmin: true }), assignedManagerUserIds: ['LM'] },
  { id: 'SA', email: 'sa@example.com', role: role130({ isSuperAdmin: true }) },
  { id: 'LM', email: 'lm@example.com', role: role130({ isManager: true }), assignedManagerUserIds: ['ADMIN'], formerUserIds: ['LM-OLD'] },
  { id: 'LM2', email: 'lm2@example.com', role: role130({ isManager: true }), assignedManagerUserIds: ['ADMIN'] },
  { id: 'GONE', role: role130({ isManager: true }), isActive: false },
  { id: 'MGR', email: 'mgr@example.com', role: role130({ isManager: true }), annualLeaveSelfBook: true },
  { id: 'OP', email: 'op@example.com', role: role130({ isOperativeMode: true }), assignedManagerUserIds: ['LM', 'LM2', 'GONE'] },
  { id: 'OP-STUB', email: 'Op@Example.com', role: role130({ isOperativeMode: true }) },
  { id: 'LEGACY', role: role130({ isOperativeMode: true }) },
]

test('1.3.0 A: every operative and manager needs a line manager; only admins outside operative mode may have none', () => {
  const msg = rulebook.LINE_MANAGER_REQUIRED_MESSAGE
  assert.equal(msg, "Set a line manager — this person's timesheets and annual leave need approval.")
  // A manager without a line manager is refused, self-book permission or not.
  assert.equal(rulebook.lineManagerRequiredError(roster130[6], roster130), msg)
  assert.equal(rulebook.lineManagerRequiredError({ id: 'M', role: 'manager', annualLeaveSelfBook: true }), msg)
  // 1.28.0: an admin without one needs both self-manage toggles; an admin with one is fine; the Super Admin always is.
  // 1.11.0: an admin has no operative mode, so a stray flag does not change which message applies.
  assert.equal(rulebook.lineManagerRequiredError(roster130[0], roster130), rulebook.ADMIN_LINE_MANAGER_REQUIRED_MESSAGE)
  assert.equal(
    rulebook.lineManagerRequiredError({ ...roster130[0], annualLeaveSelfBook: true, timesheetSelfSign: true }, roster130),
    null
  )
  assert.equal(rulebook.lineManagerRequiredError(roster130[1], roster130), null)
  assert.equal(rulebook.lineManagerRequiredError(roster130[2], roster130), null)
  assert.equal(rulebook.lineManagerRequiredError({ id: 'A', role: 'admin', operativeMode: true }), rulebook.ADMIN_LINE_MANAGER_REQUIRED_MESSAGE)
  assert.equal(rulebook.lineManagerRequired({ id: 'O', role: 'operative', isActive: false }), false)
  assert.deepEqual(rulebook.usersMissingLineManager(roster130), ['ADMIN', 'MGR', 'OP-STUB', 'LEGACY'])
})

test('1.3.0 A4 (1.28.0): self-approval follows the self-manage toggles, not the missing line manager', () => {
  // 1.28.0: no line manager alone no longer self-approves; the toggles do (line manager or not).
  assert.equal(rulebook.timesheetSelfSigned(roster130[0], roster130), false)
  assert.equal(rulebook.canSelfBookAnnualLeave(roster130[0], roster130), false)
  const admin = { ...roster130[0], annualLeaveSelfBook: true, timesheetSelfSign: true }
  const adminLm = roster130[1]
  assert.equal(rulebook.timesheetSelfSigned(admin, roster130), true)
  assert.equal(rulebook.canSelfBookAnnualLeave(admin, roster130), true)
  assert.equal(rulebook.leaveSubmitLabel(admin, roster130), rulebook.LEAVE_SUBMIT_LABEL)
  assert.equal(rulebook.LEAVE_SUBMIT_LABEL, 'Submit')
  assert.equal(rulebook.timesheetSelfSigned(adminLm, roster130), false)
  assert.equal(rulebook.canSelfBookAnnualLeave(adminLm, roster130), false)
  assert.equal(rulebook.leaveSubmitLabel(adminLm, roster130), 'Submit request')
  // 1.28.0: an admin whose only line manager left is not self-approved by that; the toggle is.
  assert.equal(rulebook.timesheetSelfSigned({ ...adminLm, assignedManagerUserIds: ['GONE'] }, roster130), false)
  assert.equal(rulebook.timesheetSelfSigned({ ...adminLm, timesheetSelfSign: true }, roster130), true)
  // Self-signed owner saves may carry weeklyReportOverride; others may not.
  const fields = { weeklyReportOverride: { lines: [] }, managerNote: 'n' }
  assert.ok('weeklyReportOverride' in rulebook.timesheetOwnerWriteFields(fields, { subjectHasLineManager: !rulebook.timesheetSelfSigned(admin, roster130), managerSigned: false }))
  assert.equal('weeklyReportOverride' in rulebook.timesheetOwnerWriteFields(fields, { subjectHasLineManager: !rulebook.timesheetSelfSigned(adminLm, roster130), managerSigned: false }), false)
  // A manager or operative is never self-approved, even with no line manager.
  assert.equal(rulebook.timesheetSelfSigned(roster130[9], roster130), false)
  assert.equal(rulebook.canSelfBookAnnualLeave(roster130[9], roster130), false)
  // The permission still self-books a manager (it no longer waives the line manager).
  assert.equal(rulebook.canSelfBookAnnualLeave(roster130[6], roster130), true)
})

test('1.3.0 A5/A6: approvers are active line managers, never the person under any id; else admins only', () => {
  assert.deepEqual(rulebook.lineManagerIds(roster130[7], roster130), ['LM', 'LM2'])
  assert.deepEqual(rulebook.lineManagerIds({ id: 'OP', assignedManagerUserIds: ['op-stub', 'LM'] }, roster130), ['LM'])
  assert.deepEqual(rulebook.lineManagerIds({ id: 'X', assignedManagerUserIds: ['LM-OLD'] }, roster130), ['LM'])
  assert.deepEqual(rulebook.leaveApproverIds(roster130[9], roster130), ['ADMIN', 'ADMIN_LM', 'SA'])
  // Legacy no-line-manager request: a plain manager may not decide it.
  assert.equal(rulebook.canDecideLeave({ id: 'LM2', role: roster130[4].role }, roster130[9], roster130), false)
  assert.equal(rulebook.canDecideLeave({ id: 'OP-STUB', role: role130({ isAdmin: true }) }, roster130[7], roster130), false)
})

test('1.3.0 B: notification recipients never include the actor', () => {
  assert.deepEqual(rulebook.personIdSet({ id: 'OP' }, roster130), ['OP', 'OP-STUB'])
  assert.deepEqual(rulebook.timesheetSubmittedRecipients('OP', roster130), ['LM', 'LM2'])
  assert.deepEqual(rulebook.timesheetSubmittedRecipients('LEGACY', roster130), ['ADMIN', 'ADMIN_LM', 'SA'])
  // 1.28.0: an admin with Timesheet self-sign off and no line manager goes to the other admins; with it on, nobody.
  assert.deepEqual(rulebook.timesheetSubmittedRecipients('ADMIN', roster130), ['ADMIN_LM', 'SA'])
  assert.deepEqual(rulebook.timesheetSubmittedRecipients({ id: 'ADMIN', timesheetSelfSign: true }, roster130), [])
  assert.deepEqual(rulebook.timesheetSubmittedRecipients('SA', roster130), [])
  assert.deepEqual(rulebook.timesheetSubmittedRecipients('ADMIN_LM', roster130), ['LM'])
  assert.deepEqual(rulebook.timesheetSignedRecipients('OP', 'LM', roster130), ['OP'])
  assert.deepEqual(rulebook.timesheetSignedRecipients('OP', 'OP-STUB', roster130), [])
  assert.deepEqual(rulebook.lineManagerPeerRecipients('OP', 'LM-OLD', roster130), ['LM2'])
  assert.deepEqual(rulebook.holidayRequestRecipients('OP', roster130), ['LM', 'LM2'])
  assert.deepEqual(rulebook.holidayRequestRecipients('ADMIN', roster130), ['ADMIN_LM', 'SA'])
  assert.deepEqual(rulebook.holidayRequestRecipients({ id: 'ADMIN', annualLeaveSelfBook: true }, roster130), [])
  assert.deepEqual(rulebook.holidayRequestRecipients('SA', roster130), [])
  assert.deepEqual(rulebook.holidayRequestRecipients('MGR', roster130), [])
  assert.deepEqual(rulebook.holidayDecisionRecipients('OP', 'op-stub', roster130), [])
  assert.deepEqual(rulebook.bookingCreatedRecipients(['OP', 'LM', 'GONE'], 'LM', roster130), ['OP'])
  assert.deepEqual(rulebook.deadlineAssignedRecipients(['OP', 'LM'], 'OP', roster130), ['LM'])
  assert.deepEqual(rulebook.toolboxTalkRecipients(['ADMIN', 'OP'], { id: 'ADMIN' }, roster130), ['OP'])
  assert.deepEqual(rulebook.ideaRecipients(['SA', 'sa', 'LM'], null, roster130), ['SA', 'LM'])
  assert.deepEqual(rulebook.excludeActor(['A', 'a', ''], null), ['A'])
})

test('1.3.0 B: the notification catalog covers each written type once and matches the push allow-list', () => {
  const types = rulebook.NOTIFICATION_CATALOG.map((row) => row.type)
  assert.equal(new Set(types).size, types.length)
  const surface = bundleSurface as unknown as Record<string, unknown>
  for (const row of rulebook.NOTIFICATION_CATALOG) {
    assert.equal(row.devicePush, rulebook.notificationDeliversDevicePush(row.type), row.type)
    assert.ok(row.writtenBy.length > 0, row.type)
    const named = row.recipients.match(/^[a-zA-Z]+/)?.[0] ?? ''
    if (/Recipients$|^excludeActor$|^receivesJobNotification$|^dueTimesheetSubmissionNotices$/.test(named)) {
      assert.equal(typeof surface[named], 'function', `${row.type}: ${named} is in the packed script`)
    }
  }
  for (const type of ['holiday_request_submitted', 'timesheet_pending_manager_signoff', 'line_manager_peer_update', 'booking_created', 'idea_merged']) {
    assert.ok(types.includes(type), type)
  }
  assert.equal(rulebook.notificationCatalogRow('line_manager_peer_update')?.devicePush, false)
  assert.equal(rulebook.notificationCatalogRow('nope'), null)
  // The rulebook §13 table lists every catalog type.
  const book = readFileSync(new URL('../../docs/RULEBOOK.md', import.meta.url), 'utf8')
  for (const type of types) assert.ok(book.includes(`| \`${type}\``), `RULEBOOK §13 lists ${type}`)
})

test('1.3.0 B: timesheet notice de-dupe keys use the organisation-zone day', () => {
  assert.equal(
    rulebook.timesheetNotificationDedupeKey({ type: 'timesheet_pending_manager_signoff', subjectId: 'OP', recipientId: 'LM', periodStartDayKey: '2026-10-01', timeZone: 'Europe/London' }),
    `timesheetPending|OP|LM|${Date.parse('2026-09-30T23:00:00Z') / 1000}`
  )
  assert.equal(rulebook.timesheetNotificationDedupeKey({ type: 'timesheet_pending_manager_signoff', subjectId: 'OP', periodStartDayKey: '2026-10-01' }), null)
  assert.equal(rulebook.timesheetNotificationDedupeKey({ type: 'timesheet_signed_by_manager', subjectId: 'OP', periodStartDayKey: 'bad' }), null)
})

test('1.4.0: bank-holiday regions are one list per country, and a country change asks for the region', () => {
  const ids = (country: string) => rulebook.bankHolidayRegionsForCountry(country).map((region) => region.id)
  assert.deepEqual(ids('GB'), ['GB-ENG-WLS', 'GB-SCT', 'GB-NIR', 'GB'])
  assert.deepEqual(ids('ie'), ['IE'])
  assert.deepEqual(ids('US'), ['US'])
  assert.deepEqual(ids('ZZ'), [])
  assert.equal(rulebook.defaultBankHolidayRegionForCountry('GB'), 'GB-ENG-WLS')
  assert.equal(rulebook.defaultBankHolidayRegionForCountry('IE'), 'IE')
  assert.equal(rulebook.defaultBankHolidayRegionForCountry('US'), 'US')
  assert.equal(rulebook.defaultBankHolidayRegionForCountry('ZZ'), null)
  assert.equal(rulebook.DEFAULT_BANK_HOLIDAY_REGION_ID, 'GB-ENG-WLS')
  assert.equal(rulebook.normalizeBankHolidayRegionId('gb-eng'), 'GB-ENG-WLS')
  assert.equal(rulebook.bankHolidayRegionLabel('GB-SCT'), 'Scotland')
  const ids2 = rulebook.BANK_HOLIDAY_REGIONS.map((region) => region.id)
  assert.equal(new Set(ids2).size, ids2.length)

  // Same country: never required. A region already in the new country: not required.
  assert.deepEqual(rulebook.companyDetailsRegionPrompt({ countryCode: 'GB', bankHolidayRegionId: 'GB-SCT' }, { countryCode: 'GB' }), { required: false })
  assert.deepEqual(rulebook.companyDetailsRegionPrompt({ countryCode: 'GB', bankHolidayRegionId: 'IE' }, { countryCode: 'IE' }), { required: false })
  const toIreland = rulebook.companyDetailsRegionPrompt({ countryCode: 'GB', bankHolidayRegionId: 'GB-ENG-WLS' }, { countryCode: 'IE' })
  assert.equal(toIreland.required, true)
  if (toIreland.required) {
    assert.deepEqual(toIreland.choices.map((region) => region.id), ['IE'])
    assert.equal(toIreland.defaultRegionId, 'IE')
    assert.equal(toIreland.message, 'Choose the bank holidays for Ireland.')
  }
  const toUk = rulebook.companyDetailsRegionPrompt({ countryCode: 'IE', bankHolidayRegionId: 'IE' }, { countryCode: 'GB' })
  assert.equal(toUk.required && toUk.defaultRegionId, 'GB-ENG-WLS')

  // Validation refuses the save until a region from the new country is chosen; the write carries both fields.
  const base = { name: 'Acme', hasOfficeAddress: false, countryCode: 'IE', previous: { countryCode: 'GB', bankHolidayRegionId: 'GB-ENG-WLS' } }
  assert.equal(rulebook.companyDetailsValidationError({ ...base }), 'Choose the bank holidays for Ireland.')
  assert.equal(rulebook.companyDetailsValidationError({ ...base, bankHolidayRegionId: 'GB-SCT' }), 'Choose the bank holidays for Ireland.')
  assert.equal(rulebook.companyDetailsValidationError({ ...base, bankHolidayRegionId: 'IE' }), null)
  assert.equal(rulebook.companyDetailsValidationError({ name: 'Acme', hasOfficeAddress: false, countryCode: 'GB', previous: { countryCode: 'GB' } }), null)
  const write = rulebook.companyDetailsWriteFields({ ...base, bankHolidayRegionId: 'IE' })
  assert.equal(write.set.countryCode, 'IE')
  assert.equal(write.set.bankHolidayRegionId, 'IE')
  assert.equal(write.set['settings.bankHolidayRegionId'], 'IE')
})

test('1.4.0: company activity goes to active admins outside operative mode, never the actor; admin-only toggle', () => {
  const roster = [
    { id: 'A1', email: 'a1@x', isActive: true, role: 'admin', adminAccess: true },
    { id: 'A2', email: 'a2@x', isActive: true, role: 'super_admin', isSuperAdmin: true },
    { id: 'A3', email: 'a3@x', isActive: false, role: 'admin', adminAccess: true },
    { id: 'A4', email: 'a4@x', isActive: true, role: 'admin', adminAccess: true, permissions: { operativeMode: true }, operativeMode: true },
    { id: 'M1', email: 'm1@x', isActive: true, role: 'manager', manager: true },
    { id: 'O1', email: 'o1@x', isActive: true, role: 'operative', operativeMode: true },
  ]
  // 1.11.0: A4 (an admin with a stray operative-mode flag) is an admin — admins have no operative mode.
  const recipients = rulebook.companyActivityRecipients('A1', roster as never)
  assert.deepEqual(recipients, ['A2', 'A4'])
  assert.deepEqual(rulebook.companyActivityRecipients('M1', roster as never), ['A1', 'A2', 'A4'])
  assert.deepEqual([...rulebook.COMPANY_ACTIVITY_NOTICE_TYPES].sort(), ['annual_leave_adjusted', 'client_created', 'job_manager_removed', 'manager_created', 'operative_created', 'operative_deleted', 'project_created', 'small_works_created', 'warning_removed'])
  for (const type of rulebook.COMPANY_ACTIVITY_NOTICE_TYPES) {
    assert.equal(rulebook.notificationPreferenceKeyForType(type), 'companyActivity', type)
    assert.equal(rulebook.notificationDeliversDevicePush(type), true, type)
    assert.equal(rulebook.notificationCatalogRow(type)?.recipients, 'companyActivityRecipients', type)
  }
  const adminRole = { isSuperAdmin: false, isAdmin: true, isManager: false, isOperativeMode: false }
  const managerRole = { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }
  const audience = (role: typeof adminRole) => ({ role, catalogue: { projects: true, smallWorks: true } })
  assert.equal(rulebook.visibleNotificationPreferenceKeys(audience(adminRole)).includes('companyActivity'), true)
  assert.equal(rulebook.visibleNotificationPreferenceKeys(audience({ ...adminRole, isAdmin: false, isSuperAdmin: true })).includes('companyActivity'), true)
  assert.equal(rulebook.visibleNotificationPreferenceKeys(audience(managerRole)).includes('companyActivity'), false)
  assert.equal(rulebook.parseUserNotificationPreferences({}).companyActivity, true)
  assert.equal(rulebook.notificationPreferenceCopy('companyActivity', audience(adminRole)).label, 'Company activity')
})

test('1.4.0: push_test reaches its sender and is the only type pushed to its actor', () => {
  assert.equal(rulebook.PUSH_TEST_NOTICE_TYPE, 'push_test')
  assert.deepEqual(rulebook.pushTestRecipients('U1'), ['U1'])
  assert.deepEqual(rulebook.pushTestRecipients(null), [])
  assert.equal(rulebook.notificationDeliversDevicePush('push_test'), true)
  assert.equal(rulebook.notificationPushesToActor('push_test'), true)
  const everyOff = Object.fromEntries(rulebook.NOTIFICATION_PREFERENCE_KEYS.map((key) => [key, false]))
  assert.equal(rulebook.notificationPreferenceAllowsDelivery(rulebook.parseUserNotificationPreferences(everyOff), 'push_test'), true)
  for (const type of rulebook.DEVICE_PUSH_NOTIFICATION_TYPES) {
    if (type !== 'push_test') assert.equal(rulebook.notificationPushesToActor(type), false, type)
  }
  assert.equal(rulebook.notificationPushesToActor('timesheet_pending_manager_signoff'), false)
})

import {
  holidayDocumentDayKey,
  labourHolidayInput,
  parseHolidayDocument,
  parseHolidayDocuments,
} from './holidayDocument.ts'
import { normalizeHolidayStatus as normalizeLeaveStatus, normalizeHolidayTimeSlot as normalizeLeaveSlot } from './leaveRequests.ts'

// 1.5.0 — one reader for holidayBookings documents on every platform.
const HD_LONDON = 'Europe/London'
// 2026-11-09 00:00 GMT and 2026-11-13 00:00 GMT as Firestore timestamps.
const HD_NOV9 = { seconds: Date.UTC(2026, 10, 9) / 1000, nanoseconds: 0 }
const HD_NOV13 = { seconds: Date.UTC(2026, 10, 13) / 1000, nanoseconds: 0 }

test('parseHolidayDocument reads a web-written record', () => {
  const parsed = parseHolidayDocument(
    'abc-web',
    {
      id: 'abc-web',
      organizationId: 'ORG',
      userId: 'u1',
      operativeId: null,
      startDate: HD_NOV9,
      endDate: HD_NOV13,
      status: 'pending',
      timeSlot: 'FULL DAY',
      approvedByUserId: null,
      cancellationRequestedAt: null,
    },
    HD_LONDON
  )
  assert.deepEqual(parsed, {
    id: 'abc-web',
    userId: 'u1',
    operativeId: null,
    startDayKey: '2026-11-09',
    endDayKey: '2026-11-13',
    timeSlot: 'FULL DAY',
    status: 'pending',
    approved: false,
    approvedByUserId: null,
    cancellationRequested: false,
    cancellationRequestedByUserId: null,
    decisionNote: null,
    organizationId: 'ORG',
  })
})

test('parseHolidayDocument reads an iOS-written record (upper-case UUID ids, approvedBy, note, cancellation)', () => {
  const parsed = parseHolidayDocument(
    'D7A3C1E2-0000-4000-8000-0000000000AA',
    {
      userId: 'AuthUid9',
      operativeId: 'B1C2D3E4-0000-4000-8000-0000000000BB',
      startDate: HD_NOV9,
      endDate: HD_NOV9,
      status: 'approved',
      timeSlot: 'PM',
      approvedBy: 'MgrUid',
      note: '  enjoy  ',
      cancellationRequestedAt: { seconds: 1, nanoseconds: 0 },
      cancellationRequestedByUserId: 'AuthUid9',
    },
    HD_LONDON
  )
  assert.equal(parsed?.id, 'D7A3C1E2-0000-4000-8000-0000000000AA')
  assert.equal(parsed?.operativeId, 'B1C2D3E4-0000-4000-8000-0000000000BB')
  assert.equal(parsed?.timeSlot, 'PM')
  assert.equal(parsed?.approved, true)
  assert.equal(parsed?.approvedByUserId, 'MgrUid')
  assert.equal(parsed?.decisionNote, 'enjoy')
  assert.equal(parsed?.cancellationRequested, true)
  assert.equal(parsed?.cancellationRequestedByUserId, 'AuthUid9')
  assert.equal(parsed?.organizationId, undefined)
})

test('parseHolidayDocument: the id is the document id, not a stored id field', () => {
  assert.equal(parseHolidayDocument('DocId', { id: 'other', startDate: '2026-11-09' })?.id, 'DocId')
  assert.equal(parseHolidayDocument('', { startDate: '2026-11-09' }), null)
})

test('parseHolidayDocument keeps a non-UUID operativeId (iOS used to drop it)', () => {
  const parsed = parseHolidayDocument('h1', { operativeId: 'op-legacy-7', startDate: '2026-11-09' }, HD_LONDON)
  assert.equal(parsed?.operativeId, 'op-legacy-7')
  assert.equal(parsed?.userId, null)
})

test('parseHolidayDocument reads legacy keys', () => {
  assert.deepEqual(
    pickHoliday(parseHolidayDocument('h', { start_date: '2026-11-09', end_date: '2026-11-10', uid: 'U' }, HD_LONDON)),
    ['U', null, '2026-11-09', '2026-11-10']
  )
  assert.deepEqual(
    pickHoliday(parseHolidayDocument('h', { from: '09/11/2026', to: '2026/11/11', user: { id: 'Nested' } }, HD_LONDON)),
    ['Nested', null, '2026-11-09', '2026-11-11']
  )
  assert.deepEqual(
    pickHoliday(parseHolidayDocument('h', { date: HD_NOV9, user_id: 'X', operative_id: 'op' }, HD_LONDON)),
    ['X', 'op', '2026-11-09', '2026-11-09']
  )
  assert.deepEqual(
    pickHoliday(parseHolidayDocument('h', { holidayStart: HD_NOV9.seconds * 1000, holidayEnd: HD_NOV13.seconds, employeeUserId: 'E' }, HD_LONDON)),
    ['E', null, '2026-11-09', '2026-11-13']
  )
  assert.equal(parseHolidayDocument('h', { endDate: HD_NOV9, userId: 'u' }, HD_LONDON), null)
  assert.equal(parseHolidayDocument('h', { startDate: 'not a date' }, HD_LONDON), null)
})

function pickHoliday(record: ReturnType<typeof parseHolidayDocument>) {
  return record ? [record.userId, record.operativeId, record.startDayKey, record.endDayKey] : null
}

test('parseHolidayDocument status synonyms: missing and unknown are approved', () => {
  const status = (data: Record<string, unknown>) => parseHolidayDocument('h', { startDate: '2026-11-09', ...data })?.status
  assert.equal(status({ status: 'declined' }), 'rejected')
  assert.equal(status({ status: 'Cancelled' }), 'rejected')
  assert.equal(status({ status: 'canceled' }), 'rejected')
  assert.equal(status({ status: 'denied' }), 'rejected')
  assert.equal(status({ status: 'requested' }), 'pending')
  assert.equal(status({ holidayStatus: 'Awaiting_Approval' }), 'pending')
  assert.equal(status({ approvalStatus: 'submitted' }), 'pending')
  assert.equal(status({ status: 'confirmed' }), 'approved')
  assert.equal(status({}), 'approved')
  assert.equal(status({ status: 'something else' }), 'approved')
  assert.equal(normalizeLeaveStatus('DECLINED'), 'rejected')
  assert.equal(normalizeLeaveSlot('morning'), 'AM')
  assert.equal(normalizeLeaveSlot('Afternoon'), 'PM')
  assert.equal(parseHolidayDocument('h', { startDate: '2026-11-09', halfDay: 'a.m.' })?.timeSlot, 'AM')
})

test('parseHolidayDocument: a BST-evening timestamp is the next organisation day', () => {
  // 2026-07-14 23:30 UTC is 2026-07-15 00:30 in London (BST).
  const evening = { seconds: Date.UTC(2026, 6, 14, 23, 30) / 1000, nanoseconds: 0 }
  const parsed = parseHolidayDocument('h', { startDate: evening, endDate: { _seconds: evening.seconds, _nanoseconds: 0 } }, HD_LONDON)
  assert.equal(parsed?.startDayKey, '2026-07-15')
  assert.equal(parsed?.endDayKey, '2026-07-15')
  assert.equal(holidayDocumentDayKey('2026-07-14T23:30:00Z', HD_LONDON), '2026-07-15')
  assert.equal(holidayDocumentDayKey(new Date(evening.seconds * 1000), HD_LONDON), '2026-07-15')
  assert.equal(holidayDocumentDayKey({ toDate: () => new Date(evening.seconds * 1000) }, HD_LONDON), '2026-07-15')
  assert.equal(holidayDocumentDayKey(0, HD_LONDON), '')
})

test('parseHolidayDocument swaps a reversed range', () => {
  const parsed = parseHolidayDocument('h', { startDate: HD_NOV13, endDate: HD_NOV9 }, HD_LONDON)
  assert.deepEqual([parsed?.startDayKey, parsed?.endDayKey], ['2026-11-09', '2026-11-13'])
})

test('parseHolidayDocuments drops unreadable documents', () => {
  const parsed = parseHolidayDocuments(
    [
      { id: 'a', data: { startDate: '2026-11-09' } },
      { id: 'b', data: {} },
      { id: 'c', data: null },
    ],
    HD_LONDON
  )
  assert.deepEqual(parsed.map((row) => row.id), ['a'])
})

test('unbookedLabourRows given parseHolidayDocument output: an admin on approved leave is not unbooked', () => {
  // The divergence: a self-booked admin record with only userId (no operativeId, no status).
  const record = parseHolidayDocument('LEAVE-1', { userId: 'ADMIN-1', startDate: HD_NOV9, endDate: HD_NOV13 }, HD_LONDON)
  assert.ok(record)
  const input = {
    timeZone: HD_LONDON,
    startDayKey: '2026-11-09',
    endDayKey: '2026-11-16',
    includeWeekends: false,
    standardPaidHours: 8,
    saturdayCountsAsHours: 8,
    sundayCountsAsHours: 8,
    people: [
      {
        id: 'ADMIN-1',
        email: 'boss@site.test',
        name: 'Boss Admin',
        isActive: true,
        passwordSet: true,
        isOperativeMode: false,
        isManager: false,
        isAdmin: true,
        isSuperAdmin: false,
      },
    ],
    operatives: [],
    bookings: [],
  }
  const withLeave = unbookedLabourRows({ ...input, holidays: [labourHolidayInput(record)] })
  const days = withLeave.filter((row) => row.userId === 'ADMIN-1' || row.operativeId === 'ADMIN-1').map((row) => row.dayKey)
  for (const day of ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13']) {
    assert.equal(days.includes(day), false, `${day} is covered by leave`)
  }
  assert.equal(days.includes('2026-11-16'), true)
  const withoutLeave = unbookedLabourRows({ ...input, holidays: [] })
  assert.equal(withoutLeave.some((row) => row.dayKey === '2026-11-10'), true)
})

// 1.5.0 — ids compare without case in unbooked labour and leave coverage (normalizeDocumentId, §1).
const CASE_ADMIN = {
  id: 'abcd-admin',
  email: 'boss@site.test',
  name: 'Boss Admin',
  isActive: true,
  passwordSet: true,
  isOperativeMode: false,
  isManager: false,
  isAdmin: true,
  isSuperAdmin: false,
}
const CASE_INPUT = {
  timeZone: HD_LONDON,
  startDayKey: '2026-11-09',
  endDayKey: '2026-11-10',
  includeWeekends: false,
  standardPaidHours: 8,
  saturdayCountsAsHours: 8,
  sundayCountsAsHours: 8,
  operatives: [],
}

test('unbookedLabourRows: an upper-case leave userId covers a lower-case person id, and the reverse', () => {
  const upperLeave = unbookedLabourRows({
    ...CASE_INPUT,
    people: [CASE_ADMIN],
    bookings: [],
    holidays: [{ userId: 'ABCD-ADMIN', startDayKey: '2026-11-09', endDayKey: '2026-11-10', approved: true }],
  })
  assert.deepEqual(upperLeave, [])
  const lowerLeave = unbookedLabourRows({
    ...CASE_INPUT,
    people: [{ ...CASE_ADMIN, id: 'ABCD-ADMIN' }],
    bookings: [],
    holidays: [{ userId: 'abcd-admin', startDayKey: '2026-11-09', endDayKey: '2026-11-10', approved: true }],
  })
  assert.deepEqual(lowerLeave, [])
})

test('unbookedLabourRows: an upper-case booking personId covers a lower-case person id; rows keep the stored id', () => {
  const rows = unbookedLabourRows({
    ...CASE_INPUT,
    people: [{ ...CASE_ADMIN, id: 'Abcd-Admin' }],
    bookings: [{ personId: 'ABCD-ADMIN', dayKey: '2026-11-09', kind: 'manager', timeSlot: 'FULL DAY' }],
    holidays: [],
  })
  assert.deepEqual(rows.map((row) => [row.dayKey, row.personKey, row.userId]), [['2026-11-10', 'Abcd-Admin', 'Abcd-Admin']])
  const excluded = unbookedLabourRows({
    ...CASE_INPUT,
    excludedUserIds: ['ABCD-ADMIN'],
    people: [CASE_ADMIN],
    bookings: [],
    holidays: [],
  })
  assert.deepEqual(excluded, [])
})

test('unbookedLabourRowsOnDay: the same case-insensitive match', () => {
  const { startDayKey: _s, endDayKey: _e, ...rest } = CASE_INPUT
  void _s
  void _e
  const rows = unbookedLabourRowsOnDay({
    ...rest,
    dayKey: '2026-11-09',
    people: [CASE_ADMIN],
    bookings: [],
    holidays: [{ userId: 'ABCD-ADMIN', startDayKey: '2026-11-09', endDayKey: '2026-11-09', approved: true }],
  })
  assert.deepEqual(rows, [])
})

test('leaveCoverageRows: leave and bookings match people without case; rows keep the stored ids', () => {
  const base = {
    timeZone: HD_LONDON,
    startDayKey: '2026-11-09',
    endDayKey: '2026-11-09',
    day: null,
    includeWeekends: false,
    people: [{ personKey: 'abcd-op', name: 'Op One', userId: 'abcd-user', operativeIds: ['abcd-op'] }],
  }
  const clash = leaveCoverageRows({
    ...base,
    leave: [{ id: 'L1', userId: 'ABCD-USER', startDayKey: '2026-11-09', endDayKey: '2026-11-09', timeSlot: 'FULL DAY', approved: true }],
    bookings: [{ id: 'B1', personId: 'ABCD-OP', kind: 'operative', dayKey: '2026-11-09', timeSlot: 'FULL DAY' }],
  })
  assert.equal(clash.length, 1)
  assert.equal(clash[0].personKey, 'abcd-op')
  const byOperative = leaveCoverageRows({
    ...base,
    leave: [{ id: 'L2', operativeId: 'ABCD-OP', startDayKey: '2026-11-09', endDayKey: '2026-11-09', timeSlot: 'FULL DAY', approved: true }],
    bookings: [{ id: 'B2', personId: 'abcd-op', kind: 'operative', dayKey: '2026-11-09', timeSlot: 'FULL DAY' }],
  })
  assert.equal(byOperative.length, 1)
})

import {
  clientWriteFields,
  defaultTimesheetsEnabled,
  documentBool,
  documentInstantMs,
  documentWriteFields,
  managerRowWriteFields,
  normalizeUserRoleToken,
  operativeRowWriteFields,
  parseClientDocument,
  parseManagerDocument,
  parseOperativeDocument,
  parsePayRateHistoryDocument,
  parsePayRateHistoryDocuments,
  parseSkillDocument,
  parseSubcontractorDocument,
  parseUserDocument,
  skillsCatalogueWrites,
  userProfileWriteFields,
} from './peopleDocuments.ts'
import { payRateOnDay as peoplePayRateOnDay } from './payRate.ts'

// 1.6.0 — one reader and partial writes for the people collections.
const PD_LONDON = 'Europe/London'
const PD_TS = (iso: string) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 })

test('documentInstantMs and documentBool accept every shape either app hands over', () => {
  const ms = Date.parse('2026-11-09T00:00:00Z')
  assert.equal(documentInstantMs({ seconds: ms / 1000, nanoseconds: 0 }), ms)
  assert.equal(documentInstantMs({ _seconds: ms / 1000, _nanoseconds: 0 }), ms)
  assert.equal(documentInstantMs(new Date(ms)), ms)
  assert.equal(documentInstantMs(ms), ms)
  assert.equal(documentInstantMs(ms / 1000), ms)
  assert.equal(documentInstantMs('2026-11-09T00:00:00.000Z'), ms)
  assert.equal(documentInstantMs({ toDate: () => new Date(ms) }), ms)
  assert.equal(documentInstantMs(''), null)
  assert.equal(documentInstantMs(0), null)
  assert.equal(documentBool(1), true)
  assert.equal(documentBool('yes'), true)
  assert.equal(documentBool('0'), false)
  assert.equal(documentBool('maybe'), null)
})

test('parseUserDocument reads a web-written user and fills missing leave fields from the organisation default', () => {
  const parsed = parseUserDocument(
    'webUid1',
    {
      email: ' Ann@Example.com ',
      firstName: 'Ann',
      surname: 'Lee',
      organizationId: 'ORG',
      role: 'manager',
      manager: true,
      permissions: { manager: true, operatives: true },
      assignedManagerUserIds: ['mgrA', 'mgrA', ' mgrB '],
      payBasis: 'day',
      dayRate: 200,
      employmentType: 'paye',
    },
    { timeZone: PD_LONDON, annualLeaveDefaults: { daysPerYear: 28, startMonth: 4, endMonth: 3, carriesOver: true } }
  )
  assert.ok(parsed)
  assert.equal(parsed.id, 'webUid1')
  assert.equal(parsed.email, 'Ann@Example.com')
  assert.equal(parsed.emailKey, 'ann@example.com')
  assert.equal(parsed.role, 'manager')
  assert.equal(parsed.accountKind, 'manager')
  assert.equal(parsed.permissions.operatives, true)
  assert.deepEqual(parsed.assignedManagerUserIds, ['mgrA', 'mgrB'])
  assert.equal(parsed.assignedManagerUserId, 'mgrA')
  assert.equal(parsed.annualLeaveDaysPerYear, 28)
  assert.equal(parsed.annualLeaveYearStartMonth, 4)
  assert.equal(parsed.annualLeaveYearEndMonth, 3)
  assert.equal(parsed.annualLeaveCarriesOver, true)
  assert.deepEqual(parsed.annualLeaveStored, { daysPerYear: null, startMonth: null, endMonth: null, carriesOver: null })
  // Missing timesheetsEnabled: a PAYE manager does not take part.
  assert.equal(parsed.timesheetsEnabled, false)
  assert.equal(parsed.timesheetsEnabledStored, null)
  assert.equal(parsed.isActive, true)
  assert.equal(parsed.passwordSet, true)
})

test('parseUserDocument reads an iOS-written user: upper-case ids, legacy keys, string flags, stored leave wins', () => {
  const parsed = parseUserDocument(
    'D7A3C1E2-0000-4000-8000-0000000000AA',
    {
      email: 'op@example.com',
      displayName: 'Bob Smith Jones',
      organizationId: 'ORG',
      role: 'Operatives',
      operativeMode: 1,
      isActive: 'false',
      assignedManagerUserId: 'B1C2D3E4-0000-4000-8000-0000000000BB',
      hourlyRate: 18.5,
      payBasis: 'hourly',
      annualLeaveDaysPerYear: 20,
      employmentType: 'selfEmployed',
      employmentTypeTransitionFrom: 'paye',
      employmentTypeEffectiveAt: PD_TS('2026-11-11T00:00:00Z'),
      mobile: '0700',
    },
    { timeZone: PD_LONDON, annualLeaveDefaults: { daysPerYear: 28 } }
  )
  assert.ok(parsed)
  assert.equal(parsed.id, 'D7A3C1E2-0000-4000-8000-0000000000AA')
  assert.equal(parsed.firstName, 'Bob')
  assert.equal(parsed.surname, 'Smith Jones')
  assert.equal(parsed.role, 'operative')
  assert.equal(parsed.operativeMode, true)
  assert.equal(parsed.accountKind, 'operative')
  assert.equal(parsed.permissions.projects, true)
  assert.equal(parsed.permissions.operatives, false)
  assert.equal(parsed.isActive, false)
  assert.deepEqual(parsed.assignedManagerUserIds, ['B1C2D3E4-0000-4000-8000-0000000000BB'])
  assert.equal(parsed.payBasis, 'hourly')
  assert.equal(parsed.hourlyRate, 18.5)
  assert.equal(parsed.dayRate, null)
  assert.equal(parsed.employmentType, 'self_employed')
  assert.equal(parsed.employmentTypeTransitionFrom, 'paye')
  assert.equal(parsed.employmentTypeEffectiveDayKey, '2026-11-11')
  assert.equal(parsed.annualLeaveDaysPerYear, 20)
  assert.equal(parsed.mobileNumber, '0700')
  // Missing timesheetsEnabled: operatives take part.
  assert.equal(parsed.timesheetsEnabled, true)
})

test('parseUserDocument: an admin with a stray operativeMode flag stays an admin on lists and (1.11.0) in the approval rules', () => {
  const parsed = parseUserDocument('admin1', {
    email: 'a@example.com',
    organizationId: 'ORG',
    role: 'admin',
    adminAccess: true,
    operativeMode: true,
  })
  assert.ok(parsed)
  assert.equal(parsed.operativeModeStored, true)
  assert.equal(parsed.operativeMode, false)
  assert.equal(parsed.accountKind, 'admin')
  assert.equal(parsed.permissions.adminAccess, true)
  assert.equal(parsed.permissions.operativeMode, false)
  assert.equal(parsed.adminOutsideOperativeMode, true)
  const plain = parseUserDocument('admin2', { email: 'b@example.com', role: 'admin', isSuperAdmin: true })
  assert.equal(plain?.adminOutsideOperativeMode, true)
})

test('parseUserDocument: hasNoLineManager clears the ids; no org defaults gives 25 / 1 / 12 / false', () => {
  const parsed = parseUserDocument('u', {
    email: 'x@example.com',
    hasNoLineManager: true,
    assignedManagerUserIds: ['m1'],
    timesheetsEnabled: true,
  })
  assert.ok(parsed)
  assert.deepEqual(parsed.assignedManagerUserIds, [])
  assert.equal(parsed.assignedManagerUserId, null)
  assert.equal(parsed.annualLeaveDaysPerYear, 25)
  assert.equal(parsed.annualLeaveYearStartMonth, 1)
  assert.equal(parsed.annualLeaveYearEndMonth, 12)
  assert.equal(parsed.annualLeaveCarriesOver, false)
  assert.equal(parsed.timesheetsEnabled, true)
  assert.equal(parseUserDocument('', { email: 'x' }), null)
})

test('normalizeUserRoleToken and defaultTimesheetsEnabled', () => {
  assert.equal(normalizeUserRoleToken('Manager'), 'manager')
  assert.equal(normalizeUserRoleToken('super_admin'), 'admin')
  assert.equal(normalizeUserRoleToken('basic'), 'basic')
  assert.equal(normalizeUserRoleToken(undefined), 'viewer')
  assert.equal(defaultTimesheetsEnabled({ operativeMode: true, employmentType: 'paye' }), true)
  assert.equal(defaultTimesheetsEnabled({ operativeMode: false, employmentType: 'paye' }), false)
  assert.equal(defaultTimesheetsEnabled({ operativeMode: false, employmentType: undefined }), true)
})

test('parseOperativeDocument keeps a non-UUID id, honours an hourly payBasis and reads legacy names', () => {
  const parsed = parseOperativeDocument(
    'op-legacy-7',
    {
      name: 'Carl Dean',
      email: 'Carl@Example.com',
      payBasis: 'hourly',
      hourlyRate: 21,
      dayRate: 160,
      skills: ['S1', { id: 'S2', name: 'Tiling' }, { name: 'Plaster' }, 'S1'],
      qualifications: [{ id: 'Q1', name: 'CSCS', hasEndDate: true, endDate: PD_TS('2027-01-01T00:00:00Z') }, { name: 'no id' }],
      qualificationExpiryDates: { Q1: PD_TS('2027-01-01T00:00:00Z') },
      qualificationCertificateURLs: { Q1: 'https://x/q1.pdf', Q2: '' },
      createdAt: PD_TS('2026-06-01T09:00:00Z'),
      linkedUserId: 'AuthUid',
    },
    PD_LONDON
  )
  assert.ok(parsed)
  assert.equal(parsed.id, 'op-legacy-7')
  assert.equal(parsed.firstName, 'Carl')
  assert.equal(parsed.lastName, 'Dean')
  assert.equal(parsed.emailKey, 'carl@example.com')
  assert.equal(parsed.payBasis, 'hourly')
  assert.equal(parsed.hourlyRate, 21)
  assert.equal(parsed.dayRate, null)
  assert.deepEqual(parsed.skills, ['S1', 'S2', 'Plaster'])
  assert.equal(parsed.qualifications.length, 1)
  assert.deepEqual(Object.keys(parsed.qualificationCertificateURLs), ['Q1'])
  assert.equal(parsed.startDayKey, '2026-06-01')
  assert.equal(parsed.linkedUserId, 'AuthUid')
  assert.equal(parsed.isActive, true)
  assert.equal(parsed.isPlaceholder, false)
  assert.equal(parseOperativeDocument('INITIAL-PLACEHOLDER', { name: 'x' })?.isPlaceholder, true)
  assert.equal(parseOperativeDocument('empty', {}), null)
})

test('parseOperativeDocument keeps an upper-case UUID id as stored', () => {
  const id = 'A1B2C3D4-0000-4000-8000-0000000000CC'
  const parsed = parseOperativeDocument(id, { id: 'other', firstName: 'Dee', lastName: 'Ray', dayRate: 150 })
  assert.equal(parsed?.id, id)
  assert.equal(parsed?.payBasis, 'day')
  assert.equal(parsed?.dayRate, 150)
})

test('parseManagerDocument reads pay and legacy mobile keys', () => {
  const parsed = parseManagerDocument('mgr-1', {
    firstName: 'Eve',
    email: 'eve@example.com',
    mobile: '0711',
    payBasis: 'hourly',
    hourlyRate: '30',
  })
  assert.ok(parsed)
  assert.equal(parsed.mobile, '0711')
  assert.equal(parsed.payBasis, 'hourly')
  assert.equal(parsed.hourlyRate, 30)
})

test('parsePayRateHistoryDocument keeps non-UUID ids and cleared rows and works with payRateOnDay', () => {
  const rows = parsePayRateHistoryDocuments(
    [
      { id: 'h2', data: { operativeId: 'op-legacy-7', dayRate: 180, effectiveAt: PD_TS('2026-11-10T00:00:00Z') } },
      { id: 'h1', data: { operativeId: 'op-legacy-7', dayRate: 150, payBasis: 'day', effectiveAt: PD_TS('2026-11-01T00:00:00Z') } },
      { id: 'h3', data: { userId: 'U', dayRate: null, payBasis: null, effectiveAt: PD_TS('2026-11-05T00:00:00Z') } },
      { id: 'bad', data: { userId: 'U', effectiveAt: PD_TS('2026-11-05T00:00:00Z') } },
      { id: 'none', data: { dayRate: 1, effectiveAt: PD_TS('2026-11-05T00:00:00Z') } },
    ],
    PD_LONDON
  )
  assert.deepEqual(rows.map((row) => row.id), ['h1', 'h3', 'h2'])
  assert.equal(rows[1].cleared, true)
  assert.equal(rows[1].payBasis, null)
  assert.equal(rows[0].operativeId, 'op-legacy-7')
  assert.equal(rows[2].effectiveDayKey, '2026-11-10')
  const onDay = peoplePayRateOnDay({ operative: { id: 'op-legacy-7' }, history: rows, dayKey: '2026-11-12', timeZone: PD_LONDON })
  assert.equal(onDay.rate, 180)
  assert.equal(onDay.source, 'history')
  assert.equal(parsePayRateHistoryDocument('x', { userId: 'U', dayRate: '12.5', effectiveAt: '2026-11-01' })?.dayRate, 12.5)
})

test('parseClientDocument keeps a non-UUID document id and blanks are null', () => {
  const parsed = parseClientDocument('client-legacy', { id: 'SOMETHING-ELSE', name: ' Acme ', email: '', phone: '0800' })
  assert.deepEqual(
    { id: parsed?.id, name: parsed?.name, email: parsed?.email, phone: parsed?.phone },
    { id: 'client-legacy', name: 'Acme', email: null, phone: '0800' }
  )
  assert.equal(parseClientDocument('c', { email: 'x' }), null)
})

test('subcontractor and skill readers', () => {
  const sub = parseSubcontractorDocument('sub-1', {
    name: 'Sparks Ltd',
    subcontractorType: 'Electrical',
    contacts: [{ id: 'c1', name: 'Sam' }, { email: 'no name' }],
  })
  assert.equal(sub?.contacts.length, 1)
  assert.equal(sub?.contacts[0].position, 'Installer')
  assert.equal(parseSubcontractorDocument('sub-2', { name: 'x' }), null)
  assert.equal(parseSkillDocument('sk', { name: 'Tiling' })?.trade, '')
})

test('documentWriteFields writes only changed fields and never deletes a field the local copy lacks', () => {
  const before = { name: 'A', email: 'a@x', phone: '1', createdAt: PD_TS('2026-01-01T00:00:00Z') }
  const out = documentWriteFields(before, {
    name: 'A',
    email: 'b@x',
    phone: null,
    address: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    notes: undefined,
  })
  assert.deepEqual(out, { set: { email: 'b@x' }, remove: ['phone'] })
  assert.deepEqual(documentWriteFields(null, { name: 'A', phone: null }), { set: { name: 'A' }, remove: [] })
})

test('userProfileWriteFields writes the line manager and pay groups together, never createdAt / organizationId', () => {
  const before = {
    assignedManagerUserIds: ['m1'],
    assignedManagerUserId: 'm1',
    hasNoLineManager: false,
    payBasis: 'day',
    dayRate: 100,
    organizationId: 'ORG',
    mobileNumber: '0700',
  }
  const out = userProfileWriteFields(before, {
    assignedManagerUserIds: ['m1'],
    assignedManagerUserId: 'm1',
    hasNoLineManager: true,
    payBasis: 'hourly',
    dayRate: null,
    hourlyRate: 20,
    organizationId: 'OTHER',
    mobileNumber: '0700',
  })
  assert.deepEqual(out.set, {
    assignedManagerUserIds: ['m1'],
    assignedManagerUserId: 'm1',
    hasNoLineManager: true,
    payBasis: 'hourly',
    hourlyRate: 20,
  })
  assert.deepEqual(out.remove, ['dayRate'])
})

test('operative, manager and client write helpers are partial and keep create-only fields', () => {
  const op = operativeRowWriteFields(
    { firstName: 'A', lastName: 'B', name: 'A B', isActive: true, id: 'x', createdAt: 1 },
    { firstName: 'A', lastName: 'C', name: 'A C', isActive: true, id: 'y', createdAt: 2 }
  )
  assert.deepEqual(op, { set: { firstName: 'A', lastName: 'C', name: 'A C' }, remove: [] })
  const mgr = managerRowWriteFields({ payBasis: 'day', dayRate: 100 }, { payBasis: 'day', dayRate: 100, hourlyRate: null })
  assert.deepEqual(mgr, { set: {}, remove: [] })
  const client = clientWriteFields({ name: 'Acme', email: 'a@x' }, { name: 'Acme', email: 'a@x' })
  assert.deepEqual(client, { set: {}, remove: [] })
})

test('skillsCatalogueWrites never deletes the catalogue from an empty or failed load', () => {
  const stored = [
    { id: 'S1', name: 'Tiling', trade: 'Finishes' },
    { id: 'S2', name: 'Plaster', trade: 'Finishes' },
  ]
  assert.deepEqual(skillsCatalogueWrites({ stored, next: [], loaded: true }), { write: [], remove: [] })
  assert.deepEqual(
    skillsCatalogueWrites({ stored, next: [{ id: 'S1', name: 'Tiling', trade: 'Finishes' }], loaded: false }),
    { write: [], remove: [] }
  )
  assert.deepEqual(
    skillsCatalogueWrites({
      stored,
      next: [
        { id: 'S1', name: 'Tiling', trade: 'Wet trades' },
        { id: 'S3', name: 'Screed' },
      ],
      loaded: true,
    }),
    { write: [{ id: 'S1', set: { trade: 'Wet trades' } }, { id: 'S3', set: { name: 'Screed' } }], remove: ['S2'] }
  )
})

import {
  bookingUpdateWriteFields,
  deadlineAssignedProjectIds,
  deadlineAssignmentWriteFields,
  deadlinesDocumentId,
  jobWriteFields,
  parseDeadlineAssignments,
  parseDeadlineDocument,
  parseJobDocument,
  parseProjectDocument,
  parseSmallWorkDocument,
  parseSubcontractorBookingDocument,
  parseTimesheetEntries,
  subcontractorBookingCreateFields,
  subcontractorBookingWriteFields,
  timesheetEntryId,
} from './workDocumentReaders.ts'

// 1.7.0 — one reader and partial writes for the work collections.
const WD_TS = (iso: string) => ({ seconds: Date.parse(iso) / 1000, nanoseconds: 0 })
const WD_UUID = '0F8B2C6A-1D2E-4F3A-9B8C-7D6E5F4A3B2C'

test('parseJobDocument reads a web-written job: stored-case ids, non-UUID ids kept, BST day keys', () => {
  const job = parseProjectDocument(
    'proj-c646',
    {
      jobNumber: 'C646',
      siteName: ' Tower ',
      addressLine1: '1 High St',
      townCity: 'Leeds',
      postcode: 'LS1 1AA',
      client: { id: 'client-acme', name: 'Acme', email: '', phone: '0113' },
      startDate: WD_TS('2026-06-30T23:30:00Z'),
      endDate: WD_TS('2026-07-10T23:00:00Z'),
      jobType: 'CAT A',
      managerIds: ['mgr-web-1', 'MGR-WEB-1', 'mgr-2'],
      isLive: true,
      createdAt: WD_TS('2026-06-01T09:00:00Z'),
    },
    { timeZone: 'Europe/London' }
  )
  assert.ok(job)
  assert.equal(job.id, 'proj-c646')
  assert.equal(job.collection, 'projects')
  assert.equal(job.siteName, 'Tower')
  assert.equal(job.startDayKey, '2026-07-01')
  assert.equal(job.endDayKey, '2026-07-11')
  assert.equal(job.client.id, 'client-acme')
  assert.equal(job.client.email, null)
  assert.deepEqual(job.managerIds, ['mgr-web-1', 'mgr-2'])
  assert.equal(job.managerId, 'mgr-web-1')
  assert.equal(job.siteAddress, '1 High St, Leeds, LS1 1AA')
})

test('parseJobDocument reads an iOS-written small work: upper-case UUIDs, managerId only, no end day', () => {
  const job = parseSmallWorkDocument(WD_UUID, {
    jobNumber: 'SW1',
    siteName: 'Kitchen',
    client: { id: WD_UUID, name: 'Client' },
    startDate: WD_TS('2026-11-03T00:00:00Z'),
    managerId: 'AB12CD34-0000-4000-8000-000000000001',
    manager: 'custom',
    isLive: 0,
    usesMapPinForLocation: 'yes',
    latitude: '53.8',
  })
  assert.ok(job)
  assert.equal(job.id, WD_UUID)
  assert.equal(job.kind, 'smallWork')
  assert.equal(job.endDayKey, '2026-11-03')
  assert.deepEqual(job.managerIds, ['AB12CD34-0000-4000-8000-000000000001'])
  assert.equal(job.managerName, null)
  assert.equal(job.isLive, false)
  assert.equal(job.usesMapPinForLocation, true)
  assert.equal(job.latitude, 53.8)
  assert.equal(parseJobDocument('INITIAL-PLACEHOLDER', { siteName: 'x' }), null)
  // No start date: the creation day, never "now".
  assert.equal(parseProjectDocument('p', { createdAt: WD_TS('2026-03-29T00:30:00Z') })?.startDayKey, '2026-03-29')
})

test('jobWriteFields writes only changed fields, never deletes an absent one, never rewrites createdAt', () => {
  const before = {
    siteName: 'Tower',
    managerId: 'm1',
    managerIds: ['m1'],
    createdAt: WD_TS('2026-01-01T00:00:00Z'),
    organizationId: 'org',
    notes: 'keep me',
  }
  const same = jobWriteFields(before, { siteName: 'Tower', createdAt: WD_TS('2026-05-05T00:00:00Z'), organizationId: 'org2' })
  assert.deepEqual(same, { set: {}, remove: [] })
  const changed = jobWriteFields(before, { siteName: 'Tower', managerIds: ['m1', 'm2'], managerId: 'm1', description: null })
  assert.deepEqual(changed.set, { managerIds: ['m1', 'm2'], managerId: 'm1' })
  assert.deepEqual(changed.remove, [])
  const created = jobWriteFields(null, { siteName: 'New', createdAt: 5, description: null })
  assert.deepEqual(created, { set: { siteName: 'New', createdAt: 5 }, remove: [] })
})

test('bookingUpdateWriteFields: changed fields only, slot with its times, bookedBy kept, no write without a stored booking', () => {
  const before = {
    id: 'B1',
    operativeId: 'op-1',
    projectId: 'proj-c646',
    status: 'Confirmed',
    timeSlot: 'FULL DAY',
    bookedBy: 'first@example.com',
    notes: '',
    createdAt: WD_TS('2026-01-01T00:00:00Z'),
  }
  assert.deepEqual(bookingUpdateWriteFields(null, { status: 'Cancelled' }), { set: {}, remove: [] })
  assert.deepEqual(
    bookingUpdateWriteFields(before, { ...before, status: 'Cancelled', bookedBy: 'second@example.com', workStartTime: null }),
    { set: { status: 'Cancelled' }, remove: [] }
  )
  const slot = bookingUpdateWriteFields(before, {
    ...before,
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: '07:30',
    workEndTime: '12:00',
    isBreakRemoved: false,
  })
  assert.deepEqual(slot.set, { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '12:00', isBreakRemoved: false })
  const back = bookingUpdateWriteFields(
    { ...before, timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '12:00' },
    { timeSlot: 'FULL DAY', workStartTime: null, workEndTime: null }
  )
  assert.deepEqual(back, { set: { timeSlot: 'FULL DAY' }, remove: ['workStartTime', 'workEndTime'] })
})

test('parseSubcontractorBookingDocument reads web-created and iOS-created bookings the same way', () => {
  const web = parseSubcontractorBookingDocument(
    'k3j2lowerrandomid',
    {
      subcontractorId: 'sub-electrics',
      projectId: 'proj-c646',
      date: WD_TS('2026-06-30T23:00:00Z'),
      timeSlot: 'FULL DAY',
      workStartTime: null,
      bookedBy: 'pm@example.com',
      bookedContactIds: [],
      bookedOperativeNames: ['Ada', 'ada'],
    },
    { timeZone: 'Europe/London' }
  )
  assert.ok(web)
  assert.equal(web.id, 'k3j2lowerrandomid')
  assert.equal(web.status, 'Confirmed')
  assert.equal(web.dayKey, '2026-07-01')
  assert.equal(web.isBreakRemoved, false)
  assert.deepEqual(web.bookedOperativeNames, ['Ada'])
  assert.equal(web.idsAreUuid, false)
  const ios = parseSubcontractorBookingDocument(WD_UUID, {
    id: 'SOMETHING-ELSE',
    subcontractorId: WD_UUID,
    projectId: WD_UUID,
    date: WD_TS('2026-11-03T00:00:00Z'),
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: '7:30',
    workEndTime: '16:00:00',
    isBreakRemoved: true,
    bookedBy: 'ios@example.com',
    status: 'Tentative',
    bookedContactIds: [WD_UUID],
  })
  assert.ok(ios)
  assert.equal(ios.id, WD_UUID)
  assert.equal(ios.workStartTime, '07:30')
  assert.equal(ios.workEndTime, '16:00')
  assert.equal(ios.status, 'Tentative')
  assert.equal(ios.idsAreUuid, true)
  assert.equal(parseSubcontractorBookingDocument('x', { subcontractorId: 's', projectId: 'p', date: 1, status: 'weird' }), null)
  assert.equal(parseSubcontractorBookingDocument('x', { subcontractorId: 's', date: WD_TS('2026-11-03T00:00:00Z') }), null)
  assert.equal(parseSubcontractorBookingDocument('x', { subContractorId: 's', projectID: 'p', date: '2026-11-03' })?.dayKey, '2026-11-03')
})

test('subcontractorBookingCreateFields and subcontractorBookingWriteFields', () => {
  const created = subcontractorBookingCreateFields({
    id: WD_UUID,
    subcontractorId: 'sub-1',
    projectId: 'proj-c646',
    dateMs: 1_780_000_000_000,
    timeSlot: 'FULL_DAY',
    workStartTime: null,
    bookedBy: 'pm@example.com',
    bookedContactIds: ['c1', 'C1'],
    createdAtMs: 1_780_000_000_500,
  })
  assert.deepEqual(created, {
    ok: true,
    fields: {
      id: WD_UUID,
      subcontractorId: 'sub-1',
      projectId: 'proj-c646',
      date: 1_780_000_000_000,
      timeSlot: 'FULL DAY',
      isBreakRemoved: false,
      bookedBy: 'pm@example.com',
      status: 'Confirmed',
      bookedContactIds: ['c1'],
      bookedOperativeNames: [],
      createdAt: 1_780_000_000_500,
      updatedAt: 1_780_000_000_500,
    },
  })
  assert.deepEqual(subcontractorBookingCreateFields({ id: '', subcontractorId: '', projectId: 'p', dateMs: NaN, timeSlot: 'x', bookedBy: '', createdAtMs: 0 }), {
    ok: false,
    errors: ['missing_id', 'missing_subcontractor_id', 'missing_date', 'bad_time_slot'],
  })
  const before = { timeSlot: 'FULL DAY', bookedContactIds: ['c1'], bookedOperativeNames: ['Ada'], bookedBy: 'a' }
  assert.deepEqual(subcontractorBookingWriteFields(null, { timeSlot: 'AM' }), { set: {}, remove: [] })
  assert.deepEqual(subcontractorBookingWriteFields(before, { bookedContactIds: ['c1', 'c2'], bookedOperativeNames: ['Ada'], bookedBy: 'b' }), {
    set: { bookedContactIds: ['c1', 'c2'], bookedOperativeNames: ['Ada'] },
    remove: [],
  })
})

test('timesheet entries keep stored ids, derive a stable id for an entry without one, and find its review', () => {
  const sheetId = 'timesheet_user1_1780000000'
  const noId = { title: 'Skip hire', amount: 120, date: WD_TS('2026-06-30T23:30:00Z') }
  const derived = timesheetEntryId(sheetId, 'expense', 1, noId)
  assert.match(derived, /^[0-9A-F]{8}-[0-9A-F]{4}-8[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/)
  assert.equal(timesheetEntryId(sheetId, 'expense', 1, noId), derived)
  assert.notEqual(timesheetEntryId(sheetId, 'expense', 2, noId), derived)
  assert.notEqual(timesheetEntryId('timesheet_user2_1780000000', 'expense', 1, noId), derived)
  assert.equal(timesheetEntryId(sheetId, 'expense', 1, { ...noId, id: 'web-entry-1' }), 'web-entry-1')

  const sheet = {
    expenseEntries: [
      { id: 'web-entry-1', title: 'Fuel', amount: '40.5', date: '2026-06-30' },
      noId,
      { title: '', amount: 5 },
    ],
    priceWorkEntries: [{ id: WD_UUID.toLowerCase(), title: 'Second fix', amount: 300, startDate: WD_TS('2026-06-01T00:00:00Z') }],
    extraEntryReviews: {
      [derived.toLowerCase()]: { decision: 'declined', reviewedAmount: 120, reviewedByUserId: 'mgr' },
      [WD_UUID]: { decision: 'edited', revisedAmount: 250, reviewedAmount: 300, reviewedByUserId: 'mgr' },
    },
  }
  const first = parseTimesheetEntries(sheetId, sheet, { timeZone: 'Europe/London' })
  const second = parseTimesheetEntries(sheetId, sheet, { timeZone: 'Europe/London' })
  assert.deepEqual(first, second)
  assert.equal(first.expenseEntries.length, 2)
  assert.equal(first.expenseEntries[0].id, 'web-entry-1')
  assert.equal(first.expenseEntries[0].amount, 40.5)
  assert.equal(first.expenseEntries[0].dayKey, '2026-06-30')
  assert.equal(first.expenseEntries[1].id, derived)
  assert.equal(first.expenseEntries[1].idStored, false)
  assert.equal(first.expenseEntries[1].dayKey, '2026-07-01')
  assert.equal(first.expenseEntries[1].managerDecision, 'declined')
  assert.equal(first.priceWorkEntries[0].id, WD_UUID.toLowerCase())
  assert.equal(first.priceWorkEntries[0].managerDecision, 'edited')
  assert.equal(first.priceWorkEntries[0].managerRevisedAmount, 250)
  assert.equal(first.priceWorkEntries[0].agreedManagerName, 'Manager')
})

test('parseDeadlineDocument keeps non-UUID ids; assignments read without case and write through a field path', () => {
  assert.equal(deadlinesDocumentId('proj-c646', false), 'deadlines_projects_PROJ-C646')
  const parsed = parseDeadlineDocument(
    'deadlines_smallWorks_PROJ-C646',
    {
      items: [
        { id: 'web-dl-2', title: 'Later', due: WD_TS('2026-07-10T00:00:00Z'), assigneeUserIds: ['u1', 'U1'], dependsOn: ['web-dl-1'] },
        { id: 'web-dl-1', title: 'First', due: WD_TS('2026-06-30T23:30:00Z'), status: 'odd', history: [{ id: 'h1', type: 'mystery' }] },
        { title: 'No id' },
      ],
      updatedAt: WD_TS('2026-06-01T00:00:00Z'),
    },
    { timeZone: 'Europe/London' }
  )
  assert.equal(parsed.collection, 'smallWorks')
  assert.equal(parsed.projectId, 'PROJ-C646')
  assert.deepEqual(parsed.items.map((item) => item.id), ['web-dl-1', 'web-dl-2'])
  assert.equal(parsed.items[0].dueDayKey, '2026-07-01')
  assert.equal(parsed.items[0].status, 'notStarted')
  assert.equal(parsed.items[0].history[0].type, 'note')
  assert.equal(parsed.items[0].history[0].note, 'mystery')
  assert.deepEqual(parsed.items[1].assigneeUserIds, ['u1'])
  assert.deepEqual(parsed.items[1].dependsOn, ['web-dl-1'])

  const stored = { 'projects.LEGACY-1': ['User-A'], projects: { 'PROJ-C646': ['user-a', 'user-b'], [WD_UUID]: ['other'] } }
  assert.deepEqual(parseDeadlineAssignments(stored), { 'LEGACY-1': ['User-A'], 'PROJ-C646': ['user-a', 'user-b'], [WD_UUID]: ['other'] })
  assert.deepEqual(deadlineAssignedProjectIds(stored, 'USER-A'), ['LEGACY-1', 'PROJ-C646'])
  assert.deepEqual(deadlineAssignmentWriteFields({ projectId: ' proj-c646 ', assigneeUserIds: ['u2', 'u1', 'U1'] }), {
    fieldPath: ['projects', 'PROJ-C646'],
    value: ['u1', 'u2'],
    createFields: { projects: { 'PROJ-C646': ['u1', 'u2'] } },
  })
  assert.equal(deadlineAssignmentWriteFields({ projectId: ' ', assigneeUserIds: [] }), null)
})

test('the iOS JavaScript bundle reads work documents the same way', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const api = sandbox.ProjectPlannerCanonical!
  const plain = (value: unknown) => JSON.parse(JSON.stringify(value))
  const sub = { subcontractorId: 'sub-1', projectId: 'proj-c646', date: WD_TS('2026-06-30T23:00:00Z') }
  assert.deepEqual(plain(api.parseSubcontractorBookingDocument('abc', sub, { timeZone: 'Europe/London' })), plain(parseSubcontractorBookingDocument('abc', sub, { timeZone: 'Europe/London' })))
  const job = { siteName: 'Tower', startDate: WD_TS('2026-06-30T23:30:00Z'), managerId: 'm1' }
  assert.deepEqual(plain(api.parseJobDocument('p1', job, { kind: 'smallWorks' })), plain(parseJobDocument('p1', job, { kind: 'smallWorks' })))
  assert.equal(api.timesheetEntryId('timesheet_u_1', 'priceWork', 0, { title: 'A', amount: 1 }), timesheetEntryId('timesheet_u_1', 'priceWork', 0, { title: 'A', amount: 1 }))
  const sheet = { expenseEntries: [{ title: 'Fuel', amount: 10 }] }
  assert.deepEqual(plain(api.parseTimesheetEntries('timesheet_u_1', sheet)), plain(parseTimesheetEntries('timesheet_u_1', sheet)))
  assert.deepEqual(plain(api.bookingUpdateWriteFields({ status: 'Confirmed' }, { status: 'Cancelled' })), { set: { status: 'Cancelled' }, remove: [] })
  assert.deepEqual(plain(api.deadlineAssignmentWriteFields({ projectId: 'p', assigneeUserIds: ['b', 'a'] })), {
    fieldPath: ['projects', 'P'],
    value: ['a', 'b'],
    createFields: { projects: { P: ['a', 'b'] } },
  })
  assert.equal(typeof api.parseDeadlineDocument, 'function')
  assert.equal(typeof api.jobWriteFields, 'function')
  assert.equal(typeof api.subcontractorBookingCreateFields, 'function')
})

// MARK: - Rulebook 1.8.0: operations and record documents

import {
  canonicalJobTypeName as opsCanonicalJobTypeName,
  coerceJobTypeList as opsCoerceJobTypeList,
  jobTypesWriteFields,
  materialCatalogueWrites,
  materialLineFields,
  materialLineWriteFields,
  materialSendRecordCreateFields,
  materialSendStatusWriteFields,
  mergeStoredRows,
  normalizeMaterialWorkflowStatus,
  normalizeProjectTaskStatus,
  operativeProfileWriteFields,
  parseJobTypesDocument,
  parseMaterialCatalogueDocument,
  parseMaterialLineDocument,
  parseMaterialListDocuments,
  parseMaterialSendRecordDocument,
  parseOperativeProfileDocument,
  parseSiteAuditDocument,
  parseTaskDocument,
  parseTradeTypeInventory,
  parseWholesalerDocument,
  siteAuditWriteFields,
  taskFields,
  taskWriteFields,
  tradeTypeInventoryWriteFields,
  wholesalerWriteFields,
} from './operationsDocuments.ts'
import {
  foldHealthSafetySignatures,
  healthSafetyDocumentWriteFields,
  healthSafetyIssueStatus,
  healthSafetySignatureKey,
  healthSafetySignatureWriteFields,
  KNOWN_NOTIFICATION_TYPES,
  notificationReadWriteFields,
  parseHealthSafetyDocument,
  parseNotificationDocument,
  parseVariationDocument,
  parseVariationTrackerDocument,
  parseWarningResolutionDocument,
  sharedWarningResolutionKey,
  variationRenumberWriteFields,
  variationWriteFields,
  warningResolutionMigrationWrites,
  warningResolutionRecords,
} from './recordsDocuments.ts'
import { documentOrganizationId, parseSubcontractorDocument as opsParseSubcontractor, parseUserDocument as opsParseUser } from './peopleDocuments.ts'
import { materialCutOffWarningRows as opsMaterialCutOffWarningRows, materialLineCountsAsOrdered } from './materialCutOffWarnings.ts'
import { NOTIFICATION_CATALOG as OPS_NOTIFICATION_CATALOG } from './notificationRecipients.ts'
import { resolvedWarningKeys as opsResolvedWarningKeys } from './scheduleSources.ts'

const OPS_TS = (iso: string) => ({ seconds: Math.floor(Date.parse(iso) / 1000), nanoseconds: 0 })

test('1.8.0 material lines: iOS and web documents read the same, never dropped, organisation-zone day', () => {
  const ios = {
    id: 'A1B2C3D4-0000-4000-8000-000000000001',
    quantity: 3,
    unit: 'Box',
    material: 'Cable 2.5mm',
    addedBy: 'Sam',
    addedByUserId: 'uid-sam',
    addedAt: OPS_TS('2026-07-01T09:00:00Z'),
    projectId: 'PROJ-1',
    // iOS device midnight in BST: 23:00 UTC the day before is 1 July in London.
    date: OPS_TS('2026-06-30T23:00:00Z'),
    status: 'sentForQuote',
    sizeOrLength: '100',
    lengthUnit: 'm',
  }
  const line = parseMaterialLineDocument('a1b2c3d4-0000-4000-8000-000000000001', ios, { timeZone: 'Europe/London' })!
  assert.equal(line.id, 'a1b2c3d4-0000-4000-8000-000000000001')
  assert.equal(line.dayKey, '2026-07-01')
  assert.equal(line.status, 'sentForQuote')
  assert.equal(line.length, '100')
  assert.equal(line.lengthUnit, 'M')
  // Web wrote a numeric-string quantity, a lower-case unit, `name` only and a non-UUID id; iOS dropped it.
  const web = { quantity: '2', unit: 'number', name: 'Clips', projectId: 'p-web', dayKey: '2026-07-02', status: 'Sent for quote' }
  const webLine = parseMaterialLineDocument('web-line-1', web)!
  assert.equal(webLine.quantity, 2)
  assert.equal(webLine.unit, 'Number')
  assert.equal(webLine.material, 'Clips')
  assert.equal(webLine.dayKey, '2026-07-02')
  assert.equal(webLine.status, 'sentForQuote')
  assert.equal(parseMaterialLineDocument('x', { projectId: 'p' }), null)
  assert.equal(normalizeMaterialWorkflowStatus('order'), 'ordered')
  assert.equal(normalizeMaterialWorkflowStatus('nonsense'), 'draft')
  assert.deepEqual(
    parseMaterialListDocuments([{ id: 'b', data: web }, { id: 'a', data: ios }], { timeZone: 'Europe/London' }).map((row) => row.id),
    ['a', 'b']
  )
})

test('1.8.0 material line writes: organisation midnight, partial, owner fields never rewritten, no downgrade', () => {
  const fields = materialLineFields(
    { id: 'L1', projectId: 'P1', quantity: 2, unit: 'box', material: ' Cable ', dayKey: '2026-07-01', length: '', brand: '' },
    'Europe/London'
  )
  assert.equal(fields.date, Date.parse('2026-06-30T23:00:00Z'))
  assert.equal(fields.unit, 'Box')
  assert.equal(fields.name, 'Cable')
  assert.equal(fields.length, null)
  const stored = { ...fields, addedBy: 'Sam', addedByUserId: 'uid-sam', brand: 'Old', iosOnly: 'kept' }
  const write = materialLineWriteFields(stored, { ...fields, quantity: 5, addedByUserId: 'someone-else', brand: null })
  assert.deepEqual(write.set, { quantity: 5 })
  assert.deepEqual(write.remove, ['brand'])
  assert.deepEqual(materialSendStatusWriteFields('ordered', 'Quote'), { status: 'ordered', lastSentRequestType: 'Quote' })
  assert.deepEqual(materialSendStatusWriteFields('draft', 'order'), { status: 'ordered', lastSentRequestType: 'Order' })
  assert.equal(materialLineCountsAsOrdered({ id: 'L1', status: 'Order' }, []), true)
  assert.equal(materialLineCountsAsOrdered({ id: 'l1', status: 'draft' }, [{ requestType: 'Order', lines: [{ materialId: 'L1' }] }]), true)
  assert.equal(typeof opsMaterialCutOffWarningRows, 'function')
})

test('1.8.0 material catalogue: never delete-all and rewrite; an empty or failed load deletes nothing', () => {
  const stored = [
    { id: 'C1', data: { id: 'C1', name: 'Cable', brand: 'Prysmian', defaultUnit: 'Length', category: 'Electrical', createdByUserId: 'u1' } },
    { id: 'C2', data: { id: 'C2', name: 'Clips', brand: 'Custom', defaultUnit: 'Box', category: 'Other' } },
  ]
  const next = [
    { id: 'c1', name: 'Cable', brand: 'Prysmian', defaultUnit: 'Length', category: 'Electrical', createdByUserId: 'u2' },
    { id: 'C3', name: 'Tape', defaultUnit: 'Number', createdByUserId: 'u2', createdByName: 'Ann' },
  ]
  const result = materialCatalogueWrites({ stored, next, loaded: true })
  assert.deepEqual(result.remove, ['C2'])
  assert.equal(result.write.length, 1)
  assert.equal(result.write[0].id, 'C3')
  assert.equal(result.write[0].create, true)
  assert.equal(result.write[0].set.brand, 'Custom')
  // A failed load: nothing removed.
  assert.deepEqual(materialCatalogueWrites({ stored, next, loaded: false }).remove, [])
  // An empty list: nothing removed.
  assert.deepEqual(materialCatalogueWrites({ stored, next: [], loaded: true }), { write: [], remove: [] })
  const item = parseMaterialCatalogueDocument('not-a-uuid', { name: 'Box', sizeOrLength: '5', lengthUnit: 'mm' })!
  assert.equal(item.id, 'not-a-uuid')
  assert.equal(item.brand, 'Custom')
  assert.equal(item.lengthUnit, 'MM')
})

test('1.8.0 send records, wholesalers and site audits keep non-UUID ids and the other app’s fields', () => {
  const record = parseMaterialSendRecordDocument(
    'rec-1',
    {
      projectId: 'proj-x',
      requestType: 'Quote',
      sentAt: OPS_TS('2026-07-01T10:00:00Z'),
      deliveryRequiredAt: OPS_TS('2026-07-02T07:00:00Z'),
      sentBy: 'Sam',
      recipients: [{ name: 'Rep', email: 'rep@x.test' }, { name: 'No email' }],
      lines: [{ materialId: 'web-line-1', name: 'Clips', quantity: '4', unit: 'box' }],
    },
    { timeZone: 'Europe/London' }
  )!
  assert.equal(record.requestType, 'quote')
  assert.equal(record.deliveryRequiredAtMs, null)
  assert.equal(record.recipients.length, 1)
  assert.deepEqual(record.lines[0], { materialId: 'web-line-1', name: 'Clips', quantity: 4, unit: 'Box', brand: null, productCode: null, lengthDisplay: null })
  const create = materialSendRecordCreateFields({ id: 'R', projectId: 'P', requestType: 'quote', sentAt: 1, sentBy: 'S', deliveryRequiredAt: 2, recipients: [], lines: [] })
  assert.equal(create.requestType, 'Quote')
  assert.equal('deliveryRequiredAt' in create, false)

  const firm = parseWholesalerDocument('w-1', {
    name: 'CEF',
    createdAt: OPS_TS('2026-01-01T00:00:00Z'),
    contacts: [{ name: 'A', email: 'a@x.test' }, { id: 'c-2', name: 'B', email: 'b@x.test', isPrimary: true }],
  })!
  assert.equal(firm.updatedAtMs, Date.parse('2026-01-01T00:00:00Z'))
  assert.equal(firm.contacts[0].idStored, false)
  assert.equal(firm.contacts[0].id, parseWholesalerDocument('w-1', { name: 'CEF', contacts: [{ name: 'A', email: 'a@x.test' }] })!.contacts[0].id)
  assert.equal(firm.primaryContactId, 'c-2')
  assert.deepEqual(wholesalerWriteFields({ name: 'CEF', primaryContactId: 'c-2', contacts: [] }, { name: 'CEF', contacts: [{ id: 'x' }], primaryContactId: 'c-2' }).set, {
    contacts: [{ id: 'x' }],
    primaryContactId: 'c-2',
  })

  const audit = parseSiteAuditDocument('audit-1', {
    projectId: 'proj-x',
    type: 'Snagging Custom',
    date: OPS_TS('2026-06-30T23:00:00Z'),
    createdAt: OPS_TS('2026-06-30T23:00:00Z'),
    items: [{ title: 'Door', imageCapturedAt: OPS_TS('2026-07-01T08:00:00Z') }],
  }, { timeZone: 'Europe/London' })!
  assert.equal(audit.dayKey, '2026-07-01')
  assert.equal(audit.items[0].idStored, false)
  assert.equal(audit.items[0].imageCapturedAtMs, Date.parse('2026-07-01T08:00:00Z'))
  assert.deepEqual(siteAuditWriteFields({ createdAt: 1, type: 'A' }, { createdAt: 2, type: 'B' }).set, { type: 'B' })
  const merged = mergeStoredRows([{ id: 'I1', title: 'Door', imageCapturedAt: 5 }], [{ id: 'i1', title: 'Door 2', imageCapturedAt: null }])
  assert.deepEqual(merged, [{ id: 'i1', title: 'Door 2', imageCapturedAt: 5 }])
})

test('1.8.0 tasks: status synonyms, kept rows, derived item ids, partial writes', () => {
  const task = parseTaskDocument('task-web-1', {
    title: 'Fix door',
    projectId: 'not-a-uuid',
    status: 'in_progress',
    priority: 'urgent',
    items: [{ title: 'Hinge' }],
    completedItemIds: [],
    createdAt: OPS_TS('2026-07-01T09:00:00Z'),
  })!
  assert.equal(task.status, 'In Progress')
  assert.equal(task.priority, 'Urgent')
  assert.equal(task.items[0].id, parseTaskDocument('task-web-1', { title: 'x', items: [{ title: 'Hinge' }] })!.items[0].id)
  assert.equal(task.updatedAtMs, Date.parse('2026-07-01T09:00:00Z'))
  assert.equal(normalizeProjectTaskStatus('Done'), 'Completed')
  assert.equal(parseTaskDocument('t', { projectId: 'p' }), null)
  const before = { ...taskFields({ id: 't', projectId: 'p', title: 'A', dueDate: 100, createdBy: 'u1' }), iosOnly: 1 }
  const next = taskFields({ id: 't', projectId: 'p', title: 'A', status: 'Completed', completedBy: 'u2', completedAt: 200, createdBy: 'u9' })
  const write = taskWriteFields(before, next)
  assert.deepEqual(write.set, { status: 'Completed', completedBy: 'u2', completedAt: 200 })
  assert.deepEqual(write.remove, ['dueDate'])
})

test('1.8.0 job types and trade inventory: canonical names, never an empty overwrite, union only', () => {
  assert.equal(opsCanonicalJobTypeName('small_works'), 'Small Works')
  assert.deepEqual(opsCoerceJobTypeList('catA, Maintenance, cat a'), ['CAT A', 'Maintenance'])
  assert.deepEqual(parseJobTypesDocument({ jobTypes: [{ name: 'CAT B' }] }, { jobTypes: ['Decarbonization'] }).jobTypes, ['CAT B', 'Decarbonisation'])
  assert.equal(jobTypesWriteFields(['CAT A'], []), null)
  assert.equal(jobTypesWriteFields(['CAT A'], ['cata']), null)
  assert.deepEqual(jobTypesWriteFields(['CAT A'], ['CAT A', 'Fit out']), { set: { jobTypes: ['CAT A', 'Fit out'] } })
  assert.deepEqual(parseTradeTypeInventory({ trades: ['Electrical', ' electrical ', 'Plumbing'] }).trades, ['Electrical', 'Plumbing'])
  assert.equal(tradeTypeInventoryWriteFields({ trades: ['Electrical'] }, ['ELECTRICAL']), null)
  assert.deepEqual(tradeTypeInventoryWriteFields({ trades: ['Electrical'] }, ['Dryliner']), { set: { trades: ['Electrical', 'Dryliner'] } })
})

test('1.8.0 operativeProfiles, organisation references and subcontractor contacts', () => {
  const profile = parseOperativeProfileDocument('uid-1', { payBasis: 'hourly', hourlyRate: '18.5', assignedManagerUserId: 'm1' })!
  assert.equal(profile.userId, 'uid-1')
  assert.equal(profile.payBasis, 'hourly')
  assert.equal(profile.hourlyRate, 18.5)
  assert.deepEqual(profile.assignedManagerUserIds, ['m1'])
  assert.deepEqual(operativeProfileWriteFields({ payBasis: 'day', dayRate: 100 }, { payBasis: 'hourly', dayRate: null, hourlyRate: 20 }), {
    set: { payBasis: 'hourly', hourlyRate: 20 },
    remove: ['dayRate'],
  })
  assert.equal(documentOrganizationId('organizations/ORG-1'), 'ORG-1')
  assert.equal(documentOrganizationId('/organizations/ORG-1'), 'ORG-1')
  assert.equal(documentOrganizationId({ id: 'ORG-2', path: 'organizations/ORG-2' }), 'ORG-2')
  assert.equal(documentOrganizationId({ _key: { path: { segments: ['organizations', 'ORG-3'] } } }), 'ORG-3')
  assert.equal(documentOrganizationId('org-4'), 'org-4')
  assert.equal(opsParseUser('u', { organizationId: 'organizations/ORG-1' })!.organizationId, 'ORG-1')
  assert.equal(opsParseUser('u', {})!.annualLeaveDefaultsPending, true)
  assert.equal(opsParseUser('u', {}, { annualLeaveDefaults: { daysPerYear: 28 } })!.annualLeaveDefaultsPending, false)
  const firm = opsParseSubcontractor('firm-1', { name: 'Sparks', subcontractorType: 'Electrical', contacts: [{ name: 'Jo', email: 'jo@x.test' }] })!
  assert.equal(firm.contacts[0].idStored, false)
  assert.match(firm.contacts[0].id, /^[0-9A-F]{8}-[0-9A-F]{4}-8[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/)
  assert.equal(firm.contacts[0].id, opsParseSubcontractor('firm-1', { name: 'Sparks', subcontractorType: 'Electrical', contacts: [{ name: 'Jo', email: 'JO@x.test' }] })!.contacts[0].id)
})

test('1.8.0 health & safety: issue statuses agree, concurrent signatures are never lost', () => {
  const web = { issues: [{ id: 'I1', talkId: 'T1', status: 'complete', recipientUserIds: ['u1', 'u2'] }] }
  const ios = { issues: [{ id: 'I1', talkId: 'T1', status: 'completed', recipientUserIds: ['u1', 'u2'] }] }
  assert.equal(parseHealthSafetyDocument(web).issues[0].status, 'complete')
  assert.equal(parseHealthSafetyDocument(ios).issues[0].status, 'complete')
  // An issue is stored `completed`, the word every iOS build reads.
  const save = healthSafetyDocumentWriteFields({ issues: [{ id: 'I1', ramsDocumentId: 'R9' }] }, { issues: [{ id: 'I1', status: 'complete' }] })
  assert.deepEqual(save.set.issues, [{ id: 'I1', ramsDocumentId: 'R9', status: 'completed' }])
  // An empty list never replaces a stored one.
  assert.equal('talks' in healthSafetyDocumentWriteFields({ talks: [{ id: 'A' }] }, { talks: [] }).set, false)
  assert.equal('signatureRecords' in save.set, false)

  // Two people sign at once from the same pending copy: each writes only their own map key.
  const pending = { signatures: [{ id: 'S1', issueId: 'I1', userId: 'u1', status: 'pending' }, { id: 'S2', issueId: 'I1', userId: 'u2', status: 'pending' }] }
  const first = healthSafetySignatureWriteFields({ issueId: 'I1', userId: 'u1', signatureId: 'S1', signedAt: 1000 })!
  const second = healthSafetySignatureWriteFields({ issueId: 'I1', userId: 'u2', signatureId: 'S2', signedAt: 2000 })!
  assert.notDeepEqual(first.fieldPath, second.fieldPath)
  const stored = {
    ...pending,
    signatureRecords: { [first.fieldPath[1]]: first.value, [second.fieldPath[1]]: second.value },
  }
  // An older build's whole-array merge-save of the pending copy cannot remove the map entries.
  const parsed = parseHealthSafetyDocument(stored)
  assert.equal(parsed.signatures.length, 2)
  assert.ok(parsed.signatures.every((row) => row.status === 'signed'))
  assert.deepEqual(parsed.signatures.map((row) => row.id).sort(), ['S1', 'S2'])
  assert.equal(healthSafetyIssueStatus({ id: 'I1', status: 'awaiting', recipientUserIds: ['u1', 'u2'] }, parsed.signatures), 'complete')
  assert.equal(healthSafetyIssueStatus({ id: 'I1', status: 'awaiting', recipientUserIds: ['u1', 'u2', 'u3'] }, parsed.signatures), 'awaiting')
  assert.equal(healthSafetySignatureKey('I1', 'U1'), 'i1__u1')
  assert.equal(foldHealthSafetySignatures([
    { id: 'a', issueId: 'I1', userId: 'u1', status: 'signed', readConfirmed: true, signatureImageBase64: 'img', signedAtMs: 5, reminderSentAtMs: null },
    { id: 'b', issueId: 'i1', userId: 'U1', status: 'pending', readConfirmed: false, signatureImageBase64: null, signedAtMs: null, reminderSentAtMs: 9 },
  ])[0].status, 'signed')
})

test('1.8.0 variations: stable line ids, recomputed counters, partial and renumber writes', () => {
  const doc = { status: 'Submitted', labour: [{ trade: 'Electrician', hours: '3.5' }, { trade: '', hours: 0 }], materials: [{ name: 'Cable', quantity: 2 }], evidence: [{ storagePath: 'a/b.jpg' }], totalLabourHours: 99 }
  const first = parseVariationDocument('V1', doc)!
  const again = parseVariationDocument('V1', doc)!
  assert.equal(first.labour.length, 1)
  assert.equal(first.labour[0].id, again.labour[0].id)
  assert.equal(first.totalLabourHours, 3.5)
  assert.equal(first.materials[0].quantity, '2')
  assert.equal(first.status, 'submitted')
  const write = variationWriteFields({ status: 'open', heading: 'A', createdAt: 1, statusHistory: [] }, { status: 'submitted', heading: 'A', createdAt: 2, statusHistory: [{ status: 'submitted' }] })
  assert.deepEqual(write.set, { status: 'submitted', statusHistory: [{ status: 'submitted' }] })
  assert.deepEqual(variationRenumberWriteFields({ stored: { voNumber: 'VO-001', sequence: 1, numberHistory: [] }, to: 'VO-002', sequence: 2, at: 7, byUid: 'u' }), {
    set: { sequence: 2, voNumber: 'VO-002', numberHistory: [{ from: 'VO-001', to: 'VO-002', at: 7, byUid: 'u' }] },
  })
  assert.equal(variationRenumberWriteFields({ stored: { voNumber: 'VO-001', sequence: 1 }, to: 'VO-001', sequence: 1, at: 7, byUid: 'u' }), null)
  assert.equal(variationRenumberWriteFields({ stored: { voNumber: 'VO-001', sequence: 1, voNumberLocked: true }, to: 'VO-005', sequence: 1, at: 7, byUid: 'u' }), null)
  assert.equal(parseVariationTrackerDocument('P1', undefined).prefix, 'VO-')
})

test('1.8.0 notifications: unknown types kept, every catalogue type known, non-UUID relatedId kept', () => {
  const row = parseNotificationDocument('not-a-uuid', { type: 'variation', title: 'New', relatedId: 'var-123', userId: 'u1', createdAt: OPS_TS('2026-07-01T09:00:00Z') }, { role: 'manager' })!
  assert.equal(row.id, 'not-a-uuid')
  assert.equal(row.known, true)
  assert.equal(row.relatedId, 'var-123')
  assert.equal(row.isRead, false)
  assert.ok(row.destination)
  const future = parseNotificationDocument('n2', { type: 'something_new_2027', title: 'x', isRead: 'true' })!
  assert.equal(future.type, 'something_new_2027')
  assert.equal(future.known, false)
  assert.equal(future.isRead, true)
  assert.equal(parseNotificationDocument('n3', { title: 'no type' }), null)
  for (const entry of OPS_NOTIFICATION_CATALOG) assert.ok(KNOWN_NOTIFICATION_TYPES.includes(entry.type), entry.type)
  for (const type of ['variation', 'variation_renumbered', 'idea_comment', 'idea_merged', 'material_added']) assert.ok(KNOWN_NOTIFICATION_TYPES.includes(type))
  assert.equal(parseNotificationDocument('n4', { type: 'booking_created', relatedId: '2026-07-01' })!.dayKey, '2026-07-01')
  assert.deepEqual(notificationReadWriteFields({ isRead: false }), { set: { isRead: true } })
  assert.equal(notificationReadWriteFields({ isRead: true }), null)
})

test('1.8.0 warningResolutions: legacy keys read in shared form and migrate once', () => {
  const seconds = Math.floor(Date.parse('2026-10-21T23:00:00Z') / 1000) // 22 Oct in London (BST)
  assert.equal(sharedWarningResolutionKey(`mgr-clash-uid1-${seconds}.0-0`, 'Europe/London'), 'mgr-clash-uid1-2026-10-22-0')
  assert.equal(sharedWarningResolutionKey(`materials-PROJ-1-${seconds}`, 'Europe/London'), 'materials-PROJ-1-2026-10-22')
  assert.equal(sharedWarningResolutionKey('materials-PROJ-1-2026-10-22'), 'materials-PROJ-1-2026-10-22')
  const docs = [
    { id: `mgr-clash-uid1-${seconds}.0-0`, data: { resolutionKey: `mgr-clash-uid1-${seconds}.0-0`, status: 'approved' } },
    { id: 'op-clash-OLD-1', data: { status: 'dismissed' } },
    { id: 'op-clash-OLD-2', data: { status: 'approved' } },
    { id: 'already-shared', data: { status: 'approved' } },
    { id: 'op-clash-OLD-3', data: { status: 'approved' } },
  ]
  const parsed = parseWarningResolutionDocument(docs[0].id, docs[0].data, { timeZone: 'Europe/London' })!
  assert.equal(parsed.isLegacyKey, true)
  assert.ok(opsResolvedWarningKeys(warningResolutionRecords(docs, 'Europe/London')).includes('mgr-clash-uid1-2026-10-22-0'))
  const writes = warningResolutionMigrationWrites({
    docs,
    legacyKeyForms: { 'pair-a-b': ['op-clash-OLD-1', 'op-clash-OLD-2'], 'already-shared': ['op-clash-OLD-3'] },
    resolvedByUserId: 'staff-1',
    timeZone: 'Europe/London',
  })
  assert.deepEqual(writes.map((write) => [write.documentId, write.fields.status]), [
    ['mgr-clash-uid1-2026-10-22-0', 'approved'],
    ['pair-a-b', 'approved'],
  ])
  // Once written, nothing more to migrate.
  const after = [...docs, ...writes.map((write) => ({ id: write.documentId, data: { ...write.fields } }))]
  assert.deepEqual(warningResolutionMigrationWrites({ docs: after, legacyKeyForms: { 'pair-a-b': ['op-clash-OLD-1'] }, resolvedByUserId: 'staff-1', timeZone: 'Europe/London' }), [])
})

test('the iOS JavaScript bundle reads operations and record documents the same way', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: unknown[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const api = sandbox.ProjectPlannerCanonical!
  const plain = (value: unknown) => JSON.parse(JSON.stringify(value))
  const line = { projectId: 'P', material: 'Cable', date: OPS_TS('2026-06-30T23:00:00Z'), unit: 'box' }
  assert.deepEqual(plain(api.parseMaterialLineDocument('L', line, { timeZone: 'Europe/London' })), plain(parseMaterialLineDocument('L', line, { timeZone: 'Europe/London' })))
  const note = { type: 'variation_renumbered', relatedId: 'abc', title: 't' }
  assert.deepEqual(plain(api.parseNotificationDocument('n', note)), plain(parseNotificationDocument('n', note)))
  const task = { title: 'A', items: [{ title: 'x' }], status: 'done' }
  assert.deepEqual(plain(api.parseTaskDocument('t', task)), plain(parseTaskDocument('t', task)))
  const hs = { signatures: [{ id: 'S', issueId: 'I', userId: 'u', status: 'signed' }] }
  assert.deepEqual(plain(api.parseHealthSafetyDocument(hs)), plain(parseHealthSafetyDocument(hs)))
  for (const name of [
    'materialCatalogueWrites', 'materialLineWriteFields', 'parseWholesalerDocument', 'parseSiteAuditDocument', 'parseMaterialSendRecordDocument',
    'parseVariationDocument', 'variationRenumberWriteFields', 'healthSafetySignatureWriteFields', 'warningResolutionMigrationWrites',
    'parseJobTypesDocument', 'tradeTypeInventoryWriteFields', 'parseOperativeProfileDocument', 'documentOrganizationId', 'taskWriteFields',
  ]) {
    assert.equal(typeof api[name], 'function', name)
  }
})

test('1.8.0 job keys map back to the stored job id; a job with a client name and no id gets a stable client id', async () => {
  const { storedJobIdForKey, jobClientId, deadlineAssignedProjectIds: assigned, parseJobDocument: parseJob } = await import('./workDocumentReaders.ts')
  const { healthSafetyDocumentId, healthSafetyDocumentIds } = await import('./recordsDocuments.ts')
  assert.equal(storedJobIdForKey('ABC-JOB', ['abc-job', 'other']), 'abc-job')
  assert.equal(storedJobIdForKey('missing', ['abc-job']), null)
  assert.deepEqual(assigned({ projects: { 'ABC-JOB': ['u1'], 'GONE': ['u1'] } }, 'u1', ['abc-job']), ['abc-job'])
  assert.deepEqual(assigned({ projects: { 'ABC-JOB': ['u1'] } }, 'u1'), ['ABC-JOB'])
  const job = parseJob('job-1', { siteName: 'Tower', client: { name: 'Acme' } })!
  assert.equal(job.client.idStored, false)
  assert.equal(job.client.id, jobClientId('job-1', 'ACME'))
  assert.equal(parseJob('job-1', { siteName: 'Tower', clientId: 'c-9' })!.client.id, 'c-9')
  assert.equal(parseJob('job-1', { siteName: 'Tower' })!.client.id, '')
  assert.equal(healthSafetyDocumentId('abc-job', false), 'healthSafety_projects_ABC-JOB')
  assert.deepEqual(healthSafetyDocumentIds('abc-job', true), ['healthSafety_smallWorks_ABC-JOB', 'healthSafety_smallWorks_abc-job'])
  assert.deepEqual(healthSafetyDocumentIds('ABC', false), ['healthSafety_projects_ABC'])
})

// MARK: - Rulebook 1.9.0

test('1.9.0 LIVE_COLLECTIONS lists every shared collection; screens listen by default', async () => {
  const { LIVE_COLLECTIONS, liveCollection, screenMustListen } = await import('./liveSources.ts')
  const required = [
    'bookings', 'managerSiteBookings', 'subcontractorBookings', 'projects', 'smallWorks', 'holidayBookings', 'timesheets',
    'users', 'operatives', 'managers', 'clients', 'subcontractors', 'operativeDayRateHistory', 'organization',
    'warningResolutions', 'acceptedBookingClashes', 'dismissedWarnings', 'materials', 'materialSendRecords',
    'materialCatalogue', 'wholesalers', 'siteAudits', 'tasks', 'healthSafety', 'variations', 'deadlines',
    'notifications', 'jobTypes', 'skills',
  ]
  for (const id of required) {
    assert.ok(liveCollection(id), id)
    assert.equal(screenMustListen(id), true, id)
  }
  const ids = LIVE_COLLECTIONS.map((row) => row.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(screenMustListen('deletedBookings'), false)
  assert.equal(screenMustListen('taxIds'), false)
  assert.equal(screenMustListen('somethingNew'), true)
  assert.equal(liveCollection('HOLIDAYBOOKINGS')!.id, 'holidayBookings')
  for (const row of LIVE_COLLECTIONS.filter((entry) => !entry.listen)) assert.ok(row.note, row.id)
})

test('1.9.0 only a user action or its offline replay writes; an edit of a missing document is refused', async () => {
  const { syncWriteAllowed, recordsToSave, editOfMissingDocumentIsRefused, replayRefusedIsFinal } = await import('./liveSources.ts')
  const { bookingReplayRefusedIsFinal } = await import('./bookingTombstones.ts')
  assert.equal(syncWriteAllowed('userAction'), true)
  assert.equal(syncWriteAllowed('offlineReplay'), true)
  for (const trigger of ['launch', 'foreground', 'reconnect', 'backgroundSync', 'pullToRefresh', 'listenerSnapshot', undefined, 'x']) {
    assert.equal(syncWriteAllowed(trigger), false, String(trigger))
  }
  const rows = [{ id: 'A' }, { id: 'b' }, { id: 'C' }]
  assert.deepEqual(recordsToSave(rows, ['a', 'B']), [{ id: 'A' }, { id: 'b' }])
  assert.deepEqual(recordsToSave(rows, []), [])
  assert.equal(editOfMissingDocumentIsRefused({ isCreate: false, exists: false }), true)
  assert.equal(editOfMissingDocumentIsRefused({ isCreate: false, code: 'not-found' }), true)
  assert.equal(editOfMissingDocumentIsRefused({ isCreate: false, code: 5 }), true)
  assert.equal(editOfMissingDocumentIsRefused({ isCreate: false, exists: true }), false)
  assert.equal(editOfMissingDocumentIsRefused({ isCreate: true, exists: false }), false)
  assert.equal(editOfMissingDocumentIsRefused({ isCreate: null, code: 'not-found' }), false)
  // The general replay rule agrees with the booking rule.
  for (const input of [
    { code: 'permission-denied', isCreate: true },
    { code: 7, isCreate: false },
    { code: 'not-found', isCreate: false },
    { code: 'not-found', isCreate: true },
    { code: 'unavailable', isCreate: false },
    { code: 5, isCreate: null },
  ]) {
    assert.equal(replayRefusedIsFinal(input), bookingReplayRefusedIsFinal(input), JSON.stringify(input))
  }
})

test('1.9.0 removing the last health & safety row or job type needs an explicit removal', async () => {
  const { healthSafetyDocumentWriteFields } = await import('./recordsDocuments.ts')
  const { jobTypesWriteFields } = await import('./operationsDocuments.ts')
  const stored = { issues: [{ id: 'I1', status: 'awaiting' }], otherDocuments: [{ id: 'D1' }, { id: 'D2' }] }
  // Empty without intent: a failed load never wipes.
  assert.deepEqual(healthSafetyDocumentWriteFields(stored, { issues: [] }), { set: {}, remove: [] })
  // Removing the last issue on purpose writes the empty list.
  assert.deepEqual(healthSafetyDocumentWriteFields(stored, { issues: [] }, { removedIds: { issues: ['i1'] } }).set, { issues: [] })
  // Naming only one of two stored documents is not enough to write an empty list.
  assert.deepEqual(healthSafetyDocumentWriteFields(stored, { otherDocuments: [] }, { removedIds: { otherDocuments: ['D1'] } }).set, {})
  assert.deepEqual(
    healthSafetyDocumentWriteFields(stored, { otherDocuments: [] }, { removedIds: { otherDocuments: ['D1', 'D2'] } }).set,
    { otherDocuments: [] }
  )
  assert.equal(jobTypesWriteFields(['Electrical'], []), null)
  assert.equal(jobTypesWriteFields(['Electrical', 'Plumbing'], [], { removed: ['electrical'] }), null)
  assert.deepEqual(jobTypesWriteFields(['Electrical', 'Plumbing'], [], { removed: ['Electrical', 'PLUMBING'] }), { set: { jobTypes: [] } })
  assert.equal(jobTypesWriteFields([], [], { removed: ['x'] }), null)
  assert.deepEqual(jobTypesWriteFields(['Electrical'], ['Plumbing']), { set: { jobTypes: ['Plumbing'] } })
})

test('1.9.0 removing a recipient or an issue removes only those signatures', async () => {
  const { healthSafetySignatureRemovalWrites, healthSafetySignatureKey } = await import('./recordsDocuments.ts')
  const stored = {
    signatureRecords: {
      [healthSafetySignatureKey('I1', 'u1')]: { issueId: 'I1', userId: 'u1', status: 'signed' },
      [healthSafetySignatureKey('I1', 'u2')]: { issueId: 'I1', userId: 'u2', status: 'pending' },
      [healthSafetySignatureKey('I2', 'u1')]: { issueId: 'I2', userId: 'u1', status: 'signed' },
      'i3__u9': {},
    },
    signatures: [
      { issueId: 'I1', userId: 'U2', status: 'pending' },
      { issueId: 'I2', userId: 'u1', status: 'signed' },
    ],
  }
  const recipient = healthSafetySignatureRemovalWrites(stored, [{ issueId: 'i1', userId: 'u2' }])!
  assert.deepEqual(recipient.removeFieldPaths, [['signatureRecords', 'i1__u2']])
  assert.deepEqual(recipient.signatures, [{ issueId: 'I2', userId: 'u1', status: 'signed' }])
  const issue = healthSafetySignatureRemovalWrites(stored, [{ issueId: 'I1' }, { issueId: 'I3' }])!
  assert.deepEqual(issue.removeFieldPaths, [['signatureRecords', 'i1__u1'], ['signatureRecords', 'i1__u2'], ['signatureRecords', 'i3__u9']])
  assert.equal(healthSafetySignatureRemovalWrites(stored, [{ issueId: 'I9' }]), null)
  assert.equal(healthSafetySignatureRemovalWrites(stored, []), null)
  const arrayOnly = healthSafetySignatureRemovalWrites({ signatures: [{ issueId: 'I2', userId: 'u1' }] }, [{ issueId: 'I2' }])!
  assert.deepEqual(arrayOnly, { removeFieldPaths: [], signatures: [] })
})

test('1.9.0 variation trackers, custom trades and settings-log entries are written as partial updates', async () => {
  const {
    variationTrackerWriteFields,
    variationTradesWriteFields,
    parseVariationTrades,
    variationLogItems,
    variationLogItemId,
    variationLogWriteFields,
    parseVariationLogDocument,
  } = await import('./recordsDocuments.ts')
  const at = '2026-11-02T10:00:00Z'
  assert.deepEqual(variationTrackerWriteFields(null, { kind: 'enable', parentId: 'P', parentType: 'smallWork', actorUid: 'u', at }), {
    set: { parentId: 'P', parentType: 'smallWork', enabled: true, enabledAt: at, enabledByUid: 'u', numberingMode: 'lockSubmitted', prefix: 'VO-', padding: 3, version: 1 },
    remove: [],
  })
  const stored = { parentId: 'P', enabled: true, numberingMode: 'resequenceAll', prefix: 'V', padding: 2, version: 4, lockedByUid: 'x', lockedByName: 'X', lockedAt: at }
  assert.deepEqual(variationTrackerWriteFields(stored, { kind: 'enable', parentId: 'P', parentType: 'project', actorUid: 'u', at }), {
    set: { enabled: true, enabledAt: at, enabledByUid: 'u' },
    remove: [],
  })
  assert.deepEqual(variationTrackerWriteFields(stored, { kind: 'renumbered' }), { set: { version: 5 }, remove: ['lockedByUid', 'lockedByName', 'lockedAt'] })
  assert.deepEqual(variationTrackerWriteFields(stored, { kind: 'unlock' })!.remove, ['lockedByUid', 'lockedByName', 'lockedAt'])
  assert.equal(variationTrackerWriteFields({ parentId: 'P' }, { kind: 'unlock' }), null)
  assert.equal(variationTrackerWriteFields(stored, { kind: 'mode', numberingMode: 'resequenceAll' }), null)
  assert.deepEqual(variationTrackerWriteFields(stored, { kind: 'disable' }), { set: { enabled: false }, remove: ['lockedByUid', 'lockedByName', 'lockedAt'] })
  assert.deepEqual(variationTrackerWriteFields(stored, { kind: 'lock', parentId: 'P', parentType: 'project', actorUid: 'u', actorName: 'U', at }), {
    set: { lockedByUid: 'u', lockedByName: 'U', lockedAt: at },
    remove: [],
  })

  assert.deepEqual(parseVariationTrades({ customTrades: [' Tiler ', 'tiler', 'Roofer', 3] }), { customTrades: ['Tiler', 'Roofer'] })
  assert.deepEqual(variationTradesWriteFields({ customTrades: ['Tiler'] }, { add: ['Roofer', 'TILER'] }), { set: { customTrades: ['Tiler', 'Roofer'] } })
  assert.deepEqual(variationTradesWriteFields({ customTrades: ['Tiler', 'Roofer'] }, { remove: ['tiler'] }), { set: { customTrades: ['Roofer'] } })
  assert.equal(variationTradesWriteFields({ customTrades: ['Tiler'] }, { add: ['tiler'] }), null)

  const log = { items: [{ heading: 'No id', voNumber: 'VO-001' }, { id: 'V2', heading: 'Two', extra: 'kept' }] }
  const items = variationLogItems('P', log)
  assert.equal(items[0].idStored, false)
  assert.equal(items[0].id, variationLogItemId('P', 0, log.items[0]))
  assert.equal(variationLogItems('P', log)[0].id, items[0].id)
  assert.deepEqual(parseVariationLogDocument('P', log).map((row) => row.id), [items[0].id, 'V2'])
  const write = variationLogWriteFields(log, { id: 'v2', heading: 'Two edited' }, { parentId: 'P' })!
  assert.deepEqual(write.set, {
    items: [
      { heading: 'No id', voNumber: 'VO-001', id: items[0].id },
      { id: 'V2', heading: 'Two edited', extra: 'kept' },
    ],
  })
  const created = variationLogWriteFields(null, { id: 'N', heading: 'New' }, { parentId: 'P', parentType: 'smallWork', organizationId: 'O' })!
  assert.deepEqual(created.set, { items: [{ id: 'N', heading: 'New' }], parentId: 'P', parentType: 'smallWork', organizationId: 'O', recordType: 'variationLog' })
  const mapForm = variationLogItems('P', { items: { K1: { heading: 'x' } } })
  assert.deepEqual(mapForm.map((row) => row.id), ['K1'])
})

test('1.9.0 annual leave figures are left out of a save while the organisation defaults are pending', async () => {
  const { annualLeavePendingOmitFields, parseUserDocument } = await import('./peopleDocuments.ts')
  const pending = parseUserDocument('u', { annualLeaveDaysPerYear: 20 })!
  assert.equal(pending.annualLeaveDefaultsPending, true)
  assert.deepEqual(annualLeavePendingOmitFields(pending), ['annualLeaveYearStartMonth', 'annualLeaveYearEndMonth', 'annualLeaveCarriesOver'])
  assert.deepEqual(annualLeavePendingOmitFields(pending, ['annualLeaveCarriesOver']), ['annualLeaveYearStartMonth', 'annualLeaveYearEndMonth'])
  const loaded = parseUserDocument('u', {}, { annualLeaveDefaults: { daysPerYear: 28 } })!
  assert.deepEqual(annualLeavePendingOmitFields(loaded), [])
  assert.deepEqual(annualLeavePendingOmitFields(null), [])
})

test('1.9.0 notification relatedId per type, and a notice is created once', async () => {
  const { notificationRelatedId, NOTIFICATION_RELATED_ID, notificationCreateFields, KNOWN_NOTIFICATION_TYPES } = await import('./recordsDocuments.ts')
  for (const type of KNOWN_NOTIFICATION_TYPES) assert.ok(NOTIFICATION_RELATED_ID[type], type)
  assert.equal(notificationRelatedId('holiday_request_submitted', { holidayBookingId: ' HB-1 ', jobId: 'J' }), 'HB-1')
  assert.equal(notificationRelatedId('variation', { variationId: 'v-1' }), 'v-1')
  assert.equal(notificationRelatedId('variation_renumbered', { jobId: 'J', variationId: 'v-1' }), 'J')
  assert.equal(notificationRelatedId('timesheet_signed_by_manager', { holidayBookingId: 'x' }), null)
  assert.equal(notificationRelatedId('timesheet_submission_reminder', { paymentDayKey: '2026-11-06' }), '2026-11-06')
  assert.equal(notificationRelatedId('timesheet_submission_reminder', { paymentDayKey: 'Fri' }), null)
  assert.equal(notificationRelatedId('task_created', {}), null)
  assert.equal(notificationRelatedId('unknown_type', { jobId: 'J' }), null)
  const input = {
    organizationId: 'O', type: 'client_created', title: 'T', message: 'M', userId: 'admin', actorUserId: 'me',
    relatedId: 'C1', createdAt: 123, dayKey: 'nope', catalogue: 'projects',
  }
  assert.deepEqual(notificationCreateFields(input), {
    set: {
      organizationId: 'O', type: 'client_created', title: 'T', message: 'M', userId: 'admin', relatedId: 'C1',
      requiresPermission: null, deepLinkUserId: null, isRead: false, createdAt: 123, actorUserId: 'me', catalogue: 'projects',
    },
  })
  assert.equal(notificationCreateFields(input, { isRead: true }), null)
  assert.equal(notificationCreateFields({ ...input, userId: '' }), null)
  assert.equal(notificationCreateFields({ ...input, actorUserId: null })!.set.actorUserId, undefined)
})

test('1.9.0 create shapes for invitations, organisations and tax ids', async () => {
  const { invitationCreateFields, invitationUsedWriteFields, organizationCreateFields, taxIdsDocumentFields } = await import('./createDocuments.ts')
  const invite = invitationCreateFields({
    email: ' New@Example.com ', organizationId: 'O', invitedBy: 'a', firstName: ' Ann ', surname: 'Lee',
    employmentType: 'paye', permissions: { manager: true }, createdAt: 1, assignedManagerUserIds: ['m1', 'M1', 'm2'],
    payBasis: 'hourly', hourlyRate: 20, dayRate: 150, timesheetsEnabled: true, annualLeaveDaysPerYear: 25,
  })!
  assert.deepEqual(invite, {
    email: 'new@example.com', organizationId: 'O', invitedBy: 'a', firstName: 'Ann', surname: 'Lee', employmentType: 'paye',
    permissions: { manager: true }, role: 'manager', inviteType: 'new_user', createdAt: 1, isUsed: false,
    assignedManagerUserIds: ['m1', 'm2'], assignedManagerUserId: 'm1', hasNoLineManager: false,
    payBasis: 'hourly', hourlyRate: 20, timesheetsEnabled: true, annualLeaveDaysPerYear: 25,
  })
  assert.equal('utrNumber' in invite, false)
  assert.equal(invitationCreateFields({ email: '', organizationId: 'O', invitedBy: 'a', firstName: '', surname: '', permissions: {}, createdAt: 1 }), null)
  const operative = invitationCreateFields({ email: 'o@x.com', organizationId: 'O', invitedBy: 'a', firstName: 'O', surname: 'P', permissions: { operativeMode: true }, createdAt: 1, hasNoLineManager: true })!
  assert.equal(operative.hasNoLineManager, true)
  assert.equal(operative.timesheetsEnabled, false)
  assert.equal(operative.employmentType, 'self_employed')
  assert.deepEqual(invitationUsedWriteFields(5), { set: { isUsed: true, usedAt: 5 } })

  const org = organizationCreateFields({
    name: ' Acme ', creatorUserId: 'u1', planKey: 'year', createdAt: 9,
    setupFields: { countryCode: 'GB', members: { hacker: 'admin' }, billing: { status: 'active' } },
    settings: { currencyCode: 'GBP' },
  })!
  assert.equal(org.name, 'Acme')
  assert.deepEqual(org.members, { u1: 'admin' })
  assert.equal(org.creatorUserId, 'u1')
  assert.equal(org.countryCode, 'GB')
  assert.deepEqual(org.billing, { status: 'pending', billingInterval: 'year', trialUsed: false, mrrPence: 0, updatedAt: 9 })
  assert.deepEqual(org.subscription, { status: 'pending', planKey: 'year', createdAt: 9 })
  assert.deepEqual(org.settings, { currencyCode: 'GBP' })
  assert.equal(organizationCreateFields({ name: '', creatorUserId: 'u', createdAt: 1 }), null)

  assert.deepEqual(taxIdsDocumentFields({ utrNumber: ' 123 ', vatNumber: null, updatedByUserId: 'u' }), { utrNumber: '123', vatNumber: '', updatedByUserId: 'u' })
  assert.equal(taxIdsDocumentFields({ utrNumber: 'x'.repeat(21), updatedByUserId: 'u' }), null)
})

test('1.9.0 the iOS bundle exposes the live-source and create helpers', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, unknown> } = {}
  runInContext(source, createContext(sandbox))
  const api = sandbox.ProjectPlannerCanonical!
  for (const name of [
    'liveCollection', 'screenMustListen', 'syncWriteAllowed', 'recordsToSave', 'editOfMissingDocumentIsRefused',
    'replayRefusedIsFinal', 'healthSafetySignatureRemovalWrites', 'variationTrackerWriteFields', 'variationTradesWriteFields',
    'parseVariationTrades', 'variationLogItems', 'variationLogItemId', 'variationLogWriteFields', 'parseVariationLogDocument',
    'annualLeavePendingOmitFields', 'notificationRelatedId', 'notificationCreateFields', 'invitationCreateFields',
    'invitationUsedWriteFields', 'organizationCreateFields', 'taxIdsDocumentFields',
  ]) {
    assert.equal(typeof api[name], 'function', name)
  }
  assert.ok(Array.isArray(api.LIVE_COLLECTIONS))
  const fn = api.notificationRelatedId as (type: string, input: Record<string, unknown>) => unknown
  assert.equal(fn('client_created', { clientId: 'C' }), 'C')
})

test('1.9.0 H2: a timesheet save writes only what this editor changed since it loaded the sheet', async () => {
  const { timesheetChangedFields } = await import('./timesheetEntryReviews.ts')
  const base = { userId: 'u', managerNote: '', expenseEntries: [{ id: 'e1', amount: 10 }], managerSignedAt: null, updatedAt: 1 }
  // The reviewer changed only the note; the owner's expense added on iOS since the load is not in `next`'s diff.
  const next = { ...base, managerNote: 'Checked', updatedAt: 2 }
  assert.deepEqual(timesheetChangedFields(base, next), { set: { managerNote: 'Checked' }, remove: [] })
  assert.deepEqual(timesheetChangedFields(base, { ...base }), { set: {}, remove: [] })
  // A cleared value removes a field only when the base had one.
  assert.deepEqual(timesheetChangedFields({ ...base, operativeSignedAt: 5 }, { ...base, operativeSignedAt: null }), { set: {}, remove: ['operativeSignedAt'] })
  assert.deepEqual(timesheetChangedFields(base, { ...base, operativeSignedAt: null }), { set: {}, remove: [] })
  // No base: a new sheet writes every non-null field (never write metadata).
  assert.deepEqual(timesheetChangedFields(null, { userId: 'u', managerNote: 'x', updatedBy: 'me' }).set, { userId: 'u', managerNote: 'x' })
})

test('1.9.0 M4: leave days inside a range come from leaveRecordDayKeys', async () => {
  const { leaveDaysInRange } = await import('./leaveRequests.ts')
  const record = { startDayKey: '2026-11-05', endDayKey: '2026-11-11', timeSlot: 'FULL DAY' } // Thu → Wed, weekend skipped
  assert.equal(leaveDaysInRange(record, { startDayKey: '2026-11-02', endDayKey: '2026-11-08' }, 'Europe/London'), 2)
  assert.equal(leaveDaysInRange(record, { startDayKey: '2026-11-01', endDayKey: '2026-11-30' }, 'Europe/London'), 5)
  assert.equal(leaveDaysInRange(record, { startDayKey: '2026-11-01', endDayKey: '2026-11-30' }, 'Europe/London', ['2026-11-09']), 4)
  assert.equal(leaveDaysInRange({ startDayKey: '2026-11-07', timeSlot: 'AM' }, { startDayKey: '2026-11-01', endDayKey: '2026-11-30' }), 0.5)
  assert.equal(leaveDaysInRange(record, { startDayKey: '2026-12-01', endDayKey: '2026-12-31' }), 0)
  assert.equal(leaveDaysInRange(record, { startDayKey: 'bad', endDayKey: '2026-12-31' }), 0)
})

test('1.9.0 M9: a manager site booking edit writes only the changed fields', async () => {
  const { managerSiteBookingUpdateWriteFields } = await import('./workDocumentReaders.ts')
  const stored = { id: 'M', userId: 'u', timeSlot: 'AM', workStartTime: '07:30', locationType: 'office', locationId: 'o1', createdAt: 1, organizationId: 'O' }
  assert.deepEqual(managerSiteBookingUpdateWriteFields(stored, { ...stored, createdAt: 99, organizationId: 'X' }), { set: {}, remove: [] })
  assert.deepEqual(managerSiteBookingUpdateWriteFields(stored, { ...stored, locationType: 'custom', locationId: null, customLocationName: 'Depot' }), {
    set: { locationType: 'custom', customLocationName: 'Depot' },
    remove: ['locationId'],
  })
  assert.deepEqual(managerSiteBookingUpdateWriteFields(stored, { ...stored, workStartTime: '08:00' }).set, { timeSlot: 'AM', workStartTime: '08:00' })
  assert.deepEqual(managerSiteBookingUpdateWriteFields(null, stored), { set: {}, remove: [] })
})

test('1.9.0 L12: leave records for an account match every id of the person, never by name', async () => {
  const { leaveRecordsForAccount } = await import('./bookingPerson.ts')
  const records = [
    { id: '1', userId: 'U-NEW' },
    { id: '2', userId: 'u-old' },
    { id: '3', operativeId: 'OP-1' },
    { id: '4', userId: 'same-email-alias' },
    { id: '5', userId: 'someone-else' },
  ]
  const mine = leaveRecordsForAccount(
    records,
    { id: 'u-new', email: 'a@x.com', formerIds: ['U-OLD'], aliasIds: ['same-email-alias'] },
    [{ id: 'op-1', email: 'A@x.com' }]
  )
  assert.deepEqual(mine.map((row) => row.id), ['1', '2', '3', '4'])
})

// --- Rulebook 1.10.0 ---------------------------------------------------------------------------------------------

import {
  bookingJobId as rb110BookingJobId,
  canDeleteBooking as rb110CanDeleteBooking,
  canSeeJob as rb110CanSeeJob,
  canWriteBooking as rb110CanWriteBooking,
  isJobManager as rb110IsJobManager,
  jobManagerUserIds as rb110JobManagerUserIds,
  stableManagerId as rb110StableManagerId,
  visibleJobsFor as rb110VisibleJobsFor,
} from './staffAccess.ts'
import { canDeleteUser as rb110CanDeleteUser, userDeleteRefusal as rb110UserDeleteRefusal, userDeleteWrites as rb110UserDeleteWrites } from './userDelete.ts'
import { orgMembershipWriteFields as rb110MembershipWrite, parseOrgMembershipDocument as rb110ParseMembership } from './orgMembership.ts'
import { payRateChangeWrites as rb110PayRateChangeWrites } from './payRate.ts'
import { jobDeleteBookingRemovals as rb110JobDeleteBookingRemovals } from './bookings.ts'
import {
  inboxNotificationVisibleToUser as rb110InboxVisible,
  notificationDestination as rb110Destination,
  unreadNotificationBadgeCount as rb110Badge,
} from './notificationPreferences.ts'
import { TOMBSTONED_BOOKING_COLLECTIONS as rb110Tombstoned, bookingTombstoneWriteFields as rb110Tombstone } from './bookingTombstones.ts'

test('1.10.0 / 1.33.0 canSeeJob: admins and every manager see every job; isJobManager matches any id spelling; operatives none', () => {
  const job = { managerIds: ['MGR-ROW-1', 'user:Mgr-Uid-2'], managerId: 'MGR-ROW-1' }
  const managers = [{ id: 'mgr-row-1', email: 'Pat@Example.com' }]
  const pat = { role: manager, ids: ['pat-uid'], email: 'pat@example.com' }
  const other = { role: manager, ids: ['mgr-uid-2'], email: 'x@example.com' }
  const stranger = { role: manager, ids: ['someone'], email: 's@example.com' }
  assert.equal(rb110CanSeeJob({ role: admin, ids: ['a'] }, job), true)
  assert.equal(rb110CanSeeJob({ role: superAdmin, ids: ['s'] }, {}), true)
  // 1.33.0 (owner decision 6 Nov): every manager sees every job, whatever their toggles and whether they manage it.
  assert.equal(rb110CanSeeJob(pat, job, managers), true)
  assert.equal(rb110CanSeeJob(pat, job), true)
  assert.equal(rb110CanSeeJob(stranger, job, managers), true)
  assert.equal(rb110CanSeeJob(stranger, job, managers, 'smallWorks'), true)
  assert.equal(rb110CanSeeJob({ role: operative, ids: ['mgr-uid-2'] }, job), false)
  assert.equal(rb110CanSeeJob({ role: { ...admin, isOperativeMode: true }, ids: ['a'] }, job), false)
  assert.equal(rb110CanSeeJob({ role: { ...manager, isOperativeMode: true }, ids: ['mgr-uid-2'] }, job), false)
  // Whether they manage it (booking writes, warnings' job part) is still `isJobManager`, under every id spelling.
  assert.equal(rb110IsJobManager(pat, job, managers), true)
  assert.equal(rb110IsJobManager(pat, job), false)
  assert.equal(rb110IsJobManager(other, job), true)
  assert.equal(rb110IsJobManager(stranger, job, managers), false)
  assert.equal(rb110IsJobManager(other, { managerIds: ['MGR-ROW-1'] }), false)
  assert.equal(rb110IsJobManager(other, { managerIds: ['MGR-ROW-1', 'mgr-uid-2'] }), true)
  // Former ids count; managerUserIds counts.
  assert.equal(rb110IsJobManager({ ids: ['new', 'OLD-INVITE'] }, { managerUserIds: ['old-invite'] }), true)
  // iOS stores a managers row whose id is a user id as its stable hash.
  const hashed = { managerIds: [rb110StableManagerId('pat-row-uid')] }
  assert.equal(rb110IsJobManager(pat, hashed, [{ id: 'pat-row-uid', email: 'pat@example.com' }]), true)
  assert.match(rb110StableManagerId('pat-row-uid'), /^[0-9A-F]{8}-[0-9A-F]{4}-5[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/)
  assert.equal(rb110StableManagerId('0f8fad5b-d9cb-469f-a165-70867728950e'), '0F8FAD5B-D9CB-469F-A165-70867728950E')
  assert.deepEqual(rb110VisibleJobsFor(other, [job, { managerIds: [] }]).length, 2)
  assert.deepEqual(rb110VisibleJobsFor({ role: operative, ids: ['mgr-uid-2'] }, [job]).length, 0)
})

test('1.10.0 canWriteBooking / canDeleteBooking: admin any, manager own jobs and own non-job site bookings, operative never', () => {
  const job = { managerIds: ['m1'] }
  const m1 = { role: manager, ids: ['m1'] }
  const m2 = { role: manager, ids: ['m2'] }
  const op = { role: operative, ids: ['m1'] }
  const labour = { collection: 'bookings', projectId: 'J1' }
  const sub = { collection: 'subcontractorBookings', projectId: 'J1' }
  const site = { collection: 'managerSiteBookings', userId: 'm2', locationType: 'project', locationId: 'J1' }
  const office = { collection: 'managerSiteBookings', userId: 'M2', locationType: 'office' }
  for (const booking of [labour, sub, site]) {
    assert.equal(rb110CanWriteBooking({ role: admin, ids: ['a'] }, booking, null), true)
    assert.equal(rb110CanWriteBooking(m1, booking, job), true)
    assert.equal(rb110CanDeleteBooking(m1, booking, job), true)
    assert.equal(rb110CanWriteBooking(m2, booking, job), false)
    assert.equal(rb110CanWriteBooking(m1, booking, null), false)
    assert.equal(rb110CanWriteBooking(op, booking, job), false)
  }
  assert.equal(rb110BookingJobId(office), null)
  assert.equal(rb110BookingJobId(site), 'J1')
  assert.equal(rb110CanWriteBooking(m2, office, null), true)
  assert.equal(rb110CanWriteBooking(m1, office, null), false)
  assert.equal(rb110CanWriteBooking({ role: admin, ids: ['a'] }, { collection: 'holidayBookings' }, null), false)
})

test('1.10.0 jobManagerUserIds maps managers rows to active accounts by email', () => {
  const ids = rb110JobManagerUserIds(
    { managerIds: ['ROW-1', 'user:U3'], managerId: 'ROW-1' },
    [{ id: 'row-1', email: 'a@x.com' }],
    [
      { id: 'U1', email: 'A@x.com' },
      { id: 'U2', email: 'a@x.com', isActive: false },
      { id: 'u3', email: 'c@x.com' },
      { id: 'U4', email: 'd@x.com' },
    ]
  )
  assert.deepEqual(ids, ['U1', 'u3'])
})

test('1.10.0 canDeleteUser follows the users delete rule', () => {
  const actor = { id: 'adm', role: admin }
  const sa = { id: 'sa', role: superAdmin }
  assert.equal(rb110CanDeleteUser(actor, { id: 'op', role: operative }), true)
  assert.equal(rb110UserDeleteRefusal(actor, { id: 'adm2', role: admin }), 'admin_needs_super_admin')
  assert.equal(rb110UserDeleteRefusal(sa, { id: 'adm2', role: admin }), null)
  assert.equal(rb110UserDeleteRefusal(sa, { id: 'sa2', role: superAdmin }), 'super_admin')
  assert.equal(rb110UserDeleteRefusal(sa, { id: 'Owner', role: admin }, { creatorUserId: 'owner' }), 'creator')
  assert.equal(rb110UserDeleteRefusal(actor, { id: 'ADM', role: operative }), 'self')
  assert.equal(rb110UserDeleteRefusal({ id: 'm', role: manager }, { id: 'op', role: operative }), 'not_admin')
  assert.equal(rb110UserDeleteRefusal({ id: 'x', role: { ...admin, isOperativeMode: true } }, { id: 'op', role: operative }), 'not_admin')
})

test('1.10.0 userDeleteWrites: account batch first, then future bookings with tombstones, roster rows, invitations', () => {
  const day = Date.parse('2026-11-03T09:00:00Z')
  const past = Date.parse('2026-10-01T09:00:00Z')
  const steps = rb110UserDeleteWrites({
    orgId: 'ORG',
    user: { id: 'U1', email: 'Op@X.com', role: operative, formerUserIds: ['OLD'] },
    actorUserId: 'adm',
    platform: 'web',
    bookings: [
      { id: 'b1', operativeId: 'u1', dateMs: day },
      { id: 'b2', operativeId: 'OP-ROW', dateMs: day },
      { id: 'b3', operativeId: 'U1', dateMs: past },
      { id: 'b4', operativeId: 'old', dateMs: day },
    ],
    managerSiteBookings: [{ id: 's1', userId: 'U1', dateMs: day }],
    operativeRows: [{ id: 'OP-ROW', email: 'op@x.com' }, { id: 'other', email: 'z@x.com' }],
    managerRows: [],
    invitations: [{ id: 'inv1', email: 'OP@x.com' }, { id: 'inv2', email: 'q@x.com' }],
    nowIso: '2026-11-02T12:00:00Z',
    tz: 'Europe/London',
  })
  assert.deepEqual(steps.map((s) => s.step), ['account', 'bookings', 'rosterRows', 'invitations'])
  assert.deepEqual(steps[0].writes.map((w) => w.path), [
    'users/U1',
    'users/U1/private/taxIds',
    'users/U1/orgMemberships/ORG',
    'organizations/ORG/userEmails/op@x.com',
    'organizations/ORG',
  ])
  assert.deepEqual(steps[0].writes[4], { op: 'update', path: 'organizations/ORG', deleteFields: ['members.U1'] })
  const bookingPaths = steps[1].writes.map((w) => w.path)
  assert.deepEqual(bookingPaths, [
    'organizations/ORG/bookings/b1',
    'organizations/ORG/deletedBookings/b1',
    'organizations/ORG/bookings/b2',
    'organizations/ORG/deletedBookings/b2',
    'organizations/ORG/bookings/b4',
    'organizations/ORG/deletedBookings/b4',
    'organizations/ORG/managerSiteBookings/s1',
    'organizations/ORG/deletedBookings/s1',
  ])
  assert.deepEqual(steps[2].writes.map((w) => w.path), ['organizations/ORG/operatives/OP-ROW'])
  assert.deepEqual(steps[3].writes.map((w) => w.path), ['invitations/inv1'])
  assert.deepEqual(rb110UserDeleteWrites({ orgId: '', user: { id: 'U', role: operative }, actorUserId: 'a', platform: 'web', nowIso: '' }), [])
})

test('1.10.0 org memberships: one reader for flat and nested shapes; a person never raises their own flags', () => {
  const flat = rb110ParseMembership('ORG', { role: 'manager', manager: true, skills: true, isActive: false })!
  assert.equal(flat.permissions.manager, true)
  assert.equal(flat.permissions.skills, true)
  assert.equal(flat.permissions.materials, true)
  assert.equal(flat.accountActive, false)
  assert.equal(flat.hasLegacyFlatFlags, true)
  const nested = rb110ParseMembership('ORG', { role: 'operative', status: 'pending', permissions: { operativeMode: true, manager: true, materials: false } })!
  assert.equal(nested.permissions.manager, false)
  assert.equal(nested.permissions.materials, false)
  assert.equal(nested.status, 'pending')
  assert.equal(rb110ParseMembership('', {}), null)
  // Self: only accepting.
  const self = rb110MembershipWrite({
    organizationId: 'ORG',
    stored: { role: 'operative', status: 'pending', permissions: {} },
    next: { status: 'active', role: 'admin', permissions: { adminAccess: true } },
    writer: 'self',
    now: 'NOW',
  })
  assert.deepEqual(self, { mode: 'update', fields: { status: 'active', acceptedAt: 'NOW', updatedAt: 'NOW' }, remove: [] })
  assert.equal(rb110MembershipWrite({ organizationId: 'ORG', stored: { status: 'active' }, next: { role: 'admin' }, writer: 'self', now: 1 }), null)
  // Admin: changed fields only, nested, legacy flat keys removed.
  const adminWrite = rb110MembershipWrite({
    organizationId: 'ORG',
    stored: { role: 'operative', manager: false, isActive: true, permissions: { adminAccess: false } },
    next: { role: 'manager', permissions: { manager: true, adminAccess: false } },
    writer: 'admin',
    now: 'NOW',
  })!
  assert.equal(adminWrite.mode, 'update')
  assert.equal(adminWrite.fields.role, 'manager')
  assert.equal(adminWrite.fields['permissions.manager'], true)
  assert.equal('permissions.adminAccess' in adminWrite.fields, false)
  assert.equal(adminWrite.fields.accountActive, true)
  assert.deepEqual(adminWrite.remove, ['manager', 'isActive'])
  const created = rb110MembershipWrite({ organizationId: 'ORG', stored: null, next: { role: 'operative', status: 'pending', invitedBy: 'adm' }, writer: 'admin', now: 'NOW' })!
  assert.equal(created.mode, 'create')
  assert.equal((created.fields.permissions as Record<string, boolean>).materials, true)
  assert.equal('acceptedAt' in created.fields, false)
})

test('1.10.0 payRateChangeWrites: seed only when history loaded and empty; refused when history failed to load', () => {
  const base = { userId: 'U', operativeId: 'O', effectiveDayKey: '2026-11-04', seedEffective: '2026-01-10', timeZone: 'Europe/London' }
  const seeded = rb110PayRateChangeWrites({ ...base, previousProfile: { rate: 150, payBasis: 'day' }, nextProfile: { rate: 160, payBasis: 'day' }, history: [] })
  assert.equal(seeded.ok, true)
  if (seeded.ok) {
    assert.deepEqual(seeded.rows.map((r) => [r.dayRate, r.effectiveDayKey]), [[150, '2026-01-10'], [160, '2026-11-04']])
  }
  const noSeed = rb110PayRateChangeWrites({ ...base, previousProfile: { rate: 150 }, nextProfile: { rate: 160 }, history: [{ id: 'h' }] })
  assert.equal(noSeed.ok && noSeed.rows.length, 1)
  const refused = rb110PayRateChangeWrites({ ...base, previousProfile: { rate: 150 }, nextProfile: { rate: 160 }, history: null })
  assert.equal(refused.ok, false)
  const same = rb110PayRateChangeWrites({ ...base, previousProfile: { rate: 150, payBasis: 'day' }, nextProfile: { rate: 150, payBasis: 'day' }, history: null })
  assert.deepEqual(same, { ok: true, rows: [] })
  const cleared = rb110PayRateChangeWrites({ ...base, previousProfile: { rate: 150 }, nextProfile: { rate: null }, history: [] })
  assert.equal(cleared.ok && cleared.rows.length === 1 && cleared.rows[0].dayRate === null, true)
  const basis = rb110PayRateChangeWrites({ ...base, previousProfile: { rate: 20, payBasis: 'day' }, nextProfile: { rate: 20, payBasis: 'hourly' }, history: [{}] })
  assert.equal(basis.ok && basis.rows[0].payBasis, 'hourly')
})

test('1.10.0 jobDeleteBookingRemovals covers labour, subcontractor and job-linked manager site bookings', () => {
  const day = Date.parse('2026-11-02T08:00:00Z')
  const past = Date.parse('2026-10-30T08:00:00Z')
  const out = rb110JobDeleteBookingRemovals({
    projectId: 'job-1',
    bookings: [{ id: 'b1', projectId: 'JOB-1', dateMs: day }, { id: 'b2', projectId: 'job-1', dateMs: past }],
    subcontractorBookings: [{ id: 's1', projectId: 'Job-1', dateMs: day }, { id: 's2', projectId: 'job-2', dateMs: day }],
    managerSiteBookings: [
      { id: 'm1', locationType: 'small_work', locationId: 'JOB-1', dateMs: day },
      { id: 'm2', locationType: 'office', locationId: 'JOB-1', dateMs: day },
    ],
    nowIso: '2026-11-02T12:00:00Z',
    timeZone: 'Europe/London',
  })
  assert.deepEqual(out, { bookings: ['b1'], subcontractorBookings: ['s1'], managerSiteBookings: ['m1'] })
  assert.ok((rb110Tombstoned as readonly string[]).includes('subcontractorBookings'))
  assert.equal(rb110Tombstone({ bookingId: 's1', collection: 'subcontractorBookings', deletedBy: 'u', deletedFrom: 'web' })?.collection, 'subcontractorBookings')
})

test('1.10.0 inbox rows are listed and counted only from their createdAt', () => {
  const now = Date.parse('2026-11-02T12:00:00Z')
  const future = { userId: 'U', isRead: false, createdAt: { seconds: now / 1000 + 3600, nanoseconds: 0 } }
  const past = { userId: 'u', isRead: false, createdAt: new Date(now - 1000) }
  const pending = { userId: 'U', isRead: false, createdAt: null }
  assert.equal(rb110InboxVisible(future, 'U', now), false)
  assert.equal(rb110InboxVisible(future, 'U', now + 3600 * 1000), true)
  assert.equal(rb110InboxVisible(past, 'U', now), true)
  assert.equal(rb110InboxVisible(pending, 'U', now), true)
  assert.equal(rb110Badge([future, past, pending], 'U', now), 2)
  assert.equal(rb110Badge([{ userId: 'U', createdAt: '2026-11-02T13:00:00Z' }], ['U'], new Date(now)), 0)
})

test('1.10.0 notificationDestination opens variations', () => {
  assert.deepEqual(rb110Destination({ type: 'variation_added', relatedId: 'VAR-1', role: 'manager' }), { kind: 'variationDetail', relatedId: 'VAR-1' })
  assert.deepEqual(rb110Destination({ type: 'variation_renumbered', relatedId: 'JOB-1', role: 'admin' }), { kind: 'variations', relatedId: 'JOB-1' })
  assert.deepEqual(rb110Destination({ type: 'variation', role: 'operative', relatedId: 'V' }), { kind: 'notifications' })
  assert.deepEqual(rb110Destination({ type: 'toolbox_talk_issued', relatedId: 'ISSUE', role: 'operative' }), { kind: 'healthSafety', relatedId: 'ISSUE' })
})

import { leaveRecordsForAccount as rb110LeaveRecordsForAccount } from './bookingPerson.ts'

test('1.10.0 leaveRecordsForAccount also matches leave stored with the account email as userId (older iOS), without case', () => {
  const records = [
    { id: 'a', userId: 'Ada@Example.com' },
    { id: 'b', userId: 'U-1' },
    { id: 'c', userId: 'someone@else.com' },
    { id: 'd', userId: 'ALIAS-2' },
  ]
  const got = rb110LeaveRecordsForAccount(records, { id: 'u-1', email: 'ada@example.com', aliasIds: ['alias-2'] }, [])
  assert.deepEqual(got.map((row) => row.id), ['a', 'b', 'd'])
  assert.deepEqual(rb110LeaveRecordsForAccount(records, { id: 'x', email: '' }, []).map((row) => row.id), [])
})

import { jobTypesChangeWriteFields as rb110JobTypesChange } from './operationsDocuments.ts'
import { syncWriteAllowed as rb110SyncWriteAllowed } from './liveSources.ts'

test('1.10.0 job type saves write the stored list plus explicit adds and removes only (never recovered names)', () => {
  assert.deepEqual(rb110JobTypesChange(['CAT A', 'Fit out'], { add: ['Strip out'] }), { set: { jobTypes: ['CAT A', 'Fit out', 'Strip out'] } })
  assert.deepEqual(rb110JobTypesChange(['CAT A', 'Fit out'], { remove: ['fit out'] }), { set: { jobTypes: ['CAT A'] } })
  assert.deepEqual(rb110JobTypesChange(['CAT A'], { remove: ['CAT A'] }), { set: { jobTypes: [] } })
  assert.equal(rb110JobTypesChange(['CAT A'], {}), null)
  assert.equal(rb110JobTypesChange([], {}), null)
})

test('1.10.0 the warning-key migration is the one idempotent write allowed outside a user action', () => {
  assert.equal(rb110SyncWriteAllowed('listenerSnapshot'), false)
  assert.equal(rb110SyncWriteAllowed('listenerSnapshot', 'warningResolutionMigrationWrites'), true)
  assert.equal(rb110SyncWriteAllowed('backgroundSync', 'somethingElse'), false)
  assert.equal(rb110SyncWriteAllowed('userAction'), true)
})

// --- Rulebook 1.10.0 round 2: job add/edit/manager list, rules-compatible reads, warning scope -----------------

import {
  JOB_MANAGER_LIST_FIELDS as r2ManagerListFields,
  bookingQueryPlan as r2BookingQueryPlanRaw,
  canChangeJobManagers as r2CanChangeJobManagers,
  canCreateJob as r2CanCreateJob,
  canEditJob as r2CanEditJob,
  jobIdQueryValues as r2JobIdQueryValues,
  jobQueryPlan as r2JobQueryPlanRaw,
  jobWriteWithoutManagerList as r2WithoutManagerList,
  readsEveryBooking as r2ReadsEveryBookingRaw,
  warningScopeFor as r2WarningScopeForRaw,
  hasWorkCatalogueToggle as r2HasToggle,
  ENFORCED_READS_ACTIVE as ENFORCED_READS_ACTIVE_110,
} from './staffAccess.ts'
// The 1.10.0 r2 tests check enforced reads (§17); 1.10.1 keeps them switched off (`ENFORCED_READS_ACTIVE`) until the
// backfill, so these wrappers ask for the enforced behaviour explicitly.
const r2JobQueryPlan = (viewer: any, options?: any) => r2JobQueryPlanRaw(viewer, { ...(options || {}), enforced: true })
const r2BookingQueryPlan = (viewer: any, ids: any, options?: any) =>
  r2BookingQueryPlanRaw(viewer, ids, { ...(options || {}), enforced: true })
const r2ReadsEveryBooking = (viewer: any) => r2ReadsEveryBookingRaw(viewer, { enforced: true })
const r2WarningScopeFor = (input: any) => r2WarningScopeForRaw({ ...input, enforced: true })
import { taskCompletedRecipients as r2TaskCompletedRecipients } from './notificationRecipients.ts'
import { parseTaskDocument as r2ParseTask, taskFields as r2TaskFields, taskWriteFields as r2TaskWriteFields } from './operationsDocuments.ts'

const r2Off = { projects: false, smallWorks: false }
const r2Projects = { projects: true, smallWorks: false }
const r2Both = { projects: true, smallWorks: true }
const r2Job = { managerIds: ['MGR-ROW'], managerUserIds: ['mgr-uid'] }

test('1.10.0 r2: admins add, edit and change managers; managers only with that kind\'s toggle; others edit details of jobs they manage', () => {
  const adminViewer = { role: admin, ids: ['a'], toggles: r2Off }
  const togglePm = { role: manager, ids: ['t'], toggles: r2Projects }
  const plain = { role: manager, ids: ['mgr-uid'], toggles: r2Off }
  const op = { role: operative, ids: ['op'], toggles: r2Both }
  assert.equal(r2CanCreateJob(adminViewer, 'smallWorks'), true)
  assert.equal(r2CanChangeJobManagers(adminViewer, 'projects'), true)
  assert.equal(r2CanCreateJob(togglePm, 'projects'), true)
  assert.equal(r2CanCreateJob(togglePm, 'smallWorks'), false)
  assert.equal(r2CanChangeJobManagers(togglePm, 'projects'), true)
  assert.equal(r2CanEditJob(togglePm, { managerIds: [] }, 'projects'), true)
  assert.equal(r2CanEditJob(togglePm, { managerIds: [] }, 'smallWorks'), false)
  assert.equal(r2CanCreateJob(plain, 'projects'), false)
  assert.equal(r2CanChangeJobManagers(plain, 'projects'), false)
  assert.equal(r2CanEditJob(plain, r2Job, 'projects'), true)
  assert.equal(r2CanEditJob(plain, { managerIds: ['someone-else'] }, 'projects'), false)
  assert.equal(r2CanCreateJob(op, 'projects'), false)
  assert.equal(r2CanEditJob(op, r2Job, 'projects'), false)
  assert.deepEqual([...r2ManagerListFields], ['managerIds', 'managerId', 'assignedManagerUserIds', 'managerUserIds'])
  assert.deepEqual(r2WithoutManagerList({ siteName: 'A', managerIds: ['x'], managerId: 'x', managerUserIds: ['u'] }), { siteName: 'A' })
})

test('1.10.0 r2 / 1.33.0: seesEveryJob and canSeeJob — every manager sees every job; the toggle is hasWorkCatalogueToggle', () => {
  const togglePm = { role: manager, ids: ['t'], toggles: r2Projects }
  const plainPm = { role: manager, ids: ['p'], toggles: r2Off }
  for (const kind of ['projects', 'smallWorks', null] as const) {
    assert.equal(seesEveryJob(manager, kind, r2Projects), true)
    assert.equal(seesEveryJob(manager, kind, r2Off), true)
    assert.equal(seesEveryJob(manager, kind, null), true)
  }
  assert.equal(seesEveryJob(admin), true)
  assert.equal(seesEveryJob(operative, 'projects', r2Both), false)
  assert.equal(seesEveryJob({ ...manager, isOperativeMode: true }, 'projects', r2Both), false)
  assert.equal(rb110CanSeeJob(togglePm, { managerIds: [] }, [], 'projects'), true)
  assert.equal(rb110CanSeeJob(togglePm, { managerIds: [] }, [], 'smallWorks'), true)
  assert.equal(rb110CanSeeJob(plainPm, { managerIds: [] }, [], 'smallWorks'), true)
  // The toggle (adding jobs, changing manager lists) is unchanged.
  assert.equal(r2HasToggle(manager, 'projects', r2Projects), true)
  assert.equal(r2HasToggle(manager, 'smallWorks', r2Projects), false)
  assert.equal(r2HasToggle(manager, null, r2Projects), false)
  assert.equal(r2HasToggle(manager, null, r2Both), true)
  assert.equal(r2HasToggle(manager, 'projects', null), false)
  assert.equal(r2HasToggle(admin, 'projects', r2Off), true)
  assert.equal(r2HasToggle(operative, 'projects', r2Both), false)
})

test('1.10.0 r2 / 1.33.0: jobQueryPlan — whole collections for every admin and manager (switch on or off), an operative\'s own job documents', () => {
  for (const enforced of [true, false]) {
    for (const viewer of [
      { role: admin, ids: ['a'] },
      { role: manager, ids: ['m'], uid: 'm-uid', toggles: r2Projects },
      { role: manager, ids: ['m'] },
    ]) {
      const plan = r2JobQueryPlanRaw(viewer, { enforced })
      assert.deepEqual(plan.queries, [
        { collection: 'projects', kind: 'all' },
        { collection: 'smallWorks', kind: 'all' },
      ])
      assert.deepEqual(plan.seesEvery, { projects: true, smallWorks: true })
    }
  }
  const opPlan = r2JobQueryPlan({ role: operative, ids: ['op'] }, { documentIds: ['abc', 'ABC'] })
  assert.deepEqual(opPlan.queries, [
    { collection: 'projects', kind: 'documents', ids: ['abc', 'ABC'] },
    { collection: 'smallWorks', kind: 'documents', ids: ['abc', 'ABC'] },
  ])
  assert.deepEqual(r2JobQueryPlan({ role: operative, ids: ['op'] }).queries, [])
  assert.deepEqual(r2JobQueryPlan(null).queries, [])
  assert.deepEqual(r2JobIdQueryValues(['Ab-1', 'ab-1', 'CD-2']), ['Ab-1', 'ab-1', 'AB-1', 'CD-2', 'cd-2'])
  assert.deepEqual(r2JobIdQueryValues(['123']), ['123'])
})

test('1.10.0 r2 / 1.33.0: bookingQueryPlan — whole collections for admins and every manager, own labour bookings for operatives', () => {
  for (const enforced of [true, false]) {
    for (const viewer of [
      { role: admin, ids: ['a'] },
      { role: manager, ids: ['m'], uid: 'm', toggles: r2Projects },
      { role: manager, ids: ['m-uid'], uid: 'm-uid' },
    ]) {
      assert.equal(r2ReadsEveryBookingRaw(viewer, { enforced }), true)
      const plan = r2BookingQueryPlanRaw(viewer, ['job-a'], { ownBookingIds: ['m-uid'], enforced })
      assert.equal(plan.readsEveryBooking, true)
      assert.deepEqual(plan.queries.map((q) => `${q.collection}:${q.kind}`), ['bookings:all', 'managerSiteBookings:all', 'subcontractorBookings:all'])
    }
  }
  assert.equal(r2ReadsEveryBooking({ role: operative, ids: ['o'], toggles: r2Both }), false)
  assert.equal(r2ReadsEveryBooking({ role: { ...manager, isOperativeMode: true }, ids: ['o'] }), false)
  const op = r2BookingQueryPlan({ role: operative, ids: ['o'] }, ['job-a'], { ownBookingIds: ['a', 'b', 'c', 'd', 'e'] })
  assert.equal(op.readsEveryBooking, false)
  assert.deepEqual(op.queries.map((q) => (q.kind === 'own' ? q.values : [])), [['o', 'a', 'b', 'c'], ['d', 'e']])
  assert.ok(op.queries.every((q) => q.collection === 'bookings' && q.kind === 'own'))
})

test('1.10.0 r2 (1.31.0, 1.33.0): warning scope — a manager gets their jobs and their people, and (1.33.0) their unbooked labour with enforced reads on', () => {
  const plain = { role: manager, ids: ['m'] }
  const scope = r2WarningScopeFor({
    viewer: plain,
    jobs: [{ id: 'JOB-A', managerUserIds: ['m'] }, { id: 'JOB-Z', managerUserIds: ['x'] }],
    roster: [{ id: 'm', role: 'manager' }, { id: 'u-1', email: 'one@x.com', assignedManagerUserIds: ['m'] }],
    people: [{ id: 'u-1', email: 'one@x.com' }],
    operatives: [{ id: 'op-1', email: 'One@x.com' }],
  })
  assert.equal(scope.kind, 'jobs')
  if (scope.kind !== 'jobs') return
  assert.deepEqual(scope.jobIds, ['job-a'])
  assert.deepEqual(scope.personEmails, ['one@x.com'])
  assert.ok(scope.personIds.includes('u-1') && scope.personIds.includes('op-1') && !scope.personIds.includes('op-2'))
  // 1.33.0: every manager reads every booking (`readsEveryBooking`), so their unbooked rows come back under enforcedReads.
  assert.equal(scope.unbookedLabour, true)
  const opScope = r2WarningScopeFor({ viewer: { role: operative, ids: ['o'] } })
  assert.equal(opScope.kind === 'jobs' && opScope.unbookedLabour, false)
  assert.deepEqual(r2WarningScopeFor({ viewer: { role: admin, ids: ['a'] }, visibleJobIds: [] }), { kind: 'all' })
  assert.equal(r2WarningScopeFor({ viewer: { ...plain, toggles: r2Projects }, visibleJobIds: [] }).kind, 'jobs')
  const unbooked = unbookedLabourRows({
    scope,
    startDayKey: '2026-11-02',
    endDayKey: '2026-11-02',
    includeWeekends: false,
    standardPaidHours: 8,
    saturdayCountsAsHours: 8,
    sundayCountsAsHours: 8,
    people: [],
    operatives: [
      { id: 'op-1', email: 'one@x.com', name: 'One', isActive: true, isPlaceholder: false, profileWeight: 1 },
      { id: 'op-2', email: 'two@x.com', name: 'Two', isActive: true, isPlaceholder: false, profileWeight: 1 },
    ],
    bookings: [],
    holidays: [],
  })
  assert.deepEqual(unbooked.map((row) => row.operativeId), ['op-1'])
  const quals = qualificationExpiryRows({
    scope,
    referenceIso: '2026-11-02T10:00:00Z',
    timeZone: 'Europe/London',
    operatives: [
      { id: 'op-1', isActive: true, name: 'One', email: 'one@x.com', expiries: [{ qualificationId: 'q', name: 'CSCS', expiryIso: '2026-11-10T00:00:00Z' }] },
      { id: 'op-2', isActive: true, name: 'Two', email: 'two@x.com', expiries: [{ qualificationId: 'q', name: 'CSCS', expiryIso: '2026-11-10T00:00:00Z' }] },
    ],
  })
  assert.deepEqual(quals.map((row) => row.operativeId), ['op-1'])
})

test('1.10.0 r2: tasks store createdByUserId, and task_completed goes to it (name only for older tasks)', () => {
  const fields = r2TaskFields({ id: 't', projectId: 'p', title: 'Do it', createdBy: 'Ada Lovelace', createdByUserId: 'u-ada' })
  assert.equal(fields.createdByUserId, 'u-ada')
  assert.equal(r2ParseTask('t', fields)?.createdByUserId, 'u-ada')
  assert.equal(r2ParseTask('t', { title: 'Old' })?.createdByUserId, '')
  // Never rewritten on an edit.
  const write = r2TaskWriteFields(fields, { ...fields, createdByUserId: 'someone-else', title: 'Do it now' })
  assert.equal('createdByUserId' in (write.set ?? {}), false)
  const roster = [
    { id: 'u-ada', role: admin, firstName: 'Ada', surname: 'Lovelace' },
    { id: 'u-bob', role: manager, firstName: 'Bob', surname: 'Smith' },
    { id: 'u-bob2', role: manager, firstName: 'Bob', surname: 'Smith' },
  ]
  assert.deepEqual(r2TaskCompletedRecipients({ createdByUserId: 'u-ada', createdBy: 'Bob Smith' }, 'u-bob', roster), ['u-ada'])
  assert.deepEqual(r2TaskCompletedRecipients({ createdByUserId: 'u-ada' }, 'u-ada', roster), [])
  assert.deepEqual(r2TaskCompletedRecipients({ createdBy: 'ada  lovelace' }, 'u-bob', roster), ['u-ada'])
  assert.deepEqual(r2TaskCompletedRecipients({ createdBy: 'Bob Smith' }, 'u-ada', roster), [])
  assert.deepEqual(r2TaskCompletedRecipients({ createdBy: '' }, 'u-ada', roster), [])
})

test('1.10.0 r2: a manager never books themselves onto a job they do not manage', () => {
  const plain = { role: manager, ids: ['m-uid'] }
  const togglePm = { role: manager, ids: ['m-uid'], toggles: r2Both }
  const otherJob = { managerIds: ['someone-else'], managerUserIds: ['someone-else'] }
  for (const viewer of [plain, togglePm]) {
    assert.equal(rb110CanWriteBooking(viewer, { collection: 'bookings', projectId: 'job-x' }, otherJob), false)
    assert.equal(rb110CanWriteBooking(viewer, { collection: 'managerSiteBookings', userId: 'm-uid', locationType: 'project', locationId: 'job-x' }, otherJob), false)
  }
  assert.equal(rb110CanWriteBooking(plain, { collection: 'managerSiteBookings', userId: 'm-uid', locationType: 'project', locationId: 'job-a' }, r2Job), false)
  assert.equal(rb110CanWriteBooking({ role: manager, ids: ['mgr-uid'] }, { collection: 'managerSiteBookings', userId: 'mgr-uid', locationType: 'project', locationId: 'job-a' }, r2Job), true)
})

// --- Rulebook 1.10.0 hunt C ---------------------------------------------------------------------------------------

import { timesheetInvoiceRows as hcInvoiceRows } from './reportPay.ts'
import { payrollLineReview as hcLineReview } from './timesheetEntryReviews.ts'
import { inviteAcceptWrites as hcInviteAccept } from './inviteAccept.ts'
import { timesheetParticipant as hcParticipant } from './peopleDocuments.ts'
import { orgDayHours as hcOrgDayHours, payForHours as hcPayForHours, payRateOnDay as hcPayRateOnDay, roundPennies as hcRoundPennies } from './payRate.ts'
import { syncWriteAllowed as hcSyncWriteAllowed } from './liveSources.ts'

test('1.10.0 hunt C L16: payForHours / roundPennies give the same numbers web payBasis.ts gave', () => {
  assert.equal(hcPayForHours({ payBasis: 'day', dayRate: 200, paidHours: 4, standardDayHours: 8 }), 100)
  assert.equal(hcPayForHours({ payBasis: 'day', dayRate: 180, paidHours: 7.5, standardDayHours: 7.5, otMultiplier: 1.5 }), 270)
  assert.equal(hcPayForHours({ payBasis: 'hourly', hourlyRate: 15.5, paidHours: 3, standardDayHours: 8, otMultiplier: 1.5 }), 69.75)
  assert.equal(hcPayForHours({ payBasis: 'day', dayRate: 100, paidHours: 1, standardDayHours: 3 }), 33.33)
  assert.equal(hcPayForHours({ payBasis: 'day', dayRate: 200, paidHours: 0, standardDayHours: 8 }), 0)
  assert.equal(hcPayForHours({ payBasis: 'hourly', hourlyRate: null, paidHours: 2, standardDayHours: 8 }), 0)
  assert.equal(hcOrgDayHours(0), 0.01)
  assert.equal(hcOrgDayHours(7.5), 7.5)
  assert.equal(hcRoundPennies(2.675), 2.68)
  assert.equal(hcRoundPennies(1.005), 1)
  assert.equal(hcRoundPennies(10.005), 10.01)
})

test('1.10.0 hunt C L13: payrollLineReview finds a review under the line id in any letter case', () => {
  const sheet = { payrollLineReviews: { 'ABC-1': { decision: 'edited', revisedAmount: 80 }, 'def-2': { decision: 'declined' } } }
  assert.deepEqual(hcLineReview(sheet, 'abc-1'), { decision: 'edited', revisedAmount: 80 })
  assert.deepEqual(hcLineReview(sheet, 'DEF-2'), { decision: 'declined', revisedAmount: null })
  assert.equal(hcLineReview(sheet, 'nope'), null)
  assert.equal(hcLineReview({}, 'abc-1'), null)
})

test('1.10.0 hunt C H1: timesheetInvoiceRows — signed snapshot first, then reviews and entry decisions; PAYE and leave never', () => {
  const lines = [
    { id: 'L1', amount: 100 },
    { id: 'L2', amount: 50, isPayeDay: true },
    { id: 'L3', amount: 0, isLeave: true },
    { id: 'L4', amount: 60 },
  ]
  const override = {
    lines: [
      { id: 'l1', amount: 90, decision: 'edited' },
      { id: 'L2', amount: 50 },
      { id: 'L4', amount: 60, decision: 'declined' },
    ],
    priceWork: [{ id: 'P1', amount: 30 }, { id: 'P2', amount: 0 }],
    expenses: [{ id: 'E1', amount: 12.5 }],
  }
  const signed = hcInvoiceRows({ sheet: { weeklyReportOverride: override }, payrollLines: lines, extrasMode: 'decided' })
  // 1.46.0 (fifth review of #324): the signed copy is final — a signed row is left out only by its own stored flags,
  // never because its live line is (now) a PAYE day. Before 1.46.0 the live L2 being PAYE dropped the signed L2.
  assert.deepEqual(signed.map((row) => [row.kind, row.id, row.amount, row.source]), [
    ['labour', 'l1', 90, 'override'],
    ['labour', 'L2', 50, 'override'],
    ['priceWork', 'P1', 30, 'override'],
    ['expense', 'E1', 12.5, 'override'],
  ])
  const flagged = hcInvoiceRows({
    sheet: { weeklyReportOverride: { ...override, lines: [{ id: 'L2', amount: 50, isPayeDay: true }, { id: 'L3', amount: 5, isLeave: true }] } },
    payrollLines: lines,
    extrasMode: 'decided',
  })
  assert.deepEqual(flagged.filter((row) => row.kind === 'labour'), [])
  const sheet = {
    managerSignedAt: '2026-11-01T10:00:00Z',
    payrollLineReviews: { l4: { decision: 'declined' }, L1: { decision: 'edited', revisedAmount: 95 } },
    extraEntryReviews: { E1: { decision: 'declined', reviewedAmount: 12.5 } },
    priceWorkEntries: [{ id: 'P1', amount: 30 }],
    expenseEntries: [{ id: 'E1', amount: 12.5 }],
  }
  const decided = hcInvoiceRows({ sheet, payrollLines: lines, extrasMode: 'decided' })
  assert.deepEqual(decided.map((row) => [row.kind, row.id, row.amount]), [
    ['labour', 'L1', 95],
    ['priceWork', 'P1', 30],
  ])
  const raw = hcInvoiceRows({ sheet, payrollLines: lines, extrasMode: 'raw' })
  assert.deepEqual(raw.map((row) => [row.kind, row.id, row.amount]), [
    ['labour', 'L1', 100],
    ['labour', 'L4', 60],
    ['priceWork', 'P1', 30],
    ['expense', 'E1', 12.5],
  ])
  // Reviews count only once the line manager signed.
  const unsigned = hcInvoiceRows({ sheet: { ...sheet, managerSignedAt: null }, payrollLines: lines, extrasMode: 'decided' })
  assert.deepEqual(unsigned.filter((row) => row.kind === 'labour').map((row) => [row.id, row.amount]), [['L1', 100], ['L4', 60]])
})

test('1.10.0 hunt C H3: inviteAcceptWrites — role from the invitation; an existing account keeps its profile and the placeholder', () => {
  const invitation = { organizationId: 'org-b', permissions: { manager: true, operativeMode: false }, payBasis: 'hourly', hourlyRate: 20 }
  const existing = hcInviteAccept({
    existingProfile: { organizationId: 'org-a', role: 'admin', passwordSet: true },
    placeholder: { role: 'manager', organizationId: 'org-b' },
    invitation,
  })
  assert.equal(existing.mode, 'existingAccount')
  assert.equal(existing.joinsAnotherCompany, true)
  assert.equal(existing.writeProfile, false)
  assert.equal(existing.movePlaceholder, false)
  assert.equal(existing.claimToAccount, false)
  assert.equal(existing.role, 'manager')
  assert.deepEqual(existing.pay, { payBasis: 'hourly', dayRate: null, hourlyRate: 20 })
  const retry = hcInviteAccept({ existingProfile: { organizationId: 'organizations/ORG-B' }, placeholder: { role: 'operative' }, invitation })
  assert.equal(retry.joinsAnotherCompany, false)
  assert.equal(retry.movePlaceholder, true)
  assert.equal(retry.claimToAccount, true)
  assert.equal(retry.writeProfile, false)
  const migrate = hcInviteAccept({ existingProfile: null, placeholder: { role: 'operative' }, invitation: { organizationId: 'org-b', role: 'operative' } })
  assert.equal(migrate.mode, 'migratePlaceholder')
  assert.equal(migrate.writeProfile && migrate.movePlaceholder && migrate.claimToAccount, true)
  assert.equal(migrate.role, 'operative')
  const fresh = hcInviteAccept({ existingProfile: null, placeholder: null, invitation: { organizationId: 'org-b', permissions: { adminAccess: true } } })
  assert.equal(fresh.mode, 'newProfile')
  assert.equal(fresh.role, 'admin')
  assert.equal(fresh.pay, null)
})

test('1.10.0 hunt C M6/M12, 1.11.0: timesheetParticipant — self-employed only; PAYE never, whatever the toggle', () => {
  const day = new Date('2026-11-02T12:00:00Z')
  assert.equal(hcParticipant({ timesheetsEnabled: true, employmentType: 'paye' }, day), false)
  assert.equal(hcParticipant({ timesheetsEnabled: false, employmentType: 'self_employed' }, day), true)
  assert.equal(hcParticipant({ employmentType: 'paye', operativeMode: true }, day), false)
  assert.equal(hcParticipant({ timesheetsEnabled: true, employmentType: 'self_employed' }, day), true)
  assert.equal(hcParticipant({ employmentType: 'paye', permissions: { operativeMode: true }, timesheetsEnabled: false }, day), false)
  assert.equal(hcParticipant({ employmentType: 'paye' }, day), false)
  assert.equal(hcParticipant({ timesheetsEnabled: true, employmentType: 'self_employed', isActive: false }, day), false)
  assert.equal(hcParticipant({ timesheetsEnabled: true, employmentType: 'self_employed', email: '', name: 'Deleted user' }, day), false)
  // Effective-dated: PAYE until Wednesday, self-employed from then.
  const changing = { employmentType: 'self_employed', employmentTypeTransitionFrom: 'paye', employmentTypeEffectiveAt: '2026-11-04T00:00:00Z' }
  assert.equal(hcParticipant(changing, day, 'Europe/London'), false)
  assert.equal(hcParticipant(changing, new Date('2026-11-05T12:00:00Z'), 'Europe/London'), true)
  // Given a period: self-employed on at least one day of it.
  assert.equal(hcParticipant(changing, { startDayKey: '2026-11-01', endDayKey: '2026-11-15' } as never, 'Europe/London'), true)
  assert.equal(hcParticipant(changing, { startDayKey: '2026-10-16', endDayKey: '2026-10-31' } as never, 'Europe/London'), false)
  assert.equal(hcParticipant(null, day), false)
})

test('1.10.0 hunt C M7: a Weekly Report never writes', () => {
  assert.equal(hcSyncWriteAllowed('weeklyReport'), false)
  assert.equal(hcSyncWriteAllowed('weeklyReport', 'warningResolutionMigrationWrites'), false)
})

test('1.10.0 hunt C H4: payRateOnDay matches history under every id of the person (personIdSet)', () => {
  const history = [
    { id: 'h1', userId: 'INVITE-OLD', dayRate: 150, payBasis: 'day', effectiveAt: '2026-10-01T00:00:00Z' },
    { id: 'h2', userId: 'same-email-2', dayRate: 175, payBasis: 'day', effectiveAt: '2026-10-15T00:00:00Z' },
    { id: 'h3', userId: 'someone-else', dayRate: 999, payBasis: 'day', effectiveAt: '2026-10-20T00:00:00Z' },
  ]
  const user = { id: 'u-1', employmentType: 'self_employed', dayRate: 120 }
  const withPerson = hcPayRateOnDay({
    user,
    history,
    person: { id: 'u-1', email: 'a@x.com', formerUserIds: ['INVITE-OLD'] },
    roster: [{ id: 'same-email-2', email: 'A@x.com' }],
    dayKey: '2026-10-25',
    timeZone: 'Europe/London',
  })
  assert.equal(withPerson.rate, 175)
  assert.equal(withPerson.source, 'history')
  const onlyOwn = hcPayRateOnDay({ user, history, dayKey: '2026-10-25', timeZone: 'Europe/London' })
  assert.equal(onlyOwn.rate, 120)
})

test('1.10.1: enforced reads stay off until the backfill — restricted managers read every job and booking', () => {
  const viewer = {
    role: { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false },
    uid: 'mgr-1',
    ids: ['mgr-1'],
    toggles: { projects: false, smallWorks: false },
  } as any
  assert.equal(ENFORCED_READS_ACTIVE_110, false)
  assert.deepEqual(r2JobQueryPlanRaw(viewer).queries.map((q: any) => q.kind), ['all', 'all'])
  assert.equal(r2ReadsEveryBookingRaw(viewer), true)
  assert.equal(r2BookingQueryPlanRaw(viewer, ['job-a']).readsEveryBooking, true)
})

// MARK: - 1.11.0 (owner decisions round 3)

import * as r3Levels from './permissionLevels.ts'
import { showsMyTimesheets as r3Shows, timesheetDaysForPerson as r3Days, userProfileWriteFields as r3ProfileWrite } from './peopleDocuments.ts'
import { invitationProfileFields as r3InviteProfile, invitationRole as r3InviteRole, inviteMembershipWrites as r3InviteMembership } from './inviteAccept.ts'
import { bookingJobCollectionFields as r3BookingKind, bookingWriteFields as r3BookingWrite, jobCollectionForJobId as r3KindFor, normalizeBookingJobCollection as r3NormKind, parseBookingDocument as r3ParseBooking } from './bookings.ts'
import { bookingQueryPlan as r3BookingPlan, jobIdsInBothCollections as r3BothKinds, jobKind as r3JobKind } from './staffAccess.ts'
import { lineManagerCandidates as r3Candidates, lineManagerOptions as r3Options, lineManagerSummary as r3Summary } from './lineManagers.ts'
import { timesheetInvoiceRows as r3InvoiceRows } from './reportPay.ts'
import { USER_PERMISSION_FIELDS as R3_FIELDS } from './userProfile.ts'

test('1.11.0 effectivePermissions / lockedPermissionFields: admins every toggle on and locked except Annual Leave Management', () => {
  const admin = { role: 'admin', adminAccess: true, operatives: false, weeklyReports: false, operativeMode: true, permissions: { projects: false, annualLeaveSelfBook: true } }
  const effective = r3Levels.effectivePermissions(admin)
  for (const key of R3_FIELDS) {
    // 1.28.0: Timesheet self-sign is an admin self-manage toggle (stored, else off).
    if (key === 'operativeMode' || key === 'timesheetSelfSign') assert.equal(effective[key], false, key)
    else assert.equal(effective[key], true, key)
  }
  assert.deepEqual(
    r3Levels.lockedPermissionFields(admin),
    R3_FIELDS.filter((key) => key !== 'annualLeaveSelfBook' && key !== 'timesheetSelfSign')
  )
  assert.equal(r3Levels.effectivePermissions({ ...admin, permissions: { annualLeaveSelfBook: false } }).annualLeaveSelfBook, false)
  assert.equal(r3Levels.permissionLevelOf({ isSuperAdmin: true, operativeMode: true }), 'admin')
  // Managers: stored toggles; Materials and Site audit always on and locked; Wholesalers stays editable (can be off).
  const manager = { role: 'manager', manager: true, materials: false, siteAudit: false, wholesalersOrderHistory: false, projects: true }
  const m = r3Levels.effectivePermissions(manager)
  assert.equal(m.materials, true)
  assert.equal(m.siteAudit, true)
  assert.equal(m.wholesalersOrderHistory, false)
  assert.equal(m.projects, true)
  assert.equal(m.smallWorks, false)
  assert.equal(m.adminAccess, false)
  // 1.28.0: Timesheet self-sign is admins only — locked off for a manager or operative.
  // 1.32.0: weeklyReports is admin-only (owner decision 5 Nov).
  assert.deepEqual(r3Levels.lockedPermissionFields(manager), ['materials', 'siteAudit', 'timesheetSelfSign', 'weeklyReports'])
  // Operatives: stored Materials / Site audit, editable.
  const op = r3Levels.effectivePermissions({ role: 'operative', operativeMode: true, materials: true, siteAudit: false })
  assert.equal(op.materials, true)
  assert.equal(op.siteAudit, false)
  assert.equal(op.operativeMode, true)
  assert.deepEqual(r3Levels.lockedPermissionFields({ role: 'operative' }), ['timesheetSelfSign', 'weeklyReports'])
  // Operatives toggle: managing operatives vs scheduling them.
  assert.equal(r3Levels.canManageOperatives({ role: 'manager', manager: true, operatives: false }), false)
  assert.equal(r3Levels.canScheduleOperatives({ role: 'manager', manager: true, operatives: false }), true)
  assert.equal(r3Levels.canManageOperatives({ role: 'admin', adminAccess: true, operatives: false }), true)
  assert.equal(r3Levels.canScheduleOperatives({ role: 'operative', operativeMode: true }), false)
})

test('1.11.0 userProfileWriteFields never writes a locked toggle and never rewrites stored toggles', () => {
  const stored = { role: 'admin', adminAccess: true, operatives: false, permissions: { operatives: false, annualLeaveSelfBook: false } }
  const write = r3ProfileWrite(stored, { operatives: true, weeklyReports: false, permissions: { operatives: true, annualLeaveSelfBook: true }, firstName: 'A' })
  assert.equal('operatives' in write.set, false)
  assert.equal('weeklyReports' in write.set, false)
  assert.deepEqual(write.set.permissions, { operatives: false, annualLeaveSelfBook: true })
  assert.equal(write.set.firstName, 'A')
  // Only locked toggles changed: nothing at all.
  assert.deepEqual(r3ProfileWrite(stored, { weeklyReports: false, materials: false }).set, {})
  // A manager's Materials / Site audit are locked too.
  assert.deepEqual(r3ProfileWrite({ role: 'manager', manager: true }, { materials: false, siteAudit: false }).set, {})
  // Change user type (manager → admin) is not stripped.
  const promote = r3ProfileWrite({ role: 'manager', manager: true }, { role: 'admin', adminAccess: true, operatives: true })
  assert.equal(promote.set.adminAccess, true)
  assert.equal(promote.set.operatives, true)
})

test('1.11.0 permissionToggleRows: one catalogue for Add User, its summary and Edit User', () => {
  const visible = (level: 'admin' | 'manager' | 'operative', mode: 'add' | 'edit' | 'summary', user?: unknown) =>
    r3Levels.permissionToggleRows({ level, mode, user }).filter((row) => row.visible)
  const admin = visible('admin', 'edit', { role: 'admin', adminAccess: true })
  assert.deepEqual(admin.filter((row) => row.editable).map((row) => row.field), ['annualLeaveSelfBook', 'timesheetSelfSign'])
  assert.ok(admin.every((row) => row.field === 'annualLeaveSelfBook' || row.field === 'timesheetSelfSign' || row.value === true))
  assert.ok(admin.some((row) => row.field === 'adminAccess'))
  const manager = visible('manager', 'add')
  assert.deepEqual(manager.map((row) => row.field), [
    'projects', 'smallWorks', 'dailyOverview', 'subContractors', 'annualLeaveSelfBook', 'operatives',
    'qualifications', 'wholesalersOrderHistory', 'materials', 'siteAudit',
  ])
  assert.deepEqual(manager.filter((row) => !row.editable).map((row) => row.field), ['materials', 'siteAudit'])
  // 1.14.0: a new manager starts with only the locked toggles on (`addUserPermissionDefaults`).
  assert.deepEqual(manager.filter((row) => row.value).map((row) => row.field), ['materials', 'siteAudit'])
  // The summary shows the same rows, none editable.
  const summary = visible('manager', 'summary')
  assert.deepEqual(summary.map((row) => row.field), manager.map((row) => row.field))
  assert.ok(summary.every((row) => !row.editable))
  const operative = visible('operative', 'add')
  assert.deepEqual(operative.map((row) => [row.field, row.value, row.editable]), [['materials', false, true], ['siteAudit', false, true]])
  assert.deepEqual(r3Levels.MANAGER_PERMISSION_TOGGLES.map((row) => row.key).slice(0, 4), ['adminAccess', 'projects', 'smallWorks', 'weeklyReports'])
})

test('1.11.0 accountTypeChangeWrites: every document that decides the type; refused for another company', () => {
  const person = { id: 'u1', email: 'u@x.com', organizationId: 'ORG', role: 'manager', manager: true, projects: true }
  const plan = r3Levels.accountTypeChangeWrites({
    person,
    kind: 'admin',
    organizationId: 'ORG',
    roster: [{ id: 'u1-old', email: 'U@x.com', organizationId: 'ORG' }, { id: 'u1-b', email: 'u@x.com', organizationId: 'OTHER' }],
  })
  assert.ok(plan.ok)
  if (!plan.ok) return
  assert.deepEqual(plan.writes.map((write) => write.path), ['users/u1', 'users/u1-old', 'organizations/ORG', 'users/u1/orgMemberships/ORG'])
  const profile = plan.writes[0] as { fields: Record<string, unknown> }
  assert.equal(profile.fields.role, 'admin')
  assert.equal(profile.fields.adminAccess, true)
  assert.equal(profile.fields['permissions.operativeMode'], false)
  assert.deepEqual((plan.writes[2] as { fields: Record<string, unknown> }).fields, { 'members.u1': 'admin' })
  const down = r3Levels.accountTypeChangeWrites({ person, kind: 'operative', organizationId: 'ORG' })
  assert.ok(down.ok && down.permissions.operativeMode === true && down.permissions.manager === false)
  // 1.15.0: an operative becoming a manager keeps their stored toggles (none stored: the reading defaults).
  const manager = r3Levels.accountTypePermissions('manager', { role: 'operative', operativeMode: true })
  assert.equal(manager.projects, false)
  assert.equal(manager.operatives, false)
  assert.equal(manager.manager, true)
  assert.equal(manager.operativeMode, false)
  // A profile of another company: only this organisation's members entry and membership are written.
  const other = r3Levels.accountTypeChangeWrites({ person: { ...person, organizationId: 'organizations/OTHER' }, kind: 'admin', organizationId: 'ORG' })
  assert.ok(other.ok)
  if (other.ok) {
    assert.deepEqual(other.writes.map((write) => write.path), ['organizations/ORG', 'users/u1/orgMemberships/ORG'])
    assert.equal(other.note, r3Levels.ACCOUNT_TYPE_OTHER_COMPANY_NOTE)
  }
  const superAdmin = r3Levels.accountTypeChangeWrites({ person: { ...person, isSuperAdmin: true }, kind: 'manager', organizationId: 'ORG' })
  assert.deepEqual(superAdmin.ok ? null : superAdmin.reason, 'super_admin')
})

test('1.11.0 PAYE: a timesheet exists only for self-employed days; reminders and the invoice follow', () => {
  const period = { startDayKey: '2026-11-01', endDayKey: '2026-11-07' }
  assert.deepEqual(r3Days({ employmentType: 'paye' }, period, 'Europe/London'), [])
  assert.equal(r3Shows({ employmentType: 'paye', timesheetsEnabled: true }, period, 'Europe/London'), false)
  assert.equal(r3Days({ employmentType: 'self_employed' }, period, 'Europe/London').length, 7)
  // PAYE until Thursday 5 Nov, self-employed from then: only 5–7 Nov count.
  const switching = { employmentType: 'self_employed', employmentTypeTransitionFrom: 'paye', employmentTypeEffectiveAt: '2026-11-05T00:00:00Z' }
  assert.deepEqual(r3Days(switching, period, 'Europe/London'), ['2026-11-05', '2026-11-06', '2026-11-07'])
  assert.equal(r3Shows({ ...switching, isActive: false }, period, 'Europe/London'), false)
  // The other way round: self-employed until the 3rd.
  const leaving = { employmentType: 'paye', employmentTypeTransitionFrom: 'self_employed', employmentTypeEffectiveAt: '2026-11-03T00:00:00Z' }
  assert.deepEqual(r3Days(leaving, period, 'Europe/London'), ['2026-11-01', '2026-11-02'])
  // Invoice: lines and entries on PAYE days never become rows.
  const rows = r3InvoiceRows({
    sheet: {
      priceWorkEntries: [{ id: 'P1', title: 'x', amount: 50, startDate: '2026-11-02T10:00:00Z' }, { id: 'P2', title: 'y', amount: 60, startDate: '2026-11-06T10:00:00Z' }],
      expenseEntries: [{ id: 'E1', title: 'z', amount: 5, date: '2026-11-01T10:00:00Z' }],
    },
    payrollLines: [{ id: 'L1', amount: 100, dayKey: '2026-11-02' }, { id: 'L2', amount: 120, dayKey: '2026-11-06' }],
    extrasMode: 'raw',
    timesheetDays: r3Days(switching, period, 'Europe/London'),
    timeZone: 'Europe/London',
  })
  assert.deepEqual(rows.map((row) => row.id), ['L2', 'P2'])
  assert.deepEqual(r3InvoiceRows({ sheet: {}, payrollLines: [{ id: 'L1', amount: 100, dayKey: '2026-11-02' }], extrasMode: 'raw', timesheetDays: [] }), [])
})

test('1.11.0 invites: the invitation is the only source of role, permissions, pay and line manager', () => {
  const invitation = { organizationId: 'ORG-B', email: 'x@y.com', role: 'manager', permissions: { manager: true, projects: true }, invitedBy: 'adm', payBasis: 'day', dayRate: 200, hourlyRate: 9, assignedManagerUserIds: ['m1', 'm2'] }
  assert.equal(r3InviteRole(invitation), 'manager')
  assert.equal(r3InviteRole({ permissions: { adminAccess: true } }), 'admin')
  assert.equal(r3InviteRole({ permissions: {} }), 'member')
  assert.deepEqual(r3InviteProfile(invitation), {
    role: 'manager', permissions: { manager: true, projects: true }, manager: true, projects: true,
    payBasis: 'day', dayRate: 200, assignedManagerUserIds: ['m1', 'm2'], assignedManagerUserId: 'm1', hasNoLineManager: false,
  })
  const writes = r3InviteMembership({ invitation, invitationId: 'inv-1', authUid: 'u-1', now: 5 })!
  assert.deepEqual(writes.membership, {
    organizationId: 'ORG-B', role: 'manager', status: 'active', isSuperAdmin: false, accountActive: true,
    permissions: { manager: true, projects: true }, invitationId: 'inv-1', invitedAt: 5, acceptedAt: 5, updatedAt: 5, invitedBy: 'adm',
  })
  assert.equal(writes.membersField, 'members.u-1')
  assert.equal(r3InviteMembership({ invitation: {}, invitationId: 'inv', authUid: 'u', now: 1 }), null)
})

test('1.11.0 job kind: the collection decides; bookings carry jobCollection (1.33.0: managers read every booking)', () => {
  assert.equal(r3JobKind({ jobType: 'Small Works' }, 'projects'), 'projects')
  assert.equal(r3JobKind({ jobType: 'CAT A' }, 'smallWorks'), 'smallWorks')
  assert.equal(r3JobKind({ jobType: 'small_works' }, null), 'smallWorks')
  assert.deepEqual(r3BothKinds(['A', 'b', 'C'], ['B', 'c', 'd']), ['b', 'C'])
  assert.equal(r3NormKind('small_work'), 'smallWorks')
  assert.equal(r3NormKind('Projects'), 'projects')
  assert.equal(r3NormKind('jobs'), null)
  assert.equal(r3KindFor('JOB-1', { projects: ['job-1'], smallWorks: [] }), 'projects')
  assert.equal(r3KindFor('X', { projects: ['x'], smallWorks: ['X'] }), null)
  assert.deepEqual(r3BookingKind({ collection: 'managerSiteBookings', locationType: 'office', jobCollection: 'projects' }), {})
  assert.deepEqual(r3BookingKind({ collection: 'managerSiteBookings', locationType: 'small_work' }), { jobCollection: 'smallWorks' })
  const written = r3BookingWrite({ id: 'B', operativeId: 'o', projectId: 'p', dateMs: 0, timeSlot: 'AM', status: 'Confirmed', bookedBy: 'x', jobCollection: 'small_works', createdAtMs: 0, updatedAtMs: 0 })
  assert.ok(written.ok && written.fields.jobCollection === 'smallWorks')
  const parsed = r3ParseBooking('B', { operativeId: 'o', projectId: 'p', date: 0, timeSlot: 'AM', status: 'Confirmed', jobCollection: 'projects' })
  assert.ok(parsed.ok && parsed.booking.jobCollection === 'projects')
  // 1.33.0: a single-toggle manager reads every booking (whole collections), switch on or off — no by-kind reads.
  const viewer = { role: { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }, uid: 'm', ids: ['m'], toggles: { projects: false, smallWorks: true } }
  assert.equal(r3BookingPlan(viewer, ['P-1'], { enforced: true }).readsEveryBooking, true)
  assert.equal(r3BookingPlan(viewer, ['P-1']).readsEveryBooking, true)
})

test('1.11.0 line managers: candidates, "No line manager" only for admins, a summary never negative', () => {
  const roster = [
    { id: 'ADM', email: 'adm@x', firstName: 'Ada', surname: 'Admin', role: 'admin', adminAccess: true },
    { id: 'SA', email: 'sa@x', firstName: 'Sam', surname: 'Super', isSuperAdmin: true },
    { id: 'MGR', email: 'mgr@x', firstName: 'Max', surname: 'Manager', role: 'manager', manager: true },
    { id: 'MGR-OLD', email: 'mgr@x', firstName: 'Max', surname: 'Manager', role: 'manager', manager: true, isActive: false },
    { id: 'OP', email: 'op@x', firstName: 'Olly', surname: 'Op', role: 'operative', operativeMode: true },
    { id: 'PEND', email: 'pend@x', firstName: 'Pat', surname: 'Pending', role: 'manager', manager: true, passwordSet: false },
    { id: 'DEL', email: '', firstName: 'Deleted', surname: 'user', role: 'manager', manager: true },
  ]
  // The manager themself is never a candidate, under any id.
  assert.deepEqual(r3Candidates({ id: 'MGR', email: 'mgr@x', role: 'manager' }, roster).map((row) => row.id), ['ADM', 'SA'])
  assert.deepEqual(r3Candidates({ id: 'NEW' }, roster).map((row) => [row.id, row.level]), [['ADM', 'admin'], ['MGR', 'manager'], ['SA', 'admin']])
  assert.equal(r3Options({ role: 'manager' }).allowsNoLineManager, false)
  assert.equal(r3Options({ role: 'operative', operativeMode: true }).allowsNoLineManager, false)
  assert.equal(r3Options({ role: 'admin', adminAccess: true }).allowsNoLineManager, true)
  assert.deepEqual(r3Summary({ assignedManagerUserIds: ['MGR', 'ADM', 'GONE'] }, roster), {
    label: 'Max Manager +2 more',
    ids: [
      { id: 'MGR', name: 'Max Manager', resolved: true },
      { id: 'ADM', name: 'Ada Admin', resolved: true },
      { id: 'GONE', name: 'Unknown person', resolved: false },
    ],
    moreCount: 2,
  })
  // One entry: no "+N more" (never "+0" or "+-1").
  assert.equal(r3Summary({ assignedManagerUserIds: ['MGR', 'mgr'] }, roster).label, 'Max Manager')
  assert.equal(r3Summary({ assignedManagerUserId: 'GONE' }, roster).label, 'Unknown person')
  assert.equal(r3Summary({ assignedManagerUserIds: [] }, roster).label, 'Not set')
  assert.equal(r3Summary({ hasNoLineManager: true }, roster).label, 'No line manager')
})

import { organizationLevelFor as r3OrgLevel, rosterMembersForOrganization as r3RosterMembers } from './orgRoster.ts'

test('1.11.0 rosterMembersForOrganization: anchored people stay; level in this organisation, never another company\'s flags', () => {
  const users = [
    { id: 'A', email: 'a@x', organizationId: 'ORG', role: 'admin', adminAccess: true },
    { id: 'SA', email: 'sa@x', organizationId: 'OTHER', role: 'manager', manager: true },
    { id: 'M2', email: 'm2@x', organizationId: 'organizations/OTHER', role: 'admin', adminAccess: true },
    { id: 'STRANGER', email: 's@x', organizationId: 'OTHER', role: 'admin', adminAccess: true },
  ]
  const result = r3RosterMembers({
    organizationId: 'ORG',
    users,
    members: { A: 'admin', SA: 'admin', M2: 'manager', GONE: 'manager', DENIED: 'operative' },
    creatorUserId: 'SA',
    signedInUserId: 'A',
    memberships: { M2: { role: 'manager', permissions: { manager: true } } },
    missingIds: ['GONE'],
  })
  assert.deepEqual(result.anchoredIds, ['A', 'SA', 'M2', 'GONE', 'DENIED'])
  assert.deepEqual(result.people.map((row) => row.id), ['A', 'SA', 'M2'])
  const level = (id: string) => result.people.find((row) => row.id === id)!.organizationLevel
  assert.deepEqual(level('A'), { level: 'admin', isSuperAdmin: false, source: 'users' })
  assert.deepEqual(level('SA'), { level: 'admin', isSuperAdmin: true, source: 'creator' })
  assert.deepEqual(level('M2'), { level: 'manager', isSuperAdmin: false, source: 'membership' })
  // A denied read keeps the person (the app keeps their last row); a confirmed-missing one leaves.
  assert.deepEqual(result.unreadIds, ['DENIED'])
  assert.deepEqual(r3OrgLevel({ organizationId: 'ORG', userId: 'X', user: { organizationId: 'OTHER', adminAccess: true }, membersRole: 'operative' }), {
    level: 'operative', isSuperAdmin: false, source: 'members',
  })
})

// ---------------------------------------------------------------------------
// Rulebook 1.12.0: organisation-zone days east of UTC+12, break overlap, policy limits, leave year, security helpers.
// ---------------------------------------------------------------------------

const ZONES_112 = ['Pacific/Auckland', 'Pacific/Kiritimati', 'Pacific/Chatham', 'America/Los_Angeles', 'Europe/London']

test('1.12.0 day keys: dateFromDayKeyInZone is that local midnight in every zone, BST and GMT included', () => {
  const keys = ['2026-11-06', '2026-11-07', '2026-03-29', '2026-10-25', '2026-04-05', '2026-09-27', '2026-03-08', '2026-11-01', '2026-01-01', '2028-02-29']
  for (const zone of ZONES_112) {
    for (const key of keys) {
      const midnight = zoneMidnight112(key, zone)
      assert.equal(zoneDayKey112(midnight, zone), key, `${zone} ${key}`)
      // One minute earlier is the previous day: this is the first instant of the day.
      assert.notEqual(zoneDayKey112(new Date(midnight.getTime() - 60_000), zone), key, `${zone} ${key} start`)
    }
  }
  // Known instants: Auckland NZDT (UTC+13), Kiritimati UTC+14, Chatham UTC+13:45, Los Angeles PST, London BST / GMT.
  assert.equal(zoneMidnight112('2026-11-06', 'Pacific/Auckland').toISOString(), '2026-11-05T11:00:00.000Z')
  assert.equal(zoneMidnight112('2026-11-06', 'Pacific/Kiritimati').toISOString(), '2026-11-05T10:00:00.000Z')
  assert.equal(zoneMidnight112('2026-11-06', 'Pacific/Chatham').toISOString(), '2026-11-05T10:15:00.000Z')
  assert.equal(zoneMidnight112('2026-11-06', 'America/Los_Angeles').toISOString(), '2026-11-06T08:00:00.000Z')
  assert.equal(zoneMidnight112('2026-07-10', 'Europe/London').toISOString(), '2026-07-09T23:00:00.000Z')
  assert.equal(zoneMidnight112('2026-11-06', 'Europe/London').toISOString(), '2026-11-06T00:00:00.000Z')
})

test('1.12.0 payrollHoursResult: a Friday is a weekday and a Saturday a Saturday in every zone', () => {
  const policy = parsePolicy112(undefined)
  for (const zone of ZONES_112) {
    const friday = R112.payrollHoursResult({ booking: { timeSlot: 'FULL DAY' }, dayKey: '2026-11-06', policy, timeZone: zone })
    assert.equal(friday.totalPaidHours, 8, `${zone} Friday`)
    const fridayJuly = R112.payrollHoursResult({ booking: { timeSlot: 'FULL DAY' }, dayKey: '2026-07-10', policy, timeZone: zone })
    assert.equal(fridayJuly.totalPaidHours, 8, `${zone} Friday (July)`)
    const saturday = R112.payrollHoursResult({ booking: { timeSlot: 'FULL DAY' }, dayKey: '2026-11-07', policy, timeZone: zone })
    const londonSaturday = R112.payrollHoursResult({ booking: { timeSlot: 'FULL DAY' }, dayKey: '2026-11-07', policy, timeZone: 'Europe/London' })
    assert.equal(saturday.totalPaidHours, londonSaturday.totalPaidHours, `${zone} Saturday`)
  }
})

test('1.12.0 leaveRecordDayKeys: Mon–Fri is five days and Fri–Mon two in every zone', () => {
  for (const zone of ZONES_112) {
    assert.deepEqual(
      R112.leaveRecordDayKeys({ startDayKey: '2026-11-09', endDayKey: '2026-11-13' }, zone),
      ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'],
      zone
    )
    assert.deepEqual(R112.leaveRecordDayKeys({ startDayKey: '2026-11-06', endDayKey: '2026-11-09' }, zone), ['2026-11-06', '2026-11-09'], zone)
  }
})

test('1.12.0 payRateHistoryWriteFields: effectiveAt is midnight of the effective day in the organisation zone', () => {
  for (const zone of ZONES_112) {
    const row = R112.payRateHistoryWriteFields({ userId: 'U1', rate: 200, payBasis: 'day', effective: '2026-11-10', timeZone: zone })
    assert.ok(row)
    assert.equal(row!.effectiveDayKey, '2026-11-10')
    assert.equal(zoneDayKey112(new Date(row!.effectiveAtMs), zone), '2026-11-10', zone)
    assert.equal(row!.effectiveAtMs, zoneMidnight112('2026-11-10', zone).getTime(), zone)
  }
})

test('1.12.0 activePaymentRunSummary: runs keep their days in every zone', () => {
  const recurring = {
    paymentRunMode: 'recurring_timeframe', paymentDateMode: 'weekday',
    recurringRunStartDay: 'monday', recurringRunEndDay: 'sunday', recurringPaymentDay: 'friday',
  }
  const ranges = {
    paymentRunMode: 'date_ranges', paymentDateMode: 'specific_dates',
    paymentRunDateRanges: [{ startDay: 1, endDay: 15 }, { startDay: 16, endDay: 31 }], paymentDates: [20, 5],
  }
  for (const zone of ZONES_112) {
    // Noon on Wednesday 4 November in the zone.
    const now = new Date(zoneMidnight112('2026-11-04', zone).getTime() + 12 * 3600_000).toISOString()
    const weekly = R112.activePaymentRunSummary(recurring as never, now, zone) as { start: string; end: string; label: string }
    assert.match(weekly.label, /^Mon 2 Nov – Sun 8 Nov · paid Fri 13 Nov$/, zone)
    const half = R112.activePaymentRunSummary(ranges as never, now, zone) as { label: string }
    assert.match(half.label, /^Sun 1 Nov – Sun 15 Nov/, zone)
  }
})

test('1.12.0 break: only the covered part of the unpaid break comes off; a booking all inside it pays 0, never a full day', () => {
  const policy = parsePolicy112(undefined) // 07:30–16:00, break 12:00–12:30 unpaid 30 minutes, 8 paid hours
  const custom = (start: string, end: string) =>
    R112.payrollHoursResult({ booking: { timeSlot: 'CUSTOM', workStartTime: start, workEndTime: end }, dayKey: '2026-11-04', policy, timeZone: 'Europe/London' })
  for (const [start, end] of [['12:00', '12:30'], ['12:05', '12:25']]) {
    const r = custom(start, end)
    assert.equal(r.totalPaidHours, 0, `${start}–${end}`)
    assert.equal(r.workedHours, 0, `${start}–${end}`)
  }
  assert.ok(Math.abs(custom('11:50', '12:20').totalPaidHours - 10 / 60) < 1e-9)
  assert.ok(Math.abs(custom('11:00', '12:10').totalPaidHours - 1) < 1e-9)
  assert.equal(custom('07:30', '16:00').totalPaidHours, 8)
  assert.equal(R112.payrollHoursResult({ booking: { timeSlot: 'FULL DAY' }, dayKey: '2026-11-04', policy, timeZone: 'Europe/London' }).totalPaidHours, 8)
  // A paid break or a removed break deducts nothing.
  const paidBreak = R112.payrollHoursResult({ booking: { timeSlot: 'CUSTOM', workStartTime: '12:00', workEndTime: '12:30' }, dayKey: '2026-11-04', policy: { ...policy, breakPaid: true }, timeZone: 'Europe/London' })
  assert.equal(paidBreak.totalPaidHours, 0.5)
})

test('1.12.0 parsePayrollPolicy: stored numbers are read into PAYROLL_POLICY_LIMITS; payForHours refuses a paid day below 1', () => {
  const bad = parsePolicy112({
    standardPaidHours: 0, unpaidBreakMinutes: 500, weekdayOutsideStandardMultiplier: 'abc',
    saturday: { allHoursMultiplier: 9, countsAsHours: 0, outsideStandardWindowMultiplier: -1 },
  })
  assert.equal(bad.standardPaidHours, 8)
  assert.equal(bad.unpaidBreakMinutes, 120)
  assert.equal(bad.weekdayOutsideStandardMultiplier, 1.5)
  assert.equal(bad.saturday.allHoursMultiplier, 3)
  assert.equal(bad.saturday.countsAsStandardHours, 0)
  assert.equal(bad.saturday.outsideWindowMultiplier, 1)
  assert.equal(parsePolicy112({ standardPaidHours: '' }).standardPaidHours, 8)
  assert.equal(parsePolicy112({ standardPaidHours: 20 }).standardPaidHours, 12)
  assert.equal(parsePolicy112({ standardPaidHours: 7.5 }).standardPaidHours, 7.5)
  assert.equal(R112.payForHours({ payBasis: 'day', dayRate: 200, paidHours: 8, standardDayHours: 0 }), 0)
  assert.equal(R112.payForHours({ payBasis: 'day', dayRate: 200, paidHours: 8, standardDayHours: Number.NaN }), 0)
  assert.equal(R112.payForHours({ payBasis: 'day', dayRate: 200, paidHours: 8, standardDayHours: 8 }), 200)
  assert.equal(R112.payForHours({ payBasis: 'day', dayRate: 200, paidHours: 2, standardDayHours: 8, otMultiplier: Number.NaN }), 50)
  assert.equal(R112.payForHours({ payBasis: 'hourly', hourlyRate: 20, paidHours: 8, standardDayHours: 0 }), 160)
})

test('1.12.0 leave year: always 12 months; the end month follows the start and a mismatch is refused', () => {
  assert.equal(R112.leaveYearEndMonth(1), 12)
  assert.equal(R112.leaveYearEndMonth(4), 3)
  assert.equal(R112.validateLeaveYearMonths(4, 3), null)
  assert.equal(R112.validateLeaveYearMonths(1, 12), null)
  assert.equal(R112.validateLeaveYearMonths(4, 12), R112.LEAVE_YEAR_MONTHS_MESSAGE)
  assert.equal(R112.validateLeaveYearMonths(1, 1), R112.LEAVE_YEAR_MONTHS_MESSAGE)
  assert.equal(R112.validateAnnualLeaveDefaults({ startMonth: 4, endMonth: 3 }), null)
  assert.notEqual(R112.validateAnnualLeaveDefaults({ startMonth: 13, endMonth: 12 }), null)
  // A stored mismatch reads as 12 months from the start: February leave in an April year is counted.
  assert.deepEqual(R112.leaveYearBounds({ startMonth: 4, endMonth: 12, onDayKey: '2027-02-10' }), {
    startDayKey: '2026-04-01', endDayKey: '2027-03-31', yearKey: '2026-04-01',
  })
  assert.deepEqual(R112.leaveYearBounds({ startMonth: 1, endMonth: 1, onDayKey: '2026-11-03' }), {
    startDayKey: '2026-01-01', endDayKey: '2026-12-31', yearKey: '2026-01-01',
  })
})

test('1.12.0 invitationIsOperativeOnly: the only invitation a manager with operatives access may write', () => {
  assert.equal(R112.invitationIsOperativeOnly({ role: 'operative', permissions: { operativeMode: true, siteAudit: true, projects: true } }), true)
  assert.equal(R112.invitationIsOperativeOnly({ permissions: { operativeMode: true } }), true)
  assert.equal(R112.invitationIsOperativeOnly({ role: 'admin', permissions: { adminAccess: true } }), false)
  assert.equal(R112.invitationIsOperativeOnly({ permissions: { adminAccess: true, operativeMode: true } }), false)
  assert.equal(R112.invitationIsOperativeOnly({ role: 'operative', permissions: { operativeMode: true, operatives: true } }), false)
  assert.equal(R112.invitationIsOperativeOnly({ role: 'operative', permissions: { operativeMode: true }, isSuperAdmin: true }), false)
  assert.equal(R112.invitationIsOperativeOnly({ role: 'manager', permissions: { manager: true } }), false)
})

test('1.12.0 organizationMemberActive: members, creator, own company or a membership; explicit false deactivates', () => {
  const organization = { members: { U1: 'member' }, creatorUserId: 'FOUNDER' }
  const check = (userId: string, user: Record<string, unknown> | null, membership: Record<string, unknown> | null = null) =>
    R112.organizationMemberActive({ organizationId: 'org-a', userId, organization, user, membership })
  assert.deepEqual(check('U1', { organizationId: 'org-a' }), { member: true, active: true })
  assert.deepEqual(check('FOUNDER', null), { member: true, active: true })
  assert.deepEqual(check('U2', { organizationId: 'organizations/ORG-A' }), { member: true, active: true })
  assert.deepEqual(check('U3', { organizationId: 'org-b' }, { role: 'manager' }), { member: true, active: true })
  assert.deepEqual(check('STRANGER', { organizationId: 'org-b' }), { member: false, active: false })
  assert.deepEqual(check('U1', { organizationId: 'org-a', isActive: false }), { member: true, active: false })
  assert.deepEqual(check('U1', { organizationId: 'org-b', isActive: false }), { member: true, active: true })
  assert.deepEqual(check('U3', { organizationId: 'org-b' }, { accountActive: false }), { member: true, active: false })
  assert.deepEqual(check('U3', { organizationId: 'org-b' }, { isActive: false }), { member: true, active: false })
})

test('1.12.0 appUpdateRequired: platformConfig/app minimums; missing or malformed config never blocks', () => {
  assert.equal(R112.PLATFORM_CONFIG_APP_PATH, 'platformConfig/app')
  assert.equal(R112.appUpdateRequired({ platform: 'ios', runningBuild: 119 }, { minimumIosBuild: 120 }), true)
  assert.equal(R112.appUpdateRequired({ platform: 'ios', runningBuild: '120' }, { minimumIosBuild: 120 }), false)
  assert.equal(R112.appUpdateRequired({ platform: 'ios', runningBuild: 121 }, { minimumIosBuild: 120 }), false)
  assert.equal(R112.appUpdateRequired({ platform: 'ios', runningBuild: 1 }, null), false)
  assert.equal(R112.appUpdateRequired({ platform: 'ios', runningBuild: 1 }, {}), false)
  assert.equal(R112.appUpdateRequired({ platform: 'ios', runningBuild: 1 }, { minimumIosBuild: 'soon' }), false)
  assert.equal(R112.appUpdateRequired({ platform: 'ios', runningBuild: 'x' }, { minimumIosBuild: 120 }), false)
  assert.equal(R112.appUpdateRequired({ platform: 'web', runningBuild: '1.11.0' }, { minimumWebVersion: '1.12.0' }), true)
  assert.equal(R112.appUpdateRequired({ platform: 'web', runningBuild: '1.12.0' }, { minimumWebVersion: '1.12' }), false)
  assert.equal(R112.appUpdateRequired({ platform: 'web', runningBuild: '1.12.1' }, { minimumWebVersion: '1.12.0' }), false)
  assert.equal(R112.appUpdateRequired({ platform: 'web', runningBuild: '1.2.0' }, { minimumIosBuild: 500 }), false)
  assert.equal(R112.appUpdateRequired({ platform: 'android', runningBuild: 1 }, { minimumIosBuild: 500 }), false)
})

test('1.12.0 isVerifiedPlatformOwner: the owner email and a verified token, never the email alone', () => {
  assert.equal(R112.isVerifiedPlatformOwner({ email: 'Info@ProjectPlanner.us', emailVerified: true }), true)
  assert.equal(R112.isVerifiedPlatformOwner({ email: 'info@projectplanner.us', emailVerified: false }), false)
  assert.equal(R112.isVerifiedPlatformOwner({ email: 'info@projectplanner.us' }), false)
  assert.equal(R112.isVerifiedPlatformOwner({ email: 'someone@test.com', emailVerified: true }), false)
})

// MARK: - Rulebook 1.13.0 (owner decisions round 4)

test('1.13.0 Q1: canViewPersonPay — the person, active line managers, admins, operatives managers for operatives', () => {
  const roster = [
    { id: 'OP', email: 'op@x.com', role: 'operative', operativeMode: true, assignedManagerUserIds: ['LM'] },
    { id: 'OP2', email: 'op2@x.com', role: 'operative', operativeMode: true, assignedManagerUserIds: ['GONE'] },
    { id: 'LM', email: 'lm@x.com', role: 'manager', manager: true },
    { id: 'GONE', email: 'gone@x.com', role: 'manager', manager: true, isActive: false },
    { id: 'OM', email: 'om@x.com', role: 'manager', manager: true, permissions: { operatives: true } },
    { id: 'M', email: 'm@x.com', role: 'manager', manager: true },
    { id: 'AD', email: 'ad@x.com', role: 'admin', adminAccess: true },
    { id: 'NEW', email: 'op@x.com', role: 'operative', operativeMode: true },
  ]
  const by = (id: string) => roster.find((row) => row.id === id)!
  const can = (viewer: string, subject: string) => R112.canViewPersonPay(by(viewer), by(subject), roster)
  assert.equal(can('OP', 'OP'), true)
  assert.equal(can('NEW', 'OP'), true, 'a same-email id is the same person')
  assert.equal(can('OP2', 'OP'), false, 'a colleague never sees a rate')
  // 1.32.0 (owner 5 Nov): a line manager sees a report's pay only on the timesheets they review.
  assert.equal(can('LM', 'OP'), false, 'the line manager: not on the profile')
  assert.equal(R112.canViewPersonPay(by('LM'), by('OP'), roster, { context: 'timesheetReview' }), true, 'the active line manager, on a reviewed timesheet')
  assert.equal(R112.canViewPersonPay(by('GONE'), by('OP2'), roster, { context: 'timesheetReview' }), false, 'an inactive line manager does not count')
  assert.equal(can('OM', 'OP'), true, 'a manager with the Operatives toggle, for an operative')
  assert.equal(can('OM', 'M'), false, 'never another manager')
  assert.equal(can('M', 'OP'), false, 'a manager without the toggle who is not the line manager')
  assert.equal(can('AD', 'M'), true)
  assert.equal(can('OP', 'AD'), false)
  assert.equal(R112.canViewPersonPay({ id: 'x', isPlatformOwner: true }, by('OP'), roster), true)
})

test('1.13.0 Q1: pay profile reader, overlay, write fields and backfill', () => {
  assert.deepEqual(R112.PAY_PROFILE_FIELDS, ['payBasis', 'dayRate', 'hourlyRate', 'employmentType', 'employmentTypeTransitionFrom', 'employmentTypeEffectiveAt'])
  assert.equal(R112.payProfilePath('ORG', 'U1'), 'organizations/ORG/payProfiles/U1')
  const profile = R112.parsePayProfileDocument('U1', { userId: 'U1', dayRate: 200, hourlyRate: null, other: 1 })
  assert.deepEqual(profile, { subjectId: 'U1', fields: { dayRate: 200, hourlyRate: null } })
  assert.deepEqual(R112.overlayPayProfile({ id: 'U1', dayRate: 150, payBasis: 'day' }, profile), { id: 'U1', dayRate: 200, payBasis: 'day', hourlyRate: null })
  assert.deepEqual(R112.overlayPayProfile({ id: 'U1', dayRate: 150 }, null), { id: 'U1', dayRate: 150 })
  assert.deepEqual(R112.payProfileWriteFieldsFromProfileWrite('U1', { firstName: 'A', dayRate: 210, payBasis: 'day' }), { userId: 'U1', dayRate: 210, payBasis: 'day' })
  assert.equal(R112.payProfileWriteFieldsFromProfileWrite('U1', { firstName: 'A' }), null)
  const copy = R112.payProfileBackfillWrites({ subjectId: 'U1', source: { dayRate: 150, employmentType: 'paye', firstName: 'A' }, profile: { dayRate: 200 } })
  assert.deepEqual(copy, { profileSet: { userId: 'U1', employmentType: 'paye' }, sourceRemove: [] })
  const strip = R112.payProfileBackfillWrites({ subjectId: 'U1', source: { dayRate: 150, employmentType: 'paye' }, profile: { dayRate: 200 }, strip: true })
  assert.deepEqual(strip.sourceRemove, ['dayRate', 'employmentType'])
  assert.deepEqual(R112.payProfileBackfillWrites({ subjectId: 'U1', source: { dayRate: 150 }, profile: { dayRate: 150 }, strip: true }), { profileSet: null, sourceRemove: ['dayRate'] })
})

test('1.13.0 Q2: weekends are custom hours only; the editor prefills the set window; stored weekend slots keep their pay', () => {
  const policy = {
    ...parsePayrollPolicy(undefined),
    saturday: { allHoursAtMultiplierMode: false, allHoursMultiplier: 2, definedWindowStart: '07:30', definedWindowEnd: '13:00', countsAsStandardHours: 8, outsideWindowMultiplier: 2 },
    sunday: { allHoursAtMultiplierMode: true, allHoursMultiplier: 2, sameAsSaturday: false },
  }
  assert.deepEqual(R112.allowedTimeSlotsOnDay(WED, policy), ['FULL DAY', 'CUSTOM'])
  assert.deepEqual(R112.allowedTimeSlotsOnDay(SAT, policy), ['CUSTOM'])
  assert.deepEqual(R112.allowedTimeSlotsOnDay(SUN, policy, 'Europe/London'), ['CUSTOM'])
  assert.deepEqual(R112.WEEKEND_TIME_SLOTS, ['CUSTOM'])
  // Whatever the weekend setup: the same with an all-hours Saturday.
  assert.deepEqual(R112.allowedTimeSlotsOnDay(SAT, { ...policy, saturday: { ...policy.sunday } }), ['CUSTOM'])
  for (const slot of ['FULL DAY', 'AM', 'PM']) assert.equal(R112.timeSlotAllowedOnDay(slot, SAT), false)
  assert.equal(R112.timeSlotAllowedOnDay('CUSTOM_HOURS', SAT), true)
  // 1.20.0: Monday–Friday offers Full day or Custom only.
  assert.equal(R112.timeSlotAllowedOnDay('AM', WED), false)
  assert.equal(R112.timeSlotAllowedOnDay('FULL DAY', WED), true)
  assert.equal(R112.timeSlotAllowedOnDay('CUSTOM_HOURS', WED), true)
  // Prefill: the window on a set-window day; nothing on an all-hours day or a weekday.
  assert.deepEqual(R112.weekendCustomHoursDefault(policy, SAT), { start: '07:30', end: '13:00' })
  assert.deepEqual(R112.weekendCustomHoursDefault(policy, 6), { start: '07:30', end: '13:00' })
  assert.equal(R112.weekendCustomHoursDefault(policy, SUN), null)
  assert.equal(R112.weekendCustomHoursDefault(policy, WED), null)
  assert.equal(
    R112.weekendBookingNote(policy, SAT),
    'Saturday is paid on the hours you enter: 07:30–13:00 counts as 8h, hours outside it at 2×. Change it in Working hours.'
  )
  assert.equal(R112.weekendBookingNote(policy, 'sunday'), 'Sunday is paid on the hours you enter, every hour at 2×. Change it in Working hours.')
  assert.equal(R112.weekendBookingNote(policy, WED), null)
  // Custom hours: the window counts as its hours, the rest at the weekend multiplier; all-hours: every hour × multiplier.
  const custom = hoursOn(SAT, { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '15:00' }, policy)
  assert.deepEqual([custom.standardHours, custom.outsideHours, custom.totalPaidHours], [8, 2, 12])
  assert.equal(hoursOn(SUN, { timeSlot: 'CUSTOM_HOURS', workStartTime: '08:00', workEndTime: '12:00' }, policy).totalPaidHours, 8)
  // Stored weekend rows are paid as stored: FULL DAY in window mode = the window at counts-as hours; AM half of it;
  // all-hours FULL DAY keeps the pre-1.13 calculation (the standard day 07:30–16:00 at 2× = 17), never more.
  const full = hoursOn(SAT, { timeSlot: 'FULL DAY' }, policy)
  assert.deepEqual([full.totalPaidHours, full.standardHours, full.outsideHours], [8, 8, 0])
  assert.equal(hoursOn(SAT, { timeSlot: 'AM' }, policy).totalPaidHours, 4)
  assert.equal(hoursOn(SUN, { timeSlot: 'FULL DAY' }, policy).totalPaidHours, 17)
})

test('1.13.0 Q2: a booking request never mixes weekdays and weekend days', () => {
  assert.equal(R112.bookingDaysMixWeekdayAndWeekend([WED, SAT]), true)
  assert.equal(R112.bookingDaysMixWeekdayAndWeekend([SAT, SUN]), false)
  assert.equal(R112.bookingDaysMixWeekdayAndWeekend([WED, '2026-10-22']), false)
  assert.equal(R112.bookingDaysMixWeekdayAndWeekend([]), false)
  assert.equal(
    R112.WEEKEND_WEEKDAY_MIX_MESSAGE,
    'Weekends cannot be booked alongside Weekdays. Make your weekday booking first then weekend separately.'
  )
})

test('1.13.0 Q3: a lapsed subscription blocks; admins reach billing only; missing billing is open', () => {
  const now = Date.parse('2026-11-03T12:00:00Z')
  assert.equal(R112.subscriptionAccess({ billing: null, now }), 'open')
  assert.equal(R112.subscriptionAccess({ billing: { status: 'active' }, now }), 'open')
  assert.equal(R112.subscriptionAccess({ billing: { status: 'canceled' }, now }), 'blocked')
  assert.equal(R112.subscriptionAccess({ billing: { status: 'canceled' }, viewerIsAdmin: true, now }), 'adminBillingOnly')
  assert.equal(R112.subscriptionAccess({ billing: { status: 'unpaid' }, viewerIsPlatformOwner: true, now }), 'open')
  assert.equal(R112.subscriptionAccess({ billing: { status: 'past_due', lastPaymentFailedAt: now - 2 * 86_400_000 }, now }), 'open')
  assert.equal(R112.subscriptionAccess({ billing: { status: 'past_due', lastPaymentFailedAt: now - 8 * 86_400_000 }, now }), 'blocked')
  assert.equal(
    R112.SUBSCRIPTION_LAPSED_MESSAGE,
    "The organisation's Project Planner subscription has lapsed. Please contact your system administrator and ask them to renew."
  )
})

test('1.13.0 Q4: leave is pro rata in the year joined; carry-over is capped by maxCarryOverDays', () => {
  const year = { startDayKey: '2026-01-01', endDayKey: '2026-12-31' }
  assert.deepEqual(R112.proRataLeaveAllowance({ daysPerYear: 25, year, employmentStartDayKey: null }), { allowance: 25, proRata: false })
  assert.deepEqual(R112.proRataLeaveAllowance({ daysPerYear: 25, year, employmentStartDayKey: '2025-06-01' }), { allowance: 25, proRata: false })
  // Joined 1 July: 184 of 365 days → 12.6 → 13 (rounded up to the half day).
  assert.deepEqual(R112.proRataLeaveAllowance({ daysPerYear: 25, year, employmentStartDayKey: '2026-07-01' }), { allowance: 13, proRata: true })
  assert.deepEqual(R112.proRataLeaveAllowance({ daysPerYear: 25, year, employmentStartDayKey: '2027-02-01' }), { allowance: 0, proRata: true })
  const joinedYear = R112.annualLeaveBalance({ daysPerYear: 25, onDayKey: '2026-09-01', employmentStartDayKey: '2026-07-01', bookings: [] })
  assert.deepEqual([joinedYear.yearEntitlement, joinedYear.proRata, joinedYear.remaining], [13, true, 13])
  // Next year: carry what was left of the pro-rata 13 (13 − 3 = 10), capped at 5.
  const bookings = [{ startDayKey: '2026-09-07', endDayKey: '2026-09-09', status: 'approved' }]
  const uncapped = R112.annualLeaveBalance({ daysPerYear: 25, carriesOver: true, onDayKey: '2027-02-01', employmentStartDayKey: '2026-07-01', bookings })
  assert.deepEqual([uncapped.carriedForward, uncapped.yearEntitlement, uncapped.remaining], [10, 25, 35])
  const capped = R112.annualLeaveBalance({ daysPerYear: 25, carriesOver: true, maxCarryOverDays: 5, onDayKey: '2027-02-01', employmentStartDayKey: '2026-07-01', bookings })
  assert.deepEqual([capped.carriedForward, capped.remaining], [5, 30])
  // Joined after the previous year: nothing to carry.
  const none = R112.annualLeaveBalance({ daysPerYear: 25, carriesOver: true, onDayKey: '2027-02-01', employmentStartDayKey: '2027-01-10', bookings: [] })
  assert.equal(none.carriedForward, 0)
  assert.equal(R112.parseAnnualLeaveDefaults({ daysPerYear: 25 }).maxCarryOverDays, null)
  assert.equal(R112.parseAnnualLeaveDefaults({ maxCarryOverDays: '5' }).maxCarryOverDays, 5)
  assert.equal(R112.parseAnnualLeaveDefaults({ maxCarryOverDays: -1 }).maxCarryOverDays, null)
  assert.equal(R112.SUGGESTED_MAX_CARRY_OVER_DAYS, 5)
})

test('1.13.0 Q5: overnight bookings clash on real clock time across midnight', () => {
  assert.deepEqual(R112.slotInterval({ timeSlot: 'CUSTOM_HOURS', workStartTime: '22:00', workEndTime: '06:00' }), { start: 1320, end: 1800 })
  assert.deepEqual(R112.overnightCarryInterval({ start: 1320, end: 1800 }), { start: -120, end: 360 })
  assert.equal(R112.nextCalendarDayKey('2026-12-31'), '2027-01-01')
  const people = { accounts: [{ id: 'U1', email: 'u1@x.com' }], operatives: [] }
  const night = { id: 'n1', operativeId: 'U1', dayKey: '2026-10-21', timeSlot: 'CUSTOM_HOURS', workStartTime: '22:00', workEndTime: '06:00' }
  // The next morning from 05:00 overlaps the night shift; from 06:00 it only touches.
  const clash = R112.operativeClashGroups({
    people,
    operativeBookings: [night, { id: 'm1', operativeId: 'U1', dayKey: '2026-10-22', timeSlot: 'CUSTOM_HOURS', workStartTime: '05:00', workEndTime: '12:00' }],
  })
  assert.equal(clash.length, 1)
  assert.deepEqual([clash[0].dayKey, clash[0].bookingIds], ['2026-10-22', ['m1', 'n1']])
  assert.deepEqual(
    R112.operativeClashGroups({
      people,
      operativeBookings: [night, { id: 'm1', operativeId: 'U1', dayKey: '2026-10-22', timeSlot: 'CUSTOM_HOURS', workStartTime: '06:00', workEndTime: '12:00' }],
    }),
    []
  )
  // Two overnight bookings on one night are one clash, listed once (on their own day).
  const twoNights = R112.operativeClashGroups({ people, operativeBookings: [night, { ...night, id: 'n2' }] })
  assert.deepEqual(twoNights.map((g) => [g.dayKey, g.bookingIds]), [['2026-10-21', ['n1', 'n2']]])
  // Same evening: a 21:00–23:00 booking overlaps.
  assert.equal(R112.operativeClashGroups({ people, operativeBookings: [night, { id: 'e', operativeId: 'U1', dayKey: '2026-10-21', timeSlot: 'CUSTOM_HOURS', workStartTime: '21:00', workEndTime: '23:00' }] }).length, 1)
  // Timesheet overlap flags and manager clashes follow the same rule.
  assert.deepEqual(
    R112.overlappingBookingIds([
      { id: 'n1', dayKey: '2026-10-21', timeSlot: 'CUSTOM_HOURS', workStartTime: '22:00', workEndTime: '06:00' },
      { id: 'm1', dayKey: '2026-10-22', timeSlot: 'AM' },
    ]),
    []
  )
  assert.deepEqual(
    R112.overlappingBookingIds([
      { id: 'n1', dayKey: '2026-10-21', timeSlot: 'CUSTOM_HOURS', workStartTime: '22:00', workEndTime: '08:00' },
      { id: 'm1', dayKey: '2026-10-22', timeSlot: 'AM' },
    ]),
    ['n1', 'm1']
  )
  const mgr = R112.managerClashGroups({
    managerIds: ['U1'],
    people,
    managerBookings: [
      { id: 'MB', userId: 'U1', dayKey: '2026-10-21', timeSlot: 'CUSTOM_HOURS', workStartTime: '20:00', workEndTime: '09:00' },
      { id: 'MB2', userId: 'U1', dayKey: '2026-10-22', timeSlot: 'AM' },
    ],
    operativeBookings: [],
  })
  assert.deepEqual(mgr.map((g) => [g.dayKey, g.pairKey]), [['2026-10-22', 'm-MB|m-MB2']])
  // Paid at the start day's rules: Friday 18:00 → Saturday 02:00 is Friday overtime, not Saturday's rule.
  const fri = hoursOn('2026-10-23', { timeSlot: 'CUSTOM_HOURS', workStartTime: '18:00', workEndTime: '02:00' })
  assert.deepEqual([fri.outsideHours, fri.outsideMultiplier, fri.totalPaidHours], [8, 1.5, 12])
  const long = hoursOn(WED, { timeSlot: 'CUSTOM_HOURS', workStartTime: '14:00', workEndTime: '01:00', isBreakRemoved: true })
  assert.deepEqual([long.standardHours, long.outsideHours], [2, 9])
})

test('1.13.0 Q6: country pickers offer GB and IE; a stored other country is kept and shown', () => {
  assert.deepEqual(R112.LAUNCH_COUNTRY_CODES, ['GB', 'IE'])
  assert.deepEqual(R112.launchCountryOptions('GB').map((row) => row.code), ['GB', 'IE'])
  assert.deepEqual(R112.launchCountryOptions('US').map((row) => row.code), ['GB', 'IE', 'US'])
  assert.deepEqual(R112.launchCountryOptions(null).map((row) => row.code), ['GB', 'IE'])
})

test('1.13.0 lunch warning: custom hours over the unpaid break with Unpaid break on', () => {
  const policy = parsePayrollPolicy(undefined)
  const warn = (booking: Record<string, unknown>, dayKey = WED, p: Record<string, unknown> = policy) =>
    R112.customHoursBreakWarning(p as never, dayKey, booking)
  const message = 'You are booking custom hours that cover the unpaid lunch break. Turn off Unpaid break to make sure they are paid for this time.'
  assert.equal(warn({ timeSlot: 'CUSTOM_HOURS', workStartTime: '11:00', workEndTime: '14:00' }), message)
  assert.equal(warn({ timeSlot: 'CUSTOM_HOURS', workStartTime: '12:05', workEndTime: '12:25' }), message)
  assert.equal(warn({ timeSlot: 'CUSTOM_HOURS', workStartTime: '11:00', workEndTime: '14:00', isBreakRemoved: true }), null)
  assert.equal(warn({ timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '12:00' }), null, 'touching the break is not covering it')
  assert.equal(warn({ timeSlot: 'FULL DAY' }), null)
  assert.equal(warn({ timeSlot: 'CUSTOM_HOURS', workStartTime: '11:00', workEndTime: '14:00' }, WED, { ...policy, breakPaid: true }), null)
  assert.equal(warn({ timeSlot: 'CUSTOM_HOURS', workStartTime: '11:00', workEndTime: '14:00' }, SAT), null)
})

test('1.13.0 §14: self email change goes through Auth; the sign-in sync writes the users email and moves the claim', () => {
  assert.equal(R112.selfEmailChangeAction({ storedEmail: 'a@x.com', nextEmail: ' A@X.com ' }), 'unchanged')
  assert.equal(R112.selfEmailChangeAction({ storedEmail: 'a@x.com', nextEmail: 'nope' }), 'invalid')
  assert.equal(R112.selfEmailChangeAction({ storedEmail: 'a@x.com', nextEmail: 'b@x.com' }), 'verifyBeforeUpdate')
  assert.equal(R112.signInEmailSyncWrites({ userId: 'U', organizationId: 'O', storedEmail: 'a@x.com', tokenEmail: 'A@x.com', tokenEmailVerified: true }), null)
  assert.equal(R112.signInEmailSyncWrites({ userId: 'U', organizationId: 'O', storedEmail: 'a@x.com', tokenEmail: 'b@x.com', tokenEmailVerified: false }), null)
  assert.deepEqual(R112.signInEmailSyncWrites({ userId: 'U', organizationId: 'O', storedEmail: 'a@x.com', tokenEmail: 'B@x.com', tokenEmailVerified: true }), {
    userFields: { email: 'b@x.com' },
    claimSet: { path: 'organizations/O/userEmails/b@x.com', fields: { userId: 'U' } },
    claimDelete: 'organizations/O/userEmails/a@x.com',
  })
})

test('1.13.0: leaveYearStartMonth is the inverse of leaveYearEndMonth; billingAccessFields for the rules', () => {
  for (let start = 1; start <= 12; start++) assert.equal(R112.leaveYearStartMonth(R112.leaveYearEndMonth(start)), start)
  assert.equal(R112.leaveYearStartMonth(12), 1)
  assert.equal(R112.leaveYearStartMonth(3), 4)
  const now = Date.parse('2026-11-03T12:00:00Z')
  const failed = now - 86_400_000
  assert.deepEqual(R112.billingAccessFields({ status: 'past_due', lastPaymentFailedAt: failed }, now), { accessOpen: true, accessClosesAtMs: failed + 7 * 86_400_000 })
  assert.deepEqual(R112.billingAccessFields({ status: 'canceled' }, now), { accessOpen: false, accessClosesAtMs: null })
  assert.deepEqual(R112.billingAccessFields(null, now), { accessOpen: true, accessClosesAtMs: null })
})

test('1.12.2 accountTypeSyncState: a half-applied user type is found and repaired from the profile', () => {
  const manager = { id: 'T1', organizationId: 'ORG', role: 'manager', manager: true, adminAccess: false }
  // Older iOS builds wrote only users/{uid}: the members entry stayed admin, so the rules still saw an admin.
  const half = r3Levels.accountTypeSyncState({ person: manager, organizationId: 'ORG', members: { t1: 'admin' } })
  assert.deepEqual(half, { inSync: false, level: 'manager', membersRole: 'admin', repair: 'manager' })
  assert.equal(r3Levels.accountTypeSyncState({ person: manager, organizationId: 'ORG', members: { T1: 'manager' } }).inSync, true)
  // `member` is any non-admin level in older data; it only fails the admin test.
  assert.equal(r3Levels.accountTypeSyncState({ person: manager, organizationId: 'ORG', members: { T1: 'member' } }).inSync, true)
  const admin = { id: 'A1', organizationId: 'organizations/ORG', role: 'admin', adminAccess: true }
  assert.equal(r3Levels.accountTypeSyncState({ person: admin, organizationId: 'ORG', members: { A1: 'member' } }).repair, 'admin')
  assert.equal(r3Levels.accountTypeSyncState({ person: admin, organizationId: 'ORG', members: {} }).repair, 'admin')
  // The membership is checked too when it is known.
  assert.equal(
    r3Levels.accountTypeSyncState({ person: manager, organizationId: 'ORG', members: { T1: 'manager' }, membership: { role: 'admin' } }).repair,
    'manager'
  )
  // A profile of another company is never judged here.
  assert.equal(r3Levels.accountTypeSyncState({ person: { ...manager, organizationId: 'OTHER' }, organizationId: 'ORG', members: { T1: 'admin' } }).inSync, true)
})

// MARK: - 1.14.0 line manager picker: one option per person; self-employed needs a pay rate

import {
  lineManagerCandidates as r1140Candidates,
  lineManagerSelectedIds as r1140Selected,
  lineManagerSummary as r1140Summary,
} from './lineManagers.ts'
import { PAY_RATE_REQUIRED_MESSAGE as R1140_PAY_MSG, payRateRequiredError as r1140PayErr, usersMissingPayRate as r1140Missing } from './payRate.ts'
import { accountTypeChangeWrites as r1140TypeWrites } from './permissionLevels.ts'

const r1140Mgr = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  email: 'sam@x.co',
  firstName: 'Sam',
  surname: 'Boss',
  role: 'manager',
  manager: true,
  passwordSet: true,
  isActive: true,
  ...extra,
})

test('1.14.0 lineManagerCandidates: two users documents on one email are one option (same-email ids)', () => {
  const roster = [r1140Mgr('live-uid'), r1140Mgr('old-uid', { email: 'SAM@x.co ' })]
  const candidates = r1140Candidates(null, roster)
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].name, 'Sam Boss')
})

test('1.14.0 lineManagerCandidates: an id in another letter case is one option (members-only anchor)', () => {
  const roster = [r1140Mgr('ABC123'), r1140Mgr('abc123', { email: '' })]
  assert.equal(r1140Candidates(null, roster).length, 1)
})

test('1.14.0 lineManagerCandidates: former invite id and sameEmailUserIds fold onto the live users doc id', () => {
  const live = r1140Mgr('live-uid', { formerUserIds: ['invite-uuid'], sameEmailUserIds: ['old-uid'] })
  const invite = r1140Mgr('invite-uuid', { email: 'other@x.co' })
  const old = r1140Mgr('old-uid', { email: 'sam.old@x.co' })
  const candidates = r1140Candidates(null, [invite, old, live])
  assert.deepEqual(candidates.map((c) => c.id), ['live-uid'])
})

test('1.14.0 lineManagerCandidates: a signed-up active row wins over a pending or inactive duplicate', () => {
  const pending = r1140Mgr('placeholder', { passwordSet: false })
  const inactive = r1140Mgr('stale', { isActive: false })
  const live = r1140Mgr('live')
  assert.deepEqual(r1140Candidates(null, [pending, inactive, live]).map((c) => c.id), ['live'])
  // Only a pending or inactive row left: not listed.
  assert.deepEqual(r1140Candidates(null, [pending, inactive]), [])
})

test('1.14.0 lineManagerCandidates: never the person themself under a duplicate id', () => {
  const roster = [r1140Mgr('live'), r1140Mgr('old'), r1140Mgr('boss', { email: 'boss@x.co', firstName: 'Bo' })]
  assert.deepEqual(r1140Candidates({ id: 'old', email: 'sam@x.co' }, roster).map((c) => c.id), ['boss'])
  assert.deepEqual(r1140Candidates({ id: 'LIVE' }, roster).map((c) => c.id), ['boss'])
})

test('1.14.0 admin → manager → admin → manager: accountTypeChangeWrites updates both same-email docs; picker still lists one', () => {
  const live = r1140Mgr('live', { organizationId: 'org' })
  const old = { ...r1140Mgr('old', { organizationId: 'org' }), role: 'operative', manager: false, operativeMode: true }
  let roster: Array<Record<string, unknown> & { id: string }> = [live, old]
  for (const kind of ['admin', 'manager', 'admin', 'manager'] as const) {
    const result = r1140TypeWrites({ person: roster[0], kind, organizationId: 'org', roster })
    assert.equal(result.ok, true)
    if (!result.ok) return
    roster = roster.map((row) => {
      const write = result.writes.find((w) => w.path === `users/${row.id}` && w.kind === 'userProfile')
      if (!write || !('fields' in write)) return row
      const flat = Object.fromEntries(Object.entries(write.fields as Record<string, unknown>).filter(([key]) => !key.includes('.')))
      return { ...row, ...flat, permissions: { ...(row.permissions as object), ...flat } }
    })
  }
  // Both documents are now manager-level — before 1.14.0 the picker listed Sam twice.
  assert.equal(roster.every((row) => row.role === 'manager'), true)
  assert.equal(r1140Candidates(null, roster as never).length, 1)
})

test('1.14.0 lineManagerSelectedIds / lineManagerSummary: a stored id naming the other duplicate shows as selected', () => {
  const roster = [r1140Mgr('live'), r1140Mgr('old')]
  const candidateId = r1140Candidates(null, roster)[0].id
  assert.deepEqual(r1140Selected({ id: 'op', assignedManagerUserIds: ['old'] }, roster), [candidateId])
  assert.deepEqual(r1140Selected({ id: 'op', assignedManagerUserId: 'OLD' }, roster), [candidateId])
  assert.deepEqual(r1140Selected({ id: 'op', assignedManagerUserIds: ['old', 'live'] }, roster), [candidateId])
  assert.deepEqual(r1140Selected({ id: 'op', assignedManagerUserIds: ['gone'] }, roster), ['gone'])
  assert.deepEqual(r1140Selected({ id: 'op', hasNoLineManager: true, assignedManagerUserIds: ['old'] }, roster), [])
  const summary = r1140Summary({ id: 'op', assignedManagerUserIds: ['old', 'live'] }, roster)
  assert.equal(summary.label, 'Sam Boss')
  assert.equal(summary.moreCount, 0)
})

test('1.14.0 payRateRequiredError: self-employed needs a rate above 0 for the chosen basis; PAYE never', () => {
  assert.equal(r1140PayErr({ employmentType: 'paye' }), null)
  assert.equal(r1140PayErr({ employmentType: 'self_employed', payBasis: 'day', dayRate: 250 }), null)
  assert.equal(r1140PayErr({ employmentType: 'selfEmployed', payBasis: 'hourly', hourlyRate: '18.5' }), null)
  assert.equal(r1140PayErr({ employmentType: 'self_employed', dayRate: 200 }), null)
  for (const bad of [
    { employmentType: 'self_employed', payBasis: 'day' },
    { employmentType: 'self_employed', payBasis: 'day', dayRate: '' },
    { employmentType: 'self_employed', payBasis: 'day', dayRate: 'abc' },
    { employmentType: 'self_employed', payBasis: 'day', dayRate: 0 },
    { employmentType: 'self_employed', payBasis: 'day', dayRate: -5 },
    { employmentType: 'self_employed', payBasis: 'hourly', dayRate: 250 },
    { employmentType: 'self_employed', payBasis: 'day', dayRate: Number.NaN },
    {},
  ]) {
    assert.equal(r1140PayErr(bad), R1140_PAY_MSG, JSON.stringify(bad))
  }
  assert.equal(R1140_PAY_MSG, 'Set a day rate or hourly rate — self-employed people are paid from it.')
})

test('1.14.0 usersMissingPayRate: active self-employed people without a rate, once per person', () => {
  const roster = [
    { id: 'a', employmentType: 'self_employed', payBasis: 'day', dayRate: 200 },
    { id: 'b', employmentType: 'self_employed', payBasis: 'day' },
    { id: 'c', employmentType: 'paye' },
    { id: 'd', employmentType: 'self_employed', isActive: false },
    { id: 'e', email: 'e@x.co', employmentType: 'self_employed' },
    { id: 'e2', email: 'E@x.co', employmentType: 'self_employed', payBasis: 'hourly', hourlyRate: 20 },
    { id: 'f', email: 'f@x.co', employmentType: 'self_employed' },
    { id: 'F2', email: 'F@x.co', employmentType: 'self_employed' },
  ]
  assert.deepEqual(r1140Missing(roster), ['b', 'f'])
})

import { addUserPermissionDefaults as r1140AddDefaults, lockedPermissionFields as r1140Locked, PERMISSION_TOGGLE_CATALOGUE as R1140_CATALOGUE, accountTypePermissions as r1140TypePerms } from './permissionLevels.ts'

test('1.14.0 addUserPermissionDefaults: every toggle the adder can change starts off; locked toggles keep their value', () => {
  for (const level of ['admin', 'manager', 'operative'] as const) {
    const defaults = r1140AddDefaults(level)
    const locked = new Set(r1140Locked({}, level))
    for (const row of R1140_CATALOGUE.filter((entry) => entry.levels.includes(level))) {
      if (locked.has(row.field)) assert.equal(defaults[row.field], true, `${level} ${row.field} locked on`)
      else assert.equal(defaults[row.field], false, `${level} ${row.field} starts off`)
    }
  }
  const admin = r1140AddDefaults('admin')
  assert.equal(admin.annualLeaveSelfBook, false)
  assert.equal(admin.adminAccess, true)
  assert.equal(admin.projects, true)
  const manager = r1140AddDefaults('manager')
  assert.equal(manager.manager, true)
  assert.equal(manager.materials, true)
  assert.equal(manager.siteAudit, true)
  for (const key of ['projects', 'smallWorks', 'weeklyReports', 'dailyOverview', 'subContractors', 'annualLeaveSelfBook', 'operatives', 'qualifications', 'wholesalersOrderHistory'] as const) {
    assert.equal(manager[key], false, key)
  }
  const operative = r1140AddDefaults('operative')
  assert.equal(operative.operativeMode, true)
  assert.equal(operative.materials, false)
  assert.equal(operative.siteAudit, false)
})

test('1.14.0 a user type change keeps saved toggles (not the new-user defaults)', () => {
  const manager = { role: 'manager', manager: true, projects: true, weeklyReports: true, dailyOverview: true }
  const back = r1140TypePerms('manager', { ...manager, role: 'admin', adminAccess: true, annualLeaveSelfBook: true })
  // 1.15.0: every saved toggle is kept, Annual Leave Management included.
  assert.equal(back.annualLeaveSelfBook, true)
  assert.equal(back.adminAccess, false)
  const asManager = r1140TypePerms('manager', manager)
  assert.equal(asManager.projects, true)
  assert.equal(asManager.weeklyReports, true)
  assert.equal(asManager.dailyOverview, true)
  assert.equal(r1140TypePerms('admin', { ...manager, annualLeaveSelfBook: true }).annualLeaveSelfBook, true)
})

// MARK: - 1.15.0 owner decisions round 6

import {
  accountTypeChangeWrites as r1150TypeWrites,
  accountTypePermissions as r1150TypePerms,
  accountTypeWritePermissions as r1150WritePerms,
  effectivePermissions as r1150Effective,
} from './permissionLevels.ts'
import { USER_PERMISSION_FIELDS as R1150_FIELDS } from './userProfile.ts'

function r1150Apply(doc: Record<string, unknown>, plan: ReturnType<typeof r1150TypeWrites>): Record<string, unknown> {
  assert.ok(plan.ok)
  if (!plan.ok) return doc
  const profile = plan.writes.find((write) => write.kind === 'userProfile') as { fields: Record<string, unknown> }
  const next: Record<string, unknown> = { ...doc, permissions: { ...(doc.permissions as Record<string, unknown>) } }
  for (const [key, value] of Object.entries(profile.fields)) {
    if (key.startsWith('permissions.')) (next.permissions as Record<string, unknown>)[key.slice(12)] = value
    else next[key] = value
  }
  return next
}

test('1.15.0 manager → admin → manager returns the exact toggles; an admin still reads all on', () => {
  const toggles = {
    manager: true, operatives: false, qualifications: true, materials: true, projects: false, smallWorks: true,
    siteAudit: true, subContractors: false, wholesalersOrderHistory: false, annualLeaveSelfBook: true,
    weeklyReports: false, dailyOverview: false, skills: false,
  }
  const start = { id: 'm1', email: 'm@x.com', organizationId: 'ORG', role: 'manager', adminAccess: false, operativeMode: false, ...toggles, permissions: { ...toggles, adminAccess: false, operativeMode: false } }
  const asAdmin = r1150Apply(start, r1150TypeWrites({ person: start, kind: 'admin', organizationId: 'ORG' }))
  const adminView = r1150Effective(asAdmin)
  for (const key of R1150_FIELDS) {
    if (key === 'operativeMode') assert.equal(adminView[key], false)
    else if (key === 'annualLeaveSelfBook') assert.equal(adminView[key], true)
    // 1.28.0: Timesheet self-sign is an admin self-manage toggle, never stored here, so it reads off.
    else if (key === 'timesheetSelfSign') assert.equal(adminView[key], false)
    else assert.equal(adminView[key], true, `admin reads ${key} on`)
  }
  // Stored values untouched underneath.
  for (const [key, value] of Object.entries(toggles)) assert.equal(asAdmin[key], value, `stored ${key}`)
  // A Change user type screen showing the admin all on writes only Annual Leave Management.
  const screen = Object.fromEntries(R1150_FIELDS.map((key) => [key, true]))
  const viaScreen = r1150Apply(start, r1150TypeWrites({ person: start, kind: 'admin', organizationId: 'ORG', permissions: { ...screen, annualLeaveSelfBook: false } }))
  assert.equal(viaScreen.projects, false)
  assert.equal(viaScreen.annualLeaveSelfBook, false)
  const back = r1150Apply(asAdmin, r1150TypeWrites({ person: asAdmin, kind: 'manager', organizationId: 'ORG' }))
  assert.equal(back.adminAccess, false)
  assert.equal(back.role, 'manager')
  for (const [key, value] of Object.entries(toggles)) {
    assert.equal(back[key], value, `top-level ${key}`)
    assert.equal((back.permissions as Record<string, unknown>)[key], value, `permissions.${key}`)
  }
  assert.deepEqual(
    Object.fromEntries(Object.keys(toggles).map((key) => [key, r1150Effective(back)[key as keyof typeof toggles]])),
    { ...toggles, materials: true, siteAudit: true, skills: false }
  )
})

test('1.15.0 operative → manager keeps the toggles; the screen sets only what the new level can change', () => {
  const op = { id: 'o1', role: 'operative', operativeMode: true, materials: false, siteAudit: true, projects: false, weeklyReports: true }
  const manager = r1150TypePerms('manager', op)
  assert.equal(manager.operativeMode, false)
  assert.equal(manager.manager, true)
  assert.equal(manager.materials, false) // stored; reads on (locked) for a manager
  assert.equal(manager.weeklyReports, true)
  assert.equal(manager.projects, false)
  assert.equal(r1150Effective({ ...op, ...manager, role: 'manager' }).materials, true)
  const edited = r1150WritePerms('manager', op, { projects: true, adminAccess: true, materials: false })
  assert.equal(edited.projects, true)
  assert.equal(edited.adminAccess, false)
  const back = r1150TypePerms('operative', { ...op, ...manager, role: 'manager' })
  assert.equal(back.operativeMode, true)
  assert.equal(back.manager, false)
  assert.equal(back.weeklyReports, true)
  assert.equal(back.siteAudit, true)
})

import {
  MATERIAL_ORDER_TYPED_RECIPIENTS_MAX as R1150_TYPED_MAX,
  canSendMaterialOrders as r1150CanSend,
  materialOrderRecipientCheck as r1150RecipientCheck,
} from './materialOrderAccess.ts'
import { canViewMaterialOrderHistory as r1150History } from './staffAccess.ts'

test('1.15.0 canSendMaterialOrders: admins, super admins and managers; never an operative', () => {
  const role = (flags: Partial<{ isSuperAdmin: boolean; isAdmin: boolean; isManager: boolean; isOperativeMode: boolean }>) => ({
    isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: false, ...flags,
  })
  assert.equal(r1150CanSend(role({ isSuperAdmin: true, isAdmin: true })), true)
  assert.equal(r1150CanSend(role({ isAdmin: true })), true)
  assert.equal(r1150CanSend(role({ isManager: true })), true)
  assert.equal(r1150CanSend(role({ isOperativeMode: true })), false)
  assert.equal(r1150CanSend(role({ isAdmin: true, isOperativeMode: true })), false)
  assert.equal(r1150CanSend(role({})), false)
  assert.equal(r1150CanSend({ level: 'manager' }), true)
  assert.equal(r1150CanSend({ level: 'operative' }), false)
  assert.equal(r1150CanSend(null), false)
  for (const flags of [{ isManager: true }, { isOperativeMode: true }, { isAdmin: true }]) {
    assert.equal(r1150History(role(flags)), r1150CanSend(role(flags)))
  }
})

test('1.15.0 materialOrderRecipientCheck: saved contacts, the sender copy and at most 3 typed addresses', () => {
  assert.equal(R1150_TYPED_MAX, 3)
  const saved = ['Wendy@Pipes.example']
  const ok = r1150RecipientCheck({ recipients: ['wendy@pipes.example', 'a@x.example', 'B@x.example', 'c@x.example', 'me@x.example', 'a@x.example'], savedContactEmails: saved, senderEmail: 'ME@x.example' })
  assert.deepEqual(ok, { ok: true, saved: ['wendy@pipes.example'], typed: ['a@x.example', 'b@x.example', 'c@x.example'], self: true })
  const four = r1150RecipientCheck({ recipients: ['a@x.example', 'b@x.example', 'c@x.example', 'd@x.example'], savedContactEmails: saved })
  assert.equal(four.ok ? null : four.reason, 'too_many_typed')
  const selfOnly = r1150RecipientCheck({ recipients: ['me@x.example'], savedContactEmails: saved, senderEmail: 'me@x.example' })
  assert.equal(selfOnly.ok ? null : selfOnly.reason, 'none')
  const typedOnly = r1150RecipientCheck({ recipients: ['shop@x.example'], savedContactEmails: [] })
  assert.ok(typedOnly.ok)
  const bad = r1150RecipientCheck({ recipients: ['not an email'], savedContactEmails: [] })
  assert.equal(bad.ok ? null : bad.reason, 'invalid')
})

import * as r1150Del from './organizationDeletion.ts'

test('1.15.0 organizationDeletionState: active, scheduled (locked, due after DELETION_RESTORE_DAYS (30 from 1.27.0)) and erased', () => {
  const at = Date.UTC(2026, 10, 3, 10, 0, 0)
  assert.equal(r1150Del.DELETION_RESTORE_DAYS, 30)
  assert.deepEqual(r1150Del.organizationDeletionState({}, at), { state: 'active' })
  const fields = r1150Del.organizationDeletionWriteFields({ requestedBy: 'SA', requestedAtMs: at })
  assert.equal(fields.deletion.status, 'scheduled')
  assert.equal(fields.deletion.restoreBy, 'super_admin')
  assert.equal(fields.deletion.eraseAfter.getTime() - at, 30 * 24 * 60 * 60 * 1000)
  const org = { id: 'ORG', name: 'Acme', creatorUserId: 'SA', ...fields }
  const state = r1150Del.organizationDeletionState(org, at + 1000)
  assert.equal(state.state, 'scheduled')
  assert.ok(state.state === 'scheduled' && state.locked && !state.due)
  assert.equal(r1150Del.organizationEraseDue(org, at + 29 * 86400000), false)
  assert.equal(r1150Del.organizationEraseDue(org, at + 30 * 86400000), true)
  // Firestore Timestamp-like values read too.
  const stored = { deletion: { status: 'scheduled', requestedAt: { seconds: at / 1000, nanoseconds: 0 }, requestedBy: 'SA' } }
  assert.equal(r1150Del.parseOrganizationDeletion(stored)?.eraseAfterMs, at + 30 * 86400000)
  assert.equal(r1150Del.organizationDeletionState({ deletion: { status: 'erased' } }).state, 'erased')
  assert.equal(
    r1150Del.organizationDeletedMessage(at + 30 * 86400000, 'Europe/London'),
    'This organisation has been deleted and will be erased on 3 December 2026.'
  )
})

test('1.15.0 restore: the super admin when restoreBy is super_admin; the platform owner always', () => {
  const at = Date.UTC(2026, 10, 3)
  const org = { id: 'ORG', creatorUserId: 'SA', ...r1150Del.organizationDeletionWriteFields({ requestedBy: 'SA', requestedAtMs: at }) }
  assert.equal(r1150Del.canRestoreOrganization({ org, viewer: { id: 'SA' }, now: at }), true)
  assert.equal(r1150Del.canRestoreOrganization({ org, viewer: { id: 'ADMIN' }, now: at }), false)
  assert.equal(r1150Del.canRestoreOrganization({ org, viewer: { id: 'SA2', isSuperAdmin: true, organizationId: 'ORG' }, now: at }), true)
  const owner = { id: 'ORG', creatorUserId: 'SA', ...r1150Del.organizationDeletionWriteFields({ requestedBy: 'SA', requestedAtMs: at, restoreBy: 'platform_owner' }) }
  assert.equal(r1150Del.canRestoreOrganization({ org: owner, viewer: { id: 'SA' }, now: at }), false)
  assert.equal(r1150Del.canRestoreOrganization({ org: owner, viewerIsPlatformOwner: true, now: at }), true)
  assert.equal(r1150Del.canRestoreOrganization({ org: { id: 'ORG' }, viewerIsPlatformOwner: true }), false)
})

test('1.15.0 organizationDeleteConfirmationError: company name and DELETE', () => {
  const base = { organizationName: 'Acme Builders' }
  assert.equal(r1150Del.organizationDeleteConfirmationError({ ...base, typedName: ' acme builders ', typedConfirmation: 'DELETE' }), null)
  assert.match(r1150Del.organizationDeleteConfirmationError({ ...base, typedName: 'Acme', typedConfirmation: 'DELETE' }) || '', /company name/)
  assert.match(r1150Del.organizationDeleteConfirmationError({ ...base, typedName: 'Acme Builders', typedConfirmation: 'delete' }) || '', /DELETE/)
})

test('1.15.0 accountDeletionPath: handover, delete with company, delete', () => {
  const org = { id: 'ORG', creatorUserId: 'SA' }
  const sa = { id: 'SA', email: 'sa@x.com', isActive: true, passwordSet: true, firstName: 'Sa' }
  const member = { id: 'M', email: 'm@x.com', isActive: true, passwordSet: true, firstName: 'Mo' }
  const pending = { id: 'P', email: 'p@x.com', isActive: true, passwordSet: false, firstName: 'Pat' }
  const inactive = { id: 'I', email: 'i@x.com', isActive: false, passwordSet: true, firstName: 'Ina' }
  const sameEmail = { id: 'SA-OLD', email: 'SA@x.com', isActive: true, passwordSet: true, firstName: 'Sa' }
  assert.equal(r1150Del.accountDeletionPath(sa, [sa, member], org), 'handover_required')
  assert.equal(r1150Del.accountDeletionPath(sa, [sa, pending, inactive, sameEmail], org), 'delete_with_company')
  assert.equal(r1150Del.accountDeletionPath(member, [sa, member], org), 'delete')
  assert.equal(r1150Del.accountDeletionPath({ id: 'S2', isSuperAdmin: true, organizationId: 'ORG' }, [sa], org), 'handover_required')
  const scheduled = { ...org, ...r1150Del.organizationDeletionWriteFields({ requestedBy: 'SA', requestedAtMs: Date.now() }) }
  assert.equal(r1150Del.accountDeletionPath(sa, [sa, member], scheduled), 'delete')
  assert.deepEqual(Object.keys(r1150Del.erasedOrganizationAuditFields({ name: 'Acme', members: { SA: 'admin' } }, 0)), ['erasedAt', 'name'])
})

// MARK: - 1.16.0 notification centre reliability + annual leave when booking

test('1.16.0: notificationRecipientAccountId resolves any person id to one signed-in account', () => {
  const roster = [
    { id: 'Placeholder-1', email: 'op@example.com', role: role130({ isOperativeMode: true }), passwordSet: false },
    { id: 'ACCOUNT-1', email: 'OP@example.com', role: role130({ isOperativeMode: true }), passwordSet: true, formerUserIds: ['placeholder-1'] },
    { id: 'LM', email: 'lm@example.com', role: role130({ isManager: true }) },
    { id: 'GONE', email: 'gone@example.com', role: role130({ isManager: true }), isActive: false },
  ]
  const catalogue = [{ id: 'op-row-7', email: 'Op@Example.com' }, { id: 'linked-row', userId: 'lm' }]
  assert.equal(rulebook.notificationRecipientAccountId('account-1', roster), 'ACCOUNT-1')
  assert.equal(rulebook.notificationRecipientAccountId('PLACEHOLDER-1', roster), 'ACCOUNT-1')
  assert.equal(rulebook.notificationRecipientAccountId('op-row-7', roster, catalogue), 'ACCOUNT-1')
  assert.equal(rulebook.notificationRecipientAccountId('linked-row', roster, catalogue), 'LM')
  assert.equal(rulebook.notificationRecipientAccountId('GONE', roster), null)
  assert.equal(rulebook.notificationRecipientAccountId('stranger', roster), null)
  assert.equal(rulebook.notificationRecipientAccountId('ACCOUNT-1', []), null)
  // One row per person, never the booker, catalogue ids resolved.
  assert.deepEqual(rulebook.bookingCreatedRecipients(['op-row-7', 'placeholder-1', 'ACCOUNT-1', 'LM'], 'lm', roster, catalogue), ['ACCOUNT-1'])
  assert.deepEqual(rulebook.bookingCreatedRecipients(['op-row-7'], 'ACCOUNT-1', roster, catalogue), [])
  // Without a roster ids pass through (de-duplicated without case).
  assert.deepEqual(rulebook.excludeActor(['A', 'a'], null), ['A'])
})

test('1.16.0: due-now rows use server time; only scheduled types hide until createdAt', () => {
  const now = Date.parse('2026-11-03T12:00:00Z')
  const row = (type: string, offsetMs: number) => ({ userId: 'U', type, createdAt: new Date(now + offsetMs) })
  assert.equal(rulebook.inboxNotificationVisibleToUser(row('booking_created', 60_000), 'U', now), true)
  assert.equal(rulebook.inboxNotificationVisibleToUser(row('booking_created', 6 * 60_000), 'U', now), false)
  assert.equal(rulebook.inboxNotificationVisibleToUser(row('deadline_reminder', 60_000), 'U', now), false)
  assert.equal(rulebook.inboxNotificationVisibleToUser(row('timesheet_submission_reminder', -1), 'U', now), true)
  assert.equal(rulebook.unreadNotificationBadgeCount([row('variation', 60_000), row('deadline_due', 60_000)], 'U', now), 1)
  const sentinel = { server: true }
  const base = { organizationId: 'O', title: 't', message: 'm', userId: 'U', createdAt: new Date(now), serverTimestamp: sentinel }
  assert.equal(rulebook.notificationCreateFields({ ...base, type: 'booking_created' })!.set.createdAt, sentinel)
  const due = new Date(now + 86_400_000)
  assert.equal(rulebook.notificationCreateFields({ ...base, type: 'deadline_reminder', createdAt: due })!.set.createdAt, due)
  // Without a sentinel the given instant is kept (older callers).
  assert.equal(rulebook.notificationCreateFields({ ...base, serverTimestamp: undefined, type: 'variation' })!.set.createdAt, base.createdAt)
})

test('1.16.0: a push token belongs to one account; the shared push payload', () => {
  assert.deepEqual(rulebook.addedPushTokens(['a'], ['a', 'b', ' b ']), ['b'])
  assert.deepEqual(
    rulebook.pushTokenOwnerWrites('b', 'ME', [{ id: 'ME', pushTokens: ['b'] }, { id: 'OTHER', pushTokens: ['b', 'c'] }, { id: 'X', pushTokens: ['c'] }]),
    [{ userId: 'OTHER', remove: ['b'] }]
  )
  const plan = rulebook.pushTokenDedupePlan([
    { id: 'OLD', pushTokens: ['t1', 't2'], pushTokenUpdatedAt: new Date('2026-01-01') },
    { id: 'NEW', pushTokens: ['t1'], pushTokenUpdatedAt: { seconds: Date.parse('2026-06-01') / 1000 } },
  ])
  assert.deepEqual(plan, [{ userId: 'OLD', remove: ['t1'], keptOn: { t1: 'NEW' } }])
  assert.deepEqual(rulebook.pushTokensExcludingActor(['t1', 't2'], ['t2']), ['t1'])
  assert.deepEqual(
    rulebook.pushPayloadFields({ notificationId: 'N', type: 'booking_created', relatedId: 'J', dayKey: '2026-11-03', catalogue: 'smallWorks', userId: 'U', organizationId: 'O' }),
    { notificationId: 'N', type: 'booking_created', relatedId: 'J', dayKey: '2026-11-03', catalogue: 'smallWorks', userId: 'U', organizationId: 'O' }
  )
  assert.deepEqual(rulebook.pushPayloadFields({ id: 'N', type: 'push_test', dayKey: 'bad', catalogue: 'x' }), { notificationId: 'N', type: 'push_test' })
  assert.equal(rulebook.notificationOrganizationSwitch({ rowOrganizationId: 'B', openOrganizationId: 'A', membershipIds: ['A', 'b'] }), 'B')
  assert.equal(rulebook.notificationOrganizationSwitch({ rowOrganizationId: 'C', openOrganizationId: 'A', membershipIds: ['A'] }), null)
  assert.equal(rulebook.notificationOrganizationSwitch({ rowOrganizationId: 'a', openOrganizationId: 'A', membershipIds: ['A'] }), null)
})

test('1.16.0: bookingLeaveConflicts lists annual leave on the days being booked', () => {
  const day = { standardDayStart: '08:00', standardDayEnd: '16:00', breakWindowStart: '12:00', breakWindowEnd: '12:30' }
  const holidays = [
    { id: 'H1', userId: 'ACCOUNT', startDayKey: '2026-11-02', endDayKey: '2026-11-04', timeSlot: 'FULL DAY', status: 'approved' },
    { id: 'H2', operativeId: 'op-row', startDayKey: '2026-11-05', endDayKey: '2026-11-05', timeSlot: 'AM', status: 'approved' },
    { id: 'H3', userId: 'account', startDayKey: '2026-11-06', endDayKey: '2026-11-06', timeSlot: 'PM', status: 'pending' },
    { id: 'H4', userId: 'ACCOUNT', startDayKey: '2026-11-09', endDayKey: '2026-11-09', timeSlot: 'FULL DAY', status: 'rejected' },
  ]
  const people = [{ id: 'OP-ROW', userId: 'Account' }]
  const days = ['2026-11-03', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10']
  const full = rulebook.bookingLeaveConflicts({ people, dayKeys: days, holidays, timeSlot: 'FULL DAY', day })
  assert.deepEqual(full.map((row) => [row.dayKey, row.leaveSlot, row.status, row.personId]), [
    ['2026-11-03', 'FULL DAY', 'approved', 'OP-ROW'],
    ['2026-11-05', 'AM', 'approved', 'OP-ROW'],
    ['2026-11-06', 'PM', 'pending', 'OP-ROW'],
  ])
  assert.equal(full[0].label, rulebook.ANNUAL_LEAVE_BOOKED_LABEL)
  assert.equal(full[0].label, 'Annual leave booked')
  assert.equal(full[2].label, rulebook.ANNUAL_LEAVE_REQUESTED_LABEL)
  // AM leave vs a PM booking: no conflict; PM leave vs an AM booking: none either.
  const pm = rulebook.bookingLeaveConflicts({ people, dayKeys: ['2026-11-05'], holidays, timeSlot: 'PM', day })
  assert.deepEqual(pm, [])
  const am = rulebook.bookingLeaveConflicts({ people, dayKeys: ['2026-11-06'], holidays, timeSlot: 'AM', day })
  assert.deepEqual(am, [])
  // Custom hours overlapping the AM half conflict with AM leave; afternoon hours do not.
  const customAm = rulebook.bookingLeaveConflicts({ people, dayKeys: ['2026-11-05'], holidays, timeSlot: 'CUSTOM', workStartTime: '11:00', workEndTime: '14:00', day })
  assert.equal(customAm.length, 1)
  const customPm = rulebook.bookingLeaveConflicts({ people, dayKeys: ['2026-11-05'], holidays, timeSlot: 'CUSTOM', workStartTime: '13:00', workEndTime: '15:00', day })
  assert.deepEqual(customPm, [])
  // Same person by roster email; a stranger never matches.
  const roster = [{ id: 'ACCOUNT', email: 'p@example.com' }, { id: 'DUP', email: 'P@example.com' }]
  assert.equal(rulebook.bookingLeaveConflicts({ people: ['dup'], dayKeys: ['2026-11-03'], holidays, roster }).length, 1)
  assert.deepEqual(rulebook.bookingLeaveConflicts({ people: ['NOBODY'], dayKeys: ['2026-11-03'], holidays, roster }), [])
})

test('1.16.1: a blank H&S file link never overwrites a stored one; copies keep the one with a link', () => {
  const stored = {
    ramsDocuments: [{ id: 'R1', title: 'RAMS', fileURL: 'https://files/r1.pdf', fileName: 'r1.pdf' }],
    otherDocuments: [{ id: 'D1', title: 'Doc', fileURL: 'https://files/d1.pdf', fileName: 'd1.pdf' }],
  }
  const write = rulebook.healthSafetyDocumentWriteFields(stored, {
    ramsDocuments: [{ id: 'r1', title: 'RAMS v2', fileURL: '', fileName: null }],
    otherDocuments: [{ id: 'D1', title: 'Doc', fileURL: 'https://files/d1-new.pdf', fileName: 'd1-new.pdf' }],
  })
  const rams = write.set.ramsDocuments as Array<Record<string, unknown>>
  assert.equal(rams[0].fileURL, 'https://files/r1.pdf')
  assert.equal(rams[0].fileName, 'r1.pdf')
  assert.equal(rams[0].title, 'RAMS v2')
  // A real replacement is written.
  assert.equal((write.set.otherDocuments as Array<Record<string, unknown>>)[0].fileURL, 'https://files/d1-new.pdf')
  assert.deepEqual([...rulebook.HEALTH_SAFETY_FILE_FIELDS], ['fileURL', 'fileName'])
  const merged = rulebook.mergeHealthSafetyRowCopies(
    [{ id: 'R1', fileURL: '' }, { id: 'R2', fileURL: 'a' }],
    [{ id: 'r1', fileURL: 'https://files/r1.pdf', fileName: 'r1.pdf' }, { id: 'R2', fileURL: 'b' }, { id: 'R3' }]
  )
  assert.deepEqual(merged, [
    { id: 'r1', fileURL: 'https://files/r1.pdf', fileName: 'r1.pdf' },
    { id: 'R2', fileURL: 'a' },
    { id: 'R3' },
  ])
})

test('1.17.0: weekendBookingNotes — one Saturday/Sunday line when the rules match, else Saturday then Sunday', () => {
  const SAT = '2026-11-07'
  const SUN = '2026-11-08'
  const WED = '2026-11-04'
  const windowRule = { allHoursAtMultiplierMode: false, allHoursMultiplier: 2, definedWindowStart: '07:30', definedWindowEnd: '13:00', countsAsStandardHours: 8, outsideWindowMultiplier: 2 }
  const same = { ...parsePolicy112(undefined), saturday: windowRule, sunday: { ...windowRule, sameAsSaturday: true } }
  assert.deepEqual(R112.weekendBookingNotes(same, [SUN, SAT], 'Europe/London'), [
    'Saturday/Sunday is paid on the hours you enter: 07:30–13:00 counts as 8h, hours outside it at 2×. Change it in Working hours.',
  ])
  // Same rule written out on both days (not "same as Saturday") also gives one line.
  const sameExplicit = { ...same, sunday: { ...windowRule, sameAsSaturday: false } }
  assert.equal(R112.weekendBookingNotes(sameExplicit, [SAT, SUN]).length, 1)
  // Both every hour at the same rate: one line.
  const allHours = { allHoursAtMultiplierMode: true, allHoursMultiplier: 2, sameAsSaturday: false }
  assert.deepEqual(R112.weekendBookingNotes({ ...same, saturday: allHours, sunday: allHours }, [SAT, SUN]), [
    'Saturday/Sunday is paid on the hours you enter, every hour at 2×. Change it in Working hours.',
  ])
  // Different rules: Saturday's line, then Sunday's, whatever the selection order.
  const different = { ...same, sunday: allHours }
  assert.deepEqual(R112.weekendBookingNotes(different, [SUN, SAT]), [
    R112.weekendBookingNote(different, SAT),
    R112.weekendBookingNote(different, SUN),
  ])
  // Same window but a different rate outside it is a different rule.
  assert.equal(R112.weekendBookingNotes({ ...same, sunday: { ...windowRule, outsideWindowMultiplier: 1.5, sameAsSaturday: false } }, [SAT, SUN]).length, 2)
  // One weekend day: exactly today's line; two Saturdays still one line.
  assert.deepEqual(R112.weekendBookingNotes(different, [SAT]), [R112.weekendBookingNote(different, SAT)])
  assert.deepEqual(R112.weekendBookingNotes(different, [SUN]), [R112.weekendBookingNote(different, SUN)])
  assert.deepEqual(R112.weekendBookingNotes(different, [SAT, '2026-11-14']), [R112.weekendBookingNote(different, SAT)])
  // Weekdays only, nothing, or no policy: no line.
  assert.deepEqual(R112.weekendBookingNotes(different, [WED]), [])
  assert.deepEqual(R112.weekendBookingNotes(different, []), [])
  assert.deepEqual(R112.weekendBookingNotes(null, [SAT, SUN]), [])
  // Each booked day keeps its own prefill (no shared midpoint).
  assert.deepEqual(R112.weekendCustomHoursDefault(different, SAT), { start: '07:30', end: '13:00' })
  assert.equal(R112.weekendCustomHoursDefault(different, SUN), null)
})

test('1.17.0: working-hours schedule robustness — weekend start, DST, replace, partial writes, stored shapes', () => {
  const zone = 'Europe/London'
  const windowRule = { allHoursAtMultiplierMode: false, allHoursMultiplier: 2, definedWindowStart: '08:00', definedWindowEnd: '12:00', countsAsStandardHours: 4, outsideWindowMultiplier: 1.5, sameAsSaturday: false }
  const allHours = { allHoursAtMultiplierMode: true, allHoursMultiplier: 2, sameAsSaturday: false }
  const oldRaw = { standardDayStart: '07:30', saturday: allHours, sunday: allHours }
  const newRaw = { standardDayStart: '08:00', saturday: windowRule, sunday: { ...windowRule, sameAsSaturday: true } }
  // A change scheduled to start on a Saturday: Friday keeps the old rules, Saturday and Sunday take the new ones.
  const doc = { countryCode: 'GB', payrollTimePolicy: oldRaw, payrollTimePolicyScheduled: { policy: newRaw, effectiveFrom: '2026-11-07' } }
  assert.equal(R112.effectivePayrollTimePolicy(doc, '2026-11-06', zone).standardDayStart, '07:30')
  assert.equal(R112.effectivePayrollTimePolicy(doc, '2026-11-07', zone).standardDayStart, '08:00')
  assert.equal(R112.effectivePayrollTimePolicy(doc, '2026-11-07', zone).saturday.allHoursAtMultiplierMode, false)
  // The weekend note follows the policy in effect on each day when given the state.
  const state = R112.parsePayrollTimePolicyState(doc, zone)
  assert.deepEqual(R112.weekendBookingNotes(state, ['2026-11-07', '2026-11-08'], zone), [
    'Saturday/Sunday is paid on the hours you enter: 08:00–12:00 counts as 4h, hours outside it at 1.5×. Change it in Working hours.',
  ])
  assert.deepEqual(R112.weekendBookingNotes(state, ['2026-10-31', '2026-11-01'], zone), [
    'Saturday/Sunday is paid on the hours you enter, every hour at 2×. Change it in Working hours.',
  ])
  // Sunday before the change and Saturday after it: different rules, so two lines (Saturday first).
  assert.deepEqual(R112.weekendBookingNotes(state, ['2026-11-01', '2026-11-07'], zone), [
    'Saturday is paid on the hours you enter: 08:00–12:00 counts as 4h, hours outside it at 1.5×. Change it in Working hours.',
    'Sunday is paid on the hours you enter, every hour at 2×. Change it in Working hours.',
  ])
  assert.equal(R112.weekendCustomHoursDefault(R112.effectivePayrollTimePolicy(doc, '2026-11-07', zone), '2026-11-07', zone)?.start, '08:00')
  assert.equal(R112.weekendCustomHoursDefault(R112.effectivePayrollTimePolicy(doc, '2026-10-31', zone), '2026-10-31', zone), null)

  // DST: the promoted prior is the rules of the calendar day before, across the October and March clock changes.
  for (const [effectiveFrom, todayKey] of [['2026-10-26', '2026-10-27'], ['2026-10-25', '2026-10-25'], ['2026-03-30', '2026-03-31'], ['2026-03-29', '2026-03-29']]) {
    const dueDoc = {
      payrollTimePolicy: { standardDayStart: '07:00' },
      payrollTimePolicyPrior: { standardDayStart: '06:00' },
      payrollTimePolicyEffectiveFrom: '2026-01-01',
      payrollTimePolicyScheduled: { policy: { standardDayStart: '09:00' }, effectiveFrom },
    }
    const timeline = R112.payrollTimePolicyTimeline(dueDoc, todayKey, zone)
    assert.equal(timeline.current.standardDayStart, '09:00', effectiveFrom)
    assert.equal(timeline.prior?.standardDayStart, '07:00', effectiveFrom)
    assert.equal(timeline.effectiveFrom, effectiveFrom)
    const promoted = R112.payrollTimePolicyTimeline(dueDoc, todayKey, zone)
    const dayBefore = zoneDayKey112(new Date(zoneMidnight112(effectiveFrom, zone).getTime() - 12 * 3600 * 1000), zone)
    assert.equal(R112.effectivePayrollTimePolicy(promoted, dayBefore, zone).standardDayStart, '07:00', dayBefore)
    assert.equal(R112.effectivePayrollTimePolicy(promoted, effectiveFrom, zone).standardDayStart, '09:00')
  }
  // Apply from today on the Monday after the October change: yesterday (the 25-hour Sunday) is the prior.
  const applyAfterDst = R112.payrollTimePolicyApplyNowWriteFields({
    orgDoc: { payrollTimePolicy: { standardDayStart: '07:00' }, payrollTimePolicyPrior: { standardDayStart: '06:00' }, payrollTimePolicyEffectiveFrom: '2026-10-26' },
    policy: { ...parsePolicy112(undefined), standardDayStart: '05:00' },
    todayKey: '2026-10-26',
    timeZone: zone,
  })
  assert.equal((applyAfterDst.payrollTimePolicyPrior as Record<string, unknown>).standardDayStart, '06:00')
  // Stored as a Timestamp (older builds): organisation-zone midnight either side of a clock change reads as that day.
  const ts = (iso: string) => ({ seconds: Date.parse(iso) / 1000 })
  assert.equal(R112.payrollDayKeyFromValue(ts('2026-10-24T23:00:00Z'), zone), '2026-10-25') // BST midnight
  assert.equal(R112.payrollDayKeyFromValue(ts('2026-10-26T00:00:00Z'), zone), '2026-10-26') // GMT midnight
  assert.equal(R112.payrollDayKeyFromValue(ts('2026-03-29T00:00:00Z'), zone), '2026-03-29') // GMT midnight
  assert.equal(R112.payrollDayKeyFromValue(ts('2026-03-29T23:00:00Z'), zone), '2026-03-30') // BST midnight
  assert.equal(R112.payrollDayKeyFromValue({ _seconds: Date.parse('2026-10-24T23:00:00Z') / 1000 }, zone), '2026-10-25')
  const tsScheduled = R112.parsePayrollTimePolicyScheduled({ policy: { standardDayStart: '09:00' }, effectiveFrom: ts('2026-03-29T23:00:00Z') }, zone)
  assert.equal(tsScheduled?.effectiveFrom, '2026-03-30')
  // A scheduled map without a policy, or without a usable day, is no schedule.
  assert.equal(R112.parsePayrollTimePolicyScheduled({ effectiveFrom: '2026-12-01' }, zone), null)
  assert.equal(R112.parsePayrollTimePolicyScheduled({ policy: {}, effectiveFrom: 'soon' }, zone), null)

  // Schedule, then schedule again before it is due: the second replaces the first and today's rules are untouched.
  const pendingDoc = { payrollTimePolicy: oldRaw, payrollTimePolicyScheduled: { policy: newRaw, effectiveFrom: '2026-12-01' } }
  const second = R112.payrollTimePolicyScheduleWriteFields({
    orgDoc: pendingDoc,
    policy: { ...parsePolicy112(undefined), standardDayStart: '06:30' },
    effectiveFrom: '2027-01-04',
    todayKey: '2026-11-03',
    timeZone: zone,
  })!
  // 1.19.0: plus the (seeded) history and the revision bump — never today's rules.
  assert.deepEqual(Object.keys(second), ['payrollTimePolicyScheduled', 'payrollTimePolicyHistory', 'payrollTimePolicyRevision'])
  assert.equal((second.payrollTimePolicyScheduled as Record<string, unknown>).effectiveFrom, '2027-01-04')
  // Apply from today while a change is pending keeps it (never writes payrollTimePolicyScheduled).
  const apply = R112.payrollTimePolicyApplyNowWriteFields({ orgDoc: pendingDoc, policy: parsePolicy112(undefined), todayKey: '2026-11-03', timeZone: zone })
  assert.equal('payrollTimePolicyScheduled' in apply, false)
  // Cancel with nothing due clears only the pending change.
  const cancelled = R112.payrollTimePolicyCancelScheduleWriteFields({ orgDoc: pendingDoc, todayKey: '2026-11-03', timeZone: zone })
  assert.equal(cancelled.payrollTimePolicyScheduled, null)
  assert.equal('payrollTimePolicy' in cancelled, false)
  // Every write is a partial update of the working-hours fields only (1.19.0: with history and revision), so another
  // settings save is never overwritten.
  const payrollFields = new Set([
    'payrollTimePolicy',
    'payrollTimePolicyPrior',
    'payrollTimePolicyEffectiveFrom',
    'payrollTimePolicyScheduled',
    'payrollTimePolicyHistory',
    'payrollTimePolicyRevision',
  ])
  const dueDoc = { ...pendingDoc, payrollTimePolicyScheduled: { policy: newRaw, effectiveFrom: '2026-11-01' } }
  for (const fields of [
    second,
    apply,
    R112.payrollTimePolicyCancelScheduleWriteFields({ orgDoc: dueDoc, todayKey: '2026-11-03', timeZone: zone }),
    R112.payrollTimePolicyScheduleWriteFields({ orgDoc: dueDoc, policy: parsePolicy112(undefined), effectiveFrom: '2026-12-01', todayKey: '2026-11-03', timeZone: zone })!,
    R112.payrollTimePolicyApplyNowWriteFields({ orgDoc: dueDoc, policy: parsePolicy112(undefined), todayKey: '2026-11-03', timeZone: zone }),
  ]) {
    for (const key of Object.keys(fields)) assert.ok(payrollFields.has(key), key)
  }
  // Day keys are written as 'YYYY-MM-DD' text, the shape iOS writes and reads.
  const cancelDue = R112.payrollTimePolicyCancelScheduleWriteFields({ orgDoc: dueDoc, todayKey: '2026-11-03', timeZone: zone })
  assert.equal(cancelDue.payrollTimePolicyEffectiveFrom, '2026-11-01')
  assert.equal(cancelDue.payrollTimePolicyScheduled, null)
  assert.equal((cancelDue.payrollTimePolicy as Record<string, unknown>).standardDayStart, '08:00')
})

test('1.17.0: push tokens never stay on a placeholder users document; signed-in accounts compare pushTokenUpdatedAt', () => {
  const PLACEHOLDER = '463952DE-0375-435D-8AB3-67570C902C56'
  const A = '8Qnz190EABWbS0t5Oaj0TZaOyfO2'
  const B = 'Zk3pQ9aLmN0bVc7XyT2rS5uW1eF4'
  const C = 'Hj6gR2tY8uI0oP4aS1dF3gH5jK7l'
  assert.equal(rulebook.isPushTokenPlaceholderUserId(PLACEHOLDER), true)
  assert.equal(rulebook.isPushTokenPlaceholderUserId(PLACEHOLDER.toLowerCase()), true)
  assert.equal(rulebook.isPushTokenPlaceholderUserId(A), false)
  // The owner's dry run: the placeholder's updatedAt is the newest, yet it loses every token and the real accounts
  // keep theirs (each token decided among the signed-in accounts only).
  const plan = rulebook.pushTokenDedupePlan([
    { id: PLACEHOLDER, pushTokens: ['tA', 'tB', 'tC'], updatedAt: new Date('2026-11-02') },
    { id: A, pushTokens: ['tA'], pushTokenUpdatedAt: new Date('2026-06-01'), updatedAt: new Date('2026-06-01') },
    { id: B, pushTokens: ['tB'], pushTokenUpdatedAt: new Date('2026-07-01') },
    { id: C, pushTokens: ['tC'], updatedAt: new Date('2026-05-01') },
  ])
  assert.deepEqual(plan, [{ userId: PLACEHOLDER, remove: ['tA', 'tB', 'tC'], keptOn: { tA: A, tB: B, tC: C } }])
  // Among signed-in accounts, pushTokenUpdatedAt decides; a newer updatedAt without it never wins.
  const shared = rulebook.pushTokenDedupePlan([
    { id: A, pushTokens: ['t'], pushTokenUpdatedAt: new Date('2026-06-01'), updatedAt: new Date('2026-06-01') },
    { id: B, pushTokens: ['t'], updatedAt: new Date('2026-11-01') },
  ])
  assert.deepEqual(shared, [{ userId: B, remove: ['t'], keptOn: { t: A } }])
  // No candidate has pushTokenUpdatedAt: updatedAt decides.
  const legacy = rulebook.pushTokenDedupePlan([
    { id: A, pushTokens: ['t'], updatedAt: new Date('2026-06-01') },
    { id: B, pushTokens: ['t'], updatedAt: new Date('2026-11-01') },
  ])
  assert.deepEqual(legacy, [{ userId: A, remove: ['t'], keptOn: { t: B } }])
  // Only on placeholders (even one): removed everywhere.
  const orphan = rulebook.pushTokenDedupePlan([
    { id: PLACEHOLDER, pushTokens: ['t'], pushTokenUpdatedAt: new Date('2026-11-02') },
    { id: '11111111-2222-3333-4444-555555555555', pushTokens: ['t', 'u'] },
  ])
  assert.deepEqual(orphan, [
    { userId: PLACEHOLDER, remove: ['t'], keptOn: { t: null } },
    { userId: '11111111-2222-3333-4444-555555555555', remove: ['t', 'u'], keptOn: { t: null, u: null } },
  ])
  // Idempotent once applied: a single signed-in holder keeps its token.
  assert.deepEqual(rulebook.pushTokenDedupePlan([{ id: A, pushTokens: ['tA'] }]), [])
  // Single-owner sweep: a placeholder write never takes the token from real accounts; it loses it itself.
  assert.deepEqual(
    rulebook.pushTokenOwnerWrites('t', PLACEHOLDER, [{ id: PLACEHOLDER, pushTokens: ['t'] }, { id: A, pushTokens: ['t'] }]),
    [{ userId: PLACEHOLDER, remove: ['t'] }]
  )
  // A signed-in registration removes it from the placeholder and other accounts.
  assert.deepEqual(
    rulebook.pushTokenOwnerWrites('t', A, [{ id: PLACEHOLDER, pushTokens: ['t'] }, { id: A, pushTokens: ['t'] }, { id: B, pushTokens: ['t'] }]),
    [{ userId: PLACEHOLDER, remove: ['t'] }, { userId: B, remove: ['t'] }]
  )
})

test('1.18.0: customHoursPrefillForDays — the custom-hours pair follows the selection kind (weekday ↔ weekend)', () => {
  const zone = 'Europe/London'
  const SAT = '2026-11-07'
  const SUN = '2026-11-08'
  const MON = '2026-11-09'
  const TUE = '2026-11-10'
  const satRule = { allHoursAtMultiplierMode: false, allHoursMultiplier: 2, definedWindowStart: '07:30', definedWindowEnd: '13:00', countsAsStandardHours: 8, outsideWindowMultiplier: 2, sameAsSaturday: false }
  const sunRule = { ...satRule, definedWindowStart: '09:00', definedWindowEnd: '12:00' }
  const policy = { ...parsePolicy112(undefined), standardDayStart: '08:00', standardDayEnd: '17:00', saturday: satRule, sunday: sunRule }
  // Weekend only: Saturday's window.
  assert.deepEqual(R112.customHoursPrefillForDays(policy, [SAT], zone), { start: '07:30', end: '13:00', kind: 'weekend' })
  // Weekend → weekday: the person unticks Saturday and picks Monday — the standard day, not the weekend times.
  assert.deepEqual(R112.customHoursPrefillForDays(policy, [MON], zone), { start: '08:00', end: '17:00', kind: 'weekday' })
  assert.deepEqual(R112.customHoursPrefillForDays(policy, [TUE, MON], zone), { start: '08:00', end: '17:00', kind: 'weekday' })
  // Weekday → weekend: Sunday alone takes Sunday's own window.
  assert.deepEqual(R112.customHoursPrefillForDays(policy, [SUN], zone), { start: '09:00', end: '12:00', kind: 'weekend' })
  // Both weekend days with different defaults: Saturday's, whatever the order.
  assert.deepEqual(R112.customHoursPrefillForDays(policy, [SUN, SAT], zone), { start: '07:30', end: '13:00', kind: 'weekend' })
  // Saturday every hour at 2× and Sunday on a window: Sunday's window (the first weekend day with a set window).
  const allHours = { allHoursAtMultiplierMode: true, allHoursMultiplier: 2, sameAsSaturday: false }
  assert.deepEqual(R112.customHoursPrefillForDays({ ...policy, saturday: allHours }, [SAT, SUN], zone), { start: '09:00', end: '12:00', kind: 'weekend' })
  // Neither day has a window: the editor's usual times (the standard day), still kind weekend.
  assert.deepEqual(R112.customHoursPrefillForDays({ ...policy, saturday: allHours, sunday: allHours }, [SAT, SUN], zone), { start: '08:00', end: '17:00', kind: 'weekend' })
  // A mixed selection is refused by every picker: kind none.
  assert.equal(R112.customHoursPrefillForDays(policy, [SAT, MON], zone)?.kind, 'none')
  // Empty, invalid or missing: null.
  assert.equal(R112.customHoursPrefillForDays(policy, [], zone), null)
  assert.equal(R112.customHoursPrefillForDays(policy, null, zone), null)
  assert.equal(R112.customHoursPrefillForDays(policy, ['not-a-day'], zone), null)
  // No policy: the canonical standard day.
  assert.deepEqual(R112.customHoursPrefillForDays(null, [MON], zone), { start: '07:30', end: '16:00', kind: 'weekday' })
  // Scheduled change on the day: given the state, each day reads the rules in effect on it.
  const doc = {
    countryCode: 'GB',
    payrollTimePolicy: { standardDayStart: '07:30', standardDayEnd: '16:00', saturday: allHours, sunday: allHours },
    payrollTimePolicyScheduled: { policy: { standardDayStart: '08:00', standardDayEnd: '16:30', saturday: satRule, sunday: { ...satRule, sameAsSaturday: true } }, effectiveFrom: SAT },
  }
  const state = R112.parsePayrollTimePolicyState(doc, zone)
  assert.deepEqual(R112.customHoursPrefillForDays(state, ['2026-11-06'], zone), { start: '07:30', end: '16:00', kind: 'weekday' })
  assert.deepEqual(R112.customHoursPrefillForDays(state, [MON], zone), { start: '08:00', end: '16:30', kind: 'weekday' })
  assert.deepEqual(R112.customHoursPrefillForDays(state, [SAT], zone), { start: '07:30', end: '13:00', kind: 'weekend' })
  assert.deepEqual(R112.customHoursPrefillForDays(state, ['2026-10-31'], zone), { start: '07:30', end: '16:00', kind: 'weekend' })
})


test('1.18.0: weekendBookingBreakdown — one row per selected day, priced by the pay rule for that day', () => {
  const zone = 'Europe/London'
  const SAT = '2026-11-07'
  const SUN = '2026-11-08'
  const satWindow = { allHoursAtMultiplierMode: false, allHoursMultiplier: 2, definedWindowStart: '07:30', definedWindowEnd: '14:00', countsAsStandardHours: 8, outsideWindowMultiplier: 1.5, sameAsSaturday: false }
  const sunAllHours = { allHoursAtMultiplierMode: true, allHoursMultiplier: 2, sameAsSaturday: false }
  const policy = { ...parsePolicy112(undefined), saturday: satWindow, sunday: sunAllHours }
  // Owner's example: Saturday on its window counts as 8h; Sunday every hour at 2× (no break off at the weekend, as pay).
  const rows = R112.weekendBookingBreakdown(policy, [SUN, SAT], '07:30', '14:00', false, zone)
  assert.deepEqual(rows.map((row) => row.line), [
    'Saturday 07:30–14:00 = 8h (counts as a full day)',
    'Sunday 07:30–14:00 = 6.5h × 2 = 13h',
  ])
  assert.deepEqual(
    { ...rows[0], line: undefined, lines: undefined, explanation: undefined },
    { dayKey: SAT, weekdayLabel: 'Saturday', start: '07:30', end: '14:00', workedHours: 6.5, countsAsHours: 8, standardHours: 8, overtimeHours: 0, multiplier: 1.5, paidHoursEquivalent: 8, unpaidBreakHours: 0, line: undefined, lines: undefined, explanation: undefined }
  )
  assert.deepEqual(
    { ...rows[1], line: undefined, lines: undefined, explanation: undefined },
    { dayKey: SUN, weekdayLabel: 'Sunday', start: '07:30', end: '14:00', workedHours: 6.5, countsAsHours: null, standardHours: 0, overtimeHours: 6.5, multiplier: 2, paidHoursEquivalent: 13, unpaidBreakHours: 0, line: undefined, lines: undefined, explanation: undefined }
  )
  // 1.39.0: each row explains its figure (`bookingHoursExplanation`).
  assert.deepEqual(rows[0].explanation.steps, ['07:30–14:00 = 8h (full day, 30 min paid break, not deducted)'])
  assert.deepEqual(rows[1].explanation.steps, ['07:30–14:00 = 6.5h × 2 = 13h'])
  // Each figure is the timesheet pay rule's for that day.
  for (const row of rows) {
    const paid = R112.payrollHoursResult({ booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '14:00' }, dayKey: row.dayKey, policy, timeZone: zone })
    assert.equal(row.paidHoursEquivalent, paid.totalPaidHours)
  }
  // Outside the window: the Saturday rate for the extra hours.
  assert.equal(R112.weekendBookingBreakdown(policy, [SAT], '07:30', '16:00', false, zone)[0].line, 'Saturday 07:30–16:00 = 8h + 2h × 1.5 = 11h')
  // Same rules on both days: identical figures (screens may collapse them).
  const same = { ...policy, sunday: { ...satWindow, sameAsSaturday: true } }
  const sameRows = R112.weekendBookingBreakdown(same, [SAT, SUN], '07:30', '14:00', false, zone)
  assert.equal(sameRows.length, 2)
  const sameBody = (row: (typeof sameRows)[number], day: string) => ({
    ...row,
    dayKey: '',
    weekdayLabel: '',
    line: row.line.replace(day, ''),
    explanation: { ...row.explanation, rule: row.explanation.rule.replace(day, '') },
  })
  assert.deepEqual(sameBody(sameRows[0], 'Saturday'), sameBody(sameRows[1], 'Sunday'))
  // A scheduled change between the two days: each day under the rules in effect on it.
  const doc = {
    countryCode: 'GB',
    payrollTimePolicy: { saturday: satWindow, sunday: { ...satWindow, sameAsSaturday: true } },
    payrollTimePolicyScheduled: { policy: { saturday: satWindow, sunday: sunAllHours }, effectiveFrom: SUN },
  }
  const state = R112.parsePayrollTimePolicyState(doc, zone)
  assert.deepEqual(R112.weekendBookingBreakdown(state, [SAT, SUN], '07:30', '14:00', false, zone).map((row) => row.line), [
    'Saturday 07:30–14:00 = 8h (counts as a full day)',
    'Sunday 07:30–14:00 = 6.5h × 2 = 13h',
  ])
  // Invalid times, no days or no policy: no rows.
  assert.deepEqual(R112.weekendBookingBreakdown(policy, [SAT], '07:30', '07:30', false, zone), [])
  assert.deepEqual(R112.weekendBookingBreakdown(policy, [], '07:30', '14:00', false, zone), [])
  assert.deepEqual(R112.weekendBookingBreakdown(null, [SAT], '07:30', '14:00', false, zone), [])
})

// ─── Rulebook 1.19.0: weekend lunch breaks, working-hours pay history, every day priced under its own rules ───

const R119_ZONE = 'Europe/London'
const R119_SAT = '2026-11-07'
const R119_SUN = '2026-11-08'
const R119_WED = '2026-11-04'
const r119SatWindow = (breakPaid?: boolean) => ({
  allHoursAtMultiplierMode: false,
  allHoursMultiplier: 2,
  definedWindowStart: '07:30',
  definedWindowEnd: '14:00',
  countsAsStandardHours: 8,
  outsideWindowMultiplier: 1.5,
  sameAsSaturday: false,
  ...(breakPaid === undefined ? {} : { breakPaid }),
})
const r119SunAllHours = (breakPaid?: boolean) => ({
  allHoursAtMultiplierMode: true,
  allHoursMultiplier: 2,
  sameAsSaturday: false,
  ...(breakPaid === undefined ? {} : { breakPaid }),
})
/** Weekday break 12:00–12:30, 30 min (the default), with the given weekend rules. */
function r119Policy(saturday: Record<string, unknown>, sunday: Record<string, unknown>) {
  return { ...parsePolicy112(undefined), saturday, sunday } as ReturnType<typeof parsePolicy112>
}
function r119Hours(dayKey: string, policy: ReturnType<typeof parsePolicy112>, start: string | null, end: string | null, extra: Record<string, unknown> = {}) {
  return R112.payrollHoursResult({
    booking: { timeSlot: start ? 'CUSTOM_HOURS' : 'FULL DAY', workStartTime: start, workEndTime: end, ...extra },
    dayKey,
    policy,
    timeZone: R119_ZONE,
  })
}

test('1.19.0: weekend lunch break — owner examples (set window and every hour, paid and unpaid, No unpaid break)', () => {
  // Sat window 07:30–14:00 counts as 8h. Paid (missing = paid): 07:30–14:00 = 8h.
  const paidSat = r119Policy(r119SatWindow(), r119SunAllHours())
  assert.equal(r119Hours(R119_SAT, paidSat, '07:30', '14:00').totalPaidHours, 8)
  // Unpaid, break 12:00–12:30: 7.5h.
  const unpaid = r119Policy(r119SatWindow(false), r119SunAllHours(false))
  const sat = r119Hours(R119_SAT, unpaid, '07:30', '14:00')
  assert.equal(sat.totalPaidHours, 7.5)
  assert.equal(sat.unpaidBreakHours, 0.5)
  assert.equal(sat.workedHours, 6)
  // Sat unpaid, booking 07:30–11:00 misses the break: pro-rated credit 8 × 3.5 / 6.5 = 4.3077h, no deduction.
  const morning = r119Hours(R119_SAT, unpaid, '07:30', '11:00')
  assert.ok(Math.abs(morning.totalPaidHours - (8 * 3.5) / 6.5) < 1e-9)
  assert.equal(morning.unpaidBreakHours, 0)
  // Sun every hour ×2, paid: 6.5 × 2 = 13h. 1.20.3: unpaid → 6.5 × 2 − 0.5 = 12.5h (the break is never multiplied;
  // 1.19.0 paid (6.5 − 0.5) × 2 = 12h). Unpaid + No unpaid break: 13h.
  assert.equal(r119Hours(R119_SUN, paidSat, '07:30', '14:00').totalPaidHours, 13)
  const sun = r119Hours(R119_SUN, unpaid, '07:30', '14:00')
  assert.equal(sun.totalPaidHours, 12.5)
  // outsideHours × multiplier is the pay (6.25 × 2 = 12.5); the clock hours at ×2 are 6.5 (`payrollOutsideClockHours`).
  assert.deepEqual([sun.outsideHours, sun.outsideMultiplier, sun.unpaidBreakHours, sun.workedHours], [6.25, 2, 0.5, 6])
  assert.deepEqual(R112.payrollOutsideClockHours(sun), { outsideClockHours: 6.5, outsideBreakHours: 0.5 })
  assert.equal(r119Hours(R119_SUN, unpaid, '07:30', '14:00', { isBreakRemoved: true }).totalPaidHours, 13)
  assert.equal(r119Hours(R119_SAT, unpaid, '07:30', '14:00', { isBreakRemoved: true }).totalPaidHours, 8)
  // Partial cover: 08:00–12:25 covers 25 min of the break → 8 × 265/390 − 25/60 (the weekday rule's covered part).
  const partial = r119Hours(R119_SAT, unpaid, '08:00', '12:25')
  assert.ok(Math.abs(partial.totalPaidHours - (8 * 265 / 390 - 25 / 60)) < 1e-9)
  // A weekday is unchanged (break taken off as before): 07:30–16:00 = 8h.
  assert.equal(r119Hours(R119_WED, unpaid, '07:30', '16:00').totalPaidHours, 8)
})

test('1.20.3: weekend lunch break in the outside-window hours comes off as plain hours after the multiplier', () => {
  // Saturday window 07:30–11:00 counts as 4h, outside ×2; booked 07:30–14:00, so the break (12:00–12:30) is worked
  // in the 3 outside hours. 1.20.3: 4 + 3 × 2 − 0.5 = 9.5h unpaid (1.19.0 took it off before the multiplier:
  // 4 + (3 − 0.5) × 2 = 9h); 4 + 3 × 2 = 10h paid.
  const window = { ...r119SatWindow(false), definedWindowEnd: '11:00', countsAsStandardHours: 4, outsideWindowMultiplier: 2 }
  const unpaid = r119Policy(window, r119SunAllHours())
  const result = r119Hours(R119_SAT, unpaid, '07:30', '14:00')
  assert.equal(result.totalPaidHours, 9.5)
  assert.deepEqual(
    result.segments.map((row) => [row.kind, row.baseHours, row.paidHours, row.workedHours, row.unpaidBreakHours ?? 0]),
    [['standardWindow', 4, 4, 3.5, 0], ['outsideWindow', 2.75, 5.5, 2.5, 0.5]]
  )
  assert.equal(R112.bookingHoursLabel(result).label, '9.5h (4h + 3h × 2 − 0.5h break)')
  assert.equal(
    R112.weekendBookingBreakdown(unpaid, [R119_SAT], '07:30', '14:00', false, R119_ZONE)[0].line,
    'Saturday 07:30–14:00 = 4h + 3h × 2 − 0.5h unpaid break = 9.5h'
  )
  assert.equal(r119Hours(R119_SAT, r119Policy({ ...window, breakPaid: true }, r119SunAllHours()), '07:30', '14:00').totalPaidHours, 10)
})

test('1.19.0: legacy stored weekend FULL DAY / AM / PM — paid as stored; break off only when that day was unpaid', () => {
  const unpaid = r119Policy(r119SatWindow(false), r119SunAllHours(false))
  const paid = r119Policy(r119SatWindow(true), r119SunAllHours(true))
  // Saturday FULL DAY = the set window at its counts-as hours, less the break when unpaid.
  assert.equal(r119Hours(R119_SAT, paid, null, null).totalPaidHours, 8)
  assert.equal(r119Hours(R119_SAT, unpaid, null, null).totalPaidHours, 7.5)
  // Sunday every-hour FULL DAY = standard day 07:30–16:00 (8.5h) × 2; unpaid (1.20.3) 8.5 × 2 − 0.5 = 16.5.
  assert.equal(r119Hours(R119_SUN, paid, null, null).totalPaidHours, 17)
  assert.equal(r119Hours(R119_SUN, unpaid, null, null).totalPaidHours, 16.5)
  // AM / PM: half the counts-as hours, never a break (as Monday–Friday).
  const am = R112.payrollHoursResult({ booking: { timeSlot: 'AM' }, dayKey: R119_SAT, policy: unpaid, timeZone: R119_ZONE })
  assert.deepEqual([am.totalPaidHours, am.unpaidBreakHours], [4, 0])
})

test('1.19.0: weekend breakPaid — default paid, Sunday same as Saturday copies it, parse / write round trip', () => {
  const parsed = parsePolicy112({ saturday: { allHoursAtMultiplierMode: false }, sunday: { allHoursAtMultiplierMode: true } })
  assert.deepEqual([parsed.saturday.breakPaid, parsed.sunday.breakPaid], [true, true])
  assert.equal(parsePolicy112(undefined).saturday.breakPaid, true)
  const written = policyToFirestore119(r119Policy(r119SatWindow(false), r119SunAllHours(true)))
  assert.equal((written.saturday as Record<string, unknown>).breakPaid, false)
  assert.equal((written.sunday as Record<string, unknown>).breakPaid, true)
  assert.deepEqual(
    [parsePolicy112(written).saturday.breakPaid, parsePolicy112(written).sunday.breakPaid],
    [false, true]
  )
  // Sunday same as Saturday uses Saturday's break setting.
  const same = r119Policy(r119SatWindow(false), { ...r119SunAllHours(true), sameAsSaturday: true })
  assert.equal(r119Hours(R119_SUN, same, '07:30', '14:00').totalPaidHours, 7.5)
  assert.equal(R112.unpaidBreakAppliesOnDay(same, R119_SUN, R119_ZONE), true)
  // Settings copy: the weekday lunch, set once.
  assert.deepEqual(R112.weekendLunchBreakCopy(same, 'saturday'), {
    title: 'Lunch break on Saturday',
    detail: '12:00–12:30, 30 min — the same as your weekday lunch.',
  })
  // A day with its own break shows it.
  const own = r119Policy({ ...r119SatWindow(false), breakMinutes: 45, breakWindowStart: '11:30', breakWindowEnd: '12:15' }, r119SunAllHours())
  assert.deepEqual(R112.weekendLunchBreakCopy(own, 'saturday').detail, '11:30–12:15, 45 min.')
})

test('1.19.0: unpaidBreakAppliesOnDay, customHoursBreakWarning and payrollDayWindows follow each day', () => {
  const unpaid = r119Policy(r119SatWindow(false), r119SunAllHours())
  assert.equal(R112.unpaidBreakAppliesOnDay(unpaid, R119_WED, R119_ZONE), true)
  assert.equal(R112.unpaidBreakAppliesOnDay({ ...unpaid, breakPaid: true }, R119_WED, R119_ZONE), false)
  assert.equal(R112.unpaidBreakAppliesOnDay(unpaid, R119_SAT, R119_ZONE), true)
  assert.equal(R112.unpaidBreakAppliesOnDay(unpaid, R119_SUN, R119_ZONE), false)
  assert.equal(R112.unpaidBreakAppliesOnDay({ ...unpaid, unpaidBreakMinutes: 0 }, R119_SAT, R119_ZONE), false)
  const booking = { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '14:00' }
  assert.equal(R112.customHoursBreakWarning(unpaid, R119_SAT, booking, R119_ZONE), R112.CUSTOM_HOURS_BREAK_WARNING)
  assert.equal(R112.customHoursBreakWarning(unpaid, R119_SUN, booking, R119_ZONE), null)
  assert.equal(R112.customHoursBreakWarning(unpaid, R119_SAT, { ...booking, isBreakRemoved: true }, R119_ZONE), null)
  assert.equal(R112.customHoursBreakWarning(unpaid, R119_WED, booking, R119_ZONE), R112.CUSTOM_HOURS_BREAK_WARNING)
  // Bands: Saturday's own window and break, Sunday every hour with no window, Wednesday the standard day.
  assert.deepEqual(R112.payrollDayWindows(unpaid, R119_SAT, R119_ZONE), {
    paidWindow: { start: 450, end: 840 },
    unpaidBreak: { start: 720, end: 750 },
    allHoursMultiplier: null,
  })
  assert.deepEqual(R112.payrollDayWindows(unpaid, R119_SUN, R119_ZONE), { paidWindow: null, unpaidBreak: null, allHoursMultiplier: 2 })
  assert.deepEqual(R112.payrollDayWindows(unpaid, R119_WED, R119_ZONE).paidWindow, { start: 450, end: 960 })
})

test('1.19.0: weekendBookingBreakdown shows the weekend break like Monday–Friday', () => {
  const unpaid = r119Policy(r119SatWindow(false), r119SunAllHours(false))
  const rows = R112.weekendBookingBreakdown(unpaid, [R119_SAT, R119_SUN], '07:30', '14:00', false, R119_ZONE)
  assert.deepEqual(rows.map((row) => row.line), [
    'Saturday 07:30–14:00 = 8h − 0.5h unpaid break = 7.5h',
    'Sunday 07:30–14:00 = 6.5h × 2 = 13h − 0.5h unpaid break = 12.5h',
  ])
  assert.deepEqual(rows[0].lines, [
    { kind: 'standard', label: 'Set hours', value: '8h' },
    { kind: 'break', label: 'Unpaid break', value: '−0.5h' },
    { kind: 'total', label: 'Total paid hours', value: '7.5h' },
  ])
  assert.deepEqual(rows[1].lines, [
    { kind: 'outside', label: 'Every hour', value: '6.5h × 2' },
    { kind: 'break', label: 'Unpaid break', value: '−0.5h' },
    { kind: 'total', label: 'Total paid hours', value: '12.5h' },
  ])
  assert.deepEqual(rows.map((row) => [row.paidHoursEquivalent, row.unpaidBreakHours]), [[7.5, 0.5], [12.5, 0.5]])
  // No unpaid break on the booking: the 1.18.0 lines, unchanged.
  assert.deepEqual(
    R112.weekendBookingBreakdown(unpaid, [R119_SAT, R119_SUN], '07:30', '14:00', true, R119_ZONE).map((row) => row.line),
    ['Saturday 07:30–14:00 = 8h (counts as a full day)', 'Sunday 07:30–14:00 = 6.5h × 2 = 13h']
  )
})

/** Apply canonical write fields to a stored document the way Firestore's partial update does (no dotted keys here). */
function r119Write(doc: Record<string, unknown>, fields: Record<string, unknown> | null): Record<string, unknown> {
  assert.ok(fields)
  return { ...doc, ...fields }
}
const r119Raw = (start: string, extra: Record<string, unknown> = {}) =>
  policyToFirestore119({ ...parsePolicy112(undefined), standardDayStart: start, ...extra })
const r119StartOn = (doc: unknown, dayKey: string) => R112.effectivePayrollTimePolicy(doc, dayKey, R119_ZONE).standardDayStart

test('1.19.0: payrollTimePolicyHistory — three changes keep every old day on its own rules', () => {
  // A (07:30) from the start; B (08:00) applied 2 March; C (06:30) applied 1 June.
  let doc: Record<string, unknown> = { countryCode: 'GB', payrollTimePolicy: r119Raw('07:30') }
  doc = r119Write(doc, R112.payrollTimePolicyApplyNowWriteFields({ orgDoc: doc, policy: parsePolicy112(r119Raw('08:00')), todayKey: '2026-03-02', timeZone: R119_ZONE }))
  doc = r119Write(doc, R112.payrollTimePolicyApplyNowWriteFields({ orgDoc: doc, policy: parsePolicy112(r119Raw('06:30')), todayKey: '2026-06-01', timeZone: R119_ZONE }))
  // Before 1.19.0 only one prior was kept, so January was re-priced with B. Now each day keeps its rules.
  assert.equal(r119StartOn(doc, '2026-01-15'), '07:30')
  assert.equal(r119StartOn(doc, '2026-03-01'), '07:30')
  assert.equal(r119StartOn(doc, '2026-03-02'), '08:00')
  assert.equal(r119StartOn(doc, '2026-05-31'), '08:00')
  assert.equal(r119StartOn(doc, '2026-06-01'), '06:30')
  // The flat fields stay for older builds: prior = yesterday's rules, current, effectiveFrom.
  assert.equal((doc.payrollTimePolicyPrior as Record<string, unknown>).standardDayStart, '08:00')
  assert.equal(doc.payrollTimePolicyEffectiveFrom, '2026-06-01')
  assert.equal(doc.payrollTimePolicyRevision, 2)
  // Schedule D (09:00) from 1 Dec: pending, not history. Cancel removes only the pending change.
  doc = r119Write(doc, R112.payrollTimePolicyScheduleWriteFields({ orgDoc: doc, policy: parsePolicy112(r119Raw('09:00')), effectiveFrom: '2026-12-01', todayKey: '2026-11-03', timeZone: R119_ZONE }))
  assert.equal(r119StartOn(doc, '2026-11-30'), '06:30')
  assert.equal(r119StartOn(doc, '2026-12-01'), '09:00')
  const historyBefore = (doc.payrollTimePolicyHistory as unknown[]).length
  const cancelled = r119Write(doc, R112.payrollTimePolicyCancelScheduleWriteFields({ orgDoc: doc, todayKey: '2026-11-03', timeZone: R119_ZONE }))
  assert.equal((cancelled.payrollTimePolicyHistory as unknown[]).length, historyBefore)
  assert.equal(r119StartOn(cancelled, '2026-12-01'), '06:30')
  assert.equal(r119StartOn(cancelled, '2026-01-15'), '07:30')
  // Keep D scheduled; on 5 Dec (D already due, never promoted by any app) apply E (07:00).
  doc = r119Write(doc, R112.payrollTimePolicyApplyNowWriteFields({ orgDoc: doc, policy: parsePolicy112(r119Raw('07:00')), todayKey: '2026-12-05', timeZone: R119_ZONE }))
  assert.deepEqual(
    (doc.payrollTimePolicyHistory as Array<{ effectiveFrom: string; policy: { standardDayStart: string } }>).map((e) => [e.effectiveFrom, e.policy.standardDayStart]),
    [['1970-01-01', '07:30'], ['2026-03-02', '08:00'], ['2026-06-01', '06:30'], ['2026-12-01', '09:00'], ['2026-12-05', '07:00']]
  )
  assert.equal(doc.payrollTimePolicyScheduled, null)
  for (const [day, start] of [['2026-01-15', '07:30'], ['2026-04-01', '08:00'], ['2026-07-01', '06:30'], ['2026-12-03', '09:00'], ['2026-12-05', '07:00']]) {
    assert.equal(r119StartOn(doc, day), start, day)
  }
  assert.equal(doc.payrollTimePolicyRevision, 4)
  // The promoted state carries the history (timeline view for "today" screens).
  const timeline = R112.payrollTimePolicyTimeline(doc, '2026-12-06', R119_ZONE)
  assert.equal(R112.payrollTimePolicyForDayFromState(timeline, '2026-01-15').standardDayStart, '07:30')
})

test('1.19.0: payrollTimePolicyHistory — seeded from the flat fields, an older build save still counts, same-day saves', () => {
  // A company saved before 1.19.0: prior B before 1 June, current C. The first write seeds history from them.
  const legacy = {
    countryCode: 'GB',
    payrollTimePolicy: r119Raw('06:30'),
    payrollTimePolicyPrior: r119Raw('08:00'),
    payrollTimePolicyEffectiveFrom: '2026-06-01',
  }
  const seeded = r119Write(legacy, R112.payrollTimePolicyApplyNowWriteFields({ orgDoc: legacy, policy: parsePolicy112(r119Raw('07:00')), todayKey: '2026-11-03', timeZone: R119_ZONE }))
  assert.deepEqual(
    (seeded.payrollTimePolicyHistory as Array<{ effectiveFrom: string; policy: { standardDayStart: string } }>).map((e) => [e.effectiveFrom, e.policy.standardDayStart]),
    [['1970-01-01', '08:00'], ['2026-06-01', '06:30'], ['2026-11-03', '07:00']]
  )
  // Without history, reads are exactly as before 1.19.0.
  assert.equal(r119StartOn(legacy, '2026-05-31'), '08:00')
  assert.equal(r119StartOn(legacy, '2026-06-01'), '06:30')
  // An older build (no history) applies F (05:30) on 1 Dec: only the flat fields change. It still counts from its day,
  // and the history keeps the earlier days.
  const oldBuild = { ...seeded, payrollTimePolicy: r119Raw('05:30'), payrollTimePolicyPrior: r119Raw('07:00'), payrollTimePolicyEffectiveFrom: '2026-12-01' }
  assert.equal(r119StartOn(oldBuild, '2026-12-02'), '05:30')
  assert.equal(r119StartOn(oldBuild, '2026-11-15'), '07:00')
  assert.equal(r119StartOn(oldBuild, '2026-05-01'), '08:00')
  // The next new-build write appends F at its day (never rewrites earlier entries).
  const next = r119Write(oldBuild, R112.payrollTimePolicyCancelScheduleWriteFields({ orgDoc: oldBuild, todayKey: '2026-12-03', timeZone: R119_ZONE }))
  assert.deepEqual(
    (next.payrollTimePolicyHistory as Array<{ effectiveFrom: string }>).map((e) => e.effectiveFrom),
    ['1970-01-01', '2026-06-01', '2026-11-03', '2026-12-01']
  )
  // Two Apply-from-today saves on one day: the later wins, both stay in the history.
  const twice = r119Write(seeded, R112.payrollTimePolicyApplyNowWriteFields({ orgDoc: seeded, policy: parsePolicy112(r119Raw('09:30')), todayKey: '2026-11-03', timeZone: R119_ZONE }))
  assert.equal(r119StartOn(twice, '2026-11-03'), '09:30')
  assert.equal(r119StartOn(twice, '2026-11-02'), '06:30')
  assert.equal((twice.payrollTimePolicyHistory as unknown[]).length, 4)
  // History day keys may be stored as Timestamps: organisation-zone day (BST midnight 30 March = 2026-03-29T23:00Z).
  const tsDoc = {
    payrollTimePolicy: r119Raw('07:00'),
    payrollTimePolicyEffectiveFrom: '2026-03-30',
    payrollTimePolicyHistory: [
      { effectiveFrom: '1970-01-01', policy: r119Raw('08:00') },
      { effectiveFrom: { seconds: Date.parse('2026-03-29T23:00:00Z') / 1000 }, policy: r119Raw('07:00') },
      { effectiveFrom: 'not a day', policy: r119Raw('04:00') },
    ],
  }
  assert.deepEqual(R112.parsePayrollTimePolicyHistory(tsDoc.payrollTimePolicyHistory, R119_ZONE).map((e) => e.effectiveFrom), ['1970-01-01', '2026-03-30'])
  assert.equal(r119StartOn(tsDoc, '2026-03-29'), '08:00') // the day the clocks go forward keeps the old rules
  assert.equal(r119StartOn(tsDoc, '2026-03-30'), '07:00')
})

test('1.19.0: a scheduled change inside a pay run prices each day under its own rules (no promotion needed)', () => {
  // FULL DAY pays the standard day's clock hours less the break: 07:30–16:00 = 8h now, 07:30–15:00 = 7h from the 12th.
  const current = { ...parsePolicy112(undefined) }
  const scheduled = { ...parsePolicy112(undefined), standardDayEnd: '15:00', standardPaidHours: 7 }
  const doc = {
    countryCode: 'GB',
    payrollTimePolicy: policyToFirestore119(current),
    payrollTimePolicyScheduled: { policy: policyToFirestore119(scheduled), effectiveFrom: '2026-11-12' },
  }
  const state = R112.payrollTimePolicyTimeline(doc, '2026-11-03', R119_ZONE)
  const fullDay = (dayKey: string) =>
    R112.payrollHoursResult({ booking: { timeSlot: 'FULL DAY' }, dayKey, policy: R112.payrollTimePolicyForDayFromState(state, dayKey), timeZone: R119_ZONE }).totalPaidHours
  // Pay run 1–15 November: 10th and 11th on 8h, 12th and 13th on 7h.
  assert.deepEqual(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map(fullDay), [8, 8, 7, 7])
})

test('1.19.0: payrollTimePolicySaveConflict refuses a stale working-hours save', () => {
  const base = { payrollTimePolicy: r119Raw('07:30'), payrollTimePolicyRevision: 3 }
  assert.equal(R112.payrollTimePolicySaveConflict(base, { ...base }, R119_ZONE), null)
  // Another admin scheduled a change (revision bumped).
  const other = r119Write(base, R112.payrollTimePolicyScheduleWriteFields({ orgDoc: base, policy: parsePolicy112(r119Raw('09:00')), effectiveFrom: '2026-12-01', todayKey: '2026-11-03', timeZone: R119_ZONE }))
  assert.equal(other.payrollTimePolicyRevision, 4)
  assert.equal(R112.payrollTimePolicySaveConflict(base, other, R119_ZONE), R112.PAYROLL_POLICY_STALE_SAVE_MESSAGE)
  // An older build that does not bump the revision is still caught by the changed rules.
  const oldBuild = { ...base, payrollTimePolicyScheduled: { policy: r119Raw('10:00'), effectiveFrom: '2026-12-01' } }
  assert.equal(R112.payrollTimePolicySaveConflict(base, oldBuild, R119_ZONE), R112.PAYROLL_POLICY_STALE_SAVE_MESSAGE)
  // Other organisation fields changing is not a conflict.
  assert.equal(R112.payrollTimePolicySaveConflict(base, { ...base, name: 'Renamed' }, R119_ZONE), null)
})

test('1.19.0: unbooked labour reads each day of the window under the rules in effect on it', () => {
  // Saturday's working-hours window is 07:30–13:00 until 14 Nov and 07:30–14:00 from then (a scheduled change); with no
  // saved "Hours to cover", each Saturday must cover that day's own window, less its lunch window (12:00–12:30).
  const before = { ...parsePolicy112(undefined), saturday: { ...r119SatWindow(), definedWindowEnd: '13:00' } }
  const after = { ...parsePolicy112(undefined), saturday: r119SatWindow() }
  const state = R112.parsePayrollTimePolicyState(
    {
      payrollTimePolicy: policyToFirestore119(before),
      payrollTimePolicyScheduled: { policy: policyToFirestore119(after), effectiveFrom: '2026-11-14' },
    },
    R119_ZONE
  )
  const rows = R112.unbookedLabourRows({
    timeZone: R119_ZONE,
    startDayKey: '2026-11-07',
    endDayKey: '2026-11-14',
    includeWeekends: true,
    payrollPolicy: state,
    people: [{ id: 'u1', email: 'op@x.com', name: 'Op One', isActive: true, passwordSet: true, isOperativeMode: true }],
    operatives: [],
    bookings: [],
    holidays: [],
  })
  const missing = (day: string) => rows.find((row) => row.dayKey === day)?.missingHours
  assert.equal(missing('2026-11-07'), 5)
  assert.equal(missing('2026-11-14'), 6)
  // Sunday is every hour at 2× (no set window): the standard day 07:30–16:00 less the lunch window.
  assert.equal(missing('2026-11-08'), 8)
  // A weekday keeps the standard day less the break.
  assert.equal(missing('2026-11-09'), 8)
})

test('1.19.0: a signed timesheet snapshot is never re-priced — its rows come from weeklyReportOverride', () => {
  const signed = {
    weeklyReportOverride: {
      lines: [{ id: 'op-b1-normal', date: '2026-11-07T00:00:00.000Z', amount: 200, days: 1, paidHours: 8, isOvertime: false, decision: 'approved' }],
      priceWork: [],
      expenses: [],
    },
    managerSignedAt: '2026-11-10T09:00:00.000Z',
  }
  // The live line (re-priced under new rules) says 175; the invoice keeps the signed 200.
  const rows = R112.timesheetInvoiceRows({
    sheet: signed,
    payrollLines: [{ id: 'op-b1-normal', date: new Date('2026-11-07T00:00:00Z'), amount: 175, paidHours: 7, isOvertimeLine: false }],
    extrasMode: 'raw',
    timesheetDays: null,
    timeZone: R119_ZONE,
  } as never) as Array<{ kind: string; amount?: number; source?: string }>
  const labour = rows.filter((row) => row.kind === 'labour')
  assert.equal(labour.length, 1)
  assert.equal(labour[0].source, 'override')
  assert.equal(labour[0].amount, 200)
})

test('1.19.0 (owner, round 2): each weekend day has its own break — length and window, weekday fallback', () => {
  // Sat window 07:30–14:00 = 8h, break 12:00–12:30 unpaid (the weekday fallback) → 7.5h.
  const fallback = r119Policy(r119SatWindow(false), r119SunAllHours(false))
  assert.equal(r119Hours(R119_SAT, fallback, '07:30', '14:00').totalPaidHours, 7.5)
  // Sun every hour ×2, break 30 min unpaid → 1.20.3: 6.5 × 2 − 0.5 = 12.5h; paid → 13h.
  assert.equal(r119Hours(R119_SUN, fallback, '07:30', '14:00').totalPaidHours, 12.5)
  assert.equal(r119Hours(R119_SUN, r119Policy(r119SatWindow(), r119SunAllHours(true)), '07:30', '14:00').totalPaidHours, 13)
  // Sat break set to 45 min, 11:30–12:15 → 8 − 0.75 = 7.25h.
  const ownSat = r119Policy({ ...r119SatWindow(false), breakMinutes: 45, breakWindowStart: '11:30', breakWindowEnd: '12:15' }, r119SunAllHours())
  const own = r119Hours(R119_SAT, ownSat, '07:30', '14:00')
  assert.equal(own.totalPaidHours, 7.25)
  assert.equal(own.unpaidBreakHours, 0.75)
  // The weekday break is untouched by a weekend day's own break.
  assert.equal(r119Hours(R119_WED, ownSat, '07:30', '16:00').totalPaidHours, 8)
  // Sunday with its own 60-minute break 12:00–13:00, every hour ×2: 1.20.3 6.5 × 2 − 1 = 12h; No unpaid break → 13h.
  const ownSun = r119Policy(r119SatWindow(), { ...r119SunAllHours(false), breakMinutes: 60, breakWindowStart: '12:00', breakWindowEnd: '13:00' })
  assert.equal(r119Hours(R119_SUN, ownSun, '07:30', '14:00').totalPaidHours, 12)
  assert.equal(r119Hours(R119_SUN, ownSun, '07:30', '14:00', { isBreakRemoved: true }).totalPaidHours, 13)
  // Sunday "same as Saturday" copies Saturday's break.
  const same = r119Policy({ ...r119SatWindow(false), breakMinutes: 45, breakWindowStart: '11:30', breakWindowEnd: '12:15' }, { ...r119SunAllHours(true), sameAsSaturday: true })
  assert.equal(r119Hours(R119_SUN, same, '07:30', '14:00').totalPaidHours, 7.25)
  // The lunch warning and the timeline use the day's own window.
  const booking = { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '11:45' }
  assert.equal(R112.customHoursBreakWarning(ownSat, R119_SAT, booking, R119_ZONE), R112.CUSTOM_HOURS_BREAK_WARNING)
  assert.equal(R112.customHoursBreakWarning(fallback, R119_SAT, booking, R119_ZONE), null)
  assert.deepEqual(R112.payrollDayWindows(ownSat, R119_SAT, R119_ZONE).unpaidBreak, { start: 690, end: 735 })
  assert.deepEqual(R112.payrollBreakOnDay(ownSat, R119_SAT, R119_ZONE), { start: 690, end: 735, minutes: 45, paid: false })
  assert.deepEqual(R112.weekendBreakFor(fallback, fallback.saturday), { paid: false, minutes: 30, start: '12:00', end: '12:30' })
  // Stored: written only when set; read back; limits as weekdays.
  const written = policyToFirestore119(ownSat).saturday as Record<string, unknown>
  assert.deepEqual([written.breakMinutes, written.breakWindowStart, written.breakWindowEnd], [45, '11:30', '12:15'])
  assert.equal('breakMinutes' in (policyToFirestore119(fallback).saturday as Record<string, unknown>), false)
  assert.equal(parsePolicy112(policyToFirestore119(ownSat)).saturday.breakMinutes, 45)
  assert.equal(parsePolicy112({ saturday: { breakMinutes: 500 } }).saturday.breakMinutes, 120)
  // 1.20.3: 11:30–12:15 and 45 min are on the 15-minute break step (1.20.2 had them off its 30-minute step).
  assert.equal(R112.validatePayrollTimePolicy(ownSat), null)
  assert.equal(
    R112.validatePayrollTimePolicy({ ...ownSat, saturday: { ...ownSat.saturday, breakMinutes: 150 } }),
    'Saturday break length must be between 0 and 120 minutes.'
  )
  assert.equal(
    R112.validatePayrollTimePolicy({ ...ownSat, saturday: { ...ownSat.saturday, breakWindowStart: '12:30', breakWindowEnd: '12:00' } }),
    'Saturday break window end must be after the break start.'
  )
})

const r119Person = { id: 'u1', email: 'op@x.com', name: 'Op One', isActive: true, passwordSet: true, isOperativeMode: true }

function r119Weekend(input: Record<string, unknown>) {
  return R112.unbookedLabourRows({
    timeZone: R119_ZONE,
    startDayKey: '2026-11-07',
    endDayKey: '2026-11-08',
    includeWeekends: true,
    payrollPolicy: r119Policy(r119SatWindow(), r119SunAllHours()),
    people: [r119Person],
    operatives: [],
    bookings: [],
    holidays: [],
    ...input,
  } as never)
}

test('1.19.0 (owner, round 2): weekend unbooked labour covers each day’s "Hours to cover" window', () => {
  // Both days on with different windows: Sat 07:30–14:00 (6.5h − the 12:00–12:30 lunch = 6h), Sun 08:00–13:00 (4.5h).
  const both = { saturday: { enabled: true, start: '07:30', end: '14:00' }, sunday: { enabled: true, start: '08:00', end: '13:00' } }
  assert.deepEqual(r119Weekend({ weekendCoverage: both }).map((row) => [row.dayKey, row.missingHours]), [['2026-11-07', 6], ['2026-11-08', 4.5]])
  // Partial coverage: Saturday booked 07:30–11:30 → missing 11:30–12:00 and 12:30–14:00 = 2h (lunch never needs covering).
  const partial = r119Weekend({
    weekendCoverage: both,
    bookings: [{ personId: 'u1', dayKey: '2026-11-07', kind: 'operative', timeSlot: 'CUSTOM_HOURS', workStart: '07:30', workEnd: '11:30' }],
  })
  const sat = partial.find((row) => row.dayKey === '2026-11-07')
  assert.equal(sat?.missingHours, 2)
  assert.match(sat?.message ?? '', /^Op One is missing 2h on /)
  // Two bookings either side of lunch (07:30–12:00, 12:30–14:00) cover the window.
  assert.equal(
    r119Weekend({
      weekendCoverage: both,
      bookings: [
        { personId: 'u1', dayKey: '2026-11-07', kind: 'operative', timeSlot: 'CUSTOM_HOURS', workStart: '07:30', workEnd: '12:00' },
        { personId: 'u1', dayKey: '2026-11-07', kind: 'operative', timeSlot: 'CUSTOM_HOURS', workStart: '12:30', workEnd: '14:00' },
      ],
    }).some((row) => row.dayKey === '2026-11-07'),
    false
  )
  // A Saturday with its own lunch window (11:30–12:15) skips that window instead: 6.5 − 0.75 = 5.75h.
  assert.equal(
    r119Weekend({
      weekendCoverage: both,
      payrollPolicy: r119Policy({ ...r119SatWindow(), breakMinutes: 45, breakWindowStart: '11:30', breakWindowEnd: '12:15' }, r119SunAllHours()),
    }).find((row) => row.dayKey === '2026-11-07')?.missingHours,
    5.75
  )
  // Fully covered: no row.
  assert.equal(
    r119Weekend({ weekendCoverage: both, bookings: [{ personId: 'u1', dayKey: '2026-11-07', kind: 'operative', timeSlot: 'CUSTOM_HOURS', workStart: '07:00', workEnd: '14:30' }] })
      .some((row) => row.dayKey === '2026-11-07'),
    false
  )
  // Sunday off: not scanned.
  assert.deepEqual(r119Weekend({ weekendCoverage: { ...both, sunday: { ...both.sunday, enabled: false } } }).map((row) => row.dayKey), ['2026-11-07'])
  // Include weekends off: nothing scanned, whatever the toggles say.
  assert.deepEqual(r119Weekend({ includeWeekends: false, weekendCoverage: both }), [])
  // Legacy organisation with no field: both days on, Saturday its set window (07:30–14:00 less lunch = 6h), Sunday every
  // hour → the standard day 07:30–16:00 less lunch = 8h.
  assert.deepEqual(r119Weekend({}).map((row) => [row.dayKey, row.missingHours]), [['2026-11-07', 6], ['2026-11-08', 8]])
  // Daily Overview's list for one day is the same rule.
  assert.deepEqual(
    R112.unbookedLabourRowsOnDay({
      timeZone: R119_ZONE,
      dayKey: '2026-11-08',
      includeWeekends: true,
      weekendCoverage: both,
      payrollPolicy: r119Policy(r119SatWindow(), r119SunAllHours()),
      people: [r119Person],
      operatives: [],
      bookings: [],
      holidays: [],
    } as never).map((row) => row.missingHours),
    [4.5]
  )
})

test('1.19.0 (owner, round 2): warningDetection.weekendCoverage parse, defaults, write and scan days', () => {
  // Missing: enabled = include weekends, windows null (the default window).
  assert.deepEqual(R112.parseWarningDetection({ includeWeekendsForUnbookedLabour: true }).weekendCoverage, {
    saturday: { enabled: true, start: null, end: null },
    sunday: { enabled: true, start: null, end: null },
  })
  assert.equal(R112.parseWarningDetection({}).weekendCoverage?.saturday.enabled, false)
  const parsed = R112.parseWarningDetection({
    includeWeekendsForUnbookedLabour: true,
    weekendCoverage: { saturday: { enabled: true, start: '7:30', end: '14:00' }, sunday: { enabled: false, start: '13:00', end: '08:00' } },
  })
  assert.deepEqual(parsed.weekendCoverage, {
    saturday: { enabled: true, start: '07:30', end: '14:00' },
    sunday: { enabled: false, start: null, end: null },
  })
  // Defaults for the window: the saved one, else the day's working-hours set window, else the standard day.
  const policy = r119Policy(r119SatWindow(), r119SunAllHours())
  assert.deepEqual(R112.resolveWeekendCoverageDay(parsed.weekendCoverage, true, policy, 'saturday'), { enabled: true, start: '07:30', end: '14:00' })
  assert.deepEqual(R112.resolveWeekendCoverageDay(null, true, policy, 'saturday'), { enabled: true, start: '07:30', end: '14:00' })
  assert.deepEqual(R112.resolveWeekendCoverageDay(null, true, policy, 'sunday'), { enabled: true, start: '07:30', end: '16:00' })
  assert.equal(R112.resolveWeekendCoverageDay(parsed.weekendCoverage, false, policy, 'saturday').enabled, false)
  // Save: the whole map as one partial-update field.
  const fields = wdFields119(parsed)
  assert.deepEqual(fields['warningDetection.weekendCoverage'], parsed.weekendCoverage)
  // Scan days skip a weekend day that is switched off.
  const days = R112.unbookedScanDays({
    referenceIso: '2026-11-06T09:00:00Z',
    clashLookaheadMode: 'numberOfDays',
    clashLookaheadDays: 3,
    includeWeekends: true,
    weekendCoverage: parsed.weekendCoverage,
    timeZone: R119_ZONE,
  } as never).dayKeys
  assert.deepEqual(days, ['2026-11-06', '2026-11-07'])
})

// ─── 1.20.0: weekday day = start / finish / break; bookings Full day + Custom; leave halves at the midpoint ────────

const R120_ZONE = 'Europe/London'
const R120_WED = '2026-11-04'
/** Owner example: 06:30–14:30, break 10:00–10:45 unpaid 45 min, saved from 1.20.0 (`paidHoursDerived`). */
const r120Owner = () =>
  parsePolicy112({
    standardDayStart: '06:30',
    standardDayEnd: '14:30',
    unpaidBreakMinutes: 45,
    breakWindowStart: '10:00',
    breakWindowEnd: '10:45',
    standardPaidHours: 8,
    weekdayOutsideStandardMultiplier: 1.5,
    breakPaid: false,
    paidHoursDerived: true,
  })
/** 10:00–18:00 with a paid 30-minute break 13:00–13:30, saved from 1.20.0. */
const r120PaidBreak = () =>
  parsePolicy112({
    standardDayStart: '10:00',
    standardDayEnd: '18:00',
    unpaidBreakMinutes: 30,
    breakWindowStart: '13:00',
    breakWindowEnd: '13:30',
    breakPaid: true,
    paidHoursDerived: true,
  })
/** A policy saved before 1.20.0 (no `paidHoursDerived`). */
const r120Legacy = (overrides: Record<string, unknown> = {}) =>
  parsePolicy112({
    standardDayStart: '07:30',
    standardDayEnd: '16:00',
    unpaidBreakMinutes: 30,
    breakWindowStart: '12:00',
    breakWindowEnd: '12:30',
    standardPaidHours: 8,
    ...overrides,
  })
const r120Hours = (policy: ReturnType<typeof r120Owner>, booking: Record<string, unknown>) =>
  R112.payrollHoursResult({ booking, dayKey: R120_WED, policy, timeZone: R120_ZONE })
const r120Custom = (start: string, end: string) => ({ timeSlot: 'CUSTOM_HOURS', workStartTime: start, workEndTime: end })

test('1.20.0 owner: the Mon–Fri paid day is derived — preview "06:30–14:30 = 8h − 45 min unpaid break = 7h15m"', () => {
  const owner = r120Owner()
  const preview = R112.weekdayPaidDayPreview(owner)
  assert.equal(preview.line, '06:30–14:30 = 8h − 45 min unpaid break = 7h15m')
  assert.deepEqual([preview.dayMinutes, preview.breakMinutes, preview.breakPaid, preview.paidHours], [480, 45, false, 7.25])
  assert.equal(R112.derivedWeekdayPaidHours(owner), 7.25)
  assert.equal(R112.weekdayPaidHours(owner), 7.25)
  // On read a derived policy's standardPaidHours is the derived day (a stale stored 8 never reaches pay).
  assert.equal(owner.standardPaidHours, 7.25)
  assert.equal(owner.paidHoursDerived, true)
  // Paid break: nothing comes off.
  const paid = r120PaidBreak()
  assert.equal(R112.weekdayPaidDayPreview(paid).line, '10:00–18:00 = 8h, 30 min break paid = 8h')
  assert.equal(R112.weekdayPaidHours(paid), 8)
  assert.equal(R112.weekdayPaidDayPreview({ ...paid, unpaidBreakMinutes: 0 }).line, '10:00–18:00 = 8h')
  assert.equal(R112.weekdayPaidDayPreview({ ...owner, standardDayEnd: '14:50' }).line, '06:30–14:50 = 8h20m − 45 min unpaid break = 7h35m')
})

test('1.20.0 owner: weekday bookings — FULL DAY 7.25h, custom 06:30–12:00 4.75h, 11:00–14:30 3.5h, 06:30–16:30 7.25h + 2h OT', () => {
  const owner = r120Owner()
  const full = r120Hours(owner, { timeSlot: 'FULL DAY' })
  assert.deepEqual([full.totalPaidHours, full.standardHours, full.outsideHours, full.unpaidBreakHours], [7.25, 7.25, 0, 0.75])
  assert.equal(r120Hours(owner, r120Custom('06:30', '12:00')).totalPaidHours, 4.75)
  // 11:00–14:30 is within 20 minutes of the legacy PM half (10:45–14:30) but is never snapped to a half day: 3.5h on the clock.
  const late = r120Hours(owner, r120Custom('11:00', '14:30'))
  assert.deepEqual([late.totalPaidHours, late.unpaidBreakHours], [3.5, 0])
  const long = r120Hours(owner, r120Custom('06:30', '16:30'))
  assert.deepEqual([long.standardHours, long.outsideHours, long.outsideMultiplier, long.totalPaidHours], [7.25, 2, 1.5, 10.25])
  // Day units and day-rate pay divide by the derived day: a FULL DAY is exactly 1 day.
  assert.equal(R112.reportDayValue({ totalPaidHours: full.totalPaidHours, standardPaidHours: R112.weekdayPaidHours(owner) }), 1)
  assert.equal(R112.payForHours({ payBasis: 'day', dayRate: 200, paidHours: full.totalPaidHours, standardDayHours: R112.weekdayPaidHours(owner) }), 200)
  // Paid break: FULL DAY is the whole 8h.
  assert.equal(r120Hours(r120PaidBreak(), { timeSlot: 'FULL DAY' }).totalPaidHours, 8)
})

test('1.44.0: a policy saved before 1.20.0 derives its paid day from its working hours (owner decision 14 Nov, A = 1)', () => {
  const legacy = r120Legacy()
  assert.equal(legacy.paidHoursDerived, undefined)
  assert.equal(R112.weekdayPaidHours(legacy), 8)
  assert.equal(r120Hours(legacy, { timeSlot: 'FULL DAY' }).totalPaidHours, 8)
  // Stored AM / PM bookings: half the paid day, on the legacy booking split (`halfDayWindows`).
  assert.equal(r120Hours(legacy, { timeSlot: 'AM' }).totalPaidHours, 4)
  assert.equal(r120Hours(legacy, { timeSlot: 'PM' }).totalPaidHours, 4)
  assert.deepEqual(R112.halfDayWindows(legacy).am, { start: 450, end: 720 })
  assert.deepEqual(R112.halfDayWindows(legacy).pm, { start: 750, end: 960 })
  // 1.44.0: no 20-minute snap any more — custom 12:30–16:00 pays its clock, 3.5h (was the half day, 4h).
  assert.equal(r120Hours(legacy, r120Custom('12:30', '16:00')).totalPaidHours, 3.5)
  // A stored paid day that does not match the clock is no longer read: 07:00–16:00 − 30 min = 8.5h (stored 8).
  const mismatch = r120Legacy({ standardDayStart: '07:00' })
  assert.equal(mismatch.standardPaidHours, 8, 'the stored figure is kept on the parsed policy (written back as stored)')
  assert.equal(R112.weekdayPaidHours(mismatch), 8.5)
  assert.equal(r120Hours(mismatch, { timeSlot: 'AM' }).totalPaidHours, 4.25)
  assert.equal(r120Hours(mismatch, { timeSlot: 'FULL DAY' }).totalPaidHours, 8.5)
  assert.equal(R112.reportDayValue({ totalPaidHours: 8.5, standardPaidHours: R112.weekdayPaidHours(mismatch) }), 1)
  // Saved from 1.20.0 it gives the same figure.
  const derived = R112.withDerivedWeekdayPaidHours(mismatch)
  assert.deepEqual([derived.paidHoursDerived, derived.standardPaidHours, R112.weekdayPaidHours(derived)], [true, 8.5, 8.5])
  assert.equal(r120Hours(derived, { timeSlot: 'AM' }).totalPaidHours, 4.25)
  // Stored AM under the owner's derived policy: half the derived day, on the legacy split (06:30–10:00).
  const owner = r120Owner()
  assert.equal(r120Hours(owner, { timeSlot: 'AM' }).totalPaidHours, 3.625)
  assert.deepEqual(R112.slotInterval({ timeSlot: 'AM' }, owner), { start: 390, end: 600 })
})

test('1.20.0: Monday–Friday bookings offer Full day or Custom only; weekends stay Custom only', () => {
  assert.deepEqual(R112.WEEKDAY_TIME_SLOTS, ['FULL DAY', 'CUSTOM'])
  assert.deepEqual(R112.allowedTimeSlotsOnDay(R120_WED, r120Owner(), R120_ZONE), ['FULL DAY', 'CUSTOM'])
  assert.deepEqual(R112.allowedTimeSlotsOnDay('2026-11-07', r120Owner(), R120_ZONE), ['CUSTOM'])
  for (const slot of ['AM', 'PM', 'Morning']) assert.equal(R112.timeSlotAllowedOnDay(slot, R120_WED, R120_ZONE), false)
  assert.equal(R112.timeSlotAllowedOnDay('FULL_DAY', R120_WED, R120_ZONE), true)
})

test('1.20.0: every working-hours save writes the derived day and paidHoursDerived; prior and history stay as stored', () => {
  const orgDoc = { countryCode: 'GB', payrollTimePolicy: policyToFirestore119(r120Legacy()) }
  const typed = { ...r120Owner(), standardPaidHours: 9, paidHoursDerived: undefined }
  const fields = R112.payrollTimePolicyApplyNowWriteFields({ orgDoc, policy: typed as never, todayKey: R120_WED, timeZone: R120_ZONE })
  const current = fields.payrollTimePolicy as Record<string, unknown>
  assert.deepEqual([current.standardPaidHours, current.paidHoursDerived], [7.25, true])
  const prior = fields.payrollTimePolicyPrior as Record<string, unknown>
  assert.deepEqual([prior.standardPaidHours, 'paidHoursDerived' in prior], [8, false])
  const history = fields.payrollTimePolicyHistory as Array<{ effectiveFrom: string; policy: Record<string, unknown> }>
  assert.deepEqual(history.map((entry) => [entry.effectiveFrom, entry.policy.standardPaidHours, entry.policy.paidHoursDerived ?? null]), [
    ['1970-01-01', 8, null],
    [R120_WED, 7.25, true],
  ])
  const scheduled = R112.payrollTimePolicyScheduleWriteFields({ orgDoc, policy: typed as never, effectiveFrom: '2026-12-01', todayKey: R120_WED, timeZone: R120_ZONE })
  const pending = (scheduled?.payrollTimePolicyScheduled as { policy: Record<string, unknown> }).policy
  assert.deepEqual([pending.standardPaidHours, pending.paidHoursDerived], [7.25, true])
  // Read back: the days before keep the legacy 8h, the days from the change the derived 7.25h.
  const after = { ...orgDoc, ...fields }
  assert.equal(R112.weekdayPaidHours(R112.effectivePayrollTimePolicy(after, '2026-11-03', R120_ZONE)), 8)
  assert.equal(R112.weekdayPaidHours(R112.effectivePayrollTimePolicy(after, R120_WED, R120_ZONE)), 7.25)
  // A legacy policy written back is unchanged (no flag, its own standardPaidHours).
  assert.equal('paidHoursDerived' in policyToFirestore119(r120Legacy({ standardPaidHours: 7 })), false)
  assert.equal(policyToFirestore119(r120Legacy({ standardPaidHours: 7 })).standardPaidHours, 7)
})

test('1.20.0: validation — the derived paid day must be 1–12 hours and the break inside the day', () => {
  const owner = r120Owner()
  // 1.20.2: the owner's stored 10:00–10:45 break window is off the 30-minute step; it passes until edited.
  assert.equal(R112.validatePayrollTimePolicy(owner, owner), null)
  assert.equal(
    R112.validatePayrollTimePolicy({ ...owner, standardDayStart: '10:00', standardDayEnd: '10:50', breakWindowStart: '10:10', breakWindowEnd: '10:20', unpaidBreakMinutes: 10 }),
    'The working day must give between 1 and 12 paid hours (finish − start − unpaid break).'
  )
  assert.equal(
    R112.validatePayrollTimePolicy({ ...owner, standardDayStart: '06:00', standardDayEnd: '20:00', unpaidBreakMinutes: 0 }),
    'The working day must give between 1 and 12 paid hours (finish − start − unpaid break).'
  )
  // 12h exactly is allowed (1.20.2: times on the 30-minute step).
  assert.equal(R112.validatePayrollTimePolicy({ ...owner, standardDayStart: '06:00', standardDayEnd: '18:30', unpaidBreakMinutes: 30 }, owner), null)
  assert.equal(
    R112.validatePayrollTimePolicy({ ...owner, breakWindowStart: '14:00', breakWindowEnd: '14:45' }),
    'Break window must fall within the working day.'
  )
  // A stored paid day the old check would refuse does not matter for a derived policy.
  assert.equal(R112.validatePayrollTimePolicy({ ...owner, standardPaidHours: 0 }, owner), null)
})

test('1.20.0 owner: leave halves split the day at its exact middle, ignoring the break', () => {
  assert.deepEqual(R112.leaveHalfDayWindows(r120Owner()), { day: { start: 390, end: 870 }, am: { start: 390, end: 630 }, pm: { start: 630, end: 870 } })
  assert.deepEqual(R112.leaveHalfDayWindows(r120PaidBreak()), { day: { start: 600, end: 1080 }, am: { start: 600, end: 840 }, pm: { start: 840, end: 1080 } })
  assert.equal(R112.leaveHalfDayLabel('AM', r120Owner()), 'AM 06:30–10:30')
  assert.equal(R112.leaveHalfDayLabel('PM', r120Owner()), 'PM 10:30–14:30')
  assert.equal(R112.leaveHalfDayLabel('FULL DAY', r120Owner()), 'Full day')
  // Day counting is unchanged: AM / PM 0.5, full day 1.
  assert.equal(
    R112.annualLeaveBalance({ annualLeaveEnabled: true, orgStartMonth: 1, orgEndMonth: 12, bookings: [{ startDayKey: R120_WED, timeSlot: 'AM', status: 'approved' }], onDayKey: R120_WED } as never).taken,
    0.5
  )
})

function r120Leave(slot: string, bookings: Array<Record<string, unknown>>, policy = r120Owner()) {
  return R112.leaveCoverageRows({
    timeZone: R120_ZONE,
    startDayKey: R120_WED,
    endDayKey: R120_WED,
    day: policy,
    includeWeekends: false,
    people: [{ personKey: 'U-1', name: 'Op One', userId: 'U-1', operativeIds: ['OP-1'] }],
    leave: [{ id: 'L1', userId: 'U-1', startDayKey: R120_WED, endDayKey: R120_WED, timeSlot: slot, approved: true }],
    bookings: bookings.map((booking, index) => ({ id: `B${index}`, personId: 'OP-1', kind: 'operative', dayKey: R120_WED, label: 'J1', ...booking })) as never,
  })
}

test('1.20.0 owner: AM leave + 10:30–14:30 covers the day; + 11:00–14:30 is missing 0.25h (lunch never needs covering); 10:00–18:00 AM leave + 14:00–18:00 covered', () => {
  assert.deepEqual(r120Leave('AM', [r120Custom('10:30', '14:30')]), [])
  const short = r120Leave('AM', [r120Custom('11:00', '14:30')])
  assert.equal(short.length, 1)
  assert.equal(short[0].kind, 'leave_cover')
  assert.deepEqual(short[0].workingWindow, { start: 630, end: 870 })
  // The lunch-break window 10:00–10:45 never needs covering, so only 10:45–11:00 is missing.
  assert.deepEqual(short[0].missing, [{ start: 645, end: 660 }])
  assert.equal(short[0].missingHours, 0.25)
  assert.equal(short[0].bookedHours, 3.5)
  assert.match(short[0].message, /The PM \(10:30–14:30\) is only booked 11:00–14:30; 10:45–11:00 \(0.25 hours\) is not booked\./)
  // Booked 10:45–14:30 (from the end of lunch): covered.
  assert.deepEqual(r120Leave('AM', [r120Custom('10:45', '14:30')]), [])
  assert.deepEqual(r120Leave('AM', [r120Custom('14:00', '18:00')], r120PaidBreak()), [])
  // Purple rows: a booking overlapping the AM leave half (06:30–10:30) clashes; 10:30 onwards does not.
  const clash = r120Leave('AM', [r120Custom('10:00', '14:30')])
  assert.deepEqual(clash.map((row) => [row.kind, row.leaveWindow]), [['leave_clash', { start: 390, end: 630 }]])
  // Stored AM / PM bookings are that leave half: an AM booking covers a PM-leave day's morning and never clashes with it.
  assert.deepEqual(r120Leave('PM', [{ timeSlot: 'AM' }]), [])
  assert.deepEqual(r120Leave('AM', [{ timeSlot: 'PM' }]), [])
  assert.deepEqual(r120Leave('AM', [{ timeSlot: 'AM' }]).map((row) => row.kind), ['leave_clash', 'leave_cover'])
})

test('1.20.0 owner: bookingLeaveConflicts compares with the leave halves (AM leave 06:30–10:30 only)', () => {
  const conflicts = (booking: Record<string, unknown>) =>
    R112.bookingLeaveConflicts({
      people: ['U-1'],
      dayKeys: [R120_WED],
      holidays: [{ id: 'L1', userId: 'U-1', startDayKey: R120_WED, endDayKey: R120_WED, timeSlot: 'AM', status: 'approved' }],
      timeZone: R120_ZONE,
      day: r120Owner(),
      ...booking,
    }).length
  assert.equal(conflicts(r120Custom('10:30', '14:30')), 0)
  assert.equal(conflicts(r120Custom('10:00', '11:00')), 1)
  assert.equal(conflicts({ timeSlot: 'FULL DAY' }), 1)
  assert.equal(conflicts({ timeSlot: 'PM' }), 0)
  assert.equal(conflicts({ timeSlot: 'AM' }), 1)
})

test('1.20.0 owner: weekday unbooked labour must cover the whole day; the lunch-break window never needs covering', () => {
  const rows = (bookings: Array<Record<string, unknown>>, holidays: Array<Record<string, unknown>> = []) =>
    R112.unbookedLabourRows({
      timeZone: R120_ZONE,
      startDayKey: R120_WED,
      endDayKey: R120_WED,
      includeWeekends: false,
      payrollPolicy: r120Owner(),
      people: [r119Person],
      operatives: [],
      bookings: bookings.map((booking) => ({ personId: 'u1', dayKey: R120_WED, kind: 'operative', ...booking })),
      holidays,
    } as never).map((row) => row.missingHours)
  // Nothing booked: 8h − the 45-minute break window = 7.25h.
  assert.deepEqual(rows([]), [7.25])
  assert.deepEqual(rows([{ timeSlot: 'FULL DAY' }]), [])
  // 06:30–10:00 and 10:45–14:30 either side of lunch cover the day.
  assert.deepEqual(rows([{ timeSlot: 'CUSTOM_HOURS', workStart: '06:30', workEnd: '10:00' }, { timeSlot: 'CUSTOM_HOURS', workStart: '10:45', workEnd: '14:30' }]), [])
  assert.deepEqual(rows([{ timeSlot: 'CUSTOM_HOURS', workStart: '06:30', workEnd: '12:00' }]), [2.5])
  // A day with approved leave is left to the leave-cover rule (`leaveCoverageRows`).
  assert.deepEqual(rows([], [{ userId: 'u1', startDayKey: R120_WED, endDayKey: R120_WED, approved: true, timeSlot: 'AM' }]), [])
})

test('1.20.0: timesheet leave lines carry the leave half clock range when given the day', () => {
  const lines = R112.timesheetLeaveLines(
    [
      { id: 'L1', startDayKey: R120_WED, endDayKey: R120_WED, timeSlot: 'AM', status: 'approved' },
      { id: 'L2', startDayKey: '2026-11-05', endDayKey: '2026-11-05', timeSlot: 'PM', status: 'approved' },
      { id: 'L3', startDayKey: '2026-11-06', endDayKey: '2026-11-06', timeSlot: 'FULL DAY', status: 'approved' },
    ],
    { startDayKey: '2026-11-02', endDayKey: '2026-11-08' },
    R120_ZONE,
    [],
    () => r120Owner()
  )
  assert.deepEqual(lines.map((line) => [line.label, line.timeRange]), [
    ['Annual leave (AM)', '06:30–10:30'],
    ['Annual leave (PM)', '10:30–14:30'],
    ['Annual leave (full day)', '06:30–14:30'],
  ])
  // Without the day the lines are as before (no range).
  assert.equal(R112.timesheetLeaveLines([{ id: 'L1', startDayKey: R120_WED, endDayKey: R120_WED, timeSlot: 'AM', status: 'approved' }], { startDayKey: R120_WED, endDayKey: R120_WED }, R120_ZONE)[0].timeRange, undefined)
})

test('1.20.2: bookingRequestIdentity — a second weekend booking at the same place with other times is not "already booked"', () => {
  const base = {
    personId: 'USER-1',
    dayKey: '2026-11-07',
    timeSlot: 'CUSTOM_HOURS',
    locationType: 'project',
    locationId: 'JOB-1',
    workStartTime: '07:30',
    workEndTime: '12:00',
    isBreakRemoved: false,
  }
  // Owner bug (3 Nov): the old screen identity left the times out, so this was treated as a duplicate and dropped.
  assert.equal(R112.isSameBookingRequest(base, { ...base, workStartTime: '13:00', workEndTime: '16:00' }), false)
  assert.equal(R112.isSameBookingRequest(base, { ...base, workEndTime: '12:30' }), false)
  assert.equal(R112.isSameBookingRequest(base, { ...base, isBreakRemoved: true }), false)
  // The same booking: ids and slot spellings without case, clock times as minutes.
  assert.equal(
    R112.isSameBookingRequest(base, { ...base, personId: 'user-1', locationId: 'job-1', timeSlot: 'CUSTOM', workStartTime: '7:30' }),
    true
  )
  // Named slots ignore stored clock times; place and day still count.
  const full = { ...base, timeSlot: 'FULL DAY', workStartTime: null, workEndTime: null }
  assert.equal(R112.isSameBookingRequest(full, { ...full, timeSlot: 'FULL_DAY', workStartTime: '07:30', workEndTime: '16:00' }), true)
  assert.equal(R112.isSameBookingRequest(full, { ...full, locationId: 'JOB-2' }), false)
  assert.equal(R112.isSameBookingRequest(full, { ...full, dayKey: '2026-11-08' }), false)
  assert.equal(R112.bookingRequestIdentity(base), R112.bookingRequestIdentity({ ...base }))
})

test('1.20.2: bookingHoursLabel — booking rows show the pay rule hours for the day, with the multiplier sum', () => {
  const policy = r119Policy(r119SatWindow(false), r119SunAllHours(false))
  const result = (dayKey: string, start: string, end: string) =>
    R112.payrollHoursResult({
      booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: start, workEndTime: end, isBreakRemoved: true },
      dayKey,
      policy,
      timeZone: R119_ZONE,
    })
  // Owner report: Sat and Sun 07:30–14:00 showed 6.5h (clock) everywhere.
  assert.deepEqual(R112.bookingHoursLabel(result(R119_SAT, '07:30', '14:00')), { hours: 8, label: '8h' })
  assert.deepEqual(R112.bookingHoursLabel(result(R119_SUN, '07:30', '14:00')), { hours: 13, label: '13h (6.5h × 2)' })
  // Same figures as the booking breakdown (`weekendBookingBreakdown`).
  const rows = R112.weekendBookingBreakdown(policy, [R119_SAT, R119_SUN], '07:30', '14:00', true, R119_ZONE)
  assert.deepEqual(rows.map((row) => row.paidHoursEquivalent), [8, 13])
  assert.deepEqual(R112.bookingHoursLabel(null), { hours: 0, label: '0h' })
  assert.deepEqual(
    R112.bookingHoursLabel({ totalPaidHours: 11, standardHours: 8, outsideHours: 2, outsideMultiplier: 1.5 }),
    { hours: 11, label: '11h (8h + 2h × 1.5)' }
  )
  assert.deepEqual(R112.bookingHoursLabel({ totalPaidHours: 8, standardHours: 8, outsideHours: 0, outsideMultiplier: 1.5 }), { hours: 8, label: '8h' })
})

test('1.20.2 / 1.20.3: day times use 30-minute steps; break times and length 15; stored off-step values pass until edited', () => {
  const base = parsePolicy112(undefined)
  assert.equal(R112.PAYROLL_POLICY_TIME_STEP_MINUTES, 30)
  assert.equal(R112.validatePayrollTimePolicy({ ...base, standardDayStart: '07:30', standardDayEnd: '16:00' }), null)
  assert.equal(R112.validatePayrollTimePolicy({ ...base, standardDayStart: '07:15' }), 'Working hours use 30-minute steps (e.g. 07:30).')
  // 1.20.3: break times are on the 15-minute step (12:10 is not).
  assert.equal(R112.validatePayrollTimePolicy({ ...base, breakWindowStart: '12:10', breakWindowEnd: '12:40' }), R112.PAYROLL_BREAK_TIME_STEP_MESSAGE)
  // Break length 45 min is on the 15-minute step (owner example).
  assert.equal(R112.validatePayrollTimePolicy({ ...base, unpaidBreakMinutes: 45 }), null)
  // A weekend window is on the 30-minute step too.
  const satWindow = { ...base.saturday, allHoursAtMultiplierMode: false, definedWindowStart: '07:30', definedWindowEnd: '13:15' }
  assert.equal(R112.validatePayrollTimePolicy({ ...base, saturday: satWindow }), R112.PAYROLL_POLICY_TIME_STEP_MESSAGE)
  // A time stored off the step before 1.20.2 is kept until it is edited.
  const stored = { ...base, standardDayStart: '07:15' }
  assert.equal(R112.validatePayrollTimePolicy({ ...stored, weekdayOutsideStandardMultiplier: 2 }, stored), null)
  assert.equal(R112.validatePayrollTimePolicy({ ...stored, standardDayStart: '07:45' }, stored), R112.PAYROLL_POLICY_TIME_STEP_MESSAGE)
  assert.equal(R112.payrollPolicyTimeOnStep('06:30'), true)
  assert.equal(R112.payrollPolicyTimeOnStep('06:45'), false)
})

test('1.20.3 owner: lunch break start, end and length use 15-minute steps; day start / finish stay 30', () => {
  const base = parsePolicy112(undefined)
  assert.equal(R112.PAYROLL_BREAK_TIME_STEP_MINUTES, 15)
  assert.equal(R112.PAYROLL_BREAK_TIME_STEP_MESSAGE, 'Lunch break times and length use 15-minute steps (e.g. 10:45).')
  // Owner example: 10:00–10:45 unpaid, 45 min — valid, and 45 minutes come off a booking that covers it.
  const owner = { ...base, breakWindowStart: '10:00', breakWindowEnd: '10:45', unpaidBreakMinutes: 45 }
  assert.equal(R112.validatePayrollTimePolicy(owner), null)
  const wed = R112.payrollHoursResult({
    booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '16:00' },
    dayKey: R119_WED,
    policy: owner,
    timeZone: R119_ZONE,
  })
  assert.equal(wed.unpaidBreakHours, 0.75)
  // Off the 15-minute step: break times and lengths are refused.
  assert.equal(R112.validatePayrollTimePolicy({ ...owner, breakWindowEnd: '10:40' }), R112.PAYROLL_BREAK_TIME_STEP_MESSAGE)
  assert.equal(R112.validatePayrollTimePolicy({ ...owner, unpaidBreakMinutes: 40 }), R112.PAYROLL_BREAK_TIME_STEP_MESSAGE)
  for (const minutes of [0, 15, 30, 45, 60, 75, 90, 105, 120]) {
    assert.equal(R112.validatePayrollTimePolicy({ ...base, unpaidBreakMinutes: minutes }), null, `${minutes} min`)
  }
  // Each weekend day's own break times and length too.
  const sat = { ...base.saturday, breakPaid: false, breakWindowStart: '11:15', breakWindowEnd: '12:00', breakMinutes: 45 }
  assert.equal(R112.validatePayrollTimePolicy({ ...base, saturday: sat }), null)
  assert.equal(R112.validatePayrollTimePolicy({ ...base, saturday: { ...sat, breakWindowStart: '11:20' } }), R112.PAYROLL_BREAK_TIME_STEP_MESSAGE)
  assert.equal(R112.validatePayrollTimePolicy({ ...base, saturday: { ...sat, breakMinutes: 50 } }), R112.PAYROLL_BREAK_TIME_STEP_MESSAGE)
  // Day start / finish stay on 30 minutes: 07:45 is refused with the day message, even with a break off-step too.
  assert.equal(R112.validatePayrollTimePolicy({ ...owner, standardDayStart: '07:45', unpaidBreakMinutes: 40 }), R112.PAYROLL_POLICY_TIME_STEP_MESSAGE)
  // Stored before 1.20.3 off the step (e.g. 40 min, 12:10): passes until it is changed.
  const stored = { ...base, unpaidBreakMinutes: 40, breakWindowStart: '12:10', breakWindowEnd: '12:50' }
  assert.equal(R112.validatePayrollTimePolicy({ ...stored, weekdayOutsideStandardMultiplier: 2 }, stored), null)
  assert.equal(R112.validatePayrollTimePolicy({ ...stored, unpaidBreakMinutes: 35 }, stored), R112.PAYROLL_BREAK_TIME_STEP_MESSAGE)
  assert.equal(R112.payrollBreakTimeOnStep('10:45'), true)
  assert.equal(R112.payrollBreakTimeOnStep('10:40'), false)
  assert.equal(R112.payrollBreakMinutesOnStep(45), true)
  assert.equal(R112.payrollBreakMinutesOnStep(50), false)
})

test('1.20.3 owner: an unpaid break is plain hours, never multiplied (every hour at N×, set window, weekday)', () => {
  const unpaid = r119Policy(r119SatWindow(false), r119SunAllHours(false))
  // Sunday every hour ×2, 07:30–14:00: paid 13h; unpaid 30 min → 6.5 × 2 = 13 − 0.5 = 12.5h; + No unpaid break → 13h.
  assert.equal(r119Hours(R119_SUN, r119Policy(r119SatWindow(), r119SunAllHours(true)), '07:30', '14:00').totalPaidHours, 13)
  const sun = r119Hours(R119_SUN, unpaid, '07:30', '14:00')
  assert.equal(sun.totalPaidHours, 12.5)
  assert.equal(R112.bookingHoursLabel(sun).label, '12.5h (6.5h × 2 − 0.5h break)')
  assert.equal(r119Hours(R119_SUN, unpaid, '07:30', '14:00', { isBreakRemoved: true }).totalPaidHours, 13)
  // Set window: the break inside the window comes off the counts-as credit as plain hours — unchanged, 7.5h.
  assert.equal(r119Hours(R119_SAT, unpaid, '07:30', '14:00').totalPaidHours, 7.5)
  // Weekday unchanged: 07:30–16:00 with 30 min unpaid = 8h.
  assert.equal(r119Hours(R119_WED, unpaid, '07:30', '16:00').totalPaidHours, 8)
  // Pay consumers use outsideHours × multiplier: it equals clock × N − break exactly.
  assert.equal(sun.outsideHours * sun.outsideMultiplier, 12.5)
})

test('1.20.3 owner bug: the Saturday / Sunday preview on Working hours changes with that day\'s Paid / Unpaid break', () => {
  const satPaid = { ...r119SatWindow(true) }
  const draft = (paid: boolean) => r119Policy({ ...satPaid, breakPaid: paid }, { ...r119SunAllHours(paid) })
  // Saturday 07:30–14:00 counts as 8h, break 12:00–12:30: paid 8h → unpaid 7.5h.
  const satP = R112.weekendDayPreview(draft(true), 'saturday', R119_ZONE)
  const satU = R112.weekendDayPreview(draft(false), 'saturday', R119_ZONE)
  assert.ok(satP && satU)
  assert.deepEqual([satP.start, satP.end, satP.rows[0].paidHoursEquivalent], ['07:30', '14:00', 8])
  assert.equal(satU.rows[0].paidHoursEquivalent, 7.5)
  assert.equal(satP.summary, '07:30–14:00 counts as 8h · Paid break 12:00–12:30, 30 min · 8h paid')
  assert.equal(satU.summary, '07:30–14:00 counts as 8h · Unpaid break 12:00–12:30, 30 min — 30 min taken off · 7.5h paid')
  // Sunday every hour ×2 over 07:30–14:00 (the standard day here): paid 13h → unpaid 30 min 12.5h (1.20.3).
  const shortDay = (paid: boolean) => ({ ...draft(paid), standardDayStart: '07:30', standardDayEnd: '14:00' })
  const sunP = R112.weekendDayPreview(shortDay(true), 'sunday', R119_ZONE)
  const sunU = R112.weekendDayPreview(shortDay(false), 'sunday', R119_ZONE)
  assert.ok(sunP && sunU)
  assert.deepEqual([sunP.start, sunP.end, sunP.rows[0].paidHoursEquivalent, sunU.rows[0].paidHoursEquivalent], ['07:30', '14:00', 13, 12.5])
  assert.equal(sunU.rows[0].line, 'Sunday 07:30–14:00 = 6.5h × 2 = 13h − 0.5h unpaid break = 12.5h')
  assert.equal(sunU.summary, 'Every hour at ×2 · Unpaid break 12:00–12:30, 30 min — 30 min taken off · 12.5h paid')
  // Length and times change it too: 45 min in 12:00–12:45 → 45 min off; a length beyond the window is capped by it,
  // and the summary says how much was taken off.
  const own = { ...draft(false), saturday: { ...draft(false).saturday, breakMinutes: 45, breakWindowEnd: '12:45' } }
  assert.equal(R112.weekendDayPreview(own, 'saturday', R119_ZONE)?.rows[0].paidHoursEquivalent, 7.25)
  const capped = { ...draft(false), saturday: { ...draft(false).saturday, breakMinutes: 60 } }
  assert.equal(
    R112.weekendDayPreview(capped, 'saturday', R119_ZONE)?.summary,
    '07:30–14:00 counts as 8h · Unpaid break 12:00–12:30, 60 min — 30 min taken off · 7.5h paid'
  )
  // Sunday "same as Saturday" prices Saturday's rule from the same draft.
  const same = { ...draft(false), sunday: { ...draft(true).sunday, sameAsSaturday: true } }
  assert.equal(R112.weekendDayPreview(same, 'sunday', R119_ZONE)?.rows[0].paidHoursEquivalent, 7.5)
  // A weekend day's own unpaid break applies even when the weekday length is 0 (1.20.3; it was gated on the weekday).
  const zeroWeekday = { ...draft(false), unpaidBreakMinutes: 0, saturday: { ...draft(false).saturday, breakMinutes: 30 } }
  assert.equal(R112.unpaidBreakAppliesOnDay(zeroWeekday, R119_SAT, R119_ZONE), true)
  assert.equal(R112.unpaidBreakAppliesOnDay(zeroWeekday, R119_WED, R119_ZONE), false)
  assert.equal(R112.weekendDayPreview(zeroWeekday, 'saturday', R119_ZONE)?.rows[0].paidHoursEquivalent, 7.5)
})

test('1.20.3 owner: one text for hours at a multiplier — clock hours × N, then the break as plain hours', () => {
  assert.equal(R112.multipliedHoursText({ clockHours: 6.5, multiplier: 2, breakHours: 0.5 }), '6.5h × 2 − 0.5h break = 12.5h')
  assert.equal(R112.multipliedHoursText({ clockHours: 6.5, multiplier: 2 }), '6.5h × 2 = 13h')
  assert.equal(R112.multipliedHoursText({ clockHours: 3, multiplier: 2, breakHours: 0.5 }), '3h × 2 − 0.5h break = 5.5h')
  assert.equal(R112.multipliedHoursText({ clockHours: 2.5, multiplier: 1.5, breakHours: 0.25 }), '2.5h × 1.5 − 0.25h break = 3.5h')
  const unpaid = r119Policy(r119SatWindow(false), r119SunAllHours(false))
  const sun = r119Hours(R119_SUN, unpaid, '07:30', '14:00')
  assert.deepEqual(R112.payrollMultipliedHours(sun), {
    clockHours: 6.5,
    multiplier: 2,
    breakHours: 0.5,
    paidHours: 12.5,
    text: '6.5h × 2 − 0.5h break = 12.5h',
  })
  // Pay is unchanged: the hours at the multiplier pay exactly what the text says.
  assert.equal(sun.outsideHours * sun.outsideMultiplier, R112.payrollMultipliedHours(sun)?.paidHours)
  const window = { ...r119SatWindow(false), definedWindowEnd: '11:00', countsAsStandardHours: 4, outsideWindowMultiplier: 2 }
  const sat = r119Hours(R119_SAT, r119Policy(window, r119SunAllHours()), '07:30', '14:00')
  assert.equal(R112.payrollMultipliedHours(sat)?.text, '3h × 2 − 0.5h break = 5.5h')
  assert.equal(sat.totalPaidHours, 9.5)
  // No hours at a multiplier: null. A weekday inside the standard day.
  assert.equal(R112.payrollMultipliedHours(r119Hours(R119_WED, unpaid, '07:30', '16:00')), null)
  // Read back from a stored line's text (signed sheets), with or without a label; anything else is null.
  assert.deepEqual(R112.parseMultipliedHoursText('OT 6.5h × 2 − 0.5h break = 12.5h'), { clockHours: 6.5, multiplier: 2, breakHours: 0.5 })
  assert.deepEqual(R112.parseMultipliedHoursText('6.5h × 2 = 13h'), { clockHours: 6.5, multiplier: 2, breakHours: 0 })
  assert.equal(R112.parseMultipliedHoursText('OT 6.25h'), null)
  assert.equal(R112.parseMultipliedHoursText('07:30–14:00'), null)
})

// MARK: - 1.21.0 Job lists (§21)

import {
  activeJobsCount as jobsActiveCount121,
  bookableJobs as bookableJobs121,
  jobWorkStatus as jobWorkStatus121,
  operativeJobIds as operativeJobIds121,
  visibleJobs as visibleJobs121,
  worksInTab as worksInTab121,
  worksListMembership as worksListMembership121,
  worksTabCounts as worksTabCounts121,
} from './worksLists'
import { parseJobDocument as parseJobDocument121 } from './workDocumentReaders'

const role121 = (r: Partial<{ isSuperAdmin: boolean; isAdmin: boolean; isManager: boolean; isOperativeMode: boolean }>) => ({
  isSuperAdmin: false,
  isAdmin: false,
  isManager: false,
  isOperativeMode: false,
  ...r,
})
const noToggles121 = { projects: false, smallWorks: false }

test('1.21.0 inactive small works are listed, sit under Completed, and All counts every row', () => {
  const jobs = [
    { id: 'SW-1', collection: 'smallWorks', isLive: false, startDayKey: '2026-11-01', endDayKey: '2026-11-30' },
    { id: 'SW-2', collection: 'smallWorks', isLive: true, startDayKey: '2026-11-01', endDayKey: '2026-11-30' },
    { id: 'SW-3', collection: 'smallWorks', isLive: true, startDayKey: '2026-12-01', endDayKey: '2026-12-05' },
  ]
  const listed = worksListMembership121(jobs, 'smallWorks')
  assert.deepEqual(listed.map((j) => j.id), ['SW-1', 'SW-2', 'SW-3'])
  const counts = worksTabCounts121(listed, '2026-11-03', 'Europe/London')
  assert.deepEqual(counts, { all: 3, active: 1, upcoming: 1, completed: 1 })
  assert.equal(counts.all, listed.length)
  assert.equal(counts.active + counts.upcoming + counts.completed, counts.all)
  assert.deepEqual(worksInTab121(listed, 'completed', '2026-11-03', 'Europe/London').map((j) => j.id), ['SW-1'])
})

test('1.21.0 list membership keeps two jobs with the same job number and goes by collection, not jobType', () => {
  const jobs = [
    { id: 'P-1', collection: 'projects', jobNumber: 'C646', jobType: 'Small Works', isLive: false },
    { id: 'P-2', collection: 'projects', jobNumber: 'C646', isLive: true },
    { id: 'SW-9', collection: 'smallWorks', jobNumber: 'C646', jobType: 'CAT A' },
  ]
  assert.deepEqual(worksListMembership121(jobs, 'projects').map((j) => j.id), ['P-1', 'P-2'])
  assert.deepEqual(worksListMembership121(jobs, 'smallWorks').map((j) => j.id), ['SW-9'])
})

test('1.21.0 an operative sees a job reached only through a task', () => {
  const viewer = { role: role121({ isOperativeMode: true }), ids: ['U-OP'], email: 'op@x.com', toggles: noToggles121 }
  const jobs = [
    { id: 'J-TASK', collection: 'projects' },
    { id: 'J-NONE', collection: 'projects' },
  ]
  const context = { operatives: [{ id: 'OPROW-1', email: 'OP@x.com' }], tasks: [{ projectId: 'j-task', assignedOperativeId: 'oprow-1' }] }
  assert.deepEqual(visibleJobs121(jobs, viewer, context).map((j) => j.id), ['J-TASK'])
  assert.deepEqual(visibleJobs121(jobs, viewer, {}).map((j) => j.id), [])
  assert.deepEqual(operativeJobIds121(viewer, { ...context, deadlineJobIds: ['J-D'] }), ['j-task', 'J-D'])
})

test('1.21.0 / 1.33.0 every manager sees every job, toggles or not (no managers\' hide list); operatives\' hide list stays', () => {
  const viewer = { role: role121({ isManager: true }), ids: ['U-M'], email: 'm@x.com', toggles: noToggles121 }
  const jobs = [
    { id: 'MINE', collection: 'projects', managerUserIds: ['U-M'] },
    { id: 'BY-ROW', collection: 'smallWorks', managerIds: ['MGR-ROW'] },
    { id: 'OTHER', collection: 'projects', managerUserIds: ['U-X'] },
    { id: 'HIDDEN', collection: 'projects', managerUserIds: ['U-M'], hiddenManagerUserIds: ['u-m'] },
  ]
  const context = { managers: [{ id: 'MGR-ROW', email: 'M@x.com' }] }
  assert.deepEqual(visibleJobs121(jobs, viewer, context).map((j) => j.id), ['MINE', 'BY-ROW', 'OTHER', 'HIDDEN'])
  const toggled = { ...viewer, toggles: { projects: true, smallWorks: false } }
  assert.deepEqual(visibleJobs121(jobs, toggled, context).map((j) => j.id), ['MINE', 'BY-ROW', 'OTHER', 'HIDDEN'])
  // Owner decision 6 Nov (later the same day): an operative named on a job's hide list does not see it, even when
  // booked on it (ids without case); a booked job not hiding them stays.
  const op = { role: role121({ isOperativeMode: true }), ids: ['U-OP'], email: 'op@x.com', toggles: noToggles121 }
  const opJobs = [
    { id: 'BOOKED', collection: 'projects', hiddenOperativeUserIds: ['u-op'] },
    { id: 'SEEN', collection: 'projects', hiddenOperativeUserIds: ['someone-else'] },
    { id: 'ELSE', collection: 'projects' },
  ]
  const opBookings = [
    { projectId: 'BOOKED', operativeId: 'U-OP', status: 'Confirmed' },
    { projectId: 'SEEN', operativeId: 'U-OP', status: 'Confirmed' },
  ]
  assert.deepEqual(visibleJobs121(opJobs, op, { bookings: opBookings }).map((j) => j.id), ['SEEN'])
})

test('1.21.0 bookable jobs exclude inactive and non-writable jobs, never by dates', () => {
  const viewer = { role: role121({ isManager: true }), ids: ['U-M'], email: 'm@x.com', toggles: { projects: true, smallWorks: true } }
  const jobs = [
    { id: 'LIVE', collection: 'projects', managerUserIds: ['U-M'], startDayKey: '2026-11-01', endDayKey: '2026-11-30' },
    { id: 'INACTIVE', collection: 'projects', isLive: false, managerUserIds: ['U-M'], startDayKey: '2026-11-01', endDayKey: '2026-11-30' },
    { id: 'NOT-MINE', collection: 'projects', managerUserIds: ['U-X'], startDayKey: '2026-11-01', endDayKey: '2026-11-30' },
    { id: 'ENDED', collection: 'projects', managerUserIds: ['U-M'], startDayKey: '2026-10-01', endDayKey: '2026-11-02' },
    { id: 'NO-END', collection: 'smallWorks', managerUserIds: ['U-M'], startDayKey: '2026-01-05' },
    { id: 'NO-DATES', collection: 'smallWorks', managerUserIds: ['U-M'] },
  ]
  const expected = ['LIVE', 'ENDED', 'NO-END', 'NO-DATES']
  assert.deepEqual(bookableJobs121(jobs, viewer, {}).map((j) => j.id), expected)
  // Day keys are accepted and ignored: a job past its end date stays bookable on a later day.
  assert.deepEqual(bookableJobs121(jobs, viewer, {}, ['2026-11-03'], 'Europe/London').map((j) => j.id), expected)
  const admin = { role: role121({ isAdmin: true }), ids: ['U-A'], email: 'a@x.com', toggles: noToggles121 }
  assert.deepEqual(bookableJobs121(jobs, admin, {}, ['2026-11-03'], 'Europe/London').map((j) => j.id), [
    'LIVE',
    'NOT-MINE',
    'ENDED',
    'NO-END',
    'NO-DATES',
  ])
})

test('1.21.0 a job day is the organisation zone day: 23:30 London vs Auckland', () => {
  const job = { id: 'J', isLive: true, startDayKey: '2026-11-01', endDayKey: '2026-11-03' }
  assert.equal(jobWorkStatus121(job, '2026-11-03T23:30:00Z', 'Europe/London'), 'active')
  assert.equal(jobWorkStatus121(job, '2026-11-03T23:30:00Z', 'Pacific/Auckland'), 'completed')
  // A job stored with instants: its end instant 23:30 London on 3 Nov is 3 Nov in London, 4 Nov in Auckland.
  const instants = { id: 'K', isLive: true, startMs: Date.parse('2026-11-01T09:00:00Z'), endMs: Date.parse('2026-11-03T23:30:00Z') }
  assert.equal(jobWorkStatus121(instants, '2026-11-04T08:00:00Z', 'Europe/London'), 'completed')
  assert.equal(jobWorkStatus121(instants, '2026-11-04T08:00:00Z', 'Pacific/Auckland'), 'active')
})

test('1.21.0 home active count equals the Active tabs of the viewer lists', () => {
  const viewer = { role: role121({ isManager: true }), ids: ['U-M'], email: 'm@x.com', toggles: noToggles121 }
  const jobs = [
    { id: 'A', collection: 'projects', managerUserIds: ['U-M'], startDayKey: '2026-11-01', endDayKey: '2026-11-30' },
    { id: 'a', collection: 'projects', managerUserIds: ['U-M'], startDayKey: '2026-11-01', endDayKey: '2026-11-30' },
    { id: 'B', collection: 'smallWorks', managerUserIds: ['U-M'], startDayKey: '2026-11-03', endDayKey: '2026-11-03' },
    { id: 'C', collection: 'projects', isLive: false, managerUserIds: ['U-M'], startDayKey: '2026-11-01', endDayKey: '2026-11-30' },
    { id: 'D', collection: 'projects', managerUserIds: ['U-X'], startDayKey: '2026-11-01', endDayKey: '2026-11-30' },
  ]
  // 1.33.0: a manager sees every job, so another manager's active job (D) counts too.
  assert.equal(jobsActiveCount121(jobs, viewer, {}, '2026-11-03', 'Europe/London'), 3)
})

test('1.21.0 a numeric job number is read as its text', () => {
  assert.equal(parseJobDocument121('J1', { jobNumber: 4521 })?.jobNumber, '4521')
  assert.equal(parseJobDocument121('J2', { jobNumber: ' C646 ' })?.jobNumber, 'C646')
  assert.equal(parseJobDocument121('J3', { jobNumber: Number.NaN })?.jobNumber, '')
})

// MARK: - Rulebook 1.22.0: money and leave-report rules (audit findings 6, 7, 8, 15)

test('1.22.0 timesheetTotals: declined expense, revised price work, stale review and a PAYE day — summary equals the invoice', () => {
  const sheet = {
    managerSignedAt: '2026-10-25T10:00:00Z',
    priceWorkEntries: [{ id: 'PW-1', title: 'Tiling', amount: 300, startDate: '2026-10-20' }],
    expenseEntries: [
      { id: 'EX-1', title: 'Skip', amount: 40, date: '2026-10-21' },
      { id: 'EX-2', title: 'Parking', amount: 25, date: '2026-10-22' },
    ],
    extraEntryReviews: {
      'pw-1': { decision: 'edited', revisedAmount: 250, reviewedAmount: 300, reviewedByUserId: 'MGR', reviewedAtMs: 1 },
      'EX-1': { decision: 'declined', revisedAmount: null, reviewedAmount: 40, reviewedByUserId: 'MGR', reviewedAtMs: 1 },
      'EX-2': { decision: 'approved', revisedAmount: null, reviewedAmount: 20, reviewedByUserId: 'MGR', reviewedAtMs: 1 },
    },
  }
  const payrollLines = [
    { id: 'op-B1-normal', amount: 200, dayKey: '2026-10-20', paidHours: 8, bookingPaidHours: 9.5, bookingOvertimeHours: 1, isOvertimeLine: false },
    { id: 'op-B1-ot', amount: 37.5, dayKey: '2026-10-20', paidHours: 1, otMultiplier: 1.5, isOvertimeLine: true },
    { id: 'op-B2-normal', amount: 0, dayKey: '2026-10-23', paidHours: 8, bookingPaidHours: 8, isOvertimeLine: false, isPayeDay: true },
  ]
  const input = {
    sheet,
    payrollLines,
    extrasMode: 'decided' as const,
    timesheetDays: ['2026-10-20', '2026-10-21', '2026-10-22'],
    timeZone: 'Europe/London',
  }
  const totals = R112.timesheetTotals(input)
  // Declined expense 0; revised price work at 250; the stale review (reviewed at 20, now 25) pending at 25; PAYE day out.
  assert.equal(totals.priceWork, 250)
  assert.equal(totals.expenses, 25)
  assert.equal(totals.labour, 237.5)
  assert.equal(totals.total, 512.5)
  assert.equal(totals.submittedExtras, 365)
  assert.equal(totals.pendingEntries, 1)
  assert.equal(totals.hours, 9.5)
  assert.equal(totals.overtimeHours, 1)
  const invoice = R112.timesheetInvoiceRows(input).reduce((sum, row) => sum + row.amount, 0)
  assert.equal(totals.total, invoice)
  // The owner's draft before review: every entry at its own amount.
  const raw = R112.timesheetTotals({ ...input, sheet: { ...sheet, managerSignedAt: null, extraEntryReviews: null }, extrasMode: 'raw' })
  assert.equal(raw.extras, 365)
  // A signed snapshot wins over the live entries.
  const signed = R112.timesheetTotals({
    ...input,
    sheet: {
      ...sheet,
      weeklyReportOverride: {
        lines: [{ id: 'op-B1-normal', amount: 200, isOvertime: false }, { id: 'op-B1-ot', amount: 37.5, isOvertime: true }],
        priceWork: [{ id: 'PW-1', amount: 250, decision: 'edited' }],
        expenses: [{ id: 'EX-1', amount: 40, decision: 'declined' }],
      },
    },
  })
  assert.equal(signed.source, 'override')
  assert.equal(signed.total, 487.5)
})

test('1.22.0 timesheetTotals: a reviewer before signing sees their labour review; the invoice waits for the signature', () => {
  const sheet = { payrollLineReviews: { 'OP-B1-NORMAL': { decision: 'edited', revisedAmount: 180 } } }
  const payrollLines = [{ id: 'op-B1-normal', amount: 200, paidHours: 8 }]
  assert.equal(R112.timesheetTotals({ sheet, payrollLines, extrasMode: 'decided', applyLabourReviews: true }).labour, 180)
  assert.equal(R112.timesheetTotals({ sheet, payrollLines, extrasMode: 'decided' }).labour, 200)
})

test('1.22.0 leaveReportRows: organisation leave year, weekends and bank holidays out, half days 0.5, ids without case', () => {
  const records = [
    { id: 'H1', userId: 'USER-A', startDayKey: '2026-12-21', endDayKey: '2027-01-08', timeSlot: 'FULL DAY', status: 'approved' },
    { id: 'H2', userId: 'user-a', startDayKey: '2027-02-05', timeSlot: 'AM', status: 'approved' },
    { id: 'H3', operativeId: 'OP-A', startDayKey: '2027-03-01', endDayKey: '2027-03-03', timeSlot: 'PM', status: 'approved' },
    { id: 'H4', userId: 'USER-A', startDayKey: '2027-03-10', status: 'pending' },
    { id: 'H5', userId: 'USER-B', startDayKey: '2027-03-10', endDayKey: '2027-03-12', status: 'approved' },
  ]
  const bank = ['2026-12-25', '2026-12-28', '2027-01-01']
  const april = R112.leaveReportRows({ records, personIds: ['user-a', 'op-a'], onDayKey: '2027-02-01', startMonth: 4, timeZone: 'Europe/London', nonWorkingDayKeys: bank })
  assert.equal(april.startDayKey, '2026-04-01')
  assert.deepEqual(april.rows.map((row) => [row.id, row.days]), [['H3', 1.5], ['H2', 0.5], ['H1', 12]])
  assert.equal(april.totalDays, 14)
  const january = R112.leaveReportRows({ records, personIds: ['USER-A'], onDayKey: '2027-02-01', startMonth: 1, timeZone: 'Europe/London', nonWorkingDayKeys: bank })
  assert.equal(january.totalDays, 5.5)
  // The report agrees with the balance the person sees.
  const balance = R112.annualLeaveBalance({
    onDayKey: '2027-02-01',
    orgStartMonth: 1,
    timeZone: 'Europe/London',
    nonWorkingDayKeys: bank,
    bookings: records.filter((row) => row.userId?.toLowerCase() === 'user-a').map((row) => ({ startDayKey: row.startDayKey, endDayKey: row.endDayKey, timeSlot: row.timeSlot, status: row.status })),
  })
  assert.equal(balance.taken, january.totalDays)
})

test('1.22.0 variation numbers: trailing digits only, deleted numbers never reused', () => {
  assert.equal(R112.nextVariationNumber(['V2-001', 'V2-003'], 'V2-', 3), 'V2-004')
  assert.equal(R112.nextVariationNumber(['VO-001', 'VO-007'], 'VO-', 3), 'VO-008')
  assert.equal(R112.variationNumberValue('V2-003'), 3)
  assert.equal(R112.variationNumberTaken([{ id: 'A', voNumber: 'VO-004', isDeleted: true }], 'vo-004'), true)
  assert.equal(R112.variationNumberTaken([{ id: 'ABC', voNumber: 'VO-004' }], 'VO-004', 'abc'), false)
  assert.equal(R112.variationNumberTaken([{ id: 'A', voNumber: 'VO-004' }], '  '), false)
})

test('1.22.0 weeklyReportTimesheetFeed: same-email weeks merge, coverage and line selection unchanged', () => {
  const line = (id: string, bookingId: string, date: string, decision = 'approved') => ({ id, bookingId, date, amount: 200, paidHours: 8, days: 1, decision })
  const weeks = [
    { userId: 'U-NAMED', weekStart: '2026-10-01', weekEnd: '2026-10-15', override: { lines: [line('a', 'shared', '2026-10-08'), line('x', 'gone', '2026-10-09', 'declined')], priceWork: [], expenses: [] } },
    { userId: 'U-BLANK', weekStart: '2026-10-01', weekEnd: '2026-10-15', override: { lines: [line('a2', 'shared', '2026-10-08'), line('c', 'own', '2026-10-10')], priceWork: [], expenses: [{ id: 'e', date: '2026-10-08', amount: 0 }] } },
  ]
  const people = [{ id: 'U-NAMED', email: 'boss@site.test' }, { id: 'U-BLANK', email: 'Boss@Site.test' }]
  const feed = R112.weeklyReportTimesheetFeed({ weeks, people, range: { start: '2026-10-01', end: '2026-10-31' }, timeZone: 'Europe/London' })
  assert.equal(feed.weeks.length, 1)
  assert.deepEqual(feed.labour.map((row) => row.line.id), ['a', 'c'])
  assert.equal(feed.expenses.length, 0)
  assert.equal(R112.timesheetFeedCovers(feed.weeks, 'U-NAMED', '2026-10-15', 'Europe/London'), true)
  assert.equal(R112.timesheetFeedCovers(feed.weeks, 'U-NAMED', '2026-10-16', 'Europe/London'), false)
})

test('1.22.0 managerCoverageHours: merged blocks, break once by the pay rule, covered is standardDayCoverage', () => {
  const policy = { ...R112.DEFAULT_PAYROLL_POLICY, standardDayStart: '07:30', standardDayEnd: '16:00', breakWindowStart: '12:00', breakWindowEnd: '12:30', unpaidBreakMinutes: 30, breakPaid: false }
  const run = (bookings: Array<Record<string, string>>) => R112.managerCoverageHours({ bookings, dayKey: '2026-11-02', policy, timeZone: 'Europe/London' })
  const split = run([{ timeSlot: 'CUSTOM', workStartTime: '07:30', workEndTime: '12:00' }, { timeSlot: 'CUSTOM', workStartTime: '12:30', workEndTime: '16:00' }])
  assert.equal(split.covered, true)
  assert.equal(split.paidHours, 8)
  const overlap = run([{ timeSlot: 'CUSTOM', workStartTime: '08:00', workEndTime: '13:00' }, { timeSlot: 'CUSTOM', workStartTime: '11:00', workEndTime: '14:00' }])
  assert.equal(overlap.paidHours, 5.5)
  assert.equal(overlap.covered, false)
  // iOS took the standard break off any block before 1.22.0 (2.5h here).
  assert.equal(run([{ timeSlot: 'CUSTOM', workStartTime: '06:00', workEndTime: '09:00' }]).paidHours, 3)
  assert.equal(run([{ timeSlot: 'FULL DAY' }]).paidHours, 8)
  assert.equal(run([]).covered, false)
})

// MARK: - Rulebook 1.23.0 — People, Home and per-day hours (audit findings 9, 12, 16–22; older per-day gaps)

const policy123Early = parsePolicy112({ standardDayStart: '07:30', standardDayEnd: '16:00', breakWindowStart: '12:00', breakWindowEnd: '12:30', unpaidBreakMinutes: 30 })
const policy123Short = parsePolicy112({ standardDayStart: '06:00', standardDayEnd: '12:00', breakWindowStart: '09:00', breakWindowEnd: '09:15', unpaidBreakMinutes: 15 })
/** Working hours 07:30–16:00 until Tuesday 10 Nov 2026, 06:00–12:00 from then on. */
const state123 = { current: policy123Short, prior: policy123Early, effectiveFrom: '2026-11-10', scheduled: null }

test('1.23.0 rosterListKind / rosterListFor: one list per person, by level', () => {
  const roster = [
    { id: 'a1', email: 'ada@x.com', firstName: 'Ada', surname: 'Admin', passwordSet: true, isActive: true, isSuperAdmin: true },
    { id: 'a2', email: 'rae@x.com', firstName: 'Rae', surname: 'Role', passwordSet: true, isActive: true, role: 'admin' },
    { id: 'm1', email: 'mo@x.com', firstName: 'Mo', surname: 'Manager', passwordSet: true, isActive: true, permissions: { manager: true } },
    { id: 'p1', email: 'pat@x.com', firstName: 'Pat', surname: 'Plain', passwordSet: true, isActive: true },
    { id: 'o1', email: 'ollie@x.com', firstName: 'Ollie', surname: 'Op', passwordSet: true, isActive: true, operativeMode: true },
    { id: 'o2', email: 'oona@x.com', firstName: 'Oona', surname: 'Role', passwordSet: true, isActive: true, role: 'operative' },
    // Same email as o1: one person, the signed-in document kept.
    { id: 'O1-INVITE', email: 'Ollie@x.com', firstName: 'Ollie', surname: 'Op', passwordSet: false, isActive: true, operativeMode: true },
    // Pending invite whose claim is gone: not listed.
    { id: 'o3', email: 'gone@x.com', firstName: 'Gone', surname: 'Invite', passwordSet: false, isActive: true, operativeMode: true },
  ]
  assert.deepEqual(roster.map((row) => R112.rosterListKind(row)), ['admins', 'admins', 'managers', 'managers', 'operatives', 'operatives', 'operatives', 'operatives'])
  assert.deepEqual(R112.rosterListFor('operatives', roster, ['ollie@x.com', 'oona@x.com']).map((row) => row.id), ['o1', 'o2'])
  assert.deepEqual(R112.rosterListFor('managers', roster, []).map((row) => row.id), ['m1', 'p1'])
  assert.deepEqual(R112.rosterListFor('admins', roster).map((row) => row.id), ['a1', 'a2'])
})

test('1.23.0 clashManagerIds: active admins and manager-flag people, never a flagless or inactive person', () => {
  assert.deepEqual(
    R112.clashManagerIds([
      { id: 'adm', role: 'admin' },
      { id: 'mgr', permissions: { manager: true } },
      { id: 'MGR', permissions: { manager: true } },
      { id: 'mgr-op', manager: true, operativeMode: true },
      { id: 'role-mgr', role: 'manager' },
      { id: 'flagless' },
      { id: 'gone', isActive: false, adminAccess: true },
    ]),
    ['adm', 'mgr', 'mgr-op', 'role-mgr']
  )
})

test('1.23.0 homeOverviewMetrics: organisation day, each person once under all their ids', () => {
  // 01:00 UTC on 4 Nov is 3 Nov in New York and 4 Nov in London.
  const nowMs = Date.parse('2026-11-04T01:00:00Z')
  const input = {
    nowMs,
    timeZone: 'America/New_York',
    viewer: { id: 'u-mgr', email: 'mo@x.com' },
    roster: [
      { id: 'u-op', email: 'ollie@x.com', isActive: true, operativeMode: true },
      { id: 'u-mgr', email: 'mo@x.com', isActive: true, permissions: { manager: true } },
      { id: 'u-flag', email: 'pat@x.com', isActive: true },
      { id: 'u-gone', email: 'gone@x.com', isActive: false, permissions: { manager: true } },
    ],
    operatives: [{ id: 'OP-ROW', email: 'Ollie@x.com' }],
    managers: [{ id: 'MGR-ROW', email: 'mo@x.com' }],
    tasks: [
      { status: 'To Do', dueDate: '2026-11-03', assignedManagerIds: ['mgr-row'] },
      { status: 'In Progress', dueDate: '2026-11-01', assignedManagerId: 'MGR-ROW' },
      { status: 'To Do', dueDate: '2026-11-09', assignedOperativeIds: ['u-mgr'] },
      { status: 'done', dueDate: '2026-11-01', assignedManagerId: 'MGR-ROW' },
      { status: 'To Do', dueDate: '2026-11-03', assignedOperativeIds: ['OP-ROW'] },
    ],
    bookings: [
      { operativeId: 'OP-ROW', date: '2026-11-03T15:00:00Z', status: 'Confirmed' },
      { operativeId: 'op-row', date: '2026-11-03T18:00:00Z', status: 'Tentative' },
      { operativeId: 'u-op', date: '2026-11-03T20:00:00Z', status: 'Confirmed' },
      { operativeId: 'u-op', date: '2026-11-04T15:00:00Z', status: 'Confirmed' },
      { operativeId: 'u-flag', date: '2026-11-03T15:00:00Z', status: 'Cancelled' },
    ],
    managerSiteBookings: [
      { userId: 'u-mgr', dayKey: '2026-11-03', locationType: 'project' },
      { userId: 'u-flag', dayKey: '2026-11-03', locationType: 'office' },
    ],
    holidays: [
      { userId: 'u-flag', startDayKey: '2026-11-02', endDayKey: '2026-11-04', status: 'approved' },
      { userId: 'u-gone', startDayKey: '2026-11-03', endDayKey: '2026-11-03', status: 'approved' },
      { operativeId: 'op-row', startDayKey: '2026-11-03', endDayKey: '2026-11-03', status: 'pending' },
    ],
  }
  assert.deepEqual(R112.homeOverviewMetrics(input), {
    dayKey: '2026-11-03',
    tasksDueToday: 1,
    tasksDueThisWeek: 2,
    tasksOverdue: 1,
    outstandingTasksAllUsers: 4,
    operativesOnSiteToday: 1,
    managersOnSiteToday: 1,
    peopleOnSiteToday: 2,
    operativesOnALToday: 0,
    managersOnALToday: 1,
  })
  assert.equal(R112.homeOverviewMetrics({ ...input, timeZone: 'Europe/London' }).dayKey, '2026-11-04')
})

test('1.23.0 qualificationExpiryCount: the warning rows, split expired / soon, optionally one person', () => {
  const input = {
    referenceIso: '2026-11-03T12:00:00Z',
    timeZone: 'Europe/London',
    operatives: [
      { id: 'op-1', isActive: true, name: 'Ollie', expiries: [
        { qualificationId: 'q1', name: 'CSCS', expiryIso: '2026-11-01T00:00:00Z' },
        { qualificationId: 'q2', name: 'IPAF', expiryIso: '2026-12-02T12:00:00Z' },
        { qualificationId: 'q3', name: 'PASMA', expiryIso: '2026-12-04T12:00:00Z' },
      ] },
      { id: 'op-2', isActive: false, name: 'Gone', expiries: [{ qualificationId: 'q1', name: 'CSCS', expiryIso: '2026-11-05T00:00:00Z' }] },
      { id: 'op-3', isActive: true, name: 'Ann', expiries: [{ qualificationId: 'q1', name: 'CSCS', expiryIso: '2026-11-05T00:00:00Z' }] },
    ],
  }
  assert.deepEqual(R112.qualificationExpiryCount(input), { expired: 1, expiringSoon: 2, total: 3 })
  assert.deepEqual(R112.qualificationExpiryCount({ ...input, operativeIds: ['OP-1'] }), { expired: 1, expiringSoon: 1, total: 2 })
})

test('1.23.0 isTaskOverdue / deadlineUrgency read the organisation day', () => {
  const nowMs = Date.parse('2026-11-04T01:00:00Z')
  const task = { status: 'To Do', dueDate: '2026-11-03T12:00:00Z' }
  assert.equal(R112.isTaskOverdue(task, nowMs, 'Europe/London'), true)
  assert.equal(R112.isTaskOverdue(task, nowMs, 'America/New_York'), false)
  assert.equal(R112.isTaskOverdue({ ...task, status: 'Completed' }, nowMs, 'Europe/London'), false)
  assert.equal(R112.isTaskOverdue({ status: 'To Do' }, nowMs, 'Europe/London'), false)
  const due = (key: string, status = 'open') => R112.deadlineUrgency({ status, due: key }, nowMs, 'Europe/London')
  assert.deepEqual(due('2026-11-02'), { kind: 'overdue', days: 2 })
  assert.deepEqual(due('2026-11-02', 'blocked'), { kind: 'overdue', days: 2 })
  assert.deepEqual(due('2026-11-05', 'blocked'), { kind: 'blocked' })
  assert.deepEqual(due('2026-11-04'), { kind: 'today' })
  assert.deepEqual(due('2026-11-05'), { kind: 'tomorrow' })
  assert.deepEqual(due('2026-11-07'), { kind: 'soon', days: 3 })
  assert.deepEqual(due('2026-11-11'), { kind: 'thisWeek', days: 7 })
  assert.deepEqual(due('2026-11-12'), { kind: 'later', days: 8 })
  assert.deepEqual(due('2026-11-01', 'complete'), { kind: 'complete' })
})

test('1.23.0 leaveDayKind: leave days only, fixed order, pending cancellation still approved', () => {
  const records = [
    { id: 'am', startDayKey: '2026-11-02', endDayKey: '2026-11-02', timeSlot: 'AM', status: 'approved' },
    { id: 'pm', startDayKey: '2026-11-02', endDayKey: '2026-11-02', timeSlot: 'PM', status: 'requested' },
    { id: 'week', startDayKey: '2026-11-06', endDayKey: '2026-11-10', timeSlot: 'FULL DAY', status: 'approved' },
    { id: 'dup', startDayKey: '2026-11-09', endDayKey: '2026-11-09', timeSlot: 'FULL DAY', status: 'pending' },
    { id: 'no', startDayKey: '2026-11-11', endDayKey: '2026-11-11', status: 'declined' },
  ]
  const day = (key: string) => R112.leaveDayKind(records, key, 'Europe/London')
  assert.deepEqual(day('2026-11-02'), { kind: 'pendingHalf', recordId: 'pm', isLocked: false })
  assert.deepEqual(day('2026-11-06'), { kind: 'approvedFull', recordId: 'week', isLocked: true })
  // Saturday inside a multi-day record is not a leave day (`leaveRecordDayKeys`).
  assert.deepEqual(day('2026-11-07'), { kind: 'none', recordId: null, isLocked: false })
  assert.deepEqual(day('2026-11-09'), { kind: 'pendingFull', recordId: 'dup', isLocked: true })
  assert.deepEqual(R112.leaveDayKind(records, '2026-11-10', 'Europe/London', ['2026-11-10']).kind, 'none')
  assert.equal(day('2026-11-11').kind, 'none')
})

test('1.23.0 siteMapPins / jobTileBadges: occupied days, one person once, inactive jobs off the map', () => {
  const people = [
    { id: 'u-op', email: 'ollie@x.com' },
    { id: 'OP-ROW', email: 'Ollie@x.com' },
    { id: 'u-mgr', email: 'mo@x.com' },
  ]
  const bookings = [
    { projectId: 'JOB-1', operativeId: 'OP-ROW', dayKey: '2026-11-03', status: 'Confirmed' },
    { projectId: 'job-1', operativeId: 'u-op', dayKey: '2026-11-03', status: 'Tentative' },
    { projectId: 'job-1', operativeId: 'other', dayKey: '2026-11-03', status: 'Cancelled' },
    { projectId: 'job-1', operativeId: 'old', dayKey: '2026-10-01', status: 'Tentative' },
  ]
  const managerSiteBookings = [
    { userId: 'u-mgr', locationId: 'job-1', locationType: 'small_work', dayKey: '2026-11-03' },
    { userId: 'u-mgr', locationId: 'job-1', locationType: 'office', dayKey: '2026-11-03' },
  ]
  assert.deepEqual(
    R112.siteMapPins({ jobs: [{ id: 'job-1' }, { id: 'job-2', isLive: false }, { id: 'job-3', isLive: true }], bookings, managerSiteBookings, dayKey: '2026-11-03', people }),
    [
      { jobId: 'job-1', bookingCount: 3, peopleCount: 2 },
      { jobId: 'job-3', bookingCount: 0, peopleCount: 0 },
    ]
  )
  assert.deepEqual(
    R112.jobTileBadges({
      jobId: 'job-1',
      bookings,
      managerSiteBookings,
      subcontractorBookings: [
        { projectId: 'job-1', subcontractorId: 'sub-1', status: 'Confirmed' },
        { projectId: 'job-1', subcontractorId: 'SUB-1', status: 'Tentative' },
        { projectId: 'job-1', subcontractorId: 'sub-2', status: 'Cancelled' },
      ],
      tasks: [{ projectId: 'JOB-1', status: 'To Do' }, { projectId: 'job-1', status: 'done' }, { projectId: 'job-2' }],
      people,
    }),
    // Ollie under OP-ROW and u-op is one person; 'old' is another; Mo; one firm.
    { tentativeBookings: 2, openTasks: 1, activeUsers: 4 }
  )
})

test('1.23.0 mergeVariationSources / openVariationCount', () => {
  const merged = R112.mergeVariationSources(
    [{ id: 'V1', updatedAtMs: 10, status: 'open' }, { id: 'v2', updatedAtMs: 5, status: 'closed' }],
    [{ id: 'v1', updatedAtMs: 20, status: 'closed' }, { id: 'v2', updatedAtMs: 5, status: 'open' }, { id: 'v3', status: 'OPEN' }],
    [{ id: 'v4', updatedAtMs: 1, status: 'open', isDeleted: true }]
  )
  assert.deepEqual(merged.map((row) => [row.id, row.status]), [['v1', 'closed'], ['v2', 'closed'], ['v3', 'OPEN'], ['v4', 'open']])
  assert.equal(R112.openVariationCount(merged), 1)
})

test('1.23.0 per-day hours: overlap flag, clashes, leave cover and booking conflicts read the booked day', () => {
  // A full day and 13:00–15:00: overlap under 07:30–16:00 (3 Nov), not under 06:00–12:00 (10 Nov).
  const bookings = [
    { id: 'a', dayKey: '2026-11-03', timeSlot: 'FULL DAY' },
    { id: 'b', dayKey: '2026-11-03', timeSlot: 'CUSTOM_HOURS', workStartTime: '13:00', workEndTime: '15:00' },
    { id: 'c', dayKey: '2026-11-10', timeSlot: 'FULL DAY' },
    { id: 'd', dayKey: '2026-11-10', timeSlot: 'CUSTOM_HOURS', workStartTime: '13:00', workEndTime: '15:00' },
  ]
  assert.deepEqual(R112.overlappingBookingIds(bookings, state123), ['a', 'b'])
  assert.deepEqual(R112.overlappingBookingIds(bookings, policy123Early), ['a', 'b', 'c', 'd'])

  const people = { accounts: [{ id: 'u1', email: 'mo@x.com' }], operatives: [] }
  const managerBookings = bookings.map((row) => ({ ...row, userId: 'u1' }))
  const groups = R112.managerClashGroups({ managerBookings, operativeBookings: [], people, managerIds: ['u1'], day: state123 })
  assert.deepEqual(groups.map((group) => group.dayKey), ['2026-11-03'])
  const opGroups = R112.operativeClashGroups({ operativeBookings: bookings.map((row) => ({ ...row, operativeId: 'op1' })), people: { accounts: [], operatives: [] }, day: state123 })
  assert.deepEqual(opGroups.map((group) => group.dayKey), ['2026-11-03'])

  // A booking being made: 13:00–15:00 against an existing full day.
  const existing = [{ id: 'x3', dayKey: '2026-11-03', timeSlot: 'FULL DAY' }, { id: 'x10', dayKey: '2026-11-10', timeSlot: 'FULL DAY' }]
  const request = (dayKey: string) => ({ dayKey, timeSlot: 'CUSTOM_HOURS', workStartTime: '13:00', workEndTime: '15:00' })
  assert.deepEqual(R112.bookingRequestClashIds({ request: request('2026-11-03'), existing, day: state123 }), ['x3'])
  assert.deepEqual(R112.bookingRequestClashIds({ request: request('2026-11-10'), existing, day: state123 }), [])
  assert.deepEqual(R112.bookingRequestClashIds({ request: request('2026-11-10'), existing, day: policy123Early }), ['x10'])
  // Touching times never clash; a cancelled booking never clashes; an overnight booking reaches the next morning.
  assert.deepEqual(
    R112.bookingRequestClashIds({
      request: { dayKey: '2026-11-04', timeSlot: 'CUSTOM_HOURS', workStartTime: '05:00', workEndTime: '08:00' },
      existing: [
        { id: 'touch', dayKey: '2026-11-04', timeSlot: 'CUSTOM_HOURS', workStartTime: '08:00', workEndTime: '10:00' },
        { id: 'gone', dayKey: '2026-11-04', timeSlot: 'CUSTOM_HOURS', workStartTime: '06:00', workEndTime: '07:00', status: 'Cancelled' },
        { id: 'night', dayKey: '2026-11-03', timeSlot: 'CUSTOM_HOURS', workStartTime: '22:00', workEndTime: '06:00' },
      ],
      day: state123,
    }),
    ['night']
  )

  // Leave halves follow the day: PM leave on 10 Nov is 09:00–12:00, so a 13:00 booking does not conflict.
  const holidays = [
    { id: 'h3', userId: 'u1', startDayKey: '2026-11-03', endDayKey: '2026-11-03', timeSlot: 'PM', status: 'approved' },
    { id: 'h10', userId: 'u1', startDayKey: '2026-11-10', endDayKey: '2026-11-10', timeSlot: 'PM', status: 'approved' },
  ]
  const conflicts = R112.bookingLeaveConflicts({
    people: [{ id: 'u1' }],
    dayKeys: ['2026-11-03', '2026-11-10'],
    holidays,
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: '13:00',
    workEndTime: '15:00',
    day: state123,
  })
  assert.deepEqual(conflicts.map((row) => row.dayKey), ['2026-11-03'])

  // Leave cover: AM leave on 10 Nov leaves 09:00–12:00 (less the 09:00–09:15 break) to cover.
  const rows = R112.leaveCoverageRows({
    timeZone: 'Europe/London',
    startDayKey: '2026-11-10',
    endDayKey: '2026-11-10',
    day: state123,
    includeWeekends: false,
    people: [{ personKey: 'u1', name: 'Mo', userId: 'u1', operativeIds: [] }],
    leave: [{ id: 'h', userId: 'u1', startDayKey: '2026-11-10', endDayKey: '2026-11-10', timeSlot: 'AM', approved: true }],
    bookings: [],
  })
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0].workingWindow, { start: 9 * 60, end: 12 * 60 })
  assert.equal(rows[0].missingHours, 2.75)
})

test('1.23.1 userMissingLevel / usersMissingLevel: no level flag and not an admin by role', () => {
  const roster = [
    { id: 'flagless', email: 'pat@x.com', role: 'manager' },
    { id: 'basic', email: 'b@x.com', role: 'basic', permissions: { manager: false, operativeMode: false } },
    { id: 'mgr', email: 'm@x.com', permissions: { manager: true } },
    { id: 'op', email: 'o@x.com', operativeMode: true },
    { id: 'adm-role', email: 'a@x.com', role: 'admin' },
    { id: 'sa', email: 's@x.com', isSuperAdmin: true },
    { id: 'gone', email: '', firstName: 'Deleted', surname: 'user' },
  ]
  assert.deepEqual(R112.usersMissingLevel(roster).map((row) => row.id), ['flagless', 'basic'])
  assert.equal(R112.userMissingLevel(null), false)
  assert.equal(R112.USER_MISSING_LEVEL_MESSAGE, 'Has no user level: open in Manage Users and pick one')
})

test('1.23.1 weekend named slots: a Saturday Full day is that Saturday\'s own window (07:30–13:00), not the weekday day', () => {
  // Weekday 07:30–16:00; Saturday set window 07:30–13:00 (default); Saturday 7 Nov 2026.
  const policy = parsePolicy112({
    standardDayStart: '07:30',
    standardDayEnd: '16:00',
    breakWindowStart: '12:00',
    breakWindowEnd: '12:30',
    unpaidBreakMinutes: 30,
    saturday: { allHoursAtMultiplierMode: false, allHoursMultiplier: 2, definedWindowStart: '07:30', definedWindowEnd: '13:00', countsAsStandardHours: 8, outsideWindowMultiplier: 2 },
  })
  assert.deepEqual(R112.bookingStandardDayOn(policy, '2026-11-07'), {
    standardDayStart: '07:30',
    standardDayEnd: '13:00',
    breakWindowStart: '12:00',
    breakWindowEnd: '12:30',
  })
  assert.equal(R112.bookingStandardDayOn(policy, '2026-11-06')?.standardDayEnd, '16:00')
  const fullDay = { id: 'sat-full', dayKey: '2026-11-07', timeSlot: 'FULL DAY' }
  const inside = { id: 'sat-in', dayKey: '2026-11-07', timeSlot: 'CUSTOM_HOURS', workStartTime: '10:00', workEndTime: '12:00' }
  const outside = { id: 'sat-out', dayKey: '2026-11-07', timeSlot: 'CUSTOM_HOURS', workStartTime: '14:00', workEndTime: '16:00' }
  // Overlap flag (timesheets)
  assert.deepEqual(R112.overlappingBookingIds([fullDay, inside], policy), ['sat-full', 'sat-in'])
  assert.deepEqual(R112.overlappingBookingIds([fullDay, outside], policy), [])
  // Warnings (operative clashes)
  const people = { accounts: [], operatives: [] }
  const withOp = (rows: Array<Record<string, string>>) => rows.map((row) => ({ ...row, operativeId: 'op1' })) as never
  assert.equal(R112.operativeClashGroups({ operativeBookings: withOp([fullDay, inside]), people, day: policy }).length, 1)
  assert.equal(R112.operativeClashGroups({ operativeBookings: withOp([fullDay, outside]), people, day: policy }).length, 0)
  // Booking being made
  const request = (row: Record<string, string>) => ({ dayKey: row.dayKey, timeSlot: row.timeSlot, workStartTime: row.workStartTime, workEndTime: row.workEndTime })
  assert.deepEqual(R112.bookingRequestClashIds({ request: request(inside), existing: [fullDay], day: policy }), ['sat-full'])
  assert.deepEqual(R112.bookingRequestClashIds({ request: request(outside), existing: [fullDay], day: policy }), [])
  assert.deepEqual(R112.bookingRequestClashIds({ request: { dayKey: '2026-11-07', timeSlot: 'FULL DAY' }, existing: [outside], day: policy }), [])
  // Leave: PM leave on Saturday is the later half of 07:30–13:00 (10:15–13:00), so 14:00–16:00 does not conflict.
  const holidays = [{ id: 'h', userId: 'u1', startDayKey: '2026-11-07', endDayKey: '2026-11-07', timeSlot: 'PM', status: 'approved' }]
  const leave = (row: Record<string, string>) =>
    R112.bookingLeaveConflicts({ people: [{ id: 'u1' }], dayKeys: ['2026-11-07'], holidays, timeSlot: row.timeSlot, workStartTime: row.workStartTime, workEndTime: row.workEndTime, day: policy }).length
  assert.equal(leave(inside), 1)
  assert.equal(leave(outside), 0)
  // Leave cover: AM leave on Saturday leaves 10:15–13:00 (less the 12:00–12:30 lunch) to cover.
  const cover = R112.leaveCoverageRows({
    timeZone: 'Europe/London',
    startDayKey: '2026-11-07',
    endDayKey: '2026-11-07',
    day: policy,
    includeWeekends: true,
    people: [{ personKey: 'u1', name: 'Mo', userId: 'u1', operativeIds: [] }],
    leave: [{ id: 'h', userId: 'u1', startDayKey: '2026-11-07', endDayKey: '2026-11-07', timeSlot: 'AM', approved: true }],
    bookings: [],
  })
  assert.deepEqual(cover[0].workingWindow, { start: 10 * 60 + 15, end: 13 * 60 })
})

// ---------------------------------------------------------------------------------------------------------------
// 1.24.0 — line-manager picks after a level change; material email envelope
// ---------------------------------------------------------------------------------------------------------------
import {
  lineManagerCandidates as r124Candidates,
  lineManagerSelectionAfterLevelChange as r124AfterLevel,
} from './lineManagers.ts'
import {
  MATERIAL_REQUEST_FROM_SUFFIX as r124FromSuffix,
  materialRequestEmailEnvelope as r124Envelope,
  materialRequestEmailSubject as r124Subject,
} from './materialOrderAccess.ts'

const r124Roster = [
  { id: 'adm', email: 'adm@x.com', firstName: 'Ann', surname: 'Admin', isActive: true, passwordSet: true, role: 'admin', adminAccess: true },
  { id: 'mgr', email: 'mgr@x.com', firstName: 'Max', surname: 'Manager', isActive: true, passwordSet: true, role: 'manager', manager: true },
  { id: 'MGR-OLD', email: 'MGR@x.com', firstName: 'Max', surname: 'Manager', isActive: false, passwordSet: true, role: 'manager', manager: true },
  { id: 'gone', email: 'gone@x.com', firstName: 'Gil', surname: 'Gone', isActive: false, passwordSet: true, role: 'manager', manager: true },
  { id: 'pend', email: 'pend@x.com', firstName: 'Pat', surname: 'Pending', isActive: true, passwordSet: false, role: 'manager', manager: true },
  { id: 'op', email: 'op@x.com', firstName: 'Oli', surname: 'Operative', isActive: true, passwordSet: true, role: 'operative', operativeMode: true },
]

test('1.24.0 lineManagerSelectionAfterLevelChange: keeps the picks that are still candidates, drops the rest', () => {
  const picks = { lineManagerIds: ['mgr', 'gone', 'pend', 'op', 'nobody', 'adm'], hasNoLineManager: false }
  for (const level of ['operative', 'manager', 'admin'] as const) {
    const out = r124AfterLevel(picks, level, r124Roster)
    assert.deepEqual(out.lineManagerIds, ['mgr', 'adm'], level)
    assert.deepEqual(out.dropped, ['gone', 'pend', 'op', 'nobody'], level)
    assert.equal(out.hasNoLineManager, false)
    // Every kept pick is a candidate.
    const ids = r124Candidates(null, r124Roster).map((row) => row.id)
    for (const id of out.lineManagerIds) assert.ok(ids.includes(id))
  }
})

test('1.24.0 lineManagerSelectionAfterLevelChange: an alias id or another letter case keeps the person once, as the candidate id', () => {
  const out = r124AfterLevel({ lineManagerIds: ['MGR-OLD', 'mgr', 'ADM'] }, 'operative', r124Roster)
  assert.deepEqual(out.lineManagerIds, ['mgr', 'adm'])
  assert.deepEqual(out.dropped, [])
})

test('1.24.0 lineManagerSelectionAfterLevelChange: "No line manager" stays only for an admin', () => {
  assert.equal(r124AfterLevel({ lineManagerIds: [], hasNoLineManager: true }, 'admin', r124Roster).hasNoLineManager, true)
  assert.equal(r124AfterLevel({ lineManagerIds: [], hasNoLineManager: true }, 'manager', r124Roster).hasNoLineManager, false)
  assert.equal(r124AfterLevel({ lineManagerIds: [], hasNoLineManager: true }, 'operative', r124Roster).hasNoLineManager, false)
  assert.deepEqual(r124AfterLevel(null, 'manager', r124Roster), { lineManagerIds: [], hasNoLineManager: false, dropped: [] })
})

test('1.24.0 lineManagerSelectionAfterLevelChange: the person being added is never kept as their own line manager', () => {
  const out = r124AfterLevel({ lineManagerIds: ['mgr', 'adm'] }, 'manager', r124Roster, { id: 'invite-draft', email: 'MGR@x.com' })
  assert.deepEqual(out.lineManagerIds, ['adm'])
  assert.deepEqual(out.dropped, ['mgr'])
})

test('1.24.0 materialRequestEmailSubject: the subjects are unchanged', () => {
  assert.equal(r124Subject('quote', 'J-101', 'Acme Ltd'), 'Quote request — J-101 — Acme Ltd')
  assert.equal(r124Subject('order', 'J-101', 'Acme Ltd'), 'Material order request — J-101 — Acme Ltd')
})

test('1.24.0 materialRequestEmailEnvelope: subject, From name, Reply-To and CC from the verified caller', () => {
  assert.deepEqual(
    r124Envelope({ requestType: 'quote', jobNumber: 'J-1', companyName: 'Acme', caller: { name: ' Sam Smith ', email: 'Sam@Acme.com ' } }),
    { subject: 'Quote request — J-1 — Acme', fromName: `Sam Smith${r124FromSuffix}`, replyTo: 'sam@acme.com', cc: ['sam@acme.com'] }
  )
  assert.equal(r124FromSuffix, ' via Project Planner')
  // No name, or a name that is just the email: the organisation From is used ('' here).
  assert.equal(r124Envelope({ requestType: 'order', jobNumber: 'J', companyName: 'C', caller: { name: '', email: 'a@b.co' } }).fromName, '')
  assert.equal(r124Envelope({ requestType: 'order', jobNumber: 'J', companyName: 'C', caller: { name: 'A@B.co', email: 'a@b.co' } }).fromName, '')
  // Not an email: no Reply-To, no CC.
  assert.deepEqual(r124Envelope({ requestType: 'order', jobNumber: 'J', companyName: 'C', caller: { name: 'Sam', email: 'nope' } }), {
    subject: 'Material order request — J — C',
    fromName: 'Sam via Project Planner',
    replyTo: '',
    cc: [],
  })
  assert.deepEqual(r124Envelope({ requestType: 'quote', jobNumber: 'J', companyName: 'C' }).cc, [])
})

// ---------------------------------------------------------------------------------------------------------------
// 1.25.0 — uploaded files are never deleted outright or lost (§24)
// ---------------------------------------------------------------------------------------------------------------
import {
  FILE_UNDO_WINDOW_MINUTES as r125UndoMinutes,
  fileDeletePermission as r125Delete,
  storedFileKind as r125Kind,
  storedFileObjectName as r125ObjectName,
  storedFileUploader as r125Uploader,
} from './storedFiles.ts'

const r125Admin = { isSuperAdmin: false, isAdmin: true, isManager: false, isOperativeMode: false }
const r125Manager = { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }
const r125Operative = { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: true }
const r125T0 = 1_762_000_000_000
const r125Cert = `organizations/org-a/operatives/op1/qualifications/q1/certificates/op-a_${r125T0}.pdf`

test('1.25.0 storedFileKind: every path both apps upload to, and nothing else', () => {
  const kinds = [
    ['organizations/org-a/userProfiles/u1/profile.jpg', 'profile_photo'],
    ['organizations/org-a/branding/company_logo/u1_1.png', 'company_logo'],
    ['organizations/org-a/timesheetExports/1700000000_Ann.pdf', 'timesheet_export'],
    [r125Cert, 'qualification_certificate'],
    ['organizations/org-a/healthSafety/job/variations/u1_1.jpg', 'variation_evidence'],
    ['organizations/org-a/healthSafety/job/variationEvidence/u1_1.jpg', 'variation_evidence'],
    ['organizations/org-a/variations/v1/u1_1.jpg', 'variation_evidence'],
    ['organizations/org-a/siteAudits/a1/images/u1_1.jpg', 'site_audit_photo'],
    ['organizations/org-a/tasks/t1/u1_1.pdf', 'task_attachment'],
    ['organizations/org-a/tasks/t1/files/u1_1.pdf', 'task_attachment'],
    ['organizations/org-a/healthSafety/job/rams/u1_1.pdf', 'health_safety'],
  ] as const
  for (const [path, kind] of kinds) assert.equal(r125Kind(path)?.kind, kind, path)
  assert.equal(r125Kind('organizations/org-a/misc/x.bin'), null)
  assert.equal(r125Kind('organizations/org-a/../org-b/tasks/t/x'), null)
  assert.equal(r125Kind('users/u1/profile.jpg'), null)
  assert.equal(r125Kind('organizations/org-a/userProfiles/u1/profile.jpg')?.ownerUserId, 'u1')
})

test('1.25.0 storedFileObjectName: a new object per upload, never the original name', () => {
  assert.equal(r125ObjectName({ uid: 'op-a', unixMs: 1700000000000, extension: '.PDF' }), 'op-a_1700000000000.pdf')
  assert.equal(r125ObjectName({ uid: 'op-a', unixMs: 2 }), 'op-a_2')
  assert.equal(r125ObjectName({ uid: '', unixMs: 2, extension: 'pdf' }), null)
  assert.equal(r125ObjectName({ uid: 'a/b', unixMs: 2, extension: 'pdf' }), null)
  assert.deepEqual(r125Uploader(r125Cert), { uploaderUserId: 'op-a', uploadedAtMs: r125T0 })
  assert.equal(r125Uploader('organizations/org-a/timesheetExports/1700000000_Ann.pdf'), null)
  assert.equal(r125Uploader('organizations/org-a/tasks/t1/old drawing.pdf'), null)
})

test('1.25.0 fileDeletePermission: the uploader within the undo window, or an admin of this organisation', () => {
  const base = { storagePath: r125Cert, organizationId: 'org-a', nowMs: r125T0 + 60_000 }
  assert.equal(r125UndoMinutes, 15)
  const own = r125Delete({ ...base, viewerUserId: 'op-a', viewerRole: r125Operative })
  assert.deepEqual(own, { allowed: true, reason: 'uploader_undo', undoEndsAtMs: r125T0 + 15 * 60_000 })
  const late = r125Delete({ ...base, nowMs: r125T0 + 15 * 60_000, viewerUserId: 'op-a', viewerRole: r125Operative })
  assert.deepEqual(late, { allowed: false, reason: 'undo_expired', undoEndsAtMs: r125T0 + 15 * 60_000 })
  // Server time when the app has it wins over the name.
  assert.equal(r125Delete({ ...base, nowMs: r125T0 + 20 * 60_000, uploadedAtMs: r125T0 + 10 * 60_000, viewerUserId: 'op-a', viewerRole: r125Operative }).allowed, true)
  // Another person, a manager included, never deletes someone else's file.
  assert.deepEqual(r125Delete({ ...base, viewerUserId: 'mgr', viewerRole: r125Manager }), { allowed: false, reason: 'not_uploader', undoEndsAtMs: null })
  // Uploader ids compare exactly (Auth uids are case-sensitive, as in storage.rules).
  assert.equal(r125Delete({ ...base, viewerUserId: 'OP-A', viewerRole: r125Operative }).allowed, false)
  assert.deepEqual(r125Delete({ ...base, nowMs: r125T0 + 86_400_000, viewerUserId: 'adm', viewerRole: r125Admin }), { allowed: true, reason: 'admin', undoEndsAtMs: null })
  assert.equal(r125Delete({ ...base, viewerUserId: 'adm', viewerRole: { ...r125Admin, isAdmin: false, isOperativeMode: true } }).allowed, false)
  assert.equal(r125Delete({ ...base, organizationId: 'org-b', viewerUserId: 'adm', viewerRole: r125Admin }).reason, 'other_organization')
  assert.equal(r125Delete({ ...base, viewerUserId: '', viewerRole: r125Admin }).reason, 'signed_out')
})

test('1.25.0 fileDeletePermission: profile photos, logos and timesheet exports', () => {
  const photo = { storagePath: 'organizations/org-a/userProfiles/op-a/profile.jpg', organizationId: 'org-a', nowMs: r125T0 }
  assert.equal(r125Delete({ ...photo, viewerUserId: 'op-a', viewerRole: r125Operative }).reason, 'own_profile_photo')
  assert.equal(r125Delete({ ...photo, viewerUserId: 'mgr', viewerRole: r125Manager }).allowed, false)
  const logo = { storagePath: `organizations/org-a/branding/company_logo/mgr_${r125T0}.png`, organizationId: 'org-a', nowMs: r125T0 }
  assert.equal(r125Delete({ ...logo, viewerUserId: 'mgr', viewerRole: r125Manager }).reason, 'admin_only')
  assert.equal(r125Delete({ ...logo, viewerUserId: 'adm', viewerRole: r125Admin }).allowed, true)
  const exp = { storagePath: 'organizations/org-a/timesheetExports/1762000000_Ann.pdf', organizationId: 'org-a', nowMs: r125T0 }
  assert.equal(r125Delete({ ...exp, viewerUserId: 'mgr', viewerRole: r125Manager }).reason, 'admin_only')
  // An older upload whose name says nothing about its uploader is deletable by admins only.
  const old = { storagePath: 'organizations/org-a/tasks/t1/drawing.pdf', organizationId: 'org-a', nowMs: r125T0 }
  assert.equal(r125Delete({ ...old, viewerUserId: 'op-a', viewerRole: r125Operative }).reason, 'not_uploader')
  assert.equal(r125Delete({ ...old, viewerUserId: 'unknown', viewerRole: r125Admin }).allowed, true)
})

test('1.25.0 storage.rules: no member-wide delete or overwrite is left, and the undo window matches', () => {
  const rules = readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8')
  assert.doesNotMatch(rules, /allow delete: if orgMember\(orgId\);/)
  assert.doesNotMatch(rules, /allow create, update: if memberSizedWrite/)
  assert.doesNotMatch(rules, /allow delete: if staffLike\(orgId\);/)
  assert.match(rules, new RegExp(`duration\\.value\\(${r125UndoMinutes}, 'm'\\)`))
})

// MARK: - Rulebook 1.26.0 security switches

import {
  payProfileReadPlan as r126PayProfileReadPlan,
  rateHistoryQueryPlan as r126RateHistoryPlan,
  securitySwitchOn as r126SwitchOn,
  securitySwitches as r126Switches,
  sharedDocumentPayWrite as r126SharedPayWrite,
} from './index'

test('1.26.0 securitySwitches: platform-wide true, or this organisation in the list; anything else is off', () => {
  assert.deepEqual(r126Switches(null, 'org-a'), { enforcedReads: false, privatePay: false })
  assert.deepEqual(r126Switches({}, 'org-a'), { enforcedReads: false, privatePay: false })
  assert.deepEqual(r126Switches({ enforcedReads: true }, 'org-a'), { enforcedReads: true, privatePay: false })
  assert.deepEqual(r126Switches({ enforcedReads: 'true', privatePay: 1 }, 'org-a'), { enforcedReads: false, privatePay: false })
  const config = { enforcedReadsOrganizationIds: ['org-a'], privatePayOrganizationIds: ['ORG-B'] }
  assert.deepEqual(r126Switches(config, 'org-a'), { enforcedReads: true, privatePay: false })
  assert.deepEqual(r126Switches(config, 'org-b'), { enforcedReads: false, privatePay: false })
  assert.equal(r126SwitchOn(config, 'ORG-B', 'privatePay'), true)
  assert.equal(r126SwitchOn({ privatePayOrganizationIds: 'org-a' }, 'org-a', 'privatePay'), false)
  assert.equal(r126SwitchOn(config, '', 'enforcedReads'), false)
  // false at platform level does not switch off a listed organisation (the rules read the same way).
  assert.equal(r126SwitchOn({ enforcedReads: false, enforcedReadsOrganizationIds: ['org-a'] }, 'org-a', 'enforcedReads'), true)
})

test('1.26.0 jobQueryPlan / bookingQueryPlan follow the switch value the app passes', () => {
  const manager = { role: { isManager: true }, ids: ['m'], uid: 'm' }
  const plan = (on: boolean) => R112.jobQueryPlan(manager as any, { enforced: r126SwitchOn({ enforcedReadsOrganizationIds: on ? ['o'] : [] }, 'o', 'enforcedReads') })
  assert.deepEqual(plan(false).queries.map((q: any) => q.kind), ['all', 'all'])
  // 1.33.0: every manager lists every job and reads every booking with the switch on too.
  assert.deepEqual(plan(true).queries.map((q: any) => q.kind), ['all', 'all'])
  assert.equal(R112.readsEveryBooking(manager as any, { enforced: false }), true)
  assert.equal(R112.readsEveryBooking(manager as any, { enforced: true }), true)
  // Operatives read their jobs by id whatever the switch.
  const op = { role: { isOperativeMode: true }, ids: ['op'], uid: 'op' }
  for (const enforced of [false, true]) {
    assert.deepEqual(R112.jobQueryPlan(op as any, { documentIds: ['j1'], enforced }).queries.map((q: any) => q.kind), ['documents', 'documents'])
    assert.equal(R112.bookingQueryPlan(op as any, [], { ownBookingIds: ['op'], enforced }).readsEveryBooking, false)
  }
})

test('1.26.0 rateHistoryQueryPlan / payProfileReadPlan: admins read all; others only the people whose pay they may see', () => {
  const admin = { id: 'adm', adminAccess: true }
  const lm = { id: 'lm', manager: true }
  const opsMgr = { id: 'om', manager: true, permissions: { operatives: true } }
  const op = { id: 'op', operativeMode: true, assignedManagerUserIds: ['lm'] }
  const other = { id: 'op2', operativeMode: true, assignedManagerUserIds: ['adm'] }
  const mgr2 = { id: 'm2', manager: true, assignedManagerUserIds: ['adm'] }
  const roster = [admin, lm, opsMgr, op, other, mgr2].map((p) => ({ ...p, email: `${p.id}@t.com`, isActive: true }))
  const subjects = [op, other, mgr2]
  assert.deepEqual(r126RateHistoryPlan(op, subjects, roster, { privatePay: false }), { kind: 'all' })
  assert.deepEqual(r126RateHistoryPlan(op, subjects, roster), { kind: 'all' })
  assert.deepEqual(r126RateHistoryPlan(admin, subjects, roster, { privatePay: true }), { kind: 'all' })
  assert.deepEqual(r126RateHistoryPlan(op, subjects, roster, { privatePay: true }), { kind: 'people', userIds: ['op'], operativeIds: [] })
  assert.deepEqual(r126RateHistoryPlan(lm, subjects, roster, { privatePay: true }), { kind: 'people', userIds: ['lm', 'op'], operativeIds: [] })
  assert.deepEqual(r126RateHistoryPlan(opsMgr, subjects, roster, { privatePay: true }), { kind: 'people', userIds: ['om', 'op', 'op2'], operativeIds: [] })
  assert.deepEqual(r126RateHistoryPlan(null, subjects, roster, { privatePay: true }), { kind: 'people', userIds: [], operativeIds: [] })
  assert.deepEqual(r126RateHistoryPlan({ ...admin, isActive: false }, subjects, roster, { privatePay: true }), { kind: 'people', userIds: ['adm'], operativeIds: [] })
  assert.deepEqual(r126PayProfileReadPlan(admin, subjects, roster), { kind: 'all' })
  assert.deepEqual(r126PayProfileReadPlan(lm, subjects, roster), { kind: 'documents', ids: ['lm', 'op'] })
  assert.deepEqual(r126PayProfileReadPlan({ id: 'x', isPlatformOwner: true }, subjects, roster), { kind: 'all' })
})

test('1.26.0 sharedDocumentPayWrite: pay stays on shared documents only while privatePay is off', () => {
  const write = { firstName: 'Pat', dayRate: 200, payBasis: 'day', hourlyRate: null, employmentType: 'self_employed' }
  assert.deepEqual(r126SharedPayWrite(write, { privatePay: false }), write)
  assert.deepEqual(r126SharedPayWrite(write), write)
  assert.deepEqual(r126SharedPayWrite(write, { privatePay: true }), { firstName: 'Pat' })
  assert.deepEqual(r126SharedPayWrite({ dayRate: 1 }, { privatePay: true }), {})
})

// MARK: - Rulebook 1.26.1 pay editor starting values

import {
  payEditorStartingValues as r1261PayEditorStart,
  payRateChangeWrites as r1261PayRateChangeWrites,
  payProfileWriteFieldsFromProfileWrite as r1261PayProfileWrite,
  userProfileWriteFields as r1261UserProfileWrite,
} from './index'

test('1.26.1 payEditorStartingValues: privatePay off — the person as stored (same object), exactly as before', () => {
  const users = { firstName: 'Pat', dayRate: 120, payBasis: 'day', employmentType: 'self_employed' }
  const stale = { subjectId: 'u1', fields: { dayRate: 150, payBasis: 'day', employmentType: 'paye' } }
  for (const options of [{ privatePay: false }, {}, null, undefined]) {
    const start = r1261PayEditorStart(users, stale, options)
    assert.equal(start.record, users)
    assert.equal(start.source, 'users')
    assert.equal(start.rate, 120)
    assert.equal(start.employmentType, 'self_employed')
  }
  assert.deepEqual(users, { firstName: 'Pat', dayRate: 120, payBasis: 'day', employmentType: 'self_employed' })
  // No pay and no basis: "rate not set" (readStoredRates), as the editors read it today.
  assert.deepEqual(r1261PayEditorStart({ firstName: 'Pat' }, null, { privatePay: false }).pay, {
    payBasis: null,
    dayRate: null,
    hourlyRate: null,
  })
})

test('1.26.1 payEditorStartingValues: privatePay on — a stale users rate gives the editor the profile rate, and the save diff and history row start from it', () => {
  const users = { firstName: 'Pat', dayRate: 120, payBasis: 'day', employmentType: 'self_employed' }
  const profile = { subjectId: 'u1', fields: { dayRate: 150, payBasis: 'day' } }
  const start = r1261PayEditorStart(users, profile, { privatePay: true })
  assert.equal(start.source, 'payProfile')
  assert.equal(start.rate, 150)
  assert.deepEqual(start.record, { ...users, dayRate: 150 })
  assert.deepEqual(users.dayRate, 120, 'the stored document is not changed')

  // Saving the rate shown (unchanged) writes no pay and no history row. From the stale users copy it would have.
  const kept = { ...start.record, firstName: 'Patrick' }
  assert.deepEqual(r1261UserProfileWrite(start.record, kept).set, { firstName: 'Patrick' })
  assert.equal(r1261PayProfileWrite('u1', r1261UserProfileWrite(start.record, kept).set), null)
  assert.ok('dayRate' in r1261UserProfileWrite(users, kept).set, 'the old baseline saw a rate change')
  const unchanged = r1261PayRateChangeWrites({
    userId: 'u1',
    previousProfile: { rate: start.rate, payBasis: start.pay.payBasis },
    nextProfile: { rate: 150, payBasis: 'day' },
    history: [],
    effectiveDayKey: '2026-11-04',
    seedEffective: '2026-01-05',
    timeZone: 'Europe/London',
  })
  assert.deepEqual(unchanged, { ok: true, rows: [] })

  // A real change: the diff and the pay-profile write carry the new rate; the seed row is the rate in force (150).
  const edited = { ...start.record, dayRate: 180 }
  const diff = r1261UserProfileWrite(start.record, edited).set
  assert.equal(diff.dayRate, 180)
  assert.deepEqual(r1261PayProfileWrite('u1', diff), { userId: 'u1', ...diff })
  const change = r1261PayRateChangeWrites({
    userId: 'u1',
    previousProfile: { rate: start.rate, payBasis: start.pay.payBasis },
    nextProfile: { rate: 180, payBasis: 'day' },
    history: [],
    effectiveDayKey: '2026-11-04',
    seedEffective: '2026-01-05',
    timeZone: 'Europe/London',
  })
  assert.ok(change.ok)
  assert.deepEqual(
    change.ok ? change.rows.map((row) => row.dayRate) : [],
    [150, 180],
    'seed of the profile rate (never the stale 120), then the new rate'
  )

  // No readable profile: the users document; a profile that cleared the rate wins (rate not set).
  assert.equal(r1261PayEditorStart(users, null, { privatePay: true }).record, users)
  const cleared = r1261PayEditorStart(users, { subjectId: 'u1', fields: { dayRate: null, payBasis: null } }, { privatePay: true })
  assert.equal(cleared.rate, null)
  assert.equal(cleared.source, 'payProfile')
})

// MARK: - Rulebook 1.27.0 (owner decisions 1–7)

test('1.27.0 (1) Add User: the invite draft is the person, so the invitee is never offered as their own line manager', () => {
  const roster = [
    { id: 'mgr-1', email: 'boss@example.com', firstName: 'Bea', surname: 'Boss', isActive: true, passwordSet: true, role: 'manager', manager: true },
    // The invitee already has a row on this email (a manager in this company being re-invited, or a same-email account).
    { id: 'self-row', email: 'new.person@example.com', firstName: 'Nia', surname: 'New', isActive: true, passwordSet: true, role: 'manager', manager: true },
  ]
  const draft = R112.inviteDraftLineManagerSubject({ email: '  New.Person@Example.com ', level: 'operative' })
  assert.equal(draft.id, R112.INVITE_DRAFT_PERSON_ID)
  assert.equal(draft.email, 'new.person@example.com')
  assert.equal(draft.operativeMode, true)
  // Before 1.27.0 web passed no person: both rows were offered.
  assert.deepEqual(R112.lineManagerCandidates(null, roster as never).map((row) => row.id), ['mgr-1', 'self-row'])
  assert.deepEqual(R112.lineManagerCandidates(draft, roster as never).map((row) => row.id), ['mgr-1'])
  // A level change keeps only real candidates, so a pick of the invitee's own row is dropped.
  const kept = R112.lineManagerSelectionAfterLevelChange({ lineManagerIds: ['self-row', 'mgr-1'], hasNoLineManager: false }, 'manager', roster as never, draft)
  assert.deepEqual(kept.lineManagerIds, ['mgr-1'])
  assert.deepEqual(kept.dropped, ['self-row'])
  // The save check: the invitee picked as their own line manager does not count (an empty id reached nobody).
  const saving = { ...draft, assignedManagerUserIds: ['self-row'] }
  assert.equal(R112.lineManagerRequiredError(saving as never, roster as never), R112.LINE_MANAGER_REQUIRED_MESSAGE)
  assert.equal(R112.lineManagerRequiredError({ ...draft, assignedManagerUserIds: ['mgr-1'] } as never, roster as never), null)
  // Unknown levels read as manager; admins may have none.
  assert.equal(R112.inviteDraftLineManagerSubject({ email: 'x@y.z', level: 'weird' }).role, 'manager')
  assert.equal(R112.inviteDraftLineManagerSubject({ email: 'x@y.z', level: 'admin' }).adminAccess, true)
})

test('1.27.0 (2) material email: the sender must see the job (§17 canSeeJob) and the job number must be the stored one', () => {
  const job = { jobNumber: 'J-200', managerIds: ['mgr-1'] }
  const viewer = (input: Partial<Parameters<typeof R112.materialRequestJobViewer>[0]>) =>
    R112.materialRequestJobViewer({ userId: 'mgr-1', email: 'Boss@Example.com', level: 'manager', ...input })
  const check = (v: ReturnType<typeof R112.materialRequestJobViewer>, overrides: Record<string, unknown> = {}) =>
    R112.materialRequestJobCheck({ viewer: v, job, kind: 'projects', managers: [], jobNumber: 'J-200', ...overrides } as never)
  assert.deepEqual(check(viewer({})), { ok: true })
  assert.equal(viewer({}).email, 'boss@example.com')
  // 1.33.0: every manager sees every job (`canSeeJob`), so a manager who does not manage it may send too, toggles or not.
  const other = viewer({ userId: 'mgr-2', email: 'other@example.com' })
  assert.deepEqual(check(other), { ok: true })
  assert.equal(check(other, { kind: 'smallWorks' }).ok, true)
  // A job naming the sender's managers-list row (by email) counts; an alias id counts.
  assert.equal(check(other, { job: { jobNumber: 'J-200', managerIds: ['mrow-9'] }, managers: [{ id: 'mrow-9', email: 'OTHER@example.com' }] }).ok, true)
  assert.equal(check(viewer({ userId: 'new-uid', formerUserIds: ['mgr-1'] })).ok, true)
  // Admins see every job; operatives none.
  assert.equal(check(viewer({ userId: 'a', email: 'a@x.y', level: 'admin' }), { job: { jobNumber: 'J-200' } }).ok, true)
  assert.equal(check(viewer({ level: 'operative' })).ok, false)
  // The job number: spaces and case aside; a number stored as a number; blank or another job's number refused.
  assert.equal(check(viewer({}), { jobNumber: '  j-200 ' }).ok, true)
  assert.equal(check(viewer({}), { job: { jobNumber: 4100, managerIds: ['mgr-1'] }, jobNumber: '4100' }).ok, true)
  for (const jobNumber of ['J-201', '', null]) {
    const refused = check(viewer({}), { jobNumber })
    assert.equal(refused.ok, false)
    assert.equal(refused.ok ? '' : refused.reason, 'job_number_mismatch')
    assert.equal(refused.ok ? 0 : refused.status, 409)
  }
  // A missing job.
  const missing = check(viewer({}), { job: null })
  assert.equal(missing.ok ? '' : missing.reason, 'job_not_found')
  assert.equal(missing.ok ? '' : missing.message, R112.MATERIAL_REQUEST_JOB_NOT_FOUND_MESSAGE)
})

test('1.27.0 (4) variation evidence: unlinking records { path, name, removedBy, removedAt }; nothing else is rewritten', () => {
  const stored = {
    id: 'v1',
    heading: 'Extra socket',
    evidence: [
      { id: 'e1', fileName: 'before.jpg', storagePath: 'organizations/o/healthSafety/j/variations/u_1.jpg', downloadURL: 'https://x/1' },
      // Stored without an id (older build): matched by its derived id.
      { fileName: 'after.jpg', storagePath: 'organizations/o/healthSafety/j/variations/u_2.jpg', downloadURL: 'https://x/2' },
    ],
    evidenceCount: 2,
    removedEvidence: [{ path: 'organizations/o/old.pdf', name: 'old.pdf', removedBy: 'u0', removedAt: 1762000000000 }],
  }
  const write = R112.variationEvidenceRemovalWriteFields(stored, { evidenceId: 'e1', removedBy: 'admin-1', removedAt: 1762250000000 })
  assert.ok(write)
  assert.deepEqual(Object.keys(write!.set).sort(), ['evidence', 'evidenceCount', 'removedEvidence'])
  assert.deepEqual(write!.set.evidence, [stored.evidence[1]])
  assert.equal(write!.set.evidenceCount, 1)
  assert.deepEqual(write!.set.removedEvidence, [
    stored.removedEvidence[0],
    { path: 'organizations/o/healthSafety/j/variations/u_1.jpg', name: 'before.jpg', removedBy: 'admin-1', removedAt: 1762250000000 },
  ])
  const derivedId = R112.parseVariationDocument('v1', stored)!.evidence[1].id
  const second = R112.variationEvidenceRemovalWriteFields(stored, { evidenceId: derivedId, removedBy: 'm', removedAt: 2 })
  assert.deepEqual(second!.set.evidence, [stored.evidence[0]])
  assert.equal(R112.variationEvidenceRemovalWriteFields(stored, { evidenceId: 'nope', removedBy: 'm', removedAt: 2 }), null)
  // The reader returns the list (oldest first); rows without a path are skipped.
  const parsed = R112.parseVariationDocument('v1', { ...stored, removedEvidence: [...stored.removedEvidence, { name: 'x' }] })!
  assert.deepEqual(parsed.removedEvidence, [{ path: 'organizations/o/old.pdf', name: 'old.pdf', removedBy: 'u0', removedAtMs: 1762000000000 }])
  assert.deepEqual(R112.parseVariationDocument('v2', { heading: 'h' })!.removedEvidence, [])
  // Admins only, never in operative mode; the heading.
  assert.equal(R112.canViewRemovedEvidence({ isAdmin: true }), true)
  assert.equal(R112.canViewRemovedEvidence({ isSuperAdmin: true }), true)
  assert.equal(R112.canViewRemovedEvidence({ isAdmin: true, isOperativeMode: true }), false)
  assert.equal(R112.canViewRemovedEvidence({ isAdmin: false, isSuperAdmin: false }), false)
  assert.equal(R112.removedEvidenceHeading(3), 'Removed evidence (3)')
  assert.equal(R112.removedEvidenceHeading(-1), 'Removed evidence (0)')
})

test('1.27.0 (5) retention: 30 days, and the privacy policy and DPA carry the shared sentence', async () => {
  assert.equal(R112.FILE_RECOVERY_RETENTION_DAYS, 30)
  assert.match(R112.DELETED_DATA_RETENTION_NOTICE, /up to 30 days/)
  assert.match(R112.DELETED_DATA_RETENTION_NOTICE, new RegExp(`restored for ${R112.DELETION_RESTORE_DAYS} days`))
  const { LEGAL_PACK_DOCUMENTS } = await import('../legal/customerLegalPack')
  for (const id of ['privacy', 'dpa']) {
    const document = LEGAL_PACK_DOCUMENTS.find((row) => row.id === id)!
    assert.ok(JSON.stringify(document.sections).includes(R112.DELETED_DATA_RETENTION_NOTICE), id)
  }
})

test('1.27.0 (6) invite accept: the invited pay profile is copied exactly to the account, only while privatePay is on', () => {
  const placeholderProfile = { userId: 'ph-1', payBasis: 'hourly', hourlyRate: 28, employmentType: 'paye', updatedBy: 'admin' }
  const base = { privatePay: true, authUid: 'uid-1', placeholderId: 'ph-1', placeholderProfile, accountProfile: null }
  assert.deepEqual(R112.invitePayProfileCopyWrite(base), {
    subjectId: 'uid-1',
    set: { userId: 'uid-1', payBasis: 'hourly', hourlyRate: 28, employmentType: 'paye' },
  })
  // A stored null (rate cleared) is copied as null.
  assert.deepEqual(
    R112.invitePayProfileCopyWrite({ ...base, placeholderProfile: { userId: 'ph-1', dayRate: null, payBasis: null } })!.set,
    { userId: 'uid-1', dayRate: null, payBasis: null }
  )
  for (const blocked of [
    { privatePay: false },
    { privatePay: undefined },
    { placeholderId: '' },
    { placeholderId: 'uid-1' },
    { placeholderProfile: null },
    { placeholderProfile: { userId: 'ph-1' } },
    { accountProfile: { userId: 'uid-1', dayRate: 1 } },
  ]) {
    assert.equal(R112.invitePayProfileCopyWrite({ ...base, ...blocked } as never), null, JSON.stringify(blocked))
  }
})

test('1.27.0 (7) catalogue operatives: managers with the Operatives toggle see their pay; plans read their profile and history', () => {
  const roster = [
    { id: 'admin-1', email: 'admin@x.y', isActive: true, role: 'admin', adminAccess: true },
    { id: 'ops-mgr', email: 'ops@x.y', isActive: true, role: 'manager', manager: true, permissions: { operatives: true } },
    { id: 'plain-mgr', email: 'plain@x.y', isActive: true, role: 'manager', manager: true },
    { id: 'op-1', email: 'op@x.y', isActive: true, role: 'operative', operativeMode: true, assignedManagerUserIds: ['plain-mgr'] },
  ]
  const operatives = [
    { id: 'row-solo', email: 'solo@x.y', name: 'Solo' },
    { id: 'row-noemail', name: 'No email' },
    { id: 'row-linked', email: 'linked@x.y', linkedUserId: 'someone' },
    { id: 'row-op', email: 'OP@x.y' },
    { id: 'OP-1' },
    { id: 'row-solo' },
  ]
  const catalogue = R112.catalogueOperativePaySubjects(operatives, roster as never)
  assert.deepEqual(catalogue, [
    { id: 'row-solo', email: 'solo@x.y', catalogueOperative: true },
    { id: 'row-noemail', email: null, catalogueOperative: true },
  ])
  const [solo] = catalogue
  const admin = roster[0]
  const opsMgr = roster[1]
  const plainMgr = roster[2]
  const op = roster[3]
  assert.equal(R112.canViewPersonPay(admin as never, solo, roster as never), true)
  assert.equal(R112.canViewPersonPay(opsMgr as never, solo, roster as never), true)
  assert.equal(R112.canViewPersonPay(plainMgr as never, solo, roster as never), false)
  assert.equal(R112.canViewPersonPay(op as never, solo, roster as never), false)
  assert.equal(R112.canViewPersonPay({ ...opsMgr, isActive: false } as never, solo, roster as never), false)
  // Unchanged for accounts: the ops manager sees the operative, never another manager.
  assert.equal(R112.canViewPersonPay(opsMgr as never, op as never, roster as never), true)
  assert.equal(R112.canViewPersonPay(opsMgr as never, plainMgr as never, roster as never), false)

  const subjects = [...roster, ...catalogue]
  assert.deepEqual(R112.payProfileReadPlan(opsMgr as never, subjects as never, roster as never), {
    kind: 'documents',
    ids: ['ops-mgr', 'op-1', 'row-solo', 'row-noemail'],
  })
  assert.deepEqual(R112.payProfileReadPlan(plainMgr as never, subjects as never, roster as never), { kind: 'documents', ids: ['plain-mgr', 'op-1'] })
  assert.deepEqual(R112.rateHistoryQueryPlan(opsMgr as never, subjects as never, roster as never, { privatePay: true }), {
    kind: 'people',
    userIds: ['ops-mgr', 'op-1'],
    operativeIds: ['row-solo', 'row-noemail'],
  })
  assert.deepEqual(R112.rateHistoryQueryPlan(plainMgr as never, subjects as never, roster as never, { privatePay: true }), {
    kind: 'people',
    userIds: ['plain-mgr', 'op-1'],
    operativeIds: [],
  })
  assert.deepEqual(R112.rateHistoryQueryPlan(admin as never, subjects as never, roster as never, { privatePay: true }), { kind: 'all' })
  assert.deepEqual(R112.rateHistoryQueryPlan(opsMgr as never, subjects as never, roster as never, { privatePay: false }), { kind: 'all' })
  // The overlay: a catalogue row takes its pay profile.
  const overlaid = R112.overlayPayProfile({ id: 'row-solo', name: 'Solo', dayRate: 100 }, R112.parsePayProfileDocument('row-solo', { dayRate: 160, payBasis: 'day' }))
  assert.equal(overlaid.dayRate, 160)
})

test('1.27.0 a deletion scheduled under the 60-day rule keeps its stored eraseAfter', () => {
  const at = Date.UTC(2026, 9, 1, 10, 0, 0)
  const org = { deletion: { status: 'scheduled', requestedAt: new Date(at), requestedBy: 'SA', eraseAfter: new Date(at + 60 * 86400000) } }
  assert.equal(r1150Del.organizationEraseDue(org, at + 31 * 86400000), false)
  assert.equal(r1150Del.organizationEraseDue(org, at + 60 * 86400000), true)
  assert.match(R112.DELETED_DATA_RETENTION_NOTICE, /restored for 30 days/)
})

// MARK: - 1.28.0 (owner decisions 4 Nov): admin self-manage toggles and when a line manager is required

import * as r1280Leave from './leaveRequests.ts'
import * as r1280Levels from './permissionLevels.ts'
import * as r1280Recipients from './notificationRecipients.ts'
import { userProfileWriteFields as r1280ProfileWrite } from './peopleDocuments.ts'
import { lineManagerOptions as r1280Options } from './lineManagers.ts'

const r1280SA = { id: 'SA', email: 'sa@x.com', role: 'admin', adminAccess: true, isSuperAdmin: true }
const r1280LM = { id: 'LM', email: 'lm@x.com', role: 'manager', manager: true, assignedManagerUserIds: ['SA'] }
const r1280Admin = (extra: Record<string, unknown> = {}) => ({ id: 'A', email: 'a@x.com', role: 'admin', adminAccess: true, ...extra })

test('1.28.0 the lone Super Admin always has both self-manage toggles and needs no line manager', () => {
  const roster = [r1280SA]
  const toggles = r1280Leave.selfManageToggles({ ...r1280SA, permissions: { annualLeaveSelfBook: false } })
  assert.deepEqual(toggles, { annualLeaveSelfBook: true, timesheetSelfSign: true, timesheetApplies: true, superAdmin: true, satisfied: true })
  assert.equal(r1280Leave.lineManagerRequired(r1280SA), false)
  assert.equal(r1280Leave.lineManagerRequiredError(r1280SA, roster), null)
  assert.equal(r1280Leave.timesheetSelfSigned(r1280SA, roster), true)
  assert.equal(r1280Leave.canSelfBookAnnualLeave(r1280SA, roster), true)
  assert.equal(r1280Leave.leaveSubmitLabel(r1280SA, roster), 'Submit')
  assert.deepEqual(r1280Leave.usersMissingLineManager(roster), [])
  // Read on and locked in the permission rows, with the Super Admin note.
  const effective = r1280Levels.effectivePermissions({ ...r1280SA, annualLeaveSelfBook: false, timesheetSelfSign: false })
  assert.equal(effective.annualLeaveSelfBook, true)
  assert.equal(effective.timesheetSelfSign, true)
  const rows = r1280Levels.permissionToggleRows({ level: 'admin', user: r1280SA, mode: 'edit' })
  for (const field of ['annualLeaveSelfBook', 'timesheetSelfSign']) {
    const row = rows.find((entry) => entry.field === field)!
    assert.equal(row.value, true, field)
    assert.equal(row.editable, false, field)
    assert.equal(row.note, r1280Levels.SUPER_ADMIN_SELF_MANAGE_MESSAGE, field)
  }
  // A save never writes the Super Admin's self-manage toggles.
  const write = r1280ProfileWrite({ ...r1280SA, permissions: { annualLeaveSelfBook: false } }, { annualLeaveSelfBook: true, permissions: { annualLeaveSelfBook: true } })
  assert.equal('annualLeaveSelfBook' in write.set, false)
})

test('1.28.0 an admin with both toggles may have no line manager; with one toggle they need one', () => {
  const both = r1280Admin({ annualLeaveSelfBook: true, timesheetSelfSign: true, hasNoLineManager: true })
  const roster = [r1280SA, both]
  assert.equal(r1280Leave.lineManagerRequired(both), false)
  assert.equal(r1280Leave.lineManagerRequiredError(both, roster), null)
  assert.equal(r1280Leave.timesheetSelfSigned(both, roster), true)
  assert.equal(r1280Leave.canSelfBookAnnualLeave(both, roster), true)
  assert.deepEqual(r1280Recipients.timesheetSubmittedRecipients(both, roster), [])
  assert.deepEqual(r1280Recipients.holidayRequestRecipients(both, roster), [])

  const leaveOnly = r1280Admin({ annualLeaveSelfBook: true, hasNoLineManager: true })
  assert.equal(r1280Leave.lineManagerRequired(leaveOnly), true)
  assert.equal(r1280Leave.lineManagerRequiredError(leaveOnly, [r1280SA, leaveOnly]), r1280Leave.ADMIN_LINE_MANAGER_REQUIRED_MESSAGE)
  assert.equal(r1280Leave.timesheetSelfSigned(leaveOnly, [r1280SA, leaveOnly]), false)
  assert.equal(r1280Leave.canSelfBookAnnualLeave(leaveOnly, [r1280SA, leaveOnly]), true)
  // Not stranded: the sheet goes to the other active admins (here only the Super Admin).
  assert.deepEqual(r1280Recipients.timesheetSubmittedRecipients(leaveOnly, [r1280SA, leaveOnly]), ['SA'])

  const signOnly = r1280Admin({ timesheetSelfSign: true })
  assert.equal(r1280Leave.lineManagerRequiredError(signOnly, [r1280SA, signOnly]), r1280Leave.ADMIN_LINE_MANAGER_REQUIRED_MESSAGE)
  assert.equal(r1280Leave.leaveSubmitLabel(signOnly, [r1280SA, signOnly]), 'Submit request')
  assert.deepEqual(r1280Recipients.holidayRequestRecipients(signOnly, [r1280SA, signOnly]), ['SA'])
  assert.deepEqual(r1280Leave.leaveApproverIds(signOnly, [r1280SA, signOnly]), ['SA'])
  assert.deepEqual(r1280Leave.usersMissingLineManager([r1280SA, leaveOnly, signOnly, both]), ['A', 'A'])

  // "No line manager" is offered to every admin; whether it is enough is lineManagerRequiredError.
  assert.equal(r1280Options(leaveOnly).allowsNoLineManager, true)
  assert.equal(r1280Options(leaveOnly).required, true)
  assert.equal(r1280Options(r1280LM).allowsNoLineManager, false)
})

test('1.28.0 a PAYE admin needs only Annual Leave Management; Timesheet self-sign is greyed out', () => {
  const paye = r1280Admin({ annualLeaveSelfBook: true, employmentType: 'paye' })
  assert.equal(r1280Leave.isPayeAccount(paye), true)
  assert.equal(r1280Leave.selfManageToggles(paye).satisfied, true)
  assert.equal(r1280Leave.lineManagerRequiredError(paye, [r1280SA, paye]), null)
  const payeOff = r1280Admin({ employmentType: 'paye' })
  assert.equal(r1280Leave.lineManagerRequiredError(payeOff, [r1280SA, payeOff]), r1280Leave.PAYE_ADMIN_LINE_MANAGER_REQUIRED_MESSAGE)
  const row = r1280Levels.permissionToggleRows({ level: 'admin', user: paye, mode: 'edit' }).find((entry) => entry.field === 'timesheetSelfSign')!
  assert.equal(row.visible, true)
  assert.equal(row.editable, false)
  assert.equal(row.note, r1280Levels.TIMESHEET_SELF_SIGN_PAYE_NOTE)
  // Self-employed: the row is editable.
  const se = r1280Levels.permissionToggleRows({ level: 'admin', user: r1280Admin(), mode: 'edit' }).find((entry) => entry.field === 'timesheetSelfSign')!
  assert.equal(se.editable, true)
  assert.equal(se.note, null)
  assert.equal(se.label, 'Timesheet self-sign')
  assert.equal(se.help, "Sign your own timesheet and generate the invoice without a line manager's signature.")
})

test('1.28.0 a demoted admin: Timesheet self-sign reads off, is kept underneath, and a line manager is required', () => {
  const stored = { id: 'D', email: 'd@x.com', organizationId: 'ORG', role: 'admin', adminAccess: true, timesheetSelfSign: true, annualLeaveSelfBook: true, permissions: { timesheetSelfSign: true, annualLeaveSelfBook: true } }
  const plan = r1280Levels.accountTypeChangeWrites({ person: stored, kind: 'manager', organizationId: 'ORG' })
  assert.ok(plan.ok)
  if (!plan.ok) return
  const fields = (plan.writes[0] as { fields: Record<string, unknown> }).fields
  // 1.31.0: an unchanged stored toggle is not rewritten at all (partial write) — the stored true stays underneath.
  assert.equal('timesheetSelfSign' in fields, false, 'stored value kept (not rewritten)')
  const demoted = { ...stored, role: 'manager', adminAccess: false, manager: true, permissions: { ...stored.permissions, adminAccess: false } }
  assert.equal(r1280Levels.effectivePermissions(demoted).timesheetSelfSign, false)
  assert.equal(r1280Leave.timesheetSelfSigned(demoted, [r1280SA, demoted]), false)
  assert.equal(r1280Leave.lineManagerRequiredError(demoted, [r1280SA, demoted]), r1280Leave.LINE_MANAGER_REQUIRED_MESSAGE)
  // Never shown for a manager; a manager save keeps the stored value underneath.
  const row = r1280Levels.permissionToggleRows({ level: 'manager', user: demoted, mode: 'edit' }).find((entry) => entry.field === 'timesheetSelfSign')!
  assert.equal(row.visible, false)
  const write = r1280ProfileWrite(demoted, { timesheetSelfSign: false, permissions: { timesheetSelfSign: false, projects: true } })
  assert.equal('timesheetSelfSign' in write.set, false)
  assert.deepEqual(write.set.permissions, { timesheetSelfSign: true, projects: true })
  // A manager can never be given it.
  assert.deepEqual(r1280Levels.withoutLockedPermissionWrites(demoted, { timesheetSelfSign: true }), {})
  // Promoted back, it reads again.
  assert.equal(r1280Levels.effectivePermissions({ ...demoted, role: 'admin', adminAccess: true }).timesheetSelfSign, true)
})

test('1.28.0 the toggles are independent of the line manager; nobody edits their own', () => {
  const roster = [r1280SA, r1280LM]
  const withLm = r1280Admin({ annualLeaveSelfBook: true, assignedManagerUserIds: ['LM'] })
  roster.push(withLm as never)
  // Leave self-booked, timesheet signed by the line manager.
  assert.equal(r1280Leave.canSelfBookAnnualLeave(withLm, roster), true)
  assert.equal(r1280Leave.timesheetSelfSigned(withLm, roster), false)
  assert.deepEqual(r1280Recipients.timesheetSubmittedRecipients(withLm, roster), ['LM'])
  // And the other way round.
  const signsOwn = r1280Admin({ timesheetSelfSign: true, assignedManagerUserIds: ['LM'] })
  assert.equal(r1280Leave.timesheetSelfSigned(signsOwn, roster), true)
  assert.equal(r1280Leave.canSelfBookAnnualLeave(signsOwn, roster), false)
  assert.equal(r1280Leave.lineManagerRequiredError(signsOwn, roster), null)
  // Managers keep Annual Leave Management; Timesheet self-sign never applies to them.
  assert.equal(r1280Leave.selfManageToggles({ ...r1280LM, timesheetSelfSign: true }).timesheetSelfSign, false)
  assert.equal(r1280Leave.canSelfBookAnnualLeave({ ...r1280LM, annualLeaveSelfBook: true }), true)
  // The viewer's own self-manage rows are not editable.
  const own = r1280Levels.permissionToggleRows({ level: 'admin', user: withLm, mode: 'edit', viewerIsSubject: true })
  for (const field of ['annualLeaveSelfBook', 'timesheetSelfSign']) {
    const row = own.find((entry) => entry.field === field)!
    assert.equal(row.editable, false, field)
    assert.equal(row.note, r1280Levels.OWN_SELF_MANAGE_MESSAGE, field)
  }
  // Add User: both start off for a new admin.
  const defaults = r1280Levels.addUserPermissionDefaults('admin')
  assert.equal(defaults.annualLeaveSelfBook, false)
  assert.equal(defaults.timesheetSelfSign, false)
})

test('1.28.0 the organisation creator is its Super Admin even without the flag; another company\'s Super Admin is not', () => {
  // isOrganizationSuperAdmin (organizationDeletion.ts, reused): the rules' callerIsSuperAdminOf.
  assert.equal(rulebook.isOrganizationSuperAdmin({ id: 'C', isSuperAdmin: false }, { id: 'ORG', creatorUserId: 'c' }), true)
  assert.equal(rulebook.isOrganizationSuperAdmin({ id: 'S', isSuperAdmin: true, organizationId: 'organizations/org' }, { id: 'ORG' }), true)
  assert.equal(rulebook.isOrganizationSuperAdmin({ id: 'S', isSuperAdmin: true, organizationId: 'ORG' }, { id: 'ORG-B' }), false)
  assert.equal(rulebook.isOrganizationSuperAdmin({ id: 'A', isSuperAdmin: false }, { id: 'ORG', creatorUserId: 'C' }), false)

  // A lone unflagged creator admin with no line manager: satisfied, self-signed, self-booked, saves pass.
  const creator = { id: 'C', email: 'c@x.com', role: 'admin', adminAccess: true, hasNoLineManager: true, organizationSuperAdmin: true }
  assert.equal(r1280Leave.lineManagerRequiredError(creator, [creator]), null)
  assert.equal(r1280Leave.timesheetSelfSigned(creator, [creator]), true)
  assert.equal(r1280Leave.canSelfBookAnnualLeave(creator, [creator]), true)
  const rows = r1280Levels.permissionToggleRows({ level: 'admin', user: creator, mode: 'edit' })
  assert.equal(rows.find((row) => row.field === 'timesheetSelfSign')?.value, true)
  assert.equal(rows.find((row) => row.field === 'timesheetSelfSign')?.editable, false)

  // A flagged Super Admin of another company working here as an admin: the flag does not count.
  const visitor = { id: 'S', role: 'admin', adminAccess: true, isSuperAdmin: true, organizationSuperAdmin: false }
  assert.equal(r1280Leave.timesheetSelfSigned(visitor, [r1280SA, visitor]), false)
  assert.equal(r1280Leave.canSelfBookAnnualLeave(visitor, [r1280SA, visitor]), false)
  assert.equal(r1280Leave.lineManagerRequiredError(visitor, [r1280SA, visitor]), r1280Leave.ADMIN_LINE_MANAGER_REQUIRED_MESSAGE)
  assert.equal(r1280Levels.effectivePermissions(visitor).timesheetSelfSign, false)
})

test('1.28.0 a save never writes derived self-manage values: demotion keeps Timesheet self-sign underneath', () => {
  const before = { role: 'admin', adminAccess: true, timesheetSelfSign: true, permissions: { adminAccess: true, timesheetSelfSign: true } }
  // The screen sends the manager-level effective value (off) with the level change.
  const write = r1280ProfileWrite(before, {
    role: 'manager', adminAccess: false, manager: true, timesheetSelfSign: false,
    permissions: { adminAccess: false, manager: true, timesheetSelfSign: false },
  })
  assert.equal('timesheetSelfSign' in write.set, false)
  assert.equal((write.set.permissions as Record<string, unknown>).timesheetSelfSign, true)
  // Promotion writes what the screen chose.
  const promote = r1280ProfileWrite({ role: 'manager', manager: true }, { role: 'admin', adminAccess: true, timesheetSelfSign: true })
  assert.equal(promote.set.timesheetSelfSign, true)
  // A flagged Super Admin's save never stores the derived on values.
  const sa = r1280ProfileWrite({ ...r1280SA, annualLeaveSelfBook: false }, { annualLeaveSelfBook: true, timesheetSelfSign: true, firstName: 'S' })
  assert.deepEqual(write.set.role, 'manager')
  assert.equal('annualLeaveSelfBook' in sa.set, false)
  assert.equal('timesheetSelfSign' in sa.set, false)
})

// MARK: - Rulebook 1.29.0: PAYE payday, PAYE overtime (§4.5, §25)

import * as r129 from './index'

const R129_ORG = {
  countryCode: 'GB',
  payrollTimePolicy: {
    standardDayStart: '07:30',
    standardDayEnd: '16:00',
    unpaidBreakMinutes: 30,
    breakWindowStart: '12:00',
    breakWindowEnd: '12:30',
    weekdayOutsideStandardMultiplier: 1.5,
    saturday: { allHoursAtMultiplierMode: false, definedWindowStart: '07:30', definedWindowEnd: '14:00', countsAsStandardHours: 8, outsideWindowMultiplier: 1.5 },
    sunday: { allHoursAtMultiplierMode: true, allHoursMultiplier: 2, sameAsSaturday: false },
  },
}
const R129_TZ = 'Europe/London'
function r129Booking(id: string, dayKey: string, start: string, end: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    collection: 'bookings',
    personId: 'sam',
    dayKey,
    timeSlot: 'CUSTOM_HOURS',
    workStartTime: start,
    workEndTime: end,
    status: 'Confirmed',
    jobId: 'job-1',
    jobNumber: 'J-1042',
    jobName: 'Riverside Flats',
    ...extra,
  }
}

test('1.29.0 PAYE payday: payrun is the day after last month\'s payday to this payday, 29–31 clamp, history keeps past runs', () => {
  const org25 = { invoicing: { payePayday: 25, payePaydayHistory: [{ day: 25, effectiveFrom: '2026-10-26' }] } }
  const summary = r129.payePayrunSummary(org25, '2026-11-04')
  assert.equal(summary.notConfigured, false)
  assert.equal((summary as { label: string }).label, 'PAYE payrun: 26 Oct – 25 Nov · paid 25 Nov')
  assert.deepEqual(r129.payePayrunPeriod({ invoicing: { payePaydayHistory: [{ day: 16, effectiveFrom: '2026-01-01' }] } }, '2026-11-17'), {
    start: '2026-11-17', end: '2026-12-16', payDate: '2026-12-16', payday: 16,
  })
  // Payday the 31st: 1 Feb – 28 Feb (clamped), never moved off a weekend.
  assert.deepEqual(r129.payePayrunPeriod({ invoicing: { payePaydayHistory: [{ day: 31, effectiveFrom: '2026-01-01' }] } }, '2027-02-10'), {
    start: '2027-02-01', end: '2027-02-28', payDate: '2027-02-28', payday: 31,
  })
  // Not set: no payrun, the screens say so.
  assert.deepEqual(r129.payePayrunSummary({ invoicing: {} }, '2026-11-04'), { notConfigured: true, message: r129.PAYE_PAYDAY_NOT_SET_MESSAGE })
  assert.equal(r129.payePayrunPeriod({}, '2026-11-04'), null)
  // First set: applies from the start of the payrun containing today.
  assert.deepEqual(r129.payePaydayWriteFields({ invoicing: {} }, 25, '2026-11-04'), {
    'invoicing.payePayday': 25,
    'invoicing.payePaydayHistory': [{ day: 25, effectiveFrom: '2026-10-26' }],
  })
  // A change applies from the next payrun; past runs keep their dates.
  const change = r129.payePaydayWriteFields(org25, 16, '2026-11-04')
  assert.deepEqual(change, {
    'invoicing.payePayday': 16,
    'invoicing.payePaydayHistory': [{ day: 25, effectiveFrom: '2026-10-26' }, { day: 16, effectiveFrom: '2026-11-26' }],
  })
  const changed = { invoicing: { payePayday: 16, payePaydayHistory: change!['invoicing.payePaydayHistory'] } }
  assert.deepEqual(r129.payePayrunPeriod(changed, '2026-11-04'), { start: '2026-10-26', end: '2026-11-25', payDate: '2026-11-25', payday: 25 })
  assert.deepEqual(r129.payePayrunPeriod(changed, '2026-11-30'), { start: '2026-11-26', end: '2026-12-16', payDate: '2026-12-16', payday: 16 })
  assert.deepEqual(r129.payePayrunPeriod(changed, '2026-12-17')?.end, '2027-01-16')
  assert.deepEqual(r129.payePastPayruns(changed, '2027-01-05').map((run) => `${run.start}..${run.end}`), ['2026-11-26..2026-12-16', '2026-10-26..2026-11-25'])
  // Days before the first payday: custom range only.
  assert.equal(r129.payePayrunPeriod(changed, '2026-10-01'), null)
  // Unchanged → nothing to write; invalid → refused.
  assert.equal(r129.payePaydayWriteFields(org25, 25, '2026-11-04'), null)
  assert.equal(r129.payePaydayWriteFields(org25, 32, '2026-11-04'), null)
  assert.equal(r129.payePaydayValidationError(0), r129.PAYE_PAYDAY_INVALID_MESSAGE)
  assert.equal(r129.payePaydayValidationError(29), null)
})

test('1.29.0 a missing otMultiplierOverride prices every booking exactly as before; a custom rate prices the overtime part only', () => {
  const policy = r129.effectivePayrollTimePolicy(R129_ORG, '2026-11-05', R129_TZ)
  const base = { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', workEndTime: '18:00' }
  const org = r129.payrollHoursResult({ booking: base, dayKey: '2026-11-05', policy, timeZone: R129_TZ })
  const nullRate = r129.payrollHoursResult({ booking: { ...base, otMultiplierOverride: null }, dayKey: '2026-11-05', policy, timeZone: R129_TZ })
  assert.deepEqual(nullRate, org)
  assert.equal(org.outsideMultiplier, 1.5)
  assert.equal(org.totalPaidHours, 8 + 2 * 1.5)
  const custom = r129.payrollHoursResult({ booking: { ...base, otMultiplierOverride: 2 }, dayKey: '2026-11-05', policy, timeZone: R129_TZ })
  assert.equal(custom.standardHours, org.standardHours)
  assert.equal(custom.totalPaidHours, 8 + 2 * 2)
  assert.equal(r129.bookingHoursLabel(custom).label, '12h (8h + 2h × 2)')
  // A full day has no overtime and no rate control.
  const full = { id: 'F', personId: 'sam', dayKey: '2026-11-05', timeSlot: 'FULL DAY', status: 'Confirmed' }
  assert.equal(r129.overtimeForBooking({ booking: full, organization: R129_ORG, timeZone: R129_TZ }), null)
  assert.equal(r129.overtimeRateControl({ booking: full, organization: R129_ORG, timeZone: R129_TZ }).show, false)
  // Manager site bookings read the same field (reader).
  const parsed = r129.parseManagerSiteBookingDocument('M1', { userId: 'u', date: 1762300800000, timeSlot: 'CUSTOM_HOURS', locationType: 'office', otMultiplierOverride: 1.75 })
  assert.equal(parsed.ok && parsed.booking.otMultiplierOverride, 1.75)
  const plainManager = r129.parseManagerSiteBookingDocument('M2', { userId: 'u', date: 1762300800000, timeSlot: 'CUSTOM_HOURS', locationType: 'office' })
  assert.equal(plainManager.ok && 'otMultiplierOverride' in plainManager.booking, false)
})

test('1.29.0 overtime lines: weekday outside the day, weekend window, every-hour weekend; 15-minute threshold; one line per booking', () => {
  const bookings = [
    r129Booking('B1', '2026-11-04', '06:30', '14:00'),
    r129Booking('B2', '2026-11-05', '07:30', '18:00', { jobNumber: 'J-1050', jobName: 'School extension' }),
    r129Booking('B3', '2026-11-07', '07:30', '15:00'),
    r129Booking('B4', '2026-11-08', '07:30', '14:00'),
    r129Booking('B5', '2026-11-03', '07:30', '16:00'),
    r129Booking('B6', '2026-11-02', '07:30', '16:10'),
    r129Booking('B7', '2026-11-02', '18:00', '21:00', { jobNumber: 'J-1050' }),
    r129Booking('OTHER', '2026-11-02', '18:00', '21:00', { personId: 'someone-else' }),
  ]
  const lines = r129.payeOvertimeLines({ personIds: ['SAM'], bookings, organization: R129_ORG, timeZone: R129_TZ, range: { start: '2026-11-01', end: '2026-11-30' } })
  assert.deepEqual(
    lines.map((line) => [line.bookingId, line.dayLabel, line.figures?.dayWindow, line.figures?.text, line.state]),
    [
      ['B7', 'Mon 2 Nov', '07:30–16:00', '3h × 1.5 = 4.5h', 'needsReview'],
      ['B1', 'Wed 4 Nov', '07:30–16:00', '1h × 1.5 = 1.5h', 'needsReview'],
      ['B2', 'Thu 5 Nov', '07:30–16:00', '2h × 1.5 = 3h', 'needsReview'],
      ['B3', 'Sat 7 Nov', '07:30–14:00', '1h × 1.5 = 1.5h', 'needsReview'],
      ['B4', 'Sun 8 Nov', null, '6.5h × 2 = 13h', 'needsReview'],
    ]
  )
  assert.equal(lines[1].title, 'J-1042 · Riverside Flats')
  assert.equal(r129.overtimeLinesTotal(lines), 23.5)
})

test('1.29.0 / 1.33.0 line state: confirmed review, pending request, booking changed since request, reopened after a change', () => {
  const booking = r129Booking('B1', '2026-11-04', '06:30', '14:00')
  const fingerprint = r129.overtimeBookingFingerprint(booking)
  assert.equal(fingerprint, '2026-11-04|CUSTOM_HOURS|06:30|14:00|||confirmed')
  const review = r129.parseOvertimeReviewDocument('sam_B1', { userId: 'sam', bookingId: 'B1', decision: 'approved', fingerprint })
  const range = { start: '2026-11-01', end: '2026-11-30' }
  const base = { personIds: ['sam'], organization: R129_ORG, timeZone: R129_TZ, range }
  // 1.33.0: a review with no request is a direct confirmation (no line manager).
  assert.equal(r129.payeOvertimeLines({ ...base, bookings: [booking], reviews: [review] })[0].state, 'confirmed')
  const moved = { ...booking, workEndTime: '15:00' }
  assert.equal(r129.overtimeLineIsStale(fingerprint, moved), true)
  // 1.33.0: a decided line whose booking changes reopens.
  assert.equal(r129.payeOvertimeLines({ ...base, bookings: [moved], reviews: [review] })[0].state, 'reopened')
  assert.equal(r129.payeOvertimeLines({ ...base, bookings: [moved] })[0].state, 'needsReview')
  const line = r129.overtimeRequestLineFields({ booking, organization: R129_ORG, timeZone: R129_TZ, proposal: { action: 'keep' } })!
  const request = r129.parseOvertimeRequestDocument('R1', { userId: 'sam', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', status: 'pending', lines: [line] })
  assert.equal(r129.payeOvertimeLines({ ...base, bookings: [booking], requests: [request] })[0].state, 'waiting')
  assert.equal(r129.payeOvertimeLines({ ...base, bookings: [moved], requests: [request] })[0].state, 'changedSinceRequest')
  assert.equal(r129.canGenerateOvertimeReport(r129.payeOvertimeLines({ ...base, bookings: [booking], reviews: [review] })), true)
  assert.equal(r129.canGenerateOvertimeReport(r129.payeOvertimeLines({ ...base, bookings: [booking], requests: [request] })), false)
  assert.equal(r129.canGenerateOvertimeReport([]), false)
})

test('1.29.0 / 1.33.0 red X: trim inside the day or window, delete when nothing is inside or the weekend pays a multiplier only', () => {
  const strike = (b: ReturnType<typeof r129Booking>) => r129.overtimeStrikeOutcome({ booking: b, organization: R129_ORG, timeZone: R129_TZ })
  assert.deepEqual(strike(r129Booking('B1', '2026-11-04', '06:30', '14:00')), { kind: 'trim', start: '07:30', end: '14:00' })
  assert.deepEqual(strike(r129Booking('B3', '2026-11-07', '07:30', '15:00')), { kind: 'trim', start: '07:30', end: '14:00' })
  assert.deepEqual(strike(r129Booking('B5', '2026-11-03', '07:30', '16:00')), { kind: 'none' })
  const sunday = strike(r129Booking('B4', '2026-11-08', '07:30', '14:00'))
  assert.equal(sunday.kind, 'delete')
  assert.deepEqual(sunday.kind === 'delete' && sunday.warning, {
    ...r129.OVERTIME_DELETE_WARNING,
    summary: 'Sun 8 Nov · J-1042 Riverside Flats · 07:30–14:00',
  })
  assert.equal(r129.OVERTIME_DELETE_WARNING.footnote, 'This cannot be undone. A manager can book it again.')
  assert.equal(strike(r129Booking('B7', '2026-11-02', '18:00', '21:00')).kind, 'delete')
  assert.equal(strike(r129Booking('M', '2026-11-02', '18:00', '21:00', { collection: 'managerSiteBookings' })).kind, 'notAllowed')
  // The writes: only the fields the rules allow; a Full day becomes custom hours when its times change.
  const booking = r129Booking('B1', '2026-11-04', '06:30', '14:00', { timeSlot: 'FULL DAY' })
  assert.deepEqual(r129.overtimeBookingWriteFields(booking, { kind: 'trim', start: '07:30', end: '14:00' }), {
    set: { workStartTime: '07:30', timeSlot: 'CUSTOM_HOURS' },
    remove: [],
  })
  assert.deepEqual(r129.overtimeBookingWriteFields({ ...booking, otMultiplierOverride: 2 }, { kind: 'edit', start: '06:30', end: '14:00', multiplier: null }), {
    set: {},
    remove: ['otMultiplierOverride'],
  })
})

test('1.29.0 cog preview and the overtime rate (1–3 in 0.25 steps)', () => {
  const booking = r129Booking('B2', '2026-11-05', '07:30', '18:00')
  const preview = r129.overtimeCogPreview({ booking, organization: R129_ORG, timeZone: R129_TZ, start: '07:30', end: '19:00', multiplier: 2 })
  assert.deepEqual([preview.beforeText, preview.afterText, preview.changed, preview.error], ['2h × 1.5 = 3h', '3h × 2 = 6h', true, null])
  assert.equal(r129.overtimeCogPreview({ booking, organization: R129_ORG, timeZone: R129_TZ, start: '07:30', end: '18:00', multiplier: 1.1 }).error, r129.OVERTIME_MULTIPLIER_MESSAGE)
  assert.deepEqual(r129.OVERTIME_MULTIPLIER_STEPS, [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3])
  assert.equal(r129.overtimeMultiplierValid(3.25), false)
  assert.equal(r129.overtimeMultiplierValid(0.75), false)
  const control = r129.overtimeRateControl({ booking: { ...booking, otMultiplierOverride: 2 }, organization: R129_ORG, timeZone: R129_TZ })
  assert.deepEqual([control.show, control.organizationLabel, control.customMultiplier], [true, 'Organisation (×1.5)', 2])
  assert.deepEqual(r129.overtimeMultiplierWriteFields(2, null), { set: {}, remove: ['otMultiplierOverride'] })
  assert.deepEqual(r129.overtimeMultiplierWriteFields(null, 2.5), { set: { otMultiplierOverride: 2.5 }, remove: [] })
  assert.deepEqual(r129.overtimeMultiplierWriteFields(2.5, 2.5), { set: {}, remove: [] })
})

const R129_ROSTER = [
  { id: 'sam', email: 'sam@x.com', isActive: true, role: { isOperativeMode: true }, assignedManagerUserIds: ['lm'], employmentType: 'paye' },
  { id: 'lm', email: 'lm@x.com', isActive: true, role: { isManager: true }, assignedManagerUserIds: ['admin'] },
  { id: 'admin', email: 'admin@x.com', isActive: true, role: { isAdmin: true } },
  { id: 'admin2', email: 'admin2@x.com', isActive: true, role: { isAdmin: true } },
  { id: 'gone', email: 'gone@x.com', isActive: false, role: { isAdmin: true } },
  { id: 'op2', email: 'op2@x.com', isActive: true, role: { isOperativeMode: true }, assignedManagerUserIds: ['admin'] },
] as never[]

test('1.29.0 who: edit mode, deciders, Users\' subjects, hub button', () => {
  const op = { role: { isOperativeMode: true }, ids: ['sam'] }
  const admin = { role: { isAdmin: true }, ids: ['admin'] }
  const manager = { role: { isManager: true }, ids: ['lm'] }
  const booking = { collection: 'bookings', projectId: 'job-1', dayKey: '2026-11-04' }
  const job = { managerUserIds: ['lm'] }
  assert.equal(r129.canEditOwnBookingOvertime({ viewer: op, isPaye: true, booking, job, todayKey: '2026-11-04' }), 'request')
  assert.equal(r129.canEditOwnBookingOvertime({ viewer: admin, isPaye: true, booking, job, todayKey: '2026-11-04' }), 'direct')
  assert.equal(r129.canEditOwnBookingOvertime({ viewer: manager, isPaye: true, booking, job, todayKey: '2026-11-04' }), 'direct')
  assert.equal(r129.canEditOwnBookingOvertime({ viewer: manager, isPaye: true, booking, job: { managerUserIds: ['other'] }, todayKey: '2026-11-04' }), 'request')
  assert.equal(r129.canEditOwnBookingOvertime({ viewer: admin, isPaye: false, booking, job }), 'none')
  assert.equal(r129.canEditOwnBookingOvertime({ viewer: admin, isPaye: true, booking, job, todayKey: '2026-11-03' }), 'none')
  const sam = (R129_ROSTER as Array<Record<string, unknown>>)[0] as never
  assert.equal(r129.canDecideOvertimeRequest({ id: 'lm', role: { isManager: true } } as never, sam, R129_ROSTER), true)
  assert.equal(r129.canDecideOvertimeRequest({ id: 'admin2', role: { isAdmin: true } } as never, sam, R129_ROSTER), true)
  assert.equal(r129.canDecideOvertimeRequest({ id: 'sam', role: { isAdmin: true } } as never, sam, R129_ROSTER), false)
  assert.equal(r129.canDecideOvertimeRequest({ id: 'op2', role: { isOperativeMode: true } } as never, sam, R129_ROSTER), false)
  assert.deepEqual(r129.overtimeUserSubjects({ id: 'lm', role: { isManager: true } } as never, R129_ROSTER), ['sam'])
  assert.deepEqual(r129.overtimeUserSubjects({ id: 'admin', role: { isAdmin: true } } as never, R129_ROSTER), ['sam', 'lm', 'admin2', 'op2'])
  assert.deepEqual(r129.overtimeHubAccess({ viewer: sam, roster: R129_ROSTER }), { showButton: true, mine: true, users: false })
  assert.deepEqual(r129.overtimeHubAccess({ viewer: { id: 'lm', role: { isManager: true } } as never, roster: R129_ROSTER }), { showButton: true, mine: false, users: true })
  assert.deepEqual(r129.overtimeHubAccess({ viewer: { id: 'op2', role: { isOperativeMode: true } } as never, roster: R129_ROSTER }), { showButton: false, mine: false, users: false })
})

test('1.29.0 overtime notices: recipients, push, toggle, destinations, relatedId, catalogue', () => {
  assert.deepEqual(r129.overtimeRequestRecipients('sam', R129_ROSTER), ['lm', 'admin', 'admin2'])
  assert.deepEqual(r129.overtimeReviewedRecipients('sam', 'lm', R129_ROSTER), ['sam'])
  assert.deepEqual(r129.overtimeReviewedRecipients('sam', 'sam', R129_ROSTER), [])
  assert.deepEqual(r129.bookingHoursChangedRecipients('lm', ['lm', 'admin2'], R129_ROSTER), ['admin2', 'admin'])
  assert.equal(r129.notificationDeliversDevicePush('overtime_request_submitted'), true)
  assert.equal(r129.notificationDeliversDevicePush('overtime_request_reviewed'), true)
  assert.equal(r129.notificationDeliversDevicePush('booking_hours_changed_by_owner'), false)
  const prefs = r129.parseUserNotificationPreferences({ overtime: false })
  assert.equal(prefs.overtime, false)
  assert.equal(r129.devicePushAllowed(prefs, 'overtime_request_submitted'), false)
  assert.equal(r129.parseUserNotificationPreferences({}).overtime, true)
  assert.ok(r129.visibleNotificationPreferenceKeys({ role: { isOperativeMode: true }, catalogue: {} } as never).includes('overtime'))
  assert.deepEqual(r129.notificationDestination({ type: 'overtime_request_submitted', relatedId: 'R1', role: 'manager', deepLinkUserId: 'sam' }), {
    kind: 'overtimeUser', userId: 'sam', relatedId: 'R1',
  })
  assert.deepEqual(r129.notificationDestination({ type: 'overtime_request_reviewed', relatedId: 'R1', role: 'operative' }), { kind: 'overtimeMine', relatedId: 'R1' })
  assert.deepEqual(r129.notificationDestination({ type: 'booking_hours_changed_by_owner', relatedId: 'B1', dayKey: '2026-11-04', role: 'manager' }), {
    kind: 'dailyOverviewDay', dayKey: '2026-11-04', relatedId: 'B1',
  })
  assert.equal(r129.notificationRelatedIdFor('overtime_request_submitted', ' R1 '), 'R1')
  assert.equal(r129.notificationRelatedIdFor('booking_hours_changed_by_owner', 'B1'), 'B1')
  for (const type of ['overtime_request_submitted', 'overtime_request_reviewed', 'booking_hours_changed_by_owner']) {
    assert.ok(r129.notificationCatalogRow(type), type)
    assert.ok(r129.KNOWN_NOTIFICATION_TYPES.includes(type), type)
  }
})

test('1.33.0 Return: one set of writes; ✓ applies the person\'s line (keep, cog, trim, delete), ✕ leaves the booking, ⚙ applies the decider\'s values', () => {
  const b1 = r129Booking('B1', '2026-11-04', '06:30', '14:00')
  const b2 = r129Booking('B2', '2026-11-05', '07:30', '18:00')
  const b4 = r129Booking('B4', '2026-11-08', '07:30', '14:00')
  const b6 = r129Booking('B6', '2026-11-06', '07:30', '17:00')
  const b7 = r129Booking('B7', '2026-11-03', '06:30', '14:00')
  const gone = r129Booking('GONE', '2026-11-06', '07:30', '17:00')
  const line = (booking: ReturnType<typeof r129Booking>, proposal: Parameters<typeof r129.overtimeRequestLineFields>[0]['proposal']) =>
    r129.overtimeRequestLineFields({ booking, organization: R129_ORG, timeZone: R129_TZ, proposal })!
  const lines = [
    line(b1, { action: 'keep' }),
    line(b2, { action: 'edit', start: '07:30', end: '19:00', multiplier: 2 }),
    line(b4, { action: 'strike' }),
    line(b6, { action: 'keep' }),
    line(b7, { action: 'strike' }),
    line(gone, { action: 'keep' }),
  ]
  assert.deepEqual([lines[1].overtimeHoursBefore, lines[1].overtimeHoursAfter], [3, 6])
  // An all-overtime day: the line asks for the booking to be removed (0h after).
  assert.deepEqual([lines[2].cancel, lines[2].overtimeHoursAfter], [true, 0])
  const fields = r129.overtimeRequestWriteFields({ userId: 'sam', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', lines })!
  assert.equal(fields.status, 'pending')
  assert.equal(r129.overtimeRequestWriteFields({ userId: 'sam', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', lines: [] }), null)
  const request = r129.parseOvertimeRequestDocument('R1', { ...fields, createdAt: 1 })
  const decisions = {
    B1: { action: 'approve' as const },
    B2: { action: 'approve' as const },
    B4: { action: 'approve' as const },
    B6: { action: 'edit' as const, start: '07:30', end: '16:30', multiplier: null },
    B7: { action: 'strike' as const },
  }
  const bookings = { b1, B2: b2, B4: b4, B6: b6, B7: b7 }
  // Return needs every line decided (the deleted booking does not block it).
  assert.deepEqual(r129.overtimeReturnReady({ request, decisions: {}, skipBookingIds: ['GONE'] }), {
    ready: false, undecidedCount: 5, message: r129.OVERTIME_REQUEST_UNDECIDED_MESSAGE,
  })
  assert.equal(r129.overtimeReturnReady({ request, decisions, skipBookingIds: ['GONE'] }).ready, true)
  const refused = r129.overtimeReturnWrites({ request, decisions: { B1: { action: 'approve' } }, bookings, organization: R129_ORG, timeZone: R129_TZ, deciderId: 'lm' })
  assert.deepEqual(refused.ok === false && [refused.reason, refused.bookingIds], ['undecided', ['B2', 'B4', 'B6', 'B7']])
  const result = r129.overtimeReturnWrites({ request, decisions, bookings, organization: R129_ORG, timeZone: R129_TZ, deciderId: 'lm' })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.bookingWrites, [
    { collection: 'bookings', bookingId: 'B2', set: { workEndTime: '19:00', otMultiplierOverride: 2, overtimeReturnRequestId: 'R1' }, remove: [] },
    { collection: 'bookings', bookingId: 'B6', set: { workEndTime: '16:30', overtimeReturnRequestId: 'R1' }, remove: [] },
  ])
  // The request id rides on each booking change, so the rules can tie the write to the returned request (§16).
  assert.equal(r129.OVERTIME_RETURN_REQUEST_ID_FIELD, 'overtimeReturnRequestId')
  // Item f: the all-overtime booking is deleted, with a tombstone naming the request; never Cancelled.
  assert.deepEqual(result.bookingDeletes, [
    { collection: 'bookings', bookingId: 'B4', tombstone: { bookingId: 'B4', collection: 'bookings', deletedBy: 'lm', deletedFrom: 'web', overtimeRequestId: 'R1' } },
  ])
  assert.deepEqual(result.reviewWrites.map((row) => [row.docId, row.fields.decision]), [
    ['sam_B1', 'approved'], ['sam_B2', 'edited'], ['sam_B4', 'deleted'], ['sam_B6', 'changed'], ['sam_B7', 'declined'],
  ])
  // ✕ = "I don't agree with this line": B7 is not written, its review keeps the booking's fingerprint.
  assert.equal(result.reviewWrites[4].fields.fingerprint, r129.overtimeBookingFingerprint(b7))
  assert.deepEqual(result.lineOutcomes, { B1: 'applied', B2: 'applied', B4: 'removed', B6: 'applied', B7: 'declined', GONE: 'deleted' })
  assert.deepEqual(result.requestFields, {
    status: 'approved',
    decisions: { B1: { action: 'approve' }, B2: { action: 'approve' }, B4: { action: 'approve' }, B6: { action: 'edit', start: '07:30', end: '16:30', multiplier: null }, B7: { action: 'strike' } },
    decidedBy: 'lm',
    appliedBookingIds: ['B1', 'B2', 'B4', 'B6', 'B7'],
    droppedBookingIds: ['GONE'],
    staleBookingIds: [],
    deletedBookingIds: ['B4'],
  })
  assert.equal(result.message, 'Returned 5 lines. 1 deleted booking left out.')
  // What the person sees after the Return.
  const after2 = { ...b2, workEndTime: '19:00', otMultiplierOverride: 2 }
  const after6 = { ...b6, workEndTime: '16:30' }
  const reviews = result.reviewWrites.map((row) => r129.parseOvertimeReviewDocument(row.docId, { ...row.fields, reviewedAt: 10 }))
  const returned = r129.parseOvertimeRequestDocument('R1', { ...fields, ...result.requestFields, createdAt: 1, decidedAt: 10 })
  const range = { start: '2026-11-01', end: '2026-11-30' }
  const after = r129.payeOvertimeLines({
    personIds: ['sam'], bookings: [b1, after2, after6, b7], organization: R129_ORG, timeZone: R129_TZ, range, reviews, requests: [returned],
    names: { lm: 'Lee Manager' }, jobs: [{ id: 'job-1', jobNumber: 'J-1042', jobName: 'Riverside Flats' }],
  })
  assert.deepEqual(after.map((row) => [row.bookingId, row.state, row.stateLabel]), [
    ['B7', 'returnedDeclined', 'Declined'],
    ['B1', 'returnedApproved', 'Approved'],
    ['B2', 'returnedApproved', 'Approved'],
    ['B6', 'returnedChanged', 'Changed by Lee Manager'],
    ['B4', 'deleted', 'Booking removed — not worked'],
  ])
  assert.deepEqual([after[4].title, after[4].start, after[4].end, after[4].figures], ['J-1042 · Riverside Flats', '07:30', '14:00', null])
  // Declined and deleted lines count 0h.
  assert.equal(r129.overtimeLinesTotal(after), 1.5 + 6 + 0.75)
  assert.equal(r129.canGenerateOvertimeReport(after, { hasLineManager: true }), true)
  // The report lists the declined line at 0h "Declined by {name}" and the deleted one at 0h.
  const snapshot = r129.overtimeReportSnapshot({ userId: 'sam', userName: 'Sam', rangeStart: range.start, rangeEnd: range.end, lines: after, generatedBy: 'sam' })
  assert.deepEqual(snapshot.lines.map((row) => [row.bookingId, row.overtimeHours, row.note]), [
    ['B7', 0, 'Declined by Lee Manager'], ['B1', 1.5, ''], ['B2', 6, ''], ['B6', 0.75, ''], ['B4', 0, 'Booking removed — not worked'],
  ])
  assert.equal(snapshot.totals.overtimeHours, 8.25)
  assert.equal(r129.overtimeReportOutOfDate({ report: snapshot, lines: after }), false)
  // Generate turns grey while an up-to-date report of the range is saved.
  assert.deepEqual(r129.overtimeGenerateReady({ lines: after, hasLineManager: true, reports: [snapshot] }), { ready: false, message: r129.OVERTIME_GENERATE_SAVED_MESSAGE })
  // Withdraw is for pending requests only.
  assert.deepEqual(r129.overtimeRequestWithdrawWriteFields(request), { status: 'withdrawn' })
  assert.equal(r129.overtimeRequestWithdrawWriteFields(returned), null)
})

test('1.33.0 Return skip-and-name: a line changed since it was sent goes back to the person; the rest apply; a 1.32 partial request completes', () => {
  const b1 = r129Booking('B1', '2026-11-04', '06:30', '14:00')
  const b2 = r129Booking('B2', '2026-11-05', '07:30', '18:00')
  const lines = [b1, b2].map((booking) => r129.overtimeRequestLineFields({ booking, organization: R129_ORG, timeZone: R129_TZ, proposal: { action: 'keep' } })!)
  const request = r129.parseOvertimeRequestDocument('R2', { userId: 'sam', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', status: 'pending', lines, createdAt: 1 })
  const moved = { ...b1, workStartTime: '06:00' }
  const decisions = { B1: { action: 'approve' as const }, B2: { action: 'approve' as const } }
  const result = r129.overtimeReturnWrites({ request, decisions, bookings: { B1: moved, B2: b2 }, organization: R129_ORG, timeZone: R129_TZ, deciderId: 'lm' })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.staleBookingIds, ['B1'])
  assert.deepEqual(result.lineOutcomes, { B1: 'stale', B2: 'applied' })
  assert.equal(result.requestFields.status, 'approved')
  assert.equal(result.message, 'Returned 1 line. 1 changed since they sent it — they need to send it again.')
  const reviews = result.reviewWrites.map((row) => r129.parseOvertimeReviewDocument(row.docId, { ...row.fields, reviewedAt: 10 }))
  const returned = r129.parseOvertimeRequestDocument('R2', { ...request, lines, ...result.requestFields, status: 'approved', decidedAt: 10 })
  const after = r129.payeOvertimeLines({ personIds: ['sam'], bookings: [moved, b2], organization: R129_ORG, timeZone: R129_TZ, range: { start: '2026-11-01', end: '2026-11-30' }, reviews, requests: [returned] })
  assert.deepEqual(after.map((row) => [row.bookingId, row.state, row.stateLabel]), [['B1', 'changedSinceRequest', 'Changed since you sent it'], ['B2', 'returnedApproved', 'Approved']])
  assert.deepEqual(r129.overtimeGenerateReady({ lines: after, hasLineManager: true }), { ready: false, message: r129.OVERTIME_GENERATE_NOT_READY_MESSAGE })
  // A 1.32 request partly applied before 1.33: Return finishes it; the applied line is skipped.
  const partial = r129.parseOvertimeRequestDocument('R3', { userId: 'sam', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', status: 'pending', lines, appliedBookingIds: ['B1'] })
  assert.equal(r129.overtimeReturnReady({ request: partial, decisions: { B2: { action: 'approve' } } }).ready, true)
  const finish = r129.overtimeReturnWrites({ request: partial, decisions: { B2: { action: 'approve' } }, bookings: { B2: b2 }, organization: R129_ORG, timeZone: R129_TZ, deciderId: 'lm' })
  assert.deepEqual(finish.ok && [finish.lineOutcomes, finish.requestFields.appliedBookingIds], [{ B1: 'alreadyApplied', B2: 'applied' }, ['B1', 'B2']])
  // Not pending → refused.
  const notPending = r129.overtimeReturnWrites({ request: returned, decisions, bookings: {}, organization: R129_ORG, timeZone: R129_TZ, deciderId: 'lm' })
  assert.equal(notPending.ok === false && notPending.reason, 'notPending')
})

test('1.29.0 direct change by a PAYE manager or admin, the report snapshot and the weekly report PAYE section', () => {
  const b1 = r129Booking('B1', '2026-11-04', '06:30', '14:00')
  const tick = r129.overtimeDirectWrites({ booking: b1, action: { action: 'approve' }, userId: 'lm', reviewerId: 'lm', organization: R129_ORG, timeZone: R129_TZ })!
  assert.equal(tick.bookingWrite, null)
  assert.equal(tick.hoursChanged, false)
  assert.equal(tick.reviewWrite.fields.fingerprint, r129.overtimeBookingFingerprint(b1))
  const x = r129.overtimeDirectWrites({ booking: b1, action: { action: 'strike' }, userId: 'lm', reviewerId: 'lm', organization: R129_ORG, timeZone: R129_TZ })!
  assert.deepEqual(x.bookingWrite, { collection: 'bookings', bookingId: 'B1', set: { workStartTime: '07:30' }, remove: [] })
  assert.equal(x.hoursChanged, true)
  assert.equal(x.reviewWrite.fields.decision, 'trimmed')
  const lines = r129.payeOvertimeLines({
    personIds: ['sam'],
    bookings: [b1],
    organization: R129_ORG,
    timeZone: R129_TZ,
    range: { start: '2026-11-01', end: '2026-11-30' },
  })
  const snapshot = r129.overtimeReportSnapshot({ userId: 'sam', userName: 'Sam', companyName: 'Acme', rangeStart: '2026-10-26', rangeEnd: '2026-11-25', lines, generatedBy: 'sam' })
  assert.deepEqual(snapshot.totals, { overtimeHours: 1.5, clockHours: 1, lineCount: 1 })
  const roundTrip = r129.parseOvertimeReportDocument('REP1', JSON.parse(JSON.stringify(snapshot)))
  // 1.33.0 adds header and table fields (reportRows.test.ts); the pre-1.33 text fields are unchanged.
  const reportText = r129.overtimeReportRows(roundTrip)
  assert.deepEqual(
    { title: reportText.title, subtitle: reportText.subtitle, rows: reportText.rows, total: reportText.total },
    {
      title: 'Overtime report · Sam',
      subtitle: 'Mon 26 Oct – Wed 25 Nov',
      rows: ['Wed 4 Nov · J-1042 Riverside Flats · 06:30–14:00 · 1h × 1.5 = 1.5h'],
      total: 'Total overtime: 1.5h',
    }
  )
  const people = [
    { id: 'sam', name: 'Sam', employmentType: 'paye' },
    { id: 'pat', name: 'Pat', employmentType: 'self_employed' },
  ]
  const rows = r129.weeklyReportPayeOvertime({
    people,
    bookings: [b1, r129Booking('B2', '2026-11-05', '07:30', '18:00'), r129Booking('P1', '2026-11-05', '07:30', '18:00', { personId: 'pat' })],
    organization: R129_ORG,
    timeZone: R129_TZ,
    range: { start: '2026-11-02', end: '2026-11-08' },
  })
  // 1.32.0: each row shows its multiplier.
  assert.deepEqual(rows.map((row) => row.label), ['Sam · J-1042 · 3h at ×1.5 = 4.5h'])
  assert.equal(r129.weeklyReportPayeDay(people[0], '2026-11-04', R129_TZ), true)
  assert.equal(r129.weeklyReportPayeDay(people[1], '2026-11-04', R129_TZ), false)
  // Effective-dated: PAYE only from the 5th.
  const switching = { employmentType: 'paye', employmentTypeTransitionFrom: 'self_employed', employmentTypeEffectiveAt: '2026-11-05T00:00:00Z' }
  assert.equal(r129.weeklyReportPayeDay(switching, '2026-11-04', R129_TZ), false)
  assert.equal(r129.weeklyReportPayeDay(switching, '2026-11-05', R129_TZ), true)
})

test('1.29.0 review fix: a request can only name and change the requester\'s own bookings', () => {
  const mine = r129Booking('B1', '2026-11-04', '06:30', '14:00')
  const theirs = r129Booking('X1', '2026-11-04', '06:30', '14:00', { personId: 'someone-else' })
  // Building a line for someone else's booking gives nothing.
  assert.equal(r129.overtimeRequestLineFields({ booking: theirs, organization: R129_ORG, timeZone: R129_TZ, proposal: { action: 'strike' }, personIds: ['sam'] }), null)
  const ownLine = r129.overtimeRequestLineFields({ booking: mine, organization: R129_ORG, timeZone: R129_TZ, proposal: { action: 'strike' }, personIds: ['SAM'] })!
  const forged = r129.overtimeRequestLineFields({ booking: theirs, organization: R129_ORG, timeZone: R129_TZ, proposal: { action: 'strike' } })!
  // The write keeps only lines on the requester's own bookings.
  const fields = r129.overtimeRequestWriteFields({
    userId: 'sam', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', lines: [ownLine, forged], personIds: ['sam'], bookings: [mine, theirs],
  })!
  assert.deepEqual((fields.lines as Array<{ bookingId: string }>).map((line) => line.bookingId), ['B1'])
  assert.equal(r129.overtimeRequestWriteFields({ userId: 'sam', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', lines: [forged], personIds: ['sam'], bookings: [theirs] }), null)
  // A forged stored request: the Return re-checks every live booking and leaves the foreign one out.
  const request = r129.parseOvertimeRequestDocument('R9', { userId: 'sam', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', status: 'pending', lines: [ownLine, forged] })
  const result = r129.overtimeReturnWrites({
    request,
    decisions: { B1: { action: 'approve' }, X1: { action: 'approve' } },
    bookings: { B1: mine, X1: theirs },
    organization: R129_ORG,
    timeZone: R129_TZ,
    deciderId: 'admin',
    requesterIds: ['sam'],
  })
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.bookingWrites.map((row) => row.bookingId), ['B1'])
  assert.deepEqual(result.foreignBookingIds, ['X1'])
  assert.deepEqual(result.requestFields.droppedBookingIds, ['X1'])
  assert.deepEqual(result.reviewWrites.map((row) => row.docId), ['sam_B1'])
})

test('1.33.0 item b: a line manager decides every line of their report, under any id the person goes by (no "Needs an admin")', () => {
  const rowBooking = r129Booking('BR', '2026-11-04', '06:30', '14:00', { personId: 'row-sam' })
  const line = r129.overtimeRequestLineFields({ booking: rowBooking, organization: R129_ORG, timeZone: R129_TZ, proposal: { action: 'strike' } })!
  const request = r129.parseOvertimeRequestDocument('R8', { userId: 'sam', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', status: 'pending', lines: [line] })
  const base = { request, bookings: { BR: rowBooking }, organization: R129_ORG, timeZone: R129_TZ, deciderId: 'lm', requesterIds: ['sam', 'row-sam'] }
  const asLineManager = r129.overtimeReturnWrites({ ...base, decisions: { BR: { action: 'approve' } } })
  assert.equal(asLineManager.ok, true)
  if (asLineManager.ok) {
    assert.deepEqual(asLineManager.lineOutcomes, { BR: 'applied' })
    assert.deepEqual(asLineManager.bookingWrites, [{ collection: 'bookings', bookingId: 'BR', set: { workStartTime: '07:30', overtimeReturnRequestId: 'R8' }, remove: [] }])
    assert.equal(Object.values(asLineManager.lineOutcomes).includes('needsAdmin' as never), false)
  }
  assert.equal(r129.overtimeDeciderMayWriteBooking({ booking: { id: 'BR', personId: 'row-sam' }, requesterUserId: 'sam', requesterIds: ['sam', 'row-sam'] }), true)
  // Without the person's ids only their users id counts (1.32 shape); a row on another email is never theirs.
  assert.equal(r129.overtimeDeciderMayWriteBooking({ booking: { id: 'BR', personId: 'row-sam' }, requesterUserId: 'sam' }), false)
  const other = r129.overtimeReturnWrites({ ...base, requesterIds: ['sam'], decisions: { BR: { action: 'approve' } } })
  assert.deepEqual(other.ok && other.lineOutcomes, { BR: 'foreign' })
  // An unreadable booking is left out, named, and does not block the Return.
  assert.equal(r129.overtimeReturnReady({ request, decisions: {}, skipBookingIds: ['BR'] }).ready, true)
  const unreadable = r129.overtimeReturnWrites({ ...base, decisions: {}, unreadableBookingIds: ['BR'], bookings: {} })
  assert.deepEqual(unreadable.ok && [unreadable.lineOutcomes.BR, unreadable.message], ['unreadable', "Returned 0 lines. 1 booking you can't read left out."])
})

// MARK: - Rulebook 1.30.0 (§26): PAYE price work, expenses and personal site audits

import * as r130 from './index'

const ORG130 = 'org-130'
const rosterPc130 = [
  { id: 'sam', email: 'sam@x.com', role: 'operative', operativeMode: true, employmentType: 'paye', assignedManagerUserIds: ['lm'], isActive: true, firstName: 'Sam', surname: 'Smith' },
  { id: 'SAM-OLD', email: 'sam@x.com', role: 'operative', operativeMode: true, isActive: true },
  { id: 'lm', email: 'lm@x.com', organizationId: ORG130, role: 'manager', manager: true, isActive: true, firstName: 'Lena', surname: 'Manager', assignedManagerUserIds: ['boss'] },
  { id: 'boss', email: 'boss@x.com', organizationId: ORG130, role: 'admin', adminAccess: true, isActive: true, firstName: 'Bo', surname: 'Ss' },
  { id: 'gone', email: 'gone@x.com', role: 'manager', manager: true, isActive: false, firstName: 'Gone' },
  { id: 'op2', email: 'op2@x.com', role: 'operative', operativeMode: true, isActive: true, firstName: 'Olly', assignedManagerUserIds: ['boss'] },
  { id: 'pending', email: 'p@x.com', role: 'manager', manager: true, isActive: true, passwordSet: false, firstName: 'Pend' },
  // 1.30.0 review: a member with no level flag, and a manager whose users document names another company.
  { id: 'member', email: 'm@x.com', organizationId: ORG130, role: 'member', isActive: true, firstName: 'Mem' },
  { id: 'visitor', email: 'v@x.com', organizationId: 'other-org', role: 'manager', manager: true, isActive: true, firstName: 'Vis' },
]
const evidencePc130 = (userId = 'sam', ms = 1_700_000_000_000, ext = 'jpg') =>
  ({ path: r130.payeClaimEvidencePath({ organizationId: ORG130, userId, unixMs: ms, extension: ext })!, name: 'receipt.jpg', kind: 'photo' as const, contentType: 'image/jpeg' })

test('1.30.0 price work approver candidates: active admins and managers only, never operatives, the person, pending or inactive', () => {
  const ids = r130.priceWorkApproverCandidates(rosterPc130[0], rosterPc130, { organizationId: ORG130 }).map((row) => row.id)
  assert.deepEqual(ids.sort(), ['boss', 'lm'])
  // Without the organisation the home-company test is skipped (the flagless member is still never offered).
  assert.deepEqual(r130.priceWorkApproverCandidates(rosterPc130[0], rosterPc130).map((row) => row.id).sort(), ['boss', 'lm', 'visitor'])
  // A manager is never offered themself.
  assert.deepEqual(r130.priceWorkApproverCandidates(rosterPc130[2], rosterPc130, { organizationId: ORG130 }).map((row) => row.id), ['boss'])
  assert.deepEqual(r130.priceWorkApproverCandidates(null, rosterPc130), [])
})

test('1.30.0 price work validation and write fields: name, from–to dates, required approver from the list, amount, evidence in own folder', () => {
  const ctx = { person: rosterPc130[0], roster: rosterPc130, organizationId: ORG130 }
  const draft = { title: 'Skirting', details: 'Flat 4', jobNumber: ' J-1042 ', startDate: '2026-11-03', endDate: '2026-11-03', approvedByUserId: 'lm', amount: '120.5' }
  assert.equal(r130.priceWorkValidationError(draft, ctx), null)
  assert.equal(r130.priceWorkValidationError({ ...draft, title: ' ' }, ctx), r130.PAYE_CLAIM_TITLE_MESSAGE)
  assert.equal(r130.priceWorkValidationError({ ...draft, endDate: '2026-11-02' }, ctx), r130.PRICE_WORK_DATES_MESSAGE)
  assert.equal(r130.priceWorkValidationError({ ...draft, approvedByUserId: '' }, ctx), r130.PRICE_WORK_APPROVER_REQUIRED_MESSAGE)
  for (const bad of ['sam', 'SAM-OLD', 'op2', 'gone', 'pending', 'member', 'visitor', 'Free Text Name']) {
    assert.equal(r130.priceWorkValidationError({ ...draft, approvedByUserId: bad }, ctx), r130.PRICE_WORK_APPROVER_INVALID_MESSAGE, bad)
  }
  assert.equal(r130.priceWorkValidationError({ ...draft, amount: 0 }, ctx), r130.PAYE_CLAIM_AMOUNT_MESSAGE)
  assert.equal(r130.priceWorkValidationError({ ...draft, evidence: [evidencePc130('op2')] }, ctx), r130.PAYE_CLAIM_EVIDENCE_INVALID_MESSAGE)
  const fields = r130.priceWorkWriteFields({ userId: 'sam', draft: { ...draft, evidence: [evidencePc130()] }, ...ctx, currency: 'gbp' })
  assert.deepEqual(fields, {
    userId: 'sam',
    title: 'Skirting',
    details: 'Flat 4',
    jobNumber: 'J-1042',
    startDate: '2026-11-03',
    endDate: '2026-11-03',
    approvedByUserId: 'lm',
    approvedByName: 'Lena Manager',
    amount: 120.5,
    currency: 'GBP',
    evidence: [{ path: `organizations/${ORG130}/payeClaims/sam/sam_1700000000000.jpg`, name: 'receipt.jpg', kind: 'photo', contentType: 'image/jpeg' }],
    createdBy: 'sam',
    personUserId: 'sam',
  })
  // Someone else writing for Sam is refused.
  assert.equal(r130.priceWorkWriteFields({ userId: 'lm', draft, ...ctx, currency: 'GBP' }), null)
})

test('1.30.0 expenses need at least one piece of evidence; write fields are the timesheet expense fields', () => {
  const draft = { title: 'Parking', details: '', jobNumber: 'J-1', date: '2026-11-04', amount: 6.4 }
  assert.equal(r130.expenseValidationError(draft), r130.EXPENSE_EVIDENCE_REQUIRED_MESSAGE)
  assert.equal(r130.expenseWriteFields({ userId: 'sam', draft, currency: 'GBP' }), null)
  const ok = r130.expenseWriteFields({ userId: 'sam', draft: { ...draft, evidence: [evidencePc130(), evidencePc130('sam', 1_700_000_000_001, 'pdf')] }, currency: 'EUR', organizationId: ORG130 })
  assert.equal(ok?.date, '2026-11-04')
  assert.equal(ok?.jobNumber, 'J-1')
  assert.equal((ok?.evidence as unknown[]).length, 2)
  assert.equal(r130.expenseValidationError({ ...draft, date: '2026-02-30', evidence: [evidencePc130()] }), r130.PAYE_CLAIM_DATE_MESSAGE)
  const many = Array.from({ length: 21 }, (_, i) => evidencePc130('sam', 1_700_000_000_000 + i))
  assert.equal(r130.expenseValidationError({ ...draft, evidence: many }), r130.PAYE_CLAIM_EVIDENCE_LIMIT_MESSAGE)
})

test('1.30.0 readers, payrun ranges, totals and report readiness', () => {
  const exp = r130.parseExpenseDocument('E1', { userId: 'sam', title: 'Fuel', amount: '12.345', date: '2026-11-04', evidence: [{ path: evidencePc130().path, name: 'a' }, { name: 'no path' }] })
  assert.equal(exp.amount, 12.35)
  assert.equal(exp.evidence.length, 1)
  assert.equal(exp.evidence[0].kind, 'file')
  // A stored instant reads as its organisation-zone day.
  const exp2 = r130.parseExpenseDocument('E2', { userId: 'sam', title: 'Late', amount: 1, date: { seconds: Date.UTC(2026, 9, 31, 23, 30) / 1000, nanoseconds: 0 } }, { timeZone: 'Europe/London' })
  assert.equal(exp2.date, '2026-10-31')
  const pw = r130.parsePriceWorkDocument('P1', { userId: 'sam', title: 'Tiling', amount: 300, startDate: '2026-11-27', endDate: '2026-11-24', approvedByName: 'Lena' })
  assert.deepEqual([pw.startDate, pw.endDate], ['2026-11-24', '2026-11-27'])
  const org = { invoicing: { payePaydayHistory: [{ day: 25, effectiveFrom: '2026-01-01' }] } }
  const run = r130.payePayrunPeriod(org, '2026-11-04')!
  const inRun = r130.payeClaimsInRange([pw, exp, exp2], run)
  assert.deepEqual(inRun.map((row) => row.id), ['E2', 'E1', 'P1'])
  assert.equal(r130.payeClaimsTotal(inRun), 313.35)
  assert.deepEqual(r130.payeClaimsInRange([exp2], { start: '2026-11-01', end: '2026-11-30' }), [])
  assert.equal(r130.payeClaimReportReady([]), false)
  assert.equal(r130.payeClaimReportReady(inRun), true)
  assert.deepEqual(r130.payeClaimListRow(pw, 'GBP'), { title: 'Tiling', figure: '£300.00', subtitle: 'Tue 24 Nov – Fri 27 Nov · — · Approved by Lena' })
})

test('1.30.0 who sees price work and expenses: the person, their active line managers, admins — never a peer', () => {
  const sam = rosterPc130[0]
  assert.equal(r130.canViewPayeClaims(sam, sam, rosterPc130), true)
  assert.equal(r130.canViewPayeClaims(rosterPc130[2], sam, rosterPc130), true) // line manager
  assert.equal(r130.canViewPayeClaims(rosterPc130[3], sam, rosterPc130), true) // admin
  assert.equal(r130.canViewPayeClaims(rosterPc130[5], sam, rosterPc130), false) // another operative
  assert.equal(r130.canViewPayeClaims({ ...rosterPc130[2], isActive: false }, sam, rosterPc130), false)
  assert.equal(r130.canWritePayeClaim('sam', { userId: 'sam' }), true)
  assert.equal(r130.canWritePayeClaim('lm', { userId: 'sam' }), false)
})

test('1.30.0 report snapshot, rows and evidence pages are frozen from the items', () => {
  const pdfEvidence = { ...evidencePc130('sam', 1_700_000_000_002, 'pdf'), name: 'invoice.pdf', kind: 'file' as const, contentType: 'application/pdf' }
  const items = [
    r130.parseExpenseDocument('E1', { userId: 'sam', title: 'Fuel', amount: 40, date: '2026-11-04', jobNumber: 'J-9', evidence: [evidencePc130(), pdfEvidence, { path: `organizations/${ORG130}/payeClaims/sam/sam_1700000000005.docx`, name: 'note.docx' }] }),
    r130.parseExpenseDocument('E2', { userId: 'sam', title: 'Parking', amount: 5.5, date: '2026-11-05', evidence: [evidencePc130('sam', 1_700_000_000_003)] }),
  ]
  const snap = r130.payeClaimReportSnapshot({ kind: 'expense', userId: 'sam', userName: 'Sam Smith', companyName: 'Co', currency: 'GBP', rangeStart: '2026-10-26', rangeEnd: '2026-11-25', items, generatedBy: 'sam' })
  assert.deepEqual(snap.totals, { amount: 45.5, itemCount: 2, evidenceCount: 4 })
  const rows = r130.payeClaimReportRows(snap)
  assert.equal(rows.title, 'Expenses report · Sam Smith')
  assert.equal(rows.total, 'Total expenses: £45.50')
  assert.equal(rows.rows[0].heading, 'Wed 4 Nov · J-9 · Fuel')
  const pages = r130.payeClaimEvidencePages(snap)
  assert.deepEqual(pages.map((page) => page.drawAs), ['image', 'pdf', 'listed', 'image'])
  assert.equal(pages[1].details[0], 'Evidence 2 of 3: invoice.pdf')
  const back = r130.parsePayeClaimReportDocument('R1', JSON.parse(JSON.stringify(snap)))
  assert.deepEqual({ ...back, id: undefined, generatedAtMs: undefined }, { ...snap, id: undefined, generatedAtMs: undefined })
})

test('1.30.0 self-employed people: Users\' view reads their timesheet entries, read-only, in the range', () => {
  const sheet = r130.parseTimesheetEntries('timesheet_op2_1', {
    expenseEntries: [{ id: 'X1', title: 'Fuel', amount: 10, date: '2026-11-04T09:00:00Z', receiptName: 'receipt.jpg' }],
    priceWorkEntries: [{ id: 'PW1', title: 'Tiles', amount: 200, startDate: '2026-10-20T09:00:00Z', endDate: '2026-11-02T09:00:00Z', agreedManagerName: 'Bo' }],
  }, { timeZone: 'Europe/London' })
  const range = { start: '2026-10-26', end: '2026-11-25' }
  assert.deepEqual(r130.timesheetClaimRows([{ id: 'timesheet_op2_1', entries: sheet }], 'expense', range).map((row) => [row.id, row.startDate, row.amount]), [['X1', '2026-11-04', 10]])
  const pw = r130.timesheetClaimRows([{ id: 'timesheet_op2_1', entries: sheet }], 'priceWork', range)
  assert.deepEqual(pw.map((row) => [row.id, row.startDate, row.endDate, row.approvedByName]), [['PW1', '2026-10-20', '2026-11-02', 'Bo']])
})

test('1.30.0 personal site audits: owner only, free-text job, frozen copy as evidence; storage kinds and delete', () => {
  const imagePath = r130.personalSiteAuditImagePath({ organizationId: ORG130, ownerUserId: 'sam', auditId: 'A1', unixMs: 1_700_000_000_000, extension: 'jpg' })!
  assert.equal(imagePath, `organizations/${ORG130}/personalSiteAudits/sam/A1/sam_1700000000000.jpg`)
  const draft = { jobNumber: 'J-77', jobName: 'Garden wall', date: '2026-11-04', authorName: 'Sam', items: [{ id: 'i1', title: 'Crack', imagePath }] }
  assert.equal(r130.personalSiteAuditValidationError({ ...draft, jobName: '' }), r130.PERSONAL_SITE_AUDIT_JOB_NAME_MESSAGE)
  assert.equal(r130.personalSiteAuditValidationError({ ...draft, items: [] }), r130.PERSONAL_SITE_AUDIT_ITEMS_MESSAGE)
  assert.equal(r130.personalSiteAuditValidationError(draft, { organizationId: ORG130, ownerUserId: 'lm' }), r130.PERSONAL_SITE_AUDIT_ITEMS_MESSAGE)
  const fields = r130.personalSiteAuditWriteFields({ ownerUserId: 'sam', draft, organizationId: ORG130 })!
  assert.equal(fields.ownerUserId, 'sam')
  const audit = r130.parsePersonalSiteAuditDocument('A1', fields)
  assert.equal(r130.canViewPersonalSiteAudit('sam', audit), true)
  assert.equal(r130.canViewPersonalSiteAudit('boss', audit), false)
  assert.deepEqual(r130.personalSiteAuditsFor([audit, { ...audit, id: 'A2', ownerUserId: 'lm' }], 'sam').map((a) => a.id), ['A1'])
  assert.equal(r130.personalSiteAuditPdfRows(audit).lines[0], 'Job number: J-77')
  const copyPath = r130.payeClaimEvidencePath({ organizationId: ORG130, userId: 'sam', unixMs: 1_700_000_000_009, extension: 'pdf' })!
  assert.deepEqual(r130.personalSiteAuditEvidence(audit, copyPath), {
    path: copyPath,
    name: 'Site audit (General) · J-77 Garden wall · Wed 4 Nov',
    kind: 'personalSiteAudit',
    contentType: 'application/pdf',
    auditId: 'A1',
  })
  assert.equal(r130.storedFileKind(imagePath)?.kind, 'personal_site_audit')
  assert.equal(r130.storedFileKind(copyPath)?.ownerUserId, 'sam')
  const admin = { isAdmin: true, isSuperAdmin: false, isManager: false, isOperativeMode: false } as never
  assert.equal(r130.fileDeletePermission({ storagePath: imagePath, organizationId: ORG130, viewerUserId: 'boss', viewerRole: admin, nowMs: 1_700_000_000_500 }).reason, 'owner_only')
  assert.equal(r130.fileDeletePermission({ storagePath: copyPath, organizationId: ORG130, viewerUserId: 'boss', viewerRole: admin, nowMs: 1_700_000_000_500 }).reason, 'admin')
  assert.equal(r130.fileDeletePermission({ storagePath: imagePath, organizationId: ORG130, viewerUserId: 'sam', viewerRole: null as never, nowMs: 1_700_000_000_500 }).allowed, true)
})

test('1.30.0 the new collections are listed for live reads and the operational paths', () => {
  for (const id of ['priceWorkItems', 'expenseItems', 'payeClaimReports', 'personalSiteAudits']) {
    assert.ok(r130.LIVE_COLLECTIONS.some((row) => row.id === id), id)
    assert.ok(id in r130.OPERATIONAL_COLLECTION_PATHS, id)
  }
})

test('1.30.0 review: evidence is only the person\'s own claim files — other people\'s, private audit photos, URLs and junk are dropped', () => {
  const own = evidencePc130()
  const raw = [
    own,
    { path: `organizations/${ORG130}/payeClaims/op2/op2_1.jpg`, name: 'theirs' },
    { path: `organizations/${ORG130}/personalSiteAudits/sam/A1/sam_1.jpg`, name: 'private' },
    { path: 'https://firebasestorage.googleapis.com/v0/b/x/o/y', name: 'url' },
    { path: 'junk', name: 'junk' },
    { path: `organizations/other-org/payeClaims/sam/sam_2.jpg`, name: 'other org' },
  ]
  assert.deepEqual(r130.parsePayeClaimEvidence(raw, { userId: 'sam', organizationId: ORG130 }).map((e) => e.name), ['receipt.jpg'])
  assert.deepEqual(r130.parsePayeClaimEvidence(raw, { userId: 'sam' }).map((e) => e.name), ['receipt.jpg', 'other org'])
  assert.equal(r130.parseExpenseDocument('E', { userId: 'sam', title: 'x', amount: 1, date: '2026-11-04', evidence: raw }, { organizationId: ORG130 }).evidence.length, 1)
  assert.equal(r130.parsePriceWorkDocument('P', { userId: 'op2', title: 'x', amount: 1, startDate: '2026-11-04', evidence: raw }).evidence.length, 1)
  assert.equal(r130.parsePayeClaimReportDocument('R', { userId: 'sam', items: [{ id: 'i', evidence: raw }] }).items[0].evidence.length, 2)
})

test('1.30.0 review: just-uploaded evidence is deleted within the undo window only; older files are kept', () => {
  const fresh = evidencePc130('sam', 1_700_000_000_000)
  const old = evidencePc130('sam', 1_600_000_000_000)
  const theirs = evidencePc130('op2', 1_700_000_000_000)
  assert.deepEqual(r130.payeClaimEvidenceToDelete([fresh, old, theirs, fresh], { organizationId: ORG130, viewerUserId: 'sam', nowMs: 1_700_000_060_000 }), [fresh.path])
  assert.deepEqual(r130.payeClaimEvidenceToDelete([fresh], { organizationId: ORG130, viewerUserId: 'sam', nowMs: 1_700_000_000_000 + 16 * 60_000 }), [])
})

// MARK: - 1.30.1 price work needs a job number (owner decision 4 Nov)

import * as r1301 from './index'

test('1.30.1 priceWorkJobNumberError / priceWorkJobNumberText: required, trimmed, 1–60, "—" for older items', () => {
  assert.equal(r1301.priceWorkJobNumberError(''), r1301.PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE)
  assert.equal(r1301.priceWorkJobNumberError('   '), r1301.PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE)
  assert.equal(r1301.priceWorkJobNumberError(null), r1301.PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE)
  assert.equal(r1301.PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE, 'Add the job number for this price work.')
  assert.equal(r1301.priceWorkJobNumberError('x'.repeat(61)), r1301.PRICE_WORK_JOB_NUMBER_TOO_LONG_MESSAGE)
  assert.equal(r1301.priceWorkJobNumberError(` ${'x'.repeat(60)} `), null)
  assert.equal(r1301.priceWorkJobNumberError(1042), null)
  assert.equal(r1301.priceWorkJobNumberText(' J-7 '), 'J-7')
  assert.equal(r1301.priceWorkJobNumberText(''), '—')
  assert.equal(r1301.priceWorkJobNumberText(undefined), '—')
})

test('1.30.1 PAYE price work: required on add, read and shown as "—" when an older item has none', () => {
  const roster = [
    { id: 'sam', email: 'sam@x.com', role: 'operative', operativeMode: true, isActive: true, passwordSet: true, organizationId: 'org1', firstName: 'Sam', surname: 'S' },
    { id: 'lm', email: 'lm@x.com', role: 'manager', manager: true, isActive: true, passwordSet: true, organizationId: 'org1', firstName: 'Lena', surname: 'M' },
  ]
  const ctx = { person: roster[0], roster, organizationId: 'org1' }
  const draft = { title: 'Skirting', startDate: '2026-11-03', endDate: '2026-11-03', approvedByUserId: 'lm', amount: 100 }
  assert.equal(r1301.priceWorkValidationError(draft as never, ctx as never), r1301.PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE)
  assert.equal(r1301.priceWorkWriteFields({ userId: 'sam', draft, ...ctx, currency: 'GBP' } as never), null)
  assert.equal(r1301.priceWorkValidationError({ ...draft, jobNumber: 'x'.repeat(61) } as never, ctx as never), r1301.PRICE_WORK_JOB_NUMBER_TOO_LONG_MESSAGE)
  assert.equal(r1301.priceWorkWriteFields({ userId: 'sam', draft: { ...draft, jobNumber: ' J-9 ' }, ...ctx, currency: 'GBP' } as never)?.jobNumber, 'J-9')
  // Reader: stored text or number kept; an older item has '' and stays valid.
  const old = r1301.parsePriceWorkDocument('P0', { userId: 'sam', title: 'Old', amount: 50, startDate: '2026-11-03', approvedByName: 'Lena' })
  assert.equal(old.jobNumber, '')
  assert.equal(r1301.parsePriceWorkDocument('P1', { userId: 'sam', title: 'N', amount: 1, startDate: '2026-11-03', jobNumber: 1042 }).jobNumber, '1042')
  const fresh = r1301.parsePriceWorkDocument('P2', { userId: 'sam', title: 'New', amount: 70, startDate: '2026-11-04', jobNumber: 'J-5' })
  assert.equal(r1301.payeClaimListRow(old, 'GBP').subtitle, 'Tue 3 Nov · — · Approved by Lena')
  assert.equal(r1301.payeClaimListRow(fresh, 'GBP').subtitle, 'Wed 4 Nov · J-5')
  // The report copy carries the job number; the summary shows "—" for an older item.
  const snap = r1301.payeClaimReportSnapshot({ kind: 'priceWork', userId: 'sam', userName: 'Sam', currency: 'GBP', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', items: [old, fresh], generatedBy: 'sam' })
  assert.deepEqual(snap.items.map((item) => item.jobNumber), ['', 'J-5'])
  assert.deepEqual(r1301.payeClaimReportRows(snap).rows.map((row) => row.heading), ['Tue 3 Nov · — · Old', 'Wed 4 Nov · J-5 · New'])
  // Expenses keep their optional job number (no "—" in the heading).
  const exp = r1301.parseExpenseDocument('E1', { userId: 'sam', title: 'Fuel', amount: 5, date: '2026-11-04' })
  const expSnap = r1301.payeClaimReportSnapshot({ kind: 'expense', userId: 'sam', userName: 'Sam', currency: 'GBP', rangeStart: '2026-11-01', rangeEnd: '2026-11-30', items: [exp], generatedBy: 'sam' })
  assert.equal(r1301.payeClaimReportRows(expSnap).rows[0].heading, 'Wed 4 Nov · Fuel')
})

test('1.30.1 timesheet price work: new or edited entries need a job number; untouched older entries and reviews never ask', () => {
  const at = (iso: string) => new Date(iso)
  const legacy = { id: 'AAA', title: 'Tiling', details: '', jobNumber: '', agreedManagerName: 'Lena', startDate: at('2026-11-03T00:00:00Z'), endDate: null, amount: 100, managerDecision: 'approved' }
  const noId = { title: 'Grout', details: 'x', agreedManagerName: 'Lena', startDate: { seconds: Date.UTC(2026, 10, 4) / 1000, nanoseconds: 0 }, amount: 20 }
  // Untouched: the same entry (id in another case), and an id-less stored entry read back with a derived id.
  assert.equal(r1301.timesheetPriceWorkJobNumberError([legacy, noId], [{ ...legacy, id: 'aaa' }, { ...noId, id: 'derived-1', startDate: at('2026-11-04T00:00:00Z'), endDate: null }]), null)
  // A reviewer's decision or revised amount is not an edit.
  assert.equal(r1301.timesheetPriceWorkJobNumberError([legacy], [{ ...legacy, managerDecision: 'edited', managerRevisedAmount: 80 }]), null)
  // The owner edits the older entry: asks for the job number.
  assert.equal(r1301.timesheetPriceWorkJobNumberError([legacy], [{ ...legacy, amount: 120 }]), r1301.PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE)
  assert.equal(r1301.timesheetPriceWorkJobNumberError([legacy], [{ ...legacy, amount: 120, jobNumber: 'J-1' }]), null)
  // A new entry needs one.
  const added = { id: 'BBB', title: 'Skirting', details: '', jobNumber: ' ', agreedManagerName: 'Lena', startDate: at('2026-11-05T00:00:00Z'), endDate: null, amount: 40 }
  assert.equal(r1301.timesheetPriceWorkJobNumberError([legacy], [legacy, added]), r1301.PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE)
  assert.equal(r1301.timesheetPriceWorkJobNumberError([legacy], [legacy, { ...added, jobNumber: 'x'.repeat(61) }]), r1301.PRICE_WORK_JOB_NUMBER_TOO_LONG_MESSAGE)
  assert.equal(r1301.timesheetPriceWorkJobNumberError(null, [{ ...added, jobNumber: 'J-2' }]), null)
  // Removing an entry never asks.
  assert.equal(r1301.timesheetPriceWorkJobNumberError([legacy, added], []), null)
})

test('1.30.1 timesheetInvoiceRows carries each row\'s job number', () => {
  const sheet = {
    priceWorkEntries: [
      { id: 'P1', title: 'Tiling', jobNumber: 'J-3', startDate: '2026-11-03T00:00:00Z', amount: 100 },
      { id: 'P2', title: 'Old', startDate: '2026-11-03T00:00:00Z', amount: 50 },
    ],
    expenseEntries: [{ id: 'E1', title: 'Fuel', jobNumber: 'J-4', date: '2026-11-03T00:00:00Z', amount: 5 }],
  }
  const rows = r1301.timesheetInvoiceRows({ sheet, payrollLines: [{ id: 'L1', amount: 200, dayKey: '2026-11-03', jobNumber: 'J-9' }], extrasMode: 'raw' } as never)
  assert.deepEqual(rows.map((row) => [row.kind, row.id, row.jobNumber]), [['labour', 'L1', 'J-9'], ['priceWork', 'P1', 'J-3'], ['priceWork', 'P2', ''], ['expense', 'E1', 'J-4']])
  assert.equal(r1301.priceWorkJobNumberText(rows[2].jobNumber), '—')
  const signed = r1301.timesheetInvoiceRows({ sheet: { weeklyReportOverride: { lines: [], priceWork: [{ id: 'P1', title: 'Tiling', jobNumber: 'J-3', amount: 100, decision: 'approved' }], expenses: [] } }, payrollLines: [], extrasMode: 'decided' } as never)
  assert.deepEqual(signed.map((row) => row.jobNumber), ['J-3'])
})

test('1.30.2 nobody reviews their own timesheet under any of their ids; userTimesheetSubjects leaves the viewer out', () => {
  const R = R112 as unknown as typeof import('./index')
  // Admins and the Super Admin are never the reviewer of their own sheet.
  assert.equal(R.timesheetWriterIsReviewer({ writerUserId: 'ADM', subjectUserId: 'adm', writerIsAdmin: true }), false)
  // A former invite id or a same-email id is the same person.
  assert.equal(R.timesheetWriterIsReviewer({ writerUserId: 'adm', writerFormerIds: ['old-adm'], subjectUserId: 'OLD-ADM', writerIsAdmin: true }), false)
  assert.equal(R.timesheetWriterIsReviewer({ writerUserId: 'adm', writerAliasIds: ['adm-2'], subjectUserId: 'adm-2', writerIsAdmin: true }), false)
  const roster = [
    { id: 'adm', email: 'a@x.com' },
    { id: 'adm-dup', email: 'A@x.com' },
    { id: 'op', email: 'op@x.com' },
  ]
  assert.equal(R.timesheetWriterIsReviewer({ writerUserId: 'adm', subjectUserId: 'adm-dup', writerIsAdmin: true, roster }), false)
  assert.equal(R.timesheetWriterIsReviewer({ writerUserId: 'adm', subjectUserId: 'op', writerIsAdmin: true, roster }), true)
  // A line manager is never their own reviewer even when listed as their own line manager.
  assert.equal(R.timesheetWriterIsReviewer({ writerUserId: 'lm', subjectUserId: 'lm', subjectLineManagerIds: ['lm'] }), false)

  const adminRole = { isAdmin: true, isSuperAdmin: false, isManager: true, isOperativeMode: false }
  const opRole = { isAdmin: false, isSuperAdmin: false, isManager: false, isOperativeMode: true }
  const members = [
    { id: 'adm', email: 'a@x.com', role: adminRole },
    { id: 'adm-dup', email: 'a@x.com', role: adminRole },
    { id: 'other-adm', email: 'b@x.com', role: adminRole },
    { id: 'op', email: 'op@x.com', role: opRole, assignedManagerUserIds: ['adm'] },
  ]
  assert.deepEqual(
    R.userTimesheetSubjects({ viewer: { id: 'ADM', role: adminRole as never }, members: members as never }).map((row) => row.userId),
    ['other-adm', 'op']
  )
  // A manager who lists themself as their own line manager does not see their own sheet.
  const mgrRole = { isAdmin: false, isSuperAdmin: false, isManager: true, isOperativeMode: false }
  assert.deepEqual(
    R.userTimesheetSubjects({
      viewer: { id: 'mgr', role: mgrRole as never },
      members: [
        { id: 'mgr', email: 'm@x.com', role: mgrRole, assignedManagerUserIds: ['mgr'] },
        { id: 'op', email: 'op@x.com', role: opRole, assignedManagerUserIds: ['mgr'] },
      ] as never,
    }).map((row) => row.userId),
    ['op']
  )
})

test('1.30.2 organizationSelfManageFlags reads the toggles for this organisation only', () => {
  const R = R112 as unknown as typeof import('./index')
  const home = { organizationId: 'org-a', role: 'admin', adminAccess: true, permissions: { annualLeaveSelfBook: true, timesheetSelfSign: true } }
  // Their users document of this organisation.
  assert.deepEqual(
    R.organizationSelfManageFlags({ organizationId: 'ORG-A', userId: 'u', user: home }),
    { source: 'users', superAdmin: false, admin: true, active: true, annualLeaveSelfBook: true, timesheetSelfSign: true }
  )
  // In org B the home document never counts: the membership there decides.
  assert.deepEqual(
    R.organizationSelfManageFlags({ organizationId: 'org-b', userId: 'u', user: home }),
    { source: 'none', superAdmin: false, admin: false, active: true, annualLeaveSelfBook: false, timesheetSelfSign: false }
  )
  const managerHere = { role: 'manager', permissions: { manager: true, annualLeaveSelfBook: false, timesheetSelfSign: true } }
  const b = R.organizationSelfManageFlags({ organizationId: 'org-b', userId: 'u', user: home, membership: managerHere })
  assert.equal(b.source, 'membership')
  assert.equal(b.annualLeaveSelfBook, false)
  // Timesheet self-sign is admins only.
  assert.equal(b.timesheetSelfSign, false)
  // A visiting admin with the toggles on only in the membership here.
  const opAtHome = { organizationId: 'org-a', role: 'operative', operativeMode: true, permissions: { operativeMode: true } }
  const adminHere = { role: 'admin', isSuperAdmin: true, permissions: { adminAccess: true, annualLeaveSelfBook: true, timesheetSelfSign: true } }
  const v = R.organizationSelfManageFlags({ organizationId: 'org-b', userId: 'u', user: opAtHome, membership: adminHere })
  assert.deepEqual([v.source, v.admin, v.superAdmin, v.annualLeaveSelfBook, v.timesheetSelfSign], ['membership', true, false, true, true])
  // Nested permissions win over a flat legacy copy (parseOrgMembershipDocument).
  const flatOn = { role: 'admin', annualLeaveSelfBook: true, permissions: { annualLeaveSelfBook: false } }
  assert.equal(R.organizationSelfManageFlags({ organizationId: 'org-b', userId: 'u', membership: flatOn }).annualLeaveSelfBook, false)
  // The creator is the Super Admin: both on, whatever is stored.
  const c = R.organizationSelfManageFlags({ organizationId: 'org-b', userId: 'u', user: opAtHome, creatorUserId: 'u' })
  assert.deepEqual([c.source, c.superAdmin, c.annualLeaveSelfBook, c.timesheetSelfSign], ['creator', true, true, true])
  // A super admin users document of this organisation reads both on.
  const sa = R.organizationSelfManageFlags({ organizationId: 'org-a', userId: 'u', user: { organizationId: 'org-a', isSuperAdmin: true } })
  assert.deepEqual([sa.superAdmin, sa.annualLeaveSelfBook, sa.timesheetSelfSign], [true, true, true])
  // An operative-mode membership never self-books.
  const opHere = { role: 'member', permissions: { operativeMode: true, annualLeaveSelfBook: true } }
  assert.equal(R.organizationSelfManageFlags({ organizationId: 'org-b', userId: 'u', membership: opHere }).annualLeaveSelfBook, false)
})

// MARK: - 1.30.3 job-manager candidates (§11)

import {
  JOB_MANAGER_FORMER_NOTES as r1303FormerNotes,
  jobManagerAssignments as r1303Assignments,
  jobManagerCandidates as r1303Candidates,
} from './jobManagers.ts'
import { stableManagerId as r1303StableManagerId } from './staffAccess.ts'

const r1303Row = (row: Record<string, unknown>) => ({ isActive: true, passwordSet: true, ...row }) as never

test('1.30.3 jobManagerCandidates: active admins and managers, never operatives, pending, inactive or deleted', () => {
  const roster = [
    r1303Row({ id: 'adm', email: 'a@x.test', firstName: 'Ann', surname: 'Admin', role: 'admin', adminAccess: true }),
    r1303Row({ id: 'mgr', email: 'm@x.test', firstName: 'Mo', surname: 'Manager', role: 'manager', manager: true }),
    r1303Row({ id: 'op', email: 'o@x.test', firstName: 'Olly', surname: 'Op', role: 'operative', operativeMode: true }),
    r1303Row({ id: 'pend', email: 'p@x.test', firstName: 'Pat', surname: 'Pending', role: 'manager', passwordSet: false }),
    r1303Row({ id: 'pend2', email: 'q@x.test', firstName: 'Quin', surname: 'Invite', role: 'manager', status: 'pending' }),
    r1303Row({ id: 'off', email: 'i@x.test', firstName: 'Ina', surname: 'Inactive', role: 'manager', isActive: false }),
    r1303Row({ id: 'del', email: '', firstName: 'Deleted', surname: 'user', role: 'manager' }),
  ]
  const out = r1303Candidates(roster)
  assert.deepEqual(out.map((row) => [row.id, row.level]), [['adm', 'admin'], ['mgr', 'manager']])
})

test('1.30.3 jobManagerCandidates: a stale admin duplicate on the email never hides the live manager document', () => {
  // The owner bug: admin → manager → admin … left an old admin invite copy on the same email. The fold kept the admin
  // copy (admin first) and web judged the person on it (pending), so they vanished from the job-manager picker.
  const roster = [
    r1303Row({ id: 'old-invite', email: 'Sam@X.test', firstName: 'Sam', surname: 'Lee', role: 'admin', adminAccess: true, passwordSet: false }),
    r1303Row({ id: 'live', email: 'sam@x.test', firstName: 'Sam', surname: 'Lee', role: 'manager', manager: true }),
  ]
  const out = r1303Candidates(roster)
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'live')
  assert.equal(out[0].level, 'manager')
  assert.deepEqual([...out[0].userIds].sort(), ['live', 'old-invite'])
})

test('1.30.3 jobManagerCandidates: two live documents on one email are one person; level from the live row', () => {
  const roster = [
    r1303Row({ id: 'b', email: 'k@x.test', firstName: 'Kim', surname: 'Ng', role: 'admin', adminAccess: true }),
    r1303Row({ id: 'a', email: 'K@x.test', firstName: 'Kim', surname: 'Ng', role: 'manager', manager: true, isActive: false }),
  ]
  const out = r1303Candidates(roster)
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'b')
  assert.equal(out[0].level, 'admin')
})

test('1.30.3 jobManagerCandidates: manager role without the flag, and manager flag without the role, are managers', () => {
  const roster = [
    r1303Row({ id: 'role', email: 'r@x.test', firstName: 'Rae', role: 'manager' }),
    r1303Row({ id: 'flag', email: 'f@x.test', firstName: 'Fin', permissions: { manager: true } }),
    r1303Row({ id: 'demoted', email: 'd@x.test', firstName: 'Dee', role: 'operative', permissions: { manager: false, adminAccess: false, operativeMode: true } }),
  ]
  assert.deepEqual(r1303Candidates(roster).map((row) => [row.id, row.level]), [['flag', 'manager'], ['role', 'manager']])
})

test('1.30.3 jobManagerAssignments: current, former (demoted, inactive, catalogue without account) and unknown', () => {
  const roster = [
    r1303Row({ id: 'mgr', email: 'm@x.test', firstName: 'Mo', surname: 'M', role: 'manager', manager: true }),
    r1303Row({ id: 'demoted', email: 'd@x.test', firstName: 'Dee', surname: 'D', role: 'operative', operativeMode: true }),
    r1303Row({ id: 'gone', email: 'g@x.test', firstName: 'Gus', surname: 'G', role: 'manager', isActive: false }),
  ]
  const catalogue = [
    { id: 'cat-mgr', email: 'M@x.test', firstName: 'Mo', lastName: 'M' },
    { id: 'cat-orphan', email: 'nobody@x.test', firstName: 'No', lastName: 'Body' },
  ]
  const job = { managerIds: [r1303StableManagerId('cat-mgr'), 'user:demoted', 'GONE', 'cat-orphan', 'not-loaded', 'mgr'] }
  const out = r1303Assignments(job, roster, catalogue)
  assert.deepEqual(
    out.map((row) => [row.storedId, row.state, row.reason]),
    [
      [r1303StableManagerId('cat-mgr'), 'current', null],
      ['user:demoted', 'former', 'not_manager'],
      ['GONE', 'former', 'inactive'],
      ['cat-orphan', 'former', 'no_account'],
      ['not-loaded', 'unknown', null],
    ]
  )
  assert.equal(out[0].candidate?.id, 'mgr')
  assert.equal(out[1].note, r1303FormerNotes.not_manager)
  assert.equal(out[1].name, 'Dee D')
})

// MARK: - 1.31.0 people and access

test('1.31.0 lineManagerIds / leaveApproverIds / canViewPersonPay: a manager demoted to operative is nobody’s line manager', () => {
  const roster = [
    { id: 'SA', email: 'sa@x', role: 'admin', isSuperAdmin: true },
    { id: 'EX', email: 'ex@x', role: 'operative', operativeMode: true },
    { id: 'LM', email: 'lm@x', role: 'manager', manager: true },
    { id: 'OP', email: 'op@x', role: 'operative', operativeMode: true, assignedManagerUserIds: ['EX'] },
  ]
  const op = roster[3]
  assert.deepEqual(R112.lineManagerIds(op, roster as never), [])
  assert.deepEqual(R112.leaveApproverIds(op, roster as never), ['SA'])
  assert.equal(R112.rosterMemberIsOperativeLevel(roster[1]), true)
  assert.equal(R112.rosterMemberIsOperativeLevel({ id: 'bare' }), false)
  assert.equal(R112.rosterMemberIsOperativeLevel({ id: 'r', role: { isAdmin: false, isSuperAdmin: false, isManager: false, isOperativeMode: true } }), true)
  // Still a line manager while a manager.
  assert.deepEqual(R112.lineManagerIds({ ...op, assignedManagerUserIds: ['LM'] }, roster as never), ['LM'])
})

test('1.31.0 userPermissionFlag: the top-level value when stored, else permissions.{key} — one reader for every rule', () => {
  assert.equal(R112.userPermissionFlag({ annualLeaveSelfBook: false, permissions: { annualLeaveSelfBook: true } }, 'annualLeaveSelfBook'), false)
  assert.equal(R112.userPermissionFlag({ permissions: { annualLeaveSelfBook: true } }, 'annualLeaveSelfBook'), true)
  assert.equal(R112.userPermissionFlag({ annualLeaveSelfBook: 1 }, 'annualLeaveSelfBook'), true)
  // The self-book rule reads the same way as every screen (before 1.31.0 it read "either place on").
  const user = { id: 'M', role: 'manager', manager: true, annualLeaveSelfBook: false, permissions: { annualLeaveSelfBook: true } }
  assert.equal(R112.selfManageToggles(user as never).annualLeaveSelfBook, false)
  assert.equal(R112.effectivePermissions(user).annualLeaveSelfBook, false)
})

test('1.31.0 lineManagerReports / lineManagerChangeBlock: a line manager is not made an operative, deactivated or deleted while anyone reports to them', () => {
  const roster = [
    { id: 'LM', email: 'lm@x', firstName: 'Lee', surname: 'M', role: 'manager', manager: true },
    { id: 'lm-old', email: 'LM@x', role: 'admin', adminAccess: true, isActive: false },
    { id: 'A', email: 'a@x', firstName: 'Ann', surname: 'A', role: 'operative', operativeMode: true, assignedManagerUserIds: ['lm-old'] },
    { id: 'B', email: 'b@x', firstName: 'Bob', surname: 'B', role: 'operative', operativeMode: true, assignedManagerUserId: 'LM' },
    { id: 'C', email: 'c@x', firstName: 'Cy', surname: 'C', role: 'operative', operativeMode: true, assignedManagerUserIds: ['LM'], isActive: false },
    { id: 'D', email: 'd@x', firstName: 'Di', surname: 'D', role: 'manager', manager: true, assignedManagerUserIds: ['LM'], hasNoLineManager: true },
  ]
  const lm = roster[0]
  assert.deepEqual(R112.lineManagerReports(lm, roster).map((row) => row.name), ['Ann A', 'Bob B'])
  for (const change of [{ kind: 'level', to: 'operative' }, { kind: 'deactivate' }, { kind: 'delete' }] as const) {
    const block = R112.lineManagerChangeBlock({ person: lm, roster, change })
    assert.equal(block.blocked, true, change.kind)
    assert.equal(block.message, R112.LINE_MANAGER_REPORTS_BLOCK_MESSAGE)
  }
  assert.equal(R112.lineManagerChangeBlock({ person: lm, roster, change: { kind: 'level', to: 'admin' } }).blocked, false)
  assert.equal(R112.lineManagerChangeBlock({ person: roster[3], roster, change: { kind: 'delete' } }).blocked, false)
})

const r1310Manager = { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }
const r1310Roster = [
  { id: 'M', email: 'm@x', role: 'manager', manager: true },
  { id: 'm-old', email: 'M@x', role: 'manager' },
  { id: 'R', email: 'r@x', role: 'operative', operativeMode: true, assignedManagerUserIds: ['m-old'] },
  { id: 'GONE', email: 'g@x', role: 'operative', operativeMode: true, assignedManagerUserIds: ['M'], isActive: false },
  { id: 'X', email: 'x@x', role: 'operative', operativeMode: true },
]
const r1310Jobs = [
  { id: 'J1', managerUserIds: ['M'] },
  { id: 'J2', managerIds: ['other'] },
]
const r1310Scope = (viewer: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  R112.warningScopeFor({ viewer: viewer as never, jobs: r1310Jobs, roster: r1310Roster as never, enforced: false, ...extra })

test('1.31.0 warningScopeFor: admins see everything; a manager (any toggles) only themselves, their active reports and the jobs they manage', () => {
  assert.equal(r1310Scope({ role: { ...r1310Manager, isAdmin: true }, ids: ['A'] }).kind, 'all')
  assert.equal(r1310Scope({ role: { ...r1310Manager, isSuperAdmin: true }, ids: ['S'] }).kind, 'all')
  const scope = r1310Scope({ role: r1310Manager, ids: ['M'], email: 'm@x', toggles: { projects: true, smallWorks: true } })
  assert.equal(scope.kind, 'jobs')
  if (scope.kind !== 'jobs') return
  assert.deepEqual(scope.jobIds, ['j1'])
  // Own ids under every document (m-old), the report R (stored against m-old), never the inactive GONE or X.
  assert.deepEqual([...scope.personIds].sort(), ['m', 'm-old', 'r'])
  assert.deepEqual([...scope.personEmails].sort(), ['m@x', 'r@x'])
  // Operatives: nothing.
  const op = r1310Scope({ role: { ...r1310Manager, isManager: false, isOperativeMode: true }, ids: ['X'] })
  assert.deepEqual(op, { kind: 'jobs', jobIds: [], personIds: [], personEmails: [], unbookedLabour: false })
})

test('1.31.0 warningScopeFor per type: unbooked labour, qualifications, unverified → self + reports; clashes → person or managed job; materials → managed jobs', () => {
  const scope = r1310Scope({ role: r1310Manager, ids: ['M'], email: 'm@x' }, { enforced: false })
  // Unbooked labour needs every booking read (enforced reads off here, so the manager reads every booking).
  assert.equal(scope.kind === 'jobs' && scope.unbookedLabour, true)
  const unbooked = R112.unbookedLabourRows({
    scope,
    startDayKey: '2026-11-02',
    endDayKey: '2026-11-02',
    includeWeekends: false,
    standardPaidHours: 8,
    people: [
      { id: 'R', email: 'r@x', name: 'Rae', isActive: true, passwordSet: true, isOperativeMode: true, isManager: false, isAdmin: false, isSuperAdmin: false },
      { id: 'X', email: 'x@x', name: 'Xan', isActive: true, passwordSet: true, isOperativeMode: true, isManager: false, isAdmin: false, isSuperAdmin: false },
    ],
    operatives: [],
    bookings: [],
    holidays: [],
  } as never)
  assert.deepEqual(unbooked.map((row: { personName?: string; operativeName?: string }) => row.operativeName ?? row.personName), ['Rae'])
  const quals = R112.qualificationExpiryRows({
    scope,
    referenceIso: '2026-11-02T10:00:00Z',
    timeZone: 'Europe/London',
    operatives: [
      { id: 'R', isActive: true, name: 'Rae', email: 'r@x', expiries: [{ qualificationId: 'q', name: 'CSCS', expiryIso: '2026-11-10T00:00:00Z' }] },
      { id: 'X', isActive: true, name: 'Xan', email: 'x@x', expiries: [{ qualificationId: 'q', name: 'CSCS', expiryIso: '2026-11-10T00:00:00Z' }] },
    ],
  } as never)
  assert.deepEqual(quals.map((row: { operativeId: string }) => row.operativeId), ['R'])
  // Unverified accounts are filtered by person (unverifiedOperativeRows → isPersonInWarningScope).
  assert.equal(R112.isPersonInWarningScope(scope, ['R']), true)
  assert.equal(R112.isPersonInWarningScope(scope, ['X'], 'x@x'), false)
  // Operative / manager clashes: a person in scope, or any booking on a managed job.
  assert.equal(R112.isWarningRowInScope(scope, { jobIds: ['J2', 'J2'], personIds: ['X'] }), false)
  assert.equal(R112.isWarningRowInScope(scope, { jobIds: ['J2', 'j1'], personIds: ['X'] }), true)
  assert.equal(R112.isWarningRowInScope(scope, { jobIds: ['J2'], personIds: ['R'] }), true)
  assert.equal(R112.isWarningRowInScope(scope, { personIds: ['M-OLD'] }), true)
  // Materials cut-off: managed jobs only.
  assert.equal(R112.isJobInWarningScope(scope, 'J1'), true)
  assert.equal(R112.isJobInWarningScope(scope, 'J2'), false)
  assert.equal(R112.managerBookingJobId({ locationType: 'project', locationId: 'J1' }), 'J1')
  assert.equal(R112.isWarningRowInScope(R112.WARNING_SCOPE_ALL, { personIds: ['X'] }), true)
})

test('1.31.0 warningScopeFor: a manager with no reports and no jobs sees only warnings about themselves', () => {
  const scope = R112.warningScopeFor({ viewer: { role: r1310Manager, ids: ['X2'], email: 'x2@x' }, jobs: r1310Jobs, roster: [{ id: 'X2', email: 'x2@x', role: 'manager' }], enforced: false })
  assert.ok(scope.kind === 'jobs')
  if (scope.kind !== 'jobs') return
  assert.deepEqual(scope.jobIds, [])
  assert.deepEqual(scope.personIds, ['x2'])
  assert.equal(R112.isWarningRowInScope(scope, { jobIds: ['J1'], personIds: ['R'] }), false)
  assert.equal(R112.isPersonInWarningScope(scope, ['X2']), true)
  // 1.33.0: a manager reads every booking with enforced reads on too, so their unbooked-labour rows stay.
  const enforced = R112.warningScopeFor({ viewer: { role: r1310Manager, ids: ['X2'] }, jobs: [], roster: [], enforced: true })
  assert.equal(enforced.kind === 'jobs' && enforced.unbookedLabour, true)
})

test('1.31.0 jobManagerRemovalWrites: made an operative, deactivated or deleted — off every job; admin ↔ manager keeps them', () => {
  const roster = [{ id: 'M', email: 'm@x', role: 'manager', manager: true }, { id: 'm-old', email: 'M@x', role: 'manager' }]
  const managers = [{ id: 'cat-m', email: 'm@x' }]
  const jobs = [
    { id: 'J1', collection: 'projects' as const, managerId: 'M', managerIds: ['M', 'K'], managerUserIds: ['M', 'K'] },
    { id: 'J2', collection: 'smallWorks' as const, managerId: R112.stableManagerId('cat-m'), managerIds: [R112.stableManagerId('cat-m')], managerUserIds: ['m-old'] },
    { id: 'J3', collection: 'projects' as const, managerIds: ['K'], managerUserIds: ['K'] },
    { id: 'J4', collection: 'projects' as const, managerIds: ['user:M'] },
  ]
  const person = roster[0]
  const out = R112.jobManagerRemovalWrites({ organizationId: 'ORG', person, change: { kind: 'level', to: 'operative' }, jobs, roster, managers })
  assert.deepEqual(out.map((row) => row.jobId), ['J1', 'J2', 'J4'])
  assert.deepEqual(out[0].set, { managerIds: ['K'], managerUserIds: ['K'], managerId: 'K' })
  assert.deepEqual(out[1], { path: 'organizations/ORG/smallWorks/J2', collection: 'smallWorks', jobId: 'J2', set: {}, remove: ['managerIds', 'managerUserIds', 'managerId'] })
  assert.deepEqual(out[2].remove, ['managerIds'])
  assert.equal(R112.jobManagerRemovalWrites({ organizationId: 'ORG', person, change: { kind: 'level', to: 'admin' }, jobs, roster }).length, 0)
  assert.equal(R112.jobManagerRemovalWrites({ organizationId: 'ORG', person, change: { kind: 'deactivate' }, jobs, roster }).length, 3)
  assert.equal(R112.jobManagerRequiredError([]), R112.JOB_MANAGER_REQUIRED_MESSAGE)
  assert.equal(R112.jobManagerRequiredError(['', 'M']), null)
  assert.equal(R112.jobManagerRemovedNoticeText('Mo', 2).message.includes('2 jobs'), true)
})

test('1.31.0 superAdminTransferWrites: one batch; the outgoing Super Admin without a line manager keeps self-approval', () => {
  const roster = [
    { id: 'SA', email: 'sa@x', role: 'admin', adminAccess: true, isSuperAdmin: true, organizationId: 'ORG' },
    { id: 'NEW', email: 'new@x', role: 'admin', adminAccess: true, organizationId: 'ORG' },
    { id: 'LM', email: 'lm@x', role: 'admin', adminAccess: true, organizationId: 'ORG' },
  ]
  const writes = R112.superAdminTransferWrites({ organizationId: 'ORG', fromUserId: 'SA', toUserId: 'NEW', previousCreatorUserId: 'SA', roster })!
  assert.deepEqual(writes[0], { path: 'organizations/ORG', kind: 'organization', fields: { creatorUserId: 'NEW', 'members.NEW': 'admin' } })
  const newProfile = writes.find((row) => row.path === 'users/NEW')!
  assert.equal(newProfile.fields.isSuperAdmin, true)
  assert.equal(newProfile.fields.timesheetSelfSign, true)
  assert.equal(newProfile.fields.annualLeaveSelfBook, true)
  const outgoing = writes.find((row) => row.path === 'users/SA')!
  assert.equal(outgoing.fields.isSuperAdmin, false)
  assert.equal(outgoing.fields.annualLeaveSelfBook, true)
  assert.equal(outgoing.fields.timesheetSelfSign, true)
  // With a line manager the outgoing Super Admin's toggles are left as stored (normal approval).
  const withManager = R112.superAdminTransferWrites({
    organizationId: 'ORG', fromUserId: 'SA', toUserId: 'NEW',
    roster: [{ ...roster[0], assignedManagerUserIds: ['LM'] }, roster[1], roster[2]],
  })!
  assert.equal('annualLeaveSelfBook' in withManager.find((row) => row.path === 'users/SA')!.fields, false)
  assert.equal(R112.superAdminTransferWrites({ organizationId: 'ORG', fromUserId: 'SA', toUserId: 'sa', roster }), null)
})

test('1.31.0 userActiveWrites: every same-email users document of this organisation, and the membership', () => {
  const writes = R112.userActiveWrites({
    organizationId: 'ORG',
    person: { id: 'U', email: 'u@x' },
    isActive: false,
    roster: [{ id: 'U', email: 'u@x', organizationId: 'ORG' }, { id: 'u-old', email: 'U@x', organizationId: 'organizations/ORG' }, { id: 'u-b', email: 'u@x', organizationId: 'OTHER' }],
  })
  assert.deepEqual(writes.map((row) => row.path), ['users/U', 'users/u-old', 'users/U/orgMemberships/ORG'])
  assert.deepEqual(writes[2].fields, { accountActive: false })
})

test('1.31.0 accountTypeChangeWrites: partial writes, demotion clears No line manager, same-email members entries, demoted admin keeps Annual Leave Management', () => {
  const person = { id: 'A', email: 'a@x', organizationId: 'ORG', role: 'admin', adminAccess: true, hasNoLineManager: true, projects: true, permissions: { projects: true } }
  const plan = R112.accountTypeChangeWrites({
    person, kind: 'manager', organizationId: 'ORG',
    roster: [{ id: 'a-old', email: 'A@x', organizationId: 'ORG' }],
    members: { A: 'admin', 'a-old': 'admin' },
  })
  assert.ok(plan.ok)
  if (!plan.ok) return
  const fields = (plan.writes[0] as { fields: Record<string, unknown> }).fields
  assert.equal(fields.hasNoLineManager, false)
  assert.equal('projects' in fields, false, 'unchanged toggle not rewritten')
  assert.equal(fields.adminAccess, false)
  const dup = (plan.writes[1] as { fields: Record<string, unknown> }).fields
  assert.equal(dup.role, 'manager')
  assert.equal('projects' in dup, false)
  assert.deepEqual((plan.writes[2] as { fields: Record<string, unknown> }).fields, { 'members.A': 'manager', 'members.a-old': 'manager' })
  // A Super Admin's Annual Leave Management reads on; never stored, it is kept on when they stop being an admin.
  assert.equal(R112.accountTypePermissions('manager', { role: 'admin', isSuperAdmin: true }).annualLeaveSelfBook, true)
  assert.equal(R112.accountTypePermissions('manager', { role: 'admin', adminAccess: true, annualLeaveSelfBook: true }).annualLeaveSelfBook, true)
})

test('1.31.0 userDeleteRefusal: a manager with the Operatives permission deletes operatives only', () => {
  const role = (over: Record<string, boolean>) => ({ isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: false, ...over })
  const manager = { id: 'M', role: role({ isManager: true }) }
  const operative = { id: 'O', role: role({ isOperativeMode: true }) }
  assert.equal(R112.userDeleteRefusal(manager, operative, { actorManagesOperatives: true }), null)
  assert.equal(R112.userDeleteRefusal(manager, operative), 'not_admin')
  assert.equal(R112.userDeleteRefusal(manager, { id: 'M2', role: role({ isManager: true }) }, { actorManagesOperatives: true }), 'operatives_only')
  assert.equal(R112.userDeleteRefusal(manager, { id: 'A', role: role({ isAdmin: true }) }, { actorManagesOperatives: true }), 'operatives_only')
  assert.equal(R112.userDeleteRefusal(manager, { id: 'm', role: role({ isOperativeMode: true }) }, { actorManagesOperatives: true }), 'self')
})

test('1.31.0 operative_deleted and job_manager_removed are company activity notices for the admins', () => {
  for (const type of ['operative_deleted', 'job_manager_removed']) {
    assert.ok((R112.COMPANY_ACTIVITY_NOTICE_TYPES as readonly string[]).includes(type), type)
    assert.equal(R112.notificationPreferenceKeyForType(type), 'companyActivity')
    assert.ok(R112.notificationCatalogRow(type))
    assert.equal(R112.notificationDeliversDevicePush(type), true)
  }
})

test('1.31.0 job edits: rosterListFor folds before it classifies; legacy assignedManagerUserIds; job type stored fields', () => {
  const roster = [
    { id: 'live', email: 's@x', firstName: 'Sam', surname: 'S', role: 'manager', manager: true, passwordSet: true, isActive: true },
    { id: 'stale', email: 'S@x', firstName: 'Sam', surname: 'S', role: 'admin', adminAccess: true, passwordSet: false, isActive: false },
  ]
  assert.deepEqual(R112.rosterListFor('managers', roster).map((row) => row.id), ['live'])
  assert.deepEqual(R112.rosterListFor('admins', roster).map((row) => row.id), [])
  const job = R112.parseProjectDocument('J', { siteName: 'S', assignedManagerUserIds: ['M1', 'M2'] })!
  assert.deepEqual(job.managerUserIds, ['M1', 'M2'])
  assert.deepEqual(R112.jobTypeStoredFields('CAT A', 'projects'), { jobType: 'CAT A', customJobType: null })
  assert.deepEqual(R112.jobTypeStoredFields('cat b', 'projects'), { jobType: 'CAT B', customJobType: 'CAT B' })
  assert.deepEqual(R112.jobTypeStoredFields('Fit-out', 'projects'), { jobType: 'CAT A', customJobType: 'Fit-out' })
  assert.deepEqual(R112.jobTypeStoredFields('Small works', 'smallWorks'), { jobType: 'Small Works', customJobType: null })
  assert.deepEqual(R112.jobTypeStoredFields('Decarbonization', 'smallWorks'), { jobType: 'Small Works', customJobType: 'Decarbonisation' })
  assert.equal(R112.jobTypeDisplayName({ jobType: 'CAT A', customJobType: 'Fit-out' }, 'projects'), 'Fit-out')
  assert.equal(R112.jobTypeDisplayName({}, 'smallWorks'), 'Small Works')
})

test('1.31.0 userDeleteWrites: an operatives manager runs the account step one write at a time, users document before the members entry', () => {
  const role = { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: true }
  const steps = R112.userDeleteWrites({
    orgId: 'ORG', user: { id: 'OP', email: 'op@x', role }, actorUserId: 'M', platform: 'web', nowIso: '2026-11-04T10:00:00Z', actorManagesOperatives: true,
  })
  assert.deepEqual(steps.map((step) => step.writes.map((write) => write.path)), [
    ['users/OP/private/taxIds'], ['users/OP/orgMemberships/ORG'], ['organizations/ORG/userEmails/op@x'], ['users/OP'], ['organizations/ORG'],
  ])
  const admin = R112.userDeleteWrites({ orgId: 'ORG', user: { id: 'OP', email: 'op@x', role }, actorUserId: 'A', platform: 'web', nowIso: '2026-11-04T10:00:00Z' })
  assert.equal(admin[0].writes.length, 5)
})

test('1.31.0 operativesManagerMayDeleteBooking: future bookings of a person with no account only; userDeleteWrites leaves today and the past', () => {
  const now = '2026-11-04T10:00:00Z'
  const day = (key: string) => Date.parse(`${key}T00:00:00Z`)
  assert.equal(R112.operativesManagerMayDeleteBooking({ dateMs: day('2026-11-05'), nowIso: now, timeZone: 'Europe/London', operativeHasAccount: false }), true)
  assert.equal(R112.operativesManagerMayDeleteBooking({ dateMs: day('2026-11-04'), nowIso: now, timeZone: 'Europe/London', operativeHasAccount: false }), false)
  assert.equal(R112.operativesManagerMayDeleteBooking({ dateMs: day('2026-11-01'), nowIso: now, timeZone: 'Europe/London', operativeHasAccount: false }), false)
  assert.equal(R112.operativesManagerMayDeleteBooking({ dateMs: day('2026-11-05'), nowIso: now, timeZone: 'Europe/London', operativeHasAccount: true }), false)
  const role = { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: true }
  const input = {
    orgId: 'ORG', user: { id: 'OP', email: 'op@x', role }, actorUserId: 'M', platform: 'web' as const, nowIso: now, tz: 'Europe/London',
    bookings: [
      { id: 'past', operativeId: 'OP', dateMs: day('2026-11-03') },
      { id: 'today', operativeId: 'OP', dateMs: day('2026-11-04') },
      { id: 'future', operativeId: 'OP', dateMs: day('2026-11-06') },
    ],
    managerSiteBookings: [{ id: 'site', userId: 'OP', dateMs: day('2026-11-06') }],
  }
  const bookingPaths = (steps: ReturnType<typeof R112.userDeleteWrites>) =>
    steps.filter((step) => step.step === 'bookings').flatMap((step) => step.writes.filter((w) => w.op === 'delete').map((w) => w.path))
  assert.deepEqual(bookingPaths(R112.userDeleteWrites({ ...input, actorManagesOperatives: true })), ['organizations/ORG/bookings/future'])
  assert.deepEqual(bookingPaths(R112.userDeleteWrites(input)), [
    'organizations/ORG/bookings/today', 'organizations/ORG/bookings/future', 'organizations/ORG/managerSiteBookings/site',
  ])
})

test('1.31.0 exportedTimesheetHistorySubjects: own sheets (read-only) and inactive people in scope; userTimesheetSubjects unchanged', () => {
  const role = (over: Record<string, boolean>) => ({ isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: false, ...over })
  const members = [
    { id: 'ADMIN', email: 'admin@x', role: role({ isAdmin: true }) },
    { id: 'admin-old', email: 'ADMIN@x', role: role({ isAdmin: true }) },
    { id: 'LM', email: 'lm@x', role: role({ isManager: true }) },
    { id: 'OP', email: 'op@x', role: role({ isOperativeMode: true }), assignedManagerUserIds: ['LM'] },
    { id: 'GONE', email: 'gone@x', isActive: false, role: role({ isOperativeMode: true }), assignedManagerUserIds: ['LM'] },
    { id: 'OTHER', email: 'other@x', isActive: false, role: role({ isOperativeMode: true }) },
  ]
  const admin = { id: 'ADMIN', role: role({ isAdmin: true }) }
  assert.deepEqual(R112.userTimesheetSubjects({ viewer: admin, members }).map((row) => row.userId), ['LM', 'OP'])
  assert.deepEqual(R112.exportedTimesheetHistorySubjects({ viewer: admin, members }), [
    { userId: 'ADMIN', own: true },
    { userId: 'admin-old', own: true },
    { userId: 'LM', own: false },
    { userId: 'OP', own: false },
    { userId: 'GONE', own: false },
    { userId: 'OTHER', own: false },
  ])
  const manager = { id: 'LM', role: role({ isManager: true }) }
  assert.deepEqual(R112.exportedTimesheetHistorySubjects({ viewer: manager, members }).map((row) => row.userId), ['LM', 'OP', 'GONE'])
  // An operative has no User Timesheets: nothing here (their sheets are on My Timesheets).
  assert.deepEqual(R112.exportedTimesheetHistorySubjects({ viewer: { id: 'OP', role: role({ isOperativeMode: true }) }, members }), [])
  // Opening one's own sheet stays non-reviewable.
  assert.equal(R112.timesheetDocumentSubjectId('timesheet_ABC-123_1761955200'), 'ABC-123')
  assert.equal(R112.timesheetDocumentSubjectId('timesheet_user_with_underscore_1761955200'), 'user_with_underscore')
  assert.equal(R112.timesheetDocumentSubjectId('settings'), '')
})

// MARK: - Rulebook 1.32.0: overtime multiplier at create, PAYE payday required, overtime and claims review, pay visibility

import * as r132 from './index'

const R132_ROLE = (over: Partial<{ isSuperAdmin: boolean; isAdmin: boolean; isManager: boolean; isOperativeMode: boolean }>) => ({
  isSuperAdmin: false,
  isAdmin: false,
  isManager: false,
  isOperativeMode: false,
  ...over,
})

test('1.32.0 multiplier at create: pre-filled with the organisation rate, stored only when changed (decision A)', () => {
  const control = r132.overtimeRateCreateControl({ organization: R129_ORG, dayKey: '2026-11-04', timeZone: R129_TZ })
  assert.equal(control.prefill, 1.5)
  assert.equal(control.options.find((row) => row.organization)?.label, '×1.5 (organisation rate)')
  assert.equal(r132.overtimeRateCreateControl({ organization: R129_ORG, dayKey: '2026-11-08', timeZone: R129_TZ }).prefill, 2, 'Sunday every hour ×2')
  assert.deepEqual(r132.overtimeMultiplierCreateFields({ chosen: 1.5, organizationMultiplier: 1.5 }), {})
  assert.deepEqual(r132.overtimeMultiplierCreateFields({ chosen: 2, organizationMultiplier: 1.5 }), { otMultiplierOverride: 2 })
  assert.deepEqual(r132.overtimeMultiplierCreateFields({ chosen: 3.1, organizationMultiplier: 1.5 }), {})
  assert.deepEqual(r132.overtimeMultiplierCreateFields({ chosen: null, organizationMultiplier: 1.5 }), {})
})

test('1.32.0 weekly report: the multiplier per row and the changed-rate mark', () => {
  const people = [{ id: 'sam', name: 'Sam', employmentType: 'paye' }]
  const rows = r132.weeklyReportPayeOvertime({
    people,
    bookings: [
      r129Booking('B1', '2026-11-04', '07:30', '18:00'),
      r129Booking('B2', '2026-11-05', '07:30', '18:00', { otMultiplierOverride: 2 }),
      r129Booking('B3', '2026-11-06', '07:30', '18:00', { otMultiplierOverride: 1.5 }),
    ],
    organization: R129_ORG,
    timeZone: R129_TZ,
    range: { start: '2026-11-02', end: '2026-11-08' },
  })
  assert.deepEqual(
    rows.map((row) => [row.multiplierText, row.changedFromOrganization]),
    [
      ['4h at ×1.5 = 6h', false],
      ['2h at ×2 = 4h', true],
    ]
  )
  assert.equal(rows[1].label, 'Sam · J-1042 · 2h at ×2 = 4h · changed from organisation rate (×1.5)')
  assert.equal(r132.overtimeMultiplierText({ clockHours: 6.5, multiplier: 2, breakHours: 0.5, overtimeHours: 12.5 }), '6.5h at ×2 − 0.5h break = 12.5h')
})

test('1.32.0 PAYE payday: required at setup, banner while missing', () => {
  assert.equal(r132.payePaydaySetupError(null), r132.PAYE_PAYDAY_REQUIRED_MESSAGE)
  assert.equal(r132.payePaydaySetupError(''), r132.PAYE_PAYDAY_REQUIRED_MESSAGE)
  assert.equal(r132.payePaydaySetupError(32), r132.PAYE_PAYDAY_INVALID_MESSAGE)
  assert.equal(r132.payePaydaySetupError(25), null)
  assert.equal(r132.payePaydayMissing({ invoicing: {} }), true)
  assert.equal(r132.payePaydayBanner({ organization: { invoicing: {} }, viewerIsAdmin: true }), r132.PAYE_PAYDAY_MISSING_BANNER)
  assert.equal(r132.payePaydayBanner({ organization: { invoicing: {} }, viewerIsAdmin: false }), r132.PAYE_PAYDAY_NOT_SET_MESSAGE)
  assert.equal(r132.payePaydayBanner({ organization: { invoicing: {} }, loaded: false, viewerIsAdmin: true }), null)
  assert.equal(r132.payePaydayBanner({ organization: { invoicing: { payePayday: 25 } }, viewerIsAdmin: true }), null)
})

test('1.32.0 overtime: future days in the current payrun are open; own edits are requests with a line manager', () => {
  const org = { ...R129_ORG, invoicing: { payePayday: 25, payePaydayHistory: [{ day: 25, effectiveFrom: '2026-10-26' }] } }
  assert.equal(r132.overtimeEditableUntil(org, '2026-11-04'), '2026-11-25')
  assert.equal(r132.overtimeEditableUntil(R129_ORG, '2026-11-04'), '2026-11-04', 'no payday: today')
  const roster = [
    { id: 'adm', email: 'a@x.com', role: 'admin', adminAccess: true, isActive: true, assignedManagerUserIds: ['boss'] },
    { id: 'solo', email: 's@x.com', role: 'admin', adminAccess: true, isActive: true },
    { id: 'boss', email: 'b@x.com', role: 'admin', adminAccess: true, isActive: true, isSuperAdmin: true },
  ]
  const viewer = (id: string, role: ReturnType<typeof R132_ROLE>) => ({ role, ids: [id], uid: id })
  const booking = { collection: 'bookings', projectId: 'job-1', dayKey: '2026-11-20' }
  const base = { isPaye: true, booking, editableUntilKey: '2026-11-25', roster }
  assert.equal(r132.canEditOwnBookingOvertime({ ...base, viewer: viewer('adm', R132_ROLE({ isAdmin: true })), person: roster[0] }), 'request', 'admin with a line manager')
  assert.equal(r132.canEditOwnBookingOvertime({ ...base, viewer: viewer('solo', R132_ROLE({ isAdmin: true })), person: roster[1] }), 'direct', 'admin with none')
  assert.equal(r132.canEditOwnBookingOvertime({ ...base, viewer: viewer('boss', R132_ROLE({ isAdmin: true, isSuperAdmin: true })), person: roster[2] }), 'direct', 'Super Admin')
  assert.equal(r132.canEditOwnBookingOvertime({ ...base, booking: { ...booking, dayKey: '2026-11-26' }, viewer: viewer('solo', R132_ROLE({ isAdmin: true })), person: roster[1] }), 'none', 'next payrun stays locked')
  assert.equal(r132.canEditOwnBookingOvertime({ ...base, viewer: viewer('op', R132_ROLE({ isOperativeMode: true })), person: { id: 'op' } }), 'request', 'an operative with no line manager still requests')
})

test('1.32.0 overtimePersonIds: every id plus every operatives row on the email, never one row', () => {
  const roster = [
    { id: 'sam', email: 'sam@x.com', isActive: true },
    { id: 'SAM-OLD', email: 'Sam@x.com', isActive: true },
  ]
  const ids = r132.overtimePersonIds({ person: roster[0], roster, operatives: [{ id: 'row-1', email: 'SAM@x.com' }, { id: 'row-2', email: 'sam@x.com' }, { id: 'row-x', email: 'x@x.com' }] })
  assert.deepEqual(ids, ['sam', 'SAM-OLD', 'row-1', 'row-2'])
  assert.deepEqual(r132.overtimePersonIds({ person: null }), [])
})

test('1.32.0 price work and expenses review: ✓ ✕ per item, one Approve (1.33.0: older ids reviewed by the line manager too)', () => {
  const evidence = [{ path: 'organizations/o/payeClaims/sam/a.pdf', name: 'a.pdf', kind: 'file' as const, contentType: 'application/pdf', auditId: null }]
  const item = (id: string, userId: string, amount: number) => ({ kind: 'expense' as const, id, userId, title: 'Fuel', details: '', amount, currency: 'GBP', evidence, createdAtMs: null, createdBy: userId, jobNumber: 'J-1', date: '2026-11-04' })
  const items = [item('E1', 'sam', 20), item('E2', 'sam', 30), item('E3', 'SAM-OLD', 40), item('E4', 'sam', 50), item('X', 'pat', 5)]
  const result = r132.payeClaimReviewWrites({
    items,
    decisions: { E1: 'approved', E2: 'rejected', E3: 'approved' },
    subjectUserId: 'sam',
    personIds: ['sam', 'SAM-OLD'],
    reviewerId: 'lm',
    reviewerIsAdmin: false,
  })
  assert.deepEqual(result.outcomes, { E1: 'applied', E2: 'applied', E3: 'applied', E4: 'undecided', X: 'foreign' })
  assert.equal(result.message, 'Approved 2 of 4. 1 rejected; 1 not decided yet.')
  assert.deepEqual(
    result.writes.map((w) => [w.docId, w.fields.decision, w.fields.userId, w.fields.personUserId]),
    [['expense_E1', 'approved', 'sam', undefined], ['expense_E2', 'rejected', 'sam', undefined], ['expense_E3', 'approved', 'SAM-OLD', 'sam']],
    'an item under another of the person\'s ids carries personUserId'
  )
  assert.equal(r132.payeClaimReviewOutcomeLabel('foreign'), 'Not theirs — left out.')
  assert.equal(r132.payeClaimReviewOutcomeLabel('applied'), null)
  assert.equal(r132.payeClaimReviewOutcomeLabel('undecided'), null)
  const reviews = result.writes.map((w) => r132.parsePayeClaimReviewDocument(w.docId, w.fields))
  assert.equal(r132.payeClaimReviewState(items[0], reviews).label, 'Approved')
  assert.equal(r132.payeClaimReviewState({ ...items[0], amount: 21 }, reviews).state, 'needsReview', 'a changed item needs review again')
  assert.equal(r132.parsePayeClaimReviewDocument('expense_E3', result.writes[2].fields).personUserId, 'sam')
  assert.equal(reviews[0].personUserId, null)
  const admin = r132.payeClaimReviewWrites({ items: [items[2]], decisions: { E3: 'approved' }, subjectUserId: 'sam', personIds: ['sam', 'SAM-OLD'], reviewerId: 'adm', reviewerIsAdmin: true })
  assert.equal(admin.message, 'Approved 1 of 1.')
  assert.deepEqual(admin.writes[0].fields, { ...result.writes[2].fields, reviewedBy: 'adm' }, 'admins and line managers write the same review')
  const roster = [
    { id: 'sam', email: 'sam@x.com', isActive: true, assignedManagerUserIds: ['lm'], role: 'operative', operativeMode: true },
    { id: 'lm', email: 'lm@x.com', isActive: true, role: 'manager', manager: true },
    { id: 'adm', email: 'adm@x.com', isActive: true, role: 'admin', adminAccess: true },
  ]
  assert.equal(r132.canReviewPayeClaims(roster[1], roster[0], roster), true)
  assert.equal(r132.canReviewPayeClaims(roster[2], roster[0], roster), true)
  assert.equal(r132.canReviewPayeClaims(roster[0], roster[0], roster), false, 'never their own')
})

test('1.32.0 booking screens follow canWriteBooking: other places only for oneself unless admin', () => {
  const manager = { role: R132_ROLE({ isManager: true }), ids: ['m1', 'M1-OLD'] }
  const admin = { role: R132_ROLE({ isAdmin: true }), ids: ['a1'] }
  const operative = { role: R132_ROLE({ isOperativeMode: true }), ids: ['o1'] }
  assert.equal(r132.canBookOtherLocationsFor(manager, ['m1']), true)
  assert.equal(r132.canBookOtherLocationsFor(manager, ['m1-old']), true)
  assert.equal(r132.canBookOtherLocationsFor(manager, ['m1', 'report']), false)
  assert.equal(r132.canBookOtherLocationsFor(admin, ['anyone', 'else']), true)
  assert.equal(r132.canBookOtherLocationsFor(operative, ['o1']), false)
  assert.equal(r132.canBookOtherLocationsFor(manager, []), false)
})

test('1.32.0 small rules: rulebook label, export notice, legal pack write, invitation queries', () => {
  assert.equal(r132.rulebookVersionLabel('1.32.0'), 'Rules 1.32.0')
  assert.equal(r132.rulebookVersionLabel('nonsense'), '')
  assert.equal(r132.timesheetExportOwnSheetNotice({ ownSheetSigned: true }), r132.TIMESHEET_EXPORT_OWN_SHEET_NOTICE)
  assert.equal(r132.timesheetExportOwnSheetNotice({ ownSheetSigned: true, ownSheetExported: true }), null)
  assert.equal(r132.timesheetExportOwnSheetNotice({ ownSheetSigned: false }), null)
  assert.deepEqual(r132.legalPackAcceptanceWriteFields({ userId: 'u1', version: '2026-11', acceptedAt: 5, platform: 'web' }), {
    policyAccepted: true,
    policyAcceptedAt: 5,
    legalPackVersion: '2026-11',
    legalPackAcceptedAt: 5,
    updatedBy: 'u1',
    updatedFrom: 'web',
  })
  assert.equal(r132.legalPackAcceptanceWriteFields({ userId: '', version: 'v', acceptedAt: 1, platform: 'web' }), null)
  assert.deepEqual(r132.invitationListConstraints({ organizationId: 'o', email: 'a@x.com', actorManagesOperatives: false }), [[['organizationId', 'o'], ['email', 'a@x.com']]])
  assert.deepEqual(
    r132.invitationListConstraints({ organizationId: 'o', email: 'a@x.com', actorManagesOperatives: true, senderIds: ['uid1', 'Me@X.com', 'uid1'] }).map((q) => q[2][1]),
    ['uid1', 'Me@X.com', 'me@x.com']
  )
  assert.equal(r132.invitationReadErrorIsSkippable('permission-denied'), true)
  assert.equal(r132.invitationReadErrorIsSkippable('firestore/permission-denied'), true)
  assert.equal(r132.invitationReadErrorIsSkippable('unavailable'), false)
})

test('1.32.0 review fix (r274 S3): weekly report pay follows canViewPersonPay — hidden rate and pay, totals over visible rows only', () => {
  const roster = [
    { id: 'op', email: 'op@x.com', role: 'operative', operativeMode: true, assignedManagerUserIds: ['lm'], isActive: true },
    { id: 'mgr', email: 'mgr@x.com', role: 'manager', manager: true, assignedManagerUserIds: ['adm'], isActive: true },
    { id: 'lm', email: 'lm@x.com', role: 'manager', manager: true, isActive: true },
    { id: 'om', email: 'om@x.com', role: 'manager', manager: true, permissions: { operatives: true }, isActive: true },
    { id: 'adm', email: 'adm@x.com', role: 'admin', adminAccess: true, isActive: true },
  ]
  const row = (subject: Record<string, unknown> | null, pay: number) => ({
    person: String(subject?.id ?? 'x'),
    role: 'r',
    lines: [{ rateType: 'Day', days: 1, rate: pay, pay, rateText: `£${pay}` }],
    personTotal: pay,
    paySubject: subject,
  })
  const rows = [row(roster[0], 200), row(roster[1], 300), row(null, 50)]
  const by = (id: string) => roster.find((r) => r.id === id)!
  const admin = r132.reportPayForViewer(rows, { viewer: by('adm'), roster })
  assert.deepEqual([admin.grandTotal, admin.hiddenPeople], [550, 0])
  const lm = r132.reportPayForViewer(rows, { viewer: by('lm'), roster })
  assert.deepEqual([lm.grandTotal, lm.hiddenPeople], [0, 3], 'a line manager sees no rate on the weekly report')
  assert.deepEqual([lm.rows[0].lines[0].rateText, lm.rows[0].lines[0].payLabel, lm.rows[0].personTotalLabel, lm.rows[0].lines[0].days], ['—', '—', '—', 1])
  const om = r132.reportPayForViewer(rows, { viewer: by('om'), roster })
  assert.deepEqual([om.grandTotal, om.hiddenPeople], [200, 2], 'an operatives manager sees operatives only')
  const self = r132.reportPayForViewer(rows, { viewer: by('mgr'), roster })
  assert.deepEqual([self.grandTotal, self.hiddenPeople], [300, 2], 'everyone sees their own')
})

test('1.32.0 review fix (r274 S4): a booking moved or changed in the Daily Overview sheet keeps its own rate', () => {
  // A ×2 labour booking moved to Office (a new manager site booking) keeps ×2.
  assert.deepEqual(r132.overtimeMultiplierMoveFields({ stored: 2, chosen: 2, organizationMultiplier: 1.5, newDocument: true }), { otMultiplierOverride: 2 })
  assert.deepEqual(r132.overtimeMultiplierMoveFields({ stored: 2, organizationMultiplier: 1.5, newDocument: true }), { otMultiplierOverride: 2 })
  // Moved to another job in the same collection: nothing to write, the stored ×2 stays.
  assert.deepEqual(r132.overtimeMultiplierMoveFields({ stored: 2, chosen: 2, organizationMultiplier: 1.5, newDocument: false }), {})
  // Changed on the sheet: written; set back to the organisation's: removed (decision A).
  assert.deepEqual(r132.overtimeMultiplierMoveFields({ stored: 2, chosen: 2.5, organizationMultiplier: 1.5, newDocument: false }), { otMultiplierOverride: 2.5 })
  assert.deepEqual(r132.overtimeMultiplierMoveFields({ stored: 2, chosen: null, organizationMultiplier: 1.5, newDocument: false }), { otMultiplierOverride: null })
  assert.deepEqual(r132.overtimeMultiplierMoveFields({ stored: 2, chosen: 1.5, organizationMultiplier: 1.5, newDocument: false }), { otMultiplierOverride: null })
  // No rate anywhere: nothing.
  assert.deepEqual(r132.overtimeMultiplierMoveFields({ stored: null, chosen: null, organizationMultiplier: 1.5, newDocument: true }), {})
})

test('1.32.0 review fix (r274 S5): invitation queries ask the email as stored and lower case', () => {
  const queries = r132.invitationListConstraints({ organizationId: 'o', email: 'Ann.Smith@X.com', actorManagesOperatives: false })
  assert.deepEqual(queries.map((q) => q[1][1]), ['Ann.Smith@X.com', 'ann.smith@x.com'])
  assert.equal(r132.invitationListConstraints({ organizationId: 'o', email: 'a@x.com', actorManagesOperatives: false }).length, 1, 'de-duplicated')
  const ops = r132.invitationListConstraints({ organizationId: 'o', email: 'Ann@X.com', actorManagesOperatives: true, senderIds: ['uid1'] })
  assert.deepEqual(ops.map((q) => [q[1][1], q[2][1]]), [['Ann@X.com', 'uid1'], ['ann@x.com', 'uid1']])
})

test('1.32.0 owner decision 5 Nov: the Weekly report is admin-only; a stored manager weeklyReports is ignored', () => {
  const manager = { id: 'm', role: 'manager', manager: true, weeklyReports: true, permissions: { weeklyReports: true } }
  const admin = { id: 'a', role: 'admin', adminAccess: true, weeklyReports: false }
  const operative = { id: 'o', role: 'operative', operativeMode: true, weeklyReports: true }
  assert.equal(r132.canOpenWeeklyReport(manager), false, 'a manager with the stored toggle on has no access')
  assert.equal(r132.canOpenWeeklyReport(admin), true, 'an admin always (the toggle is locked on)')
  assert.equal(r132.canOpenWeeklyReport(operative), false)
  assert.equal(r132.canOpenWeeklyReport({ id: 's', isSuperAdmin: true, role: 'admin' }), true)
  assert.equal(r132.canOpenWeeklyReport(null), false)
  // A level change recalculates: promoted → has it; demoted → loses it (stored value untouched).
  assert.equal(r132.canOpenWeeklyReport({ ...manager, adminAccess: true, role: 'admin' }), true)
  assert.equal(r132.effectivePermissions(manager).weeklyReports, false)
  // The toggle is not offered to managers or operatives.
  const rows = (level: 'admin' | 'manager' | 'operative') =>
    r132.permissionToggleRows({ level, mode: 'edit' }).filter((row) => row.field === 'weeklyReports' && row.visible)
  assert.equal(rows('manager').length, 0)
  assert.equal(rows('operative').length, 0)
  assert.deepEqual(rows('admin').map((row) => [row.value, row.editable]), [[true, false]])
  assert.equal(r132.addUserPermissionDefaults('manager').weeklyReports, false)
})

// MARK: - 1.33.0 §2: Cancel removed as a user action; iOS / Android offline delete

test('1.33.0 bookingRemoveAction: delete for exactly the canDeleteBooking people, none for everyone else, never cancel', () => {
  const role = (over: Partial<{ isAdmin: boolean; isSuperAdmin: boolean; isManager: boolean; isOperativeMode: boolean }>) => ({
    isAdmin: false,
    isSuperAdmin: false,
    isManager: false,
    isOperativeMode: false,
    ...over,
  })
  const admin = { role: role({ isAdmin: true }), ids: ['u-admin'] }
  const superAdmin = { role: role({ isSuperAdmin: true }), ids: ['u-super'] }
  const adminInOperativeMode = { role: role({ isAdmin: true, isOperativeMode: true }), ids: ['u-admin'] }
  const manager = { role: role({ isManager: true }), ids: ['u-mgr'], email: 'mgr@example.com' }
  // Q-E1 (6 Nov): the Operatives permission gives no booking power.
  const operativesManager = { role: role({ isManager: true }), ids: ['u-ops'], toggles: { projects: false, smallWorks: false } }
  const operative = { role: role({}), ids: ['u-op'] }
  const labour = { collection: 'bookings', projectId: 'JOB-1' }
  const ownJob = { managerUserIds: ['u-mgr'] }
  const otherJob = { managerUserIds: ['u-other'] }

  assert.deepEqual([...R112.BOOKING_REMOVE_ACTIONS], ['delete', 'none'])
  assert.equal(R112.bookingRemoveAction(admin, labour, otherJob), 'delete')
  assert.equal(R112.bookingRemoveAction(superAdmin, labour, null), 'delete')
  assert.equal(R112.bookingRemoveAction(adminInOperativeMode, labour, otherJob), 'none')
  assert.equal(R112.bookingRemoveAction(manager, labour, ownJob), 'delete')
  assert.equal(R112.bookingRemoveAction(manager, labour, otherJob), 'none')
  assert.equal(R112.bookingRemoveAction(manager, labour, null), 'none')
  // A managers-list row with the viewer's email makes them the job's manager.
  assert.equal(R112.bookingRemoveAction(manager, labour, { managerIds: ['ROW-1'] }, [{ id: 'ROW-1', email: 'MGR@example.com' }]), 'delete')
  assert.equal(R112.bookingRemoveAction(operativesManager, labour, otherJob), 'none')
  assert.equal(R112.bookingRemoveAction(operative, labour, { managerUserIds: ['u-op'] }), 'none')
  assert.equal(R112.bookingRemoveAction(null, labour, ownJob), 'none')
  assert.equal(R112.bookingRemoveAction(manager, null, ownJob), 'none')
  // Manager schedule: their own office booking; another manager's office booking is not theirs to delete.
  const office = (userId: string) => ({ collection: 'managerSiteBookings', userId, locationType: 'office', locationId: null })
  assert.equal(R112.bookingRemoveAction(manager, office('U-MGR'), null), 'delete')
  assert.equal(R112.bookingRemoveAction(manager, office('u-other'), null), 'none')
  assert.equal(R112.bookingRemoveAction(manager, { collection: 'managerSiteBookings', userId: 'u-other', locationType: 'project', locationId: 'JOB-1' }, ownJob), 'delete')
  assert.equal(R112.bookingRemoveAction(manager, { collection: 'subcontractorBookings', projectId: 'JOB-1' }, ownJob), 'delete')
  assert.equal(R112.bookingRemoveAction(manager, { collection: 'holidayBookings', projectId: 'JOB-1' }, ownJob), 'none')
  // Same answer as canDeleteBooking everywhere.
  for (const viewer of [admin, manager, operativesManager, operative]) {
    for (const job of [ownJob, otherJob, null]) {
      assert.equal(R112.bookingRemoveAction(viewer, labour, job) === 'delete', R112.canDeleteBooking(viewer, labour, job))
    }
  }
})

test('1.33.0 offline policy: labour and manager schedule deletes are queued; subcontractor deletes and cancel are online only', () => {
  assert.equal(R112.offlineAvailability('booking.delete'), 'allowedOffline')
  assert.equal(R112.offlineAvailability('booking.delete_subcontractor'), 'onlineOnly')
  assert.equal(R112.offlineAvailability('booking.cancel'), 'onlineOnly')
  assert.equal(Object.prototype.hasOwnProperty.call(R112.OFFLINE_ACTIONS, 'booking.cancel'), false)
  assert.equal(R112.bookingDeleteOfflineAction('bookings'), 'booking.delete')
  assert.equal(R112.bookingDeleteOfflineAction(' managerSiteBookings '), 'booking.delete')
  assert.equal(R112.bookingDeleteOfflineAction('subcontractorBookings'), 'booking.delete_subcontractor')
  assert.equal(R112.bookingDeleteOfflineAction('holidayBookings'), 'booking.delete_subcontractor')
  assert.equal(R112.bookingDeleteOfflineAction(undefined), 'booking.delete_subcontractor')
  assert.equal(R112.offlineAvailability(R112.bookingDeleteOfflineAction('subcontractorBookings')), 'onlineOnly')
})

test('1.33.0 bookingTombstoneWriteFields: overtimeRequestId only when given and usable', () => {
  const base = { bookingId: 'B-1', collection: 'bookings', deletedBy: 'u-1', deletedFrom: 'ios' }
  assert.deepEqual(R112.bookingTombstoneWriteFields(base), { bookingId: 'B-1', collection: 'bookings', deletedBy: 'u-1', deletedFrom: 'ios' })
  assert.deepEqual(R112.bookingTombstoneWriteFields({ ...base, overtimeRequestId: ' REQ-1 ' }), {
    bookingId: 'B-1',
    collection: 'bookings',
    deletedBy: 'u-1',
    deletedFrom: 'ios',
    overtimeRequestId: 'REQ-1',
  })
  assert.equal('overtimeRequestId' in (R112.bookingTombstoneWriteFields({ ...base, overtimeRequestId: '' }) || {}), false)
  assert.equal('overtimeRequestId' in (R112.bookingTombstoneWriteFields({ ...base, overtimeRequestId: 'a/b' }) || {}), false)
  assert.equal('overtimeRequestId' in (R112.bookingTombstoneWriteFields({ ...base, overtimeRequestId: 42 }) || {}), false)
})

test('1.33.0 bookingDeleteFingerprint: every edited field, both apps the same text', () => {
  const zone = 'Europe/London'
  const labour = {
    collection: 'bookings',
    operativeId: 'OP-1',
    projectId: 'JOB-1',
    date: { seconds: Date.parse('2026-11-09T00:00:00Z') / 1000, nanoseconds: 0 },
    timeSlot: 'custom hours',
    workStartTime: '7:30',
    workEndTime: '17:00:00',
    isBreakRemoved: false,
    otMultiplierOverride: 1.5,
    status: 'confirmed',
    notes: ' Bring PPE ',
  }
  const fp = R112.bookingDeleteFingerprint(labour, zone)
  assert.equal(fp, 'bookings|op-1|job-1|||2026-11-09|CUSTOM_HOURS|07:30|17:00|1.5||Confirmed|Bring PPE')
  // The same booking given a day key and other spellings reads the same.
  assert.equal(
    R112.bookingDeleteFingerprint({ ...labour, date: undefined, dayKey: '2026-11-09', operativeId: 'op-1', projectId: 'job-1', timeSlot: 'CUSTOM_HOURS', workStartTime: '07:30', status: 'Confirmed', notes: 'Bring PPE' }, zone),
    fp
  )
  // A BST date stored as organisation-zone midnight reads its own day.
  assert.equal(R112.bookingDeleteFingerprint({ ...labour, date: Date.parse('2026-07-08T23:00:00Z'), dayKey: null }, zone).split('|')[5], '2026-07-09')
  // Each field a booking edit changes moves the fingerprint.
  const changes: Array<Record<string, unknown>> = [
    { operativeId: 'OP-2' },
    { projectId: 'JOB-2' },
    { date: Date.parse('2026-11-10T00:00:00Z') },
    { timeSlot: 'FULL_DAY' },
    { workStartTime: '08:00' },
    { workEndTime: '16:00' },
    { isBreakRemoved: true },
    { otMultiplierOverride: 2 },
    { otMultiplierOverride: null },
    { status: 'Tentative' },
    { notes: 'Other' },
  ]
  for (const change of changes) assert.notEqual(R112.bookingDeleteFingerprint({ ...labour, ...change }, zone), fp, JSON.stringify(change))
  // Missing status reads Confirmed (as stored by older builds).
  assert.equal(R112.bookingDeleteFingerprint({ ...labour, status: undefined }, zone), fp)
  // Manager schedule: person, place type, place and custom name.
  const office = { collection: 'managerSiteBookings', userId: 'U-1', locationType: 'Office', locationId: null, dayKey: '2026-11-09', timeSlot: 'FULL_DAY' }
  assert.equal(R112.bookingDeleteFingerprint(office, zone), 'managerSiteBookings|u-1||office||2026-11-09|FULL DAY|||||Confirmed|')
  assert.notEqual(R112.bookingDeleteFingerprint({ ...office, locationType: 'custom', customLocationName: 'Depot' }, zone), R112.bookingDeleteFingerprint(office, zone))
  assert.equal(R112.bookingDeleteFingerprint(null, zone), '')
})

test('1.33.0 offlineDeleteReplayDecision: one outcome for each owner case', () => {
  const zone = 'Europe/London'
  const live = { operativeId: 'OP-1', projectId: 'JOB-1', dayKey: '2026-11-09', timeSlot: 'FULL_DAY', status: 'Confirmed' }
  const fingerprint = R112.bookingDeleteFingerprint({ ...live, collection: 'bookings' }, zone)
  const queued = { bookingId: 'B-1', collection: 'bookings', fingerprint }
  const decide = (over: Record<string, unknown>) =>
    R112.offlineDeleteReplayDecision({ queued, live, tombstoned: false, mayDelete: true, timeZone: zone, ...over })

  assert.deepEqual([...R112.OFFLINE_DELETE_REPLAY_DECISIONS], ['apply', 'dropLocal', 'alreadyGone', 'refuseChanged', 'refusePermission'])
  // Unchanged and allowed: the delete and its tombstone are sent.
  assert.equal(decide({}), 'apply')
  assert.equal(decide({ mayDelete: undefined }), 'apply')
  // Created and deleted offline: nothing is sent, whatever the server holds.
  assert.equal(decide({ queued: { ...queued, createdOffline: true }, live: null }), 'dropLocal')
  assert.equal(decide({ queued: { ...queued, createdOffline: true }, tombstoned: true }), 'dropLocal')
  // Deleted elsewhere (missing, or tombstoned): already gone, no message.
  assert.equal(decide({ live: null }), 'alreadyGone')
  assert.equal(decide({ tombstoned: true }), 'alreadyGone')
  assert.equal(decide({ queued: null }), 'alreadyGone')
  assert.equal(decide({ queued: { ...queued, bookingId: ' ' } }), 'alreadyGone')
  // Changed on another device after the offline delete: refused, booking reappears.
  assert.equal(decide({ live: { ...live, timeSlot: 'AM' } }), 'refuseChanged')
  assert.equal(decide({ live: { ...live, notes: 'moved' } }), 'refuseChanged')
  assert.equal(decide({ live: { ...live, status: 'Cancelled' } }), 'refuseChanged')
  // Permission lost: refused, booking reappears (checked before the change).
  assert.equal(decide({ mayDelete: false }), 'refusePermission')
  assert.equal(decide({ mayDelete: false, live: { ...live, timeSlot: 'AM' } }), 'refusePermission')
  // A subcontractor booking is never deleted offline.
  assert.equal(decide({ queued: { ...queued, collection: 'subcontractorBookings' } }), 'refusePermission')
  // Manager schedule bookings replay the same way.
  const office = { userId: 'U-1', locationType: 'office', dayKey: '2026-11-09', timeSlot: 'AM' }
  const officeQueued = { bookingId: 'm-1', collection: 'managerSiteBookings', fingerprint: R112.bookingDeleteFingerprint({ ...office, collection: 'managerSiteBookings' }, zone) }
  assert.equal(R112.offlineDeleteReplayDecision({ queued: officeQueued, live: office, tombstoned: false, timeZone: zone }), 'apply')
  assert.equal(R112.offlineDeleteReplayDecision({ queued: officeQueued, live: { ...office, locationType: 'wfh' }, timeZone: zone }), 'refuseChanged')

  assert.equal(R112.OFFLINE_DELETE_CHANGED_MESSAGE, 'Changed on another device — not deleted')
  assert.ok(R112.OFFLINE_DELETE_REFUSED_MESSAGE.startsWith('Not deleted'))
})

test('1.33.0 offlineDeleteRefusalDecision and bookingReplayRefusedIsFinal cover a queued delete', () => {
  assert.equal(R112.offlineDeleteRefusalDecision('not-found'), 'alreadyGone')
  assert.equal(R112.offlineDeleteRefusalDecision(5), 'alreadyGone')
  assert.equal(R112.offlineDeleteRefusalDecision('firestore/permission-denied'), 'refusePermission')
  assert.equal(R112.offlineDeleteRefusalDecision(7), 'refusePermission')
  assert.equal(R112.offlineDeleteRefusalDecision('unavailable'), 'retry')
  assert.equal(R112.offlineDeleteRefusalDecision('aborted'), 'retry')
  assert.equal(R112.offlineDeleteRefusalDecision(undefined), 'retry')
  // A delete is not a create: not-found and permission-denied are both final.
  assert.equal(R112.bookingReplayRefusedIsFinal({ code: 'not-found', isCreate: false }), true)
  assert.equal(R112.bookingReplayRefusedIsFinal({ code: 7, isCreate: false }), true)
  assert.equal(R112.bookingReplayRefusedIsFinal({ code: 'unavailable', isCreate: false }), false)
})

test('1.33.0 bookingDeleteSignedTimesheetWarning: warns (never blocks) on a day inside a signed or exported timesheet', () => {
  const signedAt = { seconds: Date.parse('2026-11-16T09:00:00Z') / 1000, nanoseconds: 0 }
  const period = { startDayKey: '2026-11-01', endDayKey: '2026-11-15' }
  const operativeSigned = { ...period, operativeSignedAt: signedAt, operativeSignedByName: 'Olga Op' }
  const managerSigned = { ...period, managerSignedAt: signedAt }
  const legacyApproved = { ...period, approvedAt: signedAt }
  const exported = { ...period, exportedAt: signedAt }
  const unsigned = { ...period }
  const nameless = { ...period, operativeSignedAt: signedAt }

  assert.equal(R112.bookingDeleteSignedTimesheetWarning('2026-11-09', [operativeSigned]), R112.BOOKING_DELETE_SIGNED_TIMESHEET_WARNING)
  assert.equal(R112.bookingDeleteSignedTimesheetWarning('2026-11-01', [managerSigned]), R112.BOOKING_DELETE_SIGNED_TIMESHEET_WARNING)
  assert.equal(R112.bookingDeleteSignedTimesheetWarning('2026-11-15', [legacyApproved]), R112.BOOKING_DELETE_SIGNED_TIMESHEET_WARNING)
  assert.equal(R112.bookingDeleteSignedTimesheetWarning('2026-11-09', [exported]), R112.BOOKING_DELETE_SIGNED_TIMESHEET_WARNING)
  assert.equal(R112.bookingDeleteSignedTimesheetWarning('2026-11-09', [unsigned, operativeSigned]), R112.BOOKING_DELETE_SIGNED_TIMESHEET_WARNING)
  assert.equal(R112.bookingDeleteSignedTimesheetWarning('2026-11-09', [unsigned]), null)
  assert.equal(R112.bookingDeleteSignedTimesheetWarning('2026-11-09', [nameless]), null)
  assert.equal(R112.bookingDeleteSignedTimesheetWarning('2026-11-16', [operativeSigned]), null)
  assert.equal(R112.bookingDeleteSignedTimesheetWarning('2026-10-31', [operativeSigned]), null)
  assert.equal(R112.bookingDeleteSignedTimesheetWarning('not a day', [operativeSigned]), null)
  assert.equal(R112.bookingDeleteSignedTimesheetWarning('2026-11-09', null), null)
  assert.match(R112.BOOKING_DELETE_SIGNED_TIMESHEET_WARNING, /signed timesheet/)
})

// MARK: - Rulebook 1.33.0 (W8 bundle: claims every id, pay C1, catalogue, active writes, unbooked inactive)

test('1.33.0 claims every id: a line manager reviews an item under a formerUserIds id; no "Needs an admin"', () => {
  const item = (id: string, userId: string) => ({ kind: 'priceWork' as const, id, userId, title: 'Tiling', details: '', amount: 100, currency: 'GBP', evidence: [], createdAtMs: null, createdBy: userId, jobNumber: 'J-1', approvedByUserId: 'lm', approvedByName: 'Lee', startDate: '2026-11-02', endDate: '2026-11-03' })
  const items = [item('P1', 'sam'), item('P2', 'sam-invite'), item('P3', 'Sam-Invite'), item('P4', 'other')]
  const roster = [
    { id: 'sam', email: 'sam@x.com', isActive: true, formerUserIds: ['sam-invite'], assignedManagerUserIds: ['lm'], role: 'operative', operativeMode: true },
    { id: 'lm', email: 'lm@x.com', isActive: true, role: 'manager', manager: true },
    { id: 'm2', email: 'm2@x.com', isActive: true, role: 'manager', manager: true },
  ]
  const personIds = r132.overtimePersonIds({ person: roster[0], roster })
  assert.ok(personIds.map((id: string) => id.toLowerCase()).includes('sam-invite'))
  assert.equal(r132.canReviewPayeClaims(roster[1], roster[0], roster), true, 'the line manager reviews')
  assert.equal(r132.canReviewPayeClaims(roster[2], roster[0], roster), false, 'a manager who is not the line manager does not')
  assert.equal(r132.canReviewPayeClaims({ ...roster[0], id: 'sam-invite' }, roster[0], roster), false, 'never the person under another id')
  const result = r132.payeClaimReviewWrites({
    items,
    decisions: { P1: 'approved', P2: 'rejected', P3: 'approved', P4: 'approved' },
    subjectUserId: 'sam',
    personIds,
    reviewerId: 'lm',
  })
  assert.deepEqual(result.outcomes, { P1: 'applied', P2: 'applied', P3: 'applied', P4: 'foreign' })
  assert.deepEqual(result.writes.map((w) => w.fields.personUserId ?? null), [null, 'sam', 'sam'], 'personUserId only on items under another id (any letter case)')
  assert.deepEqual(result.writes.map((w) => w.fields.userId), ['sam', 'sam-invite', 'Sam-Invite'], 'userId stays the item\'s own id')
  assert.equal(result.message, 'Approved 2 of 3. 1 rejected.')
  for (const outcome of ['applied', 'undecided', 'unchanged', 'foreign'] as const) {
    assert.notEqual(r132.payeClaimReviewOutcomeLabel(outcome), 'Needs an admin')
  }
  // Review is optional: the report is ready with items in range, reviewed or not.
  assert.equal(r132.payeClaimReportReady(items), true)
})

test('1.33.0 pay C1: the read plans ask only for the line manager\'s reports; every other screen shows nobody\'s pay', () => {
  const lm = { id: 'lm', role: 'manager', manager: true }
  const report = { id: 'rep', role: 'operative', operativeMode: true, assignedManagerUserIds: ['lm'] }
  const reportMgr = { id: 'rep-m', role: 'manager', manager: true, assignedManagerUserIds: ['lm'] }
  const notMine = { id: 'nm', role: 'operative', operativeMode: true, assignedManagerUserIds: ['m2'] }
  const m2 = { id: 'm2', role: 'manager', manager: true }
  const catalogueRow = { id: 'OP-ROW', catalogueOperative: true }
  const roster = [lm, report, reportMgr, notMine, m2].map((p) => ({ ...p, email: `${p.id}@t.com`, isActive: true }))
  const subjects = [report, reportMgr, notMine, m2, catalogueRow]
  // Timesheet review reach: their own id and their reports' ids, nobody else, never a catalogue row.
  assert.deepEqual(R112.payProfileReadPlan(lm as never, subjects as never, roster as never), { kind: 'documents', ids: ['lm', 'rep', 'rep-m'] })
  assert.deepEqual(R112.rateHistoryQueryPlan(lm as never, subjects as never, roster as never, { privatePay: true }), { kind: 'people', userIds: ['lm', 'rep', 'rep-m'], operativeIds: [] })
  for (const subject of [report, reportMgr]) {
    assert.equal(R112.canViewPersonPay(lm as never, subject as never, roster as never, { context: 'timesheetReview' }), true)
    assert.equal(R112.canViewPersonPay(lm as never, subject as never, roster as never, { context: 'profile' }), false, 'profile context: nobody\'s')
    assert.equal(R112.canViewPersonPay(lm as never, subject as never, roster as never), false, 'no context = profile')
  }
  for (const subject of [notMine, m2, catalogueRow]) {
    assert.equal(R112.canViewPersonPay(lm as never, subject as never, roster as never, { context: 'timesheetReview' }), false)
  }
  // Each line manager asks only for their own reports; a manager who line-manages nobody only for their own.
  assert.deepEqual(R112.payProfileReadPlan(m2 as never, subjects as never, roster as never), { kind: 'documents', ids: ['m2', 'nm'] })
  const m3 = { id: 'm3', role: 'manager', manager: true, email: 'm3@t.com', isActive: true }
  assert.deepEqual(R112.payProfileReadPlan(m3 as never, subjects as never, [...roster, m3] as never), { kind: 'documents', ids: ['m3'] })
  assert.deepEqual(R112.rateHistoryQueryPlan(m3 as never, subjects as never, [...roster, m3] as never, { privatePay: true }), { kind: 'people', userIds: ['m3'], operativeIds: [] })
  // An inactive line manager no longer counts (the roster is read live).
  const lmGone = roster.map((row) => (row.id === 'lm' ? { ...row, isActive: false } : row))
  assert.deepEqual(R112.payProfileReadPlan(lm as never, subjects as never, lmGone as never), { kind: 'documents', ids: ['lm'] })
})

test('1.33.0 canManageMaterialCatalogue: admins and super admins outside operative mode only', () => {
  const role = (over: Partial<{ isSuperAdmin: boolean; isAdmin: boolean; isManager: boolean; isOperativeMode: boolean }>) => ({ isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: false, ...over })
  assert.equal(R112.canManageMaterialCatalogue(role({ isAdmin: true })), true)
  assert.equal(R112.canManageMaterialCatalogue(role({ isSuperAdmin: true })), true)
  assert.equal(R112.canManageMaterialCatalogue(role({ isManager: true })), false, 'managers no longer manage the catalogue')
  assert.equal(R112.canManageMaterialCatalogue(role({ isOperativeMode: true })), false)
  assert.equal(R112.canManageMaterialCatalogue(role({ isAdmin: true, isOperativeMode: true })), false)
  assert.equal(R112.canManageMaterialCatalogue({ level: 'admin' }), true)
  assert.equal(R112.canManageMaterialCatalogue({ level: 'Manager' }), false)
  assert.equal(R112.canManageMaterialCatalogue({ level: 'operative' }), false)
  assert.equal(R112.canManageMaterialCatalogue(null), false)
  // Sending quotes and orders is unchanged.
  assert.equal(R112.canSendMaterialOrders(role({ isManager: true })), true)
})

test('1.33.0 userActiveWrites: another company\'s users document is never written, and no membership is created', () => {
  const roster = [
    { id: 'U', email: 'u@x', organizationId: 'OTHER' },
    { id: 'u-here', email: 'U@x', organizationId: 'ORG' },
    { id: 'u-b', email: 'u@x', organizationId: 'OTHER' },
  ]
  const fromRoster = R112.userActiveWrites({ organizationId: 'ORG', person: { id: 'U', email: 'u@x' }, isActive: false, roster })
  assert.deepEqual(fromRoster.map((row) => row.path), ['users/u-here', 'users/U/orgMemberships/ORG'], 'home company from the roster row')
  const fromPerson = R112.userActiveWrites({ organizationId: 'ORG', person: { id: 'U', email: 'u@x', organizationId: 'organizations/OTHER' }, isActive: true, roster: [] })
  assert.deepEqual(fromPerson.map((row) => row.path), ['users/U/orgMemberships/ORG'])
  assert.deepEqual(fromPerson[0].fields, { accountActive: true })
  const here = R112.userActiveWrites({ organizationId: 'ORG', person: { id: 'U', email: 'u@x', organizationId: 'org' }, isActive: false, roster: [], membershipExists: false })
  assert.deepEqual(here.map((row) => row.path), ['users/U'], 'membershipExists false: no membership write')
  const unknown = R112.userActiveWrites({ organizationId: 'ORG', person: { id: 'U' }, isActive: false })
  assert.deepEqual(unknown.map((row) => row.path), ['users/U', 'users/U/orgMemberships/ORG'], 'home company unknown: as before')
})

test('1.33.0 unbooked labour: an inactive account is never picked for an operatives row on its email', () => {
  const base = {
    timeZone: 'Europe/London',
    startDayKey: '2026-11-04',
    endDayKey: '2026-11-04',
    includeWeekends: false,
    standardPaidHours: 8,
    bookings: [],
    holidays: [],
    operatives: [{ id: 'OP-ADA', email: 'ada@site.test', name: 'Roster Ada', isActive: true, isPlaceholder: false, profileWeight: 0 }],
  }
  const person = (id: string, isActive: boolean) => ({ id, email: 'Ada@site.test', name: `Ada ${id}`, isActive, passwordSet: true, status: 'active', isOperativeMode: true, isManager: false, isAdmin: false, isSuperAdmin: false })
  const inactiveOnly = R112.unbookedLabourRows({ ...base, people: [person('U-OLD', false)] })
  assert.deepEqual(inactiveOnly, [], 'an inactive person never shows as unbooked through their operatives row')
  const both = R112.unbookedLabourRows({ ...base, people: [person('U-OLD', false), person('U-NEW', true)] })
  assert.deepEqual(both.map((row) => row.personKey), ['U-NEW'])
})

// MARK: - Rulebook 1.33.0: every manager sees every job; My Projects; Daily Overview team; line manager locked

test('1.33.0 the managers\' hide list is not read; the operatives\' hide list is (parseJobDocument, visibleJobs)', () => {
  const parsed = R112.parseJobDocument('J', { jobNumber: 'J', hiddenManagerUserIds: ['m'], hiddenOperativeUserIds: ['o'] }, { kind: 'projects', timeZone: 'Europe/London' }) as Record<string, unknown> | null
  assert.ok(parsed)
  assert.equal('hiddenManagerUserIds' in (parsed || {}), false)
  assert.deepEqual(parsed?.hiddenOperativeUserIds, ['o'])
  const mgr = { role: { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }, ids: ['m'] }
  assert.deepEqual(R112.visibleJobs([{ id: 'J', collection: 'projects', hiddenManagerUserIds: ['m'] } as never], mgr).length, 1)
})

test('1.33.0 canCreateJob / canChangeJobManagers still follow the toggle; canWriteBooking still own jobs only', () => {
  const plain = { role: { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }, ids: ['m'], toggles: { projects: false, smallWorks: false } }
  assert.equal(R112.canSeeJob(plain, { managerIds: ['x'] }), true)
  assert.equal(R112.canCreateJob(plain, 'projects'), false)
  assert.equal(R112.canChangeJobManagers(plain, 'smallWorks'), false)
  assert.equal(R112.canEditJob(plain, { managerIds: ['x'] }, 'projects'), false)
  assert.equal(R112.canWriteBooking(plain, { collection: 'bookings', projectId: 'J' }, { managerIds: ['x'] }), false)
  assert.equal(R112.canWriteBooking(plain, { collection: 'bookings', projectId: 'J' }, { managerIds: ['m'] }), true)
  assert.equal(R112.canEditWorkCatalogue(plain.role, 'projects', plain.toggles), false)
})

test('1.33.0 My Projects / My Small works: pre-fill, saved picks, picker rows, toggles, write fields', () => {
  const mgr = { role: { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }, ids: ['U-M'], email: 'm@x.com', uid: 'U-M' }
  const admin = { role: { isSuperAdmin: false, isAdmin: true, isManager: false, isOperativeMode: false }, ids: ['A'], uid: 'A' }
  const op = { role: { isSuperAdmin: false, isAdmin: false, isManager: false, isOperativeMode: true }, ids: ['O'], uid: 'O' }
  const jobs = [
    { id: 'P1', collection: 'projects', managerUserIds: ['U-M'] },
    { id: 'P2', collection: 'projects', managerUserIds: ['X'] },
    { id: 'S1', collection: 'smallWorks', managerUserIds: ['U-M'] },
  ]
  assert.equal(R112.hasMyWorksList(mgr), true)
  assert.equal(R112.hasMyWorksList(admin), true)
  assert.equal(R112.hasMyWorksList(op), false)
  assert.equal(R112.defaultWorksListTab(mgr), 'mine')
  assert.equal(R112.defaultWorksListTab(op), 'active')
  assert.deepEqual(R112.myWorksDefaultIds(jobs, mgr, {}, 'projects'), ['P1'])
  assert.deepEqual(R112.myWorksDefaultIds(jobs, admin, {}, 'projects'), [])
  assert.deepEqual(R112.myWorksList(jobs, R112.parseMyWorksPicks(null), mgr, {}, 'projects').map((j) => j.id), ['P1'])
  assert.deepEqual(R112.myWorksList(jobs, R112.parseMyWorksPicks({ projects: ['p2', 'P2', 'gone'] }), mgr, {}, 'projects').map((j) => j.id), ['P2'])
  assert.deepEqual(R112.myWorksList(jobs, R112.parseMyWorksPicks({ projects: [] }), mgr, {}, 'projects'), [])
  assert.deepEqual(R112.parseMyWorksPicks({ projects: ['a', 'A', ' b '], smallWorks: 'x' }), { projects: ['a', 'b'], smallWorks: null })
  assert.deepEqual(R112.myWorksPickerRows(jobs, null, mgr, {}, 'projects').map((r) => [r.job.id, r.picked]), [['P1', true], ['P2', false]])
  assert.deepEqual(R112.myWorksPicksAfterToggle(['P1'], 'p2', true), ['P1', 'p2'])
  assert.deepEqual(R112.myWorksPicksAfterToggle(['P1', 'p2'], 'P2', false), ['P1'])
  assert.deepEqual(R112.myWorksPicksWriteFields('smallWorks', ['S1', 's1'], 'T'), { smallWorks: ['S1'], updatedAt: 'T' })
  assert.equal(R112.myWorksPicksPath('ORG', 'U-M'), 'organizations/ORG/worksListPicks/U-M')
  assert.equal(R112.myWorksEmptyTitle('projects'), 'No projects in your list yet')
  assert.equal(R112.myWorksEmptyTitle('smallWorks'), 'No small works in your list yet')
  assert.equal(R112.myWorksTabLabel('smallWorks'), 'My Small works')
})

test('1.33.0 Daily Overview scope: a manager sees themselves and their reports only; admins everything', () => {
  const mgr = { role: { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }, ids: ['M'], email: 'm@x.com' }
  const roster = [
    { id: 'M', email: 'm@x.com', role: 'manager' },
    { id: 'R', email: 'r@x.com', assignedManagerUserIds: ['M'] },
    { id: 'N', email: 'n@x.com', assignedManagerUserIds: ['X'] },
  ]
  const scope = R112.dailyOverviewScopeFor({ viewer: mgr, roster, enforced: true })
  assert.ok(scope.kind === 'jobs' && scope.jobIds.length === 0 && scope.unbookedLabour)
  assert.equal(R112.isDailyOverviewRowInScope(scope, { personIds: ['R'] }), true)
  assert.equal(R112.isDailyOverviewRowInScope(scope, { personIds: ['N'] }), false)
  assert.equal(R112.isDailyOverviewRowInScope(scope, { personIds: ['M'], subcontractor: true }), false)
  const all = R112.dailyOverviewScopeFor({ viewer: { role: { ...mgr.role, isAdmin: true }, ids: ['A'] }, roster })
  assert.equal(R112.isDailyOverviewRowInScope(all, { subcontractor: true }), true)
  // The manager's unbooked people are exactly their Book labour / Warnings people.
  const rows = (s: ReturnType<typeof R112.dailyOverviewScopeFor>) =>
    R112.unbookedLabourRowsOnDay({
      scope: s,
      dayKey: '2026-11-04',
      timeZone: 'Europe/London',
      includeWeekends: false,
      standardPaidHours: 8,
      people: roster.map((row) => ({ id: row.id, email: row.email, name: row.id, isActive: true, passwordSet: true, isOperativeMode: true, isManager: false, isAdmin: false, isSuperAdmin: false })) as never,
      operatives: [],
      bookings: [],
      holidays: [],
    } as never).map((row) => row.operativeId ?? row.userId)
  const warningScope = R112.warningScopeFor({ viewer: mgr, roster, jobs: [{ id: 'J', managerUserIds: ['M'] }], enforced: true })
  assert.deepEqual(rows(scope).sort(), ['M', 'R'])
  assert.deepEqual(rows(scope), rows(warningScope))
  // Home: on site counts only the team.
  const metrics = R112.homeOverviewMetrics({
    nowMs: Date.parse('2026-11-04T10:00:00Z'),
    timeZone: 'Europe/London',
    viewer: { id: 'M' },
    roster: roster as never,
    bookings: [
      { operativeId: 'R', dayKey: '2026-11-04', status: 'Confirmed' },
      { operativeId: 'N', dayKey: '2026-11-04', status: 'Confirmed' },
    ],
    scope,
  })
  assert.equal(metrics.operativesOnSiteToday, 1)
})

test('1.33.0 canChangeLineManager: set once by an Operatives manager, then admins only', () => {
  const admin = { id: 'A', adminAccess: true }
  const opsMgr = { id: 'OM', role: 'manager', manager: true, operatives: true }
  const plainMgr = { id: 'PM', role: 'manager', manager: true, operatives: false }
  const operative = { id: 'O', role: 'operative', operativeMode: true }
  const manager = { id: 'M2', role: 'manager', manager: true }
  assert.equal(R112.canChangeLineManager(admin, operative), true)
  assert.equal(R112.canChangeLineManager(admin, manager), true)
  assert.equal(R112.canChangeLineManager(opsMgr, operative, { isCreate: true }), true)
  assert.equal(R112.canChangeLineManager(opsMgr, operative), false)
  assert.equal(R112.canChangeLineManager(opsMgr, operative, { invitation: { accepted: false, invitedBy: 'om' } }), true)
  assert.equal(R112.canChangeLineManager(opsMgr, operative, { invitation: { accepted: true, invitedBy: 'OM' } }), false)
  assert.equal(R112.canChangeLineManager(opsMgr, operative, { invitation: { accepted: false, invitedBy: 'someone' } }), false)
  assert.equal(R112.canChangeLineManager(opsMgr, manager, { isCreate: true }), false)
  assert.equal(R112.canChangeLineManager(plainMgr, operative, { isCreate: true }), false)
  assert.equal(R112.canChangeLineManager(operative, operative, { isCreate: true }), false)
  assert.equal(R112.lineManagerChanged({ assignedManagerUserIds: ['A', 'b'] }, { assignedManagerUserIds: ['B', 'a'] }), false)
  assert.equal(R112.lineManagerChanged({ assignedManagerUserId: 'A' }, { assignedManagerUserIds: ['A'] }), false)
  assert.equal(R112.lineManagerChanged({ assignedManagerUserIds: ['A'] }, { assignedManagerUserIds: ['C'] }), true)
  assert.equal(R112.lineManagerChanged({ assignedManagerUserIds: ['A'] }, { hasNoLineManager: true }), true)
})

// MARK: - Rulebook 1.33.0: PAYE overtime ✓ ✕ ⚙ choices, button readiness, Return notices, reopen (§25)

test('1.33.0 choice state machine: ✓ / ✕ toggle and reverse, ⚙ clears the mark and needs ✓, ✕ drops an edit', () => {
  const empty = r129.OVERTIME_EMPTY_CHOICE
  const tick = r129.overtimeChoiceAfter(empty, { kind: 'tick' })
  assert.deepEqual(tick, { mark: 'tick', edit: null })
  assert.deepEqual(r129.overtimeChoiceAfter(tick, { kind: 'tick' }), { mark: 'none', edit: null })
  const cross = r129.overtimeChoiceAfter(tick, { kind: 'cross' })
  assert.deepEqual(cross, { mark: 'cross', edit: null })
  assert.deepEqual(r129.overtimeChoiceAfter(cross, { kind: 'tick' }), { mark: 'tick', edit: null })
  assert.deepEqual(r129.overtimeChoiceAfter(cross, { kind: 'cross' }), { mark: 'none', edit: null })
  const cog = r129.overtimeChoiceAfter(tick, { kind: 'cog', start: '7:30', end: '17:00', multiplier: 2 })
  assert.deepEqual(cog, { mark: 'none', edit: { start: '07:30', end: '17:00', multiplier: 2 } })
  const cogTick = r129.overtimeChoiceAfter(cog, { kind: 'tick' })
  assert.deepEqual(r129.overtimeChoiceDecision(cogTick), { action: 'edit', start: '07:30', end: '17:00', multiplier: 2 })
  // The cog again unticks and replaces the figure.
  assert.deepEqual(r129.overtimeChoiceAfter(cogTick, { kind: 'cog', start: '07:30', end: '18:00', multiplier: null }), {
    mark: 'none', edit: { start: '07:30', end: '18:00', multiplier: null },
  })
  assert.deepEqual(r129.overtimeChoiceAfter(cogTick, { kind: 'cross' }), { mark: 'cross', edit: null })
  // An invalid cog changes nothing.
  assert.deepEqual(r129.overtimeChoiceAfter(tick, { kind: 'cog', start: '07:30', end: '07:30', multiplier: null }), tick)
  assert.equal(r129.overtimeChoiceDecision(cog), null)
  assert.deepEqual(r129.overtimeChoiceDecision(cross), { action: 'strike' })
  assert.deepEqual(r129.overtimeChoiceDecision(tick), { action: 'approve' })
  // What both apps draw.
  const b1 = r129Booking('B1', '2026-11-04', '06:30', '14:00')
  const view = (choice: typeof tick, role: 'person' | 'decider') => r129.overtimeChoiceView({ choice, booking: b1, organization: R129_ORG, timeZone: R129_TZ, role })
  assert.deepEqual(view(tick, 'person'), {
    tick: 'filled', cross: 'grey', cog: 'grey', figureStruck: false, oldFigure: '1h × 1.5 = 1.5h', newFigure: null, label: 'Confirmed', complete: true,
  })
  assert.deepEqual([view(cross, 'person').figureStruck, view(cross, 'person').newFigure, view(cross, 'person').label], [true, 'No overtime', 'Not worked'])
  assert.deepEqual([view(cross, 'decider').newFigure, view(cross, 'decider').label], [null, 'Declined'])
  assert.deepEqual([view(cog, 'person').label, view(cog, 'person').complete, view(cog, 'person').newFigure], ['Changed — tick or cross it', false, '1h × 2 = 2h'])
  assert.equal(view(cogTick, 'decider').label, 'Changed')
  const sunday = r129Booking('B4', '2026-11-08', '07:30', '14:00')
  assert.equal(r129.overtimeChoiceView({ choice: cross, booking: sunday, organization: R129_ORG, timeZone: R129_TZ, role: 'person' }).newFigure, 'Booking removed')
})

test('1.33.0 Send for approval: green once every line is marked; after a Return grey until a line changes; only changed lines are sent', () => {
  const b1 = r129Booking('B1', '2026-11-04', '06:30', '14:00')
  const b2 = r129Booking('B2', '2026-11-05', '07:30', '18:00')
  const range = { start: '2026-11-01', end: '2026-11-30' }
  const base = { personIds: ['sam'], organization: R129_ORG, timeZone: R129_TZ, range }
  const fresh = r129.payeOvertimeLines({ ...base, bookings: [b1, b2] })
  assert.deepEqual(r129.overtimeSubmitReady({ lines: fresh, choices: {} }), { ready: false, undecidedCount: 2, bookingIds: [], message: r129.OVERTIME_SUBMIT_UNDECIDED_MESSAGE })
  const choices = { B1: { mark: 'tick' as const, edit: null }, b2: { mark: 'cross' as const, edit: null } }
  assert.deepEqual(r129.overtimeSubmitReady({ lines: fresh, choices }), { ready: true, undecidedCount: 0, bookingIds: ['B1', 'B2'], message: null })
  const built = r129.overtimeSubmitLines({ lines: fresh, choices, bookings: [b1, b2], organization: R129_ORG, timeZone: R129_TZ, personIds: ['sam'] })
  assert.deepEqual(built.lines.map((line) => [line.bookingId, line.action, line.proposedStart, line.proposedEnd]), [['B1', 'keep', null, null], ['B2', 'strike', '07:30', '16:00']])
  // Waiting lines are locked; nothing else to send.
  const request = r129.parseOvertimeRequestDocument('R1', { userId: 'sam', rangeStart: range.start, rangeEnd: range.end, status: 'pending', lines: built.lines, createdAt: 1 })
  const waiting = r129.payeOvertimeLines({ ...base, bookings: [b1, b2], requests: [request] })
  assert.deepEqual(waiting.map((line) => line.state), ['waiting', 'waiting'])
  assert.deepEqual(r129.overtimeLineChoice(waiting[1], { B2: { mark: 'tick', edit: null } }), { mark: 'cross', edit: null })
  assert.equal(r129.overtimeSubmitReady({ lines: waiting, choices: {} }).message, r129.OVERTIME_SUBMIT_NOTHING_CHANGED_MESSAGE)
  // Returned: B1 approved, B2 declined (booking left as it was).
  const result = r129.overtimeReturnWrites({ request, decisions: { B1: { action: 'approve' }, B2: { action: 'strike' } }, bookings: { B1: b1, B2: b2 }, organization: R129_ORG, timeZone: R129_TZ, deciderId: 'lm' })
  assert.ok(result.ok)
  if (!result.ok) return
  const reviews = result.reviewWrites.map((row) => r129.parseOvertimeReviewDocument(row.docId, { ...row.fields, reviewedAt: 10 }))
  const returned = r129.parseOvertimeRequestDocument('R1', { userId: 'sam', rangeStart: range.start, rangeEnd: range.end, lines: built.lines, ...result.requestFields, createdAt: 1, decidedAt: 10 })
  const after = r129.payeOvertimeLines({ ...base, bookings: [b1, b2], reviews, requests: [returned] })
  assert.deepEqual(after.map((line) => line.state), ['returnedApproved', 'returnedDeclined'])
  assert.deepEqual(r129.overtimeSubmitReady({ lines: after, choices: {} }), { ready: false, undecidedCount: 0, bookingIds: [], message: r129.OVERTIME_SUBMIT_NOTHING_CHANGED_MESSAGE })
  // ✕ → ✓ on the declined line (challenge): only that line is sent.
  assert.deepEqual(r129.overtimeSubmitReady({ lines: after, choices: { B2: { mark: 'tick', edit: null } } }).bookingIds, ['B2'])
  // Generate: every line returned, nothing unsent → green; an unsent change → grey.
  assert.deepEqual(r129.overtimeGenerateReady({ lines: after, hasLineManager: true, choices: {} }), { ready: true, message: null })
  assert.deepEqual(r129.overtimeGenerateReady({ lines: after, hasLineManager: true, choices: { B2: { mark: 'tick', edit: null } } }), {
    ready: false, message: r129.OVERTIME_GENERATE_UNSENT_MESSAGE,
  })
  // A pending request whose every waiting line is sent again is withdrawn; one with other lines waiting is kept.
  assert.deepEqual(r129.overtimeRequestsSuperseded([request], 'SAM', ['B1', 'B2']), ['R1'])
  assert.deepEqual(r129.overtimeRequestsSuperseded([request], 'sam', ['B1']), [])
})

test('1.33.0 Generate without a line manager: every line confirmed (direct ✓ ✕ ⚙); a deleted line counts; report out of date after a change', () => {
  const b1 = r129Booking('B1', '2026-11-04', '06:30', '14:00')
  const b4 = r129Booking('B4', '2026-11-08', '07:30', '14:00')
  const range = { start: '2026-11-01', end: '2026-11-30' }
  const tick = r129.overtimeDirectWrites({ booking: b1, action: { action: 'approve' }, userId: 'adm', reviewerId: 'adm', organization: R129_ORG, timeZone: R129_TZ })!
  const del = r129.overtimeDirectWrites({ booking: b4, action: { action: 'strike' }, userId: 'adm', reviewerId: 'adm', organization: R129_ORG, timeZone: R129_TZ, platform: 'ios' })!
  assert.deepEqual(del.bookingDelete, { collection: 'bookings', bookingId: 'B4', tombstone: { bookingId: 'B4', collection: 'bookings', deletedBy: 'adm', deletedFrom: 'ios' } })
  assert.deepEqual([del.bookingWrite, del.reviewWrite.fields.decision, del.hoursChanged], [null, 'deleted', true])
  const reviews = [tick, del].map((row) => r129.parseOvertimeReviewDocument(row.reviewWrite.docId, row.reviewWrite.fields))
  const base = { personIds: ['adm'], organization: R129_ORG, timeZone: R129_TZ, range, reviews }
  const own = (b: ReturnType<typeof r129Booking>) => ({ ...b, personId: 'adm' })
  const lines = r129.payeOvertimeLines({ ...base, bookings: [own(b1)] })
  assert.deepEqual(lines.map((line) => [line.bookingId, line.state]), [['B1', 'confirmed'], ['B4', 'deleted']])
  assert.equal(r129.canGenerateOvertimeReport(lines, { hasLineManager: false }), true)
  assert.equal(r129.canGenerateOvertimeReport(lines), true)
  const report = r129.parseOvertimeReportDocument('REP', JSON.parse(JSON.stringify(r129.overtimeReportSnapshot({ userId: 'adm', userName: 'Ada', rangeStart: range.start, rangeEnd: range.end, lines, generatedBy: 'adm' }))))
  assert.equal(r129.overtimeReportOutOfDate({ report, lines }), false)
  assert.equal(r129.canGenerateOvertimeReport(lines, { reports: [report] }), false)
  // A manager changes the booking: the line reopens, the report is out of date, Generate needs the line again.
  const moved = r129.payeOvertimeLines({ ...base, bookings: [{ ...own(b1), workEndTime: '15:00' }] })
  assert.equal(moved[0].state, 'reopened')
  assert.equal(r129.overtimeReportOutOfDate({ report, lines: moved }), true)
  assert.equal(r129.overtimeGenerateReady({ lines: moved, hasLineManager: false, reports: [report] }).message, r129.OVERTIME_GENERATE_NOT_MARKED_MESSAGE)
  // A stored out-of-date mark is honoured.
  assert.equal(r129.parseOvertimeReportDocument('REP2', { lines: [], outOfDate: true }).outOfDate, true)
  // A line still red ✕ at Generate is in the report at 0h, "Declined by {name}" (flags for the PDF).
  const declinedLine = { ...lines[0], state: 'returnedDeclined' as const, deciderName: 'Lee' }
  const snap = r129.overtimeReportSnapshot({ userId: 'adm', userName: 'Ada', rangeStart: range.start, rangeEnd: range.end, lines: [declinedLine], generatedBy: 'adm' })
  assert.deepEqual([snap.lines[0].overtimeHours, snap.lines[0].declined, snap.lines[0].declinedByName, snap.lines[0].note], [0, true, 'Lee', 'Declined by Lee'])
})

test('1.33.0 notices: Send for approval, Return (line manager / admin wording), reopen recipients, and where they open', () => {
  const roster = [
    { id: 'sam', email: 'sam@x.com', isActive: true, role: { isOperativeMode: true }, assignedManagerUserIds: ['lm'], employmentType: 'paye' },
    { id: 'lm', email: 'lm@x.com', isActive: true, role: { isManager: true } },
    { id: 'adm', email: 'adm@x.com', isActive: true, role: { isAdmin: true } },
    { id: 'pat', email: 'pat@x.com', isActive: true, role: { isOperativeMode: true }, assignedManagerUserIds: ['lm'], employmentType: 'self_employed' },
  ] as never
  assert.deepEqual(r129.overtimeReturnedMessage({ deciderName: 'Lee Manager', deciderIsLineManager: true }), {
    title: 'Overtime returned', message: 'Your line manager Lee Manager has returned your overtime request',
  })
  assert.equal(r129.overtimeReturnedMessage({ deciderName: 'Ada Admin', deciderIsLineManager: false }).message, 'Ada Admin has returned your overtime request')
  assert.equal(r129.overtimeDeciderIsLineManager('lm', { id: 'sam', assignedManagerUserIds: ['lm'] } as never, roster), true)
  assert.equal(r129.overtimeDeciderIsLineManager('adm', { id: 'sam', assignedManagerUserIds: ['lm'] } as never, roster), false)
  assert.deepEqual(r129.overtimeReturnedRecipients('sam', 'lm', roster), ['sam'])
  assert.equal(r129.overtimeRequestSubmittedMessage({ requesterName: 'Sam', rangeStart: '2026-10-26', rangeEnd: '2026-11-25' }).message, 'Sam sent their overtime for Mon 26 Oct – Wed 25 Nov for approval.')
  // Reopen: a returned line tells the person and their line manager; a sent-only line the person; never the editor.
  const b1 = r129Booking('B1', '2026-11-04', '06:30', '14:00')
  const moved = { ...b1, workEndTime: '15:00' }
  const fp = r129.overtimeBookingFingerprint(b1)
  const returnedReview = r129.parseOvertimeReviewDocument('sam_B1', { userId: 'sam', bookingId: 'B1', decision: 'approved', fingerprint: fp, requestId: 'R1' })
  const reopen = (reviews: unknown, requests: unknown, after: unknown = moved) =>
    r129.overtimeLineReopened({ before: b1, after: after as never, organization: R129_ORG, timeZone: R129_TZ, reviews: reviews as never, requests: requests as never })
  assert.deepEqual(reopen([returnedReview], []), { reopened: true, returned: true })
  assert.deepEqual(reopen([], []), { reopened: false, returned: false })
  assert.deepEqual(reopen([returnedReview], [], b1), { reopened: false, returned: false })
  const line = r129.overtimeRequestLineFields({ booking: b1, organization: R129_ORG, timeZone: R129_TZ, proposal: { action: 'keep' } })!
  const pending = r129.parseOvertimeRequestDocument('R2', { userId: 'sam', status: 'pending', lines: [line] })
  assert.deepEqual(reopen([], [pending], null), { reopened: true, returned: false })
  assert.deepEqual(reopen(null, null), { reopened: true, returned: false })
  assert.deepEqual(r129.overtimeReopenedRecipients({ bookedId: 'SAM', actor: 'adm', roster, returned: true }), ['sam', 'lm'])
  assert.deepEqual(r129.overtimeReopenedRecipients({ bookedId: 'sam', actor: 'lm', roster, returned: true }), ['sam'])
  assert.deepEqual(r129.overtimeReopenedRecipients({ bookedId: 'row-sam', actor: 'adm', roster, operatives: [{ id: 'row-sam', email: 'SAM@x.com' }], returned: false }), ['sam'])
  // Self-employed people are out of scope.
  assert.deepEqual(r129.overtimeReopenedRecipients({ bookedId: 'pat', actor: 'adm', roster, returned: true }), [])
  assert.equal(r129.overtimeReopenedMessage({ dayKey: '2026-11-04', jobNumber: 'J-1042' }).message, 'Your booking on Wed 4 Nov (J-1042) changed. Check that overtime line and send it again.')
  // Where a notice opens: the current payrun, a past payrun, or the request's own range.
  const org = { invoicing: { payePaydayHistory: [{ day: 25, effectiveFrom: '2026-01-01' }] } }
  assert.deepEqual(r129.overtimeNotificationRange({ organization: org, todayKey: '2026-11-06', rangeStart: '2026-10-26', rangeEnd: '2026-11-25' }), { range: 'current', start: '2026-10-26', end: '2026-11-25' })
  assert.deepEqual(r129.overtimeNotificationRange({ organization: org, todayKey: '2026-11-06', dayKey: '2026-10-04' }), { range: 'past', start: '2026-09-26', end: '2026-10-25' })
  assert.deepEqual(r129.overtimeNotificationRange({ organization: org, todayKey: '2026-11-06', rangeStart: '2026-10-01', rangeEnd: '2026-11-03' }), { range: 'custom', start: '2026-10-01', end: '2026-11-03' })
  assert.equal(r129.overtimeNotificationRange({ organization: org, todayKey: '2026-11-06' }), null)
  assert.deepEqual(r129.notificationDestination({ type: 'overtime_request_reviewed', relatedId: 'R1', dayKey: '2026-10-26', role: 'operative' }), { kind: 'overtimeMine', relatedId: 'R1', dayKey: '2026-10-26' })
  // A tombstone carries overtimeRequestId only when given.
  assert.deepEqual(r129.bookingTombstoneWriteFields({ bookingId: 'B4', collection: 'bookings', deletedBy: 'lm', deletedFrom: 'web', overtimeRequestId: ' ' }), { bookingId: 'B4', collection: 'bookings', deletedBy: 'lm', deletedFrom: 'web' })
  assert.equal(r129.overtimeBookingDelete({ booking: { id: 'M1', collection: 'managerSiteBookings' }, deletedBy: 'lm', platform: 'web' }), null)
})

// MARK: - Rulebook 1.33.0 integration: claim items carry personUserId; Payrun Snapshot reads the overtime branch

test('1.33.0 claim items carry personUserId (the creator) and the backfill stamps older items through every id', () => {
  assert.deepEqual(R112.payeClaimPersonFields('sam'), { personUserId: 'sam' })
  assert.deepEqual(R112.payeClaimPersonFields(' '), {})
  const fields = R112.expenseWriteFields({
    userId: 'sam',
    organizationId: 'org1',
    currency: 'GBP',
    draft: { title: 'Fuel', details: '', jobNumber: 'J-1', date: '2026-11-04', amount: '20', evidence: [{ path: 'organizations/org1/payeClaims/sam/a.pdf', name: 'a.pdf', kind: 'file', contentType: 'application/pdf', auditId: null }] },
  } as never)
  assert.equal(fields?.personUserId, 'sam')
  assert.equal(R112.parseExpenseDocument('E1', { ...fields }).personUserId, 'sam')
  assert.equal(R112.parseExpenseDocument('E0', { userId: 'sam', title: 'Old' }).personUserId, null)
  const users = [
    { id: 'sam', formerUserIds: ['sam-invite'], sameEmailUserIds: ['SAM-2'] },
    { id: 'pat', formerUserIds: ['shared'] },
    { id: 'lee', sameEmailUserIds: ['shared'] },
  ]
  const backfill = (item: Record<string, unknown>) => R112.payeClaimPersonUserIdBackfill({ item, users })
  assert.deepEqual(backfill({ userId: 'sam' }), { personUserId: 'sam' })
  assert.deepEqual(backfill({ userId: 'Sam-Invite' }), { personUserId: 'sam' }, 'a former id, without case')
  assert.deepEqual(backfill({ userId: 'sam-2' }), { personUserId: 'sam' }, 'a same-email document')
  assert.equal(backfill({ userId: 'sam-invite', personUserId: 'sam' }), null, 'already stamped: idempotent')
  assert.equal(backfill({ userId: 'shared' }), null, 'claimed by two users documents: never guessed')
  assert.equal(backfill({ userId: 'nobody' }), null)
  assert.equal(backfill({ userId: '' }), null)
})

test('1.33.0 integration: the needs-admin label is gone; claims keep reviewApprovalMessage without "need an admin"', () => {
  assert.equal('OVERTIME_NEEDS_ADMIN_LABEL' in R112, false)
  assert.equal('OVERTIME_NEEDS_ADMIN_MESSAGE' in R112, false)
  assert.equal(R112.reviewApprovalMessage({ approved: 2, total: 5, counts: { rejected: 1, undecided: 2 } }), 'Approved 2 of 5. 1 rejected; 2 not decided yet.')
  assert.equal(R112.reviewApprovalMessage({ approved: 0, total: 1, counts: { undecided: 1 } }), 'Nothing was approved: 1 not decided yet.')
  assert.doesNotMatch(R112.reviewApprovalMessage({ approved: 1, total: 2, counts: { needsAdmin: 1 } as never }), /admin/)
})

// Rulebook 1.37.0 §21 (owner decisions 10 Nov): annual leave on a job's scheduling week.
test('1.37.0 jobScheduleLeaveMarks: full, half, pending, rejected, every id without case, organisation zone', () => {
  const tz = 'Europe/London'
  // Mon 23 Nov – Sun 29 Nov 2026
  const dayKeys = ['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']
  const roster = [
    { id: 'user-a', email: 'a@x.com', formerUserIds: ['INVITE-A'] },
    { id: 'OP-A', email: 'A@X.com' },
    { id: 'user-b', email: 'b@x.com' },
  ]
  const policy = { standardDayStart: '06:30', standardDayEnd: '14:30', breakWindowStart: '10:00', breakWindowEnd: '10:45' }
  const holidays = [
    // Multi-day approved leave filed under the operatives row (upper case): Mon–Wed; weekend days skipped.
    { id: 'h1', operativeId: 'op-a', startDayKey: '2026-11-23', endDayKey: '2026-11-25', timeSlot: 'FULL DAY', status: 'approved' },
    // AM half day under a former invite id.
    { id: 'h2', userId: 'invite-a', startDayKey: '2026-11-26', endDayKey: '2026-11-26', timeSlot: 'AM', status: 'approved' },
    // Pending full day under the email (older iOS).
    { id: 'h3', userId: 'A@x.com', startDayKey: '2026-11-27', endDayKey: '2026-11-27', timeSlot: 'FULL DAY', status: 'requested' },
    // Rejected never shows.
    { id: 'h4', userId: 'user-a', startDayKey: '2026-11-28', endDayKey: '2026-11-28', timeSlot: 'FULL DAY', status: 'declined' },
    // Pending PM half for B; someone else's leave never marks A.
    { id: 'h5', userId: 'USER-B', startDayKey: '2026-11-23', endDayKey: '2026-11-23', timeSlot: 'PM', status: 'pending' },
    // Bank holiday inside B's multi-day record is not a leave day.
    { id: 'h6', userId: 'user-b', startDayKey: '2026-11-24', endDayKey: '2026-11-26', timeSlot: 'FULL DAY', status: 'approved' },
  ]
  const rows = R112.jobScheduleLeaveMarks({
    people: [
      { key: 'a', ids: ['user-a'], email: 'a@x.com' },
      { key: 'b', ids: ['user-b'], email: null },
      { key: 'ghost', ids: ['ghost-1'], email: '' },
    ],
    holidays,
    dayKeys,
    timeZone: tz,
    nonWorkingDayKeys: ['2026-11-25'],
    roster,
    day: policy,
  })
  const a = rows.find((r) => r.key === 'a')!.days
  assert.deepEqual(a.map((d) => d.label), ['AL', 'AL', '', 'AL AM', 'AL?', '', ''])
  // Wed 25 is a bank holiday in the region, so not a leave day of h1.
  assert.equal(a[0].kind, 'approvedFull')
  assert.equal(a[0].recordId, 'h1')
  assert.equal(a[3].kind, 'approvedHalf')
  assert.equal(a[3].slot, 'AM')
  assert.equal(a[3].title, 'Annual leave · AM 06:30–10:30')
  assert.equal(a[4].pending, true)
  assert.equal(a[4].title, 'Annual leave requested · Full day')
  assert.equal(a[5].onLeave, false)
  const b = rows.find((r) => r.key === 'b')!.days
  assert.deepEqual(b.map((d) => d.label), ['AL? PM', 'AL', '', 'AL', '', '', ''])
  assert.equal(b[0].title, 'Annual leave requested · PM 10:30–14:30')
  const ghost = rows.find((r) => r.key === 'ghost')!.days
  assert.equal(ghost.every((d) => !d.onLeave), true)
  // Leave never adds a person: only the people given come back.
  assert.deepEqual(rows.map((r) => r.key), ['a', 'b', 'ghost'])
  assert.deepEqual([...R112.JOB_SCHEDULE_LEGEND], ['Standard', 'Std + OT', 'OT only', 'Ann. leave', 'Half day'])
})

test('1.37.0 jobScheduleLeaveMarks: full beats half, pending beats approved, policy state read per day', () => {
  const holidays = [
    { id: 'p', userId: 'u', startDayKey: '2026-11-23', endDayKey: '2026-11-23', timeSlot: 'PM', status: 'approved' },
    { id: 'f', userId: 'u', startDayKey: '2026-11-23', endDayKey: '2026-11-23', timeSlot: 'FULL DAY', status: 'pending' },
    { id: 'q', userId: 'u', startDayKey: '2026-11-24', endDayKey: '2026-11-24', timeSlot: 'AM', status: 'approved' },
  ]
  const state = {
    current: { standardDayStart: '08:00', standardDayEnd: '16:00' },
    effectiveFrom: '2026-11-24',
    prior: { standardDayStart: '06:30', standardDayEnd: '14:30' },
    scheduled: null,
    history: [],
  }
  const [row] = R112.jobScheduleLeaveMarks({
    people: [{ key: 'u', ids: ['U'] }],
    holidays,
    dayKeys: ['2026-11-23', '2026-11-24'],
    timeZone: 'Europe/London',
    day: state as never,
  })
  // Monday is before the change: the prior day 06:30–14:30; Tuesday the current 08:00–16:00.
  assert.equal(row.days[0].title, 'Annual leave requested · Full day')
  assert.equal(row.days[0].label, 'AL?')
  assert.equal(row.days[0].kind, 'pendingFull')
  assert.equal(row.days[1].title, 'Annual leave · AM 08:00–12:00')
  assert.deepEqual(R112.jobScheduleLeaveMarks({ people: null, holidays: null, dayKeys: null }), [])
})

// Review #299 (1): leave stored under the person's email matches without the caller passing the email.
test('1.37.0 jobScheduleLeaveMarks: a roster row pulled in by personIdSet brings its email', () => {
  const [row] = R112.jobScheduleLeaveMarks({
    people: [{ key: 'a', ids: ['OP-ROW'] }],
    holidays: [{ id: 'e', userId: 'Ann@Example.com', startDayKey: '2026-11-23', endDayKey: '2026-11-23', timeSlot: 'FULL DAY', status: 'approved' }],
    dayKeys: ['2026-11-23'],
    timeZone: 'Europe/London',
    roster: [
      { id: 'op-row', email: 'ann@example.com' },
      { id: 'someone', email: 'other@example.com' },
    ],
  })
  assert.equal(row.days[0].label, 'AL')
  const [none] = R112.jobScheduleLeaveMarks({
    people: [{ key: 'b', ids: ['someone'] }],
    holidays: [{ id: 'e', userId: 'Ann@Example.com', startDayKey: '2026-11-23', endDayKey: '2026-11-23', timeSlot: 'FULL DAY', status: 'approved' }],
    dayKeys: ['2026-11-23'],
    timeZone: 'Europe/London',
    roster: [{ id: 'op-row', email: 'ann@example.com' }, { id: 'someone', email: 'other@example.com' }],
  })
  assert.equal(none.days[0].onLeave, false)
})

// Review #299 (6): AM and PM on one day are the whole day.
test('1.37.0 jobScheduleLeaveMarks: AM + PM on one day is a full day; mixed shows both', () => {
  const marks = (amStatus: string, pmStatus: string) =>
    R112.jobScheduleLeaveMarks({
      people: [{ key: 'u', ids: ['u'] }],
      holidays: [
        { id: 'am', userId: 'u', startDayKey: '2026-11-23', endDayKey: '2026-11-23', timeSlot: 'AM', status: amStatus },
        { id: 'pm', userId: 'u', startDayKey: '2026-11-23', endDayKey: '2026-11-23', timeSlot: 'PM', status: pmStatus },
      ],
      dayKeys: ['2026-11-23'],
      timeZone: 'Europe/London',
    })[0].days[0]
  const both = marks('approved', 'approved')
  assert.equal(both.label, 'AL')
  assert.equal(both.kind, 'approvedFull')
  assert.equal(both.slot, 'FULL DAY')
  assert.equal(marks('pending', 'pending').label, 'AL?')
  const mixed = marks('approved', 'pending')
  assert.equal(mixed.label, 'AL AM · AL? PM')
  assert.equal(mixed.slot, 'AM')
  assert.equal(mixed.pending, false)
  // Review #299 (re-review 2): both halves shaded in their own style; the record is the approved half's.
  assert.equal(mixed.am, 'approved')
  assert.equal(mixed.pm, 'pending')
  assert.equal(mixed.recordId, 'am')
  const mixedPm = marks('pending', 'approved')
  assert.equal(mixedPm.label, 'AL? AM · AL PM')
  assert.deepEqual([mixedPm.am, mixedPm.pm, mixedPm.slot, mixedPm.recordId], ['pending', 'approved', 'PM', 'pm'])
  assert.deepEqual([both.am, both.pm], ['approved', 'approved'])
  const amOnly = marks('approved', 'rejected')
  assert.deepEqual([amOnly.am, amOnly.pm], ['approved', null])
  assert.equal(marks('approved', 'rejected').label, 'AL AM')
})

// Review #299 (3): one tile colour rule for both apps, from the pay rule's result.
test('1.37.0 scheduleCellKind / scheduleCellHours: the iOS scheme; a 0h booking is a Standard 0h tile', () => {
  assert.deepEqual(R112.scheduleCellKind({ paidHours: 8.5, overtimeHours: 0, timeSlot: 'FULL DAY' }), { tone: 'standard', standardHours: 8.5, overtimeHours: 0, halfLabel: null })
  assert.deepEqual(R112.scheduleCellKind({ paidHours: 11.875, overtimeHours: 3.375, timeSlot: 'CUSTOM_HOURS' }), { tone: 'split', standardHours: 8.5, overtimeHours: 3.38, halfLabel: null })
  assert.equal(R112.scheduleCellKind({ paidHours: 4.5, overtimeHours: 4.5, timeSlot: 'CUSTOM_HOURS' }).tone, 'otOnly')
  assert.equal(R112.scheduleCellKind({ paidHours: 3, overtimeHours: 0, timeSlot: 'Overtime' }).tone, 'otOnly')
  assert.deepEqual(R112.scheduleCellKind({ paidHours: 4, timeSlot: 'Morning' }), { tone: 'halfDay', standardHours: 4, overtimeHours: 0, halfLabel: 'AM' })
  assert.deepEqual(R112.scheduleCellKind({ paidHours: 0, overtimeHours: 0, timeSlot: 'CUSTOM_HOURS' }), { tone: 'standard', standardHours: 0, overtimeHours: 0, halfLabel: null })
  // Re-review (3): a 0h AM / PM is a Half day 0h chip — the same answer iOS reads (ScheduleLeaveMarksTests).
  assert.deepEqual(R112.scheduleCellKind({ paidHours: 0, overtimeHours: 0, timeSlot: 'AM' }), { tone: 'halfDay', standardHours: 0, overtimeHours: 0, halfLabel: 'AM' })
  assert.deepEqual(R112.scheduleCellKind(null), { tone: 'standard', standardHours: 0, overtimeHours: 0, halfLabel: null })
  const result = R112.payrollHoursResult({
    booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '18:15' },
    dayKey: '2026-11-23',
    policy: { standardDayStart: '07:00', standardDayEnd: '16:00', breakPaid: false, unpaidBreakMinutes: 30, breakWindowStart: '12:00', breakWindowEnd: '12:30', weekdayOutsideStandardMultiplier: 1.5, paidHoursDerived: true } as never,
  })
  const hours = R112.scheduleCellHours(result)
  assert.equal(hours.paidHours, result.totalPaidHours)
  const cell = R112.scheduleCellKind({ ...hours, timeSlot: 'CUSTOM_HOURS' })
  assert.equal(cell.tone, 'split')
  assert.equal(Math.round((cell.standardHours + cell.overtimeHours) * 100), Math.round(result.totalPaidHours * 100))
})

// --- 1.42.0: the Projects / Small works toggle text (owner decision 13 Nov, option B) -------------------------------

test('1.42.0 permissionToggleRows: the Projects and Small works rows read as add & edit, not as a view permission', () => {
  const rows = R112.permissionToggleRows({ level: 'manager', mode: 'edit', user: { manager: true } })
  const projects = rows.find((row) => row.field === 'projects')!
  const smallWorks = rows.find((row) => row.field === 'smallWorks')!
  assert.equal(projects.label, 'Projects — add & edit')
  assert.equal(
    projects.help,
    'Add new projects, edit any project and choose its managers. Without this, a manager still sees every project and can edit the projects they manage.'
  )
  assert.equal(smallWorks.label, 'Small Works — add & edit')
  assert.equal(
    smallWorks.help,
    'Add new small works, edit any small works job and choose its managers. Without this, a manager still sees every small works job and can edit the small works they manage.'
  )
  assert.equal(projects.label, R112.PROJECTS_TOGGLE_LABEL)
  assert.equal(projects.help, R112.PROJECTS_TOGGLE_HELP)
  assert.equal(smallWorks.label, R112.SMALL_WORKS_TOGGLE_LABEL)
  assert.equal(smallWorks.help, R112.SMALL_WORKS_TOGGLE_HELP)
  // The same text on every screen and level that shows the rows (Add User, its summary, Edit User; admin and manager).
  for (const level of ['admin', 'manager'] as const) {
    for (const mode of ['add', 'edit', 'summary'] as const) {
      const set = R112.permissionToggleRows({ level, mode })
      assert.equal(set.find((row) => row.field === 'projects')!.label, R112.PROJECTS_TOGGLE_LABEL)
      assert.equal(set.find((row) => row.field === 'smallWorks')!.help, R112.SMALL_WORKS_TOGGLE_HELP)
    }
  }
  // Never the pre-1.42 wording that read as a view permission.
  for (const row of [projects, smallWorks]) {
    assert.doesNotMatch(row.help, /see only|Sees, adds/i)
  }
  // The older call-site list carries the same text.
  assert.equal(R112.MANAGER_PERMISSION_TOGGLES.find((row) => row.key === 'projects')!.title, R112.PROJECTS_TOGGLE_LABEL)
})

test('1.42.0 option B: the toggle text matches the rules — every manager sees every job; the toggle adds jobs, edits any job and changes managers', () => {
  const role = { isSuperAdmin: false, isAdmin: false, isManager: true, isOperativeMode: false }
  const withToggle = { role, toggles: { projects: true, smallWorks: false }, ids: ['mgr-on'] }
  const without = { role, toggles: { projects: false, smallWorks: false }, ids: ['mgr-off'] }
  const theirs = { managerIds: ['mgr-off'], managerUserIds: ['mgr-off'] }
  const someoneElses = { managerIds: ['other'], managerUserIds: ['other'] }
  // Sees every job whatever the toggle.
  for (const viewer of [withToggle, without]) {
    assert.equal(R112.canSeeJob(viewer, someoneElses, [], 'projects'), true)
    assert.equal(R112.canSeeJob(viewer, someoneElses, [], 'smallWorks'), true)
  }
  // Toggle on: add, edit any job of that kind, change its managers — only for that kind.
  assert.equal(R112.canCreateJob(withToggle, 'projects'), true)
  assert.equal(R112.canChangeJobManagers(withToggle, 'projects'), true)
  assert.equal(R112.canEditJob(withToggle, someoneElses, 'projects'), true)
  assert.equal(R112.canCreateJob(withToggle, 'smallWorks'), false)
  // Toggle off: edit the details of the jobs they manage only; never add or change managers.
  assert.equal(R112.canCreateJob(without, 'projects'), false)
  assert.equal(R112.canChangeJobManagers(without, 'projects'), false)
  assert.equal(R112.canEditJob(without, theirs, 'projects'), true)
  assert.equal(R112.canEditJob(without, someoneElses, 'projects'), false)
})

// Rulebook 1.43.0 (owner reports 14 Nov): timesheet wording, snapshot timing, extras after sign-off, subcontractor tiles.
const policy143 = {
  ...R112.DEFAULT_PAYROLL_POLICY,
  standardDayStart: '07:00',
  standardDayEnd: '16:00',
  unpaidBreakMinutes: 30,
  breakWindowStart: '12:00',
  breakWindowEnd: '12:30',
  breakPaid: false,
  weekdayOutsideStandardMultiplier: 1.5,
}

test('1.43.0 payrollLineClockRanges: standard-window times on the standard line, overtime times on the overtime line', () => {
  const priced = (start: string, end: string, dayKey = '2026-11-11', policy: typeof policy143 = policy143) =>
    R112.payrollLineClockRanges(
      R112.payrollHoursResult({ booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: start, workEndTime: end }, dayKey, policy })
    )
  // Owner example: working day 07:00–16:00, booked 07:00–19:00.
  assert.deepEqual(priced('07:00', '19:00'), {
    standard: ['07:00–16:00'],
    overtime: ['16:00–19:00'],
    standardText: '07:00–16:00',
    overtimeText: '16:00–19:00',
  })
  // An early start and a late finish are two overtime ranges, earliest first.
  assert.equal(priced('05:00', '19:00').overtimeText, '05:00–07:00 + 16:00–19:00')
  assert.equal(priced('05:00', '19:00').standardText, '07:00–16:00')
  // Inside the day: no overtime.
  assert.deepEqual(priced('08:00', '15:00').overtime, [])
  // Entirely outside the day: no standard part.
  assert.equal(priced('17:00', '20:00').standardText, '')
  assert.equal(priced('17:00', '20:00').overtimeText, '17:00–20:00')
  // Overnight: the overtime range runs past midnight as stored.
  assert.equal(priced('22:00', '06:00').overtimeText, '22:00–06:00')
  assert.equal(priced('05:00', '02:00').overtimeText, '05:00–07:00 + 16:00–02:00')
  // Weekend set window (default Saturday 07:30–13:00): the window is standard, the rest overtime.
  const saturday = priced('06:00', '18:00', '2026-11-14', R112.DEFAULT_PAYROLL_POLICY as typeof policy143)
  assert.equal(saturday.standardText, '07:30–13:00')
  assert.equal(saturday.overtimeText, '06:00–07:30 + 13:00–18:00')
  // Every-hour Sunday (default): every hour is overtime.
  const sunday = priced('06:00', '18:00', '2026-11-15', R112.DEFAULT_PAYROLL_POLICY as typeof policy143)
  assert.equal(sunday.standardText, '')
  assert.equal(sunday.overtimeText, '06:00–18:00')
  assert.deepEqual(R112.payrollLineClockRanges(null), { standard: [], overtime: [], standardText: '', overtimeText: '' })
  // Wording only: the figures are the pay rule's, unchanged.
  const result = R112.payrollHoursResult({ booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '19:00' }, dayKey: '2026-11-11', policy: policy143 })
  assert.equal(result.totalPaidHours, 13)
})

test('1.43.0 timesheetLineClockText: the clock part of a line, never the multiplied text twice', () => {
  assert.equal(R112.timesheetLineClockText('16:00–19:00 · OT 6.5h × 2 − 0.5h break = 12.5h'), '16:00–19:00')
  assert.equal(R112.timesheetLineClockText('07:00–16:00 · no break'), '07:00–16:00 · no break')
  assert.equal(R112.timesheetLineClockText('OT 3h'), 'OT 3h')
  assert.equal(R112.timesheetLineClockText(null), '')
  // The multiplied text stays readable for a signed line (`parseMultipliedHoursText`).
  assert.deepEqual(R112.parseMultipliedHoursText('16:00–19:00 · OT 6.5h × 2 − 0.5h break = 12.5h'), { clockHours: 6.5, multiplier: 2, breakHours: 0.5 })
})

test('1.43.0 Edit booking: the booking\'s own overtime rate prices its hours and its weekend rows (owner example 14.5h)', () => {
  const explained = R112.bookingHoursExplanation(
    policy143,
    '2026-11-11',
    { workStartTime: '07:00', workEndTime: '19:00', isBreakRemoved: false, otMultiplierOverride: 2 },
    'Europe/London'
  )
  assert.equal(explained?.summary, '07:00–19:00 = 8.5h (day, less 30 min unpaid break) + 3h × 2 = 6h → 14.5h')
  assert.equal(explained?.totalPaidHours, 14.5)
  // Weekend rows (`weekendBookingBreakdown`) price the booking's own rate when given; without it the organisation's.
  const org = R112.weekendBookingBreakdown(R112.DEFAULT_PAYROLL_POLICY, ['2026-11-14'], '06:00', '18:00', false, 'Europe/London')
  const own = R112.weekendBookingBreakdown(R112.DEFAULT_PAYROLL_POLICY, ['2026-11-14'], '06:00', '18:00', false, 'Europe/London', 3)
  assert.equal(org[0].multiplier, R112.DEFAULT_PAYROLL_POLICY.saturday.outsideWindowMultiplier)
  assert.equal(own[0].multiplier, 3)
  assert.equal(own[0].overtimeHours, org[0].overtimeHours)
  assert.ok(own[0].paidHoursEquivalent > org[0].paidHoursEquivalent)
  assert.match(own[0].explanation.rule, /own overtime rate is 3×/)
})

test('1.43.0 timesheetSnapshotReady: sign-off waits for the period\'s bookings and pay inputs', () => {
  assert.deepEqual(R112.timesheetSnapshotReady({ bookingsLoaded: false }), {
    ready: false,
    failed: false,
    message: R112.TIMESHEET_SNAPSHOT_LOADING_MESSAGE,
  })
  assert.equal(R112.TIMESHEET_SNAPSHOT_LOADING_MESSAGE, 'Loading bookings…')
  assert.equal(R112.timesheetSnapshotReady({ bookingsLoaded: false, bookingsFailed: true }).failed, true)
  assert.equal(R112.timesheetSnapshotReady({ bookingsLoaded: true, rateHistoryLoaded: false }).ready, false)
  assert.equal(R112.timesheetSnapshotReady({ bookingsLoaded: true, payProfileLoaded: false }).ready, false)
  assert.deepEqual(R112.timesheetSnapshotReady({ bookingsLoaded: true, payProfileLoaded: true, rateHistoryLoaded: true }), {
    ready: true,
    failed: false,
    message: null,
  })
})

test('1.43.0 timesheetSnapshotNeedsRebuild: only a snapshot frozen empty while its bookings already existed', () => {
  const approvedAt = new Date('2026-11-10T09:00:00Z')
  const before = { isPayeDay: false, bookingCreatedAt: new Date('2026-11-03T08:00:00Z'), bookingUpdatedAt: new Date('2026-11-04T08:00:00Z') }
  const after = { isPayeDay: false, bookingCreatedAt: new Date('2026-11-12T08:00:00Z'), bookingUpdatedAt: new Date('2026-11-12T08:00:00Z') }
  // Review r318 (2nd): created before approval but moved into the period (written) after it.
  const movedLater = { isPayeDay: false, bookingCreatedAt: new Date('2026-11-03T08:00:00Z'), bookingUpdatedAt: new Date('2026-11-11T08:00:00Z') }
  const empty = { weeklyReportOverride: { lines: [], approvedAt } }
  // A booking that existed when the sheet was signed but is missing from the snapshot: the loading bug.
  assert.equal(R112.timesheetSnapshotNeedsRebuild(empty, [before]), true)
  // Any stored instant shape; the approval instant may come from the sheet when the snapshot has none.
  assert.equal(
    R112.timesheetSnapshotNeedsRebuild({ weeklyReportOverride: { lines: [] }, managerSignedAt: { seconds: 1762765200 } }, [
      { bookingCreatedAt: 1762157000000, bookingUpdatedAt: '2025-11-04T08:00:00Z' },
    ]),
    true
  )
  // Review r318: a legitimately empty snapshot (price work / expenses only) is never re-priced by a booking added later,
  // nor by one whose creation time is unknown.
  assert.equal(R112.timesheetSnapshotNeedsRebuild(empty, [after]), false)
  assert.equal(R112.timesheetSnapshotNeedsRebuild(empty, [movedLater]), false)
  assert.equal(R112.timesheetSnapshotNeedsRebuild(empty, [{ isPayeDay: false }]), false)
  // Either time unknown: never.
  assert.equal(R112.timesheetSnapshotNeedsRebuild(empty, [{ bookingCreatedAt: before.bookingCreatedAt }]), false)
  assert.equal(R112.timesheetSnapshotNeedsRebuild(empty, [{ bookingUpdatedAt: before.bookingUpdatedAt }]), false)
  // PAYE days never count; no live labour: nothing to rebuild.
  assert.equal(R112.timesheetSnapshotNeedsRebuild(empty, [{ ...before, isPayeDay: true }]), false)
  assert.equal(R112.timesheetSnapshotNeedsRebuild(empty, []), false)
  // No approval instant at all: never.
  assert.equal(R112.timesheetSnapshotNeedsRebuild({ weeklyReportOverride: { lines: [] } }, [before]), false)
  // A snapshot with labour lines is never re-priced.
  assert.equal(R112.timesheetSnapshotNeedsRebuild({ weeklyReportOverride: { lines: [{}], approvedAt } }, [before]), false)
  // Exported: left as it is.
  assert.equal(R112.timesheetSnapshotNeedsRebuild({ ...empty, exportedAt: new Date('2026-11-11T09:00:00Z') }, [before]), false)
  // No snapshot at all: not this rule (the snapshot is built on full approval).
  assert.equal(R112.timesheetSnapshotNeedsRebuild({ weeklyReportOverride: null }, [before]), false)
  assert.equal(R112.timesheetSnapshotNeedsRebuild(null, [before]), false)
})

test('1.43.0 timesheetOwnerCanAddExtras: no price work or expenses once the line manager has signed', () => {
  const signed = { managerSignedAt: new Date('2026-11-10T09:00:00Z') }
  assert.deepEqual(R112.timesheetOwnerCanAddExtras(signed), { allowed: false, message: R112.TIMESHEET_SIGNED_OFF_EXTRAS_MESSAGE })
  assert.equal(R112.TIMESHEET_SIGNED_OFF_EXTRAS_MESSAGE, 'This timesheet is signed off — add it to your next timesheet.')
  // The older approval field counts the same (the security rules test both).
  assert.equal(R112.timesheetOwnerCanAddExtras({ approvedAt: 1762765200000 }).allowed, false)
  // Not signed by the line manager yet (or only by the person): still open.
  assert.equal(R112.timesheetOwnerCanAddExtras({ managerSignedAt: null }).allowed, true)
  assert.equal(R112.timesheetOwnerCanAddExtras(null).allowed, true)
  // A self-signed sheet stays open (the person signs it again).
  assert.equal(R112.timesheetOwnerCanAddExtras(signed, { selfSigned: true }).allowed, true)
})

test('1.43.0 subcontractorScheduleCell: only the working window, never paid hours or an overtime split', () => {
  const one = R112.subcontractorScheduleCell({
    bookings: [{ timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '19:00' }],
    day: policy143,
    dayKey: '2026-11-11',
  })
  assert.equal(one?.headline, '07:00–19:00')
  assert.equal(one?.tone, 'standard')
  assert.equal(one?.standardText, null)
  assert.equal(one?.overtimeText, null)
  assert.deepEqual(one?.overtimeLines, [])
  assert.equal(one?.hoursText, '')
  // Two bookings: both windows, earliest first, with their number.
  const two = R112.subcontractorScheduleCell({
    bookings: [
      { timeSlot: 'CUSTOM_HOURS', workStartTime: '13:00', workEndTime: '16:00' },
      { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '12:00' },
    ],
  })
  assert.equal(two?.timesText, '07:00–12:00 + 13:00–16:00')
  assert.equal(two?.headline, '07:00–12:00 + 13:00–16:00 · 2 bookings')
  // A named slot is its clock window under the working hours in effect that day; a weekend day its own window.
  assert.equal(R112.subcontractorScheduleCell({ bookings: [{ timeSlot: 'FULL DAY' }], day: policy143, dayKey: '2026-11-11' })?.timesText, '07:00–16:00')
  assert.equal(
    R112.subcontractorScheduleCell({ bookings: [{ timeSlot: 'FULL DAY' }], day: R112.DEFAULT_PAYROLL_POLICY, dayKey: '2026-11-14' })?.timesText,
    '07:30–13:00'
  )
  // Overnight keeps its stored finish.
  assert.equal(R112.subcontractorScheduleCell({ bookings: [{ timeSlot: 'CUSTOM_HOURS', workStartTime: '22:00', workEndTime: '06:00' }] })?.timesText, '22:00–06:00')
  assert.equal(R112.subcontractorScheduleCell({ bookings: [] }), null)
})

test('1.43.0 agreedManagerSuggestions: the price work approvers, by any part of the name, at most six', () => {
  const ORG = 'org-143'
  const roster = [
    { id: 'op', firstName: 'Olly', surname: 'Operative', email: 'op@x.com', role: 'operative', operativeMode: true, isActive: true, passwordSet: true, organizationId: ORG },
    { id: 'pat', firstName: 'Pat', surname: 'Manager', email: 'pat@x.com', role: 'manager', manager: true, isActive: true, passwordSet: true, organizationId: ORG },
    { id: 'ann', firstName: 'Ann', surname: 'Admin', email: 'ann@x.com', role: 'admin', adminAccess: true, isActive: true, passwordSet: true, organizationId: ORG },
    { id: 'old', firstName: 'Patricia', surname: 'Gone', email: 'old@x.com', role: 'manager', manager: true, isActive: false, passwordSet: true, organizationId: ORG },
    { id: 'op2', firstName: 'Patrick', surname: 'Worker', email: 'op2@x.com', role: 'operative', operativeMode: true, isActive: true, passwordSet: true, organizationId: ORG },
  ]
  const person = roster[0]
  // Any part of the name, without case; never an operative or an inactive person.
  assert.deepEqual(R112.agreedManagerSuggestions('PAT', person, roster, { organizationId: ORG }), ['Pat Manager'])
  assert.deepEqual(R112.agreedManagerSuggestions('min', person, roster, { organizationId: ORG }), ['Ann Admin'])
  assert.deepEqual(R112.agreedManagerSuggestions('an', person, roster, { organizationId: ORG }).sort(), ['Ann Admin', 'Pat Manager'])
  // Never the person themself; the exact name is not offered again; nothing for an empty query.
  assert.deepEqual(R112.agreedManagerSuggestions('pat', roster[1], roster, { organizationId: ORG }), [])
  assert.deepEqual(R112.agreedManagerSuggestions('Pat Manager', person, roster, { organizationId: ORG }), [])
  assert.deepEqual(R112.agreedManagerSuggestions('  ', person, roster), [])
  // At most six.
  const many = Array.from({ length: 9 }, (_, i) => ({
    id: `m${i}`, firstName: `Manager${i}`, surname: 'Smith', email: `m${i}@x.com`, role: 'manager', manager: true, isActive: true, passwordSet: true, organizationId: ORG,
  }))
  assert.equal(R112.agreedManagerSuggestions('smith', person, [person, ...many], { organizationId: ORG }).length, R112.AGREED_MANAGER_SUGGESTIONS_MAX)
})


// MARK: - 1.44.0: the Monday–Friday paid day is always derived (owner decision 14 Nov, question A option 1)

test('1.44.0 owner example: 07:00–16:00, 30 min unpaid, booking 07:00–19:00 at its own ×2, £250 a day → £426.47', () => {
  const policy = r120Legacy({ standardDayStart: '07:00', breakWindowStart: '12:00', breakWindowEnd: '12:30', weekdayOutsideStandardMultiplier: 1.5 })
  assert.equal(policy.paidHoursDerived, undefined, 'saved before 1.20.0, stored standardPaidHours 8')
  const day = R112.weekdayPaidHours(policy)
  assert.equal(day, 8.5)
  const hours = r120Hours(policy, { ...r120Custom('07:00', '19:00'), otMultiplierOverride: 2 })
  assert.deepEqual([hours.standardHours, hours.outsideHours, hours.outsideMultiplier], [8.5, 3, 2])
  const standard = R112.payForHours({ payBasis: 'day', dayRate: 250, paidHours: hours.standardHours, standardDayHours: day })
  const overtime = R112.payForHours({ payBasis: 'day', dayRate: 250, paidHours: hours.outsideHours, standardDayHours: day, otMultiplier: 2 })
  assert.equal(standard, 250)
  assert.equal(overtime, 176.47)
  assert.equal(Math.round((standard + overtime) * 100) / 100, 426.47)
  assert.equal(R112.roundPennies((250 / 8.5) * 14.5), 426.47)
})

test('1.44.0: every policy in the history derives its own day; the stored standardPaidHours is never read for pay', () => {
  const zone = 'Europe/London'
  const old = policyToFirestore119(r120Legacy({ standardDayStart: '07:00' })) // stored 8, clock 8.5
  const later = policyToFirestore119(r120Legacy({ standardDayStart: '08:00', standardPaidHours: 10 })) // stored 10, clock 7.5
  const org = {
    countryCode: 'GB',
    payrollTimePolicy: later,
    payrollTimePolicyEffectiveFrom: '2026-11-02',
    payrollTimePolicyHistory: [
      { effectiveFrom: '1970-01-01', policy: old },
      { effectiveFrom: '2026-11-02', policy: later },
    ],
  }
  const state = R112.parsePayrollTimePolicyState(org, zone)
  assert.equal(R112.weekdayPaidHours(R112.payrollTimePolicyForDayFromState(state, '2026-10-28')), 8.5)
  assert.equal(R112.weekdayPaidHours(R112.payrollTimePolicyForDayFromState(state, '2026-11-04')), 7.5)
  // Written back as stored (older builds read it): the history entry keeps its 8.
  const fields = R112.payrollTimePolicyCancelScheduleWriteFields({ orgDoc: org, todayKey: '2026-11-04', timeZone: zone })
  const history = fields.payrollTimePolicyHistory as Array<{ policy: Record<string, unknown> }> | undefined
  if (history) assert.equal(history[0].policy.standardPaidHours, 8)
  // A weekend day with no "counts as" of its own reads 8h (`weekendCountsAsHours`), in the reader and the pay rule
  // alike — never the weekday paid day, stored or derived (weekend pay is unchanged by 1.44.0).
  const noCountsAs = r120Legacy({ standardDayStart: '07:00', saturday: { allHoursAtMultiplierMode: false, allHoursMultiplier: 2, definedWindowStart: '07:00', definedWindowEnd: '13:00', outsideWindowMultiplier: 2 } })
  const sat = R112.payrollHoursResult({ booking: r120Custom('07:00', '13:00'), dayKey: '2026-11-07', policy: noCountsAs, timeZone: R120_ZONE })
  assert.equal(noCountsAs.saturday.countsAsStandardHours, 8)
  assert.equal(sat.standardHours, 8)
  const raw = { ...noCountsAs, saturday: { ...noCountsAs.saturday, countsAsStandardHours: undefined } }
  assert.equal(R112.payrollHoursResult({ booking: r120Custom('07:00', '13:00'), dayKey: '2026-11-07', policy: raw as never, timeZone: R120_ZONE }).standardHours, 8)
  assert.equal(R112.weekendCountsAsHours({}), 8)
  assert.equal(R112.weekendCountsAsHours({ countsAsStandardHours: 6 }), 6)
  // No policy: the default day, derived (07:30–16:00 − 30 min).
  assert.equal(R112.weekdayPaidHours(null), 8)
  // A clock that would derive outside 1–12 (only reachable from stored data the save check refuses) is clamped.
  assert.equal(R112.weekdayPaidHours({ ...r120Legacy(), standardDayStart: '06:00', standardDayEnd: '22:00', unpaidBreakMinutes: 0 }), 12)
})

// MARK: - 1.44.0: a booking whose person can't be resolved is never hidden (owner decision 14 Nov, question H option 1)

test('1.44.0 scheduleRowPerson: former ids, same-email ids and operatives rows resolve; an unknown id is an Unknown person row', () => {
  const input = {
    accounts: [{ id: 'farnie-uid', email: 'farnie@example.com', formerIds: ['OLD-INVITE'], aliasIds: ['second-doc'] }],
    operatives: [{ id: 'op-row', email: 'farnie@example.com' }, { id: 'ghost-row', email: '' }],
  }
  for (const id of ['farnie-uid', 'old-invite', 'SECOND-DOC', 'op-row']) {
    const row = R112.scheduleRowPerson(id, input)
    assert.equal(row.unresolved, false, id)
    assert.equal(row.key, 'account:farnie-uid', id)
    assert.equal(row.label, null)
  }
  assert.deepEqual(
    [R112.scheduleRowPerson('ghost-row', input).unresolved, R112.scheduleRowPerson('ghost-row', input).key],
    [false, 'operative:ghost-row']
  )
  const unknown = R112.scheduleRowPerson('6a9632ba-1111-2222', input)
  assert.deepEqual(
    [unknown.unresolved, unknown.key, unknown.label, unknown.idHint, unknown.accountId, unknown.operativeId],
    [true, 'id:6a9632ba-1111-2222', 'Unknown person · 6A9632BA', '6A9632BA', null, null]
  )
  assert.equal(R112.UNRESOLVED_BOOKING_PERSON_CHIP, 'Not linked to a person')
})

test('1.44.0 unresolvedBookingPeople: one entry per unknown id (without case) with count, days, jobs and bookers', () => {
  const input = {
    accounts: [{ id: 'u1', email: 'a@example.com', formerIds: [], aliasIds: [] }],
    operatives: [],
    bookings: [
      { id: 'b1', personId: '6A9632BA-X', dayKey: '2026-11-10', jobId: 'J1', jobName: 'Kitchen', bookedBy: 'Sam', collection: 'bookings' as const },
      { id: 'b2', personId: '6a9632ba-x', dayKey: '2026-11-03', jobId: 'j1', jobName: '', bookedBy: 'sam', collection: 'bookings' as const },
      { id: 'b3', personId: '6A9632BA-X', dayKey: '2026-11-12', jobId: 'J2', jobName: 'Roof', bookedBy: 'Ann', collection: 'managerSiteBookings' as const },
      { id: 'b4', personId: 'u1', dayKey: '2026-11-10', jobId: 'J1', collection: 'bookings' as const },
      { id: 'b5', personId: 'zz-other', dayKey: '2026-11-11', jobId: '', collection: 'bookings' as const },
      { id: 'b6', personId: '  ', dayKey: '2026-11-11', collection: 'bookings' as const },
    ],
  }
  const rows = R112.unresolvedBookingPeople(input)
  assert.equal(rows.length, 2)
  assert.deepEqual(
    [rows[0].personId, rows[0].idHint, rows[0].count, rows[0].firstDayKey, rows[0].lastDayKey, rows[0].bookedBy, rows[0].bookingIds, rows[0].collections],
    ['6A9632BA-X', '6A9632BA', 3, '2026-11-03', '2026-11-12', ['Sam', 'Ann'], ['b1', 'b2', 'b3'], ['bookings', 'managerSiteBookings']]
  )
  assert.deepEqual(rows[0].jobs, [{ jobId: 'J1', jobName: 'Kitchen', count: 2 }, { jobId: 'J2', jobName: 'Roof', count: 1 }])
  assert.deepEqual([rows[1].personId, rows[1].count, rows[1].jobs], ['zz-other', 1, []])
})

test('1.44.0 link an unknown id to a person: candidates (one per person, live signed-up doc, not the viewer), re-check and the arrayUnion write', () => {
  const roster = [
    // Bea: a stale admin copy (pending invite) and her live document on the same email — the live one speaks.
    { id: 'b-old', firstName: 'Bea', surname: 'Old', email: 'BEA@example.com', organizationId: 'org1', isActive: true, passwordSet: false },
    { id: 'b', firstName: 'Bea', surname: 'Two', email: 'bea@example.com', organizationId: 'org1', isActive: true, passwordSet: true },
    { id: 'a', firstName: 'Ann', surname: 'One', email: 'ann@example.com', organizationId: 'org1', isActive: true, passwordSet: true },
    { id: 'me', firstName: 'Admin', surname: 'Me', email: 'me@example.com', organizationId: 'org1', isActive: true, passwordSet: true, formerUserIds: ['ME-OLD'] },
    { id: 'pending', firstName: 'Pat', surname: 'Pending', email: 'pat@example.com', organizationId: 'org1', isActive: true, passwordSet: false },
    { id: 'gone', firstName: 'Old', surname: 'Hand', email: 'old@example.com', organizationId: 'org1', isActive: false, passwordSet: true },
    { id: 'away', firstName: 'Other', surname: 'Co', email: 'oc@example.com', organizationId: 'org2', isActive: true, passwordSet: true },
    { id: 'del', firstName: 'Deleted', surname: 'user', email: '', organizationId: 'org1', isActive: true, passwordSet: true },
    { id: 'ghost1', firstName: 'Gus', surname: 'Ghost', email: '', organizationId: 'org1', isActive: true, passwordSet: false, ghost: true },
  ]
  const ids = (rows: Array<{ id: string }>) => rows.map((c) => c.id)
  assert.deepEqual(ids(R112.linkBookingPersonCandidates(roster, 'org1', { viewerIds: ['me-old'] })), ['a', 'b', 'ghost1'])
  // Without a viewer every active person is offered, by name (Admin Me, Ann One, Bea Two, Gus Ghost).
  assert.deepEqual(ids(R112.linkBookingPersonCandidates(roster, 'org1')), ['me', 'a', 'b', 'ghost1'])
  assert.equal(R112.LINK_BOOKING_PERSON_SELF_NOTE, 'To link bookings to yourself, ask another admin.')
  assert.equal(R112.linkBookingPersonConfirmMessage(3, 'Farnie Nel'), 'All 3 bookings under this ID will show as Farnie Nel.')
  assert.equal(R112.linkBookingPersonConfirmMessage(1, 'Farnie Nel'), 'All 1 booking under this ID will show as Farnie Nel.')
  assert.equal(R112.linkBookingPersonDoneMessage(3, 'Farnie Nel'), 'Linked: 3 bookings now show as Farnie Nel.')
  assert.equal(R112.LINK_BOOKING_PERSON_ALREADY_MESSAGE, 'Already linked.')
  // Re-check on a fresh roster.
  const base = { roster, operatives: [], organizationId: 'org1', viewerIds: ['me'] }
  assert.equal(R112.linkBookingPersonRefusal({ ...base, personId: '6A9632BA-X', targetId: 'b' }), null)
  assert.equal(R112.linkBookingPersonRefusal({ ...base, personId: 'me-old', targetId: 'b' })?.reason, 'already_linked')
  assert.equal(R112.linkBookingPersonRefusal({ ...base, personId: 'A', targetId: 'b' })?.reason, 'resolves')
  assert.equal(R112.linkBookingPersonRefusal({ ...base, personId: 'x', targetId: 'pending' })?.reason, 'not_candidate')
  assert.equal(R112.linkBookingPersonRefusal({ ...base, personId: 'x', targetId: 'me' })?.reason, 'not_candidate')
  assert.equal(R112.linkBookingPersonRefusal({ ...base, personId: ' ', targetId: 'b' })?.reason, 'blank')
  // The write: arrayUnion + metadata; null when already there (case-insensitive), own id, blank, bad metadata.
  const person = { id: 'farnie', formerUserIds: ['OLD-1'] }
  assert.deepEqual(
    R112.linkBookingPersonWriteFields({ person, personId: '6A9632BA-X', actorUserId: 'admin', platform: 'web' }),
    { arrayUnion: { formerUserIds: ['6A9632BA-X'] }, set: { updatedBy: 'admin', updatedFrom: 'web' } }
  )
  assert.equal(R112.linkBookingPersonWriteFields({ person, personId: 'old-1', actorUserId: 'admin', platform: 'web' }), null)
  assert.equal(R112.linkBookingPersonWriteFields({ person, personId: 'FARNIE', actorUserId: 'admin', platform: 'web' }), null)
  assert.equal(R112.linkBookingPersonWriteFields({ person, personId: ' ', actorUserId: 'admin', platform: 'web' }), null)
  assert.equal(R112.linkBookingPersonWriteFields({ person, personId: 'x', actorUserId: '', platform: 'web' }), null)
  const after = R112.scheduleRowPerson('6a9632ba-x', { accounts: [{ id: 'farnie', email: 'f@example.com', formerIds: ['OLD-1', '6A9632BA-X'] }], operatives: [] })
  assert.deepEqual([after.unresolved, after.accountId], [false, 'farnie'])
})

// MARK: - 1.45.0: timesheet claim evidence, edit and delete, "Amount inc VAT" (owner decisions 14 Nov)

import * as r145 from './index'

const ORG145 = 'org-145'
const UID145 = 'uidOwner145'
const ev145 = (uid: string, ms: number, ext = 'jpg', extra: Record<string, unknown> = {}) => ({
  path: `organizations/${ORG145}/payeClaims/${uid}/${uid}_${ms}.${ext}`,
  name: `receipt-${ms}.${ext}`,
  kind: 'photo' as const,
  contentType: ext === 'pdf' ? 'application/pdf' : 'image/jpeg',
  auditId: null,
  ...extra,
})

test("1.45.0 parseTimesheetEntries reads evidence: the sheet owner's own claim files only, receiptName kept read-only", () => {
  const sheetId = `timesheet_${UID145}_1793750400`
  const sheet = {
    userId: UID145,
    expenseEntries: [
      {
        id: 'E1',
        title: 'Parking',
        amount: 12,
        date: '2026-11-10T10:00:00.000Z',
        receiptName: 'receipt.jpg',
        evidence: [
          ev145(UID145, 1),
          ev145('someoneElse', 2),
          { path: 'https://evil.example/x.jpg', name: 'x' },
          { path: `organizations/other-org/payeClaims/${UID145}/${UID145}_3.jpg` },
          { path: `organizations/${ORG145}/personalSiteAudits/${UID145}/a1/${UID145}_4.jpg` },
          'junk',
        ],
      },
      { id: 'E2', title: 'Old receipt only', amount: 5, date: '2026-11-11T10:00:00.000Z', receiptName: 'receipt-uploaded' },
    ],
    priceWorkEntries: [{ id: 'P1', title: 'Kitchen', amount: 300, jobNumber: 'J-1', startDate: '2026-11-10T00:00:00.000Z', evidence: [ev145(UID145, 5, 'pdf')] }],
  }
  const parsed = r145.parseTimesheetEntries(sheetId, sheet, { timeZone: 'Europe/London', organizationId: ORG145 })
  assert.deepEqual(parsed.expenseEntries[0].evidence.map((e) => e.path), [ev145(UID145, 1).path])
  assert.equal(parsed.expenseEntries[0].receiptName, 'receipt.jpg')
  assert.deepEqual(parsed.expenseEntries[1].evidence, [])
  assert.equal(parsed.expenseEntries[1].receiptName, 'receipt-uploaded')
  assert.equal(parsed.priceWorkEntries[0].evidence[0].kind, 'photo')
  // Filed under a former id: the document id names the subject, so their own folder still counts.
  const filed = r145.parseTimesheetEntries(sheetId, { ...sheet, userId: 'FORMER-1' }, { organizationId: ORG145 })
  assert.equal(filed.expenseEntries[0].evidence.length, 1)
  assert.deepEqual(r145.timesheetEvidenceOwnerIds(sheetId, { userId: 'FORMER-1' }, ['alias']), ['FORMER-1', UID145, 'alias'])
  // No owner id at all: nothing is kept.
  assert.deepEqual(r145.parseTimesheetEntries('settings-x', { expenseEntries: sheet.expenseEntries }).expenseEntries[0].evidence, [])
})

test('1.45.0 timesheetOwnerEntriesError: new/edited expenses need evidence, price work evidence optional, untouched old entries never block', () => {
  const owner = { organizationId: ORG145, ownerUserIds: [UID145] }
  const oldExpense = { id: 'E-OLD', title: 'Fuel', amount: 40, date: '2026-11-01T00:00:00.000Z', receiptName: 'receipt.jpg' }
  const oldPrice = { id: 'P-OLD', title: 'Old', amount: 10, startDate: '2026-11-01T00:00:00.000Z' }
  const previous = { expenseEntries: [oldExpense], priceWorkEntries: [oldPrice] }
  assert.equal(r145.timesheetOwnerEntriesError({ previous, next: previous, ...owner }), null)
  // A reviewer decision is not an owner edit.
  assert.equal(r145.timesheetOwnerEntriesError({ previous, next: { ...previous, expenseEntries: [{ ...oldExpense, managerDecision: 'declined' }] }, ...owner }), null)
  const fresh = { id: 'E-NEW', title: 'Train', amount: 20, date: '2026-11-12T00:00:00.000Z' }
  assert.equal(r145.timesheetOwnerEntriesError({ previous, next: { ...previous, expenseEntries: [oldExpense, fresh] }, ...owner }), r145.EXPENSE_EVIDENCE_REQUIRED_MESSAGE)
  assert.equal(r145.timesheetOwnerEntriesError({ previous, next: { ...previous, expenseEntries: [oldExpense, { ...fresh, evidence: [ev145(UID145, 9)] }] }, ...owner }), null)
  // Editing the old expense asks for evidence once.
  assert.equal(r145.timesheetOwnerEntriesError({ previous, next: { ...previous, expenseEntries: [{ ...oldExpense, amount: 41 }] }, ...owner }), r145.EXPENSE_EVIDENCE_REQUIRED_MESSAGE)
  assert.equal(
    r145.timesheetOwnerEntriesError({ previous, next: { ...previous, expenseEntries: [oldExpense, { ...fresh, evidence: [ev145('other', 9)] }] }, ...owner }),
    r145.PAYE_CLAIM_EVIDENCE_INVALID_MESSAGE
  )
  const many = Array.from({ length: 21 }, (_, i) => ev145(UID145, 100 + i))
  assert.equal(r145.timesheetOwnerEntriesError({ previous, next: { ...previous, expenseEntries: [oldExpense, { ...fresh, evidence: many }] }, ...owner }), r145.PAYE_CLAIM_EVIDENCE_LIMIT_MESSAGE)
  // New price work: job number required, evidence optional.
  const pw = { id: 'P-NEW', title: 'Tiling', amount: 50, startDate: '2026-11-12T00:00:00.000Z' }
  assert.equal(r145.timesheetOwnerEntriesError({ previous, next: { ...previous, priceWorkEntries: [oldPrice, pw] }, ...owner }), r145.PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE)
  assert.equal(r145.timesheetOwnerEntriesError({ previous, next: { ...previous, priceWorkEntries: [oldPrice, { ...pw, jobNumber: 'J-9' }] }, ...owner }), null)
  // Adding evidence to an old price work entry is an edit (asks for its job number, as 1.30.1 does for any edit).
  assert.equal(r145.timesheetPriceWorkJobNumberError([oldPrice], [{ ...oldPrice, evidence: [ev145(UID145, 7)] }]), r145.PRICE_WORK_JOB_NUMBER_REQUIRED_MESSAGE)
  assert.equal(r145.timesheetPriceWorkJobNumberError([oldPrice], [oldPrice]), null)
  assert.deepEqual(r145.timesheetOwnerTouchedEntries([oldExpense], [oldExpense, fresh], 'expense').map((row) => row.id), ['E-NEW'])
})

test('1.45.0 canEditTimesheetEntry: the owner only, until the line manager signs (a self-signed sheet stays open)', () => {
  assert.deepEqual(r145.canEditTimesheetEntry({}, { viewerIsOwner: true }), { allowed: true, message: null })
  assert.deepEqual(r145.canEditTimesheetEntry({}, { viewerIsOwner: false }), { allowed: false, message: null })
  assert.deepEqual(r145.canEditTimesheetEntry({ managerSignedAt: '2026-11-12T10:00:00Z' }, { viewerIsOwner: true }), {
    allowed: false,
    message: r145.TIMESHEET_SIGNED_OFF_EXTRAS_MESSAGE,
  })
  assert.equal(r145.canEditTimesheetEntry({ approvedAt: 1 }, { viewerIsOwner: true }).allowed, false)
  assert.equal(r145.canEditTimesheetEntry({ managerSignedAt: '2026-11-12T10:00:00Z' }, { viewerIsOwner: true, selfSigned: true }).allowed, true)
})

test('1.45.0 timesheetEntryEvidenceToDelete: only files gone from every entry and uploaded by the viewer within the undo window', () => {
  const now = Date.parse('2026-11-14T12:00:00.000Z')
  const recent = ev145(UID145, now - 60_000)
  const old = ev145(UID145, now - 24 * 3600_000)
  const kept = ev145(UID145, now - 30_000)
  const before = { expenseEntries: [{ evidence: [recent, old, kept] }], priceWorkEntries: [] }
  const after = { expenseEntries: [], priceWorkEntries: [{ evidence: [kept] }] }
  assert.deepEqual(r145.timesheetEntryEvidenceToDelete({ before, after, organizationId: ORG145, viewerUserId: UID145, nowMs: now }), [recent.path])
  assert.deepEqual(r145.timesheetEntryEvidenceToDelete({ before, after, organizationId: ORG145, viewerUserId: 'manager', nowMs: now }), [])
})

test("1.45.0 timesheetEvidencePages: one page per piece of evidence on the invoice's price work and expense rows", () => {
  const sheetId = `timesheet_${UID145}_1793750400`
  const entries = r145.parseTimesheetEntries(
    sheetId,
    {
      userId: UID145,
      expenseEntries: [
        { id: 'e1', title: 'Parking', details: 'Car park', jobNumber: 'J-2', amount: 12, date: '2026-11-10T10:00:00.000Z', evidence: [ev145(UID145, 1), ev145(UID145, 2, 'pdf')] },
        { id: 'e2', title: 'Declined', amount: 3, date: '2026-11-10T10:00:00.000Z', evidence: [ev145(UID145, 3)] },
      ],
      priceWorkEntries: [
        { id: 'P1', title: 'Kitchen', agreedManagerName: 'Bea', amount: 300, jobNumber: '', startDate: '2026-11-10T00:00:00.000Z', evidence: [ev145(UID145, 5, 'heic', { contentType: 'image/heic' })] },
      ],
    },
    { timeZone: 'Europe/London', organizationId: ORG145 }
  )
  const pages = r145.timesheetEvidencePages({
    rows: [
      { kind: 'labour', id: 'L1', amount: 100 },
      { kind: 'expense', id: 'E1', amount: 12, jobNumber: 'J-2' },
      { kind: 'priceWork', id: 'p1', amount: 250, jobNumber: '' },
    ],
    entries,
    currency: 'GBP',
  })
  assert.equal(pages.length, 3)
  assert.deepEqual(pages.map((p) => p.drawAs), ['image', 'pdf', 'listed'])
  assert.equal(pages[0].evidenceTitle, 'Evidence 1 of 2: receipt-1.jpg')
  assert.equal(pages[0].itemName, 'Parking')
  assert.equal(pages[0].date, 'Tue 10 Nov')
  assert.equal(pages[0].notes[0], 'Car park')
  assert.equal(pages[2].jobNumber, '—')
  assert.equal(pages[2].approvedBy, 'Bea')
  assert.equal(pages[2].amount, '£250.00')
})

test('1.45.0 "Amount inc VAT" on expense forms and the expenses report; evidence count text; list helpers', () => {
  assert.equal(r145.EXPENSE_AMOUNT_LABEL, 'Amount inc VAT')
  assert.equal(r145.EXPENSES_REPORT_COLUMNS[r145.EXPENSES_REPORT_COLUMNS.length - 1], 'Amount inc VAT')
  assert.equal(r145.PRICE_WORK_REPORT_COLUMNS[r145.PRICE_WORK_REPORT_COLUMNS.length - 1], 'Amount')
  assert.equal(r145.claimEvidenceCountText(0), '')
  assert.equal(r145.claimEvidenceCountText(1), '1 piece of evidence')
  assert.equal(r145.claimEvidenceCountText(3), '3 pieces of evidence')
  assert.deepEqual(r145.claimEvidenceRemoved([{ path: 'a' }, { path: 'b' }, { path: 'b' }], [{ path: 'a' }]), [{ path: 'b' }])
  assert.equal(r145.claimEvidenceSameList([{ path: 'a' }], [{ path: 'a' }]), true)
  assert.equal(r145.claimEvidenceSameList([{ path: 'a' }, { path: 'b' }], [{ path: 'b' }, { path: 'a' }]), false)
  assert.deepEqual(r145.timesheetEntryEvidenceWriteFields([{ path: 'p', name: '', kind: 'photo', contentType: '', auditId: null }]), [{ path: 'p', name: 'p', kind: 'photo' }])
})

test('1.45.0 PAYE item edit: the person only, validated as new, only changed fields, back to Needs review', () => {
  const roster = [
    { id: UID145, firstName: 'Pat', surname: 'Paye', email: 'pat@example.com', organizationId: ORG145, isActive: true, role: 'operative', operativeMode: true, assignedManagerUserIds: ['mgr'], passwordSet: true },
    { id: 'mgr', firstName: 'Mo', surname: 'Manager', email: 'mo@example.com', organizationId: ORG145, isActive: true, role: 'manager', manager: true, passwordSet: true },
    { id: 'adm', firstName: 'Ada', surname: 'Admin', email: 'ada@example.com', organizationId: ORG145, isActive: true, role: 'admin', adminAccess: true, passwordSet: true },
  ]
  const person = roster[0]
  const item = r145.parsePriceWorkDocument(
    'pw1',
    { userId: UID145, title: 'Tiling', details: '', jobNumber: 'J-1', startDate: '2026-11-10', endDate: '2026-11-10', approvedByUserId: 'mgr', approvedByName: 'Mo Manager', amount: 100, currency: 'GBP', evidence: [ev145(UID145, 1)] },
    { organizationId: ORG145 }
  )
  assert.equal(r145.canEditPayeClaim(UID145, item), true)
  assert.equal(r145.canEditPayeClaim('mgr', item), false)
  const draft = r145.payeClaimEditDraft(item)
  assert.deepEqual(r145.priceWorkUpdateWriteFields({ item, userId: UID145, draft, person: person as never, roster: roster as never, organizationId: ORG145 }), { set: {}, remove: [] })
  const write = r145.priceWorkUpdateWriteFields({
    item,
    userId: UID145,
    draft: { ...draft, amount: '120', evidence: [...item.evidence, ev145(UID145, 2)] },
    person: person as never,
    roster: roster as never,
    organizationId: ORG145,
  })
  assert.deepEqual(Object.keys(write!.set).sort(), ['amount', 'evidence'])
  assert.equal(write!.set.amount, 120)
  assert.equal(r145.priceWorkUpdateWriteFields({ item, userId: 'mgr', draft, person: person as never, roster: roster as never, organizationId: ORG145 }), null)
  assert.equal(r145.priceWorkUpdateWriteFields({ item, userId: UID145, draft: { ...draft, jobNumber: '' }, person: person as never, roster: roster as never, organizationId: ORG145 }), null)
  // Editing moves the review fingerprint, so an approved item needs review again.
  assert.notEqual(r145.payeClaimFingerprint(item), r145.payeClaimFingerprint({ ...item, amount: 120 }))
  // Expense: evidence stays required on edit.
  const expense = r145.parseExpenseDocument('ex1', { userId: UID145, title: 'Fuel', date: '2026-11-10', amount: 40, currency: 'GBP', evidence: [ev145(UID145, 3)] }, { organizationId: ORG145 })
  const exDraft = r145.payeClaimEditDraft(expense)
  assert.equal(r145.expenseUpdateWriteFields({ item: expense, userId: UID145, draft: { ...exDraft, evidence: [] }, organizationId: ORG145 }), null)
  assert.deepEqual(r145.expenseUpdateWriteFields({ item: expense, userId: UID145, draft: { ...exDraft, title: 'Diesel' }, organizationId: ORG145 }), { set: { title: 'Diesel' }, remove: [] })
})

test('1.45.0 review #322 F1: any owner change reopens a fingerprinted entry review; reviews stored before 1.45.0 stay amount-only', () => {
  const ev = (uid: string, ms: number) => ({ path: `organizations/${ORG145}/payeClaims/${uid}/${uid}_${ms}.jpg`, name: 'r.jpg', kind: 'photo' })
  const sheetId = `timesheet_${UID145}_1762732800`
  const stored = { id: 'P1', title: 'Tiling', details: '', jobNumber: 'J-1', agreedManagerName: '', amount: 50, startDate: { seconds: 1762732800, nanoseconds: 0 }, evidence: [ev(UID145, 1)] }
  const parsed = r145.parseTimesheetEntries(sheetId, { userId: UID145, priceWorkEntries: [stored] }).priceWorkEntries[0]
  assert.equal(parsed.reviewFingerprint, r145.timesheetEntryFingerprint(stored, 'priceWork'))

  // The line manager declines from their loaded copy (it carries the stored row's fingerprint).
  const written = r145.timesheetEntryReviewWriteFields({
    stored: {},
    entries: [{ id: 'P1', amount: 50, managerDecision: 'declined' as const, reviewFingerprint: parsed.reviewFingerprint }],
    reviewedByUserId: 'lm',
    reviewedAtMs: 1,
  })
  const review = written['extraEntryReviews.P1'] as Record<string, unknown>
  assert.equal(review.reviewedFingerprint, parsed.reviewFingerprint)
  const sheet = (entry: Record<string, unknown>, reviews: Record<string, unknown>) => ({ userId: UID145, extraEntryReviews: reviews, priceWorkEntries: [entry] })
  assert.equal(r145.timesheetEntryDecision(sheet(stored, { P1: review }), stored).decision, 'declined')
  // Any owner change to the stored row reopens it.
  for (const changed of [
    { ...stored, evidence: [ev(UID145, 1), ev(UID145, 2)] },
    { ...stored, startDate: { seconds: 1762819200, nanoseconds: 0 } },
    { ...stored, jobNumber: 'J-9' },
    { ...stored, details: 'Hall too' },
  ]) {
    const result = r145.timesheetEntryDecision(sheet(changed, { P1: review }), changed)
    assert.deepEqual([result.decision, result.source], ['pending', 'stale-review'])
  }
  // Evidence order is not a change.
  const twoFiles = { ...stored, evidence: [ev(UID145, 1), ev(UID145, 2)] }
  assert.equal(r145.timesheetEntryFingerprint(twoFiles, 'priceWork'), r145.timesheetEntryFingerprint({ ...twoFiles, evidence: [ev(UID145, 2), ev(UID145, 1)] }, 'priceWork'))

  // A review stored before 1.45.0 (no fingerprint): only an amount change reopens it.
  const { reviewedFingerprint: _drop, ...oldReview } = review
  void _drop
  assert.equal(r145.timesheetEntryDecision(sheet(twoFiles, { P1: oldReview }), twoFiles).decision, 'declined')
  assert.equal(r145.timesheetEntryDecision(sheet({ ...stored, amount: 60 }, { P1: oldReview }), { ...stored, amount: 60 }).decision, 'pending')
})

test('1.45.0 review #322 F1a/F1b: one fingerprint input — reader, loaded copy and totals agree; dateless and foreign-file entries stay decided', () => {
  const ev = (uid: string, ms: number) => ({ path: `organizations/${ORG145}/payeClaims/${uid}/${uid}_${ms}.jpg`, name: 'r.jpg', kind: 'photo' })
  const sheetId = `timesheet_${UID145}_1762732800`
  // A price work row with no start date and no agreed manager (kind comes from its array), and an expense with no
  // date and a file from someone else's folder (the reader's display copy drops it).
  const pw = { id: 'P2', title: 'Old price work', amount: 30 }
  const ex = { id: 'E2', title: 'Old expense', amount: 7, evidence: [ev(UID145, 1), ev('someoneElse', 2)] }
  const first = r145.parseTimesheetEntries(sheetId, { userId: UID145, priceWorkEntries: [pw], expenseEntries: [ex] })
  assert.equal(first.expenseEntries[0].evidence.length, 1)
  assert.notEqual(first.priceWorkEntries[0].reviewFingerprint, r145.timesheetEntryFingerprint(pw, 'expense'))
  // The line manager approves both from the loaded copy.
  const written = r145.timesheetEntryReviewWriteFields({
    stored: {},
    entries: [
      { id: 'P2', amount: 30, managerDecision: 'edited' as const, managerRevisedAmount: 20, reviewFingerprint: first.priceWorkEntries[0].reviewFingerprint },
      { id: 'E2', amount: 7, managerDecision: 'approved' as const, reviewFingerprint: first.expenseEntries[0].reviewFingerprint },
    ],
    reviewedByUserId: 'lm',
    reviewedAtMs: 1,
  })
  const reviews = { P2: written['extraEntryReviews.P2'], E2: written['extraEntryReviews.E2'] }
  const stored = { userId: UID145, priceWorkEntries: [pw], expenseEntries: [ex], extraEntryReviews: reviews, managerSignedAt: null }
  // Reader, a second load later in the day (the app fills dates for display; the fingerprint does not), and totals.
  for (let load = 0; load < 2; load += 1) {
    const again = r145.parseTimesheetEntries(sheetId, stored)
    assert.deepEqual([again.priceWorkEntries[0].managerDecision, again.expenseEntries[0].managerDecision], ['edited', 'approved'])
  }
  const loaded = r145.parseTimesheetEntries(sheetId, stored)
  const displayCopy = {
    ...stored,
    priceWorkEntries: [{ ...pw, startDate: new Date(), agreedManagerName: 'Manager', reviewFingerprint: loaded.priceWorkEntries[0].reviewFingerprint }],
    expenseEntries: [{ ...ex, date: new Date(), evidence: loaded.expenseEntries[0].evidence, reviewFingerprint: loaded.expenseEntries[0].reviewFingerprint }],
  }
  // The loaded copy's fingerprints are passed in (never read from the rows).
  const trusted = r145.timesheetEntryFingerprintMap([...loaded.priceWorkEntries, ...loaded.expenseEntries])
  assert.equal(r145.timesheetEntryDecision(displayCopy, displayCopy.priceWorkEntries[0], 'priceWork', r145.timesheetTrustedFingerprint(trusted, 'P2')).decision, 'edited')
  assert.equal(r145.timesheetEntryDecision(displayCopy, displayCopy.expenseEntries[0], 'expense', r145.timesheetTrustedFingerprint(trusted, 'e2')).decision, 'approved')
  const fromStored = r145.timesheetTotals({ sheet: stored, payrollLines: [], extrasMode: 'decided' })
  const fromCopy = r145.timesheetTotals({ sheet: displayCopy, payrollLines: [], extrasMode: 'decided', entryFingerprints: trusted })
  assert.deepEqual([fromStored.priceWork, fromStored.expenses, fromStored.pendingEntries], [20, 7, 0])
  assert.deepEqual([fromCopy.priceWork, fromCopy.expenses, fromCopy.pendingEntries], [20, 7, 0])
})

test('1.45.0 review #322 F2: a reviewer save writes only the reviews it changes', () => {
  const sheetId = `timesheet_${UID145}_1762732800`
  const a = { id: 'A1', title: 'Fuel', amount: 10, date: '2026-11-10T00:00:00.000Z' }
  const b = { id: 'B1', title: 'Parking', amount: 5, date: '2026-11-10T00:00:00.000Z' }
  // Two reviews stored before 1.45.0 (no fingerprint).
  const old = (decision: string) => ({ decision, revisedAmount: null, reviewedAmount: decision === 'approved' ? 10 : 5, reviewedByUserId: 'old-lm', reviewedAtMs: 1 })
  const doc = { userId: UID145, expenseEntries: [a, b], extraEntryReviews: { A1: old('approved'), B1: old('declined') } }
  const loaded = r145.parseTimesheetEntries(sheetId, doc).expenseEntries
  const stored = r145.parseTimesheetEntryReviews(doc)
  const asInput = (row: (typeof loaded)[number], decision = row.managerDecision) => ({
    id: row.id,
    amount: row.amount,
    managerDecision: decision,
    managerRevisedAmount: row.managerRevisedAmount,
    reviewFingerprint: row.reviewFingerprint,
  })
  // Untouched: nothing written (no name, time or fingerprint stamped on old reviews).
  assert.deepEqual(r145.timesheetEntryReviewWriteFields({ stored, entries: loaded.map((row) => asInput(row)), reviewedByUserId: 'lm', reviewedAtMs: 2 }), {})
  // The reviewer changes one: only that review is written, with the stored row's fingerprint.
  const out = r145.timesheetEntryReviewWriteFields({ stored, entries: [asInput(loaded[0], 'declined'), asInput(loaded[1])], reviewedByUserId: 'lm', reviewedAtMs: 2 })
  assert.deepEqual(Object.keys(out), ['extraEntryReviews.A1'])
  assert.equal((out['extraEntryReviews.A1'] as Record<string, unknown>).reviewedFingerprint, loaded[0].reviewFingerprint)
  // A stale entry left pending is not recorded; re-approving it writes a fresh review.
  const editedDoc = { ...doc, expenseEntries: [{ ...a, amount: 12 }, b] }
  const reloaded = r145.parseTimesheetEntries(sheetId, editedDoc).expenseEntries
  assert.equal(reloaded[0].managerDecision, 'pending')
  const staleStored = r145.parseTimesheetEntryReviews(editedDoc)
  assert.deepEqual(r145.timesheetEntryReviewWriteFields({ stored: staleStored, entries: reloaded.map((row) => asInput(row)), reviewedByUserId: 'lm', reviewedAtMs: 3 }), {})
  const reapproved = r145.timesheetEntryReviewWriteFields({ stored: staleStored, entries: [asInput(reloaded[0], 'approved')], reviewedByUserId: 'lm', reviewedAtMs: 3 })
  assert.equal((reapproved['extraEntryReviews.A1'] as Record<string, unknown>).reviewedAmount, 12)
})

test('1.45.0 review #322 hardening: a reviewFingerprint stored on an entry is never trusted; reviews keep their stored key', () => {
  const sheetId = `timesheet_${UID145}_1762732800`
  const entry = { id: 'F1', title: 'Fuel', amount: 10, date: '2026-11-10T00:00:00.000Z' }
  const fingerprint = r145.timesheetEntryFingerprint(entry, 'expense')
  const review = { decision: 'approved', revisedAmount: null, reviewedAmount: 10, reviewedFingerprint: fingerprint, reviewedByUserId: 'lm', reviewedAtMs: 1 }
  // The owner edits the entry and writes the old fingerprint onto it, hoping to keep the approval.
  const forged = { ...entry, title: 'Fuel and lunch', reviewFingerprint: fingerprint }
  const doc = { userId: UID145, expenseEntries: [forged], extraEntryReviews: { F1: review }, managerSignedAt: null }
  const parsed = r145.parseTimesheetEntries(sheetId, doc).expenseEntries[0]
  assert.equal(parsed.managerDecision, 'pending')
  assert.notEqual(parsed.reviewFingerprint, fingerprint)
  assert.equal(r145.timesheetEntryDecision(doc, forged).decision, 'pending')
  assert.equal(r145.timesheetTotals({ sheet: doc, payrollLines: [], extrasMode: 'decided' }).pendingEntries, 1)
  assert.equal(r145.timesheetInvoiceRows({ sheet: doc, payrollLines: [], extrasMode: 'decided' })[0]?.amount, 10)
  // The owner's own save never stores a fingerprint on an entry.
  const ownerWrite = r145.timesheetOwnerWriteFields({ expenseEntries: [forged] }, { subjectHasLineManager: true, managerSigned: false })
  assert.equal('reviewFingerprint' in (ownerWrite.expenseEntries as Array<Record<string, unknown>>)[0], false)
  // A review stored under the id in another letter case is updated under that key, never a second one.
  const lower = { f1: { ...review, reviewedFingerprint: null } }
  const stored = r145.parseTimesheetEntryReviews({ extraEntryReviews: lower })
  const out = r145.timesheetEntryReviewWriteFields({ stored, entries: [{ id: 'F1', amount: 10, managerDecision: 'declined' as const }], reviewedByUserId: 'lm', reviewedAtMs: 2 })
  assert.deepEqual(Object.keys(out), ['extraEntryReviews.f1'])
})

test('1.45.0 packed script exports the claim evidence and timesheet evidence rules', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, unknown> } = {}
  runInContext(source, createContext(sandbox))
  const packed = sandbox.ProjectPlannerCanonical
  assert.ok(packed)
  for (const name of [
    'timesheetOwnerEntriesError',
    'canEditTimesheetEntry',
    'timesheetEntryEvidenceToDelete',
    'timesheetEvidencePages',
    'timesheetEntryEvidenceWriteFields',
    'timesheetEvidenceOwnerIds',
    'timesheetOwnerTouchedEntries',
    'claimEvidenceCountText',
    'claimEvidenceRemoved',
    'claimEvidenceListError',
    'parsePayeClaimEvidence',
    'payeClaimEvidencePath',
    'canEditPayeClaim',
    'priceWorkUpdateWriteFields',
    'expenseUpdateWriteFields',
    'payeClaimEditDraft',
    'timesheetEntryFingerprint',
    'timesheetEntryFingerprintMap',
    'timesheetTrustedFingerprint',
  ]) {
    assert.equal(typeof packed[name], 'function', name)
  }
  assert.equal(packed.EXPENSE_AMOUNT_LABEL, 'Amount inc VAT')
  assert.equal(packed.CLAIM_EVIDENCE_ADD_SITE_AUDIT_LABEL, 'Add site audit')
})

// MARK: - 1.44.0: one level for every role shape (lineManagers `levelOf` = `permissionLevelOf`)

test('1.44.0 levelOf: a flagless person is manager level whatever the role shape; operative and admin flags win', () => {
  const base = { email: '', isActive: true, passwordSet: true, organizationId: 'org1' }
  const noFlags = { isAdmin: false, isSuperAdmin: false, isManager: false, isOperativeMode: false }
  const roster = [
    { ...base, id: 'obj-flagless', firstName: 'Obj', surname: 'Flagless', email: 'obj@example.com', role: { ...noFlags } },
    { ...base, id: 'member', firstName: 'Mem', surname: 'Ber', email: 'mem@example.com', role: 'member' },
    { ...base, id: 'none', firstName: 'No', surname: 'Role', email: 'none@example.com' },
    { ...base, id: 'obj-mgr', firstName: 'Obj', surname: 'Manager', email: 'objm@example.com', role: { ...noFlags, isManager: true } },
    { ...base, id: 'obj-op', firstName: 'Obj', surname: 'Op', email: 'objop@example.com', role: { ...noFlags, isOperativeMode: true } },
    { ...base, id: 'flag-op', firstName: 'Flag', surname: 'Op', email: 'flagop@example.com', operativeMode: true },
    { ...base, id: 'str-op', firstName: 'Str', surname: 'Op', email: 'strop@example.com', role: 'operative' },
    { ...base, id: 'obj-admin', firstName: 'Obj', surname: 'Admin', email: 'obja@example.com', role: { ...noFlags, isAdmin: true } },
    { ...base, id: 'obj-super', firstName: 'Obj', surname: 'Super', email: 'objs@example.com', role: { ...noFlags, isSuperAdmin: true } },
    { ...base, id: 'flag-admin', firstName: 'Flag', surname: 'Admin', email: 'flaga@example.com', adminAccess: true },
  ]
  const levels = Object.fromEntries(
    R112.lineManagerCandidates(null, roster as never).map((c: { id: string; level: string }) => [c.id, c.level])
  )
  assert.deepEqual(levels, {
    'obj-flagless': 'manager',
    member: 'manager',
    none: 'manager',
    'obj-mgr': 'manager',
    'obj-admin': 'admin',
    'obj-super': 'admin',
    'flag-admin': 'admin',
  })
  // The same people on the job manager picker.
  assert.deepEqual(
    R112.jobManagerCandidates(roster as never).map((c: { id: string }) => c.id).sort(),
    Object.keys(levels).sort()
  )
  // The same line managers count for `lineManagerIds` (flagless object role was already a line manager there).
  const report = { id: 'r1', email: 'r1@example.com', assignedManagerUserIds: ['obj-flagless'] }
  assert.deepEqual(R112.lineManagerIds(report, roster as never), ['obj-flagless'])
  // A ghost may be given a flagless legacy manager whichever roster shape the app passes (stored rows or resolved roles).
  const draft = { firstName: 'Ghost', surname: 'Person', dayRate: 150, payBasis: 'day' as const, lineManagerIds: ['obj-flagless'] }
  assert.equal(R112.ghostCreateError(draft, { roster: roster as never }), null)
  assert.equal(R112.ghostCreateError({ ...draft, lineManagerIds: ['member'] }, { roster: roster as never }), null)
  assert.equal(R112.ghostCreateError({ ...draft, lineManagerIds: ['obj-op'] }, { roster: roster as never }), R112.GHOST_LINE_MANAGER_INVALID_MESSAGE)
})

test('1.44.0 linkBookingPersonImpact: lists what else a link brings and asks for a tick when pay may change', () => {
  assert.deepEqual(R112.linkBookingPersonImpact({}), { parts: [], alsoText: null, requiresPayAck: false })
  assert.deepEqual(R112.linkBookingPersonImpact({ rateHistoryRows: 2, leaveRecords: 1 }), {
    parts: ['2 pay-rate history rows', '1 leave record'],
    alsoText: 'Also linked: 2 pay-rate history rows, 1 leave record. Pay for unsigned timesheets may change.',
    requiresPayAck: true,
  })
  const noPay = R112.linkBookingPersonImpact({ timesheets: 1, overtimeRequests: 3, priceWorkItems: 1, expenseItems: 2, rateHistoryRows: 0 })
  assert.equal(noPay.alsoText, 'Also linked: 1 timesheet, 3 overtime requests, 1 price work item, 2 expenses.')
  assert.equal(noPay.requiresPayAck, false)
  assert.equal(R112.LINK_BOOKING_PERSON_PAY_ACK_LABEL, 'I understand pay may change')
})

// MARK: - Rulebook 1.46.0 (rates audit): Edit hours re-prices the booking; revised amounts in pennies; weekly report per booking

const RATES146_POLICY = {
  ...R112.DEFAULT_PAYROLL_POLICY,
  standardDayStart: '07:00',
  standardDayEnd: '16:00',
  unpaidBreakMinutes: 30,
  breakWindowStart: '12:00',
  breakWindowEnd: '12:30',
  breakPaid: false,
  paidHoursDerived: true,
  standardPaidHours: 8.5,
}

test('1.46.0: revisedPayrollLineAmounts — owner case 07:00–16:00 edited to 07:00–19:00, ×2, £250 a day = 426.47', () => {
  const base = {
    dayKey: '2026-11-18',
    timeZone: 'Europe/London',
    policy: RATES146_POLICY,
    startTime: '07:00',
    endTime: '19:00',
    otMultiplierOverride: 2,
    payBasis: 'day',
    dayRate: 250,
  }
  // No overtime line on the sheet: the standard line carries the overtime.
  const one = R112.revisedPayrollLineAmounts({ ...base, bookingHasOvertimeLine: false })
  assert.equal(one.standardHours, 8.5)
  assert.equal(one.overtimeHours, 3)
  assert.equal(one.overtimeMultiplier, 2)
  assert.equal(one.standardAmount, 250)
  assert.equal(one.overtimeAmount, 176.47)
  assert.equal(one.standardLineAmount, 426.47)
  assert.equal(one.overtimeLineAmount, null)
  assert.equal(one.total, 426.47)
  // With its own overtime line: each line its own part.
  const two = R112.revisedPayrollLineAmounts({ ...base, bookingHasOvertimeLine: true })
  assert.equal(two.standardLineAmount, 250)
  assert.equal(two.overtimeLineAmount, 176.47)
  assert.equal(two.total, 426.47)
  // Hourly £30: 8.5 × 30 + 3 × 2 × 30 = 435.
  assert.equal(R112.revisedPayrollLineAmounts({ ...base, payBasis: 'hourly', dayRate: null, hourlyRate: 30, bookingHasOvertimeLine: false }).total, 435)
  // The same as the collector's pricing of a booking with those times (payrollHoursResult + payForHours).
  const hours = R112.payrollHoursResult({
    booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '19:00', otMultiplierOverride: 2 },
    dayKey: '2026-11-18',
    policy: RATES146_POLICY,
    timeZone: 'Europe/London',
  })
  const std = R112.payForHours({ payBasis: 'day', dayRate: 250, paidHours: hours.standardHours, standardDayHours: 8.5 })
  const ot = R112.payForHours({ payBasis: 'day', dayRate: 250, paidHours: hours.outsideHours, standardDayHours: 8.5, otMultiplier: hours.outsideMultiplier })
  assert.equal(R112.roundPennies(std + ot), one.total)
})

test('1.46.0: revisedPayrollLineAmounts reads the policy in effect that day from the state, and keeps the overtime-line cut-off', () => {
  const state = { current: RATES146_POLICY, prior: R112.DEFAULT_PAYROLL_POLICY, effectiveFrom: '2026-11-01', scheduled: null }
  const before = R112.revisedPayrollLineAmounts({
    dayKey: '2026-10-21',
    timeZone: 'Europe/London',
    policyState: state,
    startTime: '07:30',
    endTime: '16:00',
    payBasis: 'day',
    dayRate: 200,
    bookingHasOvertimeLine: false,
  })
  // The default policy (07:30–16:00, 8 paid hours) was in effect then: a full day.
  assert.equal(before.total, 200)
  // 07:00–16:02 under the owner policy: 2 minutes of overtime is below the collector's 0.05h line cut-off.
  const tiny = R112.revisedPayrollLineAmounts({
    dayKey: '2026-11-18',
    timeZone: 'Europe/London',
    policy: RATES146_POLICY,
    startTime: '07:00',
    endTime: '16:02',
    payBasis: 'day',
    dayRate: 250,
    bookingHasOvertimeLine: false,
    overtimeLineMinHours: 0.05,
  })
  assert.equal(tiny.overtimeAmount, 0)
  assert.equal(tiny.total, 250)
})

test('1.46.0: a revised amount counts in pennies on the invoice, in the totals and in the effective amount', () => {
  const lines = [
    { id: 'op-a-normal', amount: 100, dayKey: '2026-11-16', isOvertimeLine: false },
    { id: 'op-b-normal', amount: 100, dayKey: '2026-11-17', isOvertimeLine: false },
  ]
  const sheet = {
    managerSignedAt: '2026-11-20T10:00:00Z',
    payrollLineReviews: {
      'op-a-normal': { decision: 'edited', revisedAmount: 176.47058823529 },
      'op-b-normal': { decision: 'edited', revisedAmount: 10.006 },
    },
  }
  const rows = R112.timesheetInvoiceRows({ sheet, payrollLines: lines, extrasMode: 'decided' })
  assert.deepEqual(rows.map((row) => row.amount), [176.47, 10.01])
  const totals = R112.timesheetTotals({ sheet, payrollLines: lines, extrasMode: 'decided' })
  assert.equal(totals.labour, R112.roundPennies(176.47 + 10.01))
  assert.equal(R112.timesheetEntryEffectiveAmount('edited', 176.47058823529, 100), 176.47)
  // A signed snapshot's edited row stored unrounded is read in pennies (never re-priced).
  const signed = R112.timesheetInvoiceRows({
    sheet: { weeklyReportOverride: { lines: [{ id: 'op-a-normal', amount: 176.47058823529, decision: 'edited' }, { id: 'op-b-normal', amount: 99.999, decision: 'agreed' }] } },
    payrollLines: lines,
    extrasMode: 'decided',
  })
  assert.deepEqual(signed.map((row) => row.amount), [176.47, 99.999])
})

test("1.46.0: bookingPaySlices + mergeBookingPaySlice sum each booking's pennies (never re-price summed hours)", () => {
  // Three days of 1h overtime at ×1.5 on a £250 / 8.5h day: 44.12 each → 132.36 (one price of 3h would be 132.35).
  const hours = R112.payrollHoursResult({
    booking: { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '17:00', otMultiplierOverride: 1.5 },
    dayKey: '2026-11-18',
    policy: RATES146_POLICY,
    timeZone: 'Europe/London',
  })
  const slices = R112.bookingPaySlices({ hours, standardDayHours: 8.5, payBasis: 'day', dayRate: 250 })
  assert.equal(slices.length, 2)
  const ot = slices.find((slice) => slice.isOvertime)!
  assert.equal(ot.paidHours, 1)
  assert.equal(ot.pay, 44.12)
  assert.equal(ot.rate, 375)
  let row = { ...ot }
  row = R112.mergeBookingPaySlice(row, ot)
  row = R112.mergeBookingPaySlice(row, ot)
  assert.equal(row.paidHours, 3)
  assert.equal(row.pay, 132.36)
  assert.equal(R112.payForHours({ payBasis: 'day', dayRate: 250, paidHours: 3, standardDayHours: 8.5, otMultiplier: 1.5 }), 132.35)
  // A PAYE day keeps its hours and pays 0.
  const paye = R112.bookingPaySlices({ hours, standardDayHours: 8.5, payBasis: 'day', dayRate: 250, isPaye: true })
  assert.deepEqual(paye.map((slice) => [slice.pay, slice.rate]), [[0, null], [0, null]])
})

test('1.46.0: the packed iOS script gives the owner case 426.47 end to end (Edit hours → review → invoice and totals)', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: never[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const bundle = sandbox.ProjectPlannerCanonical as unknown as typeof R112
  assert.ok(bundle)
  const edit = bundle.revisedPayrollLineAmounts({
    dayKey: '2026-11-18',
    timeZone: 'Europe/London',
    policy: RATES146_POLICY,
    startTime: '07:00',
    endTime: '19:00',
    otMultiplierOverride: 2,
    payBasis: 'day',
    dayRate: 250,
    bookingHasOvertimeLine: false,
    overtimeLineMinHours: 0.05,
  })
  assert.equal(edit.standardLineAmount, 426.47)
  const sheet = { managerSignedAt: '2026-11-20T10:00:00Z', payrollLineReviews: { 'op-b1-normal': { decision: 'edited', revisedAmount: edit.standardLineAmount } } }
  const lines = [{ id: 'op-b1-normal', amount: 250, dayKey: '2026-11-18', isOvertimeLine: false }]
  assert.equal(JSON.stringify(bundle.timesheetInvoiceRows({ sheet, payrollLines: lines, extrasMode: 'decided' }).map((row) => row.amount)), '[426.47]')
  assert.equal(bundle.timesheetTotals({ sheet, payrollLines: lines, extrasMode: 'decided' }).total, 426.47)
  assert.equal(typeof bundle.bookingPaySlices, 'function')
  assert.equal(typeof bundle.mergeBookingPaySlice, 'function')
})

// MARK: - 1.46.0 independent review fixes

function rates146Edit(extra: Record<string, unknown> = {}) {
  const fp = R112.overtimeBookingFingerprint({ id: 'b1', personId: '', dayKey: '2026-11-18', timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '16:00', otMultiplierOverride: 2 })
  const edit = R112.revisedPayrollLineAmounts({
    dayKey: '2026-11-18',
    timeZone: 'Europe/London',
    policy: RATES146_POLICY,
    startTime: '07:00',
    endTime: '19:00',
    otMultiplierOverride: 2,
    payBasis: 'day',
    dayRate: 250,
    bookingHasOvertimeLine: false,
    overtimeLineMinHours: 0.05,
    bookingFingerprint: fp,
    ...extra,
  })!
  return { fp, edit }
}

test('1.46.0 review: an Edit hours review is stale once the booking changes — never paid twice (602.94 → 426.47)', () => {
  const { fp, edit } = rates146Edit()
  const sheet = {
    managerSignedAt: '2026-11-20T10:00:00Z',
    payrollLineReviews: { 'op-b1-normal': { decision: 'edited', ...edit.reviewFields.standard } },
  }
  // Booking unchanged (07:00–16:00, no overtime line): the review pays 426.47.
  const before = [{ id: 'op-b1-normal', bookingId: 'op-b1', amount: 250, paidHours: 8.5, dayKey: '2026-11-18', isOvertimeLine: false, bookingPaidHours: 8.5, bookingOvertimeHours: 0, bookingFingerprint: fp }]
  assert.equal(R112.timesheetTotals({ sheet, payrollLines: before, extrasMode: 'decided' }).total, 426.47)
  // The booking is then changed to 07:00–19:00: the collector adds an overtime line; the review is stale.
  const fp2 = R112.overtimeBookingFingerprint({ id: 'b1', personId: '', dayKey: '2026-11-18', timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '19:00', otMultiplierOverride: 2 })
  const after = [
    { id: 'op-b1-normal', bookingId: 'op-b1', amount: 250, paidHours: 8.5, dayKey: '2026-11-18', isOvertimeLine: false, bookingPaidHours: 14.5, bookingOvertimeHours: 3, bookingFingerprint: fp2 },
    { id: 'op-b1-ot', bookingId: 'op-b1', amount: 176.47, paidHours: 3, otMultiplier: 2, dayKey: '2026-11-18', isOvertimeLine: true, bookingFingerprint: fp2 },
  ]
  const totals = R112.timesheetTotals({ sheet, payrollLines: after, extrasMode: 'decided' })
  assert.equal(totals.total, 426.47)
  assert.equal(R112.timesheetInvoiceRows({ sheet, payrollLines: after, extrasMode: 'decided' }).length, 2)
  assert.equal(R112.payrollLineReview(sheet, 'op-b1-normal', after[0]), null)
  // A review stored before 1.46.0 (no fingerprint) keeps today's behaviour.
  assert.equal(R112.payrollLineReview({ payrollLineReviews: { x: { decision: 'edited', revisedAmount: 10 } } }, 'x', { bookingFingerprint: 'other' })?.revisedAmount, 10)
})

test('1.46.0 review: an edited line shows its own hours and money split — 8.5h + 3h × 2, £250 + £176.47', () => {
  const { fp, edit } = rates146Edit()
  const sheet = { payrollLineReviews: { 'op-b1-normal': { decision: 'edited', ...edit.reviewFields.standard } } }
  assert.deepEqual(
    { ...edit.reviewFields.standard },
    {
      revisedAmount: 426.47,
      revisedStandardHours: 8.5,
      revisedOvertimeHours: 3,
      revisedOvertimeClockHours: 3,
      revisedOvertimeMultiplier: 2,
      revisedStandardAmount: 250,
      revisedOvertimeAmount: 176.47,
      reviewedBookingFingerprint: fp,
    }
  )
  const lines = [{ id: 'op-b1-normal', bookingId: 'op-b1', amount: 250, paidHours: 8.5, dayKey: '2026-11-18', isOvertimeLine: false, bookingPaidHours: 8.5, bookingOvertimeHours: 0, bookingFingerprint: fp }]
  const totals = R112.timesheetTotals({ sheet, payrollLines: lines, extrasMode: 'decided', applyLabourReviews: true })
  assert.equal(totals.standardHours, 8.5)
  assert.equal(totals.overtimeHours, 3)
  assert.equal(totals.hours, 14.5)
  assert.equal(totals.standardLabour, 250)
  assert.equal(totals.overtimeLabour, 176.47)
  // The signed snapshot gets two lines: the standard line and the booking's overtime line at ×2.
  const parts = R112.payrollLineReviewSnapshotParts(lines[0], R112.payrollLineReview(sheet, 'op-b1-normal', lines[0]))
  assert.equal(
    JSON.stringify(parts),
    JSON.stringify([
      { id: 'op-b1-normal', isOvertime: false, paidHours: 8.5, otMultiplier: null, amount: 250 },
      { id: 'op-b1-ot', isOvertime: true, paidHours: 3, otMultiplier: 2, amount: 176.47 },
    ])
  )
  // An older review without hours: no parts (the caller keeps today's line).
  assert.equal(R112.payrollLineReviewSnapshotParts(lines[0], { decision: 'edited', revisedAmount: 300 }), null)
})

test('1.46.0 review: blank times or a start equal to the finish are never priced', () => {
  for (const [start, end] of [['', '19:00'], ['07:00', ''], ['07:00', '07:00'], ['7', '19:00'], ['25:00', '19:00']]) {
    assert.equal(rates146Edit({ startTime: start, endTime: end }).edit, null)
    assert.equal(R112.revisedPayrollLineTimesError(start, end), R112.PAYROLL_LINE_EDIT_TIMES_MESSAGE)
  }
  assert.equal(R112.revisedPayrollLineTimesError('22:00', '06:00'), null)
  assert.ok(rates146Edit({ startTime: '22:00', endTime: '06:00' }).edit.total > 0)
})

test('1.46.0 review: the overtime-line cut-off applies with an overtime line too; a PAYE day pays 0', () => {
  const tiny = rates146Edit({ endTime: '16:02', bookingHasOvertimeLine: true }).edit
  assert.equal(tiny.overtimeHours, 0)
  assert.equal(tiny.overtimeLineAmount, 0)
  assert.equal(tiny.standardLineAmount, 250)
  const paye = rates146Edit({ employment: { employmentType: 'paye' } }).edit
  assert.equal(paye.isPayeDay, true)
  assert.equal(paye.total, 0)
  assert.equal(paye.standardHours, 8.5)
  assert.equal(paye.overtimeHours, 3)
  assert.equal(rates146Edit({ employment: { employmentType: 'self_employed' } }).edit.total, 426.47)
})

test('1.46.0 review: the packed iOS script makes a changed booking stale (426.47, never 602.94) and refuses blank times', () => {
  const source = readFileSync(new URL('./dist/canonical-business.js', import.meta.url), 'utf8')
  const sandbox: { ProjectPlannerCanonical?: Record<string, (...args: never[]) => unknown> } = {}
  runInContext(source, createContext(sandbox))
  const bundle = sandbox.ProjectPlannerCanonical as unknown as typeof R112
  const fp = bundle.overtimeBookingFingerprint({ id: 'b1', personId: '', dayKey: '2026-11-18', timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '16:00', otMultiplierOverride: 2 })
  const fp2 = bundle.overtimeBookingFingerprint({ id: 'b1', personId: '', dayKey: '2026-11-18', timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '19:00', otMultiplierOverride: 2 })
  const base = { dayKey: '2026-11-18', timeZone: 'Europe/London', policy: RATES146_POLICY, otMultiplierOverride: 2, payBasis: 'day', dayRate: 250, bookingHasOvertimeLine: false, overtimeLineMinHours: 0.05, bookingFingerprint: fp }
  const edit = bundle.revisedPayrollLineAmounts({ ...base, startTime: '07:00', endTime: '19:00' })!
  const sheet = { managerSignedAt: '2026-11-20T10:00:00Z', payrollLineReviews: { 'op-b1-normal': { decision: 'edited', ...edit.reviewFields.standard } } }
  const after = [
    { id: 'op-b1-normal', bookingId: 'op-b1', amount: 250, paidHours: 8.5, dayKey: '2026-11-18', isOvertimeLine: false, bookingFingerprint: fp2 },
    { id: 'op-b1-ot', bookingId: 'op-b1', amount: 176.47, paidHours: 3, otMultiplier: 2, dayKey: '2026-11-18', isOvertimeLine: true, bookingFingerprint: fp2 },
  ]
  assert.equal(bundle.timesheetTotals({ sheet, payrollLines: after, extrasMode: 'decided' }).total, 426.47)
  assert.equal(bundle.revisedPayrollLineAmounts({ ...base, startTime: '07:00', endTime: '07:00' }), null)
  assert.equal(bundle.revisedPayrollLineAmounts({ ...base, startTime: '', endTime: '19:00' }), null)
})

test('1.46.0 review 2: a standard-line review carrying overtime is stale once the booking has its own overtime line (working-hours change)', () => {
  const { fp, edit } = rates146Edit()
  const sheet = { managerSignedAt: '2026-11-20T10:00:00Z', payrollLineReviews: { 'op-b1-normal': { decision: 'edited', ...edit.reviewFields.standard } } }
  // Same booking (same fingerprint), but a working-hours change now gives it an overtime line of its own.
  const lines = [
    { id: 'op-b1-normal', bookingId: 'op-b1', amount: 250, paidHours: 8.5, dayKey: '2026-11-18', isOvertimeLine: false, bookingFingerprint: fp },
    { id: 'op-b1-ot', bookingId: 'op-b1', amount: 176.47, paidHours: 3, otMultiplier: 2, dayKey: '2026-11-18', isOvertimeLine: true, bookingFingerprint: fp },
  ]
  const totals = R112.timesheetTotals({ sheet, payrollLines: lines, extrasMode: 'decided' })
  assert.equal(totals.total, 426.47) // was 602.94
  assert.equal(totals.hours, 14.5)
  assert.equal(R112.payrollLineReview(sheet, 'op-b1-normal', { bookingFingerprint: fp, bookingHasOvertimeLine: true }), null)
  assert.ok(R112.payrollLineReview(sheet, 'op-b1-normal', { bookingFingerprint: fp, bookingHasOvertimeLine: false }))
})

test('1.46.0 review 2: a declined line of an edited booking counts no hours', () => {
  const now = R112.overtimeBookingFingerprint({ id: 'b1', personId: '', dayKey: '2026-11-18', timeSlot: 'CUSTOM_HOURS', workStartTime: '07:00', workEndTime: '19:00', otMultiplierOverride: 2 })
  const edit = R112.revisedPayrollLineAmounts({
    dayKey: '2026-11-18', timeZone: 'Europe/London', policy: RATES146_POLICY, startTime: '07:00', endTime: '17:00', otMultiplierOverride: 2,
    payBasis: 'day', dayRate: 250, bookingHasOvertimeLine: true, overtimeLineMinHours: 0.05, bookingFingerprint: now,
  })!
  const sheet = {
    managerSignedAt: '2026-11-20T10:00:00Z',
    payrollLineReviews: { 'op-b1-normal': { decision: 'edited', ...edit.reviewFields.standard }, 'op-b1-ot': { decision: 'declined' } },
  }
  const lines = [
    { id: 'op-b1-normal', bookingId: 'op-b1', amount: 250, paidHours: 8.5, dayKey: '2026-11-18', isOvertimeLine: false, bookingFingerprint: now },
    { id: 'op-b1-ot', bookingId: 'op-b1', amount: 176.47, paidHours: 3, otMultiplier: 2, dayKey: '2026-11-18', isOvertimeLine: true, bookingFingerprint: now },
  ]
  const totals = R112.timesheetTotals({ sheet, payrollLines: lines, extrasMode: 'decided' })
  assert.equal(totals.total, 250)
  assert.equal(totals.hours, 8.5)
  assert.equal(totals.overtimeHours, 0)
})

test('1.46.0 review 3: payrollLineBookingKey keeps two collections apart; payrollLineReviewKey identifies a review', () => {
  assert.notEqual(
    R112.payrollLineBookingKey({ id: 'x-normal', bookingId: 'B1', bookingCollection: 'bookings' }),
    R112.payrollLineBookingKey({ id: 'y-normal', bookingId: 'b1', bookingCollection: 'managerSiteBookings' })
  )
  assert.equal(R112.payrollLineBookingKey({ id: 'op-b1-ot' }), R112.payrollLineBookingKey({ id: 'OP-B1-normal' }))
  assert.equal(R112.payrollLineReviewKey(null), '')
  const { edit } = rates146Edit()
  const sheet = { payrollLineReviews: { a: { decision: 'edited', ...edit.reviewFields.standard }, b: { decision: 'edited', ...edit.reviewFields.standard, revisedAmount: 1 } } }
  assert.notEqual(R112.payrollLineReviewKey(R112.payrollLineReview(sheet, 'a')), R112.payrollLineReviewKey(R112.payrollLineReview(sheet, 'b')))
  // A labour booking and a manager site booking sharing an id: only the labour booking has an overtime line, so a
  // review on the manager site booking's standard line is not made stale by it.
  const fp = 'fp'
  const review = { payrollLineReviews: { 'mgr-normal': { decision: 'edited', ...edit.reviewFields.standard, reviewedBookingFingerprint: fp } }, managerSignedAt: '2026-11-20T10:00:00Z' }
  const lines = [
    { id: 'mgr-normal', bookingId: 'b1', bookingCollection: 'managerSiteBookings', amount: 250, paidHours: 8.5, dayKey: '2026-11-18', isOvertimeLine: false, bookingFingerprint: fp },
    { id: 'op-ot', bookingId: 'b1', bookingCollection: 'bookings', amount: 10, paidHours: 1, otMultiplier: 2, dayKey: '2026-11-18', isOvertimeLine: true },
  ]
  assert.equal(R112.timesheetInvoiceRows({ sheet: review, payrollLines: lines, extrasMode: 'decided' })[0].amount, 426.47)
})

test('1.46.0 review 4: payrollLineBookingKey reads a missing collection as labour (mgr- ids as manager site)', () => {
  assert.equal(
    R112.payrollLineBookingKey({ id: 'op-b1-normal', bookingId: 'op-b1' }),
    R112.payrollLineBookingKey({ id: 'op-b1-ot', bookingId: 'op-b1', bookingCollection: 'bookings' })
  )
  assert.equal(
    R112.payrollLineBookingKey({ id: 'mgr-b1-normal', bookingId: 'mgr-b1' }),
    R112.payrollLineBookingKey({ id: 'mgr-b1-ot', bookingId: 'mgr-b1', bookingCollection: 'managerSiteBookings' })
  )
  // A partly-filled pair still groups, so the overtime-line staleness check applies (426.47, never 602.94).
  const { fp, edit } = rates146Edit()
  const sheet = { managerSignedAt: '2026-11-20T10:00:00Z', payrollLineReviews: { 'op-b1-normal': { decision: 'edited', ...edit.reviewFields.standard } } }
  const lines = [
    { id: 'op-b1-normal', bookingId: 'op-b1', amount: 250, paidHours: 8.5, dayKey: '2026-11-18', isOvertimeLine: false, bookingFingerprint: fp },
    { id: 'op-b1-ot', bookingId: 'op-b1', bookingCollection: 'bookings', amount: 176.47, paidHours: 3, otMultiplier: 2, dayKey: '2026-11-18', isOvertimeLine: true, bookingFingerprint: fp },
  ]
  assert.equal(R112.timesheetTotals({ sheet, payrollLines: lines, extrasMode: 'decided' }).total, 426.47)
})

test('1.46.0 review 5: a signed sheet keeps its invoice and totals after a back-dated change to PAYE', () => {
  const sheet = {
    managerSignedAt: '2026-11-20T10:00:00Z',
    weeklyReportOverride: {
      lines: [
        { id: 'op-b1-normal', amount: 250, decision: 'approved', isOvertime: false, date: '2026-11-18T00:00:00Z' },
        { id: 'op-b1-ot', amount: 176.47, decision: 'edited', isOvertime: true, date: '2026-11-18T00:00:00Z' },
      ],
      priceWork: [{ id: 'P1', amount: 30, date: '2026-11-18T00:00:00Z' }],
      expenses: [],
    },
  }
  const before = R112.timesheetTotals({ sheet, payrollLines: [], extrasMode: 'decided', timesheetDays: ['2026-11-16', '2026-11-17', '2026-11-18'], timeZone: 'Europe/London' })
  assert.equal(before.total, 456.47)
  // Now PAYE from before the signed days: the live sheet counts no days and the live line is a PAYE day.
  const livePaye = [{ id: 'op-b1-normal', amount: 0, isPayeDay: true, dayKey: '2026-11-18' }]
  for (const timesheetDays of [[], ['2026-11-16']]) {
    const totals = R112.timesheetTotals({ sheet, payrollLines: livePaye, extrasMode: 'decided', timesheetDays, timeZone: 'Europe/London' })
    assert.equal(totals.total, 456.47)
    assert.equal(R112.timesheetInvoiceRows({ sheet, payrollLines: livePaye, extrasMode: 'decided', timesheetDays, timeZone: 'Europe/London' }).length, 3)
  }
  // An unsigned sheet still follows the PAYE days.
  assert.equal(R112.timesheetTotals({ sheet: {}, payrollLines: livePaye, extrasMode: 'decided', timesheetDays: [] }).total, 0)
})

test('1.46.0 cross-platform: every stored spelling of a slot gives one booking fingerprint; stored 1.29 fingerprints still match', () => {
  const base = { id: 'b1', personId: '', dayKey: '2026-11-18', workStartTime: '07:00', workEndTime: '19:00', otMultiplierOverride: 2 }
  const custom = ['CUSTOM', 'CUSTOM_HOURS', 'CUSTOM HOURS', 'custom hours', 'Custom', 'custom-hours'].map((timeSlot) => R112.overtimeBookingFingerprint({ ...base, timeSlot }))
  assert.equal(new Set(custom).size, 1)
  assert.equal(custom[0], '2026-11-18|CUSTOM_HOURS|07:00|19:00|2||confirmed')
  const full = ['FULL DAY', 'Full day', 'FULL_DAY', 'full-day'].map((timeSlot) => R112.overtimeBookingFingerprint({ ...base, timeSlot }))
  assert.equal(new Set(full).size, 1)
  assert.equal(R112.overtimeBookingFingerprint({ ...base, timeSlot: 'morning' }), R112.overtimeBookingFingerprint({ ...base, timeSlot: 'AM' }))
  // Fingerprints stored before 1.46.0 (1.29.0 overtime reviews / requests) wrote the slot with spaces, or as stored.
  for (const stored of ['2026-11-18|CUSTOM HOURS|07:00|19:00|2||confirmed', '2026-11-18|CUSTOM|07:00|19:00|2||confirmed']) {
    assert.equal(R112.overtimeFingerprintsMatch(stored, custom[0]), true)
    assert.equal(R112.overtimeLineIsStale(stored, { ...base, timeSlot: 'CUSTOM_HOURS' }), false)
    assert.equal(R112.overtimeLineIsStale(stored, { ...base, timeSlot: 'CUSTOM', workEndTime: '18:00' }), true)
  }
  assert.equal(R112.overtimeFingerprintsMatch('', ''), false)
  assert.equal(R112.overtimeFingerprintsMatch('2026-11-18|FULL DAY|||||confirmed', custom[0]), false)
})

test('1.46.0 cross-platform: an Edit hours review written on web (CUSTOM) is not stale on iOS (CUSTOM_HOURS), and the reverse', () => {
  const base = { id: 'b1', personId: '', dayKey: '2026-11-18', workStartTime: '07:00', workEndTime: '16:00', otMultiplierOverride: 2 }
  const webFp = R112.overtimeBookingFingerprint({ ...base, timeSlot: 'CUSTOM' })
  const iosFp = R112.overtimeBookingFingerprint({ ...base, timeSlot: 'CUSTOM_HOURS' })
  const { edit } = rates146Edit({ bookingFingerprint: webFp })
  const sheet = { managerSignedAt: '2026-11-20T10:00:00Z', payrollLineReviews: { 'op-b1-normal': { decision: 'edited', ...edit.reviewFields.standard } } }
  const line = { id: 'op-b1-normal', bookingId: 'op-b1', amount: 250, paidHours: 8.5, dayKey: '2026-11-18', isOvertimeLine: false }
  assert.equal(R112.timesheetTotals({ sheet, payrollLines: [{ ...line, bookingFingerprint: iosFp }], extrasMode: 'decided' }).total, 426.47)
  // A review stored with the pre-canonical form (spaces) still applies.
  const older = { ...sheet, payrollLineReviews: { 'op-b1-normal': { ...sheet.payrollLineReviews['op-b1-normal'], reviewedBookingFingerprint: '2026-11-18|CUSTOM HOURS|07:00|16:00|2||confirmed' } } }
  assert.equal(R112.timesheetTotals({ sheet: older, payrollLines: [{ ...line, bookingFingerprint: webFp }], extrasMode: 'decided' }).total, 426.47)
  // The applied-review key is the same whichever spelling the review stored.
  assert.equal(
    R112.payrollLineReviewKey(R112.payrollLineReview(sheet, 'op-b1-normal')),
    R112.payrollLineReviewKey(R112.payrollLineReview(older, 'op-b1-normal'))
  )
})
