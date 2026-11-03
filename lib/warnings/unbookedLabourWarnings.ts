import type { OrgPayrollTimePolicy, OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import type { LabourPerson, RosterOperative, WarningScope } from '@/lib/canonical'
import { bookingOccupiesDay, unbookedLabourRows, weekdayPaidHours } from '@/lib/canonical'
import type { Booking, HolidayBooking, Operative, User } from '@/types'
import { UserRole } from '@/types'
import { addLondonDays, dateFromDayKey, dayKey, londonIsoWeekday, londonMidnight } from '@/lib/ios-parity/londonTime'
import { formatWarningHours } from '@/lib/warnings/clashIntervals'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { isPlaceholderOperative } from '@/lib/operatives/operativeRosterUtils'
import { computeWarningCoverageWindow, isDateWithinWarningWindow } from '@/lib/warnings/warningLookahead'
import { holidayBookingLabourInput } from '@/lib/annualLeave/holidayDayKeys'
import type { PayrollTimePolicyState } from '@/lib/canonical'

export interface UnbookedLabourWarning {
  id: string
  operativeId: string
  operativeName: string
  userId?: string
  date: Date
  message: string
  missingHours: number
}


/** Web `User` → the rulebook's `LabourPerson`. Warnings, Daily Overview, and the scheduling picker all map through here. */
export function labourPersonFromUser(user: User): LabourPerson {
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
    formerIds: user.formerUserIds ?? [],
  }
}

/** Web `Operative` → the rulebook's `RosterOperative`. */
export function labourRosterOperative(operative: Operative): RosterOperative {
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

export function computeUnbookedLabourWarnings({
  bookings,
  managerSiteBookings = [],
  operatives,
  users,
  holidays,
  warningDetection,
  invoicing,
  payrollPolicy = DEFAULT_PAYROLL_POLICY,
  payrollPolicyState = null,
  referenceDate = new Date(),
  timeZone,
  scope,
}: {
  bookings: Booking[]
  managerSiteBookings?: ManagerSiteBooking[]
  operatives: Operative[]
  users: User[]
  holidays: HolidayBooking[]
  warningDetection: OrgWarningDetectionSettings
  invoicing?: import('@/lib/settings/organizationSettings').OrgInvoicingSettings
  payrollPolicy?: OrgPayrollTimePolicy
  /** Rulebook 1.19.0 §5: the whole working-hours state; each day of the window uses the rules in effect on it. */
  payrollPolicyState?: PayrollTimePolicyState | null
  referenceDate?: Date
  timeZone?: string
  /** Rulebook §17: the viewer's `warningScopeFor`. Missing → everything. */
  scope?: WarningScope | null
}): UnbookedLabourWarning[] {
  const window = computeWarningCoverageWindow(referenceDate, warningDetection, invoicing, timeZone)
  let periodEnd = window.end
  let endDayKey = window.endDayKey
  if (
    warningDetection.clashLookaheadMode === 'endOfWorkingWeek' &&
    warningDetection.includeWeekendsForUnbookedLabour
  ) {
    const iso = londonIsoWeekday(window.end, timeZone)
    if (iso >= 1 && iso <= 5) {
      periodEnd = addLondonDays(window.end, 7 - iso, timeZone)
      endDayKey = dayKey(periodEnd, timeZone)
    }
  }
  return computeUnbookedLabourWarningsForDateRange({
    bookings,
    managerSiteBookings,
    operatives,
    users,
    holidays,
    warningDetection,
    payrollPolicy,
    payrollPolicyState,
    periodStart: window.start,
    periodEnd,
    startDayKey: window.startDayKey,
    endDayKey,
    timeZone,
    scope,
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
  payrollPolicyState = null,
  periodStart,
  periodEnd,
  startDayKey,
  endDayKey,
  timeZone,
  scope,
}: {
  bookings: Booking[]
  managerSiteBookings?: ManagerSiteBooking[]
  operatives: Operative[]
  users: User[]
  holidays: HolidayBooking[]
  warningDetection: OrgWarningDetectionSettings
  payrollPolicy?: OrgPayrollTimePolicy
  /** Rulebook 1.19.0 §5: the whole working-hours state; each day of the range uses the rules in effect on it. */
  payrollPolicyState?: PayrollTimePolicyState | null
  periodStart: Date
  periodEnd: Date
  startDayKey?: string
  endDayKey?: string
  timeZone?: string
  /** Rulebook §17: the viewer's `warningScopeFor`. Missing → everything. */
  scope?: WarningScope | null
}): UnbookedLabourWarning[] {
  const windowStart = londonMidnight(periodStart, timeZone)
  const windowEnd = londonMidnight(periodEnd, timeZone)
  const rows = unbookedLabourRows({
    scope,
    timeZone,
    startDayKey: startDayKey || dayKey(windowStart, timeZone),
    endDayKey: endDayKey || dayKey(windowEnd, timeZone),
    includeWeekends: warningDetection.includeWeekendsForUnbookedLabour,
    excludedUserIds: warningDetection.excludedUserIdsFromUnbookedWarnings,
    standardPaidHours: weekdayPaidHours(payrollPolicy),
    standardDayStart: payrollPolicy.standardDayStart,
    standardDayEnd: payrollPolicy.standardDayEnd,
    breakWindowStart: payrollPolicy.breakWindowStart,
    breakWindowEnd: payrollPolicy.breakWindowEnd,
    // 1.19.0 (`unbookedLabourRows` payrollPolicy): each day read under the policy in effect on it, never today's.
    payrollPolicy: payrollPolicyState ?? payrollPolicy,
    // 1.19.0 §5: each weekend day's toggle and "Hours to cover" window.
    weekendCoverage: warningDetection.weekendCoverage ?? null,
    people: users.map(labourPersonFromUser),
    operatives: operatives.map(labourRosterOperative),
    bookings: [
      ...bookings
        .filter(
          (booking) =>
            bookingOccupiesDay(booking.status) &&
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
    // Parsed day keys from `parseHolidayDocument` (rulebook §9), never recomputed here.
    holidays: holidays.map((holiday) => holidayBookingLabourInput(holiday, timeZone)),
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
  return warnings.filter((warning) => {
    const key = dayKey(warning.date, timeZone)
    return key >= window.startDayKey && key <= window.endDayKey
  })
}

export function formatUnbookedMissingLabel(missingHours: number): string {
  return `−${formatWarningHours(missingHours)}h`
}
