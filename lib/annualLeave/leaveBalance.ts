import {
  annualLeaveBalance,
  annualLeaveBankHolidayRange,
  applyRemainingOverride,
  type AnnualLeaveBankHolidayRange,
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

/**
 * Rulebook 1.35.0: the bank-holiday range `userLeaveBalance` needs for this person
 * (`annualLeaveBankHolidayRange`: the previous leave year's start to the current one's end, for carry-over).
 */
export function userLeaveBankHolidayRange(input: {
  user: Pick<
    User,
    | 'annualLeaveEnabled'
    | 'annualLeaveYearStartMonth'
    | 'annualLeaveYearEndMonth'
    | 'employmentType'
    | 'employmentTypeTransitionFrom'
    | 'employmentTypeEffectiveAt'
  > | null
  orgDefaults?: OrgAnnualLeaveDefaults | null
  now?: Date
  timeZone?: string | null
}): AnnualLeaveBankHolidayRange {
  const defaults = input.orgDefaults ?? DEFAULT_ANNUAL_LEAVE
  const timeZone = organizationZoneOr(input.timeZone)
  return annualLeaveBankHolidayRange({
    annualLeaveEnabled: input.user?.annualLeaveEnabled,
    startMonth: input.user?.annualLeaveYearStartMonth,
    endMonth: input.user?.annualLeaveYearEndMonth,
    orgStartMonth: defaults.startMonth,
    orgEndMonth: defaults.endMonth,
    onDayKey: dayKeyInZone(input.now ?? new Date(), timeZone),
    timeZone,
    employment: leaveEmployment(input.user),
  })
}

/**
 * Rulebook 1.40.0 (§4.4, G25–G27): the person's employment-type fields — the allowance applies only on days they are
 * PAYE (`employmentTypeOnDay`); a missing type reads as self-employed (rulebook §8).
 */
export function leaveEmployment(
  user: Pick<User, 'employmentType' | 'employmentTypeTransitionFrom' | 'employmentTypeEffectiveAt'> | null | undefined
) {
  return {
    employmentType: user?.employmentType ?? null,
    employmentTypeTransitionFrom: user?.employmentTypeTransitionFrom ?? null,
    employmentTypeEffectiveAt: user?.employmentTypeEffectiveAt ?? null,
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
    | 'employmentType'
    | 'employmentTypeTransitionFrom'
    | 'employmentTypeEffectiveAt'
  > | null
  bookings: HolidayBooking[]
  /** Rulebook 1.40.0: the person's manual adjustments (`useAnnualLeaveAdjustments`); this leave year's count. */
  adjustments?: ReadonlyArray<{ days: number; yearKey: string }>
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
    // Rulebook 1.40.0: PAYE days only; adjustments on top for this leave year.
    employment: leaveEmployment(user),
    adjustments: input.adjustments ?? [],
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
