import { format, isSameDay } from 'date-fns'
import type { HolidayBooking, HolidayTimeSlot } from '@/types'

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

export function bookingDayCount(booking: HolidayBooking): number {
  const days = Math.round((booking.endDate.getTime() - booking.startDate.getTime()) / 86400000) + 1
  return days * leaveDayUnits(booking.timeSlot)
}

export function formatLeaveDate(day: Date): string {
  return format(day, 'EEE d MMM')
}

export function formatLeaveRange(booking: HolidayBooking): string {
  if (isSameDay(booking.startDate, booking.endDate)) return formatLeaveDate(booking.startDate)
  return `${formatLeaveDate(booking.startDate)} – ${formatLeaveDate(booking.endDate)} · ${daysLabel(bookingDayCount(booking))}`
}
