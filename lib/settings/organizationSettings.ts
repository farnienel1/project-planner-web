import { doc, getDoc, getDocFromServer, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  parseNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/settings/notificationPreferences'
import { dayKey } from '@/lib/ios-parity/londonTime'
import { ianaTimeZoneForCountry } from '@/lib/orgTime/orgTimeZone'
import {
  DEFAULT_ANNUAL_LEAVE,
  DEFAULT_INVOICING,
  DEFAULT_MY_SCHEDULE,
  DEFAULT_PAYROLL_POLICY,
  DEFAULT_PAYMENT_RUN_DATE_RANGES,
  DEFAULT_WARNING_DETECTION,
  clampClashLookaheadDays,
  copyWarningDetection,
  excludedUnbookedUserIds,
  invoicingToFirestore,
  myScheduleOptionsToFirestore,
  parseAnnualLeaveDefaults,
  parseInvoicing,
  parseMyScheduleOptions,
  parsePayrollPolicy,
  parseWarningDetection,
  payrollPolicyToFirestore,
  resolveWarningDetectionRaw,
  warningDetectionEquals,
  warningDetectionFirestoreFields,
  warningDetectionLooksLikeFactoryDefault,
  warningDetectionToFirestore,
  type MyScheduleOptions,
  type OrgAnnualLeaveDefaults,
  type OrgInvoicingSettings,
  type OrgPayrollTimePolicy,
  type OrgWarningDetectionSettings,
  type PaymentRunDateRange,
  type WeekendPayrollSettings,
} from '@/lib/canonical/organizationSettings'

export type {
  MyScheduleOptions,
  OrgAnnualLeaveDefaults,
  OrgInvoicingSettings,
  OrgPayrollTimePolicy,
  OrgWarningDetectionSettings,
  PaymentRunDateRange,
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
  invoicingToFirestore,
  myScheduleOptionsToFirestore,
  parseAnnualLeaveDefaults,
  parseInvoicing,
  parseMyScheduleOptions,
  parsePayrollPolicy,
  parseWarningDetection,
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
  officeCity?: string
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
  payrollTimePolicy: OrgPayrollTimePolicy
  payrollTimePolicyPrior?: OrgPayrollTimePolicy | null
  payrollTimePolicyEffectiveFrom?: string | null
  annualLeaveDefaults: OrgAnnualLeaveDefaults
  warningDetection: OrgWarningDetectionSettings
  invoicing: OrgInvoicingSettings
  myScheduleOptions: MyScheduleOptions
  /** Company-wide material cut-off (also dual-written to the saving user's iOS prefs). */
  materialCutOff?: NotificationPreferences | null
}

/** iOS PayrollTimePolicyCatalog.policy(for:organization:) — prior rules before effectiveFrom. */
export function orgPayrollPolicyForDay(
  day: Date,
  current: OrgPayrollTimePolicy,
  prior?: OrgPayrollTimePolicy | null,
  effectiveFrom?: string | null,
  timeZone?: string
): OrgPayrollTimePolicy {
  if (!effectiveFrom || !prior) return current
  const key = dayKey(day, timeZone)
  if (key >= effectiveFrom) return current
  return prior
}

function parsePayrollEffectiveFrom(value: unknown): string | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim()
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    const parsed = (value as { toDate: () => Date }).toDate()
    if (!Number.isNaN(parsed.getTime())) return dayKey(parsed)
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    const seconds = Number((value as { seconds: unknown }).seconds)
    if (Number.isFinite(seconds)) return dayKey(new Date(seconds * 1000))
  }
  return null
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
  const data = snap.data()
  const settings = asSettingsRecord(data.settings) ?? {}
  const materialRaw =
    asSettingsRecord(settings.materialCutOff) ??
    asSettingsRecord(settings.notificationPreferences)
  const warningRaw = resolveWarningDetectionRaw(data.warningDetection, settings.warningDetection)
  return {
    id: snap.id,
    name: String(data.name ?? ''),
    countryCode: data.countryCode as string | undefined,
    currency: (data.currencyCode as string | undefined) || (data.currency as string | undefined),
    currencyCode: (data.currencyCode as string | undefined) || (settings.currencyCode as string | undefined),
    bankHolidayRegionId:
      (data.bankHolidayRegionId as string | undefined) ||
      (settings.bankHolidayRegionId as string | undefined) ||
      'GB-ENG-WLS',
    documentAbbreviation: data.documentAbbreviation as string | undefined,
    officeAddressLine1: data.officeAddressLine1 as string | undefined,
    officeCity: data.officeCity as string | undefined,
    officePostcode: data.officePostcode as string | undefined,
    creatorUserId: data.creatorUserId as string | undefined,
    companyLogoURL: data.companyLogoURL as string | undefined,
    officeAddress: data.officeAddress as OrganizationDetails['officeAddress'],
    payrollTimePolicy: parsePayrollPolicy(data.payrollTimePolicy as Record<string, unknown> | undefined),
    payrollTimePolicyPrior: data.payrollTimePolicyPrior
      ? parsePayrollPolicy(data.payrollTimePolicyPrior as Record<string, unknown>)
      : null,
    payrollTimePolicyEffectiveFrom: parsePayrollEffectiveFrom(data.payrollTimePolicyEffectiveFrom),
    annualLeaveDefaults: parseAnnualLeaveDefaults(data.annualLeaveDefaults as Record<string, unknown> | undefined),
    warningDetection: parseWarningDetection(warningRaw),
    invoicing: parseInvoicing(data.invoicing as Record<string, unknown> | undefined),
    myScheduleOptions: parseMyScheduleOptions(settings),
    materialCutOff: materialRaw ? parseNotificationPreferences(materialRaw) : null,
  }
}

export async function saveMaterialCutOffSettings(
  organizationId: string,
  prefs: NotificationPreferences
): Promise<void> {
  await updateDoc(doc(db, 'organizations', organizationId), {
    'settings.materialCutOff': {
      materialOrderCutOff: prefs.materialOrderCutOff,
      materialCutOffHour: prefs.materialCutOffHour,
      materialCutOffMinute: prefs.materialCutOffMinute,
      materialCutOffOnSaturday: prefs.materialCutOffOnSaturday,
      materialCutOffOnSunday: prefs.materialCutOffOnSunday,
    },
    updatedAt: Timestamp.now(),
  })
}

export async function savePayrollPolicy(organizationId: string, policy: OrgPayrollTimePolicy): Promise<void> {
  const existing = await loadOrganizationDetails(organizationId)
  const timeZone = ianaTimeZoneForCountry(existing?.countryCode)
  const payload: Record<string, unknown> = {
    payrollTimePolicy: payrollPolicyToFirestore(policy),
    payrollTimePolicyEffectiveFrom: dayKey(new Date(), timeZone),
    payrollTimePolicyScheduled: null,
    updatedAt: Timestamp.now(),
  }
  if (existing?.payrollTimePolicy) {
    payload.payrollTimePolicyPrior = payrollPolicyToFirestore(existing.payrollTimePolicy)
  }
  await updateDoc(doc(db, 'organizations', organizationId), payload)
}

export async function saveAnnualLeaveDefaults(organizationId: string, defaults: OrgAnnualLeaveDefaults): Promise<void> {
  await updateDoc(doc(db, 'organizations', organizationId), {
    annualLeaveDefaults: defaults,
    updatedAt: Timestamp.now(),
  })
}

/**
 * Bank holidays read `bankHolidayRegionId`. Country stays the company country
 * so a Scotland or England & Wales choice does not change the time zone.
 */
export async function saveOrganizationBankHolidayRegion(
  organizationId: string,
  bankHolidayRegionId: string
): Promise<void> {
  const regionId = bankHolidayRegionId.trim()
  await updateDoc(doc(db, 'organizations', organizationId), {
    bankHolidayRegionId: regionId,
    'settings.bankHolidayRegionId': regionId,
    updatedAt: Timestamp.now(),
  })
}

export async function saveWarningDetection(organizationId: string, settings: OrgWarningDetectionSettings): Promise<void> {
  const payload = warningDetectionToFirestore(settings)
  const ref = doc(db, 'organizations', organizationId)
  const fields: Record<string, unknown> = {
    ...warningDetectionFirestoreFields(settings),
    updatedAt: Timestamp.now(),
  }
  try {
    await updateDoc(ref, fields)
  } catch {
    // Dotted paths need an existing org document; merge the iOS top-level map if update is denied.
    await setDoc(
      ref,
      {
        warningDetection: payload,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    )
  }
}

export async function saveInvoicingSettings(organizationId: string, settings: OrgInvoicingSettings): Promise<void> {
  await updateDoc(doc(db, 'organizations', organizationId), {
    invoicing: invoicingToFirestore(settings),
    updatedAt: Timestamp.now(),
  })
}

export async function saveMyScheduleOptions(organizationId: string, options: MyScheduleOptions): Promise<void> {
  await updateDoc(doc(db, 'organizations', organizationId), {
    'settings.myScheduleOptions': myScheduleOptionsToFirestore(options),
    updatedAt: Timestamp.now(),
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

/** iOS MyScheduleOptions.enabledScheduleLocationPicks — Other locations in Book labour. */
export function enabledScheduleLocationPicks(options: MyScheduleOptions): ScheduleLocationPick[] {
  const rows: ScheduleLocationPick[] = []
  if (options.showOffice) rows.push({ id: 'office', title: 'Office', locationType: 'office' })
  if (options.showWorkingFromHome) {
    rows.push({ id: 'wfh', title: 'Working from home', locationType: 'working_from_home' })
  }
  if (options.showSiteSurvey) {
    rows.push({ id: 'survey', title: 'Site survey', locationType: 'site_survey' })
  }
  for (const raw of options.customItems ?? []) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    rows.push({
      id: `custom:${trimmed}`,
      title: trimmed,
      locationType: 'custom',
      customLocationName: trimmed,
    })
  }
  return rows
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
