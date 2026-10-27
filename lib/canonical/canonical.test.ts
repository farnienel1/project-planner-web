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
import {
  accountKindFromFlags,
  applyEmploymentTypeChange,
  employmentEffectiveLabel,
  employmentTypeOnDay,
  MANAGER_PERMISSION_TOGGLES,
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

test('every admin and manager sees every job and every warning; operatives and role-less accounts do not', () => {
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
  assert.equal(managerKeys.includes('projectCreated'), true)
  assert.equal(managerKeys.includes('smallWorksCreated'), false)
  assert.equal(managerKeys.includes('operativeCreated'), false)
  assert.equal(managerKeys.includes('annualLeaveRequested'), true)
  assert.equal(visibleNotificationPreferenceKeys(managerBothCatalogues).includes('smallWorksCreated'), true)
  assert.equal(visibleNotificationPreferenceKeys(managerBothCatalogues).includes('operativeCreated'), true)
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
  assert.equal(inboxNotificationVisibleToUser({ userId: '' }, 'u1'), true)
  assert.equal(unreadNotificationBadgeCount(rows, 'u1'), 3)
  assert.equal(unreadNotificationBadgeCount(rows, 'u2'), 2)
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

test('named slots: AM and PM pay half the standard day, FULL DAY the whole day, custom near a half pays the half', () => {
  assert.equal(hoursOn(WED, { timeSlot: 'AM' }).totalPaidHours, 4)
  assert.equal(hoursOn(WED, { timeSlot: 'PM' }).totalPaidHours, 4)
  assert.equal(hoursOn(WED, { timeSlot: 'FULL DAY' }).totalPaidHours, 8)
  assert.equal(hoursOn(WED, { timeSlot: 'FULL_DAY' }).totalPaidHours, 8)
  assert.equal(hoursOn(WED, { timeSlot: 'CUSTOM_HOURS', workStartTime: '07:40', workEndTime: '12:00' }).totalPaidHours, 4)
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
  const night = hoursOn(WED, { timeSlot: 'CUSTOM_HOURS', workStartTime: '22:00', workEndTime: '02:00' })
  assert.equal(night.totalPaidHours, 4)
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
