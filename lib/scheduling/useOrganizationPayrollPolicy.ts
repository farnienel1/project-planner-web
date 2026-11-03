'use client'

import { useEffect, useMemo, useRef } from 'react'
import { organizationTimeZone, parsePayrollTimePolicyState, payrollTimePolicyTimeline } from '@/lib/canonical'
import { useOrganizationDocument } from '@/lib/stores/organizationDocumentStore'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import {
  customHoursPrefillForDate,
  customHoursPrefillForDates,
  isWeekendDate,
  weekendWeekdayMixMessage,
} from '@/lib/scheduling/bookingSlotRules'

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

/**
 * Rulebook 1.18.0 (`customHoursPrefillForDays`): a picker that holds one custom-hours pair for its whole selection
 * calls `apply` with the selection's prefill whenever the selection changes kind (weekend only ↔ weekday only) or the
 * working hours load or change — not on every click within the same kind, so the person's own edit survives adding
 * another day of the same kind. A refused weekday + weekend mix (`kind: 'none'`) and an empty selection change nothing.
 */
export function useCustomHoursPrefillOnKindChange(
  dates: ReadonlyArray<Date>,
  policy: OrgPayrollTimePolicy | null | undefined,
  apply: (hours: { start: string; end: string }) => void
): void {
  const applied = useRef<{ kind: string; policy: unknown } | null>(null)
  const applyRef = useRef(apply)
  applyRef.current = apply
  const datesKey = dates.map((date) => date.getTime()).join('|')
  useEffect(() => {
    const prefill = customHoursPrefillForDates(dates, policy)
    if (!prefill || prefill.kind === 'none') return
    const last = applied.current
    if (last && last.kind === prefill.kind && last.policy === policy) return
    applied.current = { kind: prefill.kind, policy }
    applyRef.current({ start: prefill.start, end: prefill.end })
    // `dates` is read through `datesKey` so a new array with the same days does not re-apply.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datesKey, policy])
}
