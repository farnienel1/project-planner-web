/**
 * iOS parity: Views/BookLabourFlowView.swift buildCandidates
 * Hours include every operative profile and user account that share an email,
 * matching unbooked-labour coverage. A full day on any of those profiles
 * removes the person from the unbooked list.
 */

import type { Booking, HolidayBooking, Operative, User } from '@/types'
import { UserRole } from '@/types'
import { isActiveBookingStatus } from '@/lib/ios-parity/enums'
import { dayKey, londonIsoWeekday, londonMidnight } from '@/lib/ios-parity/londonTime'
import { displayTradeType } from '@/lib/staff/staffTradeTypes'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { estimatedPaidHours } from '@/lib/scheduling/paidHours'

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

function operativeProfileWeight(operative: Operative): number {
  return (
    (operative.qualifications?.length ?? 0) +
    Object.keys(operative.qualificationCertificateURLs || {}).length +
    Object.keys(operative.qualificationExpiryDates || {}).length
  )
}

/** One catalogue row per person. Prefer the profile that already holds today's hours. */
function preferOperativeProfile(
  candidates: Operative[],
  bookings: Booking[],
  day: Date,
  policy: OrgPayrollTimePolicy
): Operative | undefined {
  if (candidates.length === 0) return undefined
  const withHours = candidates.filter((operative) => operativePaidHours(bookings, operative.id, day, policy) > 0)
  const pool = withHours.length > 0 ? withHours : candidates
  return [...pool].sort((a, b) => {
    const weight = operativeProfileWeight(b) - operativeProfileWeight(a)
    if (weight !== 0) return weight
    return a.id.localeCompare(b.id)
  })[0]
}

function findLinkedOperative(
  user: User,
  operatives: Operative[],
  byName: Map<string, Operative>,
  claimed: Set<string>,
  bookings: Booking[],
  day: Date,
  policy: OrgPayrollTimePolicy
): Operative | undefined {
  const email = emailKey(user.email)
  const fromEmail = email
    ? operatives.filter((operative) => emailKey(operative.email) === email && !claimed.has(operative.id))
    : []
  const picked = preferOperativeProfile(fromEmail, bookings, day, policy)
  if (picked) return picked
  const fromName = byName.get(nameKey(user.firstName, user.surname))
  if (fromName && !claimed.has(fromName.id)) return fromName
  return undefined
}

function oneAccountPerEmail(users: User[]): User[] {
  const groups = new Map<string, User[]>()
  const withoutEmail: User[] = []
  for (const person of users) {
    const email = emailKey(person.email)
    if (!email) {
      withoutEmail.push(person)
      continue
    }
    const list = groups.get(email) || []
    list.push(person)
    groups.set(email, list)
  }
  const picked: User[] = []
  for (const group of groups.values()) {
    const best =
      group.find((person) => person.passwordSet && person.isActive) ??
      group.find((person) => person.passwordSet) ??
      group[0]
    picked.push(best)
  }
  return [...picked, ...withoutEmail]
}

function displayNameForUser(user: User): string {
  const name = `${user.firstName || ''} ${user.surname || ''}`.trim()
  return name || user.email || user.id
}

function holidayCoversDay(
  holidays: HolidayBooking[],
  day: Date,
  userIds: ReadonlySet<string>,
  operativeIds: ReadonlySet<string>
): boolean {
  const key = dayKey(day)
  return holidays.some((holiday) => {
    if (String(holiday.status).toLowerCase() !== 'approved') return false
    const start = dayKey(holiday.startDate)
    const end = dayKey(holiday.endDate)
    if (key < start || key > end) return false
    if (holiday.userId && userIds.has(holiday.userId)) return true
    if (holiday.operativeId && operativeIds.has(holiday.operativeId)) return true
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

function canBookOtherLocations(_user: User): boolean {
  // Any booked person can go to Other (office, WFH, site survey, or a custom item such as training).
  return true
}

function sameDay(date: Date, day: Date): boolean {
  return dayKey(date) === dayKey(day)
}

function slotPaidHours(
  booking: { timeSlot?: string; workStartTime?: string; workEndTime?: string; isBreakRemoved?: boolean },
  policy: OrgPayrollTimePolicy
): number {
  return estimatedPaidHours({
    timeSlot: booking.timeSlot,
    workStartTime: booking.workStartTime,
    workEndTime: booking.workEndTime,
    isBreakRemoved: booking.isBreakRemoved,
    unpaidBreakMinutes: policy.unpaidBreakMinutes,
    standardPaidHours: policy.standardPaidHours,
  })
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
    .reduce((sum, booking) => sum + slotPaidHours(booking, policy), 0)
}

function idsSharingEmail(rows: ReadonlyArray<{ id: string; email?: string }>, email: string): Set<string> {
  const ids = new Set<string>()
  if (!email) return ids
  for (const row of rows) {
    if (emailKey(row.email) === email) ids.add(row.id)
  }
  return ids
}

function identityIds(
  user: User,
  linked: Operative | undefined,
  users: User[],
  operatives: Operative[]
): { email: string; userIds: Set<string>; operativeIds: Set<string> } {
  const email = emailKey(user.email)
  const userIds = idsSharingEmail(users, email)
  userIds.add(user.id)
  const operativeIds = idsSharingEmail(operatives, email)
  if (linked) operativeIds.add(linked.id)
  return { email, userIds, operativeIds }
}

/** Hours on every user and operative profile that share this email. */
function paidHoursForPerson(
  user: User,
  linked: Operative | undefined,
  bookings: Booking[],
  managerSiteBookings: ManagerSiteBooking[],
  users: User[],
  operatives: Operative[],
  day: Date,
  policy: OrgPayrollTimePolicy
): number {
  const { userIds, operativeIds } = identityIds(user, linked, users, operatives)
  let paid = 0
  for (const operativeId of operativeIds) paid += operativePaidHours(bookings, operativeId, day, policy)
  for (const userId of userIds) paid += managerPaidHours(managerSiteBookings, userId, day, policy)
  return paid
}

/** Every same-day manager booking counts, including office, home, site survey and custom locations. */
function managerPaidHours(
  managerSiteBookings: ManagerSiteBooking[],
  userId: string,
  day: Date,
  policy: OrgPayrollTimePolicy
): number {
  return managerSiteBookings
    .filter((booking) => booking.userId === userId && sameDay(booking.date, day))
    .reduce((sum, booking) => sum + slotPaidHours(booking, policy), 0)
}

export function buildBookLabourCandidates(input: {
  day: Date
  users: User[]
  operatives: Operative[]
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  holidays: HolidayBooking[]
  payrollPolicy?: OrgPayrollTimePolicy
  /** User ids (or linked operative ids) named on a warning. Pending users stay out unless focused. */
  focusedUserIds?: string[]
}): BookLabourCandidate[] {
  const day = londonMidnight(input.day)
  const weekday = londonIsoWeekday(day)
  if (weekday < 1 || weekday > 5) return []

  const policy = input.payrollPolicy ?? DEFAULT_PAYROLL_POLICY
  const required = Math.max(policy.standardPaidHours, 0)
  const focused = new Set(input.focusedUserIds || [])
  const sharesFocusedId = (user: User, linked?: Operative) => {
    if (focused.has(user.id) || (linked ? focused.has(linked.id) : false)) return true
    const email = emailKey(user.email)
    if (!email || focused.size === 0) return false
    return (
      input.users.some((other) => emailKey(other.email) === email && focused.has(other.id)) ||
      input.operatives.some((operative) => emailKey(operative.email) === email && focused.has(operative.id))
    )
  }
  const bookable = (user: User) => user.status !== 'pending' && (user.passwordSet || focused.has(user.id))
  const operativesByName = new Map<string, Operative>()
  for (const operative of input.operatives) {
    const name = nameKey(operative.firstName, operative.lastName)
    if (name && !operativesByName.has(name)) operativesByName.set(name, operative)
  }
  const claimedOperativeIds = new Set<string>()

  const operativeOnlyUsers = oneAccountPerEmail(
    input.users.filter(
      (user) =>
        user.isActive &&
        bookable(user) &&
        user.permissions.operativeMode &&
        !user.permissions.manager &&
        !user.permissions.adminAccess &&
        !user.isSuperAdmin &&
        user.role !== UserRole.ADMIN
    )
  )
  const managerUsers = oneAccountPerEmail(
    input.users.filter(
      (user) =>
        user.isActive &&
        bookable(user) &&
        (user.permissions.manager ||
          user.permissions.adminAccess ||
          user.isSuperAdmin ||
          user.role === UserRole.ADMIN)
    )
  )

  const out: BookLabourCandidate[] = []
  const seen = new Set<string>()
  const seenEmails = new Set<string>()

  for (const user of operativeOnlyUsers) {
    const email = emailKey(user.email)
    if (email && seenEmails.has(email)) continue
    const linked = findLinkedOperative(
      user,
      input.operatives,
      operativesByName,
      claimedOperativeIds,
      input.bookings,
      day,
      policy
    )
    const ids = identityIds(user, linked, input.users, input.operatives)
    if (holidayCoversDay(input.holidays, day, ids.userIds, ids.operativeIds)) continue
    const paid = paidHoursForPerson(
      user,
      linked,
      input.bookings,
      input.managerSiteBookings,
      input.users,
      input.operatives,
      day,
      policy
    )
    if (!sharesFocusedId(user, linked) && paid >= required) continue
    if (linked) claimedOperativeIds.add(linked.id)
    seen.add(user.id)
    if (email) seenEmails.add(email)
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
    const email = emailKey(user.email)
    if (email && seenEmails.has(email)) continue
    const linked = findLinkedOperative(
      user,
      input.operatives,
      operativesByName,
      claimedOperativeIds,
      input.bookings,
      day,
      policy
    )
    if (seen.has(user.id)) continue
    const ids = identityIds(user, linked, input.users, input.operatives)
    if (holidayCoversDay(input.holidays, day, ids.userIds, ids.operativeIds)) continue
    const paid = paidHoursForPerson(
      user,
      linked,
      input.bookings,
      input.managerSiteBookings,
      input.users,
      input.operatives,
      day,
      policy
    )
    if (!sharesFocusedId(user, linked) && paid >= required) continue
    if (linked) claimedOperativeIds.add(linked.id)
    if (email) seenEmails.add(email)
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

  return out.sort((a, b) => {
    const aFocus = sharesFocusedId(a.user, a.linkedOperative)
    const bFocus = sharesFocusedId(b.user, b.linkedOperative)
    if (aFocus !== bFocus) return aFocus ? -1 : 1
    return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  })
}

export function bookLabourDayLine(day: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(day)
}
