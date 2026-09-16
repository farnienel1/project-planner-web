import type { OrgPayrollTimePolicy, OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import type { Booking, HolidayBooking, Operative, User } from '@/types'
import { UserRole } from '@/types'
import { isActiveBookingStatus } from '@/lib/ios-parity/enums'
import { dayKey, londonIsoWeekday, londonMidnight } from '@/lib/ios-parity/londonTime'
import {
  combinedPaidHoursFromIntervals,
  formatWarningHours,
  isLegacyFullDaySlot,
  managerClashInterval,
  paidHoursForOperativeBooking,
  type MinuteInterval,
} from '@/lib/warnings/clashIntervals'
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

function holidayCoversDay(holidays: HolidayBooking[], day: Date, userId?: string, operativeId?: string): boolean {
  const key = dayKey(day)
  return holidays.some((holiday) => {
    if (String(holiday.status).toLowerCase() !== 'approved') return false
    const start = dayKey(holiday.startDate)
    const end = dayKey(holiday.endDate)
    if (key < start || key > end) return false
    const holidayUser = holiday.userId?.trim()
    if (userId && holidayUser && holidayUser === userId) return true
    if (operativeId && holiday.operativeId && holiday.operativeId === operativeId) return true
    return false
  })
}

function isUnbookedLabourWeekday(day: Date, includeWeekends: boolean): boolean {
  if (includeWeekends) return true
  const iso = londonIsoWeekday(day)
  return iso >= 1 && iso <= 5
}

function formatUnbookedDay(day: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
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
}): UnbookedLabourWarning[] {
  const window = computeWarningCoverageWindow(referenceDate, warningDetection, invoicing)
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
}): UnbookedLabourWarning[] {
  const windowStart = londonMidnight(periodStart)
  const windowEnd = londonMidnight(periodEnd)
  const requiredPaidHours = Math.max(payrollPolicy.standardPaidHours, 0)
  const excludedUserIds = new Set(warningDetection.excludedUserIdsFromUnbookedWarnings)

  const coverageBookings = bookings.filter(
    (booking) =>
      isActiveBookingStatus(booking.status) && isDateWithinWarningWindow(booking.date, windowStart, windowEnd)
  )
  const coverageManager = managerSiteBookings.filter((booking) =>
    isDateWithinWarningWindow(booking.date, windowStart, windowEnd)
  )
  const approvedHolidays = holidays.filter((holiday) => String(holiday.status).toLowerCase() === 'approved')

  const operativePaidByDay = new Map<string, number>()
  for (const booking of coverageBookings) {
    const key = `${booking.operativeId}|${dayKey(booking.date)}`
    operativePaidByDay.set(key, (operativePaidByDay.get(key) || 0) + paidHoursForOperativeBooking(booking, payrollPolicy))
  }

  const managerBookingsByDay = new Map<string, ManagerSiteBooking[]>()
  for (const booking of coverageManager) {
    const key = `${booking.userId}|${dayKey(booking.date)}`
    const list = managerBookingsByDay.get(key) || []
    list.push(booking)
    managerBookingsByDay.set(key, list)
  }

  const managerPaidTotal = (userId: string, day: Date): number => {
    const dayMgr = managerBookingsByDay.get(`${userId}|${dayKey(day)}`) || []
    if (dayMgr.length === 0) return 0
    const intervals: MinuteInterval[] = []
    for (const booking of dayMgr) {
      const iv = managerClashInterval(booking, payrollPolicy)
      if (iv) intervals.push(iv)
    }
    return combinedPaidHoursFromIntervals(intervals, {
      anyBreakRemoved: dayMgr.some((booking) => booking.isBreakRemoved === true),
      includesLegacyFullDay: dayMgr.some((booking) =>
        isLegacyFullDaySlot(String(booking.timeSlot), booking.workStartTime, booking.workEndTime)
      ),
      policy: payrollPolicy,
    })
  }

  const operativePaidTotal = (operativeId: string, day: Date): number =>
    operativePaidByDay.get(`${operativeId}|${dayKey(day)}`) || 0

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

  const appendIfUnderBooked = (args: {
    personKey: string
    name: string
    email: string
    paid: number
    day: Date
    operativeId: string
    userId?: string
    seenEmails: Set<string>
  }) => {
    const emailKeyValue = args.email || args.personKey
    if (args.seenEmails.has(emailKeyValue)) return
    args.seenEmails.add(emailKeyValue)
    if (args.paid >= requiredPaidHours) return
    const missing = Math.max(0, requiredPaidHours - args.paid)
    const date = londonMidnight(args.day)
    warnings.push({
      id: `unbooked-${dayKey(date)}-${args.personKey}`,
      operativeId: args.operativeId,
      operativeName: args.name,
      userId: args.userId,
      date,
      missingHours: missing,
      message: `${args.name} is below the standard paid day on ${formatUnbookedDay(date)}. Missing hours are shown below.`,
    })
  }

  for (const day of eachLondonDay(windowStart, windowEnd)) {
    if (!isUnbookedLabourWeekday(day, warningDetection.includeWeekendsForUnbookedLabour)) continue
    const seenEmails = new Set<string>()

    for (const user of operativeUsers) {
      if (excludedUserIds.has(user.id)) continue
      const linked = operativesByEmail.get(emailKey(user.email))
      if (holidayCoversDay(approvedHolidays, day, user.id, linked?.id)) continue
      const paid = (linked ? operativePaidTotal(linked.id, day) : 0) + managerPaidTotal(user.id, day)
      appendIfUnderBooked({
        personKey: user.id,
        name: linked ? displayNameForOperative(linked) : displayNameForUser(user),
        email: emailKey(user.email),
        paid,
        day,
        operativeId: linked?.id || user.id,
        userId: user.id,
        seenEmails,
      })
    }

    for (const user of managerUsers) {
      if (excludedUserIds.has(user.id)) continue
      const linked = operativesByEmail.get(emailKey(user.email))
      if (holidayCoversDay(approvedHolidays, day, user.id, linked?.id)) continue
      const paid = managerPaidTotal(user.id, day) + (linked ? operativePaidTotal(linked.id, day) : 0)
      appendIfUnderBooked({
        personKey: user.id,
        name: displayNameForUser(user),
        email: emailKey(user.email),
        paid,
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
      if (holidayCoversDay(approvedHolidays, day, matchedUser?.id, operative.id)) continue
      const paid = operativePaidTotal(operative.id, day) + (matchedUser ? managerPaidTotal(matchedUser.id, day) : 0)
      appendIfUnderBooked({
        personKey: matchedUser?.id || operative.id,
        name: displayNameForOperative(operative),
        email: email || operative.id,
        paid,
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

/** iOS unbooked card lists every person missing hours on that day. */
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
  referenceDate = new Date()
): T[] {
  const window = computeWarningCoverageWindow(referenceDate, warningDetection, invoicing)
  return warnings.filter((warning) => isDateWithinWarningWindow(warning.date, window.start, window.end))
}

export function formatUnbookedMissingLabel(missingHours: number): string {
  return `−${formatWarningHours(missingHours)}h`
}
