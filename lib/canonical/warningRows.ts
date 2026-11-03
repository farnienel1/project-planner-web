/**
 * Which qualification, unverified, and unbooked-labour warnings exist.
 *
 * Plain data only. Web wrappers map app types in and out.
 * The iOS bundle calls these functions instead of a second person-selection loop.
 *
 * Unbooked labour (`unbookedLabourRows`) is the shared person-day list for both
 * Warnings and Daily Overview. Weekend days and excluded users come from
 * `organizations/{orgId}.warningDetection` — never from a screen-local weekday gate.
 * Anonymised deleted profiles (`isAnonymisedDeletedProfile`) are never current
 * warning or Daily Overview unbooked rows. Historic bookings keep the stored name.
 */

import { isPersonInWarningScope, type WarningScope } from './staffAccess'
import { isAnonymisedDeletedProfile, listedCurrentLabourPeople } from './userRosterSegment'
import { standardDayCoverage, windowCoverage, parseClockMinutes, type StandardDayBooking } from './engine'
import { resolveWeekendCoverageDay, type OrgPayrollTimePolicy, type WeekendCoverage } from './organizationSettings'
import { payrollBreakOnDay } from './payrollHours'
import { payrollTimePolicyForDayFromState, type PayrollTimePolicyState } from './payrollPolicySchedule'
import {
  addDaysInZone,
  dateFromDayKeyInZone,
  dayKeyInZone,
  isoWeekdayInZone,
} from '../orgTime/zoneTime'
import { eachDayKey, formatLongDayKey, zoneOrLondon } from './dayKeys'
import { idKey } from './personIds'

export type QualificationExpiryInput = {
  referenceIso: string
  /** Rulebook §17: a restricted viewer's scope (`warningScopeFor`); rows only for people in it. Missing → all. */
  scope?: WarningScope | null
  timeZone?: string | null
  operatives: ReadonlyArray<{
    id: string
    isActive: boolean
    name: string
    email?: string | null
    expiries: ReadonlyArray<{
      qualificationId: string
      name: string
      expiryIso: string
    }>
  }>
}

export type QualificationExpiryRow = {
  id: string
  operativeId: string
  operativeName: string
  qualificationId: string
  qualificationName: string
  dayKey: string
  daysUntilExpiry: number
  severity: 'low'
  title: 'Qualification expired' | 'Qualification expiry'
  message: string
  /**
   * Key a dismissal is stored under (`organizations/{orgId}/dismissedWarnings/{dismissKey}`).
   * Includes the expiry day, so a renewed certificate with a new date warns again.
   */
  dismissKey: string
}

/** Shared id for a dismissed qualification warning. Both apps store and read the same key. */
export function qualificationDismissKey(operativeId: string, qualificationId: string, expiryDayKey: string): string {
  return `qual|${String(operativeId).trim()}|${String(qualificationId).trim()}|${String(expiryDayKey).trim()}`
}

/** Rows whose dismiss key is not in the dismissed set. Expiry rows still to come are never filtered. */
export function withoutDismissedQualificationRows<T extends Pick<QualificationExpiryRow, 'dismissKey' | 'daysUntilExpiry'>>(
  rows: readonly T[],
  dismissedKeys: ReadonlySet<string> | readonly string[]
): T[] {
  const dismissed = dismissedKeys instanceof Set ? dismissedKeys : new Set(dismissedKeys)
  if (dismissed.size === 0) return [...rows]
  return rows.filter((row) => !(row.daysUntilExpiry < 0 && dismissed.has(row.dismissKey)))
}

export type UnverifiedOperativeInput = {
  referenceIso: string
  /** Rulebook §17: a restricted viewer's scope (`warningScopeFor`); rows only for people in it. Missing → all. */
  scope?: WarningScope | null
  timeZone?: string | null
  operatives: ReadonlyArray<{
    id: string
    email: string
    name: string
  }>
  people: ReadonlyArray<{
    email: string
    passwordSet: boolean
    createdAtIso?: string | null
    isOperativeMode: boolean
  }>
}

export type UnverifiedOperativeRow = {
  id: string
  operativeId: string
  operativeName: string
  email: string
  title: 'Unverified operative'
  message: string
}

export type LabourPerson = {
  id: string
  email: string
  name: string
  isActive: boolean
  passwordSet: boolean
  status?: string | null
  isOperativeMode: boolean
  isManager: boolean
  isAdmin: boolean
  isSuperAdmin: boolean
  /**
   * `users/{uid}.formerUserIds`: the invite placeholder id(s) this account had
   * before sign-up moved it to `users/{authUid}`. Bookings, leave, and
   * exclusions saved under a former id still belong to this person.
   */
  formerIds?: readonly string[] | null
}

export type RosterOperative = {
  id: string
  email: string
  name: string
  isActive: boolean
  isPlaceholder: boolean
  profileWeight: number
}

export type LabourBooking = {
  personId: string
  dayKey: string
  kind: 'operative' | 'manager'
  /** Missing slot means a full standard day, so older callers stay compatible. */
  timeSlot?: string | null
  workStart?: string | null
  workEnd?: string | null
  workStartTime?: string | null
  workEndTime?: string | null
}

export type LabourHoliday = {
  userId?: string | null
  operativeId?: string | null
  startDayKey: string
  endDayKey: string
  approved: boolean
}

export type UnbookedLabourInput = {
  timeZone?: string | null
  /**
   * Rulebook §17: a restricted viewer's scope (`warningScopeFor`). Rows only for people in it, and none at all when
   * the viewer cannot read every booking (`unbookedLabour` false). Missing → all.
   */
  scope?: WarningScope | null
  startDayKey: string
  endDayKey: string
  /**
   * `organizations/{orgId}.warningDetection.includeWeekendsForUnbookedLabour`.
   * Off skips Saturday and Sunday. On lists weekend unbooked people the same
   * way weekdays do, on Warnings and on Daily Overview.
   */
  includeWeekends: boolean
  /**
   * `organizations/{orgId}.warningDetection.excludedUserIdsFromUnbookedWarnings`.
   * Those `users/{uid}` ids are never unbooked on Warnings or Daily Overview.
   */
  excludedUserIds?: readonly string[] | null
  standardPaidHours?: number
  /** Ignored since 1.19.0 (the weekend requirement is `weekendCoverage`); kept so older callers still type-check. */
  saturdayCountsAsHours?: number
  /** Ignored since 1.19.0 (see `weekendCoverage`). */
  sundayCountsAsHours?: number
  /** Organisation standard day. Defaults to 07:30–16:00 with a 12:00–12:30 break. */
  standardDayStart?: string | null
  standardDayEnd?: string | null
  breakWindowStart?: string | null
  breakWindowEnd?: string | null
  people: readonly LabourPerson[]
  operatives: readonly RosterOperative[]
  bookings: readonly LabourBooking[]
  holidays: readonly LabourHoliday[]
  /**
   * Rulebook 1.19.0 §5: the organisation's working-hours policy state (`parsePayrollTimePolicyState` /
   * `payrollTimePolicyTimeline`) or one policy. When given, every day of the window is read under the policy in effect
   * on THAT day (`payrollTimePolicyForDayFromState`) — its standard day, break, paid hours and weekend "counts as"
   * hours — and the flat fields above are ignored. A weekend day whose counts-as hours are 0 is still skipped.
   */
  payrollPolicy?: OrgPayrollTimePolicy | PayrollTimePolicyState | null
  /**
   * Rulebook 1.19.0 §5 (owner design): `warningDetection.weekendCoverage`. With include-weekends on, a Saturday or
   * Sunday is scanned only when that day's toggle is on, and a person is unbooked there when their bookings do not
   * cover every minute of the day's "Hours to cover" window (`resolveWeekendCoverageDay`, `windowCoverage`; time
   * inside that day's lunch-break window never needs covering). Missing → both days on with the default window (that day's working-hours set window, else the standard
   * day). Replaces the "counts as" hours requirement.
   */
  weekendCoverage?: Partial<WeekendCoverage> | null
}

export type UnbookedLabourRow = {
  id: string
  operativeId: string
  operativeName: string
  userId?: string
  personKey: string
  dayKey: string
  missingHours: number
  message: string
}

const zoneOf = zoneOrLondon

function emailKey(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase()
}

function dayKeyFromIso(iso: string | null | undefined, timeZone: string): string {
  const date = new Date(String(iso || ''))
  if (Number.isNaN(date.getTime())) return ''
  return dayKeyInZone(date, timeZone)
}

function addCalendarMonths(dayKey: string, months: number): string {
  const [year, month, day] = dayKey.split('-').map(Number)
  if (!year || !month || !day) return dayKey
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1))
  const yearOut = shifted.getUTCFullYear()
  const monthOut = shifted.getUTCMonth()
  const lastDay = new Date(Date.UTC(yearOut, monthOut + 1, 0)).getUTCDate()
  const dayOut = Math.min(day, lastDay)
  return `${yearOut}-${String(monthOut + 1).padStart(2, '0')}-${String(dayOut).padStart(2, '0')}`
}

function signedDayDelta(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number)
  const [ty, tm, td] = toKey.split('-').map(Number)
  const from = Date.UTC(fy, fm - 1, fd)
  const to = Date.UTC(ty, tm - 1, td)
  return Math.round((to - from) / 86_400_000)
}

function workingDaysInclusive(startKey: string, endKey: string, timeZone: string): number {
  if (!startKey || !endKey || startKey > endKey) return 0
  let count = 0
  let cursor = dateFromDayKeyInZone(startKey, timeZone)
  while (dayKeyInZone(cursor, timeZone) <= endKey) {
    const iso = isoWeekdayInZone(cursor, timeZone)
    if (iso >= 1 && iso <= 5) count += 1
    cursor = addDaysInZone(cursor, 1, timeZone)
    if (count > 400) break
  }
  return count
}

const formatUnbookedDay = formatLongDayKey

function formatCoverageHours(hours: number): string {
  const rounded = Math.round(hours * 2) / 2
  if (Math.abs(rounded - Math.trunc(rounded)) < 0.01) return String(Math.trunc(rounded))
  return rounded.toFixed(1)
}

function finiteHours(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function isPayrollState(value: unknown): value is PayrollTimePolicyState {
  return Boolean(value && typeof value === 'object' && 'current' in (value as object) && 'scheduled' in (value as object))
}


/** Active operatives whose named qualification expires on or before today plus one calendar month. */
function qualificationExpiryRowsUnscoped(input: QualificationExpiryInput): QualificationExpiryRow[] {
  const timeZone = zoneOf(input.timeZone)
  const todayKey = dayKeyFromIso(input.referenceIso, timeZone)
  if (!todayKey) return []
  const endKey = addCalendarMonths(todayKey, 1)
  const rows: QualificationExpiryRow[] = []

  for (const operative of input.operatives) {
    if (!operative.isActive) continue
    if (isAnonymisedDeletedProfile({ email: operative.email, name: operative.name })) continue
    const operativeName = String(operative.name || '').trim() || operative.id
    for (const expiry of operative.expiries) {
      const name = String(expiry.name || '').trim()
      const expiryKey = dayKeyFromIso(expiry.expiryIso, timeZone)
      if (!name || !expiry.qualificationId || !expiryKey || expiryKey > endKey) continue
      const daysUntilExpiry = signedDayDelta(todayKey, expiryKey)
      const ago = Math.abs(daysUntilExpiry)
      const message =
        daysUntilExpiry < 0
          ? `${operativeName}'s ${name} expired ${ago} day${ago === 1 ? '' : 's'} ago`
          : daysUntilExpiry === 0
            ? `${operativeName}'s ${name} expires today`
            : `${operativeName}'s ${name} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`
      rows.push({
        id: `qual-${operative.id}-${expiry.qualificationId}`,
        operativeId: operative.id,
        operativeName,
        qualificationId: expiry.qualificationId,
        qualificationName: name,
        dayKey: expiryKey,
        daysUntilExpiry,
        severity: 'low',
        title: daysUntilExpiry < 0 ? 'Qualification expired' : 'Qualification expiry',
        message,
        dismissKey: qualificationDismissKey(operative.id, expiry.qualificationId, expiryKey),
      })
    }
  }
  return rows
}

/** Operative-mode accounts that still have no password after three working days. */
function unverifiedOperativeRowsUnscoped(input: UnverifiedOperativeInput): UnverifiedOperativeRow[] {
  const timeZone = zoneOf(input.timeZone)
  const todayKey = dayKeyFromIso(input.referenceIso, timeZone)
  if (!todayKey) return []
  const rows: UnverifiedOperativeRow[] = []

  for (const operative of input.operatives) {
    if (isAnonymisedDeletedProfile({ email: operative.email, name: operative.name })) continue
    const email = emailKey(operative.email)
    if (!email) continue
    const person = input.people.find((candidate) => emailKey(candidate.email) === email && candidate.isOperativeMode)
    if (!person || person.passwordSet) continue
    const createdKey = dayKeyFromIso(person.createdAtIso, timeZone)
    if (!createdKey || workingDaysInclusive(createdKey, todayKey, timeZone) < 3) continue
    const operativeName = String(operative.name || '').trim() || operative.email
    rows.push({
      id: `unverified-${operative.id}`,
      operativeId: operative.id,
      operativeName,
      email,
      title: 'Unverified operative',
      message: `${operativeName} has not verified their account`,
    })
  }
  return rows
}

/**
 * Booking statuses that put a person on a job that day. A completed booking
 * was worked; a cancelled one was not. Daily Overview, Warnings, and the
 * weekly report use this instead of a screen-local status list.
 */
export function bookingOccupiesDay(status: unknown): boolean {
  const value = String(status ?? '').trim().toLowerCase()
  return value === 'confirmed' || value === 'tentative' || value === 'pending' || value === 'completed'
}

export type LabourBookingKind = 'operative' | 'manager'

/**
 * Who is labour, and which booking collection holds their day.
 * `operative`: an operative-mode account, booked in `organizations/{orgId}/bookings`.
 * `manager`: a manager or admin, booked in `organizations/{orgId}/managerSiteBookings`.
 * `null`: not labour — never offered by the scheduling picker and never unbooked.
 * The scheduling picker and `unbookedLabourRows` use this same split, so anyone
 * who can be flagged as unbooked can also be booked.
 */
export function labourBookingKind(person: LabourPerson): LabourBookingKind | null {
  if (!person.isActive) return null
  const admin = Boolean(person.isAdmin || person.isSuperAdmin)
  if (person.isOperativeMode && !person.isManager && !admin) return 'operative'
  if (person.isManager || admin) return 'manager'
  return null
}

/** Every id a person's bookings, leave, and exclusions may be stored under. */
export function labourPersonIds(person: Pick<LabourPerson, 'id' | 'formerIds'>): string[] {
  const ids = new Set<string>()
  if (person.id) ids.add(String(person.id))
  for (const id of person.formerIds || []) {
    const trimmed = String(id || '').trim()
    if (trimmed) ids.add(trimmed)
  }
  return [...ids]
}

/** Former id → current `users/{uid}` id, so a booking stored under an invite placeholder still names the person. */
export function formerIdAliases(people: readonly Pick<LabourPerson, 'id' | 'formerIds'>[]): Record<string, string> {
  const aliases: Record<string, string> = {}
  for (const person of people) {
    for (const id of labourPersonIds(person)) {
      if (id !== person.id && !(id in aliases)) aliases[id] = person.id
    }
  }
  return aliases
}

function hasFinishedSignup(person: LabourPerson): boolean {
  return person.passwordSet === true && person.status !== 'pending'
}

function isManagerOrAdmin(person: LabourPerson): boolean {
  return labourBookingKind(person) === 'manager'
}

function isOperativeModeOnly(person: LabourPerson): boolean {
  return labourBookingKind(person) === 'operative'
}

function preferFinishedAccount(candidates: readonly LabourPerson[]): LabourPerson | undefined {
  return candidates.find((person) => person.passwordSet && person.isActive) ?? candidates.find((person) => person.passwordSet)
}

function dedupeFinishedPeople(people: readonly LabourPerson[]): LabourPerson[] {
  const groups = new Map<string, LabourPerson[]>()
  const withoutEmail: LabourPerson[] = []
  for (const person of people) {
    if (!hasFinishedSignup(person)) continue
    const email = emailKey(person.email)
    if (!email) {
      withoutEmail.push(person)
      continue
    }
    const list = groups.get(email) || []
    list.push(person)
    groups.set(email, list)
  }
  const picked: LabourPerson[] = []
  for (const group of groups.values()) {
    const best = preferFinishedAccount(group)
    if (best) picked.push(best)
  }
  return [...picked, ...withoutEmail]
}

function asCoverageBooking(booking: LabourBooking): StandardDayBooking {
  return {
    timeSlot: booking.timeSlot,
    workStart: booking.workStart ?? booking.workStartTime,
    workEnd: booking.workEnd ?? booking.workEndTime,
  }
}

/**
 * People who do not cover the organisation standard day inside the window.
 * Pending invitees are not unbooked. 1.19.0: a weekend day is scanned only when its `weekendCoverage` toggle is on,
 * against its "Hours to cover" window.
 * Bookings on any operative profile or user account that shares the email count toward that day,
 * and so do bookings under that account's `formerIds` (an invite placeholder id from before sign-up).
 * An exclusion saved under a former id still excludes the person.
 * A partial booking stays unbooked and reports the hours still missing.
 * A clash is a separate warning: overlapping time does not create a second gap.
 *
 * Warnings and Daily Overview both call this function (Daily Overview through
 * `unbookedLabourRowsOnDay` for the viewed day). `includeWeekends` and
 * `excludedUserIds` are the `warningDetection` fields above. Do not add a
 * weekday-only loop on either screen. Anonymised deleted profiles are removed
 * by `listedCurrentLabourPeople` before the person-day loop.
 */
function unbookedLabourRowsUnscoped(input: UnbookedLabourInput): UnbookedLabourRow[] {
  const timeZone = zoneOf(input.timeZone)
  const people = listedCurrentLabourPeople(input.people)
  const operatives = listedCurrentLabourPeople(input.operatives)
  // Ids compare without case (`normalizeDocumentId`, rulebook §1): iOS writes upper-case UUIDs, web may
  // store lower case. Every set and map below is keyed by `nid`; returned rows keep the stored ids.
  const nid = idKey
  const excludedIds = new Set((input.excludedUserIds || []).map(nid).filter(Boolean))
  const isExcluded = (person: LabourPerson): boolean => labourPersonIds(person).some((id) => excludedIds.has(nid(id)))
  const flatDayPolicy = {
    standardDayStart: input.standardDayStart,
    standardDayEnd: input.standardDayEnd,
    breakWindowStart: input.breakWindowStart,
    breakWindowEnd: input.breakWindowEnd,
  }
  /**
   * 1.19.0: the standard day in effect on `dayKey`, and on a Saturday or Sunday the "Hours to cover" window
   * (`resolveWeekendCoverageDay`: saved window, else that day's set window, else the standard day) or null when that
   * day is not scanned.
   */
  const rulesOn = (
    dayKey: string,
    iso: number
  ): {
    dayPolicy: typeof flatDayPolicy
    weekendWindow: { start: number; end: number } | null
    weekendBreak: { start: number; end: number } | null
  } => {
    const source = input.payrollPolicy
    const policy = source ? (isPayrollState(source) ? payrollTimePolicyForDayFromState(source, dayKey) : source) : null
    const dayPolicy = policy
      ? {
          standardDayStart: policy.standardDayStart,
          standardDayEnd: policy.standardDayEnd,
          breakWindowStart: policy.breakWindowStart,
          breakWindowEnd: policy.breakWindowEnd,
        }
      : flatDayPolicy
    if (iso !== 6 && iso !== 7) return { dayPolicy, weekendWindow: null, weekendBreak: null }
    const resolved = resolveWeekendCoverageDay(
      input.weekendCoverage ?? null,
      input.includeWeekends,
      policy ?? {
        standardDayStart: input.standardDayStart ?? '07:30',
        standardDayEnd: input.standardDayEnd ?? '16:00',
        saturday: { allHoursAtMultiplierMode: true, allHoursMultiplier: 1 },
        sunday: { allHoursAtMultiplierMode: true, allHoursMultiplier: 1 },
      },
      iso === 6 ? 'saturday' : 'sunday'
    )
    const start = parseClockMinutes(resolved.start)
    const end = parseClockMinutes(resolved.end)
    // 1.19.0: time inside that day's lunch-break window (its own, else the weekday one; paid or not) never needs covering.
    const dayBreak = policy
      ? payrollBreakOnDay(policy, dayKey, timeZone)
      : (() => {
          const bs = parseClockMinutes(input.breakWindowStart ?? undefined)
          const be = parseClockMinutes(input.breakWindowEnd ?? undefined)
          return bs != null && be != null && be > bs ? { start: bs, end: be } : null
        })()
    return {
      dayPolicy,
      weekendWindow: resolved.enabled && start != null && end != null && end > start ? { start, end } : null,
      weekendBreak: dayBreak ? { start: dayBreak.start, end: dayBreak.end } : null,
    }
  }
  const operativeBookings = new Map<string, StandardDayBooking[]>()
  const managerBookings = new Map<string, StandardDayBooking[]>()
  for (const booking of input.bookings) {
    const personId = nid(booking.personId)
    const dayKey = String(booking.dayKey || '')
    if (!personId || !dayKey) continue
    const key = `${personId}|${dayKey}`
    const target = booking.kind === 'manager' ? managerBookings : operativeBookings
    const list = target.get(key) || []
    list.push(asCoverageBooking(booking))
    target.set(key, list)
  }

  const operativesByEmail = new Map<string, RosterOperative>()
  const operativeIdsByEmail = new Map<string, Set<string>>()
  for (const operative of operatives) {
    const email = emailKey(operative.email)
    if (!email) continue
    const ids = operativeIdsByEmail.get(email) || new Set<string>()
    if (nid(operative.id)) ids.add(nid(operative.id))
    operativeIdsByEmail.set(email, ids)
    const existing = operativesByEmail.get(email)
    if (!existing || operative.profileWeight > existing.profileWeight) {
      operativesByEmail.set(email, operative)
    }
  }

  const userIdsByEmail = new Map<string, Set<string>>()
  const idsByUserId = new Map<string, string[]>()
  for (const person of people) {
    if (nid(person.id)) idsByUserId.set(nid(person.id), labourPersonIds(person).map(nid).filter(Boolean))
    const email = emailKey(person.email)
    if (!email || !person.id) continue
    const ids = userIdsByEmail.get(email) || new Set<string>()
    for (const id of labourPersonIds(person)) if (nid(id)) ids.add(nid(id))
    userIdsByEmail.set(email, ids)
  }
  const withFormerIds = (target: Set<string>, userId: string | undefined) => {
    const key = nid(userId)
    if (!key) return
    for (const id of idsByUserId.get(key) || [key]) target.add(id)
  }

  const slotsFor = (email: string, operativeId: string | undefined, userId: string | undefined, dayKey: string): StandardDayBooking[] => {
    const ids = new Set<string>()
    if (nid(operativeId)) ids.add(nid(operativeId))
    withFormerIds(ids, userId)
    const linked = operativeIdsByEmail.get(email)
    if (linked) for (const id of linked) ids.add(id)
    const linkedUsers = userIdsByEmail.get(email)
    if (linkedUsers) for (const id of linkedUsers) ids.add(id)
    const slots: StandardDayBooking[] = []
    for (const id of ids) {
      // A FULL DAY may be stored under the user id or the roster id, as
      // either an operative booking or a manager site booking.
      slots.push(...(operativeBookings.get(`${id}|${dayKey}`) || []))
      slots.push(...(managerBookings.get(`${id}|${dayKey}`) || []))
    }
    return slots
  }

  const approvedHolidays = input.holidays.filter((holiday) => holiday.approved)
  const holidayCovers = (dayKey: string, email: string, userId?: string, operativeId?: string): boolean => {
    const userIds = new Set<string>()
    withFormerIds(userIds, userId)
    const linkedUsers = userIdsByEmail.get(email)
    if (linkedUsers) for (const id of linkedUsers) userIds.add(id)
    const operativeIds = new Set<string>()
    if (nid(operativeId)) operativeIds.add(nid(operativeId))
    const linkedOps = operativeIdsByEmail.get(email)
    if (linkedOps) for (const id of linkedOps) operativeIds.add(id)
    return approvedHolidays.some((holiday) => {
      if (dayKey < holiday.startDayKey || dayKey > holiday.endDayKey) return false
      const holidayUser = nid(holiday.userId)
      if (holidayUser && userIds.has(holidayUser)) return true
      const holidayOperative = nid(holiday.operativeId)
      if (holidayOperative && operativeIds.has(holidayOperative)) return true
      return false
    })
  }

  const operativeUsers = dedupeFinishedPeople(people.filter(isOperativeModeOnly))
  const managerUsers = dedupeFinishedPeople(people.filter(isManagerOrAdmin))
  const managerAdminUserIds = new Set(
    people.filter(isManagerOrAdmin).filter(hasFinishedSignup).map((person) => nid(person.id))
  )
  const operativeUserEmails = new Set(operativeUsers.map((person) => emailKey(person.email)).filter(Boolean))

  const verifiedUserForEmail = (email: string): LabourPerson | undefined => {
    if (!email) return undefined
    return preferFinishedAccount(people.filter((person) => emailKey(person.email) === email))
  }

  const roster = operatives.filter((operative) => operative.isActive !== false && !operative.isPlaceholder)
  const rows: UnbookedLabourRow[] = []

  for (const dayKey of eachDayKey(input.startDayKey, input.endDayKey, timeZone)) {
    const iso = isoWeekdayInZone(dateFromDayKeyInZone(dayKey, timeZone), timeZone)
    if (!input.includeWeekends && (iso < 1 || iso > 5)) continue
    const { dayPolicy, weekendWindow, weekendBreak } = rulesOn(dayKey, iso)
    if (iso >= 6 && !weekendWindow) continue
    const seen = new Set<string>()

    const append = (args: {
      personKey: string
      name: string
      email: string
      operativeId: string
      userId?: string
    }) => {
      const seenKey = args.email || args.personKey
      if (seen.has(seenKey)) return
      seen.add(seenKey)
      const slots = slotsFor(args.email, args.operativeId, args.userId, dayKey)
      // 1.19.0: a weekend day must cover every minute of its "Hours to cover" window; a weekday its standard day.
      const coverage = weekendWindow
        ? windowCoverage(weekendWindow, dayPolicy, slots, weekendBreak)
        : standardDayCoverage(dayPolicy, slots)
      const requiredHours = coverage.requiredHours
      if (requiredHours <= 0.001) return
      const coveredHours = Math.min(coverage.coveredHours, requiredHours)
      const missingHours = Math.round(Math.max(0, requiredHours - coveredHours) * 100) / 100
      if (missingHours <= 0.001) return
      const label = formatCoverageHours(missingHours)
      rows.push({
        id: `unbooked-${dayKey}-${args.personKey}`,
        operativeId: args.operativeId,
        operativeName: args.name,
        userId: args.userId,
        personKey: args.personKey,
        dayKey,
        missingHours,
        message: `${args.name} is missing ${label}h on ${formatUnbookedDay(dayKey, timeZone)}.`,
      })
    }

    for (const person of operativeUsers) {
      if (isExcluded(person)) continue
      const email = emailKey(person.email)
      const linked = operativesByEmail.get(email)
      if (holidayCovers(dayKey, email, person.id, linked?.id)) continue
      append({
        personKey: person.id,
        name: person.name,
        email,
        operativeId: linked?.id || person.id,
        userId: person.id,
      })
    }

    for (const person of managerUsers) {
      if (isExcluded(person)) continue
      const email = emailKey(person.email)
      const linked = operativesByEmail.get(email)
      if (holidayCovers(dayKey, email, person.id, linked?.id)) continue
      append({
        personKey: person.id,
        name: person.name,
        email,
        operativeId: linked?.id || person.id,
        userId: person.id,
      })
    }

    for (const operative of roster) {
      const email = emailKey(operative.email)
      if (email && operativeUserEmails.has(email)) continue
      const matched = email ? verifiedUserForEmail(email) : undefined
      if (!matched && email && people.some((person) => emailKey(person.email) === email)) continue
      if (matched && managerAdminUserIds.has(nid(matched.id))) continue
      if (matched && isExcluded(matched)) continue
      if (holidayCovers(dayKey, email, matched?.id, operative.id)) continue
      append({
        personKey: matched?.id || operative.id,
        name: matched?.name || operative.name,
        email: email || operative.id,
        operativeId: operative.id,
        userId: matched?.id,
      })
    }
  }

  return rows.sort((a, b) => {
    if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1
    return a.operativeName.localeCompare(b.operativeName, undefined, { sensitivity: 'base' })
  })
}

/**
 * Qualification expiry rows (§5). With `scope` (§17) only people in the viewer's scope (`isPersonInWarningScope`).
 */
export function qualificationExpiryRows(input: QualificationExpiryInput): QualificationExpiryRow[] {
  const rows = qualificationExpiryRowsUnscoped(input)
  const scope = input.scope
  if (!scope || scope.kind === 'all') return rows
  const emails = new Map(input.operatives.map((operative) => [operative.id, operative.email ?? null]))
  return rows.filter((row) => isPersonInWarningScope(scope, [row.operativeId], emails.get(row.operativeId) ?? null))
}

/** Unverified operative rows (§5). With `scope` (§17) only people in the viewer's scope. */
export function unverifiedOperativeRows(input: UnverifiedOperativeInput): UnverifiedOperativeRow[] {
  const rows = unverifiedOperativeRowsUnscoped(input)
  const scope = input.scope
  if (!scope || scope.kind === 'all') return rows
  return rows.filter((row) => isPersonInWarningScope(scope, [row.operativeId], row.email))
}

/**
 * Unbooked labour rows (§5). With `scope` (§17): none when the viewer cannot read every booking
 * (`scope.unbookedLabour` false), else only people in the viewer's scope.
 */
export function unbookedLabourRows(input: UnbookedLabourInput): UnbookedLabourRow[] {
  const scope = input.scope
  if (scope && scope.kind === 'jobs' && !scope.unbookedLabour) return []
  const rows = unbookedLabourRowsUnscoped(input)
  if (!scope || scope.kind === 'all') return rows
  return rows.filter((row) => isPersonInWarningScope(scope, [row.operativeId, row.userId, row.personKey], row.personKey))
}

/**
 * Daily Overview's list for one calendar day — the same rows as Warnings, not a
 * second person-selection loop. Saturday/Sunday appear only when
 * `includeWeekends` is true. Excluded user ids never appear.
 */
export function unbookedLabourRowsOnDay(
  input: Omit<UnbookedLabourInput, 'startDayKey' | 'endDayKey'> & { dayKey: string }
): UnbookedLabourRow[] {
  return unbookedLabourRows({
    ...input,
    startDayKey: input.dayKey,
    endDayKey: input.dayKey,
  })
}
