import type { HolidayBooking } from '@/types'
import { calendarDayKey } from '@/lib/orgTime/organizationWeek'
import { bookingMatchesPerson, type AnnualLeavePerson } from './annualLeavePerson'
import { getDayKindForBookingsOnDayKey } from './dayStatus'

/**
 * Annual leave → Team "Who is off" calendar (owner decision 23 Nov: approved leave only, the same as iOS
 * `HolidayView.teamAway(on:)`). Display only: no new rule — each listed person (`annualLeaveTeamPeople`, via
 * `teamLeavePeople`) is away on a day when rulebook §9 `leaveDayKind` over their records (every id they go by,
 * `bookingMatchesPerson`) with the region's bank holidays is `approvedFull` or `approvedHalf`. Pending requests,
 * rejected leave and a weekend or bank holiday inside a multi-day record are not "away".
 */
export function teamAwayOnDay(
  day: Date,
  people: ReadonlyArray<AnnualLeavePerson>,
  bookings: ReadonlyArray<HolidayBooking>,
  nonWorkingDayKeys: ReadonlyArray<string> = []
): AnnualLeavePerson[] {
  // The calendar cell is the organisation's calendar date, so its key is read from the date itself (never shifted by
  // the browser's zone).
  const dayKey = calendarDayKey(day)
  return people.filter((person) => {
    const own = bookings.filter((booking) => bookingMatchesPerson(booking, person))
    const kind = getDayKindForBookingsOnDayKey(dayKey, own, nonWorkingDayKeys)
    return kind === 'approvedFull' || kind === 'approvedHalf'
  })
}

/** How a team calendar day is coloured: nobody away, one person (approved green), two or more (blue tint). */
export type TeamAwayTone = 'none' | 'one' | 'many'

export function teamAwayTone(count: number): TeamAwayTone {
  if (count >= 2) return 'many'
  if (count === 1) return 'one'
  return 'none'
}

export function teamAwayInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

/** The day's caption: the initials of up to the first two people away (as iOS), or null when nobody is. */
export function teamAwayCaption(names: ReadonlyArray<string>): string | null {
  if (names.length === 0) return null
  return names.slice(0, 2).map(teamAwayInitials).join(' ')
}
