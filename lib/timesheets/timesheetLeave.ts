/**
 * Approved annual leave shown on a timesheet period (`timesheetLeaveLines`).
 * Information rows only: no hours, no pay, no edit, never on the invoice.
 */
import type { HolidayBooking, Operative, User } from '@/types'
import { bookingIdsForAccount, timesheetLeaveLines, type TimesheetLeaveLine } from '@/lib/canonical'
import { dayKey } from '@/lib/ios-parity/londonTime'

/** Holiday records that belong to this account (its ids, former / same-email ids, and email-linked operatives). */
export function holidayBookingsForAccount(
  user: Pick<User, 'id' | 'email' | 'formerUserIds'>,
  holidays: ReadonlyArray<HolidayBooking>,
  operatives: ReadonlyArray<Operative>,
  aliasUserIds: ReadonlyArray<string> = []
): HolidayBooking[] {
  const ids = new Set(
    bookingIdsForAccount(
      { id: user.id, email: user.email, formerIds: user.formerUserIds ?? [], aliasIds: [...aliasUserIds] },
      operatives
    ).map((id) => id.toLowerCase())
  )
  return holidays.filter((holiday) => {
    const userId = String(holiday.userId || '').trim().toLowerCase()
    const operativeId = String(holiday.operativeId || '').trim().toLowerCase()
    return (userId && ids.has(userId)) || (operativeId && ids.has(operativeId))
  })
}

export function timesheetLeaveLinesForAccount({
  user,
  holidays,
  operatives,
  aliasUserIds = [],
  periodStart,
  periodEnd,
  timeZone,
  bankHolidayDayKeys = [],
}: {
  user: Pick<User, 'id' | 'email' | 'formerUserIds'>
  holidays: ReadonlyArray<HolidayBooking>
  operatives: ReadonlyArray<Operative>
  aliasUserIds?: ReadonlyArray<string>
  periodStart: Date
  periodEnd: Date
  timeZone: string
  bankHolidayDayKeys?: ReadonlyArray<string>
}): TimesheetLeaveLine[] {
  const records = holidayBookingsForAccount(user, holidays, operatives, aliasUserIds).map((holiday) => ({
    id: holiday.id,
    startDayKey: dayKey(holiday.startDate, timeZone),
    endDayKey: dayKey(holiday.endDate, timeZone),
    timeSlot: holiday.timeSlot,
    status: holiday.status,
  }))
  return timesheetLeaveLines(
    records,
    { startDayKey: dayKey(periodStart, timeZone), endDayKey: dayKey(periodEnd, timeZone) },
    timeZone,
    bankHolidayDayKeys
  )
}
