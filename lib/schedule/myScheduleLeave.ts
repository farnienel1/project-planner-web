/**
 * My Schedule annual leave (rulebook §10): the signed-in person's own leave, approved and pending (marked pending),
 * matched by account (`leaveRecordsForAccount`: every id of the account and its email), never by name. A multi-day record
 * follows `leaveRecordDayKeys`. iOS `MyScheduleView.annualLeaveDisplayLabel(on:)`.
 *
 * Both web My Schedule screens use it: the read-only screen (operatives) and the self-booking screen (admins and
 * timesheet managers). Before 1.12.2 the self-booking screen never loaded leave, so an admin's approved leave showed
 * in Daily Overview but not in My Schedule.
 */
import { formatClockMinutes, leaveHalfDayWindows, leaveRecordDayKeys, leaveRecordsForAccount, type StandardDayInput } from '@/lib/canonical'
import { dayKey } from '@/lib/ios-parity/londonTime'
import { holidayBookingDayKeys } from '@/lib/annualLeave/holidayDayKeys'
import type { HolidayBooking, Operative, User } from '@/types'

/**
 * The label for one day of the given (already account-matched) leave records, or null. With the working day in effect
 * that day (`dayPolicy`), a half day carries its clock range from `leaveHalfDayWindows` (rulebook 1.20.0 §9: the exact
 * middle of the day), e.g. "Annual Leave - AM (06:30–10:30)".
 */
export function myScheduleAnnualLeaveLabel(
  holidays: ReadonlyArray<HolidayBooking>,
  day: Date,
  timeZone?: string,
  dayPolicy?: StandardDayInput | null
): string | null {
  const key = dayKey(day, timeZone)
  const match = holidays
    .filter((holiday) => holiday.status !== 'rejected')
    .filter((holiday) => leaveRecordDayKeys(holidayBookingDayKeys(holiday, timeZone), timeZone).includes(key))
    .sort((a, b) => (a.status === b.status ? a.startDate.getTime() - b.startDate.getTime() : a.status === 'approved' ? -1 : 1))[0]
  if (!match) return null
  let slot = match.timeSlot === 'AM' ? 'AM' : match.timeSlot === 'PM' ? 'PM' : 'Full Day'
  if (dayPolicy && slot !== 'Full Day') {
    const halves = leaveHalfDayWindows(dayPolicy)
    const window = slot === 'AM' ? halves.am : halves.pm
    slot = `${slot} (${formatClockMinutes(window.start)}–${formatClockMinutes(window.end)})`
  }
  return match.status === 'pending' ? `Pending annual leave - ${slot}` : `Annual Leave - ${slot}`
}

/** The account's leave records (every id of the account: its id, former ids, same-email aliases, operative rows). */
export function myScheduleLeaveRecords(
  account: Pick<User, 'id' | 'email' | 'formerUserIds'> | null | undefined,
  holidays: ReadonlyArray<HolidayBooking>,
  operatives: ReadonlyArray<Operative>,
  aliasUserIds: ReadonlyArray<string> = []
): HolidayBooking[] {
  if (!account) return []
  return leaveRecordsForAccount(
    holidays,
    { id: account.id, email: account.email, formerIds: account.formerUserIds ?? [], aliasIds: [...aliasUserIds] },
    operatives
  )
}
