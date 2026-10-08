/**
 * Which qualification, unverified, and unbooked-labour warnings exist.
 *
 * Plain data only. Web wrappers map app types in and out.
 * The iOS bundle calls these functions instead of a second person-selection loop.
 */

import { standardDayCoverage, type StandardDayBooking } from './engine'
import {
  LONDON_TIME_ZONE,
  addDaysInZone,
  dateFromDayKeyInZone,
  dayKeyInZone,
  isoWeekdayInZone,
} from '../orgTime/zoneTime'

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
  /** Missing slot means a full standard day, so older callers stay compatible. */
  timeSlot?: string | null
  workStart?: string | null
  workEnd?: string | null
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
  /** Organisation standard day. Defaults to 07:30–16:00 with a 12:00–12:30 break. */
  standardDayStart?: string | null
  standardDayEnd?: string | null
  breakWindowStart?: string | null
  breakWindowEnd?: string | null
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

function zoneOf(timeZone?: string | null): string {
  const value = String(timeZone || '').trim()
  return value || LONDON_TIME_ZONE
}

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

function eachDayKey(startKey: string, endKey: string, timeZone: string): string[] {
  if (!startKey || !endKey || startKey > endKey) return []
  const keys: string[] = []
  let cursor = dateFromDayKeyInZone(startKey, timeZone)
  while (dayKeyInZone(cursor, timeZone) <= endKey) {
    keys.push(dayKeyInZone(cursor, timeZone))
    cursor = addDaysInZone(cursor, 1, timeZone)
    if (keys.length > 400) break
  }
  return keys
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

function formatCoverageHours(hours: number): string {
  const rounded = Math.round(hours * 2) / 2
  if (Math.abs(rounded - Math.trunc(rounded)) < 0.01) return String(Math.trunc(rounded))
  return rounded.toFixed(1)
}

function formatUnbookedDay(dayKey: string, timeZone: string): string {
  const date = dateFromDayKeyInZone(dayKey, timeZone)
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

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

function asCoverageBooking(booking: LabourBooking): StandardDayBooking {
  return {
    timeSlot: booking.timeSlot,
    workStart: booking.workStart,
    workEnd: booking.workEnd,
  }
}

/**
 * People who do not cover the organisation standard day inside the window.
 * Pending invitees are not unbooked. A weekend whose counts-as hours are 0 is not unbooked.
 * Bookings on any operative profile that shares the email count toward that day.
 * A partial booking stays unbooked and reports the hours still missing.
 * A clash is a separate warning: overlapping time does not create a second gap.
 */
export function unbookedLabourRows(input: UnbookedLabourInput): UnbookedLabourRow[] {
  const timeZone = zoneOf(input.timeZone)
  const excluded = new Set((input.excludedUserIds || []).map((id) => String(id)))
  const dayPolicy = {
    standardDayStart: input.standardDayStart,
    standardDayEnd: input.standardDayEnd,
    breakWindowStart: input.breakWindowStart,
    breakWindowEnd: input.breakWindowEnd,
  }
  const operativeBookings = new Map<string, StandardDayBooking[]>()
  const managerBookings = new Map<string, StandardDayBooking[]>()
  for (const booking of input.bookings) {
    const personId = String(booking.personId || '')
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

  const slotsFor = (email: string, operativeId: string | undefined, userId: string | undefined, dayKey: string): StandardDayBooking[] => {
    const slots: StandardDayBooking[] = []
    const ids = new Set<string>()
    if (operativeId) ids.add(operativeId)
    const linked = operativeIdsByEmail.get(email)
    if (linked) for (const id of linked) ids.add(id)
    for (const id of ids) slots.push(...(operativeBookings.get(`${id}|${dayKey}`) || []))
    if (userId) slots.push(...(managerBookings.get(`${userId}|${dayKey}`) || []))
    return slots
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
    const weekendRequired = hoursForIsoWeekday(iso, input)
    if (iso >= 6 && weekendRequired <= 0.001) continue
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
      const coverage = standardDayCoverage(dayPolicy, slotsFor(args.email, args.operativeId, args.userId, dayKey))
      const requiredHours = iso >= 6 ? weekendRequired : coverage.requiredHours
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
      if (excluded.has(person.id)) continue
      const linked = operativesByEmail.get(emailKey(person.email))
      if (holidayCovers(dayKey, person.id, linked?.id)) continue
      const email = emailKey(person.email)
      append({
        personKey: person.id,
        name: person.name,
        email,
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
