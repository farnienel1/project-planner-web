import { format, startOfDay } from 'date-fns'
import { bankHolidayRegionLabel } from '@/lib/settings/bankHolidayRegions'

export type BankHoliday = {
  date: string
  name: string
}

type NagerHoliday = {
  date?: string
  localName?: string
  name?: string
  countryCode?: string
  global?: boolean
  counties?: string[] | null
}

const rawCache = new Map<string, NagerHoliday[]>()

/** Same-origin proxy. The public Nager API does not send CORS headers, so the browser cannot call it directly. */
async function browserAuthHeaders(): Promise<Record<string, string>> {
  if (typeof window === 'undefined') return {}
  const { getClientAuthHeaders } = await import('@/lib/security/clientAuthHeaders')
  return getClientAuthHeaders()
}

export function nagerCountryCode(regionCode: string): string {
  const code = regionCode.trim().toUpperCase()
  if (!code || code === 'UK' || code.startsWith('GB')) return 'GB'
  return code
}

/** England & Wales share dates. A bare GB setting follows that set, matching the company region picker. */
export function holidayMatchesRegion(holiday: NagerHoliday, regionCode: string): boolean {
  const region = regionCode.trim().toUpperCase() || 'GB'
  const country = nagerCountryCode(region)
  if ((holiday.countryCode || '').toUpperCase() !== country) return false
  const counties = holiday.counties?.filter(Boolean) ?? []
  if (holiday.global || counties.length === 0) return true
  if (country !== 'GB') return counties.includes(region)
  if (region === 'GB-SCT') return counties.includes('GB-SCT')
  if (region === 'GB-NIR') return counties.includes('GB-NIR')
  return counties.some((county) => county === 'GB-ENG' || county === 'GB-WLS')
}

export function holidayNameOn(holidays: BankHoliday[], day: Date): string | null {
  const key = format(startOfDay(day), 'yyyy-MM-dd')
  return holidays.find((holiday) => holiday.date === key)?.name ?? null
}

export function countHolidaysInRange(holidays: BankHoliday[], start: Date, end: Date): number {
  const from = format(startOfDay(start), 'yyyy-MM-dd')
  const to = format(startOfDay(end), 'yyyy-MM-dd')
  return holidays.filter((holiday) => holiday.date >= from && holiday.date <= to).length
}

export function bankHolidaySentence(regionCode: string, count: number): string {
  const label = bankHolidayRegionLabel(regionCode)
  if (count <= 0) {
    return `Bank holidays: ${label}. Dates for this leave year are not loaded yet. The calendar still works, and bank holidays never come out of your allowance.`
  }
  return `Bank holidays: ${label}. ${count} ${count === 1 ? 'date' : 'dates'} loaded for this leave year. They never come out of your allowance and cannot be booked.`
}

export async function loadBankHolidays(regionCode: string, years: number[]): Promise<BankHoliday[]> {
  const region = regionCode.trim().toUpperCase() || 'GB'
  const uniqueYears = Array.from(new Set(years.filter((year) => year >= 2000 && year <= 2100))).sort()
  const country = nagerCountryCode(region)
  const collected: BankHoliday[] = []
  await Promise.all(
    uniqueYears.map(async (year) => {
      const cacheKey = `${country}:${year}`
      let raw = rawCache.get(cacheKey)
      if (!raw) {
        const headers = await browserAuthHeaders()
        const response = await fetch(`/api/bank-holidays?year=${year}&country=${encodeURIComponent(country)}`, {
          headers,
        })
        if (!response.ok) throw new Error(`Bank holidays for ${year} did not load.`)
        const payload = (await response.json()) as NagerHoliday[]
        raw = payload.filter((row) => Boolean(row.date && (row.localName || row.name)))
        rawCache.set(cacheKey, raw)
      }
      for (const row of raw) {
        if (!holidayMatchesRegion({ ...row, countryCode: row.countryCode || country }, region) || !row.date) continue
        collected.push({ date: row.date, name: row.localName || row.name || 'Bank holiday' })
      }
    })
  )
  const seen = new Set<string>()
  return collected
    .filter((holiday) => {
      if (seen.has(holiday.date)) return false
      seen.add(holiday.date)
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}
