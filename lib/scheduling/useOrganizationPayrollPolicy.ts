'use client'

import { useMemo } from 'react'
import { parsePayrollPolicy } from '@/lib/canonical/organizationSettings'
import { useOrganizationDocumentStore } from '@/lib/stores/organizationDocumentStore'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { customHoursPrefillForDate, isWeekendDate, weekendWeekdayMixMessage } from '@/lib/scheduling/bookingSlotRules'

/** The open organisation's working-hours policy from its live document (`parsePayrollPolicy`), for pickers' notes. */
export function useOrganizationPayrollPolicy(): OrgPayrollTimePolicy {
  const data = useOrganizationDocumentStore((state) => state.data)
  return useMemo(
    () => parsePayrollPolicy((data as Record<string, unknown> | null)?.payrollTimePolicy as Record<string, unknown> | undefined),
    [data]
  )
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
