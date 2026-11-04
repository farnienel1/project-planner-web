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
import { normalizeDocumentId, unbookedLabourRowsOnDay, type PayrollTimePolicyState, type WarningScope } from '@/lib/canonical'
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
  /**
   * The `operativeId` an operative job booking is written under: the rulebook row's `operativeId` — the person's
   * catalogue row, or their users id when they have none (the rulebook counts a booking under either,
   * `bookingIdsForAccount`).
   */
  bookingOperativeId: string
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
export function bookLabourUserForRow(
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

/** The catalogue row the rulebook row names (`operativeId`, compared without case). Never matched by name. */
function linkedOperativeFor(operativeId: string, operatives: Operative[]): Operative | undefined {
  const key = idKey(operativeId)
  return key ? operatives.find((operative) => idKey(operative.id) === key) : undefined
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
  /** The viewer's warning scope (`orgWarningScope` / `warningScopeFor`), the same one Warnings passes. Missing → everyone. */
  scope?: WarningScope | null
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
      scope: input.scope,
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
    const user = bookLabourUserForRow(input.users, rowIds, input.userIdAliases)
    if (!user || seen.has(user.id)) continue
    const displayName = rosterDisplayName(user)
    if (!displayName) continue
    seen.add(user.id)
    const linked = linkedOperativeFor(row.operativeId, input.operatives)
    listed.push({
      candidate: {
        id: user.id,
        user,
        linkedOperative: linked,
        bookingOperativeId: linked?.id ?? (row.operativeId || user.id),
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

export type BookLabourListPhase = 'loading' | 'error' | 'ready'

/** One source the list is built from: loaded for this organisation, still loading, or failed. */
export type BookLabourSource = { ready: boolean; error?: string | null }

/**
 * Whether Book labour may show its list. Like the Warnings scan (`warningScanLanes`), nothing is listed until the
 * live organisation document (warning settings, working hours), the roster, operatives, bookings, manager bookings
 * and annual leave have loaded for this organisation; a failed source is an error, never "Everyone is booked".
 */
export function bookLabourListPhase(sources: Readonly<Record<string, BookLabourSource>>): BookLabourListPhase {
  const all = Object.values(sources)
  if (all.some((source) => Boolean(source.error))) return 'error'
  if (all.some((source) => !source.ready)) return 'loading'
  return 'ready'
}

export function bookLabourDayLine(day: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(day)
}
