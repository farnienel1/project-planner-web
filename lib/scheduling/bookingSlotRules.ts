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
  weekendCustomHoursDefault,
  type PayrollTimePolicyState,
  WEEKEND_WEEKDAY_MIX_MESSAGE,
  type BookingSlotChoice,
  type CustomHoursBreakBooking,
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
 * The custom-hours editor's starting times for the date (`weekendCustomHoursDefault`: a set-window weekend day's
 * window), else the organisation's standard day. A prefill only.
 */
export function customHoursPrefillForDate(
  date: Date | string | number,
  policy?: OrgPayrollTimePolicy | null
): { start: string; end: string } {
  const key = bookingDayKey(date)
  const dayPolicy = policyOnBookingDay(key, policy)
  const weekend = weekendCustomHoursDefault(dayPolicy, key, openOrganizationZone())
  return weekend ?? { start: dayPolicy?.standardDayStart || '07:30', end: dayPolicy?.standardDayEnd || '16:00' }
}

/**
 * The one pair of times a multi-day picker opens custom hours with: the first selected Saturday's
 * (`customHoursPrefillForDate`), else the first selected day's. Each day's own default is
 * `customHoursPrefillForDate`; a picker that keeps one time pair for the request saves that pair on every day.
 */
export function customHoursPrefillForDates(
  dates: ReadonlyArray<Date | string | number>,
  policy?: OrgPayrollTimePolicy | null
): { start: string; end: string } {
  const zone = openOrganizationZone()
  const keyed = dates.map((date) => ({ date, key: bookingDayKey(date) })).sort((a, b) => a.key.localeCompare(b.key))
  const saturday = keyed.find(({ key }) => isWeekendDayKey(key, zone) && new Date(`${key}T12:00:00Z`).getUTCDay() === 6)
  const first = saturday ?? keyed[0]
  return customHoursPrefillForDate(first ? first.date : new Date(), policy)
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
