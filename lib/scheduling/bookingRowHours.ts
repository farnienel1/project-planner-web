/**
 * Rulebook 1.20.2 §6 / §10: what a booking row shows — the times ("Custom 07:30–14:00", "Full day") and the pay rule's
 * hours for that day under the working hours in effect on it (`payrollHoursResult` → `bookingHoursLabel`), e.g. "8h"
 * or "13h (6.5h × 2)". Every booking list (My Schedule, Schedule, project / small works week, Daily Overview) uses
 * this, never a clock duration.
 */
import { bookingHoursLabel, type BookingHoursLabel } from '@/lib/canonical/bookingSlots'
import { bookingPayrollHours, bookingTimesText } from '@/lib/scheduling/paidHours'

export { bookingTimesText }
import { bookingDayKey, policyForBookingDate } from '@/lib/scheduling/bookingSlotRules'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'

export type BookingRowInput = {
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  isBreakRemoved?: boolean | null
  otMultiplierOverride?: number | null
}

/** The pay rule's hours for the booking on `day` (`bookingHoursLabel`). */
export function bookingRowHours(input: BookingRowInput, day: Date | string | number, payroll?: OrgPayrollTimePolicy | null): BookingHoursLabel {
  const policy = policyForBookingDate(day, payroll ?? null) ?? payroll ?? undefined
  return bookingHoursLabel(
    bookingPayrollHours({
      timeSlot: input.timeSlot ?? undefined,
      workStartTime: input.workStartTime ?? undefined,
      workEndTime: input.workEndTime ?? undefined,
      isBreakRemoved: input.isBreakRemoved === true,
      otMultiplierOverride: input.otMultiplierOverride ?? undefined,
      policy,
      dayKey: bookingDayKey(day),
    })
  )
}

/** "Custom 07:30–14:00 · 13h (6.5h × 2)". */
export function bookingRowText(input: BookingRowInput, day: Date | string | number, payroll?: OrgPayrollTimePolicy | null): string {
  return `${bookingTimesText(input)} · ${bookingRowHours(input, day, payroll).label}`
}
