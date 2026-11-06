/**
 * iOS parity source: Views/DailyOverviewView.swift grouping + unbooked labour
 * Spec: docs/ios-parity/sections/22-daily-overview.md
 *
 * Hours are the rulebook's `payrollHoursResult.workedHours` for the viewed day:
 * hours worked, never multiplied. Paid hours belong to pay screens.
 */

import { bookingOccupiesDay, formerIdAliases, isDailyOverviewRowInScope, isStandardWorkingWeekday, jobKind, multipliedHoursText, payrollMultipliedHours, payrollOutsideMultiplier, unbookedLabourRowsOnDay, weekdayPaidHours, workedHoursSplit, type JobAccessViewer } from '@/lib/canonical'
import { isoWeekdayInZone } from '@/lib/orgTime/zoneTime'
import { labourPersonFromUser, labourRosterOperative } from '@/lib/warnings/unbookedLabourWarnings'
import { orgDailyOverviewScope } from '@/lib/warnings/warningScopeRoster'
import { findUserByAnyId, rosterDisplayName } from '@/lib/staff/userRosterUtils'
import { addLondonDays, coversCalendarDay, dayKey, isSameLondonDay } from '@/lib/ios-parity/londonTime'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import {
  bookingPayrollHours,
  estimatedPaidHours,
  estimatedWorkedHours,
  formatHoursLabel as overviewFormatHours,
  parseMinutes,
} from '@/lib/scheduling/paidHours'
import { DEFAULT_PAYROLL_POLICY, type OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { bookingHoursLabel } from '@/lib/canonical/bookingSlots'
import { bookingTimesText } from '@/lib/scheduling/paidHours'
import type { Booking, HolidayBooking, Operative, Project, User } from '@/types'
import type { ManagerLocationType, ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import {
  formatSubcontractorBookingLabel,
  findSubcontractorFirm,
  resolveSubcontractorBookingPeople,
} from '@/lib/subcontractors/bookingPeople'
import { holidayBookingDayKeys, holidayBookingLabourInput } from '@/lib/annualLeave/holidayDayKeys'
import type { WeekendCoverage } from '@/lib/canonical'
import { normalizeDocumentId } from '@/lib/canonical'

export type OverviewSubcontractorBooking = {
  id: string
  subcontractorId: string
  projectId: string
  date: Date
  timeSlot?: string
  workStartTime?: string
  workEndTime?: string
  status?: string
  bookedContactIds?: string[]
  bookedOperativeNames?: string[]
}

export type OverviewPersonRow = {
  id: string
  personKey: string
  name: string
  initials: string
  subtitle: string
  pillText: string
  hours: number
  bookedOperativeNames: string[]
  kind: 'operative' | 'manager' | 'subcontractor'
  bookingId?: string
  userId?: string
  operativeId?: string
  projectId?: string
  locationType?: ManagerLocationType
  customLocationName?: string
  timeSlotRaw?: string
  workStartTime?: string
  workEndTime?: string
}

/** Shown when a booking's person id matches no user or operative. The booking still appears. */
export const UNKNOWN_BOOKED_PERSON = 'Unknown person'

export { overviewFormatHours, parseMinutes, estimatedPaidHours, estimatedWorkedHours }

function holidayCovers(booking: HolidayBooking, day: Date): boolean {
  if (booking.status !== 'approved') return false
  const key = dayKey(day)
  const { startDayKey, endDayKey } = holidayBookingDayKeys(booking)
  return startDayKey <= key && key <= endDayKey
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function slotSortKey(slot?: string): number {
  const s = String(slot || '').toUpperCase().replace(/_/g, ' ')
  if (s === 'AM' || s.includes('MORNING')) return 0
  if (s === 'FULL DAY' || s === 'FULLDAY') return 1
  if (s === 'PM' || s.includes('AFTERNOON')) return 2
  return 3
}

function operativeDisplayName(
  op: Operative | undefined,
  operativeId: string,
  users: readonly User[],
  aliases?: Record<string, string>
): string {
  const fromCatalogue = op
    ? rosterDisplayName({ firstName: op.firstName, surname: op.lastName, email: op.email })
    : ''
  if (fromCatalogue) return fromCatalogue
  return rosterDisplayName(findUserByAnyId(users, operativeId, aliases))
}

export type DailyOverviewModel = {
  day: Date
  dayLabel: string
  isToday: boolean
  isWeekday: boolean
  labourHours: number
  /** Of `labourHours`, hours worked inside the standard window (`workedHoursSplit`). */
  standardWorkedHours: number
  /** Of `labourHours`, clock hours at the multiplier, before it (1.20.3: before any unpaid break taken off them). */
  overtimeWorkedHours: number
  /**
   * Rulebook 1.20.3: the unpaid break taken off hours at the multiplier as plain hours (`payrollMultipliedHours`), so
   * standard + overtime × multiplier − this = `labourHours`. 0 when none.
   */
  overtimeBreakHours: number
  /** `multipliedHoursText` for the day's hours at the multiplier ("6.5h × 2 − 0.5h break = 12.5h"); null when none. */
  overtimeText: string | null
  /** That day's multiplier for the overtime hours (`payrollOutsideMultiplier`, or the booking's own). */
  overtimeMultiplier: number
  peopleCount: number
  jobsCount: number
  bookedPeopleCount: number
  unbookedCount: number
  unbookedNames: string[]
  officeCount: number
  wfhCount: number
  onSiteCount: number
  officeBookings: ManagerSiteBooking[]
  wfhBookings: ManagerSiteBooking[]
  siteSurveyBookings: ManagerSiteBooking[]
  customGroups: { name: string; bookings: ManagerSiteBooking[] }[]
  holidays: HolidayBooking[]
  projectCards: {
    project: Project
    bookings: Booking[]
    isSmallWorks: boolean
    people: OverviewPersonRow[]
    peopleCount: number
    bookedHours: number
  }[]
  empty: boolean
}

export function normalizeWorkId(id: string | undefined | null): string {
  const raw = String(id || '').trim().toUpperCase()
  if (!raw) return ''
  const compact = raw.replace(/-/g, '')
  if (/^[0-9A-F]{32}$/.test(compact)) return compact
  return raw
}

export function findWorkById(projects: Project[], id: string | undefined | null): Project | undefined {
  const key = normalizeWorkId(id)
  if (!key) return undefined
  return (
    projects.find((p) => normalizeWorkId(p.id) === key) ||
    projects.find((p) => normalizeWorkId(p.jobNumber) === key)
  )
}

function canonicalWorkKey(id: string | undefined | null, projects: Project[]): string {
  const found = findWorkById(projects, id)
  return found ? normalizeWorkId(found.id) : normalizeWorkId(id)
}

function placeholderProject(id: string): Project {
  return {
    id,
    jobNumber: id.slice(0, 8) || 'Job',
    siteName: 'Unknown job',
    addressLine1: '',
    townCity: '',
    postcode: '',
    client: { id: '', name: '', createdAt: new Date(), updatedAt: new Date() },
    startDate: new Date(),
    endDate: new Date(),
    jobType: 'CAT A',
    manager: { name: 'Custom', email: '' },
    isLive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    out.push(row)
  }
  return out
}

export function buildDailyOverview(params: {
  day: Date
  today?: Date
  projects: Project[]
  bookings: Booking[]
  managerBookings: ManagerSiteBooking[]
  holidays: HolidayBooking[]
  users: User[]
  userIdAliases?: Record<string, string>
  operatives: Operative[]
  subcontractorBookings?: OverviewSubcontractorBooking[]
  subcontractors?: { id: string; name: string; contacts?: { id: string; name: string }[] }[]
  payrollPolicy?: OrgPayrollTimePolicy
  /** `organizations/{orgId}.warningDetection.includeWeekendsForUnbookedLabour` */
  includeWeekendsForUnbookedLabour?: boolean
  /** `organizations/{orgId}.warningDetection.excludedUserIdsFromUnbookedWarnings` */
  excludedUserIdsFromUnbookedWarnings?: readonly string[] | null
  /** Rulebook 1.19.0 §5: `warningDetection.weekendCoverage` (missing → both days on, default windows). */
  weekendCoverage?: WeekendCoverage | null
  /** Organisation business zone (`organizationTimeZone`). Default Europe/London. */
  timeZone?: string
  /**
   * Rulebook 1.33.0 §6: the signed-in user. Admins see everyone and every subcontractor booking; a manager sees only
   * themselves and their reports — booked, on leave, unbooked and the day's hours (`dailyOverviewScopeFor`,
   * `isDailyOverviewRowInScope`). Missing → everything.
   */
  viewer?: JobAccessViewer | null
  /** Rulebook 1.26.0: the `enforcedReads` switch for this organisation (`securitySwitchOn`); missing → off. */
  enforcedReads?: boolean
}): DailyOverviewModel {
  const day = params.day
  // Rulebook §1: the organisation zone (1.9.0: the open organisation's when none is passed, never always London).
  const zone = organizationZoneOr(params.timeZone)
  const today = params.today || new Date()
  // Rulebook 1.33.0 §6 (owner decision 5 Nov, Q-D1): admins see everyone; a manager only themselves and their reports
  // (`dailyOverviewScopeFor`, no job part). Every row, count and hour below is taken from the rows in scope.
  const scope = params.viewer
    ? orgDailyOverviewScope({
        viewer: params.viewer,
        users: params.users,
        userIdAliases: params.userIdAliases,
        operatives: params.operatives,
        enforcedReads: params.enforcedReads === true,
      })
    : null
  const scopeEmailById = new Map<string, string>()
  for (const operative of params.operatives) scopeEmailById.set(normalizeDocumentId(operative.id), operative.email ?? '')
  for (const user of params.users) {
    for (const id of [user.id, ...(user.formerUserIds ?? [])]) {
      if (!scopeEmailById.get(normalizeDocumentId(id))) scopeEmailById.set(normalizeDocumentId(id), user.email ?? '')
    }
  }
  const personInScope = (...ids: Array<string | null | undefined>): boolean =>
    isDailyOverviewRowInScope(scope, {
      personIds: ids,
      email: ids.map((id) => scopeEmailById.get(normalizeDocumentId(id ?? '')) || '').find(Boolean) || null,
    })
  const dayBookings = uniqueById(params.bookings).filter(
    (b) => coversCalendarDay(b.date, day, zone) && bookingOccupiesDay(b.status) && personInScope(b.operativeId)
  )
  const dayManager = uniqueById(params.managerBookings).filter(
    (b) => coversCalendarDay(b.date, day, zone) && personInScope(b.userId)
  )
  const daySubs = (params.subcontractorBookings || []).filter((b) => {
    if (!coversCalendarDay(b.date, day, zone)) return false
    // Subcontractor bookings: admins only (`isDailyOverviewRowInScope` with `subcontractor`).
    if (!isDailyOverviewRowInScope(scope, { subcontractor: true })) return false
    const status = String(b.status || '').toLowerCase()
    return status !== 'cancelled' && status !== 'canceled'
  })
  const officeBookings = dayManager.filter((b) => b.locationType === 'office')
  const wfhBookings = dayManager.filter((b) => b.locationType === 'working_from_home')
  const siteSurveyBookings = dayManager.filter((b) => b.locationType === 'site_survey')
  const customMap = new Map<string, ManagerSiteBooking[]>()
  for (const b of dayManager.filter((row) => row.locationType === 'custom')) {
    const name = b.customLocationName?.trim() || 'Custom'
    const list = customMap.get(name) || []
    list.push(b)
    customMap.set(name, list)
  }
  const customGroups = [...customMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, bookings]) => ({ name, bookings }))

  // Rulebook 1.31.0 (audit finding 4): the fold's same-email ids count for the person kept.
  const labourPeople = params.users.map((user) => labourPersonFromUser(user, params.userIdAliases))
  // A booking saved under an invite placeholder id still names the person after sign-up.
  const userIdAliases = { ...formerIdAliases(labourPeople), ...(params.userIdAliases || {}) }
  const operativeById = new Map(params.operatives.map((operative) => [operative.id, operative]))
  const userById = new Map(params.users.map((user) => [user.id, user]))
  for (const [aliasId, keptId] of Object.entries(userIdAliases)) {
    const kept = userById.get(keptId)
    if (kept && !userById.has(aliasId)) userById.set(aliasId, kept)
  }
  const personIdentity = (email: string | undefined, fallback: string): string => {
    const key = (email || '').trim().toLowerCase()
    return key ? `email:${key}` : fallback
  }
  const operativeIdentity = (operativeId: string): string =>
    personIdentity(
      operativeById.get(operativeId)?.email || userById.get(operativeId)?.email,
      `op:${normalizeWorkId(operativeId)}`
    )
  const managerIdentity = (userId: string): string =>
    personIdentity(userById.get(userId)?.email, `mgr:${normalizeWorkId(userId)}`)

  const holidays = params.holidays.filter((h) => holidayCovers(h, day) && personInScope(h.userId, h.operativeId))

  const bookingsByProject = new Map<string, Booking[]>()
  for (const b of dayBookings) {
    if (!b.projectId) continue
    const key = canonicalWorkKey(b.projectId, params.projects)
    if (!key) continue
    const list = bookingsByProject.get(key) || []
    list.push(b)
    bookingsByProject.set(key, list)
  }
  const projectIds = new Set(bookingsByProject.keys())
  for (const b of dayManager) {
    if ((b.locationType === 'project' || b.locationType === 'small_work') && b.locationId) {
      const key = canonicalWorkKey(b.locationId, params.projects)
      if (key) projectIds.add(key)
    }
  }
  for (const b of daySubs) {
    if (b.projectId) {
      const key = canonicalWorkKey(b.projectId, params.projects)
      if (key) projectIds.add(key)
    }
  }

  const mergePersonRows = (rows: OverviewPersonRow[]): OverviewPersonRow[] => {
    const byPerson = new Map<string, OverviewPersonRow>()
    for (const row of rows) {
      const existing = byPerson.get(row.personKey)
      if (!existing) {
        byPerson.set(row.personKey, { ...row, bookedOperativeNames: [...row.bookedOperativeNames] })
        continue
      }
      existing.hours += row.hours
      existing.pillText = `${overviewFormatHours(existing.hours)}h`
      if (existing.subtitle !== row.subtitle) {
        existing.subtitle = `${existing.subtitle} · ${row.subtitle}`
      }
      if (existing.name !== row.name && row.bookedOperativeNames.length > existing.bookedOperativeNames.length) {
        existing.name = row.name
      }
      for (const name of row.bookedOperativeNames) {
        if (!existing.bookedOperativeNames.includes(name)) existing.bookedOperativeNames.push(name)
      }
    }
    return [...byPerson.values()]
  }

  const personRowsForProject = (projectKey: string): OverviewPersonRow[] => {
    const rows: OverviewPersonRow[] = []
    const opBookings = (bookingsByProject.get(projectKey) || []).slice().sort((a, b) => {
      const slot = slotSortKey(a.timeSlot) - slotSortKey(b.timeSlot)
      if (slot !== 0) return slot
      const nameA = operativeDisplayName(
        params.operatives.find((o) => normalizeDocumentId(o.id) === normalizeDocumentId(a.operativeId)),
        a.operativeId,
        params.users,
        userIdAliases
      )
      const nameB = operativeDisplayName(
        params.operatives.find((o) => normalizeDocumentId(o.id) === normalizeDocumentId(b.operativeId)),
        b.operativeId,
        params.users,
        userIdAliases
      )
      return nameA.localeCompare(nameB)
    })
    for (const b of opBookings) {
      const op = operativeById.get(b.operativeId)
      // A booking is never hidden because its person cannot be named.
      const name = operativeDisplayName(op, b.operativeId, params.users, userIdAliases) || UNKNOWN_BOOKED_PERSON
      // Rulebook 1.20.2 (`bookingHoursLabel`): the pay rule's hours for the day, e.g. "13h (6.5h × 2)", never clock hours.
      const shown = bookingHoursLabel(bookingPayrollHours({ ...b, policy: params.payrollPolicy ?? DEFAULT_PAYROLL_POLICY, date: params.day, timeZone: zone }))
      const hours = shown.hours
      const linkedUser = op
        ? params.users.find((row) => row.email.trim().toLowerCase() === op.email.trim().toLowerCase())
        : userById.get(b.operativeId)
      rows.push({
        id: `op-${b.id}`,
        personKey: operativeIdentity(b.operativeId),
        name,
        initials: initialsFrom(name),
        subtitle: bookingTimesText(b),
        pillText: shown.label,
        hours,
        bookedOperativeNames: [],
        kind: 'operative',
        bookingId: b.id,
        operativeId: b.operativeId,
        userId: linkedUser?.id,
        projectId: b.projectId,
        timeSlotRaw: String(b.timeSlot || 'FULL DAY'),
        workStartTime: b.workStartTime,
        workEndTime: b.workEndTime,
      })
    }
    const mgrs = dayManager
      .filter(
        (b) =>
          canonicalWorkKey(b.locationId, params.projects) === projectKey &&
          (b.locationType === 'project' || b.locationType === 'small_work')
      )
      .sort((a, b) => slotSortKey(a.timeSlot) - slotSortKey(b.timeSlot))
    for (const b of mgrs) {
      const user = userById.get(b.userId) || findUserByAnyId(params.users, b.userId, userIdAliases)
      const name = rosterDisplayName(user) || UNKNOWN_BOOKED_PERSON
      // Rulebook 1.20.2 (`bookingHoursLabel`): the pay rule's hours for the day, e.g. "13h (6.5h × 2)", never clock hours.
      const shown = bookingHoursLabel(bookingPayrollHours({ ...b, policy: params.payrollPolicy ?? DEFAULT_PAYROLL_POLICY, date: params.day, timeZone: zone }))
      const hours = shown.hours
      rows.push({
        id: `mgr-${b.id}`,
        personKey: managerIdentity(b.userId),
        name,
        initials: initialsFrom(name),
        subtitle: bookingTimesText(b),
        pillText: shown.label,
        hours,
        bookedOperativeNames: [],
        kind: 'manager',
        bookingId: b.id,
        userId: b.userId,
        projectId: b.locationId,
        locationType: b.locationType,
        customLocationName: b.customLocationName,
        timeSlotRaw: b.timeSlot,
        workStartTime: b.workStartTime,
        workEndTime: b.workEndTime,
      })
    }
    const subs = daySubs.filter((b) => canonicalWorkKey(b.projectId, params.projects) === projectKey)
    for (const b of subs) {
      const firm = findSubcontractorFirm(params.subcontractors, b.subcontractorId)
      const people = resolveSubcontractorBookingPeople(b, firm)
      const name = formatSubcontractorBookingLabel(firm?.name || 'Subcontractor', people)
      // Rulebook 1.20.2 (`bookingHoursLabel`): the pay rule's hours for the day, e.g. "13h (6.5h × 2)", never clock hours.
      const shown = bookingHoursLabel(bookingPayrollHours({ ...b, policy: params.payrollPolicy ?? DEFAULT_PAYROLL_POLICY, date: params.day, timeZone: zone }))
      const hours = shown.hours
      rows.push({
        id: `sub-${b.id}`,
        personKey: `sub:${normalizeWorkId(b.subcontractorId)}`,
        name,
        initials: initialsFrom(firm?.name || name),
        subtitle: bookingTimesText(b),
        pillText: shown.label,
        hours,
        bookedOperativeNames: people,
        kind: 'subcontractor',
      })
    }
    return mergePersonRows(rows)
  }

  const projectCards = [...projectIds]
    .map((id) => {
      const found = findWorkById(params.projects, id)
      const project = found || placeholderProject(id)
      const bookings = bookingsByProject.get(id) || []
      const people = personRowsForProject(id)
      const bookedHours = people.reduce((sum, row) => sum + row.hours, 0)
      return {
        project,
        bookings,
        // Rulebook 1.11.0 / 1.21.0 (`jobKind`): the collection decides small works, never the `jobType` text.
        isSmallWorks: jobKind(project, project.collection ?? null) === 'smallWorks',
        people,
        peopleCount: people.length,
        bookedHours,
      }
    })
    .sort(
      (a, b) =>
        a.project.siteName.localeCompare(b.project.siteName) ||
        a.project.jobNumber.localeCompare(b.project.jobNumber)
    )

  const onSiteKeys = new Set<string>()
  for (const b of dayBookings) onSiteKeys.add(operativeIdentity(b.operativeId))
  for (const b of dayManager) {
    if (b.locationType === 'project' || b.locationType === 'small_work') onSiteKeys.add(managerIdentity(b.userId))
  }
  for (const b of daySubs) onSiteKeys.add(`sub:${b.subcontractorId || b.id}`)

  const bookedKeys = new Set(onSiteKeys)
  for (const b of dayManager) bookedKeys.add(managerIdentity(b.userId))

  const overviewDayKey = dayKey(day)
  const payroll = params.payrollPolicy ?? DEFAULT_PAYROLL_POLICY
  const unbookedRows = unbookedLabourRowsOnDay({
    scope,
    timeZone: zone,
    dayKey: overviewDayKey,
    includeWeekends: Boolean(params.includeWeekendsForUnbookedLabour),
    excludedUserIds: params.excludedUserIdsFromUnbookedWarnings,
    // 1.19.0: the weekend requirement is that day's "Hours to cover" window, read under the day's policy.
    weekendCoverage: params.weekendCoverage ?? null,
    payrollPolicy: payroll,
    standardPaidHours: weekdayPaidHours(payroll),
    standardDayStart: payroll.standardDayStart,
    standardDayEnd: payroll.standardDayEnd,
    breakWindowStart: payroll.breakWindowStart,
    breakWindowEnd: payroll.breakWindowEnd,
    people: labourPeople,
    operatives: params.operatives.map(labourRosterOperative),
    bookings: [
      ...dayBookings.map((booking) => ({
        personId: booking.operativeId,
        dayKey: overviewDayKey,
        kind: 'operative' as const,
        timeSlot: booking.timeSlot,
        workStart: booking.workStartTime,
        workEnd: booking.workEndTime,
      })),
      ...dayManager.map((booking) => ({
        personId: booking.userId,
        dayKey: overviewDayKey,
        kind: 'manager' as const,
        timeSlot: booking.timeSlot,
        workStart: booking.workStartTime,
        workEnd: booking.workEndTime,
      })),
    ],
    // Parsed day keys from `parseHolidayDocument` (rulebook §9); `holidays` is already the approved leave.
    holidays: holidays.map((holiday) => ({ ...holidayBookingLabourInput(holiday, zone), approved: true })),
  })
  const unbookedNames = unbookedRows.map(
    (row) => `${row.operativeName} (missing ${overviewFormatHours(row.missingHours)}h)`
  )

  const policy = params.payrollPolicy ?? DEFAULT_PAYROLL_POLICY
  const labourResults = [
    ...dayBookings,
    ...dayManager.filter((b) => b.locationType === 'project' || b.locationType === 'small_work'),
    ...daySubs,
  ].map((b) => bookingPayrollHours({ ...b, policy, date: params.day }))
  // Rulebook 1.20.2: the day's hours are the pay rule's (`totalPaidHours`): standard hours, plus hours at the
  // multiplier shown beside it — the same figures as each row.
  const labourHours = labourResults.reduce((sum, r) => sum + r.totalPaidHours, 0)
  let standardWorkedHours = 0
  let overtimeWorkedHours = 0
  let overtimeBreakHours = 0
  for (const r of labourResults) {
    standardWorkedHours += r.standardHours
    // 1.20.3: clock hours at the multiplier and the break off them as plain hours — never the back-calculated base.
    const multiplied = payrollMultipliedHours(r)
    overtimeWorkedHours += multiplied ? multiplied.clockHours : r.outsideHours
    overtimeBreakHours += multiplied ? multiplied.breakHours : 0
  }
  const overtimeMultiplier =
    labourResults.filter((r) => r.outsideHours > 0).reduce((max, r) => Math.max(max, r.outsideMultiplier), 0) ||
    payrollOutsideMultiplier({}, isoWeekdayInZone(params.day, zone), policy)
  const multipliers = new Set(labourResults.filter((r) => r.outsideHours > 0).map((r) => r.outsideMultiplier))
  const overtimeText =
    overtimeWorkedHours > 0 && multipliers.size <= 1
      ? multipliedHoursText({ clockHours: overtimeWorkedHours, multiplier: overtimeMultiplier, breakHours: overtimeBreakHours })
      : null

  const hasOther = officeBookings.length > 0 || wfhBookings.length > 0 || customGroups.length > 0
  const empty =
    projectCards.length === 0 && holidays.length === 0 && !hasOther && siteSurveyBookings.length === 0

  const dayLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(day)

  return {
    day,
    dayLabel,
    isToday: isSameLondonDay(day, today, zone),
    // Rulebook §1 `WORKING_WEEK`: Monday–Friday in the organisation zone (was always London).
    isWeekday: isStandardWorkingWeekday(isoWeekdayInZone(day, zone)),
    labourHours,
    standardWorkedHours,
    overtimeWorkedHours,
    overtimeBreakHours,
    overtimeText,
    overtimeMultiplier,
    peopleCount: Math.max(onSiteKeys.size, bookedKeys.size),
    jobsCount: projectCards.length,
    bookedPeopleCount: bookedKeys.size,
    unbookedCount: unbookedNames.length,
    unbookedNames,
    officeCount: new Set(officeBookings.map((b) => managerIdentity(b.userId))).size,
    wfhCount: new Set(wfhBookings.map((b) => managerIdentity(b.userId))).size,
    onSiteCount: onSiteKeys.size,
    officeBookings,
    wfhBookings,
    siteSurveyBookings,
    customGroups,
    holidays,
    projectCards,
    empty,
  }
}

export function shiftOverviewDay(day: Date, delta: number): Date {
  return addLondonDays(day, delta)
}

/**
 * Unbooked names are "nobody in either booking list". Publishing that list
 * before a still-empty read finishes marks people who are already booked.
 */
export function dailyOverviewMayPublish(input: {
  bookingsLoading: boolean
  bookingCount: number
  managerLoading: boolean
  managerBookingCount: number
}): boolean {
  const operativeStillEmpty = input.bookingsLoading && input.bookingCount === 0
  const managerStillEmpty = input.managerLoading && input.managerBookingCount === 0
  return !operativeStillEmpty && !managerStillEmpty
}
