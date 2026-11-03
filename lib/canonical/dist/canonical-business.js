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
      for (let key3 of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key3) && key3 !== except)
          __defProp(to, key3, { get: () => from[key3], enumerable: !(desc = __getOwnPropDesc(from, key3)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // lib/canonical/bundleEntry.ts
  var bundleEntry_exports = {};
  __export(bundleEntry_exports, {
    ACCOUNT_DELETE_WITH_COMPANY_MESSAGE: () => ACCOUNT_DELETE_WITH_COMPANY_MESSAGE,
    ACCOUNT_HANDOVER_REQUIRED_MESSAGE: () => ACCOUNT_HANDOVER_REQUIRED_MESSAGE,
    ACCOUNT_TYPE_OTHER_COMPANY_NOTE: () => ACCOUNT_TYPE_OTHER_COMPANY_NOTE,
    ACCOUNT_TYPE_OUT_OF_SYNC_MESSAGE: () => ACCOUNT_TYPE_OUT_OF_SYNC_MESSAGE,
    ACCOUNT_TYPE_SUPER_ADMIN_MESSAGE: () => ACCOUNT_TYPE_SUPER_ADMIN_MESSAGE,
    ADMIN_EDITABLE_PERMISSION_FIELDS: () => ADMIN_EDITABLE_PERMISSION_FIELDS,
    ADMIN_LOCKED_PERMISSION_MESSAGE: () => ADMIN_LOCKED_PERMISSION_MESSAGE,
    ANNUAL_LEAVE_ALLOWANCE_COPY: () => ANNUAL_LEAVE_ALLOWANCE_COPY,
    ANNUAL_LEAVE_BOOKED_LABEL: () => ANNUAL_LEAVE_BOOKED_LABEL,
    ANNUAL_LEAVE_REQUESTED_LABEL: () => ANNUAL_LEAVE_REQUESTED_LABEL,
    ANONYMISED_DELETED_USER_NAME: () => ANONYMISED_DELETED_USER_NAME,
    BANK_HOLIDAY_REGIONS: () => BANK_HOLIDAY_REGIONS,
    BOOKING_CONFLICTS_HEADING: () => BOOKING_CONFLICTS_HEADING,
    BOOKING_JOB_COLLECTIONS: () => BOOKING_JOB_COLLECTIONS,
    BOOKING_JOB_WRITE_GROUP: () => BOOKING_JOB_WRITE_GROUP,
    BOOKING_PERMISSION_COLLECTIONS: () => BOOKING_PERMISSION_COLLECTIONS,
    BOOKING_REPLAY_REFUSED_MESSAGE: () => BOOKING_REPLAY_REFUSED_MESSAGE,
    BOOKING_SLOT_WRITE_GROUP: () => BOOKING_SLOT_WRITE_GROUP,
    BOOKING_STATUSES: () => BOOKING_STATUSES,
    BOOKING_TIME_SLOTS: () => BOOKING_TIME_SLOTS,
    BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT: () => BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT,
    BOOKING_TOMBSTONE_COLLECTION: () => BOOKING_TOMBSTONE_COLLECTION,
    BOOKING_TOMBSTONE_FIELDS: () => BOOKING_TOMBSTONE_FIELDS,
    CANONICAL_STANDARD_BREAK: () => CANONICAL_STANDARD_BREAK,
    CANONICAL_STANDARD_DAY: () => CANONICAL_STANDARD_DAY,
    COMPANY_ACTIVITY_NOTICE_TYPES: () => COMPANY_ACTIVITY_NOTICE_TYPES,
    CROSS_PLATFORM_CONTRACT_READERS: () => CROSS_PLATFORM_CONTRACT_READERS,
    CURRENCY_OPTIONS: () => CURRENCY_OPTIONS,
    CUSTOM_HOURS_BREAK_WARNING: () => CUSTOM_HOURS_BREAK_WARNING,
    DEADLINE_ASSIGNMENTS_DOCUMENT_ID: () => DEADLINE_ASSIGNMENTS_DOCUMENT_ID,
    DEADLINE_STATUSES: () => DEADLINE_STATUSES,
    DEFAULT_ANNUAL_LEAVE: () => DEFAULT_ANNUAL_LEAVE,
    DEFAULT_ANNUAL_LEAVE_DAYS: () => DEFAULT_ANNUAL_LEAVE_DAYS,
    DEFAULT_BANK_HOLIDAY_REGION_ID: () => DEFAULT_BANK_HOLIDAY_REGION_ID,
    DEFAULT_CURRENCY_CODE: () => DEFAULT_CURRENCY_CODE,
    DEFAULT_JOB_TYPE_NAMES: () => DEFAULT_JOB_TYPE_NAMES,
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
    DELETION_RESTORE_DAYS: () => DELETION_RESTORE_DAYS,
    DEVELOPER_PASSWORD_MIN_LENGTH: () => DEVELOPER_PASSWORD_MIN_LENGTH,
    DEVICE_PUSH_NOTIFICATION_TYPES: () => DEVICE_PUSH_NOTIFICATION_TYPES,
    EDIT_OF_MISSING_DOCUMENT_MESSAGE: () => EDIT_OF_MISSING_DOCUMENT_MESSAGE,
    EMPLOYMENT_WRITE_GROUP: () => EMPLOYMENT_WRITE_GROUP,
    ENFORCED_READS_ACTIVE: () => ENFORCED_READS_ACTIVE,
    ERASED_ORGANIZATIONS_COLLECTION: () => ERASED_ORGANIZATIONS_COLLECTION,
    FALLBACK_LOOKAHEAD_DAYS: () => FALLBACK_LOOKAHEAD_DAYS,
    FILE_REPORT_DETAILS_MAX: () => FILE_REPORT_DETAILS_MAX,
    FILE_REPORT_FILE_NAME_MAX: () => FILE_REPORT_FILE_NAME_MAX,
    FILE_REPORT_LINK_LABEL: () => FILE_REPORT_LINK_LABEL,
    FILE_REPORT_REASONS: () => FILE_REPORT_REASONS,
    FILE_REPORT_SENT_COPY: () => FILE_REPORT_SENT_COPY,
    FILE_REPORT_STATUSES: () => FILE_REPORT_STATUSES,
    FILE_REPORT_SURFACES: () => FILE_REPORT_SURFACES,
    FIRESTORE_IN_QUERY_LIMIT: () => FIRESTORE_IN_QUERY_LIMIT,
    HEALTH_SAFETY_ARRAY_FIELDS: () => HEALTH_SAFETY_ARRAY_FIELDS,
    HEALTH_SAFETY_FILE_FIELDS: () => HEALTH_SAFETY_FILE_FIELDS,
    HOLIDAY_DOCUMENT_KEYS: () => HOLIDAY_DOCUMENT_KEYS,
    HOLIDAY_REQUEST_SUBMITTED_TYPE: () => HOLIDAY_REQUEST_SUBMITTED_TYPE,
    HOLIDAY_STATUSES: () => HOLIDAY_STATUSES,
    HOLIDAY_STATUS_SYNONYMS: () => HOLIDAY_STATUS_SYNONYMS,
    HOLIDAY_TIME_SLOTS: () => HOLIDAY_TIME_SLOTS,
    HS_ISSUE_STATUSES: () => HS_ISSUE_STATUSES,
    HS_ISSUE_STATUS_STORED: () => HS_ISSUE_STATUS_STORED,
    HS_SIGNATURE_RECORDS_FIELD: () => HS_SIGNATURE_RECORDS_FIELD,
    HS_SIGNATURE_STATUSES: () => HS_SIGNATURE_STATUSES,
    IDEMPOTENT_MIGRATION_WRITES: () => IDEMPOTENT_MIGRATION_WRITES,
    INBOX_CREATED_AT_SKEW_MS: () => INBOX_CREATED_AT_SKEW_MS,
    INVITE_MEMBERSHIP_FIELDS: () => INVITE_MEMBERSHIP_FIELDS,
    IOS_SESSION_ORGANIZATION_STORAGE_KEY: () => IOS_SESSION_ORGANIZATION_STORAGE_KEY,
    JOBS_PER_BOOKING_QUERY: () => JOBS_PER_BOOKING_QUERY,
    JOB_ADDRESS_WRITE_GROUP: () => JOB_ADDRESS_WRITE_GROUP,
    JOB_COLLECTIONS: () => JOB_COLLECTIONS,
    JOB_MANAGER_LIST_FIELDS: () => JOB_MANAGER_LIST_FIELDS,
    JOB_MANAGER_WRITE_GROUP: () => JOB_MANAGER_WRITE_GROUP,
    JOB_PIN_WRITE_GROUP: () => JOB_PIN_WRITE_GROUP,
    JOB_QUERY_COLLECTIONS: () => JOB_QUERY_COLLECTIONS,
    JOB_TYPES_DOCUMENT_ID: () => JOB_TYPES_DOCUMENT_ID,
    KNOWN_NOTIFICATION_TYPES: () => KNOWN_NOTIFICATION_TYPES,
    LAUNCH_COUNTRY_CODES: () => LAUNCH_COUNTRY_CODES,
    LEAVE_SUBMIT_LABEL: () => LEAVE_SUBMIT_LABEL,
    LEAVE_SUBMIT_REQUEST_LABEL: () => LEAVE_SUBMIT_REQUEST_LABEL,
    LEAVE_YEAR_MONTHS_MESSAGE: () => LEAVE_YEAR_MONTHS_MESSAGE,
    LEGACY_NOTIFICATION_PREFERENCE_ALIASES: () => LEGACY_NOTIFICATION_PREFERENCE_ALIASES,
    LEGACY_NOTIFICATION_TYPES: () => LEGACY_NOTIFICATION_TYPES,
    LEGACY_PLACEHOLDER_DOCUMENT_ID: () => LEGACY_PLACEHOLDER_DOCUMENT_ID,
    LINE_MANAGER_NOT_SET_LABEL: () => LINE_MANAGER_NOT_SET_LABEL,
    LINE_MANAGER_REQUIRED_MESSAGE: () => LINE_MANAGER_REQUIRED_MESSAGE,
    LINE_MANAGER_WRITE_GROUP: () => LINE_MANAGER_WRITE_GROUP,
    LIVE_COLLECTIONS: () => LIVE_COLLECTIONS,
    MANAGER_LOCATION_TYPES: () => MANAGER_LOCATION_TYPES,
    MANAGER_LOCKED_ON_PERMISSION_FIELDS: () => MANAGER_LOCKED_ON_PERMISSION_FIELDS,
    MANAGER_PERMISSION_TOGGLES: () => MANAGER_PERMISSION_TOGGLES,
    MANAGER_SITE_BOOKING_LOCATION_WRITE_GROUP: () => MANAGER_SITE_BOOKING_LOCATION_WRITE_GROUP,
    MANAGER_TIME_SLOTS: () => MANAGER_TIME_SLOTS,
    MATERIAL_DAY_WRITE_GROUP: () => MATERIAL_DAY_WRITE_GROUP,
    MATERIAL_LENGTH_UNITS: () => MATERIAL_LENGTH_UNITS,
    MATERIAL_LENGTH_WRITE_GROUP: () => MATERIAL_LENGTH_WRITE_GROUP,
    MATERIAL_NAME_WRITE_GROUP: () => MATERIAL_NAME_WRITE_GROUP,
    MATERIAL_ORDER_NO_RECIPIENT_MESSAGE: () => MATERIAL_ORDER_NO_RECIPIENT_MESSAGE,
    MATERIAL_ORDER_SEND_REFUSED_MESSAGE: () => MATERIAL_ORDER_SEND_REFUSED_MESSAGE,
    MATERIAL_ORDER_TYPED_RECIPIENTS_MAX: () => MATERIAL_ORDER_TYPED_RECIPIENTS_MAX,
    MATERIAL_ORDER_TYPED_RECIPIENTS_MESSAGE: () => MATERIAL_ORDER_TYPED_RECIPIENTS_MESSAGE,
    MATERIAL_STATUS_SYNONYMS: () => MATERIAL_STATUS_SYNONYMS,
    MATERIAL_UNITS: () => MATERIAL_UNITS,
    MATERIAL_WHATSAPP_ITEM_LIMIT: () => MATERIAL_WHATSAPP_ITEM_LIMIT,
    MATERIAL_WORKFLOW_STATUSES: () => MATERIAL_WORKFLOW_STATUSES,
    MIN_HALF_DAY_MINUTES: () => MIN_HALF_DAY_MINUTES,
    NOTIFICATION_CATALOG: () => NOTIFICATION_CATALOG,
    NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND: () => NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND,
    NOTIFICATION_PREFERENCE_KEYS: () => NOTIFICATION_PREFERENCE_KEYS,
    NOTIFICATION_RELATED_ID: () => NOTIFICATION_RELATED_ID,
    NOTIFICATION_TOGGLE_HIDES_INBOX_ROW: () => NOTIFICATION_TOGGLE_HIDES_INBOX_ROW,
    NO_LINE_MANAGER_HELP: () => NO_LINE_MANAGER_HELP,
    NO_LINE_MANAGER_LABEL: () => NO_LINE_MANAGER_LABEL,
    OFFLINE_ACTIONS: () => OFFLINE_ACTIONS,
    OFFLINE_AVAILABILITIES: () => OFFLINE_AVAILABILITIES,
    OFFLINE_LAST_UPDATED_PREFIX: () => OFFLINE_LAST_UPDATED_PREFIX,
    OFFLINE_ONLINE_ONLY_MESSAGE: () => OFFLINE_ONLINE_ONLY_MESSAGE,
    OFFLINE_PENDING_SYNC_LABEL: () => OFFLINE_PENDING_SYNC_LABEL,
    OPERATIONAL_COLLECTION_PATHS: () => OPERATIONAL_COLLECTION_PATHS,
    OPERATIVE_PERMISSION_TOGGLES: () => OPERATIVE_PERMISSION_TOGGLES,
    ORGANIZATION_DELETE_BODY: () => ORGANIZATION_DELETE_BODY,
    ORGANIZATION_DELETE_CONFIRMATION: () => ORGANIZATION_DELETE_CONFIRMATION,
    ORGANIZATION_DELETE_SUPER_ADMIN_ONLY_MESSAGE: () => ORGANIZATION_DELETE_SUPER_ADMIN_ONLY_MESSAGE,
    ORGANIZATION_DELETE_TITLE: () => ORGANIZATION_DELETE_TITLE,
    ORGANIZATION_DOCUMENT_FIELDS: () => ORGANIZATION_DOCUMENT_FIELDS,
    ORGANIZATION_RESTORED_MESSAGE: () => ORGANIZATION_RESTORED_MESSAGE,
    ORG_MEMBERSHIP_ADMIN_FIELDS: () => ORG_MEMBERSHIP_ADMIN_FIELDS,
    ORG_MEMBERSHIP_DEFAULT_ON: () => ORG_MEMBERSHIP_DEFAULT_ON,
    ORG_MEMBERSHIP_PERMISSION_KEYS: () => ORG_MEMBERSHIP_PERMISSION_KEYS,
    ORG_MEMBERSHIP_SELF_FIELDS: () => ORG_MEMBERSHIP_SELF_FIELDS,
    ORPHAN_BOOKING_LABEL: () => ORPHAN_BOOKING_LABEL,
    OVERLAPPING_BOOKING_NOTE: () => OVERLAPPING_BOOKING_NOTE,
    OWN_BOOKING_IDS_PER_QUERY: () => OWN_BOOKING_IDS_PER_QUERY,
    PASSWORD_MIN_LENGTH: () => PASSWORD_MIN_LENGTH,
    PAYE_PAY_CELL_LABEL: () => PAYE_PAY_CELL_LABEL,
    PAYE_RATE_NOT_USED_NOTE: () => PAYE_RATE_NOT_USED_NOTE,
    PAYMENT_GRACE_MS: () => PAYMENT_GRACE_MS,
    PAYMENT_RUN_1_LAST_END_DAY: () => PAYMENT_RUN_1_LAST_END_DAY,
    PAYROLL_POLICY_HISTORY_START: () => PAYROLL_POLICY_HISTORY_START,
    PAYROLL_POLICY_LIMITS: () => PAYROLL_POLICY_LIMITS,
    PAYROLL_POLICY_STALE_SAVE_MESSAGE: () => PAYROLL_POLICY_STALE_SAVE_MESSAGE,
    PAYROLL_POLICY_TIME_STEP_MESSAGE: () => PAYROLL_POLICY_TIME_STEP_MESSAGE,
    PAYROLL_POLICY_TIME_STEP_MINUTES: () => PAYROLL_POLICY_TIME_STEP_MINUTES,
    PAY_BASIS_DAY_HELP: () => PAY_BASIS_DAY_HELP,
    PAY_BASIS_HOURLY_HELP: () => PAY_BASIS_HOURLY_HELP,
    PAY_BASIS_SAVE_NOTE: () => PAY_BASIS_SAVE_NOTE,
    PAY_HISTORY_NOT_LOADED_MESSAGE: () => PAY_HISTORY_NOT_LOADED_MESSAGE,
    PAY_PROFILES_COLLECTION: () => PAY_PROFILES_COLLECTION,
    PAY_PROFILE_FIELDS: () => PAY_PROFILE_FIELDS,
    PAY_RATE_REQUIRED_MESSAGE: () => PAY_RATE_REQUIRED_MESSAGE,
    PAY_STANDARD_DAY_MIN_HOURS: () => PAY_STANDARD_DAY_MIN_HOURS,
    PAY_WRITE_GROUP: () => PAY_WRITE_GROUP,
    PERMISSION_DEFAULT_ON: () => PERMISSION_DEFAULT_ON,
    PERMISSION_TOGGLE_CATALOGUE: () => PERMISSION_TOGGLE_CATALOGUE,
    PLATFORM_CONFIG_APP_PATH: () => PLATFORM_CONFIG_APP_PATH,
    PLATFORM_OWNER_EMAIL: () => PLATFORM_OWNER_EMAIL,
    PROJECT_TASK_PRIORITIES: () => PROJECT_TASK_PRIORITIES,
    PROJECT_TASK_STATUSES: () => PROJECT_TASK_STATUSES,
    PUSH_PAYLOAD_KEYS: () => PUSH_PAYLOAD_KEYS,
    PUSH_TEST_NOTICE_TYPE: () => PUSH_TEST_NOTICE_TYPE,
    QUALIFICATION_CERTIFICATE_STORAGE_PATH: () => QUALIFICATION_CERTIFICATE_STORAGE_PATH,
    QUALIFICATION_FILTER_ALL: () => QUALIFICATION_FILTER_ALL,
    QUALIFICATION_FILTER_OTHER: () => QUALIFICATION_FILTER_OTHER,
    QUALIFICATION_LIBRARY_SECTIONS: () => QUALIFICATION_LIBRARY_SECTIONS,
    RESTORED_JOB_TYPE_NAMES: () => RESTORED_JOB_TYPE_NAMES,
    ROSTER_DOCUMENT_KEYS: () => ROSTER_DOCUMENT_KEYS,
    ROSTER_NAME_WRITE_GROUP: () => ROSTER_NAME_WRITE_GROUP,
    SCHEDULED_NOTIFICATION_TYPES: () => SCHEDULED_NOTIFICATION_TYPES,
    SELF_EMAIL_INVALID_MESSAGE: () => SELF_EMAIL_INVALID_MESSAGE,
    SENSITIVE_EXPORT_OPTION_LABEL: () => SENSITIVE_EXPORT_OPTION_LABEL,
    SENSITIVE_HELD_BY_ADMIN_COPY: () => SENSITIVE_HELD_BY_ADMIN_COPY,
    SENSITIVE_PROFILE_DOC_ID: () => SENSITIVE_PROFILE_DOC_ID,
    SENSITIVE_PROFILE_FIELDS: () => SENSITIVE_PROFILE_FIELDS,
    SENSITIVE_VALUE_MAX: () => SENSITIVE_VALUE_MAX,
    SUBCONTRACTOR_BOOKING_DOCUMENT_KEYS: () => SUBCONTRACTOR_BOOKING_DOCUMENT_KEYS,
    SUBCONTRACTOR_BOOKING_PEOPLE_WRITE_GROUP: () => SUBCONTRACTOR_BOOKING_PEOPLE_WRITE_GROUP,
    SUBSCRIPTION_LAPSED_ADMIN_NOTE: () => SUBSCRIPTION_LAPSED_ADMIN_NOTE,
    SUBSCRIPTION_LAPSED_ADMIN_WEB_NOTE: () => SUBSCRIPTION_LAPSED_ADMIN_WEB_NOTE,
    SUBSCRIPTION_LAPSED_MESSAGE: () => SUBSCRIPTION_LAPSED_MESSAGE,
    SUGGESTED_MAX_CARRY_OVER_DAYS: () => SUGGESTED_MAX_CARRY_OVER_DAYS,
    SYNC_WRITE_TRIGGERS: () => SYNC_WRITE_TRIGGERS,
    TASK_COMPLETION_WRITE_GROUP: () => TASK_COMPLETION_WRITE_GROUP,
    TASK_ITEMS_WRITE_GROUP: () => TASK_ITEMS_WRITE_GROUP,
    TASK_MANAGER_WRITE_GROUP: () => TASK_MANAGER_WRITE_GROUP,
    TASK_OPERATIVE_WRITE_GROUP: () => TASK_OPERATIVE_WRITE_GROUP,
    TIMESHEET_CLOSE_OF_PLAY_HOUR: () => TIMESHEET_CLOSE_OF_PLAY_HOUR,
    TIMESHEET_CLOSE_OF_PLAY_MINUTE: () => TIMESHEET_CLOSE_OF_PLAY_MINUTE,
    TIMESHEET_DEADLINE_DAYS_BEFORE_PAYMENT: () => TIMESHEET_DEADLINE_DAYS_BEFORE_PAYMENT,
    TIMESHEET_DOCUMENT_PREFIX: () => TIMESHEET_DOCUMENT_PREFIX,
    TIMESHEET_ENTRY_ARRAY_FIELDS: () => TIMESHEET_ENTRY_ARRAY_FIELDS,
    TIMESHEET_ENTRY_DECISIONS: () => TIMESHEET_ENTRY_DECISIONS,
    TIMESHEET_ENTRY_REVIEWS_FIELD: () => TIMESHEET_ENTRY_REVIEWS_FIELD,
    TIMESHEET_EXPORT_STORAGE_FOLDER: () => TIMESHEET_EXPORT_STORAGE_FOLDER,
    TIMESHEET_INVOICE_EXPORT_LEFTOVER_MS: () => TIMESHEET_INVOICE_EXPORT_LEFTOVER_MS,
    TIMESHEET_MANAGER_SIGN_OFF_FIELDS: () => TIMESHEET_MANAGER_SIGN_OFF_FIELDS,
    TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT: () => TIMESHEET_NOTIFY_DAYS_BEFORE_PAYMENT,
    TIMESHEET_NOTIFY_HOUR: () => TIMESHEET_NOTIFY_HOUR,
    TIMESHEET_NOTIFY_MINUTE: () => TIMESHEET_NOTIFY_MINUTE,
    TIMESHEET_PENDING_NOTICE_TYPE: () => TIMESHEET_PENDING_NOTICE_TYPE,
    TIMESHEET_REVIEWER_ONLY_FIELDS: () => TIMESHEET_REVIEWER_ONLY_FIELDS,
    TIMESHEET_SELF_SIGNED_OWNER_FIELDS: () => TIMESHEET_SELF_SIGNED_OWNER_FIELDS,
    TIMESHEET_SIGNED_AFTER_MS: () => TIMESHEET_SIGNED_AFTER_MS,
    TIMESHEET_SIGNED_NOTICE_TYPE: () => TIMESHEET_SIGNED_NOTICE_TYPE,
    TIMESHEET_SUBMISSION_NOTICE_TITLE: () => TIMESHEET_SUBMISSION_NOTICE_TITLE,
    TIMESHEET_SUBMISSION_NOTICE_TYPE: () => TIMESHEET_SUBMISSION_NOTICE_TYPE,
    TOMBSTONED_BOOKING_COLLECTIONS: () => TOMBSTONED_BOOKING_COLLECTIONS,
    TRADE_TYPE_INVENTORY_DOCUMENT_ID: () => TRADE_TYPE_INVENTORY_DOCUMENT_ID,
    UNKNOWN_PERSON_LABEL: () => UNKNOWN_PERSON_LABEL,
    USER_ANNUAL_LEAVE_FIGURE_FIELDS: () => USER_ANNUAL_LEAVE_FIGURE_FIELDS,
    USER_DELETE_REFUSAL_MESSAGES: () => USER_DELETE_REFUSAL_MESSAGES,
    USER_DOCUMENT_FIELDS: () => USER_DOCUMENT_FIELDS,
    USER_DOCUMENT_KEYS: () => USER_DOCUMENT_KEYS,
    USER_FORMER_IDS_FIELD: () => USER_FORMER_IDS_FIELD,
    USER_NAME_WRITE_GROUP: () => USER_NAME_WRITE_GROUP,
    USER_SELF_CREATE_AGE_FIELDS: () => USER_SELF_CREATE_AGE_FIELDS,
    VARIATION_EVIDENCE_WRITE_GROUP: () => VARIATION_EVIDENCE_WRITE_GROUP,
    VARIATION_LABOUR_WRITE_GROUP: () => VARIATION_LABOUR_WRITE_GROUP,
    VARIATION_MATERIALS_WRITE_GROUP: () => VARIATION_MATERIALS_WRITE_GROUP,
    VARIATION_NUMBER_WRITE_GROUP: () => VARIATION_NUMBER_WRITE_GROUP,
    VARIATION_STATUS_TOKENS: () => VARIATION_STATUS_TOKENS,
    VARIATION_STATUS_WRITE_GROUP: () => VARIATION_STATUS_WRITE_GROUP,
    VARIATION_TRACKER_LOCK_FIELDS: () => VARIATION_TRACKER_LOCK_FIELDS,
    VARIATION_TRADES_DOCUMENT_ID: () => VARIATION_TRADES_DOCUMENT_ID,
    WARNING_RESOLUTION_STATUSES: () => WARNING_RESOLUTION_STATUSES,
    WARNING_SCOPE_ALL: () => WARNING_SCOPE_ALL,
    WEB_SESSION_ORGANIZATION_STORAGE_PREFIX: () => WEB_SESSION_ORGANIZATION_STORAGE_PREFIX,
    WEEKDAY_TIME_SLOTS: () => WEEKDAY_TIME_SLOTS,
    WEEKEND_TIME_SLOTS: () => WEEKEND_TIME_SLOTS,
    WEEKEND_WEEKDAY_MIX_MESSAGE: () => WEEKEND_WEEKDAY_MIX_MESSAGE,
    WHOLESALER_CONTACTS_WRITE_GROUP: () => WHOLESALER_CONTACTS_WRITE_GROUP,
    WORKING_WEEK: () => WORKING_WEEK,
    WRITE_PLATFORMS: () => WRITE_PLATFORMS,
    acceptedClashWriteFields: () => acceptedClashWriteFields,
    accessProbeFromReadError: () => accessProbeFromReadError,
    accountDeletionPath: () => accountDeletionPath,
    accountKindFromFlags: () => accountKindFromFlags,
    accountTypeChangeWrites: () => accountTypeChangeWrites,
    accountTypePermissions: () => accountTypePermissions,
    accountTypeSyncState: () => accountTypeSyncState,
    accountTypeWritePermissions: () => accountTypeWritePermissions,
    activePaymentRunSummary: () => activePaymentRunSummary,
    addUserPermissionDefaults: () => addUserPermissionDefaults,
    addedPushTokens: () => addedPushTokens,
    allowedTimeSlotsOnDay: () => allowedTimeSlotsOnDay,
    annualLeaveBalance: () => annualLeaveBalance,
    annualLeavePendingOmitFields: () => annualLeavePendingOmitFields,
    appUpdateRequired: () => appUpdateRequired,
    applyEmploymentTypeChange: () => applyEmploymentTypeChange,
    applyRemainingOverride: () => applyRemainingOverride,
    approvedWarningKeys: () => approvedWarningKeys,
    assignedQualificationWriteFields: () => assignedQualificationWriteFields,
    bankHolidayCountries: () => bankHolidayCountries,
    bankHolidayCountryTitle: () => bankHolidayCountryTitle,
    bankHolidayRegion: () => bankHolidayRegion,
    bankHolidayRegionLabel: () => bankHolidayRegionLabel,
    bankHolidayRegionsForCountry: () => bankHolidayRegionsForCountry,
    billingAccessFields: () => billingAccessFields,
    bookingBelongsToOrganization: () => bookingBelongsToOrganization,
    bookingClock: () => bookingClock,
    bookingCreatedRecipients: () => bookingCreatedRecipients,
    bookingDateMs: () => bookingDateMs,
    bookingDaysMixWeekdayAndWeekend: () => bookingDaysMixWeekdayAndWeekend,
    bookingHealthRows: () => bookingHealthRows,
    bookingHoursLabel: () => bookingHoursLabel,
    bookingIdsForAccount: () => bookingIdsForAccount,
    bookingIdsForPerson: () => bookingIdsForPerson,
    bookingJobCollectionFields: () => bookingJobCollectionFields,
    bookingJobId: () => bookingJobId,
    bookingJobLabel: () => bookingJobLabel,
    bookingJobState: () => bookingJobState,
    bookingLeaveConflicts: () => bookingLeaveConflicts,
    bookingLoadStart: () => bookingLoadStart,
    bookingOccupiesDay: () => bookingOccupiesDay,
    bookingPersonKey: () => bookingPersonKey,
    bookingQueryPlan: () => bookingQueryPlan,
    bookingReplayRefusedIsFinal: () => bookingReplayRefusedIsFinal,
    bookingRequestIdentity: () => bookingRequestIdentity,
    bookingTombstonePath: () => bookingTombstonePath,
    bookingTombstoneWriteFields: () => bookingTombstoneWriteFields,
    bookingUpdateWriteFields: () => bookingUpdateWriteFields,
    bookingWriteFields: () => bookingWriteFields,
    bookingsToRemoveOnOperativeDelete: () => bookingsToRemoveOnOperativeDelete,
    bookingsToRemoveOnProjectDelete: () => bookingsToRemoveOnProjectDelete,
    canChangeJobManagers: () => canChangeJobManagers,
    canChangePersonPay: () => canChangePersonPay,
    canCreateJob: () => canCreateJob,
    canDecideLeave: () => canDecideLeave,
    canDeleteBooking: () => canDeleteBooking,
    canDeleteUser: () => canDeleteUser,
    canEditJob: () => canEditJob,
    canEditWorkCatalogue: () => canEditWorkCatalogue,
    canManageOperatives: () => canManageOperatives,
    canManageVariationTracker: () => canManageVariationTracker,
    canOpenUserTimesheets: () => canOpenUserTimesheets,
    canRestoreOrganization: () => canRestoreOrganization,
    canReviewFileReports: () => canReviewFileReports,
    canReviewUserTimesheets: () => canReviewUserTimesheets,
    canScheduleOperatives: () => canScheduleOperatives,
    canSeeJob: () => canSeeJob,
    canSeeVariations: () => canSeeVariations,
    canSelfBookAnnualLeave: () => canSelfBookAnnualLeave,
    canSendMaterialOrders: () => canSendMaterialOrders,
    canViewMaterialOrderHistory: () => canViewMaterialOrderHistory,
    canViewPersonPay: () => canViewPersonPay,
    canViewSensitiveProfile: () => canViewSensitiveProfile,
    canViewStaffWarnings: () => canViewStaffWarnings,
    canWriteBooking: () => canWriteBooking,
    canonicalJobTypeName: () => canonicalJobTypeName,
    capitalizeTimesheetWeekday: () => capitalizeTimesheetWeekday,
    catalogueRecordFromItem: () => catalogueRecordFromItem,
    chooseSessionOrganization: () => chooseSessionOrganization,
    clampMonthDayInZone: () => clampMonthDayInZone,
    clashApprovalWrites: () => clashApprovalWrites,
    clashPairKey: () => clashPairKey,
    clashResolutionKey: () => clashResolutionKey,
    clashScanDays: () => clashScanDays,
    clientWriteFields: () => clientWriteFields,
    clockMinutesFromDeliveryInstant: () => clockMinutesFromDeliveryInstant,
    coalesceOrganizationName: () => coalesceOrganizationName,
    coerceJobTypeList: () => coerceJobTypeList,
    companyActivityRecipients: () => companyActivityRecipients,
    companyDetailsRegionPrompt: () => companyDetailsRegionPrompt,
    companyDetailsValidationError: () => companyDetailsValidationError,
    companyDetailsWriteFields: () => companyDetailsWriteFields,
    compareAppVersions: () => compareAppVersions,
    compareInboxNotificationsByCreatedAt: () => compareInboxNotificationsByCreatedAt,
    compareWarningDayKeys: () => compareWarningDayKeys,
    coverageWindow: () => coverageWindow,
    crossPlatformContractReaderNames: () => crossPlatformContractReaderNames,
    currencyOption: () => currencyOption,
    currencySymbol: () => currencySymbol,
    customHoursBreakWarning: () => customHoursBreakWarning,
    customHoursPrefillForDays: () => customHoursPrefillForDays,
    dayKeyInOrganizationZone: () => dayKeyInOrganizationZone,
    deadlineAssignedProjectIds: () => deadlineAssignedProjectIds,
    deadlineAssignedRecipients: () => deadlineAssignedRecipients,
    deadlineAssignmentWriteFields: () => deadlineAssignmentWriteFields,
    deadlineProjectKey: () => deadlineProjectKey,
    deadlinesDocumentId: () => deadlinesDocumentId,
    defaultBankHolidayRegionForCountry: () => defaultBankHolidayRegionForCountry,
    defaultCurrencyForCountry: () => defaultCurrencyForCountry,
    defaultMaterialDeliveryDayKey: () => defaultMaterialDeliveryDayKey,
    defaultMaterialDeliveryRequiredAt: () => defaultMaterialDeliveryRequiredAt,
    defaultTimesheetSubmissionFromPaymentDay: () => defaultTimesheetSubmissionFromPaymentDay,
    defaultTimesheetSubmissionFromPaymentWeekday: () => defaultTimesheetSubmissionFromPaymentWeekday,
    defaultTimesheetsEnabled: () => defaultTimesheetsEnabled,
    deletionTimeMs: () => deletionTimeMs,
    derivedDocumentId: () => derivedDocumentId,
    derivedRowId: () => derivedRowId,
    derivedWeekdayPaidHours: () => derivedWeekdayPaidHours,
    devicePushAllowed: () => devicePushAllowed,
    devicePushNotificationTypes: () => devicePushNotificationTypes,
    displayOrganizationName: () => displayOrganizationName,
    documentBool: () => documentBool,
    documentInstantMs: () => documentInstantMs,
    documentNumber: () => documentNumber,
    documentOrganizationId: () => documentOrganizationId,
    documentValueKey: () => documentValueKey,
    documentWriteFields: () => documentWriteFields,
    dueTimesheetSubmissionNotices: () => dueTimesheetSubmissionNotices,
    editOfMissingDocumentIsRefused: () => editOfMissingDocumentIsRefused,
    effectivePayrollTimePolicy: () => effectivePayrollTimePolicy,
    effectivePermission: () => effectivePermission,
    effectivePermissions: () => effectivePermissions,
    employmentEffectiveLabel: () => employmentEffectiveLabel,
    employmentTypeOnDay: () => employmentTypeOnDay,
    enabledScheduleLocations: () => enabledScheduleLocations,
    erasedOrganizationAuditFields: () => erasedOrganizationAuditFields,
    excludeActor: () => excludeActor,
    exclusiveRates: () => exclusiveRates,
    exportIncludesSensitiveFields: () => exportIncludesSensitiveFields,
    fileReportCollectionPath: () => fileReportCollectionPath,
    fileReportFileName: () => fileReportFileName,
    fileReportReasonCopy: () => fileReportReasonCopy,
    fileReportReviewWriteFields: () => fileReportReviewWriteFields,
    fileReportStatusCopy: () => fileReportStatusCopy,
    fileReportStoragePath: () => fileReportStoragePath,
    fileReportWriteFields: () => fileReportWriteFields,
    foldHealthSafetySignatures: () => foldHealthSafetySignatures,
    formatClockMinutes: () => formatClockMinutes,
    formatMaterialCutOffClock: () => formatMaterialCutOffClock,
    formatMaterialDeliveryRequired: () => formatMaterialDeliveryRequired,
    formatMoney: () => formatMoney,
    formatPaymentRunDay: () => formatPaymentRunDay,
    formerIdAliases: () => formerIdAliases,
    halfDayWindows: () => halfDayWindows,
    hasAccess: () => hasAccess,
    hasActiveLineManager: () => hasActiveLineManager,
    hasAnnualLeaveAllowance: () => hasAnnualLeaveAllowance,
    healthSafetyDocumentId: () => healthSafetyDocumentId,
    healthSafetyDocumentIds: () => healthSafetyDocumentIds,
    healthSafetyDocumentWriteFields: () => healthSafetyDocumentWriteFields,
    healthSafetyIssueStatus: () => healthSafetyIssueStatus,
    healthSafetySignatureKey: () => healthSafetySignatureKey,
    healthSafetySignatureRemovalWrites: () => healthSafetySignatureRemovalWrites,
    healthSafetySignatureWriteFields: () => healthSafetySignatureWriteFields,
    historyPayRowOnDay: () => historyPayRowOnDay,
    historyRowBasis: () => historyRowBasis,
    holidayDecisionRecipients: () => holidayDecisionRecipients,
    holidayDecisionWriteFields: () => holidayDecisionWriteFields,
    holidayDocumentDayKey: () => holidayDocumentDayKey,
    holidayRequestRanges: () => holidayRequestRanges,
    holidayRequestRecipients: () => holidayRequestRecipients,
    holidayRequestWriteFields: () => holidayRequestWriteFields,
    ideaRecipients: () => ideaRecipients,
    inboxNotificationVisibleToUser: () => inboxNotificationVisibleToUser,
    intervalCrossesMidnight: () => intervalCrossesMidnight,
    intervalsOverlap: () => intervalsOverlap,
    invitationCreateFields: () => invitationCreateFields,
    invitationIsOperativeOnly: () => invitationIsOperativeOnly,
    invitationProfileFields: () => invitationProfileFields,
    invitationRole: () => invitationRole,
    invitationUsedWriteFields: () => invitationUsedWriteFields,
    inviteAcceptWrites: () => inviteAcceptWrites,
    inviteEmailHasLiveClaim: () => inviteEmailHasLiveClaim,
    inviteEmailOrgLookupConstraints: () => inviteEmailOrgLookupConstraints,
    inviteMembershipWrites: () => inviteMembershipWrites,
    inviteMigrationFormerIdWriteFields: () => inviteMigrationFormerIdWriteFields,
    invitePlaceholderUserWriteFields: () => invitePlaceholderUserWriteFields,
    inviteWritesOperativeProfile: () => inviteWritesOperativeProfile,
    invoiceLines: () => invoiceLines,
    invoicingPeriod: () => invoicingPeriod,
    invoicingToFirestore: () => invoicingToFirestore,
    isAdminOutsideOperativeMode: () => isAdminOutsideOperativeMode,
    isAnonymisedDeletedProfile: () => isAnonymisedDeletedProfile,
    isBillableSelfEmployedDay: () => isBillableSelfEmployedDay,
    isBookingUuid: () => isBookingUuid,
    isClashAccepted: () => isClashAccepted,
    isClashApproved: () => isClashApproved,
    isClashGroupApproved: () => isClashGroupApproved,
    isFileReportReason: () => isFileReportReason,
    isFileReportSurface: () => isFileReportSurface,
    isIdentifiablePendingLeftover: () => isIdentifiablePendingLeftover,
    isInvoiceLine: () => isInvoiceLine,
    isJobInWarningScope: () => isJobInWarningScope,
    isJobManager: () => isJobManager,
    isKnownNotificationType: () => isKnownNotificationType,
    isLegacyPlaceholderDocumentId: () => isLegacyPlaceholderDocumentId,
    isOpenBookingStatus: () => isOpenBookingStatus,
    isOrganizationSuperAdmin: () => isOrganizationSuperAdmin,
    isPersonInWarningScope: () => isPersonInWarningScope,
    isPlatformOwnerEmail: () => isPlatformOwnerEmail,
    isPushTokenPlaceholderUserId: () => isPushTokenPlaceholderUserId,
    isSameBookingRequest: () => isSameBookingRequest,
    isScheduledNotificationType: () => isScheduledNotificationType,
    isStaffAccount: () => isStaffAccount,
    isStandardWorkingWeekday: () => isStandardWorkingWeekday,
    isTimesheetAwaitingSignOff: () => isTimesheetAwaitingSignOff,
    isTimesheetExported: () => isTimesheetExported,
    isTimesheetFullySigned: () => isTimesheetFullySigned,
    isTimesheetManagerSigned: () => isTimesheetManagerSigned,
    isTimesheetOperativeSigned: () => isTimesheetOperativeSigned,
    isTombstonedBookingCollection: () => isTombstonedBookingCollection,
    isVerifiedPlatformOwner: () => isVerifiedPlatformOwner,
    isWarningActive: () => isWarningActive,
    isWeekendDayKey: () => isWeekendDayKey,
    isWorkLiveOn: () => isWorkLiveOn,
    jobClientId: () => jobClientId,
    jobCollectionForJobId: () => jobCollectionForJobId,
    jobDeleteBookingRemovals: () => jobDeleteBookingRemovals,
    jobIdQueryValues: () => jobIdQueryValues,
    jobIdsInBothCollections: () => jobIdsInBothCollections,
    jobKind: () => jobKind,
    jobManagerIds: () => jobManagerIds,
    jobManagerUserIds: () => jobManagerUserIds,
    jobQueryPlan: () => jobQueryPlan,
    jobTypesChangeWriteFields: () => jobTypesChangeWriteFields,
    jobTypesWriteFields: () => jobTypesWriteFields,
    jobWriteFields: () => jobWriteFields,
    jobWriteWithoutManagerList: () => jobWriteWithoutManagerList,
    keepStoredLockedPermissions: () => keepStoredLockedPermissions,
    labourBookingKind: () => labourBookingKind,
    labourHolidayInput: () => labourHolidayInput,
    labourPersonIds: () => labourPersonIds,
    launchCountryOptions: () => launchCountryOptions,
    leaveApproverIds: () => leaveApproverIds,
    leaveComparableInterval: () => leaveComparableInterval,
    leaveCoverageRows: () => leaveCoverageRows,
    leaveDaysInRange: () => leaveDaysInRange,
    leaveDecisionQueue: () => leaveDecisionQueue,
    leaveHalfDayLabel: () => leaveHalfDayLabel,
    leaveHalfDayWindows: () => leaveHalfDayWindows,
    leaveRecordDayKeys: () => leaveRecordDayKeys,
    leaveRecordsForAccount: () => leaveRecordsForAccount,
    leaveSlotKind: () => leaveSlotKind,
    leaveSubmitLabel: () => leaveSubmitLabel,
    leaveYearBounds: () => leaveYearBounds,
    leaveYearEndMonth: () => leaveYearEndMonth,
    leaveYearStartMonth: () => leaveYearStartMonth,
    legalPackNeedsAcceptance: () => legalPackNeedsAcceptance,
    lineManagerCandidates: () => lineManagerCandidates,
    lineManagerIds: () => lineManagerIds,
    lineManagerOptions: () => lineManagerOptions,
    lineManagerPeerRecipients: () => lineManagerPeerRecipients,
    lineManagerRequired: () => lineManagerRequired,
    lineManagerRequiredError: () => lineManagerRequiredError,
    lineManagerSelectedIds: () => lineManagerSelectedIds,
    lineManagerSummary: () => lineManagerSummary,
    listedCurrentLabourPeople: () => listedCurrentLabourPeople,
    listedRosterUsers: () => listedRosterUsers,
    liveCollection: () => liveCollection,
    livePayRate: () => livePayRate,
    lockedPermissionFields: () => lockedPermissionFields,
    managerClashGroups: () => managerClashGroups,
    managerRowWriteFields: () => managerRowWriteFields,
    managerSiteBookingUpdateWriteFields: () => managerSiteBookingUpdateWriteFields,
    maskSensitiveValue: () => maskSensitiveValue,
    matchesRosterSegment: () => matchesRosterSegment,
    matchesUserRosterSegment: () => matchesUserRosterSegment,
    materialCatalogueItemFields: () => materialCatalogueItemFields,
    materialCatalogueItemWriteFields: () => materialCatalogueItemWriteFields,
    materialCatalogueWrites: () => materialCatalogueWrites,
    materialCutOffClockMinutes: () => materialCutOffClockMinutes,
    materialCutOffToFirestore: () => materialCutOffToFirestore,
    materialCutOffWarningRows: () => materialCutOffWarningRows,
    materialDeliveryInstant: () => materialDeliveryInstant,
    materialLineCountsAsOrdered: () => materialLineCountsAsOrdered,
    materialLineFields: () => materialLineFields,
    materialLineWriteFields: () => materialLineWriteFields,
    materialOrderIncludesDeliveryRequired: () => materialOrderIncludesDeliveryRequired,
    materialOrderRecipientCheck: () => materialOrderRecipientCheck,
    materialOrderRecipients: () => materialOrderRecipients,
    materialQuantityLabel: () => materialQuantityLabel,
    materialRecordMatches: () => materialRecordMatches,
    materialSearchScore: () => materialSearchScore,
    materialSendRecordCreateFields: () => materialSendRecordCreateFields,
    materialSendStatusWriteFields: () => materialSendStatusWriteFields,
    materialWhatsAppRows: () => materialWhatsAppRows,
    mergeHealthSafetyRowCopies: () => mergeHealthSafetyRowCopies,
    mergeJobTypeCatalogues: () => mergeJobTypeCatalogues,
    mergeMinuteIntervals: () => mergeMinuteIntervals,
    mergeOperativeQualificationWrite: () => mergeOperativeQualificationWrite,
    mergeQualificationCertificateUrls: () => mergeQualificationCertificateUrls,
    mergeStoredRows: () => mergeStoredRows,
    missingStarterQualificationCodes: () => missingStarterQualificationCodes,
    monthDayOffsetBefore: () => monthDayOffsetBefore,
    monthDayOrdinal: () => monthDayOrdinal,
    namedSlotKind: () => namedSlotKind,
    nextCalendarDayKey: () => nextCalendarDayKey,
    normalizeBankHolidayRegionId: () => normalizeBankHolidayRegionId,
    normalizeBookingJobCollection: () => normalizeBookingJobCollection,
    normalizeBookingStatus: () => normalizeBookingStatus,
    normalizeBookingTimeSlot: () => normalizeBookingTimeSlot,
    normalizeClaimedEmails: () => normalizeClaimedEmails,
    normalizeCompanyCountryCode: () => normalizeCompanyCountryCode,
    normalizeCurrencyCode: () => normalizeCurrencyCode,
    normalizeDocumentAbbreviation: () => normalizeDocumentAbbreviation,
    normalizeDocumentId: () => normalizeDocumentId,
    normalizeEmploymentType: () => normalizeEmploymentType,
    normalizeHSIssueStatus: () => normalizeHSIssueStatus,
    normalizeHSSignatureStatus: () => normalizeHSSignatureStatus,
    normalizeHolidayStatus: () => normalizeHolidayStatus,
    normalizeHolidayTimeSlot: () => normalizeHolidayTimeSlot,
    normalizeManagerBookingTimeSlot: () => normalizeManagerBookingTimeSlot,
    normalizeMaterialLengthUnit: () => normalizeMaterialLengthUnit,
    normalizeMaterialRequestType: () => normalizeMaterialRequestType,
    normalizeMaterialSearchText: () => normalizeMaterialSearchText,
    normalizeMaterialUnit: () => normalizeMaterialUnit,
    normalizeMaterialWorkflowStatus: () => normalizeMaterialWorkflowStatus,
    normalizePaymentRunRange: () => normalizePaymentRunRange,
    normalizeProjectTaskPriority: () => normalizeProjectTaskPriority,
    normalizeProjectTaskStatus: () => normalizeProjectTaskStatus,
    normalizeTimesheetWeekday: () => normalizeTimesheetWeekday,
    normalizeUserRoleToken: () => normalizeUserRoleToken,
    normalizeVariationStatus: () => normalizeVariationStatus,
    notificationCatalogRow: () => notificationCatalogRow,
    notificationCreateFields: () => notificationCreateFields,
    notificationCreatedAtIsServerTime: () => notificationCreatedAtIsServerTime,
    notificationDeliversDevicePush: () => notificationDeliversDevicePush,
    notificationDestination: () => notificationDestination,
    notificationOrganizationSwitch: () => notificationOrganizationSwitch,
    notificationPreferenceAllowsDelivery: () => notificationPreferenceAllowsDelivery,
    notificationPreferenceCopy: () => notificationPreferenceCopy,
    notificationPreferenceIsVisible: () => notificationPreferenceIsVisible,
    notificationPreferenceKeyForType: () => notificationPreferenceKeyForType,
    notificationPushesToActor: () => notificationPushesToActor,
    notificationReadWriteFields: () => notificationReadWriteFields,
    notificationRecipientAccountId: () => notificationRecipientAccountId,
    notificationRelatedId: () => notificationRelatedId,
    notificationRelatedIdFor: () => notificationRelatedIdFor,
    notificationShowsInInbox: () => notificationShowsInInbox,
    offlineAvailability: () => offlineAvailability,
    offlineLastUpdatedLabel: () => offlineLastUpdatedLabel,
    operativeClashGroups: () => operativeClashGroups,
    operativeProfileWriteFields: () => operativeProfileWriteFields,
    operativeRowWriteFields: () => operativeRowWriteFields,
    orgAccessProbeFromReads: () => orgAccessProbeFromReads,
    orgDayHours: () => orgDayHours,
    orgMembershipWriteFields: () => orgMembershipWriteFields,
    organizationCreateFields: () => organizationCreateFields,
    organizationCurrencyWriteFields: () => organizationCurrencyWriteFields,
    organizationDayStartMs: () => organizationDayStartMs,
    organizationDeleteConfirmationError: () => organizationDeleteConfirmationError,
    organizationDeletedMessage: () => organizationDeletedMessage,
    organizationDeletionState: () => organizationDeletionState,
    organizationDeletionWriteFields: () => organizationDeletionWriteFields,
    organizationEraseDateLabel: () => organizationEraseDateLabel,
    organizationEraseDue: () => organizationEraseDue,
    organizationIdFromValue: () => organizationIdFromValue,
    organizationIdsMatch: () => organizationIdsMatch,
    organizationLevelFor: () => organizationLevelFor,
    organizationMemberActive: () => organizationMemberActive,
    organizationNameToFirestore: () => organizationNameToFirestore,
    organizationNameWriteFields: () => organizationNameWriteFields,
    organizationScopedKey: () => organizationScopedKey,
    organizationTimeZone: () => organizationTimeZone,
    overlappingBookingIds: () => overlappingBookingIds,
    overlappingIntervalGroups: () => overlappingIntervalGroups,
    overlayPayProfile: () => overlayPayProfile,
    overnightCarryInterval: () => overnightCarryInterval,
    paidHoursForNamedSlot: () => paidHoursForNamedSlot,
    parseAnnualLeaveDefaults: () => parseAnnualLeaveDefaults,
    parseBookingDocument: () => parseBookingDocument,
    parseClientDocument: () => parseClientDocument,
    parseClockMinutes: () => parseClockMinutes,
    parseCompanyDetails: () => parseCompanyDetails,
    parseDeadlineAssignments: () => parseDeadlineAssignments,
    parseDeadlineDocument: () => parseDeadlineDocument,
    parseDeadlineItem: () => parseDeadlineItem,
    parseFormerUserIds: () => parseFormerUserIds,
    parseHealthSafetyDocument: () => parseHealthSafetyDocument,
    parseHolidayDecisionNote: () => parseHolidayDecisionNote,
    parseHolidayDocument: () => parseHolidayDocument,
    parseHolidayDocuments: () => parseHolidayDocuments,
    parseInvoicing: () => parseInvoicing,
    parseJobDocument: () => parseJobDocument,
    parseJobTypesDocument: () => parseJobTypesDocument,
    parseManagerDocument: () => parseManagerDocument,
    parseManagerSiteBookingDocument: () => parseManagerSiteBookingDocument,
    parseMaterialCatalogueDocument: () => parseMaterialCatalogueDocument,
    parseMaterialCutOff: () => parseMaterialCutOff,
    parseMaterialLineDocument: () => parseMaterialLineDocument,
    parseMaterialListDocuments: () => parseMaterialListDocuments,
    parseMaterialSendRecordDocument: () => parseMaterialSendRecordDocument,
    parseMaxCarryOverDays: () => parseMaxCarryOverDays,
    parseNotificationDocument: () => parseNotificationDocument,
    parseOperativeDocument: () => parseOperativeDocument,
    parseOperativeProfileDocument: () => parseOperativeProfileDocument,
    parseOrgMembershipDocument: () => parseOrgMembershipDocument,
    parseOrganizationDeletion: () => parseOrganizationDeletion,
    parseOrganizationName: () => parseOrganizationName,
    parsePayProfileDocument: () => parsePayProfileDocument,
    parsePayRateHistoryDocument: () => parsePayRateHistoryDocument,
    parsePayRateHistoryDocuments: () => parsePayRateHistoryDocuments,
    parsePaymentRunDateRanges: () => parsePaymentRunDateRanges,
    parsePaymentRunHistory: () => parsePaymentRunHistory,
    parsePayrollPolicy: () => parsePayrollPolicy,
    parsePayrollTimePolicyHistory: () => parsePayrollTimePolicyHistory,
    parsePayrollTimePolicyScheduled: () => parsePayrollTimePolicyScheduled,
    parsePayrollTimePolicyState: () => parsePayrollTimePolicyState,
    parseProjectDocument: () => parseProjectDocument,
    parseSiteAuditDocument: () => parseSiteAuditDocument,
    parseSkillDocument: () => parseSkillDocument,
    parseSmallWorkDocument: () => parseSmallWorkDocument,
    parseSubcontractorBookingDocument: () => parseSubcontractorBookingDocument,
    parseSubcontractorDocument: () => parseSubcontractorDocument,
    parseTaskDocument: () => parseTaskDocument,
    parseTimesheetEntries: () => parseTimesheetEntries,
    parseTimesheetEntryDecision: () => parseTimesheetEntryDecision,
    parseTimesheetEntryReviews: () => parseTimesheetEntryReviews,
    parseTimesheetStatusFields: () => parseTimesheetStatusFields,
    parseTimesheetSubmissionEntry: () => parseTimesheetSubmissionEntry,
    parseTimesheetSubmissionList: () => parseTimesheetSubmissionList,
    parseTradeTypeInventory: () => parseTradeTypeInventory,
    parseUserDocument: () => parseUserDocument,
    parseUserNotificationPreferences: () => parseUserNotificationPreferences,
    parseVariationDocument: () => parseVariationDocument,
    parseVariationLogDocument: () => parseVariationLogDocument,
    parseVariationTrackerDocument: () => parseVariationTrackerDocument,
    parseVariationTrades: () => parseVariationTrades,
    parseWarningDetection: () => parseWarningDetection,
    parseWarningResolutionDocument: () => parseWarningResolutionDocument,
    parseWarningsSortDirection: () => parseWarningsSortDirection,
    parseWeekendCoverage: () => parseWeekendCoverage,
    parseWholesalerDocument: () => parseWholesalerDocument,
    passwordMinLength: () => passwordMinLength,
    passwordPolicyError: () => passwordPolicyError,
    payForHours: () => payForHours,
    payProfileBackfillWrites: () => payProfileBackfillWrites,
    payProfilePath: () => payProfilePath,
    payProfileWriteFieldsFromProfileWrite: () => payProfileWriteFieldsFromProfileWrite,
    payRateChangeWrites: () => payRateChangeWrites,
    payRateHistoryWriteFields: () => payRateHistoryWriteFields,
    payRateOnDay: () => payRateOnDay,
    payRateRequiredError: () => payRateRequiredError,
    paymentDateAfterPeriodEnd: () => paymentDateAfterPeriodEnd,
    paymentRunHistoryAfterChange: () => paymentRunHistoryAfterChange,
    paymentRunHistoryToFirestore: () => paymentRunHistoryToFirestore,
    paymentRunLabel: () => paymentRunLabel,
    paymentRunMonthDay: () => paymentRunMonthDay,
    paymentRunPayDate: () => paymentRunPayDate,
    paymentRunRangeToFirestore: () => paymentRunRangeToFirestore,
    paymentRunShowsMonthCoverage: () => paymentRunShowsMonthCoverage,
    paymentWeekdayAfterPeriodEnd: () => paymentWeekdayAfterPeriodEnd,
    payrollBreakOnDay: () => payrollBreakOnDay,
    payrollDayKeyFromValue: () => payrollDayKeyFromValue,
    payrollDayWindows: () => payrollDayWindows,
    payrollHoursResult: () => payrollHoursResult,
    payrollLineReview: () => payrollLineReview,
    payrollOutsideMultiplier: () => payrollOutsideMultiplier,
    payrollPolicyTimeOnStep: () => payrollPolicyTimeOnStep,
    payrollTimePolicyApplyNowWriteFields: () => payrollTimePolicyApplyNowWriteFields,
    payrollTimePolicyCancelScheduleWriteFields: () => payrollTimePolicyCancelScheduleWriteFields,
    payrollTimePolicyForDayFromState: () => payrollTimePolicyForDayFromState,
    payrollTimePolicyHistoryEntries: () => payrollTimePolicyHistoryEntries,
    payrollTimePolicySaveConflict: () => payrollTimePolicySaveConflict,
    payrollTimePolicyScheduleDateError: () => payrollTimePolicyScheduleDateError,
    payrollTimePolicyScheduleWriteFields: () => payrollTimePolicyScheduleWriteFields,
    payrollTimePolicyTimeline: () => payrollTimePolicyTimeline,
    permissionLevelOf: () => permissionLevelOf,
    permissionToggleRows: () => permissionToggleRows,
    permissionsWriteMap: () => permissionsWriteMap,
    personDayItems: () => personDayItems,
    personIdSet: () => personIdSet,
    pickTimesheetRowForPeriod: () => pickTimesheetRowForPeriod,
    proRataLeaveAllowance: () => proRataLeaveAllowance,
    provisionalOrganizationId: () => provisionalOrganizationId,
    pushPayloadFields: () => pushPayloadFields,
    pushTestRecipients: () => pushTestRecipients,
    pushTokenDedupePlan: () => pushTokenDedupePlan,
    pushTokenList: () => pushTokenList,
    pushTokenOwnerWrites: () => pushTokenOwnerWrites,
    pushTokensExcludingActor: () => pushTokensExcludingActor,
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
    readCrossPlatformSample: () => readCrossPlatformSample,
    readStoredRates: () => readStoredRates,
    readsEveryBooking: () => readsEveryBooking,
    receivesJobNotification: () => receivesJobNotification,
    recordsToSave: () => recordsToSave,
    rememberedOrganizationSurvivesSignOut: () => rememberedOrganizationSurvivesSignOut,
    removedQualificationCertificateIds: () => removedQualificationCertificateIds,
    replayRefusedIsFinal: () => replayRefusedIsFinal,
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
    resolveWeekendCoverageDay: () => resolveWeekendCoverageDay,
    resolvedWarningKeys: () => resolvedWarningKeys,
    rosterAliasIdsFor: () => rosterAliasIdsFor,
    rosterDocumentRank: () => rosterDocumentRank,
    rosterMembersForOrganization: () => rosterMembersForOrganization,
    rosterPeople: () => rosterPeople,
    rosterPersonName: () => rosterPersonName,
    rosterSegment: () => rosterSegment,
    rosterStatusLabel: () => rosterStatusLabel,
    roundPennies: () => roundPennies,
    rulebookStamp: () => rulebookStamp,
    scheduleOptionsWriteFields: () => scheduleOptionsWriteFields,
    screenMustListen: () => screenMustListen,
    seesEveryJob: () => seesEveryJob,
    seesEveryUserTimesheet: () => seesEveryUserTimesheet,
    selectableTimesheetPaymentRunPeriods: () => selectableTimesheetPaymentRunPeriods,
    selfEmailChangeAction: () => selfEmailChangeAction,
    selfEmailChangeSentMessage: () => selfEmailChangeSentMessage,
    sensitiveProfileDocPath: () => sensitiveProfileDocPath,
    sensitiveProfileWriteFields: () => sensitiveProfileWriteFields,
    sessionMembershipIds: () => sessionMembershipIds,
    sharedWarningResolutionKey: () => sharedWarningResolutionKey,
    shouldClearRememberedOrganization: () => shouldClearRememberedOrganization,
    showsMyTimesheets: () => showsMyTimesheets,
    signInEmailSyncWrites: () => signInEmailSyncWrites,
    siteAuditWriteFields: () => siteAuditWriteFields,
    skillsCatalogueWrites: () => skillsCatalogueWrites,
    slotInterval: () => slotInterval,
    snapLeaveDays: () => snapLeaveDays,
    sortWarningsByDate: () => sortWarningsByDate,
    stableManagerId: () => stableManagerId,
    standardBreakWindow: () => standardBreakWindow,
    standardDayCoverage: () => standardDayCoverage,
    standardDayWindow: () => standardDayWindow,
    starterCollectionShouldSeed: () => starterCollectionShouldSeed,
    storedJobIdForKey: () => storedJobIdForKey,
    storedPermissionFlag: () => storedPermissionFlag,
    stringFromJobTypeField: () => stringFromJobTypeField,
    subcontractorBookingCreateFields: () => subcontractorBookingCreateFields,
    subcontractorBookingWriteFields: () => subcontractorBookingWriteFields,
    subcontractorContactId: () => subcontractorContactId,
    subcontractorDayValue: () => subcontractorDayValue,
    subcontractorWriteFields: () => subcontractorWriteFields,
    subscriptionAccess: () => subscriptionAccess,
    subtractMinuteIntervals: () => subtractMinuteIntervals,
    syncWriteAllowed: () => syncWriteAllowed,
    taskCompletedRecipients: () => taskCompletedRecipients,
    taskFields: () => taskFields,
    taskWriteFields: () => taskWriteFields,
    taxIdsDocumentFields: () => taxIdsDocumentFields,
    timeSlotAllowedOnDay: () => timeSlotAllowedOnDay,
    timesheetBelongsToOrganization: () => timesheetBelongsToOrganization,
    timesheetChangedFields: () => timesheetChangedFields,
    timesheetDaysForPerson: () => timesheetDaysForPerson,
    timesheetDocumentId: () => timesheetDocumentId,
    timesheetEntryDecision: () => timesheetEntryDecision,
    timesheetEntryEffectiveAmount: () => timesheetEntryEffectiveAmount,
    timesheetEntryId: () => timesheetEntryId,
    timesheetEntryReviewWriteFields: () => timesheetEntryReviewWriteFields,
    timesheetEntryReviewsAfterWrite: () => timesheetEntryReviewsAfterWrite,
    timesheetExportStoragePath: () => timesheetExportStoragePath,
    timesheetExportWriteFields: () => timesheetExportWriteFields,
    timesheetInvoiceRows: () => timesheetInvoiceRows,
    timesheetLeaveLabel: () => timesheetLeaveLabel,
    timesheetLeaveLines: () => timesheetLeaveLines,
    timesheetListBucket: () => timesheetListBucket,
    timesheetNotificationDedupeKey: () => timesheetNotificationDedupeKey,
    timesheetOwnerWriteFields: () => timesheetOwnerWriteFields,
    timesheetParticipant: () => timesheetParticipant,
    timesheetPaymentRunPeriodsFromWindow: () => timesheetPaymentRunPeriodsFromWindow,
    timesheetPeriodContainsDay: () => timesheetPeriodContainsDay,
    timesheetPeriodFromInvoicing: () => timesheetPeriodFromInvoicing,
    timesheetPeriodKey: () => timesheetPeriodKey,
    timesheetPeriodMatches: () => timesheetPeriodMatches,
    timesheetPeriodWriteFields: () => timesheetPeriodWriteFields,
    timesheetRequiresManagerCounterSign: () => timesheetRequiresManagerCounterSign,
    timesheetSelfSigned: () => timesheetSelfSigned,
    timesheetSignOffWriteFields: () => timesheetSignOffWriteFields,
    timesheetSignedRecipients: () => timesheetSignedRecipients,
    timesheetStatusWriteFields: () => timesheetStatusWriteFields,
    timesheetStoredStartDayKey: () => timesheetStoredStartDayKey,
    timesheetSubmissionAfterPaymentDayChange: () => timesheetSubmissionAfterPaymentDayChange,
    timesheetSubmissionAfterPaymentWeekdayChange: () => timesheetSubmissionAfterPaymentWeekdayChange,
    timesheetSubmissionNoticeCopy: () => timesheetSubmissionNoticeCopy,
    timesheetSubmissionNoticeDedupKey: () => timesheetSubmissionNoticeDedupKey,
    timesheetSubmissionToFirestore: () => timesheetSubmissionToFirestore,
    timesheetSubmittedRecipients: () => timesheetSubmittedRecipients,
    timesheetTimestampMs: () => timesheetTimestampMs,
    timesheetWriterIsReviewer: () => timesheetWriterIsReviewer,
    tokenizeMaterialSearch: () => tokenizeMaterialSearch,
    tokenizeQualificationSearch: () => tokenizeQualificationSearch,
    toolboxTalkRecipients: () => toolboxTalkRecipients,
    tradeTypeInventoryWriteFields: () => tradeTypeInventoryWriteFields,
    unbookedLabourRows: () => unbookedLabourRows,
    unbookedLabourRowsOnDay: () => unbookedLabourRowsOnDay,
    unbookedScanDays: () => unbookedScanDays,
    uniqueOrganizationIds: () => uniqueOrganizationIds,
    unpaidBreakAppliesOnDay: () => unpaidBreakAppliesOnDay,
    unreadNotificationBadgeCount: () => unreadNotificationBadgeCount,
    unverifiedOperativeRows: () => unverifiedOperativeRows,
    userCreateRequiresAgeConfirmation: () => userCreateRequiresAgeConfirmation,
    userDeleteRefusal: () => userDeleteRefusal,
    userDeleteWrites: () => userDeleteWrites,
    userNotificationPreferenceFieldPatch: () => userNotificationPreferenceFieldPatch,
    userNotificationPreferencesToFirestore: () => userNotificationPreferencesToFirestore,
    userProfileWriteFields: () => userProfileWriteFields,
    userRosterSegment: () => userRosterSegment,
    userTimesheetSubjects: () => userTimesheetSubjects,
    usersMissingLineManager: () => usersMissingLineManager,
    usersMissingPayRate: () => usersMissingPayRate,
    validateAnnualLeaveDefaults: () => validateAnnualLeaveDefaults,
    validateInvoicingSettings: () => validateInvoicingSettings,
    validateLeaveYearMonths: () => validateLeaveYearMonths,
    validatePayrollTimePolicy: () => validatePayrollTimePolicy,
    variationLineId: () => variationLineId,
    variationLogItemId: () => variationLogItemId,
    variationLogItems: () => variationLogItems,
    variationLogWriteFields: () => variationLogWriteFields,
    variationRenumberWriteFields: () => variationRenumberWriteFields,
    variationTrackerWriteFields: () => variationTrackerWriteFields,
    variationTradesWriteFields: () => variationTradesWriteFields,
    variationWriteFields: () => variationWriteFields,
    visibleJobsFor: () => visibleJobsFor,
    visibleNotificationPreferenceKeys: () => visibleNotificationPreferenceKeys,
    warningDayKeyIsDated: () => warningDayKeyIsDated,
    warningDetectionToFirestore: () => warningDetectionToFirestore,
    warningLookaheadFallbackNotice: () => warningLookaheadFallbackNotice,
    warningResolutionMigrationWrites: () => warningResolutionMigrationWrites,
    warningResolutionRecords: () => warningResolutionRecords,
    warningResolutionWriteFields: () => warningResolutionWriteFields,
    warningScopeFor: () => warningScopeFor,
    webSessionOrganizationStorageKey: () => webSessionOrganizationStorageKey,
    weekdayOffsetBefore: () => weekdayOffsetBefore,
    weekdayPaidDayPreview: () => weekdayPaidDayPreview,
    weekdayPaidHours: () => weekdayPaidHours,
    weekendBookingBreakdown: () => weekendBookingBreakdown,
    weekendBookingNote: () => weekendBookingNote,
    weekendBookingNotes: () => weekendBookingNotes,
    weekendBreakFor: () => weekendBreakFor,
    weekendCustomHoursDefault: () => weekendCustomHoursDefault,
    weekendFullDayWindow: () => weekendFullDayWindow,
    weekendLunchBreakCopy: () => weekendLunchBreakCopy,
    weekendRuleForIsoWeekday: () => weekendRuleForIsoWeekday,
    wholesalerContactId: () => wholesalerContactId,
    wholesalerWriteFields: () => wholesalerWriteFields,
    windowCoverage: () => windowCoverage,
    withDerivedWeekdayPaidHours: () => withDerivedWeekdayPaidHours,
    withoutDismissedQualificationRows: () => withoutDismissedQualificationRows,
    withoutLockedPermissionWrites: () => withoutLockedPermissionWrites,
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
  function zoneOffsetMs(instantMs3, timeZone) {
    const floored = Math.floor(instantMs3 / 6e4) * 6e4;
    const p = partsInZone(new Date(floored), timeZone);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - floored;
  }
  function localMidnightMs(y, m, d, timeZone) {
    const wall = Date.UTC(y, m - 1, d, 0, 0, 0);
    const dayOf = (ms) => {
      const p = partsInZone(new Date(ms), timeZone);
      return Date.UTC(p.y, p.m - 1, p.d);
    };
    const first = wall - zoneOffsetMs(wall, timeZone);
    const second = wall - zoneOffsetMs(first, timeZone);
    if (dayOf(second) === wall) return second;
    const third = wall - zoneOffsetMs(second, timeZone);
    return dayOf(third) === wall ? third : second;
  }
  function midnightInZone(date, timeZone) {
    const { y, m, d } = partsInZone(date, timeZone);
    return new Date(localMidnightMs(y, m, d, timeZone));
  }
  function addDaysInZone(date, days, timeZone) {
    const { y, m, d } = partsInZone(date, timeZone);
    const shifted = new Date(Date.UTC(y, m - 1, d + days));
    return new Date(localMidnightMs(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), timeZone));
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
  function dateFromDayKeyInZone(key3, timeZone) {
    const [y, m, d] = key3.split("-").map(Number);
    const day = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(day.getTime())) return /* @__PURE__ */ new Date(NaN);
    return new Date(localMidnightMs(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), timeZone));
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
    const documentOrganizationId2 = String(input.documentOrganizationId || "").trim();
    const candidates = uniqueOrganizationIds([
      input.explicitOrganizationId,
      input.rememberedOrganizationId,
      documentOrganizationId2
    ]);
    const probeFor = (organizationId) => {
      if (input.probes instanceof Map) {
        for (const [key3, probe] of input.probes) {
          if (organizationIdsMatch(key3, organizationId)) return probe;
        }
        return "unknown";
      }
      for (const [key3, probe] of Object.entries(input.probes)) {
        if (organizationIdsMatch(key3, organizationId)) return probe;
      }
      return "unknown";
    };
    const rememberedOrganizationId = String(input.rememberedOrganizationId || "").trim();
    const explicitOrganizationId = String(input.explicitOrganizationId || "").trim();
    const persistFor = (organizationId) => {
      if (!organizationId) return null;
      const chosenIsDocument = organizationIdsMatch(organizationId, documentOrganizationId2);
      const chosenIsRemembered = organizationIdsMatch(organizationId, rememberedOrganizationId);
      const chosenIsExplicit = organizationIdsMatch(organizationId, explicitOrganizationId);
      if (chosenIsDocument && !chosenIsRemembered && !chosenIsExplicit) return null;
      return organizationId;
    };
    for (const organizationId of candidates) {
      const isDocument = organizationIdsMatch(organizationId, documentOrganizationId2);
      if (!isDocument && probeFor(organizationId) === "denied") continue;
      return { organizationId, persistOrganizationId: persistFor(organizationId) };
    }
    return {
      organizationId: documentOrganizationId2,
      persistOrganizationId: persistFor(documentOrganizationId2)
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
    const text23 = String(value ?? "").trim();
    const match = /^(\d{1,2}):(\d{2})$/.exec(text23);
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
  function leaveHalfDayWindows(input) {
    const day = standardDayWindow(input);
    const mid = day.start + Math.floor((day.end - day.start) / 2);
    return { day, am: { start: day.start, end: mid }, pm: { start: mid, end: day.end } };
  }
  function leaveComparableInterval(booking, dayInput2) {
    const start = parseClockMinutes(booking.workStartTime);
    const end = parseClockMinutes(booking.workEndTime);
    const kind = namedSlotKind(booking.timeSlot);
    if ((kind === "AM" || kind === "PM") && !(start != null && end != null && start !== end)) {
      const halves = leaveHalfDayWindows(dayInput2);
      return { ...kind === "AM" ? halves.am : halves.pm };
    }
    return slotInterval(booking, dayInput2);
  }
  function leaveHalfDayLabel(timeSlot, dayInput2) {
    const kind = namedSlotKind(timeSlot);
    if (kind !== "AM" && kind !== "PM") return "Full day";
    const halves = leaveHalfDayWindows(dayInput2);
    const half = kind === "AM" ? halves.am : halves.pm;
    return `${kind} ${formatClockMinutes(half.start)}\u2013${formatClockMinutes(half.end)}`;
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
    if (start != null && end != null && end < start) return { start, end: end + 24 * 60 };
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
  function intervalCrossesMidnight(interval2) {
    return Boolean(interval2 && interval2.end > 24 * 60);
  }
  function overnightCarryInterval(interval2) {
    if (!interval2 || !intervalCrossesMidnight(interval2)) return null;
    return { start: interval2.start - 24 * 60, end: interval2.end - 24 * 60 };
  }
  function nextCalendarDayKey(dayKey) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || "").trim());
    if (!match) return "";
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1));
    return date.toISOString().slice(0, 10);
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
    const first = new Date(Date.UTC(y, m - 1 + offset, 1));
    return dateFromDayKeyInZone(`${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}-01`, timeZone);
  }
  function paymentRunMonthDay(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : 0;
  }
  function normalizePaymentRunRange(row2) {
    if (!row2) return null;
    const startDay = paymentRunMonthDay(row2.startDate) || paymentRunMonthDay(row2.startDay);
    const endDay = paymentRunMonthDay(row2.endDate) || paymentRunMonthDay(row2.endDay);
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
  function windowCoverage(window, policy, bookings, breakWindow) {
    const lunch = breakWindow && breakWindow.end > breakWindow.start ? breakWindow : null;
    const required = withoutInterval([window], lunch);
    const requiredHours = roundCoverageHours(intervalMinutes(required) / 60);
    const windows = halfDayWindows(policy);
    const covered = [];
    for (const booking of bookings) {
      const interval2 = bookingCoverInterval(booking, windows);
      if (!interval2) continue;
      const start = Math.max(interval2.start, window.start);
      const end = Math.min(interval2.end, window.end);
      if (end > start) covered.push({ start, end });
    }
    const inside = withoutInterval(mergeMinuteIntervals(covered), lunch);
    const coveredHours = roundCoverageHours(Math.min(requiredHours, intervalMinutes(inside) / 60));
    return { requiredHours, coveredHours, missingHours: roundCoverageHours(Math.max(0, requiredHours - coveredHours)) };
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
      const key3 = dayKeyInZone(cursor, timeZone);
      if (key3 > window.endDayKey) break;
      keys.push(key3);
      cursor = addDaysInZone(cursor, 1, timeZone);
    }
    const mode = String(input.clashLookaheadMode || "endOfWorkingWeek");
    if (mode === "endOfWorkingWeek") {
      const booked = input.bookedDayKeys == null ? null : new Set(input.bookedDayKeys.map((key3) => String(key3)));
      const friday = dateFromDayKeyInZone(window.endDayKey, timeZone);
      for (const offset of [1, 2]) {
        const key3 = dayKeyInZone(addDaysInZone(friday, offset, timeZone), timeZone);
        if (!booked || booked.has(key3)) keys.push(key3);
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
  function unbookedScanDays(input) {
    const timeZone = zoneOf(input.timeZone);
    const window = coverageWindow(input);
    const includeWeekends = input.includeWeekends === true || input.includeWeekendsForUnbookedLabour === true;
    const mode = String(input.clashLookaheadMode || "endOfWorkingWeek");
    let endDayKey = window.endDayKey;
    if (mode === "endOfWorkingWeek" && includeWeekends) {
      const end = dateFromDayKeyInZone(window.endDayKey, timeZone);
      const iso = isoWeekdayInZone(end, timeZone);
      if (iso >= 1 && iso <= 5) endDayKey = dayKeyInZone(addDaysInZone(end, 7 - iso, timeZone), timeZone);
    }
    const keys = [];
    let cursor = dateFromDayKeyInZone(window.startDayKey, timeZone);
    while (keys.length <= 400) {
      const key3 = dayKeyInZone(cursor, timeZone);
      if (key3 > endDayKey) break;
      const iso = isoWeekdayInZone(cursor, timeZone);
      const weekendOn = iso === 6 ? input.weekendCoverage?.saturday?.enabled !== false : iso === 7 ? input.weekendCoverage?.sunday?.enabled !== false : true;
      if (includeWeekends && weekendOn || iso >= 1 && iso <= 5) keys.push(key3);
      cursor = addDaysInZone(cursor, 1, timeZone);
    }
    const result2 = { ...window, endDayKey, dayKeys: keys };
    return result2;
  }
  function warningLookaheadFallbackNotice(reason) {
    if (reason === "lookaheadDaysMissing") {
      return "No number of days is saved for this company, so warnings scan 7 days (today and the next 6). Choose a number and save to change it.";
    }
    if (reason === "lookaheadDaysInvalid") {
      return "The saved number of days is not valid, so warnings scan 7 days (today and the next 6). Choose a number and save to fix it.";
    }
    return null;
  }
  function dayKeyInOrganizationZone(referenceIso, timeZone) {
    return dayKeyInZone(new Date(referenceIso), zoneOf(timeZone));
  }
  function organizationScopedKey(kind, organizationId, userId = "") {
    const org = String(organizationId || "").trim().toLowerCase();
    const user = String(userId || "").trim();
    return user ? `${kind}:${user}:${org}` : `${kind}:${org}`;
  }

  // lib/canonical/staffAccess.ts
  function isStaffAccount(role) {
    if (role.isOperativeMode) return false;
    return role.isSuperAdmin || role.isAdmin || role.isManager;
  }
  function seesEveryJob(role, kind, toggles) {
    if (!role || role.isOperativeMode) return false;
    if (role.isSuperAdmin || role.isAdmin) return true;
    if (!role.isManager || !toggles) return false;
    if (kind === "projects") return toggles.projects === true;
    if (kind === "smallWorks") return toggles.smallWorks === true;
    return toggles.projects === true && toggles.smallWorks === true;
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
    return seesEveryJob(role, catalogue, toggles);
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
  function idKey(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    const bare = raw.toLowerCase().startsWith("user:") ? raw.slice(5) : raw;
    return bare.trim().toLowerCase();
  }
  function idList(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  }
  function utf8Bytes(value) {
    const out = [];
    for (const char of value) {
      const code = char.codePointAt(0) ?? 0;
      if (code < 128) out.push(code);
      else if (code < 2048) out.push(192 | code >> 6, 128 | code & 63);
      else if (code < 65536) out.push(224 | code >> 12, 128 | code >> 6 & 63, 128 | code & 63);
      else out.push(240 | code >> 18, 128 | code >> 12 & 63, 128 | code >> 6 & 63, 128 | code & 63);
    }
    return out;
  }
  var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function stableManagerId(documentId2) {
    const trimmed6 = typeof documentId2 === "string" ? documentId2.trim() : "";
    if (!trimmed6) return "";
    if (UUID_PATTERN.test(trimmed6)) return trimmed6.toUpperCase();
    const MASK64 = (BigInt(1) << BigInt(64)) - BigInt(1);
    const FNV_OFFSET = BigInt("14695981039346656037");
    const FNV_PRIME = BigInt("1099511628211");
    let h1 = FNV_OFFSET;
    let h2 = FNV_PRIME;
    const bytes = utf8Bytes(trimmed6);
    for (const byte of bytes) {
      h1 = (h1 ^ BigInt(byte)) & MASK64;
      h1 = h1 * FNV_PRIME & MASK64;
      h2 = (h2 ^ BigInt(byte)) & MASK64;
      h2 = h2 * FNV_OFFSET & MASK64;
    }
    const out = new Array(16).fill(0);
    for (let index = 0; index < 8; index += 1) {
      out[index] = Number(h1 >> BigInt(8 * index) & BigInt(255));
      out[index + 8] = Number(h2 >> BigInt(8 * index) & BigInt(255));
    }
    out[6] = out[6] & 15 | 80;
    out[8] = out[8] & 63 | 128;
    const hex = out.map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toUpperCase();
  }
  function jobManagerIds(job) {
    const row2 = job && typeof job === "object" ? job : {};
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (id2) => {
      const key3 = idKey(id2);
      if (!key3 || seen.has(key3)) return;
      seen.add(key3);
      out.push(id2);
    };
    for (const id2 of idList(row2.managerIds)) add(id2);
    if (typeof row2.managerId === "string") add(row2.managerId.trim());
    for (const id2 of idList(row2.assignedManagerUserIds)) add(id2);
    for (const id2 of idList(row2.managerUserIds)) add(id2);
    return out;
  }
  function isJobManager(viewer, job, managers) {
    if (!viewer) return false;
    const viewerIds = new Set((viewer.ids || []).map(idKey).filter(Boolean));
    if (viewerIds.size === 0) return false;
    const stored = jobManagerIds(job).map(idKey);
    if (stored.length === 0) return false;
    if (stored.some((id2) => viewerIds.has(id2))) return true;
    const email = typeof viewer.email === "string" ? viewer.email.trim().toLowerCase() : "";
    if (!email) return false;
    const storedSet = new Set(stored);
    return (managers || []).some((row2) => {
      if (!row2 || typeof row2.id !== "string") return false;
      if (String(row2.email ?? "").trim().toLowerCase() !== email) return false;
      return storedSet.has(idKey(row2.id)) || storedSet.has(idKey(stableManagerId(row2.id)));
    });
  }
  function canSeeJob(viewer, job, managers, kind) {
    if (!viewer || !job) return false;
    const role = viewer.role;
    if (!role || role.isOperativeMode) return false;
    if (role.isSuperAdmin || role.isAdmin) return true;
    if (!role.isManager) return false;
    if (seesEveryJob(role, kind ?? null, viewer.toggles ?? null)) return true;
    return isJobManager(viewer, job, managers);
  }
  function visibleJobsFor(viewer, jobs, managers, kind) {
    return (jobs || []).filter((job) => canSeeJob(viewer, job, managers, kind));
  }
  var BOOKING_PERMISSION_COLLECTIONS = ["bookings", "managerSiteBookings", "subcontractorBookings"];
  function bookingJobId(booking) {
    if (!booking) return null;
    if (booking.collection === "managerSiteBookings") {
      const type = String(booking.locationType ?? "").trim();
      if (type !== "project" && type !== "small_work") return null;
      const id3 = String(booking.locationId ?? "").trim();
      return id3 || null;
    }
    const id2 = String(booking.projectId ?? "").trim();
    return id2 || null;
  }
  function canWriteBooking(viewer, booking, job, managers) {
    if (!viewer || !booking) return false;
    if (!BOOKING_PERMISSION_COLLECTIONS.includes(String(booking.collection))) return false;
    const role = viewer.role;
    if (!role || role.isOperativeMode) return false;
    if (role.isSuperAdmin || role.isAdmin) return true;
    if (!role.isManager) return false;
    if (booking.collection === "managerSiteBookings" && bookingJobId(booking) == null) {
      const ids = new Set((viewer.ids || []).map(idKey).filter(Boolean));
      return ids.has(idKey(booking.userId));
    }
    if (!job) return false;
    return isJobManager(viewer, job, managers);
  }
  function canDeleteBooking(viewer, booking, job, managers) {
    return canWriteBooking(viewer, booking, job, managers);
  }
  function jobManagerUserIds(job, managers, accounts) {
    const stored = (() => {
      const row2 = job && typeof job === "object" ? job : {};
      const ids = [];
      for (const id2 of idList(row2.managerIds)) ids.push(id2);
      if (typeof row2.managerId === "string" && row2.managerId.trim()) ids.push(row2.managerId.trim());
      return new Set(ids.map(idKey).filter(Boolean));
    })();
    if (stored.size === 0) return [];
    const emails = new Set(
      (managers || []).filter((row2) => row2 && (stored.has(idKey(row2.id)) || stored.has(idKey(stableManagerId(row2.id))))).map((row2) => String(row2.email ?? "").trim().toLowerCase()).filter(Boolean)
    );
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const account of accounts || []) {
      const id2 = typeof account?.id === "string" ? account.id.trim() : "";
      const key3 = id2.toLowerCase();
      if (!id2 || seen.has(key3) || account.isActive === false) continue;
      const email = String(account.email ?? "").trim().toLowerCase();
      if (stored.has(key3) || email !== "" && emails.has(email)) {
        seen.add(key3);
        out.push(id2);
      }
    }
    return out;
  }
  var JOB_MANAGER_LIST_FIELDS = ["managerIds", "managerId", "assignedManagerUserIds", "managerUserIds"];
  function canCreateJob(viewer, kind) {
    if (!viewer || !viewer.role) return false;
    return seesEveryJob(viewer.role, kind, viewer.toggles ?? null);
  }
  function canChangeJobManagers(viewer, kind) {
    return canCreateJob(viewer, kind);
  }
  function canEditJob(viewer, job, kind, managers) {
    if (!viewer || !viewer.role || viewer.role.isOperativeMode) return false;
    if (canChangeJobManagers(viewer, kind)) return true;
    if (!viewer.role.isManager || !job) return false;
    return isJobManager(viewer, job, managers);
  }
  function jobWriteWithoutManagerList(fields) {
    const out = {};
    for (const [key3, value] of Object.entries(fields || {})) {
      if (JOB_MANAGER_LIST_FIELDS.includes(key3)) continue;
      out[key3] = value;
    }
    return out;
  }
  var FIRESTORE_IN_QUERY_LIMIT = 30;
  var JOBS_PER_BOOKING_QUERY = 1;
  var OWN_BOOKING_IDS_PER_QUERY = 4;
  var JOB_QUERY_COLLECTIONS = ["projects", "smallWorks"];
  function viewerUid(viewer) {
    const uid = typeof viewer.uid === "string" ? viewer.uid.trim() : "";
    if (uid) return uid;
    const first = (viewer.ids || []).find((id2) => typeof id2 === "string" && id2.trim());
    return first ? first.trim() : "";
  }
  function jobIdQueryValues(ids) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const raw of ids || []) {
      const id2 = typeof raw === "string" ? raw.trim() : "";
      if (!id2) continue;
      const spellings = [id2];
      if (id2 === id2.toLowerCase()) spellings.push(id2.toUpperCase());
      if (id2 === id2.toUpperCase()) spellings.push(id2.toLowerCase());
      for (const value of spellings) {
        if (seen.has(value)) continue;
        seen.add(value);
        out.push(value);
      }
    }
    return out;
  }
  function chunk(values, size) {
    const out = [];
    for (let index = 0; index < values.length; index += size) out.push(values.slice(index, index + size));
    return out;
  }
  function jobQueryPlan(viewer, options) {
    const enforced = options?.enforced ?? ENFORCED_READS_ACTIVE;
    const none = { seesEvery: { projects: false, smallWorks: false }, queries: [] };
    if (!viewer || !viewer.role) return none;
    const uid = viewerUid(viewer);
    if (!uid) return none;
    const role = viewer.role;
    const staff = !role.isOperativeMode && (role.isSuperAdmin || role.isAdmin || role.isManager);
    if (!staff) {
      const ids = jobIdQueryValues(options?.documentIds ?? []);
      if (ids.length === 0) return none;
      return { seesEvery: none.seesEvery, queries: JOB_QUERY_COLLECTIONS.map((collection) => ({ collection, kind: "documents", ids })) };
    }
    const seesEvery = {
      projects: seesEveryJob(role, "projects", viewer.toggles ?? null),
      smallWorks: seesEveryJob(role, "smallWorks", viewer.toggles ?? null)
    };
    const queries = JOB_QUERY_COLLECTIONS.map(
      (collection) => seesEvery[collection] || !enforced ? { collection, kind: "all" } : { collection, kind: "managed", field: "managerUserIds", op: "array-contains", value: uid }
    );
    return { seesEvery, queries };
  }
  var ENFORCED_READS_ACTIVE = false;
  function readsEveryBooking(viewer, options) {
    const enforced = options?.enforced ?? ENFORCED_READS_ACTIVE;
    if (!viewer || !viewer.role) return false;
    const role = viewer.role;
    if (role.isOperativeMode) return false;
    if (role.isSuperAdmin || role.isAdmin) return true;
    if (!role.isManager) return false;
    return !enforced;
  }
  function bookingQueryPlan(viewer, visibleJobIds, options) {
    if (!viewer || !viewer.role) return { readsEveryBooking: false, queries: [] };
    const uid = viewerUid(viewer);
    if (!uid) return { readsEveryBooking: false, queries: [] };
    if (readsEveryBooking(viewer, { enforced: options?.enforced })) {
      return {
        readsEveryBooking: true,
        queries: BOOKING_PERMISSION_COLLECTIONS.map((collection) => ({ collection, kind: "all" }))
      };
    }
    const role = viewer.role;
    const isManager = !role.isOperativeMode && role.isManager;
    const queries = [];
    if (isManager) {
      for (const kind of JOB_QUERY_COLLECTIONS) {
        if (!seesEveryJob(role, kind, viewer.toggles ?? null)) continue;
        for (const collection of BOOKING_PERMISSION_COLLECTIONS) {
          queries.push({ collection, kind: "jobCollection", field: "jobCollection", op: "==", value: kind });
        }
      }
      const seen = /* @__PURE__ */ new Set();
      for (const raw of visibleJobIds || []) {
        const jobId = typeof raw === "string" ? raw.trim() : "";
        const key3 = jobId.toLowerCase();
        if (!jobId || seen.has(key3)) continue;
        seen.add(key3);
        const values = jobIdQueryValues([jobId]);
        queries.push({ collection: "bookings", kind: "job", jobId, field: "projectId", op: "in", values });
        queries.push({ collection: "subcontractorBookings", kind: "job", jobId, field: "projectId", op: "in", values });
        queries.push({ collection: "managerSiteBookings", kind: "job", jobId, field: "locationId", op: "in", values });
      }
    }
    const own = [];
    const ownSeen = /* @__PURE__ */ new Set();
    for (const raw of [uid, ...options?.ownBookingIds ?? viewer.ids ?? []]) {
      const id2 = typeof raw === "string" ? raw.trim() : "";
      if (!id2 || ownSeen.has(id2)) continue;
      ownSeen.add(id2);
      own.push(id2);
    }
    for (const values of chunk(own, OWN_BOOKING_IDS_PER_QUERY)) {
      queries.push({ collection: "bookings", kind: "own", field: "operativeId", op: "in", values });
    }
    if (isManager) queries.push({ collection: "managerSiteBookings", kind: "own", field: "userId", op: "==", values: [uid] });
    return { readsEveryBooking: false, queries };
  }
  var WARNING_SCOPE_ALL = { kind: "all" };
  function warningScopeFor(input) {
    const viewer = input?.viewer;
    if (!viewer || !viewer.role) return { kind: "jobs", jobIds: [], personIds: [], personEmails: [], unbookedLabour: false };
    if (seesEveryJob(viewer.role, null, viewer.toggles ?? null)) return WARNING_SCOPE_ALL;
    const jobKeys = new Set((input.visibleJobIds || []).map(idKey).filter(Boolean));
    const booked = /* @__PURE__ */ new Set();
    for (const booking of input.bookings || []) {
      if (jobKeys.has(idKey(booking?.projectId))) booked.add(idKey(booking?.operativeId));
    }
    for (const booking of input.managerBookings || []) {
      const job = bookingJobId({ collection: "managerSiteBookings", ...booking });
      if (job && jobKeys.has(idKey(job))) booked.add(idKey(booking?.userId));
    }
    booked.delete("");
    const rows3 = [
      ...(input.people || []).map((row2) => ({ ids: [row2.id, ...row2.formerIds || []], email: row2.email })),
      ...(input.operatives || []).map((row2) => ({ ids: [row2.id], email: row2.email }))
    ];
    const emails = /* @__PURE__ */ new Set();
    for (const row2 of rows3) {
      const email = String(row2.email ?? "").trim().toLowerCase();
      if (email && row2.ids.some((id2) => booked.has(idKey(id2)))) emails.add(email);
    }
    const ids = new Set(booked);
    for (const row2 of rows3) {
      const email = String(row2.email ?? "").trim().toLowerCase();
      if (email && emails.has(email)) {
        for (const id2 of row2.ids) if (idKey(id2)) ids.add(idKey(id2));
      }
    }
    return {
      kind: "jobs",
      jobIds: [...jobKeys],
      personIds: [...ids],
      personEmails: [...emails],
      unbookedLabour: readsEveryBooking(viewer, { enforced: input.enforced })
    };
  }
  function isJobInWarningScope(scope, jobId) {
    if (!scope || scope.kind === "all") return true;
    const key3 = idKey(jobId);
    return key3 !== "" && scope.jobIds.includes(key3);
  }
  function isPersonInWarningScope(scope, ids, email) {
    if (!scope || scope.kind === "all") return true;
    if (ids.some((id2) => idKey(id2) !== "" && scope.personIds.includes(idKey(id2)))) return true;
    const key3 = String(email ?? "").trim().toLowerCase();
    return key3 !== "" && scope.personEmails.includes(key3);
  }
  function jobTypeIsSmallWorks(jobType) {
    return String(jobType ?? "").trim().toLowerCase().replace(/[\s_-]/g, "") === "smallworks";
  }
  function jobKind(doc, collection) {
    if (collection === "projects" || collection === "smallWorks") return collection;
    return jobTypeIsSmallWorks(doc?.jobType) ? "smallWorks" : "projects";
  }
  function jobIdsInBothCollections(projectIds, smallWorkIds) {
    const small = new Set((smallWorkIds || []).map((id2) => String(id2 ?? "").trim().toLowerCase()).filter(Boolean));
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const raw of projectIds || []) {
      const id2 = String(raw ?? "").trim();
      const key3 = id2.toLowerCase();
      if (!id2 || seen.has(key3) || !small.has(key3)) continue;
      seen.add(key3);
      out.push(id2);
    }
    return out;
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
    const rows3 = [];
    for (let index = 0; index < count; index += 1) {
      const paymentDay = paymentDays[index] || 0;
      const fallback = defaultTimesheetSubmissionFromPaymentDay(paymentDay);
      const fromList = rawList[index] != null ? parseTimesheetSubmissionEntry(rawList[index], fallback) : null;
      const fromRange = rangeRows[index] != null ? parseTimesheetSubmissionEntry(rangeRows[index], fallback) : null;
      rows3.push(fromList ?? fromRange ?? fallback);
    }
    return rows3;
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
      const key3 = name.toLowerCase();
      if (seen.has(key3)) continue;
      seen.add(key3);
      out.push(name);
    }
    return out;
  }
  function enabledFlag(map, name) {
    if (!map) return true;
    if (typeof map[name] === "boolean") return map[name];
    const lower = name.toLowerCase();
    for (const [key3, value] of Object.entries(map)) {
      if (key3.trim().toLowerCase() === lower && typeof value === "boolean") return value;
    }
    return true;
  }
  function enabledScheduleLocations(options) {
    const opts = options ?? {};
    const rows3 = [];
    if (opts.showOffice !== false) rows3.push({ id: "office", title: "Office", locationType: "office" });
    if (opts.showWorkingFromHome !== false) {
      rows3.push({ id: "wfh", title: "Working from home", locationType: "working_from_home" });
    }
    if (opts.showSiteSurvey !== false) rows3.push({ id: "survey", title: "Site survey", locationType: "site_survey" });
    for (const name of cleanItems(opts.customItems)) {
      if (!enabledFlag(opts.customItemEnabled, name)) continue;
      rows3.push({ id: `custom:${name}`, title: name, locationType: "custom", customLocationName: name });
    }
    return rows3;
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
  function zoneOf2(timeZone) {
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
      const row2 = value;
      if (typeof row2.toDate === "function") {
        try {
          const date = row2.toDate();
          if (date instanceof Date && !Number.isNaN(date.getTime())) return date.getTime();
        } catch {
        }
      }
      const seconds = Number(row2.seconds ?? row2._seconds);
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
    const stamp = unixStartOfDayInZone(dateFromDayKeyInZone(startDayKey, zoneOf2(timeZone)), zoneOf2(timeZone));
    return `${TIMESHEET_DOCUMENT_PREFIX}${uid}_${stamp}`;
  }
  function timesheetPeriodKey(period) {
    return `${period.startDayKey}|${period.endDayKey}`;
  }
  function timesheetPeriodFromInvoicing(input) {
    const timeZone = zoneOf2(input.timeZone);
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
    const row2 = data && typeof data === "object" ? data : {};
    const managerSignedAtMs = realSignatureMs(row2.managerSignedAt) ?? realSignatureMs(row2.approvedAt);
    return {
      operativeSignedAtMs: realSignatureMs(row2.operativeSignedAt),
      operativeSignedByName: trimmed2(row2.operativeSignedByName),
      operativeSignatureImageBase64: trimmed2(row2.operativeSignatureImageBase64),
      managerSignedAtMs,
      managerSignedByName: trimmed2(row2.managerSignedByName) || trimmed2(row2.approvedByName),
      managerSignedByUserId: trimmed2(row2.managerSignedByUserId),
      managerSignatureImageBase64: trimmed2(row2.managerSignatureImageBase64),
      exportedAtMs: resolveTimesheetExportedAtMs(row2)
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
  function pickTimesheetRowForPeriod(rows3, period) {
    if (rows3.length === 0) return -1;
    const exact = [];
    const startOnly = [];
    for (let index = 0; index < rows3.length; index += 1) {
      const row2 = rows3[index];
      if (trimmed2(row2.startDayKey) !== period.startDayKey) continue;
      const end = trimmed2(row2.endDayKey);
      if (isDayKey(end)) {
        if (end === period.endDayKey) exact.push(index);
        continue;
      }
      startOnly.push(index);
    }
    const withActivity = (indexes) => indexes.find((index) => rows3[index]?.hasActivity === true);
    return withActivity(exact) ?? exact[0] ?? withActivity(startOnly) ?? startOnly[0] ?? -1;
  }
  function paymentRunWindowFingerprint(window) {
    if (String(window.paymentRunMode || "") === "recurring_timeframe") {
      return `recurring:${trimmed2(window.recurringRunStartDay).toLowerCase() || "monday"}:${trimmed2(window.recurringRunEndDay).toLowerCase() || "sunday"}`;
    }
    const ranges = (window.ranges ?? []).map((row2) => normalizePaymentRunRange(row2)).filter((row2) => row2 != null).map((row2) => `${row2.startDay}-${row2.endDay}`);
    return `dates:${ranges.join("|")}`;
  }
  function paymentRunHistoryAfterChange(input) {
    const existing = [...input.existingHistory ?? []];
    if (paymentRunWindowFingerprint(input.previous) === paymentRunWindowFingerprint(input.next)) {
      return existing;
    }
    const snapshot = {
      paymentRunMode: input.previous.paymentRunMode === "recurring_timeframe" ? "recurring_timeframe" : "date_ranges",
      ranges: (input.previous.ranges ?? []).map((row2) => normalizePaymentRunRange(row2)).filter((row2) => row2 != null),
      recurringRunStartDay: trimmed2(input.previous.recurringRunStartDay) || "monday",
      recurringRunEndDay: trimmed2(input.previous.recurringRunEndDay) || "sunday",
      recordedAtDayKey: trimmed2(input.recordedAtDayKey)
    };
    const fingerprint = paymentRunWindowFingerprint(snapshot);
    const rest = existing.filter((row2) => paymentRunWindowFingerprint(row2) !== fingerprint);
    return [snapshot, ...rest].slice(0, 24);
  }
  function timesheetPaymentRunPeriodsFromWindow(input) {
    const timeZone = zoneOf2(input.timeZone);
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
      const key3 = timesheetPeriodKey(period);
      if (seen.has(key3)) return;
      seen.add(key3);
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
    const rows3 = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const data = entry;
      const mode = String(data.paymentRunMode || "") === "recurring_timeframe" ? "recurring_timeframe" : "date_ranges";
      const rangeRows = Array.isArray(data.paymentRunDateRanges) ? data.paymentRunDateRanges : Array.isArray(data.ranges) ? data.ranges : [];
      const ranges = rangeRows.map((row2) => normalizePaymentRunRange(row2 || {})).filter((row2) => row2 != null);
      const recordedAtDayKey = trimmed2(data.recordedAtDayKey);
      rows3.push({
        paymentRunMode: mode,
        ranges,
        recurringRunStartDay: trimmed2(data.recurringRunStartDay) || "monday",
        recurringRunEndDay: trimmed2(data.recurringRunEndDay) || "sunday",
        recordedAtDayKey: isDayKey(recordedAtDayKey) ? recordedAtDayKey : ""
      });
    }
    return rows3;
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
    return dayKeyInZone(new Date(ms), zoneOf2(timeZone));
  }

  // lib/canonical/organizationSettings.ts
  var SUGGESTED_MAX_CARRY_OVER_DAYS = 5;
  function parseMaxCarryOverDays(value) {
    if (value == null || value === "") return null;
    const n = typeof value === "string" ? Number(value.trim()) : Number(value);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.min(365, Math.round(n * 2) / 2);
  }
  var ORGANIZATION_DOCUMENT_FIELDS = [
    "name",
    "countryCode",
    "currency",
    "currencyCode",
    "bankHolidayRegionId",
    "documentAbbreviation",
    "officeAddressLine1",
    "officeAddressLine2",
    "officeCity",
    "officeCounty",
    "officePostcode",
    /** Legacy nested address. Read as a fallback; every company-details save removes it. */
    "officeAddress",
    "companyLogoURL",
    "defaultLatitude",
    "defaultLongitude",
    "creatorUserId",
    "members",
    "payrollTimePolicy",
    "payrollTimePolicyPrior",
    "payrollTimePolicyEffectiveFrom",
    "payrollTimePolicyScheduled",
    /** 1.19.0: append-only `{ effectiveFrom: 'YYYY-MM-DD', policy }[]`, the working hours in effect from each day. */
    "payrollTimePolicyHistory",
    /** 1.19.0: bumped by every working-hours save so a second admin's stale save is refused. */
    "payrollTimePolicyRevision",
    "annualLeaveDefaults",
    "warningDetection",
    "invoicing",
    "settings"
  ];
  var OPERATIONAL_COLLECTION_PATHS = {
    variations: "organizations/{orgId}/variations",
    variationTrackers: "organizations/{orgId}/variationTrackers",
    variationLog: "organizations/{orgId}/settings/variations_{parentId}",
    variationItem: "organizations/{orgId}/settings/variationItem_{id}",
    bookings: "organizations/{orgId}/bookings",
    holidayBookings: "organizations/{orgId}/holidayBookings",
    timesheets: "organizations/{orgId}/timesheets",
    dismissedWarnings: "organizations/{orgId}/dismissedWarnings",
    projects: "organizations/{orgId}/projects",
    smallWorks: "organizations/{orgId}/smallWorks",
    clients: "organizations/{orgId}/clients",
    tasks: "organizations/{orgId}/tasks",
    siteAudits: "organizations/{orgId}/siteAudits",
    materialCatalogue: "organizations/{orgId}/materialCatalogue",
    materials: "organizations/{orgId}/materials",
    materialSendRecords: "organizations/{orgId}/materialSendRecords",
    qualifications: "organizations/{orgId}/qualifications",
    healthSafetySettings: "organizations/{orgId}/settings/healthSafety_{projects|smallWorks}_{parentId}",
    healthSafetyEvidence: "organizations/{orgId}/healthSafety/{parentId}/variations/{file}"
  };
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
    sameAsSaturday: false,
    breakPaid: true
  };
  var DEFAULT_SATURDAY_PAYROLL = {
    allHoursAtMultiplierMode: false,
    allHoursMultiplier: 2,
    definedWindowStart: "07:30",
    definedWindowEnd: "13:00",
    countsAsStandardHours: 8,
    outsideWindowMultiplier: 2,
    sameAsSaturday: false,
    breakPaid: true
  };
  var DEFAULT_SUNDAY_PAYROLL = {
    allHoursAtMultiplierMode: true,
    allHoursMultiplier: 2,
    definedWindowStart: "07:30",
    definedWindowEnd: "16:00",
    countsAsStandardHours: 8,
    outsideWindowMultiplier: 2,
    sameAsSaturday: false,
    breakPaid: true
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
  var DEFAULT_ANNUAL_LEAVE = {
    daysPerYear: 25,
    startMonth: 1,
    endMonth: 12,
    carriesOver: false,
    maxCarryOverDays: null
  };
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
    for (const key3 of keys) {
      if (data[key3] != null && data[key3] !== "") return data[key3];
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
  var PAYROLL_POLICY_LIMITS = {
    paidHours: { min: 1, max: 12 },
    breakMinutes: { min: 0, max: 120 },
    multiplier: { min: 1, max: 3 }
  };
  function policyNumber(raw, fallback, limits, options = {}) {
    if (raw == null || typeof raw === "string" && raw.trim() === "" || typeof raw === "boolean") return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    if (options.zeroIsMissing && n <= 0) return fallback;
    if (options.allowZero && n === 0) return 0;
    return Math.min(Math.max(n, limits.min), limits.max);
  }
  function parseWeekend(data, dayDefault) {
    if (!data || typeof data !== "object") return { ...dayDefault };
    const fallback = WEEKEND_FIELD_FALLBACK;
    return {
      allHoursAtMultiplierMode: data.allHoursAtMultiplierMode === true,
      allHoursMultiplier: policyNumber(data.allHoursMultiplier, fallback.allHoursMultiplier, PAYROLL_POLICY_LIMITS.multiplier),
      definedWindowStart: String(
        firstPresent(data, ["customStandardStart", "definedWindowStart"], fallback.definedWindowStart ?? "07:30")
      ),
      definedWindowEnd: String(
        firstPresent(data, ["customStandardEnd", "definedWindowEnd"], fallback.definedWindowEnd ?? "16:00")
      ),
      countsAsStandardHours: policyNumber(
        firstPresent(data, ["countsAsHours", "countsAsStandardHours"], fallback.countsAsStandardHours ?? 8),
        fallback.countsAsStandardHours ?? 8,
        PAYROLL_POLICY_LIMITS.paidHours,
        { allowZero: true }
      ),
      outsideWindowMultiplier: policyNumber(
        firstPresent(
          data,
          ["outsideStandardWindowMultiplier", "outsideWindowMultiplier"],
          fallback.outsideWindowMultiplier ?? 1.5
        ),
        fallback.outsideWindowMultiplier ?? 1.5,
        PAYROLL_POLICY_LIMITS.multiplier
      ),
      sameAsSaturday: false,
      // 1.19.0: missing or anything but `false` = paid, so nothing changes for a company that never chose.
      breakPaid: data.breakPaid !== false,
      // 1.19.0: the day's own break; missing stays missing and reads as the weekday break.
      ...data.breakMinutes == null || typeof data.breakMinutes === "string" && data.breakMinutes.trim() === "" || !Number.isFinite(Number(data.breakMinutes)) ? {} : { breakMinutes: policyNumber(data.breakMinutes, 0, PAYROLL_POLICY_LIMITS.breakMinutes) },
      ...typeof data.breakWindowStart === "string" && data.breakWindowStart.trim() ? { breakWindowStart: data.breakWindowStart.trim() } : {},
      ...typeof data.breakWindowEnd === "string" && data.breakWindowEnd.trim() ? { breakWindowEnd: data.breakWindowEnd.trim() } : {}
    };
  }
  function weekendBreakFor(policy, weekend) {
    const own = Number(weekend.breakMinutes);
    return {
      paid: weekend.breakPaid !== false,
      minutes: weekend.breakMinutes != null && Number.isFinite(own) ? Math.max(0, own) : Math.max(0, Number(policy.unpaidBreakMinutes) || 0),
      start: weekend.breakWindowStart || policy.breakWindowStart,
      end: weekend.breakWindowEnd || policy.breakWindowEnd
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
      outsideStandardWindowMultiplier: weekend.outsideWindowMultiplier ?? 1.5,
      breakPaid: weekend.breakPaid !== false,
      // 1.19.0: written only when the day has its own break; missing reads as the weekday break.
      ...weekend.breakMinutes != null ? { breakMinutes: weekend.breakMinutes } : {},
      ...weekend.breakWindowStart ? { breakWindowStart: weekend.breakWindowStart } : {},
      ...weekend.breakWindowEnd ? { breakWindowEnd: weekend.breakWindowEnd } : {}
    };
  }
  function parsePayrollPolicy(data) {
    if (!data) {
      return { ...DEFAULT_PAYROLL_POLICY, saturday: { ...DEFAULT_SATURDAY_PAYROLL }, sunday: { ...DEFAULT_SUNDAY_PAYROLL } };
    }
    const parsed = {
      standardDayStart: String(data.standardDayStart ?? DEFAULT_PAYROLL_POLICY.standardDayStart),
      standardDayEnd: String(data.standardDayEnd ?? DEFAULT_PAYROLL_POLICY.standardDayEnd),
      // 1.12.0 §4.3: numbers are read into PAYROLL_POLICY_LIMITS (missing / blank / not a number → the default).
      unpaidBreakMinutes: policyNumber(
        data.unpaidBreakMinutes,
        DEFAULT_PAYROLL_POLICY.unpaidBreakMinutes,
        PAYROLL_POLICY_LIMITS.breakMinutes
      ),
      standardPaidHours: policyNumber(
        data.standardPaidHours,
        DEFAULT_PAYROLL_POLICY.standardPaidHours,
        PAYROLL_POLICY_LIMITS.paidHours,
        { zeroIsMissing: true }
      ),
      breakWindowStart: String(data.breakWindowStart ?? DEFAULT_PAYROLL_POLICY.breakWindowStart),
      breakWindowEnd: String(data.breakWindowEnd ?? DEFAULT_PAYROLL_POLICY.breakWindowEnd),
      weekdayOutsideStandardMultiplier: policyNumber(
        data.weekdayOutsideStandardMultiplier,
        DEFAULT_PAYROLL_POLICY.weekdayOutsideStandardMultiplier,
        PAYROLL_POLICY_LIMITS.multiplier
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
    if (data.paidHoursDerived !== true) return parsed;
    const derived = { ...parsed, paidHoursDerived: true };
    return { ...derived, standardPaidHours: weekdayPaidHours(derived) };
  }
  function derivedWeekdayPaidHours(policy) {
    const day = standardDayWindow(policy);
    const breakMinutes = policy.breakPaid === true ? 0 : Math.max(Number(policy.unpaidBreakMinutes) || 0, 0);
    return Math.max(0, day.end - day.start - breakMinutes) / 60;
  }
  function weekdayPaidHours(policy) {
    if (!policy) return DEFAULT_PAYROLL_POLICY.standardPaidHours;
    if (policy.paidHoursDerived !== true) return Number(policy.standardPaidHours);
    const { min, max } = PAYROLL_POLICY_LIMITS.paidHours;
    return Math.min(Math.max(derivedWeekdayPaidHours(policy), min), max);
  }
  function withDerivedWeekdayPaidHours(policy) {
    const marked = { ...policy, paidHoursDerived: true };
    return { ...marked, standardPaidHours: Math.round(derivedWeekdayPaidHours(marked) * 1e4) / 1e4 };
  }
  function hoursMinutesText(totalMinutes) {
    const minutes = Math.max(0, Math.round(totalMinutes));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}m`;
  }
  function weekdayPaidDayPreview(policy) {
    const day = standardDayWindow(policy);
    const dayMinutes = day.end - day.start;
    const breakMinutes = Math.max(Number(policy.unpaidBreakMinutes) || 0, 0);
    const breakPaid = policy.breakPaid === true;
    const paidHours = derivedWeekdayPaidHours(policy);
    const range = `${formatClockMinutes(day.start)}\u2013${formatClockMinutes(day.end)}`;
    const dayText = hoursMinutesText(dayMinutes);
    const line = breakMinutes <= 0 ? `${range} = ${dayText}` : breakPaid ? `${range} = ${dayText}, ${breakMinutes} min break paid = ${dayText}` : `${range} = ${dayText} \u2212 ${breakMinutes} min unpaid break = ${hoursMinutesText(paidHours * 60)}`;
    return { start: formatClockMinutes(day.start), end: formatClockMinutes(day.end), dayMinutes, breakMinutes, breakPaid, paidHours, line };
  }
  function payrollPolicyToFirestore(policy) {
    return {
      standardDayStart: policy.standardDayStart,
      standardDayEnd: policy.standardDayEnd,
      unpaidBreakMinutes: policy.unpaidBreakMinutes,
      // 1.20.0: a derived policy writes its derived day, so older builds that read `standardPaidHours` agree.
      standardPaidHours: policy.paidHoursDerived === true ? Math.round(derivedWeekdayPaidHours(policy) * 1e4) / 1e4 : policy.standardPaidHours,
      ...policy.paidHoursDerived === true ? { paidHoursDerived: true } : {},
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
  function parseAnnualLeaveDefaults(data) {
    if (!data) return { ...DEFAULT_ANNUAL_LEAVE };
    return {
      daysPerYear: Number(data.daysPerYear ?? DEFAULT_ANNUAL_LEAVE.daysPerYear),
      startMonth: Number(data.startMonth ?? DEFAULT_ANNUAL_LEAVE.startMonth),
      endMonth: Number(data.endMonth ?? DEFAULT_ANNUAL_LEAVE.endMonth),
      carriesOver: Boolean(data.carriesOver),
      maxCarryOverDays: parseMaxCarryOverDays(data.maxCarryOverDays)
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
  function excludedUnbookedUserIds(record9) {
    if (Array.isArray(record9.excludedUserIdsFromUnbookedWarnings)) {
      return stringIdList(record9.excludedUserIdsFromUnbookedWarnings);
    }
    for (const key3 of ["excludedUserIds", "excludedUsers", "excludedUserIdsFromWarnings", "unbookedWarningExcludedUserIds"]) {
      if (Array.isArray(record9[key3])) return stringIdList(record9[key3]);
    }
    return [];
  }
  function parseWarningDetection(data) {
    const record9 = asSettingsRecord(data);
    if (!record9) return { ...DEFAULT_WARNING_DETECTION, excludedUserIdsFromUnbookedWarnings: [] };
    const daysRaw = record9.clashLookaheadDays ?? record9.lookaheadDays ?? record9.lookAheadDays ?? record9.numberOfDays ?? record9.daysAhead;
    const days = daysRaw === void 0 || daysRaw === null ? DEFAULT_WARNING_DETECTION.clashLookaheadDays : daysRaw;
    const clashLookaheadMode = parseClashLookaheadMode(
      record9.clashLookaheadMode ?? record9.lookAheadMode ?? record9.lookaheadMode
    );
    const fallback = lookaheadDaysFallback(daysRaw);
    const parsed = {
      detectClashes: record9.detectClashes !== false,
      clashLookaheadMode,
      clashLookaheadDays: fallback ? DEFAULT_WARNING_DETECTION.clashLookaheadDays : clampClashLookaheadDays(days),
      includeWeekendsForUnbookedLabour: Boolean(record9.includeWeekendsForUnbookedLabour),
      excludedUserIdsFromUnbookedWarnings: excludedUnbookedUserIds(record9),
      weekendCoverage: parseWeekendCoverage(record9.weekendCoverage, Boolean(record9.includeWeekendsForUnbookedLabour))
    };
    if (fallback && clashLookaheadMode === "numberOfDays") parsed.clashLookaheadDaysFallback = fallback;
    return parsed;
  }
  var COVERAGE_CLOCK_RE = /^\d{1,2}:\d{2}$/;
  function clockMinutesOf(value) {
    const text23 = coverageClock(value);
    if (!text23) return null;
    const [h, m] = text23.split(":").map(Number);
    return h * 60 + m;
  }
  function coverageClock(value) {
    const text23 = typeof value === "string" ? value.trim() : "";
    if (!COVERAGE_CLOCK_RE.test(text23)) return null;
    const [h, m] = text23.split(":").map(Number);
    return h >= 0 && h < 24 && m >= 0 && m < 60 ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` : null;
  }
  function parseWeekendCoverage(value, includeWeekends) {
    const raw = asSettingsRecord(value) ?? {};
    const day = (entry) => {
      const rec = asSettingsRecord(entry) ?? {};
      let start = coverageClock(rec.start);
      let end = coverageClock(rec.end);
      if (start && end && clockMinutesOf(end) <= clockMinutesOf(start)) {
        start = null;
        end = null;
      }
      return { enabled: typeof rec.enabled === "boolean" ? rec.enabled : includeWeekends, start: start && end ? start : null, end: start && end ? end : null };
    };
    return { saturday: day(raw.saturday), sunday: day(raw.sunday) };
  }
  function resolveWeekendCoverageDay(coverage, includeWeekends, policy, weekday2) {
    const saved = coverage?.[weekday2];
    const enabled = includeWeekends && (saved ? saved.enabled !== false : true);
    const fallbackDay = { start: policy?.standardDayStart || "07:30", end: policy?.standardDayEnd || "16:00" };
    let window = fallbackDay;
    if (policy) {
      const rule = weekday2 === "sunday" && policy.sunday?.sameAsSaturday ? policy.saturday : policy[weekday2];
      const ws = clockMinutesOf(rule?.definedWindowStart);
      const we = clockMinutesOf(rule?.definedWindowEnd);
      if (rule && !rule.allHoursAtMultiplierMode && ws != null && we != null && we > ws) {
        window = { start: coverageClock(rule.definedWindowStart), end: coverageClock(rule.definedWindowEnd) };
      }
    }
    const ss = clockMinutesOf(saved?.start);
    const se = clockMinutesOf(saved?.end);
    if (ss != null && se != null && se > ss) window = { start: saved.start, end: saved.end };
    return { enabled, ...window };
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
      excludedUserIdsFromUnbookedWarnings: settings.excludedUserIdsFromUnbookedWarnings,
      // 1.19.0: the whole map, one field (`warningDetection.weekendCoverage`) in the partial update.
      ...settings.weekendCoverage ? {
        weekendCoverage: {
          saturday: { ...settings.weekendCoverage.saturday },
          sunday: { ...settings.weekendCoverage.sunday }
        }
      } : {}
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
        const row2 = paymentRunRangeToFirestore(range);
        const timesheet = timesheetSubmission[index];
        return timesheet ? { ...row2, ...timesheet } : row2;
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

  // lib/canonical/payrollHours.ts
  var HALF_WINDOW_TOLERANCE = 20;
  function weekendFor(isoWeekday, policy) {
    if (isoWeekday === 6) return policy.saturday;
    if (isoWeekday === 7) return policy.sunday?.sameAsSaturday ? policy.saturday : policy.sunday;
    return null;
  }
  function standardPaid(policy) {
    return Math.max(Number(weekdayPaidHours(policy)) || 0, 0);
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
    for (const row2 of result2.segments) {
      if (row2.kind === "standardWindow") standard += row2.workedHours;
      else outside += row2.workedHours;
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
  function segment(kind, baseHours, multiplier, start, end, workedHours = baseHours, unpaidBreakHours = 0) {
    const clock = (value) => value == null ? void 0 : typeof value === "number" ? formatClockMinutes(value > 24 * 60 ? value - 24 * 60 : Math.min(value, 24 * 60 - 1)) : value;
    const row2 = { kind, clockStart: clock(start), clockEnd: clock(end), baseHours, multiplier, paidHours: baseHours * multiplier, workedHours };
    if (unpaidBreakHours > 0) row2.unpaidBreakHours = unpaidBreakHours;
    return row2;
  }
  function result(segments, outsideMultiplier) {
    let total = 0;
    let standard = 0;
    let outside = 0;
    let worked = 0;
    let unpaidBreak = 0;
    for (const row2 of segments) {
      total += row2.paidHours;
      worked += row2.workedHours;
      unpaidBreak += row2.unpaidBreakHours ?? 0;
      if (row2.kind === "standardWindow") standard += row2.baseHours;
      else outside += row2.baseHours;
    }
    return {
      totalPaidHours: total,
      standardHours: standard,
      outsideHours: outside,
      outsideMultiplier,
      workedHours: worked,
      unpaidBreakHours: unpaidBreak,
      segments
    };
  }
  function interval(booking, policy) {
    return slotInterval(
      { timeSlot: booking.timeSlot ?? void 0, workStartTime: booking.workStartTime ?? void 0, workEndTime: booking.workEndTime ?? void 0 },
      dayInput(policy)
    );
  }
  function isNamedHalf(booking) {
    const kind = namedSlotKind(booking.timeSlot);
    return kind === "AM" || kind === "PM";
  }
  function isHalfDayPaid(booking, policy, allHoursDay, weekdayDay = false) {
    if (isNamedHalf(booking)) return true;
    if (namedSlotKind(booking.timeSlot) !== "CUSTOM" || allHoursDay) return false;
    if (weekdayDay && policy.paidHoursDerived === true) return false;
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
    const overlap = Math.min(span.end, end) - Math.max(span.start, start);
    if (!(overlap > 0)) return 0;
    const unpaid = Math.max(Number(policy.unpaidBreakMinutes) || 0, 0);
    return Math.min(overlap, unpaid);
  }
  function dayBreakOf(start, end, minutes) {
    const s = parseClockMinutes(start);
    const e = parseClockMinutes(end);
    if (s == null || e == null || e <= s) return null;
    return { start: s, end: e, minutes: Math.max(Number(minutes) || 0, 0) };
  }
  function weekendDayBreak(policy, weekend) {
    const own = weekendBreakFor(policy, weekend);
    return dayBreakOf(own.start, own.end, own.minutes);
  }
  function breakOverlapMinutes(dayBreak, part) {
    if (!dayBreak) return 0;
    return Math.max(0, Math.min(part.end, dayBreak.end) - Math.max(part.start, dayBreak.start));
  }
  function dayBreakDeductionMinutes(dayBreak, span) {
    if (!dayBreak) return 0;
    return Math.min(breakOverlapMinutes(dayBreak, span), dayBreak.minutes);
  }
  function weekendBreakUnpaid(policy, weekend) {
    const own = weekendBreakFor(policy, weekend);
    return !own.paid && own.minutes > 0;
  }
  function unpaidBreakAppliesOnDay(policy, dayKey, timeZone) {
    if (!policy || !(Number(policy.unpaidBreakMinutes) > 0)) return false;
    const zone3 = zoneOrLondon(timeZone);
    const iso = isoWeekdayInZone(dateFromDayKeyInZone(dayKey, zone3), zone3);
    const weekend = weekendFor(iso, policy);
    if (weekend) return weekendBreakUnpaid(policy, weekend);
    return policy.breakPaid !== true;
  }
  function payrollBreakOnDay(policy, dayKey, timeZone) {
    if (!policy) return null;
    const zone3 = zoneOrLondon(timeZone);
    const iso = isoWeekdayInZone(dateFromDayKeyInZone(dayKey, zone3), zone3);
    const weekend = weekendFor(iso, policy);
    if (weekend) {
      const own = weekendBreakFor(policy, weekend);
      const window2 = dayBreakOf(own.start, own.end, own.minutes);
      return window2 ? { ...window2, paid: own.paid } : null;
    }
    const window = dayBreakOf(policy.breakWindowStart, policy.breakWindowEnd, policy.unpaidBreakMinutes);
    return window ? { ...window, paid: policy.breakPaid === true } : null;
  }
  function payrollDayWindows(policy, dayKey, timeZone) {
    if (!policy) return { paidWindow: null, unpaidBreak: null, allHoursMultiplier: null };
    const zone3 = zoneOrLondon(timeZone);
    const iso = isoWeekdayInZone(dateFromDayKeyInZone(dayKey, zone3), zone3);
    const weekend = weekendFor(iso, policy);
    const dayBreak = payrollBreakOnDay(policy, dayKey, zone3);
    const unpaidBreak = unpaidBreakAppliesOnDay(policy, dayKey, zone3) && dayBreak ? { start: dayBreak.start, end: dayBreak.end } : null;
    if (weekend) {
      if (weekend.allHoursAtMultiplierMode) return { paidWindow: null, unpaidBreak, allHoursMultiplier: weekend.allHoursMultiplier };
      const ws = parseClockMinutes(weekend.definedWindowStart ?? policy.standardDayStart);
      const we = parseClockMinutes(weekend.definedWindowEnd ?? "13:00");
      return { paidWindow: ws != null && we != null && we > ws ? { start: ws, end: we } : null, unpaidBreak, allHoursMultiplier: null };
    }
    const ds = parseClockMinutes(policy.standardDayStart);
    const de = parseClockMinutes(policy.standardDayEnd);
    return { paidWindow: ds != null && de != null && de > ds ? { start: ds, end: de } : null, unpaidBreak, allHoursMultiplier: null };
  }
  function nothingPaid(span, multiplier) {
    return result([segment("standardWindow", 0, 1, span.start, span.end, 0)], multiplier);
  }
  function outsideIntervals(span, windowStart, windowEnd) {
    const parts = [];
    if (span.start < windowStart) parts.push({ start: span.start, end: Math.min(span.end, windowStart) });
    if (span.end > windowEnd) parts.push({ start: Math.max(span.start, windowEnd), end: span.end });
    return parts.filter((part) => part.end > part.start);
  }
  function outsideSegments(span, windowStart, windowEnd, multiplier) {
    const rows3 = [];
    if (span.start < windowStart) {
      const end = Math.min(span.end, windowStart);
      const hours = (end - span.start) / 60;
      if (hours > 1e-3) rows3.push(segment("outsideWindow", hours, multiplier, span.start, end));
    }
    if (span.end > windowEnd) {
      const start = Math.max(span.start, windowEnd);
      const hours = (span.end - start) / 60;
      if (hours > 1e-3) rows3.push(segment("outsideWindow", hours, multiplier, start, span.end));
    }
    return rows3;
  }
  function weekday(booking, policy, multiplier) {
    if (isHalfDayPaid(booking, policy, false, true)) return halfDayPaid(booking, policy, null, multiplier);
    const span = interval(booking, policy);
    if (!span) return legacySlot(booking, policy, multiplier);
    const ds = parseClockMinutes(policy.standardDayStart) ?? 0;
    const de = parseClockMinutes(policy.standardDayEnd) ?? 0;
    if (!(de > ds)) {
      const wall = wallHours(booking, policy);
      return result([segment("allHoursMultiplier", wall, multiplier, booking.workStartTime ?? void 0, booking.workEndTime ?? void 0)], multiplier);
    }
    const rows3 = [];
    const insideStart = Math.max(span.start, ds);
    const insideEnd = Math.min(span.end, de);
    if (insideEnd > insideStart) {
      let hours = (insideEnd - insideStart) / 60;
      let deducted = 0;
      if (!isNamedHalf(booking) && policy.breakPaid !== true && booking.isBreakRemoved !== true) {
        deducted = Math.min(hours, breakDeductionMinutes(policy, span) / 60);
        hours = Math.max(0, hours - deducted);
      }
      if (hours > 1e-3) rows3.push(segment("standardWindow", hours, 1, insideStart, insideEnd, hours, deducted));
    }
    rows3.push(...outsideSegments(span, ds, de, multiplier));
    if (rows3.length === 0) return nothingPaid(span, multiplier);
    return result(rows3, multiplier);
  }
  function weekendFullDayOnly(booking) {
    if (namedSlotKind(booking.timeSlot) !== "FULL_DAY") return false;
    return parseClockMinutes(booking.workStartTime ?? void 0) == null || parseClockMinutes(booking.workEndTime ?? void 0) == null;
  }
  function weekendFullDayWindow(policy, weekend) {
    if (weekend.allHoursAtMultiplierMode) {
      const start2 = parseClockMinutes(policy.standardDayStart);
      const end2 = parseClockMinutes(policy.standardDayEnd);
      return start2 != null && end2 != null && end2 > start2 ? { start: start2, end: end2 } : null;
    }
    const start = parseClockMinutes(weekend.definedWindowStart ?? policy.standardDayStart);
    const end = parseClockMinutes(weekend.definedWindowEnd ?? "13:00");
    return start != null && end != null && end > start ? { start, end } : null;
  }
  function weekendRuleForIsoWeekday(isoWeekday, policy) {
    return weekendFor(isoWeekday, policy);
  }
  function weekendDay(booking, policy, weekend, multiplier) {
    const fullDayWindow = weekendFullDayOnly(booking) ? weekendFullDayWindow(policy, weekend) : null;
    const span = fullDayWindow ?? interval(booking, policy);
    if (!span) return legacySlot(booking, policy, multiplier);
    const dayBreak = weekendDayBreak(policy, weekend);
    const deductBreak = weekendBreakUnpaid(policy, weekend) && booking.isBreakRemoved !== true && !isNamedHalf(booking);
    const totalBreak = deductBreak ? dayBreakDeductionMinutes(dayBreak, span) : 0;
    if (weekend.allHoursAtMultiplierMode) {
      if (isNamedHalf(booking)) return halfDayPaid(booking, policy, weekend, multiplier);
      const clockHours = (span.end - span.start) / 60;
      const deducted = Math.min(clockHours, totalBreak / 60);
      const base = Math.max(0, clockHours - deducted);
      return result([segment("allHoursMultiplier", base, multiplier, span.start, span.end, base, deducted)], multiplier);
    }
    const ws = parseClockMinutes(weekend.definedWindowStart ?? policy.standardDayStart) ?? 0;
    const we = parseClockMinutes(weekend.definedWindowEnd ?? "13:00") ?? 0;
    if (!(we > ws)) {
      const wall = wallHours(booking, policy);
      return result([segment("allHoursMultiplier", wall, multiplier, booking.workStartTime ?? void 0, booking.workEndTime ?? void 0)], multiplier);
    }
    if (isHalfDayPaid(booking, policy, false)) return halfDayPaid(booking, policy, weekend, multiplier);
    const credit = countsAs(weekend, policy);
    const rows3 = [];
    const overlapStart = Math.max(span.start, ws);
    const overlapEnd = Math.min(span.end, we);
    let breakLeft = totalBreak;
    if (overlapEnd > overlapStart) {
      const credited = overlapStart <= ws && overlapEnd >= we ? credit : credit * ((overlapEnd - overlapStart) / (we - ws));
      const inside = Math.min(breakLeft, breakOverlapMinutes(dayBreak, { start: overlapStart, end: overlapEnd }));
      breakLeft -= inside;
      const insideHours = inside / 60;
      rows3.push(
        segment(
          "standardWindow",
          Math.max(0, credited - insideHours),
          1,
          overlapStart,
          overlapEnd,
          Math.max(0, (overlapEnd - overlapStart) / 60 - insideHours),
          insideHours
        )
      );
    }
    for (const part of outsideIntervals(span, ws, we)) {
      const taken = Math.min(breakLeft, breakOverlapMinutes(dayBreak, part));
      breakLeft -= taken;
      const hours = (part.end - part.start - taken) / 60;
      if ((part.end - part.start) / 60 > 1e-3) {
        rows3.push(segment("outsideWindow", Math.max(0, hours), multiplier, part.start, part.end, Math.max(0, hours), taken / 60));
      }
    }
    if (rows3.length === 0) return nothingPaid(span, multiplier);
    return result(rows3, multiplier);
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

  // lib/canonical/payrollPolicySchedule.ts
  var DEFAULT_ZONE = "Europe/London";
  var DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var PAYROLL_POLICY_HISTORY_START = "1970-01-01";
  var PAYROLL_POLICY_STALE_SAVE_MESSAGE = "Someone else changed the working hours while you were editing. Your change was not saved \u2014 check the latest working hours and try again.";
  function zone(timeZone) {
    return String(timeZone || "").trim() || DEFAULT_ZONE;
  }
  function record(value) {
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
    const raw = record(value);
    const policy = record(raw?.policy);
    if (!raw || !policy) return null;
    const effectiveFrom = payrollDayKeyFromValue(raw.effectiveFrom, timeZone);
    if (!effectiveFrom) return null;
    return { policy: parsePayrollPolicy(policy), effectiveFrom };
  }
  function parsePayrollTimePolicyHistory(value, timeZone) {
    if (!Array.isArray(value)) return [];
    const entries = [];
    value.forEach((raw, index) => {
      const row2 = record(raw);
      const policy = record(row2?.policy);
      const effectiveFrom = row2 ? payrollDayKeyFromValue(row2.effectiveFrom, timeZone) : null;
      if (!policy || !effectiveFrom) return;
      entries.push({ effectiveFrom, policy: parsePayrollPolicy(policy), index });
    });
    entries.sort((a, b) => a.effectiveFrom < b.effectiveFrom ? -1 : a.effectiveFrom > b.effectiveFrom ? 1 : a.index - b.index);
    return entries.map(({ effectiveFrom, policy }) => ({ effectiveFrom, policy }));
  }
  function parseRevision(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  function parsePayrollTimePolicyState(orgDoc, timeZone) {
    const data = record(orgDoc) ?? {};
    const priorRaw = record(data.payrollTimePolicyPrior);
    return {
      current: parsePayrollPolicy(record(data.payrollTimePolicy)),
      prior: priorRaw ? parsePayrollPolicy(priorRaw) : null,
      effectiveFrom: payrollDayKeyFromValue(data.payrollTimePolicyEffectiveFrom, timeZone),
      scheduled: parsePayrollTimePolicyScheduled(data.payrollTimePolicyScheduled, timeZone),
      history: parsePayrollTimePolicyHistory(data.payrollTimePolicyHistory, timeZone),
      revision: parseRevision(data.payrollTimePolicyRevision)
    };
  }
  function isState(value) {
    const v = record(value);
    return Boolean(v && "current" in v && "scheduled" in v && record(v.current));
  }
  function payrollTimePolicyHistoryEntries(state) {
    const history = state.history ?? [];
    const effectiveFrom = state.effectiveFrom;
    const entries = effectiveFrom ? history.filter((entry) => entry.effectiveFrom < effectiveFrom) : history.slice();
    if (entries.length === 0 && state.prior && effectiveFrom) {
      entries.push({ effectiveFrom: PAYROLL_POLICY_HISTORY_START, policy: state.prior });
    }
    if (effectiveFrom) entries.push({ effectiveFrom, policy: state.current });
    else if (entries.length === 0) entries.push({ effectiveFrom: PAYROLL_POLICY_HISTORY_START, policy: state.current });
    return entries;
  }
  function payrollTimePolicyForDayFromState(state, dayKey) {
    if (state.scheduled && dayKey >= state.scheduled.effectiveFrom) return state.scheduled.policy;
    const entries = payrollTimePolicyHistoryEntries(state);
    let chosen = entries[0]?.policy ?? state.current;
    for (const entry of entries) {
      if (entry.effectiveFrom <= dayKey) chosen = entry.policy;
      else break;
    }
    return chosen;
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
    const settled = { ...state, scheduled: null };
    return {
      current: scheduled.policy,
      prior: payrollTimePolicyForDayFromState(settled, dayBefore),
      effectiveFrom: scheduled.effectiveFrom,
      scheduled: null,
      history: [...payrollTimePolicyHistoryEntries(settled), { effectiveFrom: scheduled.effectiveFrom, policy: scheduled.policy }],
      revision: state.revision ?? 0
    };
  }
  function samePolicy(a, b) {
    return JSON.stringify(payrollPolicyToFirestore(a)) === JSON.stringify(payrollPolicyToFirestore(b));
  }
  function historyToWrite(state, todayKey2, next) {
    const stored = state.history ?? [];
    const entries = stored.length === 0 ? payrollTimePolicyHistoryEntries({ ...state, scheduled: null }) : stored.slice();
    if (stored.length > 0 && state.effectiveFrom) {
      const last = stored[stored.length - 1];
      if (last.effectiveFrom < state.effectiveFrom || last.effectiveFrom === state.effectiveFrom && !samePolicy(last.policy, state.current)) {
        entries.push({ effectiveFrom: state.effectiveFrom, policy: state.current });
      }
    }
    if (state.scheduled && state.scheduled.effectiveFrom <= todayKey2) {
      entries.push({ effectiveFrom: state.scheduled.effectiveFrom, policy: state.scheduled.policy });
    }
    if (next) entries.push(next);
    return entries;
  }
  function historyToFirestore(entries) {
    return entries.map((entry) => ({ effectiveFrom: entry.effectiveFrom, policy: payrollPolicyToFirestore(entry.policy) }));
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
  function revisionField(state) {
    return { payrollTimePolicyRevision: (state.revision ?? 0) + 1 };
  }
  function payrollTimePolicyApplyNowWriteFields(input) {
    const tz = zone(input.timeZone);
    const state = parsePayrollTimePolicyState(input.orgDoc, tz);
    const yesterday = shiftDayKey(input.todayKey, -1, tz);
    const prior = payrollTimePolicyForDayFromState(state, yesterday);
    const policy = withDerivedWeekdayPaidHours(input.policy);
    const fields = {
      payrollTimePolicy: payrollPolicyToFirestore(policy),
      payrollTimePolicyPrior: payrollPolicyToFirestore(prior),
      payrollTimePolicyEffectiveFrom: input.todayKey,
      payrollTimePolicyHistory: historyToFirestore(
        historyToWrite(state, input.todayKey, { effectiveFrom: input.todayKey, policy })
      ),
      ...revisionField(state)
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
        // 1.20.0 §4.3: the scheduled policy derives its weekday paid day (`paidHoursDerived`).
        policy: payrollPolicyToFirestore(withDerivedWeekdayPaidHours(input.policy)),
        effectiveFrom: input.effectiveFrom
      },
      payrollTimePolicyHistory: historyToFirestore(historyToWrite(state, input.todayKey, null)),
      ...revisionField(state)
    };
  }
  function payrollTimePolicyCancelScheduleWriteFields(input) {
    const tz = zone(input.timeZone);
    const state = parsePayrollTimePolicyState(input.orgDoc, tz);
    const promoted = promotedFields(state, input.todayKey, tz);
    return {
      ...Object.keys(promoted).length > 0 ? promoted : { payrollTimePolicyScheduled: null },
      payrollTimePolicyHistory: historyToFirestore(historyToWrite(state, input.todayKey, null)),
      ...revisionField(state)
    };
  }
  function payrollTimePolicySaveConflict(baseOrgDoc, liveOrgDoc, timeZone) {
    const tz = zone(timeZone);
    const fingerprint = (doc) => {
      const state = parsePayrollTimePolicyState(doc, tz);
      return JSON.stringify({
        revision: state.revision ?? 0,
        current: payrollPolicyToFirestore(state.current),
        prior: state.prior ? payrollPolicyToFirestore(state.prior) : null,
        effectiveFrom: state.effectiveFrom,
        scheduled: state.scheduled ? { effectiveFrom: state.scheduled.effectiveFrom, policy: payrollPolicyToFirestore(state.scheduled.policy) } : null,
        history: (state.history ?? []).length
      });
    };
    return fingerprint(baseOrgDoc) === fingerprint(liveOrgDoc) ? null : PAYROLL_POLICY_STALE_SAVE_MESSAGE;
  }
  function inRange(value, limits) {
    return typeof value === "number" && Number.isFinite(value) && value >= limits.min && value <= limits.max;
  }
  function validClock(value) {
    const raw = String(value ?? "").trim();
    if (!/^\d{1,2}:\d{2}$/.test(raw)) return null;
    return parseClockMinutes(raw);
  }
  var PAYROLL_POLICY_TIME_STEP_MINUTES = 30;
  var PAYROLL_POLICY_TIME_STEP_MESSAGE = "Working hours use 30-minute steps (e.g. 07:30).";
  function payrollPolicyTimeOnStep(value) {
    const minutes = validClock(value);
    return minutes != null && minutes % PAYROLL_POLICY_TIME_STEP_MINUTES === 0;
  }
  function payrollPolicyClockTimes(policy) {
    const times = [
      ["standardDayStart", policy.standardDayStart],
      ["standardDayEnd", policy.standardDayEnd],
      ["breakWindowStart", policy.breakWindowStart],
      ["breakWindowEnd", policy.breakWindowEnd]
    ];
    const days = [["saturday", policy.saturday]];
    if (!policy.sunday?.sameAsSaturday) days.push(["sunday", policy.sunday]);
    for (const [day, settings] of days) {
      if (!settings) continue;
      if (!settings.allHoursAtMultiplierMode) {
        times.push([`${day}.definedWindowStart`, settings.definedWindowStart]);
        times.push([`${day}.definedWindowEnd`, settings.definedWindowEnd]);
      }
      if (settings.breakWindowStart != null) times.push([`${day}.breakWindowStart`, settings.breakWindowStart]);
      if (settings.breakWindowEnd != null) times.push([`${day}.breakWindowEnd`, settings.breakWindowEnd]);
    }
    return times;
  }
  function payrollPolicyTimeStepError(policy, previous) {
    const before = new Map(previous ? payrollPolicyClockTimes(previous) : []);
    for (const [key3, value] of payrollPolicyClockTimes(policy)) {
      if (value == null || String(value).trim() === "") continue;
      if (payrollPolicyTimeOnStep(value)) continue;
      const stored = before.get(key3);
      if (stored != null && validClock(stored) === validClock(value)) continue;
      return PAYROLL_POLICY_TIME_STEP_MESSAGE;
    }
    return null;
  }
  function validatePayrollTimePolicy(policy, previous) {
    const error = validatePayrollTimePolicyFields(policy);
    return error ?? payrollPolicyTimeStepError(policy, previous);
  }
  function validatePayrollTimePolicyFields(policy) {
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
    if (policy.paidHoursDerived === true) {
      const derived = derivedWeekdayPaidHours(policy);
      if (!(derived >= paidHours.min - 1e-9 && derived <= paidHours.max + 1e-9)) {
        return `The working day must give between ${paidHours.min} and ${paidHours.max} paid hours (finish \u2212 start \u2212 unpaid break).`;
      }
    } else if (!inRange(policy.standardPaidHours, paidHours)) {
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
      if (settings.breakMinutes != null && !inRange(settings.breakMinutes, breakMinutes)) {
        return `${name} break length must be between ${breakMinutes.min} and ${breakMinutes.max} minutes.`;
      }
      if (settings.breakWindowStart != null || settings.breakWindowEnd != null) {
        const bs = validClock(settings.breakWindowStart ?? policy.breakWindowStart);
        const be = validClock(settings.breakWindowEnd ?? policy.breakWindowEnd);
        if (bs == null || be == null) return `${name} break window must use valid 24h times.`;
        if (be <= bs) return `${name} break window end must be after the break start.`;
      }
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

  // lib/canonical/personIds.ts
  function idText(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function idKey2(value) {
    return idText(value).toLowerCase();
  }
  function ownIds(person) {
    if (!person) return [];
    return [
      person.id,
      ...person.formerUserIds ?? [],
      ...person.sameEmailUserIds ?? [],
      ...person.formerIds ?? [],
      ...person.aliasIds ?? []
    ].map(idText).filter(Boolean);
  }
  function validRoster(roster) {
    return (roster || []).filter((member) => member && typeof member === "object" && idText(member.id));
  }
  function rosterMemberActive(member) {
    return Boolean(member) && member.isActive !== false;
  }
  function rosterMemberFor(id2, roster) {
    const key3 = idKey2(id2);
    if (!key3) return void 0;
    const members = validRoster(roster);
    return members.find((member) => idKey2(member.id) === key3) ?? members.find((member) => ownIds(member).some((alias) => idKey2(alias) === key3));
  }
  function personIdSet(person, roster) {
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (id2) => {
      const key3 = idKey2(id2);
      if (!key3 || seen.has(key3)) return false;
      seen.add(key3);
      out.push(idText(id2));
      return true;
    };
    for (const id2 of ownIds(person)) add(id2);
    if (out.length === 0) return [];
    const emails = /* @__PURE__ */ new Set();
    const personEmail = idKey2(person?.email);
    if (personEmail) emails.add(personEmail);
    const members = validRoster(roster);
    let grew = true;
    for (let pass = 0; grew && pass < 8; pass += 1) {
      grew = false;
      for (const member of members) {
        const ids = ownIds(member);
        const email = idKey2(member.email);
        const same = ids.some((id2) => seen.has(idKey2(id2))) || email !== "" && emails.has(email);
        if (!same) continue;
        for (const id2 of ids) if (add(id2)) grew = true;
        if (email && !emails.has(email)) {
          emails.add(email);
          grew = true;
        }
      }
    }
    return out;
  }

  // lib/canonical/warningRows.ts
  function qualificationDismissKey(operativeId, qualificationId, expiryDayKey) {
    return `qual|${String(operativeId).trim()}|${String(qualificationId).trim()}|${String(expiryDayKey).trim()}`;
  }
  function withoutDismissedQualificationRows(rows3, dismissedKeys) {
    const dismissed = dismissedKeys instanceof Set ? dismissedKeys : new Set(dismissedKeys);
    if (dismissed.size === 0) return [...rows3];
    return rows3.filter((row2) => !(row2.daysUntilExpiry < 0 && dismissed.has(row2.dismissKey)));
  }
  var zoneOf3 = zoneOrLondon;
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
  function isPayrollState(value) {
    return Boolean(value && typeof value === "object" && "current" in value && "scheduled" in value);
  }
  function qualificationExpiryRowsUnscoped(input) {
    const timeZone = zoneOf3(input.timeZone);
    const todayKey2 = dayKeyFromIso(input.referenceIso, timeZone);
    if (!todayKey2) return [];
    const endKey = addCalendarMonths(todayKey2, 1);
    const rows3 = [];
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
        rows3.push({
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
    return rows3;
  }
  function unverifiedOperativeRowsUnscoped(input) {
    const timeZone = zoneOf3(input.timeZone);
    const todayKey2 = dayKeyFromIso(input.referenceIso, timeZone);
    if (!todayKey2) return [];
    const rows3 = [];
    for (const operative of input.operatives) {
      if (isAnonymisedDeletedProfile({ email: operative.email, name: operative.name })) continue;
      const email = emailKey(operative.email);
      if (!email) continue;
      const person = input.people.find((candidate) => emailKey(candidate.email) === email && candidate.isOperativeMode);
      if (!person || person.passwordSet) continue;
      const createdKey = dayKeyFromIso(person.createdAtIso, timeZone);
      if (!createdKey || workingDaysInclusive(createdKey, todayKey2, timeZone) < 3) continue;
      const operativeName = String(operative.name || "").trim() || operative.email;
      rows3.push({
        id: `unverified-${operative.id}`,
        operativeId: operative.id,
        operativeName,
        email,
        title: "Unverified operative",
        message: `${operativeName} has not verified their account`
      });
    }
    return rows3;
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
  function unbookedLabourRowsUnscoped(input) {
    const timeZone = zoneOf3(input.timeZone);
    const people = listedCurrentLabourPeople(input.people);
    const operatives = listedCurrentLabourPeople(input.operatives);
    const nid = idKey2;
    const excludedIds = new Set((input.excludedUserIds || []).map(nid).filter(Boolean));
    const isExcluded = (person) => labourPersonIds(person).some((id2) => excludedIds.has(nid(id2)));
    const flatDayPolicy = {
      standardDayStart: input.standardDayStart,
      standardDayEnd: input.standardDayEnd,
      breakWindowStart: input.breakWindowStart,
      breakWindowEnd: input.breakWindowEnd
    };
    const rulesOn = (dayKey, iso) => {
      const source = input.payrollPolicy;
      const policy = source ? isPayrollState(source) ? payrollTimePolicyForDayFromState(source, dayKey) : source : null;
      const dayPolicy = policy ? {
        standardDayStart: policy.standardDayStart,
        standardDayEnd: policy.standardDayEnd,
        breakWindowStart: policy.breakWindowStart,
        breakWindowEnd: policy.breakWindowEnd
      } : flatDayPolicy;
      if (iso !== 6 && iso !== 7) return { dayPolicy, weekendWindow: null, weekendBreak: null };
      const resolved = resolveWeekendCoverageDay(
        input.weekendCoverage ?? null,
        input.includeWeekends,
        policy ?? {
          standardDayStart: input.standardDayStart ?? "07:30",
          standardDayEnd: input.standardDayEnd ?? "16:00",
          saturday: { allHoursAtMultiplierMode: true, allHoursMultiplier: 1 },
          sunday: { allHoursAtMultiplierMode: true, allHoursMultiplier: 1 }
        },
        iso === 6 ? "saturday" : "sunday"
      );
      const start = parseClockMinutes(resolved.start);
      const end = parseClockMinutes(resolved.end);
      const dayBreak = policy ? payrollBreakOnDay(policy, dayKey, timeZone) : (() => {
        const bs = parseClockMinutes(input.breakWindowStart ?? void 0);
        const be = parseClockMinutes(input.breakWindowEnd ?? void 0);
        return bs != null && be != null && be > bs ? { start: bs, end: be } : null;
      })();
      return {
        dayPolicy,
        weekendWindow: resolved.enabled && start != null && end != null && end > start ? { start, end } : null,
        weekendBreak: dayBreak ? { start: dayBreak.start, end: dayBreak.end } : null
      };
    };
    const operativeBookings = /* @__PURE__ */ new Map();
    const managerBookings = /* @__PURE__ */ new Map();
    for (const booking of input.bookings) {
      const personId2 = nid(booking.personId);
      const dayKey = String(booking.dayKey || "");
      if (!personId2 || !dayKey) continue;
      const key3 = `${personId2}|${dayKey}`;
      const target = booking.kind === "manager" ? managerBookings : operativeBookings;
      const list = target.get(key3) || [];
      list.push(asCoverageBooking(booking));
      target.set(key3, list);
    }
    const operativesByEmail = /* @__PURE__ */ new Map();
    const operativeIdsByEmail = /* @__PURE__ */ new Map();
    for (const operative of operatives) {
      const email = emailKey(operative.email);
      if (!email) continue;
      const ids = operativeIdsByEmail.get(email) || /* @__PURE__ */ new Set();
      if (nid(operative.id)) ids.add(nid(operative.id));
      operativeIdsByEmail.set(email, ids);
      const existing = operativesByEmail.get(email);
      if (!existing || operative.profileWeight > existing.profileWeight) {
        operativesByEmail.set(email, operative);
      }
    }
    const userIdsByEmail = /* @__PURE__ */ new Map();
    const idsByUserId = /* @__PURE__ */ new Map();
    for (const person of people) {
      if (nid(person.id)) idsByUserId.set(nid(person.id), labourPersonIds(person).map(nid).filter(Boolean));
      const email = emailKey(person.email);
      if (!email || !person.id) continue;
      const ids = userIdsByEmail.get(email) || /* @__PURE__ */ new Set();
      for (const id2 of labourPersonIds(person)) if (nid(id2)) ids.add(nid(id2));
      userIdsByEmail.set(email, ids);
    }
    const withFormerIds = (target, userId) => {
      const key3 = nid(userId);
      if (!key3) return;
      for (const id2 of idsByUserId.get(key3) || [key3]) target.add(id2);
    };
    const slotsFor = (email, operativeId, userId, dayKey) => {
      const ids = /* @__PURE__ */ new Set();
      if (nid(operativeId)) ids.add(nid(operativeId));
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
      if (nid(operativeId)) operativeIds.add(nid(operativeId));
      const linkedOps = operativeIdsByEmail.get(email);
      if (linkedOps) for (const id2 of linkedOps) operativeIds.add(id2);
      return approvedHolidays.some((holiday) => {
        if (dayKey < holiday.startDayKey || dayKey > holiday.endDayKey) return false;
        const holidayUser = nid(holiday.userId);
        if (holidayUser && userIds.has(holidayUser)) return true;
        const holidayOperative = nid(holiday.operativeId);
        if (holidayOperative && operativeIds.has(holidayOperative)) return true;
        return false;
      });
    };
    const operativeUsers = dedupeFinishedPeople(people.filter(isOperativeModeOnly));
    const managerUsers = dedupeFinishedPeople(people.filter(isManagerOrAdmin));
    const managerAdminUserIds = new Set(
      people.filter(isManagerOrAdmin).filter(hasFinishedSignup).map((person) => nid(person.id))
    );
    const operativeUserEmails = new Set(operativeUsers.map((person) => emailKey(person.email)).filter(Boolean));
    const verifiedUserForEmail = (email) => {
      if (!email) return void 0;
      return preferFinishedAccount(people.filter((person) => emailKey(person.email) === email));
    };
    const roster = operatives.filter((operative) => operative.isActive !== false && !operative.isPlaceholder);
    const rows3 = [];
    for (const dayKey of eachDayKey(input.startDayKey, input.endDayKey, timeZone)) {
      const iso = isoWeekdayInZone(dateFromDayKeyInZone(dayKey, timeZone), timeZone);
      if (!input.includeWeekends && (iso < 1 || iso > 5)) continue;
      const { dayPolicy, weekendWindow, weekendBreak } = rulesOn(dayKey, iso);
      if (iso >= 6 && !weekendWindow) continue;
      const seen = /* @__PURE__ */ new Set();
      const append = (args) => {
        const seenKey = args.email || args.personKey;
        if (seen.has(seenKey)) return;
        seen.add(seenKey);
        const slots = slotsFor(args.email, args.operativeId, args.userId, dayKey);
        const coverage = weekendWindow ? windowCoverage(weekendWindow, dayPolicy, slots, weekendBreak) : standardDayCoverage(dayPolicy, slots);
        const requiredHours = coverage.requiredHours;
        if (requiredHours <= 1e-3) return;
        const coveredHours = Math.min(coverage.coveredHours, requiredHours);
        const missingHours = Math.round(Math.max(0, requiredHours - coveredHours) * 100) / 100;
        if (missingHours <= 1e-3) return;
        const label = formatCoverageHours(missingHours);
        rows3.push({
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
        if (matched && managerAdminUserIds.has(nid(matched.id))) continue;
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
    return rows3.sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1;
      return a.operativeName.localeCompare(b.operativeName, void 0, { sensitivity: "base" });
    });
  }
  function qualificationExpiryRows(input) {
    const rows3 = qualificationExpiryRowsUnscoped(input);
    const scope = input.scope;
    if (!scope || scope.kind === "all") return rows3;
    const emails = new Map(input.operatives.map((operative) => [operative.id, operative.email ?? null]));
    return rows3.filter((row2) => isPersonInWarningScope(scope, [row2.operativeId], emails.get(row2.operativeId) ?? null));
  }
  function unverifiedOperativeRows(input) {
    const rows3 = unverifiedOperativeRowsUnscoped(input);
    const scope = input.scope;
    if (!scope || scope.kind === "all") return rows3;
    return rows3.filter((row2) => isPersonInWarningScope(scope, [row2.operativeId], row2.email));
  }
  function unbookedLabourRows(input) {
    const scope = input.scope;
    if (scope && scope.kind === "jobs" && !scope.unbookedLabour) return [];
    const rows3 = unbookedLabourRowsUnscoped(input);
    if (!scope || scope.kind === "all") return rows3;
    return rows3.filter((row2) => isPersonInWarningScope(scope, [row2.operativeId, row2.userId, row2.personKey], row2.personKey));
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
  function sortWarningsByDate(rows3, direction = DEFAULT_WARNINGS_SORT_DIRECTION) {
    const dir = parseWarningsSortDirection(direction);
    return rows3.map((row2, index) => ({ row: row2, index })).sort((left, right) => {
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
    const text23 = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "");
    return `${text23} hour${rounded === 1 ? "" : "s"}`;
  }
  function joinRanges(intervals) {
    const labels = intervals.map(rangeLabel);
    if (labels.length <= 1) return labels[0] || "";
    return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  }
  function leaveCoverageRows(input) {
    const timeZone = zoneOrLondon(input.timeZone);
    const windows = leaveHalfDayWindows(input.day);
    const lunch = standardBreakWindow(input.day);
    const excluded = new Set((input.excludedUserIds || []).map(idKey2).filter(Boolean));
    const approvedLeave = input.leave.filter((record9) => record9.approved && record9.startDayKey && record9.endDayKey);
    if (approvedLeave.length === 0) return [];
    const peopleByUserId = /* @__PURE__ */ new Map();
    const peopleByOperativeId = /* @__PURE__ */ new Map();
    for (const person of input.people) {
      if (isAnonymisedDeletedProfile({ name: person.name })) continue;
      const userId = idKey2(person.userId);
      if (userId && !peopleByUserId.has(userId)) peopleByUserId.set(userId, person);
      for (const operativeId of person.operativeIds || []) {
        const key3 = idKey2(operativeId);
        if (key3 && !peopleByOperativeId.has(key3)) peopleByOperativeId.set(key3, person);
      }
    }
    const personForLeave = (record9) => {
      const userId = idKey2(record9.userId);
      if (userId && peopleByUserId.has(userId)) return peopleByUserId.get(userId);
      const operativeId = idKey2(record9.operativeId);
      if (operativeId && peopleByOperativeId.has(operativeId)) return peopleByOperativeId.get(operativeId);
      return void 0;
    };
    const bookingsByPersonDay = /* @__PURE__ */ new Map();
    for (const booking of input.bookings) {
      const personId2 = idKey2(booking.personId);
      if (!personId2 || !booking.dayKey) continue;
      const person = booking.kind === "manager" ? peopleByUserId.get(personId2) : peopleByOperativeId.get(personId2);
      if (!person) continue;
      const key3 = `${person.personKey}|${booking.dayKey}`;
      const list = bookingsByPersonDay.get(key3) || [];
      list.push(booking);
      bookingsByPersonDay.set(key3, list);
    }
    const rows3 = [];
    const seen = /* @__PURE__ */ new Set();
    for (const dayKey of eachDayKey(input.startDayKey, input.endDayKey, timeZone)) {
      const iso = isoWeekdayOfDayKey(dayKey, timeZone);
      const weekend = iso === 6 || iso === 7;
      for (const record9 of approvedLeave) {
        if (dayKey < record9.startDayKey || dayKey > record9.endDayKey) continue;
        const person = personForLeave(record9);
        if (!person) continue;
        const dedupe = `${person.personKey}|${dayKey}|${record9.id}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        const leaveSlot2 = leaveSlotKind(record9.timeSlot);
        const leaveWindow = leaveSlot2 === "AM" ? windows.am : leaveSlot2 === "PM" ? windows.pm : windows.day;
        const dayBookings = bookingsByPersonDay.get(`${person.personKey}|${dayKey}`) || [];
        const intervals = dayBookings.map((booking) => ({ booking, interval: leaveComparableInterval(booking, input.day) })).filter((entry) => entry.interval !== null);
        const personName = String(person.name || "").trim() || person.personKey;
        const userId = String(person.userId || "").trim() || void 0;
        const operativeId = String(record9.operativeId || person.operativeIds?.[0] || "").trim() || void 0;
        const longDay = formatLongDayKey(dayKey, timeZone);
        const leaveLabel = leaveLabelFor(leaveSlot2);
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
          const leaveText = leaveSlot2 === "FULL_DAY" ? "full-day annual leave" : `${leaveLabel} annual leave (${rangeLabel(leaveWindow)})`;
          rows3.push({
            id: `leave-clash-${dayKey}-${person.personKey}-${record9.id}`,
            kind: "leave_clash",
            personKey: person.personKey,
            personName,
            userId,
            operativeId,
            dayKey,
            leaveId: record9.id,
            leaveSlot: leaveSlot2,
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
        if (leaveSlot2 === "FULL_DAY") continue;
        if (weekend && !input.includeWeekends) continue;
        if (userId && excluded.has(idKey2(userId))) continue;
        const workingWindow = leaveSlot2 === "PM" ? windows.am : windows.pm;
        const workingLabel = leaveSlot2 === "PM" ? "AM" : "PM";
        const covered = intervals.map((entry) => entry.interval);
        const missing = subtractMinuteIntervals(workingWindow, lunch ? [...covered, lunch] : covered);
        if (missing.length === 0) continue;
        const missingHours = hoursOf(missing);
        const bookedInWorking = mergeMinuteIntervals(
          covered.flatMap((interval2) => {
            const start = Math.max(interval2.start, workingWindow.start);
            const end = Math.min(interval2.end, workingWindow.end);
            return end > start ? subtractMinuteIntervals({ start, end }, lunch ? [lunch] : []) : [];
          })
        );
        const bookedHours = hoursOf(bookedInWorking);
        const message = bookedHours > 0 ? `${personName} has ${leaveLabel} annual leave on ${longDay}. The ${workingLabel} (${rangeLabel(workingWindow)}) is only booked ${joinRanges(bookedInWorking)}; ${joinRanges(missing)} (${formatHours(missingHours)}) is not booked.` : `${personName} has ${leaveLabel} annual leave on ${longDay} but is not booked for the ${workingLabel} (${rangeLabel(workingWindow)}, ${formatHours(missingHours)}).`;
        rows3.push({
          id: `leave-cover-${dayKey}-${person.personKey}-${record9.id}`,
          kind: "leave_cover",
          personKey: person.personKey,
          personName,
          userId,
          operativeId,
          dayKey,
          leaveId: record9.id,
          leaveSlot: leaveSlot2,
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
    return rows3.sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1;
      if (a.kind !== b.kind) return a.kind === "leave_clash" ? -1 : 1;
      return a.personName.localeCompare(b.personName, void 0, { sensitivity: "base" });
    });
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
    "employmentStartDate",
    "annualLeaveYearAllowance",
    "annualLeaveYearAllowanceKey",
    "timesheetsEnabled",
    // vatNumber and utrNumber live at users/{uid}/private/taxIds (sensitiveProfile.ts).
    "lastSeenAt",
    "profilePhotoURL",
    // Set with the new download URL on every photo upload; devices refresh the cached avatar when it changes.
    "profilePhotoUpdatedAt",
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
  var USER_PERMISSION_FIELDS = [
    "adminAccess",
    "manager",
    "operatives",
    "skills",
    "qualifications",
    "materials",
    "projects",
    "smallWorks",
    "operativeMode",
    "siteAudit",
    "subContractors",
    "wholesalersOrderHistory",
    "annualLeaveSelfBook",
    "weeklyReports",
    "dailyOverview"
  ];
  function normalizeEmploymentType(raw) {
    if (raw === "paye") return "paye";
    if (raw === "self_employed" || raw === "selfEmployed") return "self_employed";
    return "self_employed";
  }
  function accountKindFromFlags(flags2) {
    if (flags2.isSuperAdmin) return "admin";
    if (flags2.adminAccess || flags2.role === "admin") return "admin";
    if (flags2.operativeMode) return "operative";
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
    "variations",
    "companyActivity"
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
    variations: true,
    companyActivity: true
  };
  var LEGACY_NOTIFICATION_PREFERENCE_ALIASES = {
    bookingConflicts: "bookingClashes"
  };
  var TYPE_TO_PREFERENCE = {
    material_order_cut_off: "materialOrderCutOff",
    holiday_request_submitted: "annualLeaveRequested",
    holiday_request_approved: "annualLeaveDecision",
    holiday_request_declined: "annualLeaveDecision",
    holiday_cancelled_by_manager: "annualLeaveDecision",
    holiday_booked_for_you: "annualLeaveDecision",
    project_created: "companyActivity",
    small_works_created: "companyActivity",
    booking_clash: "bookingClashes",
    material_order_placed: "materialOrderPlaced",
    material_order_created: "materialOrderPlaced",
    booking_created: "bookedOntoJob",
    booked_onto_job: "bookedOntoJob",
    operative_created: "companyActivity",
    manager_created: "companyActivity",
    client_created: "companyActivity",
    warning_removed: "companyActivity",
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
    const key3 = trimmed3(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(key3) ? key3 : void 0;
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
    for (const key3 of NOTIFICATION_PREFERENCE_KEYS) {
      if (key3 in source) prefs[key3] = flagOn(source[key3]);
    }
    return prefs;
  }
  function userNotificationPreferencesToFirestore(prefs) {
    const out = {};
    for (const key3 of NOTIFICATION_PREFERENCE_KEYS) {
      out[key3] = prefs[key3] !== false;
    }
    return out;
  }
  function userNotificationPreferenceFieldPatch(prefs) {
    const patch = {};
    for (const key3 of NOTIFICATION_PREFERENCE_KEYS) {
      if (Object.prototype.hasOwnProperty.call(prefs, key3)) {
        patch[`notificationPreferences.${key3}`] = prefs[key3] !== false;
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
    variations: "Variations",
    companyActivity: "Company activity"
  };
  function notificationPreferenceCopy(key3, audience) {
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
      variations: "When a variation is added to a job you manage, or variation numbers are updated.",
      companyActivity: "People, clients, jobs added and warnings removed."
    };
    return { label: PREFERENCE_LABELS[key3], description: descriptions[key3] };
  }
  function notificationPreferenceIsVisible(key3, audience) {
    const role = audience.role;
    const staff = isStaffAccount(role);
    switch (key3) {
      case "annualLeaveRequested":
      case "bookingClashes":
      case "lineManagerPeerUpdates":
        return staff;
      case "materialOrderPlaced":
        return staff && audience.canManageMaterials !== false;
      case "timesheetSignOff":
        return canReviewUserTimesheets(role);
      case "variations":
        return canSeeVariations(role);
      case "companyActivity":
        return Boolean(role.isAdmin || role.isSuperAdmin);
      // Retired in 1.4.0: their six types are `companyActivity` now. Kept in the map so a saved value still parses.
      case "projectCreated":
      case "smallWorksCreated":
      case "operativeCreated":
      case "managerCreated":
      case "clientCreated":
      case "warningDismissed":
        return false;
      default:
        return true;
    }
  }
  function visibleNotificationPreferenceKeys(audience) {
    return NOTIFICATION_PREFERENCE_KEYS.filter((key3) => notificationPreferenceIsVisible(key3, audience));
  }
  function notificationPreferenceAllowsDelivery(prefs, type) {
    if (String(type || "").trim() === PUSH_TEST_NOTICE_TYPE) return true;
    const key3 = notificationPreferenceKeyForType(type);
    if (!key3) return true;
    return prefs[key3] !== false;
  }
  var PUSH_TEST_NOTICE_TYPE = "push_test";
  function notificationPushesToActor(type) {
    return String(type || "").trim() === PUSH_TEST_NOTICE_TYPE;
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
    "holiday_cancelled_by_manager",
    "holiday_booked_for_you",
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
    TIMESHEET_SUBMISSION_NOTICE_TYPE,
    "push_test"
  ];
  var DEVICE_PUSH_TYPE_SET = new Set(DEVICE_PUSH_NOTIFICATION_TYPES);
  var NOTIFICATION_ICON_BADGE_CLEARS_ON_FOREGROUND = true;
  function devicePushNotificationTypes() {
    return DEVICE_PUSH_NOTIFICATION_TYPES;
  }
  function notificationDeliversDevicePush(type) {
    return DEVICE_PUSH_TYPE_SET.has(trimmed3(type));
  }
  function ownerKeys(userId) {
    const list = Array.isArray(userId) ? userId : [userId];
    return new Set(list.map((id2) => trimmed3(id2).toLowerCase()).filter(Boolean));
  }
  function nowMs(now) {
    if (typeof now === "number" && Number.isFinite(now)) return now;
    if (now instanceof Date && !Number.isNaN(now.getTime())) return now.getTime();
    if (typeof now === "string") {
      const ms = Date.parse(now);
      if (!Number.isNaN(ms)) return ms;
    }
    return Date.now();
  }
  var SCHEDULED_NOTIFICATION_TYPES = ["deadline_reminder", "deadline_due", "timesheet_submission_reminder"];
  var INBOX_CREATED_AT_SKEW_MS = 5 * 60 * 1e3;
  function isScheduledNotificationType(type) {
    return SCHEDULED_NOTIFICATION_TYPES.includes(typeof type === "string" ? type.trim() : "");
  }
  function notificationCreatedAtIsServerTime(type, scheduledAt) {
    return !(isScheduledNotificationType(type) && scheduledAt != null);
  }
  function inboxNotificationVisibleToUser(row2, userId, now) {
    const ids = ownerKeys(userId);
    if (ids.size === 0 || !row2 || typeof row2 !== "object") return false;
    const owner = trimmed3(row2.userId).toLowerCase();
    if (owner === "" || !ids.has(owner)) return false;
    const created = createdAtInstantMs(row2.createdAt);
    if (created == null) return true;
    const at = nowMs(now);
    return isScheduledNotificationType(row2.type) ? created <= at : created <= at + INBOX_CREATED_AT_SKEW_MS;
  }
  function createdAtInstantMs(value) {
    if (value == null) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string") {
      const ms = Date.parse(value);
      return Number.isNaN(ms) ? null : ms;
    }
    if (typeof value === "object") {
      const row2 = value;
      if (typeof row2.toMillis === "function") {
        const ms = row2.toMillis();
        return Number.isFinite(ms) ? ms : null;
      }
      if (typeof row2.getTime === "function") {
        const ms = row2.getTime();
        return Number.isFinite(ms) ? ms : null;
      }
      const seconds = Number(row2.seconds ?? row2._seconds);
      if (Number.isFinite(seconds)) {
        const nanos = Number(row2.nanoseconds ?? row2._nanoseconds ?? 0);
        return seconds * 1e3 + Math.floor((Number.isFinite(nanos) ? nanos : 0) / 1e6);
      }
    }
    return null;
  }
  function compareInboxNotificationsByCreatedAt(left, right) {
    return inboxCreatedAtMs(right) - inboxCreatedAtMs(left);
  }
  function inboxCreatedAtMs(row2) {
    return createdAtInstantMs(row2?.createdAt) ?? 0;
  }
  function unreadNotificationBadgeCount(notifications, userId, now) {
    if (ownerKeys(userId).size === 0) return 0;
    const rows3 = Array.isArray(notifications) ? notifications : [];
    let count = 0;
    for (const row2 of rows3) {
      if (!inboxNotificationVisibleToUser(row2, userId, now)) continue;
      if (row2.isRead === true) continue;
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
      case "holiday_cancelled_by_manager":
      case "holiday_booked_for_you":
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
      // Variations (1.10.0). relatedId follows `notificationRelatedId`: the variation id for a new or added variation,
      // the job id when a job's variations were renumbered. Operatives never see variations (`canSeeVariations`).
      case "variation":
      case "variation_added":
      case "variation_from_tracker":
        if (role === "operative") return { kind: "notifications" };
        return relatedId ? { kind: "variationDetail", relatedId } : { kind: "variations" };
      case "variation_renumbered":
      case "variation_numbers_updated":
        if (role === "operative") return { kind: "notifications" };
        return { kind: "variations", relatedId };
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
    if (raw === "AM" || raw === "A.M." || raw === "MORNING") return "AM";
    if (raw === "PM" || raw === "P.M." || raw === "AFTERNOON") return "PM";
    return "FULL DAY";
  }
  var HOLIDAY_STATUS_SYNONYMS = {
    pending: ["pending", "requested", "awaiting", "awaiting approval", "submitted"],
    approved: ["approved", "approve", "accepted", "confirmed"],
    rejected: ["rejected", "declined", "denied", "cancelled", "canceled"]
  };
  function normalizeHolidayStatus(value) {
    const raw = text(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    if (!raw) return "approved";
    for (const status of HOLIDAY_STATUSES) {
      if (HOLIDAY_STATUS_SYNONYMS[status].includes(raw)) return status;
    }
    return "approved";
  }
  function parseHolidayDecisionNote(value) {
    const note = text(value);
    return note ? note : null;
  }
  function leaveRecordDayKeys(record9, timeZone, nonWorkingDayKeys) {
    const zone3 = zoneOrLondon(timeZone);
    const start = text(record9.startDayKey);
    if (!DAY_KEY.test(start)) return [];
    const endRaw = text(record9.endDayKey);
    const end = DAY_KEY.test(endRaw) && endRaw >= start ? endRaw : start;
    if (end === start) return [start];
    const skip = new Set((nonWorkingDayKeys || []).map(text));
    return eachDayKey(start, end, zone3).filter((key3) => {
      const iso = isoWeekdayOfDayKey(key3, zone3);
      return iso !== 6 && iso !== 7 && !skip.has(key3);
    });
  }
  function leaveDaysInRange(record9, range, timeZone, nonWorkingDayKeys) {
    const from = text(range?.startDayKey);
    const to = text(range?.endDayKey);
    if (!DAY_KEY.test(from) || !DAY_KEY.test(to) || to < from) return 0;
    const each = normalizeHolidayTimeSlot(record9?.timeSlot) === "FULL DAY" ? 1 : 0.5;
    const days = leaveRecordDayKeys(record9, timeZone, nonWorkingDayKeys).filter((key3) => key3 >= from && key3 <= to);
    return Math.round(days.length * each * 100) / 100;
  }
  function holidayRequestRanges(picks, timeZone) {
    const zone3 = zoneOrLondon(timeZone);
    const bySlot = /* @__PURE__ */ new Map();
    for (const pick of picks || []) {
      const key3 = text(pick?.dayKey);
      if (!DAY_KEY.test(key3) || bySlot.has(key3)) continue;
      bySlot.set(key3, normalizeHolidayTimeSlot(pick.timeSlot));
    }
    const keys = Array.from(bySlot.keys()).sort();
    const ranges = [];
    for (const key3 of keys) {
      const slot = bySlot.get(key3);
      const last = ranges[ranges.length - 1];
      if (last && last.timeSlot === slot) {
        const next = dayKeyInZone(addDaysInZone(dateFromDayKeyInZone(last.endDayKey, zone3), 1, zone3), zone3);
        if (next === key3) {
          last.endDayKey = key3;
          continue;
        }
      }
      ranges.push({ startDayKey: key3, endDayKey: key3, timeSlot: slot });
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
  function lineManagerIds(user, roster) {
    if (!user || user.hasNoLineManager === true) return [];
    const listed = (user.assignedManagerUserIds || []).map(text).filter(Boolean);
    const ids = listed.length > 0 ? listed : [text(user.assignedManagerUserId)].filter(Boolean);
    const members = (roster || []).filter((member) => member && text(member.id));
    const self = new Set(personIdSet(user, members).map(idKey2));
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const id2 of ids) {
      let resolved = id2;
      if (members.length > 0) {
        const member = rosterMemberFor(id2, members);
        if (!member || !rosterMemberActive(member)) continue;
        resolved = text(member.id);
      }
      if (self.has(idKey2(id2)) || self.has(idKey2(resolved))) continue;
      if (seen.has(idKey2(resolved))) continue;
      seen.add(idKey2(resolved));
      out.push(resolved);
    }
    return out;
  }
  function hasActiveLineManager(user, roster) {
    return lineManagerIds(user, roster).length > 0;
  }
  function leaveApproverIds(user, roster) {
    const members = (roster || []).filter((member) => member && text(member.id));
    const managers = lineManagerIds(user, members);
    if (managers.length > 0) return managers;
    const self = new Set(personIdSet(user, members).map(idKey2));
    const seen = /* @__PURE__ */ new Set();
    return members.filter((member) => {
      const key3 = idKey2(member.id);
      if (!rosterMemberActive(member) || !isAdminOutsideOperativeMode(member) || self.has(key3) || seen.has(key3)) return false;
      seen.add(key3);
      return true;
    }).map((member) => text(member.id));
  }
  var HOLIDAY_REQUEST_SUBMITTED_TYPE = "holiday_request_submitted";
  function flagOn2(user, key3) {
    if (!user) return false;
    return user[key3] === true || user.permissions?.[key3] === true;
  }
  function roleObject(role) {
    if (!role || typeof role !== "object") return null;
    return role;
  }
  function roleText(role) {
    return text(role).toLowerCase().replace(/[\s-]/g, "_");
  }
  function inOperativeMode(user) {
    if (!user) return false;
    if (isAdminOutsideOperativeMode(user)) return false;
    const role = roleObject(user.role);
    if (role?.isOperativeMode === true) return true;
    return flagOn2(user, "operativeMode") || roleText(user.role) === "operative";
  }
  function isAdminOutsideOperativeMode(user) {
    if (!user) return false;
    const role = roleObject(user.role);
    if (role) return role.isAdmin === true || role.isSuperAdmin === true;
    const named = roleText(user.role);
    return flagOn2(user, "isSuperAdmin") || flagOn2(user, "adminAccess") || named === "admin" || named === "super_admin" || named === "superadmin";
  }
  function lineManagerRequired(user) {
    if (!user || user.isActive === false) return false;
    return !isAdminOutsideOperativeMode(user);
  }
  function timesheetSelfSigned(user, roster) {
    return isAdminOutsideOperativeMode(user) && !hasActiveLineManager(user, roster);
  }
  function canSelfBookAnnualLeave(user, roster) {
    if (!user) return false;
    if (inOperativeMode(user)) return false;
    if (flagOn2(user, "annualLeaveSelfBook")) return true;
    return timesheetSelfSigned(user, roster);
  }
  var LEAVE_SUBMIT_LABEL = "Submit";
  var LEAVE_SUBMIT_REQUEST_LABEL = "Submit request";
  function leaveSubmitLabel(user, roster) {
    return canSelfBookAnnualLeave(user, roster) ? LEAVE_SUBMIT_LABEL : LEAVE_SUBMIT_REQUEST_LABEL;
  }
  var LINE_MANAGER_REQUIRED_MESSAGE = "Set a line manager \u2014 this person's timesheets and annual leave need approval.";
  function lineManagerRequiredError(user, roster) {
    if (!lineManagerRequired(user)) return null;
    return hasActiveLineManager(user, roster) ? null : LINE_MANAGER_REQUIRED_MESSAGE;
  }
  function usersMissingLineManager(roster) {
    const members = (roster || []).filter((member) => member && text(member.id));
    return members.filter((member) => lineManagerRequiredError(member, members) != null).map((member) => text(member.id));
  }
  function canDecideLeave(viewer, requester, roster) {
    const me = text(viewer?.id).toLowerCase();
    if (!viewer || !me) return false;
    if (me === text(requester?.id).toLowerCase()) return false;
    if (personIdSet(requester, roster).some((id2) => idKey2(id2) === me)) return false;
    const role = viewer.role;
    if (role && !role.isOperativeMode && (role.isAdmin || role.isSuperAdmin)) return true;
    return leaveApproverIds(requester, roster).some((id2) => id2.toLowerCase() === me);
  }
  function cancellationRequested(request) {
    const at = request.cancellationRequestedAt;
    if (at != null && at !== "" && at !== false) return true;
    return text(request.cancellationRequestedByUserId) !== "";
  }
  function leaveDecisionQueue(viewer, requests, roster) {
    const members = (roster || []).filter((member) => member && text(member.id));
    const byId = new Map(members.map((member) => [text(member.id).toLowerCase(), member]));
    return (requests || []).filter((request) => {
      if (!request) return false;
      const status = normalizeHolidayStatus(request.status);
      const waiting = status === "pending" || status === "approved" && cancellationRequested(request);
      if (!waiting) return false;
      const ids = [text(request.userId), text(request.operativeId)].filter(Boolean);
      if (ids.length === 0) return false;
      const member = ids.map((id2) => byId.get(id2.toLowerCase())).find(Boolean);
      const requester = member ?? { id: ids[0] };
      return canDecideLeave(viewer, requester, members);
    });
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
  function leaveYearEndMonth(startMonth) {
    const start = clampMonth(startMonth, 1);
    return start === 1 ? 12 : start - 1;
  }
  function leaveYearStartMonth(endMonth) {
    const end = clampMonth(endMonth, 12);
    return end === 12 ? 1 : end + 1;
  }
  var LEAVE_YEAR_MONTHS_MESSAGE = "The leave year must be 12 months: it ends the month before it starts.";
  function validateLeaveYearMonths(startMonth, endMonth) {
    const start = Number(startMonth);
    const end = Number(endMonth);
    const month = (n) => Number.isInteger(n) && n >= 1 && n <= 12;
    if (!month(start) || !month(end)) return "Choose the months the leave year starts and ends.";
    return end === leaveYearEndMonth(start) ? null : LEAVE_YEAR_MONTHS_MESSAGE;
  }
  function validateAnnualLeaveDefaults(defaults) {
    return validateLeaveYearMonths(defaults?.startMonth, defaults?.endMonth);
  }
  function leaveYearBounds(input) {
    const parsed = parseDayKey(input.onDayKey);
    const startMonth = clampMonth(input.startMonth, 1);
    const endMonth = leaveYearEndMonth(startMonth);
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
      ).filter((key3) => key3 >= startDayKey && key3 <= endDayKey).length;
      total += days * leaveUnits(booking.timeSlot);
    }
    return snapLeaveDays(total);
  }
  function dayNumber(dayKey) {
    const parsed = parseDayKey(dayKey);
    if (!parsed) return null;
    return Math.round(Date.UTC(parsed.year, parsed.month - 1, parsed.day) / 864e5);
  }
  function proRataLeaveAllowance(input) {
    const full = snapLeaveDays(input.daysPerYear);
    const joined = dayNumber(String(input.employmentStartDayKey || "").trim());
    const first = dayNumber(input.year.startDayKey);
    const last = dayNumber(input.year.endDayKey);
    if (joined == null || first == null || last == null || joined <= first) return { allowance: full, proRata: false };
    if (joined > last) return { allowance: 0, proRata: true };
    const fraction = (last - joined + 1) / (last - first + 1);
    return { allowance: Math.min(full, Math.ceil(full * fraction * 2 - 1e-9) / 2), proRata: true };
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
    const entitlement = hasAllowance ? proRataLeaveAllowance({ daysPerYear, year, employmentStartDayKey: input.employmentStartDayKey }) : { allowance: 0, proRata: false };
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
      const prevAllowance = proRataLeaveAllowance({
        daysPerYear,
        year: previous,
        employmentStartDayKey: input.employmentStartDayKey
      }).allowance;
      carriedForward = Math.max(0, snapLeaveDays(prevAllowance - prevTaken));
      const cap = input.maxCarryOverDays;
      if (cap != null && Number.isFinite(Number(cap)) && Number(cap) >= 0) {
        carriedForward = Math.min(carriedForward, snapLeaveDays(Number(cap)));
      }
    }
    const yearAllowance = overrideApplies ? snapLeaveDays(input.yearAllowance) : null;
    const pot = yearAllowance != null ? yearAllowance : entitlement.allowance + carriedForward;
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
      yearEntitlement: entitlement.allowance,
      proRata: entitlement.proRata,
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
  function recordFields(record9) {
    return {
      name: fieldTokens(record9.name),
      brand: fieldTokens(record9.brand),
      code: fieldTokens(record9.productCode),
      extra: [
        ...fieldTokens(record9.category),
        ...fieldTokens(record9.size),
        ...fieldTokens(record9.length)
      ]
    };
  }
  function materialSearchScore(query, record9) {
    const tokens = tokenizeMaterialSearch(query);
    if (tokens.length === 0) return 1;
    const fields = recordFields(record9);
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
    const name = normalizeMaterialSearchText(record9.name);
    const joined = tokens.join(" ");
    if (name.startsWith(joined)) score += 24;
    else if (name.includes(joined)) score += 10;
    const nameLength = name.length;
    if (nameLength > 0) score += Math.max(0, 20 - Math.floor(nameLength / 8));
    return score;
  }
  function materialRecordMatches(query, record9) {
    return materialSearchScore(query, record9) > 0;
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
    QUALIFICATION_LIBRARY_SECTIONS.map((row2) => [row2.section, row2.chip])
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
  function recordFields2(record9) {
    return {
      name: fieldTokens2(record9.name),
      code: fieldTokens2(record9.code),
      body: fieldTokens2(record9.awardingBody),
      extra: [
        ...fieldTokens2(record9.section),
        ...fieldTokens2(record9.subsection),
        ...fieldTokens2(record9.notes)
      ]
    };
  }
  function qualificationSearchScore(query, record9) {
    const tokens = tokenizeQualificationSearch(query);
    if (tokens.length === 0) return 1;
    const fields = recordFields2(record9);
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
    const name = normalizeQualificationSearchText(record9.name);
    const joined = tokens.join(" ");
    if (name.startsWith(joined)) score += 24;
    else if (name.includes(joined)) score += 10;
    if (name.length > 0) score += Math.max(0, 20 - Math.floor(name.length / 8));
    return score;
  }
  function qualificationRecordMatches(query, record9) {
    return qualificationSearchScore(query, record9) > 0;
  }
  function qualificationMatchesSection(record9, section) {
    const wanted = String(section || "").trim();
    if (!wanted || wanted === QUALIFICATION_FILTER_ALL) return true;
    const value = String(record9.section || "").trim();
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
    for (const record9 of records) {
      const section = String(record9.section || "").trim();
      if (!section) {
        other += 1;
        continue;
      }
      counts.set(section, (counts.get(section) || 0) + 1);
    }
    const chips = [
      { key: QUALIFICATION_FILTER_ALL, label: QUALIFICATION_FILTER_ALL, count: records.length }
    ];
    for (const row2 of QUALIFICATION_LIBRARY_SECTIONS) {
      const count = counts.get(row2.section) || 0;
      if (count === 0) continue;
      chips.push({ key: row2.section, label: row2.chip, count });
      counts.delete(row2.section);
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
  function assignedQualificationWriteFields(row2) {
    if (!row2) return null;
    const id2 = trimId(row2.id);
    const name = String(row2.name || "").trim();
    if (!id2 || !name) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const createdAtIso = isoFromUnknown(row2.createdAtIso) || isoFromUnknown(row2.createdAt) || now;
    const updatedAtIso = isoFromUnknown(row2.updatedAtIso) || isoFromUnknown(row2.updatedAt) || createdAtIso;
    const endDateIso = isoFromUnknown(row2.endDateIso) || isoFromUnknown(row2.endDate);
    const write = {
      id: id2,
      name,
      hasEndDate: row2.hasEndDate === true,
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
    for (const [key3, value] of Object.entries(urls)) {
      if (key3.toLowerCase() === target && typeof value === "string" && value.trim()) return value;
    }
    return void 0;
  }
  function mergeQualificationCertificateUrls(existing, uploaded, removedIds) {
    const next = {};
    for (const [key3, value] of Object.entries(existing || {})) {
      if (typeof value === "string" && value.trim()) next[key3] = value;
    }
    for (const [key3, value] of Object.entries(uploaded || {})) {
      if (typeof value === "string" && value.trim()) next[key3] = value;
    }
    for (const id2 of removedIds || []) {
      const target = trimId(id2).toLowerCase();
      if (!target) continue;
      for (const key3 of Object.keys(next)) {
        if (key3.toLowerCase() === target) delete next[key3];
      }
    }
    return next;
  }
  function removedQualificationCertificateIds(previousUrls, nextUrls, assignedIds) {
    const removed = [];
    for (const id2 of assignedIds) {
      const key3 = trimId(id2);
      if (!key3) continue;
      if (qualificationCertificateUrl(previousUrls, key3) && !qualificationCertificateUrl(nextUrls, key3)) {
        removed.push(key3);
      }
    }
    return removed;
  }
  function mergeExpiryDates(previous, next, nextAssignmentIds) {
    const expiry = {};
    for (const [key3, value] of Object.entries(previous || {})) {
      const iso = isoFromUnknown(value);
      if (iso) expiry[key3] = iso;
    }
    for (const id2 of nextAssignmentIds) {
      const target = id2.toLowerCase();
      for (const key3 of Object.keys(expiry)) {
        if (key3.toLowerCase() === target) delete expiry[key3];
      }
    }
    for (const [key3, value] of Object.entries(next || {})) {
      const iso = isoFromUnknown(value);
      if (iso) expiry[key3] = iso;
    }
    return expiry;
  }
  function mergeOperativeQualificationWrite(input) {
    const byId = /* @__PURE__ */ new Map();
    for (const row2 of input.previous?.qualifications || []) {
      const write = assignedQualificationWriteFields(row2);
      if (write) byId.set(write.id, write);
    }
    const nextAssignmentIds = [];
    for (const row2 of input.next.qualifications || []) {
      const write = assignedQualificationWriteFields(row2);
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
    const key3 = raw.toLowerCase();
    const plural = Math.abs(quantity) !== 1;
    if (key3 === "number") return plural ? "Numbers" : "Number";
    if (key3 === "box") return plural ? "Boxes" : "Box";
    if (key3 === "length") return plural ? "Lengths" : "Length";
    if (key3 === "drum") return plural ? "Drums" : "Drum";
    if (key3 === "pallet") return plural ? "Pallets" : "Pallet";
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
      (input.managers ?? []).filter((row2) => jobIds.has(key(row2.id))).map((row2) => key(row2.email)).filter(Boolean)
    );
    const adder = new Set((input.adderIds ?? []).map(key).filter(Boolean));
    const seen = /* @__PURE__ */ new Set();
    const rows3 = [];
    for (const account of input.accounts ?? []) {
      const id2 = key(account.id);
      if (!id2 || seen.has(id2)) continue;
      if (account.isActive === false || !isStaffAccount(account.role)) continue;
      const ids = accountKeys(account);
      if (ids.some((value) => adder.has(value))) continue;
      const named = ids.some((value) => jobIds.has(value)) || key(account.email) !== "" && jobEmails.has(key(account.email));
      if (!named) continue;
      seen.add(id2);
      rows3.push({ userId: account.id });
    }
    return rows3;
  }

  // lib/canonical/userTimesheetAccess.ts
  function idKey3(value) {
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
    const listed = (member.assignedManagerUserIds ?? []).map(idKey3).filter(Boolean);
    if (listed.length > 0) return listed;
    const legacy = idKey3(member.assignedManagerUserId);
    return legacy ? [legacy] : [];
  }
  function userTimesheetSubjects(input) {
    const { viewer, members } = input;
    if (!viewer || !idKey3(viewer.id)) return [];
    if (!canReviewUserTimesheets(viewer.role)) return [];
    const active = members.filter((member) => idKey3(member.id) && memberIsActive(member));
    if (seesEveryUserTimesheet(viewer.role)) {
      return active.filter((member) => isTimesheetUser(member.role)).map((member) => ({ userId: member.id }));
    }
    const viewerKeys = new Set(
      [viewer.id, ...viewer.formerIds ?? [], ...viewer.aliasIds ?? []].map(idKey3).filter(Boolean)
    );
    const reportsToViewer = (member) => lineManagerKeys(member).some((key3) => viewerKeys.has(key3));
    const managedEmails = /* @__PURE__ */ new Set();
    for (const member of active) {
      const email = idKey3(member.email);
      if (email && reportsToViewer(member)) managedEmails.add(email);
    }
    return active.filter((member) => {
      if (reportsToViewer(member)) return true;
      const email = idKey3(member.email);
      return Boolean(email) && managedEmails.has(email);
    }).map((member) => ({ userId: member.id }));
  }
  function canOpenUserTimesheets(input) {
    const { viewer } = input;
    if (!viewer || !idKey3(viewer.id)) return false;
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
      const record9 = value;
      if (typeof record9.toDate === "function") {
        try {
          const parsed = record9.toDate();
          const ms = timestampMs(parsed);
          if (ms != null) return ms;
        } catch {
        }
      }
      const seconds = typeof record9.seconds === "number" ? record9.seconds : record9._seconds;
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
  var SUBSCRIPTION_LAPSED_MESSAGE = "The organisation's Project Planner subscription has lapsed. Please contact your system administrator and ask them to renew.";
  var SUBSCRIPTION_LAPSED_ADMIN_NOTE = "You are an admin: renew the subscription in Settings \u2192 Billing.";
  var SUBSCRIPTION_LAPSED_ADMIN_WEB_NOTE = "You are an admin: renew the subscription in Settings \u2192 Billing on the Project Planner website.";
  function subscriptionAccess(input) {
    if (input.viewerIsPlatformOwner === true) return "open";
    if (hasAccess(input.billing, input.now ?? Date.now())) return "open";
    return input.viewerIsAdmin === true ? "adminBillingOnly" : "blocked";
  }
  function billingAccessFields(billing, now = Date.now()) {
    const accessOpen = hasAccess(billing, now);
    let accessClosesAtMs = null;
    if (billing?.status === "past_due" && billing.lastPaymentFailedAt) {
      const failedAt = timestampMs(billing.lastPaymentFailedAt);
      if (failedAt != null) accessClosesAtMs = failedAt + PAYMENT_GRACE_MS;
    }
    return { accessOpen, accessClosesAtMs };
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
  var UUID_PATTERN2 = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  var LEGACY_PLACEHOLDER_DOCUMENT_ID = "INITIAL-PLACEHOLDER";
  function isLegacyPlaceholderDocumentId(id2) {
    return (id2 || "").trim().toUpperCase() === LEGACY_PLACEHOLDER_DOCUMENT_ID;
  }
  var BOOKING_JOB_COLLECTIONS = ["projects", "smallWorks"];
  function normalizeBookingJobCollection(raw) {
    const value = String(raw ?? "").trim().toLowerCase().replace(/[\s_-]/g, "");
    if (value === "projects" || value === "project") return "projects";
    if (value === "smallworks" || value === "smallwork") return "smallWorks";
    return null;
  }
  function jobCollectionForJobId(jobId, jobs) {
    const key3 = String(jobId ?? "").trim().toLowerCase();
    if (!key3) return null;
    const inProjects = (jobs?.projects || []).some((id2) => String(id2 ?? "").trim().toLowerCase() === key3);
    const inSmallWorks = (jobs?.smallWorks || []).some((id2) => String(id2 ?? "").trim().toLowerCase() === key3);
    if (inProjects === inSmallWorks) return null;
    return inProjects ? "projects" : "smallWorks";
  }
  function bookingJobCollectionFields(input) {
    if (input?.collection === "managerSiteBookings") {
      const type = String(input.locationType ?? "").trim();
      if (type !== "project" && type !== "small_work") return {};
      const kind2 = normalizeBookingJobCollection(input.jobCollection) ?? (type === "project" ? "projects" : "smallWorks");
      return { jobCollection: kind2 };
    }
    const kind = normalizeBookingJobCollection(input?.jobCollection);
    return kind ? { jobCollection: kind } : {};
  }
  function text2(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : void 0;
  }
  function isBookingUuid(value) {
    return UUID_PATTERN2.test(text2(value));
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
      const row2 = raw;
      const seconds = finiteNumber(row2.seconds) ?? finiteNumber(row2._seconds);
      if (seconds == null) return null;
      const nanos = finiteNumber(row2.nanoseconds) ?? finiteNumber(row2._nanoseconds) ?? 0;
      return seconds * 1e3 + Math.floor(nanos / 1e6);
    }
    return null;
  }
  function isTimestampShape(raw) {
    if (!raw || typeof raw !== "object") return false;
    const row2 = raw;
    return finiteNumber(row2.seconds) != null || finiteNumber(row2._seconds) != null;
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
    const row2 = data && typeof data === "object" ? data : {};
    const repairs = [];
    const errors = [];
    let operativeId = text2(row2.operativeId);
    if (!operativeId && text2(row2.operativeID)) {
      operativeId = text2(row2.operativeID);
      repairs.push("operative_id_alias");
    }
    let projectId = text2(row2.projectId);
    if (!projectId && text2(row2.projectID)) {
      projectId = text2(row2.projectID);
      repairs.push("project_id_alias");
    }
    const dateMs = bookingDateMs(row2.date);
    if (dateMs != null && !isTimestampShape(row2.date)) repairs.push("date_not_timestamp");
    const rawStatus = text2(row2.status);
    const status = normalizeBookingStatus(row2.status);
    if (status && status !== rawStatus) repairs.push("status_alias");
    const rawSlot = text2(row2.timeSlot);
    let timeSlot = normalizeBookingTimeSlot(row2.timeSlot);
    if (!rawSlot) {
      timeSlot = "FULL DAY";
      repairs.push("slot_missing_full_day");
    } else if (timeSlot && timeSlot !== rawSlot) {
      repairs.push("slot_alias");
    }
    const bookedBy = text2(row2.bookedBy);
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
      notes: text2(row2.notes),
      isBreakRemoved: row2.isBreakRemoved === true,
      operativeIdIsUuid: isBookingUuid(operativeId),
      projectIdIsUuid: isBookingUuid(projectId)
    };
    const workStartTime = bookingClock(row2.workStartTime, options?.timeZone);
    const workEndTime = bookingClock(row2.workEndTime, options?.timeZone);
    const otMultiplierOverride = finiteNumber(row2.otMultiplierOverride);
    const bookingGroupId = text2(row2.bookingGroupId);
    const createdAtMs = bookingDateMs(row2.createdAt);
    const updatedAtMs = bookingDateMs(row2.updatedAt);
    if (workStartTime) booking.workStartTime = workStartTime;
    if (workEndTime) booking.workEndTime = workEndTime;
    if (otMultiplierOverride != null) booking.otMultiplierOverride = otMultiplierOverride;
    if (bookingGroupId) booking.bookingGroupId = bookingGroupId;
    if (createdAtMs != null) booking.createdAtMs = createdAtMs;
    if (updatedAtMs != null) booking.updatedAtMs = updatedAtMs;
    const jobCollection = normalizeBookingJobCollection(row2.jobCollection);
    if (jobCollection) booking.jobCollection = jobCollection;
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
    Object.assign(fields, bookingJobCollectionFields({ collection: "bookings", jobCollection: input.jobCollection }));
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
    return input.bookings.filter((row2) => ids.has(text2(row2.operativeId).toUpperCase()) && onOrAfterToday(row2.dateMs, today, input.timeZone)).map((row2) => row2.id);
  }
  function bookingsToRemoveOnProjectDelete(input) {
    const projectId = text2(input.projectId).toUpperCase();
    if (!projectId) return [];
    const today = todayKey(input.nowIso, input.timeZone);
    return input.bookings.filter((row2) => text2(row2.projectId).toUpperCase() === projectId && onOrAfterToday(row2.dateMs, today, input.timeZone)).map((row2) => row2.id);
  }
  function jobDeleteBookingRemovals(input) {
    const job = text2(input.projectId).toLowerCase();
    const empty = { bookings: [], subcontractorBookings: [], managerSiteBookings: [] };
    if (!job) return empty;
    const today = todayKey(input.nowIso, input.timeZone);
    const upcoming = (row2) => Number.isFinite(row2?.dateMs) && onOrAfterToday(row2.dateMs, today, input.timeZone);
    const byProject = (rows3) => (rows3 || []).filter((row2) => row2 && text2(row2.id) && text2(row2.projectId).toLowerCase() === job && upcoming(row2)).map((row2) => text2(row2.id));
    return {
      bookings: byProject(input.bookings),
      subcontractorBookings: byProject(input.subcontractorBookings),
      managerSiteBookings: (input.managerSiteBookings || []).filter(
        (row2) => row2 && text2(row2.id) && (text2(row2.locationType) === "project" || text2(row2.locationType) === "small_work") && text2(row2.locationId).toLowerCase() === job && upcoming(row2)
      ).map((row2) => text2(row2.id))
    };
  }
  function bookingJobState(projectId, liveProjectIds) {
    const id2 = text2(projectId).toUpperCase();
    if (!id2) return "deleted_job";
    const ids = Array.isArray(liveProjectIds) ? liveProjectIds : Array.from(liveProjectIds);
    return ids.some((row2) => text2(row2).toUpperCase() === id2) ? "live" : "deleted_job";
  }
  function bookingJobLabel(projectName) {
    return text2(projectName) || ORPHAN_BOOKING_LABEL;
  }
  function bookingHealthRows(input) {
    const people = new Set([...input.operativeIds, ...input.userIds].map((id2) => text2(id2).toUpperCase()).filter(Boolean));
    const jobs = new Set(input.projectIds.map((id2) => text2(id2).toUpperCase()).filter(Boolean));
    const rows3 = [];
    for (const doc of input.docs) {
      const parsed = parseBookingDocument(doc.id, doc.data);
      if (!parsed.ok) {
        rows3.push({ id: doc.id, kind: "refused", detail: parsed.errors.join(", ") });
        continue;
      }
      const booking = parsed.booking;
      if (parsed.repairs.length > 0) rows3.push({ id: doc.id, kind: "repaired", detail: parsed.repairs.join(", ") });
      if (!people.has(booking.operativeId.toUpperCase())) {
        rows3.push({ id: doc.id, kind: "missing_operative", detail: booking.operativeId });
      }
      if (!jobs.has(booking.projectId.toUpperCase())) {
        rows3.push({ id: doc.id, kind: "missing_job", detail: booking.projectId });
      }
      if (!booking.operativeIdIsUuid || !booking.projectIdIsUuid) {
        rows3.push({
          id: doc.id,
          kind: "ios_cannot_read",
          detail: !booking.operativeIdIsUuid ? `operativeId ${booking.operativeId}` : `projectId ${booking.projectId}`
        });
      }
    }
    return rows3;
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
    const row2 = data && typeof data === "object" ? data : {};
    const errors = [];
    const repairs = [];
    const userId = text2(row2.userId);
    const dateMs = bookingDateMs(row2.date);
    if (dateMs != null && !isTimestampShape(row2.date)) repairs.push("date_not_timestamp");
    const timeSlot = normalizeManagerBookingTimeSlot(row2.timeSlot);
    if (timeSlot && timeSlot !== text2(row2.timeSlot)) repairs.push("slot_alias");
    if (!userId) errors.push("missing_user_id");
    if (dateMs == null) errors.push("missing_date");
    if (!timeSlot) errors.push("bad_time_slot");
    if (errors.length > 0 || dateMs == null || !timeSlot) return { ok: false, errors };
    const rawLocation = text2(row2.locationType);
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
      isBreakRemoved: row2.isBreakRemoved === true
    };
    const locationId = text2(row2.locationId);
    const customLocationName = text2(row2.customLocationName);
    const workStartTime = bookingClock(row2.workStartTime, options?.timeZone);
    const workEndTime = bookingClock(row2.workEndTime, options?.timeZone);
    const bookingGroupId = text2(row2.bookingGroupId);
    const createdAtMs = bookingDateMs(row2.createdAt);
    const updatedAtMs = bookingDateMs(row2.updatedAt);
    if (locationId) booking.locationId = locationId;
    if (customLocationName) booking.customLocationName = customLocationName;
    if (workStartTime) booking.workStartTime = workStartTime;
    if (workEndTime) booking.workEndTime = workEndTime;
    if (bookingGroupId) booking.bookingGroupId = bookingGroupId;
    if (createdAtMs != null) booking.createdAtMs = createdAtMs;
    if (updatedAtMs != null) booking.updatedAtMs = updatedAtMs;
    const kind = bookingJobCollectionFields({ collection: "managerSiteBookings", jobCollection: row2.jobCollection, locationType });
    if (kind.jobCollection) booking.jobCollection = kind.jobCollection;
    return { ok: true, booking, repairs };
  }

  // lib/canonical/bookingPerson.ts
  function idKey4(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  function emailKey2(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  function rosterAliasIdsFor(accountId, aliases) {
    const kept = idKey4(accountId);
    if (!kept || !aliases) return [];
    const ids = [];
    const seen = /* @__PURE__ */ new Set([kept]);
    for (const [alias, keptId] of Object.entries(aliases)) {
      const key3 = idKey4(alias);
      if (!key3 || seen.has(key3) || idKey4(keptId) !== kept) continue;
      seen.add(key3);
      ids.push(alias.trim());
    }
    return ids;
  }
  function bookingIdsForAccount(account, operatives) {
    const ids = [];
    const seen = /* @__PURE__ */ new Set();
    const add = (raw) => {
      const id2 = typeof raw === "string" ? raw.trim() : "";
      const key3 = id2.toLowerCase();
      if (!id2 || seen.has(key3)) return;
      seen.add(key3);
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
    const needle = idKey4(operativeId);
    if (!needle) return { accountId: null, operativeId: null, email: null };
    const operative = input.operatives.find((row2) => idKey4(row2.id) === needle) || null;
    let account = input.accounts.find((row2) => idKey4(row2.id) === needle) || input.accounts.find((row2) => (row2.formerIds || []).some((id2) => idKey4(id2) === needle)) || input.accounts.find((row2) => (row2.aliasIds || []).some((id2) => idKey4(id2) === needle)) || null;
    const operativeEmail = emailKey2(operative?.email);
    if (!account && operativeEmail) {
      account = input.accounts.find((row2) => emailKey2(row2.email) === operativeEmail) || null;
    }
    const accountEmail = emailKey2(account?.email);
    const linkedOperative = operative || (accountEmail ? input.operatives.find((row2) => emailKey2(row2.email) === accountEmail) || null : null);
    const email = operativeEmail || accountEmail || emailKey2(linkedOperative?.email) || null;
    return {
      accountId: account ? account.id : null,
      operativeId: linkedOperative ? linkedOperative.id : null,
      email: email || null
    };
  }
  function bookingPersonKey(operativeId, input) {
    const person = resolveBookingPerson(operativeId, input);
    if (person.accountId) return `account:${idKey4(person.accountId)}`;
    if (person.operativeId) return `operative:${idKey4(person.operativeId)}`;
    return `id:${idKey4(operativeId)}`;
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
    const account = person.accountId ? input.accounts.find((row2) => row2.id === person.accountId) : void 0;
    if (account) for (const id2 of bookingIdsForAccount(account, input.operatives)) add(id2);
    return ids;
  }
  function leaveRecordsForAccount(records, account, operatives) {
    const ids = new Set(bookingIdsForAccount(account, operatives).map((id2) => id2.toLowerCase()));
    if (ids.size === 0) return [];
    const email = emailKey2(account?.email);
    if (email) ids.add(email);
    const has = (value) => typeof value === "string" && value.trim() !== "" && ids.has(value.trim().toLowerCase());
    return (records || []).filter((record9) => has(record9?.userId) || has(record9?.operativeId));
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

  // lib/canonical/derivedIds.ts
  function fnv1a(input, seed) {
    let hash = seed >>> 0;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
  }
  function derivedDocumentId(source) {
    const input = typeof source === "string" ? source : String(source ?? "");
    const hex = [2166136261, 19088743, 2309737967, 1540483477].map((seed) => fnv1a(input, seed).toString(16).padStart(8, "0")).join("");
    const version = `8${hex.slice(13, 16)}`;
    const variant = `${(parseInt(hex[16], 16) & 3 | 8).toString(16)}${hex.slice(17, 20)}`;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${version}-${variant}-${hex.slice(20, 32)}`.toUpperCase();
  }
  function derivedRowId(parentId, arrayName, index, content) {
    const parent = typeof parentId === "string" ? parentId.trim() : "";
    const position = String(Math.max(0, Math.floor(Number(index) || 0)));
    const parts = (content || []).map((value) => value == null ? "" : typeof value === "string" ? value : String(value));
    return derivedDocumentId([parent, arrayName, position, ...parts].join("|"));
  }

  // lib/canonical/permissionLevels.ts
  var ADMIN_EDITABLE_PERMISSION_FIELDS = ["annualLeaveSelfBook"];
  var MANAGER_LOCKED_ON_PERMISSION_FIELDS = ["materials", "siteAudit"];
  var PERMISSION_DEFAULT_ON = [
    "materials",
    "siteAudit",
    "wholesalersOrderHistory",
    "dailyOverview"
  ];
  var ADMIN_LOCKED_PERMISSION_MESSAGE = "Administrators have this on. Change user type to remove admin access.";
  function bool(value) {
    if (value === true || value === false) return value;
    if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
    if (typeof value === "string") {
      const token = value.trim().toLowerCase();
      if (token === "true" || token === "yes" || token === "1") return true;
      if (token === "false" || token === "no" || token === "0") return false;
    }
    return null;
  }
  function record2(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function storedPermissionFlag(user, key3) {
    const row2 = record2(user);
    const top = bool(row2[key3]);
    if (top != null) return top;
    return bool(record2(row2.permissions)[key3]);
  }
  function roleToken(user) {
    const role = record2(user).role;
    return typeof role === "string" ? role.trim().toLowerCase().replace(/[\s-]/g, "_") : "";
  }
  function permissionLevelOf(user) {
    const role = roleToken(user);
    if (storedPermissionFlag(user, "isSuperAdmin") === true || storedPermissionFlag(user, "adminAccess") === true || role === "admin" || role === "super_admin" || role === "superadmin") {
      return "admin";
    }
    if (storedPermissionFlag(user, "operativeMode") === true || role === "operative") return "operative";
    return "manager";
  }
  function lockedPermissionFields(user, level) {
    const resolved = level ?? permissionLevelOf(user);
    if (resolved === "manager") return [...MANAGER_LOCKED_ON_PERMISSION_FIELDS];
    if (resolved !== "admin") return [];
    return USER_PERMISSION_FIELDS.filter((key3) => !ADMIN_EDITABLE_PERMISSION_FIELDS.includes(key3));
  }
  function effectivePermissions(user, level) {
    const resolved = level ?? permissionLevelOf(user);
    const out = {};
    const stored = (key3, fallback) => storedPermissionFlag(user, key3) ?? fallback;
    if (resolved === "admin") {
      for (const key3 of USER_PERMISSION_FIELDS) out[key3] = true;
      out.operativeMode = false;
      out.annualLeaveSelfBook = stored("annualLeaveSelfBook", false);
      return out;
    }
    for (const key3 of USER_PERMISSION_FIELDS) out[key3] = stored(key3, PERMISSION_DEFAULT_ON.includes(key3));
    out.skills = false;
    out.adminAccess = false;
    if (resolved === "operative") {
      out.operativeMode = true;
      out.manager = false;
      out.operatives = false;
      out.qualifications = false;
      out.materials = stored("materials", false);
      out.projects = true;
      out.smallWorks = true;
      return out;
    }
    out.operativeMode = false;
    out.manager = stored("manager", roleToken(user) === "manager");
    for (const key3 of MANAGER_LOCKED_ON_PERMISSION_FIELDS) out[key3] = true;
    return out;
  }
  function effectivePermission(user, key3) {
    return effectivePermissions(user)[key3] === true;
  }
  function withoutLockedPermissionWrites(user, fields, level) {
    const locked = lockedPermissionFields(user, level);
    if (locked.length === 0) return fields;
    const effective = effectivePermissions(user, level);
    const out = {};
    for (const [key3, value] of Object.entries(fields || {})) {
      const dotted = key3.startsWith("permissions.") ? key3.slice("permissions.".length) : null;
      const field = dotted ?? key3;
      if (locked.includes(field) && (dotted != null || key3 === field) && typeof value === "boolean" && value !== effective[field]) {
        continue;
      }
      if (key3 === "permissions" && value && typeof value === "object" && !Array.isArray(value)) {
        const map = {};
        for (const [inner, flag] of Object.entries(value)) {
          const innerField = inner;
          if (locked.includes(innerField) && typeof flag === "boolean" && flag !== effective[innerField]) continue;
          map[inner] = flag;
        }
        out[key3] = map;
        continue;
      }
      out[key3] = value;
    }
    return out;
  }
  function keepStoredLockedPermissions(before, next) {
    if (!before || !next || typeof next !== "object") return next;
    const level = permissionLevelOf(before);
    if (permissionLevelOf({ ...before, ...next }) !== level) return next;
    const locked = lockedPermissionFields(before, level);
    if (locked.length === 0) return next;
    const out = { ...next };
    for (const key3 of locked) {
      if (key3 === "adminAccess") continue;
      delete out[key3];
      delete out[`permissions.${key3}`];
    }
    const map = out.permissions;
    if (map && typeof map === "object" && !Array.isArray(map)) {
      const stored = record2(before.permissions);
      const kept = { ...map };
      for (const key3 of locked) {
        if (stored[key3] !== void 0) kept[key3] = stored[key3];
        else delete kept[key3];
      }
      out.permissions = kept;
    }
    return out;
  }
  var PERMISSION_TOGGLE_CATALOGUE = [
    { field: "adminAccess", label: "Admin Access", help: "Gives Manage Users and organisation settings. Change user type to give or remove it.", levels: ["admin"] },
    {
      field: "projects",
      label: "Projects",
      help: "Sees, adds and edits every project. If off, they see only the projects they are assigned to as a manager \u2014 scheduling and other job tools stay available there, but they cannot add projects or change a project's managers.",
      levels: ["admin", "manager"]
    },
    {
      field: "smallWorks",
      label: "Small Works",
      help: "Sees, adds and edits every small works job. If off, they see only the small works they are assigned to as a manager \u2014 scheduling and other job tools stay available there, but they cannot add small works or change their managers.",
      levels: ["admin", "manager"]
    },
    { field: "weeklyReports", label: "Weekly Report", help: "Can open Weekly Report from Home. If off, that tile is hidden.", levels: ["admin", "manager"] },
    { field: "dailyOverview", label: "Daily Overview", help: "Can open Daily Overview from Home. If off, that tile is hidden.", levels: ["admin", "manager"] },
    {
      field: "subContractors",
      label: "Sub Contractors",
      help: "Can add and manage sub contractor records. If off, Sub Contractors is hidden on Home and menus. They can still book existing subcontractors on jobs.",
      levels: ["admin", "manager"]
    },
    {
      field: "annualLeaveSelfBook",
      label: "Annual Leave Management",
      help: "Can book their own annual leave. If off, this user requests leave for approval.",
      levels: ["admin", "manager"]
    },
    {
      field: "operatives",
      label: "Operatives",
      help: "Can add and manage operatives and view their details. If off, they can still schedule active operatives onto the jobs they manage, but do not see Manage Operatives or full operative profiles.",
      levels: ["admin", "manager"]
    },
    {
      field: "qualifications",
      label: "Manage Qualifications",
      help: "Can add and edit organisation qualification templates. If off, they see My Qualifications and can still assign templates others have added.",
      levels: ["admin", "manager"]
    },
    {
      field: "wholesalersOrderHistory",
      label: "Wholesalers",
      help: "Can view and manage the Wholesalers page, including quote and order history. If off, that page is not available.",
      levels: ["admin", "manager"]
    },
    {
      field: "materials",
      label: "Materials",
      help: "Can open material lists on projects and small works. Operatives cannot send quotes or place orders.",
      levels: ["admin", "manager", "operative"]
    },
    { field: "siteAudit", label: "Site audit", help: "Can view and submit site audits.", levels: ["admin", "manager", "operative"] }
  ];
  function addUserPermissionDefaults(level) {
    const resolved = level === "admin" || level === "operative" ? level : "manager";
    const out = resolved === "admin" ? effectivePermissions({}, "admin") : resolved === "operative" ? effectivePermissions({}, "operative") : effectivePermissions({ manager: true }, "manager");
    const locked = new Set(lockedPermissionFields({}, resolved));
    for (const row2 of PERMISSION_TOGGLE_CATALOGUE) {
      if (!row2.levels.includes(resolved) || locked.has(row2.field)) continue;
      out[row2.field] = false;
    }
    return out;
  }
  function permissionToggleRows(input) {
    const level = input?.level === "admin" || input?.level === "operative" ? input.level : "manager";
    const values = input?.user != null ? effectivePermissions(input.user, level) : addUserPermissionDefaults(level);
    const locked = lockedPermissionFields(input?.user ?? {}, level);
    return PERMISSION_TOGGLE_CATALOGUE.map((row2) => {
      const visible = row2.levels.includes(level);
      return {
        field: row2.field,
        label: row2.label,
        help: row2.help,
        visible,
        editable: visible && input?.mode !== "summary" && !locked.includes(row2.field),
        value: values[row2.field] === true
      };
    });
  }
  function permissionsWriteMap(draft, level) {
    return effectivePermissions(draft, level);
  }
  var PAYE_RATE_NOT_USED_NOTE = "Not used while PAYE. Kept for days they are self-employed.";
  function canManageOperatives(user) {
    const level = permissionLevelOf(user);
    if (level === "operative") return false;
    return effectivePermissions(user, level).operatives === true;
  }
  function canScheduleOperatives(user) {
    return permissionLevelOf(user) !== "operative";
  }
  var MANAGER_PERMISSION_TOGGLES = PERMISSION_TOGGLE_CATALOGUE.filter(
    (row2) => row2.levels.includes("admin")
  ).map((row2) => ({ key: row2.field, title: row2.label, description: row2.help }));
  var OPERATIVE_PERMISSION_TOGGLES = PERMISSION_TOGGLE_CATALOGUE.filter(
    (row2) => row2.levels.includes("operative")
  ).map((row2) => ({ key: row2.field, title: row2.label, description: row2.help }));
  function accountTypePermissions(kind, previous) {
    const out = {};
    for (const key3 of USER_PERMISSION_FIELDS) {
      out[key3] = storedPermissionFlag(previous, key3) ?? PERMISSION_DEFAULT_ON.includes(key3);
    }
    out.adminAccess = kind === "admin";
    out.operativeMode = kind === "operative";
    out.manager = kind !== "operative";
    return out;
  }
  function accountTypeWritePermissions(kind, person, screen) {
    const out = accountTypePermissions(kind, person);
    if (!screen || typeof screen !== "object") return out;
    const locked = new Set(lockedPermissionFields({}, kind));
    for (const row2 of PERMISSION_TOGGLE_CATALOGUE) {
      if (!row2.levels.includes(kind) || locked.has(row2.field)) continue;
      const value = bool(screen[row2.field]);
      if (value != null) out[row2.field] = value;
    }
    return out;
  }
  var ACCOUNT_TYPE_OTHER_COMPANY_NOTE = "This person's profile belongs to another company. Their user type changes here only; their profile in the other company is not changed.";
  var ACCOUNT_TYPE_SUPER_ADMIN_MESSAGE = "The Super Admin stays an administrator. Pass Super Admin to another admin first (Change Super Admin).";
  function sameOrg(value, organizationId) {
    const raw = typeof value === "string" ? value.trim() : "";
    const id2 = raw.includes("/") ? raw.split("/").filter(Boolean).pop() ?? "" : raw;
    return id2 !== "" && id2.toLowerCase() === organizationId.trim().toLowerCase();
  }
  function accountTypeChangeWrites(input) {
    const person = input?.person;
    const org = typeof input?.organizationId === "string" ? input.organizationId.trim() : "";
    const uid = typeof person?.id === "string" ? person.id.trim() : "";
    const kind = input?.kind;
    if (!person || !uid || !org || kind !== "admin" && kind !== "manager" && kind !== "operative") {
      return { ok: false, reason: "invalid", message: "Choose a user type." };
    }
    const otherCompany = person.organizationId != null && String(person.organizationId).trim() !== "" && !sameOrg(person.organizationId, org);
    if (storedPermissionFlag(person, "isSuperAdmin") === true && kind !== "admin") {
      return { ok: false, reason: "super_admin", message: ACCOUNT_TYPE_SUPER_ADMIN_MESSAGE };
    }
    const permissions = accountTypeWritePermissions(kind, person, input.permissions ?? null);
    const fields = { role: kind };
    for (const key3 of USER_PERMISSION_FIELDS) {
      fields[key3] = permissions[key3];
      fields[`permissions.${key3}`] = permissions[key3];
    }
    fields.isSuperAdmin = kind === "admin" && storedPermissionFlag(person, "isSuperAdmin") === true;
    const writes = otherCompany ? [] : [{ path: `users/${uid}`, kind: "userProfile", fields }];
    const email = typeof person.email === "string" ? person.email.trim().toLowerCase() : "";
    if (email) {
      for (const row2 of input.roster || []) {
        const id2 = typeof row2?.id === "string" ? row2.id.trim() : "";
        if (!id2 || id2 === uid) continue;
        if (String(row2.email ?? "").trim().toLowerCase() !== email) continue;
        if (!sameOrg(row2.organizationId, org)) continue;
        writes.push({ path: `users/${id2}`, kind: "userProfile", fields: { ...fields, isSuperAdmin: false } });
      }
    }
    writes.push({ path: `organizations/${org}`, kind: "organizationMember", fields: { [`members.${uid}`]: kind } });
    writes.push({ path: `users/${uid}/orgMemberships/${org}`, kind: "membership", role: kind, permissions });
    return { ok: true, role: kind, permissions, writes, note: otherCompany ? ACCOUNT_TYPE_OTHER_COMPANY_NOTE : null };
  }
  var ACCOUNT_TYPE_OUT_OF_SYNC_MESSAGE = "This person's user type was only partly saved. Press Save to finish it on every record.";
  function accountTypeSyncState(input) {
    const person = input?.person;
    const org = typeof input?.organizationId === "string" ? input.organizationId.trim() : "";
    const uid = typeof person?.id === "string" ? person.id.trim() : "";
    if (!person || !uid || !org || !sameOrg(person.organizationId, org)) {
      return { inSync: true, level: null, membersRole: null, repair: null };
    }
    const level = permissionLevelOf(person);
    const members = input.members && typeof input.members === "object" ? input.members : {};
    const rawEntry = Object.entries(members).find(([key3]) => key3.trim().toLowerCase() === uid.toLowerCase())?.[1];
    const membersRole = typeof rawEntry === "string" && rawEntry.trim() ? rawEntry.trim().toLowerCase() : null;
    const explicit = (role) => role === "admin" || role === "manager" || role === "operative";
    let inSync = membersRole === "admin" === (level === "admin");
    if (inSync && explicit(membersRole) && membersRole !== level) inSync = false;
    const membershipRole = input.membership && typeof input.membership.role === "string" ? input.membership.role.trim().toLowerCase() : null;
    if (inSync && explicit(membershipRole) && membershipRole !== level) inSync = false;
    return { inSync, level, membersRole, repair: inSync ? null : level };
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
  function historyRowBasis(row2) {
    return row2.payBasis === "hourly" ? "hourly" : "day";
  }
  function historyPayRowOnDay(rows3, day, livePayBasis, dayOf) {
    const candidates = rows3.filter((row2) => dayOf(row2.effectiveAt) <= day).slice().sort((a, b) => {
      const byEffective = a.effectiveAt.getTime() - b.effectiveAt.getTime();
      if (byEffective !== 0) return byEffective;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    if (candidates.length === 0) return null;
    if (livePayBasis === "hourly") {
      const hourlyRows = candidates.filter((row2) => historyRowBasis(row2) === "hourly");
      if (hourlyRows.length > 0) {
        const hourly = hourlyRows[hourlyRows.length - 1];
        const hourlyDay = dayOf(hourly.effectiveAt);
        const laterDayRows = candidates.filter(
          (row2) => historyRowBasis(row2) === "day" && dayOf(row2.effectiveAt) > hourlyDay
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
    const personIds = input.person ? personIdSet(input.person, input.roster ?? []) : [];
    const userIds = idSet([
      ...input.userIds && input.userIds.length > 0 ? input.userIds : [user?.id],
      ...personIds
    ]);
    const operativeIds = idSet(input.operativeIds && input.operativeIds.length > 0 ? input.operativeIds : [operative?.id]);
    const seen = /* @__PURE__ */ new Set();
    const rows3 = [];
    (input.history || []).forEach((row2, index) => {
      if (!row2) return;
      const amount = finiteNumber2(row2.dayRate);
      const cleared = row2.dayRate === null;
      const effectiveAt = toDate(row2.effectiveAt);
      if (amount == null && !cleared || !effectiveAt) return;
      const rowUser = String(row2.userId || "").trim();
      const rowOperative = String(row2.operativeId || "").trim();
      if (!(rowUser && userIds.has(rowUser)) && !(rowOperative && operativeIds.has(rowOperative))) return;
      const key3 = String(row2.id || "").trim() || `#${index}`;
      if (seen.has(key3)) return;
      seen.add(key3);
      rows3.push({
        payBasis: cleared ? null : row2.payBasis ?? null,
        dayRate: cleared ? null : amount,
        effectiveAt,
        createdAt: toDate(row2.createdAt) || effectiveAt
      });
    });
    const match = historyPayRowOnDay(rows3, dayKey, live.payBasis, (date) => dayKeyInZone(date, timeZone));
    if (match && match.dayRate == null) {
      return { payBasis: liveBasis, rate: null, employmentType, isPaye: false, hasRate: false, source: "none" };
    }
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
  var HISTORY_DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
  function payRateHistoryWriteFields(input) {
    const timeZone = zoneOrLondon(input.timeZone);
    const userId = String(input.userId || "").trim();
    const operativeId = String(input.operativeId || "").trim();
    if (!userId && !operativeId) return null;
    let dayKey = "";
    if (typeof input.effective === "string" && HISTORY_DAY_KEY.test(input.effective.trim())) {
      dayKey = input.effective.trim();
    } else {
      const instant2 = toDate(input.effective);
      if (!instant2) return null;
      dayKey = dayKeyInZone(instant2, timeZone);
    }
    const amount = finiteNumber2(input.rate);
    return {
      userId,
      operativeId,
      dayRate: amount,
      payBasis: amount == null ? null : input.payBasis === "hourly" ? "hourly" : "day",
      effectiveAtMs: dateFromDayKeyInZone(dayKey, timeZone).getTime(),
      effectiveDayKey: dayKey
    };
  }
  var PAY_BASIS_SAVE_NOTE = "Pay is a day rate or an hourly rate, not both. Saving a day rate removes the hourly rate, and saving an hourly rate removes the day rate.";
  var PAY_BASIS_DAY_HELP = "Day rate pays a share of the standard day. This person cannot also have an hourly rate. Other people can still be paid hourly.";
  var PAY_BASIS_HOURLY_HELP = "Hourly pay is worked hours \xD7 this rate, including 15-minute blocks. This person cannot also have a day rate. Other people can still be on a day rate.";
  var PAY_HISTORY_NOT_LOADED_MESSAGE = "Pay history could not be loaded. Check your connection and save again.";
  function payRateChangeWrites(input) {
    const previous = finiteNumber2(input.previousProfile?.rate);
    const next = finiteNumber2(input.nextProfile?.rate);
    const prevBasis = input.previousProfile?.payBasis === "hourly" ? "hourly" : input.previousProfile?.payBasis === "day" ? "day" : null;
    const nextBasis = input.nextProfile?.payBasis === "hourly" ? "hourly" : "day";
    const base = { userId: input.userId, operativeId: input.operativeId, timeZone: input.timeZone };
    if (next == null) {
      if (previous == null) return { ok: true, rows: [] };
    } else if (previous === next && (prevBasis == null || prevBasis === nextBasis)) {
      return { ok: true, rows: [] };
    }
    if (!Array.isArray(input.history)) {
      return { ok: false, reason: "history_not_loaded", message: PAY_HISTORY_NOT_LOADED_MESSAGE };
    }
    const rows3 = [];
    if (next == null) {
      const cleared = payRateHistoryWriteFields({ ...base, rate: null, effective: input.effectiveDayKey });
      return { ok: true, rows: cleared ? [cleared] : [] };
    }
    if (input.history.length === 0 && previous != null && previous > 0 && input.seedEffective != null) {
      const seed = payRateHistoryWriteFields({
        ...base,
        rate: previous,
        payBasis: prevBasis === "hourly" ? "hourly" : "day",
        effective: input.seedEffective
      });
      if (seed) rows3.push(seed);
    }
    const row2 = payRateHistoryWriteFields({ ...base, rate: next, payBasis: nextBasis, effective: input.effectiveDayKey });
    if (row2) rows3.push(row2);
    return { ok: true, rows: rows3 };
  }
  function roundPennies(amount) {
    return Math.round(Number(amount) * 100) / 100;
  }
  var PAY_STANDARD_DAY_MIN_HOURS = 1;
  function orgDayHours(standardPaidHours) {
    const hours = Number(standardPaidHours);
    return hours > 0 ? hours : 0.01;
  }
  function payForHours(input) {
    const paidHours = Number(input.paidHours);
    if (!(paidHours > 0)) return 0;
    const rawMultiplier = Number(input.otMultiplier ?? 1);
    const multiplier = Number.isFinite(rawMultiplier) && rawMultiplier > 0 ? rawMultiplier : 1;
    const rate = (value) => {
      const n = Number(value ?? 0);
      return Number.isFinite(n) ? n : 0;
    };
    if (input.payBasis === "hourly") return roundPennies(rate(input.hourlyRate) * paidHours * multiplier);
    const standardDay = Number(input.standardDayHours);
    if (!(standardDay >= PAY_STANDARD_DAY_MIN_HOURS)) return 0;
    return roundPennies(rate(input.dayRate) * (paidHours / standardDay) * multiplier);
  }
  var PAY_RATE_REQUIRED_MESSAGE = "Set a day rate or hourly rate \u2014 self-employed people are paid from it.";
  function positiveRate(value) {
    const amount = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value.trim()) : NaN;
    return Number.isFinite(amount) && amount > 0;
  }
  function payRateRequiredError(input) {
    const person = input || {};
    if (normalizeEmploymentType(person.employmentType) !== "self_employed") return null;
    const basis = person.payBasis === "hourly" || person.payBasis === "day" ? person.payBasis : null;
    const ok = basis === "hourly" ? positiveRate(person.hourlyRate) : basis === "day" ? positiveRate(person.dayRate) : positiveRate(person.dayRate) || positiveRate(person.hourlyRate);
    return ok ? null : PAY_RATE_REQUIRED_MESSAGE;
  }
  function usersMissingPayRate(roster) {
    const rows3 = (roster || []).filter((row2) => row2 && typeof row2.id === "string" && row2.id.trim());
    const done = /* @__PURE__ */ new Set();
    const out = [];
    for (const row2 of rows3) {
      const key3 = row2.id.trim().toLowerCase();
      if (done.has(key3)) continue;
      const ids = new Set(personIdSet(row2, rows3).map((id2) => id2.toLowerCase()));
      ids.add(key3);
      const group = rows3.filter((other) => ids.has(other.id.trim().toLowerCase()));
      for (const member of group) done.add(member.id.trim().toLowerCase());
      const active = group.filter((member) => member.isActive !== false && !isAnonymisedDeletedProfile(member));
      if (active.length === 0) continue;
      if (active.some((member) => payRateRequiredError(member) == null)) continue;
      out.push(active[0].id.trim());
    }
    return out;
  }

  // lib/canonical/peopleDocuments.ts
  function text4(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function firstText(row2, keys) {
    for (const key3 of keys) {
      const value = text4(row2[key3]);
      if (value) return value;
    }
    return "";
  }
  function optionalText(value) {
    return text4(value) || null;
  }
  function documentBool(value) {
    if (value === true || value === false) return value;
    if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
    if (typeof value === "string") {
      const token = value.trim().toLowerCase();
      if (token === "true" || token === "yes" || token === "1") return true;
      if (token === "false" || token === "no" || token === "0") return false;
    }
    return null;
  }
  function documentNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value.trim());
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }
  function documentInstantMs(raw) {
    if (raw == null || raw === "") return null;
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.getTime();
    if (typeof raw === "number") {
      if (!Number.isFinite(raw) || raw <= 0) return null;
      return raw > 1e10 ? raw : raw * 1e3;
    }
    if (typeof raw === "string") {
      const value = raw.trim();
      if (!value) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const ms2 = Date.parse(`${value}T12:00:00Z`);
        return Number.isNaN(ms2) ? null : ms2;
      }
      const ms = Date.parse(value);
      return Number.isNaN(ms) ? null : ms;
    }
    if (typeof raw === "object") {
      const row2 = raw;
      const seconds = typeof row2.seconds === "number" ? row2.seconds : typeof row2._seconds === "number" ? row2._seconds : null;
      if (seconds != null && Number.isFinite(seconds)) {
        const nanos = typeof row2.nanoseconds === "number" ? row2.nanoseconds : typeof row2._nanoseconds === "number" ? row2._nanoseconds : 0;
        return seconds * 1e3 + Math.floor((Number(nanos) || 0) / 1e6);
      }
      if (typeof row2.toMillis === "function") {
        try {
          const ms = row2.toMillis();
          if (typeof ms === "number" && Number.isFinite(ms)) return ms;
        } catch {
          return null;
        }
      }
      if (typeof row2.toDate === "function") {
        try {
          const date = row2.toDate();
          if (date instanceof Date && !Number.isNaN(date.getTime())) return date.getTime();
        } catch {
          return null;
        }
      }
    }
    return null;
  }
  function documentOrganizationId(raw) {
    if (raw == null) return null;
    if (typeof raw === "string") {
      const value = raw.trim();
      if (!value) return null;
      const segments = value.split("/").filter(Boolean);
      const at = segments.lastIndexOf("organizations");
      if (at >= 0) return segments[at + 1] || null;
      return segments.length === 1 ? segments[0] : segments[segments.length - 1] || null;
    }
    if (typeof raw === "object") {
      const row2 = raw;
      if (typeof row2.path === "string" && row2.path.trim()) return documentOrganizationId(row2.path);
      const segments = row2._key?.path?.segments;
      if (Array.isArray(segments) && segments.length > 0) {
        return documentOrganizationId(segments.map((part) => String(part)).join("/"));
      }
      if (typeof row2.id === "string" && row2.id.trim()) return row2.id.trim();
    }
    return null;
  }
  function dayKeyOf(ms, zone3) {
    return ms == null ? null : dayKeyInZone(new Date(ms), zone3);
  }
  function idList2(value) {
    if (!Array.isArray(value)) return [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const entry of value) {
      const id2 = text4(entry);
      if (!id2 || seen.has(id2)) continue;
      seen.add(id2);
      out.push(id2);
    }
    return out;
  }
  function flagIn(data, key3) {
    const top = documentBool(data[key3]);
    if (top != null) return top;
    const nested = data.permissions;
    if (nested && typeof nested === "object") return documentBool(nested[key3]);
    return null;
  }
  function splitName(full) {
    const parts = full.trim().split(/\s+/);
    if (!parts[0]) return { first: "", last: "" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
  }
  function storedPay(data) {
    return readStoredRates({
      payBasis: text4(data.payBasis).toLowerCase() || null,
      dayRate: documentNumber(data.dayRate),
      hourlyRate: documentNumber(data.hourlyRate)
    });
  }
  var USER_DOCUMENT_KEYS = {
    firstName: ["firstName", "givenName"],
    surname: ["surname", "lastName", "familyName"],
    combinedName: ["displayName", "name"],
    mobileNumber: ["mobileNumber", "mobile", "phone", "phoneNumber"],
    profilePhotoURL: ["profilePhotoURL", "photoURL"]
  };
  var ROLE_TOKENS = ["basic", "admin", "manager", "operative", "viewer"];
  function normalizeUserRoleToken(raw) {
    const token = text4(raw).toLowerCase();
    if (ROLE_TOKENS.includes(token)) return token;
    if (token.includes("operat")) return "operative";
    if (token.includes("admin")) return "admin";
    if (token.includes("manag")) return "manager";
    return "viewer";
  }
  function defaultTimesheetsEnabled(input) {
    if (input.operativeMode === true) return true;
    return normalizeEmploymentType(input.employmentType) === "self_employed";
  }
  function wholeMonth(value) {
    const n = documentNumber(value);
    if (n == null) return null;
    const month = Math.trunc(n);
    return month >= 1 && month <= 12 ? month : null;
  }
  function parseUserDocument(docId, data, options) {
    const id2 = text4(docId);
    if (!id2) return null;
    const row2 = data && typeof data === "object" ? data : {};
    const zone3 = zoneOrLondon(options?.timeZone);
    const orgDefaults = options?.annualLeaveDefaults ? parseAnnualLeaveDefaults(options.annualLeaveDefaults) : { ...DEFAULT_ANNUAL_LEAVE };
    const leaveDefaults = {
      daysPerYear: Number.isFinite(orgDefaults.daysPerYear) ? orgDefaults.daysPerYear : DEFAULT_ANNUAL_LEAVE.daysPerYear,
      startMonth: wholeMonth(orgDefaults.startMonth) ?? DEFAULT_ANNUAL_LEAVE.startMonth,
      endMonth: wholeMonth(orgDefaults.endMonth) ?? DEFAULT_ANNUAL_LEAVE.endMonth,
      carriesOver: orgDefaults.carriesOver === true
    };
    const email = text4(row2.email);
    let firstName = firstText(row2, USER_DOCUMENT_KEYS.firstName);
    let surname = firstText(row2, USER_DOCUMENT_KEYS.surname);
    const combined = firstText(row2, USER_DOCUMENT_KEYS.combinedName);
    if (!firstName && !surname && combined) {
      const parts = splitName(combined);
      firstName = parts.first;
      surname = parts.last;
    }
    const displayName = `${firstName} ${surname}`.trim() || combined;
    const role = normalizeUserRoleToken(row2.role);
    const isSuperAdmin = flagIn(row2, "isSuperAdmin") === true;
    const adminAccessStored = flagIn(row2, "adminAccess") === true;
    const operativeModeStored = flagIn(row2, "operativeMode") === true;
    const keepsAdmin = isSuperAdmin || adminAccessStored || role === "admin";
    const operativeMode = operativeModeStored && !keepsAdmin;
    const flag = (key3, fallback) => {
      const value = flagIn(row2, key3);
      return value == null ? fallback : value;
    };
    const permissions = effectivePermissions(row2);
    const hasNoLineManager = flagIn(row2, "hasNoLineManager") === true;
    let managers = hasNoLineManager ? [] : idList2(row2.assignedManagerUserIds);
    if (!hasNoLineManager && managers.length === 0) {
      const legacy = text4(row2.assignedManagerUserId);
      if (legacy) managers = [legacy];
    }
    const pay = storedPay(row2);
    const employmentType = normalizeEmploymentType(text4(row2.employmentType) || null);
    const transitionRaw = text4(row2.employmentTypeTransitionFrom);
    const effectiveAtMs = documentInstantMs(row2.employmentTypeEffectiveAt);
    const transitionFrom = transitionRaw && effectiveAtMs != null ? normalizeEmploymentType(transitionRaw) : null;
    const leaveStored = {
      daysPerYear: documentNumber(row2.annualLeaveDaysPerYear),
      startMonth: wholeMonth(row2.annualLeaveYearStartMonth),
      endMonth: wholeMonth(row2.annualLeaveYearEndMonth),
      carriesOver: flagIn(row2, "annualLeaveCarriesOver")
    };
    const timesheetsStored = flagIn(row2, "timesheetsEnabled");
    return {
      id: id2,
      email,
      emailKey: email.toLowerCase(),
      firstName,
      surname,
      displayName,
      mobileNumber: firstText(row2, USER_DOCUMENT_KEYS.mobileNumber) || null,
      organizationId: documentOrganizationId(row2.organizationId),
      role: operativeMode ? "operative" : role,
      isSuperAdmin: operativeMode ? false : isSuperAdmin,
      operativeModeStored,
      operativeMode,
      accountKind: accountKindFromFlags({ isSuperAdmin, role, adminAccess: adminAccessStored, operativeMode }),
      adminOutsideOperativeMode: isAdminOutsideOperativeMode({
        role,
        isSuperAdmin,
        adminAccess: adminAccessStored,
        operativeMode
      }),
      permissions,
      isActive: documentBool(row2.isActive) ?? true,
      passwordSet: flagIn(row2, "passwordSet") ?? true,
      status: optionalText(row2.status),
      assignedManagerUserIds: managers,
      assignedManagerUserId: managers[0] ?? null,
      hasNoLineManager,
      formerUserIds: parseFormerUserIds(row2),
      payBasis: pay.payBasis,
      dayRate: pay.payBasis === "day" ? pay.dayRate : null,
      hourlyRate: pay.payBasis === "hourly" ? pay.hourlyRate : null,
      employmentType,
      employmentTypeTransitionFrom: transitionFrom,
      employmentTypeEffectiveAtMs: transitionFrom ? effectiveAtMs : null,
      employmentTypeEffectiveDayKey: transitionFrom ? dayKeyOf(effectiveAtMs, zone3) : null,
      annualLeaveEnabled: flagIn(row2, "annualLeaveEnabled") ?? true,
      annualLeaveDaysPerYear: leaveStored.daysPerYear ?? leaveDefaults.daysPerYear,
      annualLeaveYearStartMonth: leaveStored.startMonth ?? leaveDefaults.startMonth,
      annualLeaveYearEndMonth: leaveStored.endMonth ?? leaveDefaults.endMonth,
      annualLeaveCarriesOver: leaveStored.carriesOver ?? leaveDefaults.carriesOver,
      employmentStartDayKey: /^\d{4}-\d{2}-\d{2}$/.test(text4(row2.employmentStartDate)) ? text4(row2.employmentStartDate) : dayKeyOf(documentInstantMs(row2.employmentStartDate), zone3),
      annualLeaveStored: leaveStored,
      annualLeaveDefaultsPending: !options?.annualLeaveDefaults && (leaveStored.daysPerYear == null || leaveStored.startMonth == null || leaveStored.endMonth == null || leaveStored.carriesOver == null),
      annualLeaveYearAllowance: documentNumber(row2.annualLeaveYearAllowance),
      annualLeaveYearAllowanceKey: optionalText(row2.annualLeaveYearAllowanceKey),
      timesheetsEnabled: timesheetsStored ?? defaultTimesheetsEnabled({ operativeMode, employmentType }),
      timesheetsEnabledStored: timesheetsStored,
      tradeTypePreset: optionalText(row2.tradeTypePreset),
      tradeTypeCustom: optionalText(row2.tradeTypeCustom),
      profilePhotoURL: firstText(row2, USER_DOCUMENT_KEYS.profilePhotoURL) || null,
      profilePhotoUpdatedAtMs: documentInstantMs(row2.profilePhotoUpdatedAt),
      lastSeenAtMs: documentInstantMs(row2.lastSeenAt),
      policyAccepted: flagIn(row2, "policyAccepted") === true,
      policyAcceptedAtMs: documentInstantMs(row2.policyAcceptedAt),
      legalPackVersion: optionalText(row2.legalPackVersion),
      createdAtMs: documentInstantMs(row2.createdAt),
      updatedAtMs: documentInstantMs(row2.updatedAt),
      isAnonymisedDeleted: isAnonymisedDeletedProfile({
        email,
        firstName,
        surname,
        name: text4(row2.name),
        displayName: text4(row2.displayName)
      })
    };
  }
  var ROSTER_DOCUMENT_KEYS = {
    lastName: ["lastName", "surname"],
    phone: ["phone", "mobileNumber", "mobile", "phoneNumber"],
    mobile: ["mobileNumber", "mobile", "phone", "phoneNumber"],
    linkedUserId: ["linkedUserId", "userId", "uid"]
  };
  function rosterNames(row2) {
    let firstName = text4(row2.firstName);
    let lastName = firstText(row2, ROSTER_DOCUMENT_KEYS.lastName);
    const stored = text4(row2.name) || text4(row2.displayName);
    if (!firstName && !lastName && stored) {
      const parts = splitName(stored);
      firstName = parts.first;
      lastName = parts.last;
    }
    return { firstName, lastName, name: `${firstName} ${lastName}`.trim() || stored };
  }
  function isPlaceholderRow(id2, name, email) {
    if (id2 === "INITIAL-PLACEHOLDER") return true;
    const n = name.toLowerCase();
    const e = email.toLowerCase();
    return n.includes("placeholder") || e.includes("placeholder") || n.includes("initial operative");
  }
  function parseQualifications(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const row2 = entry;
      const id2 = text4(row2.id);
      const name = text4(row2.name);
      if (!id2 || !name) continue;
      out.push({
        id: id2,
        name,
        hasEndDate: documentBool(row2.hasEndDate) === true,
        endDateMs: documentInstantMs(row2.endDate),
        createdAtMs: documentInstantMs(row2.createdAt),
        updatedAtMs: documentInstantMs(row2.updatedAt)
      });
    }
    return out;
  }
  function parseInstantMap(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const [key3, value] of Object.entries(raw)) {
      const id2 = key3.trim();
      const ms = documentInstantMs(value);
      if (id2 && ms != null) out[id2] = ms;
    }
    return out;
  }
  function parseTextMap(raw) {
    const out = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
    for (const [key3, value] of Object.entries(raw)) {
      const id2 = key3.trim();
      const url = text4(value);
      if (id2 && url) out[id2] = url;
    }
    return out;
  }
  function parseSkillTokens(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const entry of raw) {
      let token = "";
      if (typeof entry === "string") token = entry.trim();
      else if (entry && typeof entry === "object") {
        const row2 = entry;
        token = text4(row2.id) || text4(row2.name);
      }
      if (!token || seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
    return out;
  }
  function rosterPay(row2) {
    const pay = storedPay(row2);
    return {
      payBasis: pay.payBasis,
      dayRate: pay.payBasis === "day" ? pay.dayRate : null,
      hourlyRate: pay.payBasis === "hourly" ? pay.hourlyRate : null
    };
  }
  function parseOperativeDocument(docId, data, timeZone) {
    const id2 = text4(docId);
    if (!id2) return null;
    const row2 = data && typeof data === "object" ? data : {};
    const zone3 = zoneOrLondon(timeZone);
    const names = rosterNames(row2);
    const email = text4(row2.email);
    if (!names.name && !email) return null;
    const startDateMs = documentInstantMs(row2.startDate) ?? documentInstantMs(row2.createdAt);
    const startRaw = text4(row2.startDate);
    const startDayKey = /^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? startRaw : dayKeyOf(startDateMs, zone3);
    return {
      id: id2,
      ...names,
      email,
      emailKey: email.toLowerCase(),
      phone: firstText(row2, ROSTER_DOCUMENT_KEYS.phone) || null,
      linkedUserId: firstText(row2, ROSTER_DOCUMENT_KEYS.linkedUserId) || null,
      startDayKey,
      startDateMs,
      skills: parseSkillTokens(row2.skills),
      qualifications: parseQualifications(row2.qualifications),
      qualificationExpiryDates: parseInstantMap(row2.qualificationExpiryDates),
      qualificationCertificateURLs: parseTextMap(row2.qualificationCertificateURLs),
      isActive: documentBool(row2.isActive) ?? true,
      ...rosterPay(row2),
      currencySymbol: optionalText(row2.currencySymbol),
      notes: optionalText(row2.notes),
      tradeTypePreset: optionalText(row2.tradeTypePreset),
      tradeTypeCustom: optionalText(row2.tradeTypeCustom),
      organizationId: documentOrganizationId(row2.organizationId),
      createdAtMs: documentInstantMs(row2.createdAt),
      updatedAtMs: documentInstantMs(row2.updatedAt),
      isPlaceholder: isPlaceholderRow(id2, names.name, email)
    };
  }
  function parseManagerDocument(docId, data) {
    const id2 = text4(docId);
    if (!id2) return null;
    const row2 = data && typeof data === "object" ? data : {};
    const names = rosterNames(row2);
    const email = text4(row2.email);
    if (!names.name && !email) return null;
    return {
      id: id2,
      ...names,
      email,
      emailKey: email.toLowerCase(),
      mobile: firstText(row2, ROSTER_DOCUMENT_KEYS.mobile) || null,
      phone: firstText(row2, ROSTER_DOCUMENT_KEYS.phone) || null,
      linkedUserId: firstText(row2, ROSTER_DOCUMENT_KEYS.linkedUserId) || null,
      department: optionalText(row2.department),
      isActive: documentBool(row2.isActive) ?? true,
      ...rosterPay(row2),
      notes: optionalText(row2.notes),
      tradeTypePreset: optionalText(row2.tradeTypePreset),
      tradeTypeCustom: optionalText(row2.tradeTypeCustom),
      organizationId: documentOrganizationId(row2.organizationId),
      createdAtMs: documentInstantMs(row2.createdAt),
      updatedAtMs: documentInstantMs(row2.updatedAt),
      isPlaceholder: isPlaceholderRow(id2, names.name, email)
    };
  }
  function parsePayRateHistoryDocument(docId, data, timeZone) {
    const id2 = text4(docId);
    if (!id2) return null;
    const row2 = data && typeof data === "object" ? data : {};
    const cleared = row2.dayRate === null;
    const amount = documentNumber(row2.dayRate);
    if (!cleared && amount == null) return null;
    const effectiveAt = documentInstantMs(row2.effectiveAt);
    if (effectiveAt == null) return null;
    const userId = text4(row2.userId) || null;
    const operativeId = text4(row2.operativeId) || null;
    if (!userId && !operativeId) return null;
    const basis = text4(row2.payBasis).toLowerCase();
    return {
      id: id2,
      userId,
      operativeId,
      dayRate: cleared ? null : amount,
      cleared,
      payBasis: cleared ? null : basis === "hourly" ? "hourly" : "day",
      effectiveAt,
      createdAt: documentInstantMs(row2.createdAt) ?? effectiveAt,
      effectiveDayKey: dayKeyInZone(new Date(effectiveAt), zoneOrLondon(timeZone))
    };
  }
  function parsePayRateHistoryDocuments(docs, timeZone) {
    const out = [];
    for (const entry of docs || []) {
      const parsed = parsePayRateHistoryDocument(entry?.id, entry?.data, timeZone);
      if (parsed) out.push(parsed);
    }
    return out.sort((a, b) => a.effectiveAt - b.effectiveAt || a.createdAt - b.createdAt);
  }
  function parseClientDocument(docId, data) {
    const id2 = text4(docId);
    if (!id2) return null;
    const row2 = data && typeof data === "object" ? data : {};
    const name = text4(row2.name);
    if (!name) return null;
    return {
      id: id2,
      name,
      contactPerson: optionalText(row2.contactPerson),
      email: optionalText(row2.email),
      phone: optionalText(row2.phone),
      address: optionalText(row2.address),
      organizationId: documentOrganizationId(row2.organizationId),
      createdAtMs: documentInstantMs(row2.createdAt),
      updatedAtMs: documentInstantMs(row2.updatedAt)
    };
  }
  function subcontractorContactId(firmDocId, index, contact) {
    const row2 = contact && typeof contact === "object" ? contact : {};
    return derivedRowId(firmDocId, "contacts", index, [text4(row2.name), text4(row2.email).toLowerCase()]);
  }
  function parseSubcontractorDocument(docId, data) {
    const id2 = text4(docId);
    if (!id2) return null;
    const row2 = data && typeof data === "object" ? data : {};
    const name = text4(row2.name);
    const subcontractorType = text4(row2.subcontractorType);
    if (!name || !subcontractorType) return null;
    const contacts = [];
    if (Array.isArray(row2.contacts)) {
      for (const [index, entry] of row2.contacts.entries()) {
        if (!entry || typeof entry !== "object") continue;
        const contact = entry;
        const contactName = text4(contact.name);
        if (!contactName) continue;
        const storedContactId = text4(contact.id) || text4(contact.uuid) || text4(contact.contactId);
        contacts.push({
          id: storedContactId || subcontractorContactId(id2, index, contact),
          idStored: Boolean(storedContactId),
          name: contactName,
          email: text4(contact.email),
          contactNumber: text4(contact.contactNumber),
          position: text4(contact.position) || "Installer",
          tradeType: optionalText(contact.tradeType),
          createdAtMs: documentInstantMs(contact.createdAt)
        });
      }
    }
    const createdAtMs = documentInstantMs(row2.createdAt);
    return {
      id: id2,
      name,
      subcontractorType,
      website: optionalText(row2.website),
      address: optionalText(row2.address),
      contacts,
      createdAtMs,
      updatedAtMs: documentInstantMs(row2.updatedAt) ?? createdAtMs
    };
  }
  function parseSkillDocument(docId, data) {
    const id2 = text4(docId);
    if (!id2) return null;
    const row2 = data && typeof data === "object" ? data : {};
    const name = text4(row2.name);
    if (!name) return null;
    const createdAtMs = documentInstantMs(row2.createdAt);
    return {
      id: id2,
      name,
      trade: text4(row2.trade),
      createdAtMs,
      updatedAtMs: documentInstantMs(row2.updatedAt) ?? createdAtMs
    };
  }
  function skillsCatalogueWrites(input) {
    const storedById = /* @__PURE__ */ new Map();
    for (const row2 of input.stored || []) if (text4(row2?.id)) storedById.set(text4(row2.id), row2);
    const nextIds = /* @__PURE__ */ new Set();
    const write = [];
    for (const skill of input.next || []) {
      const id2 = text4(skill?.id);
      const name = text4(skill?.name);
      if (!id2 || !name) continue;
      nextIds.add(id2);
      const trade = text4(skill.trade);
      const before = storedById.get(id2);
      const set = {};
      if (!before || text4(before.name) !== name) set.name = name;
      if (!before ? Boolean(trade) : text4(before.trade) !== trade) set.trade = trade;
      if (Object.keys(set).length > 0) write.push({ id: id2, set });
    }
    const remove = input.loaded && nextIds.size > 0 ? [...storedById.keys()].filter((id2) => !nextIds.has(id2)) : [];
    return { write, remove };
  }
  function documentValueKey(value) {
    if (value === void 0) return "undefined";
    if (value === null) return "null";
    if (value instanceof Date) return `ts:${value.getTime()}`;
    if (Array.isArray(value)) return `[${value.map(documentValueKey).join(",")}]`;
    if (typeof value === "object") {
      const row2 = value;
      const looksLikeInstant = typeof row2.seconds === "number" || typeof row2._seconds === "number" || typeof row2.toMillis === "function" || typeof row2.toDate === "function";
      if (looksLikeInstant) {
        const ms = documentInstantMs(value);
        if (ms != null) return `ts:${ms}`;
      }
      return `{${Object.keys(row2).sort().map((key3) => `${JSON.stringify(key3)}:${documentValueKey(row2[key3])}`).join(",")}}`;
    }
    return JSON.stringify(value) ?? String(value);
  }
  var USER_ANNUAL_LEAVE_FIGURE_FIELDS = [
    ["annualLeaveDaysPerYear", "daysPerYear"],
    ["annualLeaveYearStartMonth", "startMonth"],
    ["annualLeaveYearEndMonth", "endMonth"],
    ["annualLeaveCarriesOver", "carriesOver"]
  ];
  function annualLeavePendingOmitFields(user, edited) {
    if (!user?.annualLeaveDefaultsPending) return [];
    const changed = new Set(edited || []);
    const stored = user.annualLeaveStored || {};
    return USER_ANNUAL_LEAVE_FIGURE_FIELDS.filter(([field, key3]) => stored[key3] == null && !changed.has(field)).map(
      ([field]) => field
    );
  }
  function hasValue(row2, key3) {
    return Boolean(row2) && row2[key3] !== void 0 && row2[key3] !== null;
  }
  function documentWriteFields(before, next, options) {
    const set = {};
    const remove = [];
    const source = next && typeof next === "object" ? next : {};
    if (!before) {
      for (const [key3, value] of Object.entries(source)) {
        if (value !== void 0 && value !== null) set[key3] = value;
      }
      return { set, remove };
    }
    const createOnly = new Set(options?.createOnly || []);
    const changed = /* @__PURE__ */ new Set();
    for (const [key3, value] of Object.entries(source)) {
      if (value === void 0 || createOnly.has(key3)) continue;
      if (value === null) {
        if (hasValue(before, key3)) changed.add(key3);
        continue;
      }
      if (documentValueKey(value) !== documentValueKey(before[key3])) changed.add(key3);
    }
    for (const group of options?.together || []) {
      if (!group.some((key3) => changed.has(key3))) continue;
      for (const key3 of group) {
        if (createOnly.has(key3) || source[key3] === void 0) continue;
        if (source[key3] === null) {
          if (hasValue(before, key3)) changed.add(key3);
        } else changed.add(key3);
      }
    }
    for (const key3 of Object.keys(source)) {
      if (!changed.has(key3)) continue;
      if (source[key3] === null) remove.push(key3);
      else set[key3] = source[key3];
    }
    return { set, remove };
  }
  var LINE_MANAGER_WRITE_GROUP = ["assignedManagerUserIds", "assignedManagerUserId", "hasNoLineManager"];
  var PAY_WRITE_GROUP = ["payBasis", "dayRate", "hourlyRate"];
  var EMPLOYMENT_WRITE_GROUP = ["employmentType", "employmentTypeTransitionFrom", "employmentTypeEffectiveAt"];
  var USER_NAME_WRITE_GROUP = ["firstName", "surname", "lastName", "name", "displayName"];
  var ROSTER_NAME_WRITE_GROUP = ["firstName", "lastName", "name"];
  var CREATE_ONLY_FIELDS = ["id", "createdAt", "organizationId"];
  function userProfileWriteFields(before, next) {
    return documentWriteFields(before, keepStoredLockedPermissions(before, next), {
      together: [LINE_MANAGER_WRITE_GROUP, PAY_WRITE_GROUP, EMPLOYMENT_WRITE_GROUP, USER_NAME_WRITE_GROUP],
      createOnly: ["createdAt", "organizationId"]
    });
  }
  function operativeRowWriteFields(before, next) {
    return documentWriteFields(before, next, {
      together: [PAY_WRITE_GROUP, ROSTER_NAME_WRITE_GROUP],
      createOnly: CREATE_ONLY_FIELDS
    });
  }
  function managerRowWriteFields(before, next) {
    return documentWriteFields(before, next, {
      together: [PAY_WRITE_GROUP, ROSTER_NAME_WRITE_GROUP],
      createOnly: CREATE_ONLY_FIELDS
    });
  }
  function clientWriteFields(before, next) {
    return documentWriteFields(before, next, { createOnly: CREATE_ONLY_FIELDS });
  }
  function subcontractorWriteFields(before, next) {
    return documentWriteFields(before, next, { createOnly: CREATE_ONLY_FIELDS });
  }
  var DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  function timesheetEmploymentOnDayKey(user, dayKey, zone3) {
    const current = normalizeEmploymentType(text4(user.employmentType) || null);
    const from = text4(user.employmentTypeTransitionFrom);
    const effectiveMs = documentInstantMs(user.employmentTypeEffectiveAt);
    if (!from || effectiveMs == null) return current;
    return dayKey < dayKeyInZone(new Date(effectiveMs), zone3) ? normalizeEmploymentType(from) : current;
  }
  function timesheetDaysForPerson(user, period, timeZone) {
    if (!user || user.isActive === false) return [];
    if (isAnonymisedDeletedProfile({ email: user.email ?? "", name: user.name ?? "" })) return [];
    const start = text4(period?.startDayKey);
    const end = text4(period?.endDayKey);
    if (!DAY_KEY_PATTERN.test(start) || !DAY_KEY_PATTERN.test(end) || start > end) return [];
    const zone3 = zoneOrLondon(timeZone);
    return eachDayKey(start, end, zone3).filter((day) => timesheetEmploymentOnDayKey(user, day, zone3) === "self_employed");
  }
  function showsMyTimesheets(user, period, timeZone) {
    return timesheetDaysForPerson(user, period, timeZone).length > 0;
  }
  function timesheetParticipant(user, dayOrPeriod, timeZone) {
    if (!user) return false;
    const zone3 = zoneOrLondon(timeZone);
    if (dayOrPeriod && typeof dayOrPeriod === "object" && !(dayOrPeriod instanceof Date)) {
      return showsMyTimesheets(user, dayOrPeriod, zone3);
    }
    const when = dayOrPeriod instanceof Date ? dayOrPeriod : new Date(dayOrPeriod);
    if (Number.isNaN(when.getTime())) return false;
    const key3 = dayKeyInZone(when, zone3);
    return showsMyTimesheets(user, { startDayKey: key3, endDayKey: key3 }, zone3);
  }

  // lib/canonical/scheduleSources.ts
  var DAY_KEY2 = /^\d{4}-\d{2}-\d{2}$/;
  function idText2(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function idKey5(value) {
    return idText2(value).toLowerCase();
  }
  function emailKey3(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  function dayKeyText(value) {
    const text23 = typeof value === "string" ? value.trim() : "";
    return DAY_KEY2.test(text23) ? text23 : null;
  }
  function compareText(a, b) {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  function uniqueIds(values, without) {
    const skip = new Set(without.map(idKey5));
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const raw of values) {
      const id2 = idText2(raw);
      const key3 = id2.toLowerCase();
      if (!id2 || skip.has(key3) || seen.has(key3)) continue;
      seen.add(key3);
      out.push(id2);
    }
    return out.sort(compareText);
  }
  function rosterDocumentRank(doc) {
    let rank = 0;
    if (doc.passwordSet === true) rank += 4;
    if (doc.listed === true) rank += 2;
    if (idText2(doc.firstName) || idText2(doc.surname)) rank += 1;
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
    return compareText(idKey5(incoming.id), idKey5(existing.id)) < 0;
  }
  function rosterPeople(docs) {
    const seenIds = /* @__PURE__ */ new Set();
    const order = [];
    const groups = /* @__PURE__ */ new Map();
    for (const doc of docs || []) {
      const id2 = idText2(doc?.id);
      if (!id2 || seenIds.has(id2.toLowerCase())) continue;
      seenIds.add(id2.toLowerCase());
      const email = emailKey3(doc.email);
      const key3 = email || `id:${id2.toLowerCase()}`;
      const list = groups.get(key3);
      if (list) list.push(doc);
      else {
        groups.set(key3, [doc]);
        order.push(key3);
      }
    }
    const people = [];
    const userIdAliases = {};
    for (const key3 of order) {
      const group = groups.get(key3) || [];
      let kept = group[0];
      for (const doc of group.slice(1)) if (rosterKeeps(kept, doc)) kept = doc;
      const keptId = idText2(kept.id);
      const aliases = [];
      const former = [];
      for (const doc of group) {
        aliases.push(...doc.sameEmailUserIds || []);
        former.push(...doc.formerUserIds || []);
        if (doc !== kept) {
          aliases.push(doc.id);
          userIdAliases[idText2(doc.id)] = keptId;
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
    const needed = (input?.neededDayKeys || []).map(dayKeyText).filter((key3) => Boolean(key3));
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
      const key3 = idKey5(work?.id);
      if (!key3 || key3 === "initial-placeholder" || seen.has(key3)) continue;
      seen.add(key3);
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
      const text23 = idText2(id2);
      if (text23) managerIdByKey.set(text23.toLowerCase(), text23);
    }
    const people = input?.people || { accounts: [], operatives: [] };
    const managerIdByEmail = /* @__PURE__ */ new Map();
    for (const account of people.accounts || []) {
      const kept = managerIdByKey.get(idKey5(account.id));
      const email = emailKey3(account.email);
      if (kept && email && !managerIdByEmail.has(email)) managerIdByEmail.set(email, kept);
    }
    const ownerOf = (storedId) => {
      const direct = managerIdByKey.get(idKey5(storedId));
      const person = resolveBookingPerson(storedId, people);
      const account = person.accountId ? managerIdByKey.get(idKey5(person.accountId)) : void 0;
      if (account) return account;
      if (direct) return direct;
      return person.email ? managerIdByEmail.get(person.email) ?? null : null;
    };
    const days = /* @__PURE__ */ new Map();
    const seenPairIds = /* @__PURE__ */ new Set();
    const push = (userId, dayKey, item) => {
      if (seenPairIds.has(item.pairId.toLowerCase())) return;
      seenPairIds.add(item.pairId.toLowerCase());
      const key3 = `${userId}|${dayKey}`;
      const day = days.get(key3) || { userId, dayKey, items: [] };
      day.items.push(item);
      days.set(key3, day);
    };
    (input?.managerBookings || []).forEach((booking, index) => {
      const id2 = idText2(booking?.id);
      const day = dayKeyText(booking?.dayKey);
      if (!id2 || !day || !occupiesDay(booking.status)) return;
      const owner = ownerOf(idText2(booking.userId));
      if (owner) push(owner, day, { kind: "manager", bookingId: id2, pairId: `m-${id2}`, index });
    });
    (input?.operativeBookings || []).forEach((booking, index) => {
      const id2 = idText2(booking?.id);
      const day = dayKeyText(booking?.dayKey);
      if (!id2 || !day || !occupiesDay(booking.status)) return;
      const owner = ownerOf(idText2(booking.operativeId));
      if (owner) push(owner, day, { kind: "operative", bookingId: id2, pairId: `o-${id2}`, index });
    });
    return Array.from(days.values()).map((day) => ({ ...day, items: [...day.items].sort((a, b) => compareText(a.pairId, b.pairId)) })).sort((a, b) => compareText(a.dayKey, b.dayKey) || compareText(a.userId, b.userId));
  }
  function managerClashGroups(input) {
    const groups = [];
    const seen = /* @__PURE__ */ new Set();
    const intervalOf = (item) => {
      const booking = item.kind === "manager" ? input.managerBookings[item.index] : input.operativeBookings[item.index];
      return slotInterval(
        { timeSlot: booking?.timeSlot, workStartTime: booking?.workStartTime, workEndTime: booking?.workEndTime },
        input.day
      );
    };
    const personDays = personDayItems(input);
    const carried = /* @__PURE__ */ new Map();
    for (const personDay of personDays) {
      const next = nextCalendarDayKey(personDay.dayKey);
      if (!next) continue;
      for (const item of personDay.items) {
        if (!intervalCrossesMidnight(intervalOf(item))) continue;
        const key3 = `${personDay.userId}|${next}`;
        carried.set(key3, [...carried.get(key3) || [], item]);
      }
    }
    for (const personDay of personDays) {
      const carriedIn = carried.get(`${personDay.userId}|${personDay.dayKey}`) || [];
      if (personDay.items.length + carriedIn.length < 2) continue;
      const entries = [
        ...personDay.items.map((item) => ({ item, carried: false })),
        ...carriedIn.map((item) => ({ item, carried: true }))
      ].sort((a, b) => compareText(a.item.pairId, b.item.pairId));
      const intervals = entries.map(
        (entry) => entry.carried ? overnightCarryInterval(intervalOf(entry.item)) : intervalOf(entry.item)
      );
      overlappingIntervalGroups(intervals).forEach((indexes, clusterIndex) => {
        if (indexes.every((i) => entries[i].carried)) return;
        const items = indexes.map((i) => ({ ...entries[i].item, interval: intervals[i] })).sort((a, b) => compareText(a.pairId, b.pairId));
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
    return [idText2(bookingAId), idText2(bookingBId)].sort(compareText).join("|");
  }
  function isClashAccepted(bookingAId, bookingBId, accepted) {
    const a = idKey5(bookingAId);
    const b = idKey5(bookingBId);
    if (!a || !b) return false;
    const key3 = clashPairKey(a, b);
    const savedKey = (raw) => {
      const [first, second, ...rest] = idKey5(raw).split("|");
      return first && second && rest.length === 0 ? clashPairKey(first, second) : "";
    };
    return (accepted || []).some((row2) => {
      if (typeof row2 === "string") return savedKey(row2) === key3;
      if (!row2) return false;
      if (savedKey(row2.id) === key3) return true;
      const rowA = idKey5(row2.bookingAId);
      const rowB = idKey5(row2.bookingBId);
      return Boolean(rowA && rowB) && clashPairKey(rowA, rowB) === key3;
    });
  }
  function validDocumentId(id2) {
    return Boolean(id2) && !id2.includes("/") && id2 !== "." && id2 !== ".." && !/^__.*__$/.test(id2) && id2.length <= 1500;
  }
  function acceptedClashWriteFields(input) {
    const a = idText2(input?.bookingAId);
    const b = idText2(input?.bookingBId);
    const by = idText2(input?.acceptedByUserId);
    if (!a || !b || !by || a.toLowerCase() === b.toLowerCase()) return null;
    const documentId2 = clashPairKey(a, b);
    if (!validDocumentId(documentId2)) return null;
    return { documentId: documentId2, fields: { bookingAId: a, bookingBId: b, acceptedByUserId: by } };
  }
  var WARNING_RESOLUTION_STATUSES = ["approved", "dismissed"];
  function warningResolutionWriteFields(input) {
    const resolutionKey = idText2(input?.resolutionKey);
    const status = typeof input?.status === "string" ? input.status.trim().toLowerCase() : "";
    const by = idText2(input?.resolvedByUserId);
    if (!validDocumentId(resolutionKey) || !by) return null;
    if (!WARNING_RESOLUTION_STATUSES.includes(status)) return null;
    return {
      documentId: resolutionKey,
      fields: { resolutionKey, status, resolvedByUserId: by }
    };
  }
  function normalizeDocumentId(id2) {
    return idKey5(id2);
  }
  function warningResolutionKeys(records, statuses) {
    const keys = /* @__PURE__ */ new Map();
    for (const record9 of records || []) {
      if (!record9) continue;
      const status = typeof record9.status === "string" ? record9.status.trim().toLowerCase() : "";
      if (!statuses.includes(status)) continue;
      const key3 = idText2(record9.resolutionKey) || idText2(record9.id);
      if (key3 && !keys.has(normalizeDocumentId(key3))) keys.set(normalizeDocumentId(key3), key3);
    }
    return [...keys.values()].sort(compareText);
  }
  function resolvedWarningKeys(records) {
    return warningResolutionKeys(records, WARNING_RESOLUTION_STATUSES);
  }
  function approvedWarningKeys(records) {
    return warningResolutionKeys(records, ["approved"]);
  }
  function hasKey(keys, key3) {
    const needle = normalizeDocumentId(key3);
    return Boolean(needle) && (keys || []).some((candidate) => normalizeDocumentId(candidate) === needle);
  }
  function isWarningActive(row2, decisions) {
    if (!row2) return false;
    const key3 = idText2(row2.resolutionKey);
    if (key3 && hasKey(decisions?.resolvedKeys, key3)) return false;
    if (idText2(row2.bookingAId) && idText2(row2.bookingBId)) {
      return !isClashAccepted(row2.bookingAId, row2.bookingBId, decisions?.acceptedClashes);
    }
    return true;
  }
  function clashResolutionKey(input) {
    const own = idText2(input?.resolutionKey);
    if (own) return own;
    const a = idText2(input?.bookingAId);
    const b = idText2(input?.bookingBId);
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
  function isClashApproved(row2, decisions) {
    if (!row2) return false;
    const approved = decisions?.approvedKeys != null ? decisions.approvedKeys : decisions?.resolvedKeys;
    const key3 = clashResolutionKey(row2);
    if (key3 && hasKey(approved, key3)) return true;
    if (!idText2(row2.bookingAId) || !idText2(row2.bookingBId)) return false;
    return isClashAccepted(row2.bookingAId, row2.bookingBId, decisions?.acceptedClashes);
  }
  function operativeClashGroups(input) {
    const people = input?.people || { accounts: [], operatives: [] };
    const managerKeys = new Set((input?.managerIds || []).map(idKey5).filter(Boolean));
    const managerEmails = /* @__PURE__ */ new Set();
    for (const account of people.accounts || []) {
      const email = emailKey3(account.email);
      if (email && managerKeys.has(idKey5(account.id))) managerEmails.add(email);
    }
    const isManager = (storedId) => {
      if (managerKeys.size === 0) return false;
      if (managerKeys.has(idKey5(storedId))) return true;
      const person = resolveBookingPerson(storedId, people);
      if (person.accountId && managerKeys.has(idKey5(person.accountId))) return true;
      return Boolean(person.email && managerEmails.has(person.email));
    };
    const days = /* @__PURE__ */ new Map();
    const seenIds = /* @__PURE__ */ new Set();
    (input?.operativeBookings || []).forEach((booking, index) => {
      const id2 = idText2(booking?.id);
      const day = dayKeyText(booking?.dayKey);
      const stored = idText2(booking?.operativeId);
      if (!id2 || !day || !stored || !occupiesDay(booking.status)) return;
      if (seenIds.has(id2.toLowerCase())) return;
      seenIds.add(id2.toLowerCase());
      if (isManager(stored)) return;
      const personKey = bookingPersonKey(stored, people);
      const key3 = `${personKey}|${day}`;
      const entry = days.get(key3) || { personKey, dayKey: day, indexes: [] };
      entry.indexes.push(index);
      days.set(key3, entry);
    });
    const intervalOf = (index) => {
      const booking = input.operativeBookings[index];
      return slotInterval(
        { timeSlot: booking?.timeSlot, workStartTime: booking?.workStartTime, workEndTime: booking?.workEndTime },
        input.day
      );
    };
    const carried = /* @__PURE__ */ new Map();
    for (const entry of days.values()) {
      const next = nextCalendarDayKey(entry.dayKey);
      if (!next) continue;
      for (const index of entry.indexes) {
        if (!intervalCrossesMidnight(intervalOf(index))) continue;
        const key3 = `${entry.personKey}|${next}`;
        carried.set(key3, [...carried.get(key3) || [], index]);
      }
    }
    const groups = [];
    const seen = /* @__PURE__ */ new Set();
    const ordered = Array.from(days.entries()).sort(
      ([, a], [, b]) => compareText(a.dayKey, b.dayKey) || compareText(a.personKey, b.personKey)
    );
    for (const [dayMapKey, personDay] of ordered) {
      const carriedIn = carried.get(dayMapKey) || [];
      if (personDay.indexes.length + carriedIn.length < 2) continue;
      const entries = [
        ...personDay.indexes.map((index) => ({ index, carried: false })),
        ...carriedIn.map((index) => ({ index, carried: true }))
      ].sort((a, b) => compareText(idText2(input.operativeBookings[a.index].id), idText2(input.operativeBookings[b.index].id)));
      const sorted = entries.map((entry) => entry.index);
      const intervals = entries.map((entry) => {
        const interval2 = intervalOf(entry.index);
        return entry.carried ? overnightCarryInterval(interval2) : interval2;
      });
      for (const cluster of overlappingIntervalGroups(intervals)) {
        if (cluster.every((position) => entries[position].carried)) continue;
        const items = cluster.map((position) => ({
          bookingId: idText2(input.operativeBookings[sorted[position]].id),
          index: sorted[position],
          interval: intervals[position]
        }));
        const bookingIds = items.map((item) => item.bookingId);
        const pairKey = bookingIds.join("|");
        if (items.length < 2 || seen.has(pairKey.toLowerCase())) continue;
        seen.add(pairKey.toLowerCase());
        const pairs = [];
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            if (!intervalsOverlap(items[i].interval, items[j].interval)) continue;
            const a = items[i].bookingId;
            const b = items[j].bookingId;
            pairs.push({ bookingAId: a, bookingBId: b, clashPairKey: clashPairKey(a, b), clashResolutionKey: clashResolutionKey({ bookingAId: a, bookingBId: b }) });
          }
        }
        groups.push({
          personKey: personDay.personKey,
          operativeId: idText2(input.operativeBookings[items[0].index].operativeId),
          dayKey: personDay.dayKey,
          items,
          bookingIds,
          pairKey,
          bookingAId: bookingIds[0],
          bookingBId: bookingIds[1],
          resolutionKey: clashResolutionKey({ bookingAId: bookingIds[0], bookingBId: bookingIds[1] }),
          pairs
        });
      }
    }
    return groups;
  }
  function isClashGroupApproved(group, decisions) {
    const pairs = group?.pairs || [];
    if (pairs.length === 0) return false;
    return pairs.every((pair) => isClashApproved({ bookingAId: pair.bookingAId, bookingBId: pair.bookingBId }, decisions));
  }

  // lib/canonical/timesheetEntryReviews.ts
  var TIMESHEET_ENTRY_DECISIONS = ["pending", "approved", "declined", "edited"];
  var TIMESHEET_ENTRY_REVIEWS_FIELD = "extraEntryReviews";
  var TIMESHEET_REVIEWER_ONLY_FIELDS = ["payrollLineReviews", "extraEntryReviews"];
  var TIMESHEET_SELF_SIGNED_OWNER_FIELDS = ["weeklyReportOverride"];
  var TIMESHEET_MANAGER_SIGN_OFF_FIELDS = [
    "managerSignedAt",
    "managerSignedAtMs",
    "managerSignedByName",
    "managerSignedByUserId",
    "managerSignatureImageBase64",
    "approvedAt",
    "approvedAtMs",
    "approvedByName",
    "exportedAt",
    "exportedAtMs"
  ];
  var TIMESHEET_ENTRY_ARRAY_FIELDS = ["expenseEntries", "priceWorkEntries"];
  var AMOUNT_EPSILON = 5e-3;
  function finite(value) {
    const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(number) ? number : null;
  }
  function text5(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function parseTimesheetEntryDecision(raw) {
    return TIMESHEET_ENTRY_DECISIONS.includes(raw) ? raw : "approved";
  }
  function parseReview(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row2 = raw;
    const decision = parseTimesheetEntryDecision(row2.decision);
    return {
      decision,
      revisedAmount: decision === "edited" ? finite(row2.revisedAmount) : null,
      reviewedAmount: finite(row2.reviewedAmount),
      reviewedByUserId: text5(row2.reviewedByUserId),
      reviewedAtMs: finite(row2.reviewedAtMs)
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
  function reviewFor(reviews, entryId) {
    if (Object.prototype.hasOwnProperty.call(reviews, entryId)) return reviews[entryId];
    const needle = normalizeDocumentId(entryId);
    const key3 = Object.keys(reviews).find((candidate) => normalizeDocumentId(candidate) === needle);
    return key3 == null ? void 0 : reviews[key3];
  }
  function timesheetEntryEffectiveAmount(decision, revisedAmount, amount) {
    if (decision === "declined") return 0;
    if (decision === "edited") return finite(revisedAmount) ?? amount;
    return amount;
  }
  function timesheetEntryDecision(sheet, entry) {
    const row2 = entry || {};
    const id2 = text5(row2.id);
    const amount = finite(row2.amount) ?? 0;
    const inlineDecision = parseTimesheetEntryDecision(row2.managerDecision);
    const inline = {
      decision: inlineDecision,
      revisedAmount: inlineDecision === "edited" ? finite(row2.managerRevisedAmount) : null,
      source: "legacy-inline"
    };
    const reviews = parseTimesheetEntryReviews(sheet);
    let base;
    if (reviews == null) {
      const managerSigned = parseTimesheetStatusFields(sheet || {}).managerSignedAtMs != null;
      if (managerSigned) return inline;
      base = { decision: "approved", revisedAmount: null, source: "unreviewed" };
    } else {
      const review = id2 ? reviewFor(reviews, id2) : void 0;
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
    const reviewer = text5(input.reviewedByUserId);
    const output = {};
    for (const entry of input.entries) {
      const id2 = text5(entry.id);
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
    for (const key3 of keys) {
      const review = parseReview(written[key3]);
      if (review && key3.startsWith(prefix)) output[key3.slice(prefix.length)] = review;
    }
    return output;
  }
  function timesheetWriterIsReviewer(input) {
    const writer = text5(input.writerUserId).toLowerCase();
    if (!writer) return false;
    if (input.writerIsAdmin === true) return true;
    if (writer === text5(input.subjectUserId).toLowerCase()) return false;
    const keys = new Set([writer, ...(input.writerFormerIds ?? []).map((id2) => text5(id2).toLowerCase())].filter(Boolean));
    return (input.subjectLineManagerIds ?? []).some((id2) => keys.has(text5(id2).toLowerCase()));
  }
  function timesheetOwnerWriteFields(fields, input) {
    const output = { ...fields };
    const drop = (key3) => {
      for (const written of Object.keys(output)) {
        if (written === key3 || written.startsWith(`${key3}.`)) delete output[written];
      }
    };
    for (const key3 of TIMESHEET_REVIEWER_ONLY_FIELDS) drop(key3);
    for (const key3 of TIMESHEET_MANAGER_SIGN_OFF_FIELDS) drop(key3);
    if (input.subjectHasLineManager) {
      for (const key3 of TIMESHEET_SELF_SIGNED_OWNER_FIELDS) drop(key3);
    }
    if (input.managerSigned) {
      for (const key3 of TIMESHEET_ENTRY_ARRAY_FIELDS) drop(key3);
    }
    return output;
  }
  var TIMESHEET_DIFF_IGNORED_FIELDS = ["updatedAt", "updatedBy", "updatedFrom", "createdAt"];
  function timesheetChangedFields(base, next) {
    const strip = (row2) => {
      if (!row2) return row2;
      const out = { ...row2 };
      for (const key3 of TIMESHEET_DIFF_IGNORED_FIELDS) delete out[key3];
      return out;
    };
    return documentWriteFields(strip(base) ?? null, strip(next) ?? {}, { createOnly: ["userId"] });
  }
  function payrollLineReview(sheet, lineId) {
    const raw = sheet && typeof sheet === "object" ? sheet.payrollLineReviews : null;
    if (!raw || typeof raw !== "object") return null;
    const reviews = raw;
    const id2 = typeof lineId === "string" ? lineId.trim() : "";
    if (!id2) return null;
    let value = Object.prototype.hasOwnProperty.call(reviews, id2) ? reviews[id2] : void 0;
    if (value === void 0) {
      const needle = normalizeDocumentId(id2);
      const key3 = Object.keys(reviews).find((candidate) => normalizeDocumentId(candidate) === needle);
      value = key3 == null ? void 0 : reviews[key3];
    }
    if (!value || typeof value !== "object") return null;
    const row2 = value;
    const decision = parseTimesheetEntryDecision(row2.decision);
    const revised = typeof row2.revisedAmount === "number" && Number.isFinite(row2.revisedAmount) ? row2.revisedAmount : null;
    return { decision, revisedAmount: decision === "edited" ? revised : null };
  }

  // lib/canonical/reportPay.ts
  var PAYE_PAY_CELL_LABEL = "PAYE";
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
  function isInvoiceLine(line) {
    if (!line) return false;
    if (line.isPayeDay === true || lineIsPaye(line)) return false;
    if (line.isLeave === true || String(line.kind || "").trim().toLowerCase() === "leave") return false;
    return true;
  }
  function invoiceLines(lines) {
    return (lines || []).filter((line) => isInvoiceLine(line));
  }
  var INVOICE_AMOUNT_EPSILON = 1e-4;
  function rowsOf(value) {
    return Array.isArray(value) ? value.filter((row2) => Boolean(row2) && typeof row2 === "object") : [];
  }
  function amountOf(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }
  function timesheetInvoiceRows(input) {
    const sheet = input.sheet && typeof input.sheet === "object" ? input.sheet : {};
    const lines = input.payrollLines || [];
    const liveById = new Map(lines.map((line) => [normalizeDocumentId(line.id), line]));
    const override = sheet.weeklyReportOverride;
    const rows3 = [];
    const days = input.timesheetDays ? new Set(input.timesheetDays.map((day) => String(day).trim())) : null;
    const zone3 = zoneOrLondon(input.timeZone);
    if (days && days.size === 0) return rows3;
    const onCountedDay = (dayKey) => !days || !dayKey || days.has(dayKey);
    const entryDay = (entry) => {
      const ms = documentInstantMs(entry.date) ?? documentInstantMs(entry.startDate);
      return ms == null ? null : dayKeyInZone(new Date(ms), zone3);
    };
    if (override && typeof override === "object") {
      const snapshot = override;
      for (const row2 of rowsOf(snapshot.lines)) {
        const amount = amountOf(row2.amount);
        if (row2.decision === "declined" || amount <= INVOICE_AMOUNT_EPSILON) continue;
        const id2 = String(row2.id ?? "").trim();
        const live = liveById.get(normalizeDocumentId(id2)) ?? null;
        if (live && !isInvoiceLine(live)) continue;
        if (!onCountedDay(live?.dayKey ?? null)) continue;
        rows3.push({ kind: "labour", id: id2, amount, source: "override", line: live, stored: row2 });
      }
      for (const [kind, key3] of [["priceWork", "priceWork"], ["expense", "expenses"]]) {
        for (const row2 of rowsOf(snapshot[key3])) {
          const amount = amountOf(row2.amount);
          if (row2.decision === "declined" || amount <= INVOICE_AMOUNT_EPSILON) continue;
          if (!onCountedDay(entryDay(row2))) continue;
          rows3.push({ kind, id: String(row2.id ?? "").trim(), amount, source: "override", line: null, stored: row2 });
        }
      }
      return rows3;
    }
    const decided = input.extrasMode === "decided";
    const managerSigned = parseTimesheetStatusFields(sheet).managerSignedAtMs != null;
    for (const line of invoiceLines(lines)) {
      if (!onCountedDay(line.dayKey)) continue;
      let amount = line.amount;
      if (decided && managerSigned) {
        const review = payrollLineReview(sheet, line.id);
        if (review?.decision === "declined") continue;
        if (review?.decision === "edited" && review.revisedAmount != null) amount = review.revisedAmount;
      }
      rows3.push({ kind: "labour", id: line.id, amount, source: "live", line, stored: null });
    }
    for (const [kind, key3] of [["priceWork", "priceWorkEntries"], ["expense", "expenseEntries"]]) {
      for (const entry of rowsOf(sheet[key3])) {
        if (!onCountedDay(entryDay(entry))) continue;
        const own = amountOf(entry.amount);
        let amount = own;
        if (decided) {
          const decision = timesheetEntryDecision(sheet, entry);
          if (decision.decision === "declined") continue;
          amount = timesheetEntryEffectiveAmount(decision.decision, decision.revisedAmount, own);
        }
        rows3.push({ kind, id: String(entry.id ?? "").trim(), amount, source: "live", line: null, stored: entry });
      }
    }
    return rows3;
  }

  // lib/canonical/sensitiveProfile.ts
  var SENSITIVE_PROFILE_FIELDS = ["utrNumber", "vatNumber"];
  var SENSITIVE_PROFILE_DOC_ID = "taxIds";
  var SENSITIVE_VALUE_MAX = 20;
  var SENSITIVE_HELD_BY_ADMIN_COPY = "Held by admin";
  var SENSITIVE_EXPORT_OPTION_LABEL = "Include UTR and VAT number";
  function text6(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function sensitiveProfileDocPath(userId) {
    return `users/${text6(userId)}/private/${SENSITIVE_PROFILE_DOC_ID}`;
  }
  function canViewSensitiveProfile(input) {
    const viewer = text6(input.viewerUserId);
    if (viewer && viewer === text6(input.subjectUserId)) return true;
    if (input.viewerRole.isOperativeMode) return false;
    return input.viewerRole.isSuperAdmin || input.viewerRole.isAdmin;
  }
  function maskSensitiveValue(value) {
    const raw = text6(value).replace(/\s+/g, "");
    if (!raw) return "";
    if (raw.length <= 4) return "\u2022\u2022\u2022\u2022";
    return `\u2022\u2022\u2022\u2022 ${raw.slice(-4)}`;
  }
  function resolveSensitiveProfile(input) {
    if (input.privateDoc && typeof input.privateDoc === "object") {
      return {
        utrNumber: text6(input.privateDoc.utrNumber),
        vatNumber: text6(input.privateDoc.vatNumber),
        source: "private"
      };
    }
    const legacy = input.legacyUser && typeof input.legacyUser === "object" ? input.legacyUser : {};
    const utrNumber = text6(legacy.utrNumber);
    const vatNumber = text6(legacy.vatNumber);
    return { utrNumber, vatNumber, source: utrNumber || vatNumber ? "legacy" : "none" };
  }
  function sensitiveProfileWriteFields(input) {
    const updatedByUserId = text6(input.updatedByUserId);
    if (!updatedByUserId) return { ok: false, error: "missing_user" };
    const utrNumber = text6(input.utrNumber);
    const vatNumber = text6(input.vatNumber);
    if (utrNumber.length > SENSITIVE_VALUE_MAX || vatNumber.length > SENSITIVE_VALUE_MAX) {
      return { ok: false, error: "too_long" };
    }
    return { ok: true, fields: { utrNumber, vatNumber, updatedByUserId } };
  }
  function exportIncludesSensitiveFields(input) {
    return input.requested === true && input.canView === true;
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
  function text7(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function normalizeCurrencyCode(value) {
    const code = text7(value).toUpperCase();
    if (!code) return null;
    return CURRENCY_OPTIONS.some((option) => option.code === code) ? code : null;
  }
  function currencyOption(code) {
    const normalized = normalizeCurrencyCode(code);
    return CURRENCY_OPTIONS.find((option) => option.code === normalized) ?? CURRENCY_OPTIONS[0];
  }
  function defaultCurrencyForCountry(countryCode) {
    const country = text7(countryCode).toUpperCase().split("-")[0];
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
      version: true ? "1.20.2" : "",
      sha256: true ? "5b8ca46347fa93842af738e991901602dba25f1ea18f4f9657e2cb1c691c941b" : ""
    };
  }

  // lib/canonical/holidayDocument.ts
  var HOLIDAY_DOCUMENT_KEYS = {
    start: ["startDate", "start_date", "start", "from", "dateFrom", "holidayStart", "date"],
    end: ["endDate", "end_date", "end", "to", "dateTo", "holidayEnd"],
    userId: ["userId", "user_id", "uid", "userID", "linkedUserId", "employeeUserId"],
    nestedUserId: ["id", "uid", "userId", "userID"],
    operativeId: ["operativeId", "operative_id", "operativeID"],
    status: ["status", "holidayStatus", "approvalStatus"],
    timeSlot: ["timeSlot", "slot", "halfDay"],
    decisionNote: ["decisionNote", "note"],
    approvedByUserId: ["approvedByUserId", "approvedBy"]
  };
  var DAY_KEY3 = /^(\d{4})-(\d{2})-(\d{2})$/;
  function text8(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function firstText2(row2, keys) {
    for (const key3 of keys) {
      const value = text8(row2[key3]);
      if (value) return value;
    }
    return "";
  }
  function validCalendarDay(year, month, day) {
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return "";
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function epochMs(value) {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value > 1e10 ? value : value * 1e3;
  }
  function holidayDocumentDayKey(raw, timeZone) {
    const zone3 = zoneOrLondon(timeZone);
    if (raw == null || raw === "") return "";
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? "" : dayKeyInZone(raw, zone3);
    if (typeof raw === "number") {
      const ms = epochMs(raw);
      return ms == null ? "" : dayKeyInZone(new Date(ms), zone3);
    }
    if (typeof raw === "string") {
      const value = raw.trim();
      if (!value) return "";
      let match = value.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (match) return validCalendarDay(Number(match[1]), Number(match[2]), Number(match[3]));
      match = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (match) return validCalendarDay(Number(match[3]), Number(match[2]), Number(match[1]));
      const ms = Date.parse(value);
      return Number.isNaN(ms) ? "" : dayKeyInZone(new Date(ms), zone3);
    }
    if (typeof raw === "object") {
      const row2 = raw;
      const seconds = typeof row2.seconds === "number" ? row2.seconds : typeof row2._seconds === "number" ? row2._seconds : null;
      if (seconds != null && Number.isFinite(seconds)) {
        const nanos = typeof row2.nanoseconds === "number" ? row2.nanoseconds : typeof row2._nanoseconds === "number" ? row2._nanoseconds : 0;
        return dayKeyInZone(new Date(seconds * 1e3 + Math.floor((Number(nanos) || 0) / 1e6)), zone3);
      }
      if (typeof row2.toDate === "function") {
        try {
          const date = row2.toDate();
          if (date instanceof Date && !Number.isNaN(date.getTime())) return dayKeyInZone(date, zone3);
        } catch {
          return "";
        }
      }
    }
    return "";
  }
  function firstDayKey(row2, keys, zone3) {
    for (const key3 of keys) {
      const dayKey = holidayDocumentDayKey(row2[key3], zone3);
      if (dayKey) return dayKey;
    }
    return "";
  }
  function hasValue2(value) {
    if (value == null || value === false || value === "") return false;
    if (typeof value === "string") return value.trim() !== "";
    return true;
  }
  function parseHolidayDocument(docId, data, timeZone) {
    const id2 = text8(docId);
    if (!id2) return null;
    const row2 = data && typeof data === "object" ? data : {};
    const zone3 = zoneOrLondon(timeZone);
    const start = firstDayKey(row2, HOLIDAY_DOCUMENT_KEYS.start, zone3);
    if (!start || !DAY_KEY3.test(start)) return null;
    const end = firstDayKey(row2, HOLIDAY_DOCUMENT_KEYS.end, zone3) || start;
    const [startDayKey, endDayKey] = end < start ? [end, start] : [start, end];
    let userId = firstText2(row2, HOLIDAY_DOCUMENT_KEYS.userId);
    if (!userId && row2.user && typeof row2.user === "object") {
      userId = firstText2(row2.user, HOLIDAY_DOCUMENT_KEYS.nestedUserId);
    }
    const operativeId = firstText2(row2, HOLIDAY_DOCUMENT_KEYS.operativeId);
    const status = normalizeHolidayStatus(firstText2(row2, HOLIDAY_DOCUMENT_KEYS.status));
    const cancellationRequestedByUserId = text8(row2.cancellationRequestedByUserId);
    const organizationId = text8(row2.organizationId);
    const parsed = {
      id: id2,
      userId: userId || null,
      operativeId: operativeId || null,
      startDayKey,
      endDayKey,
      timeSlot: normalizeHolidayTimeSlot(firstText2(row2, HOLIDAY_DOCUMENT_KEYS.timeSlot)),
      status,
      approved: status === "approved",
      approvedByUserId: firstText2(row2, HOLIDAY_DOCUMENT_KEYS.approvedByUserId) || null,
      cancellationRequested: hasValue2(row2.cancellationRequestedAt),
      cancellationRequestedByUserId: cancellationRequestedByUserId || null,
      decisionNote: parseHolidayDecisionNote(firstText2(row2, HOLIDAY_DOCUMENT_KEYS.decisionNote))
    };
    if (organizationId) parsed.organizationId = organizationId;
    return parsed;
  }
  function parseHolidayDocuments(docs, timeZone) {
    const out = [];
    for (const entry of docs || []) {
      const parsed = parseHolidayDocument(entry?.id, entry?.data, timeZone);
      if (parsed) out.push(parsed);
    }
    return out;
  }
  function labourHolidayInput(record9) {
    return {
      id: record9.id,
      userId: record9.userId,
      operativeId: record9.operativeId,
      startDayKey: record9.startDayKey,
      endDayKey: record9.endDayKey,
      timeSlot: record9.timeSlot,
      approved: record9.approved
    };
  }

  // lib/canonical/timesheetLines.ts
  var OVERLAPPING_BOOKING_NOTE = "Overlaps another booking \u2014 check with your manager";
  function overlappingBookingIds(bookings, day) {
    const byDay = /* @__PURE__ */ new Map();
    for (const booking of bookings || []) {
      const id2 = String(booking?.id || "").trim();
      if (!id2) continue;
      const key3 = String(booking.dayKey || "").trim();
      const list = byDay.get(key3) || [];
      list.push(booking);
      byDay.set(key3, list);
    }
    const flagged = /* @__PURE__ */ new Set();
    const intervalOf = (booking) => slotInterval({ timeSlot: booking.timeSlot, workStartTime: booking.workStartTime, workEndTime: booking.workEndTime }, day);
    const carried = /* @__PURE__ */ new Map();
    for (const [key3, list] of byDay) {
      const next = nextCalendarDayKey(key3);
      if (!next) continue;
      for (const booking of list) {
        if (intervalCrossesMidnight(intervalOf(booking))) carried.set(next, [...carried.get(next) || [], booking]);
      }
    }
    for (const [key3, list] of byDay) {
      const carriedIn = carried.get(key3) || [];
      if (list.length + carriedIn.length < 2) continue;
      const entries = [...list.map((b) => ({ b, carried: false })), ...carriedIn.map((b) => ({ b, carried: true }))];
      const intervals = entries.map(
        (entry) => entry.carried ? overnightCarryInterval(intervalOf(entry.b)) : intervalOf(entry.b)
      );
      for (const group of overlappingIntervalGroups(intervals)) {
        if (group.every((index) => entries[index].carried)) continue;
        for (const index of group) flagged.add(String(entries[index].b.id).trim());
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
  function timesheetLeaveLines(leaveRecords, period, timeZone, nonWorkingDayKeys, dayPolicy) {
    const start = String(period?.startDayKey || "").trim();
    const end = String(period?.endDayKey || "").trim();
    if (!start || !end || start > end) return [];
    const byDay = /* @__PURE__ */ new Map();
    for (const record9 of leaveRecords || []) {
      if (!record9) continue;
      const approved = record9.approved === true || record9.approved == null && normalizeHolidayStatus(record9.status) === "approved";
      if (!approved) continue;
      const slot = normalizeHolidayTimeSlot(record9.timeSlot);
      for (const dayKey of leaveRecordDayKeys(record9, timeZone, nonWorkingDayKeys)) {
        if (dayKey < start || dayKey > end) continue;
        const list = byDay.get(dayKey) || [];
        if (list.some((line2) => line2.timeSlot === slot || line2.timeSlot === "FULL DAY")) continue;
        const line = {
          id: `leave-${String(record9.id)}-${dayKey}`,
          leaveId: String(record9.id),
          dayKey,
          timeSlot: slot,
          label: timesheetLeaveLabel(slot)
        };
        if (dayPolicy) {
          const halves = leaveHalfDayWindows(dayPolicy(dayKey));
          const half = slot === "AM" ? halves.am : slot === "PM" ? halves.pm : halves.day;
          line.timeRange = `${formatClockMinutes(half.start)}\u2013${formatClockMinutes(half.end)}`;
        }
        byDay.set(dayKey, slot === "FULL DAY" ? [line] : [...list, line]);
      }
    }
    const lines = Array.from(byDay.values()).flat();
    const order = { "FULL DAY": 0, AM: 1, PM: 2 };
    return lines.sort((a, b) => a.dayKey !== b.dayKey ? a.dayKey < b.dayKey ? -1 : 1 : order[a.timeSlot] - order[b.timeSlot]);
  }

  // lib/canonical/bankHolidayRegions.ts
  var DEFAULT_BANK_HOLIDAY_REGION_ID = "GB-ENG-WLS";
  var BANK_HOLIDAY_REGIONS = [
    { id: "GB-ENG-WLS", title: "England & Wales", countryCode: "GB", subdivisionCodes: ["GB-ENG", "GB-WLS"] },
    { id: "GB-SCT", title: "Scotland", countryCode: "GB", subdivisionCodes: ["GB-SCT"] },
    { id: "GB-NIR", title: "Northern Ireland", countryCode: "GB", subdivisionCodes: ["GB-NIR"] },
    { id: "GB", title: "United Kingdom (all nations)", countryCode: "GB" },
    { id: "IE", title: "Ireland", countryCode: "IE" },
    { id: "IM", title: "Isle of Man", countryCode: "IM" },
    { id: "JE", title: "Jersey", countryCode: "JE" },
    { id: "GG", title: "Guernsey", countryCode: "GG" },
    { id: "AD", title: "Andorra", countryCode: "AD" },
    { id: "AL", title: "Albania", countryCode: "AL" },
    { id: "AM", title: "Armenia", countryCode: "AM" },
    { id: "AO", title: "Angola", countryCode: "AO" },
    { id: "AR", title: "Argentina", countryCode: "AR" },
    { id: "AT", title: "Austria", countryCode: "AT" },
    { id: "AU", title: "Australia", countryCode: "AU" },
    { id: "AW", title: "Aruba", countryCode: "AW" },
    { id: "AX", title: "\xC5land Islands", countryCode: "AX" },
    { id: "BA", title: "Bosnia and Herzegovina", countryCode: "BA" },
    { id: "BB", title: "Barbados", countryCode: "BB" },
    { id: "BD", title: "Bangladesh", countryCode: "BD" },
    { id: "BE", title: "Belgium", countryCode: "BE" },
    { id: "BG", title: "Bulgaria", countryCode: "BG" },
    { id: "BJ", title: "Benin", countryCode: "BJ" },
    { id: "BO", title: "Bolivia", countryCode: "BO" },
    { id: "BR", title: "Brazil", countryCode: "BR" },
    { id: "BS", title: "Bahamas", countryCode: "BS" },
    { id: "BW", title: "Botswana", countryCode: "BW" },
    { id: "BY", title: "Belarus", countryCode: "BY" },
    { id: "BZ", title: "Belize", countryCode: "BZ" },
    { id: "CA", title: "Canada", countryCode: "CA" },
    { id: "CD", title: "DR Congo", countryCode: "CD" },
    { id: "CG", title: "Congo", countryCode: "CG" },
    { id: "CH", title: "Switzerland", countryCode: "CH" },
    { id: "CL", title: "Chile", countryCode: "CL" },
    { id: "CN", title: "China", countryCode: "CN" },
    { id: "CO", title: "Colombia", countryCode: "CO" },
    { id: "CR", title: "Costa Rica", countryCode: "CR" },
    { id: "CU", title: "Cuba", countryCode: "CU" },
    { id: "CY", title: "Cyprus", countryCode: "CY" },
    { id: "CZ", title: "Czechia", countryCode: "CZ" },
    { id: "DE", title: "Germany", countryCode: "DE" },
    { id: "DK", title: "Denmark", countryCode: "DK" },
    { id: "DM", title: "Dominica", countryCode: "DM" },
    { id: "DO", title: "Dominican Republic", countryCode: "DO" },
    { id: "EC", title: "Ecuador", countryCode: "EC" },
    { id: "EE", title: "Estonia", countryCode: "EE" },
    { id: "EG", title: "Egypt", countryCode: "EG" },
    { id: "ES", title: "Spain", countryCode: "ES" },
    { id: "FI", title: "Finland", countryCode: "FI" },
    { id: "FO", title: "Faroe Islands", countryCode: "FO" },
    { id: "FR", title: "France", countryCode: "FR" },
    { id: "GA", title: "Gabon", countryCode: "GA" },
    { id: "GD", title: "Grenada", countryCode: "GD" },
    { id: "GE", title: "Georgia", countryCode: "GE" },
    { id: "GH", title: "Ghana", countryCode: "GH" },
    { id: "GI", title: "Gibraltar", countryCode: "GI" },
    { id: "GL", title: "Greenland", countryCode: "GL" },
    { id: "GM", title: "Gambia", countryCode: "GM" },
    { id: "GP", title: "Guadeloupe", countryCode: "GP" },
    { id: "GR", title: "Greece", countryCode: "GR" },
    { id: "GT", title: "Guatemala", countryCode: "GT" },
    { id: "GY", title: "Guyana", countryCode: "GY" },
    { id: "HK", title: "Hong Kong", countryCode: "HK" },
    { id: "HN", title: "Honduras", countryCode: "HN" },
    { id: "HR", title: "Croatia", countryCode: "HR" },
    { id: "HT", title: "Haiti", countryCode: "HT" },
    { id: "HU", title: "Hungary", countryCode: "HU" },
    { id: "ID", title: "Indonesia", countryCode: "ID" },
    { id: "IS", title: "Iceland", countryCode: "IS" },
    { id: "IT", title: "Italy", countryCode: "IT" },
    { id: "JM", title: "Jamaica", countryCode: "JM" },
    { id: "JP", title: "Japan", countryCode: "JP" },
    { id: "KE", title: "Kenya", countryCode: "KE" },
    { id: "KR", title: "South Korea", countryCode: "KR" },
    { id: "KY", title: "Cayman Islands", countryCode: "KY" },
    { id: "KZ", title: "Kazakhstan", countryCode: "KZ" },
    { id: "LC", title: "Saint Lucia", countryCode: "LC" },
    { id: "LI", title: "Liechtenstein", countryCode: "LI" },
    { id: "LS", title: "Lesotho", countryCode: "LS" },
    { id: "LT", title: "Lithuania", countryCode: "LT" },
    { id: "LU", title: "Luxembourg", countryCode: "LU" },
    { id: "LV", title: "Latvia", countryCode: "LV" },
    { id: "MA", title: "Morocco", countryCode: "MA" },
    { id: "MC", title: "Monaco", countryCode: "MC" },
    { id: "MD", title: "Moldova", countryCode: "MD" },
    { id: "ME", title: "Montenegro", countryCode: "ME" },
    { id: "MG", title: "Madagascar", countryCode: "MG" },
    { id: "MK", title: "North Macedonia", countryCode: "MK" },
    { id: "MN", title: "Mongolia", countryCode: "MN" },
    { id: "MQ", title: "Martinique", countryCode: "MQ" },
    { id: "MS", title: "Montserrat", countryCode: "MS" },
    { id: "MT", title: "Malta", countryCode: "MT" },
    { id: "MX", title: "Mexico", countryCode: "MX" },
    { id: "MZ", title: "Mozambique", countryCode: "MZ" },
    { id: "NA", title: "Namibia", countryCode: "NA" },
    { id: "NE", title: "Niger", countryCode: "NE" },
    { id: "NG", title: "Nigeria", countryCode: "NG" },
    { id: "NI", title: "Nicaragua", countryCode: "NI" },
    { id: "NL", title: "Netherlands", countryCode: "NL" },
    { id: "NO", title: "Norway", countryCode: "NO" },
    { id: "NZ", title: "New Zealand", countryCode: "NZ" },
    { id: "PA", title: "Panama", countryCode: "PA" },
    { id: "PE", title: "Peru", countryCode: "PE" },
    { id: "PG", title: "Papua New Guinea", countryCode: "PG" },
    { id: "PH", title: "Philippines", countryCode: "PH" },
    { id: "PL", title: "Poland", countryCode: "PL" },
    { id: "PR", title: "Puerto Rico", countryCode: "PR" },
    { id: "PT", title: "Portugal", countryCode: "PT" },
    { id: "PY", title: "Paraguay", countryCode: "PY" },
    { id: "RO", title: "Romania", countryCode: "RO" },
    { id: "RS", title: "Serbia", countryCode: "RS" },
    { id: "RU", title: "Russia", countryCode: "RU" },
    { id: "SC", title: "Seychelles", countryCode: "SC" },
    { id: "SE", title: "Sweden", countryCode: "SE" },
    { id: "SG", title: "Singapore", countryCode: "SG" },
    { id: "SI", title: "Slovenia", countryCode: "SI" },
    { id: "SJ", title: "Svalbard and Jan Mayen", countryCode: "SJ" },
    { id: "SK", title: "Slovakia", countryCode: "SK" },
    { id: "SM", title: "San Marino", countryCode: "SM" },
    { id: "SR", title: "Suriname", countryCode: "SR" },
    { id: "SV", title: "El Salvador", countryCode: "SV" },
    { id: "TN", title: "Tunisia", countryCode: "TN" },
    { id: "TR", title: "T\xFCrkiye", countryCode: "TR" },
    { id: "UA", title: "Ukraine", countryCode: "UA" },
    { id: "UG", title: "Uganda", countryCode: "UG" },
    { id: "US", title: "United States", countryCode: "US" },
    { id: "UY", title: "Uruguay", countryCode: "UY" },
    { id: "VA", title: "Vatican City", countryCode: "VA" },
    { id: "VE", title: "Venezuela", countryCode: "VE" },
    { id: "VN", title: "Vietnam", countryCode: "VN" },
    { id: "ZA", title: "South Africa", countryCode: "ZA" },
    { id: "ZW", title: "Zimbabwe", countryCode: "ZW" }
  ];
  var REGION_ID_ALIASES = {
    "GB-ENG": "GB-ENG-WLS",
    "GB-WLS": "GB-ENG-WLS",
    UK: "GB"
  };
  var COUNTRY_TITLES = { GB: "United Kingdom" };
  function text9(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function normalizeBankHolidayRegionId(value) {
    const raw = text9(value).toUpperCase();
    if (!raw) return null;
    const id2 = REGION_ID_ALIASES[raw] ?? raw;
    return BANK_HOLIDAY_REGIONS.some((region) => region.id === id2) ? id2 : null;
  }
  function bankHolidayRegion(id2) {
    const normalized = normalizeBankHolidayRegionId(id2);
    return normalized ? BANK_HOLIDAY_REGIONS.find((region) => region.id === normalized) ?? null : null;
  }
  function bankHolidayRegionLabel(id2) {
    return bankHolidayRegion(id2)?.title ?? text9(id2);
  }
  function countryKey(countryCode) {
    const raw = text9(countryCode).toUpperCase();
    if (raw === "UK" || raw.startsWith("GB")) return "GB";
    return raw;
  }
  function bankHolidayRegionsForCountry(countryCode) {
    const country = countryKey(countryCode);
    return BANK_HOLIDAY_REGIONS.filter((region) => region.countryCode === country);
  }
  function defaultBankHolidayRegionForCountry(countryCode) {
    const country = countryKey(countryCode);
    if (country === "GB") return DEFAULT_BANK_HOLIDAY_REGION_ID;
    const regions = bankHolidayRegionsForCountry(country);
    return regions.length === 1 ? regions[0].id : null;
  }
  function bankHolidayCountries() {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const region of BANK_HOLIDAY_REGIONS) {
      if (seen.has(region.countryCode)) continue;
      seen.add(region.countryCode);
      out.push({ code: region.countryCode, title: COUNTRY_TITLES[region.countryCode] ?? region.title });
    }
    return out;
  }
  function bankHolidayCountryTitle(countryCode) {
    const country = countryKey(countryCode);
    return bankHolidayCountries().find((entry) => entry.code === country)?.title ?? country;
  }
  function companyDetailsRegionPrompt(previous, next) {
    const before = countryKey(previous?.countryCode) || "GB";
    const after = countryKey(next?.countryCode);
    if (!after || after === before) return { required: false };
    const saved = bankHolidayRegion(previous?.bankHolidayRegionId);
    if (saved && saved.countryCode === after) return { required: false };
    const choices = bankHolidayRegionsForCountry(after);
    if (choices.length === 0) return { required: false };
    return {
      required: true,
      choices,
      defaultRegionId: defaultBankHolidayRegionForCountry(after),
      message: `Choose the bank holidays for ${bankHolidayCountryTitle(after)}.`
    };
  }
  var LAUNCH_COUNTRY_CODES = ["GB", "IE"];
  function launchCountryOptions(storedCountryCode) {
    const out = LAUNCH_COUNTRY_CODES.map((code) => ({ code, title: bankHolidayCountryTitle(code) }));
    const stored = countryKey(storedCountryCode);
    if (stored && !LAUNCH_COUNTRY_CODES.includes(stored)) out.push({ code: stored, title: bankHolidayCountryTitle(stored) });
    return out;
  }

  // lib/canonical/companyDetails.ts
  var OPTIONAL_ADDRESS_FIELDS = ["officeAddressLine2", "officeCounty", "officePostcode"];
  var ALL_ADDRESS_FIELDS = [
    "officeAddressLine1",
    "officeAddressLine2",
    "officeCity",
    "officeCounty",
    "officePostcode"
  ];
  function text10(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function record3(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function finiteNumber3(value) {
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(n) ? n : null;
  }
  function normalizeDocumentAbbreviation(value) {
    return text10(value).replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  }
  function normalizeCompanyCountryCode(value) {
    const raw = text10(value).toUpperCase();
    if (raw === "UK") return "GB";
    const country = raw.split("-")[0];
    return /^[A-Z]{2}$/.test(country) ? country : "";
  }
  function parseCompanyDetails(orgDoc) {
    const data = record3(orgDoc);
    const nested = record3(data.officeAddress);
    const settings = record3(data.settings);
    const pick = (flat, legacy) => text10(data[flat]) || text10(nested[legacy]);
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
      companyLogoURL: text10(data.companyLogoURL),
      defaultLatitude: finiteNumber3(data.defaultLatitude),
      defaultLongitude: finiteNumber3(data.defaultLongitude),
      bankHolidayRegionId: normalizeBankHolidayRegionId(text10(data.bankHolidayRegionId) || text10(settings.bankHolidayRegionId)) || text10(data.bankHolidayRegionId) || text10(settings.bankHolidayRegionId) || defaultBankHolidayRegionForCountry(normalizeCompanyCountryCode(data.countryCode) || "GB") || DEFAULT_BANK_HOLIDAY_REGION_ID
    };
  }
  function companyDetailsValidationError(input) {
    const nameOk = Boolean(text10(input.name));
    const countryOk = Boolean(normalizeCompanyCountryCode(input.countryCode));
    if (input.hasOfficeAddress) {
      if (!nameOk || !countryOk || !text10(input.officeAddressLine1) || !text10(input.officeCity)) {
        return "Name, country, address line 1 and town are required.";
      }
      return companyDetailsRegionError(input);
    }
    if (!nameOk || !countryOk) return "Organisation name and country are required.";
    return companyDetailsRegionError(input);
  }
  function companyDetailsRegionError(input) {
    if (!input.previous) return null;
    const prompt = companyDetailsRegionPrompt(input.previous, { countryCode: input.countryCode });
    if (!prompt.required) return null;
    const chosen = normalizeBankHolidayRegionId(input.bankHolidayRegionId);
    return chosen && prompt.choices.some((region) => region.id === chosen) ? null : prompt.message;
  }
  function companyDetailsWriteFields(input) {
    const set = { ...organizationNameWriteFields(input.name) };
    const remove = ["officeAddress"];
    const country = normalizeCompanyCountryCode(input.countryCode);
    if (country) set.countryCode = country;
    if (input.hasOfficeAddress) {
      set.officeAddressLine1 = text10(input.officeAddressLine1);
      set.officeCity = text10(input.officeCity);
      const optional = {
        officeAddressLine2: text10(input.officeAddressLine2),
        officeCounty: text10(input.officeCounty),
        officePostcode: text10(input.officePostcode)
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
      const logo = text10(input.companyLogoURL);
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
      const region = normalizeBankHolidayRegionId(input.bankHolidayRegionId) || text10(input.bankHolidayRegionId).toUpperCase() || DEFAULT_BANK_HOLIDAY_REGION_ID;
      set.bankHolidayRegionId = region;
      set["settings.bankHolidayRegionId"] = region;
    } else if (input.previous && country) {
      const previousCountry = normalizeCompanyCountryCode(input.previous.countryCode) || "GB";
      if (previousCountry !== country && !defaultBankHolidayRegionForCountry(country)) {
        remove.push("bankHolidayRegionId", "settings.bankHolidayRegionId");
      }
    }
    return { set, remove };
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
  var TOMBSTONED_BOOKING_COLLECTIONS = ["bookings", "managerSiteBookings", "subcontractorBookings"];
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
  function errorCodeText(errorCode) {
    return (typeof errorCode === "number" ? String(errorCode) : trimmed5(errorCode)).toLowerCase().replace(/^firestore\//, "");
  }
  function bookingReplayRefusedIsFinal(refusal) {
    const input = refusal && typeof refusal === "object" && "code" in refusal ? refusal : { code: refusal, isCreate: null };
    const code = errorCodeText(input.code);
    if (code === "permission-denied" || code === "7") return true;
    if ((code === "not-found" || code === "5") && input.isCreate === false) return true;
    return false;
  }
  var BOOKING_REPLAY_REFUSED_MESSAGE = "This booking was cancelled or deleted on another device.";

  // lib/canonical/operationsDocuments.ts
  function text11(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function optionalText2(value) {
    return text11(value) || null;
  }
  function record4(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function rows(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item === "object" && !Array.isArray(item));
  }
  function idList3(value) {
    if (!Array.isArray(value)) return [];
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const item of value) {
      const id2 = typeof item === "string" ? item.trim() : typeof item === "number" ? String(item) : "";
      const key3 = normalizeDocumentId(id2);
      if (!id2 || seen.has(key3)) continue;
      seen.add(key3);
      out.push(id2);
    }
    return out;
  }
  function textList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
  }
  function dayKeyOf2(ms, zone3) {
    return ms == null ? null : dayKeyInZone(new Date(ms), zone3);
  }
  var DAY_KEY4 = /^\d{4}-\d{2}-\d{2}$/;
  function storedDayKey(raw, zone3) {
    const value = text11(raw);
    if (DAY_KEY4.test(value)) return value;
    return dayKeyOf2(documentInstantMs(raw), zone3);
  }
  function blankToNull(value) {
    if (value === void 0) return void 0;
    return text11(value) || null;
  }
  var CREATE_ONLY = ["id", "createdAt", "organizationId"];
  function organizationDayStartMs(dayKey, timeZone) {
    const key3 = text11(dayKey);
    if (!DAY_KEY4.test(key3)) return null;
    const ms = dateFromDayKeyInZone(key3, zoneOrLondon(timeZone)).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  var MATERIAL_WORKFLOW_STATUSES = ["draft", "sentForQuote", "ordered"];
  var MATERIAL_UNITS = ["Number", "Box", "Length", "Drum", "Pallet"];
  var MATERIAL_LENGTH_UNITS = ["M", "MM"];
  var MATERIAL_STATUS_SYNONYMS = {
    draft: "draft",
    new: "draft",
    pending: "draft",
    sentforquote: "sentForQuote",
    quote: "sentForQuote",
    quoted: "sentForQuote",
    quoterequested: "sentForQuote",
    sent: "sentForQuote",
    ordered: "ordered",
    order: "ordered",
    orderplaced: "ordered"
  };
  function normalizeMaterialWorkflowStatus(raw) {
    const compact = text11(raw).replace(/[\s_\-]+/g, "").toLowerCase();
    return MATERIAL_STATUS_SYNONYMS[compact] ?? "draft";
  }
  function normalizeMaterialUnit(raw) {
    const token = text11(raw).toLowerCase();
    return MATERIAL_UNITS.find((unit) => unit.toLowerCase() === token) ?? "Number";
  }
  function normalizeMaterialLengthUnit(raw) {
    const token = text11(raw).toUpperCase();
    return token === "M" || token === "MM" ? token : null;
  }
  function normalizeMaterialRequestType(raw) {
    const token = text11(raw).toLowerCase();
    if (token === "order" || token === "ordered") return "Order";
    if (token === "quote" || token === "sentforquote") return "Quote";
    return null;
  }
  function materialLength(row2) {
    const length = text11(row2.length) || text11(row2.sizeOrLength);
    if (length) return length;
    const pack = documentNumber(row2.packSize);
    return pack == null ? null : String(pack);
  }
  function materialQuantity(raw) {
    const n = documentNumber(raw);
    return n != null && n >= 0 ? n : 1;
  }
  function parseMaterialLineDocument(docId, data, options) {
    const id2 = text11(docId);
    if (!id2) return null;
    const row2 = record4(data);
    const projectId = text11(row2.projectId);
    const material = text11(row2.material) || text11(row2.name);
    if (!projectId || !material) return null;
    const zone3 = zoneOrLondon(options?.timeZone);
    const dateMs = documentInstantMs(row2.date);
    const lengthValue = materialLength(row2);
    return {
      id: id2,
      projectId,
      quantity: materialQuantity(row2.quantity),
      unit: normalizeMaterialUnit(row2.unit),
      material,
      addedBy: text11(row2.addedBy),
      addedByUserId: optionalText2(row2.addedByUserId),
      addedAtMs: documentInstantMs(row2.addedAt) ?? documentInstantMs(row2.createdAt),
      editedBy: optionalText2(row2.editedBy),
      editedByUserId: optionalText2(row2.editedByUserId),
      editedAtMs: documentInstantMs(row2.editedAt),
      dayKey: DAY_KEY4.test(text11(row2.dayKey)) ? text11(row2.dayKey) : storedDayKey(row2.date, zone3),
      dateMs,
      status: normalizeMaterialWorkflowStatus(row2.status),
      catalogueItemId: optionalText2(row2.catalogueItemId),
      brand: optionalText2(row2.brand),
      productCode: optionalText2(row2.productCode),
      category: optionalText2(row2.category),
      size: optionalText2(row2.size),
      length: lengthValue,
      lengthUnit: lengthValue ? normalizeMaterialLengthUnit(row2.lengthUnit) : null,
      websiteURL: optionalText2(row2.websiteURL),
      notes: optionalText2(row2.notes),
      lastSentAtMs: documentInstantMs(row2.lastSentAt),
      lastSentRequestType: normalizeMaterialRequestType(row2.lastSentRequestType),
      createdAtMs: documentInstantMs(row2.createdAt),
      updatedAtMs: documentInstantMs(row2.updatedAt)
    };
  }
  function parseMaterialListDocuments(docs, options) {
    const out = [];
    for (const entry of docs || []) {
      const parsed = parseMaterialLineDocument(entry?.id, entry?.data, options);
      if (parsed) out.push(parsed);
    }
    return out.sort(
      (a, b) => (a.dayKey ?? "").localeCompare(b.dayKey ?? "") || a.material.localeCompare(b.material) || a.id.localeCompare(b.id)
    );
  }
  function materialLineFields(input, timeZone) {
    const material = text11(input?.material);
    const length = text11(input?.length);
    const out = {
      id: text11(input?.id),
      projectId: text11(input?.projectId),
      quantity: materialQuantity(input?.quantity),
      unit: normalizeMaterialUnit(input?.unit),
      material,
      name: material,
      dayKey: text11(input?.dayKey),
      date: organizationDayStartMs(input?.dayKey, timeZone),
      status: normalizeMaterialWorkflowStatus(input?.status),
      catalogueItemId: blankToNull(input?.catalogueItemId),
      brand: blankToNull(input?.brand),
      productCode: blankToNull(input?.productCode),
      category: blankToNull(input?.category),
      size: blankToNull(input?.size),
      length: length || null,
      sizeOrLength: length || null,
      lengthUnit: length ? normalizeMaterialLengthUnit(input?.lengthUnit) : null,
      websiteURL: blankToNull(input?.websiteURL),
      notes: blankToNull(input?.notes)
    };
    if (input?.addedBy !== void 0) out.addedBy = text11(input.addedBy);
    if (input?.addedByUserId !== void 0) out.addedByUserId = blankToNull(input.addedByUserId);
    if (input?.addedAt !== void 0) out.addedAt = input.addedAt;
    if (input?.editedBy !== void 0) out.editedBy = blankToNull(input.editedBy);
    if (input?.editedByUserId !== void 0) out.editedByUserId = blankToNull(input.editedByUserId);
    if (input?.editedAt !== void 0) out.editedAt = input.editedAt;
    return out;
  }
  var MATERIAL_LENGTH_WRITE_GROUP = ["length", "sizeOrLength", "lengthUnit"];
  var MATERIAL_NAME_WRITE_GROUP = ["material", "name"];
  var MATERIAL_DAY_WRITE_GROUP = ["dayKey", "date"];
  function materialLineWriteFields(before, next) {
    return documentWriteFields(before, next, {
      together: [MATERIAL_LENGTH_WRITE_GROUP, MATERIAL_NAME_WRITE_GROUP, MATERIAL_DAY_WRITE_GROUP],
      createOnly: [...CREATE_ONLY, "addedAt", "addedBy", "addedByUserId"]
    });
  }
  function materialSendStatusWriteFields(currentStatus, requestType) {
    const type = normalizeMaterialRequestType(requestType) ?? "Quote";
    const current = normalizeMaterialWorkflowStatus(currentStatus);
    if (type === "Order") return { status: "ordered", lastSentRequestType: "Order" };
    return { status: current === "ordered" ? "ordered" : "sentForQuote", lastSentRequestType: "Quote" };
  }
  function parseMaterialCatalogueDocument(docId, data) {
    const id2 = text11(docId);
    if (!id2) return null;
    const row2 = record4(data);
    const name = text11(row2.name);
    if (!name) return null;
    const length = materialLength(row2);
    return {
      id: id2,
      name,
      brand: text11(row2.brand) || "Custom",
      productCode: optionalText2(row2.productCode),
      defaultUnit: normalizeMaterialUnit(row2.defaultUnit),
      size: optionalText2(row2.size),
      length,
      lengthUnit: length ? normalizeMaterialLengthUnit(row2.lengthUnit) : null,
      category: text11(row2.category) || "Other",
      createdAtMs: documentInstantMs(row2.createdAt),
      createdByUserId: text11(row2.createdByUserId),
      createdByName: text11(row2.createdByName),
      updatedAtMs: documentInstantMs(row2.updatedAt)
    };
  }
  function materialCatalogueItemFields(item) {
    const length = text11(item?.length);
    const out = {
      id: text11(item?.id),
      name: text11(item?.name),
      brand: text11(item?.brand) || "Custom",
      defaultUnit: normalizeMaterialUnit(item?.defaultUnit),
      category: text11(item?.category) || "Other",
      productCode: blankToNull(item?.productCode) ?? null,
      size: blankToNull(item?.size) ?? null,
      length: length || null,
      sizeOrLength: length || null,
      lengthUnit: length ? normalizeMaterialLengthUnit(item?.lengthUnit) : null
    };
    if (item?.createdAt !== void 0) out.createdAt = item.createdAt;
    if (item?.createdByUserId !== void 0) out.createdByUserId = text11(item.createdByUserId);
    if (item?.createdByName !== void 0) out.createdByName = text11(item.createdByName);
    return out;
  }
  function materialCatalogueItemWriteFields(before, next) {
    return documentWriteFields(before, next, {
      together: [MATERIAL_LENGTH_WRITE_GROUP],
      createOnly: [...CREATE_ONLY, "createdByUserId", "createdByName"]
    });
  }
  function materialCatalogueWrites(input) {
    const storedByKey = /* @__PURE__ */ new Map();
    for (const entry of input?.stored || []) {
      const id2 = text11(entry?.id);
      if (id2) storedByKey.set(normalizeDocumentId(id2), { id: id2, data: record4(entry?.data) });
    }
    const nextKeys = /* @__PURE__ */ new Set();
    const write = [];
    for (const item of input?.next || []) {
      const id2 = text11(item?.id);
      if (!id2 || !text11(item?.name)) continue;
      const key3 = normalizeDocumentId(id2);
      if (nextKeys.has(key3)) continue;
      nextKeys.add(key3);
      const stored = storedByKey.get(key3);
      const fields = materialCatalogueItemFields({ ...item, id: stored?.id ?? id2 });
      const result2 = materialCatalogueItemWriteFields(stored ? stored.data : null, fields);
      if (Object.keys(result2.set).length > 0 || result2.remove.length > 0) {
        write.push({ id: stored?.id ?? id2, create: !stored, ...result2 });
      }
    }
    const remove = input?.loaded === true && nextKeys.size > 0 ? [...storedByKey.entries()].filter(([key3]) => !nextKeys.has(key3)).map(([, entry]) => entry.id) : [];
    return { write, remove };
  }
  function parseMaterialSendRecordDocument(docId, data, options) {
    const id2 = text11(docId);
    if (!id2) return null;
    const row2 = record4(data);
    const projectId = text11(row2.projectId);
    const sentAtMs = documentInstantMs(row2.sentAt);
    if (!projectId || sentAtMs == null) return null;
    const zone3 = zoneOrLondon(options?.timeZone);
    const requestType = normalizeMaterialRequestType(row2.requestType) === "Order" ? "order" : "quote";
    const materialsDateMs = documentInstantMs(row2.materialsDate);
    const recipients = [];
    for (const entry of rows(row2.recipients)) {
      const email = text11(entry.email);
      if (!email) continue;
      recipients.push({ name: text11(entry.name), email, wholesalerName: optionalText2(entry.wholesalerName) });
    }
    const lines = [];
    for (const entry of rows(row2.lines)) {
      const materialId = text11(entry.materialId);
      const name = text11(entry.name);
      if (!materialId || !name) continue;
      lines.push({
        materialId,
        name,
        quantity: materialQuantity(entry.quantity),
        unit: normalizeMaterialUnit(entry.unit),
        brand: optionalText2(entry.brand),
        productCode: optionalText2(entry.productCode),
        lengthDisplay: optionalText2(entry.lengthDisplay)
      });
    }
    return {
      id: id2,
      projectId,
      requestType,
      sentAtMs,
      materialsDayKey: storedDayKey(row2.materialsDate, zone3),
      materialsDateMs,
      deliveryRequiredAtMs: materialOrderIncludesDeliveryRequired(requestType) ? documentInstantMs(row2.deliveryRequiredAt) : null,
      sentBy: text11(row2.sentBy),
      recipients,
      lines
    };
  }
  function materialSendRecordCreateFields(input) {
    const requestType = normalizeMaterialRequestType(input?.requestType) ?? "Quote";
    const out = {
      id: text11(input?.id),
      projectId: text11(input?.projectId),
      requestType,
      sentAt: input?.sentAt,
      sentBy: text11(input?.sentBy),
      recipients: (input?.recipients || []).filter((entry) => text11(entry?.email)).map((entry) => {
        const recipient = { name: text11(entry.name), email: text11(entry.email) };
        if (text11(entry.wholesalerName)) recipient.wholesalerName = text11(entry.wholesalerName);
        return recipient;
      }),
      lines: (input?.lines || []).filter((line) => text11(line?.materialId) && text11(line?.name)).map((line) => {
        const out2 = {
          materialId: text11(line.materialId),
          name: text11(line.name),
          quantity: materialQuantity(line.quantity),
          unit: normalizeMaterialUnit(line.unit)
        };
        if (text11(line.brand)) out2.brand = text11(line.brand);
        if (text11(line.productCode)) out2.productCode = text11(line.productCode);
        if (text11(line.lengthDisplay)) out2.lengthDisplay = text11(line.lengthDisplay);
        return out2;
      })
    };
    if (input?.materialsDate != null) out.materialsDate = input.materialsDate;
    if (requestType === "Order" && input?.deliveryRequiredAt != null) out.deliveryRequiredAt = input.deliveryRequiredAt;
    return out;
  }
  function wholesalerContactId(firmDocId, index, contact) {
    const row2 = record4(contact);
    return derivedRowId(firmDocId, "contacts", index, [text11(row2.name), text11(row2.email).toLowerCase()]);
  }
  function parseWholesalerDocument(docId, data) {
    const id2 = text11(docId);
    if (!id2) return null;
    const row2 = record4(data);
    const name = text11(row2.name);
    if (!name) return null;
    const contacts = [];
    for (const [index, entry] of (Array.isArray(row2.contacts) ? row2.contacts : []).entries()) {
      const contact = record4(entry);
      const contactName = text11(contact.name);
      const email = text11(contact.email);
      if (!contactName && !email) continue;
      const storedId = text11(contact.id);
      contacts.push({
        id: storedId || wholesalerContactId(id2, index, contact),
        idStored: Boolean(storedId),
        name: contactName,
        email,
        phone: optionalText2(contact.phone),
        isPrimary: documentBool(contact.isPrimary) === true,
        createdAtMs: documentInstantMs(contact.createdAt)
      });
    }
    const storedPrimary = text11(row2.primaryContactId);
    const primary = contacts.find((contact) => storedPrimary && normalizeDocumentId(contact.id) === normalizeDocumentId(storedPrimary)) ?? contacts.find((contact) => contact.isPrimary) ?? contacts[0];
    for (const contact of contacts) contact.isPrimary = contact === primary;
    const createdAtMs = documentInstantMs(row2.createdAt);
    return {
      id: id2,
      name,
      address: optionalText2(row2.address),
      trade: optionalText2(row2.trade),
      accountNumber: optionalText2(row2.accountNumber),
      primaryContactId: primary ? primary.id : null,
      contacts,
      createdAtMs,
      updatedAtMs: documentInstantMs(row2.updatedAt) ?? createdAtMs
    };
  }
  var WHOLESALER_CONTACTS_WRITE_GROUP = ["contacts", "primaryContactId"];
  function wholesalerWriteFields(before, next) {
    return documentWriteFields(before, next, { together: [WHOLESALER_CONTACTS_WRITE_GROUP], createOnly: CREATE_ONLY });
  }
  function parseSiteAuditDocument(docId, data, options) {
    const id2 = text11(docId);
    if (!id2) return null;
    const row2 = record4(data);
    const projectId = text11(row2.projectId);
    const type = text11(row2.type);
    if (!projectId || !type) return null;
    const zone3 = zoneOrLondon(options?.timeZone);
    const items = [];
    for (const [index, entry] of (Array.isArray(row2.items) ? row2.items : []).entries()) {
      const item = record4(entry);
      const title = text11(item.title);
      if (!title) continue;
      const storedId = text11(item.id);
      items.push({
        id: storedId || derivedRowId(id2, "items", index, [title, text11(item.location)]),
        idStored: Boolean(storedId),
        title,
        location: text11(item.location),
        assignee: text11(item.assignee),
        comments: text11(item.comments),
        annotations: text11(item.annotations),
        imageURL: optionalText2(item.imageURL),
        imageCapturedAtMs: documentInstantMs(item.imageCapturedAt),
        createdAtMs: documentInstantMs(item.createdAt)
      });
    }
    const dateMs = documentInstantMs(row2.date);
    return {
      id: id2,
      projectId,
      projectJobNumber: text11(row2.projectJobNumber),
      projectName: text11(row2.projectName),
      type,
      customTitle: text11(row2.customTitle),
      authorName: text11(row2.authorName),
      dateMs,
      dayKey: storedDayKey(row2.date, zone3),
      createdAtMs: documentInstantMs(row2.createdAt) ?? dateMs,
      createdByUserId: text11(row2.createdByUserId),
      visibleToOperatives: documentBool(row2.visibleToOperatives) ?? true,
      items,
      organizationId: documentOrganizationId(row2.organizationId),
      updatedAtMs: documentInstantMs(row2.updatedAt)
    };
  }
  function siteAuditWriteFields(before, next) {
    return documentWriteFields(before, next, { createOnly: [...CREATE_ONLY, "createdByUserId"] });
  }
  function mergeStoredRows(stored, next) {
    const byId = /* @__PURE__ */ new Map();
    for (const row2 of rows(stored)) {
      const key3 = normalizeDocumentId(row2.id);
      if (key3) byId.set(key3, row2);
    }
    return (next || []).map((row2) => {
      const base = byId.get(normalizeDocumentId(row2?.id)) ?? {};
      const out = { ...base };
      for (const [key3, value] of Object.entries(row2 || {})) {
        if (value !== void 0 && value !== null) out[key3] = value;
      }
      return out;
    });
  }
  var PROJECT_TASK_STATUSES = ["To Do", "In Progress", "Completed"];
  var PROJECT_TASK_PRIORITIES = ["Low", "Normal", "High", "Urgent"];
  var TASK_STATUS_SYNONYMS = {
    todo: "To Do",
    open: "To Do",
    new: "To Do",
    pending: "To Do",
    notstarted: "To Do",
    inprogress: "In Progress",
    started: "In Progress",
    doing: "In Progress",
    completed: "Completed",
    complete: "Completed",
    done: "Completed",
    closed: "Completed"
  };
  function normalizeProjectTaskStatus(raw) {
    const compact = text11(raw).replace(/[\s_\-]+/g, "").toLowerCase();
    return TASK_STATUS_SYNONYMS[compact] ?? "To Do";
  }
  function normalizeProjectTaskPriority(raw) {
    const token = text11(raw).toLowerCase();
    return PROJECT_TASK_PRIORITIES.find((priority) => priority.toLowerCase() === token) ?? "Normal";
  }
  function urlList(value) {
    if (!Array.isArray(value)) return [];
    const out = [];
    for (const item of value) {
      const url = typeof item === "string" ? item.trim() : text11(record4(item).url) || text11(record4(item).downloadURL);
      if (url) out.push(url);
    }
    return out;
  }
  function parseTaskDocument(docId, data, options) {
    const id2 = text11(docId);
    if (!id2) return null;
    const row2 = record4(data);
    const title = text11(row2.title);
    if (!title) return null;
    const zone3 = zoneOrLondon(options?.timeZone);
    const items = [];
    for (const [index, entry] of (Array.isArray(row2.items) ? row2.items : []).entries()) {
      const item = record4(entry);
      const itemTitle = text11(item.title);
      if (!itemTitle) continue;
      const storedId = text11(item.id);
      items.push({
        id: storedId || derivedRowId(id2, "items", index, [itemTitle]),
        idStored: Boolean(storedId),
        title: itemTitle,
        description: optionalText2(item.description)
      });
    }
    const dueDateMs = documentInstantMs(row2.dueDate);
    const createdAtMs = documentInstantMs(row2.createdAt);
    return {
      id: id2,
      projectId: text11(row2.projectId),
      title,
      details: optionalText2(row2.details),
      createdBy: text11(row2.createdBy),
      createdByUserId: text11(row2.createdByUserId),
      status: normalizeProjectTaskStatus(row2.status),
      priority: normalizeProjectTaskPriority(row2.priority),
      assignedOperativeId: optionalText2(row2.assignedOperativeId),
      assignedManagerId: optionalText2(row2.assignedManagerId),
      assignedOperativeIds: idList3(row2.assignedOperativeIds),
      assignedManagerIds: idList3(row2.assignedManagerIds),
      dueDateMs,
      dueDayKey: storedDayKey(row2.dueDate, zone3),
      completedBy: optionalText2(row2.completedBy),
      completedAtMs: documentInstantMs(row2.completedAt),
      completionNotes: optionalText2(row2.completionNotes),
      completionImages: urlList(row2.completionImages),
      completionFiles: urlList(row2.completionFiles),
      attachedImageURLs: urlList(row2.attachedImageURLs),
      attachedFileURL: optionalText2(row2.attachedFileURL),
      attachedFileName: optionalText2(row2.attachedFileName),
      attachedSiteAuditId: optionalText2(row2.attachedSiteAuditId),
      attachedSiteAuditTitle: optionalText2(row2.attachedSiteAuditTitle),
      items,
      completedItemIds: idList3(row2.completedItemIds),
      organizationId: documentOrganizationId(row2.organizationId),
      createdAtMs,
      updatedAtMs: documentInstantMs(row2.updatedAt) ?? createdAtMs
    };
  }
  function listOrNull(value) {
    const list = (value || []).map((item) => text11(item)).filter(Boolean);
    return list.length > 0 ? list : null;
  }
  function taskFields(input) {
    const items = (input?.items || []).filter((item) => text11(item?.id) && text11(item?.title)).map((item) => ({ id: text11(item.id), title: text11(item.title), description: text11(item.description) }));
    const out = {
      id: text11(input?.id),
      projectId: text11(input?.projectId),
      title: text11(input?.title),
      details: text11(input?.details),
      status: normalizeProjectTaskStatus(input?.status),
      priority: normalizeProjectTaskPriority(input?.priority),
      assignedOperativeId: blankToNull(input?.assignedOperativeId) ?? null,
      assignedManagerId: blankToNull(input?.assignedManagerId) ?? null,
      assignedOperativeIds: listOrNull(input?.assignedOperativeIds),
      assignedManagerIds: listOrNull(input?.assignedManagerIds),
      dueDate: input?.dueDate ?? null,
      completedBy: blankToNull(input?.completedBy) ?? null,
      completedAt: input?.completedAt ?? null,
      completionNotes: blankToNull(input?.completionNotes) ?? null,
      completionImages: listOrNull(input?.completionImages),
      completionFiles: listOrNull(input?.completionFiles),
      attachedImageURLs: listOrNull(input?.attachedImageURLs),
      attachedFileURL: blankToNull(input?.attachedFileURL) ?? null,
      attachedFileName: blankToNull(input?.attachedFileName) ?? null,
      attachedSiteAuditId: blankToNull(input?.attachedSiteAuditId) ?? null,
      attachedSiteAuditTitle: blankToNull(input?.attachedSiteAuditTitle) ?? null,
      items: items.length > 0 ? items : null,
      completedItemIds: listOrNull(input?.completedItemIds)
    };
    if (input?.createdBy !== void 0) out.createdBy = text11(input.createdBy);
    if (input?.createdByUserId != null && text11(input.createdByUserId)) out.createdByUserId = text11(input.createdByUserId);
    if (input?.createdAt !== void 0) out.createdAt = input.createdAt;
    if (input?.organizationId !== void 0) out.organizationId = text11(input.organizationId) || null;
    return out;
  }
  var TASK_OPERATIVE_WRITE_GROUP = ["assignedOperativeId", "assignedOperativeIds"];
  var TASK_MANAGER_WRITE_GROUP = ["assignedManagerId", "assignedManagerIds"];
  var TASK_COMPLETION_WRITE_GROUP = ["completedBy", "completedAt"];
  var TASK_ITEMS_WRITE_GROUP = ["items", "completedItemIds"];
  function taskWriteFields(before, next) {
    return documentWriteFields(before, next, {
      together: [TASK_OPERATIVE_WRITE_GROUP, TASK_MANAGER_WRITE_GROUP, TASK_COMPLETION_WRITE_GROUP, TASK_ITEMS_WRITE_GROUP],
      createOnly: [...CREATE_ONLY, "createdBy", "createdByUserId"]
    });
  }
  var JOB_TYPES_DOCUMENT_ID = "jobTypes";
  var DEFAULT_JOB_TYPE_NAMES = ["CAT A", "CAT B", "Small Works", "Maintenance"];
  var RESTORED_JOB_TYPE_NAMES = [...DEFAULT_JOB_TYPE_NAMES, "Decarbonisation"];
  var JOB_TYPE_ALIASES = {
    cata: "CAT A",
    categorya: "CAT A",
    catafitout: "CAT A",
    catafit: "CAT A",
    catb: "CAT B",
    categoryb: "CAT B",
    catbfitout: "CAT B",
    smallworks: "Small Works",
    smallwork: "Small Works",
    maintenance: "Maintenance",
    decarbonisation: "Decarbonisation",
    decarbonization: "Decarbonisation"
  };
  function canonicalJobTypeName(name) {
    const raw = typeof name === "string" ? name : "";
    const compact = raw.replace(/[\s_\-]+/g, "").toLowerCase();
    return JOB_TYPE_ALIASES[compact] || raw.trim();
  }
  function stringFromJobTypeField(value) {
    if (typeof value === "string") return value.trim();
    const row2 = record4(value);
    return text11(row2.name) || text11(row2.rawValue);
  }
  function uniqueSortedNames(names) {
    const seen = /* @__PURE__ */ new Map();
    for (const name of names) {
      const trimmed6 = text11(name);
      if (trimmed6 && !seen.has(trimmed6.toLowerCase())) seen.set(trimmed6.toLowerCase(), trimmed6);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, void 0, { sensitivity: "base" }));
  }
  function coerceJobTypeList(raw) {
    let values = [];
    if (Array.isArray(raw)) values = raw;
    else if (typeof raw === "string") values = raw.split(",");
    else if (raw && typeof raw === "object") values = Object.values(raw);
    return uniqueSortedNames(values.map((item) => canonicalJobTypeName(stringFromJobTypeField(item))));
  }
  function parseJobTypesDocument(data, organization) {
    const org = record4(organization);
    const nested = record4(org.settings).jobTypes;
    return {
      jobTypes: uniqueSortedNames([...coerceJobTypeList(record4(data).jobTypes), ...coerceJobTypeList(org.jobTypes ?? nested)])
    };
  }
  function mergeJobTypeCatalogues(stored, recovered) {
    return uniqueSortedNames([...stored, ...recovered, ...RESTORED_JOB_TYPE_NAMES].map(canonicalJobTypeName));
  }
  function jobTypesWriteFields(stored, next, options) {
    const names = uniqueSortedNames((next || []).map(canonicalJobTypeName));
    const before = uniqueSortedNames((stored || []).map(canonicalJobTypeName));
    if (names.length === 0) {
      if (before.length === 0) return null;
      const removed = new Set((options?.removed || []).map((name) => canonicalJobTypeName(String(name ?? "")).toLowerCase()));
      return before.every((name) => removed.has(name.toLowerCase())) ? { set: { jobTypes: [] } } : null;
    }
    if (before.length === names.length && before.every((name, index) => name === names[index])) return null;
    return { set: { jobTypes: names } };
  }
  function jobTypesChangeWriteFields(stored, change) {
    const removed = new Set((change?.remove || []).map((name) => canonicalJobTypeName(String(name ?? "")).toLowerCase()));
    const kept = (stored || []).map(canonicalJobTypeName).filter((name) => name && !removed.has(name.toLowerCase()));
    const added = (change?.add || []).map((name) => canonicalJobTypeName(String(name ?? ""))).filter(Boolean);
    return jobTypesWriteFields(stored, [...kept, ...added], { removed: change?.remove ?? [] });
  }
  var TRADE_TYPE_INVENTORY_DOCUMENT_ID = "tradeTypeInventory";
  function parseTradeTypeInventory(data) {
    const seen = /* @__PURE__ */ new Set();
    const trades = [];
    for (const trade of textList(record4(data).trades)) {
      if (seen.has(trade.toLowerCase())) continue;
      seen.add(trade.toLowerCase());
      trades.push(trade);
    }
    return { trades };
  }
  function tradeTypeInventoryWriteFields(stored, incoming) {
    const trades = parseTradeTypeInventory(stored).trades;
    const seen = new Set(trades.map((trade) => trade.toLowerCase()));
    let added = false;
    for (const trade of incoming || []) {
      const name = text11(trade);
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      trades.push(name);
      added = true;
    }
    return added ? { set: { trades } } : null;
  }
  function parseOperativeProfileDocument(docId, data) {
    const documentId2 = text11(docId);
    if (!documentId2) return null;
    const row2 = record4(data);
    const managers = idList3(row2.assignedManagerUserIds);
    const single = text11(row2.assignedManagerUserId);
    if (single && !managers.some((id2) => normalizeDocumentId(id2) === normalizeDocumentId(single))) managers.unshift(single);
    const pay = readStoredRates({
      payBasis: text11(row2.payBasis).toLowerCase() || null,
      dayRate: documentNumber(row2.dayRate),
      hourlyRate: documentNumber(row2.hourlyRate)
    });
    return {
      userId: text11(row2.userId) || documentId2,
      documentId: documentId2,
      assignedManagerUserId: managers[0] ?? null,
      assignedManagerUserIds: managers,
      payBasis: pay.payBasis,
      dayRate: pay.payBasis === "day" ? pay.dayRate : null,
      hourlyRate: pay.payBasis === "hourly" ? pay.hourlyRate : null,
      updatedAtMs: documentInstantMs(row2.updatedAt)
    };
  }
  function operativeProfileWriteFields(before, next) {
    return documentWriteFields(before, next, {
      together: [PAY_WRITE_GROUP, ["assignedManagerUserId", "assignedManagerUserIds"]],
      createOnly: ["userId", "createdAt"]
    });
  }

  // lib/canonical/materialCutOffWarnings.ts
  var DAY_KEY5 = /^\d{4}-\d{2}-\d{2}$/;
  function text12(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function instant(value) {
    if (value instanceof Date) return value;
    return new Date(value);
  }
  function dayKeyOf3(row2, timeZone) {
    const key3 = text12(row2.dayKey);
    if (DAY_KEY5.test(key3)) return key3;
    const iso = text12(row2.dateIso);
    if (!iso) return "";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : dayKeyInZone(date, timeZone);
  }
  function orderedMaterialIds(records) {
    const ids = /* @__PURE__ */ new Set();
    for (const record9 of records || []) {
      if (!record9 || normalizeMaterialRequestType(record9.requestType) !== "Order") continue;
      for (const id2 of record9.materialIds || []) {
        const value = normalizeDocumentId(id2);
        if (value) ids.add(value);
      }
      for (const line of record9.lines || []) {
        const value = normalizeDocumentId(line?.materialId);
        if (value) ids.add(value);
      }
    }
    return ids;
  }
  function materialLineCountsAsOrdered(line, sendRecords) {
    if (normalizeMaterialWorkflowStatus(line.status) === "ordered") return true;
    return orderedMaterialIds(sendRecords).has(normalizeDocumentId(line.id));
  }
  function materialCutOffWarningRows(input) {
    const rows3 = materialCutOffWarningRowsUnscoped(input);
    if (!input.scope || input.scope.kind === "all") return rows3;
    return rows3.filter((row2) => isJobInWarningScope(input.scope, row2.projectId));
  }
  function materialCutOffWarningRowsUnscoped(input) {
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
      const projectId = text12(booking?.projectId);
      if (!projectId || seen.has(projectId)) continue;
      if (!bookingOccupiesDay(normalizeBookingStatus(booking.status) ?? booking.status)) continue;
      if (dayKeyOf3(booking, timeZone) !== tomorrowKey) continue;
      seen.add(projectId);
      bookedProjectIds.push(projectId);
    }
    const projectsById = new Map((input.projects || []).map((project) => [text12(project.id), project]));
    const ordered = orderedMaterialIds(input.sendRecords);
    const cutOffLabel = formatMaterialCutOffClock(clock);
    const rows3 = [];
    for (const projectId of bookedProjectIds) {
      const project = projectsById.get(projectId);
      if (!project) continue;
      const lines = (input.materials || []).filter(
        (line) => text12(line.projectId) === projectId && dayKeyOf3(line, timeZone) === tomorrowKey
      );
      const unordered = lines.filter(
        (line) => normalizeMaterialWorkflowStatus(line.status) !== "ordered" && !ordered.has(normalizeDocumentId(line.id))
      );
      if (lines.length > 0 && unordered.length === 0) continue;
      const jobNumber = text12(project.jobNumber) || text12(project.siteName) || projectId.slice(0, 8);
      const message = lines.length === 0 ? `No materials have been ordered for ${jobNumber} tomorrow's work (cut-off ${cutOffLabel}).` : `Materials for ${jobNumber} were not fully ordered by the cut-off ${cutOffLabel} for tomorrow's work (${unordered.length} line${unordered.length === 1 ? "" : "s"} still not ordered).`;
      const id2 = `materials-${projectId}-${tomorrowKey}`;
      rows3.push({
        id: id2,
        resolutionKey: id2,
        type: "missed_material_order",
        severity: "low",
        title: "Material order not placed",
        projectId,
        jobNumber,
        projectLabel: `${text12(project.jobNumber)} ${text12(project.siteName)}`.trim() || jobNumber,
        dayKey: tomorrowKey,
        unorderedCount: lines.length === 0 ? 0 : unordered.length,
        cutOffLabel,
        message
      });
    }
    return rows3.sort((a, b) => a.projectLabel.localeCompare(b.projectLabel));
  }

  // lib/canonical/passwordPolicy.ts
  var PASSWORD_MIN_LENGTH = 8;
  var DEVELOPER_PASSWORD_MIN_LENGTH = 10;
  var PLATFORM_OWNER_EMAIL = "info@projectplanner.us";
  function isPlatformOwnerEmail(email) {
    return typeof email === "string" && email.trim().toLowerCase() === PLATFORM_OWNER_EMAIL;
  }
  function isVerifiedPlatformOwner(token) {
    return isPlatformOwnerEmail(token?.email) && token?.emailVerified === true;
  }
  function passwordMinLength(options) {
    const developer = options?.developerAccount === true || isPlatformOwnerEmail(options?.email);
    return developer ? DEVELOPER_PASSWORD_MIN_LENGTH : PASSWORD_MIN_LENGTH;
  }
  function passwordPolicyError(password, options) {
    const value = typeof password === "string" ? password : "";
    const min = passwordMinLength(options);
    if (value.length < min) return `Password must be at least ${min} characters.`;
    return null;
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

  // lib/canonical/notificationRecipients.ts
  function rosterOf(roster) {
    return (roster || []).filter((member) => member && typeof member === "object" && idText(member.id));
  }
  function resolvePerson(person, members) {
    const given = typeof person === "string" ? { id: person } : person && typeof person === "object" ? person : null;
    if (!given || !idText(given.id)) return given;
    const row2 = members.find((member) => idKey2(member.id) === idKey2(given.id));
    if (!row2) return given;
    const merged = { ...row2 };
    for (const [key3, value] of Object.entries(given)) {
      if (value !== void 0) merged[key3] = value;
    }
    return merged;
  }
  function notificationRecipientAccountId(id2, roster, catalogue) {
    const key3 = idKey2(id2);
    if (!key3) return null;
    const members = rosterOf(roster);
    if (members.length === 0) return null;
    const seeds = [];
    const direct = members.find((member) => idKey2(member.id) === key3);
    if (direct) seeds.push(direct);
    else {
      const aliased = members.find(
        (member) => [...member.formerUserIds ?? [], ...member.sameEmailUserIds ?? [], ...member.formerIds ?? [], ...member.aliasIds ?? []].some(
          (alias) => idKey2(alias) === key3
        )
      );
      if (aliased) seeds.push(aliased);
      else {
        const row2 = (catalogue || []).find((entry) => entry && idKey2(entry.id) === key3);
        if (!row2) return null;
        const linked = idText(row2.userId) || idText(row2.linkedUserId);
        if (linked) seeds.push({ id: linked });
        if (idText(row2.email)) seeds.push({ id: idText(row2.id), email: idText(row2.email) });
      }
    }
    const same = /* @__PURE__ */ new Set();
    for (const seed of seeds) for (const alias of personIdSet(seed, members)) same.add(idKey2(alias));
    const formerOfOther = /* @__PURE__ */ new Set();
    for (const member of members) {
      for (const alias of [...member.formerUserIds ?? [], ...member.formerIds ?? []]) {
        if (idKey2(alias) !== idKey2(member.id)) formerOfOther.add(idKey2(alias));
      }
    }
    let best = null;
    for (const member of members) {
      const memberKey = idKey2(member.id);
      if (!same.has(memberKey) || !rosterMemberActive(member)) continue;
      const signedUp = member.passwordSet === true ? 2 : member.passwordSet === false ? 0 : 1;
      const score = signedUp * 2 + (formerOfOther.has(memberKey) ? 0 : 1);
      if (!best || score > best.score) best = { id: idText(member.id), score };
    }
    return best ? best.id : null;
  }
  function excludeActor(ids, actor, roster, catalogue) {
    const members = rosterOf(roster);
    const actorPerson = resolvePerson(actor, members);
    const actorIds = new Set(personIdSet(actorPerson, members).map(idKey2));
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const raw of ids || []) {
      const given = idText(raw);
      if (!given) continue;
      const id2 = members.length > 0 ? notificationRecipientAccountId(given, members, catalogue) : given;
      if (!id2) continue;
      const key3 = idKey2(id2);
      if (seen.has(key3) || actorIds.has(key3) || actorIds.has(idKey2(given))) continue;
      seen.add(key3);
      out.push(id2);
    }
    return out;
  }
  function personId(person) {
    return typeof person === "string" ? idText(person) : idText(person?.id);
  }
  function timesheetSubmittedRecipients(subject, roster) {
    const members = rosterOf(roster);
    const person = resolvePerson(subject, members);
    if (!person || !idText(person.id)) return [];
    if (timesheetSelfSigned(person, members)) return [];
    return excludeActor(leaveApproverIds(person, members), person, members);
  }
  function timesheetSignedRecipients(subject, signer, roster) {
    const id2 = personId(subject);
    return id2 ? excludeActor([id2], signer, roster) : [];
  }
  function lineManagerPeerRecipients(subject, actor, roster) {
    const members = rosterOf(roster);
    const person = resolvePerson(subject, members);
    if (!person || !idText(person.id)) return [];
    return excludeActor(excludeActor(lineManagerIds(person, members), actor, members), person, members);
  }
  function holidayRequestRecipients(requester, roster) {
    const members = rosterOf(roster);
    const person = resolvePerson(requester, members);
    if (!person || !idText(person.id)) return [];
    if (canSelfBookAnnualLeave(person, members)) return [];
    return excludeActor(leaveApproverIds(person, members), person, members);
  }
  function holidayDecisionRecipients(requester, decider, roster) {
    const id2 = personId(requester);
    return id2 ? excludeActor([id2], decider, roster) : [];
  }
  function bookingCreatedRecipients(bookedIds, booker, roster, catalogue) {
    return excludeActor(bookedIds, booker, roster, catalogue);
  }
  function deadlineAssignedRecipients(addedIds, actor, roster) {
    return excludeActor(addedIds, actor, roster);
  }
  function toolboxTalkRecipients(ids, issuer, roster) {
    return excludeActor(ids, issuer, roster);
  }
  function ideaRecipients(ids, actor, roster) {
    return excludeActor(ids, actor, roster);
  }
  function taskCompletedRecipients(task, completer, roster) {
    const members = rosterOf(roster);
    const creatorId = idText(task?.createdByUserId);
    if (creatorId) return excludeActor([creatorId], completer, members);
    const name = String(task?.createdBy ?? "").trim().replace(/\s+/g, " ").toLowerCase();
    if (!name) return [];
    const named = (roster || []).filter((member) => {
      if (!member || !idText(member.id) || !rosterMemberActive(member)) return false;
      const display = String(member.displayName ?? "").trim() || String(member.name ?? "").trim() || `${String(member.firstName ?? "").trim()} ${String(member.surname ?? "").trim()}`.trim();
      return display.replace(/\s+/g, " ").toLowerCase() === name;
    });
    if (named.length !== 1) return [];
    return excludeActor([idText(named[0].id)], completer, members);
  }
  var COMPANY_ACTIVITY_NOTICE_TYPES = [
    "operative_created",
    "manager_created",
    "client_created",
    "project_created",
    "small_works_created",
    "warning_removed"
  ];
  function companyActivityRecipients(actor, roster) {
    const members = rosterOf(roster);
    const admins = members.filter((member) => rosterMemberActive(member) && isAdminOutsideOperativeMode(member)).map((member) => idText(member.id));
    return excludeActor(admins, actor, members);
  }
  function pushTestRecipients(actor) {
    const id2 = personId(actor);
    return id2 ? [id2] : [];
  }
  var TIMESHEET_PENDING_NOTICE_TYPE = "timesheet_pending_manager_signoff";
  var TIMESHEET_SIGNED_NOTICE_TYPE = "timesheet_signed_by_manager";
  function timesheetNotificationDedupeKey(input) {
    const type = idText(input?.type);
    const subject = idText(input?.subjectId);
    const dayKey = idText(input?.periodStartDayKey);
    if (!subject || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
    const seconds = Math.floor(dateFromDayKeyInZone(dayKey, zoneOrLondon(input.timeZone)).getTime() / 1e3);
    if (!Number.isFinite(seconds)) return null;
    if (type === TIMESHEET_PENDING_NOTICE_TYPE) {
      const recipient = idText(input.recipientId);
      return recipient ? `timesheetPending|${subject}|${recipient}|${seconds}` : null;
    }
    if (type === TIMESHEET_SIGNED_NOTICE_TYPE) return `timesheetSigned|${subject}|${seconds}`;
    return null;
  }
  function row(type, trigger, recipients, writtenBy, status = "ok") {
    return { type, trigger, recipients, devicePush: notificationDeliversDevicePush(type), writtenBy, status };
  }
  var NOTIFICATION_CATALOG = [
    row(
      "holiday_request_submitted",
      "Leave request, or a request to cancel approved leave",
      "holidayRequestRecipients",
      ["web", "ios"],
      "web: pass a roster with aliases (PersonalLeave)."
    ),
    row(
      "holiday_request_approved",
      "Leave request approved (or a cancellation accepted)",
      "holidayDecisionRecipients",
      ["web", "ios"],
      "iOS: stop writing it for a manager-booked confirmation (that is holiday_booked_for_you) and to every admin (notifyAdminAnnualLeaveApproval)."
    ),
    row(
      "holiday_request_declined",
      "Leave request declined (or a cancellation refused)",
      "holidayDecisionRecipients",
      ["web", "ios"],
      "iOS: a manager cancelling approved leave writes holiday_cancelled_by_manager; switching self-book off writes no notice (1.10.0)."
    ),
    row(
      "holiday_cancelled_by_manager",
      "A manager or admin removes someone's approved leave",
      "holidayDecisionRecipients",
      ["ios"],
      "1.10.0: was holiday_request_declined on iOS. The person, never the actor."
    ),
    row(
      "holiday_booked_for_you",
      "A manager or admin books approved leave for someone",
      "holidayDecisionRecipients",
      ["ios"],
      "1.10.0: was holiday_request_approved on iOS. The person, never the actor (nobody when they booked it themselves)."
    ),
    row(
      "timesheet_pending_manager_signoff",
      "Owner signs their timesheet (not self-signed)",
      "timesheetSubmittedRecipients",
      ["web", "ios"],
      "both: use timesheetSubmittedRecipients and timesheetNotificationDedupeKey."
    ),
    row("timesheet_signed_by_manager", "Line manager or admin signs a timesheet", "timesheetSignedRecipients", ["web", "ios"]),
    row(
      "line_manager_peer_update",
      "One line manager signs a timesheet or decides leave for a shared report",
      "lineManagerPeerRecipients",
      ["web", "ios"],
      "web: not written for leave decisions (iOS is)."
    ),
    row(
      "timesheet_submission_reminder",
      "Scheduled reminder before the submit deadline",
      "dueTimesheetSubmissionNotices (schedule); recipients are each participating user",
      ["web", "ios"],
      "scheduled: rows carry actorUserId: null (nobody caused them). Who participates is still decided in each app; no shared recipient rule yet."
    ),
    row(
      "material_order_placed",
      "A line is added to a job material list",
      "materialOrderRecipients, then excludeActor",
      ["web", "ios"],
      "iOS: falls back to every admin when the job has no managers; there is no fallback \u2014 write nothing."
    ),
    row("variation", "Variation created", "receivesJobNotification, then excludeActor", ["web", "ios"], "ok (iOS reads the type and passes the job managers)."),
    row("variation_renumbered", "Variation renumbered", "receivesJobNotification, then excludeActor", ["web", "ios"], "ok. relatedId is the job id."),
    row(
      "variation_added",
      "Variation added to a job",
      "receivesJobNotification, then excludeActor",
      ["web", "ios"],
      "iOS: relatedId is the job id; write the variation id (notificationRelatedIdFor)."
    ),
    row(
      "toolbox_talk_issued",
      "Toolbox talk issued",
      "toolboxTalkRecipients",
      ["web", "ios"],
      "web writes it from 1.10.0. iOS: relatedId is the job id; write the issue id (notificationRelatedIdFor)."
    ),
    row("hs_toolbox_reminder", "Reminder to the people who have not signed a toolbox talk", "toolboxTalkRecipients", ["web"], "ok"),
    row(
      "booking_created",
      "People booked onto a job",
      "bookingCreatedRecipients",
      ["web", "ios"],
      'web writes it from 1.10.0. iOS: the "New Booking Created" batch row has no userId (never an inbox row) \u2014 stop writing it.'
    ),
    row(
      "task_created",
      "Task assigned",
      "excludeActor (the assignees)",
      ["web", "ios"],
      "web writes it from 1.10.0. The Settings diagnostic writes push_test, not this type."
    ),
    row(
      PUSH_TEST_NOTICE_TYPE,
      'Settings "send a test notification"',
      "pushTestRecipients (the signed-in user)",
      ["web", "ios"],
      "pushes to its actor (notificationPushesToActor); no toggle turns it off."
    ),
    row(
      "task_completed",
      "Task completed",
      "taskCompletedRecipients (the task creator)",
      ["web", "ios"],
      "tasks store createdByUserId from 1.10.0; older tasks fall back to the creator name. iOS: write createdByUserId on create and address taskCompletedRecipients (it addressed the completer)."
    ),
    row(
      "deadline_assigned",
      "Assignees added to a deadline",
      "deadlineAssignedRecipients",
      ["web", "ios"],
      "both: the actor is not removed; use deadlineAssignedRecipients."
    ),
    row(
      "deadline_reminder",
      "Scheduled deadline reminder",
      "the assignees (on-device schedule, no shared rule)",
      ["ios"],
      "iOS only. Scheduled: no actorUserId. Listed from its createdAt (1.10.0)."
    ),
    row(
      "deadline_due",
      "Deadline due",
      "the assignees (on-device schedule, no shared rule)",
      ["ios"],
      "iOS only. Scheduled: no actorUserId. Listed from its createdAt (1.10.0)."
    ),
    row(
      "operative_created",
      "Operative added",
      "companyActivityRecipients",
      ["ios"],
      "one row per admin (userId + actorUserId); never written without userId. Toggle: companyActivity."
    ),
    row(
      "manager_created",
      "Manager added",
      "companyActivityRecipients",
      ["ios"],
      "one row per admin (userId + actorUserId); never written without userId. Toggle: companyActivity."
    ),
    row(
      "client_created",
      "Client added",
      "companyActivityRecipients",
      ["web", "ios"],
      "one row per admin (userId + actorUserId); never written without userId. Toggle: companyActivity."
    ),
    row(
      "project_created",
      "Project created",
      "companyActivityRecipients",
      ["ios"],
      "web: not written yet. One row per admin (userId + actorUserId). Toggle: companyActivity."
    ),
    row(
      "small_works_created",
      "Small works created",
      "companyActivityRecipients",
      ["ios"],
      "web: not written yet. One row per admin (userId + actorUserId). Toggle: companyActivity."
    ),
    row(
      "warning_removed",
      "Warning dismissed",
      "companyActivityRecipients",
      ["web", "ios"],
      "one row per admin (userId + actorUserId); never written without userId. Toggle: companyActivity."
    ),
    row("idea_status", "Feedback idea status changed", "ideaRecipients", ["web"], "web: the actor is not removed; use ideaRecipients."),
    row("idea_shipped", "Feedback idea shipped", "ideaRecipients", ["web"], "web: the actor is not removed; use ideaRecipients."),
    row(
      "idea_comment",
      "Comment on a feedback idea",
      "ideaRecipients",
      ["web"],
      "web: the actor is not removed; use ideaRecipients."
    ),
    row(
      "idea_merged",
      "Feedback idea merged into another",
      "ideaRecipients",
      ["web"],
      "web: the actor is not removed; use ideaRecipients."
    ),
    row("material_order_cut_off", "On-device clock before the organisation material cut-off", "the signed-in user (local notification, not an inbox row)", ["ios"], "iOS only."),
    row("qualification_expiry", "On-device clock before a qualification expires", "the signed-in user (local notification, not an inbox row)", ["ios"], "iOS only.")
  ];
  function notificationCatalogRow(type) {
    const key3 = idText(type);
    return NOTIFICATION_CATALOG.find((entry) => entry.type === key3) ?? null;
  }

  // lib/canonical/offlinePolicy.ts
  var OFFLINE_AVAILABILITIES = ["allowedOffline", "onlineOnly", "readOnlyOffline"];
  var OFFLINE_ACTIONS = {
    // Allowed offline
    "booking.create": "allowedOffline",
    "booking.edit": "allowedOffline",
    "booking.cancel": "allowedOffline",
    "annual_leave.request": "allowedOffline",
    "profile.own_fields": "allowedOffline",
    "notifications.own_toggles": "allowedOffline",
    // Online only: bookings
    "booking.delete": "onlineOnly",
    // Online only: organisation settings
    "settings.company_details": "onlineOnly",
    "settings.currency": "onlineOnly",
    "settings.working_hours_overtime": "onlineOnly",
    "settings.warnings": "onlineOnly",
    "settings.payment_runs": "onlineOnly",
    "settings.material_order_cut_off": "onlineOnly",
    "settings.schedule_options": "onlineOnly",
    // Online only: Manage Users
    "users.role": "onlineOnly",
    "users.line_manager": "onlineOnly",
    "users.employment_status": "onlineOnly",
    "users.pay_rate": "onlineOnly",
    "users.exclusions": "onlineOnly",
    "users.inactive": "onlineOnly",
    "users.invites": "onlineOnly",
    // Online only: approvals
    "approvals.annual_leave": "onlineOnly",
    "approvals.timesheet_signing": "onlineOnly",
    "approvals.clash": "onlineOnly",
    // Online only: account actions
    "account.sign_in": "onlineOnly",
    "account.password": "onlineOnly",
    "account.switch_organization": "onlineOnly",
    // Read-only offline
    "view.daily_overview": "readOnlyOffline",
    "view.warnings": "readOnlyOffline",
    "view.weekly_report": "readOnlyOffline",
    "view.my_schedule": "readOnlyOffline"
  };
  var OFFLINE_ONLINE_ONLY_MESSAGE = "Connect to the internet to change this";
  var OFFLINE_PENDING_SYNC_LABEL = "Pending sync";
  var OFFLINE_LAST_UPDATED_PREFIX = "Last updated";
  function offlineAvailability(actionId) {
    const id2 = typeof actionId === "string" ? actionId.trim() : "";
    return Object.prototype.hasOwnProperty.call(OFFLINE_ACTIONS, id2) ? OFFLINE_ACTIONS[id2] : "onlineOnly";
  }
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function pad(value) {
    return String(value).padStart(2, "0");
  }
  function offlineLastUpdatedLabel(iso, timeZone) {
    if (iso == null || iso === "") return null;
    const date = iso instanceof Date ? iso : new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const parts = partsInZone(date, zoneOrLondon(timeZone));
    return `${OFFLINE_LAST_UPDATED_PREFIX} ${parts.d} ${MONTHS[parts.m - 1]} ${parts.y}, ${pad(parts.h)}:${pad(parts.min)}`;
  }

  // lib/canonical/workDocumentReaders.ts
  function text13(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function rawText(value) {
    return typeof value === "string" ? value : "";
  }
  function firstText3(row2, keys) {
    for (const key3 of keys) {
      const value = text13(row2[key3]);
      if (value) return value;
    }
    return "";
  }
  function optionalText3(value) {
    return text13(value) || null;
  }
  function dayKeyOf4(ms, zone3) {
    return ms == null ? null : dayKeyInZone(new Date(ms), zone3);
  }
  function idList4(value) {
    if (!Array.isArray(value)) return [];
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const item of value) {
      let id2 = "";
      if (typeof item === "string") id2 = item.trim();
      else if (item && typeof item === "object") {
        const record9 = item;
        id2 = text13(record9.id) || text13(record9.contactId);
      }
      const key3 = normalizeDocumentId(id2);
      if (!id2 || seen.has(key3)) continue;
      seen.add(key3);
      out.push(id2);
    }
    return out;
  }
  function nameList(value) {
    if (!Array.isArray(value)) return [];
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const item of value) {
      let name = "";
      if (typeof item === "string") name = item.trim();
      else if (item && typeof item === "object") name = text13(item.name);
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      out.push(name);
    }
    return out;
  }
  function record5(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  var WRITE_CREATE_ONLY = ["id", "createdAt", "organizationId"];
  var JOB_COLLECTIONS = { project: "projects", smallWork: "smallWorks" };
  function jobClientId(jobDocId, clientName) {
    const name = text13(clientName).toLowerCase();
    return name ? derivedRowId(jobDocId, "client", 0, [name]) : "";
  }
  function storedJobIdForKey(key3, jobIds) {
    const wanted = normalizeDocumentId(key3);
    if (!wanted) return null;
    for (const id2 of jobIds || []) if (normalizeDocumentId(id2) === wanted) return text13(id2);
    return null;
  }
  function jobKind2(raw) {
    return raw === "smallWork" || raw === "smallWorks" ? "smallWork" : "project";
  }
  function parseJobDocument(docId, data, options) {
    const id2 = text13(docId);
    if (!id2 || isLegacyPlaceholderDocumentId(id2)) return null;
    const row2 = record5(data);
    const zone3 = zoneOrLondon(options?.timeZone);
    const kind = jobKind2(options?.kind);
    const clientRow = record5(row2.client);
    const managerIdsStored = idList4(row2.managerIds);
    const managerIdStored = text13(row2.managerId);
    const managerIds = managerIdsStored.length > 0 ? managerIdsStored : managerIdStored ? [managerIdStored] : [];
    const startMs = documentInstantMs(row2.startDate) ?? documentInstantMs(row2.createdAt);
    const endMs = documentInstantMs(row2.endDate) ?? startMs;
    const addressLine1 = text13(row2.addressLine1);
    const addressLine2 = optionalText3(row2.addressLine2);
    const townCity = text13(row2.townCity);
    const postcode = text13(row2.postcode);
    const siteAddress = text13(row2.siteAddress) || [addressLine1, addressLine2, townCity, postcode].filter(Boolean).join(", ");
    const managerName = text13(row2.manager);
    return {
      id: id2,
      kind,
      collection: JOB_COLLECTIONS[kind],
      jobNumber: text13(row2.jobNumber),
      siteName: text13(row2.siteName),
      addressLine1,
      addressLine2,
      townCity,
      postcode,
      siteAddress,
      client: {
        id: text13(clientRow.id) || text13(row2.clientId) || jobClientId(id2, clientRow.name),
        idStored: Boolean(text13(clientRow.id) || text13(row2.clientId)),
        name: text13(clientRow.name),
        email: optionalText3(clientRow.email),
        phone: optionalText3(clientRow.phone)
      },
      startMs,
      startDayKey: dayKeyOf4(startMs, zone3),
      endMs,
      endDayKey: dayKeyOf4(endMs, zone3),
      jobType: text13(row2.jobType),
      customJobType: optionalText3(row2.customJobType),
      managerName: managerName && managerName.toLowerCase() !== "custom" ? managerName : null,
      managerId: managerIdStored || managerIds[0] || null,
      managerIds,
      managerUserIds: idList4(row2.managerUserIds),
      isLive: documentBool(row2.isLive) !== false,
      description: optionalText3(row2.description),
      notes: optionalText3(row2.notes),
      latitude: documentNumber(row2.latitude),
      longitude: documentNumber(row2.longitude),
      usesMapPinForLocation: documentBool(row2.usesMapPinForLocation) === true,
      hiddenManagerUserIds: idList4(row2.hiddenManagerUserIds),
      hiddenOperativeUserIds: idList4(row2.hiddenOperativeUserIds),
      status: optionalText3(row2.status),
      organizationId: optionalText3(row2.organizationId),
      createdAtMs: documentInstantMs(row2.createdAt),
      updatedAtMs: documentInstantMs(row2.updatedAt)
    };
  }
  function parseProjectDocument(docId, data, options) {
    return parseJobDocument(docId, data, { kind: "project", timeZone: options?.timeZone });
  }
  function parseSmallWorkDocument(docId, data, options) {
    return parseJobDocument(docId, data, { kind: "smallWork", timeZone: options?.timeZone });
  }
  var JOB_MANAGER_WRITE_GROUP = ["managerId", "managerIds", "managerUserIds"];
  var JOB_ADDRESS_WRITE_GROUP = ["addressLine1", "addressLine2", "townCity", "postcode", "siteAddress"];
  var JOB_PIN_WRITE_GROUP = ["latitude", "longitude", "usesMapPinForLocation"];
  function jobWriteFields(before, next) {
    return documentWriteFields(before, next, {
      together: [JOB_MANAGER_WRITE_GROUP, JOB_ADDRESS_WRITE_GROUP, JOB_PIN_WRITE_GROUP],
      createOnly: WRITE_CREATE_ONLY
    });
  }
  var BOOKING_SLOT_WRITE_GROUP = ["timeSlot", "workStartTime", "workEndTime", "isBreakRemoved"];
  var BOOKING_JOB_WRITE_GROUP = ["projectId", "jobCollection"];
  function bookingUpdateWriteFields(before, next) {
    if (!before) return { set: {}, remove: [] };
    return documentWriteFields(before, next, {
      together: [BOOKING_SLOT_WRITE_GROUP, BOOKING_JOB_WRITE_GROUP],
      createOnly: [...WRITE_CREATE_ONLY, "bookedBy"]
    });
  }
  var MANAGER_SITE_BOOKING_LOCATION_WRITE_GROUP = ["locationType", "locationId", "customLocationName", "jobCollection"];
  function managerSiteBookingUpdateWriteFields(before, next) {
    if (!before) return { set: {}, remove: [] };
    return documentWriteFields(before, next, {
      together: [BOOKING_SLOT_WRITE_GROUP, MANAGER_SITE_BOOKING_LOCATION_WRITE_GROUP],
      createOnly: [...WRITE_CREATE_ONLY]
    });
  }
  var SUBCONTRACTOR_BOOKING_DOCUMENT_KEYS = {
    subcontractorId: ["subcontractorId", "subContractorId", "subcontractorID"],
    projectId: ["projectId", "projectID"],
    bookedContactIds: ["bookedContactIds", "contactIds", "bookedContacts", "operativeIds"],
    bookedOperativeNames: ["bookedOperativeNames", "operativeNames", "bookedNames", "contactNames"]
  };
  function firstPresent2(row2, keys) {
    for (const key3 of keys) {
      if (row2[key3] !== void 0 && row2[key3] !== null) return row2[key3];
    }
    return void 0;
  }
  function parseSubcontractorBookingDocument(docId, data, options) {
    const id2 = text13(docId);
    if (!id2 || isLegacyPlaceholderDocumentId(id2)) return null;
    const row2 = record5(data);
    const zone3 = zoneOrLondon(options?.timeZone);
    const subcontractorId = firstText3(row2, SUBCONTRACTOR_BOOKING_DOCUMENT_KEYS.subcontractorId);
    const projectId = firstText3(row2, SUBCONTRACTOR_BOOKING_DOCUMENT_KEYS.projectId);
    const dateMs = documentInstantMs(row2.date);
    if (!subcontractorId || !projectId || dateMs == null) return null;
    const rawStatus = text13(row2.status);
    const status = rawStatus ? normalizeBookingStatus(rawStatus) : "Confirmed";
    const rawSlot = text13(row2.timeSlot);
    const timeSlot = rawSlot ? normalizeBookingTimeSlot(rawSlot) : "FULL DAY";
    if (!status || !timeSlot) return null;
    const bookedContactIds = idList4(firstPresent2(row2, SUBCONTRACTOR_BOOKING_DOCUMENT_KEYS.bookedContactIds));
    return {
      id: id2,
      subcontractorId,
      projectId,
      dateMs,
      dayKey: dayKeyInZone(new Date(dateMs), zone3),
      timeSlot,
      workStartTime: bookingClock(row2.workStartTime, zone3) ?? null,
      workEndTime: bookingClock(row2.workEndTime, zone3) ?? null,
      isBreakRemoved: documentBool(row2.isBreakRemoved) === true,
      bookedBy: text13(row2.bookedBy),
      status,
      bookedContactIds,
      bookedOperativeNames: nameList(firstPresent2(row2, SUBCONTRACTOR_BOOKING_DOCUMENT_KEYS.bookedOperativeNames)),
      createdAtMs: documentInstantMs(row2.createdAt),
      updatedAtMs: documentInstantMs(row2.updatedAt),
      jobCollection: normalizeBookingJobCollection(row2.jobCollection),
      idsAreUuid: [id2, subcontractorId, projectId, ...bookedContactIds].every((value) => isBookingUuid(value))
    };
  }
  function subcontractorBookingCreateFields(input) {
    const errors = [];
    const id2 = text13(input?.id);
    const subcontractorId = text13(input?.subcontractorId);
    const projectId = text13(input?.projectId);
    const dateMs = typeof input?.dateMs === "number" && Number.isFinite(input.dateMs) ? input.dateMs : null;
    const timeSlot = normalizeBookingTimeSlot(input?.timeSlot);
    const status = text13(input?.status) ? normalizeBookingStatus(input?.status) : "Confirmed";
    if (!id2) errors.push("missing_id");
    if (!subcontractorId) errors.push("missing_subcontractor_id");
    if (!projectId) errors.push("missing_project_id");
    if (dateMs == null) errors.push("missing_date");
    if (!timeSlot) errors.push("bad_time_slot");
    if (!status) errors.push("bad_status");
    if (errors.length > 0 || dateMs == null || !timeSlot || !status) return { ok: false, errors };
    const createdAtMs = typeof input.createdAtMs === "number" && Number.isFinite(input.createdAtMs) ? input.createdAtMs : dateMs;
    const fields = {
      id: id2,
      subcontractorId,
      projectId,
      date: dateMs,
      timeSlot,
      isBreakRemoved: input.isBreakRemoved === true,
      bookedBy: text13(input.bookedBy),
      status,
      bookedContactIds: idList4(input.bookedContactIds ?? []),
      bookedOperativeNames: nameList(input.bookedOperativeNames ?? []),
      createdAt: createdAtMs,
      updatedAt: createdAtMs
    };
    const start = bookingClock(input.workStartTime);
    const end = bookingClock(input.workEndTime);
    if (start) fields.workStartTime = start;
    if (end) fields.workEndTime = end;
    Object.assign(fields, bookingJobCollectionFields({ collection: "subcontractorBookings", jobCollection: input.jobCollection }));
    return { ok: true, fields };
  }
  var SUBCONTRACTOR_BOOKING_PEOPLE_WRITE_GROUP = ["bookedContactIds", "bookedOperativeNames"];
  function subcontractorBookingWriteFields(before, next) {
    if (!before) return { set: {}, remove: [] };
    return documentWriteFields(before, next, {
      together: [BOOKING_SLOT_WRITE_GROUP, SUBCONTRACTOR_BOOKING_PEOPLE_WRITE_GROUP, BOOKING_JOB_WRITE_GROUP],
      createOnly: [...WRITE_CREATE_ONLY, "bookedBy"]
    });
  }
  var ENTRY_ARRAY_FIELD = {
    expense: "expenseEntries",
    priceWork: "priceWorkEntries"
  };
  function timesheetEntryId(sheetDocId, kind, index, entry) {
    const row2 = record5(entry);
    const stored = text13(row2.id);
    if (stored) return stored;
    const when = documentInstantMs(kind === "expense" ? row2.date : row2.startDate);
    const source = [
      text13(sheetDocId),
      ENTRY_ARRAY_FIELD[kind],
      String(Math.max(0, Math.floor(Number(index) || 0))),
      rawText(row2.title),
      String(documentNumber(row2.amount) ?? 0),
      when == null ? "" : String(when)
    ].join("|");
    return derivedDocumentId(source);
  }
  function entryBase(sheetDocId, sheet, kind, index, row2) {
    const title = text13(row2.title);
    if (!title) return null;
    const id2 = timesheetEntryId(sheetDocId, kind, index, row2);
    const amount = documentNumber(row2.amount) ?? 0;
    const decision = timesheetEntryDecision(sheet, { ...row2, id: id2, amount });
    return {
      id: id2,
      idStored: Boolean(text13(row2.id)),
      title,
      details: rawText(row2.details),
      jobNumber: text13(row2.jobNumber),
      amount,
      managerDecision: decision.decision,
      managerRevisedAmount: decision.revisedAmount,
      decisionSource: decision.source
    };
  }
  function parseTimesheetEntries(sheetDocId, sheet, options) {
    const data = record5(sheet);
    const zone3 = zoneOrLondon(options?.timeZone);
    const expenseEntries = [];
    const priceWorkEntries = [];
    const expenses = Array.isArray(data.expenseEntries) ? data.expenseEntries : [];
    expenses.forEach((raw, index) => {
      const row2 = record5(raw);
      const base = entryBase(sheetDocId, data, "expense", index, row2);
      if (!base) return;
      const dateMs = documentInstantMs(row2.date);
      expenseEntries.push({
        ...base,
        dateMs,
        dayKey: dayKeyOf4(dateMs, zone3),
        receiptName: optionalText3(row2.receiptName)
      });
    });
    const priceWork = Array.isArray(data.priceWorkEntries) ? data.priceWorkEntries : [];
    priceWork.forEach((raw, index) => {
      const row2 = record5(raw);
      const base = entryBase(sheetDocId, data, "priceWork", index, row2);
      if (!base) return;
      const startMs = documentInstantMs(row2.startDate) ?? documentInstantMs(row2.date);
      const endMs = documentInstantMs(row2.endDate);
      priceWorkEntries.push({
        ...base,
        agreedManagerName: text13(row2.agreedManagerName) || "Manager",
        startMs,
        startDayKey: dayKeyOf4(startMs, zone3),
        endMs,
        endDayKey: dayKeyOf4(endMs, zone3)
      });
    });
    return { expenseEntries, priceWorkEntries };
  }
  var DEADLINE_ASSIGNMENTS_DOCUMENT_ID = "deadlineAssignments";
  var DEADLINE_STATUSES = ["notStarted", "inProgress", "blocked", "complete"];
  function deadlineProjectKey(projectId) {
    return text13(projectId).toUpperCase();
  }
  function deadlinesDocumentId(projectId, isSmallWorks) {
    return `deadlines_${isSmallWorks ? "smallWorks" : "projects"}_${deadlineProjectKey(projectId)}`;
  }
  function deadlineStatus(raw) {
    const value = text13(raw);
    return DEADLINE_STATUSES.includes(value) ? value : "notStarted";
  }
  var DEADLINE_CHANGE_TYPES = [
    "created",
    "rescheduled",
    "progress",
    "status",
    "note",
    "completed",
    "assigned",
    "fileAttached",
    "siteAuditAttached"
  ];
  function parseDeadlineChange(raw) {
    const row2 = record5(raw);
    const id2 = text13(row2.id);
    if (!id2) return null;
    const storedType = text13(row2.type) || "note";
    const known = DEADLINE_CHANGE_TYPES.includes(storedType);
    const type = known ? storedType : "note";
    const progress = documentNumber(row2.progress);
    return {
      id: id2,
      atMs: documentInstantMs(row2.at),
      author: text13(row2.author),
      type,
      dueMs: documentInstantMs(row2.due),
      fromMs: documentInstantMs(row2.from),
      toMs: documentInstantMs(row2.to),
      reason: optionalText3(row2.reason),
      progress: progress == null ? null : Math.round(progress),
      status: text13(row2.status) ? deadlineStatus(row2.status) : null,
      note: known ? optionalText3(row2.note) : storedType,
      completedOnMs: documentInstantMs(row2.completedOn),
      assignedTo: optionalText3(row2.assignedTo),
      name: optionalText3(row2.name)
    };
  }
  function stringList(value) {
    return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim() !== "").map((item) => item.trim()) : [];
  }
  function parseDeadlineItem(raw, options) {
    const row2 = record5(raw);
    const id2 = text13(row2.id);
    if (!id2) return null;
    const zone3 = zoneOrLondon(options?.timeZone);
    const startMs = documentInstantMs(row2.start);
    const dueMs = documentInstantMs(row2.due);
    const reminder = documentNumber(row2.reminderDaysBefore);
    const history = Array.isArray(row2.history) ? row2.history.map(parseDeadlineChange).filter((change) => change !== null) : [];
    return {
      id: id2,
      title: text13(row2.title) || "Untitled deadline",
      location: optionalText3(row2.location),
      trade: optionalText3(row2.trade),
      detail: optionalText3(row2.detail),
      startMs,
      startDayKey: dayKeyOf4(startMs, zone3),
      dueMs,
      dueDayKey: dayKeyOf4(dueMs, zone3),
      completedAtMs: documentInstantMs(row2.completedAt),
      assignees: stringList(row2.assignees),
      assigneeUserIds: idList4(row2.assigneeUserIds),
      company: optionalText3(row2.company),
      status: deadlineStatus(row2.status),
      progress: documentNumber(row2.progress) ?? 0,
      isCritical: documentBool(row2.isCritical) === true,
      dependsOn: idList4(row2.dependsOn),
      blockedReason: optionalText3(row2.blockedReason),
      reminderDaysBefore: reminder == null ? null : Math.round(reminder),
      originalDueMs: documentInstantMs(row2.originalDue),
      history,
      contextKind: text13(row2.contextKind) || "Project",
      projectId: text13(row2.projectId) || text13(options?.projectId),
      createdByUserId: text13(row2.createdByUserId),
      fileURL: optionalText3(row2.fileURL),
      fileName: optionalText3(row2.fileName),
      siteAuditId: optionalText3(row2.siteAuditId),
      siteAuditTitle: optionalText3(row2.siteAuditTitle)
    };
  }
  function parseDeadlineDocument(docId, data, options) {
    const id2 = text13(docId);
    const row2 = record5(data);
    const match = /^deadlines_(projects|smallWorks)_(.+)$/.exec(id2);
    const projectId = text13(row2.projectId) || text13(options?.projectId) || (match ? match[2] : "");
    const items = (Array.isArray(row2.items) ? row2.items : []).map((item) => parseDeadlineItem(item, { projectId, timeZone: options?.timeZone })).filter((item) => item !== null).sort((a, b) => {
      const left = a.dueMs ?? Number.MAX_SAFE_INTEGER;
      const right = b.dueMs ?? Number.MAX_SAFE_INTEGER;
      return left - right || a.id.localeCompare(b.id);
    });
    return {
      id: id2,
      collection: match ? match[1] : null,
      projectId,
      items,
      updatedAtMs: documentInstantMs(row2.updatedAt)
    };
  }
  function parseDeadlineAssignments(data) {
    const row2 = record5(data);
    const out = {};
    for (const [key3, value] of Object.entries(row2)) {
      if (!key3.startsWith("projects.")) continue;
      const projectKey = key3.slice("projects.".length).trim();
      if (projectKey && Array.isArray(value)) out[projectKey] = idList4(value);
    }
    for (const [key3, value] of Object.entries(record5(row2.projects))) {
      if (key3.trim() && Array.isArray(value)) out[key3.trim()] = idList4(value);
    }
    return out;
  }
  function deadlineAssignedProjectIds(data, personIds, jobIds) {
    const ids = new Set((Array.isArray(personIds) ? personIds : [personIds]).map(normalizeDocumentId).filter(Boolean));
    if (ids.size === 0) return [];
    return Object.entries(parseDeadlineAssignments(data)).filter(([, assignees]) => assignees.some((id2) => ids.has(normalizeDocumentId(id2)))).map(([key3]) => jobIds ? storedJobIdForKey(key3, jobIds) : key3).filter((key3) => Boolean(key3)).filter((key3, index, all) => all.indexOf(key3) === index).sort();
  }
  function deadlineAssignmentWriteFields(input) {
    const key3 = deadlineProjectKey(input?.projectId);
    if (!key3) return null;
    const value = idList4(input.assigneeUserIds ?? []).sort((a, b) => a.localeCompare(b));
    return { fieldPath: ["projects", key3], value, createFields: { projects: { [key3]: value } } };
  }

  // lib/canonical/recordsDocuments.ts
  function text14(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function optionalText4(value) {
    return text14(value) || null;
  }
  function record6(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function rows2(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((item) => item && typeof item === "object" && !Array.isArray(item));
  }
  function textList2(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean);
  }
  function idList5(value) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const id2 of textList2(value)) {
      const key3 = normalizeDocumentId(id2);
      if (seen.has(key3)) continue;
      seen.add(key3);
      out.push(id2);
    }
    return out;
  }
  function dayKeyOf5(ms, zone3) {
    return ms == null ? null : dayKeyInZone(new Date(ms), zone3);
  }
  var DAY_KEY6 = /^\d{4}-\d{2}-\d{2}$/;
  var HS_ISSUE_STATUSES = ["awaiting", "scheduled", "complete"];
  var HS_SIGNATURE_STATUSES = ["pending", "signed"];
  var HS_ISSUE_STATUS_STORED = {
    awaiting: "awaiting",
    scheduled: "scheduled",
    complete: "completed"
  };
  function normalizeHSIssueStatus(raw) {
    const value = text14(raw).toLowerCase();
    if (value === "complete" || value === "completed" || value === "signed" || value === "done") return "complete";
    if (value === "scheduled" || value === "schedule") return "scheduled";
    return "awaiting";
  }
  function normalizeHSSignatureStatus(raw) {
    const value = text14(raw).toLowerCase();
    return value === "signed" || value === "complete" || value === "completed" ? "signed" : "pending";
  }
  function healthSafetyDocumentId(jobId, isSmallWorks) {
    return `healthSafety_${isSmallWorks ? "smallWorks" : "projects"}_${deadlineProjectKey(jobId)}`;
  }
  function healthSafetyDocumentIds(jobId, isSmallWorks) {
    const shared = healthSafetyDocumentId(jobId, isSmallWorks);
    const stored = `healthSafety_${isSmallWorks ? "smallWorks" : "projects"}_${text14(jobId)}`;
    return stored === shared || !text14(jobId) ? [shared] : [shared, stored];
  }
  var HS_SIGNATURE_RECORDS_FIELD = "signatureRecords";
  function healthSafetySignatureKey(issueId, userId) {
    const clean = (value) => normalizeDocumentId(value).replace(/[^a-z0-9\-]/g, "_");
    const issue = clean(issueId);
    const user = clean(userId);
    return issue && user ? `${issue}__${user}` : "";
  }
  function parseTalk(row2) {
    const id2 = text14(row2.id) || text14(row2.referenceCode) || text14(row2.ref);
    if (!id2) return null;
    const trades = textList2(row2.trades);
    return {
      id: id2,
      referenceCode: optionalText4(row2.referenceCode) ?? optionalText4(row2.ref),
      title: text14(row2.title),
      category: text14(row2.category) || "general",
      isGeneral: documentBool(row2.isGeneral) ?? trades.length === 0,
      trades,
      purpose: text14(row2.purpose),
      keyPoints: textList2(row2.keyPoints),
      source: text14(row2.source) || "library",
      status: text14(row2.status).toLowerCase() === "draft" ? "draft" : "approved",
      version: documentNumber(row2.version) ?? 1,
      ownerOrganizationId: optionalText4(row2.ownerOrganizationId),
      fileURL: optionalText4(row2.fileURL),
      updatedAtMs: documentInstantMs(row2.updatedAt)
    };
  }
  function parseIssue(row2, projectId, zone3) {
    const id2 = text14(row2.id);
    if (!id2) return null;
    const weekCommencingMs = documentInstantMs(row2.weekCommencing);
    return {
      id: id2,
      projectId: text14(row2.projectId) || projectId,
      talkId: text14(row2.talkId),
      weekCommencingMs,
      weekCommencingDayKey: DAY_KEY6.test(text14(row2.weekCommencing)) ? text14(row2.weekCommencing) : dayKeyOf5(weekCommencingMs, zone3),
      issuedByUserId: text14(row2.issuedByUserId),
      issuedAtMs: documentInstantMs(row2.issuedAt),
      publishAtMs: documentInstantMs(row2.publishAt),
      recipientUserIds: idList5(row2.recipientUserIds),
      status: normalizeHSIssueStatus(row2.status),
      ramsDocumentId: optionalText4(row2.ramsDocumentId)
    };
  }
  function parseSignature(row2) {
    const issueId = text14(row2.issueId);
    const userId = text14(row2.userId);
    if (!issueId || !userId) return null;
    return {
      id: text14(row2.id) || healthSafetySignatureKey(issueId, userId),
      issueId,
      userId,
      status: normalizeHSSignatureStatus(row2.status),
      readConfirmed: documentBool(row2.readConfirmed) === true,
      signatureImageBase64: optionalText4(row2.signatureImageBase64),
      signedAtMs: documentInstantMs(row2.signedAt),
      reminderSentAtMs: documentInstantMs(row2.reminderSentAt)
    };
  }
  function richerSignature(a, b) {
    let winner;
    if (a.status === "signed" && b.status !== "signed") winner = a;
    else if (b.status === "signed" && a.status !== "signed") winner = b;
    else {
      const at = a.signedAtMs ?? a.reminderSentAtMs ?? 0;
      const bt = b.signedAtMs ?? b.reminderSentAtMs ?? 0;
      winner = bt >= at ? b : a;
    }
    const other = winner === a ? b : a;
    return {
      ...winner,
      id: a.id || b.id,
      readConfirmed: winner.readConfirmed || winner.status === "signed" && other.readConfirmed,
      signatureImageBase64: winner.signatureImageBase64 ?? other.signatureImageBase64,
      signedAtMs: winner.signedAtMs ?? other.signedAtMs,
      reminderSentAtMs: Math.max(winner.reminderSentAtMs ?? 0, other.reminderSentAtMs ?? 0) || null
    };
  }
  function foldHealthSafetySignatures(signatures) {
    const byKey = /* @__PURE__ */ new Map();
    for (const signature of signatures || []) {
      const key3 = healthSafetySignatureKey(signature.issueId, signature.userId);
      if (!key3) continue;
      const existing = byKey.get(key3);
      byKey.set(key3, existing ? { ...richerSignature(existing, signature), id: existing.id } : signature);
    }
    return [...byKey.values()].sort((a, b) => (b.signedAtMs ?? 0) - (a.signedAtMs ?? 0));
  }
  function parseHealthSafetyDocument(data, options) {
    const row2 = record6(data);
    const zone3 = zoneOrLondon(options?.timeZone);
    const projectId = text14(options?.projectId);
    const signatures = [];
    for (const entry of rows2(row2.signatures)) {
      const parsed = parseSignature(entry);
      if (parsed) signatures.push(parsed);
    }
    for (const entry of Object.values(record6(row2[HS_SIGNATURE_RECORDS_FIELD]))) {
      const parsed = parseSignature(record6(entry));
      if (parsed) signatures.push(parsed);
    }
    const byUploaded = (list) => list.sort((a, b) => (b.uploadedAtMs ?? 0) - (a.uploadedAtMs ?? 0));
    return {
      talks: rows2(row2.talks).map(parseTalk).filter((talk) => talk !== null),
      issues: rows2(row2.issues).map((entry) => parseIssue(entry, projectId, zone3)).filter((issue) => issue !== null).sort((a, b) => (b.issuedAtMs ?? 0) - (a.issuedAtMs ?? 0)),
      signatures: foldHealthSafetySignatures(signatures),
      ramsDocuments: byUploaded(
        rows2(row2.ramsDocuments).filter((entry) => text14(entry.id)).map((entry) => ({
          id: text14(entry.id),
          title: text14(entry.title) || "Untitled RAMS",
          trade: text14(entry.trade) || "General",
          version: documentNumber(entry.version) ?? 1,
          status: text14(entry.status) || "live",
          uploadedAtMs: documentInstantMs(entry.uploadedAt),
          fileURL: optionalText4(entry.fileURL),
          fileName: optionalText4(entry.fileName),
          reviewDateMs: documentInstantMs(entry.reviewDate),
          attachedDocTitles: textList2(entry.attachedDocTitles)
        }))
      ),
      otherDocuments: byUploaded(
        rows2(row2.otherDocuments).filter((entry) => text14(entry.id)).map((entry) => ({
          id: text14(entry.id),
          title: text14(entry.title) || "Untitled H&S doc",
          trade: optionalText4(entry.trade),
          category: text14(entry.category) || "trade",
          uploadedAtMs: documentInstantMs(entry.uploadedAt),
          fileURL: optionalText4(entry.fileURL),
          fileName: optionalText4(entry.fileName),
          issuableToClient: documentBool(entry.issuableToClient) === true
        }))
      ),
      updatedAtMs: documentInstantMs(row2.updatedAt)
    };
  }
  function healthSafetyIssueStatus(issue, signatures) {
    const own = (signatures || []).filter((row2) => normalizeDocumentId(row2.issueId) === normalizeDocumentId(issue.id));
    const signed = new Set(own.filter((row2) => row2.status === "signed").map((row2) => normalizeDocumentId(row2.userId)));
    const wanted = /* @__PURE__ */ new Set([
      ...(issue.recipientUserIds || []).map(normalizeDocumentId),
      ...own.map((row2) => normalizeDocumentId(row2.userId))
    ]);
    wanted.delete("");
    if (wanted.size > 0 && [...wanted].every((id2) => signed.has(id2))) return "complete";
    return issue.status === "scheduled" ? "scheduled" : "awaiting";
  }
  function healthSafetySignatureWriteFields(input) {
    const issueId = text14(input?.issueId);
    const userId = text14(input?.userId);
    const key3 = healthSafetySignatureKey(issueId, userId);
    if (!key3) return null;
    const status = normalizeHSSignatureStatus(input?.status ?? "signed");
    const value = {
      id: text14(input?.signatureId) || key3,
      issueId,
      userId,
      status,
      readConfirmed: input?.readConfirmed ?? status === "signed"
    };
    if (text14(input?.signatureImageBase64)) value.signatureImageBase64 = text14(input?.signatureImageBase64);
    if (input?.signedAt != null) value.signedAt = input.signedAt;
    if (input?.reminderSentAt != null) value.reminderSentAt = input.reminderSentAt;
    return { fieldPath: [HS_SIGNATURE_RECORDS_FIELD, key3], value, arrayRow: { ...value } };
  }
  var HEALTH_SAFETY_ARRAY_FIELDS = ["talks", "issues", "signatures", "ramsDocuments", "otherDocuments"];
  var HEALTH_SAFETY_FILE_FIELDS = ["fileURL", "fileName"];
  function mergeHealthSafetyRowCopies(primary, secondary) {
    const out = [];
    const index = /* @__PURE__ */ new Map();
    for (const row2 of [...rows2(primary), ...rows2(secondary)]) {
      const key3 = normalizeDocumentId(row2.id);
      if (!key3) continue;
      const at = index.get(key3);
      if (at === void 0) {
        index.set(key3, out.length);
        out.push(row2);
        continue;
      }
      if (!text14(out[at].fileURL) && text14(row2.fileURL)) out[at] = row2;
    }
    return out;
  }
  function healthSafetyDocumentWriteFields(stored, next, options) {
    const before = record6(stored);
    const out = {};
    for (const field of HEALTH_SAFETY_ARRAY_FIELDS) {
      const list = next?.[field];
      if (!Array.isArray(list)) continue;
      const storedRows = rows2(before[field]);
      if (list.length === 0 && storedRows.length > 0) {
        const removed = new Set((options?.removedIds?.[field] || []).map(normalizeDocumentId));
        removed.delete("");
        const everyRowRemoved = storedRows.every((row2) => removed.has(normalizeDocumentId(row2.id)));
        if (!everyRowRemoved) continue;
        out[field] = [];
        continue;
      }
      const byId = /* @__PURE__ */ new Map();
      for (const row2 of storedRows) {
        const key3 = normalizeDocumentId(row2.id);
        if (key3) byId.set(key3, row2);
      }
      out[field] = list.map((row2) => {
        const merged = { ...byId.get(normalizeDocumentId(row2?.id)) ?? {} };
        for (const [key3, value] of Object.entries(row2 || {})) {
          if (value === void 0) continue;
          if (HEALTH_SAFETY_FILE_FIELDS.includes(key3) && !text14(value) && text14(merged[key3])) continue;
          merged[key3] = value;
        }
        if (field === "issues") merged.status = HS_ISSUE_STATUS_STORED[normalizeHSIssueStatus(merged.status)];
        if (field === "signatures") merged.status = normalizeHSSignatureStatus(merged.status);
        return merged;
      });
    }
    return documentWriteFields(stored ? before : null, out);
  }
  function healthSafetySignatureRemovalWrites(stored, removals) {
    const row2 = record6(stored);
    const wanted = (removals || []).map((entry) => ({ issue: normalizeDocumentId(entry?.issueId), user: normalizeDocumentId(entry?.userId) })).filter((entry) => entry.issue);
    if (wanted.length === 0) return null;
    const matches = (issueId, userId) => {
      const issue = normalizeDocumentId(issueId);
      const user = normalizeDocumentId(userId);
      return wanted.some((entry) => entry.issue === issue && (!entry.user || entry.user === user));
    };
    const removeFieldPaths = [];
    for (const [key3, value] of Object.entries(record6(row2[HS_SIGNATURE_RECORDS_FIELD]))) {
      const entry = record6(value);
      let issueId = entry.issueId;
      let userId = entry.userId;
      if (!text14(issueId) || !text14(userId)) {
        const split = key3.split("__");
        if (split.length === 2) {
          issueId = issueId || split[0];
          userId = userId || split[1];
        }
      }
      if (matches(issueId, userId)) removeFieldPaths.push([HS_SIGNATURE_RECORDS_FIELD, key3]);
    }
    const storedSignatures = rows2(row2.signatures);
    const keptSignatures = storedSignatures.filter((entry) => !matches(entry.issueId, entry.userId));
    const signatures = keptSignatures.length === storedSignatures.length ? null : keptSignatures;
    if (removeFieldPaths.length === 0 && !signatures) return null;
    return { removeFieldPaths, signatures };
  }
  var VARIATION_STATUS_TOKENS = ["open", "submitted", "closed"];
  function normalizeVariationStatus(raw) {
    const value = text14(raw).toLowerCase();
    if (value === "submitted" || value === "sent") return "submitted";
    if (value === "closed" || value === "complete" || value === "completed" || value === "done") return "closed";
    return "open";
  }
  function variationLineId(variationId, kind, index, row2) {
    const line = record6(row2);
    const content = kind === "labour" ? [text14(line.trade), String(documentNumber(line.hours) ?? 0)] : kind === "materials" ? [text14(line.name), text14(line.quantity)] : [text14(line.storagePath), text14(line.downloadURL), text14(line.fileName)];
    return derivedRowId(variationId, kind, index, content);
  }
  function parseVariationDocument(docId, data) {
    const row2 = record6(data);
    const id2 = text14(docId) || text14(row2.id);
    if (!id2) return null;
    const labour = [];
    for (const [index, entry] of (Array.isArray(row2.labour) ? row2.labour : []).entries()) {
      const line = record6(entry);
      const trade = text14(line.trade);
      const hours = documentNumber(line.hours) ?? 0;
      if (!trade && !hours) continue;
      labour.push({ id: text14(line.id) || variationLineId(id2, "labour", index, line), idStored: Boolean(text14(line.id)), trade, hours });
    }
    const materials = [];
    for (const [index, entry] of (Array.isArray(row2.materials) ? row2.materials : []).entries()) {
      const line = record6(entry);
      const name = text14(line.name);
      const quantity = typeof line.quantity === "number" ? String(line.quantity) : text14(line.quantity);
      if (!name && !quantity) continue;
      materials.push({ id: text14(line.id) || variationLineId(id2, "materials", index, line), idStored: Boolean(text14(line.id)), name, quantity });
    }
    const evidence = [];
    for (const [index, entry] of (Array.isArray(row2.evidence) ? row2.evidence : []).entries()) {
      const line = record6(entry);
      const storagePath = text14(line.storagePath);
      const downloadURL = text14(line.downloadURL);
      if (!storagePath && !downloadURL) continue;
      evidence.push({
        id: text14(line.id) || variationLineId(id2, "evidence", index, line),
        idStored: Boolean(text14(line.id)),
        fileName: text14(line.fileName) || "file",
        contentType: text14(line.contentType),
        sizeBytes: documentNumber(line.sizeBytes) ?? 0,
        storagePath,
        downloadURL,
        uploadedByUid: text14(line.uploadedByUid),
        uploadedAtMs: documentInstantMs(line.uploadedAt)
      });
    }
    const totalLabourHours = Math.round(labour.reduce((sum, line) => sum + (Number.isFinite(line.hours) ? line.hours : 0), 0) * 100) / 100;
    return {
      id: id2,
      orgId: documentOrganizationId(row2.orgId) ?? documentOrganizationId(row2.organizationId) ?? "",
      parentType: text14(row2.parentType) === "smallWork" ? "smallWork" : "project",
      parentId: text14(row2.parentId),
      parentName: text14(row2.parentName),
      origin: text14(row2.origin) === "tracker" ? "tracker" : "app",
      voNumber: text14(row2.voNumber),
      sequence: Math.trunc(documentNumber(row2.sequence) ?? 0),
      voNumberLocked: documentBool(row2.voNumberLocked) === true,
      numberHistory: rows2(row2.numberHistory).map((entry) => ({
        from: text14(entry.from),
        to: text14(entry.to),
        atMs: documentInstantMs(entry.at),
        byUid: text14(entry.byUid)
      })),
      heading: text14(row2.heading),
      description: typeof row2.description === "string" ? row2.description : "",
      status: normalizeVariationStatus(row2.status),
      labour,
      materials,
      evidence,
      totalLabourHours,
      materialLineCount: materials.length,
      evidenceCount: evidence.length,
      createdByUid: text14(row2.createdByUid),
      createdByName: text14(row2.createdByName),
      createdAtMs: documentInstantMs(row2.createdAt),
      updatedByUid: text14(row2.updatedByUid),
      updatedAtMs: documentInstantMs(row2.updatedAt),
      statusHistory: rows2(row2.statusHistory).map((entry) => ({
        status: text14(entry.status),
        byUid: text14(entry.byUid),
        byName: text14(entry.byName),
        atMs: documentInstantMs(entry.at)
      })),
      submittedAtMs: documentInstantMs(row2.submittedAt),
      closedAtMs: documentInstantMs(row2.closedAt),
      isDeleted: documentBool(row2.isDeleted) === true
    };
  }
  var VARIATION_LABOUR_WRITE_GROUP = ["labour", "totalLabourHours"];
  var VARIATION_MATERIALS_WRITE_GROUP = ["materials", "materialLineCount"];
  var VARIATION_EVIDENCE_WRITE_GROUP = ["evidence", "evidenceCount"];
  var VARIATION_STATUS_WRITE_GROUP = ["status", "statusHistory", "voNumberLocked", "submittedAt", "closedAt"];
  var VARIATION_NUMBER_WRITE_GROUP = ["voNumber", "sequence", "numberHistory"];
  function variationWriteFields(before, next) {
    return documentWriteFields(before, next, {
      together: [
        VARIATION_LABOUR_WRITE_GROUP,
        VARIATION_MATERIALS_WRITE_GROUP,
        VARIATION_EVIDENCE_WRITE_GROUP,
        VARIATION_STATUS_WRITE_GROUP,
        VARIATION_NUMBER_WRITE_GROUP
      ],
      createOnly: ["id", "orgId", "organizationId", "createdAt", "createdByUid", "createdByName", "origin", "parentId", "parentType"]
    });
  }
  function variationRenumberWriteFields(input) {
    const row2 = record6(input?.stored);
    const from = text14(row2.voNumber);
    const to = text14(input?.to);
    const sequence = Math.trunc(documentNumber(input?.sequence) ?? NaN);
    const locked = documentBool(row2.voNumberLocked) === true && text14(input?.numberingMode) !== "resequenceAll";
    const set = {};
    if (Number.isFinite(sequence) && sequence !== Math.trunc(documentNumber(row2.sequence) ?? NaN)) set.sequence = sequence;
    if (to && to !== from && !locked) {
      set.voNumber = to;
      set.numberHistory = [
        ...Array.isArray(row2.numberHistory) ? row2.numberHistory : [],
        { from, to, at: input?.at, byUid: text14(input?.byUid) }
      ];
    }
    return Object.keys(set).length > 0 ? { set } : null;
  }
  function parseVariationTrackerDocument(parentId, data) {
    const row2 = record6(data);
    const padding = Math.trunc(documentNumber(row2.padding) ?? 3);
    return {
      parentId: text14(parentId) || text14(row2.parentId),
      parentType: text14(row2.parentType) === "smallWork" ? "smallWork" : "project",
      enabled: documentBool(row2.enabled) === true,
      enabledAtMs: documentInstantMs(row2.enabledAt),
      enabledByUid: optionalText4(row2.enabledByUid),
      numberingMode: text14(row2.numberingMode) === "resequenceAll" ? "resequenceAll" : "lockSubmitted",
      prefix: text14(row2.prefix) || "VO-",
      padding: padding >= 1 && padding <= 6 ? padding : 3,
      version: Math.trunc(documentNumber(row2.version) ?? 0),
      lockedByUid: optionalText4(row2.lockedByUid),
      lockedByName: optionalText4(row2.lockedByName),
      lockedAtMs: documentInstantMs(row2.lockedAt)
    };
  }
  var VARIATION_TRACKER_LOCK_FIELDS = ["lockedByUid", "lockedByName", "lockedAt"];
  function variationTrackerWriteFields(stored, action) {
    const row2 = stored ? record6(stored) : null;
    const set = {};
    const remove = [];
    const removeLock = () => {
      for (const key3 of VARIATION_TRACKER_LOCK_FIELDS) if (row2 && row2[key3] != null) remove.push(key3);
    };
    const parentFields = (parentId, parentType) => {
      if (row2) return;
      set.parentId = text14(parentId);
      set.parentType = text14(parentType) === "smallWork" ? "smallWork" : "project";
    };
    switch (action?.kind) {
      case "enable": {
        parentFields(action.parentId, action.parentType);
        set.enabled = true;
        set.enabledAt = action.at;
        set.enabledByUid = text14(action.actorUid);
        if (!row2) {
          set.numberingMode = "lockSubmitted";
          set.prefix = "VO-";
          set.padding = 3;
          set.version = 1;
        } else if (Math.trunc(documentNumber(row2.version) ?? 0) < 1) {
          set.version = 1;
        }
        break;
      }
      case "disable":
        if (!row2) return null;
        if (documentBool(row2.enabled) !== false) set.enabled = false;
        removeLock();
        break;
      case "lock":
        parentFields(action.parentId, action.parentType);
        set.lockedByUid = text14(action.actorUid);
        set.lockedByName = text14(action.actorName);
        set.lockedAt = action.at;
        break;
      case "unlock":
        removeLock();
        break;
      case "mode": {
        const mode = text14(action.numberingMode) === "resequenceAll" ? "resequenceAll" : "lockSubmitted";
        if (!row2 || text14(row2.numberingMode) !== mode) set.numberingMode = mode;
        break;
      }
      case "renumbered":
        if (!row2) return null;
        set.version = Math.trunc(documentNumber(row2.version) ?? 0) + 1;
        removeLock();
        break;
      default:
        return null;
    }
    return Object.keys(set).length > 0 || remove.length > 0 ? { set, remove } : null;
  }
  var VARIATION_TRADES_DOCUMENT_ID = "variationTrades";
  function parseVariationTrades(data) {
    const seen = /* @__PURE__ */ new Set();
    const customTrades = [];
    for (const trade of textList2(record6(data).customTrades)) {
      if (seen.has(trade.toLowerCase())) continue;
      seen.add(trade.toLowerCase());
      customTrades.push(trade);
    }
    return { customTrades };
  }
  function variationTradesWriteFields(stored, change) {
    const before = parseVariationTrades(stored).customTrades;
    const removed = new Set((change?.remove || []).map((trade) => text14(trade).toLowerCase()).filter(Boolean));
    const next = before.filter((trade) => !removed.has(trade.toLowerCase()));
    const seen = new Set(next.map((trade) => trade.toLowerCase()));
    for (const trade of change?.add || []) {
      const name = text14(trade);
      if (!name || seen.has(name.toLowerCase()) || removed.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      next.push(name);
    }
    if (next.length === before.length && next.every((trade, index) => trade === before[index])) return null;
    return { set: { customTrades: next } };
  }
  function variationLogItemId(parentId, index, row2) {
    const item = record6(row2);
    return derivedRowId(parentId, "items", index, [
      text14(item.voNumber),
      text14(item.heading),
      text14(item.parentId),
      String(documentInstantMs(item.createdAt) ?? "")
    ]);
  }
  function variationLogItems(parentId, data) {
    const items = record6(data).items;
    const out = [];
    if (Array.isArray(items)) {
      items.forEach((entry, index) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
        const row2 = entry;
        const stored = text14(row2.id);
        out.push({ id: stored || variationLogItemId(parentId, index, row2), idStored: Boolean(stored), row: row2 });
      });
    } else if (items && typeof items === "object") {
      for (const [key3, entry] of Object.entries(items)) {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const row2 = entry;
        const stored = text14(row2.id) || text14(key3);
        out.push({ id: stored, idStored: Boolean(text14(row2.id)), row: row2 });
      }
    }
    return out;
  }
  function parseVariationLogDocument(parentId, data) {
    return variationLogItems(parentId, data).map((item) => parseVariationDocument(item.id, { ...item.row, id: item.id })).filter((row2) => row2 !== null);
  }
  function variationLogWriteFields(stored, entry, context) {
    const entryId = text14(entry?.id);
    if (!entryId) return null;
    const items = variationLogItems(context?.parentId, stored).map((item) => ({ ...item.row, id: item.id }));
    const index = items.findIndex((row2) => normalizeDocumentId(row2.id) === normalizeDocumentId(entryId));
    if (index >= 0) {
      const merged = { ...items[index] };
      for (const [key3, value] of Object.entries(entry)) if (value !== void 0) merged[key3] = value;
      merged.id = items[index].id;
      items[index] = merged;
    } else {
      const row2 = {};
      for (const [key3, value] of Object.entries(entry)) if (value !== void 0) row2[key3] = value;
      items.push(row2);
    }
    const set = { items };
    if (!stored) {
      set.parentId = text14(context?.parentId);
      set.parentType = text14(context?.parentType) === "smallWork" ? "smallWork" : "project";
      if (text14(context?.organizationId)) set.organizationId = text14(context?.organizationId);
      set.recordType = "variationLog";
    }
    return { set };
  }
  var LEGACY_NOTIFICATION_TYPES = ["material_added"];
  var KNOWN_NOTIFICATION_TYPES = Array.from(
    /* @__PURE__ */ new Set([
      ...NOTIFICATION_CATALOG.map((row2) => row2.type),
      ...DEVICE_PUSH_NOTIFICATION_TYPES,
      ...LEGACY_NOTIFICATION_TYPES
    ])
  ).sort();
  function isKnownNotificationType(type) {
    const key3 = text14(type);
    return Boolean(key3) && KNOWN_NOTIFICATION_TYPES.includes(key3);
  }
  function parseNotificationDocument(docId, data, options) {
    const id2 = text14(docId);
    if (!id2) return null;
    const row2 = record6(data);
    const type = text14(row2.type);
    if (!type) return null;
    const relatedId = optionalText4(row2.relatedId) ?? (typeof row2.relatedId === "number" ? String(row2.relatedId) : null);
    const storedDay = text14(row2.dayKey);
    const dayKey = DAY_KEY6.test(storedDay) ? storedDay : relatedId && DAY_KEY6.test(relatedId) ? relatedId : null;
    const catalogue = text14(row2.catalogue) === "projects" || text14(row2.catalogue) === "smallWorks" ? text14(row2.catalogue) : null;
    const deepLinkUserId = optionalText4(row2.deepLinkUserId);
    return {
      id: id2,
      organizationId: documentOrganizationId(row2.organizationId) ?? optionalText4(options?.organizationId),
      type,
      known: isKnownNotificationType(type),
      title: text14(row2.title),
      message: text14(row2.message),
      userId: optionalText4(row2.userId),
      actorUserId: optionalText4(row2.actorUserId),
      relatedId,
      isRead: documentBool(row2.isRead) === true,
      readAtMs: documentInstantMs(row2.readAt),
      createdAtMs: documentInstantMs(row2.createdAt),
      requiresPermission: optionalText4(row2.requiresPermission),
      deepLinkUserId,
      deepLinkWeekStartMs: documentInstantMs(row2.deepLinkWeekStart),
      dayKey,
      catalogue,
      destination: options?.role ? notificationDestination({ type, relatedId, dayKey, catalogue, role: options.role, deepLinkUserId }) : null
    };
  }
  function notificationReadWriteFields(stored) {
    return documentBool(record6(stored).isRead) === true ? null : { set: { isRead: true } };
  }
  var NOTIFICATION_RELATED_ID = {
    holiday_request_submitted: "holidayBooking",
    holiday_request_approved: "holidayBooking",
    holiday_request_declined: "holidayBooking",
    holiday_cancelled_by_manager: "holidayBooking",
    holiday_booked_for_you: "holidayBooking",
    timesheet_pending_manager_signoff: "none",
    timesheet_signed_by_manager: "none",
    line_manager_peer_update: "holidayBookingOrNone",
    timesheet_submission_reminder: "paymentDayKey",
    material_order_placed: "job",
    material_order_created: "job",
    material_order_cut_off: "none",
    variation: "variation",
    variation_renumbered: "job",
    variation_added: "variation",
    variation_from_tracker: "variation",
    variation_numbers_updated: "job",
    toolbox_talk_issued: "healthSafetyIssue",
    hs_toolbox_reminder: "healthSafetyIssue",
    booking_created: "job",
    booked_onto_job: "job",
    booking_clash: "job",
    task_created: "task",
    task_completed: "task",
    push_test: "none",
    deadline_assigned: "deadline",
    deadline_reminder: "deadline",
    deadline_due: "deadline",
    operative_created: "user",
    manager_created: "user",
    client_created: "client",
    project_created: "job",
    small_works_created: "job",
    warning_removed: "warningKey",
    qualification_expiry: "none",
    idea_status: "feedbackIdea",
    idea_shipped: "feedbackIdea",
    idea_comment: "feedbackIdea",
    idea_merged: "feedbackIdea",
    material_added: "job"
  };
  function notificationRelatedId(type, input) {
    const kind = NOTIFICATION_RELATED_ID[text14(type)];
    const pick = (value) => optionalText4(value);
    switch (kind) {
      case "holidayBooking":
      case "holidayBookingOrNone":
        return pick(input?.holidayBookingId);
      case "job":
        return pick(input?.jobId);
      case "variation":
        return pick(input?.variationId);
      case "client":
        return pick(input?.clientId);
      case "user":
        return pick(input?.userId);
      case "task":
        return pick(input?.taskId);
      case "deadline":
        return pick(input?.deadlineId);
      case "healthSafetyIssue":
        return pick(input?.issueId);
      case "warningKey":
        return pick(input?.warningKey);
      case "paymentDayKey": {
        const day = text14(input?.paymentDayKey);
        return DAY_KEY6.test(day) ? day : null;
      }
      case "feedbackIdea":
        return pick(input?.ideaId);
      default:
        return null;
    }
  }
  var RELATED_ID_INPUT_KEY = {
    holidayBooking: "holidayBookingId",
    holidayBookingOrNone: "holidayBookingId",
    job: "jobId",
    variation: "variationId",
    client: "clientId",
    user: "userId",
    task: "taskId",
    deadline: "deadlineId",
    healthSafetyIssue: "issueId",
    warningKey: "warningKey",
    paymentDayKey: "paymentDayKey",
    feedbackIdea: "ideaId",
    none: null
  };
  function notificationRelatedIdFor(type, id2) {
    const kind = NOTIFICATION_RELATED_ID[text14(type)];
    if (!kind) return null;
    const key3 = RELATED_ID_INPUT_KEY[kind];
    if (!key3) return null;
    return notificationRelatedId(type, { [key3]: id2 });
  }
  function notificationCreateFields(input, stored) {
    if (stored) return null;
    const type = text14(input?.type);
    const userId = text14(input?.userId);
    if (!type || !userId) return null;
    const set = {
      organizationId: text14(input?.organizationId),
      type,
      title: text14(input?.title),
      message: typeof input?.message === "string" ? input.message : text14(input?.message),
      userId,
      relatedId: optionalText4(input?.relatedId),
      requiresPermission: optionalText4(input?.requiresPermission),
      deepLinkUserId: optionalText4(input?.deepLinkUserId),
      isRead: false,
      // 1.16.0: a due-now row carries the server time; only a scheduled type keeps its own due instant.
      createdAt: input?.serverTimestamp !== void 0 && notificationCreatedAtIsServerTime(type, input?.createdAt) ? input.serverTimestamp : input?.createdAt
    };
    const actor = optionalText4(input?.actorUserId);
    if (actor) set.actorUserId = actor;
    if (input?.deepLinkWeekStart != null) set.deepLinkWeekStart = input.deepLinkWeekStart;
    const day = text14(input?.dayKey);
    if (DAY_KEY6.test(day)) set.dayKey = day;
    const catalogue = text14(input?.catalogue);
    if (catalogue === "projects" || catalogue === "smallWorks") set.catalogue = catalogue;
    return { set };
  }
  function sharedWarningResolutionKey(key3, timeZone) {
    const raw = text14(key3);
    const zone3 = zoneOrLondon(timeZone);
    const toDay = (seconds) => {
      const value = Number(seconds);
      if (!Number.isFinite(value) || value <= 0) return null;
      return dayKeyInZone(new Date(value > 1e10 ? value : value * 1e3), zone3);
    };
    const manager = /^(mgr-clash-.+)-(\d{9,}(?:\.\d+)?)-(\d+)$/.exec(raw);
    if (manager) {
      const day = toDay(manager[2]);
      return day ? `${manager[1]}-${day}-${manager[3]}` : raw;
    }
    const materials = /^(materials-.+)-(\d{9,}(?:\.\d+)?)$/.exec(raw);
    if (materials) {
      const day = toDay(materials[2]);
      return day ? `${materials[1]}-${day}` : raw;
    }
    return raw;
  }
  function parseWarningResolutionDocument(docId, data, options) {
    const id2 = text14(docId);
    if (!id2) return null;
    const row2 = record6(data);
    const storedKey = text14(row2.resolutionKey) || id2;
    const resolutionKey = sharedWarningResolutionKey(storedKey, options?.timeZone);
    const status = text14(row2.status).toLowerCase();
    return {
      id: id2,
      resolutionKey,
      storedKey,
      isLegacyKey: resolutionKey !== storedKey,
      status: status === "approved" || status === "dismissed" ? status : null,
      resolvedByUserId: optionalText4(row2.resolvedByUserId),
      resolvedAtMs: documentInstantMs(row2.resolvedAt)
    };
  }
  function warningResolutionRecords(docs, timeZone) {
    const out = [];
    for (const entry of docs || []) {
      const parsed = parseWarningResolutionDocument(entry?.id, entry?.data, { timeZone });
      if (parsed?.status) out.push({ id: parsed.id, resolutionKey: parsed.resolutionKey, status: parsed.status });
    }
    return out;
  }
  function warningResolutionMigrationWrites(input) {
    const parsed = (input?.docs || []).map((entry) => parseWarningResolutionDocument(entry?.id, entry?.data, { timeZone: input?.timeZone })).filter((row2) => Boolean(row2?.status));
    const sharedResolved = new Set(parsed.filter((row2) => !row2.isLegacyKey).map((row2) => normalizeDocumentId(row2.resolutionKey)));
    const storedStatus = /* @__PURE__ */ new Map();
    for (const row2 of parsed) {
      const key3 = normalizeDocumentId(row2.storedKey);
      if (storedStatus.get(key3) !== "approved") storedStatus.set(key3, row2.status);
    }
    const wanted = /* @__PURE__ */ new Map();
    const want = (key3, status) => {
      const norm = normalizeDocumentId(key3);
      if (!norm || sharedResolved.has(norm)) return;
      const existing = wanted.get(norm);
      if (!existing || existing.status === "dismissed" && status === "approved") wanted.set(norm, { key: key3, status });
    };
    for (const row2 of parsed) if (row2.isLegacyKey) want(row2.resolutionKey, row2.status);
    for (const [sharedKey, forms] of Object.entries(input?.legacyKeyForms || {})) {
      let status = null;
      for (const form of forms || []) {
        const found = storedStatus.get(normalizeDocumentId(form));
        if (found === "approved") status = "approved";
        else if (found === "dismissed" && !status) status = "dismissed";
      }
      if (status) want(sharedKey, status);
    }
    const writes = [];
    for (const { key: key3, status } of wanted.values()) {
      const write = warningResolutionWriteFields({ resolutionKey: key3, status, resolvedByUserId: input?.resolvedByUserId });
      if (write) writes.push(write);
    }
    return writes.sort((a, b) => a.documentId.localeCompare(b.documentId));
  }

  // lib/canonical/liveSources.ts
  var LIVE_COLLECTIONS = [
    { id: "organization", path: "organizations/{orgId}", scope: "organization", listen: true, note: "One listener for every organisation setting." },
    { id: "users", path: "users (organizationId == {orgId})", scope: "organization", listen: true, note: "The live roster; the signed-in user document too." },
    { id: "bookings", path: "organizations/{orgId}/bookings", scope: "organization", listen: true, note: "Bounded by bookingLoadStart." },
    { id: "managerSiteBookings", path: "organizations/{orgId}/managerSiteBookings", scope: "organization", listen: true, note: "Bounded by bookingLoadStart." },
    { id: "subcontractorBookings", path: "organizations/{orgId}/subcontractorBookings", scope: "organization", listen: true, note: "Scheduling grids and the weekly overview." },
    { id: "projects", path: "organizations/{orgId}/projects", scope: "organization", listen: true, note: "" },
    { id: "smallWorks", path: "organizations/{orgId}/smallWorks", scope: "organization", listen: true, note: "" },
    { id: "holidayBookings", path: "organizations/{orgId}/holidayBookings", scope: "organization", listen: true, note: "Annual leave, My Schedule, Daily Overview, warnings and Home." },
    { id: "timesheets", path: "organizations/{orgId}/settings/timesheet_{uid}_{periodStart}", scope: "organization", listen: true, note: "The open sheet document; unsaved edits are never overwritten by a snapshot." },
    { id: "operatives", path: "organizations/{orgId}/operatives", scope: "organization", listen: true, note: "" },
    { id: "managers", path: "organizations/{orgId}/managers", scope: "organization", listen: true, note: "" },
    { id: "clients", path: "organizations/{orgId}/clients", scope: "organization", listen: true, note: "" },
    { id: "subcontractors", path: "organizations/{orgId}/subcontractors", scope: "organization", listen: true, note: "" },
    { id: "operativeDayRateHistory", path: "organizations/{orgId}/operativeDayRateHistory", scope: "organization", listen: true, note: "Pay history, while its screen is open." },
    { id: "warningResolutions", path: "organizations/{orgId}/warningResolutions", scope: "organization", listen: true, note: "Warnings and the Home warning count." },
    { id: "acceptedBookingClashes", path: "organizations/{orgId}/acceptedBookingClashes", scope: "organization", listen: true, note: "Warnings and the Home warning count." },
    { id: "dismissedWarnings", path: "organizations/{orgId}/dismissedWarnings", scope: "organization", listen: true, note: "Warnings and the Home warning count." },
    { id: "materials", path: "organizations/{orgId}/materials", scope: "organization", listen: true, note: "Per job on the job screen; org-wide where a screen lists every job." },
    { id: "materialSendRecords", path: "organizations/{orgId}/materialSendRecords", scope: "organization", listen: true, note: "" },
    { id: "materialCatalogue", path: "organizations/{orgId}/materialCatalogue", scope: "organization", listen: true, note: "While its screen is open." },
    { id: "wholesalers", path: "organizations/{orgId}/wholesalers", scope: "organization", listen: true, note: "While its screen is open." },
    { id: "siteAudits", path: "organizations/{orgId}/siteAudits", scope: "organization", listen: true, note: "While its screen is open." },
    { id: "tasks", path: "organizations/{orgId}/tasks", scope: "organization", listen: true, note: "" },
    { id: "healthSafety", path: "organizations/{orgId}/settings/healthSafety_{projects|smallWorks}_{KEY}", scope: "organization", listen: true, note: "The open job's document(s) (healthSafetyDocumentIds)." },
    { id: "variations", path: "organizations/{orgId}/variations", scope: "organization", listen: true, note: "" },
    { id: "variationTrackers", path: "organizations/{orgId}/variationTrackers", scope: "organization", listen: true, note: "" },
    { id: "deadlines", path: "organizations/{orgId}/settings/deadlines_{KEY} + settings/deadlineAssignments", scope: "organization", listen: true, note: "While its screen is open." },
    { id: "notifications", path: "organizations/{orgId}/notifications (userId == signed-in user)", scope: "organization", listen: true, note: "Newest 150." },
    { id: "jobTypes", path: "organizations/{orgId}/settings/jobTypes", scope: "organization", listen: true, note: "While a screen that picks a job type is open." },
    { id: "skills", path: "organizations/{orgId}/skills", scope: "organization", listen: true, note: "While its screen is open." },
    { id: "qualifications", path: "organizations/{orgId}/qualifications", scope: "organization", listen: true, note: "While its screen is open." },
    { id: "variationTrades", path: "organizations/{orgId}/settings/variationTrades", scope: "organization", listen: false, note: "Add-only picker suggestions; read when the picker opens." },
    { id: "tradeTypeInventory", path: "organizations/{orgId}/settings/tradeTypeInventory", scope: "organization", listen: false, note: "Add-only picker suggestions; read when the picker opens." },
    { id: "payProfiles", path: "organizations/{orgId}/payProfiles/{subjectId}", scope: "organization", listen: false, note: "1.13.0: private pay, one document per person; read by id when a pay screen opens (only pay viewers may, canViewPersonPay)." },
    { id: "taxIds", path: "users/{uid}/private/taxIds", scope: "user", listen: false, note: "Private; only its owner and admins edit it, on one screen; read when that screen opens." },
    { id: "toolboxLibrary", path: "platformConfig/*", scope: "platform", listen: false, note: "Platform content, changed by releases; read on open." },
    { id: "orgMemberships", path: "users/{uid}/orgMemberships/{orgId}", scope: "user", listen: false, note: "Read on sign-in and when switching organisation (1.10.0 parseOrgMembershipDocument); only admins of that organisation change role or permissions." },
    { id: "deletedBookings", path: "organizations/{orgId}/deletedBookings", scope: "organization", listen: false, note: "Write-only tombstones; never shown." }
  ];
  function liveCollection(id2) {
    const key3 = typeof id2 === "string" ? id2.trim() : "";
    if (!key3) return null;
    return LIVE_COLLECTIONS.find((row2) => row2.id === key3) ?? LIVE_COLLECTIONS.find((row2) => row2.id.toLowerCase() === key3.toLowerCase()) ?? null;
  }
  function screenMustListen(id2) {
    return liveCollection(id2)?.listen ?? true;
  }
  var SYNC_WRITE_TRIGGERS = [
    "userAction",
    "offlineReplay",
    "launch",
    "foreground",
    "reconnect",
    "backgroundSync",
    "pullToRefresh",
    "listenerSnapshot",
    /** 1.10.0 (M7): producing a Weekly Report. It reads only; it never writes a timesheet or anything else. */
    "weeklyReport"
  ];
  var IDEMPOTENT_MIGRATION_WRITES = ["warningResolutionMigrationWrites"];
  function syncWriteAllowed(trigger, migration) {
    if (trigger === "userAction" || trigger === "offlineReplay") return true;
    if (trigger === "weeklyReport") return false;
    return typeof migration === "string" && IDEMPOTENT_MIGRATION_WRITES.includes(migration);
  }
  function recordsToSave(records, changedIds) {
    const wanted = new Set((changedIds || []).map((id2) => String(id2 ?? "").trim().toLowerCase()).filter(Boolean));
    if (wanted.size === 0) return [];
    return (records || []).filter((row2) => wanted.has(String(row2?.id ?? "").trim().toLowerCase()));
  }
  function codeText(code) {
    return (typeof code === "number" ? String(code) : typeof code === "string" ? code.trim() : "").toLowerCase().replace(/^firestore\//, "");
  }
  function editOfMissingDocumentIsRefused(input) {
    if (input?.isCreate !== false) return false;
    if (input.exists === false) return true;
    const code = codeText(input.code);
    return code === "not-found" || code === "5";
  }
  function replayRefusedIsFinal(input) {
    const code = codeText(input?.code);
    if (code === "permission-denied" || code === "7") return true;
    return editOfMissingDocumentIsRefused({ isCreate: input?.isCreate, code: input?.code });
  }
  var EDIT_OF_MISSING_DOCUMENT_MESSAGE = "This was deleted on another device.";

  // lib/canonical/createDocuments.ts
  function text15(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function idList6(value) {
    if (!Array.isArray(value)) return [];
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const entry of value) {
      const id2 = text15(entry);
      if (!id2 || seen.has(id2.toLowerCase())) continue;
      seen.add(id2.toLowerCase());
      out.push(id2);
    }
    return out;
  }
  function finite2(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  function inviteRoleFor(role, permissions) {
    const stored = text15(role).toLowerCase();
    if (stored === "admin" || stored === "manager" || stored === "operative") return stored;
    if (permissions.adminAccess === true || permissions.isSuperAdmin === true) return "admin";
    if (permissions.operativeMode === true) return "operative";
    return "manager";
  }
  function invitationCreateFields(input) {
    const email = text15(input?.email).toLowerCase();
    const organizationId = text15(input?.organizationId);
    if (!email || !organizationId) return null;
    const permissions = input.permissions && typeof input.permissions === "object" ? { ...input.permissions } : {};
    const out = {
      email,
      organizationId,
      invitedBy: text15(input.invitedBy),
      firstName: text15(input.firstName),
      surname: text15(input.surname),
      employmentType: text15(input.employmentType) === "paye" ? "paye" : "self_employed",
      permissions,
      role: inviteRoleFor(input.role, permissions),
      inviteType: "new_user",
      createdAt: input.createdAt,
      isUsed: false
    };
    const mobile = text15(input.mobileNumber);
    if (mobile) out.mobileNumber = mobile;
    let managers = idList6(input.assignedManagerUserIds);
    if (managers.length === 0 && text15(input.assignedManagerUserId)) managers = [text15(input.assignedManagerUserId)];
    if (input.hasNoLineManager === true) {
      out.hasNoLineManager = true;
    } else if (managers.length > 0) {
      out.assignedManagerUserIds = managers;
      out.assignedManagerUserId = managers[0];
      out.hasNoLineManager = false;
    }
    const rates = readStoredRates({
      payBasis: input.payBasis,
      dayRate: input.dayRate,
      hourlyRate: input.hourlyRate
    });
    if (rates.payBasis === "hourly" && rates.hourlyRate != null) {
      out.payBasis = "hourly";
      out.hourlyRate = rates.hourlyRate;
    } else if (rates.payBasis === "day" && rates.dayRate != null) {
      out.payBasis = "day";
      out.dayRate = rates.dayRate;
    }
    if (text15(input.tradeTypePreset)) out.tradeTypePreset = text15(input.tradeTypePreset);
    if (text15(input.tradeTypeCustom)) out.tradeTypeCustom = text15(input.tradeTypeCustom);
    if (permissions.manager === true || permissions.operativeMode === true) {
      out.timesheetsEnabled = input.timesheetsEnabled === true;
    }
    if (typeof input.annualLeaveEnabled === "boolean") out.annualLeaveEnabled = input.annualLeaveEnabled;
    const days = finite2(input.annualLeaveDaysPerYear);
    if (days != null) out.annualLeaveDaysPerYear = days;
    const start = finite2(input.annualLeaveYearStartMonth);
    if (start != null) out.annualLeaveYearStartMonth = start;
    const end = finite2(input.annualLeaveYearEndMonth);
    if (end != null) out.annualLeaveYearEndMonth = end;
    if (typeof input.annualLeaveCarriesOver === "boolean") out.annualLeaveCarriesOver = input.annualLeaveCarriesOver;
    const allowance = finite2(input.annualLeaveYearAllowance);
    if (allowance != null) out.annualLeaveYearAllowance = allowance;
    if (text15(input.annualLeaveYearAllowanceKey)) out.annualLeaveYearAllowanceKey = text15(input.annualLeaveYearAllowanceKey);
    return out;
  }
  function invitationUsedWriteFields(usedAt) {
    return { set: { isUsed: true, usedAt } };
  }
  function organizationCreateFields(input) {
    const name = text15(input?.name);
    const creatorUserId = text15(input?.creatorUserId);
    if (!name || !creatorUserId) return null;
    const planKey = text15(input.planKey) === "year" ? "year" : "month";
    const protectedKeys = /* @__PURE__ */ new Set(["members", "creatorUserId", "subscription", "billing", "settings", "name"]);
    const setup = {};
    for (const [key3, value] of Object.entries(input.setupFields || {})) {
      if (value !== void 0 && !protectedKeys.has(key3)) setup[key3] = value;
    }
    return {
      name,
      members: { [creatorUserId]: "admin" },
      settings: input.settings && typeof input.settings === "object" ? { ...input.settings } : {},
      subscription: { status: "pending", planKey: text15(input.planKey) || planKey, createdAt: input.createdAt },
      billing: {
        status: "pending",
        billingInterval: planKey,
        trialUsed: false,
        mrrPence: 0,
        updatedAt: input.updatedAt ?? input.createdAt
      },
      teamOnboarding: { status: "pending_add_users", addUsersGuideShown: false },
      createdAt: input.createdAt,
      updatedAt: input.updatedAt ?? input.createdAt,
      ...setup,
      creatorUserId
    };
  }
  function taxIdsDocumentFields(input) {
    const result2 = sensitiveProfileWriteFields(input);
    return result2.ok ? result2.fields : null;
  }

  // lib/canonical/userDelete.ts
  var USER_DELETE_REFUSAL_MESSAGES = {
    not_admin: "Only an admin can delete people.",
    self: "You cannot delete your own account here.",
    super_admin: "The super admin cannot be deleted.",
    creator: "The company owner cannot be deleted.",
    admin_needs_super_admin: "Only the super admin can delete an admin."
  };
  function key2(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  function text16(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function userDeleteRefusal(actor, target, options) {
    if (!actor || !target || !text16(target.id)) return "not_admin";
    const actorRole = actor.role;
    if (!actorRole || actorRole.isOperativeMode || !(actorRole.isAdmin || actorRole.isSuperAdmin)) return "not_admin";
    const roster = options?.roster ?? null;
    const actorIds = new Set(personIdSet(actor, roster).map(key2));
    const targetIds = personIdSet(target, roster).map(key2);
    if (targetIds.some((id2) => actorIds.has(id2))) return "self";
    if (target.role?.isSuperAdmin) return "super_admin";
    const creator = key2(options?.creatorUserId);
    if (creator && targetIds.includes(creator)) return "creator";
    if (actorRole.isSuperAdmin) return null;
    if (target.role?.isAdmin || target.role?.isSuperAdmin) return "admin_needs_super_admin";
    return null;
  }
  function canDeleteUser(actor, target, options) {
    return userDeleteRefusal(actor, target, options) === null;
  }
  function userDeleteWrites(input) {
    const org = text16(input?.orgId);
    const uid = text16(input?.user?.id);
    if (!org || !uid || org.includes("/") || uid.includes("/")) return [];
    const ids = personIdSet(input.user, input.roster ?? null);
    const idKeys = new Set(ids.map(key2));
    const email = key2(input.user.email);
    const account = [
      { op: "delete", path: `users/${uid}` },
      { op: "delete", path: `users/${uid}/private/taxIds` },
      { op: "delete", path: `users/${uid}/orgMemberships/${org}` }
    ];
    if (email && !email.includes("/")) account.push({ op: "delete", path: `organizations/${org}/userEmails/${email}` });
    if (input.listedInMembers !== false) account.push({ op: "update", path: `organizations/${org}`, deleteFields: [`members.${uid}`] });
    const steps = [{ step: "account", writes: account }];
    const rowMatches = (row2) => idKeys.has(key2(row2?.id)) || idKeys.has(key2(row2?.userId)) || email !== "" && key2(row2?.email) === email;
    const rosterRows = [
      ...(input.operativeRows || []).filter(rowMatches).map((row2) => ({ collection: "operatives", id: text16(row2.id) })),
      ...(input.managerRows || []).filter(rowMatches).map((row2) => ({ collection: "managers", id: text16(row2.id) }))
    ].filter((row2) => row2.id && !row2.id.includes("/"));
    const labour = bookingsToRemoveOnOperativeDelete({
      bookings: input.bookings || [],
      operativeIds: [...ids, ...rosterRows.filter((row2) => row2.collection === "operatives").map((row2) => row2.id)],
      nowIso: input.nowIso,
      timeZone: input.tz
    }).map((id2) => ({ collection: "bookings", id: id2 }));
    const today = bookingsToRemoveOnOperativeDelete({
      bookings: (input.managerSiteBookings || []).map((row2) => ({ id: row2.id, operativeId: row2.userId, dateMs: row2.dateMs })),
      operativeIds: ids,
      nowIso: input.nowIso,
      timeZone: input.tz
    }).map((id2) => ({ collection: "managerSiteBookings", id: id2 }));
    const bookingWrites = [];
    let current = [];
    for (const row2 of [...labour, ...today]) {
      const tombstone = bookingTombstoneWriteFields({
        bookingId: row2.id,
        collection: row2.collection,
        deletedBy: input.actorUserId,
        deletedFrom: input.platform
      });
      const path = bookingTombstonePath(org, row2.id);
      if (!tombstone || !path) continue;
      current.push({ op: "delete", path: `organizations/${org}/${row2.collection}/${row2.id}` });
      current.push({ op: "set", path, fields: { ...tombstone }, serverTimestampFields: ["deletedAt"] });
      if (current.length >= BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT * 2) {
        bookingWrites.push(current);
        current = [];
      }
    }
    if (current.length > 0) bookingWrites.push(current);
    for (const writes of bookingWrites) steps.push({ step: "bookings", writes });
    if (rosterRows.length > 0) {
      steps.push({
        step: "rosterRows",
        writes: rosterRows.map((row2) => ({ op: "delete", path: `organizations/${org}/${row2.collection}/${row2.id}` }))
      });
    }
    const invitations = (input.invitations || []).filter((row2) => email !== "" && key2(row2?.email) === email && text16(row2.id) && !text16(row2.id).includes("/")).map((row2) => ({ op: "delete", path: `invitations/${text16(row2.id)}` }));
    if (invitations.length > 0) steps.push({ step: "invitations", writes: invitations });
    return steps;
  }

  // lib/canonical/orgMembership.ts
  var ORG_MEMBERSHIP_PERMISSION_KEYS = [
    "adminAccess",
    "manager",
    "operatives",
    "skills",
    "qualifications",
    "materials",
    "projects",
    "smallWorks",
    "operativeMode",
    "siteAudit",
    "subContractors",
    "wholesalersOrderHistory",
    "annualLeaveSelfBook",
    "weeklyReports",
    "dailyOverview"
  ];
  var ORG_MEMBERSHIP_DEFAULT_ON = [
    "materials",
    "siteAudit",
    "wholesalersOrderHistory",
    "dailyOverview"
  ];
  var ORG_MEMBERSHIP_ADMIN_FIELDS = ["role", "isSuperAdmin", "accountActive", "isActive", "permissions", ...ORG_MEMBERSHIP_PERMISSION_KEYS];
  var ORG_MEMBERSHIP_SELF_FIELDS = ["status", "acceptedAt", "updatedAt", "updatedBy", "updatedFrom"];
  function text17(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function bool2(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    return null;
  }
  function instantMs(raw) {
    if (raw == null || raw === "") return null;
    if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.getTime();
    if (typeof raw === "string") {
      const ms = Date.parse(raw);
      return Number.isNaN(ms) ? null : ms;
    }
    if (typeof raw === "object") {
      const row2 = raw;
      if (typeof row2.toMillis === "function") {
        const ms = row2.toMillis();
        return Number.isFinite(ms) ? ms : null;
      }
      const seconds = Number(row2.seconds ?? row2._seconds);
      if (!Number.isFinite(seconds)) return null;
      const nanos = Number(row2.nanoseconds ?? row2._nanoseconds ?? 0);
      return seconds * 1e3 + Math.floor((Number.isFinite(nanos) ? nanos : 0) / 1e6);
    }
    return null;
  }
  function parseOrgMembershipDocument(organizationId, data) {
    const org = text17(organizationId);
    if (!org) return null;
    const row2 = data && typeof data === "object" ? data : {};
    const nested = row2.permissions && typeof row2.permissions === "object" ? row2.permissions : {};
    let hasLegacyFlatFlags = false;
    const permissions = {};
    for (const key3 of ORG_MEMBERSHIP_PERMISSION_KEYS) {
      const fromNested = bool2(nested[key3]);
      const fromFlat = bool2(row2[key3]);
      if (fromNested == null && fromFlat != null) hasLegacyFlatFlags = true;
      permissions[key3] = fromNested ?? fromFlat ?? ORG_MEMBERSHIP_DEFAULT_ON.includes(key3);
    }
    if (permissions.operativeMode) {
      permissions.manager = false;
      permissions.operatives = false;
    }
    const accountActive = bool2(row2.accountActive) ?? bool2(row2.isActive) ?? true;
    return {
      organizationId: org,
      role: text17(row2.role) || "member",
      status: text17(row2.status) === "pending" ? "pending" : "active",
      isSuperAdmin: bool2(row2.isSuperAdmin) === true,
      accountActive,
      permissions,
      invitedBy: text17(row2.invitedBy) || null,
      invitedAtMs: instantMs(row2.invitedAt),
      acceptedAtMs: instantMs(row2.acceptedAt),
      updatedAtMs: instantMs(row2.updatedAt),
      hasLegacyFlatFlags
    };
  }
  function orgMembershipWriteFields(input) {
    const org = text17(input?.organizationId);
    if (!org) return null;
    const storedRaw = input.stored && typeof input.stored === "object" ? input.stored : null;
    const current = storedRaw ? parseOrgMembershipDocument(org, storedRaw) : null;
    const next = input.next || {};
    const fields = {};
    const remove = [];
    if (input.writer === "self") {
      if (next.status === "active" && (!current || current.status === "pending")) {
        fields.status = "active";
        fields.acceptedAt = input.now;
      }
      if (!current && Object.keys(fields).length > 0) {
        return { mode: "create", fields: { ...fields, invitedAt: input.now, updatedAt: input.now }, remove: [] };
      }
      if (Object.keys(fields).length === 0) return null;
      fields.updatedAt = input.now;
      return { mode: "update", fields, remove: [] };
    }
    const role = text17(next.role);
    if (!current) {
      const permissions = {};
      for (const key3 of ORG_MEMBERSHIP_PERMISSION_KEYS) {
        const value = next.permissions?.[key3];
        permissions[key3] = typeof value === "boolean" ? value : ORG_MEMBERSHIP_DEFAULT_ON.includes(key3);
      }
      const status = next.status === "pending" ? "pending" : "active";
      const set = {
        role: role || "member",
        status,
        isSuperAdmin: next.isSuperAdmin === true,
        accountActive: next.accountActive !== false,
        permissions,
        invitedAt: input.now,
        updatedAt: input.now
      };
      if (status === "active") set.acceptedAt = input.now;
      const invitedBy = text17(next.invitedBy);
      if (invitedBy) set.invitedBy = invitedBy;
      return { mode: "create", fields: set, remove: [] };
    }
    if (role && role !== current.role) fields.role = role;
    if (next.status && next.status !== current.status) {
      fields.status = next.status;
      if (next.status === "active") fields.acceptedAt = input.now;
    }
    if (typeof next.isSuperAdmin === "boolean" && next.isSuperAdmin !== current.isSuperAdmin) fields.isSuperAdmin = next.isSuperAdmin;
    if (typeof next.accountActive === "boolean" && next.accountActive !== current.accountActive) fields.accountActive = next.accountActive;
    const nested = storedRaw && storedRaw.permissions && typeof storedRaw.permissions === "object" ? storedRaw.permissions : {};
    for (const key3 of ORG_MEMBERSHIP_PERMISSION_KEYS) {
      const value = next.permissions?.[key3];
      if (typeof value !== "boolean") {
        if (bool2(nested[key3]) == null && storedRaw && bool2(storedRaw[key3]) != null) {
          fields[`permissions.${key3}`] = current.permissions[key3];
        }
        continue;
      }
      if (bool2(nested[key3]) !== value) fields[`permissions.${key3}`] = value;
    }
    if (storedRaw) {
      for (const key3 of ORG_MEMBERSHIP_PERMISSION_KEYS) if (key3 in storedRaw) remove.push(key3);
      if ("isActive" in storedRaw) {
        if (!("accountActive" in fields) && bool2(storedRaw.accountActive) == null) fields.accountActive = current.accountActive;
        remove.push("isActive");
      }
    }
    if (Object.keys(fields).length === 0 && remove.length === 0) return null;
    fields.updatedAt = input.now;
    return { mode: "update", fields, remove };
  }
  function organizationMemberActive(input) {
    const orgId = String(input?.organizationId ?? "").trim();
    const uid = String(input?.userId ?? "").trim();
    if (!orgId || !uid) return { member: false, active: false };
    const org = input.organization && typeof input.organization === "object" ? input.organization : {};
    const members = org.members && typeof org.members === "object" ? org.members : {};
    const user = input.user && typeof input.user === "object" ? input.user : null;
    const membership = input.membership && typeof input.membership === "object" ? input.membership : null;
    const homeOrg = user ? membershipOrganizationId(user.organizationId) : "";
    const home = homeOrg !== "" && homeOrg.toLowerCase() === orgId.toLowerCase();
    const member = members[uid] != null && members[uid] !== "" || String(org.creatorUserId ?? "") === uid || home || membership != null;
    const homeInactive = home && user?.isActive === false;
    const membershipInactive = membership != null && (membership.accountActive ?? membership.isActive) === false;
    return { member, active: member && !homeInactive && !membershipInactive };
  }
  function membershipOrganizationId(value) {
    if (typeof value === "string") {
      const parts = value.trim().split("/");
      return (parts[parts.length - 1] ?? "").trim();
    }
    if (value && typeof value === "object") {
      const row2 = value;
      if (typeof row2.id === "string") return row2.id.trim();
      if (typeof row2.path === "string") return membershipOrganizationId(row2.path);
    }
    return "";
  }

  // lib/canonical/crossPlatformContract.ts
  var CROSS_PLATFORM_CONTRACT_READERS = {
    parseBookingDocument: (id2, data, o) => parseBookingDocument(id2, data, { timeZone: o.timeZone }),
    parseManagerSiteBookingDocument: (id2, data, o) => parseManagerSiteBookingDocument(id2, data, { timeZone: o.timeZone }),
    parseSubcontractorBookingDocument: (id2, data, o) => parseSubcontractorBookingDocument(id2, data, { timeZone: o.timeZone }),
    parseProjectDocument: (id2, data, o) => parseProjectDocument(id2, data, { timeZone: o.timeZone }),
    parseSmallWorkDocument: (id2, data, o) => parseSmallWorkDocument(id2, data, { timeZone: o.timeZone }),
    parseHolidayDocument: (id2, data, o) => parseHolidayDocument(id2, data, o.timeZone),
    parseOperativeDocument: (id2, data, o) => parseOperativeDocument(id2, data, o.timeZone),
    parseManagerDocument: (id2, data) => parseManagerDocument(id2, data),
    parseClientDocument: (id2, data) => parseClientDocument(id2, data),
    parseSubcontractorDocument: (id2, data) => parseSubcontractorDocument(id2, data),
    parsePayRateHistoryDocument: (id2, data, o) => parsePayRateHistoryDocument(id2, data, o.timeZone),
    parseWarningResolutionDocument: (id2, data, o) => parseWarningResolutionDocument(id2, data, { timeZone: o.timeZone }),
    parseMaterialLineDocument: (id2, data, o) => parseMaterialLineDocument(id2, data, { timeZone: o.timeZone }),
    parseMaterialSendRecordDocument: (id2, data, o) => parseMaterialSendRecordDocument(id2, data, { timeZone: o.timeZone }),
    parseMaterialCatalogueDocument: (id2, data) => parseMaterialCatalogueDocument(id2, data),
    parseWholesalerDocument: (id2, data) => parseWholesalerDocument(id2, data),
    parseSiteAuditDocument: (id2, data, o) => parseSiteAuditDocument(id2, data, { timeZone: o.timeZone }),
    parseTaskDocument: (id2, data, o) => parseTaskDocument(id2, data, { timeZone: o.timeZone }),
    parseHealthSafetyDocument: (_id, data, o) => parseHealthSafetyDocument(data, { projectId: o.projectId, timeZone: o.timeZone }),
    parseVariationDocument: (id2, data) => parseVariationDocument(id2, data),
    parseVariationTrackerDocument: (id2, data) => parseVariationTrackerDocument(id2, data),
    parseDeadlineDocument: (id2, data, o) => parseDeadlineDocument(id2, data, { projectId: o.projectId, timeZone: o.timeZone }),
    parseNotificationDocument: (id2, data, o) => parseNotificationDocument(id2, data, { timeZone: o.timeZone }),
    parseJobTypesDocument: (_id, data) => parseJobTypesDocument(data),
    parseSkillDocument: (id2, data) => parseSkillDocument(id2, data),
    parseUserDocument: (id2, data) => parseUserDocument(id2, data),
    parseVariationTrades: (_id, data) => parseVariationTrades(data),
    parseTradeTypeInventory: (_id, data) => parseTradeTypeInventory(data),
    parseTimesheetStatusFields: (_id, data) => parseTimesheetStatusFields(data),
    resolveSensitiveProfile: (_id, data) => resolveSensitiveProfile({ privateDoc: data }),
    parseOrgMembershipDocument: (id2, data) => parseOrgMembershipDocument(id2, data),
    /** `organizations/{orgId}`: the settings readers together. */
    organizationDocument: (_id, data) => ({
      name: parseOrganizationName(data),
      companyDetails: parseCompanyDetails(data),
      currency: resolveOrganizationCurrency(data),
      warningDetection: parseWarningDetection(
        data.warningDetection && typeof data.warningDetection === "object" ? data.warningDetection : data.settings?.warningDetection
      )
    }),
    /** `users/{uid}.notificationPreferences`. */
    parseUserNotificationPreferences: (_id, data) => parseUserNotificationPreferences(data.notificationPreferences)
  };
  function plain(value) {
    if (value === void 0) return null;
    return JSON.parse(JSON.stringify(value));
  }
  function readCrossPlatformSample(reader, docId, data, options) {
    const run = CROSS_PLATFORM_CONTRACT_READERS[typeof reader === "string" ? reader : ""];
    if (!run) return { error: "unknown_reader" };
    return plain(run(typeof docId === "string" ? docId : "", data && typeof data === "object" ? data : {}, options || {}));
  }
  function crossPlatformContractReaderNames() {
    return Object.keys(CROSS_PLATFORM_CONTRACT_READERS).sort();
  }

  // lib/canonical/inviteAccept.ts
  function text18(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function record7(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }
  function flags(value) {
    const out = {};
    for (const [key3, flag] of Object.entries(record7(value) ?? {})) if (typeof flag === "boolean") out[key3] = flag;
    return out;
  }
  function finite3(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }
  function sameOrganization(a, b) {
    const raw = text18(a);
    const id2 = raw.includes("/") ? raw.split("/").filter(Boolean).pop() ?? "" : raw;
    return id2 !== "" && id2.toLowerCase() === b.toLowerCase();
  }
  function inviteAcceptWrites(input) {
    const invitation = record7(input.invitation) ?? {};
    const placeholder = record7(input.placeholder);
    const existing = record7(input.existingProfile);
    const organizationId = text18(invitation.organizationId);
    const permissions = flags(invitation.permissions);
    const invitedRole = text18(invitation.role).toLowerCase();
    const role = ["admin", "manager", "operative", "member"].includes(invitedRole) ? invitedRole : Object.keys(permissions).length > 0 ? accountKindFromFlags({
      isSuperAdmin: false,
      adminAccess: permissions.adminAccess === true,
      operativeMode: permissions.operativeMode === true,
      role: ""
    }) : ["admin", "manager", "operative"].includes(text18(placeholder?.role).toLowerCase()) ? text18(placeholder?.role).toLowerCase() : "member";
    const basis = text18(invitation.payBasis) === "hourly" ? "hourly" : text18(invitation.payBasis) === "day" ? "day" : null;
    const pay = basis === "hourly" && finite3(invitation.hourlyRate) != null ? { payBasis: "hourly", dayRate: null, hourlyRate: finite3(invitation.hourlyRate) } : basis === "day" && finite3(invitation.dayRate) != null ? { payBasis: "day", dayRate: finite3(invitation.dayRate), hourlyRate: null } : null;
    if (existing) {
      const another = organizationId !== "" && !sameOrganization(existing.organizationId, organizationId);
      return {
        mode: "existingAccount",
        writeProfile: false,
        profileSource: null,
        movePlaceholder: !another && Boolean(placeholder),
        claimToAccount: !another,
        role,
        permissions,
        pay,
        joinsAnotherCompany: another
      };
    }
    const migrating = Boolean(placeholder);
    return {
      mode: migrating ? "migratePlaceholder" : "newProfile",
      writeProfile: true,
      profileSource: migrating ? "placeholder" : "invitation",
      movePlaceholder: migrating,
      claimToAccount: true,
      role,
      permissions,
      pay,
      joinsAnotherCompany: false
    };
  }
  function idList7(value) {
    if (!Array.isArray(value)) return [];
    const out = [];
    for (const item of value) {
      const id2 = text18(item);
      if (id2 && !out.includes(id2)) out.push(id2);
    }
    return out;
  }
  function invitationRole(invitation) {
    const row2 = record7(invitation) ?? {};
    const stored = text18(row2.role).toLowerCase();
    if (stored === "admin" || stored === "manager" || stored === "operative" || stored === "member") return stored;
    const permissions = record7(row2.permissions) ?? {};
    if (Object.keys(permissions).length === 0) return "member";
    if (permissions.adminAccess === true) return "admin";
    if (permissions.operativeMode === true) return "operative";
    return "manager";
  }
  var OPERATIVE_INVITE_FORBIDDEN_FLAGS = ["adminAccess", "isSuperAdmin", "manager", "operatives"];
  function flagOn3(value) {
    return value === true || value === 1;
  }
  function invitationIsOperativeOnly(invitation) {
    const row2 = record7(invitation) ?? {};
    const permissions = record7(row2.permissions) ?? {};
    if (invitationRole(row2) !== "operative") return false;
    if (!(flagOn3(permissions.operativeMode) || text18(row2.role).toLowerCase() === "operative")) return false;
    return OPERATIVE_INVITE_FORBIDDEN_FLAGS.every((key3) => !flagOn3(permissions[key3]) && !flagOn3(row2[key3]));
  }
  function invitationProfileFields(invitation) {
    const row2 = record7(invitation) ?? {};
    const out = { role: invitationRole(row2) };
    const permissions = record7(row2.permissions);
    if (permissions) {
      out.permissions = { ...permissions };
      for (const [key3, value] of Object.entries(permissions)) if (typeof value === "boolean") out[key3] = value;
    }
    const employment = text18(row2.employmentType);
    if (employment) out.employmentType = employment === "paye" ? "paye" : "self_employed";
    const basis = text18(row2.payBasis);
    if (basis === "hourly" && finite3(row2.hourlyRate) != null) {
      out.payBasis = "hourly";
      out.hourlyRate = finite3(row2.hourlyRate);
    } else if (basis === "day" && finite3(row2.dayRate) != null) {
      out.payBasis = "day";
      out.dayRate = finite3(row2.dayRate);
    }
    if (row2.hasNoLineManager === true) {
      out.hasNoLineManager = true;
    } else {
      let managers = idList7(row2.assignedManagerUserIds);
      if (managers.length === 0 && text18(row2.assignedManagerUserId)) managers = [text18(row2.assignedManagerUserId)];
      if (managers.length > 0) {
        out.assignedManagerUserIds = managers;
        out.assignedManagerUserId = managers[0];
        out.hasNoLineManager = false;
      }
    }
    return out;
  }
  var INVITE_MEMBERSHIP_FIELDS = [
    "organizationId",
    "role",
    "status",
    "isSuperAdmin",
    "accountActive",
    "permissions",
    "invitationId",
    "invitedBy",
    "invitedAt",
    "acceptedAt",
    "updatedAt"
  ];
  function inviteMembershipWrites(input) {
    const row2 = record7(input?.invitation) ?? {};
    const organizationId = text18(row2.organizationId);
    const invitationId = text18(input?.invitationId);
    const authUid = text18(input?.authUid);
    if (!organizationId || !invitationId || !authUid) return null;
    const role = invitationRole(row2);
    const membership = {
      organizationId,
      role,
      status: "active",
      isSuperAdmin: false,
      accountActive: true,
      permissions: { ...record7(row2.permissions) ?? {} },
      invitationId,
      invitedAt: input.now,
      acceptedAt: input.now,
      updatedAt: input.now
    };
    const invitedBy = text18(row2.invitedBy);
    if (invitedBy) membership.invitedBy = invitedBy;
    return { organizationId, membership, membersField: `members.${authUid}`, role };
  }

  // lib/canonical/lineManagers.ts
  var NO_LINE_MANAGER_LABEL = "No line manager";
  var NO_LINE_MANAGER_HELP = "For directors or senior staff whose timesheets and leave nobody else approves.";
  var LINE_MANAGER_NOT_SET_LABEL = "Not set";
  function text19(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function rosterPersonName2(row2) {
    if (!row2) return "";
    const full = `${text19(row2.firstName)} ${text19(row2.surname) || text19(row2.lastName)}`.trim();
    return full || text19(row2.displayName) || text19(row2.name) || text19(row2.email);
  }
  function levelOf(row2) {
    const role = row2.role;
    if (role && typeof role === "object") {
      const resolved = role;
      if (resolved.isAdmin === true || resolved.isSuperAdmin === true) return "admin";
      if (resolved.isOperativeMode === true) return "operative";
      return resolved.isManager === true ? "manager" : "operative";
    }
    return permissionLevelOf(row2);
  }
  function rosterPersonGroups(rows3) {
    const groups = [];
    const grouped = /* @__PURE__ */ new Set();
    for (const row2 of rows3) {
      const key3 = idKey2(row2.id);
      if (grouped.has(key3)) continue;
      const keys = new Set(personIdSet(row2, rows3).map(idKey2));
      keys.add(key3);
      const members = rows3.filter((other) => keys.has(idKey2(other.id)));
      for (const member of members) grouped.add(idKey2(member.id));
      const aliasKeys = /* @__PURE__ */ new Set();
      for (const member of members) {
        for (const alias of [...member.formerUserIds || [], ...member.sameEmailUserIds || [], ...member.formerIds || [], ...member.aliasIds || []]) {
          if (idKey2(alias) !== idKey2(member.id)) aliasKeys.add(idKey2(alias));
        }
      }
      const rank = (member) => (rosterMemberActive(member) && !isAnonymisedDeletedProfile(member) ? 0 : 4) + (member.passwordSet === false ? 2 : 0) + (aliasKeys.has(idKey2(member.id)) ? 1 : 0);
      const primary = members.reduce((best, member) => rank(member) < rank(best) ? member : best, members[0]);
      groups.push({ primary, rows: members, keys });
    }
    return groups;
  }
  function lineManagerCandidates(person, roster) {
    const rows3 = (roster || []).filter((row2) => row2 && text19(row2.id));
    const self = new Set(person ? personIdSet(person, rows3).map(idKey2) : []);
    const out = [];
    for (const group of rosterPersonGroups(rows3)) {
      if ([...group.keys].some((key3) => self.has(key3))) continue;
      const row2 = group.primary;
      if (!rosterMemberActive(row2) || row2.passwordSet === false) continue;
      if (isAnonymisedDeletedProfile(row2)) continue;
      const level = levelOf(row2);
      if (level === "operative") continue;
      out.push({ id: text19(row2.id), name: rosterPersonName2(row2), level });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.id.localeCompare(b.id));
  }
  function lineManagerSelectedIds(person, roster) {
    if (!person || person.hasNoLineManager === true) return [];
    const listed = (person.assignedManagerUserIds || []).map(text19).filter(Boolean);
    const stored = listed.length > 0 ? listed : [text19(person.assignedManagerUserId)].filter(Boolean);
    if (stored.length === 0) return [];
    const rows3 = (roster || []).filter((row2) => row2 && text19(row2.id));
    const candidates = lineManagerCandidates(person, rows3);
    const groups = rosterPersonGroups(rows3);
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const id2 of stored) {
      const group = groups.find((entry) => entry.keys.has(idKey2(id2)));
      const candidate = group ? candidates.find((entry) => group.keys.has(idKey2(entry.id))) : candidates.find((entry) => idKey2(entry.id) === idKey2(id2));
      const value = candidate ? candidate.id : id2;
      const key3 = group ? `g:${idKey2(group.primary.id)}` : idKey2(value);
      if (seen.has(key3)) continue;
      seen.add(key3);
      out.push(value);
    }
    return out;
  }
  function lineManagerOptions(person) {
    const required = lineManagerRequired(person);
    return { required, allowsNoLineManager: !required, noLineManagerLabel: NO_LINE_MANAGER_LABEL, noLineManagerHelp: NO_LINE_MANAGER_HELP };
  }
  var UNKNOWN_PERSON_LABEL = "Unknown person";
  function lineManagerSummary(person, roster) {
    if (!person) return { label: LINE_MANAGER_NOT_SET_LABEL, ids: [], moreCount: 0 };
    if (person.hasNoLineManager === true) return { label: NO_LINE_MANAGER_LABEL, ids: [], moreCount: 0 };
    const listed = (person.assignedManagerUserIds || []).map(text19).filter(Boolean);
    const stored = listed.length > 0 ? listed : [text19(person.assignedManagerUserId)].filter(Boolean);
    const rows3 = (roster || []).filter((row2) => row2 && text19(row2.id));
    const ids = [];
    const seen = /* @__PURE__ */ new Set();
    const groups = rosterPersonGroups(rows3);
    for (const id2 of stored) {
      const group = groups.find((entry) => entry.keys.has(idKey2(id2)));
      const row2 = group ? group.primary : rosterMemberFor(id2, rows3);
      const key3 = group ? `g:${idKey2(group.primary.id)}` : idKey2(row2 ? row2.id : id2);
      if (seen.has(key3)) continue;
      seen.add(key3);
      ids.push(row2 ? { id: text19(row2.id), name: rosterPersonName2(row2) || UNKNOWN_PERSON_LABEL, resolved: true } : { id: id2, name: UNKNOWN_PERSON_LABEL, resolved: false });
    }
    const moreCount = Math.max(0, ids.length - 1);
    const label = ids.length === 0 ? LINE_MANAGER_NOT_SET_LABEL : moreCount >= 1 ? `${ids[0].name} +${moreCount} more` : ids[0].name;
    return { label, ids, moreCount };
  }

  // lib/canonical/orgRoster.ts
  function text20(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function orgIdOf(value) {
    const raw = text20(value);
    return raw.includes("/") ? raw.split("/").filter(Boolean).pop() ?? "" : raw;
  }
  function levelFromRole(role) {
    const value = text20(role).toLowerCase().replace(/[\s-]/g, "_");
    if (value === "admin" || value === "super_admin" || value === "superadmin") return "admin";
    if (value === "manager") return "manager";
    if (value === "operative") return "operative";
    return null;
  }
  function organizationLevelFor(input) {
    const org = text20(input.organizationId).toLowerCase();
    const id2 = text20(input.userId);
    if (id2 && text20(input.creatorUserId) === id2) return { level: "admin", isSuperAdmin: true, source: "creator" };
    const user = input.user ?? null;
    if (user && orgIdOf(user.organizationId).toLowerCase() === org) {
      return { level: permissionLevelOf(user), isSuperAdmin: storedPermissionFlag(user, "isSuperAdmin") === true, source: "users" };
    }
    if (input.membership && typeof input.membership === "object") {
      const parsed = parseOrgMembershipDocument(input.organizationId, input.membership);
      if (parsed) {
        const fromRole = levelFromRole(parsed.role);
        const level = fromRole ?? (parsed.isSuperAdmin || parsed.permissions.adminAccess ? "admin" : parsed.permissions.operativeMode ? "operative" : "manager");
        return { level, isSuperAdmin: parsed.isSuperAdmin === true, source: "membership" };
      }
    }
    return { level: levelFromRole(input.membersRole) ?? "operative", isSuperAdmin: false, source: "members" };
  }
  function rosterMembersForOrganization(input) {
    const org = text20(input?.organizationId);
    const members = input?.members && typeof input.members === "object" ? input.members : {};
    const creator = text20(input?.creatorUserId);
    const signedIn = text20(input?.signedInUserId);
    const anchored = [];
    const add = (id2) => {
      if (id2 && !anchored.some((row2) => row2.toLowerCase() === id2.toLowerCase())) anchored.push(id2);
    };
    for (const key3 of Object.keys(members)) add(text20(key3));
    add(creator);
    if (signedIn && Object.keys(members).some((key3) => key3.toLowerCase() === signedIn.toLowerCase())) add(signedIn);
    const anchoredKeys = new Set(anchored.map((id2) => id2.toLowerCase()));
    const missing = new Set((input?.missingIds || []).map((id2) => text20(id2).toLowerCase()));
    const docs = (input?.users || []).filter((row2) => {
      const id2 = text20(row2?.id).toLowerCase();
      if (!id2 || missing.has(id2)) return false;
      return orgIdOf(row2.organizationId).toLowerCase() === org.toLowerCase() || anchoredKeys.has(id2);
    });
    const folded = rosterPeople(docs);
    const people = folded.people.map((person) => {
      const id2 = text20(person.id);
      const membersRole = Object.entries(members).find(([key3]) => key3.toLowerCase() === id2.toLowerCase())?.[1];
      return {
        ...person,
        organizationLevel: organizationLevelFor({
          organizationId: org,
          userId: id2,
          user: person,
          membership: input?.memberships?.[id2] ?? null,
          membersRole,
          creatorUserId: creator
        })
      };
    });
    const present = new Set(docs.map((row2) => text20(row2.id).toLowerCase()));
    const unreadIds = anchored.filter((id2) => !present.has(id2.toLowerCase()) && !missing.has(id2.toLowerCase()));
    return { people, userIdAliases: folded.userIdAliases, anchoredIds: anchored, unreadIds };
  }

  // lib/canonical/platformConfig.ts
  var PLATFORM_CONFIG_APP_PATH = "platformConfig/app";
  function finiteNumber4(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "string" && /^\s*\d+(\.\d+)?\s*$/.test(value)) return Number(value);
    return null;
  }
  function versionParts(value) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return [value];
    if (typeof value !== "string") return null;
    const raw = value.trim().replace(/^v/i, "");
    if (!/^\d+(\.\d+)*$/.test(raw)) return null;
    return raw.split(".").map(Number);
  }
  function compareAppVersions(a, b) {
    const length = Math.max(a.length, b.length);
    for (let i = 0; i < length; i += 1) {
      const left = a[i] ?? 0;
      const right = b[i] ?? 0;
      if (left !== right) return left < right ? -1 : 1;
    }
    return 0;
  }
  function appUpdateRequired(running, config) {
    if (!config || typeof config !== "object") return false;
    const platform = String(running?.platform ?? "").trim().toLowerCase();
    if (platform === "ios") {
      const minimum = finiteNumber4(config.minimumIosBuild);
      const build = finiteNumber4(running?.runningBuild);
      return minimum != null && build != null && build < minimum;
    }
    if (platform === "web") {
      const minimum = versionParts(config.minimumWebVersion);
      const version = versionParts(running?.runningBuild);
      return minimum != null && version != null && compareAppVersions(version, minimum) < 0;
    }
    return false;
  }

  // lib/canonical/bookingSlots.ts
  var WEEKDAY_TIME_SLOTS = ["FULL DAY", "CUSTOM"];
  var WEEKEND_TIME_SLOTS = ["CUSTOM"];
  function isoWeekdayOf(day, timeZone) {
    if (typeof day === "number") return day;
    const text23 = String(day || "").trim().toLowerCase();
    if (text23 === "saturday") return 6;
    if (text23 === "sunday") return 7;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text23)) return isoWeekdayOfDayKey(text23, zoneOrLondon(timeZone));
    return 0;
  }
  function isWeekendDayKey(dayKey, timeZone) {
    const iso = isoWeekdayOf(dayKey, timeZone);
    return iso === 6 || iso === 7;
  }
  function allowedTimeSlotsOnDay(dayKey, _policy, timeZone) {
    return [...isWeekendDayKey(dayKey, timeZone) ? WEEKEND_TIME_SLOTS : WEEKDAY_TIME_SLOTS];
  }
  function timeSlotAllowedOnDay(timeSlot, dayKey, timeZone) {
    const kind = namedSlotKind(timeSlot);
    if (!isWeekendDayKey(dayKey, timeZone)) return kind === "FULL_DAY" || kind === "CUSTOM";
    return kind === "CUSTOM";
  }
  var WEEKEND_WEEKDAY_MIX_MESSAGE = "Weekends cannot be booked alongside Weekdays. Make your weekday booking first then weekend separately.";
  function bookingDaysMixWeekdayAndWeekend(dayKeys, timeZone) {
    let weekday2 = false;
    let weekend = false;
    for (const key3 of dayKeys || []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key3 || "").trim())) continue;
      if (isWeekendDayKey(String(key3).trim(), timeZone)) weekend = true;
      else weekday2 = true;
      if (weekday2 && weekend) return true;
    }
    return false;
  }
  function weekendCustomHoursDefault(policy, weekday2, timeZone) {
    if (!policy) return null;
    const iso = isoWeekdayOf(weekday2, timeZone);
    if (iso !== 6 && iso !== 7) return null;
    const weekend = weekendRuleForIsoWeekday(iso, policy);
    if (!weekend || weekend.allHoursAtMultiplierMode) return null;
    const window = weekendFullDayWindow(policy, weekend);
    return window ? { start: formatClockMinutes(window.start), end: formatClockMinutes(window.end) } : null;
  }
  function hoursText(hours) {
    const rounded = Math.round(hours * 100) / 100;
    return `${Number.isInteger(rounded) ? rounded : rounded.toString()}h`;
  }
  function multiplierText(multiplier) {
    const rounded = Math.round(Number(multiplier) * 100) / 100;
    return `${rounded}\xD7`;
  }
  function weekendNoteBody(policy, iso) {
    if (!policy || iso !== 6 && iso !== 7) return null;
    const weekend = weekendRuleForIsoWeekday(iso, policy);
    if (!weekend) return null;
    if (weekend.allHoursAtMultiplierMode) {
      return ` is paid on the hours you enter, every hour at ${multiplierText(weekend.allHoursMultiplier)}. Change it in Working hours.`;
    }
    const window = weekendFullDayWindow(policy, weekend);
    if (!window) return null;
    const range = `${formatClockMinutes(window.start)}\u2013${formatClockMinutes(window.end)}`;
    const countsAs2 = Number(weekend.countsAsStandardHours ?? policy.standardPaidHours);
    const outside = Number(weekend.outsideWindowMultiplier ?? 1.5);
    return ` is paid on the hours you enter: ${range} counts as ${hoursText(Number.isFinite(countsAs2) ? countsAs2 : 0)}, hours outside it at ${multiplierText(outside)}. Change it in Working hours.`;
  }
  function weekendBookingNote(policy, weekday2, timeZone) {
    const iso = isoWeekdayOf(weekday2, timeZone);
    const body = weekendNoteBody(policy, iso);
    if (!body) return null;
    return `${iso === 6 ? "Saturday" : "Sunday"}${body}`;
  }
  function isPolicyState(value) {
    return Boolean(value && typeof value === "object" && "current" in value && "scheduled" in value);
  }
  function weekendBookingNotes(policy, dayKeys, timeZone) {
    if (!policy) return [];
    const keys = Array.from(
      new Set(
        (dayKeys || []).map((key3) => String(key3 || "").trim()).filter((key3) => /^\d{4}-\d{2}-\d{2}$/.test(key3))
      )
    ).sort();
    const bodies = { 6: [], 7: [] };
    for (const key3 of keys) {
      const iso = isoWeekdayOf(key3, timeZone);
      if (iso !== 6 && iso !== 7) continue;
      const dayPolicy = isPolicyState(policy) ? payrollTimePolicyForDayFromState(policy, key3) : policy;
      const body = weekendNoteBody(dayPolicy, iso);
      if (body && !bodies[iso].includes(body)) bodies[iso].push(body);
    }
    if (bodies[6].length === 1 && bodies[7].length === 1 && bodies[6][0] === bodies[7][0]) {
      return [`Saturday/Sunday${bodies[6][0]}`];
    }
    return [...bodies[6].map((body) => `Saturday${body}`), ...bodies[7].map((body) => `Sunday${body}`)];
  }
  function customHoursPrefillForDays(policy, dayKeys, timeZone) {
    const keys = Array.from(
      new Set((dayKeys || []).map((key3) => String(key3 || "").trim()).filter((key3) => /^\d{4}-\d{2}-\d{2}$/.test(key3)))
    ).sort();
    if (keys.length === 0) return null;
    const policyOn = (key3) => !policy ? null : isPolicyState(policy) ? payrollTimePolicyForDayFromState(policy, key3) : policy;
    const standardDay = (key3) => {
      const day = halfDayWindows(policyOn(key3)).day;
      return { start: formatClockMinutes(day.start), end: formatClockMinutes(day.end) };
    };
    const weekendKeys = keys.filter((key3) => isWeekendDayKey(key3, timeZone));
    if (weekendKeys.length === 0) return { ...standardDay(keys[0]), kind: "weekday" };
    if (weekendKeys.length !== keys.length) return { ...standardDay(keys[0]), kind: "none" };
    const ordered = [
      ...weekendKeys.filter((key3) => isoWeekdayOf(key3, timeZone) === 6),
      ...weekendKeys.filter((key3) => isoWeekdayOf(key3, timeZone) === 7)
    ];
    for (const key3 of ordered) {
      const window = weekendCustomHoursDefault(policyOn(key3), key3, timeZone);
      if (window) return { ...window, kind: "weekend" };
    }
    return { ...standardDay(ordered[0]), kind: "weekend" };
  }
  var WEEKDAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  function roundHours(hours) {
    return Math.round(hours * 100) / 100;
  }
  function weekendBookingBreakdown(policy, dayKeys, start, end, isBreakRemoved, timeZone) {
    if (!policy) return [];
    const startMinutes = parseClockMinutes(start);
    const endMinutes = parseClockMinutes(end);
    if (startMinutes == null || endMinutes == null || startMinutes === endMinutes) return [];
    const startText = formatClockMinutes(startMinutes);
    const endText = formatClockMinutes(endMinutes);
    const keys = Array.from(
      new Set((dayKeys || []).map((key3) => String(key3 || "").trim()).filter((key3) => /^\d{4}-\d{2}-\d{2}$/.test(key3)))
    ).sort();
    return keys.map((dayKey) => {
      const dayPolicy = isPolicyState(policy) ? payrollTimePolicyForDayFromState(policy, dayKey) : policy;
      const iso = isoWeekdayOf(dayKey, timeZone);
      const paid = payrollHoursResult({
        booking: { timeSlot: "CUSTOM_HOURS", workStartTime: startText, workEndTime: endText, isBreakRemoved: isBreakRemoved === true },
        dayKey,
        policy: dayPolicy,
        timeZone
      });
      const weekend = iso === 6 || iso === 7 ? weekendRuleForIsoWeekday(iso, dayPolicy) : null;
      const windowDay = Boolean(weekend && !weekend.allHoursAtMultiplierMode);
      const allHoursDay = Boolean(weekend && weekend.allHoursAtMultiplierMode);
      const standardHours = roundHours(paid.standardHours);
      const overtimeHours = roundHours(paid.outsideHours);
      const multiplier = roundHours(paid.outsideMultiplier);
      const total = roundHours(paid.totalPaidHours);
      const unpaidBreakHours = roundHours(paid.unpaidBreakHours);
      let breakInStandard = 0;
      let breakOutside = 0;
      for (const row2 of paid.segments) {
        if (row2.kind === "standardWindow") breakInStandard += row2.unpaidBreakHours ?? 0;
        else breakOutside += row2.unpaidBreakHours ?? 0;
      }
      breakInStandard = roundHours(breakInStandard);
      breakOutside = roundHours(breakOutside);
      const credit = weekend ? Number(weekend.countsAsStandardHours ?? dayPolicy.standardPaidHours) : NaN;
      const fullDay = windowDay && standardHours > 0 && Math.abs(standardHours - roundHours(credit)) < 1e-3;
      const label = WEEKDAY_NAMES[iso] || dayKey;
      let line = `${label} ${startText}\u2013${endText} = `;
      if (unpaidBreakHours > 0) {
        const parts = [];
        const standardBefore = roundHours(standardHours + breakInStandard);
        if (standardBefore > 0) {
          parts.push(breakInStandard > 0 ? `${hoursText(standardBefore)} \u2212 ${hoursText(breakInStandard)} unpaid break` : hoursText(standardHours));
        }
        const outsideBefore = roundHours(overtimeHours + breakOutside);
        if (outsideBefore > 0) {
          parts.push(
            breakOutside > 0 ? `(${hoursText(outsideBefore)} \u2212 ${hoursText(breakOutside)} unpaid break) \xD7 ${multiplier}` : `${hoursText(overtimeHours)} \xD7 ${multiplier}`
          );
        }
        line += parts.length === 0 ? "0h" : `${parts.join(" + ")} = ${hoursText(total)}`;
      } else {
        const parts = [];
        if (standardHours > 0) parts.push(hoursText(standardHours));
        if (overtimeHours > 0) parts.push(`${hoursText(overtimeHours)} \xD7 ${roundHours(multiplier)}`);
        if (parts.length === 0) line += "0h";
        else if (overtimeHours > 0) line += `${parts.join(" + ")} = ${hoursText(total)}`;
        else line += `${parts[0]}${fullDay ? " (counts as a full day)" : ""}`;
      }
      const lines = [];
      if (allHoursDay) {
        lines.push({ kind: "outside", label: "Every hour", value: `${hoursText(roundHours(overtimeHours + breakOutside))} \xD7 ${multiplier}` });
      } else if (standardHours > 0 || breakInStandard > 0) {
        lines.push({
          kind: "standard",
          label: windowDay ? "Set hours" : "Standard hours",
          value: hoursText(roundHours(standardHours + breakInStandard))
        });
      }
      if (unpaidBreakHours > 0) {
        lines.push({ kind: "break", label: "Unpaid break", value: `\u2212${hoursText(unpaidBreakHours)}` });
      }
      if (!allHoursDay && (overtimeHours > 0 || breakOutside > 0)) {
        lines.push({ kind: "outside", label: "Outside hours", value: `${hoursText(roundHours(overtimeHours + breakOutside))} \xD7 ${multiplier}` });
      }
      lines.push({ kind: "total", label: "Total paid hours", value: hoursText(total) });
      return {
        dayKey,
        weekdayLabel: label,
        start: startText,
        end: endText,
        workedHours: roundHours(paid.workedHours),
        countsAsHours: windowDay ? standardHours : null,
        standardHours,
        overtimeHours,
        multiplier,
        paidHoursEquivalent: total,
        unpaidBreakHours,
        line,
        lines
      };
    });
  }
  function weekendLunchBreakCopy(policy, weekday2) {
    const name = weekday2 === "saturday" ? "Saturday" : "Sunday";
    if (!policy) return { title: `Lunch break on ${name}`, detail: "" };
    const settings = weekday2 === "sunday" && policy.sunday?.sameAsSaturday ? policy.saturday : policy[weekday2];
    const own = weekendBreakFor(policy, settings);
    const sameAsWeekday = own.minutes === Math.max(0, Number(policy.unpaidBreakMinutes) || 0) && own.start === policy.breakWindowStart && own.end === policy.breakWindowEnd;
    return {
      title: `Lunch break on ${name}`,
      detail: `${own.start}\u2013${own.end}, ${own.minutes} min${sameAsWeekday ? " \u2014 the same as your weekday lunch." : "."}`
    };
  }
  var CUSTOM_HOURS_BREAK_WARNING = "You are booking custom hours that cover the unpaid lunch break. Turn off Unpaid break to make sure they are paid for this time.";
  function customHoursBreakWarning(policy, dayKey, booking, timeZone) {
    if (!policy || !booking) return null;
    if (namedSlotKind(booking.timeSlot) !== "CUSTOM") return null;
    if (booking.isBreakRemoved === true) return null;
    const day = dayKey || "2026-01-07";
    if (!unpaidBreakAppliesOnDay(policy, day, timeZone)) return null;
    const dayBreak = payrollBreakOnDay(policy, day, timeZone);
    if (!dayBreak) return null;
    const { start, end } = dayBreak;
    const span = slotInterval(
      { timeSlot: booking.timeSlot, workStartTime: booking.workStartTime, workEndTime: booking.workEndTime },
      policy
    );
    if (!span) return null;
    return intervalsOverlap(span, { start, end }) ? CUSTOM_HOURS_BREAK_WARNING : null;
  }
  function identityPart(value) {
    return String(value ?? "").trim().toLowerCase();
  }
  function bookingRequestIdentity(input) {
    const kind = namedSlotKind(input.timeSlot);
    const slot = kind === "UNKNOWN" ? identityPart(input.timeSlot) : kind;
    const custom = kind === "CUSTOM";
    const clock = (value) => {
      const minutes = parseClockMinutes(value ?? null);
      return minutes === null ? identityPart(value) : String(minutes);
    };
    return [
      identityPart(input.personId),
      String(input.dayKey || "").trim(),
      slot,
      identityPart(input.locationType),
      identityPart(input.locationId),
      identityPart(input.customLocationName),
      custom ? clock(input.workStartTime) : "",
      custom ? clock(input.workEndTime) : "",
      input.isBreakRemoved === true ? "break-off" : ""
    ].join("|");
  }
  function isSameBookingRequest(a, b) {
    return bookingRequestIdentity(a) === bookingRequestIdentity(b);
  }
  function bookingHoursLabel(result2) {
    if (!result2) return { hours: 0, label: "0h" };
    const total = roundHours(Number(result2.totalPaidHours) || 0);
    const standard = roundHours(Number(result2.standardHours) || 0);
    const outside = roundHours(Number(result2.outsideHours) || 0);
    const multiplier = roundHours(Number(result2.outsideMultiplier) || 1);
    if (outside > 0 && Math.abs(multiplier - 1) > 1e-3) {
      const parts = standard > 0 ? `${hoursText(standard)} + ${hoursText(outside)} \xD7 ${multiplier}` : `${hoursText(outside)} \xD7 ${multiplier}`;
      return { hours: total, label: `${hoursText(total)} (${parts})` };
    }
    return { hours: total, label: hoursText(total) };
  }

  // lib/canonical/payProfile.ts
  var PAY_PROFILES_COLLECTION = "payProfiles";
  var PAY_PROFILE_FIELDS = [
    "payBasis",
    "dayRate",
    "hourlyRate",
    "employmentType",
    "employmentTypeTransitionFrom",
    "employmentTypeEffectiveAt"
  ];
  function payProfilePath(organizationId, subjectId) {
    return `organizations/${String(organizationId || "").trim()}/${PAY_PROFILES_COLLECTION}/${String(subjectId || "").trim()}`;
  }
  function canViewPersonPay(viewer, subject, roster) {
    if (!viewer || !subject) return false;
    const viewerIds = new Set(personIdSet(viewer, roster).map(idKey2));
    if (viewerIds.size === 0) return false;
    if (viewer.isPlatformOwner === true) return true;
    const subjectIds = personIdSet(subject, roster).map(idKey2);
    if (subjectIds.some((id2) => viewerIds.has(id2))) return true;
    if (viewer.isActive === false) return false;
    const level = permissionLevelOf(viewer);
    if (level === "admin") return true;
    if (lineManagerIds(subject, roster).some((id2) => viewerIds.has(idKey2(id2)))) return true;
    return level === "manager" && effectivePermissions(viewer).operatives === true && permissionLevelOf(subject) === "operative";
  }
  function parsePayProfileDocument(docId, data) {
    const fields = {};
    for (const key3 of PAY_PROFILE_FIELDS) {
      if (data && Object.prototype.hasOwnProperty.call(data, key3)) fields[key3] = data[key3];
    }
    return { subjectId: String(docId || "").trim(), fields };
  }
  function overlayPayProfile(person, profile) {
    if (!profile) return person;
    const out = { ...person };
    for (const [key3, value] of Object.entries(profile.fields)) out[key3] = value;
    return out;
  }
  function payProfileWriteFieldsFromProfileWrite(subjectId, profileWrite) {
    const id2 = String(subjectId || "").trim();
    if (!id2 || !profileWrite) return null;
    const out = {};
    for (const key3 of PAY_PROFILE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(profileWrite, key3)) out[key3] = profileWrite[key3];
    }
    if (Object.keys(out).length === 0) return null;
    return { userId: id2, ...out };
  }
  function payProfileBackfillWrites(input) {
    const source = input.source || {};
    const profile = input.profile || {};
    const has = (data, key3) => Object.prototype.hasOwnProperty.call(data, key3);
    const set = {};
    for (const key3 of PAY_PROFILE_FIELDS) {
      if (has(source, key3) && !has(profile, key3)) set[key3] = source[key3];
    }
    const profileSet = Object.keys(set).length > 0 ? { userId: String(input.subjectId || "").trim(), ...set } : null;
    const sourceRemove = [];
    if (input.strip === true) {
      for (const key3 of PAY_PROFILE_FIELDS) {
        if (has(source, key3) && (has(profile, key3) || has(set, key3))) sourceRemove.push(key3);
      }
    }
    return { profileSet, sourceRemove };
  }

  // lib/canonical/emailChange.ts
  function normalizeEmailText(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  var EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function selfEmailChangeAction(input) {
    const stored = normalizeEmailText(input.storedEmail);
    const next = normalizeEmailText(input.nextEmail);
    if (!next || next === stored) return "unchanged";
    if (!EMAIL_SHAPE.test(next)) return "invalid";
    return "verifyBeforeUpdate";
  }
  var SELF_EMAIL_INVALID_MESSAGE = "Enter a valid email address.";
  function selfEmailChangeSentMessage(nextEmail) {
    const email = normalizeEmailText(nextEmail);
    return `We sent a link to ${email}. Open it to confirm, then sign in with ${email}. Until then you sign in with your current email.`;
  }
  function signInEmailSyncWrites(input) {
    const userId = String(input.userId || "").trim();
    const token = normalizeEmailText(input.tokenEmail);
    const stored = normalizeEmailText(input.storedEmail);
    if (!userId || !token || input.tokenEmailVerified !== true || token === stored) return null;
    const orgId = String(input.organizationId || "").trim();
    return {
      userFields: { email: token },
      claimSet: orgId ? { path: `organizations/${orgId}/userEmails/${token}`, fields: { userId } } : null,
      claimDelete: orgId && stored ? `organizations/${orgId}/userEmails/${stored}` : null
    };
  }

  // lib/canonical/materialOrderAccess.ts
  var MATERIAL_ORDER_TYPED_RECIPIENTS_MAX = 3;
  var MATERIAL_ORDER_SEND_REFUSED_MESSAGE = "Only admins and managers can send quotes and orders.";
  var MATERIAL_ORDER_TYPED_RECIPIENTS_MESSAGE = "Add at most 3 email addresses that are not saved on a wholesaler. Save a regular supplier as a wholesaler contact.";
  var MATERIAL_ORDER_NO_RECIPIENT_MESSAGE = "Choose a wholesaler contact or add an email address.";
  function canSendMaterialOrders(viewer) {
    if (!viewer || typeof viewer !== "object") return false;
    if ("level" in viewer) {
      const level = typeof viewer.level === "string" ? viewer.level.trim().toLowerCase() : "";
      return level === "admin" || level === "manager";
    }
    return isStaffAccount(viewer);
  }
  function normalizedEmail(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }
  function looksLikeEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
  function materialOrderRecipientCheck(input) {
    const saved = new Set((input?.savedContactEmails || []).map(normalizedEmail).filter(Boolean));
    const self = normalizedEmail(input?.senderEmail);
    const seen = /* @__PURE__ */ new Set();
    const savedOut = [];
    const typed = [];
    let includesSelf = false;
    for (const raw of input?.recipients || []) {
      const email = normalizedEmail(raw);
      if (!email || !looksLikeEmail(email)) {
        return { ok: false, reason: "invalid", message: "Every recipient must be a valid email address.", typed };
      }
      if (seen.has(email)) continue;
      seen.add(email);
      if (saved.has(email)) savedOut.push(email);
      else if (self && email === self) includesSelf = true;
      else typed.push(email);
    }
    if (typed.length > MATERIAL_ORDER_TYPED_RECIPIENTS_MAX) {
      return { ok: false, reason: "too_many_typed", message: MATERIAL_ORDER_TYPED_RECIPIENTS_MESSAGE, typed };
    }
    if (savedOut.length + typed.length === 0) {
      return { ok: false, reason: "none", message: MATERIAL_ORDER_NO_RECIPIENT_MESSAGE, typed };
    }
    return { ok: true, saved: savedOut, typed, self: includesSelf };
  }

  // lib/canonical/organizationDeletion.ts
  var DELETION_RESTORE_DAYS = 60;
  var DAY_MS = 24 * 60 * 60 * 1e3;
  var ORGANIZATION_DELETE_CONFIRMATION = "DELETE";
  var ORGANIZATION_DELETE_TITLE = "Delete organisation";
  var ORGANIZATION_DELETE_BODY = [
    "This deletes the organisation for everyone. Nobody can open it once you confirm.",
    "The subscription is cancelled at the end of the current billing period. Payments already made are not refunded.",
    `You can restore the organisation from this screen for ${DELETION_RESTORE_DAYS} days. After that every job, booking, timesheet, file and person in it is erased for good.`
  ];
  var ORGANIZATION_DELETE_SUPER_ADMIN_ONLY_MESSAGE = "Only the super admin can delete the organisation.";
  var ORGANIZATION_RESTORED_MESSAGE = "The organisation is restored.";
  var ACCOUNT_HANDOVER_REQUIRED_MESSAGE = "You are the super admin. Make another admin the super admin before you delete your account.";
  var ACCOUNT_DELETE_WITH_COMPANY_MESSAGE = "You are the only member of this organisation. Deleting your account also deletes the organisation. Type the company name and DELETE to confirm.";
  function text21(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function record8(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function deletionTimeMs(value) {
    if (value == null) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (typeof value === "object") {
      const row2 = value;
      if (typeof row2.getTime === "function") {
        const ms = row2.getTime();
        return Number.isFinite(ms) ? ms : null;
      }
      if (typeof row2.toMillis === "function") {
        const ms = row2.toMillis();
        return Number.isFinite(ms) ? ms : null;
      }
      const seconds = typeof row2.seconds === "number" ? row2.seconds : typeof row2._seconds === "number" ? row2._seconds : null;
      if (seconds != null) return seconds * 1e3 + (typeof row2.nanoseconds === "number" ? Math.floor(row2.nanoseconds / 1e6) : 0);
    }
    return null;
  }
  function parseOrganizationDeletion(org) {
    const raw = record8(record8(org).deletion);
    const status = text21(raw.status).toLowerCase();
    if (status !== "scheduled" && status !== "erased") return null;
    const requestedAtMs = deletionTimeMs(raw.requestedAt);
    const eraseAfterMs = deletionTimeMs(raw.eraseAfter) ?? (requestedAtMs == null ? null : requestedAtMs + DELETION_RESTORE_DAYS * DAY_MS);
    return {
      status,
      requestedAtMs,
      requestedBy: text21(raw.requestedBy),
      eraseAfterMs,
      restoreBy: text21(raw.restoreBy) === "platform_owner" ? "platform_owner" : "super_admin"
    };
  }
  function organizationDeletionState(org, now = Date.now()) {
    const deletion = parseOrganizationDeletion(org);
    if (!deletion) return { state: "active" };
    if (deletion.status === "erased") return { state: "erased", locked: true };
    return {
      state: "scheduled",
      locked: true,
      eraseAfterMs: deletion.eraseAfterMs,
      due: deletion.eraseAfterMs != null && now >= deletion.eraseAfterMs,
      restoreBy: deletion.restoreBy,
      requestedBy: deletion.requestedBy
    };
  }
  function organizationEraseDue(org, now = Date.now()) {
    const state = organizationDeletionState(org, now);
    return state.state === "scheduled" && state.due;
  }
  function organizationEraseDateLabel(eraseAfterMs, timeZone) {
    if (eraseAfterMs == null || !Number.isFinite(eraseAfterMs)) return "";
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: text21(timeZone) || "Europe/London"
      }).format(new Date(eraseAfterMs));
    } catch {
      return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" }).format(
        new Date(eraseAfterMs)
      );
    }
  }
  function organizationDeletedMessage(eraseAfterMs, timeZone) {
    const label = organizationEraseDateLabel(eraseAfterMs, timeZone);
    return label ? `This organisation has been deleted and will be erased on ${label}.` : "This organisation has been deleted and will be erased.";
  }
  function organizationDeletionWriteFields(input) {
    const at = Number.isFinite(input?.requestedAtMs) ? input.requestedAtMs : Date.now();
    return {
      deletion: {
        status: "scheduled",
        requestedAt: new Date(at),
        requestedBy: text21(input?.requestedBy),
        eraseAfter: new Date(at + DELETION_RESTORE_DAYS * DAY_MS),
        restoreBy: input?.restoreBy === "platform_owner" ? "platform_owner" : "super_admin"
      }
    };
  }
  function isOrganizationSuperAdmin(viewer, org) {
    const id2 = text21(viewer?.id);
    if (!id2) return false;
    const creator = text21(org?.creatorUserId);
    if (creator && creator.toLowerCase() === id2.toLowerCase()) return true;
    if (viewer?.isSuperAdmin !== true) return false;
    const orgId = text21(org?.id);
    const home = text21(viewer?.organizationId);
    const homeId = home.includes("/") ? home.split("/").filter(Boolean).pop() ?? "" : home;
    return !orgId || !homeId || homeId.toLowerCase() === orgId.toLowerCase();
  }
  function canRestoreOrganization(input) {
    const state = organizationDeletionState(input?.org, input?.now ?? Date.now());
    if (state.state !== "scheduled") return false;
    if (input.viewerIsPlatformOwner === true) return true;
    if (state.restoreBy !== "super_admin") return false;
    const org = record8(input.org);
    return isOrganizationSuperAdmin(input.viewer ?? null, { id: text21(org.id), creatorUserId: org.creatorUserId });
  }
  function organizationDeleteConfirmationError(input) {
    const name = text21(input?.organizationName).toLowerCase();
    if (!name || text21(input?.typedName).toLowerCase() !== name) return "Type the company name exactly as it is shown.";
    if (text21(input?.typedConfirmation) !== ORGANIZATION_DELETE_CONFIRMATION) return "Type DELETE to confirm.";
    return null;
  }
  function accountDeletionPath(viewer, roster, org) {
    if (!viewer || !text21(viewer.id) || !org) return "delete";
    if (organizationDeletionState(org).state !== "active") return "delete";
    if (!isOrganizationSuperAdmin(viewer, org)) return "delete";
    const rows3 = roster || [];
    const own = new Set(personIdSet(viewer, rows3).map((id2) => id2.toLowerCase()));
    const others = rows3.filter((row2) => {
      const id2 = text21(row2?.id).toLowerCase();
      if (!id2 || own.has(id2)) return false;
      return rosterSegment(row2) === "active";
    });
    return others.length > 0 ? "handover_required" : "delete_with_company";
  }
  function erasedOrganizationAuditFields(org, erasedAtMs) {
    const name = text21(record8(org).name);
    return { erasedAt: new Date(Number.isFinite(erasedAtMs) ? erasedAtMs : Date.now()), name };
  }
  var ERASED_ORGANIZATIONS_COLLECTION = "erasedOrganizations";

  // lib/canonical/bookingLeaveConflicts.ts
  var ANNUAL_LEAVE_BOOKED_LABEL = "Annual leave booked";
  var ANNUAL_LEAVE_REQUESTED_LABEL = "Annual leave requested";
  var BOOKING_CONFLICTS_HEADING = "Some selected days clash. Tick to confirm, or \u2715 to drop that day.";
  function holidayStatus(holiday) {
    const status = idKey2(holiday.status);
    if (status === "approved") return "approved";
    if (status === "pending") return "pending";
    if (status === "rejected") return null;
    if (status) return null;
    return holiday.approved === false ? null : "approved";
  }
  function leaveSlot(timeSlot) {
    const kind = leaveSlotKind(timeSlot);
    return kind === "AM" ? "AM" : kind === "PM" ? "PM" : "FULL DAY";
  }
  function bookingLeaveConflicts(input) {
    const holidays = (input?.holidays || []).filter(
      (holiday) => holiday && idText(holiday.startDayKey) && (idText(holiday.userId) || idText(holiday.operativeId))
    );
    if (holidays.length === 0) return [];
    const days = Array.from(new Set((input.dayKeys || []).map(idText).filter(Boolean))).sort();
    if (days.length === 0) return [];
    const windows = leaveHalfDayWindows(input.day);
    const booking = leaveComparableInterval(
      { timeSlot: input.timeSlot, workStartTime: input.workStartTime, workEndTime: input.workEndTime },
      input.day
    );
    const leaveWindow = (slot) => slot === "AM" ? windows.am : slot === "PM" ? windows.pm : windows.day;
    const overlaps = (slot) => {
      if (slot === "FULL DAY" || booking === null) return true;
      return intervalsOverlap(booking, leaveWindow(slot));
    };
    const people = (input.people || []).map((person, index) => {
      const given = typeof person === "string" ? { id: person } : person;
      const personId2 = idText(given?.id);
      if (!personId2) return null;
      const keys = new Set(
        [
          ...personIdSet(given, input.roster),
          idText(given.userId),
          ...(given.operativeIds || []).map(idText)
        ].map(idKey2).filter(Boolean)
      );
      return { personId: personId2, keys, index };
    }).filter((entry) => entry !== null);
    const best = /* @__PURE__ */ new Map();
    const rank = (row2) => (row2.status === "approved" ? 2 : 0) + (row2.leaveSlot === "FULL DAY" ? 1 : 0);
    for (const holiday of holidays) {
      const status = holidayStatus(holiday);
      if (!status) continue;
      const start = idText(holiday.startDayKey);
      const end = idText(holiday.endDayKey) || start;
      const slot = leaveSlot(holiday.timeSlot);
      if (!overlaps(slot)) continue;
      const holidayKeys = [idKey2(holiday.userId), idKey2(holiday.operativeId)].filter(Boolean);
      for (const person of people) {
        if (!holidayKeys.some((key3) => person.keys.has(key3))) continue;
        for (const dayKey of days) {
          if (dayKey < start || dayKey > end) continue;
          const row2 = {
            personId: person.personId,
            dayKey,
            kind: "annual_leave",
            leaveId: idText(holiday.id),
            leaveSlot: slot,
            status,
            label: status === "approved" ? ANNUAL_LEAVE_BOOKED_LABEL : ANNUAL_LEAVE_REQUESTED_LABEL,
            index: person.index
          };
          const key3 = `${idKey2(person.personId)}|${dayKey}`;
          const current = best.get(key3);
          if (!current || rank(row2) > rank(current)) best.set(key3, row2);
        }
      }
    }
    return [...best.values()].sort((a, b) => a.dayKey !== b.dayKey ? a.dayKey < b.dayKey ? -1 : 1 : a.index - b.index).map(({ index: _index, ...row2 }) => row2);
  }

  // lib/canonical/pushTokens.ts
  function text22(value) {
    return typeof value === "string" ? value.trim() : "";
  }
  function isPushTokenPlaceholderUserId(userId) {
    return isBookingUuid(text22(userId));
  }
  function pushTokenList(raw) {
    const list = Array.isArray(raw) ? raw : [raw];
    const out = [];
    for (const value of list) {
      const token = text22(value);
      if (token && !out.includes(token)) out.push(token);
    }
    return out;
  }
  function addedPushTokens(before, after) {
    const old = new Set(pushTokenList(before));
    return pushTokenList(after).filter((token) => !old.has(token));
  }
  function pushTokenOwnerWrites(token, ownerUid, holders) {
    const value = text22(token);
    const owner = text22(ownerUid);
    if (!value || !owner) return [];
    if (isPushTokenPlaceholderUserId(owner)) return [{ userId: owner, remove: [value] }];
    const out = [];
    const seen = /* @__PURE__ */ new Set();
    for (const holder of holders || []) {
      const id2 = text22(holder?.id);
      if (!id2 || id2 === owner || seen.has(id2)) continue;
      if (!pushTokenList(holder.pushTokens).includes(value)) continue;
      seen.add(id2);
      out.push({ userId: id2, remove: [value] });
    }
    return out;
  }
  function instantMs2(value) {
    if (value == null) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
    if (typeof value === "string") {
      const ms = Date.parse(value);
      return Number.isNaN(ms) ? 0 : ms;
    }
    if (typeof value === "object") {
      const row2 = value;
      if (typeof row2.toMillis === "function") return Number(row2.toMillis()) || 0;
      const seconds = Number(row2.seconds ?? row2._seconds);
      if (Number.isFinite(seconds)) return seconds * 1e3;
    }
    return 0;
  }
  function pushTokenDedupePlan(documents) {
    const docs = (documents || []).filter((doc) => doc && text22(doc.id));
    const holders = /* @__PURE__ */ new Map();
    for (const doc of docs) {
      if (isPushTokenPlaceholderUserId(doc.id)) continue;
      for (const token of pushTokenList(doc.pushTokens)) {
        const list = holders.get(token) ?? [];
        list.push(doc);
        holders.set(token, list);
      }
    }
    const keeper = /* @__PURE__ */ new Map();
    for (const [token, list] of holders) {
      const byTokenTime = list.some((doc) => instantMs2(doc.pushTokenUpdatedAt) > 0);
      let best = null;
      for (const doc of list) {
        const ms = byTokenTime ? instantMs2(doc.pushTokenUpdatedAt) : instantMs2(doc.updatedAt);
        if (!best || ms > best.ms) best = { id: text22(doc.id), ms };
      }
      if (best) keeper.set(token, best.id);
    }
    const out = [];
    for (const doc of docs) {
      const id2 = text22(doc.id);
      const remove = [];
      const keptOn = {};
      for (const token of pushTokenList(doc.pushTokens)) {
        const kept = keeper.get(token) ?? null;
        if (kept !== id2) {
          remove.push(token);
          keptOn[token] = kept;
        }
      }
      if (remove.length > 0) out.push({ userId: id2, remove, keptOn });
    }
    return out;
  }
  function pushTokensExcludingActor(recipientTokens, actorTokens) {
    const actor = new Set(pushTokenList(actorTokens));
    return pushTokenList(recipientTokens).filter((token) => !actor.has(token));
  }
  var PUSH_PAYLOAD_KEYS = ["notificationId", "type", "relatedId", "dayKey", "catalogue", "userId", "organizationId"];
  function pushPayloadFields(row2) {
    const source = row2 || {};
    const values = {
      notificationId: text22(source.notificationId) || text22(source.id),
      type: text22(source.type),
      relatedId: text22(source.relatedId),
      dayKey: /^\d{4}-\d{2}-\d{2}$/.test(text22(source.dayKey)) ? text22(source.dayKey) : "",
      catalogue: text22(source.catalogue) === "projects" || text22(source.catalogue) === "smallWorks" ? text22(source.catalogue) : "",
      userId: text22(source.userId),
      organizationId: text22(source.organizationId)
    };
    const out = {};
    for (const key3 of PUSH_PAYLOAD_KEYS) if (values[key3]) out[key3] = values[key3];
    return out;
  }
  function notificationOrganizationSwitch(input) {
    const row2 = text22(input?.rowOrganizationId);
    const open = text22(input?.openOrganizationId);
    if (!row2 || row2.toLowerCase() === open.toLowerCase()) return null;
    const member = (input.membershipIds || []).some((id2) => text22(id2).toLowerCase() === row2.toLowerCase());
    return member ? row2 : null;
  }
  return __toCommonJS(bundleEntry_exports);
})();
