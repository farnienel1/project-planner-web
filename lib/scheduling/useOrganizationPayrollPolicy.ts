'use client'

import { useMemo } from 'react'
import { organizationTimeZone, parsePayrollTimePolicyState, payrollTimePolicyTimeline } from '@/lib/canonical'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { customHoursPrefillForDate, isWeekendDate, weekendWeekdayMixMessage } from '@/lib/scheduling/bookingSlotRules'

/**
 * The open organisation's working hours in effect today, from its live document (subscribed here, so a picker opened
 * on its own still reads the open organisation and never another company's copy): a scheduled change that is due
 * counts (`payrollTimePolicyTimeline`). Per-day rules for a booking date are resolved in `bookingSlotRules`
 * (`effectivePayrollTimePolicy`).
 */
export function useOrganizationPayrollPolicy(): OrgPayrollTimePolicy {
  const { data } = useOrganizationDocument()
  return useMemo(() => {
    const record = (data as Record<string, unknown> | null) ?? {}
    const zone = organizationTimeZone(typeof record.countryCode === 'string' ? record.countryCode : null)
    return payrollTimePolicyTimeline(parsePayrollTimePolicyState(record, zone), dayKeyInZone(new Date(), zone), zone).current
  }, [data])
}

/** Rulebook 1.13.0 (Q2): the weekend and weekday-mix rules a date picker needs, bound to the open organisation. */
export function useScheduleDateRules() {
  const policy = useOrganizationPayrollPolicy()
  return useMemo(
    () => ({
      policy,
      isWeekend: (date: Date) => isWeekendDate(date),
      prefill: (date: Date) => customHoursPrefillForDate(date, policy),
      mixMessage: (dates: Date[]) => weekendWeekdayMixMessage(dates),
    }),
    [policy]
  )
}
