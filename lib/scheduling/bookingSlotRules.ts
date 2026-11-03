/**
 * Web glue for the 1.13.0 booking slot rules (`lib/canonical/bookingSlots.ts`): the slots a picker offers on a day,
 * the weekend Full day note, and the custom-hours lunch-break confirm step. No rule lives here — only the Date → day
 * key conversion in the organisation zone and the browser confirm.
 */
import {
  allowedTimeSlotsOnDay,
  customHoursBreakWarning,
  organizationTimeZone,
  weekendFullDayNote,
  type BookingSlotChoice,
  type CustomHoursBreakBooking,
} from '@/lib/canonical'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { useOrganizationDocumentStore } from '@/lib/stores/organizationDocumentStore'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'

function openOrganizationZone(): string {
  const data = useOrganizationDocumentStore.getState().data
  const country = data && typeof data.countryCode === 'string' ? data.countryCode : null
  return organizationTimeZone(country)
}

/** The booking day as an organisation-zone day key. */
export function bookingDayKey(date: Date | string | number): string {
  const zone = openOrganizationZone()
  return dayKeyInZone(date instanceof Date ? date : new Date(date), zone)
}

/** `allowedTimeSlotsOnDay` for a booking date: Saturday and Sunday offer FULL DAY and CUSTOM only. */
export function slotChoicesForDate(date: Date | string | number, policy?: OrgPayrollTimePolicy | null): BookingSlotChoice[] {
  return allowedTimeSlotsOnDay(bookingDayKey(date), policy, openOrganizationZone())
}

/** Whether a picker should offer this slot on the date. A slot already stored (a weekend AM / PM) is kept and shown. */
export function slotOfferedOnDate(
  slot: string,
  date: Date | string | number,
  policy?: OrgPayrollTimePolicy | null,
  stored?: string | null
): boolean {
  const kind = slot.toUpperCase().includes('FULL') ? 'FULL DAY' : slot.toUpperCase().includes('CUSTOM') ? 'CUSTOM' : slot.toUpperCase()
  if (stored && kind === String(stored).toUpperCase().replace(/_/g, ' ')) return true
  return (slotChoicesForDate(date, policy) as string[]).includes(kind)
}

/** The weekend Full day note for the date, else null. */
export function weekendNoteForDate(date: Date | string | number, policy?: OrgPayrollTimePolicy | null): string | null {
  return weekendFullDayNote(policy ?? null, bookingDayKey(date), openOrganizationZone())
}

/**
 * The confirm step before saving custom hours (`customHoursBreakWarning`): true to go ahead. Shows the rulebook
 * message only when the hours cover the unpaid break while the booking's Unpaid break toggle is on.
 */
export function confirmCustomHoursBreak(
  policy: OrgPayrollTimePolicy | null | undefined,
  date: Date | string | number,
  booking: CustomHoursBreakBooking
): boolean {
  const message = customHoursBreakWarning(policy ?? null, bookingDayKey(date), booking, openOrganizationZone())
  if (!message || typeof window === 'undefined') return true
  return window.confirm(message)
}
