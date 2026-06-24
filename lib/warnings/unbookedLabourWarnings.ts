import { addDays, getISODay, isAfter, startOfDay } from 'date-fns'
import { isSameDay } from 'date-fns/isSameDay'
import { getDayKindForBookings } from '@/lib/annualLeave/dayStatus'
import { bookingMatchesPerson, type AnnualLeavePerson } from '@/lib/annualLeave/annualLeavePerson'
import {
  findOperativeForUser,
  getActiveOperativesForScheduling,
  getLinkedOperatives,
} from '@/lib/operatives/operativeRosterUtils'
import { getOperativeModeUsers } from '@/lib/staff/userRosterUtils'
import type { OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import type { Booking, HolidayBooking, Operative, User } from '@/types'
import { computeWarningLookaheadEnd, isDateWithinWarningWindow } from './warningLookahead'

const ACTIVE_STATUSES = new Set(['confirmed', 'tentative', 'Confirmed', 'Tentative'])

export interface UnbookedLabourWarning {
  id: string
  operativeId: string
  operativeName: string
  userId?: string
  date: Date
  message: string
}

function isActiveBooking(booking: Booking): boolean {
  return ACTIVE_STATUSES.has(String(booking.status))
}

function operativeHasBookingOnDay(bookings: Booking[], operativeId: string, day: Date): boolean {
  return bookings.some(
    (booking) =>
      booking.operativeId === operativeId &&
      isActiveBooking(booking) &&
      isSameDay(new Date(booking.date), day)
  )
}

function operativeHasApprovedLeaveOnDay(
  holidays: HolidayBooking[],
  person: AnnualLeavePerson,
  day: Date
): boolean {
  const personHolidays = holidays.filter((booking) => bookingMatchesPerson(booking, person))
  const kind = getDayKindForBookings(day, personHolidays)
  return kind === 'approvedFull'
}

function isWorkingDay(day: Date, includeWeekends: boolean): boolean {
  const iso = getISODay(day)
  if (includeWeekends) return true
  return iso >= 1 && iso <= 5
}

function buildExcludedOperativeIds(
  users: User[],
  operatives: Operative[],
  excludedUserIds: string[]
): Set<string> {
  const excluded = new Set<string>()
  for (const userId of excludedUserIds) {
    const user = users.find((entry) => entry.id === userId)
    if (!user) continue
    const operative = findOperativeForUser(user, operatives)
    if (operative) excluded.add(operative.id)
  }
  return excluded
}

function operativeDisplayName(operative: Operative): string {
  return `${operative.firstName} ${operative.lastName}`.trim() || operative.email || 'Operative'
}

export function computeUnbookedLabourWarnings({
  bookings,
  operatives,
  users,
  holidays,
  warningDetection,
  invoicing,
  referenceDate = new Date(),
}: {
  bookings: Booking[]
  operatives: Operative[]
  users: User[]
  holidays: HolidayBooking[]
  warningDetection: OrgWarningDetectionSettings
  invoicing?: import('@/lib/settings/organizationSettings').OrgInvoicingSettings
  referenceDate?: Date
}): UnbookedLabourWarning[] {
  const windowStart = startOfDay(referenceDate)
  const windowEnd = computeWarningLookaheadEnd(referenceDate, warningDetection, invoicing)
  const excludedOperativeIds = buildExcludedOperativeIds(
    users,
    operatives,
    warningDetection.excludedUserIdsFromUnbookedWarnings
  )

  const activeOperatives = getActiveOperativesForScheduling(operatives)
  const linkedOperatives = getLinkedOperatives(operatives, users)
  const linkedIds = new Set(linkedOperatives.map((operative) => operative.id))

  const operativeUsers = getOperativeModeUsers(users).filter((user) => user.isActive && user.passwordSet)
  const userByOperativeId = new Map<string, User>()
  for (const user of operativeUsers) {
    const operative = findOperativeForUser(user, operatives)
    if (operative) userByOperativeId.set(operative.id, user)
  }

  const warnings: UnbookedLabourWarning[] = []

  for (const operative of activeOperatives) {
    if (!linkedIds.has(operative.id)) continue
    if (excludedOperativeIds.has(operative.id)) continue

    const linkedUser = userByOperativeId.get(operative.id)
    const person: AnnualLeavePerson = {
      id: operative.id,
      displayName: operativeDisplayName(operative),
      subtitle: operative.email,
      tradeLabel: 'General',
      firstNameSort: operative.firstName,
      surnameSort: operative.lastName,
      userId: linkedUser?.id,
      operativeId: operative.id,
    }

    let day = windowStart
    while (!isAfter(day, windowEnd)) {
      if (isWorkingDay(day, warningDetection.includeWeekendsForUnbookedLabour)) {
        const booked = operativeHasBookingOnDay(bookings, operative.id, day)
        const onLeave = operativeHasApprovedLeaveOnDay(holidays, person, day)
        if (!booked && !onLeave) {
          const dateKey = startOfDay(day).toISOString()
          warnings.push({
            id: `${operative.id}|${dateKey}`,
            operativeId: operative.id,
            operativeName: operativeDisplayName(operative),
            userId: linkedUser?.id,
            date: startOfDay(day),
            message: `${operativeDisplayName(operative)} is not booked on ${day.toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}.`,
          })
        }
      }
      day = addDays(day, 1)
    }
  }

  return warnings.sort((a, b) => a.date.getTime() - b.date.getTime())
}

export function filterWarningsByLookahead<T extends { date: Date }>(
  warnings: T[],
  warningDetection: OrgWarningDetectionSettings,
  invoicing?: import('@/lib/settings/organizationSettings').OrgInvoicingSettings,
  referenceDate = new Date()
): T[] {
  const windowStart = startOfDay(referenceDate)
  const windowEnd = computeWarningLookaheadEnd(referenceDate, warningDetection, invoicing)
  return warnings.filter((warning) => isDateWithinWarningWindow(warning.date, windowStart, windowEnd))
}
