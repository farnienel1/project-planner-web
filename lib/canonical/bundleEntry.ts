/**
 * Surface evaluated by iOS JavaScriptCore.
 * Keep this list limited to pure functions. Organization epoch state is per process;
 * the iOS engine keeps its own copy inside this JavaScript context.
 */
export {
  CANONICAL_STANDARD_BREAK,
  CANONICAL_STANDARD_DAY,
  MIN_HALF_DAY_MINUTES,
  bookingBelongsToOrganization,
  coverageWindow,
  dayKeyInOrganizationZone,
  formatClockMinutes,
  halfDayWindows,
  intervalsOverlap,
  invoicingPeriod,
  mergeMinuteIntervals,
  namedSlotKind,
  normalizePaymentRunRange,
  paymentRunMonthDay,
  accessProbeFromReadError,
  chooseSessionOrganization,
  IOS_SESSION_ORGANIZATION_STORAGE_KEY,
  orgAccessProbeFromReads,
  organizationIdFromValue,
  organizationIdsMatch,
  organizationScopedKey,
  provisionalOrganizationId,
  rememberedOrganizationSurvivesSignOut,
  sessionMembershipIds,
  shouldClearRememberedOrganization,
  uniqueOrganizationIds,
  WEB_SESSION_ORGANIZATION_STORAGE_PREFIX,
  webSessionOrganizationStorageKey,
  paidHoursForNamedSlot,
  parseClockMinutes,
  slotInterval,
  standardDayCoverage,
  standardBreakWindow,
  standardDayWindow,
  subtractMinuteIntervals,
} from './engine'

export {
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
} from './warningRows'

export {
  DEFAULT_WARNINGS_SORT_DIRECTION,
  compareWarningDayKeys,
  parseWarningsSortDirection,
  sortWarningsByDate,
  warningDayKeyIsDated,
} from './warningSort'

export { leaveCoverageRows, leaveSlotKind } from './leaveCoverage'

export {
  canEditWorkCatalogue,
  canManageVariationTracker,
  canReviewUserTimesheets,
  canSeeVariations,
  canViewStaffWarnings,
  isStaffAccount,
  receivesJobNotification,
  seesEveryJob,
  seesEveryUserTimesheet,
} from './staffAccess'

export {
  DEFAULT_MATERIAL_CUT_OFF,
  DEFAULT_PAYMENT_RUN_DATE_RANGES,
  DEFAULT_WARNING_DETECTION,
  coalesceOrganizationName,
  displayOrganizationName,
  formatMaterialCutOffClock,
  invoicingToFirestore,
  materialCutOffClockMinutes,
  materialCutOffToFirestore,
  organizationNameToFirestore,
  organizationNameWriteFields,
  parseInvoicing,
  parseMaterialCutOff,
  parseOrganizationName,
  parsePaymentRunDateRanges,
  parseWarningDetection,
  paymentRunRangeToFirestore,
  paymentRunShowsMonthCoverage,
  resolveMaterialCutOffClock,
  starterCollectionShouldSeed,
  missingStarterQualificationCodes,
  validateInvoicingSettings,
  warningDetectionToFirestore,
} from './organizationSettings'

export {
  USER_DOCUMENT_FIELDS,
  USER_FORMER_IDS_FIELD,
  USER_SELF_CREATE_AGE_FIELDS,
  accountKindFromFlags,
  applyEmploymentTypeChange,
  employmentEffectiveLabel,
  employmentTypeOnDay,
  inviteMigrationFormerIdWriteFields,
  isBillableSelfEmployedDay,
  normalizeEmploymentType,
  parseFormerUserIds,
  userCreateRequiresAgeConfirmation,
} from './userProfile'

export {
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  DEVICE_PUSH_NOTIFICATION_TYPES,
  LEGACY_NOTIFICATION_PREFERENCE_ALIASES,
  NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND,
  NOTIFICATION_PREFERENCE_KEYS,
  compareInboxNotificationsByCreatedAt,
  devicePushNotificationTypes,
  inboxNotificationVisibleToUser,
  notificationDeliversDevicePush,
  notificationDestination,
  notificationPreferenceAllowsDelivery,
  notificationPreferenceCopy,
  notificationPreferenceIsVisible,
  notificationPreferenceKeyForType,
  visibleNotificationPreferenceKeys,
  parseUserNotificationPreferences,
  unreadNotificationBadgeCount,
  userNotificationPreferenceFieldPatch,
  userNotificationPreferencesToFirestore,
} from './notificationPreferences'

export {
  ANNUAL_LEAVE_ALLOWANCE_COPY,
  DEFAULT_ANNUAL_LEAVE_DAYS,
  annualLeaveBalance,
  applyRemainingOverride,
  hasAnnualLeaveAllowance,
  leaveYearBounds,
  snapLeaveDays,
} from './annualLeaveBalance'

export {
  catalogueRecordFromItem,
  materialRecordMatches,
  materialSearchScore,
  normalizeMaterialSearchText,
  rankMaterialRecords,
  tokenizeMaterialSearch,
} from './materialSearch'

export {
  QUALIFICATION_FILTER_ALL,
  QUALIFICATION_FILTER_OTHER,
  QUALIFICATION_LIBRARY_SECTIONS,
  qualificationLibraryFilterChips,
  qualificationMatchesSection,
  qualificationRecordMatches,
  qualificationSearchRecordFromItem,
  qualificationSearchScore,
  qualificationSectionChipLabel,
  rankQualificationRecords,
  tokenizeQualificationSearch,
} from './qualificationSearch'

export {
  QUALIFICATION_CERTIFICATE_STORAGE_PATH,
  assignedQualificationWriteFields,
  mergeOperativeQualificationWrite,
  mergeQualificationCertificateUrls,
  qualificationCertificateStoragePath,
  qualificationCertificateUrl,
  removedQualificationCertificateIds,
} from './operativeQualifications'

export {
  DEFAULT_MATERIAL_DELIVERY_CLOCK,
  DEFAULT_MATERIAL_DELIVERY_HOUR,
  DEFAULT_MATERIAL_DELIVERY_MINUTE,
  DEFAULT_MATERIAL_DELIVERY_MINUTES,
  clockMinutesFromDeliveryInstant,
  defaultMaterialDeliveryDayKey,
  defaultMaterialDeliveryRequiredAt,
  formatMaterialDeliveryRequired,
  materialDeliveryInstant,
  materialOrderIncludesDeliveryRequired,
} from './materialDelivery'

export {
  TIMESHEET_CLOSE_OF_PLAY_HOUR,
  TIMESHEET_CLOSE_OF_PLAY_MINUTE,
  TIMESHEET_DEADLINE_DAYS_BEFORE_PAYMENT,
  TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT,
  TIMESHEET_NOTIFY_HOUR,
  TIMESHEET_NOTIFY_MINUTE,
  TIMESHEET_SUBMISSION_NOTICE_TITLE,
  TIMESHEET_SUBMISSION_NOTICE_TYPE,
  capitalizeTimesheetWeekday,
  clampMonthDayInZone,
  defaultTimesheetSubmissionFromPaymentDay,
  defaultTimesheetSubmissionFromPaymentWeekday,
  dueTimesheetSubmissionNotices,
  monthDayOffsetBefore,
  monthDayOrdinal,
  normalizeTimesheetWeekday,
  parseTimesheetSubmissionEntry,
  parseTimesheetSubmissionList,
  paymentDateAfterPeriodEnd,
  timesheetSubmissionAfterPaymentDayChange,
  timesheetSubmissionAfterPaymentWeekdayChange,
  timesheetSubmissionNoticeCopy,
  timesheetSubmissionNoticeDedupKey,
  timesheetSubmissionToFirestore,
  weekdayOffsetBefore,
} from './timesheetSubmission'

export { PAYMENT_GRACE_MS, hasAccess } from './billingAccess'

export {
  ANONYMISED_DELETED_USER_NAME,
  DELETED_USER_DISPLAY_NAME,
  isAnonymisedDeletedProfile,
  isIdentifiablePendingLeftover,
  listedCurrentLabourPeople,
  listedRosterUsers,
  matchesRosterSegment,
  matchesUserRosterSegment,
  normalizeClaimedEmails,
  rosterPersonName,
  rosterSegment,
  rosterStatusLabel,
  userRosterSegment,
} from './userRosterSegment'

export {
  inviteEmailHasLiveClaim,
  inviteEmailOrgLookupConstraints,
  invitePlaceholderUserWriteFields,
  inviteWritesOperativeProfile,
  resolveInviteEmailClaim,
} from './inviteEmailClaim'

export {
  TIMESHEET_DOCUMENT_PREFIX,
  TIMESHEET_EXPORT_STORAGE_FOLDER,
  TIMESHEET_INVOICE_EXPORT_LEFTOVER_MS,
  TIMESHEET_SIGNED_AFTER_MS,
  isTimesheetAwaitingSignOff,
  isTimesheetExported,
  isTimesheetFullySigned,
  isTimesheetManagerSigned,
  isTimesheetOperativeSigned,
  parsePaymentRunHistory,
  parseTimesheetStatusFields,
  paymentRunHistoryAfterChange,
  paymentRunHistoryToFirestore,
  pickTimesheetRowForPeriod,
  resolveTimesheetExportedAtMs,
  resolveTimesheetPeriod,
  selectableTimesheetPaymentRunPeriods,
  timesheetBelongsToOrganization,
  timesheetDocumentId,
  timesheetExportStoragePath,
  timesheetExportWriteFields,
  timesheetListBucket,
  timesheetPaymentRunPeriodsFromWindow,
  timesheetPeriodContainsDay,
  timesheetPeriodFromInvoicing,
  timesheetPeriodKey,
  timesheetPeriodMatches,
  timesheetPeriodWriteFields,
  timesheetRequiresManagerCounterSign,
  timesheetSignOffWriteFields,
  timesheetStatusWriteFields,
  timesheetStoredStartDayKey,
  timesheetTimestampMs,
} from './timesheetPeriod'

export {
  FILE_REPORT_DETAILS_MAX,
  FILE_REPORT_FILE_NAME_MAX,
  FILE_REPORT_LINK_LABEL,
  FILE_REPORT_REASONS,
  FILE_REPORT_SENT_COPY,
  FILE_REPORT_STATUSES,
  FILE_REPORT_SURFACES,
  canReviewFileReports,
  fileReportCollectionPath,
  fileReportFileName,
  fileReportReasonCopy,
  fileReportReviewWriteFields,
  fileReportStatusCopy,
  fileReportStoragePath,
  fileReportWriteFields,
  isFileReportReason,
  isFileReportSurface,
} from './fileReports'

export {
  BOOKING_STATUSES,
  BOOKING_TIME_SLOTS,
  ORPHAN_BOOKING_LABEL,
  bookingClock,
  bookingDateMs,
  bookingHealthRows,
  bookingJobLabel,
  bookingJobState,
  bookingWriteFields,
  bookingsToRemoveOnOperativeDelete,
  bookingsToRemoveOnProjectDelete,
  isBookingUuid,
  normalizeBookingStatus,
  normalizeBookingTimeSlot,
  parseBookingDocument,
  MANAGER_LOCATION_TYPES,
  MANAGER_TIME_SLOTS,
  normalizeManagerBookingTimeSlot,
  parseManagerSiteBookingDocument,
} from './bookings'

export { bookingIdsForAccount, bookingPersonKey, resolveBookingPerson } from './bookingPerson'
export { LEGACY_PLACEHOLDER_DOCUMENT_ID, isLegacyPlaceholderDocumentId } from './bookings'

export { legalPackNeedsAcceptance } from './legalPack'

export {
  SENSITIVE_EXPORT_OPTION_LABEL,
  SENSITIVE_HELD_BY_ADMIN_COPY,
  SENSITIVE_PROFILE_DOC_ID,
  SENSITIVE_PROFILE_FIELDS,
  SENSITIVE_VALUE_MAX,
  canViewSensitiveProfile,
  exportIncludesSensitiveFields,
  maskSensitiveValue,
  resolveSensitiveProfile,
  sensitiveProfileDocPath,
  sensitiveProfileWriteFields,
} from './sensitiveProfile'
