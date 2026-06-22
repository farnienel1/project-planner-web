import { endOfMonth } from 'date-fns/endOfMonth'
import type { HolidayBooking } from '@/types'

function dayCount(booking: HolidayBooking): number {
  const start = booking.startDate.getTime()
  const end = booking.endDate.getTime()
  const days = Math.round((end - start) / 86400000) + 1
  if (booking.timeSlot === 'AM' || booking.timeSlot === 'PM') return days * 0.5
  return days
}

export function leaveYearRangeFromMonths(startMonth: number, endMonth: number, reference = new Date()) {
  const startMonthIndex = startMonth - 1
  let year = reference.getFullYear()
  if (reference.getMonth() < startMonthIndex) year -= 1
  const start = new Date(year, startMonthIndex, 1)
  const endYear = endMonth <= startMonth ? year + 1 : year
  const end = endOfMonth(new Date(endYear, endMonth - 1, 1))
  return { start, end }
}

export function previousLeaveYearRange(startMonth: number, endMonth: number, reference = new Date()) {
  const current = leaveYearRangeFromMonths(startMonth, endMonth, reference)
  const prevReference = new Date(current.start)
  prevReference.setDate(prevReference.getDate() - 1)
  return leaveYearRangeFromMonths(startMonth, endMonth, prevReference)
}

export function bookingsInRange(bookings: HolidayBooking[], start: Date, end: Date): HolidayBooking[] {
  return bookings.filter((b) => {
    if (b.status !== 'approved') return false
    return b.startDate >= start && b.startDate <= end
  })
}

/** Unused approved days from the previous leave year that carry into the current year. */
export function computeCarriedForwardDays(params: {
  carriesOver: boolean
  allowance: number
  startMonth: number
  endMonth: number
  bookings: HolidayBooking[]
  reference?: Date
}): number {
  if (!params.carriesOver || params.allowance <= 0) return 0

  const previous = previousLeaveYearRange(params.startMonth, params.endMonth, params.reference)
  const prevApproved = bookingsInRange(params.bookings, previous.start, previous.end)
  const taken = prevApproved.reduce((sum, b) => sum + dayCount(b), 0)
  const unused = params.allowance - taken
  return Math.max(0, Math.round(unused * 2) / 2)
}
