/**
 * Annual leave against a booking being made (rulebook 1.16.0, §5 and §9).
 *
 * When someone books people onto days, every (person, day) that falls on that person's annual leave is listed next
 * to the double-booking conflicts, so the booker ticks to confirm or drops the day before the booking saves. This is
 * the booking-time partner of `leaveCoverageRows` (which warns after the booking exists).
 *
 * - Approved leave conflicts with the booking when the leave window overlaps the booking interval: full-day leave
 *   conflicts with any booking; AM leave with a booking that touches the AM half; PM leave likewise. AM leave and a
 *   PM booking do not conflict. Custom hours conflict with half-day leave when the interval overlaps that half.
 *   1.20.0: the halves are the leave halves (`leaveHalfDayWindows`: the exact middle of the day, ignoring the break —
 *   06:30–14:30 → AM 06:30–10:30), and a stored named AM / PM booking is that leave half (`leaveComparableInterval`). A booking with no interval (no slot, no times) conflicts with any leave.
 * - Pending leave is listed too, with `status: 'pending'` (shown softer). Rejected leave never is.
 * - People match leave by every id they go by (`personIdSet` over the roster, plus their `userId` and
 *   `operativeIds`), compared without case (`normalizeDocumentId`), like `leaveCoverageRows`.
 * - One row per (person, day): approved wins over pending; then full day over a half.
 *
 * Plain data in, plain data out. Apps parse leave with `parseHolidayDocument` / `labourHolidayInput` first.
 */

import { intervalsOverlap, leaveComparableInterval, leaveHalfDayWindows, type MinuteInterval, type StandardDayInput } from './engine'
import { idKey, idText, personIdSet, type PersonIdsInput, type PersonRosterRow } from './personIds'
import { leaveSlotKind } from './leaveCoverage'

/** The label a leave conflict row shows (purple; double bookings stay orange). */
export const ANNUAL_LEAVE_BOOKED_LABEL = 'Annual leave booked'
/** The label for pending leave (shown softer). */
export const ANNUAL_LEAVE_REQUESTED_LABEL = 'Annual leave requested'
/** The heading over a booking's conflict list when it holds double bookings and/or leave. */
export const BOOKING_CONFLICTS_HEADING = 'Some selected days clash. Tick to confirm, or ✕ to drop that day.'

export type BookingLeaveSlot = 'FULL DAY' | 'AM' | 'PM'

export type BookingLeavePerson =
  | string
  | (PersonIdsInput & {
      id: string
      userId?: string | null
      operativeIds?: ReadonlyArray<string> | null
    })

export type BookingLeaveHoliday = {
  id: string
  userId?: string | null
  operativeId?: string | null
  startDayKey: string
  endDayKey: string
  timeSlot?: string | null
  /** `approved`, `pending` or `rejected` (`normalizeHolidayStatus`). Missing → `approved` flag. */
  status?: string | null
  approved?: boolean | null
}

export type BookingLeaveConflictInput = {
  people: ReadonlyArray<BookingLeavePerson>
  dayKeys: ReadonlyArray<string>
  holidays: ReadonlyArray<BookingLeaveHoliday> | null | undefined
  timeZone?: string | null
  /** The booking's slot (`FULL DAY`, `AM`, `PM`, `CUSTOM`, …). */
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  /** The organisation's standard day (`payrollTimePolicy` / `effectivePayrollTimePolicy`). */
  day?: StandardDayInput | null
  roster?: ReadonlyArray<PersonRosterRow> | null
}

export type BookingLeaveConflict = {
  /** The person id as given in `people`. */
  personId: string
  dayKey: string
  kind: 'annual_leave'
  leaveId: string
  leaveSlot: BookingLeaveSlot
  status: 'approved' | 'pending'
  label: string
}

function holidayStatus(holiday: BookingLeaveHoliday): 'approved' | 'pending' | null {
  const status = idKey(holiday.status)
  if (status === 'approved') return 'approved'
  if (status === 'pending') return 'pending'
  if (status === 'rejected') return null
  if (status) return null
  return holiday.approved === false ? null : 'approved'
}

function leaveSlot(timeSlot: string | null | undefined): BookingLeaveSlot {
  const kind = leaveSlotKind(timeSlot)
  return kind === 'AM' ? 'AM' : kind === 'PM' ? 'PM' : 'FULL DAY'
}

/**
 * Every (person, day) of a booking being made that falls on that person's annual leave, approved or pending, whose
 * leave window overlaps the booking slot. Sorted by day, then by the order of `people`.
 */
export function bookingLeaveConflicts(input: BookingLeaveConflictInput): BookingLeaveConflict[] {
  const holidays = (input?.holidays || []).filter(
    (holiday) => holiday && idText(holiday.startDayKey) && (idText(holiday.userId) || idText(holiday.operativeId))
  )
  if (holidays.length === 0) return []
  const days = Array.from(new Set((input.dayKeys || []).map(idText).filter(Boolean))).sort()
  if (days.length === 0) return []
  const windows = leaveHalfDayWindows(input.day)
  const booking: MinuteInterval | null = leaveComparableInterval(
    { timeSlot: input.timeSlot, workStartTime: input.workStartTime, workEndTime: input.workEndTime },
    input.day
  )
  const leaveWindow = (slot: BookingLeaveSlot): MinuteInterval =>
    slot === 'AM' ? windows.am : slot === 'PM' ? windows.pm : windows.day
  const overlaps = (slot: BookingLeaveSlot): boolean => {
    if (slot === 'FULL DAY' || booking === null) return true
    return intervalsOverlap(booking, leaveWindow(slot))
  }

  const people = (input.people || [])
    .map((person, index) => {
      const given = typeof person === 'string' ? { id: person } : person
      const personId = idText(given?.id)
      if (!personId) return null
      const keys = new Set(
        [
          ...personIdSet(given as PersonIdsInput, input.roster),
          idText((given as { userId?: string | null }).userId),
          ...(((given as { operativeIds?: ReadonlyArray<string> | null }).operativeIds) || []).map(idText),
        ]
          .map(idKey)
          .filter(Boolean)
      )
      return { personId, keys, index }
    })
    .filter((entry): entry is { personId: string; keys: Set<string>; index: number } => entry !== null)

  const best = new Map<string, BookingLeaveConflict & { index: number }>()
  const rank = (row: { status: string; leaveSlot: BookingLeaveSlot }) =>
    (row.status === 'approved' ? 2 : 0) + (row.leaveSlot === 'FULL DAY' ? 1 : 0)

  for (const holiday of holidays) {
    const status = holidayStatus(holiday)
    if (!status) continue
    const start = idText(holiday.startDayKey)
    const end = idText(holiday.endDayKey) || start
    const slot = leaveSlot(holiday.timeSlot)
    if (!overlaps(slot)) continue
    const holidayKeys = [idKey(holiday.userId), idKey(holiday.operativeId)].filter(Boolean)
    for (const person of people) {
      if (!holidayKeys.some((key) => person.keys.has(key))) continue
      for (const dayKey of days) {
        if (dayKey < start || dayKey > end) continue
        const row = {
          personId: person.personId,
          dayKey,
          kind: 'annual_leave' as const,
          leaveId: idText(holiday.id),
          leaveSlot: slot,
          status,
          label: status === 'approved' ? ANNUAL_LEAVE_BOOKED_LABEL : ANNUAL_LEAVE_REQUESTED_LABEL,
          index: person.index,
        }
        const key = `${idKey(person.personId)}|${dayKey}`
        const current = best.get(key)
        if (!current || rank(row) > rank(current)) best.set(key, row)
      }
    }
  }

  return [...best.values()]
    .sort((a, b) => (a.dayKey !== b.dayKey ? (a.dayKey < b.dayKey ? -1 : 1) : a.index - b.index))
    .map(({ index: _index, ...row }) => row)
}
