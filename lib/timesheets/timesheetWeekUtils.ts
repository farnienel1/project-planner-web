import { format, isWithinInterval, startOfWeek, endOfWeek } from 'date-fns'
import type { Booking, Operative, User } from '@/types'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'

export type TimesheetSubjectKind = 'operative' | 'manager'

export type TimesheetSubject = {
  key: string
  kind: TimesheetSubjectKind
  name: string
  userId?: string
  operativeId?: string
  dayRate?: number
  hourlyRate?: number
  vatNumber?: string
  utrNumber?: string
  employmentType?: string
}

export type TimesheetDayEntry = {
  date: Date
  label: string
  hours: number
  source: 'operative' | 'manager'
}

export function weekStartKey(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

export function weekRangeFromStart(weekStart: Date) {
  const start = startOfWeek(weekStart, { weekStartsOn: 1 })
  return { start, end: endOfWeek(start, { weekStartsOn: 1 }) }
}

function parseMinutes(value?: string): number | null {
  if (!value) return null
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

export function hoursFromSlot(
  timeSlot: string,
  workStartTime?: string,
  workEndTime?: string,
  payrollPolicy?: OrgPayrollTimePolicy
): number {
  const normalized = (timeSlot || '').toUpperCase()
  if (workStartTime && workEndTime) {
    const start = parseMinutes(workStartTime)
    const end = parseMinutes(workEndTime)
    if (start != null && end != null && end > start) {
      let minutes = end - start
      const breakMinutes = payrollPolicy?.unpaidBreakMinutes ?? 0
      if (breakMinutes > 0) minutes = Math.max(0, minutes - breakMinutes)
      return Math.round((minutes / 60) * 10) / 10
    }
  }
  if (normalized.includes('FULL')) return payrollPolicy?.standardPaidHours ?? 8
  if (normalized === 'AM' || normalized === 'PM') return (payrollPolicy?.standardPaidHours ?? 8) / 2
  return payrollPolicy?.standardPaidHours ?? 8
}

export function buildTimesheetSubjects(users: User[], operatives: Operative[]): TimesheetSubject[] {
  const subjects = new Map<string, TimesheetSubject>()

  for (const operative of operatives) {
    const linkedUser = users.find(
      (user) => findOperativeForUser(user, [operative])?.id === operative.id
    )
    subjects.set(`operative:${operative.id}`, {
      key: `operative:${operative.id}`,
      kind: 'operative',
      name: `${operative.firstName} ${operative.lastName}`.trim(),
      operativeId: operative.id,
      userId: linkedUser?.id,
      dayRate: linkedUser?.dayRate,
      hourlyRate: linkedUser?.hourlyRate,
      vatNumber: linkedUser?.vatNumber,
      utrNumber: linkedUser?.utrNumber,
      employmentType: linkedUser?.employmentType,
    })
  }

  for (const user of users) {
    if (user.permissions.operativeMode) continue
    const shouldInclude =
      user.timesheetsEnabled === true ||
      user.permissions.adminAccess ||
      user.isSuperAdmin ||
      user.permissions.manager
    if (!shouldInclude) continue

    const linked = findOperativeForUser(user, operatives)
    if (linked) continue

    subjects.set(`user:${user.id}`, {
      key: `user:${user.id}`,
      kind: 'manager',
      name: `${user.firstName} ${user.surname}`.trim(),
      userId: user.id,
      dayRate: user.dayRate,
      hourlyRate: user.hourlyRate,
      vatNumber: user.vatNumber,
      utrNumber: user.utrNumber,
      employmentType: user.employmentType,
    })
  }

  return Array.from(subjects.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export function collectSubjectDayEntries({
  subject,
  bookings,
  managerSiteBookings,
  weekRange,
  payrollPolicy,
}: {
  subject: TimesheetSubject
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  weekRange: { start: Date; end: Date }
  payrollPolicy?: OrgPayrollTimePolicy
}): TimesheetDayEntry[] {
  const entries: TimesheetDayEntry[] = []

  if (subject.operativeId) {
    for (const booking of bookings) {
      if (booking.operativeId !== subject.operativeId) continue
      const date = new Date(booking.date)
      if (!isWithinInterval(date, weekRange)) continue
      entries.push({
        date,
        label: String(booking.timeSlot),
        hours: hoursFromSlot(
          String(booking.timeSlot),
          booking.workStartTime,
          booking.workEndTime,
          payrollPolicy
        ),
        source: 'operative',
      })
    }
  }

  if (subject.userId && subject.kind === 'manager') {
    for (const booking of managerSiteBookings) {
      if (booking.userId !== subject.userId) continue
      const date = new Date(booking.date)
      if (!isWithinInterval(date, weekRange)) continue
      entries.push({
        date,
        label: String(booking.timeSlot),
        hours: hoursFromSlot(
          String(booking.timeSlot),
          booking.workStartTime,
          booking.workEndTime,
          payrollPolicy
        ),
        source: 'manager',
      })
    }
  }

  return entries.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function totalHours(entries: TimesheetDayEntry[]): number {
  return Math.round(entries.reduce((sum, entry) => sum + entry.hours, 0) * 10) / 10
}

export function estimatedDays(entries: TimesheetDayEntry[], standardDayHours = 8): number {
  const hours = totalHours(entries)
  return Math.round((hours / standardDayHours) * 10) / 10
}

export function estimatedAmount(subject: TimesheetSubject, hours: number): number | null {
  if (subject.dayRate && subject.dayRate > 0) {
    const days = hours / 8
    return Math.round(days * subject.dayRate * 100) / 100
  }
  if (subject.hourlyRate && subject.hourlyRate > 0) {
    return Math.round(hours * subject.hourlyRate * 100) / 100
  }
  return null
}
