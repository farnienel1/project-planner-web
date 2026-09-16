/**
 * iOS parity: Views/BookLabourFlowView.swift buildCandidates
 */

import type { Booking, HolidayBooking, Operative, User } from '@/types'
import { UserRole } from '@/types'
import { isActiveBookingStatus } from '@/lib/ios-parity/enums'
import { dayKey, londonIsoWeekday, londonMidnight } from '@/lib/ios-parity/londonTime'
import { displayTradeType } from '@/lib/staff/staffTradeTypes'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { paidHoursForOperativeBooking } from '@/lib/warnings/clashIntervals'

export type BookLabourCandidate = {
  id: string
  user: User
  linkedOperative?: Operative
  usesOperativeProjectBookings: boolean
  displayName: string
  roleChips: string[]
  tradeDisplay?: string
  canBookOtherLocations: boolean
}

function emailKey(value: string | undefined): string {
  return (value || '').trim().toLowerCase()
}

function displayNameForUser(user: User): string {
  const name = `${user.firstName || ''} ${user.surname || ''}`.trim()
  return name || user.email || user.id
}

function holidayCoversDay(
  holidays: HolidayBooking[],
  day: Date,
  userId?: string,
  operativeId?: string
): boolean {
  const key = dayKey(day)
  return holidays.some((holiday) => {
    if (String(holiday.status).toLowerCase() !== 'approved') return false
    const start = dayKey(holiday.startDate)
    const end = dayKey(holiday.endDate)
    if (key < start || key > end) return false
    if (userId && holiday.userId && holiday.userId === userId) return true
    if (operativeId && holiday.operativeId && holiday.operativeId === operativeId) return true
    return false
  })
}

function roleChipsFor(user: User): string[] {
  const chips: string[] = []
  if (user.permissions.operativeMode) chips.push('Operative')
  if (user.permissions.manager) chips.push('Manager')
  if (user.permissions.adminAccess) chips.push('Admin')
  if (chips.length === 0) chips.push('User')
  return chips
}

function tradeFor(user: User, linked?: Operative): string | undefined {
  const fromUser = displayTradeType(user.tradeTypePreset, user.tradeTypeCustom)
  if (fromUser && fromUser !== '—') return fromUser
  if (!linked) return undefined
  const fromOp = displayTradeType(linked.tradeTypePreset, linked.tradeTypeCustom)
  return fromOp && fromOp !== '—' ? fromOp : undefined
}

function canBookOtherLocations(user: User): boolean {
  return (
    !user.permissions.operativeMode &&
    Boolean(user.permissions.manager || user.permissions.adminAccess || user.isSuperAdmin)
  )
}

function sameDay(date: Date, day: Date): boolean {
  return dayKey(date) === dayKey(day)
}

function operativePaidHours(
  bookings: Booking[],
  operativeId: string,
  day: Date,
  policy: OrgPayrollTimePolicy
): number {
  return bookings
    .filter(
      (booking) =>
        booking.operativeId === operativeId &&
        sameDay(booking.date, day) &&
        isActiveBookingStatus(booking.status)
    )
    .reduce((sum, booking) => sum + paidHoursForOperativeBooking(booking, policy), 0)
}

function managerProjectPaidHours(
  managerSiteBookings: ManagerSiteBooking[],
  userId: string,
  day: Date,
  policy: OrgPayrollTimePolicy
): number {
  return managerSiteBookings
    .filter(
      (booking) =>
        booking.userId === userId &&
        sameDay(booking.date, day) &&
        (booking.locationType === 'project' || booking.locationType === 'small_work')
    )
    .reduce((sum, booking) => sum + paidHoursForOperativeBooking(booking, policy), 0)
}

export function buildBookLabourCandidates(input: {
  day: Date
  users: User[]
  operatives: Operative[]
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  holidays: HolidayBooking[]
  payrollPolicy?: OrgPayrollTimePolicy
}): BookLabourCandidate[] {
  const day = londonMidnight(input.day)
  const weekday = londonIsoWeekday(day)
  if (weekday < 1 || weekday > 5) return []

  const policy = input.payrollPolicy ?? DEFAULT_PAYROLL_POLICY
  const required = Math.max(policy.standardPaidHours, 0)
  const operativesByEmail = new Map<string, Operative>()
  for (const operative of input.operatives) {
    const email = emailKey(operative.email)
    if (email) operativesByEmail.set(email, operative)
  }

  const operativeOnlyUsers = input.users.filter(
    (user) =>
      user.isActive &&
      user.permissions.operativeMode &&
      !user.permissions.manager &&
      !user.permissions.adminAccess &&
      !user.isSuperAdmin &&
      user.role !== UserRole.ADMIN
  )
  const managerUsers = input.users.filter(
    (user) =>
      user.isActive &&
      (user.permissions.manager ||
        user.permissions.adminAccess ||
        user.isSuperAdmin ||
        user.role === UserRole.ADMIN)
  )

  const out: BookLabourCandidate[] = []
  const seen = new Set<string>()

  for (const user of operativeOnlyUsers) {
    const linked = operativesByEmail.get(emailKey(user.email))
    if (holidayCoversDay(input.holidays, day, user.id, linked?.id)) continue
    if (!linked) continue
    const paid =
      operativePaidHours(input.bookings, linked.id, day, policy) +
      managerProjectPaidHours(input.managerSiteBookings, user.id, day, policy)
    if (paid >= required) continue
    seen.add(user.id)
    out.push({
      id: user.id,
      user,
      linkedOperative: linked,
      usesOperativeProjectBookings: true,
      displayName: displayNameForUser(user),
      roleChips: roleChipsFor(user),
      tradeDisplay: tradeFor(user, linked),
      canBookOtherLocations: canBookOtherLocations(user),
    })
  }

  for (const user of managerUsers) {
    const linked = operativesByEmail.get(emailKey(user.email))
    if (holidayCoversDay(input.holidays, day, user.id, linked?.id)) continue
    if (seen.has(user.id)) continue
    const paid =
      managerProjectPaidHours(input.managerSiteBookings, user.id, day, policy) +
      (linked ? operativePaidHours(input.bookings, linked.id, day, policy) : 0)
    if (paid >= required) continue
    out.push({
      id: user.id,
      user,
      linkedOperative: linked,
      usesOperativeProjectBookings: false,
      displayName: displayNameForUser(user),
      roleChips: roleChipsFor(user),
      tradeDisplay: tradeFor(user, linked),
      canBookOtherLocations: canBookOtherLocations(user),
    })
  }

  return out.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))
}

export function bookLabourDayLine(day: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(day)
}
