/**
 * iOS parity: Views/BookLabourFlowView.swift buildCandidates
 */

import type { Booking, HolidayBooking, Operative, User } from '@/types'
import { UserRole } from '@/types'
import { londonIsoWeekday, londonMidnight } from '@/lib/ios-parity/londonTime'
import { displayTradeType } from '@/lib/staff/staffTradeTypes'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { listUnbookedLabour } from '@/lib/daily-overview/buildDailyOverview'

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

function nameKey(first?: string, last?: string): string {
  return `${first || ''} ${last || ''}`.trim().toLowerCase().replace(/\s+/g, ' ')
}

function findLinkedOperative(
  user: User,
  byEmail: Map<string, Operative>,
  byName: Map<string, Operative>,
  claimed: Set<string>
): Operative | undefined {
  const email = emailKey(user.email)
  const fromEmail = email ? byEmail.get(email) : undefined
  if (fromEmail && !claimed.has(fromEmail.id)) return fromEmail
  const fromName = byName.get(nameKey(user.firstName, user.surname))
  if (fromName && !claimed.has(fromName.id)) return fromName
  return undefined
}

function displayNameForUser(user: User): string {
  const name = `${user.firstName || ''} ${user.surname || ''}`.trim()
  return name || user.email || user.id
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

function canBookOtherLocations(_user: User): boolean {
  // Any booked person can go to Other (office, WFH, site survey, or a custom item such as training).
  return true
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

  const unbookedIds = new Set(
    listUnbookedLabour({
      day,
      bookings: input.bookings,
      managerBookings: input.managerSiteBookings,
      holidays: input.holidays,
      users: input.users,
      operatives: input.operatives,
    }).map((row) => row.userId)
  )
  const operativesByEmail = new Map<string, Operative>()
  const operativesByName = new Map<string, Operative>()
  for (const operative of input.operatives) {
    const email = emailKey(operative.email)
    if (email) operativesByEmail.set(email, operative)
    const name = nameKey(operative.firstName, operative.lastName)
    if (name && !operativesByName.has(name)) operativesByName.set(name, operative)
  }
  const claimedOperativeIds = new Set<string>()

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
    if (!unbookedIds.has(user.id)) continue
    const linked = findLinkedOperative(user, operativesByEmail, operativesByName, claimedOperativeIds)
    if (linked) claimedOperativeIds.add(linked.id)
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
    if (!unbookedIds.has(user.id)) continue
    const linked = findLinkedOperative(user, operativesByEmail, operativesByName, claimedOperativeIds)
    if (seen.has(user.id)) continue
    if (linked) claimedOperativeIds.add(linked.id)
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
