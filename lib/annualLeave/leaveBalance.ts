import {
  annualLeaveBalance,
  applyRemainingOverride,
  type AnnualLeaveBalance,
  type LeaveDayRecord,
} from '@/lib/canonical'
import { dayKeyInZone } from '@/lib/orgTime/zoneTime'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import type { HolidayBooking, User } from '@/types'
import type { OrgAnnualLeaveDefaults } from '@/lib/settings/organizationSettings'
import { DEFAULT_ANNUAL_LEAVE } from '@/lib/settings/organizationSettings'
import { holidayBookingDayKeys } from '@/lib/annualLeave/holidayDayKeys'

/** Day keys in the organisation business zone (rulebook §1), never London unless that is the organisation's zone. */
export function holidayToLeaveDay(booking: HolidayBooking, timeZone?: string | null): LeaveDayRecord {
  return {
    ...holidayBookingDayKeys(booking, organizationZoneOr(timeZone)),
    timeSlot: booking.timeSlot,
    status: booking.status,
  }
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
    | 'employmentStartDate'
  > | null
  bookings: HolidayBooking[]
  orgDefaults?: OrgAnnualLeaveDefaults | null
  now?: Date
  /** Bank holidays inside a multi-day record are not taken from the allowance. */
  bankHolidayDayKeys?: ReadonlyArray<string>
  /** Organisation business zone; defaults to the open organisation's zone. */
  timeZone?: string | null
}): AnnualLeaveBalance {
  const defaults = input.orgDefaults ?? DEFAULT_ANNUAL_LEAVE
  const user = input.user
  const timeZone = organizationZoneOr(input.timeZone)
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
    bookings: input.bookings.map((booking) => holidayToLeaveDay(booking, timeZone)),
    onDayKey: dayKeyInZone(input.now ?? new Date(), timeZone),
    nonWorkingDayKeys: input.bankHolidayDayKeys ?? [],
    // Rulebook 1.13.0 (Q4): pro rata in the year joined; carry-over capped by the organisation setting.
    employmentStartDayKey: user?.employmentStartDate ?? null,
    maxCarryOverDays: defaults.maxCarryOverDays ?? null,
    timeZone,
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
