import { addMinutes, endOfWeek, format, startOfDay } from 'date-fns'
import type { Booking } from '@/types'
import {
  DEFAULT_PAYROLL_POLICY,
  type OrgPayrollTimePolicy,
} from '@/lib/settings/organizationSettings'

export type CalendarEventInput = {
  uid: string
  title: string
  description?: string
  start: Date
  end: Date
}

function parseMinutes(hhmm: string): number | null {
  const trimmed = hhmm.trim()
  const parts = trimmed.split(':')
  if (parts.length !== 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

function normalizeSlot(slot: string): string {
  return (slot || '').toUpperCase().replace(/\s+/g, '_').replace('FULLDAY', 'FULL_DAY')
}

function clashIntervalMinutes(booking: Booking, policy: OrgPayrollTimePolicy): [number, number] | null {
  if (booking.workStartTime && booking.workEndTime) {
    const sm = parseMinutes(booking.workStartTime)
    const em = parseMinutes(booking.workEndTime)
    if (sm !== null && em !== null && em > sm) return [sm, em]
  }

  const dayStart = parseMinutes(policy.standardDayStart)
  const dayEnd = parseMinutes(policy.standardDayEnd)
  if (dayStart === null || dayEnd === null || dayEnd <= dayStart) {
    if (normalizeSlot(String(booking.timeSlot)) === 'FULL_DAY') return [0, 24 * 60]
    return null
  }

  const mid = dayStart + Math.floor((dayEnd - dayStart) / 2)
  switch (normalizeSlot(String(booking.timeSlot))) {
    case 'FULL_DAY':
    case 'CUSTOM_HOURS':
      return [dayStart, dayEnd]
    case 'AM':
    case 'MORNING':
      return [dayStart, mid]
    case 'PM':
    case 'AFTERNOON':
      return [mid, dayEnd]
    case 'EVENING': {
      const end = Math.min(dayEnd + 240, 24 * 60)
      return end > dayEnd ? [dayEnd, end] : null
    }
    case 'OVERTIME': {
      const startOt = Math.min(dayEnd + 240, 24 * 60)
      const endOt = Math.min(dayEnd + 360, 24 * 60)
      return endOt > startOt ? [startOt, endOt] : null
    }
    default:
      return [dayStart, dayEnd]
  }
}

export function bookingCalendarBlock(
  booking: Booking,
  policy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY
): { start: Date; end: Date } {
  const day = startOfDay(booking.date instanceof Date ? booking.date : new Date(booking.date))

  if (booking.workStartTime && booking.workEndTime) {
    const sm = parseMinutes(booking.workStartTime)
    const em = parseMinutes(booking.workEndTime)
    if (sm !== null && em !== null && em > sm) {
      return { start: addMinutes(day, sm), end: addMinutes(day, em) }
    }
  }

  const interval = clashIntervalMinutes(booking, policy)
  if (interval) {
    return { start: addMinutes(day, interval[0]), end: addMinutes(day, interval[1]) }
  }

  return { start: day, end: addMinutes(day, 8 * 60) }
}

function scheduleLabel(booking: Booking): string {
  if (booking.workStartTime && booking.workEndTime) {
    return `${booking.workStartTime}–${booking.workEndTime}`
  }
  const slot = normalizeSlot(String(booking.timeSlot))
  if (slot === 'FULL_DAY') return 'Full day'
  if (slot === 'AM' || slot === 'MORNING') return 'AM'
  if (slot === 'PM' || slot === 'AFTERNOON') return 'PM'
  if (slot === 'CUSTOM_HOURS') return 'Custom hours'
  return String(booking.timeSlot || 'Booking')
}

export function bookingsToCalendarEvents(
  bookings: Booking[],
  projectsById: Map<string, string>,
  policy: OrgPayrollTimePolicy = DEFAULT_PAYROLL_POLICY
): CalendarEventInput[] {
  return bookings.map((booking) => {
    const { start, end } = bookingCalendarBlock(booking, policy)
    const location = booking.displayTitle || projectsById.get(booking.projectId) || 'Booking'
    return {
      uid: `pp-booking-${booking.id}@projectplanner`,
      title: `${location} – ${scheduleLabel(booking)}`,
      description: booking.notes,
      start,
      end,
    }
  })
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatIcsLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

export function generateIcsCalendar(events: CalendarEventInput[], calendarName: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Project Planner//My Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ]

  const stamp = formatIcsLocalDateTime(new Date())
  for (const event of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.uid}`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART:${formatIcsLocalDateTime(event.start)}`)
    lines.push(`DTEND:${formatIcsLocalDateTime(event.end)}`)
    lines.push(`SUMMARY:${escapeIcs(event.title)}`)
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\r\n')}\r\n`
}

export function downloadIcsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function googleCalendarEventUrl(event: CalendarEventInput): string {
  const fmt = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${fmt(event.start)}/${fmt(event.end)}`,
  })
  if (event.description) params.set('details', event.description)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function outlookWebEventUrl(event: CalendarEventInput): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: event.start.toISOString(),
    enddt: event.end.toISOString(),
  })
  if (event.description) params.set('body', event.description)
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

export function bookingsInWeek(bookings: Booking[], weekStart: Date): Booking[] {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
  return bookings.filter((booking) => {
    const day = startOfDay(booking.date instanceof Date ? booking.date : new Date(booking.date))
    return day >= startOfDay(weekStart) && day <= weekEnd
  })
}

export function weekCalendarFilename(weekStart: Date): string {
  return `my-schedule-${format(weekStart, 'yyyy-MM-dd')}.ics`
}
