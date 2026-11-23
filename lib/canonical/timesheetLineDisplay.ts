/**
 * Rulebook 1.70.0 §8 (owner approved 23 Nov): how a booking line reads on a timesheet, on web and iOS alike. Display
 * only — it reads the line's stored text and never changes a stored field, an amount, hours, a fingerprint or a signed
 * snapshot's text.
 *
 * - `title`: the job number and the job's name ("J-1042 · Station Road"), or the place alone when the line is not on a
 *   job ("Office", "Working from home"). Jobs store one name (`siteName`, `parseJobDocument`); the collectors put it
 *   in the line's `projectName`. An overtime line keeps its " (Overtime)" suffix.
 * - `times`: the line's clock times (`timesheetLineClockText` of its details). A named slot with no clock times (a
 *   Full day, AM or PM line, stored as "FULL DAY", "AM", "PM") reads its window on that day — the standard day in
 *   effect that day, or a weekend day's own window (`bookingStandardDayOn`, `slotInterval`): "Full day 07:00–16:00".
 *   Anything else is shown as stored ("" when there is nothing).
 */

import { formatClockMinutes, slotInterval, type StandardDayInput } from './engine'
import { bookingStandardDayOn, type PayrollTimePolicyState } from './payrollPolicySchedule'
import { normalizeBookingTimeSlot } from './bookings'
import { timesheetLineClockText } from './payrollHours'
import type { OrgPayrollTimePolicy } from './organizationSettings'
import { signedTimesheetLineBookingKey } from './timesheetBookingChanges'

export type TimesheetLineDisplayInput = {
  jobNumber?: string | null
  /** The job's name (or the place's title) as the collector wrote it on the line. */
  projectName?: string | null
  details?: string | null
  /** The line's day key (organisation zone), for a named slot's window. */
  dayKey?: string | null
}

export type TimesheetLineDisplay = { title: string; times: string }

const NO_JOB_NUMBER = new Set(['', '—', '-', '–'])
const SLOT_LABELS: Record<string, string> = { 'FULL DAY': 'Full day', AM: 'AM', PM: 'PM' }

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function timesheetLineDisplay(
  line: TimesheetLineDisplayInput | null | undefined,
  day?: StandardDayInput | OrgPayrollTimePolicy | PayrollTimePolicyState | null
): TimesheetLineDisplay {
  const jobNumber = text(line?.jobNumber)
  const name = text(line?.projectName)
  const title = NO_JOB_NUMBER.has(jobNumber) ? name || 'Booking' : name ? `${jobNumber} · ${name}` : jobNumber
  const details = text(line?.details)
  const clock = timesheetLineClockText(details)
  if (/\d{1,2}:\d{2}/.test(clock)) return { title, times: clock }
  // 1.72.0: the slot is the part before " · " ("FULL DAY · no break"); the rest is kept after the window.
  const [head, ...rest] = details.split(' · ')
  const suffix = rest.length > 0 ? ` · ${rest.join(' · ')}` : ''
  const slot = normalizeBookingTimeSlot(head.trim())
  const label = slot ? SLOT_LABELS[slot] : undefined
  if (label) {
    const dayKey = text(line?.dayKey)
    const interval = day ? slotInterval({ timeSlot: slot }, bookingStandardDayOn(day, dayKey || null)) : null
    if (interval && interval.end > interval.start) {
      return { title, times: `${label} ${formatClockMinutes(interval.start)}–${formatClockMinutes(interval.end)}${suffix}` }
    }
    return { title, times: `${label}${suffix}` }
  }
  return { title, times: details }
}

// MARK: - 1.74.0 §8: the order lines are shown in, and the empty standard line of an all-overtime booking

/** A timesheet line as the display order reads it (a live payroll line, or a signed snapshot / invoice row). */
export type TimesheetLineOrderInput = {
  id?: unknown
  bookingId?: unknown
  bookingCollection?: unknown
  /** Organisation-zone day key of the line. */
  dayKey?: string | null
  isOvertimeLine?: boolean | null
  /** The line's paid hours and amount (an invoice row: its decided amount). */
  paidHours?: number | null
  amount?: number | null
  /** The booking's own clock times (live lines carry them when the booking has clock times). */
  bookingStartTime?: string | null
  bookingEndTime?: string | null
  details?: string | null
}

const EMPTY_LINE_EPSILON = 0.0001

function lineGroupKey(line: TimesheetLineOrderInput, index: number): string {
  const key = signedTimesheetLineBookingKey(line as never)
  return key || `line|${text(line.id) || String(index)}`
}

function clockMinutes(value: string): number | null {
  const match = value.match(/(\d{1,2}):(\d{2})/)
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return Number.isFinite(minutes) ? minutes : null
}

function numberOf(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Rulebook 1.74.0 §8 (owner report 23 Nov): the standard line of a booking that has NO standard part (every hour at a
 * multiplier — a weekend paid every hour at N×, or a booking wholly outside the working day) is 0h and £0 next to the
 * booking's overtime line. It is not shown: true when the line is a standard line, its paid hours and amount
 * (`effectiveAmount`, else its own amount) are 0, and another line of the same booking is an overtime line. Display
 * only — the line stays in every figure (`timesheetTotals` reads the booking's hours from it), so no total changes.
 */
export function timesheetLineIsEmptyStandardPart(
  line: TimesheetLineOrderInput,
  lines: ReadonlyArray<TimesheetLineOrderInput>,
  effectiveAmount?: ((line: TimesheetLineOrderInput) => number) | null,
  /**
   * Owner answer 23 Nov (choice 6): a reviewer decision that declines a line. When every overtime line of the booking
   * is declined, its empty standard line is NOT hidden — it stays, drawn declined (`timesheetLineShownDeclined`).
   * Missing = an overtime line is never declined (the invoice: declined rows are already left off).
   */
  isDeclined?: ((line: TimesheetLineOrderInput) => boolean) | null
): boolean {
  if (line.isOvertimeLine === true) return false
  if (Math.abs(numberOf(line.paidHours)) > EMPTY_LINE_EPSILON) return false
  const amount = effectiveAmount ? effectiveAmount(line) : numberOf(line.amount)
  if (Math.abs(amount) > EMPTY_LINE_EPSILON) return false
  const key = signedTimesheetLineBookingKey(line as never)
  if (!key) return false
  return lines.some(
    (other) =>
      other !== line &&
      other.isOvertimeLine === true &&
      signedTimesheetLineBookingKey(other as never) === key &&
      !(isDeclined && isDeclined(other))
  )
}

/**
 * Owner answer 23 Nov (choice 6): the 0h / £0 standard line of a booking whose every overtime line is declined is shown
 * with the declined look (struck through) on the review and the person's sheet — it pays nothing, like its overtime
 * line. True for such a line; false otherwise (its own review decides as usual). Display only.
 */
export function timesheetLineShownDeclined(
  line: TimesheetLineOrderInput,
  lines: ReadonlyArray<TimesheetLineOrderInput>,
  isDeclined: (line: TimesheetLineOrderInput) => boolean,
  effectiveAmount?: ((line: TimesheetLineOrderInput) => number) | null
): boolean {
  if (line.isOvertimeLine === true) return false
  // An empty standard line that would be hidden if its overtime were not declined…
  if (!timesheetLineIsEmptyStandardPart(line, lines, effectiveAmount)) return false
  // …and is not hidden because every overtime line of the booking is declined.
  return !timesheetLineIsEmptyStandardPart(line, lines, effectiveAmount, isDeclined)
}

/**
 * Rulebook 1.74.0 §8 (owner report 23 Nov): the order a timesheet shows its booking lines in, on the review, the
 * person's sheet, the sign screen, the invoice and its PDF, on web and iOS alike. Day by day; within a day booking by
 * booking — by the booking's start, then finish (an overnight finish after midnight), then its id — each booking's
 * standard line followed by its own overtime line(s): A, A overtime, B, B overtime. Lines that name no booking keep
 * their place after the bookings of their day. With `hideEmptyStandardParts` (default true) the 0h / £0 standard line of
 * a booking with no standard part is left out (`timesheetLineIsEmptyStandardPart`). Display only: nothing is re-priced
 * and the input lines are not changed. `day` (optional) gives a Full day / AM / PM line its window, as
 * `timesheetLineDisplay`, so it sorts by its clock start.
 */
export function timesheetLineDisplayOrder<T extends TimesheetLineOrderInput>(
  lines: ReadonlyArray<T> | null | undefined,
  options?: {
    hideEmptyStandardParts?: boolean
    effectiveAmount?: ((line: T) => number) | null
    /** Owner answer 23 Nov (choice 6): with every overtime line declined, the empty standard line stays (shown declined). */
    isDeclined?: ((line: T) => boolean) | null
    day?: (dayKey: string) => StandardDayInput | OrgPayrollTimePolicy | PayrollTimePolicyState | null | undefined
  }
): T[] {
  const all = (lines ?? []).filter(Boolean) as T[]
  const hide = options?.hideEmptyStandardParts !== false
  const effective = options?.effectiveAmount ?? null
  // A group's start comes from the booking's own clock times, else a standard line's times; an overtime line's own
  // clock range is used only when nothing better is known (an all-overtime booking on a signed snapshot or invoice,
  // which has no standard row), so it still sorts by its start.
  const groups = new Map<string, { start: number; end: number; named: boolean; fromOvertime: boolean }>()
  all.forEach((line, index) => {
    const key = `${text(line.dayKey)}|${lineGroupKey(line, index)}`
    const named = Boolean(signedTimesheetLineBookingKey(line as never))
    let start = clockMinutes(text(line.bookingStartTime))
    let end = clockMinutes(text(line.bookingEndTime))
    let fromOvertime = false
    if (start == null) {
      const dayKey = text(line.dayKey)
      const times = timesheetLineDisplay({ details: line.details ?? '', dayKey }, options?.day ? options.day(dayKey) ?? null : null).times
      const match = times.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/)
      if (match) {
        start = clockMinutes(match[1])
        end = clockMinutes(match[2])
        fromOvertime = line.isOvertimeLine === true
      }
    }
    if (start != null && end != null && end <= start) end += 24 * 60
    const held = groups.get(key)
    if (!held) {
      groups.set(key, { start: start ?? Number.POSITIVE_INFINITY, end: end ?? Number.POSITIVE_INFINITY, named, fromOvertime })
    } else if (start != null && (held.start === Number.POSITIVE_INFINITY || (held.fromOvertime && !fromOvertime))) {
      held.start = start
      held.end = end ?? Number.POSITIVE_INFINITY
      held.fromOvertime = fromOvertime
    }
  })
  const indexed = all.map((line, index) => ({ line, index, group: `${text(line.dayKey)}|${lineGroupKey(line, index)}` }))
  indexed.sort((a, b) => {
    const dayA = text(a.line.dayKey)
    const dayB = text(b.line.dayKey)
    if (dayA !== dayB) return dayA < dayB ? -1 : 1
    if (a.group !== b.group) {
      const ga = groups.get(a.group)!
      const gb = groups.get(b.group)!
      if (ga.named !== gb.named) return ga.named ? -1 : 1
      if (ga.start !== gb.start) return ga.start < gb.start ? -1 : 1
      if (ga.end !== gb.end) return ga.end < gb.end ? -1 : 1
      return a.group < b.group ? -1 : 1
    }
    const otA = a.line.isOvertimeLine === true ? 1 : 0
    const otB = b.line.isOvertimeLine === true ? 1 : 0
    if (otA !== otB) return otA - otB
    return a.index - b.index
  })
  const ordered = indexed.map((row) => row.line)
  if (!hide) return ordered
  const effectiveAmount = effective ? (line: TimesheetLineOrderInput) => effective(line as T) : null
  const declined = options?.isDeclined ? (line: TimesheetLineOrderInput) => options.isDeclined!(line as T) : null
  return ordered.filter((line) => !timesheetLineIsEmptyStandardPart(line, all, effectiveAmount, declined))
}
