/**
 * Which qualification, unverified, and unbooked-labour warnings exist.
 *
 * Plain data only. Web wrappers map app types in and out.
 * The iOS bundle calls these functions instead of a second person-selection loop.
 */

import {
  addDaysInZone,
  dateFromDayKeyInZone,
  dayKeyInZone,
  isoWeekdayInZone,
} from '../orgTime/zoneTime'
import { eachDayKey, formatLongDayKey, zoneOrLondon } from './dayKeys'

export type QualificationExpiryInput = {
  referenceIso: string
  timeZone?: string | null
  operatives: ReadonlyArray<{
    id: string
    isActive: boolean
    name: string
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
  startDayKey: string
  endDayKey: string
  includeWeekends: boolean
  excludedUserIds?: readonly string[] | null
  standardPaidHours: number
  saturdayCountsAsHours: number
  sundayCountsAsHours: number
  people: readonly LabourPerson[]
  operatives: readonly RosterOperative[]
  bookings: readonly LabourBooking[]
  holidays: readonly LabourHoliday[]
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

function finiteHours(value: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function hoursForIsoWeekday(iso: number, input: Pick<UnbookedLabourInput, 'standardPaidHours' | 'saturdayCountsAsHours' | 'sundayCountsAsHours'>): number {
  const standard = finiteHours(input.standardPaidHours, 0)
  if (iso === 6) return Math.max(finiteHours(input.saturdayCountsAsHours, standard), 0)
  if (iso === 7) return Math.max(finiteHours(input.sundayCountsAsHours, standard), 0)
  return Math.max(standard, 0)
}

/** Active operatives whose named qualification expires on or before today plus one calendar month. */
export function qualificationExpiryRows(input: QualificationExpiryInput): QualificationExpiryRow[] {
  const timeZone = zoneOf(input.timeZone)
  const todayKey = dayKeyFromIso(input.referenceIso, timeZone)
  if (!todayKey) return []
  const endKey = addCalendarMonths(todayKey, 1)
  const rows: QualificationExpiryRow[] = []

  for (const operative of input.operatives) {
    if (!operative.isActive) continue
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
export function unverifiedOperativeRows(input: UnverifiedOperativeInput): UnverifiedOperativeRow[] {
  const timeZone = zoneOf(input.timeZone)
  const todayKey = dayKeyFromIso(input.referenceIso, timeZone)
  if (!todayKey) return []
  const rows: UnverifiedOperativeRow[] = []

  for (const operative of input.operatives) {
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

function hasFinishedSignup(person: LabourPerson): boolean {
  return person.passwordSet === true && person.status !== 'pending'
}

function isManagerOrAdmin(person: LabourPerson): boolean {
  return Boolean(person.isActive && (person.isManager || person.isAdmin || person.isSuperAdmin))
}

function isOperativeModeOnly(person: LabourPerson): boolean {
  return Boolean(
    person.isActive &&
      person.isOperativeMode &&
      !person.isManager &&
      !person.isAdmin &&
      !person.isSuperAdmin
  )
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

/**
 * People with finished signup and no labour booking on a day inside the window.
 * Pending invitees are not unbooked. A weekend whose counts-as hours are 0 is not unbooked.
 * A booking on any operative profile that shares the email counts as booked.
 */
export function unbookedLabourRows(input: UnbookedLabourInput): UnbookedLabourRow[] {
  const timeZone = zoneOf(input.timeZone)
  const excluded = new Set((input.excludedUserIds || []).map((id) => String(id)))
  const operativeBooked = new Set<string>()
  const managerBooked = new Set<string>()
  for (const booking of input.bookings) {
    const personId = String(booking.personId || '')
    const dayKey = String(booking.dayKey || '')
    if (!personId || !dayKey) continue
    if (booking.kind === 'manager') managerBooked.add(`${personId}|${dayKey}`)
    else operativeBooked.add(`${personId}|${dayKey}`)
  }

  const operativesByEmail = new Map<string, RosterOperative>()
  const operativeIdsByEmail = new Map<string, Set<string>>()
  for (const operative of input.operatives) {
    const email = emailKey(operative.email)
    if (!email) continue
    const ids = operativeIdsByEmail.get(email) || new Set<string>()
    if (operative.id) ids.add(operative.id)
    operativeIdsByEmail.set(email, ids)
    const existing = operativesByEmail.get(email)
    if (!existing || operative.profileWeight > existing.profileWeight) {
      operativesByEmail.set(email, operative)
    }
  }

  const hasOperativeBooking = (operativeId: string | undefined, dayKey: string): boolean =>
    Boolean(operativeId) && operativeBooked.has(`${operativeId}|${dayKey}`)

  const hasManagerBooking = (userId: string | undefined, dayKey: string): boolean =>
    Boolean(userId) && managerBooked.has(`${userId}|${dayKey}`)

  const hasEmailOperativeBooking = (email: string, dayKey: string): boolean => {
    const ids = operativeIdsByEmail.get(email)
    if (!ids) return false
    for (const id of ids) {
      if (hasOperativeBooking(id, dayKey)) return true
    }
    return false
  }

  const approvedHolidays = input.holidays.filter((holiday) => holiday.approved)
  const holidayCovers = (dayKey: string, userId?: string, operativeId?: string): boolean =>
    approvedHolidays.some((holiday) => {
      if (dayKey < holiday.startDayKey || dayKey > holiday.endDayKey) return false
      const holidayUser = String(holiday.userId || '').trim()
      if (userId && holidayUser && holidayUser === userId) return true
      if (operativeId && holiday.operativeId && holiday.operativeId === operativeId) return true
      return false
    })

  const operativeUsers = dedupeFinishedPeople(input.people.filter(isOperativeModeOnly))
  const managerUsers = dedupeFinishedPeople(input.people.filter(isManagerOrAdmin))
  const managerAdminUserIds = new Set(
    input.people.filter(isManagerOrAdmin).filter(hasFinishedSignup).map((person) => person.id)
  )
  const operativeUserEmails = new Set(operativeUsers.map((person) => emailKey(person.email)).filter(Boolean))

  const verifiedUserForEmail = (email: string): LabourPerson | undefined => {
    if (!email) return undefined
    return preferFinishedAccount(input.people.filter((person) => emailKey(person.email) === email))
  }

  const roster = input.operatives.filter((operative) => operative.isActive !== false && !operative.isPlaceholder)
  const rows: UnbookedLabourRow[] = []

  for (const dayKey of eachDayKey(input.startDayKey, input.endDayKey, timeZone)) {
    const iso = isoWeekdayInZone(dateFromDayKeyInZone(dayKey, timeZone), timeZone)
    if (!input.includeWeekends && (iso < 1 || iso > 5)) continue
    const requiredHours = hoursForIsoWeekday(iso, input)
    if (requiredHours <= 0.001) continue
    const seen = new Set<string>()

    const append = (args: {
      personKey: string
      name: string
      email: string
      hasBooking: boolean
      operativeId: string
      userId?: string
    }) => {
      const seenKey = args.email || args.personKey
      if (seen.has(seenKey)) return
      seen.add(seenKey)
      if (args.hasBooking) return
      rows.push({
        id: `unbooked-${dayKey}-${args.personKey}`,
        operativeId: args.operativeId,
        operativeName: args.name,
        userId: args.userId,
        personKey: args.personKey,
        dayKey,
        missingHours: requiredHours,
        message: `${args.name} is not booked on ${formatUnbookedDay(dayKey, timeZone)}.`,
      })
    }

    for (const person of operativeUsers) {
      if (excluded.has(person.id)) continue
      const linked = operativesByEmail.get(emailKey(person.email))
      if (holidayCovers(dayKey, person.id, linked?.id)) continue
      const email = emailKey(person.email)
      append({
        personKey: person.id,
        name: person.name,
        email,
        hasBooking: hasEmailOperativeBooking(email, dayKey) || hasOperativeBooking(linked?.id, dayKey) || hasManagerBooking(person.id, dayKey),
        operativeId: linked?.id || person.id,
        userId: person.id,
      })
    }

    for (const person of managerUsers) {
      if (excluded.has(person.id)) continue
      const linked = operativesByEmail.get(emailKey(person.email))
      if (holidayCovers(dayKey, person.id, linked?.id)) continue
      const email = emailKey(person.email)
      append({
        personKey: person.id,
        name: person.name,
        email,
        hasBooking: hasEmailOperativeBooking(email, dayKey) || hasManagerBooking(person.id, dayKey) || hasOperativeBooking(linked?.id, dayKey),
        operativeId: linked?.id || person.id,
        userId: person.id,
      })
    }

    for (const operative of roster) {
      const email = emailKey(operative.email)
      if (email && operativeUserEmails.has(email)) continue
      const matched = email ? verifiedUserForEmail(email) : undefined
      if (!matched && email && input.people.some((person) => emailKey(person.email) === email)) continue
      if (matched && managerAdminUserIds.has(matched.id)) continue
      if (matched && excluded.has(matched.id)) continue
      if (holidayCovers(dayKey, matched?.id, operative.id)) continue
      append({
        personKey: matched?.id || operative.id,
        name: matched?.name || operative.name,
        email: email || operative.id,
        hasBooking: hasEmailOperativeBooking(email, dayKey) || hasOperativeBooking(operative.id, dayKey) || hasManagerBooking(matched?.id, dayKey),
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
