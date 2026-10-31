/**
 * Company details on `organizations/{orgId}` — the one shape both apps read and write.
 *
 * Canonical fields are flat: `name`, `officeAddressLine1`, `officeAddressLine2`, `officeCity`,
 * `officeCounty`, `officePostcode`, `countryCode`, `documentAbbreviation`, `companyLogoURL`,
 * `defaultLatitude` / `defaultLongitude`, and the bank-holiday region (`bankHolidayRegionId` plus
 * `settings.bankHolidayRegionId`).
 *
 * Read falls back to the legacy nested `officeAddress` map (web setup once wrote it). Every save
 * removes that nested map so a stale address cannot come back. A blank optional field (line 2,
 * county, postcode, abbreviation, logo) is removed, never written as an empty string.
 *
 * The write is SDK-neutral: `set` holds plain values (dotted keys are paths for a partial update),
 * `remove` lists the field paths each app deletes (web `deleteField()`, iOS `FieldValue.delete()`).
 * Currency is separate: `organizationCurrencyWriteFields` in `money.ts`.
 */
import { organizationNameWriteFields, parseOrganizationName } from './organizationSettings'

export const DEFAULT_BANK_HOLIDAY_REGION_ID = 'GB-ENG-WLS'

export type CompanyDetails = {
  name: string
  /** True when both line 1 and the town / city are saved (iOS `hasOfficeAddress`). */
  hasOfficeAddress: boolean
  officeAddressLine1: string
  officeAddressLine2: string
  officeCity: string
  officeCounty: string
  officePostcode: string
  /** Two-letter upper-case ISO country. Missing or invalid reads as GB. */
  countryCode: string
  documentAbbreviation: string
  companyLogoURL: string
  defaultLatitude: number | null
  defaultLongitude: number | null
  bankHolidayRegionId: string
}

export type CompanyDetailsInput = {
  name: string
  hasOfficeAddress: boolean
  officeAddressLine1?: string | null
  officeAddressLine2?: string | null
  officeCity?: string | null
  officeCounty?: string | null
  officePostcode?: string | null
  countryCode: string
  documentAbbreviation?: string | null
  /** A URL sets the logo, `null` or `''` removes it, `undefined` leaves it unchanged. */
  companyLogoURL?: string | null
  /** Written only when both are finite numbers; otherwise the saved pin is left unchanged. */
  defaultLatitude?: number | null
  defaultLongitude?: number | null
  /** Written only when given. */
  bankHolidayRegionId?: string | null
}

export type CompanyDetailsWrite = {
  set: Record<string, unknown>
  remove: string[]
}

const OPTIONAL_ADDRESS_FIELDS = ['officeAddressLine2', 'officeCounty', 'officePostcode'] as const
const ALL_ADDRESS_FIELDS = [
  'officeAddressLine1',
  'officeAddressLine2',
  'officeCity',
  'officeCounty',
  'officePostcode',
] as const

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function finiteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

/** 1–3 letters or digits, upper case. Anything else is no abbreviation. */
export function normalizeDocumentAbbreviation(value: unknown): string {
  return text(value).replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()
}

/** Two-letter upper-case country; a `GB-SCT` style region reads as its country. Invalid → ''. */
export function normalizeCompanyCountryCode(value: unknown): string {
  const raw = text(value).toUpperCase()
  if (raw === 'UK') return 'GB'
  const country = raw.split('-')[0]
  return /^[A-Z]{2}$/.test(country) ? country : ''
}

export function parseCompanyDetails(orgDoc: unknown): CompanyDetails {
  const data = record(orgDoc)
  const nested = record(data.officeAddress)
  const settings = record(data.settings)
  const pick = (flat: string, legacy: string) => text(data[flat]) || text(nested[legacy])
  const line1 = pick('officeAddressLine1', 'addressLine1')
  const city = pick('officeCity', 'town')
  const hasOfficeAddress = Boolean(line1 && city)
  return {
    name: parseOrganizationName(data),
    hasOfficeAddress,
    officeAddressLine1: line1,
    officeAddressLine2: pick('officeAddressLine2', 'addressLine2'),
    officeCity: city,
    officeCounty: pick('officeCounty', 'county'),
    officePostcode: pick('officePostcode', 'postcode'),
    countryCode: normalizeCompanyCountryCode(data.countryCode) || 'GB',
    documentAbbreviation: normalizeDocumentAbbreviation(data.documentAbbreviation),
    companyLogoURL: text(data.companyLogoURL),
    defaultLatitude: finiteNumber(data.defaultLatitude),
    defaultLongitude: finiteNumber(data.defaultLongitude),
    bankHolidayRegionId:
      text(data.bankHolidayRegionId) || text(settings.bankHolidayRegionId) || DEFAULT_BANK_HOLIDAY_REGION_ID,
  }
}

/** Same rule as iOS `canSave`: name and country, plus line 1 and town when there is an office. */
export function companyDetailsValidationError(input: CompanyDetailsInput): string | null {
  const nameOk = Boolean(text(input.name))
  const countryOk = Boolean(normalizeCompanyCountryCode(input.countryCode))
  if (input.hasOfficeAddress) {
    if (!nameOk || !countryOk || !text(input.officeAddressLine1) || !text(input.officeCity)) {
      return 'Name, country, address line 1 and town are required.'
    }
    return null
  }
  if (!nameOk || !countryOk) return 'Organisation name and country are required.'
  return null
}

/**
 * Fields a company-details save writes as one partial update. Never persists a blank `name`
 * (`organizationNameWriteFields`), always removes the legacy nested `officeAddress` map.
 */
export function companyDetailsWriteFields(input: CompanyDetailsInput): CompanyDetailsWrite {
  const set: Record<string, unknown> = { ...organizationNameWriteFields(input.name) }
  const remove: string[] = ['officeAddress']

  const country = normalizeCompanyCountryCode(input.countryCode)
  if (country) set.countryCode = country

  if (input.hasOfficeAddress) {
    set.officeAddressLine1 = text(input.officeAddressLine1)
    set.officeCity = text(input.officeCity)
    const optional: Record<(typeof OPTIONAL_ADDRESS_FIELDS)[number], string> = {
      officeAddressLine2: text(input.officeAddressLine2),
      officeCounty: text(input.officeCounty),
      officePostcode: text(input.officePostcode),
    }
    for (const field of OPTIONAL_ADDRESS_FIELDS) {
      if (optional[field]) set[field] = optional[field]
      else remove.push(field)
    }
  } else {
    remove.push(...ALL_ADDRESS_FIELDS)
  }

  const abbreviation = normalizeDocumentAbbreviation(input.documentAbbreviation)
  if (abbreviation) set.documentAbbreviation = abbreviation
  else remove.push('documentAbbreviation')

  if (input.companyLogoURL !== undefined) {
    const logo = text(input.companyLogoURL)
    if (logo) set.companyLogoURL = logo
    else remove.push('companyLogoURL')
  }

  const lat = finiteNumber(input.defaultLatitude)
  const lon = finiteNumber(input.defaultLongitude)
  if (lat != null && lon != null) {
    set.defaultLatitude = lat
    set.defaultLongitude = lon
  }

  if (input.bankHolidayRegionId !== undefined && input.bankHolidayRegionId !== null) {
    const region = text(input.bankHolidayRegionId).toUpperCase() || DEFAULT_BANK_HOLIDAY_REGION_ID
    set.bankHolidayRegionId = region
    set['settings.bankHolidayRegionId'] = region
  }

  return { set, remove }
}
