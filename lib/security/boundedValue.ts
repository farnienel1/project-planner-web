/** Web save-boundary parsing. Does not change Canonical calculators or stored field names. */

export const MONEY_SAVE_MAX = 10_000_000
export const QUANTITY_SAVE_MAX = 1_000_000
export const LEAVE_DAYS_SAVE_MAX = 365
export const MULTIPLIER_SAVE_MAX = 100
export const CALENDAR_YEAR_MIN = 1970
export const CALENDAR_YEAR_MAX = 2100

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseBoundedNumber(
  value: unknown,
  options: { min: number; max: number }
): number | null {
  if (value == null) return null
  const raw = typeof value === 'number' ? value : String(value).replace(/,/g, '.').trim()
  if (raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return null
  if (n < options.min || n > options.max) return null
  return n
}

export function parseBoundedInteger(
  value: unknown,
  options: { min: number; max: number }
): number | null {
  const n = parseBoundedNumber(value, options)
  if (n == null) return null
  return Math.trunc(n)
}

export function isPlausibleDayKey(value: string): boolean {
  const match = DAY_KEY.exec(value.trim())
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < CALENDAR_YEAR_MIN || year > CALENDAR_YEAR_MAX) return false
  if (month < 1 || month > 12 || day < 1 || day > 31) return false
  const probe = new Date(Date.UTC(year, month - 1, day))
  return (
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day
  )
}

export function parseBoundedLatitude(value: unknown): number | null {
  return parseBoundedNumber(value, { min: -90, max: 90 })
}

export function parseBoundedLongitude(value: unknown): number | null {
  return parseBoundedNumber(value, { min: -180, max: 180 })
}
