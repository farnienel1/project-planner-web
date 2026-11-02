import { format, isSameDay } from 'date-fns'
import type { HolidayBooking, HolidayTimeSlot } from '@/types'
import { leaveRecordDayKeys } from '@/lib/canonical'
import { dayKey } from '@/lib/ios-parity/londonTime'

export function leaveDayUnits(slot: HolidayTimeSlot): number {
  return slot === 'FULL DAY' ? 1 : 0.5
}

export function formatDayCount(days: number): string {
  const rounded = Math.round(days * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function daysLabel(days: number): string {
  return `${formatDayCount(days)} ${days === 1 ? 'day' : 'days'}`
}

/** Allowance days in one record (`leaveRecordDayKeys`: a multi-day record skips weekends and bank holidays). */
export function bookingDayCount(
  booking: HolidayBooking,
  timeZone?: string,
  bankHolidayDayKeys: ReadonlyArray<string> = []
): number {
  const days = leaveRecordDayKeys(
    { startDayKey: dayKey(booking.startDate, timeZone), endDayKey: dayKey(booking.endDate, timeZone) },
    timeZone,
    bankHolidayDayKeys
  ).length
  return days * leaveDayUnits(booking.timeSlot)
}

export function formatLeaveDate(day: Date): string {
  return format(day, 'EEE d MMM')
}

export function formatLeaveRange(booking: HolidayBooking): string {
  if (isSameDay(booking.startDate, booking.endDate)) return formatLeaveDate(booking.startDate)
  return `${formatLeaveDate(booking.startDate)} – ${formatLeaveDate(booking.endDate)} · ${daysLabel(bookingDayCount(booking))}`
}
