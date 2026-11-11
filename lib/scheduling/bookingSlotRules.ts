/**
 * Web glue for the 1.13.0 booking slot rules (`lib/canonical/bookingSlots.ts`): the slots a picker offers on a day,
 * the weekend Full day note, and the custom-hours lunch-break confirm step. No rule lives here — only the Date → day
 * key conversion in the organisation zone and the browser confirm.
 */
import {
  allowedTimeSlotsOnDay,
  bookingDaysMixWeekdayAndWeekend,
  customHoursBreakWarning,
  isWeekendDayKey,
  organizationTimeZone,
  parsePayrollTimePolicyState,
  payrollTimePolicyTimeline,
  effectivePayrollTimePolicy,
  weekendBookingNotes,
  customHoursPrefillForDays,
  weekendBookingBreakdown,
  type BookingDayBreakdownRow,
  formatClockMinutes,
  halfDayWindows,
  type CustomHoursPrefill,
  type PayrollTimePolicyState,
  WEEKEND_WEEKDAY_MIX_MESSAGE,
  type BookingSlotChoice,
  type CustomHoursBreakBooking,
  payrollDayWindows,
  unpaidBreakAppliesOnDay,
} from '@/lib/canonical'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { useOrganizationDocumentStore } from '@/lib/stores/organizationDocumentStore'
import { useAuthStore } from '@/lib/stores/authStore'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'

function openOrganizationZone(): string {
  const data = useOrganizationDocumentStore.getState().data
  const country = data && typeof data.countryCode === 'string' ? data.countryCode : null
  return organizationTimeZone(country)
}

/**
 * The open organisation's working-hours state from the live document (`parsePayrollTimePolicyState`, promoted to
 * today with `payrollTimePolicyTimeline`), or null when the live document is not loaded for the open organisation.
 */
function livePayrollState(): PayrollTimePolicyState | null {
  const { organizationId, data } = useOrganizationDocumentStore.getState()
  const openId = useAuthStore.getState().organization?.id || ''
  if (!data || !openId || organizationId !== openId) return null
  const zone = openOrganizationZone()
  return payrollTimePolicyTimeline(parsePayrollTimePolicyState(data, zone), dayKeyInZone(new Date(), zone), zone)
}

/**
 * The working hours in effect on the booking day (`effectivePayrollTimePolicy`, rulebook §4.3): a scheduled change
 * counts from its own day. Falls back to the policy the screen passed when the live document is not loaded.
 */
function policyOnBookingDay(dayKey: string, fallback?: OrgPayrollTimePolicy | null): OrgPayrollTimePolicy | null {
  const state = livePayrollState()
  return state ? effectivePayrollTimePolicy(state, dayKey, openOrganizationZone()) : fallback ?? null
}

/** `policyForBookingDate` for an organisation day key already known (a week-grid calendar day, rulebook 1.37.0). */
export function policyForBookingDayKey(dayKey: string, fallback?: OrgPayrollTimePolicy | null): OrgPayrollTimePolicy | null {
  return policyOnBookingDay(dayKey, fallback)
}

/**
 * Rulebook 1.19.0: the working hours in effect on a booking date (history first, `effectivePayrollTimePolicy`), for
 * hours previews and breakdowns. Falls back to the policy the screen passed when the live document is not loaded.
 */
export function policyForBookingDate(
  date: Date | string | number,
  fallback?: OrgPayrollTimePolicy | null
): OrgPayrollTimePolicy | null {
  return policyOnBookingDay(bookingDayKey(date), fallback)
}

/**
 * Rulebook 1.19.0 (`unpaidBreakAppliesOnDay`): whether the booking day takes an unpaid break off — so whether a picker
 * offers the "Unpaid break" toggle. Monday–Friday the organisation break; Saturday / Sunday that day's own setting.
 */
export function unpaidBreakAppliesOnDate(date: Date | string | number, fallback?: OrgPayrollTimePolicy | null): boolean {
  const key = bookingDayKey(date)
  return unpaidBreakAppliesOnDay(policyOnBookingDay(key, fallback), key, openOrganizationZone())
}

/** Rulebook 1.19.0 (`payrollDayWindows`): the paid window and unpaid break an hours timeline draws for the date. */
export function payrollDayWindowsForDate(date: Date | string | number, fallback?: OrgPayrollTimePolicy | null) {
  const key = bookingDayKey(date)
  return payrollDayWindows(policyOnBookingDay(key, fallback), key, openOrganizationZone())
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

/**
 * Rulebook 1.17.0: the weekend note lines for the days a picker has selected (`weekendBookingNotes`): one
 * "Saturday/Sunday" line when both follow the same rule, else Saturday then Sunday; `[]` for weekdays. Each day is read
 * under the working hours in effect on that day.
 */
export function weekendNotesForDates(
  dates: ReadonlyArray<Date | string | number>,
  policy?: OrgPayrollTimePolicy | null
): string[] {
  const keys = dates.map((date) => bookingDayKey(date))
  return weekendBookingNotes(livePayrollState() ?? policy ?? null, keys, openOrganizationZone())
}

/** Whether the date is a Saturday or Sunday in the organisation zone (custom hours only). */
export function isWeekendDate(date: Date | string | number): boolean {
  return isWeekendDayKey(bookingDayKey(date), openOrganizationZone())
}

/**
 * Rulebook 1.18.0: the custom-hours pair for the dates a picker has selected and what kind of selection it is
 * (`customHoursPrefillForDays`): weekend only → the first Saturday's window (else the first Sunday's), weekday only →
 * the standard day in effect on the first day, `none` for a refused weekday + weekend mix, null for no dates. Each day
 * is read under the working hours in effect on it. A picker re-applies it when `kind` changes, not on every click.
 */
export function customHoursPrefillForDates(
  dates: ReadonlyArray<Date | string | number>,
  policy?: OrgPayrollTimePolicy | null
): CustomHoursPrefill | null {
  const keys = dates.map((date) => bookingDayKey(date))
  return customHoursPrefillForDays(livePayrollState() ?? policy ?? null, keys, openOrganizationZone())
}

/**
 * The custom-hours editor's starting times for one date (`customHoursPrefillForDays` for that day): a set-window
 * weekend day's window, else the organisation's standard day in effect on it. A prefill only.
 */
export function customHoursPrefillForDate(
  date: Date | string | number,
  policy?: OrgPayrollTimePolicy | null
): { start: string; end: string } {
  const prefill = customHoursPrefillForDates([date], policy)
  if (prefill) return { start: prefill.start, end: prefill.end }
  // Not a valid day: the canonical standard day (`halfDayWindows`), never a window computed here.
  const day = halfDayWindows(policy ?? null).day
  return { start: formatClockMinutes(day.start), end: formatClockMinutes(day.end) }
}

/**
 * Rulebook 1.18.0: the per-day hours rows for a booking whose selection holds a Saturday or Sunday
 * (`weekendBookingBreakdown`: each day priced by the timesheet pay rule under the working hours in effect on it), or
 * `[]` for a weekday-only selection, where the screen keeps its usual hours breakdown.
 */
export function weekendBreakdownForDates(
  dates: ReadonlyArray<Date | string | number>,
  start: string | null | undefined,
  end: string | null | undefined,
  breakRemoved: boolean | null | undefined,
  policy?: OrgPayrollTimePolicy | null
): BookingDayBreakdownRow[] {
  const zone = openOrganizationZone()
  const keys = dates.map((date) => bookingDayKey(date))
  if (!keys.some((key) => isWeekendDayKey(key, zone))) return []
  return weekendBookingBreakdown(livePayrollState() ?? policy ?? null, keys, start, end, breakRemoved, zone)
}

/** `WEEKEND_WEEKDAY_MIX_MESSAGE` when the dates mix weekdays and weekend days (`bookingDaysMixWeekdayAndWeekend`). */
export function weekendWeekdayMixMessage(dates: ReadonlyArray<Date | string | number>): string | null {
  const zone = openOrganizationZone()
  const keys = dates.map((date) => bookingDayKey(date))
  return bookingDaysMixWeekdayAndWeekend(keys, zone) ? WEEKEND_WEEKDAY_MIX_MESSAGE : null
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
  const key = bookingDayKey(date)
  const message = customHoursBreakWarning(policyOnBookingDay(key, policy), key, booking, openOrganizationZone())
  if (!message || typeof window === 'undefined') return true
  return window.confirm(message)
}
