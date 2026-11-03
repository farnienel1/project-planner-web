/**
 * Rulebook 1.16.0 §5 / §9: annual leave on the days being booked. Inputs only — the rule is the canonical
 * `bookingLeaveConflicts`; this file maps the web stores onto it (leave through `holidayBookingLabourInput`, the
 * organisation's standard day from its payroll policy, the roster through `rulebookRoster`).
 */
import { bookingLeaveConflicts, type BookingLeaveConflict } from '@/lib/canonical'
import { holidayBookingLabourInput } from '@/lib/annualLeave/holidayDayKeys'
import { rulebookRoster } from '@/lib/staff/rulebookPeople'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import type { HolidayBooking, User } from '@/types'

export type LeaveConflictPerson = {
  /** The id the booking flow uses for this person (operative row id or users id). */
  id: string
  userId?: string | null
  operativeIds?: ReadonlyArray<string> | null
  email?: string | null
}

export function leaveConflictsForBooking(input: {
  people: ReadonlyArray<LeaveConflictPerson>
  dayKeys: ReadonlyArray<string>
  holidays: ReadonlyArray<HolidayBooking>
  users: ReadonlyArray<User>
  payrollPolicy?: OrgPayrollTimePolicy | null
  timeZone?: string | null
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
}): BookingLeaveConflict[] {
  if (input.holidays.length === 0 || input.people.length === 0 || input.dayKeys.length === 0) return []
  return bookingLeaveConflicts({
    people: input.people.map((person) => ({
      id: person.id,
      userId: person.userId ?? null,
      operativeIds: person.operativeIds ?? null,
      email: person.email ?? null,
    })),
    dayKeys: input.dayKeys,
    holidays: input.holidays.map((holiday) => ({
      ...holidayBookingLabourInput(holiday, input.timeZone),
      status: String(holiday.status ?? ''),
    })),
    timeZone: input.timeZone ?? null,
    timeSlot: input.timeSlot ?? null,
    workStartTime: input.workStartTime ?? null,
    workEndTime: input.workEndTime ?? null,
    day: input.payrollPolicy ?? null,
    roster: rulebookRoster(input.users),
  })
}

/** "Annual leave booked · AM" / "Annual leave requested · Full day". */
export function leaveConflictDetail(row: Pick<BookingLeaveConflict, 'label' | 'leaveSlot'>): string {
  const slot = row.leaveSlot === 'FULL DAY' ? 'Full day' : row.leaveSlot
  return `${row.label} · ${slot}`
}
