"use strict";
var ProjectPlannerCanonical = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key2 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key2) && key2 !== except)
          __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // lib/canonical/bundleEntry.ts
  var bundleEntry_exports = {};
  __export(bundleEntry_exports, {
    ANNUAL_LEAVE_ALLOWANCE_COPY: () => ANNUAL_LEAVE_ALLOWANCE_COPY,
    ANONYMISED_DELETED_USER_NAME: () => ANONYMISED_DELETED_USER_NAME,
    BOOKING_REPLAY_REFUSED_MESSAGE: () => BOOKING_REPLAY_REFUSED_MESSAGE,
    BOOKING_STATUSES: () => BOOKING_STATUSES,
    BOOKING_TIME_SLOTS: () => BOOKING_TIME_SLOTS,
    BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT: () => BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT,
    BOOKING_TOMBSTONE_COLLECTION: () => BOOKING_TOMBSTONE_COLLECTION,
    BOOKING_TOMBSTONE_FIELDS: () => BOOKING_TOMBSTONE_FIELDS,
    CANONICAL_STANDARD_BREAK: () => CANONICAL_STANDARD_BREAK,
    CANONICAL_STANDARD_DAY: () => CANONICAL_STANDARD_DAY,
    CURRENCY_OPTIONS: () => CURRENCY_OPTIONS,
    DEFAULT_ANNUAL_LEAVE_DAYS: () => DEFAULT_ANNUAL_LEAVE_DAYS,
    DEFAULT_BANK_HOLIDAY_REGION_ID: () => DEFAULT_BANK_HOLIDAY_REGION_ID,
    DEFAULT_CURRENCY_CODE: () => DEFAULT_CURRENCY_CODE,
    DEFAULT_MATERIAL_CUT_OFF: () => DEFAULT_MATERIAL_CUT_OFF,
    DEFAULT_MATERIAL_DELIVERY_CLOCK: () => DEFAULT_MATERIAL_DELIVERY_CLOCK,
    DEFAULT_MATERIAL_DELIVERY_HOUR: () => DEFAULT_MATERIAL_DELIVERY_HOUR,
    DEFAULT_MATERIAL_DELIVERY_MINUTE: () => DEFAULT_MATERIAL_DELIVERY_MINUTE,
    DEFAULT_MATERIAL_DELIVERY_MINUTES: () => DEFAULT_MATERIAL_DELIVERY_MINUTES,
    DEFAULT_PAYMENT_RUN_DATE_RANGES: () => DEFAULT_PAYMENT_RUN_DATE_RANGES,
    DEFAULT_USER_NOTIFICATION_PREFERENCES: () => DEFAULT_USER_NOTIFICATION_PREFERENCES,
    DEFAULT_WARNINGS_SORT_DIRECTION: () => DEFAULT_WARNINGS_SORT_DIRECTION,
    DEFAULT_WARNING_DETECTION: () => DEFAULT_WARNING_DETECTION,
    DELETED_USER_DISPLAY_NAME: () => DELETED_USER_DISPLAY_NAME,
    DEVELOPER_PASSWORD_MIN_LENGTH: () => DEVELOPER_PASSWORD_MIN_LENGTH,
    DEVICE_PUSH_NOTIFICATION_TYPES: () => DEVICE_PUSH_NOTIFICATION_TYPES,
    FALLBACK_LOOKAHEAD_DAYS: () => FALLBACK_LOOKAHEAD_DAYS,
    FILE_REPORT_DETAILS_MAX: () => FILE_REPORT_DETAILS_MAX,
    FILE_REPORT_FILE_NAME_MAX: () => FILE_REPORT_FILE_NAME_MAX,
    FILE_REPORT_LINK_LABEL: () => FILE_REPORT_LINK_LABEL,
    FILE_REPORT_REASONS: () => FILE_REPORT_REASONS,
    FILE_REPORT_SENT_COPY: () => FILE_REPORT_SENT_COPY,
    FILE_REPORT_STATUSES: () => FILE_REPORT_STATUSES,
    FILE_REPORT_SURFACES: () => FILE_REPORT_SURFACES,
    HOLIDAY_REQUEST_SUBMITTED_TYPE: () => HOLIDAY_REQUEST_SUBMITTED_TYPE,
    HOLIDAY_STATUSES: () => HOLIDAY_STATUSES,
    HOLIDAY_TIME_SLOTS: () => HOLIDAY_TIME_SLOTS,
    IOS_SESSION_ORGANIZATION_STORAGE_KEY: () => IOS_SESSION_ORGANIZATION_STORAGE_KEY,
    LEGACY_NOTIFICATION_PREFERENCE_ALIASES: () => LEGACY_NOTIFICATION_PREFERENCE_ALIASES,
    LEGACY_PLACEHOLDER_DOCUMENT_ID: () => LEGACY_PLACEHOLDER_DOCUMENT_ID,
    MANAGER_LOCATION_TYPES: () => MANAGER_LOCATION_TYPES,
    MANAGER_TIME_SLOTS: () => MANAGER_TIME_SLOTS,
    MATERIAL_WHATSAPP_ITEM_LIMIT: () => MATERIAL_WHATSAPP_ITEM_LIMIT,
    MIN_HALF_DAY_MINUTES: () => MIN_HALF_DAY_MINUTES,
    NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND: () => NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND,
    NOTIFICATION_PREFERENCE_KEYS: () => NOTIFICATION_PREFERENCE_KEYS,
    NOTIFICATION_TOGGLE_HIDES_INBOX_ROW: () => NOTIFICATION_TOGGLE_HIDES_INBOX_ROW,
    ORPHAN_BOOKING_LABEL: () => ORPHAN_BOOKING_LABEL,
    OVERLAPPING_BOOKING_NOTE: () => OVERLAPPING_BOOKING_NOTE,
    PASSWORD_MIN_LENGTH: () => PASSWORD_MIN_LENGTH,
    PAYE_PAY_CELL_LABEL: () => PAYE_PAY_CELL_LABEL,
    PAYMENT_GRACE_MS: () => PAYMENT_GRACE_MS,
    PAYMENT_RUN_1_LAST_END_DAY: () => PAYMENT_RUN_1_LAST_END_DAY,
    PAYROLL_POLICY_LIMITS: () => PAYROLL_POLICY_LIMITS,
    QUALIFICATION_CERTIFICATE_STORAGE_PATH: () => QUALIFICATION_CERTIFICATE_STORAGE_PATH,
    QUALIFICATION_FILTER_ALL: () => QUALIFICATION_FILTER_ALL,
    QUALIFICATION_FILTER_OTHER: () => QUALIFICATION_FILTER_OTHER,
    QUALIFICATION_LIBRARY_SECTIONS: () => QUALIFICATION_LIBRARY_SECTIONS,
    SENSITIVE_EXPORT_OPTION_LABEL: () => SENSITIVE_EXPORT_OPTION_LABEL,
    SENSITIVE_HELD_BY_ADMIN_COPY: () => SENSITIVE_HELD_BY_ADMIN_COPY,
    SENSITIVE_PROFILE_DOC_ID: () => SENSITIVE_PROFILE_DOC_ID,
    SENSITIVE_PROFILE_FIELDS: () => SENSITIVE_PROFILE_FIELDS,
    SENSITIVE_VALUE_MAX: () => SENSITIVE_VALUE_MAX,
    TIMESHEET_CLOSE_OF_PLAY_HOUR: () => TIMESHEET_CLOSE_OF_PLAY_HOUR,
    TIMESHEET_CLOSE_OF_PLAY_MINUTE: () => TIMESHEET_CLOSE_OF_PLAY_MINUTE,
    TIMESHEET_DEADLINE_DAYS_BEFORE_PAYMENT: () => TIMESHEET_DEADLINE_DAYS_BEFORE_PAYMENT,
    TIMESHEET_DOCUMENT_PREFIX: () => TIMESHEET_DOCUMENT_PREFIX,
    TIMESHEET_ENTRY_ARRAY_FIELDS: () => TIMESHEET_ENTRY_ARRAY_FIELDS,
    TIMESHEET_ENTRY_DECISIONS: () => TIMESHEET_ENTRY_DECISIONS,
    TIMESHEET_ENTRY_REVIEWS_FIELD: () => TIMESHEET_ENTRY_REVIEWS_FIELD,
    TIMESHEET_EXPORT_STORAGE_FOLDER: () => TIMESHEET_EXPORT_STORAGE_FOLDER,
    TIMESHEET_INVOICE_EXPORT_LEFTOVER_MS: () => TIMESHEET_INVOICE_EXPORT_LEFTOVER_MS,
    TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT: () => TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT,
    TIMESHEET_NOTIFY_HOUR: () => TIMESHEET_NOTIFY_HOUR,
    TIMESHEET_NOTIFY_MINUTE: () => TIMESHEET_NOTIFY_MINUTE,
    TIMESHEET_REVIEWER_ONLY_FIELDS: () => TIMESHEET_REVIEWER_ONLY_FIELDS,
    TIMESHEET_SELF_SIGNED_OWNER_FIELDS: () => TIMESHEET_SELF_SIGNED_OWNER_FIELDS,
    TIMESHEET_SIGNED_AFTER_MS: () => TIMESHEET_SIGNED_AFTER_MS,
    TIMESHEET_SUBMISSION_NOTICE_TITLE: () => TIMESHEET_SUBMISSION_NOTICE_TITLE,
    TIMESHEET_SUBMISSION_NOTICE_TYPE: () => TIMESHEET_SUBMISSION_NOTICE_TYPE,
    TOMBSTONED_BOOKING_COLLECTIONS: () => TOMBSTONED_BOOKING_COLLECTIONS,
    USER_DOCUMENT_FIELDS: () => USER_DOCUMENT_FIELDS,
    USER_FORMER_IDS_FIELD: () => USER_FORMER_IDS_FIELD,
    USER_SELF_CREATE_AGE_FIELDS: () => USER_SELF_CREATE_AGE_FIELDS,
    WARNING_RESOLUTION_STATUSES: () => WARNING_RESOLUTION_STATUSES,
    WEB_SESSION_ORGANIZATION_STORAGE_PREFIX: () => WEB_SESSION_ORGANIZATION_STORAGE_PREFIX,
    WORKING_WEEK: () => WORKING_WEEK,
    WRITE_PLATFORMS: () => WRITE_PLATFORMS,
    acceptedClashWriteFields: () => acceptedClashWriteFields,
    accessProbeFromReadError: () => accessProbeFromReadError,
    accountKindFromFlags: () => accountKindFromFlags,
    activePaymentRunSummary: () => activePaymentRunSummary,
    annualLeaveBalance: () => annualLeaveBalance,
    applyEmploymentTypeChange: () => applyEmploymentTypeChange,
    applyRemainingOverride: () => applyRemainingOverride,
    assignedQualificationWriteFields: () => assignedQualificationWriteFields,
    bookingBelongsToOrganization: () => bookingBelongsToOrganization,
    bookingClock: () => bookingClock,
    bookingDateMs: () => bookingDateMs,
    bookingHealthRows: () => bookingHealthRows,
    bookingIdsForAccount: () => bookingIdsForAccount,
    bookingIdsForPerson: () => bookingIdsForPerson,
    bookingJobLabel: () => bookingJobLabel,
    bookingJobState: () => bookingJobState,
    bookingLoadStart: () => bookingLoadStart,
    bookingOccupiesDay: () => bookingOccupiesDay,
    bookingPersonKey: () => bookingPersonKey,
    bookingReplayRefusedIsFinal: () => bookingReplayRefusedIsFinal,
    bookingTombstonePath: () => bookingTombstonePath,
    bookingTombstoneWriteFields: () => bookingTombstoneWriteFields,
    bookingWriteFields: () => bookingWriteFields,
    bookingsToRemoveOnOperativeDelete: () => bookingsToRemoveOnOperativeDelete,
    bookingsToRemoveOnProjectDelete: () => bookingsToRemoveOnProjectDelete,
    canChangePersonPay: () => canChangePersonPay,
    canEditWorkCatalogue: () => canEditWorkCatalogue,
    canManageVariationTracker: () => canManageVariationTracker,
    canOpenUserTimesheets: () => canOpenUserTimesheets,
    canReviewFileReports: () => canReviewFileReports,
    canReviewUserTimesheets: () => canReviewUserTimesheets,
    canSeeVariations: () => canSeeVariations,
    canViewMaterialOrderHistory: () => canViewMaterialOrderHistory,
    canViewSensitiveProfile: () => canViewSensitiveProfile,
    canViewStaffWarnings: () => canViewStaffWarnings,
    capitalizeTimesheetWeekday: () => capitalizeTimesheetWeekday,
    catalogueRecordFromItem: () => catalogueRecordFromItem,
    chooseSessionOrganization: () => chooseSessionOrganization,
    clampMonthDayInZone: () => clampMonthDayInZone,
    clashApprovalWrites: () => clashApprovalWrites,
    clashPairKey: () => clashPairKey,
    clashResolutionKey: () => clashResolutionKey,
    clashScanDays: () => clashScanDays,
    clockMinutesFromDeliveryInstant: () => clockMinutesFromDeliveryInstant,
    coalesceOrganizationName: () => coalesceOrganizationName,
    companyDetailsValidationError: () => companyDetailsValidationError,
    companyDetailsWriteFields: () => companyDetailsWriteFields,
    compareInboxNotificationsByCreatedAt: () => compareInboxNotificationsByCreatedAt,
    compareWarningDayKeys: () => compareWarningDayKeys,
    coverageWindow: () => coverageWindow,
    currencyOption: () => currencyOption,
    currencySymbol: () => currencySymbol,
    dayKeyInOrganizationZone: () => dayKeyInOrganizationZone,
    defaultCurrencyForCountry: () => defaultCurrencyForCountry,
    defaultMaterialDeliveryDayKey: () => defaultMaterialDeliveryDayKey,
    defaultMaterialDeliveryRequiredAt: () => defaultMaterialDeliveryRequiredAt,
    defaultTimesheetSubmissionFromPaymentDay: () => defaultTimesheetSubmissionFromPaymentDay,
    defaultTimesheetSubmissionFromPaymentWeekday: () => defaultTimesheetSubmissionFromPaymentWeekday,
    devicePushAllowed: () => devicePushAllowed,
    devicePushNotificationTypes: () => devicePushNotificationTypes,
    displayOrganizationName: () => displayOrganizationName,
    dueTimesheetSubmissionNotices: () => dueTimesheetSubmissionNotices,
    effectivePayrollTimePolicy: () => effectivePayrollTimePolicy,
    employmentEffectiveLabel: () => employmentEffectiveLabel,
    employmentTypeOnDay: () => employmentTypeOnDay,
    enabledScheduleLocations: () => enabledScheduleLocations,
    exclusiveRates: () => exclusiveRates,
    exportIncludesSensitiveFields: () => exportIncludesSensitiveFields,
    fileReportCollectionPath: () => fileReportCollectionPath,
    fileReportFileName: () => fileReportFileName,
    fileReportReasonCopy: () => fileReportReasonCopy,
    fileReportReviewWriteFields: () => fileReportReviewWriteFields,
    fileReportStatusCopy: () => fileReportStatusCopy,
    fileReportStoragePath: () => fileReportStoragePath,
    fileReportWriteFields: () => fileReportWriteFields,
    formatClockMinutes: () => formatClockMinutes,
    formatMaterialCutOffClock: () => formatMaterialCutOffClock,
    formatMaterialDeliveryRequired: () => formatMaterialDeliveryRequired,
    formatMoney: () => formatMoney,
    formatPaymentRunDay: () => formatPaymentRunDay,
    formerIdAliases: () => formerIdAliases,
    halfDayWindows: () => halfDayWindows,
    hasAccess: () => hasAccess,
    hasAnnualLeaveAllowance: () => hasAnnualLeaveAllowance,
    historyPayRowOnDay: () => historyPayRowOnDay,
    historyRowBasis: () => historyRowBasis,
    holidayDecisionWriteFields: () => holidayDecisionWriteFields,
    holidayRequestRanges: () => holidayRequestRanges,
    holidayRequestWriteFields: () => holidayRequestWriteFields,
    inboxNotificationVisibleToUser: () => inboxNotificationVisibleToUser,
    intervalsOverlap: () => intervalsOverlap,
    inviteEmailHasLiveClaim: () => inviteEmailHasLiveClaim,
    inviteEmailOrgLookupConstraints: () => inviteEmailOrgLookupConstraints,
    inviteMigrationFormerIdWriteFields: () => inviteMigrationFormerIdWriteFields,
    invitePlaceholderUserWriteFields: () => invitePlaceholderUserWriteFields,
    inviteWritesOperativeProfile: () => inviteWritesOperativeProfile,
    invoicingPeriod: () => invoicingPeriod,
    invoicingToFirestore: () => invoicingToFirestore,
    isAnonymisedDeletedProfile: () => isAnonymisedDeletedProfile,
    isBillableSelfEmployedDay: () => isBillableSelfEmployedDay,
    isBookingUuid: () => isBookingUuid,
    isClashAccepted: () => isClashAccepted,
    isClashApproved: () => isClashApproved,
    isFileReportReason: () => isFileReportReason,
    isFileReportSurface: () => isFileReportSurface,
    isIdentifiablePendingLeftover: () => isIdentifiablePendingLeftover,
    isLegacyPlaceholderDocumentId: () => isLegacyPlaceholderDocumentId,
    isOpenBookingStatus: () => isOpenBookingStatus,
    isStaffAccount: () => isStaffAccount,
    isStandardWorkingWeekday: () => isStandardWorkingWeekday,
    isTimesheetAwaitingSignOff: () => isTimesheetAwaitingSignOff,
    isTimesheetExported: () => isTimesheetExported,
    isTimesheetFullySigned: () => isTimesheetFullySigned,
    isTimesheetManagerSigned: () => isTimesheetManagerSigned,
    isTimesheetOperativeSigned: () => isTimesheetOperativeSigned,
    isTombstonedBookingCollection: () => isTombstonedBookingCollection,
    isWarningActive: () => isWarningActive,
    isWorkLiveOn: () => isWorkLiveOn,
    labourBookingKind: () => labourBookingKind,
    labourPersonIds: () => labourPersonIds,
    leaveApproverIds: () => leaveApproverIds,
    leaveCoverageRows: () => leaveCoverageRows,
    leaveRecordDayKeys: () => leaveRecordDayKeys,
    leaveSlotKind: () => leaveSlotKind,
    leaveYearBounds: () => leaveYearBounds,
    legalPackNeedsAcceptance: () => legalPackNeedsAcceptance,
    lineManagerIds: () => lineManagerIds,
    listedCurrentLabourPeople: () => listedCurrentLabourPeople,
    listedRosterUsers: () => listedRosterUsers,
    livePayRate: () => livePayRate,
    managerClashGroups: () => managerClashGroups,
    maskSensitiveValue: () => maskSensitiveValue,
    matchesRosterSegment: () => matchesRosterSegment,
    matchesUserRosterSegment: () => matchesUserRosterSegment,
    materialCutOffClockMinutes: () => materialCutOffClockMinutes,
    materialCutOffToFirestore: () => materialCutOffToFirestore,
    materialCutOffWarningRows: () => materialCutOffWarningRows,
    materialDeliveryInstant: () => materialDeliveryInstant,
    materialLineCountsAsOrdered: () => materialLineCountsAsOrdered,
    materialOrderIncludesDeliveryRequired: () => materialOrderIncludesDeliveryRequired,
    materialOrderRecipients: () => materialOrderRecipients,
    materialQuantityLabel: () => materialQuantityLabel,
    materialRecordMatches: () => materialRecordMatches,
    materialSearchScore: () => materialSearchScore,
    materialWhatsAppRows: () => materialWhatsAppRows,
    mergeMinuteIntervals: () => mergeMinuteIntervals,
    mergeOperativeQualificationWrite: () => mergeOperativeQualificationWrite,
    mergeQualificationCertificateUrls: () => mergeQualificationCertificateUrls,
    missingStarterQualificationCodes: () => missingStarterQualificationCodes,
    monthDayOffsetBefore: () => monthDayOffsetBefore,
    monthDayOrdinal: () => monthDayOrdinal,
    namedSlotKind: () => namedSlotKind,
    normalizeBookingStatus: () => normalizeBookingStatus,
    normalizeBookingTimeSlot: () => normalizeBookingTimeSlot,
    normalizeClaimedEmails: () => normalizeClaimedEmails,
    normalizeCompanyCountryCode: () => normalizeCompanyCountryCode,
    normalizeCurrencyCode: () => normalizeCurrencyCode,
    normalizeDocumentAbbreviation: () => normalizeDocumentAbbreviation,
    normalizeEmploymentType: () => normalizeEmploymentType,
    normalizeHolidayStatus: () => normalizeHolidayStatus,
    normalizeHolidayTimeSlot: () => normalizeHolidayTimeSlot,
    normalizeManagerBookingTimeSlot: () => normalizeManagerBookingTimeSlot,
    normalizeMaterialSearchText: () => normalizeMaterialSearchText,
    normalizePaymentRunRange: () => normalizePaymentRunRange,
    normalizeTimesheetWeekday: () => normalizeTimesheetWeekday,
    notificationDeliversDevicePush: () => notificationDeliversDevicePush,
    notificationDestination: () => notificationDestination,
    notificationPreferenceAllowsDelivery: () => notificationPreferenceAllowsDelivery,
    notificationPreferenceCopy: () => notificationPreferenceCopy,
    notificationPreferenceIsVisible: () => notificationPreferenceIsVisible,
    notificationPreferenceKeyForType: () => notificationPreferenceKeyForType,
    notificationShowsInInbox: () => notificationShowsInInbox,
    orgAccessProbeFromReads: () => orgAccessProbeFromReads,
    organizationCurrencyWriteFields: () => organizationCurrencyWriteFields,
    organizationIdFromValue: () => organizationIdFromValue,
    organizationIdsMatch: () => organizationIdsMatch,
    organizationNameToFirestore: () => organizationNameToFirestore,
    organizationNameWriteFields: () => organizationNameWriteFields,
    organizationScopedKey: () => organizationScopedKey,
    organizationTimeZone: () => organizationTimeZone,
    overlappingBookingIds: () => overlappingBookingIds,
    overlappingIntervalGroups: () => overlappingIntervalGroups,
    paidHoursForNamedSlot: () => paidHoursForNamedSlot,
    parseBookingDocument: () => parseBookingDocument,
    parseClockMinutes: () => parseClockMinutes,
    parseCompanyDetails: () => parseCompanyDetails,
    parseFormerUserIds: () => parseFormerUserIds,
    parseHolidayDecisionNote: () => parseHolidayDecisionNote,
    parseInvoicing: () => parseInvoicing,
    parseManagerSiteBookingDocument: () => parseManagerSiteBookingDocument,
    parseMaterialCutOff: () => parseMaterialCutOff,
    parseOrganizationName: () => parseOrganizationName,
    parsePaymentRunDateRanges: () => parsePaymentRunDateRanges,
    parsePaymentRunHistory: () => parsePaymentRunHistory,
    parsePayrollPolicy: () => parsePayrollPolicy,
    parsePayrollTimePolicyScheduled: () => parsePayrollTimePolicyScheduled,
    parsePayrollTimePolicyState: () => parsePayrollTimePolicyState,
    parseTimesheetEntryDecision: () => parseTimesheetEntryDecision,
    parseTimesheetEntryReviews: () => parseTimesheetEntryReviews,
    parseTimesheetStatusFields: () => parseTimesheetStatusFields,
    parseTimesheetSubmissionEntry: () => parseTimesheetSubmissionEntry,
    parseTimesheetSubmissionList: () => parseTimesheetSubmissionList,
    parseUserNotificationPreferences: () => parseUserNotificationPreferences,
    parseWarningDetection: () => parseWarningDetection,
    parseWarningsSortDirection: () => parseWarningsSortDirection,
    passwordMinLength: () => passwordMinLength,
    passwordPolicyError: () => passwordPolicyError,
    payRateOnDay: () => payRateOnDay,
    paymentDateAfterPeriodEnd: () => paymentDateAfterPeriodEnd,
    paymentRunHistoryAfterChange: () => paymentRunHistoryAfterChange,
    paymentRunHistoryToFirestore: () => paymentRunHistoryToFirestore,
    paymentRunLabel: () => paymentRunLabel,
    paymentRunMonthDay: () => paymentRunMonthDay,
    paymentRunPayDate: () => paymentRunPayDate,
    paymentRunRangeToFirestore: () => paymentRunRangeToFirestore,
    paymentRunShowsMonthCoverage: () => paymentRunShowsMonthCoverage,
    paymentWeekdayAfterPeriodEnd: () => paymentWeekdayAfterPeriodEnd,
    payrollDayKeyFromValue: () => payrollDayKeyFromValue,
    payrollHoursResult: () => payrollHoursResult,
    payrollOutsideMultiplier: () => payrollOutsideMultiplier,
    payrollTimePolicyApplyNowWriteFields: () => payrollTimePolicyApplyNowWriteFields,
    payrollTimePolicyCancelScheduleWriteFields: () => payrollTimePolicyCancelScheduleWriteFields,
    payrollTimePolicyForDayFromState: () => payrollTimePolicyForDayFromState,
    payrollTimePolicyScheduleDateError: () => payrollTimePolicyScheduleDateError,
    payrollTimePolicyScheduleWriteFields: () => payrollTimePolicyScheduleWriteFields,
    payrollTimePolicyTimeline: () => payrollTimePolicyTimeline,
    personDayItems: () => personDayItems,
    pickTimesheetRowForPeriod: () => pickTimesheetRowForPeriod,
    provisionalOrganizationId: () => provisionalOrganizationId,
    qualificationCertificateStoragePath: () => qualificationCertificateStoragePath,
    qualificationCertificateUrl: () => qualificationCertificateUrl,
    qualificationDismissKey: () => qualificationDismissKey,
    qualificationExpiryRows: () => qualificationExpiryRows,
    qualificationLibraryFilterChips: () => qualificationLibraryFilterChips,
    qualificationMatchesSection: () => qualificationMatchesSection,
    qualificationRecordMatches: () => qualificationRecordMatches,
    qualificationSearchRecordFromItem: () => qualificationSearchRecordFromItem,
    qualificationSearchScore: () => qualificationSearchScore,
    qualificationSectionChipLabel: () => qualificationSectionChipLabel,
    rankMaterialRecords: () => rankMaterialRecords,
    rankQualificationRecords: () => rankQualificationRecords,
    readStoredRates: () => readStoredRates,
    receivesJobNotification: () => receivesJobNotification,
    rememberedOrganizationSurvivesSignOut: () => rememberedOrganizationSurvivesSignOut,
    removedQualificationCertificateIds: () => removedQualificationCertificateIds,
    reportDayValue: () => reportDayValue,
    reportPayCell: () => reportPayCell,
    reportPayTotal: () => reportPayTotal,
    reportPersonPayCell: () => reportPersonPayCell,
    resolveBookingPerson: () => resolveBookingPerson,
    resolveInviteEmailClaim: () => resolveInviteEmailClaim,
    resolveMaterialCutOffClock: () => resolveMaterialCutOffClock,
    resolveOrganizationCurrency: () => resolveOrganizationCurrency,
    resolveSensitiveProfile: () => resolveSensitiveProfile,
    resolveTimesheetExportedAtMs: () => resolveTimesheetExportedAtMs,
    resolveTimesheetPeriod: () => resolveTimesheetPeriod,
    resolvedWarningKeys: () => resolvedWarningKeys,
    rosterAliasIdsFor: () => rosterAliasIdsFor,
    rosterDocumentRank: () => rosterDocumentRank,
    rosterPeople: () => rosterPeople,
    rosterPersonName: () => rosterPersonName,
    rosterSegment: () => rosterSegment,
    rosterStatusLabel: () => rosterStatusLabel,
    rulebookStamp: () => rulebookStamp,
    scheduleOptionsWriteFields: () => scheduleOptionsWriteFields,
    seesEveryJob: () => seesEveryJob,
    seesEveryUserTimesheet: () => seesEveryUserTimesheet,
    selectableTimesheetPaymentRunPeriods: () => selectableTimesheetPaymentRunPeriods,
    sensitiveProfileDocPath: () => sensitiveProfileDocPath,
    sensitiveProfileWriteFields: () => sensitiveProfileWriteFields,
    sessionMembershipIds: () => sessionMembershipIds,
    shouldClearRememberedOrganization: () => shouldClearRememberedOrganization,
    slotInterval: () => slotInterval,
    snapLeaveDays: () => snapLeaveDays,
    sortWarningsByDate: () => sortWarningsByDate,
    standardBreakWindow: () => standardBreakWindow,
    standardDayCoverage: () => standardDayCoverage,
    standardDayWindow: () => standardDayWindow,
    starterCollectionShouldSeed: () => starterCollectionShouldSeed,
    subcontractorDayValue: () => subcontractorDayValue,
    subtractMinuteIntervals: () => subtractMinuteIntervals,
    timesheetBelongsToOrganization: () => timesheetBelongsToOrganization,
    timesheetDocumentId: () => timesheetDocumentId,
    timesheetEntryDecision: () => timesheetEntryDecision,
    timesheetEntryEffectiveAmount: () => timesheetEntryEffectiveAmount,
    timesheetEntryReviewWriteFields: () => timesheetEntryReviewWriteFields,
    timesheetEntryReviewsAfterWrite: () => timesheetEntryReviewsAfterWrite,
    timesheetExportStoragePath: () => timesheetExportStoragePath,
    timesheetExportWriteFields: () => timesheetExportWriteFields,
    timesheetLeaveLabel: () => timesheetLeaveLabel,
    timesheetLeaveLines: () => timesheetLeaveLines,
    timesheetListBucket: () => timesheetListBucket,
    timesheetOwnerWriteFields: () => timesheetOwnerWriteFields,
    timesheetPaymentRunPeriodsFromWindow: () => timesheetPaymentRunPeriodsFromWindow,
    timesheetPeriodContainsDay: () => timesheetPeriodContainsDay,
    timesheetPeriodFromInvoicing: () => timesheetPeriodFromInvoicing,
    timesheetPeriodKey: () => timesheetPeriodKey,
    timesheetPeriodMatches: () => timesheetPeriodMatches,
    timesheetPeriodWriteFields: () => timesheetPeriodWriteFields,
    timesheetRequiresManagerCounterSign: () => timesheetRequiresManagerCounterSign,
    timesheetSignOffWriteFields: () => timesheetSignOffWriteFields,
    timesheetStatusWriteFields: () => timesheetStatusWriteFields,
    timesheetStoredStartDayKey: () => timesheetStoredStartDayKey,
    timesheetSubmissionAfterPaymentDayChange: () => timesheetSubmissionAfterPaymentDayChange,
    timesheetSubmissionAfterPaymentWeekdayChange: () => timesheetSubmissionAfterPaymentWeekdayChange,
    timesheetSubmissionNoticeCopy: () => timesheetSubmissionNoticeCopy,
    timesheetSubmissionNoticeDedupKey: () => timesheetSubmissionNoticeDedupKey,
    timesheetSubmissionToFirestore: () => timesheetSubmissionToFirestore,
    timesheetTimestampMs: () => timesheetTimestampMs,
    timesheetWriterIsReviewer: () => timesheetWriterIsReviewer,
    tokenizeMaterialSearch: () => tokenizeMaterialSearch,
    tokenizeQualificationSearch: () => tokenizeQualificationSearch,
    unbookedLabourRows: () => unbookedLabourRows,
    unbookedLabourRowsOnDay: () => unbookedLabourRowsOnDay,
    uniqueOrganizationIds: () => uniqueOrganizationIds,
    unreadNotificationBadgeCount: () => unreadNotificationBadgeCount,
    unverifiedOperativeRows: () => unverifiedOperativeRows,
    userCreateRequiresAgeConfirmation: () => userCreateRequiresAgeConfirmation,
    userNotificationPreferenceFieldPatch: () => userNotificationPreferenceFieldPatch,
    userNotificationPreferencesToFirestore: () => userNotificationPreferencesToFirestore,
    userRosterSegment: () => userRosterSegment,
    userTimesheetSubjects: () => userTimesheetSubjects,
    validateInvoicingSettings: () => validateInvoicingSettings,
    validatePayrollTimePolicy: () => validatePayrollTimePolicy,
    visibleNotificationPreferenceKeys: () => visibleNotificationPreferenceKeys,
    warningDayKeyIsDated: () => warningDayKeyIsDated,
    warningDetectionToFirestore: () => warningDetectionToFirestore,
    warningResolutionWriteFields: () => warningResolutionWriteFields,
    webSessionOrganizationStorageKey: () => webSessionOrganizationStorageKey,
    weekdayOffsetBefore: () => weekdayOffsetBefore,
    withoutDismissedQualificationRows: () => withoutDismissedQualificationRows,
    workDocuments: () => workDocuments,
    workStatusOn: () => workStatusOn,
    workedHoursSplit: () => workedHoursSplit,
    writeMetadataFields: () => writeMetadataFields
  });

  // lib/orgTime/zoneTime.ts
  var LONDON_TIME_ZONE = "Europe/London";
  var partsFormatters = /* @__PURE__ */ new Map();
  var partsMemo = /* @__PURE__ */ new Map();
  var PARTS_MEMO_LIMIT = 4096;
  function partsFormatter(timeZone) {
    let fmt = partsFormatters.get(timeZone);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      });
      partsFormatters.set(timeZone, fmt);
    }
    return fmt;
  }
  function partsInZone(date, timeZone) {
    const memoKey = `${timeZone}|${date.getTime()}`;
    const cached = partsMemo.get(memoKey);
    if (cached) return cached;
    const map = {};
    for (const part of partsFormatter(timeZone).formatToParts(date)) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
    const parts = {
      y: Number(map.year),
      m: Number(map.month),
      d: Number(map.day),
      h: Number(map.hour),
      min: Number(map.minute)
    };
    if (partsMemo.size >= PARTS_MEMO_LIMIT) {
      partsMemo.delete(partsMemo.keys().next().value);
    }
    partsMemo.set(memoKey, parts);
    return parts;
  }
  function dayKeyInZone(date, timeZone) {
    const { y, m, d } = partsInZone(date, timeZone);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  function midnightInZone(date, timeZone) {
    const { y, m, d } = partsInZone(date, timeZone);
    const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const shown = partsInZone(guess, timeZone);
    let deltaMin = shown.h * 60 + shown.min;
    const shownKey = dayKeyInZone(guess, timeZone);
    const wanted = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (shownKey < wanted) deltaMin -= 24 * 60;
    else if (shownKey > wanted) deltaMin += 24 * 60;
    return new Date(guess.getTime() - deltaMin * 6e4);
  }
  function addDaysInZone(date, days, timeZone) {
    const { y, m, d } = partsInZone(date, timeZone);
    const noon = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
    return midnightInZone(noon, timeZone);
  }
  function daysInZoneMonth(date, timeZone) {
    const { y, m } = partsInZone(date, timeZone);
    return new Date(Date.UTC(y, m, 0, 12, 0, 0)).getUTCDate();
  }
  function isoWeekdayInZone(date, timeZone) {
    const { y, m, d } = partsInZone(date, timeZone);
    const js = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
    return js === 0 ? 7 : js;
  }
  function dayOfMonthInZone(date, timeZone) {
    return partsInZone(date, timeZone).d;
  }
  function dateFromDayKeyInZone(key2, timeZone) {
    const [y, m, d] = key2.split("-").map(Number);
    return midnightInZone(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)), timeZone);
  }
  function unixStartOfDayInZone(date, timeZone) {
    return Math.floor(midnightInZone(date, timeZone).getTime() / 1e3);
  }

  // lib/canonical/engine.ts
  var CANONICAL_TIME_ZONE = LONDON_TIME_ZONE;
  var CANONICAL_HALF_MONTH_RANGES = [
    { startDay: 1, endDay: 15 },
    { startDay: 16, endDay: 31 }
  ];
  var WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  function organizationIdsMatch(lhs, rhs) {
    const left = String(lhs ?? "").trim().toLowerCase();
    const right = String(rhs ?? "").trim().toLowerCase();
    return left.length > 0 && left === right;
  }
  function uniqueOrganizationIds(values = []) {
    const ids = [];
    for (const value of values) {
      const organizationId = String(value || "").trim();
      if (!organizationId) continue;
      if (ids.some((existing) => organizationIdsMatch(existing, organizationId))) continue;
      ids.push(organizationId);
    }
    return ids;
  }
  var WEB_SESSION_ORGANIZATION_STORAGE_PREFIX = "pp.webActiveOrg:";
  var IOS_SESSION_ORGANIZATION_STORAGE_KEY = "cached_organizationId";
  function webSessionOrganizationStorageKey(userId) {
    const id2 = String(userId || "").trim();
    return id2 ? `${WEB_SESSION_ORGANIZATION_STORAGE_PREFIX}${id2}` : "";
  }
  function shouldClearRememberedOrganization(input) {
    const previous = String(input.signedOutUserId || "").trim();
    const next = String(input.nextUserId || "").trim();
    return Boolean(previous && next && previous !== next);
  }
  function rememberedOrganizationSurvivesSignOut() {
    return !shouldClearRememberedOrganization({ signedOutUserId: "same", nextUserId: "" });
  }
  function sessionMembershipIds(input) {
    void input.discoveryIncomplete;
    return uniqueOrganizationIds([
      ...input.discoveredIds ?? [],
      ...input.previousIds ?? [],
      input.explicitOrganizationId,
      input.rememberedOrganizationId,
      input.documentOrganizationId
    ]);
  }
  function organizationIdFromValue(value) {
    if (typeof value === "string") {
      const trimmed6 = value.trim();
      if (!trimmed6) return "";
      if (trimmed6.includes("/")) {
        const parts = trimmed6.split("/").filter(Boolean);
        return parts[parts.length - 1] || "";
      }
      return trimmed6;
    }
    if (value && typeof value === "object" && "id" in value) {
      return organizationIdFromValue(value.id);
    }
    return "";
  }
  function bookingBelongsToOrganization(bookingOrganizationId, currentOrganizationId) {
    return organizationIdsMatch(bookingOrganizationId, currentOrganizationId);
  }
  function provisionalOrganizationId(input) {
    for (const value of [input.explicitOrganizationId, input.rememberedOrganizationId, input.documentOrganizationId]) {
      const organizationId = String(value || "").trim();
      if (organizationId) return organizationId;
    }
    return "";
  }
  function orgAccessProbeFromReads(input) {
    const belongs = input.membershipRead === "active" || input.listed || input.isCreator;
    if (input.unconfirmed || input.orgRead !== "loaded" || input.membershipRead === "failed") {
      return belongs ? "allowed" : "unknown";
    }
    if (!belongs) return "denied";
    return "allowed";
  }
  function accessProbeFromReadError(_error) {
    return "unknown";
  }
  function chooseSessionOrganization(input) {
    const documentOrganizationId = String(input.documentOrganizationId || "").trim();
    const candidates = uniqueOrganizationIds([
      input.explicitOrganizationId,
      input.rememberedOrganizationId,
      documentOrganizationId
    ]);
    const probeFor = (organizationId) => {
      if (input.probes instanceof Map) {
        for (const [key2, probe] of input.probes) {
          if (organizationIdsMatch(key2, organizationId)) return probe;
        }
        return "unknown";
      }
      for (const [key2, probe] of Object.entries(input.probes)) {
        if (organizationIdsMatch(key2, organizationId)) return probe;
      }
      return "unknown";
    };
    const rememberedOrganizationId = String(input.rememberedOrganizationId || "").trim();
    const explicitOrganizationId = String(input.explicitOrganizationId || "").trim();
    const persistFor = (organizationId) => {
      if (!organizationId) return null;
      const chosenIsDocument = organizationIdsMatch(organizationId, documentOrganizationId);
      const chosenIsRemembered = organizationIdsMatch(organizationId, rememberedOrganizationId);
      const chosenIsExplicit = organizationIdsMatch(organizationId, explicitOrganizationId);
      if (chosenIsDocument && !chosenIsRemembered && !chosenIsExplicit) return null;
      return organizationId;
    };
    for (const organizationId of candidates) {
      const isDocument = organizationIdsMatch(organizationId, documentOrganizationId);
      if (!isDocument && probeFor(organizationId) === "denied") continue;
      return { organizationId, persistOrganizationId: persistFor(organizationId) };
    }
    return {
      organizationId: documentOrganizationId,
      persistOrganizationId: persistFor(documentOrganizationId)
    };
  }
  function intervalsOverlap(a, b) {
    return a.start < b.end && b.start < a.end;
  }
  function overlappingIntervalGroups(intervals) {
    const n = intervals.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (i) => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
    const linked = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      const a = intervals[i];
      if (!a) continue;
      for (let j = i + 1; j < n; j++) {
        const b = intervals[j];
        if (!b || !intervalsOverlap(a, b)) continue;
        linked[i] = true;
        linked[j] = true;
        const ra = find(i);
        const rb = find(j);
        if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
      }
    }
    const groups = /* @__PURE__ */ new Map();
    for (let i = 0; i < n; i++) {
      if (!linked[i]) continue;
      const root = find(i);
      const list = groups.get(root) || [];
      list.push(i);
      groups.set(root, list);
    }
    return [...groups.values()].filter((group) => group.length >= 2).sort((a, b) => a[0] - b[0]);
  }
  var CANONICAL_STANDARD_DAY = { start: 7 * 60 + 30, end: 16 * 60 };
  var CANONICAL_STANDARD_BREAK = { start: 12 * 60, end: 12 * 60 + 30 };
  var MIN_HALF_DAY_MINUTES = 60;
  function parseClockMinutes(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) && value >= 0 && value <= 24 * 60 ? Math.round(value) : null;
    }
    const text9 = String(value ?? "").trim();
    const match = /^(\d{1,2}):(\d{2})$/.exec(text9);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 24 || minutes > 59) return null;
    const total = hours * 60 + minutes;
    return total <= 24 * 60 ? total : null;
  }
  function formatClockMinutes(minutes) {
    const clamped = Math.max(0, Math.min(Math.round(minutes), 24 * 60));
    const hours = Math.floor(clamped / 60);
    const mins = clamped % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }
  function standardDayWindow(input) {
    const start = parseClockMinutes(input?.standardDayStart);
    const end = parseClockMinutes(input?.standardDayEnd);
    if (start == null || end == null || end <= start) return { ...CANONICAL_STANDARD_DAY };
    return { start, end };
  }
  function standardBreakWindow(input) {
    const start = input?.breakWindowStart == null ? CANONICAL_STANDARD_BREAK.start : parseClockMinutes(input.breakWindowStart);
    const end = input?.breakWindowEnd == null ? CANONICAL_STANDARD_BREAK.end : parseClockMinutes(input.breakWindowEnd);
    if (start == null || end == null || end <= start) return null;
    return { start, end };
  }
  function halfDayWindows(input) {
    const day = standardDayWindow(input);
    const breakWindow = standardBreakWindow(input);
    const breakStart = breakWindow?.start ?? null;
    const breakEnd = breakWindow?.end ?? null;
    const breakUsable = breakStart != null && breakEnd != null && breakStart - day.start >= MIN_HALF_DAY_MINUTES && day.end - breakEnd >= MIN_HALF_DAY_MINUTES;
    if (breakUsable) {
      return {
        day,
        am: { start: day.start, end: breakStart },
        pm: { start: breakEnd, end: day.end },
        pivot: "break",
        breakWindow: { start: breakStart, end: breakEnd }
      };
    }
    const mid = day.start + Math.floor((day.end - day.start) / 2);
    return {
      day,
      am: { start: day.start, end: mid },
      pm: { start: mid, end: day.end },
      pivot: "midpoint",
      breakWindow: null
    };
  }
  function namedSlotKind(timeSlot) {
    const normalized = String(timeSlot || "").trim().toUpperCase().replace(/_/g, " ");
    if (!normalized) return "UNKNOWN";
    if (normalized.includes("FULL")) return "FULL_DAY";
    if (normalized === "AM" || normalized.includes("MORNING")) return "AM";
    if (normalized === "PM" || normalized.includes("AFTERNOON")) return "PM";
    if (normalized.includes("CUSTOM")) return "CUSTOM";
    if (normalized.includes("EVENING")) return "EVENING";
    if (normalized.includes("OVERTIME")) return "OVERTIME";
    return "UNKNOWN";
  }
  function slotInterval(booking, dayInput2) {
    const start = parseClockMinutes(booking.workStartTime);
    const end = parseClockMinutes(booking.workEndTime);
    if (start != null && end != null && end > start) return { start, end };
    const windows = halfDayWindows(dayInput2);
    switch (namedSlotKind(booking.timeSlot)) {
      case "AM":
        return { ...windows.am };
      case "PM":
        return { ...windows.pm };
      case "EVENING": {
        const eveningEnd = Math.min(windows.day.end + 240, 24 * 60);
        return eveningEnd > windows.day.end ? { start: windows.day.end, end: eveningEnd } : null;
      }
      case "OVERTIME": {
        const overtimeStart = Math.min(windows.day.end + 240, 24 * 60);
        const overtimeEnd = Math.min(windows.day.end + 360, 24 * 60);
        return overtimeEnd > overtimeStart ? { start: overtimeStart, end: overtimeEnd } : null;
      }
      default:
        return { ...windows.day };
    }
  }
  function mergeMinuteIntervals(intervals) {
    const sorted = intervals.filter((interval2) => interval2.end > interval2.start).map((interval2) => ({ ...interval2 })).sort((a, b) => a.start - b.start);
    const merged = [];
    for (const interval2 of sorted) {
      const last = merged[merged.length - 1];
      if (last && interval2.start <= last.end) last.end = Math.max(last.end, interval2.end);
      else merged.push(interval2);
    }
    return merged;
  }
  function subtractMinuteIntervals(window, covered) {
    const gaps = [];
    let cursor = window.start;
    for (const interval2 of mergeMinuteIntervals(covered)) {
      if (interval2.end <= cursor) continue;
      if (interval2.start >= window.end) break;
      if (interval2.start > cursor) gaps.push({ start: cursor, end: Math.min(interval2.start, window.end) });
      cursor = Math.max(cursor, interval2.end);
      if (cursor >= window.end) break;
    }
    if (cursor < window.end) gaps.push({ start: cursor, end: window.end });
    return gaps;
  }
  function paidHoursForNamedSlot(timeSlot, standardPaidHours = 8) {
    const normalized = String(timeSlot || "").trim().toUpperCase().replace(/_/g, " ");
    const standard = Number.isFinite(standardPaidHours) && standardPaidHours > 0 ? standardPaidHours : 8;
    if (normalized.includes("FULL")) return standard;
    if (normalized === "AM" || normalized === "PM") return standard / 2;
    return null;
  }
  function zoneOf(timeZone) {
    const value = String(timeZone || "").trim();
    return value || CANONICAL_TIME_ZONE;
  }
  function isoWeekdayIndex(day) {
    const index = WEEKDAYS.indexOf(String(day || "").trim().toLowerCase());
    return index >= 0 ? index + 1 : 5;
  }
  function weekdayOnOrBefore(reference, isoWeekday, timeZone) {
    const current = isoWeekdayInZone(reference, timeZone);
    const delta = current >= isoWeekday ? current - isoWeekday : current + 7 - isoWeekday;
    return addDaysInZone(midnightInZone(reference, timeZone), -delta, timeZone);
  }
  function weekdayOnOrAfter(reference, isoWeekday, timeZone) {
    const current = isoWeekdayInZone(reference, timeZone);
    const delta = current <= isoWeekday ? isoWeekday - current : 7 - current + isoWeekday;
    return addDaysInZone(midnightInZone(reference, timeZone), delta, timeZone);
  }
  function dayInMonth(monthAnchor2, day, timeZone) {
    const { y, m } = partsInZone(monthAnchor2, timeZone);
    const dim = daysInZoneMonth(monthAnchor2, timeZone);
    const clamped = Math.min(Math.max(day, 1), dim);
    return dateFromDayKeyInZone(
      `${y}-${String(m).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`,
      timeZone
    );
  }
  function shiftMonth(reference, offset, timeZone) {
    const { y, m } = partsInZone(reference, timeZone);
    return midnightInZone(new Date(Date.UTC(y, m - 1 + offset, 1, 12, 0, 0)), timeZone);
  }
  function paymentRunMonthDay(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : 0;
  }
  function normalizePaymentRunRange(row) {
    if (!row) return null;
    const startDay = paymentRunMonthDay(row.startDate) || paymentRunMonthDay(row.startDay);
    const endDay = paymentRunMonthDay(row.endDate) || paymentRunMonthDay(row.endDay);
    if (startDay <= 0 || endDay <= 0) return null;
    return { startDay, endDay };
  }
  function usableRanges(ranges) {
    return (ranges ?? []).map((range) => normalizePaymentRunRange(range)).filter((range) => range != null).slice(0, 2);
  }
  function rangeContainsDay(range, dayOfMonth) {
    if (range.startDay <= range.endDay) {
      return dayOfMonth >= range.startDay && dayOfMonth <= range.endDay;
    }
    return dayOfMonth >= range.startDay || dayOfMonth <= range.endDay;
  }
  function boundsForRange(range, reference, timeZone) {
    const dayOfMonth = dayOfMonthInZone(reference, timeZone);
    const monthAnchor2 = shiftMonth(reference, 0, timeZone);
    if (range.startDay <= range.endDay) {
      return {
        startDayKey: dayKeyInZone(dayInMonth(monthAnchor2, range.startDay, timeZone), timeZone),
        endDayKey: dayKeyInZone(dayInMonth(monthAnchor2, range.endDay, timeZone), timeZone)
      };
    }
    if (dayOfMonth >= range.startDay) {
      const nextMonth = shiftMonth(reference, 1, timeZone);
      return {
        startDayKey: dayKeyInZone(dayInMonth(monthAnchor2, range.startDay, timeZone), timeZone),
        endDayKey: dayKeyInZone(dayInMonth(nextMonth, range.endDay, timeZone), timeZone)
      };
    }
    const previousMonth = shiftMonth(reference, -1, timeZone);
    return {
      startDayKey: dayKeyInZone(dayInMonth(previousMonth, range.startDay, timeZone), timeZone),
      endDayKey: dayKeyInZone(dayInMonth(monthAnchor2, range.endDay, timeZone), timeZone)
    };
  }
  function invoicingPeriod(input) {
    const timeZone = zoneOf(input.timeZone);
    const reference = midnightInZone(new Date(input.referenceIso), timeZone);
    if (String(input.paymentRunMode || "date_ranges") === "recurring_timeframe") {
      return recurringPeriod(reference, input, timeZone);
    }
    return dateRangePeriod(reference, input.ranges, timeZone);
  }
  function dateRangePeriod(reference, ranges, timeZone) {
    const parsed = usableRanges(ranges);
    const effective = parsed.length > 0 ? parsed : CANONICAL_HALF_MONTH_RANGES;
    const dayOfMonth = dayOfMonthInZone(reference, timeZone);
    const match = effective.find((range) => rangeContainsDay(range, dayOfMonth));
    if (match) return boundsForRange(match, reference, timeZone);
    const fallback = effective.reduce((latest, range) => range.endDay > latest.endDay ? range : latest);
    return boundsForRange(fallback, reference, timeZone);
  }
  function recurringPeriod(reference, input, timeZone) {
    const startWd = isoWeekdayIndex(input.recurringRunStartDay || "monday");
    const endWd = isoWeekdayIndex(input.recurringRunEndDay || "sunday");
    let periodStart = weekdayOnOrBefore(reference, startWd, timeZone);
    let periodEnd = weekdayOnOrAfter(periodStart, endWd, timeZone);
    if (dayKeyInZone(periodEnd, timeZone) < dayKeyInZone(periodStart, timeZone)) {
      periodEnd = addDaysInZone(periodEnd, 7, timeZone);
    }
    if (dayKeyInZone(reference, timeZone) > dayKeyInZone(periodEnd, timeZone)) {
      periodStart = addDaysInZone(periodStart, 7, timeZone);
      periodEnd = weekdayOnOrAfter(periodStart, endWd, timeZone);
      if (dayKeyInZone(periodEnd, timeZone) < dayKeyInZone(periodStart, timeZone)) {
        periodEnd = addDaysInZone(periodEnd, 7, timeZone);
      }
    }
    return {
      startDayKey: dayKeyInZone(periodStart, timeZone),
      endDayKey: dayKeyInZone(periodEnd, timeZone)
    };
  }
  function intervalMinutes(intervals) {
    return intervals.reduce((sum, interval2) => sum + (interval2.end - interval2.start), 0);
  }
  function roundCoverageHours(hours) {
    return Math.round(hours * 100) / 100;
  }
  function withoutInterval(intervals, cut) {
    if (!cut) return intervals.map((interval2) => ({ ...interval2 }));
    return intervals.flatMap((interval2) => subtractMinuteIntervals(interval2, [cut]));
  }
  function bookingCoverInterval(booking, windows) {
    switch (namedSlotKind(booking.timeSlot)) {
      case "UNKNOWN":
      case "FULL_DAY":
        return { ...windows.day };
      case "AM":
        return windows.am.end > windows.am.start ? { ...windows.am } : null;
      case "PM":
        return windows.pm.end > windows.pm.start ? { ...windows.pm } : null;
      default: {
        const start = parseClockMinutes(booking.workStart ?? booking.workStartTime);
        const end = parseClockMinutes(booking.workEnd ?? booking.workEndTime);
        if (start != null && end != null && end > start) return { start, end };
        return { ...windows.day };
      }
    }
  }
  function standardDayCoverage(policy, bookings) {
    const windows = halfDayWindows(policy);
    const unpaidBreak = standardBreakWindow(policy);
    const required = withoutInterval([windows.day], unpaidBreak);
    const requiredHours = roundCoverageHours(intervalMinutes(required) / 60);
    const covered = [];
    for (const booking of bookings) {
      const interval2 = bookingCoverInterval(booking, windows);
      if (!interval2) continue;
      const start = Math.max(interval2.start, windows.day.start);
      const end = Math.min(interval2.end, windows.day.end);
      if (end > start) covered.push({ start, end });
    }
    const inside = withoutInterval(mergeMinuteIntervals(covered), unpaidBreak);
    const coveredHours = roundCoverageHours(Math.min(requiredHours, intervalMinutes(inside) / 60));
    return {
      requiredHours,
      coveredHours,
      missingHours: roundCoverageHours(Math.max(0, requiredHours - coveredHours))
    };
  }
  var FALLBACK_LOOKAHEAD_DAYS = 7;
  function lookaheadDaysOrFallback(raw) {
    if (raw === void 0 || raw === null || typeof raw === "string" && raw.trim() === "") {
      return { days: FALLBACK_LOOKAHEAD_DAYS, fallbackReason: "lookaheadDaysMissing" };
    }
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || Math.round(n) < 1) {
      return { days: FALLBACK_LOOKAHEAD_DAYS, fallbackReason: "lookaheadDaysInvalid" };
    }
    return { days: Math.min(Math.round(n), 366) };
  }
  function coverageWindow(input) {
    const timeZone = zoneOf(input.timeZone);
    const today = midnightInZone(new Date(input.referenceIso), timeZone);
    const todayKey2 = dayKeyInZone(today, timeZone);
    const mode = String(input.clashLookaheadMode || "endOfWorkingWeek");
    if (mode === "numberOfDays") {
      const lookahead = lookaheadDaysOrFallback(input.clashLookaheadDays);
      const window = {
        startDayKey: todayKey2,
        endDayKey: dayKeyInZone(addDaysInZone(today, lookahead.days - 1, timeZone), timeZone)
      };
      if (lookahead.fallbackReason) window.fallbackReason = lookahead.fallbackReason;
      return window;
    }
    if (mode === "endOfInvoicingPeriod") {
      return invoicingPeriod({ ...input, referenceIso: today.toISOString(), timeZone });
    }
    const iso = isoWeekdayInZone(today, timeZone);
    return {
      startDayKey: dayKeyInZone(addDaysInZone(today, -(iso - 1), timeZone), timeZone),
      endDayKey: dayKeyInZone(addDaysInZone(today, 5 - iso, timeZone), timeZone)
    };
  }
  function clashScanDays(input) {
    const timeZone = zoneOf(input.timeZone);
    const window = coverageWindow(input);
    const keys = [];
    let cursor = dateFromDayKeyInZone(window.startDayKey, timeZone);
    while (keys.length <= 400) {
      const key2 = dayKeyInZone(cursor, timeZone);
      if (key2 > window.endDayKey) break;
      keys.push(key2);
      cursor = addDaysInZone(cursor, 1, timeZone);
    }
    const mode = String(input.clashLookaheadMode || "endOfWorkingWeek");
    if (mode === "endOfWorkingWeek") {
      const booked = input.bookedDayKeys == null ? null : new Set(input.bookedDayKeys.map((key2) => String(key2)));
      const friday = dateFromDayKeyInZone(window.endDayKey, timeZone);
      for (const offset of [1, 2]) {
        const key2 = dayKeyInZone(addDaysInZone(friday, offset, timeZone), timeZone);
        if (!booked || booked.has(key2)) keys.push(key2);
      }
    }
    const result2 = {
      ...window,
      startDayKey: keys[0] ?? window.startDayKey,
      endDayKey: keys[keys.length - 1] ?? window.endDayKey,
      dayKeys: keys
    };
    return result2;
  }
  function dayKeyInOrganizationZone(referenceIso, timeZone) {
    return dayKeyInZone(new Date(referenceIso), zoneOf(timeZone));
  }
  function organizationScopedKey(kind, organizationId, userId = "") {
    const org = String(organizationId || "").trim().toLowerCase();
    const user = String(userId || "").trim();
    return user ? `${kind}:${user}:${org}` : `${kind}:${org}`;
  }

  // lib/canonical/userRosterSegment.ts
  var ANONYMISED_DELETED_USER_NAME = "Deleted user";
  function trimmed(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function normalizeEmail(value) {
    return trimmed(value).toLowerCase();
  }
  function namesEqualDeletedUser(value) {
    return value.toLowerCase() === ANONYMISED_DELETED_USER_NAME.toLowerCase();
  }
  function rosterPersonName(profile) {
    const first = trimmed(profile.firstName);
    const surname = trimmed(profile.surname) || trimmed(profile.lastName);
    const combined = `${first} ${surname}`.trim();
    if (combined) return combined;
    return trimmed(profile.name) || trimmed(profile.displayName);
  }
  function rosterPhone(profile) {
    return trimmed(profile.mobileNumber) || trimmed(profile.mobile) || trimmed(profile.phone);
  }
  function isAnonymisedDeletedProfile(profile) {
    if (!profile) return false;
    if (normalizeEmail(profile.email)) return false;
    if (namesEqualDeletedUser(rosterPersonName(profile))) return true;
    if (namesEqualDeletedUser(trimmed(profile.name))) return true;
    if (namesEqualDeletedUser(trimmed(profile.displayName))) return true;
    return false;
  }
  function rosterSegment(profile) {
    if (isAnonymisedDeletedProfile(profile)) return "inactive";
    if (profile.passwordSet === true) return profile.isActive === true ? "active" : "inactive";
    return "pending";
  }
  function matchesRosterSegment(profile, segment2) {
    return rosterSegment(profile) === segment2;
  }
  function rosterStatusLabel(profile) {
    const segment2 = rosterSegment(profile);
    if (segment2 === "active") return "Active";
    if (segment2 === "inactive") return "Inactive";
    return "Pending";
  }
  function normalizeClaimedEmails(claimedEmails) {
    if (claimedEmails == null) return null;
    return claimedEmails.map((email) => normalizeEmail(email)).filter(Boolean);
  }
  function isIdentifiablePendingLeftover(profile, claimedEmails) {
    if (profile.passwordSet === true) return false;
    if (isAnonymisedDeletedProfile(profile)) return false;
    const email = normalizeEmail(profile.email);
    const name = rosterPersonName(profile);
    const phone = rosterPhone(profile);
    const namedPerson = Boolean(name) && !namesEqualDeletedUser(name);
    const identifiable = Boolean(email) || namedPerson || Boolean(phone);
    if (!identifiable) return false;
    if (!email) return true;
    const claimed = normalizeClaimedEmails(claimedEmails);
    if (claimed == null) return false;
    return !claimed.includes(email);
  }
  function listedRosterUsers(users, claimedEmails) {
    return users.filter((user) => !isIdentifiablePendingLeftover(user, claimedEmails));
  }
  function listedCurrentLabourPeople(people) {
    return people.filter((person) => !isAnonymisedDeletedProfile(person));
  }
  var DELETED_USER_DISPLAY_NAME = ANONYMISED_DELETED_USER_NAME;
  var userRosterSegment = rosterSegment;
  var matchesUserRosterSegment = matchesRosterSegment;

  // lib/canonical/dayKeys.ts
  function zoneOrLondon(timeZone) {
    const value = String(timeZone || "").trim();
    return value || LONDON_TIME_ZONE;
  }
  function eachDayKey(startKey, endKey, timeZone, cap = 400) {
    if (!startKey || !endKey || startKey > endKey) return [];
    const keys = [];
    let cursor = dateFromDayKeyInZone(startKey, timeZone);
    while (dayKeyInZone(cursor, timeZone) <= endKey) {
      keys.push(dayKeyInZone(cursor, timeZone));
      cursor = addDaysInZone(cursor, 1, timeZone);
      if (keys.length > cap) break;
    }
    return keys;
  }
  function isoWeekdayOfDayKey(dayKey, timeZone) {
    return isoWeekdayInZone(dateFromDayKeyInZone(dayKey, timeZone), timeZone);
  }
  function formatLongDayKey(dayKey, timeZone) {
    const date = dateFromDayKeyInZone(dayKey, timeZone);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(date);
  }

  // lib/canonical/warningRows.ts
  function qualificationDismissKey(operativeId, qualificationId, expiryDayKey) {
    return `qual|${String(operativeId).trim()}|${String(qualificationId).trim()}|${String(expiryDayKey).trim()}`;
  }
  function withoutDismissedQualificationRows(rows, dismissedKeys) {
    const dismissed = dismissedKeys instanceof Set ? dismissedKeys : new Set(dismissedKeys);
    if (dismissed.size === 0) return [...rows];
    return rows.filter((row) => !(row.daysUntilExpiry < 0 && dismissed.has(row.dismissKey)));
  }
  var zoneOf2 = zoneOrLondon;
  function emailKey(value) {
    return String(value || "").trim().toLowerCase();
  }
  function dayKeyFromIso(iso, timeZone) {
    const date = new Date(String(iso || ""));
    if (Number.isNaN(date.getTime())) return "";
    return dayKeyInZone(date, timeZone);
  }
  function addCalendarMonths(dayKey, months) {
    const [year, month, day] = dayKey.split("-").map(Number);
    if (!year || !month || !day) return dayKey;
    const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
    const yearOut = shifted.getUTCFullYear();
    const monthOut = shifted.getUTCMonth();
    const lastDay = new Date(Date.UTC(yearOut, monthOut + 1, 0)).getUTCDate();
    const dayOut = Math.min(day, lastDay);
    return `${yearOut}-${String(monthOut + 1).padStart(2, "0")}-${String(dayOut).padStart(2, "0")}`;
  }
  function signedDayDelta(fromKey, toKey) {
    const [fy, fm, fd] = fromKey.split("-").map(Number);
    const [ty, tm, td] = toKey.split("-").map(Number);
    const from = Date.UTC(fy, fm - 1, fd);
    const to = Date.UTC(ty, tm - 1, td);
    return Math.round((to - from) / 864e5);
  }
  function workingDaysInclusive(startKey, endKey, timeZone) {
    if (!startKey || !endKey || startKey > endKey) return 0;
    let count = 0;
    let cursor = dateFromDayKeyInZone(startKey, timeZone);
    while (dayKeyInZone(cursor, timeZone) <= endKey) {
      const iso = isoWeekdayInZone(cursor, timeZone);
      if (iso >= 1 && iso <= 5) count += 1;
      cursor = addDaysInZone(cursor, 1, timeZone);
      if (count > 400) break;
    }
    return count;
  }
  var formatUnbookedDay = formatLongDayKey;
  function formatCoverageHours(hours) {
    const rounded = Math.round(hours * 2) / 2;
    if (Math.abs(rounded - Math.trunc(rounded)) < 0.01) return String(Math.trunc(rounded));
    return rounded.toFixed(1);
  }
  function finiteHours(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
  function hoursForIsoWeekday(iso, input) {
    const standard = finiteHours(input.standardPaidHours, 0);
    if (iso === 6) return Math.max(finiteHours(input.saturdayCountsAsHours, standard), 0);
    if (iso === 7) return Math.max(finiteHours(input.sundayCountsAsHours, standard), 0);
    return Math.max(standard, 0);
  }
  function qualificationExpiryRows(input) {
    const timeZone = zoneOf2(input.timeZone);
    const todayKey2 = dayKeyFromIso(input.referenceIso, timeZone);
    if (!todayKey2) return [];
    const endKey = addCalendarMonths(todayKey2, 1);
    const rows = [];
    for (const operative of input.operatives) {
      if (!operative.isActive) continue;
      if (isAnonymisedDeletedProfile({ email: operative.email, name: operative.name })) continue;
      const operativeName = String(operative.name || "").trim() || operative.id;
      for (const expiry of operative.expiries) {
        const name = String(expiry.name || "").trim();
        const expiryKey = dayKeyFromIso(expiry.expiryIso, timeZone);
        if (!name || !expiry.qualificationId || !expiryKey || expiryKey > endKey) continue;
        const daysUntilExpiry = signedDayDelta(todayKey2, expiryKey);
        const ago = Math.abs(daysUntilExpiry);
        const message = daysUntilExpiry < 0 ? `${operativeName}'s ${name} expired ${ago} day${ago === 1 ? "" : "s"} ago` : daysUntilExpiry === 0 ? `${operativeName}'s ${name} expires today` : `${operativeName}'s ${name} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`;
        rows.push({
          id: `qual-${operative.id}-${expiry.qualificationId}`,
          operativeId: operative.id,
          operativeName,
          qualificationId: expiry.qualificationId,
          qualificationName: name,
          dayKey: expiryKey,
          daysUntilExpiry,
          severity: "low",
          title: daysUntilExpiry < 0 ? "Qualification expired" : "Qualification expiry",
          message,
          dismissKey: qualificationDismissKey(operative.id, expiry.qualificationId, expiryKey)
        });
      }
    }
    return rows;
  }
  function unverifiedOperativeRows(input) {
    const timeZone = zoneOf2(input.timeZone);
    const todayKey2 = dayKeyFromIso(input.referenceIso, timeZone);
    if (!todayKey2) return [];
    const rows = [];
    for (const operative of input.operatives) {
      if (isAnonymisedDeletedProfile({ email: operative.email, name: operative.name })) continue;
      const email = emailKey(operative.email);
      if (!email) continue;
      const person = input.people.find((candidate) => emailKey(candidate.email) === email && candidate.isOperativeMode);
      if (!person || person.passwordSet) continue;
      const createdKey = dayKeyFromIso(person.createdAtIso, timeZone);
      if (!createdKey || workingDaysInclusive(createdKey, todayKey2, timeZone) < 3) continue;
      const operativeName = String(operative.name || "").trim() || operative.email;
      rows.push({
        id: `unverified-${operative.id}`,
        operativeId: operative.id,
        operativeName,
        email,
        title: "Unverified operative",
        message: `${operativeName} has not verified their account`
      });
    }
    return rows;
  }
  function bookingOccupiesDay(status) {
    const value = String(status ?? "").trim().toLowerCase();
    return value === "confirmed" || value === "tentative" || value === "pending" || value === "completed";
  }
  function labourBookingKind(person) {
    if (!person.isActive) return null;
    const admin = Boolean(person.isAdmin || person.isSuperAdmin);
    if (person.isOperativeMode && !person.isManager && !admin) return "operative";
    if (person.isManager || admin) return "manager";
    return null;
  }
  function labourPersonIds(person) {
    const ids = /* @__PURE__ */ new Set();
    if (person.id) ids.add(String(person.id));
    for (const id2 of person.formerIds || []) {
      const trimmed6 = String(id2 || "").trim();
      if (trimmed6) ids.add(trimmed6);
    }
    return [...ids];
  }
  function formerIdAliases(people) {
    const aliases = {};
    for (const person of people) {
      for (const id2 of labourPersonIds(person)) {
        if (id2 !== person.id && !(id2 in aliases)) aliases[id2] = person.id;
      }
    }
    return aliases;
  }
  function hasFinishedSignup(person) {
    return person.passwordSet === true && person.status !== "pending";
  }
  function isManagerOrAdmin(person) {
    return labourBookingKind(person) === "manager";
  }
  function isOperativeModeOnly(person) {
    return labourBookingKind(person) === "operative";
  }
  function preferFinishedAccount(candidates) {
    return candidates.find((person) => person.passwordSet && person.isActive) ?? candidates.find((person) => person.passwordSet);
  }
  function dedupeFinishedPeople(people) {
    const groups = /* @__PURE__ */ new Map();
    const withoutEmail = [];
    for (const person of people) {
      if (!hasFinishedSignup(person)) continue;
      const email = emailKey(person.email);
      if (!email) {
        withoutEmail.push(person);
        continue;
      }
      const list = groups.get(email) || [];
      list.push(person);
      groups.set(email, list);
    }
    const picked = [];
    for (const group of groups.values()) {
      const best = preferFinishedAccount(group);
      if (best) picked.push(best);
    }
    return [...picked, ...withoutEmail];
  }
  function asCoverageBooking(booking) {
    return {
      timeSlot: booking.timeSlot,
      workStart: booking.workStart ?? booking.workStartTime,
      workEnd: booking.workEnd ?? booking.workEndTime
    };
  }
  function unbookedLabourRows(input) {
    const timeZone = zoneOf2(input.timeZone);
    const people = listedCurrentLabourPeople(input.people);
    const operatives = listedCurrentLabourPeople(input.operatives);
    const excludedIds = new Set((input.excludedUserIds || []).map((id2) => String(id2)));
    const isExcluded = (person) => labourPersonIds(person).some((id2) => excludedIds.has(id2));
    const dayPolicy = {
      standardDayStart: input.standardDayStart,
      standardDayEnd: input.standardDayEnd,
      breakWindowStart: input.breakWindowStart,
      breakWindowEnd: input.breakWindowEnd
    };
    const operativeBookings = /* @__PURE__ */ new Map();
    const managerBookings = /* @__PURE__ */ new Map();
    for (const booking of input.bookings) {
      const personId = String(booking.personId || "");
      const dayKey = String(booking.dayKey || "");
      if (!personId || !dayKey) continue;
      const key2 = `${personId}|${dayKey}`;
      const target = booking.kind === "manager" ? managerBookings : operativeBookings;
      const list = target.get(key2) || [];
      list.push(asCoverageBooking(booking));
      target.set(key2, list);
    }
    const operativesByEmail = /* @__PURE__ */ new Map();
    const operativeIdsByEmail = /* @__PURE__ */ new Map();
    for (const operative of operatives) {
      const email = emailKey(operative.email);
      if (!email) continue;
      const ids = operativeIdsByEmail.get(email) || /* @__PURE__ */ new Set();
      if (operative.id) ids.add(operative.id);
      operativeIdsByEmail.set(email, ids);
      const existing = operativesByEmail.get(email);
      if (!existing || operative.profileWeight > existing.profileWeight) {
        operativesByEmail.set(email, operative);
      }
    }
    const userIdsByEmail = /* @__PURE__ */ new Map();
    const idsByUserId = /* @__PURE__ */ new Map();
    for (const person of people) {
      if (person.id) idsByUserId.set(person.id, labourPersonIds(person));
      const email = emailKey(person.email);
      if (!email || !person.id) continue;
      const ids = userIdsByEmail.get(email) || /* @__PURE__ */ new Set();
      for (const id2 of labourPersonIds(person)) ids.add(id2);
      userIdsByEmail.set(email, ids);
    }
    const withFormerIds = (target, userId) => {
      if (!userId) return;
      for (const id2 of idsByUserId.get(userId) || [userId]) target.add(id2);
    };
    const slotsFor = (email, operativeId, userId, dayKey) => {
      const ids = /* @__PURE__ */ new Set();
      if (operativeId) ids.add(operativeId);
      withFormerIds(ids, userId);
      const linked = operativeIdsByEmail.get(email);
      if (linked) for (const id2 of linked) ids.add(id2);
      const linkedUsers = userIdsByEmail.get(email);
      if (linkedUsers) for (const id2 of linkedUsers) ids.add(id2);
      const slots = [];
      for (const id2 of ids) {
        slots.push(...operativeBookings.get(`${id2}|${dayKey}`) || []);
        slots.push(...managerBookings.get(`${id2}|${dayKey}`) || []);
      }
      return slots;
    };
    const approvedHolidays = input.holidays.filter((holiday) => holiday.approved);
    const holidayCovers = (dayKey, email, userId, operativeId) => {
      const userIds = /* @__PURE__ */ new Set();
      withFormerIds(userIds, userId);
      const linkedUsers = userIdsByEmail.get(email);
      if (linkedUsers) for (const id2 of linkedUsers) userIds.add(id2);
      const operativeIds = /* @__PURE__ */ new Set();
      if (operativeId) operativeIds.add(operativeId);
      const linkedOps = operativeIdsByEmail.get(email);
      if (linkedOps) for (const id2 of linkedOps) operativeIds.add(id2);
      return approvedHolidays.some((holiday) => {
        if (dayKey < holiday.startDayKey || dayKey > holiday.endDayKey) return false;
        const holidayUser = String(holiday.userId || "").trim();
        if (holidayUser && userIds.has(holidayUser)) return true;
        if (holiday.operativeId && operativeIds.has(holiday.operativeId)) return true;
        return false;
      });
    };
    const operativeUsers = dedupeFinishedPeople(people.filter(isOperativeModeOnly));
    const managerUsers = dedupeFinishedPeople(people.filter(isManagerOrAdmin));
    const managerAdminUserIds = new Set(
      people.filter(isManagerOrAdmin).filter(hasFinishedSignup).map((person) => person.id)
    );
    const operativeUserEmails = new Set(operativeUsers.map((person) => emailKey(person.email)).filter(Boolean));
    const verifiedUserForEmail = (email) => {
      if (!email) return void 0;
      return preferFinishedAccount(people.filter((person) => emailKey(person.email) === email));
    };
    const roster = operatives.filter((operative) => operative.isActive !== false && !operative.isPlaceholder);
    const rows = [];
    for (const dayKey of eachDayKey(input.startDayKey, input.endDayKey, timeZone)) {
      const iso = isoWeekdayInZone(dateFromDayKeyInZone(dayKey, timeZone), timeZone);
      if (!input.includeWeekends && (iso < 1 || iso > 5)) continue;
      const weekendRequired = hoursForIsoWeekday(iso, input);
      if (iso >= 6 && weekendRequired <= 1e-3) continue;
      const seen = /* @__PURE__ */ new Set();
      const append = (args) => {
        const seenKey = args.email || args.personKey;
        if (seen.has(seenKey)) return;
        seen.add(seenKey);
        const coverage = standardDayCoverage(dayPolicy, slotsFor(args.email, args.operativeId, args.userId, dayKey));
        const requiredHours = iso >= 6 ? weekendRequired : coverage.requiredHours;
        if (requiredHours <= 1e-3) return;
        const coveredHours = Math.min(coverage.coveredHours, requiredHours);
        const missingHours = Math.round(Math.max(0, requiredHours - coveredHours) * 100) / 100;
        if (missingHours <= 1e-3) return;
        const label = formatCoverageHours(missingHours);
        rows.push({
          id: `unbooked-${dayKey}-${args.personKey}`,
          operativeId: args.operativeId,
          operativeName: args.name,
          userId: args.userId,
          personKey: args.personKey,
          dayKey,
          missingHours,
          message: `${args.name} is missing ${label}h on ${formatUnbookedDay(dayKey, timeZone)}.`
        });
      };
      for (const person of operativeUsers) {
        if (isExcluded(person)) continue;
        const email = emailKey(person.email);
        const linked = operativesByEmail.get(email);
        if (holidayCovers(dayKey, email, person.id, linked?.id)) continue;
        append({
          personKey: person.id,
          name: person.name,
          email,
          operativeId: linked?.id || person.id,
          userId: person.id
        });
      }
      for (const person of managerUsers) {
        if (isExcluded(person)) continue;
        const email = emailKey(person.email);
        const linked = operativesByEmail.get(email);
        if (holidayCovers(dayKey, email, person.id, linked?.id)) continue;
        append({
          personKey: person.id,
          name: person.name,
          email,
          operativeId: linked?.id || person.id,
          userId: person.id
        });
      }
      for (const operative of roster) {
        const email = emailKey(operative.email);
        if (email && operativeUserEmails.has(email)) continue;
        const matched = email ? verifiedUserForEmail(email) : void 0;
        if (!matched && email && people.some((person) => emailKey(person.email) === email)) continue;
        if (matched && managerAdminUserIds.has(matched.id)) continue;
        if (matched && isExcluded(matched)) continue;
        if (holidayCovers(dayKey, email, matched?.id, operative.id)) continue;
        append({
          personKey: matched?.id || operative.id,
          name: matched?.name || operative.name,
          email: email || operative.id,
          operativeId: operative.id,
          userId: matched?.id
        });
      }
    }
    return rows.sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1;
      return a.operativeName.localeCompare(b.operativeName, void 0, { sensitivity: "base" });
    });
  }
  function unbookedLabourRowsOnDay(input) {
    return unbookedLabourRows({
      ...input,
      startDayKey: input.dayKey,
      endDayKey: input.dayKey
    });
  }

  // lib/canonical/warningSort.ts
  var DEFAULT_WARNINGS_SORT_DIRECTION = "oldest";
  var DATED_DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
  function parseWarningsSortDirection(value) {
    return value === "newest" ? "newest" : DEFAULT_WARNINGS_SORT_DIRECTION;
  }
  function warningDayKeyIsDated(dayKey) {
    return DATED_DAY_KEY.test(String(dayKey ?? "").trim());
  }
  function compareWarningDayKeys(a, b, direction = DEFAULT_WARNINGS_SORT_DIRECTION) {
    const left = String(a ?? "").trim();
    const right = String(b ?? "").trim();
    const leftDated = warningDayKeyIsDated(left);
    const rightDated = warningDayKeyIsDated(right);
    if (leftDated !== rightDated) return leftDated ? -1 : 1;
    if (!leftDated || left === right) return 0;
    const ascending = left < right ? -1 : 1;
    return parseWarningsSortDirection(direction) === "newest" ? -ascending : ascending;
  }
  function sortWarningsByDate(rows, direction = DEFAULT_WARNINGS_SORT_DIRECTION) {
    const dir = parseWarningsSortDirection(direction);
    return rows.map((row, index) => ({ row, index })).sort((left, right) => {
      const byDate = compareWarningDayKeys(left.row.dayKey ?? "", right.row.dayKey ?? "", dir);
      return byDate !== 0 ? byDate : left.index - right.index;
    }).map((entry) => entry.row);
  }

  // lib/canonical/leaveCoverage.ts
  function leaveSlotKind(timeSlot) {
    const kind = namedSlotKind(timeSlot);
    if (kind === "AM") return "AM";
    if (kind === "PM") return "PM";
    return "FULL_DAY";
  }
  function leaveLabelFor(slot) {
    return slot === "AM" ? "AM" : slot === "PM" ? "PM" : "Full day";
  }
  function rangeLabel(interval2) {
    return `${formatClockMinutes(interval2.start)}\u2013${formatClockMinutes(interval2.end)}`;
  }
  function hoursOf(intervals) {
    const minutes = intervals.reduce((sum, interval2) => sum + Math.max(0, interval2.end - interval2.start), 0);
    return Math.round(minutes / 60 * 100) / 100;
  }
  function formatHours(hours) {
    const rounded = Math.round(hours * 4) / 4;
    const text9 = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "");
    return `${text9} hour${rounded === 1 ? "" : "s"}`;
  }
  function joinRanges(intervals) {
    const labels = intervals.map(rangeLabel);
    if (labels.length <= 1) return labels[0] || "";
    return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  }
  function leaveCoverageRows(input) {
    const timeZone = zoneOrLondon(input.timeZone);
    const windows = halfDayWindows(input.day);
    const excluded = new Set((input.excludedUserIds || []).map((id2) => String(id2)));
    const approvedLeave = input.leave.filter((record3) => record3.approved && record3.startDayKey && record3.endDayKey);
    if (approvedLeave.length === 0) return [];
    const peopleByUserId = /* @__PURE__ */ new Map();
    const peopleByOperativeId = /* @__PURE__ */ new Map();
    for (const person of input.people) {
      if (isAnonymisedDeletedProfile({ name: person.name })) continue;
      const userId = String(person.userId || "").trim();
      if (userId && !peopleByUserId.has(userId)) peopleByUserId.set(userId, person);
      for (const operativeId of person.operativeIds || []) {
        const key2 = String(operativeId || "").trim();
        if (key2 && !peopleByOperativeId.has(key2)) peopleByOperativeId.set(key2, person);
      }
    }
    const personForLeave = (record3) => {
      const userId = String(record3.userId || "").trim();
      if (userId && peopleByUserId.has(userId)) return peopleByUserId.get(userId);
      const operativeId = String(record3.operativeId || "").trim();
      if (operativeId && peopleByOperativeId.has(operativeId)) return peopleByOperativeId.get(operativeId);
      return void 0;
    };
    const bookingsByPersonDay = /* @__PURE__ */ new Map();
    for (const booking of input.bookings) {
      const personId = String(booking.personId || "").trim();
      if (!personId || !booking.dayKey) continue;
      const person = booking.kind === "manager" ? peopleByUserId.get(personId) : peopleByOperativeId.get(personId);
      if (!person) continue;
      const key2 = `${person.personKey}|${booking.dayKey}`;
      const list = bookingsByPersonDay.get(key2) || [];
      list.push(booking);
      bookingsByPersonDay.set(key2, list);
    }
    const rows = [];
    const seen = /* @__PURE__ */ new Set();
    for (const dayKey of eachDayKey(input.startDayKey, input.endDayKey, timeZone)) {
      const iso = isoWeekdayOfDayKey(dayKey, timeZone);
      const weekend = iso === 6 || iso === 7;
      for (const record3 of approvedLeave) {
        if (dayKey < record3.startDayKey || dayKey > record3.endDayKey) continue;
        const person = personForLeave(record3);
        if (!person) continue;
        const dedupe = `${person.personKey}|${dayKey}|${record3.id}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        const leaveSlot = leaveSlotKind(record3.timeSlot);
        const leaveWindow = leaveSlot === "AM" ? windows.am : leaveSlot === "PM" ? windows.pm : windows.day;
        const dayBookings = bookingsByPersonDay.get(`${person.personKey}|${dayKey}`) || [];
        const intervals = dayBookings.map((booking) => ({ booking, interval: slotInterval(booking, input.day) })).filter((entry) => entry.interval !== null);
        const personName = String(person.name || "").trim() || person.personKey;
        const userId = String(person.userId || "").trim() || void 0;
        const operativeId = String(record3.operativeId || person.operativeIds?.[0] || "").trim() || void 0;
        const longDay = formatLongDayKey(dayKey, timeZone);
        const leaveLabel = leaveLabelFor(leaveSlot);
        const clashes = intervals.filter(({ interval: interval2 }) => intervalsOverlap(interval2, leaveWindow)).map(({ booking, interval: interval2 }) => ({
          bookingId: booking.id,
          kind: booking.kind,
          label: String(booking.label || "").trim() || (booking.kind === "manager" ? "Manager booking" : "Booking"),
          start: interval2.start,
          end: interval2.end,
          overlapStart: Math.max(interval2.start, leaveWindow.start),
          overlapEnd: Math.min(interval2.end, leaveWindow.end)
        })).sort((a, b) => a.start - b.start);
        if (clashes.length > 0) {
          const bookedText = clashes.map((clash) => `${clash.label} ${formatClockMinutes(clash.start)}\u2013${formatClockMinutes(clash.end)}`).join(", ");
          const leaveText = leaveSlot === "FULL_DAY" ? "full-day annual leave" : `${leaveLabel} annual leave (${rangeLabel(leaveWindow)})`;
          rows.push({
            id: `leave-clash-${dayKey}-${person.personKey}-${record3.id}`,
            kind: "leave_clash",
            personKey: person.personKey,
            personName,
            userId,
            operativeId,
            dayKey,
            leaveId: record3.id,
            leaveSlot,
            leaveLabel,
            leaveWindow: { ...leaveWindow },
            clashes,
            workingWindow: null,
            missing: [],
            missingHours: 0,
            bookedHours: hoursOf(mergeMinuteIntervals(intervals.map((entry) => entry.interval))),
            severity: "high",
            title: "Booked during annual leave",
            message: `${personName} is booked ${bookedText} on ${longDay} while on ${leaveText}.`
          });
        }
        if (leaveSlot === "FULL_DAY") continue;
        if (weekend && !input.includeWeekends) continue;
        if (userId && excluded.has(userId)) continue;
        const workingWindow = leaveSlot === "PM" ? windows.am : windows.pm;
        const workingLabel = leaveSlot === "PM" ? "AM" : "PM";
        const covered = intervals.map((entry) => entry.interval);
        const missing = subtractMinuteIntervals(workingWindow, covered);
        if (missing.length === 0) continue;
        const missingHours = hoursOf(missing);
        const bookedInWorking = subtractMinuteIntervals(workingWindow, missing);
        const bookedHours = hoursOf(bookedInWorking);
        const message = bookedHours > 0 ? `${personName} has ${leaveLabel} annual leave on ${longDay}. The ${workingLabel} (${rangeLabel(workingWindow)}) is only booked ${joinRanges(bookedInWorking)}; ${joinRanges(missing)} (${formatHours(missingHours)}) is not booked.` : `${personName} has ${leaveLabel} annual leave on ${longDay} but is not booked for the ${workingLabel} (${rangeLabel(workingWindow)}, ${formatHours(missingHours)}).`;
        rows.push({
          id: `leave-cover-${dayKey}-${person.personKey}-${record3.id}`,
          kind: "leave_cover",
          personKey: person.personKey,
          personName,
          userId,
          operativeId,
          dayKey,
          leaveId: record3.id,
          leaveSlot,
          leaveLabel,
          leaveWindow: { ...leaveWindow },
          clashes: [],
          workingWindow: { ...workingWindow },
          missing,
          missingHours,
          bookedHours,
          severity: "medium",
          title: "Half-day leave not covered",
          message
        });
      }
    }
    return rows.sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1;
      if (a.kind !== b.kind) return a.kind === "leave_clash" ? -1 : 1;
      return a.personName.localeCompare(b.personName, void 0, { sensitivity: "base" });
    });
  }

  // lib/canonical/staffAccess.ts
  function isStaffAccount(role) {
    if (role.isOperativeMode) return false;
    return role.isSuperAdmin || role.isAdmin || role.isManager;
  }
  function seesEveryJob(role) {
    return isStaffAccount(role);
  }
  function canViewStaffWarnings(role) {
    return isStaffAccount(role);
  }
  function canSeeVariations(role) {
    return isStaffAccount(role);
  }
  function canReviewUserTimesheets(role) {
    return isStaffAccount(role);
  }
  function seesEveryUserTimesheet(role) {
    if (role.isOperativeMode) return false;
    return role.isSuperAdmin || role.isAdmin;
  }
  function canViewMaterialOrderHistory(role) {
    return isStaffAccount(role);
  }
  function canManageVariationTracker(role) {
    if (role.isOperativeMode) return false;
    return role.isSuperAdmin || role.isAdmin;
  }
  function canEditWorkCatalogue(role, catalogue, toggles) {
    if (role.isOperativeMode) return false;
    if (role.isSuperAdmin) return true;
    if (!role.isAdmin && !role.isManager) return false;
    return catalogue === "projects" ? toggles.projects === true : toggles.smallWorks === true;
  }
  function normalizedId(value) {
    return String(value ?? "").trim();
  }
  function receivesJobNotification(input) {
    const userId = normalizedId(input.userId);
    if (!userId) return false;
    const role = input.role;
    if (role.isOperativeMode) return false;
    if (role.isSuperAdmin || role.isAdmin) return true;
    const assigned = input.assignedManagerUserIds.map(normalizedId);
    if (assigned.includes(userId)) return true;
    const line = (input.lineManagerUserIds ?? []).map(normalizedId);
    return line.includes(userId);
  }

  // lib/canonical/timesheetSubmission.ts
  var TIMESHEET_CLOSE_OF_PLAY_HOUR = 17;
  var TIMESHEET_CLOSE_OF_PLAY_MINUTE = 0;
  var TIMESHEET_NOTIFY_HOUR = 8;
  var TIMESHEET_NOTIFY_MINUTE = 0;
  var TIMESHEET_DEADLINE_DAYS_BEFORE_PAYMENT = 1;
  var TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT = 3;
  var TIMESHEET_SUBMISSION_NOTICE_TITLE = "Timesheet submission reminder";
  var TIMESHEET_SUBMISSION_NOTICE_TYPE = "timesheet_submission_reminder";
  var TIMESHEET_SUBMISSION_WEEKDAYS = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday"
  ];
  var MONTH_CYCLE = 31;
  var GRACE_DAYS_AFTER_PAYMENT = 7;
  function pad2(value) {
    return String(value).padStart(2, "0");
  }
  function clampHour(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(23, Math.round(n)));
  }
  function clampMinute(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.min(59, Math.round(n)));
  }
  function monthDayOrZero(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : 0;
  }
  function normalizeTimesheetWeekday(value, fallback = "friday") {
    const raw = String(value || "").trim().toLowerCase();
    return TIMESHEET_SUBMISSION_WEEKDAYS.includes(raw) ? raw : fallback;
  }
  function weekdayOffsetBefore(weekday2, daysBefore) {
    const current = normalizeTimesheetWeekday(weekday2);
    const index = TIMESHEET_SUBMISSION_WEEKDAYS.indexOf(current);
    const shift = ((index - daysBefore) % 7 + 7) % 7;
    return TIMESHEET_SUBMISSION_WEEKDAYS[shift];
  }
  function monthDayOffsetBefore(paymentDay, daysBefore) {
    const day = monthDayOrZero(paymentDay);
    if (day <= 0) return 0;
    const offset = Math.max(0, Math.round(daysBefore));
    return ((day - 1 - offset) % MONTH_CYCLE + MONTH_CYCLE) % MONTH_CYCLE + 1;
  }
  function monthDayOrdinal(day) {
    const n = monthDayOrZero(day);
    if (n <= 0) return "";
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    switch (n % 10) {
      case 1:
        return `${n}st`;
      case 2:
        return `${n}nd`;
      case 3:
        return `${n}rd`;
      default:
        return `${n}th`;
    }
  }
  function capitalizeTimesheetWeekday(day) {
    const name = normalizeTimesheetWeekday(day);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  function emptyTimesheetSubmission() {
    return {
      timesheetDeadlineDay: 0,
      timesheetDeadlineWeekday: "",
      timesheetDeadlineHour: TIMESHEET_CLOSE_OF_PLAY_HOUR,
      timesheetDeadlineMinute: TIMESHEET_CLOSE_OF_PLAY_MINUTE,
      notifyDay: 0,
      notifyWeekday: "",
      notifyHour: TIMESHEET_NOTIFY_HOUR,
      notifyMinute: TIMESHEET_NOTIFY_MINUTE,
      notifyCustomised: false
    };
  }
  function defaultTimesheetSubmissionFromPaymentDay(paymentDay) {
    const day = monthDayOrZero(paymentDay);
    if (day <= 0) return emptyTimesheetSubmission();
    return {
      timesheetDeadlineDay: monthDayOffsetBefore(day, TIMESHEET_DEADLINE_DAYS_BEFORE_PAYMENT),
      timesheetDeadlineWeekday: "",
      timesheetDeadlineHour: TIMESHEET_CLOSE_OF_PLAY_HOUR,
      timesheetDeadlineMinute: TIMESHEET_CLOSE_OF_PLAY_MINUTE,
      notifyDay: monthDayOffsetBefore(day, TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT),
      notifyWeekday: "",
      notifyHour: TIMESHEET_NOTIFY_HOUR,
      notifyMinute: TIMESHEET_NOTIFY_MINUTE,
      notifyCustomised: false
    };
  }
  function defaultTimesheetSubmissionFromPaymentWeekday(paymentWeekday) {
    const pay = normalizeTimesheetWeekday(paymentWeekday);
    return {
      timesheetDeadlineDay: 0,
      timesheetDeadlineWeekday: weekdayOffsetBefore(pay, TIMESHEET_DEADLINE_DAYS_BEFORE_PAYMENT),
      timesheetDeadlineHour: TIMESHEET_CLOSE_OF_PLAY_HOUR,
      timesheetDeadlineMinute: TIMESHEET_CLOSE_OF_PLAY_MINUTE,
      notifyDay: 0,
      notifyWeekday: weekdayOffsetBefore(pay, TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT),
      notifyHour: TIMESHEET_NOTIFY_HOUR,
      notifyMinute: TIMESHEET_NOTIFY_MINUTE,
      notifyCustomised: false
    };
  }
  function timesheetSubmissionAfterPaymentDayChange(current, paymentDay) {
    if (current?.notifyCustomised) {
      return { ...current };
    }
    return defaultTimesheetSubmissionFromPaymentDay(paymentDay);
  }
  function timesheetSubmissionAfterPaymentWeekdayChange(current, paymentWeekday) {
    if (current?.notifyCustomised) {
      return { ...current };
    }
    return defaultTimesheetSubmissionFromPaymentWeekday(paymentWeekday);
  }
  function isCloseOfPlay(hour, minute) {
    return hour === TIMESHEET_CLOSE_OF_PLAY_HOUR && minute === TIMESHEET_CLOSE_OF_PLAY_MINUTE;
  }
  function deadlinePhrase(dayLabel, hour, minute) {
    if (isCloseOfPlay(hour, minute)) return `close of play on ${dayLabel}`;
    return `${formatClockMinutes(hour * 60 + minute)} on ${dayLabel}`;
  }
  function timesheetSubmissionNoticeCopy(input) {
    const hour = clampHour(input.deadlineHour, TIMESHEET_CLOSE_OF_PLAY_HOUR);
    const minute = clampMinute(input.deadlineMinute, TIMESHEET_CLOSE_OF_PLAY_MINUTE);
    if (input.mode === "recurring_timeframe") {
      const deadlineWeekday = capitalizeTimesheetWeekday(input.deadlineWeekday || "thursday");
      const paymentWeekday = capitalizeTimesheetWeekday(input.paymentWeekday || "friday");
      const when = isCloseOfPlay(hour, minute) ? `close of play ${deadlineWeekday}` : `${formatClockMinutes(hour * 60 + minute)} ${deadlineWeekday}`;
      return `Please issue timesheets for the previous payment run by ${when}, to be paid on ${paymentWeekday}.`;
    }
    const deadline = monthDayOrdinal(input.deadlineDay || 0);
    const payment = monthDayOrdinal(input.paymentDay || 0);
    if (!deadline || !payment) return "";
    return `Timesheets need to be submitted by ${deadlinePhrase(`the ${deadline}`, hour, minute)} for payment on the ${payment}.`;
  }
  function asRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
    return value;
  }
  function parseTimesheetSubmissionEntry(raw, fallback) {
    const data = asRecord(raw);
    if (!data) return { ...fallback };
    const deadlineDay = monthDayOrZero(data.timesheetDeadlineDay);
    const notifyDay = monthDayOrZero(data.notifyDay);
    return {
      timesheetDeadlineDay: deadlineDay || fallback.timesheetDeadlineDay,
      timesheetDeadlineWeekday: data.timesheetDeadlineWeekday ? normalizeTimesheetWeekday(data.timesheetDeadlineWeekday, fallback.timesheetDeadlineWeekday || "thursday") : fallback.timesheetDeadlineWeekday,
      timesheetDeadlineHour: clampHour(data.timesheetDeadlineHour, fallback.timesheetDeadlineHour),
      timesheetDeadlineMinute: clampMinute(data.timesheetDeadlineMinute, fallback.timesheetDeadlineMinute),
      notifyDay: notifyDay || fallback.notifyDay,
      notifyWeekday: data.notifyWeekday ? normalizeTimesheetWeekday(data.notifyWeekday, fallback.notifyWeekday || "tuesday") : fallback.notifyWeekday,
      notifyHour: clampHour(data.notifyHour, fallback.notifyHour),
      notifyMinute: clampMinute(data.notifyMinute, fallback.notifyMinute),
      notifyCustomised: data.notifyCustomised === true
    };
  }
  function timesheetSubmissionToFirestore(entry) {
    return {
      timesheetDeadlineDay: entry.timesheetDeadlineDay,
      timesheetDeadlineWeekday: entry.timesheetDeadlineWeekday,
      timesheetDeadlineHour: entry.timesheetDeadlineHour,
      timesheetDeadlineMinute: entry.timesheetDeadlineMinute,
      notifyDay: entry.notifyDay,
      notifyWeekday: entry.notifyWeekday,
      notifyHour: entry.notifyHour,
      notifyMinute: entry.notifyMinute,
      notifyCustomised: entry.notifyCustomised === true
    };
  }
  function parseTimesheetSubmissionList(input) {
    const rawList = Array.isArray(input.timesheetSubmission) ? input.timesheetSubmission : [];
    const rangeRows = Array.isArray(input.paymentRunDateRanges) ? input.paymentRunDateRanges : [];
    if (input.paymentRunMode === "recurring_timeframe") {
      const fallback = defaultTimesheetSubmissionFromPaymentWeekday(input.recurringPaymentDay || "friday");
      const fromList = rawList[0] != null ? parseTimesheetSubmissionEntry(rawList[0], fallback) : null;
      const fromRoot = input.invoicingRoot ? parseTimesheetSubmissionEntry(
        {
          timesheetDeadlineWeekday: input.invoicingRoot.timesheetDeadlineWeekday,
          timesheetDeadlineHour: input.invoicingRoot.timesheetDeadlineHour,
          timesheetDeadlineMinute: input.invoicingRoot.timesheetDeadlineMinute,
          notifyWeekday: input.invoicingRoot.notifyWeekday,
          notifyHour: input.invoicingRoot.notifyHour,
          notifyMinute: input.invoicingRoot.notifyMinute,
          notifyCustomised: input.invoicingRoot.notifyCustomised
        },
        fallback
      ) : null;
      const chosen = fromList && (asRecord(rawList[0])?.notifyWeekday || asRecord(rawList[0])?.timesheetDeadlineWeekday) ? fromList : fromRoot && (input.invoicingRoot?.notifyWeekday || input.invoicingRoot?.timesheetDeadlineWeekday) ? fromRoot : fromList ?? fromRoot ?? fallback;
      return [{ ...chosen, timesheetDeadlineDay: 0, notifyDay: 0 }];
    }
    const paymentDays = input.paymentDates.map((value) => monthDayOrZero(value)).filter((day) => day > 0);
    const count = Math.max(paymentDays.length, rawList.length, 2);
    const rows = [];
    for (let index = 0; index < count; index += 1) {
      const paymentDay = paymentDays[index] || 0;
      const fallback = defaultTimesheetSubmissionFromPaymentDay(paymentDay);
      const fromList = rawList[index] != null ? parseTimesheetSubmissionEntry(rawList[index], fallback) : null;
      const fromRange = rangeRows[index] != null ? parseTimesheetSubmissionEntry(rangeRows[index], fallback) : null;
      rows.push(fromList ?? fromRange ?? fallback);
    }
    return rows;
  }
  function shiftYearMonth(year, month, offset) {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1, 12, 0, 0));
    return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1 };
  }
  function monthAnchor(year, month, timeZone) {
    return dateFromDayKeyInZone(`${year}-${pad2(month)}-01`, timeZone);
  }
  function clampMonthDayInZone(year, month, day, timeZone) {
    const zone3 = zoneOrLondon(timeZone);
    const dim = daysInZoneMonth(monthAnchor(year, month, zone3), zone3);
    const clamped = Math.min(Math.max(monthDayOrZero(day) || 1, 1), dim);
    return `${year}-${pad2(month)}-${pad2(clamped)}`;
  }
  function paymentDateAfterPeriodEnd(periodEndDayKey, paymentDays, timeZone) {
    const zone3 = zoneOrLondon(timeZone);
    const days = paymentDays.map((day) => monthDayOrZero(day)).filter((day) => day > 0);
    if (!periodEndDayKey || days.length === 0) return null;
    const periodEnd = dateFromDayKeyInZone(periodEndDayKey, zone3);
    const { y, m } = partsInZone(periodEnd, zone3);
    for (const day of days) {
      const candidate = clampMonthDayInZone(y, m, day, zone3);
      if (candidate >= periodEndDayKey) return candidate;
    }
    const next = shiftYearMonth(y, m, 1);
    return clampMonthDayInZone(next.y, next.m, days[0], zone3);
  }
  function paymentWeekdayAfterPeriodEnd(periodEndDayKey, paymentWeekday, timeZone) {
    const zone3 = zoneOrLondon(timeZone);
    if (!periodEndDayKey) return null;
    const payIso = TIMESHEET_SUBMISSION_WEEKDAYS.indexOf(normalizeTimesheetWeekday(paymentWeekday || "friday")) + 1;
    let pay = addDaysInZone(dateFromDayKeyInZone(periodEndDayKey, zone3), 1, zone3);
    for (let step = 0; step < 7; step += 1) {
      if (isoWeekdayInZone(pay, zone3) === payIso) break;
      pay = addDaysInZone(pay, 1, zone3);
    }
    return dayKeyInZone(pay, zone3);
  }
  function relatedMonthDayToPayment(paymentDayKey, relatedDay, timeZone) {
    const payment = dateFromDayKeyInZone(paymentDayKey, timeZone);
    const { y, m, d } = partsInZone(payment, timeZone);
    const day = monthDayOrZero(relatedDay);
    if (day <= 0) return paymentDayKey;
    if (day <= d) return clampMonthDayInZone(y, m, day, timeZone);
    const prev = shiftYearMonth(y, m, -1);
    return clampMonthDayInZone(prev.y, prev.m, day, timeZone);
  }
  function weekdayOnOrBefore2(dayKey, weekday2, timeZone) {
    const target = TIMESHEET_SUBMISSION_WEEKDAYS.indexOf(normalizeTimesheetWeekday(weekday2)) + 1;
    let cursor = dateFromDayKeyInZone(dayKey, timeZone);
    for (let step = 0; step < 7; step += 1) {
      if (isoWeekdayInZone(cursor, timeZone) === target) return dayKeyInZone(cursor, timeZone);
      cursor = addDaysInZone(cursor, -1, timeZone);
    }
    return dayKey;
  }
  function instantOnDay(dayKey, hour, minute, timeZone) {
    const midnight = dateFromDayKeyInZone(dayKey, timeZone);
    return new Date(midnight.getTime() + (hour * 60 + minute) * 6e4);
  }
  function resolveDateRangeInstants(paymentDayKey, settings, timeZone) {
    const payment = dateFromDayKeyInZone(paymentDayKey, timeZone);
    if (!settings.notifyCustomised) {
      return {
        deadlineDayKey: dayKeyInZone(addDaysInZone(payment, -TIMESHEET_DEADLINE_DAYS_BEFORE_PAYMENT, timeZone), timeZone),
        notifyDayKey: dayKeyInZone(addDaysInZone(payment, -TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT, timeZone), timeZone)
      };
    }
    return {
      deadlineDayKey: relatedMonthDayToPayment(paymentDayKey, settings.timesheetDeadlineDay, timeZone),
      notifyDayKey: relatedMonthDayToPayment(paymentDayKey, settings.notifyDay, timeZone)
    };
  }
  function resolveRecurringInstants(paymentDayKey, settings, timeZone) {
    const deadlineWeekday = settings.timesheetDeadlineWeekday || weekdayOffsetBefore(settings.notifyWeekday || "friday", 2);
    const notifyWeekday = settings.notifyWeekday || weekdayOffsetBefore(deadlineWeekday, 2);
    return {
      deadlineDayKey: weekdayOnOrBefore2(paymentDayKey, deadlineWeekday, timeZone),
      notifyDayKey: weekdayOnOrBefore2(paymentDayKey, notifyWeekday, timeZone)
    };
  }
  function timesheetSubmissionNoticeDedupKey(input) {
    const scoped = organizationScopedKey("timesheetSubmission", input.organizationId, input.userId);
    return `${scoped}|${input.runIndex}|${input.paymentDayKey}`;
  }
  function paymentNumbers(values) {
    return (values ?? []).map((value) => monthDayOrZero(value)).filter((day) => day > 0);
  }
  function noticeFromInstants(input) {
    const paymentDay = partsInZone(dateFromDayKeyInZone(input.paymentDayKey, input.timeZone), input.timeZone).d;
    const deadlineDay = monthDayOrZero(input.settings.timesheetDeadlineDay) || partsInZone(dateFromDayKeyInZone(input.deadlineDayKey, input.timeZone), input.timeZone).d;
    const message = timesheetSubmissionNoticeCopy({
      mode: input.mode,
      deadlineDay,
      paymentDay,
      deadlineWeekday: input.settings.timesheetDeadlineWeekday,
      paymentWeekday: input.paymentWeekday,
      deadlineHour: input.settings.timesheetDeadlineHour,
      deadlineMinute: input.settings.timesheetDeadlineMinute
    });
    return {
      runIndex: input.runIndex,
      occurrenceKey: `${input.runIndex}:${input.paymentDayKey}`,
      paymentDayKey: input.paymentDayKey,
      deadlineDayKey: input.deadlineDayKey,
      notifyDayKey: input.notifyDayKey,
      notifyHour: input.settings.notifyHour,
      notifyMinute: input.settings.notifyMinute,
      deadlineHour: input.settings.timesheetDeadlineHour,
      deadlineMinute: input.settings.timesheetDeadlineMinute,
      title: TIMESHEET_SUBMISSION_NOTICE_TITLE,
      message
    };
  }
  function isDue(now, notifyAt, paymentDayKey, timeZone) {
    if (now.getTime() < notifyAt.getTime()) return false;
    const latest = addDaysInZone(dateFromDayKeyInZone(paymentDayKey, timeZone), GRACE_DAYS_AFTER_PAYMENT, timeZone);
    return dayKeyInZone(now, timeZone) <= dayKeyInZone(latest, timeZone);
  }
  function dueTimesheetSubmissionNotices(input) {
    const timeZone = zoneOrLondon(input.timeZone);
    const now = new Date(input.referenceIso);
    if (Number.isNaN(now.getTime())) return [];
    const found = /* @__PURE__ */ new Map();
    const consider = (notice, settings) => {
      const notifyAt = instantOnDay(notice.notifyDayKey, settings.notifyHour, settings.notifyMinute, timeZone);
      if (!isDue(now, notifyAt, notice.paymentDayKey, timeZone)) return;
      found.set(notice.occurrenceKey, notice);
    };
    if (input.paymentRunMode === "recurring_timeframe") {
      const settings = input.timesheetSubmission?.[0] ?? defaultTimesheetSubmissionFromPaymentWeekday(input.recurringPaymentDay || "friday");
      const anchors = [
        now,
        addDaysInZone(now, -8, timeZone),
        addDaysInZone(now, 8, timeZone)
      ];
      for (const anchor of anchors) {
        const period = invoicingPeriod({
          referenceIso: midnightInZone(anchor, timeZone).toISOString(),
          timeZone,
          paymentRunMode: "recurring_timeframe",
          recurringRunStartDay: input.recurringRunStartDay || "monday",
          recurringRunEndDay: input.recurringRunEndDay || "sunday"
        });
        const paymentDayKey = paymentWeekdayAfterPeriodEnd(period.endDayKey, input.recurringPaymentDay || "friday", timeZone);
        if (!paymentDayKey) continue;
        const instants = resolveRecurringInstants(paymentDayKey, settings, timeZone);
        consider(
          noticeFromInstants({
            runIndex: 0,
            paymentDayKey,
            deadlineDayKey: instants.deadlineDayKey,
            notifyDayKey: instants.notifyDayKey,
            settings,
            mode: "recurring_timeframe",
            paymentWeekday: input.recurringPaymentDay || "friday",
            timeZone
          }),
          settings
        );
      }
      return [...found.values()];
    }
    const paymentDays = paymentNumbers(input.paymentDates);
    const ranges = (input.paymentRunDateRanges ?? []).slice(0, 2);
    const { y, m } = partsInZone(now, timeZone);
    for (let monthOffset = -1; monthOffset <= 1; monthOffset += 1) {
      const month = shiftYearMonth(y, m, monthOffset);
      ranges.forEach((range, index) => {
        const endDay = Number(range?.endDay) || 0;
        if (endDay <= 0) return;
        const paymentDay = paymentDays[index] || 0;
        if (paymentDay <= 0) return;
        const periodEnd = clampMonthDayInZone(month.y, month.m, endDay, timeZone);
        const paymentDayKey = paymentDateAfterPeriodEnd(periodEnd, [paymentDay], timeZone);
        if (!paymentDayKey) return;
        const settings = input.timesheetSubmission?.[index] ?? defaultTimesheetSubmissionFromPaymentDay(paymentDay);
        const instants = resolveDateRangeInstants(paymentDayKey, settings, timeZone);
        consider(
          noticeFromInstants({
            runIndex: index,
            paymentDayKey,
            deadlineDayKey: instants.deadlineDayKey,
            notifyDayKey: instants.notifyDayKey,
            settings,
            mode: "date_ranges",
            timeZone
          }),
          settings
        );
      });
    }
    return [...found.values()];
  }

  // lib/canonical/scheduleOptions.ts
  function cleanItems(items) {
    if (!Array.isArray(items)) return [];
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const raw of items) {
      const name = typeof raw === "string" ? raw.trim() : "";
      if (!name) continue;
      const key2 = name.toLowerCase();
      if (seen.has(key2)) continue;
      seen.add(key2);
      out.push(name);
    }
    return out;
  }
  function enabledFlag(map, name) {
    if (!map) return true;
    if (typeof map[name] === "boolean") return map[name];
    const lower = name.toLowerCase();
    for (const [key2, value] of Object.entries(map)) {
      if (key2.trim().toLowerCase() === lower && typeof value === "boolean") return value;
    }
    return true;
  }
  function enabledScheduleLocations(options) {
    const opts = options ?? {};
    const rows = [];
    if (opts.showOffice !== false) rows.push({ id: "office", title: "Office", locationType: "office" });
    if (opts.showWorkingFromHome !== false) {
      rows.push({ id: "wfh", title: "Working from home", locationType: "working_from_home" });
    }
    if (opts.showSiteSurvey !== false) rows.push({ id: "survey", title: "Site survey", locationType: "site_survey" });
    for (const name of cleanItems(opts.customItems)) {
      if (!enabledFlag(opts.customItemEnabled, name)) continue;
      rows.push({ id: `custom:${name}`, title: name, locationType: "custom", customLocationName: name });
    }
    return rows;
  }
  function scheduleOptionsWriteFields(options) {
    const customItems = cleanItems(options.customItems);
    const customItemEnabled = {};
    for (const name of customItems) customItemEnabled[name] = enabledFlag(options.customItemEnabled, name);
    return {
      showOffice: options.showOffice !== false,
      showWorkingFromHome: options.showWorkingFromHome !== false,
      showSiteSurvey: options.showSiteSurvey !== false,
      customItems,
      customItemEnabled
    };
  }

  // lib/canonical/timesheetPeriod.ts
  var TIMESHEET_DOCUMENT_PREFIX = "timesheet_";
  var TIMESHEET_EXPORT_STORAGE_FOLDER = "timesheetExports";
  var TIMESHEET_SIGNED_AFTER_MS = Date.parse("2020-01-01T00:00:00.000Z");
  var TIMESHEET_INVOICE_EXPORT_LEFTOVER_MS = 6e4;
  function zoneOf3(timeZone) {
    return String(timeZone || "").trim() || CANONICAL_TIME_ZONE;
  }
  function trimmed2(value) {
    return String(value ?? "").trim();
  }
  function isDayKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }
  function timesheetTimestampMs(value) {
    if (value == null || value === "") return null;
    if (value instanceof Date) {
      const ms = value.getTime();
      return Number.isNaN(ms) ? null : ms;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value < 1e12 ? Math.round(value * 1e3) : Math.round(value);
    }
    if (typeof value === "string") {
      const ms = Date.parse(value);
      return Number.isNaN(ms) ? null : ms;
    }
    if (typeof value === "object") {
      const row = value;
      if (typeof row.toDate === "function") {
        try {
          const date = row.toDate();
          if (date instanceof Date && !Number.isNaN(date.getTime())) return date.getTime();
        } catch {
        }
      }
      const seconds = Number(row.seconds ?? row._seconds);
      if (Number.isFinite(seconds)) return Math.round(seconds * 1e3);
    }
    return null;
  }
  function realSignatureMs(value) {
    const ms = timesheetTimestampMs(value);
    if (ms == null || ms <= TIMESHEET_SIGNED_AFTER_MS) return null;
    return ms;
  }
  function timesheetDocumentId(userId, startDayKey, timeZone) {
    const uid = trimmed2(userId);
    if (!uid || !isDayKey(startDayKey)) return "";
    const stamp = unixStartOfDayInZone(dateFromDayKeyInZone(startDayKey, zoneOf3(timeZone)), zoneOf3(timeZone));
    return `${TIMESHEET_DOCUMENT_PREFIX}${uid}_${stamp}`;
  }
  function timesheetPeriodKey(period) {
    return `${period.startDayKey}|${period.endDayKey}`;
  }
  function timesheetPeriodFromInvoicing(input) {
    const timeZone = zoneOf3(input.timeZone);
    const reference = dateFromDayKeyInZone(input.referenceDayKey, timeZone);
    return invoicingPeriod({
      referenceIso: reference.toISOString(),
      timeZone,
      paymentRunMode: input.paymentRunMode,
      ranges: input.ranges,
      recurringRunStartDay: input.recurringRunStartDay,
      recurringRunEndDay: input.recurringRunEndDay
    });
  }
  function timesheetPeriodContainsDay(period, dayKey) {
    if (!isDayKey(period.startDayKey) || !isDayKey(period.endDayKey) || !isDayKey(dayKey)) return false;
    return dayKey >= period.startDayKey && dayKey <= period.endDayKey;
  }
  function resolveTimesheetPeriod(input) {
    const start = trimmed2(input.storedStartDayKey);
    const end = trimmed2(input.storedEndDayKey);
    if (isDayKey(start) && isDayKey(end)) return { startDayKey: start, endDayKey: end };
    if (isDayKey(start) && start === input.currentPeriod.startDayKey) return { ...input.currentPeriod };
    if (isDayKey(start)) return { startDayKey: start, endDayKey: start };
    return { ...input.currentPeriod };
  }
  function timesheetPeriodMatches(stored, period) {
    const start = trimmed2(stored.startDayKey);
    const end = trimmed2(stored.endDayKey);
    if (start !== period.startDayKey) return false;
    if (isDayKey(end)) return end === period.endDayKey;
    return true;
  }
  function timesheetBelongsToOrganization(storedOrganizationId, organizationId) {
    return organizationIdsMatch(storedOrganizationId, organizationId);
  }
  function isTimesheetOperativeSigned(fields) {
    if (fields.operativeSignedAtMs == null || fields.operativeSignedAtMs <= TIMESHEET_SIGNED_AFTER_MS) return false;
    return Boolean(trimmed2(fields.operativeSignedByName) || trimmed2(fields.operativeSignatureImageBase64));
  }
  function timesheetRequiresManagerCounterSign(hasLineManager) {
    return hasLineManager === true;
  }
  function isTimesheetManagerSigned(fields) {
    return fields.managerSignedAtMs != null && fields.managerSignedAtMs > TIMESHEET_SIGNED_AFTER_MS;
  }
  function isTimesheetFullySigned(fields, hasLineManager) {
    if (!isTimesheetOperativeSigned(fields)) return false;
    if (timesheetRequiresManagerCounterSign(hasLineManager)) return isTimesheetManagerSigned(fields);
    return true;
  }
  function isTimesheetAwaitingSignOff(fields, hasLineManager) {
    return timesheetRequiresManagerCounterSign(hasLineManager) && isTimesheetOperativeSigned(fields) && !isTimesheetManagerSigned(fields);
  }
  function resolveTimesheetExportedAtMs(data) {
    const exportedAt = realSignatureMs(data.exportedAt);
    if (exportedAt == null) return null;
    const invoiceGeneratedAt = timesheetTimestampMs(data.invoiceGeneratedAt);
    if (invoiceGeneratedAt != null && Math.abs(exportedAt - invoiceGeneratedAt) <= TIMESHEET_INVOICE_EXPORT_LEFTOVER_MS) {
      return null;
    }
    return exportedAt;
  }
  function isTimesheetExported(fields) {
    return fields.exportedAtMs != null && fields.exportedAtMs > TIMESHEET_SIGNED_AFTER_MS;
  }
  function timesheetListBucket(fields, hasLineManager) {
    if (isTimesheetExported(fields)) return "exported";
    if (isTimesheetFullySigned(fields, hasLineManager)) return "signed";
    if (isTimesheetAwaitingSignOff(fields, hasLineManager)) return "awaiting";
    return "unsigned";
  }
  function parseTimesheetStatusFields(data) {
    const row = data && typeof data === "object" ? data : {};
    const managerSignedAtMs = realSignatureMs(row.managerSignedAt) ?? realSignatureMs(row.approvedAt);
    return {
      operativeSignedAtMs: realSignatureMs(row.operativeSignedAt),
      operativeSignedByName: trimmed2(row.operativeSignedByName),
      operativeSignatureImageBase64: trimmed2(row.operativeSignatureImageBase64),
      managerSignedAtMs,
      managerSignedByName: trimmed2(row.managerSignedByName) || trimmed2(row.approvedByName),
      managerSignedByUserId: trimmed2(row.managerSignedByUserId),
      managerSignatureImageBase64: trimmed2(row.managerSignatureImageBase64),
      exportedAtMs: resolveTimesheetExportedAtMs(row)
    };
  }
  function timesheetSignOffWriteFields(input) {
    const signedAtMs = Number(input.signedAtMs);
    const name = trimmed2(input.signedByName);
    const signature = trimmed2(input.signatureImageBase64);
    if (input.role === "operative") {
      return {
        operativeSignedAtMs: signedAtMs,
        operativeSignedByName: name,
        operativeSignatureImageBase64: signature
      };
    }
    return {
      managerSignedAtMs: signedAtMs,
      managerSignedByName: name,
      managerSignedByUserId: trimmed2(input.signedByUserId),
      managerSignatureImageBase64: signature,
      approvedAtMs: signedAtMs,
      approvedByName: name
    };
  }
  function timesheetExportWriteFields(exportedAtMs) {
    return { exportedAtMs: Number(exportedAtMs) };
  }
  function timesheetPeriodWriteFields(input) {
    return {
      userId: trimmed2(input.userId),
      weekStartKey: trimmed2(input.startDayKey),
      weekEndKey: trimmed2(input.endDayKey)
    };
  }
  function timesheetExportStoragePath(organizationId, fileName, stampSeconds) {
    const org = trimmed2(organizationId);
    const safe = trimmed2(fileName).replace(/\s+/g, "_");
    const stamp = Math.max(0, Math.floor(Number(stampSeconds) || 0));
    return `organizations/${org}/${TIMESHEET_EXPORT_STORAGE_FOLDER}/${stamp}_${safe}`;
  }
  function timesheetStatusWriteFields(fields) {
    const managerMs = fields.managerSignedAtMs;
    return {
      operativeSignedAtMs: fields.operativeSignedAtMs,
      operativeSignedByName: trimmed2(fields.operativeSignedByName),
      operativeSignatureImageBase64: trimmed2(fields.operativeSignatureImageBase64),
      managerSignedAtMs: managerMs,
      managerSignedByName: trimmed2(fields.managerSignedByName),
      managerSignedByUserId: trimmed2(fields.managerSignedByUserId),
      managerSignatureImageBase64: trimmed2(fields.managerSignatureImageBase64),
      approvedAtMs: managerMs,
      approvedByName: trimmed2(fields.managerSignedByName),
      exportedAtMs: fields.exportedAtMs
    };
  }
  function pickTimesheetRowForPeriod(rows, period) {
    if (rows.length === 0) return -1;
    const exact = [];
    const startOnly = [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (trimmed2(row.startDayKey) !== period.startDayKey) continue;
      const end = trimmed2(row.endDayKey);
      if (isDayKey(end)) {
        if (end === period.endDayKey) exact.push(index);
        continue;
      }
      startOnly.push(index);
    }
    const withActivity = (indexes) => indexes.find((index) => rows[index]?.hasActivity === true);
    return withActivity(exact) ?? exact[0] ?? withActivity(startOnly) ?? startOnly[0] ?? -1;
  }
  function paymentRunWindowFingerprint(window) {
    if (String(window.paymentRunMode || "") === "recurring_timeframe") {
      return `recurring:${trimmed2(window.recurringRunStartDay).toLowerCase() || "monday"}:${trimmed2(window.recurringRunEndDay).toLowerCase() || "sunday"}`;
    }
    const ranges = (window.ranges ?? []).map((row) => normalizePaymentRunRange(row)).filter((row) => row != null).map((row) => `${row.startDay}-${row.endDay}`);
    return `dates:${ranges.join("|")}`;
  }
  function paymentRunHistoryAfterChange(input) {
    const existing = [...input.existingHistory ?? []];
    if (paymentRunWindowFingerprint(input.previous) === paymentRunWindowFingerprint(input.next)) {
      return existing;
    }
    const snapshot = {
      paymentRunMode: input.previous.paymentRunMode === "recurring_timeframe" ? "recurring_timeframe" : "date_ranges",
      ranges: (input.previous.ranges ?? []).map((row) => normalizePaymentRunRange(row)).filter((row) => row != null),
      recurringRunStartDay: trimmed2(input.previous.recurringRunStartDay) || "monday",
      recurringRunEndDay: trimmed2(input.previous.recurringRunEndDay) || "sunday",
      recordedAtDayKey: trimmed2(input.recordedAtDayKey)
    };
    const fingerprint = paymentRunWindowFingerprint(snapshot);
    const rest = existing.filter((row) => paymentRunWindowFingerprint(row) !== fingerprint);
    return [snapshot, ...rest].slice(0, 24);
  }
  function timesheetPaymentRunPeriodsFromWindow(input) {
    const timeZone = zoneOf3(input.timeZone);
    const lookback = Math.max(0, Math.min(Number(input.lookbackCount) || 0, 240));
    const current = timesheetPeriodFromInvoicing(input);
    const periods = input.includeCurrent === false ? [] : [current];
    let cursor = current.startDayKey;
    for (let step = 0; step < lookback; step += 1) {
      const previousRef = addDaysInZone(dateFromDayKeyInZone(cursor, timeZone), -1, timeZone);
      const previous = invoicingPeriod({
        referenceIso: previousRef.toISOString(),
        timeZone,
        paymentRunMode: input.paymentRunMode,
        ranges: input.ranges,
        recurringRunStartDay: input.recurringRunStartDay,
        recurringRunEndDay: input.recurringRunEndDay
      });
      if (previous.startDayKey === cursor) break;
      periods.push(previous);
      cursor = previous.startDayKey;
    }
    return periods;
  }
  function selectableTimesheetPaymentRunPeriods(input) {
    const lookback = input.lookbackCount ?? 120;
    const seen = /* @__PURE__ */ new Set();
    const periods = [];
    const add = (period, source) => {
      if (!isDayKey(period.startDayKey) || !isDayKey(period.endDayKey)) return;
      const key2 = timesheetPeriodKey(period);
      if (seen.has(key2)) return;
      seen.add(key2);
      periods.push({ startDayKey: period.startDayKey, endDayKey: period.endDayKey, source });
    };
    for (const period of timesheetPaymentRunPeriodsFromWindow({
      ...input.current,
      referenceDayKey: input.referenceDayKey,
      lookbackCount: lookback,
      timeZone: input.timeZone
    })) {
      add(period, "current");
    }
    for (const window of input.historicalWindows ?? []) {
      for (const period of timesheetPaymentRunPeriodsFromWindow({
        paymentRunMode: window.paymentRunMode,
        ranges: window.ranges,
        recurringRunStartDay: window.recurringRunStartDay,
        recurringRunEndDay: window.recurringRunEndDay,
        referenceDayKey: input.referenceDayKey,
        lookbackCount: lookback,
        timeZone: input.timeZone
      })) {
        add(period, "historical");
      }
    }
    for (const period of input.observedPeriods ?? []) {
      add(period, "observed");
    }
    periods.sort((left, right) => {
      if (left.startDayKey !== right.startDayKey) return right.startDayKey.localeCompare(left.startDayKey);
      return right.endDayKey.localeCompare(left.endDayKey);
    });
    return periods;
  }
  function parsePaymentRunHistory(raw) {
    if (!Array.isArray(raw)) return [];
    const rows = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const data = entry;
      const mode = String(data.paymentRunMode || "") === "recurring_timeframe" ? "recurring_timeframe" : "date_ranges";
      const rangeRows = Array.isArray(data.paymentRunDateRanges) ? data.paymentRunDateRanges : Array.isArray(data.ranges) ? data.ranges : [];
      const ranges = rangeRows.map((row) => normalizePaymentRunRange(row || {})).filter((row) => row != null);
      const recordedAtDayKey = trimmed2(data.recordedAtDayKey);
      rows.push({
        paymentRunMode: mode,
        ranges,
        recurringRunStartDay: trimmed2(data.recurringRunStartDay) || "monday",
        recurringRunEndDay: trimmed2(data.recurringRunEndDay) || "sunday",
        recordedAtDayKey: isDayKey(recordedAtDayKey) ? recordedAtDayKey : ""
      });
    }
    return rows;
  }
  function paymentRunHistoryToFirestore(history) {
    return history.map((window) => ({
      paymentRunMode: window.paymentRunMode,
      paymentRunDateRanges: (window.ranges ?? []).map((range) => {
        const normalized = normalizePaymentRunRange(range) ?? { startDay: 0, endDay: 0 };
        return {
          startDay: normalized.startDay,
          endDay: normalized.endDay,
          startDate: normalized.startDay,
          endDate: normalized.endDay
        };
      }),
      recurringRunStartDay: window.recurringRunStartDay || "monday",
      recurringRunEndDay: window.recurringRunEndDay || "sunday",
      recordedAtDayKey: window.recordedAtDayKey
    }));
  }
  function timesheetStoredStartDayKey(weekStart, timeZone) {
    const ms = timesheetTimestampMs(weekStart);
    if (ms == null) return "";
    return dayKeyInZone(new Date(ms), zoneOf3(timeZone));
  }

  // lib/canonical/organizationSettings.ts
  function starterCollectionShouldSeed(existingDocumentCount) {
    return existingDocumentCount === 0;
  }
  function missingStarterQualificationCodes(existingDocumentIds, libraryCodes) {
    const have = new Set(existingDocumentIds.map((id2) => String(id2 || "").trim()).filter(Boolean));
    return libraryCodes.filter((code) => {
      const id2 = String(code || "").trim();
      return Boolean(id2) && !have.has(id2);
    });
  }
  var WEEKEND_FIELD_FALLBACK = {
    allHoursAtMultiplierMode: false,
    allHoursMultiplier: 2,
    definedWindowStart: "07:30",
    definedWindowEnd: "16:00",
    countsAsStandardHours: 8,
    outsideWindowMultiplier: 1.5,
    sameAsSaturday: false
  };
  var DEFAULT_SATURDAY_PAYROLL = {
    allHoursAtMultiplierMode: false,
    allHoursMultiplier: 2,
    definedWindowStart: "07:30",
    definedWindowEnd: "13:00",
    countsAsStandardHours: 8,
    outsideWindowMultiplier: 2,
    sameAsSaturday: false
  };
  var DEFAULT_SUNDAY_PAYROLL = {
    allHoursAtMultiplierMode: true,
    allHoursMultiplier: 2,
    definedWindowStart: "07:30",
    definedWindowEnd: "16:00",
    countsAsStandardHours: 8,
    outsideWindowMultiplier: 2,
    sameAsSaturday: false
  };
  var DEFAULT_PAYROLL_POLICY = {
    standardDayStart: "07:30",
    standardDayEnd: "16:00",
    unpaidBreakMinutes: 30,
    standardPaidHours: 8,
    breakWindowStart: "12:00",
    breakWindowEnd: "12:30",
    weekdayOutsideStandardMultiplier: 1.5,
    saturday: { ...DEFAULT_SATURDAY_PAYROLL },
    sunday: { ...DEFAULT_SUNDAY_PAYROLL }
  };
  var DEFAULT_PAYMENT_RUN_DATE_RANGES = CANONICAL_HALF_MONTH_RANGES.map((range) => ({
    ...range
  }));
  var DEFAULT_WARNING_DETECTION = {
    detectClashes: true,
    clashLookaheadMode: "numberOfDays",
    clashLookaheadDays: 7,
    includeWeekendsForUnbookedLabour: false,
    excludedUserIdsFromUnbookedWarnings: []
  };
  var DEFAULT_INVOICING = {
    paymentRunMode: "date_ranges",
    paymentDateMode: "specific_dates",
    recurringRunStartDay: "monday",
    recurringRunEndDay: "sunday",
    recurringPaymentDay: "friday",
    paymentRunDateRanges: DEFAULT_PAYMENT_RUN_DATE_RANGES.map((range) => ({ ...range })),
    paymentDates: [],
    noteToUsers: "If your timesheet displays 0 against your rate, then your day/hourly rate hasn't been set by your line manager",
    timesheetSubmission: [],
    paymentRunHistory: []
  };
  function parseOrganizationName(data) {
    if (!data) return "";
    const settings = asSettingsRecord(data.settings);
    const candidates = [
      data.name,
      data.organizationName,
      data.organisationName,
      data.companyName,
      settings?.name,
      settings?.organizationName,
      settings?.organisationName,
      settings?.companyName
    ];
    for (const value of candidates) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  }
  function organizationNameToFirestore(name) {
    const trimmed6 = String(name || "").trim();
    return trimmed6 ? { name: trimmed6 } : {};
  }
  function organizationNameWriteFields(nextName, existingName) {
    const next = String(nextName || "").trim();
    if (next) return { name: next };
    void existingName;
    return {};
  }
  function coalesceOrganizationName(...candidates) {
    for (const value of candidates) {
      const trimmed6 = String(value || "").trim();
      if (trimmed6) return trimmed6;
    }
    return "";
  }
  function displayOrganizationName(name, fallback = "Organisation") {
    const trimmed6 = String(name || "").trim();
    return trimmed6 || fallback;
  }
  function paymentRunShowsMonthCoverage(settings) {
    return settings.paymentRunMode === "date_ranges";
  }
  function parsePaymentRunMode(value) {
    return String(value || "").trim() === "recurring_timeframe" ? "recurring_timeframe" : "date_ranges";
  }
  function parsePaymentDateMode(value, paymentRunMode) {
    if (paymentRunMode === "date_ranges") return "specific_dates";
    return String(value || "").trim() === "specific_dates" ? "specific_dates" : "recurring_date";
  }
  var DEFAULT_MATERIAL_CUT_OFF = {
    materialOrderCutOff: true,
    materialCutOffHour: 16,
    materialCutOffMinute: 0,
    materialCutOffOnSaturday: false,
    materialCutOffOnSunday: false
  };
  var MONTH_DAYS = 31;
  function firstPresent(data, keys, fallback) {
    for (const key2 of keys) {
      if (data[key2] != null && data[key2] !== "") return data[key2];
    }
    return fallback;
  }
  function asSettingsRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
    return value;
  }
  function parseDayOfMonth(value) {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1 && n <= 31) return n;
    return 0;
  }
  function stringIdList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((id2) => String(id2).trim()).filter(Boolean);
  }
  function parseWeekend(data, dayDefault) {
    if (!data || typeof data !== "object") return { ...dayDefault };
    const fallback = WEEKEND_FIELD_FALLBACK;
    return {
      allHoursAtMultiplierMode: data.allHoursAtMultiplierMode === true,
      allHoursMultiplier: Number(data.allHoursMultiplier ?? fallback.allHoursMultiplier),
      definedWindowStart: String(
        firstPresent(data, ["customStandardStart", "definedWindowStart"], fallback.definedWindowStart ?? "07:30")
      ),
      definedWindowEnd: String(
        firstPresent(data, ["customStandardEnd", "definedWindowEnd"], fallback.definedWindowEnd ?? "16:00")
      ),
      countsAsStandardHours: Number(
        firstPresent(data, ["countsAsHours", "countsAsStandardHours"], fallback.countsAsStandardHours ?? 8)
      ),
      outsideWindowMultiplier: Number(
        firstPresent(
          data,
          ["outsideStandardWindowMultiplier", "outsideWindowMultiplier"],
          fallback.outsideWindowMultiplier ?? 1.5
        )
      ),
      sameAsSaturday: false
    };
  }
  function weekendToFirestore(weekend) {
    return {
      allHoursAtMultiplierMode: weekend.allHoursAtMultiplierMode,
      allHoursMultiplier: weekend.allHoursMultiplier,
      useCustomStandardDayWindow: !weekend.allHoursAtMultiplierMode,
      customStandardStart: weekend.definedWindowStart ?? "07:30",
      customStandardEnd: weekend.definedWindowEnd ?? "16:00",
      countsAsHours: weekend.countsAsStandardHours ?? 8,
      outsideStandardWindowMultiplier: weekend.outsideWindowMultiplier ?? 1.5
    };
  }
  function parsePayrollPolicy(data) {
    if (!data) {
      return { ...DEFAULT_PAYROLL_POLICY, saturday: { ...DEFAULT_SATURDAY_PAYROLL }, sunday: { ...DEFAULT_SUNDAY_PAYROLL } };
    }
    return {
      standardDayStart: String(data.standardDayStart ?? DEFAULT_PAYROLL_POLICY.standardDayStart),
      standardDayEnd: String(data.standardDayEnd ?? DEFAULT_PAYROLL_POLICY.standardDayEnd),
      unpaidBreakMinutes: Number(data.unpaidBreakMinutes ?? DEFAULT_PAYROLL_POLICY.unpaidBreakMinutes),
      standardPaidHours: Number(data.standardPaidHours ?? DEFAULT_PAYROLL_POLICY.standardPaidHours),
      breakWindowStart: String(data.breakWindowStart ?? DEFAULT_PAYROLL_POLICY.breakWindowStart),
      breakWindowEnd: String(data.breakWindowEnd ?? DEFAULT_PAYROLL_POLICY.breakWindowEnd),
      weekdayOutsideStandardMultiplier: Number(
        data.weekdayOutsideStandardMultiplier ?? DEFAULT_PAYROLL_POLICY.weekdayOutsideStandardMultiplier
      ),
      saturday: parseWeekend(data.saturday, DEFAULT_SATURDAY_PAYROLL),
      sunday: (() => {
        const sunday = parseWeekend(data.sunday, DEFAULT_SUNDAY_PAYROLL);
        const sunRaw = data.sunday;
        const same = data.sundaySameAsSaturday === true || data.sundaySameAsSaturday == null && sunRaw?.sameAsSaturday === true;
        return { ...sunday, sameAsSaturday: same };
      })(),
      breakPaid: data.breakPaid === true
    };
  }
  function payrollPolicyToFirestore(policy) {
    return {
      standardDayStart: policy.standardDayStart,
      standardDayEnd: policy.standardDayEnd,
      unpaidBreakMinutes: policy.unpaidBreakMinutes,
      standardPaidHours: policy.standardPaidHours,
      breakWindowStart: policy.breakWindowStart,
      breakWindowEnd: policy.breakWindowEnd,
      weekdayOutsideStandardMultiplier: policy.weekdayOutsideStandardMultiplier,
      saturday: weekendToFirestore(policy.saturday),
      sunday: weekendToFirestore({ ...policy.sunday, sameAsSaturday: false }),
      sundaySameAsSaturday: policy.sunday.sameAsSaturday === true,
      breakPaid: policy.breakPaid === true
    };
  }
  function parsePaymentRunDateRanges(data) {
    const raw = data?.paymentRunDateRanges;
    if (!Array.isArray(raw) || raw.length === 0) {
      return DEFAULT_PAYMENT_RUN_DATE_RANGES.map((range) => ({ ...range }));
    }
    const ranges = raw.slice(0, 2).map((entry) => {
      const normalized = normalizePaymentRunRange(entry || {});
      return normalized ?? { startDay: 0, endDay: 0 };
    });
    while (ranges.length < 2) ranges.push({ startDay: 0, endDay: 0 });
    return ranges;
  }
  function paymentRunRangeToFirestore(range) {
    return {
      startDay: range.startDay,
      endDay: range.endDay,
      startDate: range.startDay,
      endDate: range.endDay
    };
  }
  function clampClashLookaheadDays(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const rec = value;
      if (rec.integerValue != null) return clampClashLookaheadDays(rec.integerValue);
      if (rec.doubleValue != null) return clampClashLookaheadDays(rec.doubleValue);
    }
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return DEFAULT_WARNING_DETECTION.clashLookaheadDays;
    return Math.max(1, Math.min(365, Math.round(n)));
  }
  function parseClashLookaheadMode(value) {
    const mode = String(value || "").trim();
    if (mode === "numberOfDays" || mode === "days") return "numberOfDays";
    if (mode === "endOfInvoicingPeriod" || mode === "invoicing") return "endOfInvoicingPeriod";
    if (mode === "endOfWorkingWeek" || mode === "week") return "endOfWorkingWeek";
    return DEFAULT_WARNING_DETECTION.clashLookaheadMode;
  }
  function excludedUnbookedUserIds(record3) {
    if (Array.isArray(record3.excludedUserIdsFromUnbookedWarnings)) {
      return stringIdList(record3.excludedUserIdsFromUnbookedWarnings);
    }
    for (const key2 of ["excludedUserIds", "excludedUsers", "excludedUserIdsFromWarnings", "unbookedWarningExcludedUserIds"]) {
      if (Array.isArray(record3[key2])) return stringIdList(record3[key2]);
    }
    return [];
  }
  function parseWarningDetection(data) {
    const record3 = asSettingsRecord(data);
    if (!record3) return { ...DEFAULT_WARNING_DETECTION, excludedUserIdsFromUnbookedWarnings: [] };
    const daysRaw = record3.clashLookaheadDays ?? record3.lookaheadDays ?? record3.lookAheadDays ?? record3.numberOfDays ?? record3.daysAhead;
    const days = daysRaw === void 0 || daysRaw === null ? DEFAULT_WARNING_DETECTION.clashLookaheadDays : daysRaw;
    const clashLookaheadMode = parseClashLookaheadMode(
      record3.clashLookaheadMode ?? record3.lookAheadMode ?? record3.lookaheadMode
    );
    const fallback = lookaheadDaysFallback(daysRaw);
    const parsed = {
      detectClashes: record3.detectClashes !== false,
      clashLookaheadMode,
      clashLookaheadDays: fallback ? DEFAULT_WARNING_DETECTION.clashLookaheadDays : clampClashLookaheadDays(days),
      includeWeekendsForUnbookedLabour: Boolean(record3.includeWeekendsForUnbookedLabour),
      excludedUserIdsFromUnbookedWarnings: excludedUnbookedUserIds(record3)
    };
    if (fallback && clashLookaheadMode === "numberOfDays") parsed.clashLookaheadDaysFallback = fallback;
    return parsed;
  }
  function lookaheadDaysFallback(raw) {
    if (raw === void 0 || raw === null || typeof raw === "string" && raw.trim() === "") return "lookaheadDaysMissing";
    let value = raw;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const rec = value;
      value = rec.integerValue ?? rec.doubleValue;
    }
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || Math.round(n) < 1) return "lookaheadDaysInvalid";
    return void 0;
  }
  function warningDetectionToFirestore(settings) {
    return {
      detectClashes: settings.detectClashes,
      clashLookaheadMode: settings.clashLookaheadMode,
      clashLookaheadDays: clampClashLookaheadDays(settings.clashLookaheadDays),
      includeWeekendsForUnbookedLabour: settings.includeWeekendsForUnbookedLabour,
      excludedUserIdsFromUnbookedWarnings: settings.excludedUserIdsFromUnbookedWarnings
    };
  }
  function parseInvoicing(data) {
    if (!data) {
      return {
        ...DEFAULT_INVOICING,
        paymentRunDateRanges: DEFAULT_PAYMENT_RUN_DATE_RANGES.map((range) => ({ ...range }))
      };
    }
    const paymentRunMode = parsePaymentRunMode(data.paymentRunMode);
    const paymentDateMode = parsePaymentDateMode(data.paymentDateMode, paymentRunMode);
    const paymentDates = Array.isArray(data.paymentDates) ? data.paymentDates.map((d) => String(parseDayOfMonth(d) || Number(d) || "")).filter(Boolean) : [];
    const timesheetSubmission = parseTimesheetSubmissionList({
      paymentRunMode,
      paymentDates,
      recurringPaymentDay: String(data.recurringPaymentDay ?? DEFAULT_INVOICING.recurringPaymentDay),
      timesheetSubmission: data.timesheetSubmission,
      paymentRunDateRanges: data.paymentRunDateRanges,
      invoicingRoot: data
    });
    return {
      paymentRunMode,
      paymentDateMode,
      recurringRunStartDay: String(data.recurringRunStartDay ?? DEFAULT_INVOICING.recurringRunStartDay),
      recurringRunEndDay: String(data.recurringRunEndDay ?? DEFAULT_INVOICING.recurringRunEndDay),
      recurringPaymentDay: String(data.recurringPaymentDay ?? DEFAULT_INVOICING.recurringPaymentDay),
      paymentRunDateRanges: parsePaymentRunDateRanges(data),
      paymentDates,
      noteToUsers: String(data.noteToUsers ?? DEFAULT_INVOICING.noteToUsers),
      timesheetSubmission,
      paymentRunHistory: parsePaymentRunHistory(data.paymentRunHistory)
    };
  }
  function capitalizeWeekday(day) {
    if (!day) return day;
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
  function invoicingToFirestore(settings) {
    const timesheetSubmission = settings.timesheetSubmission.map(timesheetSubmissionToFirestore);
    const payload = {
      paymentRunMode: settings.paymentRunMode,
      paymentDateMode: settings.paymentDateMode,
      paymentRunDateRanges: settings.paymentRunDateRanges.map((range, index) => {
        const row = paymentRunRangeToFirestore(range);
        const timesheet = timesheetSubmission[index];
        return timesheet ? { ...row, ...timesheet } : row;
      }),
      paymentDates: settings.paymentDates.map((d) => Number(d)),
      noteToUsers: settings.noteToUsers,
      recurringPaymentRunSummary: `In arrears: ${capitalizeWeekday(settings.recurringRunStartDay)} to ${capitalizeWeekday(settings.recurringRunEndDay)} (of the previous week)`,
      recurringRunStartDay: settings.recurringRunStartDay,
      recurringRunEndDay: settings.recurringRunEndDay,
      recurringPaymentDay: settings.recurringPaymentDay,
      timesheetSubmission,
      paymentRunHistory: paymentRunHistoryToFirestore(settings.paymentRunHistory ?? [])
    };
    if (settings.paymentRunMode === "recurring_timeframe" && timesheetSubmission[0]) {
      const recurring = timesheetSubmission[0];
      payload.timesheetDeadlineWeekday = recurring.timesheetDeadlineWeekday;
      payload.timesheetDeadlineHour = recurring.timesheetDeadlineHour;
      payload.timesheetDeadlineMinute = recurring.timesheetDeadlineMinute;
      payload.notifyWeekday = recurring.notifyWeekday;
      payload.notifyHour = recurring.notifyHour;
      payload.notifyMinute = recurring.notifyMinute;
      payload.notifyCustomised = recurring.notifyCustomised;
    }
    return payload;
  }
  function cutOffClockNumber(value, fallback, min, max) {
    if (value == null || value === "") return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(n)));
  }
  function parseMaterialCutOff(data) {
    const raw = asSettingsRecord(data);
    if (!raw) return { ...DEFAULT_MATERIAL_CUT_OFF };
    return {
      materialOrderCutOff: raw.materialOrderCutOff !== false,
      materialCutOffHour: cutOffClockNumber(
        raw.materialCutOffHour,
        DEFAULT_MATERIAL_CUT_OFF.materialCutOffHour,
        0,
        23
      ),
      materialCutOffMinute: cutOffClockNumber(
        raw.materialCutOffMinute,
        DEFAULT_MATERIAL_CUT_OFF.materialCutOffMinute,
        0,
        59
      ),
      materialCutOffOnSaturday: raw.materialCutOffOnSaturday === true,
      materialCutOffOnSunday: raw.materialCutOffOnSunday === true
    };
  }
  function resolveMaterialCutOffClock(input = {}) {
    const settings = asSettingsRecord(input.organizationSettings);
    const fromOrg = asSettingsRecord(input.organizationMaterialCutOff) ?? (settings ? asSettingsRecord(settings.materialCutOff) : void 0);
    return parseMaterialCutOff(fromOrg);
  }
  function materialCutOffClockMinutes(clock) {
    return clock.materialCutOffHour * 60 + clock.materialCutOffMinute;
  }
  function formatMaterialCutOffClock(clock) {
    return formatClockMinutes(materialCutOffClockMinutes(clock));
  }
  function materialCutOffToFirestore(prefs) {
    return {
      materialOrderCutOff: prefs.materialOrderCutOff,
      materialCutOffHour: prefs.materialCutOffHour,
      materialCutOffMinute: prefs.materialCutOffMinute,
      materialCutOffOnSaturday: prefs.materialCutOffOnSaturday,
      materialCutOffOnSunday: prefs.materialCutOffOnSunday
    };
  }
  var PAYMENT_RUN_1_LAST_END_DAY = 27;
  function isValidDay(day) {
    return Number.isInteger(day) && day >= 1 && day <= MONTH_DAYS;
  }
  function validatePaymentRunDateRanges(ranges) {
    if (ranges.length < 2) {
      return "Set two payment run date ranges that together cover every day of the month.";
    }
    const [run1, run2] = ranges;
    if (!isValidDay(run1.startDay) || !isValidDay(run1.endDay)) {
      return "Payment run 1 needs a start and end day (1\u201331).";
    }
    if (!isValidDay(run2.startDay) || !isValidDay(run2.endDay)) {
      return "Payment run 2 needs a start and end day (1\u201331).";
    }
    if (run1.startDay > run1.endDay) return "Payment run 1: start day must be on or before end day.";
    if (run2.startDay > run2.endDay) return "Payment run 2: start day must be on or before end day.";
    if (run1.startDay !== 1) return "Payment run 1 must start on day 1 of the month.";
    if (run1.endDay >= PAYMENT_RUN_1_LAST_END_DAY + 1) {
      return `Payment run 1 must end on or before the ${PAYMENT_RUN_1_LAST_END_DAY}th, so run 2 exists in every month (February can have 28 days).`;
    }
    if (run2.endDay !== MONTH_DAYS) {
      return `Payment run 2 must end on day ${MONTH_DAYS} so all days of the month are covered.`;
    }
    if (run2.startDay !== run1.endDay + 1) {
      return "Payment runs must not overlap \u2014 run 2 should start the day after run 1 ends (e.g. 1\u201315 then 16\u201331).";
    }
    const covered = /* @__PURE__ */ new Set();
    for (const range of ranges) {
      for (let day = range.startDay; day <= range.endDay; day += 1) {
        if (covered.has(day)) {
          return "Payment run date ranges overlap. Each day of the month must belong to exactly one run.";
        }
        covered.add(day);
      }
    }
    if (covered.size !== MONTH_DAYS) {
      return `All ${MONTH_DAYS} days of the month must be covered across your payment runs.`;
    }
    return null;
  }
  function validatePaymentDates(paymentDates, expectedCount) {
    if (paymentDates.length < expectedCount) {
      return `Set ${expectedCount} payment date${expectedCount === 1 ? "" : "s"} \u2014 one for each payment run.`;
    }
    for (let i = 0; i < expectedCount; i += 1) {
      if (!isValidDay(paymentDates[i])) {
        return `Payment date ${i + 1} must be a day of the month (1\u201331).`;
      }
    }
    return null;
  }
  function validateInvoicingSettings(settings) {
    if (settings.paymentRunMode === "date_ranges") {
      const rangeError = validatePaymentRunDateRanges(settings.paymentRunDateRanges);
      if (rangeError) return rangeError;
      if (settings.paymentDateMode !== "specific_dates") {
        return "Choose payment date/s when using payment run date ranges.";
      }
      const paymentDays = settings.paymentDates.map((d) => Number(d)).filter((d) => Number.isFinite(d) && d > 0);
      return validatePaymentDates(paymentDays, 2);
    }
    if (settings.paymentRunMode === "recurring_timeframe") {
      if (!settings.recurringRunStartDay || !settings.recurringRunEndDay) {
        return "Choose a start day and end day for your recurring payment run.";
      }
      if (settings.paymentDateMode === "recurring_date" && !settings.recurringPaymentDay) {
        return "Choose a recurring payment date.";
      }
      if (settings.paymentDateMode === "specific_dates") {
        const paymentDays = settings.paymentDates.map((d) => Number(d)).filter((d) => Number.isFinite(d) && d > 0);
        if (paymentDays.length < 1) return "Set at least one payment date.";
        for (const day of paymentDays) {
          if (!isValidDay(day)) return "Each payment date must be a day of the month (1\u201331).";
        }
      }
    }
    return null;
  }

  // lib/canonical/userProfile.ts
  var USER_DOCUMENT_FIELDS = [
    "firstName",
    "surname",
    "email",
    "mobileNumber",
    "role",
    "isActive",
    "passwordSet",
    "status",
    "isSuperAdmin",
    "organizationId",
    "permissions",
    "assignedManagerUserId",
    "assignedManagerUserIds",
    "hasNoLineManager",
    "dayRate",
    "hourlyRate",
    "payBasis",
    "tradeTypePreset",
    "tradeTypeCustom",
    "employmentType",
    "employmentTypeTransitionFrom",
    "employmentTypeEffectiveAt",
    "annualLeaveEnabled",
    "annualLeaveDaysPerYear",
    "annualLeaveYearStartMonth",
    "annualLeaveYearEndMonth",
    "annualLeaveCarriesOver",
    "annualLeaveYearAllowance",
    "annualLeaveYearAllowanceKey",
    "timesheetsEnabled",
    // vatNumber and utrNumber live at users/{uid}/private/taxIds (sensitiveProfile.ts).
    "lastSeenAt",
    "profilePhotoURL",
    "pushTokens",
    "pushTokenUpdatedAt",
    "notificationPreferences",
    "formerUserIds"
  ];
  var USER_FORMER_IDS_FIELD = "formerUserIds";
  function parseFormerUserIds(data) {
    const raw = data?.[USER_FORMER_IDS_FIELD];
    if (!Array.isArray(raw)) return [];
    const ids = /* @__PURE__ */ new Set();
    for (const value of raw) {
      const id2 = typeof value === "string" ? value.trim() : "";
      if (id2) ids.add(id2);
    }
    return [...ids];
  }
  function inviteMigrationFormerIdWriteFields(input) {
    const ids = parseFormerUserIds(input.existing);
    const placeholder = String(input.placeholderId || "").trim();
    if (placeholder && placeholder !== input.authUid.trim() && !ids.includes(placeholder)) ids.push(placeholder);
    return ids.length > 0 ? { [USER_FORMER_IDS_FIELD]: ids } : {};
  }
  var USER_SELF_CREATE_AGE_FIELDS = [
    "ageConfirmed",
    "ageConfirmedAt",
    "ageConfirmedYears"
  ];
  function userCreateRequiresAgeConfirmation(input) {
    const creator = typeof input.creatorUserId === "string" ? input.creatorUserId.trim() : "";
    const target = typeof input.targetUserId === "string" ? input.targetUserId.trim() : "";
    return creator.length > 0 && creator === target;
  }
  function normalizeEmploymentType(raw) {
    if (raw === "paye") return "paye";
    if (raw === "self_employed" || raw === "selfEmployed") return "self_employed";
    return "self_employed";
  }
  function accountKindFromFlags(flags) {
    if (flags.isSuperAdmin) return "admin";
    if (flags.adminAccess || flags.role === "admin") return "admin";
    if (flags.operativeMode) return "operative";
    return "manager";
  }
  function validDay(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? void 0 : value;
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? void 0 : parsed;
    }
    return void 0;
  }
  function employmentTypeOnDay(user, date, timeZone) {
    const current = normalizeEmploymentType(user.employmentType);
    const from = user.employmentTypeTransitionFrom;
    const day = validDay(date);
    const effectiveAt = validDay(user.employmentTypeEffectiveAt);
    if (!from || !day || !effectiveAt) return current;
    const zone3 = zoneOrLondon(timeZone);
    if (dayKeyInZone(day, zone3) < dayKeyInZone(effectiveAt, zone3)) {
      return normalizeEmploymentType(from);
    }
    return current;
  }
  function isBillableSelfEmployedDay(user, date, timeZone) {
    return employmentTypeOnDay(user, date, timeZone) === "self_employed";
  }
  function applyEmploymentTypeChange(input) {
    const next = normalizeEmploymentType(input.nextType);
    const previous = normalizeEmploymentType(input.previousType);
    if (next === previous) {
      const existing = validDay(input.previousEffectiveAt);
      return {
        employmentType: next,
        employmentTypeTransitionFrom: input.previousTransitionFrom ? String(input.previousTransitionFrom) : null,
        employmentTypeEffectiveAt: existing ?? null
      };
    }
    const zone3 = zoneOrLondon(input.timeZone);
    const todayKey2 = dayKeyInZone(input.now ?? /* @__PURE__ */ new Date(), zone3);
    if (input.effectiveAt === "immediate") {
      return { employmentType: next, employmentTypeTransitionFrom: null, employmentTypeEffectiveAt: null };
    }
    const when = validDay(input.effectiveAt);
    if (!when || dayKeyInZone(when, zone3) <= todayKey2) {
      return { employmentType: next, employmentTypeTransitionFrom: null, employmentTypeEffectiveAt: null };
    }
    return {
      employmentType: next,
      employmentTypeTransitionFrom: previous,
      employmentTypeEffectiveAt: when
    };
  }
  function employmentEffectiveLabel(user, now = /* @__PURE__ */ new Date(), timeZone) {
    const effectiveAt = validDay(user.employmentTypeEffectiveAt);
    if (!effectiveAt || !user.employmentTypeTransitionFrom) return "Effective immediately";
    const zone3 = zoneOrLondon(timeZone);
    if (dayKeyInZone(now, zone3) >= dayKeyInZone(effectiveAt, zone3)) return "Effective immediately";
    const [year, month, day] = dayKeyInZone(effectiveAt, zone3).split("-").map(Number);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${day} ${months[(month || 1) - 1]} ${year}`;
  }

  // lib/canonical/notificationPreferences.ts
  var NOTIFICATION_PREFERENCE_KEYS = [
    "materialOrderCutOff",
    "annualLeaveRequested",
    "annualLeaveDecision",
    "projectCreated",
    "smallWorksCreated",
    "bookingClashes",
    "materialOrderPlaced",
    "bookedOntoJob",
    "operativeCreated",
    "managerCreated",
    "clientCreated",
    "warningDismissed",
    "tasksAssignedOrCompleted",
    "toolboxTalkIssued",
    "timesheetSignOff",
    "qualificationExpiry",
    "lineManagerPeerUpdates",
    "timesheetSubmissionReminder",
    "variations"
  ];
  var DEFAULT_USER_NOTIFICATION_PREFERENCES = {
    materialOrderCutOff: true,
    annualLeaveRequested: true,
    annualLeaveDecision: true,
    projectCreated: true,
    smallWorksCreated: true,
    bookingClashes: true,
    materialOrderPlaced: true,
    bookedOntoJob: true,
    operativeCreated: true,
    managerCreated: true,
    clientCreated: true,
    warningDismissed: true,
    tasksAssignedOrCompleted: true,
    toolboxTalkIssued: true,
    timesheetSignOff: true,
    qualificationExpiry: true,
    lineManagerPeerUpdates: true,
    timesheetSubmissionReminder: true,
    variations: true
  };
  var LEGACY_NOTIFICATION_PREFERENCE_ALIASES = {
    bookingConflicts: "bookingClashes"
  };
  var TYPE_TO_PREFERENCE = {
    material_order_cut_off: "materialOrderCutOff",
    holiday_request_submitted: "annualLeaveRequested",
    holiday_request_approved: "annualLeaveDecision",
    holiday_request_declined: "annualLeaveDecision",
    project_created: "projectCreated",
    small_works_created: "smallWorksCreated",
    booking_clash: "bookingClashes",
    material_order_placed: "materialOrderPlaced",
    material_order_created: "materialOrderPlaced",
    booking_created: "bookedOntoJob",
    booked_onto_job: "bookedOntoJob",
    operative_created: "operativeCreated",
    manager_created: "managerCreated",
    client_created: "clientCreated",
    warning_removed: "warningDismissed",
    task_created: "tasksAssignedOrCompleted",
    task_completed: "tasksAssignedOrCompleted",
    deadline_assigned: "tasksAssignedOrCompleted",
    deadline_reminder: "tasksAssignedOrCompleted",
    deadline_due: "tasksAssignedOrCompleted",
    toolbox_talk_issued: "toolboxTalkIssued",
    hs_toolbox_reminder: "toolboxTalkIssued",
    timesheet_pending_manager_signoff: "timesheetSignOff",
    timesheet_signed_by_manager: "timesheetSignOff",
    qualification_expiry: "qualificationExpiry",
    line_manager_peer_update: "lineManagerPeerUpdates",
    [TIMESHEET_SUBMISSION_NOTICE_TYPE]: "timesheetSubmissionReminder",
    // Web writes `variation` / `variation_renumbered`; iOS writes the three `variation_*` kinds below.
    variation: "variations",
    variation_renumbered: "variations",
    variation_added: "variations",
    variation_from_tracker: "variations",
    variation_numbers_updated: "variations"
  };
  function trimmed3(value) {
    return String(value ?? "").trim();
  }
  function asDayKey(value) {
    const key2 = trimmed3(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(key2) ? key2 : void 0;
  }
  function asCatalogue(value) {
    if (value === "projects" || value === "smallWorks") return value;
    return void 0;
  }
  function flagOn(raw) {
    return raw !== false;
  }
  function parseUserNotificationPreferences(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const prefs = { ...DEFAULT_USER_NOTIFICATION_PREFERENCES };
    for (const [legacy, current] of Object.entries(LEGACY_NOTIFICATION_PREFERENCE_ALIASES)) {
      if (!(current in source) && legacy in source) {
        prefs[current] = flagOn(source[legacy]);
      }
    }
    for (const key2 of NOTIFICATION_PREFERENCE_KEYS) {
      if (key2 in source) prefs[key2] = flagOn(source[key2]);
    }
    return prefs;
  }
  function userNotificationPreferencesToFirestore(prefs) {
    const out = {};
    for (const key2 of NOTIFICATION_PREFERENCE_KEYS) {
      out[key2] = prefs[key2] !== false;
    }
    return out;
  }
  function userNotificationPreferenceFieldPatch(prefs) {
    const patch = {};
    for (const key2 of NOTIFICATION_PREFERENCE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(prefs, key2)) {
        patch[`notificationPreferences.${key2}`] = prefs[key2] !== false;
      }
    }
    return patch;
  }
  function notificationPreferenceKeyForType(type) {
    return TYPE_TO_PREFERENCE[trimmed3(type)] ?? null;
  }
  var PREFERENCE_LABELS = {
    materialOrderCutOff: "Material order cut-off",
    annualLeaveRequested: "Annual leave requested",
    annualLeaveDecision: "Annual leave approved or declined",
    projectCreated: "New project created",
    smallWorksCreated: "New small works",
    bookingClashes: "Booking clashes",
    materialOrderPlaced: "New material order",
    bookedOntoJob: "You've been booked",
    operativeCreated: "New operative created",
    managerCreated: "New manager created",
    clientCreated: "New client created",
    warningDismissed: "Warning dismissed",
    tasksAssignedOrCompleted: "Tasks assigned or completed",
    toolboxTalkIssued: "Toolbox talk issued",
    timesheetSignOff: "Timesheet sign-off",
    qualificationExpiry: "Qualification expiry",
    lineManagerPeerUpdates: "Line manager peer updates",
    timesheetSubmissionReminder: "Timesheet submission reminder",
    variations: "Variations"
  };
  function notificationPreferenceCopy(key2, audience) {
    const descriptions = {
      materialOrderCutOff: "Daily reminder at the time set in organisation settings.",
      annualLeaveRequested: "When someone you manage requests annual leave.",
      annualLeaveDecision: "When your annual leave is approved or declined.",
      projectCreated: "When a project is added.",
      smallWorksCreated: "When new small works is added.",
      bookingClashes: "When two bookings overlap.",
      materialOrderPlaced: "When a material order is placed.",
      bookedOntoJob: "When you are booked onto a job.",
      operativeCreated: "When a new operative is added.",
      managerCreated: "When a new manager is added.",
      clientCreated: "When a new client is added.",
      warningDismissed: "When someone dismisses a warning.",
      tasksAssignedOrCompleted: "When a task is assigned to you or marked complete.",
      toolboxTalkIssued: "When a toolbox talk is issued to you.",
      timesheetSignOff: "When a timesheet needs your sign-off or has been signed.",
      qualificationExpiry: "Reminders before qualifications expire.",
      lineManagerPeerUpdates: "When another line manager actions a shared request.",
      timesheetSubmissionReminder: "Reminder to submit before the payment-run deadline.",
      variations: "When a variation is added to a job you manage, or variation numbers are updated."
    };
    return { label: PREFERENCE_LABELS[key2], description: descriptions[key2] };
  }
  function notificationPreferenceIsVisible(key2, audience) {
    const role = audience.role;
    const staff = isStaffAccount(role);
    switch (key2) {
      case "projectCreated":
        return canEditWorkCatalogue(role, "projects", audience.catalogue);
      case "smallWorksCreated":
        return canEditWorkCatalogue(role, "smallWorks", audience.catalogue);
      case "annualLeaveRequested":
      case "bookingClashes":
      case "lineManagerPeerUpdates":
      case "managerCreated":
        return staff;
      case "materialOrderPlaced":
        return staff && audience.canManageMaterials !== false;
      case "operativeCreated":
        return staff && audience.canManagePeople !== false;
      case "clientCreated":
        return staff && audience.canManageClients !== false;
      case "warningDismissed":
        return canViewStaffWarnings(role);
      case "timesheetSignOff":
        return canReviewUserTimesheets(role);
      case "variations":
        return canSeeVariations(role);
      default:
        return true;
    }
  }
  function visibleNotificationPreferenceKeys(audience) {
    return NOTIFICATION_PREFERENCE_KEYS.filter((key2) => notificationPreferenceIsVisible(key2, audience));
  }
  function notificationPreferenceAllowsDelivery(prefs, type) {
    const key2 = notificationPreferenceKeyForType(type);
    if (!key2) return true;
    return prefs[key2] !== false;
  }
  var NOTIFICATION_TOGGLE_HIDES_INBOX_ROW = false;
  function notificationShowsInInbox(_prefs, _type) {
    return true;
  }
  function devicePushAllowed(prefs, type) {
    return notificationDeliversDevicePush(type) && notificationPreferenceAllowsDelivery(prefs, type);
  }
  var DEVICE_PUSH_NOTIFICATION_TYPES = [
    "booking_created",
    "booked_onto_job",
    "booking_clash",
    "task_created",
    "task_completed",
    "deadline_assigned",
    "holiday_request_submitted",
    "holiday_request_approved",
    "holiday_request_declined",
    "timesheet_pending_manager_signoff",
    "timesheet_signed_by_manager",
    "toolbox_talk_issued",
    "hs_toolbox_reminder",
    "material_order_placed",
    "material_order_created",
    "variation",
    "variation_renumbered",
    "variation_added",
    "variation_from_tracker",
    "variation_numbers_updated",
    "warning_removed",
    "operative_created",
    "manager_created",
    "client_created",
    "project_created",
    "small_works_created",
    TIMESHEET_SUBMISSION_NOTICE_TYPE
  ];
  var DEVICE_PUSH_TYPE_SET = new Set(DEVICE_PUSH_NOTIFICATION_TYPES);
  var NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND = true;
  function devicePushNotificationTypes() {
    return DEVICE_PUSH_NOTIFICATION_TYPES;
  }
  function notificationDeliversDevicePush(type) {
    return DEVICE_PUSH_TYPE_SET.has(trimmed3(type));
  }
  function inboxNotificationVisibleToUser(row, userId) {
    const uid = trimmed3(userId);
    if (!uid || !row || typeof row !== "object") return false;
    const owner = trimmed3(row.userId);
    return !owner || owner === uid;
  }
  function compareInboxNotificationsByCreatedAt(left, right) {
    return inboxCreatedAtMs(right) - inboxCreatedAtMs(left);
  }
  function inboxCreatedAtMs(row) {
    const value = row?.createdAt;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (value && typeof value === "object" && typeof value.getTime === "function") {
      const ms = value.getTime();
      return Number.isFinite(ms) ? ms : 0;
    }
    return 0;
  }
  function unreadNotificationBadgeCount(notifications, userId) {
    const uid = trimmed3(userId);
    if (!uid) return 0;
    const rows = Array.isArray(notifications) ? notifications : [];
    let count = 0;
    for (const row of rows) {
      if (!inboxNotificationVisibleToUser(row, uid)) continue;
      if (row.isRead === true) continue;
      count += 1;
    }
    return count;
  }
  function bookingDestination(role, relatedId, dayKey, catalogue) {
    if (role === "operative") return { kind: "mySchedule", dayKey };
    if (role === "manager" && relatedId) {
      if (catalogue === "smallWorks") return { kind: "smallWorksScheduling", relatedId, dayKey };
      if (catalogue === "projects") return { kind: "projectScheduling", relatedId, dayKey };
    }
    return { kind: "dailyOverviewDay", dayKey };
  }
  function notificationDestination(input) {
    const type = trimmed3(input.type);
    const relatedId = trimmed3(input.relatedId) || void 0;
    const dayKey = asDayKey(input.dayKey) || asDayKey(relatedId);
    const catalogue = asCatalogue(input.catalogue);
    const role = input.role === "admin" || input.role === "operative" || input.role === "manager" ? input.role : "manager";
    const userId = trimmed3(input.deepLinkUserId) || void 0;
    switch (type) {
      case "booking_created":
      case "booked_onto_job":
        return bookingDestination(role, relatedId, dayKey, catalogue);
      case "booking_clash":
        if (role === "admin") return { kind: "dailyOverviewDay", dayKey };
        if (role === "manager" && relatedId && catalogue === "smallWorks") {
          return { kind: "smallWorksScheduling", relatedId, dayKey };
        }
        if (role === "manager" && relatedId && catalogue === "projects") {
          return { kind: "projectScheduling", relatedId, dayKey };
        }
        return { kind: "warnings", dayKey };
      case "holiday_request_submitted":
        return { kind: "annualLeavePending", relatedId };
      case "holiday_request_approved":
      case "holiday_request_declined":
        return { kind: "annualLeave", relatedId };
      case "project_created":
        return relatedId ? { kind: "projectDetail", relatedId } : { kind: "projectsList" };
      case "small_works_created":
        return relatedId ? { kind: "smallWorksDetail", relatedId } : { kind: "smallWorksList" };
      case "material_order_cut_off":
        return { kind: "warnings" };
      case "material_order_placed":
      case "material_order_created":
        return { kind: "materialOrders", relatedId };
      case "operative_created":
      case "manager_created":
        return relatedId ? { kind: "userEdit", relatedId } : { kind: "manageUsers" };
      case "client_created":
        return { kind: "clients", relatedId };
      case "warning_removed":
      case "qualification_expiry":
        return { kind: "warnings", relatedId, dayKey };
      case "task_created":
      case "task_completed":
      case "deadline_assigned":
      case "deadline_reminder":
      case "deadline_due":
        return { kind: "tasks", relatedId };
      case "toolbox_talk_issued":
      case "hs_toolbox_reminder":
        return { kind: "healthSafety", relatedId };
      case "timesheet_pending_manager_signoff":
        return { kind: "timesheetTeamAwaiting", userId, dayKey };
      case "timesheet_signed_by_manager":
        return { kind: "timesheetMine", userId, dayKey };
      case "line_manager_peer_update":
        if (userId || dayKey) return { kind: "timesheetTeamSigned", userId, dayKey };
        return { kind: "annualLeave" };
      case TIMESHEET_SUBMISSION_NOTICE_TYPE:
        return { kind: "timesheetMine", dayKey };
      default:
        return { kind: "notifications" };
    }
  }

  // lib/canonical/leaveRequests.ts
  var HOLIDAY_TIME_SLOTS = ["FULL DAY", "AM", "PM"];
  var HOLIDAY_STATUSES = ["pending", "approved", "rejected"];
  var DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function normalizeHolidayTimeSlot(value) {
    const raw = text(value).toUpperCase().replace(/_/g, " ");
    if (raw === "AM") return "AM";
    if (raw === "PM") return "PM";
    return "FULL DAY";
  }
  function normalizeHolidayStatus(value) {
    const raw = text(value).toLowerCase();
    if (raw === "pending" || raw === "rejected" || raw === "approved") return raw;
    return "approved";
  }
  function parseHolidayDecisionNote(value) {
    const note = text(value);
    return note ? note : null;
  }
  function leaveRecordDayKeys(record3, timeZone, nonWorkingDayKeys) {
    const zone3 = zoneOrLondon(timeZone);
    const start = text(record3.startDayKey);
    if (!DAY_KEY.test(start)) return [];
    const endRaw = text(record3.endDayKey);
    const end = DAY_KEY.test(endRaw) && endRaw >= start ? endRaw : start;
    if (end === start) return [start];
    const skip = new Set((nonWorkingDayKeys || []).map(text));
    return eachDayKey(start, end, zone3).filter((key2) => {
      const iso = isoWeekdayOfDayKey(key2, zone3);
      return iso !== 6 && iso !== 7 && !skip.has(key2);
    });
  }
  function holidayRequestRanges(picks, timeZone) {
    const zone3 = zoneOrLondon(timeZone);
    const bySlot = /* @__PURE__ */ new Map();
    for (const pick of picks || []) {
      const key2 = text(pick?.dayKey);
      if (!DAY_KEY.test(key2) || bySlot.has(key2)) continue;
      bySlot.set(key2, normalizeHolidayTimeSlot(pick.timeSlot));
    }
    const keys = Array.from(bySlot.keys()).sort();
    const ranges = [];
    for (const key2 of keys) {
      const slot = bySlot.get(key2);
      const last = ranges[ranges.length - 1];
      if (last && last.timeSlot === slot) {
        const next = dayKeyInZone(addDaysInZone(dateFromDayKeyInZone(last.endDayKey, zone3), 1, zone3), zone3);
        if (next === key2) {
          last.endDayKey = key2;
          continue;
        }
      }
      ranges.push({ startDayKey: key2, endDayKey: key2, timeSlot: slot });
    }
    return ranges;
  }
  function holidayRequestWriteFields(input) {
    const zone3 = zoneOrLondon(input.timeZone);
    const id2 = text(input.id);
    const organizationId = text(input.organizationId);
    const userId = text(input.userId) || null;
    const operativeId = text(input.operativeId) || null;
    const startDayKey = text(input.startDayKey);
    if (!id2 || !organizationId || !userId && !operativeId || !DAY_KEY.test(startDayKey)) return null;
    const endRaw = text(input.endDayKey);
    const endDayKey = DAY_KEY.test(endRaw) && endRaw >= startDayKey ? endRaw : startDayKey;
    const status = normalizeHolidayStatus(input.status || "pending");
    return {
      id: id2,
      organizationId,
      userId,
      operativeId,
      startDateMs: dateFromDayKeyInZone(startDayKey, zone3).getTime(),
      endDateMs: dateFromDayKeyInZone(endDayKey, zone3).getTime(),
      startDayKey,
      endDayKey,
      status,
      timeSlot: normalizeHolidayTimeSlot(input.timeSlot),
      approvedByUserId: status === "approved" ? text(input.approvedByUserId) || null : null,
      cancellationRequestedByUserId: null,
      decisionNote: null
    };
  }
  function holidayDecisionWriteFields(input) {
    const raw = text(input.status).toLowerCase();
    const status = raw === "approved" ? "approved" : raw === "rejected" || raw === "declined" ? "rejected" : null;
    const approver = text(input.approverUid);
    if (!status || !approver) return null;
    return { status, approvedByUserId: approver, decisionNote: parseHolidayDecisionNote(input.decisionNote) };
  }
  function lineManagerIds(user) {
    if (!user || user.hasNoLineManager === true) return [];
    const listed = (user.assignedManagerUserIds || []).map(text).filter(Boolean);
    const ids = listed.length > 0 ? listed : [text(user.assignedManagerUserId)].filter(Boolean);
    return Array.from(new Set(ids));
  }
  function leaveApproverIds(user, roster) {
    const members = (roster || []).filter((member) => member && text(member.id));
    const self = text(user?.id);
    const active = (member) => member.isActive !== false;
    const byId = new Map(members.map((member) => [text(member.id), member]));
    const managers = lineManagerIds(user).filter((id2) => {
      if (id2 === self) return false;
      if (members.length === 0) return true;
      const member = byId.get(id2);
      return Boolean(member && active(member));
    });
    if (managers.length > 0) return managers;
    return members.filter(
      (member) => active(member) && !member.role.isOperativeMode && (member.role.isSuperAdmin || member.role.isAdmin) && text(member.id) !== self
    ).map((member) => text(member.id));
  }
  var HOLIDAY_REQUEST_SUBMITTED_TYPE = "holiday_request_submitted";

  // lib/canonical/annualLeaveBalance.ts
  var DEFAULT_ANNUAL_LEAVE_DAYS = 25;
  var ANNUAL_LEAVE_ALLOWANCE_COPY = {
    toggleTitle: "Annual leave allowance",
    toggleDescription: "Turn off annual leave allowances using this toggle. This is generally used for self-employed staff who do not get paid annual leave, therefore they do not have a set number of days per year.",
    toggleNote: "When off, this person can still book and see annual leave. They see days taken in the company leave year, not a remaining balance or days per year.",
    remainingTitle: "Manually adjust this user's remaining annual leave allowance for this year",
    remainingNote: "This number will reset to the Days per year figure at the end of your company year."
  };
  function hasAnnualLeaveAllowance(enabled) {
    return enabled !== false;
  }
  function snapLeaveDays(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 2) / 2;
  }
  function clampMonth(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const month = Math.trunc(n);
    if (month < 1 || month > 12) return fallback;
    return month;
  }
  function pad22(n) {
    return n < 10 ? `0${n}` : String(n);
  }
  function lastDayOfMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }
  function parseDayKey(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, month, day };
  }
  function leaveYearBounds(input) {
    const parsed = parseDayKey(input.onDayKey);
    const startMonth = clampMonth(input.startMonth, 1);
    const endMonth = clampMonth(input.endMonth, 12);
    if (!parsed) {
      const startDayKey2 = `1970-${pad22(startMonth)}-01`;
      const endDay2 = lastDayOfMonth(endMonth <= startMonth ? 1971 : 1970, endMonth);
      const endDayKey2 = `${endMonth <= startMonth ? 1971 : 1970}-${pad22(endMonth)}-${pad22(endDay2)}`;
      return { startDayKey: startDayKey2, endDayKey: endDayKey2, yearKey: startDayKey2 };
    }
    let year = parsed.year;
    if (parsed.month < startMonth) year -= 1;
    const startDayKey = `${year}-${pad22(startMonth)}-01`;
    const endYear = endMonth <= startMonth ? year + 1 : year;
    const endDay = lastDayOfMonth(endYear, endMonth);
    const endDayKey = `${endYear}-${pad22(endMonth)}-${pad22(endDay)}`;
    return { startDayKey, endDayKey, yearKey: startDayKey };
  }
  function leaveUnits(slot) {
    const raw = String(slot || "").trim().toUpperCase().replace(/\s+/g, "_");
    if (raw === "AM" || raw === "PM") return 0.5;
    return 1;
  }
  function bookingsInYear(bookings, startDayKey, endDayKey, status, timeZone, nonWorkingDayKeys) {
    let total = 0;
    for (const booking of bookings) {
      const raw = String(booking.status || "approved").toLowerCase();
      if (raw !== status) continue;
      const start = String(booking.startDayKey || "").trim();
      if (!parseDayKey(start)) continue;
      const days = leaveRecordDayKeys(
        { startDayKey: start, endDayKey: String(booking.endDayKey || start).trim() || start },
        timeZone,
        nonWorkingDayKeys
      ).filter((key2) => key2 >= startDayKey && key2 <= endDayKey).length;
      total += days * leaveUnits(booking.timeSlot);
    }
    return snapLeaveDays(total);
  }
  function resolveDaysPerYear(userDays, orgDays) {
    const user = Number(userDays);
    if (Number.isFinite(user) && user >= 0) return snapLeaveDays(user);
    const org = Number(orgDays);
    if (Number.isFinite(org) && org >= 0) return snapLeaveDays(org);
    return DEFAULT_ANNUAL_LEAVE_DAYS;
  }
  function previousYearEndKey(startDayKey, timeZone) {
    const start = dateFromDayKeyInZone(startDayKey, timeZone);
    return dayKeyInZone(addDaysInZone(start, -1, timeZone), timeZone);
  }
  function annualLeaveBalance(input) {
    const hasAllowance = hasAnnualLeaveAllowance(input.annualLeaveEnabled);
    const timeZone = zoneOrLondon(input.timeZone);
    const orgStart = clampMonth(input.orgStartMonth, 1);
    const orgEnd = clampMonth(input.orgEndMonth, 12);
    const startMonth = hasAllowance ? clampMonth(input.startMonth, orgStart) : orgStart;
    const endMonth = hasAllowance ? clampMonth(input.endMonth, orgEnd) : orgEnd;
    const year = leaveYearBounds({ startMonth, endMonth, onDayKey: input.onDayKey });
    const bookings = input.bookings ?? [];
    const nonWorking = input.nonWorkingDayKeys ?? [];
    const taken = bookingsInYear(bookings, year.startDayKey, year.endDayKey, "approved", timeZone, nonWorking);
    const pending = bookingsInYear(bookings, year.startDayKey, year.endDayKey, "pending", timeZone, nonWorking);
    const daysPerYear = hasAllowance ? resolveDaysPerYear(input.daysPerYear, input.orgDaysPerYear) : 0;
    const overrideKey = String(input.yearAllowanceKey || "").trim();
    const overrideApplies = hasAllowance && overrideKey !== "" && overrideKey === year.yearKey && Number.isFinite(Number(input.yearAllowance));
    let carriedForward = 0;
    if (hasAllowance && input.carriesOver === true && !overrideApplies && daysPerYear > 0) {
      const prevOn = previousYearEndKey(year.startDayKey, timeZone);
      const previous = leaveYearBounds({ startMonth, endMonth, onDayKey: prevOn });
      const prevTaken = bookingsInYear(
        bookings,
        previous.startDayKey,
        previous.endDayKey,
        "approved",
        timeZone,
        nonWorking
      );
      carriedForward = Math.max(0, snapLeaveDays(daysPerYear - prevTaken));
    }
    const yearAllowance = overrideApplies ? snapLeaveDays(input.yearAllowance) : null;
    const pot = yearAllowance != null ? yearAllowance : daysPerYear + carriedForward;
    const remaining = hasAllowance ? snapLeaveDays(pot - taken - pending) : null;
    return {
      hasAllowance,
      startDayKey: year.startDayKey,
      endDayKey: year.endDayKey,
      yearKey: year.yearKey,
      taken,
      pending,
      usedThisYear: taken,
      daysPerYear,
      carriedForward,
      yearAllowance,
      remaining
    };
  }
  function applyRemainingOverride(input) {
    const remaining = snapLeaveDays(input.remaining);
    const taken = snapLeaveDays(input.taken);
    const pending = snapLeaveDays(input.pending);
    return {
      annualLeaveYearAllowance: snapLeaveDays(remaining + taken + pending),
      annualLeaveYearAllowanceKey: String(input.yearKey || "").trim()
    };
  }

  // lib/canonical/materialSearch.ts
  var UNIT_TOKEN = /^(mm2|mm|cm|m|kg)$/;
  var NUMBER_TOKEN = /^\d+(?:\.\d+)?$/;
  var MEASURE_TOKEN = /^(\d+(?:\.\d+)?)(mm2|mm|cm|m|kg)$/;
  function normalizeMaterialSearchText(value) {
    return String(value || "").toLowerCase().replace(/mm²|mm\^2/g, "mm2").replace(/&/g, " ").replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function expandToken(token) {
    const out = /* @__PURE__ */ new Set([token]);
    const measure = MEASURE_TOKEN.exec(token);
    if (measure) {
      const amount = measure[1];
      const unit = measure[2];
      out.add(amount);
      out.add(unit);
      out.add(amount + unit);
      if (unit === "mm2") {
        out.add(`${amount}mm`);
        out.add("mm");
      }
    }
    const code = /^(\d+)([a-z]+)$/.exec(token);
    if (code) out.add(code[1]);
    return [...out];
  }
  function tokenizeMaterialSearch(value) {
    const raw = normalizeMaterialSearchText(value).split(" ").filter(Boolean);
    const tokens = [];
    for (let i = 0; i < raw.length; i += 1) {
      const current = raw[i];
      const next = raw[i + 1];
      if (next && NUMBER_TOKEN.test(current) && UNIT_TOKEN.test(next)) {
        tokens.push(current + next);
        i += 1;
        continue;
      }
      tokens.push(current);
    }
    return tokens;
  }
  function fieldTokens(value) {
    const tokens = normalizeMaterialSearchText(value).split(" ").filter(Boolean);
    const expanded = [];
    for (const token of tokens) expanded.push(...expandToken(token));
    return expanded;
  }
  function bestHit(...hits) {
    if (hits.includes("exact")) return "exact";
    if (hits.includes("prefix")) return "prefix";
    if (hits.includes("contains")) return "contains";
    return null;
  }
  function tokenHit(queryToken, hayTokens) {
    if (!queryToken) return null;
    for (const hay of hayTokens) {
      if (hay === queryToken) return "exact";
    }
    if (queryToken.length >= 2) {
      for (const hay of hayTokens) {
        if (hay.startsWith(queryToken)) return "prefix";
      }
    }
    if (queryToken.length >= 3) {
      for (const hay of hayTokens) {
        if (hay.includes(queryToken) || hay.length >= 3 && queryToken.startsWith(hay)) return "contains";
      }
    }
    return null;
  }
  function recordFields(record3) {
    return {
      name: fieldTokens(record3.name),
      brand: fieldTokens(record3.brand),
      code: fieldTokens(record3.productCode),
      extra: [
        ...fieldTokens(record3.category),
        ...fieldTokens(record3.size),
        ...fieldTokens(record3.length)
      ]
    };
  }
  function materialSearchScore(query, record3) {
    const tokens = tokenizeMaterialSearch(query);
    if (tokens.length === 0) return 1;
    const fields = recordFields(record3);
    const all = [...fields.name, ...fields.brand, ...fields.code, ...fields.extra];
    let score = 0;
    for (const token of tokens) {
      const named = tokenHit(token, fields.name);
      const branded = tokenHit(token, fields.brand);
      const coded = tokenHit(token, fields.code);
      const extra = tokenHit(token, fields.extra);
      const hit = bestHit(coded, named, branded, extra, tokenHit(token, all));
      if (!hit) return 0;
      if (hit === "exact") score += 40;
      else if (hit === "prefix") score += 26;
      else score += 12;
      if (coded) score += 18;
      if (named) score += 8;
    }
    const name = normalizeMaterialSearchText(record3.name);
    const joined = tokens.join(" ");
    if (name.startsWith(joined)) score += 24;
    else if (name.includes(joined)) score += 10;
    const nameLength = name.length;
    if (nameLength > 0) score += Math.max(0, 20 - Math.floor(nameLength / 8));
    return score;
  }
  function materialRecordMatches(query, record3) {
    return materialSearchScore(query, record3) > 0;
  }
  function rankMaterialRecords(query, records, limit) {
    const tokens = tokenizeMaterialSearch(query);
    const hits = [];
    for (let index = 0; index < records.length; index += 1) {
      const score = tokens.length === 0 ? 1 : materialSearchScore(query, records[index]);
      if (score > 0) hits.push({ index, score });
    }
    if (tokens.length > 0) {
      hits.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const left = normalizeMaterialSearchText(records[a.index]?.name);
        const right = normalizeMaterialSearchText(records[b.index]?.name);
        return left.localeCompare(right);
      });
    }
    const cap = Number(limit);
    if (Number.isFinite(cap) && cap > 0) return hits.slice(0, cap);
    return hits;
  }
  function catalogueRecordFromItem(item) {
    return {
      name: item.name,
      brand: item.brand,
      productCode: item.productCode,
      category: item.category,
      size: item.size,
      length: item.length
    };
  }

  // lib/canonical/qualificationSearch.ts
  var QUALIFICATION_FILTER_ALL = "All";
  var QUALIFICATION_FILTER_OTHER = "Other";
  var QUALIFICATION_LIBRARY_SECTIONS = [
    { section: "Electrical", chip: "Electrical" },
    { section: "Gas", chip: "Gas" },
    { section: "Air Conditioning, Refrigeration & F-Gas", chip: "Air Con & F-Gas" },
    { section: "Site Management & Supervision", chip: "Site Management" },
    { section: "Health, Safety & Environment", chip: "Health & Safety" },
    { section: "Access & Working at Height", chip: "Access & Height" },
    { section: "Plant, Lifting & Groundworks", chip: "Plant & Lifting" },
    { section: "Plumbing & Heating", chip: "Plumbing" },
    { section: "Mechanical & HVAC", chip: "Mechanical" },
    { section: "Renewables & Low Carbon", chip: "Renewables" },
    { section: "Fire & Security", chip: "Fire & Security" },
    { section: "Data, Comms & Technology", chip: "Data & Comms" },
    { section: "CSCS Site Cards (General)", chip: "CSCS" },
    { section: "Professional Memberships", chip: "Professional" }
  ];
  var SECTION_CHIP = new Map(
    QUALIFICATION_LIBRARY_SECTIONS.map((row) => [row.section, row.chip])
  );
  function normalizeQualificationSearchText(value) {
    return String(value || "").toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function tokenizeQualificationSearch(value) {
    return normalizeQualificationSearchText(value).split(" ").filter(Boolean);
  }
  function fieldTokens2(value) {
    return tokenizeQualificationSearch(value);
  }
  function bestHit2(...hits) {
    if (hits.includes("exact")) return "exact";
    if (hits.includes("prefix")) return "prefix";
    if (hits.includes("contains")) return "contains";
    return null;
  }
  function tokenHit2(queryToken, hayTokens) {
    if (!queryToken) return null;
    for (const hay of hayTokens) {
      if (hay === queryToken) return "exact";
    }
    if (queryToken.length >= 2) {
      for (const hay of hayTokens) {
        if (hay.startsWith(queryToken)) return "prefix";
      }
    }
    if (queryToken.length >= 3) {
      for (const hay of hayTokens) {
        if (hay.includes(queryToken) || hay.length >= 3 && queryToken.startsWith(hay)) return "contains";
      }
    }
    return null;
  }
  function recordFields2(record3) {
    return {
      name: fieldTokens2(record3.name),
      code: fieldTokens2(record3.code),
      body: fieldTokens2(record3.awardingBody),
      extra: [
        ...fieldTokens2(record3.section),
        ...fieldTokens2(record3.subsection),
        ...fieldTokens2(record3.notes)
      ]
    };
  }
  function qualificationSearchScore(query, record3) {
    const tokens = tokenizeQualificationSearch(query);
    if (tokens.length === 0) return 1;
    const fields = recordFields2(record3);
    const all = [...fields.name, ...fields.code, ...fields.body, ...fields.extra];
    let score = 0;
    for (const token of tokens) {
      const named = tokenHit2(token, fields.name);
      const coded = tokenHit2(token, fields.code);
      const body = tokenHit2(token, fields.body);
      const extra = tokenHit2(token, fields.extra);
      const hit = bestHit2(coded, named, body, extra, tokenHit2(token, all));
      if (!hit) return 0;
      if (hit === "exact") score += 40;
      else if (hit === "prefix") score += 26;
      else score += 12;
      if (coded) score += 18;
      if (named) score += 8;
    }
    const name = normalizeQualificationSearchText(record3.name);
    const joined = tokens.join(" ");
    if (name.startsWith(joined)) score += 24;
    else if (name.includes(joined)) score += 10;
    if (name.length > 0) score += Math.max(0, 20 - Math.floor(name.length / 8));
    return score;
  }
  function qualificationRecordMatches(query, record3) {
    return qualificationSearchScore(query, record3) > 0;
  }
  function qualificationMatchesSection(record3, section) {
    const wanted = String(section || "").trim();
    if (!wanted || wanted === QUALIFICATION_FILTER_ALL) return true;
    const value = String(record3.section || "").trim();
    if (wanted === QUALIFICATION_FILTER_OTHER) return value.length === 0;
    return value === wanted;
  }
  function qualificationSectionChipLabel(section) {
    if (section === QUALIFICATION_FILTER_ALL || section === QUALIFICATION_FILTER_OTHER) return section;
    return SECTION_CHIP.get(section) || section;
  }
  function qualificationLibraryFilterChips(records) {
    const counts = /* @__PURE__ */ new Map();
    let other = 0;
    for (const record3 of records) {
      const section = String(record3.section || "").trim();
      if (!section) {
        other += 1;
        continue;
      }
      counts.set(section, (counts.get(section) || 0) + 1);
    }
    const chips = [
      { key: QUALIFICATION_FILTER_ALL, label: QUALIFICATION_FILTER_ALL, count: records.length }
    ];
    for (const row of QUALIFICATION_LIBRARY_SECTIONS) {
      const count = counts.get(row.section) || 0;
      if (count === 0) continue;
      chips.push({ key: row.section, label: row.chip, count });
      counts.delete(row.section);
    }
    for (const [section, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      chips.push({ key: section, label: section, count });
    }
    if (other > 0) {
      chips.push({ key: QUALIFICATION_FILTER_OTHER, label: QUALIFICATION_FILTER_OTHER, count: other });
    }
    return chips;
  }
  function rankQualificationRecords(query, records, limit, section) {
    const tokens = tokenizeQualificationSearch(query);
    const hits = [];
    for (let index = 0; index < records.length; index += 1) {
      if (!qualificationMatchesSection(records[index], section)) continue;
      const score = tokens.length === 0 ? 1 : qualificationSearchScore(query, records[index]);
      if (score > 0) hits.push({ index, score });
    }
    if (tokens.length > 0) {
      hits.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const left = normalizeQualificationSearchText(records[a.index]?.name);
        const right = normalizeQualificationSearchText(records[b.index]?.name);
        return left.localeCompare(right);
      });
    }
    const cap = Number(limit);
    if (Number.isFinite(cap) && cap > 0) return hits.slice(0, cap);
    return hits;
  }
  function qualificationSearchRecordFromItem(item) {
    return {
      name: item.name,
      code: item.code,
      awardingBody: item.awardingBody,
      section: item.section,
      subsection: item.subsection,
      notes: item.notes
    };
  }

  // lib/canonical/operativeQualifications.ts
  var QUALIFICATION_CERTIFICATE_STORAGE_PATH = "organizations/{orgId}/operatives/{operativeId}/qualifications/{qualificationId}/certificates/{file}";
  function isoFromUnknown(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    if (typeof value === "string" && value.trim()) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    return void 0;
  }
  function trimId(value) {
    return String(value || "").trim();
  }
  function assignedQualificationWriteFields(row) {
    if (!row) return null;
    const id2 = trimId(row.id);
    const name = String(row.name || "").trim();
    if (!id2 || !name) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const createdAtIso = isoFromUnknown(row.createdAtIso) || isoFromUnknown(row.createdAt) || now;
    const updatedAtIso = isoFromUnknown(row.updatedAtIso) || isoFromUnknown(row.updatedAt) || createdAtIso;
    const endDateIso = isoFromUnknown(row.endDateIso) || isoFromUnknown(row.endDate);
    const write = {
      id: id2,
      name,
      hasEndDate: row.hasEndDate === true,
      createdAtIso,
      updatedAtIso
    };
    if (endDateIso) write.endDateIso = endDateIso;
    return write;
  }
  function qualificationCertificateUrl(urls, qualificationId) {
    if (!urls) return void 0;
    const id2 = trimId(qualificationId);
    if (!id2) return void 0;
    const direct = urls[id2];
    if (typeof direct === "string" && direct.trim()) return direct;
    const target = id2.toLowerCase();
    for (const [key2, value] of Object.entries(urls)) {
      if (key2.toLowerCase() === target && typeof value === "string" && value.trim()) return value;
    }
    return void 0;
  }
  function mergeQualificationCertificateUrls(existing, uploaded, removedIds) {
    const next = {};
    for (const [key2, value] of Object.entries(existing || {})) {
      if (typeof value === "string" && value.trim()) next[key2] = value;
    }
    for (const [key2, value] of Object.entries(uploaded || {})) {
      if (typeof value === "string" && value.trim()) next[key2] = value;
    }
    for (const id2 of removedIds || []) {
      const target = trimId(id2).toLowerCase();
      if (!target) continue;
      for (const key2 of Object.keys(next)) {
        if (key2.toLowerCase() === target) delete next[key2];
      }
    }
    return next;
  }
  function removedQualificationCertificateIds(previousUrls, nextUrls, assignedIds) {
    const removed = [];
    for (const id2 of assignedIds) {
      const key2 = trimId(id2);
      if (!key2) continue;
      if (qualificationCertificateUrl(previousUrls, key2) && !qualificationCertificateUrl(nextUrls, key2)) {
        removed.push(key2);
      }
    }
    return removed;
  }
  function mergeExpiryDates(previous, next, nextAssignmentIds) {
    const expiry = {};
    for (const [key2, value] of Object.entries(previous || {})) {
      const iso = isoFromUnknown(value);
      if (iso) expiry[key2] = iso;
    }
    for (const id2 of nextAssignmentIds) {
      const target = id2.toLowerCase();
      for (const key2 of Object.keys(expiry)) {
        if (key2.toLowerCase() === target) delete expiry[key2];
      }
    }
    for (const [key2, value] of Object.entries(next || {})) {
      const iso = isoFromUnknown(value);
      if (iso) expiry[key2] = iso;
    }
    return expiry;
  }
  function mergeOperativeQualificationWrite(input) {
    const byId = /* @__PURE__ */ new Map();
    for (const row of input.previous?.qualifications || []) {
      const write = assignedQualificationWriteFields(row);
      if (write) byId.set(write.id, write);
    }
    const nextAssignmentIds = [];
    for (const row of input.next.qualifications || []) {
      const write = assignedQualificationWriteFields(row);
      if (!write) continue;
      byId.set(write.id, write);
      nextAssignmentIds.push(write.id);
    }
    return {
      qualifications: Array.from(byId.values()),
      qualificationExpiryDates: mergeExpiryDates(
        input.previous?.qualificationExpiryDates,
        input.next.qualificationExpiryDates,
        nextAssignmentIds
      ),
      qualificationCertificateURLs: mergeQualificationCertificateUrls(
        input.previous?.qualificationCertificateURLs,
        input.next.qualificationCertificateURLs,
        input.next.removedCertificateIds
      )
    };
  }
  function qualificationCertificateStoragePath(input) {
    const organizationId = trimId(input.organizationId);
    const operativeId = trimId(input.operativeId);
    const qualificationId = trimId(input.qualificationId);
    const fileName = trimId(input.fileName);
    if (!organizationId || !operativeId || !qualificationId || !fileName) return null;
    return `organizations/${organizationId}/operatives/${operativeId}/qualifications/${qualificationId}/certificates/${fileName}`;
  }

  // lib/canonical/materialDelivery.ts
  var DEFAULT_MATERIAL_DELIVERY_HOUR = 8;
  var DEFAULT_MATERIAL_DELIVERY_MINUTE = 0;
  var DEFAULT_MATERIAL_DELIVERY_CLOCK = "08:00";
  var DEFAULT_MATERIAL_DELIVERY_MINUTES = DEFAULT_MATERIAL_DELIVERY_HOUR * 60 + DEFAULT_MATERIAL_DELIVERY_MINUTE;
  function materialOrderIncludesDeliveryRequired(requestType) {
    return String(requestType || "").trim().toLowerCase() === "order";
  }
  function defaultMaterialDeliveryDayKey(referenceIso, timeZone) {
    const zone3 = zoneOrLondon(timeZone);
    const now = new Date(referenceIso);
    if (Number.isNaN(now.getTime())) {
      return dayKeyInZone(/* @__PURE__ */ new Date(), zone3);
    }
    const weekday2 = isoWeekdayInZone(now, zone3);
    const daysAhead = weekday2 === 6 ? 2 : 1;
    return dayKeyInZone(addDaysInZone(now, daysAhead, zone3), zone3);
  }
  function materialDeliveryInstant(dayKey, clockMinutes, timeZone) {
    const zone3 = zoneOrLondon(timeZone);
    const midnight = dateFromDayKeyInZone(dayKey, zone3);
    const clamped = Math.max(0, Math.min(Math.round(clockMinutes), 24 * 60));
    return new Date(midnight.getTime() + clamped * 6e4);
  }
  function defaultMaterialDeliveryRequiredAt(referenceIso, timeZone) {
    return materialDeliveryInstant(
      defaultMaterialDeliveryDayKey(referenceIso, timeZone),
      DEFAULT_MATERIAL_DELIVERY_MINUTES,
      timeZone
    );
  }
  function clockMinutesFromDeliveryInstant(at, timeZone) {
    const zone3 = zoneOrLondon(timeZone);
    const parts = partsInZone(at, zone3);
    return parts.h * 60 + parts.min;
  }
  function formatMaterialDeliveryRequired(at, timeZone) {
    const zone3 = zoneOrLondon(timeZone);
    const day = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone3,
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(at);
    return `${day} at ${formatClockMinutes(clockMinutesFromDeliveryInstant(at, zone3))}`;
  }

  // lib/canonical/materialWhatsApp.ts
  var MATERIAL_WHATSAPP_ITEM_LIMIT = 30;
  var CALLING_CODES = {
    GB: "44",
    UK: "44",
    "GB-ENG": "44",
    "GB-SCT": "44",
    "GB-NIR": "44",
    IE: "353",
    IM: "44",
    JE: "44",
    GG: "44",
    AD: "376",
    AL: "355",
    AM: "374",
    AO: "244",
    AR: "54",
    AT: "43",
    AU: "61",
    AW: "297",
    AX: "358",
    BA: "387",
    BB: "1246",
    BD: "880",
    BE: "32",
    BG: "359",
    BJ: "229",
    BO: "591",
    BR: "55",
    BS: "1242",
    BW: "267",
    BY: "375",
    BZ: "501",
    CA: "1",
    CD: "243",
    CG: "242",
    CH: "41",
    CL: "56",
    CN: "86",
    CO: "57",
    CR: "506",
    CU: "53",
    CY: "357",
    CZ: "420",
    DE: "49",
    DK: "45",
    DM: "1767",
    DO: "1809",
    EC: "593",
    EE: "372",
    EG: "20",
    ES: "34",
    FI: "358",
    FO: "298",
    FR: "33",
    GA: "241",
    GD: "1473",
    GE: "995",
    GH: "233",
    GI: "350",
    GL: "299",
    GM: "220",
    GP: "590",
    GR: "30",
    GT: "502",
    GY: "592",
    HK: "852",
    HN: "504",
    HR: "385",
    HT: "509",
    HU: "36",
    ID: "62",
    IN: "91",
    IS: "354",
    IT: "39",
    JM: "1876",
    JP: "81",
    KE: "254",
    KR: "82",
    KY: "1345",
    KZ: "7",
    LC: "1758",
    LI: "423",
    LS: "266",
    LT: "370",
    LU: "352",
    LV: "371",
    MA: "212",
    MC: "377",
    MD: "373",
    ME: "382",
    MG: "261",
    MK: "389",
    MN: "976",
    MQ: "596",
    MS: "1664",
    MT: "356",
    MX: "52",
    MZ: "258",
    NA: "264",
    NE: "227",
    NG: "234",
    NI: "505",
    NL: "31",
    NO: "47",
    NZ: "64",
    PA: "507",
    PE: "51",
    PG: "675",
    PH: "63",
    PL: "48",
    PR: "1",
    PT: "351",
    PY: "595",
    RO: "40",
    RS: "381",
    RU: "7",
    SC: "248",
    SE: "46",
    SG: "65",
    SI: "386",
    SJ: "47",
    SK: "421",
    SM: "378",
    SR: "597",
    SV: "503",
    TN: "216",
    TR: "90",
    UA: "380",
    UG: "256",
    US: "1",
    UY: "598",
    VA: "379",
    VE: "58",
    VN: "84",
    ZA: "27",
    ZW: "263"
  };
  var MIN_E164_LEN = 8;
  var MAX_E164_LEN = 15;
  function trim(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function callingCodeForCountry(countryCode) {
    const code = (trim(countryCode) || "GB").toUpperCase();
    return CALLING_CODES[code] || "44";
  }
  function materialQuantityLabel(unit, quantity) {
    const raw = trim(unit) || "Number";
    const key2 = raw.toLowerCase();
    const plural = Math.abs(quantity) !== 1;
    if (key2 === "number") return plural ? "Numbers" : "Number";
    if (key2 === "box") return plural ? "Boxes" : "Box";
    if (key2 === "length") return plural ? "Lengths" : "Length";
    if (key2 === "drum") return plural ? "Drums" : "Drum";
    if (key2 === "pallet") return plural ? "Pallets" : "Pallet";
    return raw;
  }
  function whatsAppNumber(raw, countryCode) {
    const trimmed6 = trim(raw);
    if (!trimmed6) return { ok: false, reason: "No mobile number is saved for this contact." };
    let working = trimmed6.replace(/[^\d+]/g, "");
    if (working.startsWith("00")) working = `+${working.slice(2)}`;
    const orgCalling = callingCodeForCountry(countryCode);
    let digits;
    if (working.startsWith("+")) digits = working.slice(1).replace(/^0+/, "");
    else if (working.startsWith("0")) digits = `${orgCalling}${working.replace(/^0+/, "")}`;
    else if (working.startsWith(orgCalling)) digits = working;
    else digits = `${orgCalling}${working}`;
    digits = digits.replace(/\D/g, "");
    if (digits.length < MIN_E164_LEN) return { ok: false, reason: "This number is too short to open WhatsApp." };
    if (digits.length > MAX_E164_LEN) return { ok: false, reason: "This number is too long to open WhatsApp." };
    if (digits.startsWith("44") && digits.length >= 3 && digits[2] !== "7") {
      return { ok: false, reason: "This looks like a landline. WhatsApp needs a mobile number." };
    }
    return { ok: true, digits };
  }
  function orderItemLines(materials) {
    if (materials.length === 0) return "\u2022 (No materials listed)";
    const shown = materials.slice(0, MATERIAL_WHATSAPP_ITEM_LIMIT);
    const lines = shown.map((item) => {
      const qty = `${item.quantity} \xD7 ${item.material}`;
      const extras = [
        trim(item.brand),
        trim(item.productCode) ? `Code ${trim(item.productCode)}` : "",
        trim(item.lengthDisplay),
        trim(item.notes)
      ].filter(Boolean);
      const unit = materialQuantityLabel(item.unit, item.quantity);
      const unitBit = unit && unit.toLowerCase() !== "number" && unit.toLowerCase() !== "numbers" ? ` (${unit})` : "";
      return extras.length ? `\u2022 ${qty}${unitBit} \u2014 ${extras.join(" \xB7 ")}` : `\u2022 ${qty}${unitBit}`;
    });
    const remaining = materials.length - shown.length;
    if (remaining > 0) {
      lines.push(`\u2022 \u2026and ${remaining} more item${remaining === 1 ? "" : "s"}. We can send the full list by email.`);
    }
    return lines.join("\n");
  }
  function deliveryDate(value) {
    if (value == null || value === "") return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function whatsAppMessage(input, recipient) {
    const isQuote = String(input.requestType).toLowerCase() === "quote";
    const contact = trim(recipient.name) || "there";
    const orgName = trim(input.organisationName);
    const org = orgName || "our company";
    const lead = isQuote ? `Please see the following quote request from ${org}.` : `Please see the following material order from ${org}.`;
    const confirm = isQuote ? "Please can you confirm availability, pricing and the expected delivery date? This is only a quote request." : "Please can you confirm availability and the expected delivery date?";
    const lines = [`Hi ${contact},`, "", lead, "", isQuote ? "QUOTE REQUEST" : "MATERIAL ORDER"];
    if (trim(input.jobNumber)) lines.push(`Job: ${trim(input.jobNumber)}`);
    if (trim(input.projectName)) lines.push(`Project: ${trim(input.projectName)}`);
    const address = trim(input.projectAddress);
    if (address) {
      lines.push("Project address:");
      lines.push(address);
    }
    if (trim(recipient.wholesalerName)) lines.push(`Supplier: ${trim(recipient.wholesalerName)}`);
    const delivery = deliveryDate(input.deliveryAt);
    if (materialOrderIncludesDeliveryRequired(isQuote ? "quote" : "order") && delivery) {
      lines.push(`Required delivery: ${formatMaterialDeliveryRequired(delivery, input.timeZone)}`);
    }
    lines.push("", "ORDER DETAILS", orderItemLines(input.materials), "", confirm, "", "Thanks,");
    lines.push(trim(input.requestingUserName) || "Project Planner");
    if (orgName) lines.push(orgName);
    return lines.join("\n");
  }
  function materialWhatsAppRows(input) {
    return (input.recipients ?? []).map((recipient) => {
      const message = whatsAppMessage(input, recipient);
      const number = whatsAppNumber(recipient.phone, input.countryCode);
      if (!number.ok) {
        return { recipientId: recipient.id, message, ok: false, digits: null, reason: number.reason, url: null };
      }
      return {
        recipientId: recipient.id,
        message,
        ok: true,
        digits: number.digits,
        reason: null,
        url: `https://wa.me/${number.digits}?text=${encodeURIComponent(message)}`
      };
    });
  }

  // lib/canonical/materialOrderRecipients.ts
  function key(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  function accountKeys(account) {
    return [account.id, ...account.formerIds ?? [], ...account.aliasIds ?? []].map(key).filter(Boolean);
  }
  function materialOrderRecipients(input) {
    const jobIds = new Set((input.jobManagerIds ?? []).map(key).filter(Boolean));
    if (jobIds.size === 0) return [];
    const jobEmails = new Set(
      (input.managers ?? []).filter((row) => jobIds.has(key(row.id))).map((row) => key(row.email)).filter(Boolean)
    );
    const adder = new Set((input.adderIds ?? []).map(key).filter(Boolean));
    const seen = /* @__PURE__ */ new Set();
    const rows = [];
    for (const account of input.accounts ?? []) {
      const id2 = key(account.id);
      if (!id2 || seen.has(id2)) continue;
      if (account.isActive === false || !isStaffAccount(account.role)) continue;
      const ids = accountKeys(account);
      if (ids.some((value) => adder.has(value))) continue;
      const named = ids.some((value) => jobIds.has(value)) || key(account.email) !== "" && jobEmails.has(key(account.email));
      if (!named) continue;
      seen.add(id2);
      rows.push({ userId: account.id });
    }
    return rows;
  }

  // lib/canonical/userTimesheetAccess.ts
  function idKey(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  function memberIsActive(member) {
    return member.isActive !== false;
  }
  function isTimesheetUser(role) {
    return role.isOperativeMode || role.isManager || role.isAdmin || role.isSuperAdmin;
  }
  function lineManagerKeys(member) {
    if (member.hasNoLineManager === true) return [];
    const listed = (member.assignedManagerUserIds ?? []).map(idKey).filter(Boolean);
    if (listed.length > 0) return listed;
    const legacy = idKey(member.assignedManagerUserId);
    return legacy ? [legacy] : [];
  }
  function userTimesheetSubjects(input) {
    const { viewer, members } = input;
    if (!viewer || !idKey(viewer.id)) return [];
    if (!canReviewUserTimesheets(viewer.role)) return [];
    const active = members.filter((member) => idKey(member.id) && memberIsActive(member));
    if (seesEveryUserTimesheet(viewer.role)) {
      return active.filter((member) => isTimesheetUser(member.role)).map((member) => ({ userId: member.id }));
    }
    const viewerKeys = new Set(
      [viewer.id, ...viewer.formerIds ?? [], ...viewer.aliasIds ?? []].map(idKey).filter(Boolean)
    );
    const reportsToViewer = (member) => lineManagerKeys(member).some((key2) => viewerKeys.has(key2));
    const managedEmails = /* @__PURE__ */ new Set();
    for (const member of active) {
      const email = idKey(member.email);
      if (email && reportsToViewer(member)) managedEmails.add(email);
    }
    return active.filter((member) => {
      if (reportsToViewer(member)) return true;
      const email = idKey(member.email);
      return Boolean(email) && managedEmails.has(email);
    }).map((member) => ({ userId: member.id }));
  }
  function canOpenUserTimesheets(input) {
    const { viewer } = input;
    if (!viewer || !idKey(viewer.id)) return false;
    if (!canReviewUserTimesheets(viewer.role)) return false;
    if (seesEveryUserTimesheet(viewer.role)) return true;
    if (input.rosterLoading === true) return true;
    return userTimesheetSubjects(input).length > 0;
  }

  // lib/canonical/billingAccess.ts
  var PAYMENT_GRACE_MS = 7 * 24 * 60 * 60 * 1e3;
  var LIVE_STATUSES = /* @__PURE__ */ new Set(["trialing", "active"]);
  function timestampMs(value) {
    if (value == null || value === "") return null;
    if (typeof value === "object" && typeof value.getTime === "function") {
      const ms = value.getTime();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value < 1e12 ? Math.round(value * 1e3) : Math.round(value);
    }
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : parsed;
    }
    if (typeof value === "object") {
      const record3 = value;
      if (typeof record3.toDate === "function") {
        try {
          const parsed = record3.toDate();
          const ms = timestampMs(parsed);
          if (ms != null) return ms;
        } catch {
        }
      }
      const seconds = typeof record3.seconds === "number" ? record3.seconds : record3._seconds;
      if (typeof seconds === "number" && Number.isFinite(seconds)) return Math.round(seconds * 1e3);
    }
    return null;
  }
  function hasAccess(billing, now = Date.now()) {
    if (!billing) return true;
    if (billing.status === "none" || billing.status === "pending") return true;
    if (typeof billing.status === "string" && LIVE_STATUSES.has(billing.status)) return true;
    if (billing.status === "past_due") {
      if (!billing.lastPaymentFailedAt) return true;
      const failedAt = timestampMs(billing.lastPaymentFailedAt);
      if (failedAt == null) return false;
      return now - failedAt < PAYMENT_GRACE_MS;
    }
    return false;
  }

  // lib/canonical/inviteEmailClaim.ts
  function normalizeEmail2(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  function trimmedId(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function pointedOwnsInviteEmail(pointed, inviteEmail) {
    if (!pointed) return false;
    if (isAnonymisedDeletedProfile(pointed)) return false;
    return normalizeEmail2(pointed.email) === inviteEmail;
  }
  function resolveInviteEmailClaim(input) {
    const inviteEmail = normalizeEmail2(input.inviteEmail);
    if (!inviteEmail) return { action: "allow" };
    const pointer = input.emailPointer;
    const pointedUser = pointer?.pointedUser ?? null;
    const livePointer = pointer != null && pointer.exists === true && pointedOwnsInviteEmail(pointedUser, inviteEmail);
    if (livePointer) return { action: "block" };
    const claimedEmails = pointer == null ? null : [];
    let reuseUserId = "";
    for (const user of input.existingUsers ?? []) {
      if (isAnonymisedDeletedProfile(user)) continue;
      if (normalizeEmail2(user.email) !== inviteEmail) continue;
      if (user.passwordSet === true) return { action: "block" };
      if (!isIdentifiablePendingLeftover(user, claimedEmails)) return { action: "block" };
      const id2 = trimmedId(user.userId);
      if (id2 && !reuseUserId) reuseUserId = id2;
    }
    if (!reuseUserId && pointer?.exists === true && !pointedUser) {
      const pointedId = trimmedId(pointer.pointedUserId);
      if (pointedId) reuseUserId = pointedId;
    }
    return reuseUserId ? { action: "allow", reuseUserId } : { action: "allow" };
  }
  function inviteEmailHasLiveClaim(input) {
    return resolveInviteEmailClaim(input).action === "block";
  }
  function inviteEmailOrgLookupConstraints(organizationId, email) {
    return {
      organizationId: typeof organizationId === "string" ? organizationId.trim() : "",
      email: normalizeEmail2(email)
    };
  }
  function invitePlaceholderUserWriteFields() {
    return {
      passwordSet: false,
      isActive: true,
      isSuperAdmin: false,
      policyAccepted: false
    };
  }
  function inviteWritesOperativeProfile() {
    return false;
  }

  // lib/canonical/fileReports.ts
  var FILE_REPORT_REASONS = [
    "copyright",
    "personal_data",
    "offensive",
    "wrong_file",
    "other"
  ];
  var FILE_REPORT_SURFACES = [
    "site_audit",
    "task_attachment",
    "health_safety",
    "deadline",
    "variation_evidence",
    "qualification_certificate"
  ];
  var FILE_REPORT_STATUSES = ["open", "reviewed", "removed"];
  var FILE_REPORT_DETAILS_MAX = 1e3;
  var FILE_REPORT_FILE_NAME_MAX = 200;
  var FILE_REPORT_LINK_LABEL = "Report a problem with this file";
  var FILE_REPORT_SENT_COPY = "Thanks \u2014 an admin will review this.";
  var REASON_COPY = {
    copyright: "Copyright or someone else\u2019s work",
    personal_data: "Personal information that should not be shared",
    offensive: "Offensive or inappropriate",
    wrong_file: "Wrong file or wrong job",
    other: "Something else"
  };
  var STATUS_COPY = {
    open: "Open",
    reviewed: "Reviewed \u2014 no action",
    removed: "File removed"
  };
  function trimmed4(value) {
    return String(value ?? "").trim();
  }
  function fileReportCollectionPath(organizationId) {
    return `organizations/${trimmed4(organizationId)}/fileReports`;
  }
  function isFileReportReason(value) {
    return FILE_REPORT_REASONS.includes(trimmed4(value));
  }
  function isFileReportSurface(value) {
    return FILE_REPORT_SURFACES.includes(trimmed4(value));
  }
  function fileReportReasonCopy(reason) {
    return isFileReportReason(reason) ? REASON_COPY[trimmed4(reason)] : REASON_COPY.other;
  }
  function fileReportStatusCopy(status) {
    const value = trimmed4(status);
    return FILE_REPORT_STATUSES.includes(value) ? STATUS_COPY[value] : STATUS_COPY.open;
  }
  function fileReportStoragePath(fileRef) {
    const raw = trimmed4(fileRef);
    if (!raw) return null;
    if (raw.startsWith("gs://")) {
      const rest = raw.slice("gs://".length);
      const slash = rest.indexOf("/");
      return slash > 0 && slash < rest.length - 1 ? rest.slice(slash + 1) : null;
    }
    if (/^https?:\/\//i.test(raw)) {
      const firebase = raw.match(/\/v0\/b\/[^/]+\/o\/([^?#]+)/);
      if (firebase) {
        try {
          return decodeURIComponent(firebase[1]);
        } catch {
          return null;
        }
      }
      const gcs = raw.match(/^https?:\/\/storage\.googleapis\.com\/[^/]+\/([^?#]+)/i);
      if (gcs) {
        try {
          return decodeURIComponent(gcs[1]);
        } catch {
          return null;
        }
      }
      return null;
    }
    if (raw.includes("://") || raw.startsWith("/")) return null;
    return raw;
  }
  function fileReportFileName(storagePath) {
    const path = trimmed4(storagePath);
    const last = path.split("/").pop() || "";
    return last.slice(0, FILE_REPORT_FILE_NAME_MAX);
  }
  function fileReportWriteFields(input) {
    const organizationId = trimmed4(input.organizationId);
    const reportedByUserId = trimmed4(input.reportedByUserId);
    const storagePath = trimmed4(input.storagePath);
    const surface = trimmed4(input.surface);
    const parentId = trimmed4(input.parentId);
    const reason = trimmed4(input.reason);
    if (!organizationId) return { ok: false, error: "missing_organization" };
    if (!reportedByUserId) return { ok: false, error: "missing_user" };
    if (!storagePath.startsWith(`organizations/${organizationId}/`) || storagePath.includes("..")) {
      return { ok: false, error: "bad_path" };
    }
    if (!isFileReportSurface(surface)) return { ok: false, error: "bad_surface" };
    if (!parentId) return { ok: false, error: "missing_parent" };
    if (!isFileReportReason(reason)) return { ok: false, error: "bad_reason" };
    const fileName = (trimmed4(input.fileName) || fileReportFileName(storagePath)).slice(0, FILE_REPORT_FILE_NAME_MAX);
    return {
      ok: true,
      fields: {
        organizationId,
        storagePath,
        surface,
        parentId,
        fileName,
        reason,
        details: trimmed4(input.details).slice(0, FILE_REPORT_DETAILS_MAX),
        reportedByUserId,
        status: "open"
      }
    };
  }
  function fileReportReviewWriteFields(input) {
    const status = trimmed4(input.status);
    const reviewedByUserId = trimmed4(input.reviewedByUserId);
    if (status !== "reviewed" && status !== "removed") return null;
    if (!reviewedByUserId) return null;
    return { status, reviewedByUserId };
  }
  function canReviewFileReports(role) {
    if (role.isOperativeMode) return false;
    return role.isSuperAdmin || role.isAdmin;
  }

  // lib/canonical/bookings.ts
  var BOOKING_STATUSES = ["Confirmed", "Tentative", "Cancelled", "Completed"];
  var BOOKING_TIME_SLOTS = ["AM", "PM", "FULL DAY", "Evening", "Overtime", "CUSTOM_HOURS"];
  var ORPHAN_BOOKING_LABEL = "Deleted job";
  var STATUS_ALIASES = {
    confirmed: "Confirmed",
    tentative: "Tentative",
    pending: "Tentative",
    cancelled: "Cancelled",
    canceled: "Cancelled",
    completed: "Completed"
  };
  var UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  var LEGACY_PLACEHOLDER_DOCUMENT_ID = "INITIAL-PLACEHOLDER";
  function isLegacyPlaceholderDocumentId(id2) {
    return (id2 || "").trim().toUpperCase() === LEGACY_PLACEHOLDER_DOCUMENT_ID;
  }
  function text2(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : void 0;
  }
  function isBookingUuid(value) {
    return UUID_PATTERN.test(text2(value));
  }
  function normalizeBookingStatus(raw) {
    const value = text2(raw);
    if (!value) return null;
    if (BOOKING_STATUSES.includes(value)) return value;
    return STATUS_ALIASES[value.toLowerCase()] ?? null;
  }
  function isOpenBookingStatus(raw) {
    const status = normalizeBookingStatus(raw);
    return status === "Confirmed" || status === "Tentative";
  }
  function normalizeBookingTimeSlot(raw) {
    const value = text2(raw);
    if (!value) return null;
    if (BOOKING_TIME_SLOTS.includes(value)) return value;
    const compact = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").toUpperCase();
    if (compact === "FULL DAY" || compact === "FULLDAY") return "FULL DAY";
    if (compact === "CUSTOM" || compact === "CUSTOM HOURS" || compact === "CUSTOMHOURS") return "CUSTOM_HOURS";
    if (compact === "AM" || compact === "MORNING") return "AM";
    if (compact === "PM" || compact === "AFTERNOON") return "PM";
    if (compact === "EVENING") return "Evening";
    if (compact === "OVERTIME") return "Overtime";
    return null;
  }
  function bookingDateMs(raw) {
    if (raw == null || raw === "") return null;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.getTime();
    if (typeof raw === "string") {
      const ms = Date.parse(raw.trim());
      return Number.isNaN(ms) ? null : ms;
    }
    if (typeof raw === "object") {
      const row = raw;
      const seconds = finiteNumber(row.seconds) ?? finiteNumber(row._seconds);
      if (seconds == null) return null;
      const nanos = finiteNumber(row.nanoseconds) ?? finiteNumber(row._nanoseconds) ?? 0;
      return seconds * 1e3 + Math.floor(nanos / 1e6);
    }
    return null;
  }
  function isTimestampShape(raw) {
    if (!raw || typeof raw !== "object") return false;
    const row = raw;
    return finiteNumber(row.seconds) != null || finiteNumber(row._seconds) != null;
  }
  function bookingClock(raw, timeZone) {
    if (raw != null && typeof raw !== "string") {
      const ms = bookingDateMs(raw);
      if (ms == null) return void 0;
      const parts = partsInZone(new Date(ms), zoneOrLondon(timeZone));
      return formatClockMinutes(parts.h * 60 + parts.min);
    }
    const value = text2(raw);
    if (!value) return void 0;
    const ampm = value.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(AM|PM)$/i);
    if (ampm) {
      let hours = Number(ampm[1]);
      const minutes2 = Number(ampm[2] || "0");
      const pm = ampm[3].toUpperCase() === "PM";
      if (hours === 12) hours = pm ? 12 : 0;
      else if (pm) hours += 12;
      if (hours > 23 || minutes2 > 59) return void 0;
      return formatClockMinutes(hours * 60 + minutes2);
    }
    const withSeconds = value.match(/^(\d{1,2}:\d{2})(?::\d{2})?$/);
    const minutes = withSeconds ? parseClockMinutes(withSeconds[1]) : null;
    return minutes == null ? void 0 : formatClockMinutes(minutes);
  }
  function parseBookingDocument(docId, data, options) {
    if (isLegacyPlaceholderDocumentId(docId)) return { ok: false, errors: ["legacy_placeholder"] };
    const row = data && typeof data === "object" ? data : {};
    const repairs = [];
    const errors = [];
    let operativeId = text2(row.operativeId);
    if (!operativeId && text2(row.operativeID)) {
      operativeId = text2(row.operativeID);
      repairs.push("operative_id_alias");
    }
    let projectId = text2(row.projectId);
    if (!projectId && text2(row.projectID)) {
      projectId = text2(row.projectID);
      repairs.push("project_id_alias");
    }
    const dateMs = bookingDateMs(row.date);
    if (dateMs != null && !isTimestampShape(row.date)) repairs.push("date_not_timestamp");
    const rawStatus = text2(row.status);
    const status = normalizeBookingStatus(row.status);
    if (status && status !== rawStatus) repairs.push("status_alias");
    const rawSlot = text2(row.timeSlot);
    let timeSlot = normalizeBookingTimeSlot(row.timeSlot);
    if (!rawSlot) {
      timeSlot = "FULL DAY";
      repairs.push("slot_missing_full_day");
    } else if (timeSlot && timeSlot !== rawSlot) {
      repairs.push("slot_alias");
    }
    const bookedBy = text2(row.bookedBy);
    if (!bookedBy) repairs.push("booked_by_missing");
    if (!operativeId) errors.push("missing_operative_id");
    if (!projectId) errors.push("missing_project_id");
    if (dateMs == null) errors.push("missing_date");
    if (!status) errors.push("bad_status");
    if (!timeSlot) errors.push("bad_time_slot");
    if (errors.length > 0 || dateMs == null || !status || !timeSlot) return { ok: false, errors };
    const booking = {
      id: text2(docId),
      operativeId,
      projectId,
      dateMs,
      timeSlot,
      status,
      bookedBy,
      notes: text2(row.notes),
      isBreakRemoved: row.isBreakRemoved === true,
      operativeIdIsUuid: isBookingUuid(operativeId),
      projectIdIsUuid: isBookingUuid(projectId)
    };
    const workStartTime = bookingClock(row.workStartTime, options?.timeZone);
    const workEndTime = bookingClock(row.workEndTime, options?.timeZone);
    const otMultiplierOverride = finiteNumber(row.otMultiplierOverride);
    const bookingGroupId = text2(row.bookingGroupId);
    const createdAtMs = bookingDateMs(row.createdAt);
    const updatedAtMs = bookingDateMs(row.updatedAt);
    if (workStartTime) booking.workStartTime = workStartTime;
    if (workEndTime) booking.workEndTime = workEndTime;
    if (otMultiplierOverride != null) booking.otMultiplierOverride = otMultiplierOverride;
    if (bookingGroupId) booking.bookingGroupId = bookingGroupId;
    if (createdAtMs != null) booking.createdAtMs = createdAtMs;
    if (updatedAtMs != null) booking.updatedAtMs = updatedAtMs;
    return { ok: true, booking, repairs };
  }
  function bookingWriteFields(input) {
    const errors = [];
    const id2 = text2(input.id);
    const operativeId = text2(input.operativeId);
    const projectId = text2(input.projectId);
    const bookedBy = text2(input.bookedBy);
    const status = normalizeBookingStatus(input.status);
    const timeSlot = normalizeBookingTimeSlot(input.timeSlot);
    const dateMs = finiteNumber(input.dateMs);
    if (!id2) errors.push("missing_id");
    if (!operativeId) errors.push("missing_operative_id");
    if (!projectId) errors.push("missing_project_id");
    if (dateMs == null) errors.push("missing_date");
    if (!timeSlot) errors.push("bad_time_slot");
    if (!bookedBy) errors.push("missing_booked_by");
    if (!status) errors.push("bad_status");
    if (errors.length > 0 || dateMs == null || !status || !timeSlot) return { ok: false, errors };
    const fields = {
      id: id2,
      operativeId,
      projectId,
      date: dateMs,
      timeSlot,
      bookedBy,
      notes: text2(input.notes),
      status,
      isBreakRemoved: input.isBreakRemoved === true,
      createdAt: finiteNumber(input.createdAtMs) ?? dateMs,
      updatedAt: finiteNumber(input.updatedAtMs) ?? dateMs
    };
    const workStartTime = bookingClock(input.workStartTime);
    const workEndTime = bookingClock(input.workEndTime);
    const otMultiplierOverride = finiteNumber(input.otMultiplierOverride);
    const bookingGroupId = text2(input.bookingGroupId);
    if (workStartTime) fields.workStartTime = workStartTime;
    if (workEndTime) fields.workEndTime = workEndTime;
    if (otMultiplierOverride != null) fields.otMultiplierOverride = otMultiplierOverride;
    if (bookingGroupId) fields.bookingGroupId = bookingGroupId;
    return { ok: true, fields };
  }
  function todayKey(nowIso, timeZone) {
    const zone3 = zoneOrLondon(timeZone);
    const now = new Date(nowIso);
    return dayKeyInZone(Number.isNaN(now.getTime()) ? /* @__PURE__ */ new Date() : now, zone3);
  }
  function onOrAfterToday(dateMs, today, timeZone) {
    if (!Number.isFinite(dateMs)) return false;
    return dayKeyInZone(new Date(dateMs), zoneOrLondon(timeZone)) >= today;
  }
  function bookingsToRemoveOnOperativeDelete(input) {
    const ids = new Set(input.operativeIds.map((id2) => text2(id2).toUpperCase()).filter(Boolean));
    if (ids.size === 0) return [];
    const today = todayKey(input.nowIso, input.timeZone);
    return input.bookings.filter((row) => ids.has(text2(row.operativeId).toUpperCase()) && onOrAfterToday(row.dateMs, today, input.timeZone)).map((row) => row.id);
  }
  function bookingsToRemoveOnProjectDelete(input) {
    const projectId = text2(input.projectId).toUpperCase();
    if (!projectId) return [];
    const today = todayKey(input.nowIso, input.timeZone);
    return input.bookings.filter((row) => text2(row.projectId).toUpperCase() === projectId && onOrAfterToday(row.dateMs, today, input.timeZone)).map((row) => row.id);
  }
  function bookingJobState(projectId, liveProjectIds) {
    const id2 = text2(projectId).toUpperCase();
    if (!id2) return "deleted_job";
    const ids = Array.isArray(liveProjectIds) ? liveProjectIds : Array.from(liveProjectIds);
    return ids.some((row) => text2(row).toUpperCase() === id2) ? "live" : "deleted_job";
  }
  function bookingJobLabel(projectName) {
    return text2(projectName) || ORPHAN_BOOKING_LABEL;
  }
  function bookingHealthRows(input) {
    const people = new Set([...input.operativeIds, ...input.userIds].map((id2) => text2(id2).toUpperCase()).filter(Boolean));
    const jobs = new Set(input.projectIds.map((id2) => text2(id2).toUpperCase()).filter(Boolean));
    const rows = [];
    for (const doc of input.docs) {
      const parsed = parseBookingDocument(doc.id, doc.data);
      if (!parsed.ok) {
        rows.push({ id: doc.id, kind: "refused", detail: parsed.errors.join(", ") });
        continue;
      }
      const booking = parsed.booking;
      if (parsed.repairs.length > 0) rows.push({ id: doc.id, kind: "repaired", detail: parsed.repairs.join(", ") });
      if (!people.has(booking.operativeId.toUpperCase())) {
        rows.push({ id: doc.id, kind: "missing_operative", detail: booking.operativeId });
      }
      if (!jobs.has(booking.projectId.toUpperCase())) {
        rows.push({ id: doc.id, kind: "missing_job", detail: booking.projectId });
      }
      if (!booking.operativeIdIsUuid || !booking.projectIdIsUuid) {
        rows.push({
          id: doc.id,
          kind: "ios_cannot_read",
          detail: !booking.operativeIdIsUuid ? `operativeId ${booking.operativeId}` : `projectId ${booking.projectId}`
        });
      }
    }
    return rows;
  }
  var MANAGER_TIME_SLOTS = ["AM", "PM", "FULL_DAY", "CUSTOM_HOURS"];
  var MANAGER_LOCATION_TYPES = [
    "project",
    "small_work",
    "office",
    "working_from_home",
    "site_survey",
    "custom"
  ];
  function normalizeManagerBookingTimeSlot(raw) {
    const value = text2(raw);
    if (!value) return null;
    if (MANAGER_TIME_SLOTS.includes(value)) return value;
    switch (namedSlotKind(value)) {
      case "FULL_DAY":
        return "FULL_DAY";
      case "AM":
        return "AM";
      case "PM":
        return "PM";
      case "CUSTOM":
        return "CUSTOM_HOURS";
      default:
        return null;
    }
  }
  function parseManagerSiteBookingDocument(docId, data, options) {
    if (isLegacyPlaceholderDocumentId(docId)) return { ok: false, errors: ["legacy_placeholder"] };
    const row = data && typeof data === "object" ? data : {};
    const errors = [];
    const repairs = [];
    const userId = text2(row.userId);
    const dateMs = bookingDateMs(row.date);
    if (dateMs != null && !isTimestampShape(row.date)) repairs.push("date_not_timestamp");
    const timeSlot = normalizeManagerBookingTimeSlot(row.timeSlot);
    if (timeSlot && timeSlot !== text2(row.timeSlot)) repairs.push("slot_alias");
    if (!userId) errors.push("missing_user_id");
    if (dateMs == null) errors.push("missing_date");
    if (!timeSlot) errors.push("bad_time_slot");
    if (errors.length > 0 || dateMs == null || !timeSlot) return { ok: false, errors };
    const rawLocation = text2(row.locationType);
    let locationType = "project";
    if (MANAGER_LOCATION_TYPES.includes(rawLocation)) {
      locationType = rawLocation;
    } else {
      repairs.push(rawLocation ? "location_type_unknown" : "location_type_missing");
    }
    const booking = {
      id: text2(docId),
      userId,
      dateMs,
      timeSlot,
      locationType,
      isBreakRemoved: row.isBreakRemoved === true
    };
    const locationId = text2(row.locationId);
    const customLocationName = text2(row.customLocationName);
    const workStartTime = bookingClock(row.workStartTime, options?.timeZone);
    const workEndTime = bookingClock(row.workEndTime, options?.timeZone);
    const bookingGroupId = text2(row.bookingGroupId);
    const createdAtMs = bookingDateMs(row.createdAt);
    const updatedAtMs = bookingDateMs(row.updatedAt);
    if (locationId) booking.locationId = locationId;
    if (customLocationName) booking.customLocationName = customLocationName;
    if (workStartTime) booking.workStartTime = workStartTime;
    if (workEndTime) booking.workEndTime = workEndTime;
    if (bookingGroupId) booking.bookingGroupId = bookingGroupId;
    if (createdAtMs != null) booking.createdAtMs = createdAtMs;
    if (updatedAtMs != null) booking.updatedAtMs = updatedAtMs;
    return { ok: true, booking, repairs };
  }

  // lib/canonical/bookingPerson.ts
  function idKey2(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  function emailKey2(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  function rosterAliasIdsFor(accountId, aliases) {
    const kept = idKey2(accountId);
    if (!kept || !aliases) return [];
    const ids = [];
    const seen = /* @__PURE__ */ new Set([kept]);
    for (const [alias, keptId] of Object.entries(aliases)) {
      const key2 = idKey2(alias);
      if (!key2 || seen.has(key2) || idKey2(keptId) !== kept) continue;
      seen.add(key2);
      ids.push(alias.trim());
    }
    return ids;
  }
  function bookingIdsForAccount(account, operatives) {
    const ids = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (raw) => {
      const id2 = typeof raw === "string" ? raw.trim() : "";
      const key2 = id2.toLowerCase();
      if (!id2 || seen.has(key2)) return;
      seen.add(key2);
      ids.push(id2);
    };
    for (const id2 of labourPersonIds({ id: account.id, formerIds: account.formerIds ? [...account.formerIds] : [] })) add(id2);
    for (const id2 of account.aliasIds || []) add(id2);
    const email = emailKey2(account.email);
    if (email) {
      for (const operative of operatives) {
        if (emailKey2(operative.email) === email) add(operative.id);
      }
    }
    return ids;
  }
  function resolveBookingPerson(operativeId, input) {
    const needle = idKey2(operativeId);
    if (!needle) return { accountId: null, operativeId: null, email: null };
    const operative = input.operatives.find((row) => idKey2(row.id) === needle) || null;
    let account = input.accounts.find((row) => idKey2(row.id) === needle) || input.accounts.find((row) => (row.formerIds || []).some((id2) => idKey2(id2) === needle)) || input.accounts.find((row) => (row.aliasIds || []).some((id2) => idKey2(id2) === needle)) || null;
    const operativeEmail = emailKey2(operative?.email);
    if (!account && operativeEmail) {
      account = input.accounts.find((row) => emailKey2(row.email) === operativeEmail) || null;
    }
    const accountEmail = emailKey2(account?.email);
    const linkedOperative = operative || (accountEmail ? input.operatives.find((row) => emailKey2(row.email) === accountEmail) || null : null);
    const email = operativeEmail || accountEmail || emailKey2(linkedOperative?.email) || null;
    return {
      accountId: account ? account.id : null,
      operativeId: linkedOperative ? linkedOperative.id : null,
      email: email || null
    };
  }
  function bookingPersonKey(operativeId, input) {
    const person = resolveBookingPerson(operativeId, input);
    if (person.accountId) return `account:${idKey2(person.accountId)}`;
    if (person.operativeId) return `operative:${idKey2(person.operativeId)}`;
    return `id:${idKey2(operativeId)}`;
  }
  function bookingIdsForPerson(operativeId, input) {
    const first = typeof operativeId === "string" ? operativeId.trim() : "";
    if (!first) return [];
    const ids = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (raw) => {
      const id2 = (raw || "").trim();
      if (!id2 || seen.has(id2.toLowerCase())) return;
      seen.add(id2.toLowerCase());
      ids.push(id2);
    };
    add(first);
    const person = resolveBookingPerson(first, input);
    add(person.operativeId);
    const account = person.accountId ? input.accounts.find((row) => row.id === person.accountId) : void 0;
    if (account) for (const id2 of bookingIdsForAccount(account, input.operatives)) add(id2);
    return ids;
  }

  // lib/canonical/legalPack.ts
  function text3(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function legalPackNeedsAcceptance(input) {
    if (input.policyAccepted !== true) return true;
    const current = text3(input.currentVersion);
    if (!current) return false;
    return text3(input.acceptedVersion) !== current;
  }

  // lib/canonical/payrollHours.ts
  var HALF_WINDOW_TOLERANCE = 20;
  function weekendFor(isoWeekday, policy) {
    if (isoWeekday === 6) return policy.saturday;
    if (isoWeekday === 7) return policy.sunday?.sameAsSaturday ? policy.saturday : policy.sunday;
    return null;
  }
  function standardPaid(policy) {
    return Math.max(Number(policy.standardPaidHours) || 0, 0);
  }
  function countsAs(weekend, policy) {
    return weekend.countsAsStandardHours ?? Number(policy.standardPaidHours);
  }
  function dayInput(policy) {
    return {
      standardDayStart: policy.standardDayStart,
      standardDayEnd: policy.standardDayEnd,
      breakWindowStart: policy.breakWindowStart,
      breakWindowEnd: policy.breakWindowEnd
    };
  }
  function workedHoursSplit(result2) {
    let standard = 0;
    let outside = 0;
    for (const row of result2.segments) {
      if (row.kind === "standardWindow") standard += row.workedHours;
      else outside += row.workedHours;
    }
    return { standardWorkedHours: standard, outsideWorkedHours: outside };
  }
  function payrollOutsideMultiplier(booking, isoWeekday, policy) {
    const override = Number(booking.otMultiplierOverride);
    if (Number.isFinite(override) && override > 0) return override;
    const weekend = weekendFor(isoWeekday, policy);
    if (weekend) {
      return weekend.allHoursAtMultiplierMode ? weekend.allHoursMultiplier : weekend.outsideWindowMultiplier ?? 1.5;
    }
    return policy.weekdayOutsideStandardMultiplier;
  }
  function segment(kind, baseHours, multiplier, start, end, workedHours = baseHours) {
    const clock = (value) => value == null ? void 0 : typeof value === "number" ? formatClockMinutes(Math.min(value, 24 * 60 - 1)) : value;
    return { kind, clockStart: clock(start), clockEnd: clock(end), baseHours, multiplier, paidHours: baseHours * multiplier, workedHours };
  }
  function result(segments, outsideMultiplier) {
    let total = 0;
    let standard = 0;
    let outside = 0;
    let worked = 0;
    for (const row of segments) {
      total += row.paidHours;
      worked += row.workedHours;
      if (row.kind === "standardWindow") standard += row.baseHours;
      else outside += row.baseHours;
    }
    return { totalPaidHours: total, standardHours: standard, outsideHours: outside, outsideMultiplier, workedHours: worked, segments };
  }
  function interval(booking, policy) {
    return slotInterval(
      { timeSlot: booking.timeSlot ?? void 0, workStartTime: booking.workStartTime ?? void 0, workEndTime: booking.workEndTime ?? void 0 },
      dayInput(policy)
    );
  }
  function overnight(booking) {
    const start = parseClockMinutes(booking.workStartTime ?? void 0);
    const end = parseClockMinutes(booking.workEndTime ?? void 0);
    if (start == null || end == null || !(end < start)) return null;
    return segment("standardWindow", (end + 24 * 60 - start) / 60, 1, booking.workStartTime ?? void 0, booking.workEndTime ?? void 0);
  }
  function isNamedHalf(booking) {
    const kind = namedSlotKind(booking.timeSlot);
    return kind === "AM" || kind === "PM";
  }
  function isHalfDayPaid(booking, policy, allHoursDay) {
    if (isNamedHalf(booking)) return true;
    if (namedSlotKind(booking.timeSlot) !== "CUSTOM" || allHoursDay) return false;
    const span = interval(booking, policy);
    if (!span) return false;
    const windows = halfDayWindows(dayInput(policy));
    const near = (a, b) => Math.abs(a - b) <= HALF_WINDOW_TOLERANCE;
    return near(span.start, windows.am.start) && near(span.end, windows.am.end) || near(span.start, windows.pm.start) && near(span.end, windows.pm.end);
  }
  function halfDayPaid(booking, policy, weekend, multiplier) {
    const paid = weekend && !weekend.allHoursAtMultiplierMode ? Math.max(countsAs(weekend, policy), 0) / 2 : standardPaid(policy) / 2;
    const span = interval(booking, policy);
    return result([segment("standardWindow", paid, 1, span?.start, span?.end)], multiplier);
  }
  function legacySlot(booking, policy, multiplier) {
    const kind = namedSlotKind(booking.timeSlot);
    const paid = kind === "AM" || kind === "PM" ? standardPaid(policy) / 2 : kind === "EVENING" ? 4 : kind === "OVERTIME" ? 2 : standardPaid(policy);
    return result([segment("standardWindow", paid, 1)], multiplier);
  }
  function wallHours(booking, policy) {
    const start = parseClockMinutes(booking.workStartTime ?? void 0);
    const end = parseClockMinutes(booking.workEndTime ?? void 0);
    if (start != null && end != null && start !== end) return ((end > start ? end : end + 24 * 60) - start) / 60;
    const span = interval(booking, policy);
    if (span) return (span.end - span.start) / 60;
    const kind = namedSlotKind(booking.timeSlot);
    if (kind === "AM" || kind === "PM") return standardPaid(policy) / 2;
    if (kind === "EVENING") return 4;
    if (kind === "OVERTIME") return 2;
    return standardPaid(policy);
  }
  function breakDeductionMinutes(policy, span) {
    const start = parseClockMinutes(policy.breakWindowStart);
    const end = parseClockMinutes(policy.breakWindowEnd);
    if (start == null || end == null || end <= start) return 0;
    return Math.min(span.end, end) > Math.max(span.start, start) ? Number(policy.unpaidBreakMinutes) || 0 : 0;
  }
  function outsideSegments(span, windowStart, windowEnd, multiplier) {
    const rows = [];
    if (span.start < windowStart) {
      const end = Math.min(span.end, windowStart);
      const hours = (end - span.start) / 60;
      if (hours > 1e-3) rows.push(segment("outsideWindow", hours, multiplier, span.start, end));
    }
    if (span.end > windowEnd) {
      const start = Math.max(span.start, windowEnd);
      const hours = (span.end - start) / 60;
      if (hours > 1e-3) rows.push(segment("outsideWindow", hours, multiplier, start, span.end));
    }
    return rows;
  }
  function weekday(booking, policy, multiplier) {
    const night = overnight(booking);
    if (night) return result([night], multiplier);
    if (isHalfDayPaid(booking, policy, false)) return halfDayPaid(booking, policy, null, multiplier);
    const span = interval(booking, policy);
    if (!span) return legacySlot(booking, policy, multiplier);
    const ds = parseClockMinutes(policy.standardDayStart) ?? 0;
    const de = parseClockMinutes(policy.standardDayEnd) ?? 0;
    if (!(de > ds)) {
      const wall = wallHours(booking, policy);
      return result([segment("allHoursMultiplier", wall, multiplier, booking.workStartTime ?? void 0, booking.workEndTime ?? void 0)], multiplier);
    }
    const rows = [];
    const insideStart = Math.max(span.start, ds);
    const insideEnd = Math.min(span.end, de);
    if (insideEnd > insideStart) {
      let hours = (insideEnd - insideStart) / 60;
      if (!isNamedHalf(booking) && policy.breakPaid !== true && booking.isBreakRemoved !== true) {
        hours = Math.max(0, hours - breakDeductionMinutes(policy, span) / 60);
      }
      if (hours > 1e-3) rows.push(segment("standardWindow", hours, 1, insideStart, insideEnd));
    }
    rows.push(...outsideSegments(span, ds, de, multiplier));
    if (rows.length === 0) return legacySlot(booking, policy, multiplier);
    return result(rows, multiplier);
  }
  function weekendDay(booking, policy, weekend, multiplier) {
    const night = overnight(booking);
    if (night) return result([night], multiplier);
    const span = interval(booking, policy);
    if (!span) return legacySlot(booking, policy, multiplier);
    if (weekend.allHoursAtMultiplierMode) {
      if (isNamedHalf(booking)) return halfDayPaid(booking, policy, weekend, multiplier);
      return result([segment("allHoursMultiplier", (span.end - span.start) / 60, multiplier, span.start, span.end)], multiplier);
    }
    const ws = parseClockMinutes(weekend.definedWindowStart ?? policy.standardDayStart) ?? 0;
    const we = parseClockMinutes(weekend.definedWindowEnd ?? "13:00") ?? 0;
    if (!(we > ws)) {
      const wall = wallHours(booking, policy);
      return result([segment("allHoursMultiplier", wall, multiplier, booking.workStartTime ?? void 0, booking.workEndTime ?? void 0)], multiplier);
    }
    if (isHalfDayPaid(booking, policy, false)) return halfDayPaid(booking, policy, weekend, multiplier);
    const credit = countsAs(weekend, policy);
    const rows = [];
    const overlapStart = Math.max(span.start, ws);
    const overlapEnd = Math.min(span.end, we);
    if (overlapEnd > overlapStart) {
      const credited = overlapStart <= ws && overlapEnd >= we ? credit : credit * ((overlapEnd - overlapStart) / (we - ws));
      rows.push(segment("standardWindow", credited, 1, overlapStart, overlapEnd, (overlapEnd - overlapStart) / 60));
    }
    rows.push(...outsideSegments(span, ws, we, multiplier));
    if (rows.length === 0) return legacySlot(booking, policy, multiplier);
    return result(rows, multiplier);
  }
  function payrollHoursResult(input) {
    const zone3 = zoneOrLondon(input.timeZone);
    const iso = isoWeekdayInZone(dateFromDayKeyInZone(input.dayKey, zone3), zone3);
    const policy = input.policy;
    const booking = input.booking || {};
    const multiplier = payrollOutsideMultiplier(booking, iso, policy);
    const weekend = weekendFor(iso, policy);
    return weekend ? weekendDay(booking, policy, weekend, multiplier) : weekday(booking, policy, multiplier);
  }
  function reportDayValue(input) {
    const standard = Math.max(Number(input.standardPaidHours) || 0, 0.01);
    return Math.min(1.5, Math.max(0, Number(input.totalPaidHours) || 0) / standard);
  }
  function subcontractorDayValue(timeSlot) {
    return namedSlotKind(timeSlot) === "FULL_DAY" ? 1 : 0.5;
  }

  // lib/canonical/reportPay.ts
  var PAYE_PAY_CELL_LABEL = "PAYE";
  function roundPennies(value) {
    return Math.round(value * 100) / 100;
  }
  function lineIsPaye(line) {
    if (line.isPaye === true) return true;
    if (line.isPaye === false) return false;
    if (line.employmentType == null || String(line.employmentType).trim() === "") return false;
    return normalizeEmploymentType(line.employmentType) === "paye";
  }
  function reportPayCell(line) {
    if (lineIsPaye(line)) return { pay: null, label: PAYE_PAY_CELL_LABEL, countsTowardPayTotal: false };
    const pay = typeof line.pay === "number" && Number.isFinite(line.pay) ? roundPennies(line.pay) : null;
    return { pay, label: null, countsTowardPayTotal: pay != null };
  }
  function reportPayTotal(lines) {
    let total = 0;
    for (const line of lines) {
      const cell = reportPayCell(line);
      if (cell.countsTowardPayTotal && cell.pay != null) total += cell.pay;
    }
    return roundPennies(total);
  }
  function reportPersonPayCell(lines) {
    if (lines.length > 0 && lines.every(lineIsPaye)) {
      return { pay: null, label: PAYE_PAY_CELL_LABEL, countsTowardPayTotal: false };
    }
    return { pay: reportPayTotal(lines), label: null, countsTowardPayTotal: true };
  }

  // lib/canonical/sensitiveProfile.ts
  var SENSITIVE_PROFILE_FIELDS = ["utrNumber", "vatNumber"];
  var SENSITIVE_PROFILE_DOC_ID = "taxIds";
  var SENSITIVE_VALUE_MAX = 20;
  var SENSITIVE_HELD_BY_ADMIN_COPY = "Held by admin";
  var SENSITIVE_EXPORT_OPTION_LABEL = "Include UTR and VAT number";
  function text4(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function sensitiveProfileDocPath(userId) {
    return `users/${text4(userId)}/private/${SENSITIVE_PROFILE_DOC_ID}`;
  }
  function canViewSensitiveProfile(input) {
    const viewer = text4(input.viewerUserId);
    if (viewer && viewer === text4(input.subjectUserId)) return true;
    if (input.viewerRole.isOperativeMode) return false;
    return input.viewerRole.isSuperAdmin || input.viewerRole.isAdmin;
  }
  function maskSensitiveValue(value) {
    const raw = text4(value).replace(/\s+/g, "");
    if (!raw) return "";
    if (raw.length <= 4) return "\u2022\u2022\u2022\u2022";
    return `\u2022\u2022\u2022\u2022 ${raw.slice(-4)}`;
  }
  function resolveSensitiveProfile(input) {
    if (input.privateDoc && typeof input.privateDoc === "object") {
      return {
        utrNumber: text4(input.privateDoc.utrNumber),
        vatNumber: text4(input.privateDoc.vatNumber),
        source: "private"
      };
    }
    const legacy = input.legacyUser && typeof input.legacyUser === "object" ? input.legacyUser : {};
    const utrNumber = text4(legacy.utrNumber);
    const vatNumber = text4(legacy.vatNumber);
    return { utrNumber, vatNumber, source: utrNumber || vatNumber ? "legacy" : "none" };
  }
  function sensitiveProfileWriteFields(input) {
    const updatedByUserId = text4(input.updatedByUserId);
    if (!updatedByUserId) return { ok: false, error: "missing_user" };
    const utrNumber = text4(input.utrNumber);
    const vatNumber = text4(input.vatNumber);
    if (utrNumber.length > SENSITIVE_VALUE_MAX || vatNumber.length > SENSITIVE_VALUE_MAX) {
      return { ok: false, error: "too_long" };
    }
    return { ok: true, fields: { utrNumber, vatNumber, updatedByUserId } };
  }
  function exportIncludesSensitiveFields(input) {
    return input.requested === true && input.canView === true;
  }

  // lib/canonical/scheduleSources.ts
  var DAY_KEY2 = /^\d{4}-\d{2}-\d{2}$/;
  function idText(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function idKey3(value) {
    return idText(value).toLowerCase();
  }
  function emailKey3(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  function dayKeyText(value) {
    const text9 = typeof value === "string" ? value.trim() : "";
    return DAY_KEY2.test(text9) ? text9 : null;
  }
  function compareText(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  function uniqueIds(values, without) {
    const skip = new Set(without.map(idKey3));
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const raw of values) {
      const id2 = idText(raw);
      const key2 = id2.toLowerCase();
      if (!id2 || skip.has(key2) || seen.has(key2)) continue;
      seen.add(key2);
      out.push(id2);
    }
    return out.sort(compareText);
  }
  function rosterDocumentRank(doc) {
    let rank = 0;
    if (doc.passwordSet === true) rank += 4;
    if (doc.listed === true) rank += 2;
    if (idText(doc.firstName) || idText(doc.surname)) rank += 1;
    if (doc.isActive === true) rank += 1;
    return rank;
  }
  function updatedMs(doc) {
    return typeof doc.updatedAtMs === "number" && Number.isFinite(doc.updatedAtMs) ? doc.updatedAtMs : 0;
  }
  function rosterKeeps(existing, incoming) {
    const adminA = existing.admin === true;
    const adminB = incoming.admin === true;
    if (adminA !== adminB) return adminB;
    const signedA = existing.passwordSet === true;
    const signedB = incoming.passwordSet === true;
    if (signedA !== signedB) return signedB;
    if (updatedMs(existing) !== updatedMs(incoming)) return updatedMs(incoming) > updatedMs(existing);
    const activeA = existing.isActive === true;
    const activeB = incoming.isActive === true;
    if (activeA !== activeB) return activeB;
    const rankA = rosterDocumentRank(existing);
    const rankB = rosterDocumentRank(incoming);
    if (rankA !== rankB) return rankB > rankA;
    return compareText(idKey3(incoming.id), idKey3(existing.id)) < 0;
  }
  function rosterPeople(docs) {
    const seenIds = /* @__PURE__ */ new Set();
    const order = [];
    const groups = /* @__PURE__ */ new Map();
    for (const doc of docs || []) {
      const id2 = idText(doc?.id);
      if (!id2 || seenIds.has(id2.toLowerCase())) continue;
      seenIds.add(id2.toLowerCase());
      const email = emailKey3(doc.email);
      const key2 = email || `id:${id2.toLowerCase()}`;
      const list = groups.get(key2);
      if (list) list.push(doc);
      else {
        groups.set(key2, [doc]);
        order.push(key2);
      }
    }
    const people = [];
    const userIdAliases = {};
    for (const key2 of order) {
      const group = groups.get(key2) || [];
      let kept = group[0];
      for (const doc of group.slice(1)) if (rosterKeeps(kept, doc)) kept = doc;
      const keptId = idText(kept.id);
      const aliases = [];
      const former = [];
      for (const doc of group) {
        aliases.push(...doc.sameEmailUserIds || []);
        former.push(...doc.formerUserIds || []);
        if (doc !== kept) {
          aliases.push(doc.id);
          userIdAliases[idText(doc.id)] = keptId;
        }
      }
      people.push({
        ...kept,
        sameEmailUserIds: uniqueIds(aliases, [keptId]),
        formerUserIds: uniqueIds(former, [keptId])
      });
    }
    return { people, userIdAliases };
  }
  function bookingLoadStart(input) {
    if (input?.fullHistory === true) return { startDayKey: null, reload: false };
    const needed = (input?.neededDayKeys || []).map(dayKeyText).filter((key2) => Boolean(key2));
    const earliest = needed.length ? needed.reduce((a, b) => compareText(b, a) < 0 ? b : a) : null;
    const loaded = dayKeyText(input?.loadedFromDayKey);
    if (!loaded) return { startDayKey: earliest, reload: false };
    if (earliest && compareText(earliest, loaded) < 0) return { startDayKey: earliest, reload: true };
    return { startDayKey: loaded, reload: false };
  }
  function workDocuments(projects, smallWorks) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const work of [...projects || [], ...smallWorks || []]) {
      const key2 = idKey3(work?.id);
      if (!key2 || key2 === "initial-placeholder" || seen.has(key2)) continue;
      seen.add(key2);
      out.push(work);
    }
    return out;
  }
  function workStatusOn(work, dayKey) {
    if (work?.isLive === false) return "inactive";
    const day = dayKeyText(dayKey);
    if (!day) return "active";
    const start = dayKeyText(work?.startDayKey);
    const end = dayKeyText(work?.endDayKey);
    if (start && compareText(day, start) < 0) return "upcoming";
    if (end && compareText(day, end) > 0) return "completed";
    return "active";
  }
  function isWorkLiveOn(work, dayKey) {
    return workStatusOn(work, dayKey) === "active";
  }
  function occupiesDay(status) {
    if (status == null || status === "") return true;
    return bookingOccupiesDay(normalizeBookingStatus(status) ?? status);
  }
  function personDayItems(input) {
    const managerIdByKey = /* @__PURE__ */ new Map();
    for (const id2 of input?.managerIds || []) {
      const text9 = idText(id2);
      if (text9) managerIdByKey.set(text9.toLowerCase(), text9);
    }
    const people = input?.people || { accounts: [], operatives: [] };
    const managerIdByEmail = /* @__PURE__ */ new Map();
    for (const account of people.accounts || []) {
      const kept = managerIdByKey.get(idKey3(account.id));
      const email = emailKey3(account.email);
      if (kept && email && !managerIdByEmail.has(email)) managerIdByEmail.set(email, kept);
    }
    const ownerOf = (storedId) => {
      const direct = managerIdByKey.get(idKey3(storedId));
      const person = resolveBookingPerson(storedId, people);
      const account = person.accountId ? managerIdByKey.get(idKey3(person.accountId)) : void 0;
      if (account) return account;
      if (direct) return direct;
      return person.email ? managerIdByEmail.get(person.email) ?? null : null;
    };
    const days = /* @__PURE__ */ new Map();
    const seenPairIds = /* @__PURE__ */ new Set();
    const push = (userId, dayKey, item) => {
      if (seenPairIds.has(item.pairId.toLowerCase())) return;
      seenPairIds.add(item.pairId.toLowerCase());
      const key2 = `${userId}|${dayKey}`;
      const day = days.get(key2) || { userId, dayKey, items: [] };
      day.items.push(item);
      days.set(key2, day);
    };
    (input?.managerBookings || []).forEach((booking, index) => {
      const id2 = idText(booking?.id);
      const day = dayKeyText(booking?.dayKey);
      if (!id2 || !day || !occupiesDay(booking.status)) return;
      const owner = ownerOf(idText(booking.userId));
      if (owner) push(owner, day, { kind: "manager", bookingId: id2, pairId: `m-${id2}`, index });
    });
    (input?.operativeBookings || []).forEach((booking, index) => {
      const id2 = idText(booking?.id);
      const day = dayKeyText(booking?.dayKey);
      if (!id2 || !day || !occupiesDay(booking.status)) return;
      const owner = ownerOf(idText(booking.operativeId));
      if (owner) push(owner, day, { kind: "operative", bookingId: id2, pairId: `o-${id2}`, index });
    });
    return Array.from(days.values()).map((day) => ({ ...day, items: [...day.items].sort((a, b) => compareText(a.pairId, b.pairId)) })).sort((a, b) => compareText(a.dayKey, b.dayKey) || compareText(a.userId, b.userId));
  }
  function managerClashGroups(input) {
    const groups = [];
    const seen = /* @__PURE__ */ new Set();
    for (const personDay of personDayItems(input)) {
      if (personDay.items.length < 2) continue;
      const intervals = personDay.items.map((item) => {
        const booking = item.kind === "manager" ? input.managerBookings[item.index] : input.operativeBookings[item.index];
        return slotInterval(
          { timeSlot: booking?.timeSlot, workStartTime: booking?.workStartTime, workEndTime: booking?.workEndTime },
          input.day
        );
      });
      overlappingIntervalGroups(intervals).forEach((indexes, clusterIndex) => {
        const items = indexes.map((i) => ({ ...personDay.items[i], interval: intervals[i] })).sort((a, b) => compareText(a.pairId, b.pairId));
        const pairKey = items.map((item) => item.pairId).join("|");
        if (items.length < 2 || seen.has(pairKey)) return;
        seen.add(pairKey);
        groups.push({
          userId: personDay.userId,
          dayKey: personDay.dayKey,
          items,
          pairKey,
          bookingAId: items[0].bookingId,
          bookingBId: items[1].bookingId,
          resolutionKey: `mgr-clash-${personDay.userId}-${personDay.dayKey}-${clusterIndex}`
        });
      });
    }
    return groups;
  }
  function clashPairKey(bookingAId, bookingBId) {
    return [idText(bookingAId), idText(bookingBId)].sort(compareText).join("|");
  }
  function isClashAccepted(bookingAId, bookingBId, accepted) {
    const a = idKey3(bookingAId);
    const b = idKey3(bookingBId);
    if (!a || !b) return false;
    const key2 = clashPairKey(a, b);
    const savedKey = (raw) => {
      const [first, second, ...rest] = idKey3(raw).split("|");
      return first && second && rest.length === 0 ? clashPairKey(first, second) : "";
    };
    return (accepted || []).some((row) => {
      if (typeof row === "string") return savedKey(row) === key2;
      if (!row) return false;
      if (savedKey(row.id) === key2) return true;
      const rowA = idKey3(row.bookingAId);
      const rowB = idKey3(row.bookingBId);
      return Boolean(rowA && rowB) && clashPairKey(rowA, rowB) === key2;
    });
  }
  function validDocumentId(id2) {
    return Boolean(id2) && !id2.includes("/") && id2 !== "." && id2 !== ".." && !/^__.*__$/.test(id2) && id2.length <= 1500;
  }
  function acceptedClashWriteFields(input) {
    const a = idText(input?.bookingAId);
    const b = idText(input?.bookingBId);
    const by = idText(input?.acceptedByUserId);
    if (!a || !b || !by || a.toLowerCase() === b.toLowerCase()) return null;
    const documentId2 = clashPairKey(a, b);
    if (!validDocumentId(documentId2)) return null;
    return { documentId: documentId2, fields: { bookingAId: a, bookingBId: b, acceptedByUserId: by } };
  }
  var WARNING_RESOLUTION_STATUSES = ["approved", "dismissed"];
  function warningResolutionWriteFields(input) {
    const resolutionKey = idText(input?.resolutionKey);
    const status = typeof input?.status === "string" ? input.status.trim().toLowerCase() : "";
    const by = idText(input?.resolvedByUserId);
    if (!validDocumentId(resolutionKey) || !by) return null;
    if (!WARNING_RESOLUTION_STATUSES.includes(status)) return null;
    return {
      documentId: resolutionKey,
      fields: { resolutionKey, status, resolvedByUserId: by }
    };
  }
  function resolvedWarningKeys(records) {
    const keys = /* @__PURE__ */ new Set();
    for (const record3 of records || []) {
      if (!record3) continue;
      const status = typeof record3.status === "string" ? record3.status.trim().toLowerCase() : "";
      if (!WARNING_RESOLUTION_STATUSES.includes(status)) continue;
      const key2 = idText(record3.resolutionKey) || idText(record3.id);
      if (key2) keys.add(key2);
    }
    return [...keys].sort(compareText);
  }
  function isWarningActive(row, decisions) {
    if (!row) return false;
    const key2 = idText(row.resolutionKey);
    if (key2 && (decisions?.resolvedKeys || []).includes(key2)) return false;
    if (idText(row.bookingAId) && idText(row.bookingBId)) {
      return !isClashAccepted(row.bookingAId, row.bookingBId, decisions?.acceptedClashes);
    }
    return true;
  }
  function clashResolutionKey(input) {
    const own = idText(input?.resolutionKey);
    if (own) return own;
    const a = idText(input?.bookingAId);
    const b = idText(input?.bookingBId);
    return a && b ? clashPairKey(a, b) : "";
  }
  function clashApprovalWrites(input) {
    return {
      acceptedClash: acceptedClashWriteFields({
        bookingAId: input?.bookingAId,
        bookingBId: input?.bookingBId,
        acceptedByUserId: input?.approvedByUserId
      }),
      resolution: warningResolutionWriteFields({
        resolutionKey: clashResolutionKey({
          bookingAId: input?.bookingAId,
          bookingBId: input?.bookingBId,
          resolutionKey: input?.resolutionKey
        }),
        status: "approved",
        resolvedByUserId: input?.approvedByUserId
      })
    };
  }
  function isClashApproved(row, decisions) {
    if (!row) return false;
    return !isWarningActive(
      { resolutionKey: clashResolutionKey(row), bookingAId: row.bookingAId, bookingBId: row.bookingBId },
      decisions
    );
  }

  // lib/canonical/money.ts
  var DEFAULT_CURRENCY_CODE = "GBP";
  var CURRENCY_OPTIONS = [
    { code: "GBP", title: "British pound", symbol: "\xA3" },
    { code: "EUR", title: "Euro", symbol: "\u20AC" },
    { code: "USD", title: "US dollar", symbol: "$" },
    { code: "CAD", title: "Canadian dollar", symbol: "CA$" },
    { code: "AUD", title: "Australian dollar", symbol: "A$" },
    { code: "NZD", title: "New Zealand dollar", symbol: "NZ$" },
    { code: "SEK", title: "Swedish krona", symbol: "kr" },
    { code: "NOK", title: "Norwegian krone", symbol: "kr" },
    { code: "DKK", title: "Danish krone", symbol: "kr" },
    { code: "PLN", title: "Polish z\u0142oty", symbol: "z\u0142" },
    { code: "AED", title: "UAE dirham", symbol: "\u062F.\u0625" }
  ];
  var COUNTRY_CURRENCY = {
    GB: "GBP",
    UK: "GBP",
    IE: "EUR",
    FR: "EUR",
    DE: "EUR",
    ES: "EUR",
    IT: "EUR",
    NL: "EUR",
    US: "USD",
    CA: "CAD",
    AU: "AUD",
    NZ: "NZD",
    SE: "SEK",
    NO: "NOK",
    DK: "DKK",
    PL: "PLN",
    AE: "AED"
  };
  function text5(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function normalizeCurrencyCode(value) {
    const code = text5(value).toUpperCase();
    if (!code) return null;
    return CURRENCY_OPTIONS.some((option) => option.code === code) ? code : null;
  }
  function currencyOption(code) {
    const normalized = normalizeCurrencyCode(code);
    return CURRENCY_OPTIONS.find((option) => option.code === normalized) ?? CURRENCY_OPTIONS[0];
  }
  function defaultCurrencyForCountry(countryCode) {
    const country = text5(countryCode).toUpperCase().split("-")[0];
    return COUNTRY_CURRENCY[country] ?? DEFAULT_CURRENCY_CODE;
  }
  function resolveOrganizationCurrency(org) {
    const doc = org && typeof org === "object" ? org : {};
    const settings = doc.settings && typeof doc.settings === "object" ? doc.settings : {};
    return normalizeCurrencyCode(doc.currencyCode) ?? normalizeCurrencyCode(settings.currencyCode) ?? normalizeCurrencyCode(doc.currency) ?? normalizeCurrencyCode(doc["settings.currencyCode"]) ?? defaultCurrencyForCountry(doc.countryCode);
  }
  function organizationCurrencyWriteFields(code) {
    const normalized = normalizeCurrencyCode(code);
    if (!normalized) return null;
    return { currencyCode: normalized, currency: normalized, "settings.currencyCode": normalized };
  }
  function formatMoney(amount, currencyCode, options = {}) {
    const decimals = Number.isInteger(options.decimals) && options.decimals >= 0 ? options.decimals : 2;
    const value = typeof amount === "number" && Number.isFinite(amount) ? amount : Number(amount);
    const safe = Number.isFinite(value) ? value : 0;
    const negative = safe < 0 && Math.abs(safe) >= 0.5 * Math.pow(10, -decimals);
    const fixed = Math.abs(safe).toFixed(decimals);
    const [whole, fraction] = fixed.split(".");
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const body = fraction ? `${grouped}.${fraction}` : grouped;
    const symbol = currencyOption(currencyCode).symbol;
    const spaced = /\p{L}$/u.test(symbol) ? `${symbol} ` : symbol;
    const sign = negative && options.signed !== false ? "-" : "";
    return `${sign}${spaced}${body}`;
  }
  function currencySymbol(currencyCode) {
    return currencyOption(currencyCode).symbol;
  }

  // lib/canonical/writeMetadata.ts
  var WRITE_PLATFORMS = ["web", "ios", "android"];
  function writeMetadataFields(userId, platform) {
    const uid = typeof userId === "string" ? userId.trim() : "";
    const from = typeof platform === "string" ? platform.trim().toLowerCase() : "";
    if (!uid) return null;
    if (!WRITE_PLATFORMS.includes(from)) return null;
    return { updatedBy: uid, updatedFrom: from };
  }

  // lib/orgTime/orgTimeZone.ts
  var COUNTRY_TIME_ZONES = {
    GB: "Europe/London",
    UK: "Europe/London",
    "GB-ENG": "Europe/London",
    "GB-SCT": "Europe/London",
    "GB-NIR": "Europe/London",
    IE: "Europe/Dublin",
    IM: "Europe/Isle_of_Man",
    JE: "Europe/Jersey",
    GG: "Europe/Guernsey",
    AD: "Europe/Andorra",
    AL: "Europe/Tirane",
    AM: "Asia/Yerevan",
    AO: "Africa/Luanda",
    AR: "America/Argentina/Buenos_Aires",
    AT: "Europe/Vienna",
    AU: "Australia/Sydney",
    AW: "America/Aruba",
    AX: "Europe/Mariehamn",
    BA: "Europe/Sarajevo",
    BB: "America/Barbados",
    BD: "Asia/Dhaka",
    BE: "Europe/Brussels",
    BG: "Europe/Sofia",
    BJ: "Africa/Porto-Novo",
    BO: "America/La_Paz",
    BR: "America/Sao_Paulo",
    BS: "America/Nassau",
    BW: "Africa/Gaborone",
    BY: "Europe/Minsk",
    BZ: "America/Belize",
    CA: "America/Toronto",
    CD: "Africa/Kinshasa",
    CG: "Africa/Brazzaville",
    CH: "Europe/Zurich",
    CL: "America/Santiago",
    CN: "Asia/Shanghai",
    CO: "America/Bogota",
    CR: "America/Costa_Rica",
    CU: "America/Havana",
    CY: "Asia/Nicosia",
    CZ: "Europe/Prague",
    DE: "Europe/Berlin",
    DK: "Europe/Copenhagen",
    DM: "America/Dominica",
    DO: "America/Santo_Domingo",
    EC: "America/Guayaquil",
    EE: "Europe/Tallinn",
    EG: "Africa/Cairo",
    ES: "Europe/Madrid",
    FI: "Europe/Helsinki",
    FO: "Atlantic/Faroe",
    FR: "Europe/Paris",
    GA: "Africa/Libreville",
    GD: "America/Grenada",
    GE: "Asia/Tbilisi",
    GH: "Africa/Accra",
    GI: "Europe/Gibraltar",
    GL: "America/Nuuk",
    GM: "Africa/Banjul",
    GP: "America/Guadeloupe",
    GR: "Europe/Athens",
    GT: "America/Guatemala",
    GY: "America/Guyana",
    HK: "Asia/Hong_Kong",
    HN: "America/Tegucigalpa",
    HR: "Europe/Zagreb",
    HT: "America/Port-au-Prince",
    HU: "Europe/Budapest",
    ID: "Asia/Jakarta",
    IN: "Asia/Kolkata",
    IS: "Atlantic/Reykjavik",
    IT: "Europe/Rome",
    JM: "America/Jamaica",
    JP: "Asia/Tokyo",
    KE: "Africa/Nairobi",
    KR: "Asia/Seoul",
    KY: "America/Cayman",
    KZ: "Asia/Almaty",
    LC: "America/St_Lucia",
    LI: "Europe/Vaduz",
    LS: "Africa/Maseru",
    LT: "Europe/Vilnius",
    LU: "Europe/Luxembourg",
    LV: "Europe/Riga",
    MA: "Africa/Casablanca",
    MC: "Europe/Monaco",
    MD: "Europe/Chisinau",
    ME: "Europe/Podgorica",
    MG: "Indian/Antananarivo",
    MK: "Europe/Skopje",
    MN: "Asia/Ulaanbaatar",
    MQ: "America/Martinique",
    MS: "America/Montserrat",
    MT: "Europe/Malta",
    MX: "America/Mexico_City",
    MZ: "Africa/Maputo",
    NA: "Africa/Windhoek",
    NE: "Africa/Niamey",
    NG: "Africa/Lagos",
    NI: "America/Managua",
    NL: "Europe/Amsterdam",
    NO: "Europe/Oslo",
    NZ: "Pacific/Auckland",
    PA: "America/Panama",
    PE: "America/Lima",
    PG: "Pacific/Port_Moresby",
    PH: "Asia/Manila",
    PL: "Europe/Warsaw",
    PR: "America/Puerto_Rico",
    PT: "Europe/Lisbon",
    PY: "America/Asuncion",
    RO: "Europe/Bucharest",
    RS: "Europe/Belgrade",
    RU: "Europe/Moscow",
    SC: "Indian/Mahe",
    SE: "Europe/Stockholm",
    SG: "Asia/Singapore",
    SI: "Europe/Ljubljana",
    SJ: "Arctic/Longyearbyen",
    SK: "Europe/Bratislava",
    SM: "Europe/San_Marino",
    SR: "America/Paramaribo",
    SV: "America/El_Salvador",
    TN: "Africa/Tunis",
    TR: "Europe/Istanbul",
    UA: "Europe/Kyiv",
    UG: "Africa/Kampala",
    US: "America/New_York",
    UY: "America/Montevideo",
    VA: "Europe/Vatican",
    VE: "America/Caracas",
    VN: "Asia/Ho_Chi_Minh",
    ZA: "Africa/Johannesburg",
    ZW: "Africa/Harare"
  };
  function ianaTimeZoneForCountry(countryCode) {
    const code = (countryCode || "GB").trim().toUpperCase();
    return COUNTRY_TIME_ZONES[code] || LONDON_TIME_ZONE;
  }

  // lib/canonical/organizationTimeZone.ts
  function organizationTimeZone(countryCode) {
    return ianaTimeZoneForCountry(countryCode);
  }

  // lib/canonical/rulebookStamp.ts
  function rulebookStamp() {
    return {
      version: true ? "1.1.0" : "",
      sha256: true ? "36f61c979df49622f619e6c101e83b9d24e4d7694e494db53762af3c2b9e826c" : ""
    };
  }

  // lib/canonical/payRate.ts
  function finiteNumber2(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return null;
  }
  function exclusiveRates(input) {
    const basis = input.payBasis === "hourly" || input.payBasis === "day" ? input.payBasis : null;
    const day = typeof input.dayRate === "number" ? input.dayRate : null;
    const hourly = typeof input.hourlyRate === "number" ? input.hourlyRate : null;
    if (basis === "hourly") return { payBasis: "hourly", dayRate: null, hourlyRate: hourly };
    if (basis === "day") return { payBasis: "day", dayRate: day, hourlyRate: null };
    if (day != null && day > 0) return { payBasis: "day", dayRate: day, hourlyRate: null };
    if (hourly != null && hourly > 0) return { payBasis: "hourly", dayRate: null, hourlyRate: hourly };
    if (day != null) return { payBasis: "day", dayRate: day, hourlyRate: null };
    return { payBasis: "day", dayRate: null, hourlyRate: null };
  }
  function readStoredRates(input) {
    const source = input || {};
    const basis = source.payBasis === "hourly" || source.payBasis === "day" ? source.payBasis : null;
    const day = finiteNumber2(source.dayRate);
    const hourly = finiteNumber2(source.hourlyRate);
    if (basis == null && !(day != null && day > 0) && !(hourly != null && hourly > 0)) {
      return { payBasis: null, dayRate: null, hourlyRate: null };
    }
    return exclusiveRates({ dayRate: day, hourlyRate: hourly, payBasis: basis });
  }
  function historyRowBasis(row) {
    return row.payBasis === "hourly" ? "hourly" : "day";
  }
  function historyPayRowOnDay(rows, day, livePayBasis, dayOf) {
    const candidates = rows.filter((row) => dayOf(row.effectiveAt) <= day).slice().sort((a, b) => {
      const byEffective = a.effectiveAt.getTime() - b.effectiveAt.getTime();
      if (byEffective !== 0) return byEffective;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    if (candidates.length === 0) return null;
    if (livePayBasis === "hourly") {
      const hourlyRows = candidates.filter((row) => historyRowBasis(row) === "hourly");
      if (hourlyRows.length > 0) {
        const hourly = hourlyRows[hourlyRows.length - 1];
        const hourlyDay = dayOf(hourly.effectiveAt);
        const laterDayRows = candidates.filter(
          (row) => historyRowBasis(row) === "day" && dayOf(row.effectiveAt) > hourlyDay
        );
        if (laterDayRows.length > 0) return laterDayRows[laterDayRows.length - 1];
        return hourly;
      }
    }
    return candidates[candidates.length - 1];
  }
  function toDate(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "number" || typeof value === "string") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }
  function idSet(values) {
    return new Set(values.map((value) => String(value || "").trim()).filter(Boolean));
  }
  function livePayRate(user, operative) {
    const fromUser = user ? readStoredRates(user) : null;
    if (fromUser && (fromUser.dayRate != null || fromUser.hourlyRate != null)) return fromUser;
    const fromOperative = operative ? readStoredRates(operative) : null;
    if (fromOperative && (fromOperative.dayRate != null || fromOperative.hourlyRate != null)) return fromOperative;
    return { payBasis: null, dayRate: null, hourlyRate: null };
  }
  function payRateOnDay(input) {
    const timeZone = zoneOrLondon(input.timeZone);
    const dayKey = String(input.dayKey || "").trim();
    const user = input.user || null;
    const operative = input.operative || null;
    const live = livePayRate(user, operative);
    const liveBasis = live.payBasis === "hourly" ? "hourly" : "day";
    const employmentType = user ? employmentTypeOnDay(user, dateFromDayKeyInZone(dayKey, timeZone), timeZone) : "self_employed";
    if (user && employmentType === "paye") {
      return { payBasis: liveBasis, rate: 0, employmentType, isPaye: true, hasRate: true, source: "paye" };
    }
    const userIds = idSet(input.userIds && input.userIds.length > 0 ? input.userIds : [user?.id]);
    const operativeIds = idSet(input.operativeIds && input.operativeIds.length > 0 ? input.operativeIds : [operative?.id]);
    const seen = /* @__PURE__ */ new Set();
    const rows = [];
    (input.history || []).forEach((row, index) => {
      if (!row) return;
      const amount = finiteNumber2(row.dayRate);
      const effectiveAt = toDate(row.effectiveAt);
      if (amount == null || !effectiveAt) return;
      const rowUser = String(row.userId || "").trim();
      const rowOperative = String(row.operativeId || "").trim();
      if (!(rowUser && userIds.has(rowUser)) && !(rowOperative && operativeIds.has(rowOperative))) return;
      const key2 = String(row.id || "").trim() || `#${index}`;
      if (seen.has(key2)) return;
      seen.add(key2);
      rows.push({
        payBasis: row.payBasis ?? null,
        dayRate: amount,
        effectiveAt,
        createdAt: toDate(row.createdAt) || effectiveAt
      });
    });
    const match = historyPayRowOnDay(rows, dayKey, live.payBasis, (date) => dayKeyInZone(date, timeZone));
    if (match) {
      return {
        payBasis: historyRowBasis(match),
        rate: match.dayRate,
        employmentType,
        isPaye: false,
        hasRate: true,
        source: "history"
      };
    }
    const rate = liveBasis === "hourly" ? live.hourlyRate : live.dayRate;
    return {
      payBasis: liveBasis,
      rate,
      employmentType,
      isPaye: false,
      hasRate: rate != null,
      source: rate != null ? "profile" : "none"
    };
  }

  // lib/canonical/timesheetLines.ts
  var OVERLAPPING_BOOKING_NOTE = "Overlaps another booking \u2014 check with your manager";
  function overlappingBookingIds(bookings, day) {
    const byDay = /* @__PURE__ */ new Map();
    for (const booking of bookings || []) {
      const id2 = String(booking?.id || "").trim();
      if (!id2) continue;
      const key2 = String(booking.dayKey || "").trim();
      const list = byDay.get(key2) || [];
      list.push(booking);
      byDay.set(key2, list);
    }
    const flagged = /* @__PURE__ */ new Set();
    for (const list of byDay.values()) {
      if (list.length < 2) continue;
      const intervals = list.map(
        (booking) => slotInterval(
          { timeSlot: booking.timeSlot, workStartTime: booking.workStartTime, workEndTime: booking.workEndTime },
          day
        )
      );
      for (const group of overlappingIntervalGroups(intervals)) {
        for (const index of group) flagged.add(String(list[index].id).trim());
      }
    }
    const out = [];
    for (const booking of bookings || []) {
      const id2 = String(booking?.id || "").trim();
      if (id2 && flagged.has(id2) && !out.includes(id2)) out.push(id2);
    }
    return out;
  }
  function timesheetLeaveLabel(timeSlot) {
    const slot = normalizeHolidayTimeSlot(timeSlot);
    if (slot === "AM") return "Annual leave (AM)";
    if (slot === "PM") return "Annual leave (PM)";
    return "Annual leave (full day)";
  }
  function timesheetLeaveLines(leaveRecords, period, timeZone, nonWorkingDayKeys) {
    const start = String(period?.startDayKey || "").trim();
    const end = String(period?.endDayKey || "").trim();
    if (!start || !end || start > end) return [];
    const byDay = /* @__PURE__ */ new Map();
    for (const record3 of leaveRecords || []) {
      if (!record3) continue;
      const approved = record3.approved === true || record3.approved == null && normalizeHolidayStatus(record3.status) === "approved";
      if (!approved) continue;
      const slot = normalizeHolidayTimeSlot(record3.timeSlot);
      for (const dayKey of leaveRecordDayKeys(record3, timeZone, nonWorkingDayKeys)) {
        if (dayKey < start || dayKey > end) continue;
        const list = byDay.get(dayKey) || [];
        if (list.some((line2) => line2.timeSlot === slot || line2.timeSlot === "FULL DAY")) continue;
        const line = {
          id: `leave-${String(record3.id)}-${dayKey}`,
          leaveId: String(record3.id),
          dayKey,
          timeSlot: slot,
          label: timesheetLeaveLabel(slot)
        };
        byDay.set(dayKey, slot === "FULL DAY" ? [line] : [...list, line]);
      }
    }
    const lines = Array.from(byDay.values()).flat();
    const order = { "FULL DAY": 0, AM: 1, PM: 2 };
    return lines.sort((a, b) => a.dayKey !== b.dayKey ? a.dayKey < b.dayKey ? -1 : 1 : order[a.timeSlot] - order[b.timeSlot]);
  }

  // lib/canonical/companyDetails.ts
  var DEFAULT_BANK_HOLIDAY_REGION_ID = "GB-ENG-WLS";
  var OPTIONAL_ADDRESS_FIELDS = ["officeAddressLine2", "officeCounty", "officePostcode"];
  var ALL_ADDRESS_FIELDS = [
    "officeAddressLine1",
    "officeAddressLine2",
    "officeCity",
    "officeCounty",
    "officePostcode"
  ];
  function text6(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function record(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function finiteNumber3(value) {
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(n) ? n : null;
  }
  function normalizeDocumentAbbreviation(value) {
    return text6(value).replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  }
  function normalizeCompanyCountryCode(value) {
    const raw = text6(value).toUpperCase();
    if (raw === "UK") return "GB";
    const country = raw.split("-")[0];
    return /^[A-Z]{2}$/.test(country) ? country : "";
  }
  function parseCompanyDetails(orgDoc) {
    const data = record(orgDoc);
    const nested = record(data.officeAddress);
    const settings = record(data.settings);
    const pick = (flat, legacy) => text6(data[flat]) || text6(nested[legacy]);
    const line1 = pick("officeAddressLine1", "addressLine1");
    const city = pick("officeCity", "town");
    const hasOfficeAddress = Boolean(line1 && city);
    return {
      name: parseOrganizationName(data),
      hasOfficeAddress,
      officeAddressLine1: line1,
      officeAddressLine2: pick("officeAddressLine2", "addressLine2"),
      officeCity: city,
      officeCounty: pick("officeCounty", "county"),
      officePostcode: pick("officePostcode", "postcode"),
      countryCode: normalizeCompanyCountryCode(data.countryCode) || "GB",
      documentAbbreviation: normalizeDocumentAbbreviation(data.documentAbbreviation),
      companyLogoURL: text6(data.companyLogoURL),
      defaultLatitude: finiteNumber3(data.defaultLatitude),
      defaultLongitude: finiteNumber3(data.defaultLongitude),
      bankHolidayRegionId: text6(data.bankHolidayRegionId) || text6(settings.bankHolidayRegionId) || DEFAULT_BANK_HOLIDAY_REGION_ID
    };
  }
  function companyDetailsValidationError(input) {
    const nameOk = Boolean(text6(input.name));
    const countryOk = Boolean(normalizeCompanyCountryCode(input.countryCode));
    if (input.hasOfficeAddress) {
      if (!nameOk || !countryOk || !text6(input.officeAddressLine1) || !text6(input.officeCity)) {
        return "Name, country, address line 1 and town are required.";
      }
      return null;
    }
    if (!nameOk || !countryOk) return "Organisation name and country are required.";
    return null;
  }
  function companyDetailsWriteFields(input) {
    const set = { ...organizationNameWriteFields(input.name) };
    const remove = ["officeAddress"];
    const country = normalizeCompanyCountryCode(input.countryCode);
    if (country) set.countryCode = country;
    if (input.hasOfficeAddress) {
      set.officeAddressLine1 = text6(input.officeAddressLine1);
      set.officeCity = text6(input.officeCity);
      const optional = {
        officeAddressLine2: text6(input.officeAddressLine2),
        officeCounty: text6(input.officeCounty),
        officePostcode: text6(input.officePostcode)
      };
      for (const field of OPTIONAL_ADDRESS_FIELDS) {
        if (optional[field]) set[field] = optional[field];
        else remove.push(field);
      }
    } else {
      remove.push(...ALL_ADDRESS_FIELDS);
    }
    const abbreviation = normalizeDocumentAbbreviation(input.documentAbbreviation);
    if (abbreviation) set.documentAbbreviation = abbreviation;
    else remove.push("documentAbbreviation");
    if (input.companyLogoURL !== void 0) {
      const logo = text6(input.companyLogoURL);
      if (logo) set.companyLogoURL = logo;
      else remove.push("companyLogoURL");
    }
    const lat = finiteNumber3(input.defaultLatitude);
    const lon = finiteNumber3(input.defaultLongitude);
    if (lat != null && lon != null) {
      set.defaultLatitude = lat;
      set.defaultLongitude = lon;
    }
    if (input.bankHolidayRegionId !== void 0 && input.bankHolidayRegionId !== null) {
      const region = text6(input.bankHolidayRegionId).toUpperCase() || DEFAULT_BANK_HOLIDAY_REGION_ID;
      set.bankHolidayRegionId = region;
      set["settings.bankHolidayRegionId"] = region;
    }
    return { set, remove };
  }

  // lib/canonical/payrollPolicySchedule.ts
  var DEFAULT_ZONE = "Europe/London";
  var DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
  function zone(timeZone) {
    return String(timeZone || "").trim() || DEFAULT_ZONE;
  }
  function record2(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
  }
  function payrollDayKeyFromValue(value, timeZone) {
    if (typeof value === "string") {
      const trimmed6 = value.trim().slice(0, 10);
      return DAY_KEY_RE.test(trimmed6) ? trimmed6 : null;
    }
    let date = null;
    if (value instanceof Date) date = value;
    else if (value && typeof value === "object") {
      const v = value;
      if (typeof v.toDate === "function") date = v.toDate();
      else if (typeof v.seconds === "number") date = new Date(v.seconds * 1e3);
      else if (typeof v._seconds === "number") date = new Date(v._seconds * 1e3);
    }
    if (!date || Number.isNaN(date.getTime())) return null;
    return dayKeyInZone(date, zone(timeZone));
  }
  function shiftDayKey(dayKey, days, timeZone) {
    return dayKeyInZone(addDaysInZone(dateFromDayKeyInZone(dayKey, timeZone), days, timeZone), timeZone);
  }
  function parsePayrollTimePolicyScheduled(value, timeZone) {
    const raw = record2(value);
    const policy = record2(raw?.policy);
    if (!raw || !policy) return null;
    const effectiveFrom = payrollDayKeyFromValue(raw.effectiveFrom, timeZone);
    if (!effectiveFrom) return null;
    return { policy: parsePayrollPolicy(policy), effectiveFrom };
  }
  function parsePayrollTimePolicyState(orgDoc, timeZone) {
    const data = record2(orgDoc) ?? {};
    const priorRaw = record2(data.payrollTimePolicyPrior);
    return {
      current: parsePayrollPolicy(record2(data.payrollTimePolicy)),
      prior: priorRaw ? parsePayrollPolicy(priorRaw) : null,
      effectiveFrom: payrollDayKeyFromValue(data.payrollTimePolicyEffectiveFrom, timeZone),
      scheduled: parsePayrollTimePolicyScheduled(data.payrollTimePolicyScheduled, timeZone)
    };
  }
  function isState(value) {
    const v = record2(value);
    return Boolean(v && "current" in v && "scheduled" in v && record2(v.current));
  }
  function payrollTimePolicyForDayFromState(state, dayKey) {
    if (state.scheduled && dayKey >= state.scheduled.effectiveFrom) return state.scheduled.policy;
    if (state.prior && state.effectiveFrom && dayKey < state.effectiveFrom) return state.prior;
    return state.current;
  }
  function effectivePayrollTimePolicy(orgDoc, dayKey, timeZone) {
    const state = isState(orgDoc) ? orgDoc : parsePayrollTimePolicyState(orgDoc, timeZone);
    return payrollTimePolicyForDayFromState(state, dayKey);
  }
  function payrollTimePolicyTimeline(orgDoc, todayKey2, timeZone) {
    const tz = zone(timeZone);
    const state = isState(orgDoc) ? orgDoc : parsePayrollTimePolicyState(orgDoc, tz);
    const scheduled = state.scheduled;
    if (!scheduled || scheduled.effectiveFrom > todayKey2) return state;
    const dayBefore = shiftDayKey(scheduled.effectiveFrom, -1, tz);
    return {
      current: scheduled.policy,
      prior: payrollTimePolicyForDayFromState({ ...state, scheduled: null }, dayBefore),
      effectiveFrom: scheduled.effectiveFrom,
      scheduled: null
    };
  }
  function promotedFields(state, todayKey2, tz) {
    const promoted = payrollTimePolicyTimeline(state, todayKey2, tz);
    if (promoted === state) return {};
    return {
      payrollTimePolicy: payrollPolicyToFirestore(promoted.current),
      payrollTimePolicyPrior: promoted.prior ? payrollPolicyToFirestore(promoted.prior) : null,
      payrollTimePolicyEffectiveFrom: promoted.effectiveFrom,
      payrollTimePolicyScheduled: null
    };
  }
  function payrollTimePolicyApplyNowWriteFields(input) {
    const tz = zone(input.timeZone);
    const state = parsePayrollTimePolicyState(input.orgDoc, tz);
    const yesterday = shiftDayKey(input.todayKey, -1, tz);
    const prior = payrollTimePolicyForDayFromState(state, yesterday);
    const fields = {
      payrollTimePolicy: payrollPolicyToFirestore(input.policy),
      payrollTimePolicyPrior: payrollPolicyToFirestore(prior),
      payrollTimePolicyEffectiveFrom: input.todayKey
    };
    if (state.scheduled && state.scheduled.effectiveFrom <= input.todayKey) {
      fields.payrollTimePolicyScheduled = null;
    }
    return fields;
  }
  function payrollTimePolicyScheduleDateError(effectiveFrom, todayKey2) {
    if (!DAY_KEY_RE.test(String(effectiveFrom || ""))) return "Choose the date the new working hours start.";
    if (effectiveFrom <= todayKey2) return "Choose a date after today, or apply the change from today.";
    return null;
  }
  function payrollTimePolicyScheduleWriteFields(input) {
    if (payrollTimePolicyScheduleDateError(input.effectiveFrom, input.todayKey)) return null;
    const tz = zone(input.timeZone);
    const state = parsePayrollTimePolicyState(input.orgDoc, tz);
    return {
      ...promotedFields(state, input.todayKey, tz),
      payrollTimePolicyScheduled: {
        policy: payrollPolicyToFirestore(input.policy),
        effectiveFrom: input.effectiveFrom
      }
    };
  }
  function payrollTimePolicyCancelScheduleWriteFields(input) {
    const tz = zone(input.timeZone);
    const state = parsePayrollTimePolicyState(input.orgDoc, tz);
    const promoted = promotedFields(state, input.todayKey, tz);
    return Object.keys(promoted).length > 0 ? promoted : { payrollTimePolicyScheduled: null };
  }
  var PAYROLL_POLICY_LIMITS = {
    paidHours: { min: 1, max: 12 },
    breakMinutes: { min: 0, max: 120 },
    multiplier: { min: 1, max: 3 }
  };
  function inRange(value, limits) {
    return typeof value === "number" && Number.isFinite(value) && value >= limits.min && value <= limits.max;
  }
  function validClock(value) {
    const raw = String(value ?? "").trim();
    if (!/^\d{1,2}:\d{2}$/.test(raw)) return null;
    return parseClockMinutes(raw);
  }
  function validatePayrollTimePolicy(policy) {
    const { paidHours, breakMinutes, multiplier } = PAYROLL_POLICY_LIMITS;
    const clocks = [
      ["standardDayStart", "Standard day start"],
      ["standardDayEnd", "Standard day end"],
      ["breakWindowStart", "Break window start"],
      ["breakWindowEnd", "Break window end"]
    ];
    for (const [field, label] of clocks) {
      if (validClock(policy[field]) == null) return `${label} must be a valid 24h time (e.g. 07:30).`;
    }
    const dayStart = validClock(policy.standardDayStart);
    const dayEnd = validClock(policy.standardDayEnd);
    const breakStart = validClock(policy.breakWindowStart);
    const breakEnd = validClock(policy.breakWindowEnd);
    if (dayEnd <= dayStart) return "Standard day end must be after the start time.";
    if (breakEnd <= breakStart) return "Break window end must be after the break start.";
    if (breakStart < dayStart || breakEnd > dayEnd) return "Break window must fall within the working day.";
    if (!inRange(policy.standardPaidHours, paidHours)) {
      return `Standard paid hours must be between ${paidHours.min} and ${paidHours.max}.`;
    }
    if (!inRange(policy.unpaidBreakMinutes, breakMinutes)) {
      return `Break length must be between ${breakMinutes.min} and ${breakMinutes.max} minutes.`;
    }
    if (!inRange(policy.weekdayOutsideStandardMultiplier, multiplier)) {
      return `Weekday overtime rate must be between \xD7${multiplier.min} and \xD7${multiplier.max}.`;
    }
    const weekend = [["Saturday", policy.saturday]];
    if (!policy.sunday.sameAsSaturday) weekend.push(["Sunday", policy.sunday]);
    for (const [name, settings] of weekend) {
      if (settings.allHoursAtMultiplierMode) {
        if (!inRange(settings.allHoursMultiplier, multiplier)) {
          return `${name} rate must be between \xD7${multiplier.min} and \xD7${multiplier.max}.`;
        }
        continue;
      }
      const start = validClock(settings.definedWindowStart);
      const end = validClock(settings.definedWindowEnd);
      if (start == null || end == null) return `${name} window must use valid 24h times.`;
      if (end <= start) return `${name} window end must be after the start.`;
      if (settings.countsAsStandardHours != null && !inRange(settings.countsAsStandardHours, paidHours)) {
        return `${name} counts-as hours must be between ${paidHours.min} and ${paidHours.max}.`;
      }
      if (!inRange(settings.outsideWindowMultiplier, multiplier)) {
        return `${name} rate outside the window must be between \xD7${multiplier.min} and \xD7${multiplier.max}.`;
      }
    }
    return null;
  }
  var WORKING_WEEK = {
    firstDay: "monday",
    lastDay: "sunday",
    workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"]
  };
  function isStandardWorkingWeekday(isoWeekday) {
    return Number.isInteger(isoWeekday) && isoWeekday >= 1 && isoWeekday <= 5;
  }

  // lib/canonical/paymentRuns.ts
  var DEFAULT_ZONE2 = "Europe/London";
  var WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function zone2(timeZone) {
    return String(timeZone || "").trim() || DEFAULT_ZONE2;
  }
  function monthDay(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : 0;
  }
  function dayOfKey(dayKey) {
    return Number(dayKey.slice(8, 10)) || 0;
  }
  function formatPaymentRunDay(dayKey) {
    const [y, m, d] = dayKey.split("-").map((part) => Number(part));
    if (!y || !m || !d) return dayKey;
    const weekday2 = WEEKDAY_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `${weekday2} ${d} ${MONTH_SHORT[m - 1]}`;
  }
  function dateRangeRunIndex(invoicing, period) {
    const startDay = dayOfKey(period.startDayKey);
    const ranges = (invoicing.paymentRunDateRanges ?? []).slice(0, 2).map((range) => normalizePaymentRunRange(range));
    const exact = ranges.findIndex((range) => range?.startDay === startDay);
    if (exact >= 0) return exact;
    const containing = ranges.findIndex(
      (range) => range ? range.startDay <= range.endDay ? startDay >= range.startDay && startDay <= range.endDay : startDay >= range.startDay || startDay <= range.endDay : false
    );
    return containing >= 0 ? containing : 0;
  }
  function paymentRunPayDate(invoicing, period, timeZone) {
    const tz = zone2(timeZone);
    if (!period?.endDayKey) return null;
    const paymentDays = (invoicing.paymentDates ?? []).map((day2) => monthDay(day2));
    if (invoicing.paymentRunMode === "recurring_timeframe") {
      if (invoicing.paymentDateMode === "specific_dates") {
        const days = paymentDays.filter((day2) => day2 > 0).sort((a, b) => a - b);
        if (days.length === 0) return null;
        const [y, m, d] = period.endDayKey.split("-").map(Number);
        const next = new Date(Date.UTC(y, m - 1, d + 1));
        const nextDay = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
        return paymentDateAfterPeriodEnd(nextDay, days, tz);
      }
      return paymentWeekdayAfterPeriodEnd(period.endDayKey, invoicing.recurringPaymentDay || "friday", tz);
    }
    const index = dateRangeRunIndex(invoicing, period);
    const day = paymentDays[index] ?? 0;
    if (day <= 0) return null;
    return paymentDateAfterPeriodEnd(period.endDayKey, [day], tz);
  }
  function paymentRunLabel(period, payDate) {
    const span = `${formatPaymentRunDay(period.startDayKey)} \u2013 ${formatPaymentRunDay(period.endDayKey)}`;
    return payDate ? `${span} \xB7 paid ${formatPaymentRunDay(payDate)}` : span;
  }
  function activePaymentRunSummary(invoicing, now, timeZone) {
    if (!invoicing || typeof invoicing !== "object" || Array.isArray(invoicing)) return { notConfigured: true };
    const reference = now instanceof Date ? now : new Date(now);
    if (Number.isNaN(reference.getTime())) return { notConfigured: true };
    const tz = zone2(timeZone);
    const settings = parseInvoicing(invoicing);
    const period = invoicingPeriod({
      referenceIso: reference.toISOString(),
      timeZone: tz,
      paymentRunMode: settings.paymentRunMode,
      ranges: settings.paymentRunDateRanges,
      recurringRunStartDay: settings.recurringRunStartDay,
      recurringRunEndDay: settings.recurringRunEndDay
    });
    const payDate = paymentRunPayDate(settings, period, tz);
    return {
      notConfigured: false,
      start: period.startDayKey,
      end: period.endDayKey,
      payDate,
      label: paymentRunLabel(period, payDate)
    };
  }

  // lib/canonical/bookingTombstones.ts
  var BOOKING_TOMBSTONE_COLLECTION = "deletedBookings";
  var TOMBSTONED_BOOKING_COLLECTIONS = ["bookings", "managerSiteBookings"];
  var BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT = 200;
  var BOOKING_TOMBSTONE_FIELDS = ["bookingId", "collection", "deletedAt", "deletedBy", "deletedFrom"];
  function trimmed5(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function documentId(value) {
    const id2 = trimmed5(value);
    if (!id2 || id2.includes("/")) return "";
    return id2;
  }
  function isTombstonedBookingCollection(value) {
    return TOMBSTONED_BOOKING_COLLECTIONS.includes(trimmed5(value));
  }
  function bookingTombstonePath(organizationId, bookingId) {
    const org = documentId(organizationId);
    const id2 = documentId(bookingId);
    if (!org || !id2) return null;
    return `organizations/${org}/${BOOKING_TOMBSTONE_COLLECTION}/${id2}`;
  }
  function bookingTombstoneWriteFields(input) {
    const bookingId = documentId(input.bookingId);
    const collection = trimmed5(input.collection);
    const deletedBy = trimmed5(input.deletedBy);
    const deletedFrom = trimmed5(input.deletedFrom).toLowerCase();
    if (!bookingId || !deletedBy) return null;
    if (!isTombstonedBookingCollection(collection)) return null;
    if (!WRITE_PLATFORMS.includes(deletedFrom)) return null;
    return {
      bookingId,
      collection,
      deletedBy,
      deletedFrom
    };
  }
  function bookingReplayRefusedIsFinal(errorCode) {
    const code = (typeof errorCode === "number" ? String(errorCode) : trimmed5(errorCode)).toLowerCase();
    return code === "permission-denied" || code === "firestore/permission-denied" || code === "7";
  }
  var BOOKING_REPLAY_REFUSED_MESSAGE = "This booking was cancelled or deleted on another device.";

  // lib/canonical/materialCutOffWarnings.ts
  var DAY_KEY3 = /^\d{4}-\d{2}-\d{2}$/;
  function text7(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function instant(value) {
    if (value instanceof Date) return value;
    return new Date(value);
  }
  function dayKeyOf(row, timeZone) {
    const key2 = text7(row.dayKey);
    if (DAY_KEY3.test(key2)) return key2;
    const iso = text7(row.dateIso);
    if (!iso) return "";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : dayKeyInZone(date, timeZone);
  }
  function orderedMaterialIds(records) {
    const ids = /* @__PURE__ */ new Set();
    for (const record3 of records || []) {
      if (!record3 || text7(record3.requestType).toLowerCase() !== "order") continue;
      for (const id2 of record3.materialIds || []) {
        const value = text7(id2);
        if (value) ids.add(value);
      }
      for (const line of record3.lines || []) {
        const value = text7(line?.materialId);
        if (value) ids.add(value);
      }
    }
    return ids;
  }
  function materialLineCountsAsOrdered(line, sendRecords) {
    if (text7(line.status).toLowerCase() === "ordered") return true;
    return orderedMaterialIds(sendRecords).has(text7(line.id));
  }
  function materialCutOffWarningRows(input) {
    const timeZone = zoneOrLondon(input.timeZone);
    const now = instant(input.now);
    if (Number.isNaN(now.getTime())) return [];
    const clock = resolveMaterialCutOffClock({ organizationMaterialCutOff: input.cutOff ?? null });
    if (clock.materialOrderCutOff === false) return [];
    const parts = partsInZone(now, timeZone);
    if (parts.h * 60 + parts.min < materialCutOffClockMinutes(clock)) return [];
    const tomorrow = addDaysInZone(midnightInZone(now, timeZone), 1, timeZone);
    const weekday2 = isoWeekdayInZone(tomorrow, timeZone);
    if (weekday2 === 6 && clock.materialCutOffOnSaturday !== true) return [];
    if (weekday2 === 7 && clock.materialCutOffOnSunday !== true) return [];
    const tomorrowKey = dayKeyInZone(tomorrow, timeZone);
    const bookedProjectIds = [];
    const seen = /* @__PURE__ */ new Set();
    for (const booking of input.bookings || []) {
      const projectId = text7(booking?.projectId);
      if (!projectId || seen.has(projectId)) continue;
      if (!bookingOccupiesDay(normalizeBookingStatus(booking.status) ?? booking.status)) continue;
      if (dayKeyOf(booking, timeZone) !== tomorrowKey) continue;
      seen.add(projectId);
      bookedProjectIds.push(projectId);
    }
    const projectsById = new Map((input.projects || []).map((project) => [text7(project.id), project]));
    const ordered = orderedMaterialIds(input.sendRecords);
    const cutOffLabel = formatMaterialCutOffClock(clock);
    const rows = [];
    for (const projectId of bookedProjectIds) {
      const project = projectsById.get(projectId);
      if (!project) continue;
      const lines = (input.materials || []).filter(
        (line) => text7(line.projectId) === projectId && dayKeyOf(line, timeZone) === tomorrowKey
      );
      const unordered = lines.filter((line) => text7(line.status).toLowerCase() !== "ordered" && !ordered.has(text7(line.id)));
      if (lines.length > 0 && unordered.length === 0) continue;
      const jobNumber = text7(project.jobNumber) || text7(project.siteName) || projectId.slice(0, 8);
      const message = lines.length === 0 ? `No materials have been ordered for ${jobNumber} tomorrow's work (cut-off ${cutOffLabel}).` : `Materials for ${jobNumber} were not fully ordered by the cut-off ${cutOffLabel} for tomorrow's work (${unordered.length} line${unordered.length === 1 ? "" : "s"} still not ordered).`;
      const id2 = `materials-${projectId}-${tomorrowKey}`;
      rows.push({
        id: id2,
        resolutionKey: id2,
        type: "missed_material_order",
        severity: "low",
        title: "Material order not placed",
        projectId,
        jobNumber,
        projectLabel: `${text7(project.jobNumber)} ${text7(project.siteName)}`.trim() || jobNumber,
        dayKey: tomorrowKey,
        unorderedCount: lines.length === 0 ? 0 : unordered.length,
        cutOffLabel,
        message
      });
    }
    return rows.sort((a, b) => a.projectLabel.localeCompare(b.projectLabel));
  }

  // lib/canonical/passwordPolicy.ts
  var PASSWORD_MIN_LENGTH = 8;
  var DEVELOPER_PASSWORD_MIN_LENGTH = 10;
  function passwordMinLength(options) {
    return options?.developerAccount === true ? DEVELOPER_PASSWORD_MIN_LENGTH : PASSWORD_MIN_LENGTH;
  }
  function passwordPolicyError(password, options) {
    const value = typeof password === "string" ? password : "";
    const min = passwordMinLength(options);
    if (value.length < min) return `Password must be at least ${min} characters.`;
    return null;
  }

  // lib/canonical/timesheetEntryReviews.ts
  var TIMESHEET_ENTRY_DECISIONS = ["pending", "approved", "declined", "edited"];
  var TIMESHEET_ENTRY_REVIEWS_FIELD = "extraEntryReviews";
  var TIMESHEET_REVIEWER_ONLY_FIELDS = ["payrollLineReviews", "extraEntryReviews"];
  var TIMESHEET_SELF_SIGNED_OWNER_FIELDS = ["weeklyReportOverride"];
  var TIMESHEET_ENTRY_ARRAY_FIELDS = ["expenseEntries", "priceWorkEntries"];
  var AMOUNT_EPSILON = 5e-3;
  function finite(value) {
    const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(number) ? number : null;
  }
  function text8(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function parseTimesheetEntryDecision(raw) {
    return TIMESHEET_ENTRY_DECISIONS.includes(raw) ? raw : "approved";
  }
  function parseReview(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw;
    const decision = parseTimesheetEntryDecision(row.decision);
    return {
      decision,
      revisedAmount: decision === "edited" ? finite(row.revisedAmount) : null,
      reviewedAmount: finite(row.reviewedAmount),
      reviewedByUserId: text8(row.reviewedByUserId),
      reviewedAtMs: finite(row.reviewedAtMs)
    };
  }
  function parseTimesheetEntryReviews(sheet) {
    const raw = sheet ? sheet[TIMESHEET_ENTRY_REVIEWS_FIELD] : void 0;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const output = {};
    for (const [entryId, value] of Object.entries(raw)) {
      const review = parseReview(value);
      if (review && entryId.trim()) output[entryId] = review;
    }
    return output;
  }
  function timesheetEntryEffectiveAmount(decision, revisedAmount, amount) {
    if (decision === "declined") return 0;
    if (decision === "edited") return finite(revisedAmount) ?? amount;
    return amount;
  }
  function timesheetEntryDecision(sheet, entry) {
    const row = entry || {};
    const id2 = text8(row.id);
    const amount = finite(row.amount) ?? 0;
    const inlineDecision = parseTimesheetEntryDecision(row.managerDecision);
    const inline = {
      decision: inlineDecision,
      revisedAmount: inlineDecision === "edited" ? finite(row.managerRevisedAmount) : null,
      source: "legacy-inline"
    };
    const reviews = parseTimesheetEntryReviews(sheet);
    let base;
    if (reviews == null) {
      const managerSigned = parseTimesheetStatusFields(sheet || {}).managerSignedAtMs != null;
      if (managerSigned) return inline;
      base = { decision: "approved", revisedAmount: null, source: "unreviewed" };
    } else {
      const review = id2 ? reviews[id2] : void 0;
      if (!review) {
        base = { decision: "approved", revisedAmount: null, source: "unreviewed" };
      } else if (review.reviewedAmount != null && Math.abs(review.reviewedAmount - amount) >= AMOUNT_EPSILON) {
        base = { decision: "pending", revisedAmount: null, source: "stale-review" };
      } else {
        base = { decision: review.decision, revisedAmount: review.revisedAmount, source: "review" };
      }
    }
    const inlinePaid = timesheetEntryEffectiveAmount(inline.decision, inline.revisedAmount, amount);
    const basePaid = timesheetEntryEffectiveAmount(base.decision, base.revisedAmount, amount);
    if (inlinePaid < basePaid - AMOUNT_EPSILON) return { ...inline, source: "inline-lower" };
    return base;
  }
  function sameNumber(a, b) {
    const left = finite(a);
    const right = finite(b);
    if (left == null || right == null) return left == null && right == null;
    return Math.abs(left - right) < AMOUNT_EPSILON;
  }
  function timesheetEntryReviewWriteFields(input) {
    const stored = input.stored || {};
    const reviewer = text8(input.reviewedByUserId);
    const output = {};
    for (const entry of input.entries) {
      const id2 = text8(entry.id);
      if (!id2 || /[.`~*/[\]]/.test(id2)) continue;
      const decision = parseTimesheetEntryDecision(entry.managerDecision);
      const revisedAmount = decision === "edited" ? finite(entry.managerRevisedAmount) : null;
      const amount = finite(entry.amount) ?? 0;
      const prior = stored[id2];
      if (input.stored && prior && prior.decision === decision && sameNumber(prior.revisedAmount, revisedAmount) && sameNumber(prior.reviewedAmount, amount)) {
        continue;
      }
      output[`${TIMESHEET_ENTRY_REVIEWS_FIELD}.${id2}`] = {
        decision,
        revisedAmount,
        reviewedAmount: amount,
        reviewedByUserId: reviewer,
        reviewedAtMs: Math.round(Number(input.reviewedAtMs) || 0)
      };
    }
    return output;
  }
  function timesheetEntryReviewsAfterWrite(stored, written) {
    const keys = Object.keys(written);
    if (keys.length === 0) return stored ?? null;
    const output = { ...stored || {} };
    const prefix = `${TIMESHEET_ENTRY_REVIEWS_FIELD}.`;
    for (const key2 of keys) {
      const review = parseReview(written[key2]);
      if (review && key2.startsWith(prefix)) output[key2.slice(prefix.length)] = review;
    }
    return output;
  }
  function timesheetWriterIsReviewer(input) {
    const writer = text8(input.writerUserId).toLowerCase();
    if (!writer) return false;
    if (input.writerIsAdmin === true) return true;
    if (writer === text8(input.subjectUserId).toLowerCase()) return false;
    const keys = new Set([writer, ...(input.writerFormerIds ?? []).map((id2) => text8(id2).toLowerCase())].filter(Boolean));
    return (input.subjectLineManagerIds ?? []).some((id2) => keys.has(text8(id2).toLowerCase()));
  }
  function timesheetOwnerWriteFields(fields, input) {
    const output = { ...fields };
    for (const key2 of TIMESHEET_REVIEWER_ONLY_FIELDS) delete output[key2];
    for (const key2 of Object.keys(output)) {
      if (key2.startsWith(`${TIMESHEET_ENTRY_REVIEWS_FIELD}.`)) delete output[key2];
    }
    if (input.subjectHasLineManager) {
      for (const key2 of TIMESHEET_SELF_SIGNED_OWNER_FIELDS) delete output[key2];
    }
    if (input.managerSigned) {
      for (const key2 of TIMESHEET_ENTRY_ARRAY_FIELDS) delete output[key2];
    }
    return output;
  }

  // lib/canonical/payAccess.ts
  function id(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  function canChangePersonPay(writer, subject) {
    const writerId = id(writer.userId);
    if (!writerId) return false;
    if (writer.isPlatformOwner === true || writer.isAdmin === true) return true;
    if (writerId === id(subject.userId)) return false;
    return writer.isManager === true && writer.hasOperativesAccess === true && writer.isOperativeMode !== true && subject.isOperative === true;
  }
  return __toCommonJS(bundleEntry_exports);
})();
