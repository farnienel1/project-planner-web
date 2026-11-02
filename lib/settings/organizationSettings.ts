import { doc, getDoc, getDocFromServer, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { serverTimestamp } from 'firebase/firestore'
import { writeMetadataFields } from '@/lib/canonical'
import { type NotificationPreferences } from '@/lib/settings/notificationPreferences'
import { dayKey } from '@/lib/ios-parity/londonTime'
import {
  companyDetailsWriteFields,
  enabledScheduleLocations,
  organizationCurrencyWriteFields,
  organizationTimeZone,
  parseCompanyDetails,
  payrollTimePolicyApplyNowWriteFields,
  payrollTimePolicyCancelScheduleWriteFields,
  payrollTimePolicyForDayFromState,
  payrollTimePolicyScheduleWriteFields,
  payrollTimePolicyTimeline,
  parsePayrollTimePolicyState,
  paymentRunHistoryAfterChange,
  type CompanyDetailsInput,
  type PayrollTimePolicyScheduledChange,
} from '@/lib/canonical'
import { deleteField, type DocumentData } from 'firebase/firestore'
import {
  DEFAULT_ANNUAL_LEAVE,
  DEFAULT_INVOICING,
  DEFAULT_MY_SCHEDULE,
  DEFAULT_PAYROLL_POLICY,
  DEFAULT_PAYMENT_RUN_DATE_RANGES,
  DEFAULT_WARNING_DETECTION,
  clampClashLookaheadDays,
  copyWarningDetection,
  coalesceOrganizationName,
  displayOrganizationName,
  excludedUnbookedUserIds,
  invoicingToFirestore,
  myScheduleOptionsToFirestore,
  organizationNameToFirestore,
  organizationNameWriteFields,
  parseAnnualLeaveDefaults,
  parseInvoicing,
  materialCutOffToFirestore,
  parseMaterialCutOff,
  parseMyScheduleOptions,
  parseOrganizationName,
  parsePayrollPolicy,
  parseWarningDetection,
  paymentRunShowsMonthCoverage,
  payrollPolicyToFirestore,
  resolveWarningDetectionRaw,
  warningDetectionEquals,
  warningDetectionFirestoreFields,
  warningDetectionLooksLikeFactoryDefault,
  warningDetectionToFirestore,
  type MyScheduleOptions,
  type OrgAnnualLeaveDefaults,
  type OrgInvoicingSettings,
  type MaterialCutOffSettings,
  type OrgPayrollTimePolicy,
  type OrgWarningDetectionSettings,
  type PaymentRunDateRange,
  type TimesheetSubmissionSettings,
  type WeekendPayrollSettings,
} from '@/lib/canonical/organizationSettings'

export type {
  MaterialCutOffSettings,
  MyScheduleOptions,
  OrgAnnualLeaveDefaults,
  OrgInvoicingSettings,
  OrgPayrollTimePolicy,
  OrgWarningDetectionSettings,
  PaymentRunDateRange,
  TimesheetSubmissionSettings,
  WeekendPayrollSettings,
}

export {
  DEFAULT_ANNUAL_LEAVE,
  DEFAULT_INVOICING,
  DEFAULT_MY_SCHEDULE,
  DEFAULT_PAYROLL_POLICY,
  DEFAULT_PAYMENT_RUN_DATE_RANGES,
  DEFAULT_WARNING_DETECTION,
  clampClashLookaheadDays,
  copyWarningDetection,
  excludedUnbookedUserIds,
  coalesceOrganizationName,
  displayOrganizationName,
  invoicingToFirestore,
  myScheduleOptionsToFirestore,
  organizationNameToFirestore,
  organizationNameWriteFields,
  parseAnnualLeaveDefaults,
  parseInvoicing,
  parseMyScheduleOptions,
  parseOrganizationName,
  parsePayrollPolicy,
  parseWarningDetection,
  paymentRunShowsMonthCoverage,
  payrollPolicyToFirestore,
  resolveWarningDetectionRaw,
  warningDetectionEquals,
  warningDetectionFirestoreFields,
  warningDetectionLooksLikeFactoryDefault,
  warningDetectionToFirestore,
}

export type OrganizationDetails = {
  id: string
  name: string
  countryCode?: string
  currency?: string
  currencyCode?: string
  bankHolidayRegionId?: string
  documentAbbreviation?: string
  officeAddressLine1?: string
  officeAddressLine2?: string
  officeCity?: string
  officeCounty?: string
  officePostcode?: string
  creatorUserId?: string
  companyLogoURL?: string
  officeAddress?: {
    addressLine1?: string
    addressLine2?: string
    town?: string
    county?: string
    postcode?: string
  }
  /**
   * Working hours in effect today (organisation zone). A scheduled change whose day has arrived is
   * already promoted here (`payrollTimePolicyTimeline`), so "today" screens read this directly.
   */
  payrollTimePolicy: OrgPayrollTimePolicy
  payrollTimePolicyPrior?: OrgPayrollTimePolicy | null
  payrollTimePolicyEffectiveFrom?: string | null
  /** A future working-hours change still pending (`{ policy, effectiveFrom }`). */
  payrollTimePolicyScheduled?: PayrollTimePolicyScheduledChange | null
  annualLeaveDefaults: OrgAnnualLeaveDefaults
  warningDetection: OrgWarningDetectionSettings
  invoicing: OrgInvoicingSettings
  myScheduleOptions: MyScheduleOptions
  /** Company-wide material cut-off. Organisation map is the only clock. */
  materialCutOff: MaterialCutOffSettings
}

/**
 * Working hours in effect on `day` (canonical `effectivePayrollTimePolicy`): a scheduled change from
 * its day on, the prior rules before `effectiveFrom`, otherwise the current rules.
 */
export function orgPayrollPolicyForDay(
  day: Date,
  current: OrgPayrollTimePolicy,
  prior?: OrgPayrollTimePolicy | null,
  effectiveFrom?: string | null,
  timeZone?: string,
  scheduled?: PayrollTimePolicyScheduledChange | null
): OrgPayrollTimePolicy {
  return payrollTimePolicyForDayFromState(
    { current, prior: prior ?? null, effectiveFrom: effectiveFrom ?? null, scheduled: scheduled ?? null },
    dayKey(day, timeZone)
  )
}

export function asSettingsRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/** iOS MyScheduleOptions.includesManagerScheduleLocation — project/small work always count. */
export function includesManagerScheduleLocation(
  options: MyScheduleOptions,
  booking: { locationType: string; customLocationName?: string }
): boolean {
  switch (booking.locationType) {
    case 'project':
    case 'small_work':
      return true
    case 'office':
      return options.showOffice
    case 'working_from_home':
      return options.showWorkingFromHome
    case 'site_survey':
      return options.showSiteSurvey
    case 'custom': {
      const name = booking.customLocationName?.trim() || ''
      if (!name) return false
      return options.customItems.some((item) => item.trim().toLowerCase() === name.toLowerCase())
    }
    default:
      return true
  }
}

/** Today's organisation-zone day key for an organisation document. */
export function organizationTodayKey(data: Record<string, unknown> | null | undefined, now: Date = new Date()): string {
  const country = typeof data?.countryCode === 'string' ? data.countryCode : null
  return dayKey(now, organizationTimeZone(country))
}

/**
 * Parse an `organizations/{orgId}` document (from `getDoc` or the live `useOrganizationDocument`
 * listener). Pure — every settings screen reads through this so the live and one-off paths match.
 */
export function organizationDetailsFromData(
  id: string,
  data: Record<string, unknown>,
  now: Date = new Date()
): OrganizationDetails {
  const settings = asSettingsRecord(data.settings) ?? {}
  const materialRaw =
    asSettingsRecord(settings.materialCutOff) ??
    asSettingsRecord(settings.notificationPreferences)
  const warningRaw = resolveWarningDetectionRaw(data.warningDetection, settings.warningDetection)
  const company = parseCompanyDetails(data)
  const timeZone = organizationTimeZone(company.countryCode)
  const payroll = payrollTimePolicyTimeline(
    parsePayrollTimePolicyState(data, timeZone),
    dayKey(now, timeZone),
    timeZone
  )
  return {
    id,
    name: parseOrganizationName(data),
    countryCode: data.countryCode as string | undefined,
    currency: (data.currencyCode as string | undefined) || (data.currency as string | undefined),
    currencyCode: (data.currencyCode as string | undefined) || (settings.currencyCode as string | undefined),
    bankHolidayRegionId: company.bankHolidayRegionId,
    documentAbbreviation: company.documentAbbreviation || undefined,
    officeAddressLine1: company.officeAddressLine1 || undefined,
    officeAddressLine2: company.officeAddressLine2 || undefined,
    officeCity: company.officeCity || undefined,
    officeCounty: company.officeCounty || undefined,
    officePostcode: company.officePostcode || undefined,
    creatorUserId: data.creatorUserId as string | undefined,
    companyLogoURL: company.companyLogoURL || undefined,
    officeAddress: data.officeAddress as OrganizationDetails['officeAddress'],
    payrollTimePolicy: payroll.current,
    payrollTimePolicyPrior: payroll.prior,
    payrollTimePolicyEffectiveFrom: payroll.effectiveFrom,
    payrollTimePolicyScheduled: payroll.scheduled,
    annualLeaveDefaults: parseAnnualLeaveDefaults(data.annualLeaveDefaults as Record<string, unknown> | undefined),
    warningDetection: parseWarningDetection(warningRaw),
    invoicing: parseInvoicing(data.invoicing as Record<string, unknown> | undefined),
    myScheduleOptions: parseMyScheduleOptions(settings),
    materialCutOff: parseMaterialCutOff(materialRaw),
  }
}

export async function loadOrganizationDetails(
  organizationId: string,
  options?: { fromServer?: boolean; allowCacheFallback?: boolean }
): Promise<OrganizationDetails | null> {
  const ref = doc(db, 'organizations', organizationId)
  const snap = options?.fromServer
    ? options.allowCacheFallback === false
      ? await getDocFromServer(ref)
      : await getDocFromServer(ref).catch(() => getDoc(ref))
    : await getDoc(ref)
  if (!snap.exists()) return null
  return organizationDetailsFromData(snap.id, snap.data())
}

function settingsWriteMetadata(userId?: string): Record<string, unknown> {
  return { ...(writeMetadataFields(userId, 'web') ?? {}), updatedAt: serverTimestamp() }
}

async function readOrganizationData(organizationId: string): Promise<DocumentData> {
  const ref = doc(db, 'organizations', organizationId)
  const snap = await getDocFromServer(ref).catch(() => getDoc(ref))
  if (!snap.exists()) throw new Error('Organisation not found.')
  return snap.data()
}

/** Organisation `settings.materialCutOff` only — never copied into `users/{uid}.notificationPreferences`. */
export async function saveMaterialCutOffSettings(
  organizationId: string,
  prefs: NotificationPreferences,
  userId?: string
): Promise<void> {
  await updateDoc(doc(db, 'organizations', organizationId), {
    'settings.materialCutOff': materialCutOffToFirestore(prefs),
    ...settingsWriteMetadata(userId),
  })
}

/**
 * "Apply from today" (`payrollTimePolicyApplyNowWriteFields`). Reads the stored document first so
 * prior rules and a pending iOS-scheduled change are kept; a future scheduled change is not cancelled.
 */
export async function savePayrollPolicy(
  organizationId: string,
  policy: OrgPayrollTimePolicy,
  userId?: string
): Promise<void> {
  const data = await readOrganizationData(organizationId)
  const timeZone = organizationTimeZone(typeof data.countryCode === 'string' ? data.countryCode : null)
  await updateDoc(doc(db, 'organizations', organizationId), {
    ...payrollTimePolicyApplyNowWriteFields({
      orgDoc: data,
      policy,
      todayKey: dayKey(new Date(), timeZone),
      timeZone,
    }),
    ...settingsWriteMetadata(userId),
  })
}

/** "Schedule from a date" (`payrollTimePolicyScheduleWriteFields`). `effectiveFrom` is an org-zone day key. */
export async function schedulePayrollPolicyChange(
  organizationId: string,
  policy: OrgPayrollTimePolicy,
  effectiveFrom: string,
  userId?: string
): Promise<void> {
  const data = await readOrganizationData(organizationId)
  const timeZone = organizationTimeZone(typeof data.countryCode === 'string' ? data.countryCode : null)
  const fields = payrollTimePolicyScheduleWriteFields({
    orgDoc: data,
    policy,
    effectiveFrom,
    todayKey: dayKey(new Date(), timeZone),
    timeZone,
  })
  if (!fields) throw new Error('Choose a date after today for the scheduled change.')
  await updateDoc(doc(db, 'organizations', organizationId), { ...fields, ...settingsWriteMetadata(userId) })
}

export async function cancelScheduledPayrollPolicyChange(organizationId: string, userId?: string): Promise<void> {
  const data = await readOrganizationData(organizationId)
  const timeZone = organizationTimeZone(typeof data.countryCode === 'string' ? data.countryCode : null)
  await updateDoc(doc(db, 'organizations', organizationId), {
    ...payrollTimePolicyCancelScheduleWriteFields({ orgDoc: data, todayKey: dayKey(new Date(), timeZone), timeZone }),
    ...settingsWriteMetadata(userId),
  })
}

/**
 * Annual leave defaults and the bank-holiday region in one update, so a failure cannot leave one
 * saved without the other. Country stays the company country, so a Scotland or England & Wales
 * choice does not change the time zone.
 */
export async function saveAnnualLeaveSettings(
  organizationId: string,
  defaults: OrgAnnualLeaveDefaults,
  bankHolidayRegionId: string,
  userId?: string
): Promise<void> {
  const regionId = bankHolidayRegionId.trim()
  await updateDoc(doc(db, 'organizations', organizationId), {
    annualLeaveDefaults: defaults,
    ...(regionId ? { bankHolidayRegionId: regionId, 'settings.bankHolidayRegionId': regionId } : {}),
    ...settingsWriteMetadata(userId),
  })
}

/**
 * Company details (`companyDetailsWriteFields`) plus the currency (`organizationCurrencyWriteFields`)
 * as one partial update. Blank optional fields and the legacy nested `officeAddress` map are deleted.
 */
export async function saveCompanyDetails(
  organizationId: string,
  input: CompanyDetailsInput,
  currencyCode: string | null,
  userId?: string
): Promise<void> {
  const { set, remove } = companyDetailsWriteFields(input)
  const payload: Record<string, unknown> = { ...set }
  for (const path of remove) payload[path] = deleteField()
  const currency = currencyCode ? organizationCurrencyWriteFields(currencyCode) : null
  if (currency) Object.assign(payload, currency)
  await updateDoc(doc(db, 'organizations', organizationId), { ...payload, ...settingsWriteMetadata(userId) })
}

/**
 * Warning detection from a live `organizations/{orgId}` document (top-level `warningDetection`, with
 * `settings.warningDetection` filling a missing excluded list). The same parse `loadOrganizationDetails` uses.
 */
export function warningDetectionFromOrganizationData(
  data: Record<string, unknown> | null | undefined
): OrgWarningDetectionSettings {
  const settings = asSettingsRecord(data?.settings) ?? {}
  return parseWarningDetection(resolveWarningDetectionRaw(data?.warningDetection, settings.warningDetection))
}

/**
 * Saves only the warning detection keys, as dotted fields, with `updatedBy` / `updatedFrom` / `updatedAt`.
 * Firebase is the only source: no browser copy is written back over a server value.
 */
export async function saveWarningDetection(
  organizationId: string,
  settings: OrgWarningDetectionSettings,
  updatedByUserId?: string
): Promise<void> {
  const payload = warningDetectionToFirestore(settings)
  const ref = doc(db, 'organizations', organizationId)
  const metadata = writeMetadataFields(updatedByUserId, 'web') ?? {}
  const fields: Record<string, unknown> = {
    ...warningDetectionFirestoreFields(settings),
    ...metadata,
    updatedAt: serverTimestamp(),
  }
  try {
    await updateDoc(ref, fields)
  } catch {
    // Dotted paths need an existing org document; merge the iOS top-level map if update is denied.
    await setDoc(
      ref,
      {
        warningDetection: payload,
        ...metadata,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
  }
}

export async function saveInvoicingSettings(
  organizationId: string,
  settings: OrgInvoicingSettings,
  userId?: string
): Promise<void> {
  const ref = doc(db, 'organizations', organizationId)
  const data = await readOrganizationData(organizationId)
  const existing = asSettingsRecord(data.invoicing) ?? {}
  const previous = parseInvoicing(existing)
  const recordedAtDayKey = organizationTodayKey(data)
  const paymentRunHistory = paymentRunHistoryAfterChange({
    previous: {
      paymentRunMode: previous.paymentRunMode,
      ranges: previous.paymentRunDateRanges,
      recurringRunStartDay: previous.recurringRunStartDay,
      recurringRunEndDay: previous.recurringRunEndDay,
    },
    next: {
      paymentRunMode: settings.paymentRunMode,
      ranges: settings.paymentRunDateRanges,
      recurringRunStartDay: settings.recurringRunStartDay,
      recurringRunEndDay: settings.recurringRunEndDay,
    },
    existingHistory: settings.paymentRunHistory ?? previous.paymentRunHistory ?? [],
    recordedAtDayKey,
  })
  // Dotted keys: invoicing fields this screen does not own are left as stored.
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(invoicingToFirestore({ ...settings, paymentRunHistory }))) {
    fields[`invoicing.${key}`] = value
  }
  await updateDoc(ref, { ...fields, ...settingsWriteMetadata(userId) })
}

/** Writes exactly this list (`scheduleOptionsWriteFields`) — never merged with the stored list. */
export async function saveMyScheduleOptions(
  organizationId: string,
  options: MyScheduleOptions,
  userId?: string
): Promise<void> {
  await updateDoc(doc(db, 'organizations', organizationId), {
    'settings.myScheduleOptions': myScheduleOptionsToFirestore(options),
    ...settingsWriteMetadata(userId),
  })
}

export function capitalizeDay(day: string): string {
  if (!day) return day
  return day.charAt(0).toUpperCase() + day.slice(1)
}

export const WEEKDAY_OPTIONS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const

export function formatPayrollSubtitle(policy: OrgPayrollTimePolicy): string {
  return `${policy.standardDayStart}–${policy.standardDayEnd} · ${policy.standardPaidHours}h · weekday OT ${policy.weekdayOutsideStandardMultiplier}x`
}

export function formatAnnualLeaveSubtitle(defaults: OrgAnnualLeaveDefaults, months: string[]): string {
  const start = months[defaults.startMonth - 1] ?? 'Jan'
  const end = months[defaults.endMonth - 1] ?? 'Dec'
  return `${defaults.daysPerYear} days · ${start}→${end} · ${defaults.carriesOver ? 'carry over' : 'no carry over'}`
}

export function formatScheduleOptionsSubtitle(options: MyScheduleOptions): string {
  const count =
    Number(options.showOffice) + Number(options.showWorkingFromHome) + Number(options.showSiteSurvey) + options.customItems.length
  return `${count} location option${count === 1 ? '' : 's'} in My Schedule`
}

export type ScheduleLocationPick = {
  id: string
  title: string
  locationType: import('@/lib/scheduling/managerSiteBookingUtils').ManagerLocationType
  customLocationName?: string
}

/** Other locations in Book labour / My Schedule (canonical `enabledScheduleLocations`, honours `customItemEnabled`). */
export function enabledScheduleLocationPicks(options: MyScheduleOptions): ScheduleLocationPick[] {
  return enabledScheduleLocations(options).map((row) => ({ ...row }))
}

/** One-off Other location for this booking only. Not written into organisation defaults. */
export function oneOffCustomLocationPick(name: string): ScheduleLocationPick | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  return {
    id: `custom:${trimmed}`,
    title: trimmed,
    locationType: 'custom',
    customLocationName: trimmed,
  }
}

export function formatInvoicingSubtitle(invoicing: OrgInvoicingSettings): string {
  if (invoicing.paymentRunMode === 'recurring_timeframe') {
    return `Recurring: ${capitalizeDay(invoicing.recurringRunStartDay)}–${capitalizeDay(invoicing.recurringRunEndDay)}`
  }
  const count = invoicing.paymentRunDateRanges.length
  if (count === 0) return 'Payment runs & timesheet periods'
  return `${count} custom payment run period${count === 1 ? '' : 's'}`
}
