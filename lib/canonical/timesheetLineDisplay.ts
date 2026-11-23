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
  const slot = normalizeBookingTimeSlot(details)
  const label = slot ? SLOT_LABELS[slot] : undefined
  if (label) {
    const dayKey = text(line?.dayKey)
    const interval = day ? slotInterval({ timeSlot: slot }, bookingStandardDayOn(day, dayKey || null)) : null
    if (interval && interval.end > interval.start) {
      return { title, times: `${label} ${formatClockMinutes(interval.start)}–${formatClockMinutes(interval.end)}` }
    }
    return { title, times: label }
  }
  return { title, times: details }
}
