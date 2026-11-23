/**
 * The Daily Overview booking sheet's slot choice (owner bug 23 Nov: a weekday Full day could not be chosen, and
 * saving a Full day booking turned it into Custom).
 *
 * Rulebook §4.3 (1.13.0, 1.20.0): every booking picker offers `allowedTimeSlotsOnDay` — Full day and Custom on a
 * weekday, Custom only on Saturday and Sunday — and a stored AM / PM (or a stored weekend Full day) keeps its own slot
 * offered. The options come from `slotOfferedOnDate` (built on `allowedTimeSlotsOnDay`), the same filter as the
 * scheduling Edit Booking sheet (`components/schedule/BookingEditSheet.tsx`). The fields written mirror that sheet:
 * a named slot is saved with no clock times and no break removal; Custom hours with the times on screen.
 */
import { slotOfferedOnDate } from '@/lib/scheduling/bookingSlotRules'
import type { ScheduleSlotChoice } from '@/lib/scheduling/scheduleUtils'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'

export type SheetBookingCollection = 'bookings' | 'managerSiteBookings'

export const SHEET_SLOT_OPTIONS: ReadonlyArray<{ value: ScheduleSlotChoice; label: string }> = [
  { value: 'AM', label: 'Morning (AM)' },
  { value: 'PM', label: 'Afternoon (PM)' },
  { value: 'FULL DAY', label: 'Full day' },
  { value: 'CUSTOM', label: 'Custom hours' },
]

/**
 * The stored slot as the sheet's choice. A booking stored with no slot word reads as Custom when it has both clock
 * times (it has always been saved as custom hours here), else Full day.
 */
export function sheetSlotChoiceFromRaw(
  raw: string | null | undefined,
  times?: { workStartTime?: string | null; workEndTime?: string | null }
): ScheduleSlotChoice {
  const compact = String(raw ?? '').toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!compact) return times?.workStartTime && times?.workEndTime ? 'CUSTOM' : 'FULL DAY'
  if (compact === 'AM' || compact.includes('MORNING')) return 'AM'
  if (compact === 'PM' || compact.includes('AFTERNOON')) return 'PM'
  if (compact.includes('CUSTOM')) return 'CUSTOM'
  return 'FULL DAY'
}

/** The slot buttons offered on that day: the rulebook's day slots plus the booking's own stored slot. */
export function sheetSlotOptions(
  date: Date | string | number,
  policy: OrgPayrollTimePolicy | null | undefined,
  stored: ScheduleSlotChoice
): Array<{ value: ScheduleSlotChoice; label: string }> {
  return SHEET_SLOT_OPTIONS.filter((opt) => slotOfferedOnDate(opt.value, date, policy, stored))
}

/** The stored slot word for the collection the booking is written to (labour `FULL DAY`, manager site `FULL_DAY`). */
export function sheetTimeSlotWord(choice: ScheduleSlotChoice, collection: SheetBookingCollection): string {
  if (choice === 'CUSTOM') return 'CUSTOM_HOURS'
  if (choice === 'FULL DAY') return collection === 'managerSiteBookings' ? 'FULL_DAY' : 'FULL DAY'
  return choice
}

/**
 * The slot fields an edit writes: Custom hours carry the clock times and the break toggle; a named slot carries no
 * clock times and no break removal (as `BookingEditSheet` saves it).
 */
export function sheetSlotWriteFields(
  choice: ScheduleSlotChoice,
  collection: SheetBookingCollection,
  hours: { workStartTime: string; workEndTime: string; isBreakRemoved: boolean }
): { timeSlot: string; workStartTime: string | undefined; workEndTime: string | undefined; isBreakRemoved: boolean } {
  const timeSlot = sheetTimeSlotWord(choice, collection)
  if (choice === 'CUSTOM') {
    return { timeSlot, workStartTime: hours.workStartTime, workEndTime: hours.workEndTime, isBreakRemoved: hours.isBreakRemoved }
  }
  return { timeSlot, workStartTime: undefined, workEndTime: undefined, isBreakRemoved: false }
}
