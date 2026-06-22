import {
  DEFAULT_ANNUAL_LEAVE,
  DEFAULT_INVOICING,
  DEFAULT_MY_SCHEDULE,
  DEFAULT_PAYROLL_POLICY,
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

export const COUNTRY_OPTIONS = [
  { code: 'GB', label: 'United Kingdom' },
  { code: 'IE', label: 'Ireland' },
  { code: 'US', label: 'United States' },
  { code: 'AU', label: 'Australia' },
] as const

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
    invoicing: { ...DEFAULT_INVOICING },
  }
}

export function createDefaultOrgSetupSettings(): OrgSetupSettings {
  return {
    identity: createDefaultIdentitySetup(),
    features: createDefaultFeaturesSetup(),
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
    countryCode: identity.countryCode,
    currency: identity.currency,
    companyLogoURL: identity.companyLogoURL ?? null,
    officeAddress: {
      addressLine1: identity.officeAddress.addressLine1.trim(),
      addressLine2: identity.officeAddress.addressLine2.trim() || null,
      town: identity.officeAddress.town.trim() || null,
      county: identity.officeAddress.county.trim() || null,
      postcode: identity.officeAddress.postcode.trim() || null,
    },
    payrollTimePolicy: payrollPolicyToFirestore(features.payrollTimePolicy),
    annualLeaveDefaults: features.annualLeaveDefaults,
    warningDetection: warningDetectionToFirestore(features.warningDetection),
    invoicing: invoicingToFirestore(features.invoicing),
    settings: {
      myScheduleOptions: myScheduleOptionsToFirestore(features.myScheduleOptions),
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
