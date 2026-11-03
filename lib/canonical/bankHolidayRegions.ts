/**
 * Bank-holiday regions (rulebook §4.1, §4.4) — the one list both apps offer.
 *
 * A region belongs to one country (`countryCode`, ISO 3166-1 alpha-2, the Nager.Date country). UK regions
 * also name the Nager subdivision codes whose holidays apply (`subdivisionCodes`); a region without them takes
 * every national holiday. Ids are stored on `organizations/{orgId}.bankHolidayRegionId` and never renamed
 * (`GB-ENG-WLS`, `GB-SCT`, `GB-NIR`, `GB`, `IE`, `US`, …). The older web id `GB-ENG` reads as `GB-ENG-WLS`.
 *
 * - `bankHolidayRegionsForCountry(countryCode)`: the regions a picker offers for a company in that country.
 * - `defaultBankHolidayRegionForCountry(countryCode)`: GB → `GB-ENG-WLS`; a country with one region → that
 *   region; a country with none listed → null.
 * - `companyDetailsRegionPrompt(previous, next)`: after a country change, whether the region must be chosen again.
 */

export type BankHolidayRegion = {
  id: string
  title: string
  countryCode: string
  /** Nager subdivision codes whose holidays apply; absent means every national holiday. */
  subdivisionCodes?: readonly string[]
}

export const DEFAULT_BANK_HOLIDAY_REGION_ID = 'GB-ENG-WLS'

export const BANK_HOLIDAY_REGIONS: readonly BankHolidayRegion[] = [
  { id: 'GB-ENG-WLS', title: 'England & Wales', countryCode: 'GB', subdivisionCodes: ['GB-ENG', 'GB-WLS'] },
  { id: 'GB-SCT', title: 'Scotland', countryCode: 'GB', subdivisionCodes: ['GB-SCT'] },
  { id: 'GB-NIR', title: 'Northern Ireland', countryCode: 'GB', subdivisionCodes: ['GB-NIR'] },
  { id: 'GB', title: 'United Kingdom (all nations)', countryCode: 'GB' },
  { id: 'IE', title: 'Ireland', countryCode: 'IE' },
  { id: 'IM', title: 'Isle of Man', countryCode: 'IM' },
  { id: 'JE', title: 'Jersey', countryCode: 'JE' },
  { id: 'GG', title: 'Guernsey', countryCode: 'GG' },
  { id: 'AD', title: 'Andorra', countryCode: 'AD' },
  { id: 'AL', title: 'Albania', countryCode: 'AL' },
  { id: 'AM', title: 'Armenia', countryCode: 'AM' },
  { id: 'AO', title: 'Angola', countryCode: 'AO' },
  { id: 'AR', title: 'Argentina', countryCode: 'AR' },
  { id: 'AT', title: 'Austria', countryCode: 'AT' },
  { id: 'AU', title: 'Australia', countryCode: 'AU' },
  { id: 'AW', title: 'Aruba', countryCode: 'AW' },
  { id: 'AX', title: 'Åland Islands', countryCode: 'AX' },
  { id: 'BA', title: 'Bosnia and Herzegovina', countryCode: 'BA' },
  { id: 'BB', title: 'Barbados', countryCode: 'BB' },
  { id: 'BD', title: 'Bangladesh', countryCode: 'BD' },
  { id: 'BE', title: 'Belgium', countryCode: 'BE' },
  { id: 'BG', title: 'Bulgaria', countryCode: 'BG' },
  { id: 'BJ', title: 'Benin', countryCode: 'BJ' },
  { id: 'BO', title: 'Bolivia', countryCode: 'BO' },
  { id: 'BR', title: 'Brazil', countryCode: 'BR' },
  { id: 'BS', title: 'Bahamas', countryCode: 'BS' },
  { id: 'BW', title: 'Botswana', countryCode: 'BW' },
  { id: 'BY', title: 'Belarus', countryCode: 'BY' },
  { id: 'BZ', title: 'Belize', countryCode: 'BZ' },
  { id: 'CA', title: 'Canada', countryCode: 'CA' },
  { id: 'CD', title: 'DR Congo', countryCode: 'CD' },
  { id: 'CG', title: 'Congo', countryCode: 'CG' },
  { id: 'CH', title: 'Switzerland', countryCode: 'CH' },
  { id: 'CL', title: 'Chile', countryCode: 'CL' },
  { id: 'CN', title: 'China', countryCode: 'CN' },
  { id: 'CO', title: 'Colombia', countryCode: 'CO' },
  { id: 'CR', title: 'Costa Rica', countryCode: 'CR' },
  { id: 'CU', title: 'Cuba', countryCode: 'CU' },
  { id: 'CY', title: 'Cyprus', countryCode: 'CY' },
  { id: 'CZ', title: 'Czechia', countryCode: 'CZ' },
  { id: 'DE', title: 'Germany', countryCode: 'DE' },
  { id: 'DK', title: 'Denmark', countryCode: 'DK' },
  { id: 'DM', title: 'Dominica', countryCode: 'DM' },
  { id: 'DO', title: 'Dominican Republic', countryCode: 'DO' },
  { id: 'EC', title: 'Ecuador', countryCode: 'EC' },
  { id: 'EE', title: 'Estonia', countryCode: 'EE' },
  { id: 'EG', title: 'Egypt', countryCode: 'EG' },
  { id: 'ES', title: 'Spain', countryCode: 'ES' },
  { id: 'FI', title: 'Finland', countryCode: 'FI' },
  { id: 'FO', title: 'Faroe Islands', countryCode: 'FO' },
  { id: 'FR', title: 'France', countryCode: 'FR' },
  { id: 'GA', title: 'Gabon', countryCode: 'GA' },
  { id: 'GD', title: 'Grenada', countryCode: 'GD' },
  { id: 'GE', title: 'Georgia', countryCode: 'GE' },
  { id: 'GH', title: 'Ghana', countryCode: 'GH' },
  { id: 'GI', title: 'Gibraltar', countryCode: 'GI' },
  { id: 'GL', title: 'Greenland', countryCode: 'GL' },
  { id: 'GM', title: 'Gambia', countryCode: 'GM' },
  { id: 'GP', title: 'Guadeloupe', countryCode: 'GP' },
  { id: 'GR', title: 'Greece', countryCode: 'GR' },
  { id: 'GT', title: 'Guatemala', countryCode: 'GT' },
  { id: 'GY', title: 'Guyana', countryCode: 'GY' },
  { id: 'HK', title: 'Hong Kong', countryCode: 'HK' },
  { id: 'HN', title: 'Honduras', countryCode: 'HN' },
  { id: 'HR', title: 'Croatia', countryCode: 'HR' },
  { id: 'HT', title: 'Haiti', countryCode: 'HT' },
  { id: 'HU', title: 'Hungary', countryCode: 'HU' },
  { id: 'ID', title: 'Indonesia', countryCode: 'ID' },
  { id: 'IS', title: 'Iceland', countryCode: 'IS' },
  { id: 'IT', title: 'Italy', countryCode: 'IT' },
  { id: 'JM', title: 'Jamaica', countryCode: 'JM' },
  { id: 'JP', title: 'Japan', countryCode: 'JP' },
  { id: 'KE', title: 'Kenya', countryCode: 'KE' },
  { id: 'KR', title: 'South Korea', countryCode: 'KR' },
  { id: 'KY', title: 'Cayman Islands', countryCode: 'KY' },
  { id: 'KZ', title: 'Kazakhstan', countryCode: 'KZ' },
  { id: 'LC', title: 'Saint Lucia', countryCode: 'LC' },
  { id: 'LI', title: 'Liechtenstein', countryCode: 'LI' },
  { id: 'LS', title: 'Lesotho', countryCode: 'LS' },
  { id: 'LT', title: 'Lithuania', countryCode: 'LT' },
  { id: 'LU', title: 'Luxembourg', countryCode: 'LU' },
  { id: 'LV', title: 'Latvia', countryCode: 'LV' },
  { id: 'MA', title: 'Morocco', countryCode: 'MA' },
  { id: 'MC', title: 'Monaco', countryCode: 'MC' },
  { id: 'MD', title: 'Moldova', countryCode: 'MD' },
  { id: 'ME', title: 'Montenegro', countryCode: 'ME' },
  { id: 'MG', title: 'Madagascar', countryCode: 'MG' },
  { id: 'MK', title: 'North Macedonia', countryCode: 'MK' },
  { id: 'MN', title: 'Mongolia', countryCode: 'MN' },
  { id: 'MQ', title: 'Martinique', countryCode: 'MQ' },
  { id: 'MS', title: 'Montserrat', countryCode: 'MS' },
  { id: 'MT', title: 'Malta', countryCode: 'MT' },
  { id: 'MX', title: 'Mexico', countryCode: 'MX' },
  { id: 'MZ', title: 'Mozambique', countryCode: 'MZ' },
  { id: 'NA', title: 'Namibia', countryCode: 'NA' },
  { id: 'NE', title: 'Niger', countryCode: 'NE' },
  { id: 'NG', title: 'Nigeria', countryCode: 'NG' },
  { id: 'NI', title: 'Nicaragua', countryCode: 'NI' },
  { id: 'NL', title: 'Netherlands', countryCode: 'NL' },
  { id: 'NO', title: 'Norway', countryCode: 'NO' },
  { id: 'NZ', title: 'New Zealand', countryCode: 'NZ' },
  { id: 'PA', title: 'Panama', countryCode: 'PA' },
  { id: 'PE', title: 'Peru', countryCode: 'PE' },
  { id: 'PG', title: 'Papua New Guinea', countryCode: 'PG' },
  { id: 'PH', title: 'Philippines', countryCode: 'PH' },
  { id: 'PL', title: 'Poland', countryCode: 'PL' },
  { id: 'PR', title: 'Puerto Rico', countryCode: 'PR' },
  { id: 'PT', title: 'Portugal', countryCode: 'PT' },
  { id: 'PY', title: 'Paraguay', countryCode: 'PY' },
  { id: 'RO', title: 'Romania', countryCode: 'RO' },
  { id: 'RS', title: 'Serbia', countryCode: 'RS' },
  { id: 'RU', title: 'Russia', countryCode: 'RU' },
  { id: 'SC', title: 'Seychelles', countryCode: 'SC' },
  { id: 'SE', title: 'Sweden', countryCode: 'SE' },
  { id: 'SG', title: 'Singapore', countryCode: 'SG' },
  { id: 'SI', title: 'Slovenia', countryCode: 'SI' },
  { id: 'SJ', title: 'Svalbard and Jan Mayen', countryCode: 'SJ' },
  { id: 'SK', title: 'Slovakia', countryCode: 'SK' },
  { id: 'SM', title: 'San Marino', countryCode: 'SM' },
  { id: 'SR', title: 'Suriname', countryCode: 'SR' },
  { id: 'SV', title: 'El Salvador', countryCode: 'SV' },
  { id: 'TN', title: 'Tunisia', countryCode: 'TN' },
  { id: 'TR', title: 'Türkiye', countryCode: 'TR' },
  { id: 'UA', title: 'Ukraine', countryCode: 'UA' },
  { id: 'UG', title: 'Uganda', countryCode: 'UG' },
  { id: 'US', title: 'United States', countryCode: 'US' },
  { id: 'UY', title: 'Uruguay', countryCode: 'UY' },
  { id: 'VA', title: 'Vatican City', countryCode: 'VA' },
  { id: 'VE', title: 'Venezuela', countryCode: 'VE' },
  { id: 'VN', title: 'Vietnam', countryCode: 'VN' },
  { id: 'ZA', title: 'South Africa', countryCode: 'ZA' },
  { id: 'ZW', title: 'Zimbabwe', countryCode: 'ZW' },
]

/** Stored ids that mean another listed id. */
const REGION_ID_ALIASES: Readonly<Record<string, string>> = {
  'GB-ENG': 'GB-ENG-WLS',
  'GB-WLS': 'GB-ENG-WLS',
  UK: 'GB',
}

const COUNTRY_TITLES: Readonly<Record<string, string>> = { GB: 'United Kingdom' }

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** A listed region id (aliases resolved, upper case), or null. */
export function normalizeBankHolidayRegionId(value: unknown): string | null {
  const raw = text(value).toUpperCase()
  if (!raw) return null
  const id = REGION_ID_ALIASES[raw] ?? raw
  return BANK_HOLIDAY_REGIONS.some((region) => region.id === id) ? id : null
}

export function bankHolidayRegion(id: unknown): BankHolidayRegion | null {
  const normalized = normalizeBankHolidayRegionId(id)
  return normalized ? BANK_HOLIDAY_REGIONS.find((region) => region.id === normalized) ?? null : null
}

/** The region's title, or the raw value when it is not listed. */
export function bankHolidayRegionLabel(id: unknown): string {
  return bankHolidayRegion(id)?.title ?? text(id)
}

function countryKey(countryCode: unknown): string {
  const raw = text(countryCode).toUpperCase()
  if (raw === 'UK' || raw.startsWith('GB')) return 'GB'
  return raw
}

/** Regions for a company in `countryCode` (order as listed). Empty when none are listed. */
export function bankHolidayRegionsForCountry(countryCode: unknown): BankHolidayRegion[] {
  const country = countryKey(countryCode)
  return BANK_HOLIDAY_REGIONS.filter((region) => region.countryCode === country)
}

export function defaultBankHolidayRegionForCountry(countryCode: unknown): string | null {
  const country = countryKey(countryCode)
  if (country === 'GB') return DEFAULT_BANK_HOLIDAY_REGION_ID
  const regions = bankHolidayRegionsForCountry(country)
  return regions.length === 1 ? regions[0].id : null
}

/** Countries that have at least one region, with their display name (the company country picker). */
export function bankHolidayCountries(): { code: string; title: string }[] {
  const seen = new Set<string>()
  const out: { code: string; title: string }[] = []
  for (const region of BANK_HOLIDAY_REGIONS) {
    if (seen.has(region.countryCode)) continue
    seen.add(region.countryCode)
    out.push({ code: region.countryCode, title: COUNTRY_TITLES[region.countryCode] ?? region.title })
  }
  return out
}

export function bankHolidayCountryTitle(countryCode: unknown): string {
  const country = countryKey(countryCode)
  return bankHolidayCountries().find((entry) => entry.code === country)?.title ?? country
}

export type CompanyDetailsRegionPrompt =
  | { required: false }
  | { required: true; choices: BankHolidayRegion[]; defaultRegionId: string | null; message: string }

/**
 * After Company Details changes the country: the region must be chosen again when the saved
 * `bankHolidayRegionId` does not belong to the new country. Same country → never required. A new country
 * with no listed regions → not required (nothing to choose; the saved region is removed on save).
 */
export function companyDetailsRegionPrompt(
  previous: { countryCode?: unknown; bankHolidayRegionId?: unknown } | null | undefined,
  next: { countryCode?: unknown } | null | undefined
): CompanyDetailsRegionPrompt {
  const before = countryKey(previous?.countryCode) || 'GB'
  const after = countryKey(next?.countryCode)
  if (!after || after === before) return { required: false }
  const saved = bankHolidayRegion(previous?.bankHolidayRegionId)
  if (saved && saved.countryCode === after) return { required: false }
  const choices = bankHolidayRegionsForCountry(after)
  if (choices.length === 0) return { required: false }
  return {
    required: true,
    choices,
    defaultRegionId: defaultBankHolidayRegionForCountry(after),
    message: `Choose the bank holidays for ${bankHolidayCountryTitle(after)}.`,
  }
}

/**
 * Rulebook 1.13.0 §4.1 (owner decisions round 4, Q6): the countries a company can choose at launch. Every country
 * picker (Company details, organisation setup) offers only these. A company that already stores another country keeps
 * it: `launchCountryOptions(stored)` lists it too, so it is shown and saved unchanged. More countries come later.
 */
export const LAUNCH_COUNTRY_CODES: readonly string[] = ['GB', 'IE']

/** The country picker rows: the launch countries, plus the stored country when it is another one (kept and shown). */
export function launchCountryOptions(storedCountryCode?: unknown): { code: string; title: string }[] {
  const out = LAUNCH_COUNTRY_CODES.map((code) => ({ code, title: bankHolidayCountryTitle(code) }))
  const stored = countryKey(storedCountryCode)
  if (stored && !LAUNCH_COUNTRY_CODES.includes(stored)) out.push({ code: stored, title: bankHolidayCountryTitle(stored) })
  return out
}
