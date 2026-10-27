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
    BOOKING_STATUSES: () => BOOKING_STATUSES,
    BOOKING_TIME_SLOTS: () => BOOKING_TIME_SLOTS,
    CANONICAL_STANDARD_BREAK: () => CANONICAL_STANDARD_BREAK,
    CANONICAL_STANDARD_DAY: () => CANONICAL_STANDARD_DAY,
    DEFAULT_ANNUAL_LEAVE_DAYS: () => DEFAULT_ANNUAL_LEAVE_DAYS,
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
    DEVICE_PUSH_NOTIFICATION_TYPES: () => DEVICE_PUSH_NOTIFICATION_TYPES,
    FILE_REPORT_DETAILS_MAX: () => FILE_REPORT_DETAILS_MAX,
    FILE_REPORT_FILE_NAME_MAX: () => FILE_REPORT_FILE_NAME_MAX,
    FILE_REPORT_LINK_LABEL: () => FILE_REPORT_LINK_LABEL,
    FILE_REPORT_REASONS: () => FILE_REPORT_REASONS,
    FILE_REPORT_SENT_COPY: () => FILE_REPORT_SENT_COPY,
    FILE_REPORT_STATUSES: () => FILE_REPORT_STATUSES,
    FILE_REPORT_SURFACES: () => FILE_REPORT_SURFACES,
    IOS_SESSION_ORGANIZATION_STORAGE_KEY: () => IOS_SESSION_ORGANIZATION_STORAGE_KEY,
    LEGACY_NOTIFICATION_PREFERENCE_ALIASES: () => LEGACY_NOTIFICATION_PREFERENCE_ALIASES,
    LEGACY_PLACEHOLDER_DOCUMENT_ID: () => LEGACY_PLACEHOLDER_DOCUMENT_ID,
    MANAGER_LOCATION_TYPES: () => MANAGER_LOCATION_TYPES,
    MANAGER_TIME_SLOTS: () => MANAGER_TIME_SLOTS,
    MATERIAL_WHATSAPP_ITEM_LIMIT: () => MATERIAL_WHATSAPP_ITEM_LIMIT,
    MIN_HALF_DAY_MINUTES: () => MIN_HALF_DAY_MINUTES,
    NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND: () => NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND,
    NOTIFICATION_PREFERENCE_KEYS: () => NOTIFICATION_PREFERENCE_KEYS,
    ORPHAN_BOOKING_LABEL: () => ORPHAN_BOOKING_LABEL,
    PAYE_PAY_CELL_LABEL: () => PAYE_PAY_CELL_LABEL,
    PAYMENT_GRACE_MS: () => PAYMENT_GRACE_MS,
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
    TIMESHEET_EXPORT_STORAGE_FOLDER: () => TIMESHEET_EXPORT_STORAGE_FOLDER,
    TIMESHEET_INVOICE_EXPORT_LEFTOVER_MS: () => TIMESHEET_INVOICE_EXPORT_LEFTOVER_MS,
    TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT: () => TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT,
    TIMESHEET_NOTIFY_HOUR: () => TIMESHEET_NOTIFY_HOUR,
    TIMESHEET_NOTIFY_MINUTE: () => TIMESHEET_NOTIFY_MINUTE,
    TIMESHEET_SIGNED_AFTER_MS: () => TIMESHEET_SIGNED_AFTER_MS,
    TIMESHEET_SUBMISSION_NOTICE_TITLE: () => TIMESHEET_SUBMISSION_NOTICE_TITLE,
    TIMESHEET_SUBMISSION_NOTICE_TYPE: () => TIMESHEET_SUBMISSION_NOTICE_TYPE,
    USER_DOCUMENT_FIELDS: () => USER_DOCUMENT_FIELDS,
    USER_FORMER_IDS_FIELD: () => USER_FORMER_IDS_FIELD,
    USER_SELF_CREATE_AGE_FIELDS: () => USER_SELF_CREATE_AGE_FIELDS,
    WEB_SESSION_ORGANIZATION_STORAGE_PREFIX: () => WEB_SESSION_ORGANIZATION_STORAGE_PREFIX,
    accessProbeFromReadError: () => accessProbeFromReadError,
    accountKindFromFlags: () => accountKindFromFlags,
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
    bookingOccupiesDay: () => bookingOccupiesDay,
    bookingPersonKey: () => bookingPersonKey,
    bookingWriteFields: () => bookingWriteFields,
    bookingsToRemoveOnOperativeDelete: () => bookingsToRemoveOnOperativeDelete,
    bookingsToRemoveOnProjectDelete: () => bookingsToRemoveOnProjectDelete,
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
    clockMinutesFromDeliveryInstant: () => clockMinutesFromDeliveryInstant,
    coalesceOrganizationName: () => coalesceOrganizationName,
    compareInboxNotificationsByCreatedAt: () => compareInboxNotificationsByCreatedAt,
    compareWarningDayKeys: () => compareWarningDayKeys,
    coverageWindow: () => coverageWindow,
    dayKeyInOrganizationZone: () => dayKeyInOrganizationZone,
    defaultMaterialDeliveryDayKey: () => defaultMaterialDeliveryDayKey,
    defaultMaterialDeliveryRequiredAt: () => defaultMaterialDeliveryRequiredAt,
    defaultTimesheetSubmissionFromPaymentDay: () => defaultTimesheetSubmissionFromPaymentDay,
    defaultTimesheetSubmissionFromPaymentWeekday: () => defaultTimesheetSubmissionFromPaymentWeekday,
    devicePushNotificationTypes: () => devicePushNotificationTypes,
    displayOrganizationName: () => displayOrganizationName,
    dueTimesheetSubmissionNotices: () => dueTimesheetSubmissionNotices,
    employmentEffectiveLabel: () => employmentEffectiveLabel,
    employmentTypeOnDay: () => employmentTypeOnDay,
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
    formerIdAliases: () => formerIdAliases,
    halfDayWindows: () => halfDayWindows,
    hasAccess: () => hasAccess,
    hasAnnualLeaveAllowance: () => hasAnnualLeaveAllowance,
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
    isFileReportReason: () => isFileReportReason,
    isFileReportSurface: () => isFileReportSurface,
    isIdentifiablePendingLeftover: () => isIdentifiablePendingLeftover,
    isLegacyPlaceholderDocumentId: () => isLegacyPlaceholderDocumentId,
    isOpenBookingStatus: () => isOpenBookingStatus,
    isStaffAccount: () => isStaffAccount,
    isTimesheetAwaitingSignOff: () => isTimesheetAwaitingSignOff,
    isTimesheetExported: () => isTimesheetExported,
    isTimesheetFullySigned: () => isTimesheetFullySigned,
    isTimesheetManagerSigned: () => isTimesheetManagerSigned,
    isTimesheetOperativeSigned: () => isTimesheetOperativeSigned,
    labourBookingKind: () => labourBookingKind,
    labourPersonIds: () => labourPersonIds,
    leaveCoverageRows: () => leaveCoverageRows,
    leaveSlotKind: () => leaveSlotKind,
    leaveYearBounds: () => leaveYearBounds,
    legalPackNeedsAcceptance: () => legalPackNeedsAcceptance,
    listedCurrentLabourPeople: () => listedCurrentLabourPeople,
    listedRosterUsers: () => listedRosterUsers,
    maskSensitiveValue: () => maskSensitiveValue,
    matchesRosterSegment: () => matchesRosterSegment,
    matchesUserRosterSegment: () => matchesUserRosterSegment,
    materialCutOffClockMinutes: () => materialCutOffClockMinutes,
    materialCutOffToFirestore: () => materialCutOffToFirestore,
    materialDeliveryInstant: () => materialDeliveryInstant,
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
    normalizeEmploymentType: () => normalizeEmploymentType,
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
    orgAccessProbeFromReads: () => orgAccessProbeFromReads,
    organizationIdFromValue: () => organizationIdFromValue,
    organizationIdsMatch: () => organizationIdsMatch,
    organizationNameToFirestore: () => organizationNameToFirestore,
    organizationNameWriteFields: () => organizationNameWriteFields,
    organizationScopedKey: () => organizationScopedKey,
    overlappingIntervalGroups: () => overlappingIntervalGroups,
    paidHoursForNamedSlot: () => paidHoursForNamedSlot,
    parseBookingDocument: () => parseBookingDocument,
    parseClockMinutes: () => parseClockMinutes,
    parseFormerUserIds: () => parseFormerUserIds,
    parseInvoicing: () => parseInvoicing,
    parseManagerSiteBookingDocument: () => parseManagerSiteBookingDocument,
    parseMaterialCutOff: () => parseMaterialCutOff,
    parseOrganizationName: () => parseOrganizationName,
    parsePaymentRunDateRanges: () => parsePaymentRunDateRanges,
    parsePaymentRunHistory: () => parsePaymentRunHistory,
    parsePayrollPolicy: () => parsePayrollPolicy,
    parseTimesheetStatusFields: () => parseTimesheetStatusFields,
    parseTimesheetSubmissionEntry: () => parseTimesheetSubmissionEntry,
    parseTimesheetSubmissionList: () => parseTimesheetSubmissionList,
    parseUserNotificationPreferences: () => parseUserNotificationPreferences,
    parseWarningDetection: () => parseWarningDetection,
    parseWarningsSortDirection: () => parseWarningsSortDirection,
    paymentDateAfterPeriodEnd: () => paymentDateAfterPeriodEnd,
    paymentRunHistoryAfterChange: () => paymentRunHistoryAfterChange,
    paymentRunHistoryToFirestore: () => paymentRunHistoryToFirestore,
    paymentRunMonthDay: () => paymentRunMonthDay,
    paymentRunRangeToFirestore: () => paymentRunRangeToFirestore,
    paymentRunShowsMonthCoverage: () => paymentRunShowsMonthCoverage,
    payrollHoursResult: () => payrollHoursResult,
    payrollOutsideMultiplier: () => payrollOutsideMultiplier,
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
    resolveSensitiveProfile: () => resolveSensitiveProfile,
    resolveTimesheetExportedAtMs: () => resolveTimesheetExportedAtMs,
    resolveTimesheetPeriod: () => resolveTimesheetPeriod,
    rosterAliasIdsFor: () => rosterAliasIdsFor,
    rosterPersonName: () => rosterPersonName,
    rosterSegment: () => rosterSegment,
    rosterStatusLabel: () => rosterStatusLabel,
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
    timesheetExportStoragePath: () => timesheetExportStoragePath,
    timesheetExportWriteFields: () => timesheetExportWriteFields,
    timesheetListBucket: () => timesheetListBucket,
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
    visibleNotificationPreferenceKeys: () => visibleNotificationPreferenceKeys,
    warningDayKeyIsDated: () => warningDayKeyIsDated,
    warningDetectionToFirestore: () => warningDetectionToFirestore,
    webSessionOrganizationStorageKey: () => webSessionOrganizationStorageKey,
    weekdayOffsetBefore: () => weekdayOffsetBefore,
    withoutDismissedQualificationRows: () => withoutDismissedQualificationRows
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
    const id = String(userId || "").trim();
    return id ? `${WEB_SESSION_ORGANIZATION_STORAGE_PREFIX}${id}` : "";
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
      const trimmed5 = value.trim();
      if (!trimmed5) return "";
      if (trimmed5.includes("/")) {
        const parts = trimmed5.split("/").filter(Boolean);
        return parts[parts.length - 1] || "";
      }
      return trimmed5;
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
    const text4 = String(value ?? "").trim();
    const match = /^(\d{1,2}):(\d{2})$/.exec(text4);
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
  function coverageWindow(input) {
    const timeZone = zoneOf(input.timeZone);
    const today = midnightInZone(new Date(input.referenceIso), timeZone);
    const todayKey2 = dayKeyInZone(today, timeZone);
    const mode = String(input.clashLookaheadMode || "endOfWorkingWeek");
    if (mode === "numberOfDays") {
      const days = Math.max(1, Math.min(Number(input.clashLookaheadDays) || 1, 366));
      return {
        startDayKey: todayKey2,
        endDayKey: dayKeyInZone(addDaysInZone(today, days - 1, timeZone), timeZone)
      };
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
    for (const id of person.formerIds || []) {
      const trimmed5 = String(id || "").trim();
      if (trimmed5) ids.add(trimmed5);
    }
    return [...ids];
  }
  function formerIdAliases(people) {
    const aliases = {};
    for (const person of people) {
      for (const id of labourPersonIds(person)) {
        if (id !== person.id && !(id in aliases)) aliases[id] = person.id;
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
    const excludedIds = new Set((input.excludedUserIds || []).map((id) => String(id)));
    const isExcluded = (person) => labourPersonIds(person).some((id) => excludedIds.has(id));
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
      for (const id of labourPersonIds(person)) ids.add(id);
      userIdsByEmail.set(email, ids);
    }
    const withFormerIds = (target, userId) => {
      if (!userId) return;
      for (const id of idsByUserId.get(userId) || [userId]) target.add(id);
    };
    const slotsFor = (email, operativeId, userId, dayKey) => {
      const ids = /* @__PURE__ */ new Set();
      if (operativeId) ids.add(operativeId);
      withFormerIds(ids, userId);
      const linked = operativeIdsByEmail.get(email);
      if (linked) for (const id of linked) ids.add(id);
      const linkedUsers = userIdsByEmail.get(email);
      if (linkedUsers) for (const id of linkedUsers) ids.add(id);
      const slots = [];
      for (const id of ids) {
        slots.push(...operativeBookings.get(`${id}|${dayKey}`) || []);
        slots.push(...managerBookings.get(`${id}|${dayKey}`) || []);
      }
      return slots;
    };
    const approvedHolidays = input.holidays.filter((holiday) => holiday.approved);
    const holidayCovers = (dayKey, email, userId, operativeId) => {
      const userIds = /* @__PURE__ */ new Set();
      withFormerIds(userIds, userId);
      const linkedUsers = userIdsByEmail.get(email);
      if (linkedUsers) for (const id of linkedUsers) userIds.add(id);
      const operativeIds = /* @__PURE__ */ new Set();
      if (operativeId) operativeIds.add(operativeId);
      const linkedOps = operativeIdsByEmail.get(email);
      if (linkedOps) for (const id of linkedOps) operativeIds.add(id);
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
    const text4 = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "");
    return `${text4} hour${rounded === 1 ? "" : "s"}`;
  }
  function joinRanges(intervals) {
    const labels = intervals.map(rangeLabel);
    if (labels.length <= 1) return labels[0] || "";
    return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  }
  function leaveCoverageRows(input) {
    const timeZone = zoneOrLondon(input.timeZone);
    const windows = halfDayWindows(input.day);
    const excluded = new Set((input.excludedUserIds || []).map((id) => String(id)));
    const approvedLeave = input.leave.filter((record) => record.approved && record.startDayKey && record.endDayKey);
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
    const personForLeave = (record) => {
      const userId = String(record.userId || "").trim();
      if (userId && peopleByUserId.has(userId)) return peopleByUserId.get(userId);
      const operativeId = String(record.operativeId || "").trim();
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
      for (const record of approvedLeave) {
        if (dayKey < record.startDayKey || dayKey > record.endDayKey) continue;
        const person = personForLeave(record);
        if (!person) continue;
        const dedupe = `${person.personKey}|${dayKey}|${record.id}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        const leaveSlot = leaveSlotKind(record.timeSlot);
        const leaveWindow = leaveSlot === "AM" ? windows.am : leaveSlot === "PM" ? windows.pm : windows.day;
        const dayBookings = bookingsByPersonDay.get(`${person.personKey}|${dayKey}`) || [];
        const intervals = dayBookings.map((booking) => ({ booking, interval: slotInterval(booking, input.day) })).filter((entry) => entry.interval !== null);
        const personName = String(person.name || "").trim() || person.personKey;
        const userId = String(person.userId || "").trim() || void 0;
        const operativeId = String(record.operativeId || person.operativeIds?.[0] || "").trim() || void 0;
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
            id: `leave-clash-${dayKey}-${person.personKey}-${record.id}`,
            kind: "leave_clash",
            personKey: person.personKey,
            personName,
            userId,
            operativeId,
            dayKey,
            leaveId: record.id,
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
          id: `leave-cover-${dayKey}-${person.personKey}-${record.id}`,
          kind: "leave_cover",
          personKey: person.personKey,
          personName,
          userId,
          operativeId,
          dayKey,
          leaveId: record.id,
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
    const zone = zoneOrLondon(timeZone);
    const dim = daysInZoneMonth(monthAnchor(year, month, zone), zone);
    const clamped = Math.min(Math.max(monthDayOrZero(day) || 1, 1), dim);
    return `${year}-${pad2(month)}-${pad2(clamped)}`;
  }
  function paymentDateAfterPeriodEnd(periodEndDayKey, paymentDays, timeZone) {
    const zone = zoneOrLondon(timeZone);
    const days = paymentDays.map((day) => monthDayOrZero(day)).filter((day) => day > 0);
    if (!periodEndDayKey || days.length === 0) return null;
    const periodEnd = dateFromDayKeyInZone(periodEndDayKey, zone);
    const { y, m } = partsInZone(periodEnd, zone);
    for (const day of days) {
      const candidate = clampMonthDayInZone(y, m, day, zone);
      if (candidate >= periodEndDayKey) return candidate;
    }
    const next = shiftYearMonth(y, m, 1);
    return clampMonthDayInZone(next.y, next.m, days[0], zone);
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
        const dayAfter = addDaysInZone(dateFromDayKeyInZone(period.endDayKey, timeZone), 1, timeZone);
        const payIso = TIMESHEET_SUBMISSION_WEEKDAYS.indexOf(normalizeTimesheetWeekday(input.recurringPaymentDay || "friday")) + 1;
        let pay = dayAfter;
        for (let step = 0; step < 7; step += 1) {
          if (isoWeekdayInZone(pay, timeZone) === payIso) break;
          pay = addDaysInZone(pay, 1, timeZone);
        }
        const paymentDayKey = dayKeyInZone(pay, timeZone);
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
    const have = new Set(existingDocumentIds.map((id) => String(id || "").trim()).filter(Boolean));
    return libraryCodes.filter((code) => {
      const id = String(code || "").trim();
      return Boolean(id) && !have.has(id);
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
    const trimmed5 = String(name || "").trim();
    return trimmed5 ? { name: trimmed5 } : {};
  }
  function organizationNameWriteFields(nextName, existingName) {
    const next = String(nextName || "").trim();
    if (next) return { name: next };
    void existingName;
    return {};
  }
  function coalesceOrganizationName(...candidates) {
    for (const value of candidates) {
      const trimmed5 = String(value || "").trim();
      if (trimmed5) return trimmed5;
    }
    return "";
  }
  function displayOrganizationName(name, fallback = "Organisation") {
    const trimmed5 = String(name || "").trim();
    return trimmed5 || fallback;
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
    return value.map((id) => String(id).trim()).filter(Boolean);
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
  function excludedUnbookedUserIds(record) {
    if (Array.isArray(record.excludedUserIdsFromUnbookedWarnings)) {
      return stringIdList(record.excludedUserIdsFromUnbookedWarnings);
    }
    for (const key2 of ["excludedUserIds", "excludedUsers", "excludedUserIdsFromWarnings", "unbookedWarningExcludedUserIds"]) {
      if (Array.isArray(record[key2])) return stringIdList(record[key2]);
    }
    return [];
  }
  function parseWarningDetection(data) {
    const record = asSettingsRecord(data);
    if (!record) return { ...DEFAULT_WARNING_DETECTION, excludedUserIdsFromUnbookedWarnings: [] };
    const daysRaw = record.clashLookaheadDays ?? record.lookaheadDays ?? record.lookAheadDays ?? record.numberOfDays ?? record.daysAhead;
    const days = daysRaw === void 0 || daysRaw === null ? DEFAULT_WARNING_DETECTION.clashLookaheadDays : daysRaw;
    return {
      detectClashes: record.detectClashes !== false,
      clashLookaheadMode: parseClashLookaheadMode(
        record.clashLookaheadMode ?? record.lookAheadMode ?? record.lookaheadMode
      ),
      clashLookaheadDays: clampClashLookaheadDays(days),
      includeWeekendsForUnbookedLabour: Boolean(record.includeWeekendsForUnbookedLabour),
      excludedUserIdsFromUnbookedWarnings: excludedUnbookedUserIds(record)
    };
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
      const id = typeof value === "string" ? value.trim() : "";
      if (id) ids.add(id);
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
    const zone = zoneOrLondon(timeZone);
    if (dayKeyInZone(day, zone) < dayKeyInZone(effectiveAt, zone)) {
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
    const zone = zoneOrLondon(input.timeZone);
    const todayKey2 = dayKeyInZone(input.now ?? /* @__PURE__ */ new Date(), zone);
    if (input.effectiveAt === "immediate") {
      return { employmentType: next, employmentTypeTransitionFrom: null, employmentTypeEffectiveAt: null };
    }
    const when = validDay(input.effectiveAt);
    if (!when || dayKeyInZone(when, zone) <= todayKey2) {
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
    const zone = zoneOrLondon(timeZone);
    if (dayKeyInZone(now, zone) >= dayKeyInZone(effectiveAt, zone)) return "Effective immediately";
    const [year, month, day] = dayKeyInZone(effectiveAt, zone).split("-").map(Number);
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
    "timesheetSubmissionReminder"
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
    timesheetSubmissionReminder: true
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
    [TIMESHEET_SUBMISSION_NOTICE_TYPE]: "timesheetSubmissionReminder"
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
    timesheetSubmissionReminder: "Timesheet submission reminder"
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
      timesheetSubmissionReminder: "Reminder to submit before the payment-run deadline."
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
  function bookingDays(startDayKey, endDayKey, timeZone) {
    const keys = eachDayKey(startDayKey, endDayKey || startDayKey, timeZone);
    return keys.length;
  }
  function bookingCount(booking, timeZone) {
    const start = String(booking.startDayKey || "").trim();
    if (!parseDayKey(start)) return 0;
    const end = String(booking.endDayKey || start).trim() || start;
    return snapLeaveDays(bookingDays(start, end, timeZone) * leaveUnits(booking.timeSlot));
  }
  function bookingsInYear(bookings, startDayKey, endDayKey, status, timeZone) {
    let total = 0;
    for (const booking of bookings) {
      const raw = String(booking.status || "approved").toLowerCase();
      if (raw !== status) continue;
      const start = String(booking.startDayKey || "").trim();
      if (start < startDayKey || start > endDayKey) continue;
      total += bookingCount(booking, timeZone);
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
    const taken = bookingsInYear(bookings, year.startDayKey, year.endDayKey, "approved", timeZone);
    const pending = bookingsInYear(bookings, year.startDayKey, year.endDayKey, "pending", timeZone);
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
        timeZone
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
  function recordFields(record) {
    return {
      name: fieldTokens(record.name),
      brand: fieldTokens(record.brand),
      code: fieldTokens(record.productCode),
      extra: [
        ...fieldTokens(record.category),
        ...fieldTokens(record.size),
        ...fieldTokens(record.length)
      ]
    };
  }
  function materialSearchScore(query, record) {
    const tokens = tokenizeMaterialSearch(query);
    if (tokens.length === 0) return 1;
    const fields = recordFields(record);
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
    const name = normalizeMaterialSearchText(record.name);
    const joined = tokens.join(" ");
    if (name.startsWith(joined)) score += 24;
    else if (name.includes(joined)) score += 10;
    const nameLength = name.length;
    if (nameLength > 0) score += Math.max(0, 20 - Math.floor(nameLength / 8));
    return score;
  }
  function materialRecordMatches(query, record) {
    return materialSearchScore(query, record) > 0;
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
  function recordFields2(record) {
    return {
      name: fieldTokens2(record.name),
      code: fieldTokens2(record.code),
      body: fieldTokens2(record.awardingBody),
      extra: [
        ...fieldTokens2(record.section),
        ...fieldTokens2(record.subsection),
        ...fieldTokens2(record.notes)
      ]
    };
  }
  function qualificationSearchScore(query, record) {
    const tokens = tokenizeQualificationSearch(query);
    if (tokens.length === 0) return 1;
    const fields = recordFields2(record);
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
    const name = normalizeQualificationSearchText(record.name);
    const joined = tokens.join(" ");
    if (name.startsWith(joined)) score += 24;
    else if (name.includes(joined)) score += 10;
    if (name.length > 0) score += Math.max(0, 20 - Math.floor(name.length / 8));
    return score;
  }
  function qualificationRecordMatches(query, record) {
    return qualificationSearchScore(query, record) > 0;
  }
  function qualificationMatchesSection(record, section) {
    const wanted = String(section || "").trim();
    if (!wanted || wanted === QUALIFICATION_FILTER_ALL) return true;
    const value = String(record.section || "").trim();
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
    for (const record of records) {
      const section = String(record.section || "").trim();
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
    const id = trimId(row.id);
    const name = String(row.name || "").trim();
    if (!id || !name) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const createdAtIso = isoFromUnknown(row.createdAtIso) || isoFromUnknown(row.createdAt) || now;
    const updatedAtIso = isoFromUnknown(row.updatedAtIso) || isoFromUnknown(row.updatedAt) || createdAtIso;
    const endDateIso = isoFromUnknown(row.endDateIso) || isoFromUnknown(row.endDate);
    const write = {
      id,
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
    const id = trimId(qualificationId);
    if (!id) return void 0;
    const direct = urls[id];
    if (typeof direct === "string" && direct.trim()) return direct;
    const target = id.toLowerCase();
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
    for (const id of removedIds || []) {
      const target = trimId(id).toLowerCase();
      if (!target) continue;
      for (const key2 of Object.keys(next)) {
        if (key2.toLowerCase() === target) delete next[key2];
      }
    }
    return next;
  }
  function removedQualificationCertificateIds(previousUrls, nextUrls, assignedIds) {
    const removed = [];
    for (const id of assignedIds) {
      const key2 = trimId(id);
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
    for (const id of nextAssignmentIds) {
      const target = id.toLowerCase();
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
    const zone = zoneOrLondon(timeZone);
    const now = new Date(referenceIso);
    if (Number.isNaN(now.getTime())) {
      return dayKeyInZone(/* @__PURE__ */ new Date(), zone);
    }
    const weekday2 = isoWeekdayInZone(now, zone);
    const daysAhead = weekday2 === 6 ? 2 : 1;
    return dayKeyInZone(addDaysInZone(now, daysAhead, zone), zone);
  }
  function materialDeliveryInstant(dayKey, clockMinutes, timeZone) {
    const zone = zoneOrLondon(timeZone);
    const midnight = dateFromDayKeyInZone(dayKey, zone);
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
    const zone = zoneOrLondon(timeZone);
    const parts = partsInZone(at, zone);
    return parts.h * 60 + parts.min;
  }
  function formatMaterialDeliveryRequired(at, timeZone) {
    const zone = zoneOrLondon(timeZone);
    const day = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(at);
    return `${day} at ${formatClockMinutes(clockMinutesFromDeliveryInstant(at, zone))}`;
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
    const trimmed5 = trim(raw);
    if (!trimmed5) return { ok: false, reason: "No mobile number is saved for this contact." };
    let working = trimmed5.replace(/[^\d+]/g, "");
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
      const id = key(account.id);
      if (!id || seen.has(id)) continue;
      if (account.isActive === false || !isStaffAccount(account.role)) continue;
      const ids = accountKeys(account);
      if (ids.some((value) => adder.has(value))) continue;
      const named = ids.some((value) => jobIds.has(value)) || key(account.email) !== "" && jobEmails.has(key(account.email));
      if (!named) continue;
      seen.add(id);
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
      const record = value;
      if (typeof record.toDate === "function") {
        try {
          const parsed = record.toDate();
          const ms = timestampMs(parsed);
          if (ms != null) return ms;
        } catch {
        }
      }
      const seconds = typeof record.seconds === "number" ? record.seconds : record._seconds;
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
      const id = trimmedId(user.userId);
      if (id && !reuseUserId) reuseUserId = id;
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
  function isLegacyPlaceholderDocumentId(id) {
    return (id || "").trim().toUpperCase() === LEGACY_PLACEHOLDER_DOCUMENT_ID;
  }
  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : void 0;
  }
  function isBookingUuid(value) {
    return UUID_PATTERN.test(text(value));
  }
  function normalizeBookingStatus(raw) {
    const value = text(raw);
    if (!value) return null;
    if (BOOKING_STATUSES.includes(value)) return value;
    return STATUS_ALIASES[value.toLowerCase()] ?? null;
  }
  function isOpenBookingStatus(raw) {
    const status = normalizeBookingStatus(raw);
    return status === "Confirmed" || status === "Tentative";
  }
  function normalizeBookingTimeSlot(raw) {
    const value = text(raw);
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
    const value = text(raw);
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
    let operativeId = text(row.operativeId);
    if (!operativeId && text(row.operativeID)) {
      operativeId = text(row.operativeID);
      repairs.push("operative_id_alias");
    }
    let projectId = text(row.projectId);
    if (!projectId && text(row.projectID)) {
      projectId = text(row.projectID);
      repairs.push("project_id_alias");
    }
    const dateMs = bookingDateMs(row.date);
    if (dateMs != null && !isTimestampShape(row.date)) repairs.push("date_not_timestamp");
    const rawStatus = text(row.status);
    const status = normalizeBookingStatus(row.status);
    if (status && status !== rawStatus) repairs.push("status_alias");
    const rawSlot = text(row.timeSlot);
    let timeSlot = normalizeBookingTimeSlot(row.timeSlot);
    if (!rawSlot) {
      timeSlot = "FULL DAY";
      repairs.push("slot_missing_full_day");
    } else if (timeSlot && timeSlot !== rawSlot) {
      repairs.push("slot_alias");
    }
    const bookedBy = text(row.bookedBy);
    if (!bookedBy) repairs.push("booked_by_missing");
    if (!operativeId) errors.push("missing_operative_id");
    if (!projectId) errors.push("missing_project_id");
    if (dateMs == null) errors.push("missing_date");
    if (!status) errors.push("bad_status");
    if (!timeSlot) errors.push("bad_time_slot");
    if (errors.length > 0 || dateMs == null || !status || !timeSlot) return { ok: false, errors };
    const booking = {
      id: text(docId),
      operativeId,
      projectId,
      dateMs,
      timeSlot,
      status,
      bookedBy,
      notes: text(row.notes),
      isBreakRemoved: row.isBreakRemoved === true,
      operativeIdIsUuid: isBookingUuid(operativeId),
      projectIdIsUuid: isBookingUuid(projectId)
    };
    const workStartTime = bookingClock(row.workStartTime, options?.timeZone);
    const workEndTime = bookingClock(row.workEndTime, options?.timeZone);
    const otMultiplierOverride = finiteNumber(row.otMultiplierOverride);
    const bookingGroupId = text(row.bookingGroupId);
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
    const id = text(input.id);
    const operativeId = text(input.operativeId);
    const projectId = text(input.projectId);
    const bookedBy = text(input.bookedBy);
    const status = normalizeBookingStatus(input.status);
    const timeSlot = normalizeBookingTimeSlot(input.timeSlot);
    const dateMs = finiteNumber(input.dateMs);
    if (!id) errors.push("missing_id");
    if (!operativeId) errors.push("missing_operative_id");
    if (!projectId) errors.push("missing_project_id");
    if (dateMs == null) errors.push("missing_date");
    if (!timeSlot) errors.push("bad_time_slot");
    if (!bookedBy) errors.push("missing_booked_by");
    if (!status) errors.push("bad_status");
    if (errors.length > 0 || dateMs == null || !status || !timeSlot) return { ok: false, errors };
    const fields = {
      id,
      operativeId,
      projectId,
      date: dateMs,
      timeSlot,
      bookedBy,
      notes: text(input.notes),
      status,
      isBreakRemoved: input.isBreakRemoved === true,
      createdAt: finiteNumber(input.createdAtMs) ?? dateMs,
      updatedAt: finiteNumber(input.updatedAtMs) ?? dateMs
    };
    const workStartTime = bookingClock(input.workStartTime);
    const workEndTime = bookingClock(input.workEndTime);
    const otMultiplierOverride = finiteNumber(input.otMultiplierOverride);
    const bookingGroupId = text(input.bookingGroupId);
    if (workStartTime) fields.workStartTime = workStartTime;
    if (workEndTime) fields.workEndTime = workEndTime;
    if (otMultiplierOverride != null) fields.otMultiplierOverride = otMultiplierOverride;
    if (bookingGroupId) fields.bookingGroupId = bookingGroupId;
    return { ok: true, fields };
  }
  function todayKey(nowIso, timeZone) {
    const zone = zoneOrLondon(timeZone);
    const now = new Date(nowIso);
    return dayKeyInZone(Number.isNaN(now.getTime()) ? /* @__PURE__ */ new Date() : now, zone);
  }
  function onOrAfterToday(dateMs, today, timeZone) {
    if (!Number.isFinite(dateMs)) return false;
    return dayKeyInZone(new Date(dateMs), zoneOrLondon(timeZone)) >= today;
  }
  function bookingsToRemoveOnOperativeDelete(input) {
    const ids = new Set(input.operativeIds.map((id) => text(id).toUpperCase()).filter(Boolean));
    if (ids.size === 0) return [];
    const today = todayKey(input.nowIso, input.timeZone);
    return input.bookings.filter((row) => ids.has(text(row.operativeId).toUpperCase()) && onOrAfterToday(row.dateMs, today, input.timeZone)).map((row) => row.id);
  }
  function bookingsToRemoveOnProjectDelete(input) {
    const projectId = text(input.projectId).toUpperCase();
    if (!projectId) return [];
    const today = todayKey(input.nowIso, input.timeZone);
    return input.bookings.filter((row) => text(row.projectId).toUpperCase() === projectId && onOrAfterToday(row.dateMs, today, input.timeZone)).map((row) => row.id);
  }
  function bookingJobState(projectId, liveProjectIds) {
    const id = text(projectId).toUpperCase();
    if (!id) return "deleted_job";
    const ids = Array.isArray(liveProjectIds) ? liveProjectIds : Array.from(liveProjectIds);
    return ids.some((row) => text(row).toUpperCase() === id) ? "live" : "deleted_job";
  }
  function bookingJobLabel(projectName) {
    return text(projectName) || ORPHAN_BOOKING_LABEL;
  }
  function bookingHealthRows(input) {
    const people = new Set([...input.operativeIds, ...input.userIds].map((id) => text(id).toUpperCase()).filter(Boolean));
    const jobs = new Set(input.projectIds.map((id) => text(id).toUpperCase()).filter(Boolean));
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
    const value = text(raw);
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
    const userId = text(row.userId);
    const dateMs = bookingDateMs(row.date);
    if (dateMs != null && !isTimestampShape(row.date)) repairs.push("date_not_timestamp");
    const timeSlot = normalizeManagerBookingTimeSlot(row.timeSlot);
    if (timeSlot && timeSlot !== text(row.timeSlot)) repairs.push("slot_alias");
    if (!userId) errors.push("missing_user_id");
    if (dateMs == null) errors.push("missing_date");
    if (!timeSlot) errors.push("bad_time_slot");
    if (errors.length > 0 || dateMs == null || !timeSlot) return { ok: false, errors };
    const rawLocation = text(row.locationType);
    let locationType = "project";
    if (MANAGER_LOCATION_TYPES.includes(rawLocation)) {
      locationType = rawLocation;
    } else {
      repairs.push(rawLocation ? "location_type_unknown" : "location_type_missing");
    }
    const booking = {
      id: text(docId),
      userId,
      dateMs,
      timeSlot,
      locationType,
      isBreakRemoved: row.isBreakRemoved === true
    };
    const locationId = text(row.locationId);
    const customLocationName = text(row.customLocationName);
    const workStartTime = bookingClock(row.workStartTime, options?.timeZone);
    const workEndTime = bookingClock(row.workEndTime, options?.timeZone);
    const bookingGroupId = text(row.bookingGroupId);
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
      const id = typeof raw === "string" ? raw.trim() : "";
      const key2 = id.toLowerCase();
      if (!id || seen.has(key2)) return;
      seen.add(key2);
      ids.push(id);
    };
    for (const id of labourPersonIds({ id: account.id, formerIds: account.formerIds ? [...account.formerIds] : [] })) add(id);
    for (const id of account.aliasIds || []) add(id);
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
    let account = input.accounts.find((row) => idKey2(row.id) === needle) || input.accounts.find((row) => (row.formerIds || []).some((id) => idKey2(id) === needle)) || input.accounts.find((row) => (row.aliasIds || []).some((id) => idKey2(id) === needle)) || null;
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
      const id = (raw || "").trim();
      if (!id || seen.has(id.toLowerCase())) return;
      seen.add(id.toLowerCase());
      ids.push(id);
    };
    add(first);
    const person = resolveBookingPerson(first, input);
    add(person.operativeId);
    const account = person.accountId ? input.accounts.find((row) => row.id === person.accountId) : void 0;
    if (account) for (const id of bookingIdsForAccount(account, input.operatives)) add(id);
    return ids;
  }

  // lib/canonical/legalPack.ts
  function text2(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function legalPackNeedsAcceptance(input) {
    if (input.policyAccepted !== true) return true;
    const current = text2(input.currentVersion);
    if (!current) return false;
    return text2(input.acceptedVersion) !== current;
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
    const zone = zoneOrLondon(input.timeZone);
    const iso = isoWeekdayInZone(dateFromDayKeyInZone(input.dayKey, zone), zone);
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
  function text3(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function sensitiveProfileDocPath(userId) {
    return `users/${text3(userId)}/private/${SENSITIVE_PROFILE_DOC_ID}`;
  }
  function canViewSensitiveProfile(input) {
    const viewer = text3(input.viewerUserId);
    if (viewer && viewer === text3(input.subjectUserId)) return true;
    if (input.viewerRole.isOperativeMode) return false;
    return input.viewerRole.isSuperAdmin || input.viewerRole.isAdmin;
  }
  function maskSensitiveValue(value) {
    const raw = text3(value).replace(/\s+/g, "");
    if (!raw) return "";
    if (raw.length <= 4) return "\u2022\u2022\u2022\u2022";
    return `\u2022\u2022\u2022\u2022 ${raw.slice(-4)}`;
  }
  function resolveSensitiveProfile(input) {
    if (input.privateDoc && typeof input.privateDoc === "object") {
      return {
        utrNumber: text3(input.privateDoc.utrNumber),
        vatNumber: text3(input.privateDoc.vatNumber),
        source: "private"
      };
    }
    const legacy = input.legacyUser && typeof input.legacyUser === "object" ? input.legacyUser : {};
    const utrNumber = text3(legacy.utrNumber);
    const vatNumber = text3(legacy.vatNumber);
    return { utrNumber, vatNumber, source: utrNumber || vatNumber ? "legacy" : "none" };
  }
  function sensitiveProfileWriteFields(input) {
    const updatedByUserId = text3(input.updatedByUserId);
    if (!updatedByUserId) return { ok: false, error: "missing_user" };
    const utrNumber = text3(input.utrNumber);
    const vatNumber = text3(input.vatNumber);
    if (utrNumber.length > SENSITIVE_VALUE_MAX || vatNumber.length > SENSITIVE_VALUE_MAX) {
      return { ok: false, error: "too_long" };
    }
    return { ok: true, fields: { utrNumber, vatNumber, updatedByUserId } };
  }
  function exportIncludesSensitiveFields(input) {
    return input.requested === true && input.canView === true;
  }
  return __toCommonJS(bundleEntry_exports);
})();
