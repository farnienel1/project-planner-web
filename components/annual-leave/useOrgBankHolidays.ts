'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { loadOrganizationDetails } from '@/lib/settings/organizationSettings'
import {
  bankHolidaySentence,
  countHolidaysInRange,
  holidayNameOn,
  loadBankHolidays,
  type BankHoliday,
} from '@/lib/annualLeave/bankHolidays'

/**
 * The organisation region's bank holidays for the calendar years of `rangeStart`–`rangeEnd`, this year and next.
 * `options.years` adds more calendar years: a leave balance passes `annualLeaveBankHolidayRange(...).years`
 * (rulebook 1.35.0, the previous leave year too, for carry-over). `loaded` is true once the region is known and the
 * holidays for exactly these years have been fetched (or the fetch failed) — a screen that counts leave waits for it.
 */
export function useOrgBankHolidays(rangeStart: Date, rangeEnd: Date, options?: { years?: ReadonlyArray<number> }) {
  const organizationId = useAuthStore((state) => state.organization?.id)
  const [region, setRegion] = useState('GB')
  const [regionResolved, setRegionResolved] = useState(false)
  const [holidays, setHolidays] = useState<BankHoliday[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  const startMs = rangeStart.getTime()
  const endMs = rangeEnd.getTime()
  const extraYears = (options?.years ?? []).join(',')
  const years = useMemo(() => {
    const values = [
      new Date(startMs).getFullYear(),
      new Date(endMs).getFullYear(),
      new Date().getFullYear(),
      new Date().getFullYear() + 1,
      ...extraYears.split(',').filter(Boolean).map(Number),
    ].filter((value) => Number.isFinite(value))
    return Array.from(new Set(values)).sort((a, b) => a - b)
  }, [startMs, endMs, extraYears])

  useEffect(() => {
    if (!organizationId) {
      setRegionResolved(true)
      return
    }
    let cancelled = false
    setRegionResolved(false)
    loadOrganizationDetails(organizationId)
      .then((details) => {
        if (cancelled) return
        const region = details?.bankHolidayRegionId || details?.countryCode
        if (region) setRegion(region)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRegionResolved(true)
      })
    return () => {
      cancelled = true
    }
  }, [organizationId])

  const requestKey = `${region}|${years.join(',')}`
  useEffect(() => {
    let cancelled = false
    loadBankHolidays(region, years)
      .then((rows) => {
        if (!cancelled) setHolidays(rows)
      })
      .catch(() => {
        if (!cancelled) setHolidays([])
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(`${region}|${years.join(',')}`)
      })
    return () => {
      cancelled = true
    }
  }, [region, years])

  const loaded = regionResolved && loadedKey === requestKey

  const yearCount = countHolidaysInRange(holidays, rangeStart, rangeEnd)
  return {
    region,
    loaded,
    holidays,
    sentence: bankHolidaySentence(region, yearCount),
    nameOn: (day: Date) => holidayNameOn(holidays, day),
  }
}
