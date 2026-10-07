import {
  DEFAULT_ANNUAL_LEAVE,
  DEFAULT_INVOICING,
  DEFAULT_MY_SCHEDULE,
  DEFAULT_PAYROLL_POLICY,
  DEFAULT_PAYMENT_RUN_DATE_RANGES,
  DEFAULT_WARNING_DETECTION,
  invoicingToFirestore,
  myScheduleOptionsToFirestore,
  payrollPolicyToFirestore,
  warningDetectionToFirestore,
  type MyScheduleOptions,
  type OrgAnnualLeaveDefaults,
  type OrgInvoicingSettings,
  type OrgPayrollTimePolicy,
  type OrgWarningDetectionSettings,
} from '@/lib/settings/organizationSettings'
import { BANK_HOLIDAY_REGIONS, bankHolidayRegionLabel } from '@/lib/settings/bankHolidayRegions'
import type { NotificationPreferences } from '@/lib/settings/notificationPreferences'

export type OrgOfficeAddress = {
  addressLine1: string
  addressLine2: string
  town: string
  county: string
  postcode: string
}

export type OrganisationIdentitySetup = {
  officeAddress: OrgOfficeAddress
  countryCode: string
  countryLabel: string
  currency: string
  /** Local file selected during setup — uploaded after org is created. */
  logoFile: File | null
  /** Set after upload completes. */
  companyLogoURL?: string
}

export type OrganisationFeaturesSetup = {
  payrollTimePolicy: OrgPayrollTimePolicy
  annualLeaveDefaults: OrgAnnualLeaveDefaults
  myScheduleOptions: MyScheduleOptions
  warningDetection: OrgWarningDetectionSettings
  notificationPreferences: NotificationPreferences
  invoicing: OrgInvoicingSettings
}

export type OrgSetupSettings = {
  identity: OrganisationIdentitySetup
  features: OrganisationFeaturesSetup
}

export const CURRENCY_OPTIONS = [
  { code: 'GBP', label: 'GBP — British Pound (£)' },
  { code: 'EUR', label: 'EUR — Euro (€)' },
  { code: 'USD', label: 'USD — US Dollar ($)' },
  { code: 'AUD', label: 'AUD — Australian Dollar (A$)' },
] as const

export const COUNTRY_OPTIONS = BANK_HOLIDAY_REGIONS

export { bankHolidayRegionLabel }

export const LOGO_MAX_BYTES = 10 * 1024 * 1024

export function createEmptyOfficeAddress(): OrgOfficeAddress {
  return {
    addressLine1: '',
    addressLine2: '',
    town: '',
    county: '',
    postcode: '',
  }
}

export function createDefaultIdentitySetup(): OrganisationIdentitySetup {
  return {
    officeAddress: createEmptyOfficeAddress(),
    countryCode: 'GB',
    countryLabel: 'United Kingdom',
    currency: 'GBP',
    logoFile: null,
  }
}

export function createDefaultFeaturesSetup(): OrganisationFeaturesSetup {
  return {
    payrollTimePolicy: {
      ...DEFAULT_PAYROLL_POLICY,
      saturday: { ...DEFAULT_PAYROLL_POLICY.saturday },
      sunday: { ...DEFAULT_PAYROLL_POLICY.sunday },
    },
    annualLeaveDefaults: { ...DEFAULT_ANNUAL_LEAVE },
    myScheduleOptions: { ...DEFAULT_MY_SCHEDULE, customItemEnabled: {} },
    warningDetection: { ...DEFAULT_WARNING_DETECTION, excludedUserIdsFromUnbookedWarnings: [] },
    notificationPreferences: {
      materialOrderCutOff: true,
      materialCutOffHour: 16,
      materialCutOffMinute: 0,
      materialCutOffOnSaturday: false,
      materialCutOffOnSunday: false,
    },
    invoicing: {
      ...DEFAULT_INVOICING,
      paymentRunDateRanges: DEFAULT_PAYMENT_RUN_DATE_RANGES.map((r) => ({ ...r })),
      paymentDates: [],
    },
  }
}

export function createDefaultOrgSetupSettings(): OrgSetupSettings {
  return {
    identity: createDefaultIdentitySetup(),
    features: createDefaultFeaturesSetup(),
  }
}

export const DEFAULT_BANK_HOLIDAY_REGION_ID = 'GB-ENG-WLS'

/** iOS stores a 1–3 character document prefix. */
export function normalizeDocumentAbbreviation(value: string | null | undefined): string | undefined {
  const cleaned = (value || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()
  return cleaned || undefined
}

/**
 * Bank-holiday region is not the company country. `GB-ENG` (older web picker) maps to iOS `GB-ENG-WLS`.
 * A missing choice stays England & Wales.
 */
export function bankHolidayRegionIdFromSelection(selection: string | null | undefined): string {
  const raw = (selection || '').trim().toUpperCase()
  if (!raw || raw === 'GB' || raw === 'GB-ENG' || raw === 'GB-WLS' || raw === 'GB-ENG-WLS') {
    return DEFAULT_BANK_HOLIDAY_REGION_ID
  }
  return raw
}

/** Value for the annual-leave region menu. England & Wales is stored as GB-ENG-WLS. */
export function bankHolidaySelectionFromStored(stored: string | null | undefined): string {
  const raw = (stored || '').trim().toUpperCase()
  if (!raw || raw === 'GB' || raw === 'GB-WLS' || raw === 'GB-ENG-WLS') return 'GB-ENG'
  return raw
}

export function countryCodeForCompany(selection: string | null | undefined, storedCountry?: string | null): string {
  const stored = (storedCountry || '').trim().toUpperCase()
  if (/^[A-Z]{2}$/.test(stored)) return stored
  const raw = (selection || '').trim().toUpperCase()
  if (raw.startsWith('GB')) return 'GB'
  if (/^[A-Z]{2}$/.test(raw)) return raw
  return 'GB'
}

/** Flat iOS company fields plus the nested address the web form still edits. */
export function companyIdentityFirestoreFields(input: {
  addressLine1?: string
  addressLine2?: string
  town?: string
  county?: string
  postcode?: string
  currency?: string
  companyLogoURL?: string | null
  documentAbbreviation?: string | null
  bankHolidayRegionId?: string | null
  countryCode?: string | null
  regionSelection?: string | null
}): Record<string, unknown> {
  const line1 = (input.addressLine1 || '').trim()
  const town = (input.town || '').trim()
  const postcode = (input.postcode || '').trim()
  const regionId = bankHolidayRegionIdFromSelection(input.bankHolidayRegionId || input.regionSelection)
  const currency = (input.currency || 'GBP').trim() || 'GBP'
  const abbreviation = normalizeDocumentAbbreviation(input.documentAbbreviation)
  const fields: Record<string, unknown> = {
    countryCode: countryCodeForCompany(input.regionSelection, input.countryCode),
    currency,
    currencyCode: currency,
    bankHolidayRegionId: regionId,
    officeAddressLine1: line1 || null,
    officeCity: town || null,
    officePostcode: postcode || null,
    officeAddress: line1
      ? {
          addressLine1: line1,
          addressLine2: (input.addressLine2 || '').trim() || null,
          town: town || null,
          county: (input.county || '').trim() || null,
          postcode: postcode || null,
        }
      : null,
  }
  if (input.companyLogoURL) fields.companyLogoURL = input.companyLogoURL
  if (abbreviation) fields.documentAbbreviation = abbreviation
  return fields
}

/** Fields written to organizations/{id} from guided setup. */
export function orgSetupSettingsToFirestoreFields(
  settings: OrgSetupSettings,
  creatorUserId: string
): Record<string, unknown> {
  const { identity, features } = settings
  return {
    creatorUserId,
    ...companyIdentityFirestoreFields({
      addressLine1: identity.officeAddress.addressLine1,
      addressLine2: identity.officeAddress.addressLine2,
      town: identity.officeAddress.town,
      county: identity.officeAddress.county,
      postcode: identity.officeAddress.postcode,
      currency: identity.currency,
      companyLogoURL: identity.companyLogoURL,
      countryCode: identity.countryCode,
      regionSelection: identity.countryCode,
    }),
    payrollTimePolicy: payrollPolicyToFirestore(features.payrollTimePolicy),
    annualLeaveDefaults: features.annualLeaveDefaults,
    warningDetection: warningDetectionToFirestore(features.warningDetection),
    invoicing: invoicingToFirestore(features.invoicing),
    settings: {
      myScheduleOptions: myScheduleOptionsToFirestore(features.myScheduleOptions),
      materialCutOff: features.notificationPreferences,
      currencyCode: identity.currency,
      bankHolidayRegionId: bankHolidayRegionIdFromSelection(identity.countryCode),
    },
  }
}

export function validateLogoFile(file: File): string | null {
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  const isImage =
    type.startsWith('image/') ||
    /\.(jpe?g|png)$/i.test(name)
  const isPdf = type === 'application/pdf' || name.endsWith('.pdf')
  if (!isImage && !isPdf) {
    return 'Logo must be a JPEG, PNG or PDF file.'
  }
  if (file.size > LOGO_MAX_BYTES) return 'Logo must be 10 MB or smaller.'
  return null
}

export function isLogoCropCandidate(file: File): boolean {
  const name = file.name.toLowerCase()
  const type = (file.type || '').toLowerCase()
  return (
    type.startsWith('image/') ||
    type === 'application/pdf' ||
    /\.(jpe?g|png|pdf)$/i.test(name)
  )
}
