/**
 * Organisation currency and money display.
 *
 * - `CURRENCY_OPTIONS`: the currencies an organisation may pick (same list on every platform).
 * - `defaultCurrencyForCountry`: the suggestion when an organisation has not saved one.
 * - `resolveOrganizationCurrency`: the saved code on `organizations/{orgId}`, else the country default.
 * - `organizationCurrencyWriteFields`: the fields a currency save writes (dotted update on the org document).
 * - `formatMoney`: how every screen, export and PDF shows an amount.
 *
 * Every money figure uses the organisation currency. Subscription prices (Stripe) are not organisation
 * money and stay in their billing currency.
 */

export type CurrencyOption = {
  code: string
  title: string
  symbol: string
}

export const DEFAULT_CURRENCY_CODE = 'GBP'

export const CURRENCY_OPTIONS: readonly CurrencyOption[] = [
  { code: 'GBP', title: 'British pound', symbol: '£' },
  { code: 'EUR', title: 'Euro', symbol: '€' },
  { code: 'USD', title: 'US dollar', symbol: '$' },
  { code: 'CAD', title: 'Canadian dollar', symbol: 'CA$' },
  { code: 'AUD', title: 'Australian dollar', symbol: 'A$' },
  { code: 'NZD', title: 'New Zealand dollar', symbol: 'NZ$' },
  { code: 'SEK', title: 'Swedish krona', symbol: 'kr' },
  { code: 'NOK', title: 'Norwegian krone', symbol: 'kr' },
  { code: 'DKK', title: 'Danish krone', symbol: 'kr' },
  { code: 'PLN', title: 'Polish złoty', symbol: 'zł' },
  { code: 'AED', title: 'UAE dirham', symbol: 'د.إ' },
]

const COUNTRY_CURRENCY: Record<string, string> = {
  GB: 'GBP',
  UK: 'GBP',
  IE: 'EUR',
  FR: 'EUR',
  DE: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
  US: 'USD',
  CA: 'CAD',
  AU: 'AUD',
  NZ: 'NZD',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  AE: 'AED',
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** A supported code in upper case, or null. */
export function normalizeCurrencyCode(value: unknown): string | null {
  const code = text(value).toUpperCase()
  if (!code) return null
  return CURRENCY_OPTIONS.some((option) => option.code === code) ? code : null
}

export function currencyOption(code: unknown): CurrencyOption {
  const normalized = normalizeCurrencyCode(code)
  return CURRENCY_OPTIONS.find((option) => option.code === normalized) ?? CURRENCY_OPTIONS[0]
}

export function defaultCurrencyForCountry(countryCode: unknown): string {
  const country = text(countryCode).toUpperCase().split('-')[0]
  return COUNTRY_CURRENCY[country] ?? DEFAULT_CURRENCY_CODE
}

/**
 * The organisation currency from an `organizations/{orgId}` document.
 * Order: top-level `currencyCode`, nested `settings.currencyCode`, legacy `currency`,
 * a literal `"settings.currencyCode"` key (older iOS merge writes), then the country default.
 */
export function resolveOrganizationCurrency(org: unknown): string {
  const doc = org && typeof org === 'object' ? (org as Record<string, unknown>) : {}
  const settings =
    doc.settings && typeof doc.settings === 'object' ? (doc.settings as Record<string, unknown>) : {}
  return (
    normalizeCurrencyCode(doc.currencyCode) ??
    normalizeCurrencyCode(settings.currencyCode) ??
    normalizeCurrencyCode(doc.currency) ??
    normalizeCurrencyCode(doc['settings.currencyCode']) ??
    defaultCurrencyForCountry(doc.countryCode)
  )
}

/**
 * Fields a currency save writes, as a dotted partial update (updateDoc / updateData).
 * Never use these keys with setData(merge:) — a dotted key there is a literal field name.
 */
export function organizationCurrencyWriteFields(code: unknown): {
  currencyCode: string
  currency: string
  'settings.currencyCode': string
} | null {
  const normalized = normalizeCurrencyCode(code)
  if (!normalized) return null
  return { currencyCode: normalized, currency: normalized, 'settings.currencyCode': normalized }
}

export type FormatMoneyOptions = {
  /** Decimal places. Default 2. */
  decimals?: number
  /** Show the sign before the symbol for negatives (−£5.00). Default true. */
  signed?: boolean
}

/**
 * `formatMoney(1234.5, 'GBP')` → `£1,234.50`. Grouping uses commas and a dot for decimals on every
 * platform so exports and PDFs match. Non-finite amounts show as 0.
 */
export function formatMoney(amount: unknown, currencyCode: unknown, options: FormatMoneyOptions = {}): string {
  const decimals = Number.isInteger(options.decimals) && (options.decimals as number) >= 0 ? (options.decimals as number) : 2
  const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : Number(amount)
  const safe = Number.isFinite(value) ? value : 0
  const negative = safe < 0 && Math.abs(safe) >= 0.5 * Math.pow(10, -decimals)
  const fixed = Math.abs(safe).toFixed(decimals)
  const [whole, fraction] = fixed.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const body = fraction ? `${grouped}.${fraction}` : grouped
  const symbol = currencyOption(currencyCode).symbol
  // A symbol that ends in a letter (kr, zł, د.إ) is followed by a space; £ € $ CA$ A$ NZ$ are not.
  const spaced = /\p{L}$/u.test(symbol) ? `${symbol} ` : symbol
  const sign = negative && options.signed !== false ? '-' : ''
  return `${sign}${spaced}${body}`
}

export function currencySymbol(currencyCode: unknown): string {
  return currencyOption(currencyCode).symbol
}
