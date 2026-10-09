import type { OrgPayrollTimePolicy, OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { effectiveWeekendSettings } from '@/lib/setup/workingHoursUtils'
import type { LabourPerson, RosterOperative } from '@/lib/canonical'
import { unbookedLabourRows } from '@/lib/canonical'
import type { Booking, HolidayBooking, Operative, User } from '@/types'
import { UserRole } from '@/types'
import { isActiveBookingStatus } from '@/lib/ios-parity/enums'
import { addLondonDays, dateFromDayKey, dayKey, londonIsoWeekday, londonMidnight } from '@/lib/ios-parity/londonTime'
import { formatWarningHours } from '@/lib/warnings/clashIntervals'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { isPlaceholderOperative } from '@/lib/operatives/operativeRosterUtils'
import { computeWarningCoverageWindow, isDateWithinWarningWindow } from '@/lib/warnings/warningLookahead'

export interface UnbookedLabourWarning {
  id: string
  operativeId: string
  operativeName: string
  userId?: string
  date: Date
  message: string
  missingHours: number
}

function countsAsHours(day: 'saturday' | 'sunday', payrollPolicy: OrgPayrollTimePolicy): number {
  const settings = effectiveWeekendSettings(day, payrollPolicy)
  const countsAs = settings.countsAsStandardHours
  return typeof countsAs === 'number' && Number.isFinite(countsAs) ? countsAs : payrollPolicy.standardPaidHours
}

function labourPerson(user: User): LabourPerson {
  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email || user.id,
    isActive: Boolean(user.isActive),
    passwordSet: user.passwordSet === true,
    status: user.status,
    isOperativeMode: Boolean(user.permissions?.operativeMode),
    isManager: Boolean(user.permissions?.manager),
    isAdmin: Boolean(user.permissions?.adminAccess) || user.role === UserRole.ADMIN,
    isSuperAdmin: Boolean(user.isSuperAdmin),
  }
}

function rosterOperative(operative: Operative): RosterOperative {
  return {
    id: operative.id,
    email: operative.email,
    name: `${operative.firstName} ${operative.lastName}`.trim() || operative.email || 'Operative',
    isActive: operative.isActive !== false,
    isPlaceholder: isPlaceholderOperative(operative),
    profileWeight:
      (operative.qualifications?.length ?? 0) +
      Object.keys(operative.qualificationCertificateURLs || {}).length +
      Object.keys(operative.qualificationExpiryDates || {}).length,
  }
}

/** iOS paidHoursRequired: weekday standard day, or that weekend's counts-as hours. */
export function paidHoursRequiredForUnbookedDay(
  day: Date,
  payrollPolicy: OrgPayrollTimePolicy,
  timeZone?: string
): number {
  const iso = londonIsoWeekday(day, timeZone)
  if (iso === 6) return Math.max(countsAsHours('saturday', payrollPolicy), 0)
  if (iso === 7) return Math.max(countsAsHours('sunday', payrollPolicy), 0)
  return Math.max(payrollPolicy.standardPaidHours, 0)
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
  let periodEnd = window.end
  if (
    warningDetection.clashLookaheadMode === 'endOfWorkingWeek' &&
    warningDetection.includeWeekendsForUnbookedLabour
  ) {
    const iso = londonIsoWeekday(window.end, timeZone)
    if (iso >= 1 && iso <= 5) periodEnd = addLondonDays(window.end, 7 - iso, timeZone)
  }
  return computeUnbookedLabourWarningsForDateRange({
    bookings,
    managerSiteBookings,
    operatives,
    users,
    holidays,
    warningDetection,
    payrollPolicy,
    periodStart: window.start,
    periodEnd,
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
  const rows = unbookedLabourRows({
    timeZone,
    startDayKey: dayKey(windowStart, timeZone),
    endDayKey: dayKey(windowEnd, timeZone),
    includeWeekends: warningDetection.includeWeekendsForUnbookedLabour,
    excludedUserIds: warningDetection.excludedUserIdsFromUnbookedWarnings,
    standardPaidHours: payrollPolicy.standardPaidHours,
    saturdayCountsAsHours: countsAsHours('saturday', payrollPolicy),
    sundayCountsAsHours: countsAsHours('sunday', payrollPolicy),
    standardDayStart: payrollPolicy.standardDayStart,
    standardDayEnd: payrollPolicy.standardDayEnd,
    breakWindowStart: payrollPolicy.breakWindowStart,
    breakWindowEnd: payrollPolicy.breakWindowEnd,
    people: users.map(labourPerson),
    operatives: operatives.map(rosterOperative),
    bookings: [
      ...bookings
        .filter(
          (booking) =>
            isActiveBookingStatus(booking.status) &&
            Boolean(booking.operativeId) &&
            isDateWithinWarningWindow(booking.date, windowStart, windowEnd, timeZone)
        )
        .map((booking) => ({
          personId: booking.operativeId,
          dayKey: dayKey(booking.date, timeZone),
          kind: 'operative' as const,
          timeSlot: booking.timeSlot,
          workStart: booking.workStartTime,
          workEnd: booking.workEndTime,
        })),
      ...managerSiteBookings
        .filter(
          (booking) => Boolean(booking.userId) && isDateWithinWarningWindow(booking.date, windowStart, windowEnd, timeZone)
        )
        .map((booking) => ({
          personId: booking.userId,
          dayKey: dayKey(booking.date, timeZone),
          kind: 'manager' as const,
          timeSlot: booking.timeSlot,
          workStart: booking.workStartTime,
          workEnd: booking.workEndTime,
        })),
    ],
    holidays: holidays.map((holiday) => ({
      userId: holiday.userId,
      operativeId: holiday.operativeId,
      startDayKey: dayKey(holiday.startDate, timeZone),
      endDayKey: dayKey(holiday.endDate, timeZone),
      approved: String(holiday.status).toLowerCase() === 'approved',
    })),
  })
  return rows.map((row) => ({
    id: row.id,
    operativeId: row.operativeId,
    operativeName: row.operativeName,
    userId: row.userId,
    date: dateFromDayKey(row.dayKey, timeZone),
    missingHours: row.missingHours,
    message: row.message,
  }))
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
