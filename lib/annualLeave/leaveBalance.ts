import {
  annualLeaveBalance,
  annualLeaveBankHolidayRange,
  applyRemainingOverride,
  canViewPersonPay,
  isPlatformOwnerEmail,
  type AnnualLeaveBankHolidayRange,
  type AnnualLeaveBalance,
  type EmploymentTypeUser,
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
  > | null
  /**
   * Rulebook 1.40.0: the person's employment-type fields from their pay record (`useLeaveEmployment` /
   * `annualLeaveEmploymentInput`), never the users document alone; null when it could not be read.
   */
  employment: EmploymentTypeUser | null
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
    employment: input.employment,
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
    | 'employmentStartDate'
  > | null
  bookings: HolidayBooking[]
  /**
   * Rulebook 1.40.0: the person's employment-type fields from their pay record (`useLeaveEmployment` /
   * `annualLeaveEmploymentInput`), never the users document alone; null when it could not be read (the whole year
   * counts, as before 1.40.0).
   */
  employment: EmploymentTypeUser | null
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
    employment: input.employment,
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

/**
 * Rulebook 1.40.0 (review r306 #2): whether a balance's notes may name the person's employment type — the viewer may
 * see the person's pay (`canViewPersonPay`, profile context: the person, admins, an Operatives manager for an
 * operative, the platform owner). Anyone else sees the same figures with neutral notes (`annualLeaveBalanceNotes`).
 */
export function leaveBalanceShowsEmploymentType(
  viewer: User | null | undefined,
  subject: User | null | undefined,
  users: ReadonlyArray<User>
): boolean {
  if (!viewer || !subject) return false
  return canViewPersonPay({ ...viewer, isPlatformOwner: isPlatformOwnerEmail(viewer.email) } as never, subject as never, users as never)
}
