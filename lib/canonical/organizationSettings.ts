/**
 * Organisation settings both apps must read and write the same way.
 * Screens stay in each app. Defaults, field names, and payment-run math
 * live here so a save on the web is the same document iOS decodes.
 */

import { CANONICAL_HALF_MONTH_RANGES, formatClockMinutes, normalizePaymentRunRange, standardDayWindow } from './engine'
import {
  parseTimesheetSubmissionList,
  timesheetSubmissionToFirestore,
  type TimesheetSubmissionSettings,
} from './timesheetSubmission'
import { scheduleOptionsWriteFields } from './scheduleOptions'
import {
  parsePaymentRunHistory,
  paymentRunHistoryToFirestore,
  type PaymentRunHistoryWindow,
} from './timesheetPeriod'

export type { TimesheetSubmissionSettings }
export type { PaymentRunHistoryWindow }

export type WeekendPayrollSettings = {
  allHoursAtMultiplierMode: boolean
  allHoursMultiplier: number
  definedWindowStart?: string
  definedWindowEnd?: string
  countsAsStandardHours?: number
  outsideWindowMultiplier?: number
  sameAsSaturday?: boolean
  /**
   * Rulebook 1.19.0 §4.3: whether that day's lunch break is paid. Missing = paid (every company saved before 1.19.0).
   * Sunday "same as Saturday" uses Saturday's.
   */
  breakPaid?: boolean
  /**
   * Rulebook 1.19.0 §4.3: that day's own break length (0–120 minutes) and window. Missing → the weekday break
   * (`unpaidBreakMinutes`, `breakWindowStart`–`breakWindowEnd`), so data saved before 1.19.0 reads unchanged
   * (`weekendBreakFor`).
   */
  breakMinutes?: number
  breakWindowStart?: string
  breakWindowEnd?: string
}

export type PaymentRunDateRange = {
  startDay: number
  endDay: number
}

export type OrgPayrollTimePolicy = {
  standardDayStart: string
  standardDayEnd: string
  unpaidBreakMinutes: number
  standardPaidHours: number
  breakWindowStart: string
  breakWindowEnd: string
  weekdayOutsideStandardMultiplier: number
  saturday: WeekendPayrollSettings
  sunday: WeekendPayrollSettings
  breakPaid?: boolean
  /**
   * Rulebook 1.20.0 §4.3: true on every policy saved from 1.20.0 on. The Monday–Friday paid day is then derived from
   * the day itself — finish − start − the unpaid break (`weekdayPaidHours`) — and `standardPaidHours` is written as that
   * value so older builds agree. 1.44.0 (owner decision 14 Nov, question A option 1): the weekday paid day is derived
   * for every policy, flag or not (`weekdayPaidHours`); the flag now only says which value was written to
   * `standardPaidHours`, which is kept and written as stored for older builds and never read for pay.
   */
  paidHoursDerived?: boolean
}

export type OrgAnnualLeaveDefaults = {
  daysPerYear: number
  startMonth: number
  endMonth: number
  carriesOver: boolean
  /**
   * Rulebook 1.13.0 §4.4 (Q4): most unused days carried into the next leave year. Null or missing = no cap
   * (every organisation saved before 1.13.0). The settings screens suggest `SUGGESTED_MAX_CARRY_OVER_DAYS`.
   */
  maxCarryOverDays?: number | null
}

/** The cap the settings screens suggest when carry-over is switched on (never applied unless saved). */
export const SUGGESTED_MAX_CARRY_OVER_DAYS = 5

/** A stored carry-over cap: a number 0–365 (snapped to half days), else null (no cap). */
export function parseMaxCarryOverDays(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'string' ? Number(value.trim()) : Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.min(365, Math.round(n * 2) / 2)
}

export type OrgWarningDetectionSettings = {
  detectClashes: boolean
  clashLookaheadMode: 'endOfWorkingWeek' | 'numberOfDays' | 'endOfInvoicingPeriod'
  clashLookaheadDays: number
  /** Warnings and Daily Overview. Weekend person-days are unbooked only when true. */
  includeWeekendsForUnbookedLabour: boolean
  /** `users/{uid}` ids never listed as unbooked on Warnings or Daily Overview. */
  excludedUserIdsFromUnbookedWarnings: string[]
  /**
   * Read-only notice from `parseWarningDetection`: "Set number of days" was saved without a usable N
   * (missing, not a number, or below 1), so 7 days is used. Never written to Firestore.
   */
  clashLookaheadDaysFallback?: 'lookaheadDaysMissing' | 'lookaheadDaysInvalid'
  /**
   * Rulebook 1.19.0 §4.6 / §5: `warningDetection.weekendCoverage` — per weekend day, whether it is scanned for unbooked
   * labour and the "Hours to cover" window. `start` / `end` null = the default window (`resolveWeekendCoverageDay`).
   * Missing in Firestore → each day enabled exactly when `includeWeekendsForUnbookedLabour` is on.
   */
  weekendCoverage?: WeekendCoverage
}

/** Rulebook 1.19.0: one weekend day's unbooked-labour requirement. */
export type WeekendCoverageDay = { enabled: boolean; start: string | null; end: string | null }
export type WeekendCoverage = { saturday: WeekendCoverageDay; sunday: WeekendCoverageDay }

export type OrgInvoicingSettings = {
  paymentRunMode: 'date_ranges' | 'recurring_timeframe'
  paymentDateMode: 'specific_dates' | 'recurring_date'
  recurringRunStartDay: string
  recurringRunEndDay: string
  recurringPaymentDay: string
  paymentRunDateRanges: PaymentRunDateRange[]
  paymentDates: string[]
  noteToUsers: string
  /** One block per date-range payment date, or one block for a recurring run. */
  timesheetSubmission: TimesheetSubmissionSettings[]
  /**
   * Snapshots of previous payment-run windows. A 1–7 run stays selectable on
   * timesheets after payroll becomes 1–15 or switches to recurring.
   */
  paymentRunHistory?: PaymentRunHistoryWindow[]
}

export type MyScheduleOptions = {
  showOffice: boolean
  showWorkingFromHome: boolean
  showSiteSurvey: boolean
  customItems: string[]
  customItemEnabled: Record<string, boolean>
}

export type MaterialCutOffSettings = {
  materialOrderCutOff: boolean
  materialCutOffHour: number
  materialCutOffMinute: number
  materialCutOffOnSaturday: boolean
  materialCutOffOnSunday: boolean
}

/**
 * Inputs for the organisation cut-off clock.
 * `users/{uid}.notificationPreferences.materialCutOffHour` is accepted only so
 * callers cannot treat it as the clock — those fields are ignored.
 */
export type MaterialCutOffClockSource = {
  /** `organizations/{orgId}.settings.materialCutOff` */
  organizationMaterialCutOff?: Record<string, unknown> | MaterialCutOffSettings | null
  /** Organisation `settings` map; reads `settings.materialCutOff`. */
  organizationSettings?: Record<string, unknown> | null
  /** User-doc leftover. Clock hour / minute / weekend flags here never win. */
  userNotificationPreferences?: Record<string, unknown> | null
}

/** Top-level keys on `organizations/{orgId}` both apps must keep. */
export const ORGANIZATION_DOCUMENT_FIELDS = [
  'name',
  'countryCode',
  'currency',
  'currencyCode',
  'bankHolidayRegionId',
  'documentAbbreviation',
  'officeAddressLine1',
  'officeAddressLine2',
  'officeCity',
  'officeCounty',
  'officePostcode',
  /** Legacy nested address. Read as a fallback; every company-details save removes it. */
  'officeAddress',
  'companyLogoURL',
  'defaultLatitude',
  'defaultLongitude',
  'creatorUserId',
  'members',
  'payrollTimePolicy',
  'payrollTimePolicyPrior',
  'payrollTimePolicyEffectiveFrom',
  'payrollTimePolicyScheduled',
  /** 1.19.0: append-only `{ effectiveFrom: 'YYYY-MM-DD', policy }[]`, the working hours in effect from each day. */
  'payrollTimePolicyHistory',
  /** 1.19.0: bumped by every working-hours save so a second admin's stale save is refused. */
  'payrollTimePolicyRevision',
  'annualLeaveDefaults',
  'warningDetection',
  'invoicing',
  'settings',
] as const

/**
 * Org-wide operational collections. Screens stay in each app; the path and
 * who may use the surface must match.
 */
export const OPERATIONAL_COLLECTION_PATHS = {
  variations: 'organizations/{orgId}/variations',
  variationTrackers: 'organizations/{orgId}/variationTrackers',
  variationLog: 'organizations/{orgId}/settings/variations_{parentId}',
  variationItem: 'organizations/{orgId}/settings/variationItem_{id}',
  bookings: 'organizations/{orgId}/bookings',
  holidayBookings: 'organizations/{orgId}/holidayBookings',
  timesheets: 'organizations/{orgId}/timesheets',
  dismissedWarnings: 'organizations/{orgId}/dismissedWarnings',
  projects: 'organizations/{orgId}/projects',
  smallWorks: 'organizations/{orgId}/smallWorks',
  clients: 'organizations/{orgId}/clients',
  tasks: 'organizations/{orgId}/tasks',
  siteAudits: 'organizations/{orgId}/siteAudits',
  materialCatalogue: 'organizations/{orgId}/materialCatalogue',
  materials: 'organizations/{orgId}/materials',
  materialSendRecords: 'organizations/{orgId}/materialSendRecords',
  qualifications: 'organizations/{orgId}/qualifications',
  healthSafetySettings: 'organizations/{orgId}/settings/healthSafety_{projects|smallWorks}_{parentId}',
  healthSafetyEvidence: 'organizations/{orgId}/healthSafety/{parentId}/variations/{file}',
  /** 1.29.0 (§25): PAYE overtime requests, approved lines and saved reports. */
  overtimeRequests: 'organizations/{orgId}/overtimeRequests',
  /** Document id `{userId}_{bookingId}` (`overtimeReviewDocId`). */
  overtimeReviews: 'organizations/{orgId}/overtimeReviews',
  overtimeReports: 'organizations/{orgId}/overtimeReports',
  /** 1.30.0 (§26): PAYE price work and expenses, their saved report copies, and personal site audits (owner only). */
  priceWorkItems: 'organizations/{orgId}/priceWorkItems',
  expenseItems: 'organizations/{orgId}/expenseItems',
  payeClaimReports: 'organizations/{orgId}/payeClaimReports',
  personalSiteAudits: 'organizations/{orgId}/personalSiteAudits',
  /** 1.40.0 (§4.4): manual annual-leave adjustments, written once (`annualLeaveAdjustmentCreateFields`). */
  annualLeaveAdjustments: 'organizations/{orgId}/annualLeaveAdjustments',
} as const

/**
 * Starter material catalogue writes.
 * Seed only when the collection has no documents. Never delete-all + rewrite.
 */
export function starterCollectionShouldSeed(existingDocumentCount: number): boolean {
  return existingDocumentCount === 0
}

/**
 * Qualification library writes. Merge any starter codes that are not already
 * document ids. A custom or guided-setup row must not block the library.
 * Never delete-all + rewrite.
 */
export function missingStarterQualificationCodes(
  existingDocumentIds: readonly string[],
  libraryCodes: readonly string[]
): string[] {
  const have = new Set(existingDocumentIds.map((id) => String(id || '').trim()).filter(Boolean))
  return libraryCodes.filter((code) => {
    const id = String(code || '').trim()
    return Boolean(id) && !have.has(id)
  })
}

/** A saved weekend day map that leaves a field out (iOS `OrgWeekendDayPayrollSettings.fromFirestore`). */
const WEEKEND_FIELD_FALLBACK: WeekendPayrollSettings = {
  allHoursAtMultiplierMode: false,
  allHoursMultiplier: 2,
  definedWindowStart: '07:30',
  definedWindowEnd: '16:00',
  countsAsStandardHours: 8,
  outsideWindowMultiplier: 1.5,
  sameAsSaturday: false,
  breakPaid: true,
}

/**
 * Saturday when the company never saved one (iOS `defaultSaturday`):
 * 07:30–13:00 counts as 8 hours, time outside it at 2×.
 */
export const DEFAULT_SATURDAY_PAYROLL: WeekendPayrollSettings = {
  allHoursAtMultiplierMode: false,
  allHoursMultiplier: 2,
  definedWindowStart: '07:30',
  definedWindowEnd: '13:00',
  countsAsStandardHours: 8,
  outsideWindowMultiplier: 2,
  sameAsSaturday: false,
  breakPaid: true,
}

/** Sunday when the company never saved one (iOS `defaultSunday`): every hour at 2×. */
export const DEFAULT_SUNDAY_PAYROLL: WeekendPayrollSettings = {
  allHoursAtMultiplierMode: true,
  allHoursMultiplier: 2,
  definedWindowStart: '07:30',
  definedWindowEnd: '16:00',
  countsAsStandardHours: 8,
  outsideWindowMultiplier: 2,
  sameAsSaturday: false,
  breakPaid: true,
}

export const DEFAULT_PAYROLL_POLICY: OrgPayrollTimePolicy = {
  standardDayStart: '07:30',
  standardDayEnd: '16:00',
  unpaidBreakMinutes: 30,
  standardPaidHours: 8,
  breakWindowStart: '12:00',
  breakWindowEnd: '12:30',
  weekdayOutsideStandardMultiplier: 1.5,
  saturday: { ...DEFAULT_SATURDAY_PAYROLL },
  sunday: { ...DEFAULT_SUNDAY_PAYROLL },
}

export const DEFAULT_PAYMENT_RUN_DATE_RANGES: PaymentRunDateRange[] = CANONICAL_HALF_MONTH_RANGES.map((range) => ({
  ...range,
}))

export const DEFAULT_ANNUAL_LEAVE: OrgAnnualLeaveDefaults = {
  daysPerYear: 25,
  startMonth: 1,
  endMonth: 12,
  carriesOver: false,
  maxCarryOverDays: null,
}

export const DEFAULT_WARNING_DETECTION: OrgWarningDetectionSettings = {
  detectClashes: true,
  clashLookaheadMode: 'numberOfDays',
  clashLookaheadDays: 7,
  includeWeekendsForUnbookedLabour: false,
  excludedUserIdsFromUnbookedWarnings: [],
}

export const DEFAULT_INVOICING: OrgInvoicingSettings = {
  paymentRunMode: 'date_ranges',
  paymentDateMode: 'specific_dates',
  recurringRunStartDay: 'monday',
  recurringRunEndDay: 'sunday',
  recurringPaymentDay: 'friday',
  paymentRunDateRanges: DEFAULT_PAYMENT_RUN_DATE_RANGES.map((range) => ({ ...range })),
  paymentDates: [],
  noteToUsers:
    "If your timesheet displays 0 against your rate, then your day/hourly rate hasn't been set by your line manager",
  timesheetSubmission: [],
  paymentRunHistory: [],
}

/**
 * Shared company name on `organizations/{orgId}`. Both apps write `name`.
 * Read prefers that field, then leftover aliases so a document that only has
 * an older key still displays — a save then stores `name` and does not invent
 * a second writer.
 */
export function parseOrganizationName(data: Record<string, unknown> | undefined): string {
  if (!data) return ''
  const settings = asSettingsRecord(data.settings)
  const candidates = [
    data.name,
    data.organizationName,
    data.organisationName,
    data.companyName,
    settings?.name,
    settings?.organizationName,
    settings?.organisationName,
    settings?.companyName,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

/**
 * Write the shared `name` field only when it has a value.
 * A blank must not persist — that is how Company details went empty after
 * a stub or the other company painted the form.
 */
export function organizationNameToFirestore(name: string): Record<string, unknown> {
  const trimmed = String(name || '').trim()
  return trimmed ? { name: trimmed } : {}
}

/**
 * Incoming blank omits `name` so a stub or the other company cannot persist
 * empty over a known company. `existingName` is the already-parsed value —
 * it stays in Firestore because this write does not touch the field.
 */
export function organizationNameWriteFields(
  nextName: string | null | undefined,
  existingName?: string | null
): Record<string, unknown> {
  const next = String(nextName || '').trim()
  if (next) return { name: next }
  void existingName
  return {}
}

/** First non-empty parsed or in-memory name. A stub `''` must not hide a known name. */
export function coalesceOrganizationName(
  ...candidates: Array<string | null | undefined>
): string {
  for (const value of candidates) {
    const trimmed = String(value || '').trim()
    if (trimmed) return trimmed
  }
  return ''
}

export function displayOrganizationName(name: string | null | undefined, fallback = 'Organisation'): string {
  const trimmed = String(name || '').trim()
  return trimmed || fallback
}

/** Days-covered 1–31 strip is date-range runs only. Recurring hides it by design. */
export function paymentRunShowsMonthCoverage(
  settings: Pick<OrgInvoicingSettings, 'paymentRunMode'>
): boolean {
  return settings.paymentRunMode === 'date_ranges'
}

function parsePaymentRunMode(value: unknown): OrgInvoicingSettings['paymentRunMode'] {
  return String(value || '').trim() === 'recurring_timeframe' ? 'recurring_timeframe' : 'date_ranges'
}

function parsePaymentDateMode(
  value: unknown,
  paymentRunMode: OrgInvoicingSettings['paymentRunMode']
): OrgInvoicingSettings['paymentDateMode'] {
  if (paymentRunMode === 'date_ranges') return 'specific_dates'
  return String(value || '').trim() === 'specific_dates' ? 'specific_dates' : 'recurring_date'
}

export const DEFAULT_MY_SCHEDULE: MyScheduleOptions = {
  showOffice: true,
  showWorkingFromHome: true,
  showSiteSurvey: true,
  customItems: [],
  customItemEnabled: {},
}

export const DEFAULT_MATERIAL_CUT_OFF: MaterialCutOffSettings = {
  materialOrderCutOff: true,
  materialCutOffHour: 16,
  materialCutOffMinute: 0,
  materialCutOffOnSaturday: false,
  materialCutOffOnSunday: false,
}

const MONTH_DAYS = 31

function firstPresent(data: Record<string, unknown>, keys: string[], fallback: unknown): unknown {
  for (const key of keys) {
    if (data[key] != null && data[key] !== '') return data[key]
  }
  return fallback
}

function asSettingsRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function parseDayOfMonth(value: unknown): number {
  const n = Number(value)
  if (Number.isInteger(n) && n >= 1 && n <= 31) return n
  return 0
}

function stringIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((id) => String(id).trim()).filter(Boolean)
}

/** A missing day map is that day's default; a saved map fills a missing field from `WEEKEND_FIELD_FALLBACK`. */
/** Limits for every platform (rulebook §4.3; `validatePayrollTimePolicy` on save, `parsePayrollPolicy` on read). */
export const PAYROLL_POLICY_LIMITS = {
  paidHours: { min: 1, max: 12 },
  breakMinutes: { min: 0, max: 120 },
  multiplier: { min: 1, max: 3 },
} as const

/**
 * Rulebook 1.12.0 §4.3: a stored policy number read into the limits. Missing, blank or not a number → the default;
 * otherwise clamped to `[min, max]`. `zeroIsMissing`: 0 or less also reads as missing (a standard paid day of 0
 * would multiply day-rate pay by up to 800×). `allowZero`: 0 is kept (weekend "counts as" 0 hours, §5).
 */
function policyNumber(
  raw: unknown,
  fallback: number,
  limits: { min: number; max: number },
  options: { zeroIsMissing?: boolean; allowZero?: boolean } = {}
): number {
  if (raw == null || (typeof raw === 'string' && raw.trim() === '') || typeof raw === 'boolean') return fallback
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  if (options.zeroIsMissing && n <= 0) return fallback
  if (options.allowZero && n === 0) return 0
  return Math.min(Math.max(n, limits.min), limits.max)
}

function parseWeekend(data: Record<string, unknown> | undefined, dayDefault: WeekendPayrollSettings): WeekendPayrollSettings {
  if (!data || typeof data !== 'object') return { ...dayDefault }
  const fallback = WEEKEND_FIELD_FALLBACK
  return {
    allHoursAtMultiplierMode: data.allHoursAtMultiplierMode === true,
    allHoursMultiplier: policyNumber(data.allHoursMultiplier, fallback.allHoursMultiplier, PAYROLL_POLICY_LIMITS.multiplier),
    definedWindowStart: String(
      firstPresent(data, ['customStandardStart', 'definedWindowStart'], fallback.definedWindowStart ?? '07:30')
    ),
    definedWindowEnd: String(
      firstPresent(data, ['customStandardEnd', 'definedWindowEnd'], fallback.definedWindowEnd ?? '16:00')
    ),
    countsAsStandardHours: policyNumber(
      firstPresent(data, ['countsAsHours', 'countsAsStandardHours'], fallback.countsAsStandardHours ?? 8),
      fallback.countsAsStandardHours ?? 8,
      PAYROLL_POLICY_LIMITS.paidHours,
      { allowZero: true }
    ),
    outsideWindowMultiplier: policyNumber(
      firstPresent(
        data,
        ['outsideStandardWindowMultiplier', 'outsideWindowMultiplier'],
        fallback.outsideWindowMultiplier ?? 1.5
      ),
      fallback.outsideWindowMultiplier ?? 1.5,
      PAYROLL_POLICY_LIMITS.multiplier
    ),
    sameAsSaturday: false,
    // 1.19.0: missing or anything but `false` = paid, so nothing changes for a company that never chose.
    breakPaid: data.breakPaid !== false,
    // 1.19.0: the day's own break; missing stays missing and reads as the weekday break.
    ...(data.breakMinutes == null || (typeof data.breakMinutes === 'string' && data.breakMinutes.trim() === '') || !Number.isFinite(Number(data.breakMinutes))
      ? {}
      : { breakMinutes: policyNumber(data.breakMinutes, 0, PAYROLL_POLICY_LIMITS.breakMinutes) }),
    ...(typeof data.breakWindowStart === 'string' && data.breakWindowStart.trim() ? { breakWindowStart: data.breakWindowStart.trim() } : {}),
    ...(typeof data.breakWindowEnd === 'string' && data.breakWindowEnd.trim() ? { breakWindowEnd: data.breakWindowEnd.trim() } : {}),
  }
}

/**
 * Rulebook 1.19.0 §4.3: a weekend day's lunch break — paid or not, its length and window, each missing field read as
 * the weekday break (`unpaidBreakMinutes`, `breakWindowStart`–`breakWindowEnd`). The one place that fallback lives.
 */
export function weekendBreakFor(
  policy: Pick<OrgPayrollTimePolicy, 'unpaidBreakMinutes' | 'breakWindowStart' | 'breakWindowEnd'>,
  weekend: WeekendPayrollSettings
): { paid: boolean; minutes: number; start: string; end: string } {
  const own = Number(weekend.breakMinutes)
  return {
    paid: weekend.breakPaid !== false,
    minutes: weekend.breakMinutes != null && Number.isFinite(own) ? Math.max(0, own) : Math.max(0, Number(policy.unpaidBreakMinutes) || 0),
    start: weekend.breakWindowStart || policy.breakWindowStart,
    end: weekend.breakWindowEnd || policy.breakWindowEnd,
  }
}

function weekendToFirestore(weekend: WeekendPayrollSettings): Record<string, unknown> {
  return {
    allHoursAtMultiplierMode: weekend.allHoursAtMultiplierMode,
    allHoursMultiplier: weekend.allHoursMultiplier,
    useCustomStandardDayWindow: !weekend.allHoursAtMultiplierMode,
    customStandardStart: weekend.definedWindowStart ?? '07:30',
    customStandardEnd: weekend.definedWindowEnd ?? '16:00',
    countsAsHours: weekend.countsAsStandardHours ?? 8,
    outsideStandardWindowMultiplier: weekend.outsideWindowMultiplier ?? 1.5,
    breakPaid: weekend.breakPaid !== false,
    // 1.19.0: written only when the day has its own break; missing reads as the weekday break.
    ...(weekend.breakMinutes != null ? { breakMinutes: weekend.breakMinutes } : {}),
    ...(weekend.breakWindowStart ? { breakWindowStart: weekend.breakWindowStart } : {}),
    ...(weekend.breakWindowEnd ? { breakWindowEnd: weekend.breakWindowEnd } : {}),
  }
}

export function parsePayrollPolicy(data: Record<string, unknown> | undefined): OrgPayrollTimePolicy {
  if (!data) {
    return { ...DEFAULT_PAYROLL_POLICY, saturday: { ...DEFAULT_SATURDAY_PAYROLL }, sunday: { ...DEFAULT_SUNDAY_PAYROLL } }
  }
  const parsed: OrgPayrollTimePolicy = {
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
    saturday: parseWeekend(data.saturday as Record<string, unknown> | undefined, DEFAULT_SATURDAY_PAYROLL),
    sunday: (() => {
      const sunday = parseWeekend(data.sunday as Record<string, unknown> | undefined, DEFAULT_SUNDAY_PAYROLL)
      const sunRaw = data.sunday as Record<string, unknown> | undefined
      const same =
        data.sundaySameAsSaturday === true ||
        (data.sundaySameAsSaturday == null && sunRaw?.sameAsSaturday === true)
      return { ...sunday, sameAsSaturday: same }
    })(),
    breakPaid: data.breakPaid === true,
  }
  // 1.20.0 §4.3: a policy saved from 1.20.0 on derives its weekday paid day from the day itself. 1.44.0: pay reads
  // `weekdayPaidHours` (derived for every policy); a policy without the flag keeps its stored `standardPaidHours` here
  // only so a rewrite of the prior / history writes it back as stored for older builds.
  if (data.paidHoursDerived !== true) return parsed
  const derived: OrgPayrollTimePolicy = { ...parsed, paidHoursDerived: true }
  return { ...derived, standardPaidHours: weekdayPaidHours(derived) }
}

/**
 * Rulebook 1.20.0 §4.3: the Monday–Friday paid day worked out from the day itself — finish − start, less the break when
 * it is unpaid (a paid break takes nothing off). 06:30–14:30 with a 45-minute unpaid break → 7.25. Not clamped (the
 * save check `validatePayrollTimePolicy` refuses anything outside 1–12). Invalid clock times read as the canonical
 * standard day (`standardDayWindow`).
 */
export function derivedWeekdayPaidHours(
  policy: Pick<OrgPayrollTimePolicy, 'standardDayStart' | 'standardDayEnd' | 'unpaidBreakMinutes' | 'breakPaid'>
): number {
  const day = standardDayWindow(policy)
  const breakMinutes = policy.breakPaid === true ? 0 : Math.max(Number(policy.unpaidBreakMinutes) || 0, 0)
  return Math.max(0, day.end - day.start - breakMinutes) / 60
}

/**
 * Rulebook 1.20.0 §4.3: the paid hours of a Monday–Friday full day — what FULL DAY pays, what a day rate is divided by,
 * the unbooked-labour day, the weekly-report day unit, invoices and Home. 1.44.0 (owner decision 14 Nov, question A
 * option 1): always `derivedWeekdayPaidHours` of the working hours passed — finish − start − the unpaid break — for
 * every policy, including the current, prior, scheduled and history policies saved before 1.20.0 without
 * `paidHoursDerived`. The stored `standardPaidHours` is never read here. Read into the 1–12 limits as every stored
 * number is since 1.12.0: a derived day outside them (only reachable from stored data the save check refuses) is
 * clamped to 1 or 12, never 0 or NaN. No policy → the default policy's day.
 */
export function weekdayPaidHours(
  policy: Pick<OrgPayrollTimePolicy, 'standardDayStart' | 'standardDayEnd' | 'unpaidBreakMinutes' | 'breakPaid'> | null | undefined
): number {
  if (!policy) return derivedWeekdayPaidHours(DEFAULT_PAYROLL_POLICY)
  const { min, max } = PAYROLL_POLICY_LIMITS.paidHours
  return Math.min(Math.max(derivedWeekdayPaidHours(policy), min), max)
}

/**
 * Rulebook 1.20.0 §4.3: the policy a 1.20.0 working-hours save writes — `paidHoursDerived: true` and `standardPaidHours`
 * set to the derived day (`derivedWeekdayPaidHours`) so older builds, which read `standardPaidHours`, agree. Every
 * write-fields function (`payrollTimePolicyApplyNowWriteFields`, `payrollTimePolicyScheduleWriteFields`) applies it to
 * the new policy; earlier policies (prior, history) are written as stored.
 */
export function withDerivedWeekdayPaidHours(policy: OrgPayrollTimePolicy): OrgPayrollTimePolicy {
  const marked: OrgPayrollTimePolicy = { ...policy, paidHoursDerived: true }
  return { ...marked, standardPaidHours: Math.round(derivedWeekdayPaidHours(marked) * 10000) / 10000 }
}

function hoursMinutesText(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}m`
}

export type WeekdayPaidDayPreview = {
  /** `HH:mm` of the standard day. */
  start: string
  end: string
  /** finish − start, in minutes. */
  dayMinutes: number
  breakMinutes: number
  breakPaid: boolean
  /** The derived paid day (`derivedWeekdayPaidHours`). */
  paidHours: number
  /** "06:30–14:30 = 8h − 45 min unpaid break = 7h15m"; paid break: "06:30–14:30 = 8h, 45 min break paid = 8h". */
  line: string
}

/**
 * Rulebook 1.20.0 §4.3: the live calculation shown under Monday–Friday in Working hours (web, iOS, setup wizard): the
 * day, its break and the paid hours it gives. "06:30–14:30 = 8h − 45 min unpaid break = 7h15m". With no break (0
 * minutes): "06:30–14:30 = 8h".
 */
export function weekdayPaidDayPreview(
  policy: Pick<OrgPayrollTimePolicy, 'standardDayStart' | 'standardDayEnd' | 'unpaidBreakMinutes' | 'breakPaid'>
): WeekdayPaidDayPreview {
  const day = standardDayWindow(policy)
  const dayMinutes = day.end - day.start
  const breakMinutes = Math.max(Number(policy.unpaidBreakMinutes) || 0, 0)
  const breakPaid = policy.breakPaid === true
  const paidHours = derivedWeekdayPaidHours(policy)
  const range = `${formatClockMinutes(day.start)}–${formatClockMinutes(day.end)}`
  const dayText = hoursMinutesText(dayMinutes)
  const line =
    breakMinutes <= 0
      ? `${range} = ${dayText}`
      : breakPaid
        ? `${range} = ${dayText}, ${breakMinutes} min break paid = ${dayText}`
        : `${range} = ${dayText} − ${breakMinutes} min unpaid break = ${hoursMinutesText(paidHours * 60)}`
  return { start: formatClockMinutes(day.start), end: formatClockMinutes(day.end), dayMinutes, breakMinutes, breakPaid, paidHours, line }
}

export function payrollPolicyToFirestore(policy: OrgPayrollTimePolicy): Record<string, unknown> {
  return {
    standardDayStart: policy.standardDayStart,
    standardDayEnd: policy.standardDayEnd,
    unpaidBreakMinutes: policy.unpaidBreakMinutes,
    // 1.20.0: a derived policy writes its derived day, so older builds that read `standardPaidHours` agree.
    standardPaidHours: policy.paidHoursDerived === true ? Math.round(derivedWeekdayPaidHours(policy) * 10000) / 10000 : policy.standardPaidHours,
    ...(policy.paidHoursDerived === true ? { paidHoursDerived: true } : {}),
    breakWindowStart: policy.breakWindowStart,
    breakWindowEnd: policy.breakWindowEnd,
    weekdayOutsideStandardMultiplier: policy.weekdayOutsideStandardMultiplier,
    saturday: weekendToFirestore(policy.saturday),
    sunday: weekendToFirestore({ ...policy.sunday, sameAsSaturday: false }),
    sundaySameAsSaturday: policy.sunday.sameAsSaturday === true,
    breakPaid: policy.breakPaid === true,
  }
}

/**
 * iOS `startDate`/`endDate` win when both pairs are present and disagree, so a
 * leftover web 1–16 cannot override a saved 1–15. Web-only `startDay`/`endDay`
 * (including a saved 1–16) are kept. Empty or missing ranges use 1–15 then 16–31.
 */
export function parsePaymentRunDateRanges(data: Record<string, unknown> | undefined): PaymentRunDateRange[] {
  const raw = data?.paymentRunDateRanges
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_PAYMENT_RUN_DATE_RANGES.map((range) => ({ ...range }))
  }
  const ranges = raw.slice(0, 2).map((entry) => {
    const normalized = normalizePaymentRunRange((entry || {}) as Record<string, unknown>)
    return normalized ?? { startDay: 0, endDay: 0 }
  })
  while (ranges.length < 2) ranges.push({ startDay: 0, endDay: 0 })
  return ranges
}

/** Every payment-run row iOS and web write must carry both field pairs. */
export function paymentRunRangeToFirestore(range: PaymentRunDateRange): Record<string, unknown> {
  return {
    startDay: range.startDay,
    endDay: range.endDay,
    startDate: range.startDay,
    endDate: range.endDay,
  }
}

export function parseAnnualLeaveDefaults(data: Record<string, unknown> | undefined): OrgAnnualLeaveDefaults {
  if (!data) return { ...DEFAULT_ANNUAL_LEAVE }
  return {
    daysPerYear: Number(data.daysPerYear ?? DEFAULT_ANNUAL_LEAVE.daysPerYear),
    startMonth: Number(data.startMonth ?? DEFAULT_ANNUAL_LEAVE.startMonth),
    endMonth: Number(data.endMonth ?? DEFAULT_ANNUAL_LEAVE.endMonth),
    carriesOver: Boolean(data.carriesOver),
    maxCarryOverDays: parseMaxCarryOverDays(data.maxCarryOverDays),
  }
}

export function copyWarningDetection(
  settings: OrgWarningDetectionSettings = DEFAULT_WARNING_DETECTION
): OrgWarningDetectionSettings {
  return {
    ...settings,
    excludedUserIdsFromUnbookedWarnings: [...(settings.excludedUserIdsFromUnbookedWarnings ?? [])],
    ...(settings.weekendCoverage
      ? { weekendCoverage: { saturday: { ...settings.weekendCoverage.saturday }, sunday: { ...settings.weekendCoverage.sunday } } }
      : {}),
  }
}

export function warningDetectionEquals(
  a: OrgWarningDetectionSettings,
  b: OrgWarningDetectionSettings
): boolean {
  return (
    a.detectClashes === b.detectClashes &&
    a.clashLookaheadMode === b.clashLookaheadMode &&
    a.clashLookaheadDays === b.clashLookaheadDays &&
    a.includeWeekendsForUnbookedLabour === b.includeWeekendsForUnbookedLabour &&
    (a.excludedUserIdsFromUnbookedWarnings ?? []).join('\0') ===
      (b.excludedUserIdsFromUnbookedWarnings ?? []).join('\0') &&
    JSON.stringify(a.weekendCoverage ?? parseWeekendCoverage(undefined, a.includeWeekendsForUnbookedLabour)) ===
      JSON.stringify(b.weekendCoverage ?? parseWeekendCoverage(undefined, b.includeWeekendsForUnbookedLabour))
  )
}

export function warningDetectionLooksLikeFactoryDefault(settings: OrgWarningDetectionSettings): boolean {
  return warningDetectionEquals(settings, {
    ...DEFAULT_WARNING_DETECTION,
    excludedUserIdsFromUnbookedWarnings: [],
  })
}

export function clampClashLookaheadDays(value: unknown): number {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>
    if (rec.integerValue != null) return clampClashLookaheadDays(rec.integerValue)
    if (rec.doubleValue != null) return clampClashLookaheadDays(rec.doubleValue)
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_WARNING_DETECTION.clashLookaheadDays
  return Math.max(1, Math.min(365, Math.round(n)))
}

function parseClashLookaheadMode(value: unknown): OrgWarningDetectionSettings['clashLookaheadMode'] {
  const mode = String(value || '').trim()
  if (mode === 'numberOfDays' || mode === 'days') return 'numberOfDays'
  if (mode === 'endOfInvoicingPeriod' || mode === 'invoicing') return 'endOfInvoicingPeriod'
  if (mode === 'endOfWorkingWeek' || mode === 'week') return 'endOfWorkingWeek'
  return DEFAULT_WARNING_DETECTION.clashLookaheadMode
}

export function resolveWarningDetectionRaw(topLevel: unknown, nested: unknown): Record<string, unknown> | undefined {
  const top = asSettingsRecord(topLevel)
  const nestedRec = asSettingsRecord(nested)
  if (!top && !nestedRec) return undefined
  if (!top) return nestedRec
  const merged: Record<string, unknown> = { ...top }
  if (top.excludedUserIdsFromUnbookedWarnings == null && nestedRec) {
    const nestedIds = nestedRec.excludedUserIdsFromUnbookedWarnings
    if (Array.isArray(nestedIds) && nestedIds.length > 0) {
      merged.excludedUserIdsFromUnbookedWarnings = nestedIds
    }
  }
  return merged
}

export function excludedUnbookedUserIds(record: Record<string, unknown>): string[] {
  if (Array.isArray(record.excludedUserIdsFromUnbookedWarnings)) {
    return stringIdList(record.excludedUserIdsFromUnbookedWarnings)
  }
  for (const key of ['excludedUserIds', 'excludedUsers', 'excludedUserIdsFromWarnings', 'unbookedWarningExcludedUserIds']) {
    if (Array.isArray(record[key])) return stringIdList(record[key])
  }
  return []
}

export function parseWarningDetection(data: Record<string, unknown> | undefined): OrgWarningDetectionSettings {
  const record = asSettingsRecord(data)
  if (!record) return { ...DEFAULT_WARNING_DETECTION, excludedUserIdsFromUnbookedWarnings: [] }
  const daysRaw =
    record.clashLookaheadDays ??
    record.lookaheadDays ??
    record.lookAheadDays ??
    record.numberOfDays ??
    record.daysAhead
  const days =
    daysRaw === undefined || daysRaw === null ? DEFAULT_WARNING_DETECTION.clashLookaheadDays : daysRaw
  const clashLookaheadMode = parseClashLookaheadMode(
    record.clashLookaheadMode ?? record.lookAheadMode ?? record.lookaheadMode
  )
  const fallback = lookaheadDaysFallback(daysRaw)
  const parsed: OrgWarningDetectionSettings = {
    detectClashes: record.detectClashes !== false,
    clashLookaheadMode,
    clashLookaheadDays: fallback ? DEFAULT_WARNING_DETECTION.clashLookaheadDays : clampClashLookaheadDays(days),
    includeWeekendsForUnbookedLabour: Boolean(record.includeWeekendsForUnbookedLabour),
    excludedUserIdsFromUnbookedWarnings: excludedUnbookedUserIds(record),
    weekendCoverage: parseWeekendCoverage(record.weekendCoverage, Boolean(record.includeWeekendsForUnbookedLabour)),
  }
  if (fallback && clashLookaheadMode === 'numberOfDays') parsed.clashLookaheadDaysFallback = fallback
  return parsed
}

const COVERAGE_CLOCK_RE = /^\d{1,2}:\d{2}$/

function clockMinutesOf(value: unknown): number | null {
  const text = coverageClock(value)
  if (!text) return null
  const [h, m] = text.split(':').map(Number)
  return h * 60 + m
}

function coverageClock(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!COVERAGE_CLOCK_RE.test(text)) return null
  const [h, m] = text.split(':').map(Number)
  return h >= 0 && h < 24 && m >= 0 && m < 60 ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : null
}

/**
 * Rulebook 1.19.0: `warningDetection.weekendCoverage` read. Missing day or `enabled` → `includeWeekends` (so an
 * organisation saved before 1.19.0 behaves as before); a missing or invalid window, or one whose end is not after
 * its start, is null (the default window, `resolveWeekendCoverageDay`).
 */
export function parseWeekendCoverage(value: unknown, includeWeekends: boolean): WeekendCoverage {
  const raw = asSettingsRecord(value) ?? {}
  const day = (entry: unknown): WeekendCoverageDay => {
    const rec = asSettingsRecord(entry) ?? {}
    let start = coverageClock(rec.start)
    let end = coverageClock(rec.end)
    if (start && end && (clockMinutesOf(end) as number) <= (clockMinutesOf(start) as number)) {
      start = null
      end = null
    }
    return { enabled: typeof rec.enabled === 'boolean' ? rec.enabled : includeWeekends, start: start && end ? start : null, end: start && end ? end : null }
  }
  return { saturday: day(raw.saturday), sunday: day(raw.sunday) }
}

/**
 * Rulebook 1.19.0 §5: a weekend day's unbooked-labour requirement on a day — scanned or not, and the window that must
 * be covered: the saved "Hours to cover", else that day's working-hours set window (`saturday` / `sunday`, Sunday
 * "same as Saturday" → Saturday's), else the standard day. `policy` is the policy in effect that day.
 * Include weekends off → never scanned.
 */
export function resolveWeekendCoverageDay(
  coverage: Partial<WeekendCoverage> | null | undefined,
  includeWeekends: boolean,
  policy: Pick<OrgPayrollTimePolicy, 'standardDayStart' | 'standardDayEnd' | 'saturday' | 'sunday'> | null | undefined,
  weekday: 'saturday' | 'sunday'
): { enabled: boolean; start: string; end: string } {
  const saved = coverage?.[weekday]
  const enabled = includeWeekends && (saved ? saved.enabled !== false : true)
  const fallbackDay = { start: policy?.standardDayStart || '07:30', end: policy?.standardDayEnd || '16:00' }
  let window = fallbackDay
  if (policy) {
    const rule = weekday === 'sunday' && policy.sunday?.sameAsSaturday ? policy.saturday : policy[weekday]
    const ws = clockMinutesOf(rule?.definedWindowStart)
    const we = clockMinutesOf(rule?.definedWindowEnd)
    if (rule && !rule.allHoursAtMultiplierMode && ws != null && we != null && we > ws) {
      window = { start: coverageClock(rule.definedWindowStart) as string, end: coverageClock(rule.definedWindowEnd) as string }
    }
  }
  const ss = clockMinutesOf(saved?.start)
  const se = clockMinutesOf(saved?.end)
  if (ss != null && se != null && se > ss) window = { start: saved!.start as string, end: saved!.end as string }
  return { enabled, ...window }
}

/** A saved days value that cannot be used: missing, blank, not a number, or below 1. */
function lookaheadDaysFallback(raw: unknown): OrgWarningDetectionSettings['clashLookaheadDaysFallback'] {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) return 'lookaheadDaysMissing'
  let value: unknown = raw
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>
    value = rec.integerValue ?? rec.doubleValue
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || Math.round(n) < 1) return 'lookaheadDaysInvalid'
  return undefined
}

export function warningDetectionToFirestore(settings: OrgWarningDetectionSettings): Record<string, unknown> {
  return {
    detectClashes: settings.detectClashes,
    clashLookaheadMode: settings.clashLookaheadMode,
    clashLookaheadDays: clampClashLookaheadDays(settings.clashLookaheadDays),
    includeWeekendsForUnbookedLabour: settings.includeWeekendsForUnbookedLabour,
    excludedUserIdsFromUnbookedWarnings: settings.excludedUserIdsFromUnbookedWarnings,
    // 1.19.0: the whole map, one field (`warningDetection.weekendCoverage`) in the partial update.
    ...(settings.weekendCoverage
      ? {
          weekendCoverage: {
            saturday: { ...settings.weekendCoverage.saturday },
            sunday: { ...settings.weekendCoverage.sunday },
          },
        }
      : {}),
  }
}

export function warningDetectionFirestoreFields(settings: OrgWarningDetectionSettings): Record<string, unknown> {
  const payload = warningDetectionToFirestore(settings)
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    fields[`warningDetection.${key}`] = value
  }
  return fields
}

export function parseInvoicing(data: Record<string, unknown> | undefined): OrgInvoicingSettings {
  if (!data) {
    return {
      ...DEFAULT_INVOICING,
      paymentRunDateRanges: DEFAULT_PAYMENT_RUN_DATE_RANGES.map((range) => ({ ...range })),
    }
  }
  const paymentRunMode = parsePaymentRunMode(data.paymentRunMode)
  const paymentDateMode = parsePaymentDateMode(data.paymentDateMode, paymentRunMode)
  const paymentDates = Array.isArray(data.paymentDates)
    ? (data.paymentDates as unknown[])
        .map((d) => String(parseDayOfMonth(d) || Number(d) || ''))
        .filter(Boolean)
    : []

  const timesheetSubmission = parseTimesheetSubmissionList({
    paymentRunMode,
    paymentDates,
    recurringPaymentDay: String(data.recurringPaymentDay ?? DEFAULT_INVOICING.recurringPaymentDay),
    timesheetSubmission: data.timesheetSubmission,
    paymentRunDateRanges: data.paymentRunDateRanges,
    invoicingRoot: data,
  })

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
    paymentRunHistory: parsePaymentRunHistory(data.paymentRunHistory),
  }
}

export function capitalizeWeekday(day: string): string {
  if (!day) return day
  return day.charAt(0).toUpperCase() + day.slice(1)
}

export function invoicingToFirestore(settings: OrgInvoicingSettings): Record<string, unknown> {
  const timesheetSubmission = settings.timesheetSubmission.map(timesheetSubmissionToFirestore)
  const payload: Record<string, unknown> = {
    paymentRunMode: settings.paymentRunMode,
    paymentDateMode: settings.paymentDateMode,
    paymentRunDateRanges: settings.paymentRunDateRanges.map((range, index) => {
      const row = paymentRunRangeToFirestore(range)
      const timesheet = timesheetSubmission[index]
      return timesheet ? { ...row, ...timesheet } : row
    }),
    paymentDates: settings.paymentDates.map((d) => Number(d)),
    noteToUsers: settings.noteToUsers,
    recurringPaymentRunSummary: `In arrears: ${capitalizeWeekday(settings.recurringRunStartDay)} to ${capitalizeWeekday(settings.recurringRunEndDay)} (of the previous week)`,
    recurringRunStartDay: settings.recurringRunStartDay,
    recurringRunEndDay: settings.recurringRunEndDay,
    recurringPaymentDay: settings.recurringPaymentDay,
    timesheetSubmission,
    paymentRunHistory: paymentRunHistoryToFirestore(settings.paymentRunHistory ?? []),
  }
  if (settings.paymentRunMode === 'recurring_timeframe' && timesheetSubmission[0]) {
    const recurring = timesheetSubmission[0]
    payload.timesheetDeadlineWeekday = recurring.timesheetDeadlineWeekday
    payload.timesheetDeadlineHour = recurring.timesheetDeadlineHour
    payload.timesheetDeadlineMinute = recurring.timesheetDeadlineMinute
    payload.notifyWeekday = recurring.notifyWeekday
    payload.notifyHour = recurring.notifyHour
    payload.notifyMinute = recurring.notifyMinute
    payload.notifyCustomised = recurring.notifyCustomised
  }
  return payload
}

export function parseMyScheduleOptions(settings: Record<string, unknown> | undefined): MyScheduleOptions {
  const raw = (settings?.myScheduleOptions as Record<string, unknown> | undefined) ?? settings
  if (!raw) return { ...DEFAULT_MY_SCHEDULE, customItemEnabled: {} }
  const customItems = Array.isArray(raw.customItems) ? (raw.customItems as string[]) : []
  const enabledRaw = (raw.customItemEnabled as Record<string, boolean> | undefined) ?? {}
  const customItemEnabled = customItems.reduce<Record<string, boolean>>((acc, item) => {
    acc[item] = enabledRaw[item] ?? true
    return acc
  }, {})
  return {
    showOffice: raw.showOffice !== false,
    showWorkingFromHome: raw.showWorkingFromHome !== false,
    showSiteSurvey: raw.showSiteSurvey !== false,
    customItems,
    customItemEnabled,
  }
}

/** Exactly the list given, de-duplicated case-insensitively (`scheduleOptionsWriteFields`). */
export function myScheduleOptionsToFirestore(options: MyScheduleOptions): Record<string, unknown> {
  return scheduleOptionsWriteFields(options)
}

function cutOffClockNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (value == null || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

/**
 * Parse `organizations/{orgId}.settings.materialCutOff`.
 * A missing hour defaults to 16. A saved 15 and 30 stay 15:30.
 * This is the only cut-off clock — do not read the user-pref hour.
 */
export function parseMaterialCutOff(
  data: Record<string, unknown> | MaterialCutOffSettings | undefined | null
): MaterialCutOffSettings {
  const raw = asSettingsRecord(data)
  if (!raw) return { ...DEFAULT_MATERIAL_CUT_OFF }
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
    materialCutOffOnSunday: raw.materialCutOffOnSunday === true,
  }
}

/**
 * Organisation `settings.materialCutOff` is the only cut-off clock.
 * User `notificationPreferences.materialCutOffHour` is never consulted.
 */
export function resolveMaterialCutOffClock(input: MaterialCutOffClockSource = {}): MaterialCutOffSettings {
  const settings = asSettingsRecord(input.organizationSettings)
  const fromOrg =
    asSettingsRecord(input.organizationMaterialCutOff) ??
    (settings ? asSettingsRecord(settings.materialCutOff) : undefined)
  return parseMaterialCutOff(fromOrg)
}

export function materialCutOffClockMinutes(clock: MaterialCutOffSettings): number {
  return clock.materialCutOffHour * 60 + clock.materialCutOffMinute
}

export function formatMaterialCutOffClock(clock: MaterialCutOffSettings): string {
  return formatClockMinutes(materialCutOffClockMinutes(clock))
}

export function materialCutOffToFirestore(prefs: MaterialCutOffSettings): Record<string, unknown> {
  return {
    materialOrderCutOff: prefs.materialOrderCutOff,
    materialCutOffHour: prefs.materialCutOffHour,
    materialCutOffMinute: prefs.materialCutOffMinute,
    materialCutOffOnSaturday: prefs.materialCutOffOnSaturday,
    materialCutOffOnSunday: prefs.materialCutOffOnSunday,
  }
}

/**
 * Run 1 of a date-range split must end by the 27th. Ending on the 28th or later would leave
 * run 2 empty in a short month. Run 2 ending on the 31st means the last day of every month.
 */
export const PAYMENT_RUN_1_LAST_END_DAY = 27

function isValidDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= MONTH_DAYS
}

export function paymentRunModeChange(
  current: OrgInvoicingSettings,
  mode: OrgInvoicingSettings['paymentRunMode']
): Partial<OrgInvoicingSettings> {
  if (mode === current.paymentRunMode) return {}
  if (mode === 'recurring_timeframe') {
    return { paymentRunMode: mode, paymentDateMode: 'recurring_date' }
  }
  return {
    paymentRunMode: mode,
    paymentDateMode: 'specific_dates',
    paymentRunDateRanges:
      current.paymentRunDateRanges.length >= 2
        ? current.paymentRunDateRanges
        : DEFAULT_PAYMENT_RUN_DATE_RANGES.map((range) => ({ ...range })),
    paymentDates: current.paymentDates.length >= 2 ? current.paymentDates : ['', ''],
  }
}

export function validatePaymentRunDateRanges(ranges: PaymentRunDateRange[]): string | null {
  if (ranges.length < 2) {
    return 'Set two payment run date ranges that together cover every day of the month.'
  }
  const [run1, run2] = ranges
  if (!isValidDay(run1.startDay) || !isValidDay(run1.endDay)) {
    return 'Payment run 1 needs a start and end day (1–31).'
  }
  if (!isValidDay(run2.startDay) || !isValidDay(run2.endDay)) {
    return 'Payment run 2 needs a start and end day (1–31).'
  }
  if (run1.startDay > run1.endDay) return 'Payment run 1: start day must be on or before end day.'
  if (run2.startDay > run2.endDay) return 'Payment run 2: start day must be on or before end day.'
  if (run1.startDay !== 1) return 'Payment run 1 must start on day 1 of the month.'
  if (run1.endDay >= PAYMENT_RUN_1_LAST_END_DAY + 1) {
    return `Payment run 1 must end on or before the ${PAYMENT_RUN_1_LAST_END_DAY}th, so run 2 exists in every month (February can have 28 days).`
  }
  if (run2.endDay !== MONTH_DAYS) {
    return `Payment run 2 must end on day ${MONTH_DAYS} so all days of the month are covered.`
  }
  if (run2.startDay !== run1.endDay + 1) {
    return 'Payment runs must not overlap — run 2 should start the day after run 1 ends (e.g. 1–15 then 16–31).'
  }
  const covered = new Set<number>()
  for (const range of ranges) {
    for (let day = range.startDay; day <= range.endDay; day += 1) {
      if (covered.has(day)) {
        return 'Payment run date ranges overlap. Each day of the month must belong to exactly one run.'
      }
      covered.add(day)
    }
  }
  if (covered.size !== MONTH_DAYS) {
    return `All ${MONTH_DAYS} days of the month must be covered across your payment runs.`
  }
  return null
}

export function validatePaymentDates(paymentDates: number[], expectedCount: number): string | null {
  if (paymentDates.length < expectedCount) {
    return `Set ${expectedCount} payment date${expectedCount === 1 ? '' : 's'} — one for each payment run.`
  }
  for (let i = 0; i < expectedCount; i += 1) {
    if (!isValidDay(paymentDates[i])) {
      return `Payment date ${i + 1} must be a day of the month (1–31).`
    }
  }
  return null
}

export function validateInvoicingSettings(settings: OrgInvoicingSettings): string | null {
  if (settings.paymentRunMode === 'date_ranges') {
    const rangeError = validatePaymentRunDateRanges(settings.paymentRunDateRanges)
    if (rangeError) return rangeError
    if (settings.paymentDateMode !== 'specific_dates') {
      return 'Choose payment date/s when using payment run date ranges.'
    }
    const paymentDays = settings.paymentDates
      .map((d) => Number(d))
      .filter((d) => Number.isFinite(d) && d > 0)
    return validatePaymentDates(paymentDays, 2)
  }
  if (settings.paymentRunMode === 'recurring_timeframe') {
    if (!settings.recurringRunStartDay || !settings.recurringRunEndDay) {
      return 'Choose a start day and end day for your recurring payment run.'
    }
    if (settings.paymentDateMode === 'recurring_date' && !settings.recurringPaymentDay) {
      return 'Choose a recurring payment date.'
    }
    if (settings.paymentDateMode === 'specific_dates') {
      const paymentDays = settings.paymentDates
        .map((d) => Number(d))
        .filter((d) => Number.isFinite(d) && d > 0)
      if (paymentDays.length < 1) return 'Set at least one payment date.'
      for (const day of paymentDays) {
        if (!isValidDay(day)) return 'Each payment date must be a day of the month (1–31).'
      }
    }
  }
  return null
}
