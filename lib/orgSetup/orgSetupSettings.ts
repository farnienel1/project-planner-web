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
import {
  CURRENCY_OPTIONS as CANONICAL_CURRENCY_OPTIONS,
  DEFAULT_MATERIAL_CUT_OFF,
  companyDetailsWriteFields,
  normalizeDocumentAbbreviation as canonicalDocumentAbbreviation,
  organizationCurrencyWriteFields,
} from '@/lib/canonical'
import type { NotificationPreferences } from '@/lib/settings/notificationPreferences'
import { COMPANY_LOGO_MAX_BYTES, uploadLimitError } from '@/lib/security/uploadLimits'

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

/** The canonical organisation currencies (`lib/canonical/money.ts`, same list as iOS), with a picker label. */
export const CURRENCY_OPTIONS: ReadonlyArray<{ code: string; label: string }> = CANONICAL_CURRENCY_OPTIONS.map(
  (option) => ({ code: option.code, label: `${option.code} — ${option.title} (${option.symbol})` })
)

export const COUNTRY_OPTIONS = BANK_HOLIDAY_REGIONS

export { bankHolidayRegionLabel }

/** Must match storage.rules company logo write: sized(5 * 1024 * 1024). */
export const LOGO_MAX_BYTES = COMPANY_LOGO_MAX_BYTES

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
    notificationPreferences: { ...DEFAULT_MATERIAL_CUT_OFF },
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

/** iOS stores a 1–3 character document prefix (canonical `normalizeDocumentAbbreviation`). */
export function normalizeDocumentAbbreviation(value: string | null | undefined): string | undefined {
  return canonicalDocumentAbbreviation(value) || undefined
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

/**
 * Company fields for a new organisation document (guided setup, a full `setDoc`): the canonical flat
 * shape from `companyDetailsWriteFields` plus currency. No nested `officeAddress` map is written.
 */
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
  const regionId = bankHolidayRegionIdFromSelection(input.bankHolidayRegionId || input.regionSelection)
  const { set } = companyDetailsWriteFields({
    name: '',
    hasOfficeAddress: Boolean(line1 || town),
    officeAddressLine1: line1,
    officeAddressLine2: input.addressLine2,
    officeCity: town,
    officeCounty: input.county,
    officePostcode: input.postcode,
    countryCode: countryCodeForCompany(input.regionSelection, input.countryCode),
    documentAbbreviation: input.documentAbbreviation,
    companyLogoURL: input.companyLogoURL || undefined,
  })
  const currency = organizationCurrencyWriteFields(input.currency) ?? organizationCurrencyWriteFields('GBP')!
  // A full-document create: the dotted `settings.currencyCode` key belongs in the nested settings map.
  return {
    ...set,
    currency: currency.currency,
    currencyCode: currency.currencyCode,
    bankHolidayRegionId: regionId,
  }
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

type NamedFile = { name: string; type?: string; size: number }

export function validateLogoFile(file: NamedFile): string | null {
  return uploadLimitError(file, 'logo')
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
