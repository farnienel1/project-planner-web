/**
 * iOS parity: Views/BookLabourFlowView.swift buildCandidates.
 *
 * Rulebook §5 / §6: Book labour lists exactly the people `unbookedLabourRowsOnDay` returns for the day — the same
 * rows as the Warnings unbooked card and Daily Overview, built from the same input (`unbookedLabourInputFromStores`).
 * Weekends, excluded users, approved leave, pending invitees, deleted profiles, same-email profiles and coverage are
 * the rulebook's; this file only maps each row to its `users` account and catalogue row for the booking writes.
 */

import type { Booking, HolidayBooking, Operative, User } from '@/types'
import { UserRole } from '@/types'
import { normalizeDocumentId, unbookedLabourRowsOnDay, type PayrollTimePolicyState } from '@/lib/canonical'
import { dateFromDayKey } from '@/lib/ios-parity/londonTime'
import { displayTradeType } from '@/lib/staff/staffTradeTypes'
import { rosterDisplayName } from '@/lib/staff/userRosterUtils'
import type { OrgPayrollTimePolicy, OrgWarningDetectionSettings } from '@/lib/settings/organizationSettings'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { unbookedLabourInputFromStores } from '@/lib/warnings/unbookedLabourWarnings'

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

/** Ids compare without case (`normalizeDocumentId`, rulebook §1). */
function idKey(value: string | undefined | null): string {
  return normalizeDocumentId(value ?? '')
}

function nameKey(first?: string, last?: string): string {
  return `${first || ''} ${last || ''}`.trim().toLowerCase().replace(/\s+/g, ' ')
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


/** Operative-mode only (not a manager or admin): booked onto jobs through the `bookings` collection. */
function isOperativeOnly(user: User): boolean {
  return (
    Boolean(user.permissions?.operativeMode) &&
    !user.permissions?.manager &&
    !user.permissions?.adminAccess &&
    !user.isSuperAdmin &&
    user.role !== UserRole.ADMIN
  )
}

/** The `users` account a rulebook row names: its `userId`, else its `personKey`, also as a same-email or former id. */
function userForRow(
  users: User[],
  ids: string[],
  userIdAliases: Readonly<Record<string, string>> | null | undefined
): User | undefined {
  for (const raw of ids) {
    const id = idKey(raw)
    if (!id) continue
    const direct = users.find((user) => idKey(user.id) === id)
    if (direct) return direct
    const kept = Object.entries(userIdAliases || {}).find(([alias]) => idKey(alias) === id)?.[1]
    const aliased = kept ? users.find((user) => idKey(user.id) === idKey(kept)) : undefined
    if (aliased) return aliased
    const former = users.find((user) => (user.formerUserIds ?? []).some((formerId) => idKey(formerId) === id))
    if (former) return former
  }
  return undefined
}

/**
 * The catalogue row operative bookings are written against: the row's `operativeId` (the rulebook's pick among the
 * same-email profiles). An account with no same-email profile falls back to a same-name catalogue row.
 */
function linkedOperativeFor(user: User, operativeId: string, operatives: Operative[]): Operative | undefined {
  const byId = operatives.find((operative) => idKey(operative.id) === idKey(operativeId))
  if (byId) return byId
  const name = nameKey(user.firstName, user.surname)
  return name ? operatives.find((operative) => nameKey(operative.firstName, operative.lastName) === name) : undefined
}

export function buildBookLabourCandidates(input: {
  /** The day shown, `YYYY-MM-DD` in the organisation zone. */
  dayKey: string
  /** The organisation business time zone (rulebook §1). */
  timeZone?: string
  users: User[]
  operatives: Operative[]
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  holidays: HolidayBooking[]
  /** `organizations/{orgId}.warningDetection` — include weekends, excluded users, weekend hours to cover. */
  warningDetection: Pick<
    OrgWarningDetectionSettings,
    'includeWeekendsForUnbookedLabour' | 'excludedUserIdsFromUnbookedWarnings' | 'weekendCoverage'
  >
  payrollPolicy?: OrgPayrollTimePolicy
  /** The whole working-hours state, so the day uses the rules in effect on it. */
  payrollPolicyState?: PayrollTimePolicyState | null
  /** The roster fold's same-email ids (duplicate id → the kept id). */
  userIdAliases?: Readonly<Record<string, string>> | null
  /** User ids (or linked operative ids) named on a warning; listed first. */
  focusedUserIds?: string[]
}): BookLabourCandidate[] {
  const day = dateFromDayKey(input.dayKey, input.timeZone)
  const rows = unbookedLabourRowsOnDay({
    ...unbookedLabourInputFromStores({
      bookings: input.bookings,
      managerSiteBookings: input.managerSiteBookings,
      operatives: input.operatives,
      users: input.users,
      holidays: input.holidays,
      warningDetection: input.warningDetection,
      payrollPolicy: input.payrollPolicy,
      payrollPolicyState: input.payrollPolicyState,
      windowStart: day,
      windowEnd: day,
      timeZone: input.timeZone,
      userIdAliases: input.userIdAliases,
    }),
    dayKey: input.dayKey,
  })

  const focused = new Set((input.focusedUserIds || []).map(idKey).filter(Boolean))
  const isFocused = (user: User, linked: Operative | undefined, rowIds: string[]): boolean => {
    if (focused.size === 0) return false
    if ([user.id, linked?.id, ...rowIds].some((id) => focused.has(idKey(id)))) return true
    const email = emailKey(user.email)
    if (!email) return false
    return (
      input.users.some((other) => emailKey(other.email) === email && focused.has(idKey(other.id))) ||
      input.operatives.some((operative) => emailKey(operative.email) === email && focused.has(idKey(operative.id)))
    )
  }

  const listed: { candidate: BookLabourCandidate; focused: boolean }[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const rowIds = [row.userId ?? '', row.personKey]
    // A roster row with no `users` account cannot be booked from here (iOS skips it too).
    const user = userForRow(input.users, rowIds, input.userIdAliases)
    if (!user || seen.has(user.id)) continue
    const displayName = rosterDisplayName(user)
    if (!displayName) continue
    seen.add(user.id)
    const linked = linkedOperativeFor(user, row.operativeId, input.operatives)
    listed.push({
      candidate: {
        id: user.id,
        user,
        linkedOperative: linked,
        usesOperativeProjectBookings: isOperativeOnly(user),
        displayName,
        roleChips: roleChipsFor(user),
        tradeDisplay: tradeFor(user, linked),
        canBookOtherLocations: canBookOtherLocations(user),
      },
      focused: isFocused(user, linked, [...rowIds, row.operativeId]),
    })
  }

  return listed
    .sort((a, b) => {
      if (a.focused !== b.focused) return a.focused ? -1 : 1
      return a.candidate.displayName.localeCompare(b.candidate.displayName, undefined, { sensitivity: 'base' })
    })
    .map((entry) => entry.candidate)
}

export function bookLabourDayLine(day: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(day)
}
