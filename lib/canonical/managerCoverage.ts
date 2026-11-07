/**
 * Rulebook 1.22.0 (§6): a person's booked cover on one day — every labour and manager site booking they have that day
 * (each id they go by; the caller filters by person and day) merged into one figure, used by Book labour to decide
 * who is still free and by any screen that shows "booked Xh of Yh".
 *
 * - **Covered** is `standardDayCoverage` — the same rule as `unbookedLabourRowsOnDay` (Daily Overview) and
 *   unbooked-labour warnings: every minute of the standard day except the lunch-break window is booked. So nobody
 *   is offered in Book labour whom Daily Overview shows as booked, and the reverse.
 * - **Paid hours** merge the bookings' clock intervals (`slotInterval`, `mergeMinuteIntervals`; touching blocks join)
 *   and price each merged block once with `payrollHoursResult` under the policy in effect that day — hours worked,
 *   never multiplied, with the unpaid break taken off once, by the pay rule, only where a block covers the break
 *   window. A FULL DAY with no clock times, or blocks spanning the whole standard day, is the weekday paid day
 *   (`weekdayPaidHours`). Overlapping bookings are never counted twice.
 *
 * Before 1.22.0 iOS `ManagerScheduleInterval.combinedPaidBookedHours` took the standard break off any day not fully
 * covered (even 06:00–09:00) and Book labour on iOS compared paid hours with the paid day, while web compared
 * standard-day coverage; the two apps offered different people.
 */

import { formatClockMinutes, mergeMinuteIntervals, namedSlotKind, slotInterval, standardDayCoverage, standardDayWindow, type MinuteInterval } from './engine'
import { weekdayPaidHours, type OrgPayrollTimePolicy } from './organizationSettings'
import { payrollHoursResult } from './payrollHours'
import { bookingStandardDayOn } from './payrollPolicySchedule'

export type CoverageBooking = {
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
  isBreakRemoved?: boolean | null
}

export type ManagerCoverageHours = {
  /** The weekday paid day (`weekdayPaidHours`). */
  paidDayHours: number
  /** Hours worked across the merged bookings, the unpaid break taken off once; overlaps count once. */
  paidHours: number
  /** The merged clock blocks, minutes from midnight. */
  blocks: MinuteInterval[]
  /** `standardDayCoverage` of the bookings. */
  requiredHours: number
  coveredHours: number
  missingHours: number
  /** Every minute of the standard day (lunch window excepted) is booked. */
  covered: boolean
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Booked cover for one person on one organisation-zone day (`dayKey`), under the policy in effect that day. */
export function managerCoverageHours(input: {
  bookings: ReadonlyArray<CoverageBooking> | null | undefined
  dayKey: string
  policy: OrgPayrollTimePolicy
  timeZone?: string | null
}): ManagerCoverageHours {
  const bookings = (input.bookings || []).filter(Boolean)
  const policy = input.policy
  const paidDay = Math.max(Number(weekdayPaidHours(policy)) || 0, 0)
  const coverage = standardDayCoverage(policy, bookings.map((booking) => ({ ...booking })))
  const covered = bookings.length > 0 && coverage.missingHours <= 0.001
  const intervals: Array<MinuteInterval & { noBreak: boolean }> = []
  for (const booking of bookings) {
    const interval = slotInterval(booking, policy)
    if (interval) intervals.push({ ...interval, noBreak: booking.isBreakRemoved === true })
  }
  const blocks = mergeMinuteIntervals(intervals).map((block) => ({ start: block.start, end: block.end }))
  const base = {
    paidDayHours: round2(paidDay),
    blocks,
    requiredHours: coverage.requiredHours,
    coveredHours: coverage.coveredHours,
    missingHours: coverage.missingHours,
    covered,
  }
  if (bookings.length === 0) return { ...base, paidHours: 0 }
  const plainFullDay = bookings.some(
    (booking) =>
      namedSlotKind(booking.timeSlot) === 'FULL_DAY' &&
      !String(booking.workStartTime ?? '').trim() &&
      !String(booking.workEndTime ?? '').trim()
  )
  const day = standardDayWindow(policy)
  const spansDay = blocks.some((block) => block.start <= day.start && block.end >= day.end)
  if (plainFullDay || spansDay) return { ...base, paidHours: round2(paidDay) }
  let paid = 0
  for (const block of blocks) {
    const noBreak = intervals.some((row) => row.noBreak && row.start < block.end && row.end > block.start)
    const result = payrollHoursResult({
      booking: {
        timeSlot: 'CUSTOM',
        workStartTime: formatClockMinutes(block.start),
        workEndTime: formatClockMinutes(block.end > 24 * 60 ? block.end - 24 * 60 : block.end),
        isBreakRemoved: noBreak,
      },
      dayKey: input.dayKey,
      policy,
      timeZone: input.timeZone,
    })
    paid += result.workedHours
  }
  return { ...base, paidHours: round2(paid) }
}

/**
 * Rulebook 1.35.0 §12 (owner Q1 = a, 7 Nov): the hours a person worked on one organisation-zone day across all
 * their bookings — clock time less the unpaid break, never multiplied — with overlapping (or touching) bookings
 * counted once. Unlike `managerCoverageHours.paidHours` there is no cap at the weekday paid day: a block that spans
 * the whole standard day (06:00–18:00) is its real hours, and a Saturday or Sunday named slot is that day's own
 * window (`bookingStandardDayOn`). A booking that overlaps nothing is priced on its own by `payrollHoursResult`
 * (`workedHours`); bookings that overlap are merged (`mergeMinuteIntervals`) and the block priced once as custom
 * hours, the unpaid break taken off where the block covers it unless one of them has "No unpaid break".
 */
export function bookedWorkedHours(input: {
  bookings: ReadonlyArray<CoverageBooking> | null | undefined
  dayKey: string
  policy: OrgPayrollTimePolicy
  timeZone?: string | null
}): number {
  const bookings = (input.bookings || []).filter(Boolean)
  if (bookings.length === 0) return 0
  const policy = input.policy
  const dayInput = bookingStandardDayOn(policy, input.dayKey) ?? policy
  const priced = (booking: CoverageBooking) =>
    payrollHoursResult({ booking: { ...booking }, dayKey: input.dayKey, policy, timeZone: input.timeZone }).workedHours
  const withInterval: Array<{ booking: CoverageBooking; interval: MinuteInterval }> = []
  let worked = 0
  for (const booking of bookings) {
    const interval = slotInterval(booking, dayInput)
    if (interval && interval.end > interval.start) withInterval.push({ booking, interval })
    else worked += priced(booking)
  }
  for (const block of mergeMinuteIntervals(withInterval.map((row) => row.interval))) {
    const inside = withInterval.filter((row) => row.interval.start < block.end && row.interval.end > block.start)
    if (inside.length === 1) {
      worked += priced(inside[0].booking)
      continue
    }
    worked += payrollHoursResult({
      booking: {
        timeSlot: 'CUSTOM',
        workStartTime: formatClockMinutes(block.start),
        workEndTime: formatClockMinutes(block.end > 24 * 60 ? block.end - 24 * 60 : block.end),
        isBreakRemoved: inside.some((row) => row.booking.isBreakRemoved === true),
      },
      dayKey: input.dayKey,
      policy,
      timeZone: input.timeZone,
    }).workedHours
  }
  return round2(worked)
}
