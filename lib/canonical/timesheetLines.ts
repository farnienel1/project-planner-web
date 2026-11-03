/**
 * Extra rows on a timesheet period.
 *
 * Overlapping bookings (`overlappingBookingIds`): every booking is paid, even when two bookings on
 * the same person-day overlap. Bookings are never merged. The ones that overlap another booking on
 * the same day (`slotInterval` + `overlappingIntervalGroups`; touching times do not overlap) are
 * flagged so the person and their line manager can check them.
 *
 * Annual leave (`timesheetLeaveLines`): each approved leave day inside the period is an information
 * row, "Annual leave (full day)", "Annual leave (AM)" or "Annual leave (PM)". It carries no hours and
 * no pay, cannot be edited, and is never put on an invoice. Days follow `leaveRecordDayKeys`, so a
 * multi-day request skips weekends and bank holidays.
 */

import {
  intervalCrossesMidnight,
  nextCalendarDayKey,
  overlappingIntervalGroups,
  overnightCarryInterval,
  slotInterval,
  type StandardDayInput,
} from './engine'
import { leaveRecordDayKeys, normalizeHolidayStatus, normalizeHolidayTimeSlot, type HolidayTimeSlotValue } from './leaveRequests'

export const OVERLAPPING_BOOKING_NOTE = 'Overlaps another booking — check with your manager'

export type OverlapBookingInput = {
  id: string
  /** Bookings are compared within the same day key. Missing → all are one day. */
  dayKey?: string | null
  timeSlot?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
}

/** Ids of bookings that overlap at least one other booking on the same day, in input order. */
export function overlappingBookingIds(
  bookings: ReadonlyArray<OverlapBookingInput>,
  day?: StandardDayInput | null
): string[] {
  const byDay = new Map<string, OverlapBookingInput[]>()
  for (const booking of bookings || []) {
    const id = String(booking?.id || '').trim()
    if (!id) continue
    const key = String(booking.dayKey || '').trim()
    const list = byDay.get(key) || []
    list.push(booking)
    byDay.set(key, list)
  }
  const flagged = new Set<string>()
  const intervalOf = (booking: OverlapBookingInput) =>
    slotInterval({ timeSlot: booking.timeSlot, workStartTime: booking.workStartTime, workEndTime: booking.workEndTime }, day)
  // 1.13.0 §5: an overnight booking also sits on the next morning, so it overlaps that day's early bookings.
  const carried = new Map<string, OverlapBookingInput[]>()
  for (const [key, list] of byDay) {
    const next = nextCalendarDayKey(key)
    if (!next) continue
    for (const booking of list) {
      if (intervalCrossesMidnight(intervalOf(booking))) carried.set(next, [...(carried.get(next) || []), booking])
    }
  }
  for (const [key, list] of byDay) {
    const carriedIn = carried.get(key) || []
    if (list.length + carriedIn.length < 2) continue
    const entries = [...list.map((b) => ({ b, carried: false })), ...carriedIn.map((b) => ({ b, carried: true }))]
    const intervals = entries.map((entry) =>
      entry.carried ? overnightCarryInterval(intervalOf(entry.b)) : intervalOf(entry.b)
    )
    for (const group of overlappingIntervalGroups(intervals)) {
      if (group.every((index) => entries[index].carried)) continue
      for (const index of group) flagged.add(String(entries[index].b.id).trim())
    }
  }
  const out: string[] = []
  for (const booking of bookings || []) {
    const id = String(booking?.id || '').trim()
    if (id && flagged.has(id) && !out.includes(id)) out.push(id)
  }
  return out
}

export type TimesheetLeaveRecord = {
  id: string
  startDayKey: string
  endDayKey?: string | null
  timeSlot?: string | null
  /** Only approved leave is shown. Missing status is approved. */
  status?: string | null
  /** A pending cancellation still shows until it is decided. */
  approved?: boolean | null
}

export type TimesheetLeaveLine = {
  id: string
  leaveId: string
  dayKey: string
  timeSlot: HolidayTimeSlotValue
  label: string
}

export function timesheetLeaveLabel(timeSlot: unknown): string {
  const slot = normalizeHolidayTimeSlot(timeSlot)
  if (slot === 'AM') return 'Annual leave (AM)'
  if (slot === 'PM') return 'Annual leave (PM)'
  return 'Annual leave (full day)'
}

/** Approved leave days inside the period, one row per day (full day wins over a half day). */
export function timesheetLeaveLines(
  leaveRecords: ReadonlyArray<TimesheetLeaveRecord>,
  period: { startDayKey: string; endDayKey: string },
  timeZone?: string | null,
  nonWorkingDayKeys?: ReadonlyArray<string> | null
): TimesheetLeaveLine[] {
  const start = String(period?.startDayKey || '').trim()
  const end = String(period?.endDayKey || '').trim()
  if (!start || !end || start > end) return []
  const byDay = new Map<string, TimesheetLeaveLine[]>()
  for (const record of leaveRecords || []) {
    if (!record) continue
    const approved =
      record.approved === true || (record.approved == null && normalizeHolidayStatus(record.status) === 'approved')
    if (!approved) continue
    const slot = normalizeHolidayTimeSlot(record.timeSlot)
    for (const dayKey of leaveRecordDayKeys(record, timeZone, nonWorkingDayKeys)) {
      if (dayKey < start || dayKey > end) continue
      const list = byDay.get(dayKey) || []
      if (list.some((line) => line.timeSlot === slot || line.timeSlot === 'FULL DAY')) continue
      const line: TimesheetLeaveLine = {
        id: `leave-${String(record.id)}-${dayKey}`,
        leaveId: String(record.id),
        dayKey,
        timeSlot: slot,
        label: timesheetLeaveLabel(slot),
      }
      byDay.set(dayKey, slot === 'FULL DAY' ? [line] : [...list, line])
    }
  }
  const lines = Array.from(byDay.values()).flat()
  const order: Record<HolidayTimeSlotValue, number> = { 'FULL DAY': 0, AM: 1, PM: 2 }
  return lines.sort((a, b) => (a.dayKey !== b.dayKey ? (a.dayKey < b.dayKey ? -1 : 1) : order[a.timeSlot] - order[b.timeSlot]))
}
