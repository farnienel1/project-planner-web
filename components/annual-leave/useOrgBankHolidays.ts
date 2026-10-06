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

export function useOrgBankHolidays(rangeStart: Date, rangeEnd: Date) {
  const organizationId = useAuthStore((state) => state.organization?.id)
  const [region, setRegion] = useState('GB')
  const [holidays, setHolidays] = useState<BankHoliday[]>([])

  const startMs = rangeStart.getTime()
  const endMs = rangeEnd.getTime()
  const years = useMemo(() => {
    const values = [
      new Date(startMs).getFullYear(),
      new Date(endMs).getFullYear(),
      new Date().getFullYear(),
      new Date().getFullYear() + 1,
    ]
    return Array.from(new Set(values))
  }, [startMs, endMs])

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    loadOrganizationDetails(organizationId)
      .then((details) => {
        if (cancelled) return
        const region = details?.bankHolidayRegionId || details?.countryCode
        if (region) setRegion(region)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [organizationId])

  useEffect(() => {
    let cancelled = false
    loadBankHolidays(region, years)
      .then((rows) => {
        if (!cancelled) setHolidays(rows)
      })
      .catch(() => {
        if (!cancelled) setHolidays([])
      })
    return () => {
      cancelled = true
    }
  }, [region, years])

  const yearCount = countHolidaysInRange(holidays, rangeStart, rangeEnd)
  return {
    region,
    holidays,
    sentence: bankHolidaySentence(region, yearCount),
    nameOn: (day: Date) => holidayNameOn(holidays, day),
  }
}
