import {
  annualLeaveBalance,
  applyRemainingOverride,
  CANONICAL_TIME_ZONE,
  type AnnualLeaveBalance,
  type LeaveDayRecord,
} from '@/lib/canonical'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'

function leaveDayKey(date: Date): string {
  return dayKeyInZone(date, CANONICAL_TIME_ZONE)
}
import type { HolidayBooking, User } from '@/types'
import type { OrgAnnualLeaveDefaults } from '@/lib/settings/organizationSettings'
import { DEFAULT_ANNUAL_LEAVE } from '@/lib/settings/organizationSettings'

export function holidayToLeaveDay(booking: HolidayBooking): LeaveDayRecord {
  return {
    startDayKey: leaveDayKey(booking.startDate),
    endDayKey: leaveDayKey(booking.endDate),
    timeSlot: booking.timeSlot,
    status: booking.status,
  }
}

export function bookingsForPerson(
  bookings: HolidayBooking[],
  userId?: string | null,
  operativeId?: string | null
): HolidayBooking[] {
  return bookings.filter((booking) => {
    if (userId && (booking.userId === userId || booking.operativeId === userId)) return true
    if (operativeId && (booking.operativeId === operativeId || booking.userId === operativeId)) {
      return true
    }
    return false
  })
}

export function userLeaveBalance(input: {
  user: Pick<
    User,
    | 'annualLeaveEnabled'
    | 'annualLeaveDaysPerYear'
    | 'annualLeaveYearStartMonth'
    | 'annualLeaveYearEndMonth'
    | 'annualLeaveCarriesOver'
    | 'annualLeaveYearAllowance'
    | 'annualLeaveYearAllowanceKey'
  > | null
  bookings: HolidayBooking[]
  orgDefaults?: OrgAnnualLeaveDefaults | null
  now?: Date
}): AnnualLeaveBalance {
  const defaults = input.orgDefaults ?? DEFAULT_ANNUAL_LEAVE
  const user = input.user
  return annualLeaveBalance({
    annualLeaveEnabled: user?.annualLeaveEnabled,
    daysPerYear: user?.annualLeaveDaysPerYear,
    startMonth: user?.annualLeaveYearStartMonth,
    endMonth: user?.annualLeaveYearEndMonth,
    carriesOver: user?.annualLeaveCarriesOver,
    yearAllowance: user?.annualLeaveYearAllowance,
    yearAllowanceKey: user?.annualLeaveYearAllowanceKey,
    orgDaysPerYear: defaults.daysPerYear,
    orgStartMonth: defaults.startMonth,
    orgEndMonth: defaults.endMonth,
    bookings: input.bookings.map(holidayToLeaveDay),
    onDayKey: leaveDayKey(input.now ?? new Date()),
  })
}

export function remainingOverrideFromBalance(
  remaining: number,
  balance: AnnualLeaveBalance
) {
  return applyRemainingOverride({
    remaining,
    taken: balance.taken,
    pending: balance.pending,
    yearKey: balance.yearKey,
  })
}
