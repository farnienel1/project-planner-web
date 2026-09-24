import type { OrgPayrollTimePolicy, OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { effectiveWeekendSettings } from '@/lib/setup/workingHoursUtils'
import type { Booking, HolidayBooking, Operative, User } from '@/types'
import { UserRole } from '@/types'
import { isActiveBookingStatus } from '@/lib/ios-parity/enums'
import { dayKey, londonIsoWeekday, londonMidnight } from '@/lib/ios-parity/londonTime'
import { formatWarningHours } from '@/lib/warnings/clashIntervals'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { isPlaceholderOperative } from '@/lib/operatives/operativeRosterUtils'
import {
  computeWarningCoverageWindow,
  eachLondonDay,
  isDateWithinWarningWindow,
} from '@/lib/warnings/warningLookahead'

export interface UnbookedLabourWarning {
  id: string
  operativeId: string
  operativeName: string
  userId?: string
  date: Date
  message: string
  missingHours: number
}

function isManagerOrAdminUser(user: User): boolean {
  return Boolean(
    user.isActive &&
      (user.permissions?.manager ||
        user.permissions?.adminAccess ||
        user.isSuperAdmin ||
        user.role === UserRole.ADMIN)
  )
}

function isOperativeModeOnlyUser(user: User): boolean {
  return Boolean(
    user.isActive &&
      user.permissions?.operativeMode &&
      !user.permissions?.manager &&
      !user.permissions?.adminAccess &&
      !user.isSuperAdmin &&
      user.role !== UserRole.ADMIN
  )
}

function displayNameForUser(user: User): string {
  const name = `${user.firstName || ''} ${user.surname || ''}`.trim()
  return name || user.email || user.id
}

function displayNameForOperative(operative: Operative): string {
  return `${operative.firstName} ${operative.lastName}`.trim() || operative.email || 'Operative'
}

function emailKey(value: string | undefined): string {
  return (value || '').trim().toLowerCase()
}

function holidayCoversDay(
  holidays: HolidayBooking[],
  day: Date,
  userId?: string,
  operativeId?: string,
  timeZone?: string
): boolean {
  const key = dayKey(day, timeZone)
  return holidays.some((holiday) => {
    if (String(holiday.status).toLowerCase() !== 'approved') return false
    const start = dayKey(holiday.startDate, timeZone)
    const end = dayKey(holiday.endDate, timeZone)
    if (key < start || key > end) return false
    const holidayUser = holiday.userId?.trim()
    if (userId && holidayUser && holidayUser === userId) return true
    if (operativeId && holiday.operativeId && holiday.operativeId === operativeId) return true
    return false
  })
}

function isUnbookedLabourWeekday(day: Date, includeWeekends: boolean, timeZone?: string): boolean {
  if (includeWeekends) return true
  const iso = londonIsoWeekday(day, timeZone)
  return iso >= 1 && iso <= 5
}

/** iOS paidHoursRequired: weekday standard day, or that weekend's counts-as hours. */
export function paidHoursRequiredForUnbookedDay(
  day: Date,
  payrollPolicy: OrgPayrollTimePolicy,
  timeZone?: string
): number {
  const iso = londonIsoWeekday(day, timeZone)
  if (iso === 6 || iso === 7) {
    const settings = effectiveWeekendSettings(iso === 6 ? 'saturday' : 'sunday', payrollPolicy)
    const countsAs = settings.countsAsStandardHours
    const hours = typeof countsAs === 'number' && Number.isFinite(countsAs) ? countsAs : payrollPolicy.standardPaidHours
    return Math.max(hours, 0)
  }
  return Math.max(payrollPolicy.standardPaidHours, 0)
}

function formatUnbookedDay(day: Date, timeZone = 'Europe/London'): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(day)
}

export function computeUnbookedLabourWarnings({
  bookings,
  managerSiteBookings = [],
  operatives,
  users,
  holidays,
  warningDetection,
  invoicing,
  payrollPolicy = DEFAULT_PAYROLL_POLICY,
  referenceDate = new Date(),
  timeZone,
}: {
  bookings: Booking[]
  managerSiteBookings?: ManagerSiteBooking[]
  operatives: Operative[]
  users: User[]
  holidays: HolidayBooking[]
  warningDetection: OrgWarningDetectionSettings
  invoicing?: import('@/lib/settings/organizationSettings').OrgInvoicingSettings
  payrollPolicy?: OrgPayrollTimePolicy
  referenceDate?: Date
  timeZone?: string
}): UnbookedLabourWarning[] {
  const window = computeWarningCoverageWindow(referenceDate, warningDetection, invoicing, timeZone)
  return computeUnbookedLabourWarningsForDateRange({
    bookings,
    managerSiteBookings,
    operatives,
    users,
    holidays,
    warningDetection,
    payrollPolicy,
    periodStart: window.start,
    periodEnd: window.end,
    timeZone,
  })
}

/** Unbooked labour flags for an explicit date range (weekly report / iOS unbookedPeople). */
export function computeUnbookedLabourWarningsForDateRange({
  bookings,
  managerSiteBookings = [],
  operatives,
  users,
  holidays,
  warningDetection,
  payrollPolicy = DEFAULT_PAYROLL_POLICY,
  periodStart,
  periodEnd,
  timeZone,
}: {
  bookings: Booking[]
  managerSiteBookings?: ManagerSiteBooking[]
  operatives: Operative[]
  users: User[]
  holidays: HolidayBooking[]
  warningDetection: OrgWarningDetectionSettings
  payrollPolicy?: OrgPayrollTimePolicy
  periodStart: Date
  periodEnd: Date
  timeZone?: string
}): UnbookedLabourWarning[] {
  const windowStart = londonMidnight(periodStart, timeZone)
  const windowEnd = londonMidnight(periodEnd, timeZone)
  const excludedUserIds = new Set(warningDetection.excludedUserIdsFromUnbookedWarnings)

  const coverageBookings = bookings.filter(
    (booking) =>
      isActiveBookingStatus(booking.status) &&
      Boolean(booking.operativeId) &&
      isDateWithinWarningWindow(booking.date, windowStart, windowEnd, timeZone)
  )
  const coverageManager = managerSiteBookings.filter(
    (booking) =>
      Boolean(booking.userId) && isDateWithinWarningWindow(booking.date, windowStart, windowEnd, timeZone)
  )
  const approvedHolidays = holidays.filter((holiday) => String(holiday.status).toLowerCase() === 'approved')

  const operativeBookedDays = new Set<string>()
  for (const booking of coverageBookings) {
    operativeBookedDays.add(`${booking.operativeId}|${dayKey(booking.date, timeZone)}`)
  }

  const managerBookedDays = new Set<string>()
  for (const booking of coverageManager) {
    managerBookedDays.add(`${booking.userId}|${dayKey(booking.date, timeZone)}`)
  }

  const hasOperativeBooking = (operativeId: string | undefined, day: Date): boolean =>
    Boolean(operativeId) && operativeBookedDays.has(`${operativeId}|${dayKey(day, timeZone)}`)

  const hasManagerBooking = (userId: string | undefined, day: Date): boolean =>
    Boolean(userId) && managerBookedDays.has(`${userId}|${dayKey(day, timeZone)}`)

  const operativesByEmail = new Map<string, Operative>()
  for (const operative of operatives) {
    const email = emailKey(operative.email)
    if (email) operativesByEmail.set(email, operative)
  }

  const usersById = new Map(users.map((user) => [user.id, user]))
  const operativeUsers = users.filter(isOperativeModeOnlyUser)
  const managerUsers = users.filter(isManagerOrAdminUser)
  const managerAdminUserIds = new Set(managerUsers.map((user) => user.id))
  const operativeUserEmails = new Set(operativeUsers.map((user) => emailKey(user.email)))

  const rosterOperatives = operatives.filter(
    (operative) => operative.isActive !== false && !isPlaceholderOperative(operative)
  )
  const warnings: UnbookedLabourWarning[] = []

  const appendIfUnbooked = (args: {
    personKey: string
    name: string
    email: string
    hasBooking: boolean
    requiredHours: number
    day: Date
    operativeId: string
    userId?: string
    seenEmails: Set<string>
  }) => {
    const emailKeyValue = args.email || args.personKey
    if (args.seenEmails.has(emailKeyValue)) return
    args.seenEmails.add(emailKeyValue)
    if (args.hasBooking) return
    const date = londonMidnight(args.day, timeZone)
    warnings.push({
      id: `unbooked-${dayKey(date, timeZone)}-${args.personKey}`,
      operativeId: args.operativeId,
      operativeName: args.name,
      userId: args.userId,
      date,
      missingHours: args.requiredHours,
      message: `${args.name} is not booked on ${formatUnbookedDay(date, timeZone)}.`,
    })
  }

  for (const day of eachLondonDay(windowStart, windowEnd, timeZone)) {
    if (!isUnbookedLabourWeekday(day, warningDetection.includeWeekendsForUnbookedLabour, timeZone)) continue
    const requiredHours = paidHoursRequiredForUnbookedDay(day, payrollPolicy, timeZone)
    // A non-working weekend (counts-as 0) is not unbooked labour.
    if (requiredHours <= 0.001) continue
    const seenEmails = new Set<string>()

    for (const user of operativeUsers) {
      if (excludedUserIds.has(user.id)) continue
      const linked = operativesByEmail.get(emailKey(user.email))
      if (holidayCoversDay(approvedHolidays, day, user.id, linked?.id, timeZone)) continue
      appendIfUnbooked({
        personKey: user.id,
        name: linked ? displayNameForOperative(linked) : displayNameForUser(user),
        email: emailKey(user.email),
        hasBooking: hasOperativeBooking(linked?.id, day) || hasManagerBooking(user.id, day),
        requiredHours,
        day,
        operativeId: linked?.id || user.id,
        userId: user.id,
        seenEmails,
      })
    }

    for (const user of managerUsers) {
      if (excludedUserIds.has(user.id)) continue
      const linked = operativesByEmail.get(emailKey(user.email))
      if (holidayCoversDay(approvedHolidays, day, user.id, linked?.id, timeZone)) continue
      appendIfUnbooked({
        personKey: user.id,
        name: displayNameForUser(user),
        email: emailKey(user.email),
        hasBooking: hasManagerBooking(user.id, day) || hasOperativeBooking(linked?.id, day),
        requiredHours,
        day,
        operativeId: linked?.id || user.id,
        userId: user.id,
        seenEmails,
      })
    }

    for (const operative of rosterOperatives) {
      const email = emailKey(operative.email)
      if (email && operativeUserEmails.has(email)) continue
      const matchedUser = email
        ? [...usersById.values()].find((user) => emailKey(user.email) === email)
        : undefined
      if (matchedUser && managerAdminUserIds.has(matchedUser.id)) continue
      if (matchedUser && excludedUserIds.has(matchedUser.id)) continue
      if (holidayCoversDay(approvedHolidays, day, matchedUser?.id, operative.id, timeZone)) continue
      appendIfUnbooked({
        personKey: matchedUser?.id || operative.id,
        name: displayNameForOperative(operative),
        email: email || operative.id,
        hasBooking: hasOperativeBooking(operative.id, day) || hasManagerBooking(matchedUser?.id, day),
        requiredHours,
        day,
        operativeId: operative.id,
        userId: matchedUser?.id,
        seenEmails,
      })
    }
  }

  return warnings.sort((a, b) => {
    const byDate = a.date.getTime() - b.date.getTime()
    if (byDate !== 0) return byDate
    return a.operativeName.localeCompare(b.operativeName, undefined, { sensitivity: 'base' })
  })
}

export type UnbookedLabourDayGroup = {
  id: string
  date: Date
  people: UnbookedLabourWarning[]
}

/** iOS unbooked card lists every person with no booking on that day. */
export function groupUnbookedWarningsByDay(warnings: UnbookedLabourWarning[]): UnbookedLabourDayGroup[] {
  const byDay = new Map<string, UnbookedLabourWarning[]>()
  for (const warning of warnings) {
    const key = dayKey(warning.date)
    const list = byDay.get(key) || []
    list.push(warning)
    byDay.set(key, list)
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, people]) => ({
      id,
      date: londonMidnight(people[0].date),
      people: people.sort((a, b) => a.operativeName.localeCompare(b.operativeName)),
    }))
}

export function filterWarningsByLookahead<T extends { date: Date }>(
  warnings: T[],
  warningDetection: OrgWarningDetectionSettings,
  invoicing?: import('@/lib/settings/organizationSettings').OrgInvoicingSettings,
  referenceDate = new Date(),
  timeZone?: string
): T[] {
  const window = computeWarningCoverageWindow(referenceDate, warningDetection, invoicing, timeZone)
  return warnings.filter((warning) =>
    isDateWithinWarningWindow(warning.date, window.start, window.end, timeZone)
  )
}

export function formatUnbookedMissingLabel(missingHours: number): string {
  return `−${formatWarningHours(missingHours)}h`
}
