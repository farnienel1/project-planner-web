/**
 * iOS parity source: Views/DailyOverviewView.swift grouping + unbooked labour
 * Spec: docs/ios-parity/sections/22-daily-overview.md
 *
 * Paid hours here use wall-clock / slot estimates (8h full day). The full
 * PayrollHoursEngine is section 17.
 */

import { addLondonDays, coversCalendarDay, dayKey, isSameLondonDay } from '@/lib/ios-parity/londonTime'
import { isSmallWorksJobType, normalizeBookingStatus } from '@/lib/ios-parity/enums'
import {
  estimatedPaidHours,
  formatHoursLabel as overviewFormatHours,
  parseMinutes,
} from '@/lib/scheduling/paidHours'
import type { Booking, HolidayBooking, Operative, Project, User } from '@/types'
import type { ManagerLocationType, ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import {
  formatSubcontractorBookingLabel,
  findSubcontractorFirm,
  resolveSubcontractorBookingPeople,
} from '@/lib/subcontractors/bookingPeople'

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

export function isLondonWeekday(date: Date): boolean {
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short' }).format(date)
  return wd !== 'Sat' && wd !== 'Sun'
}

export { overviewFormatHours, parseMinutes, estimatedPaidHours }

const STANDARD_PAID_HOURS = 8

function displayName(user: User): string {
  const full = `${user.firstName || ''} ${user.surname || ''}`.trim()
  return full || user.email.split('@')[0] || user.email
}

function holidayCovers(booking: HolidayBooking, day: Date): boolean {
  if (booking.status !== 'approved') return false
  const key = dayKey(day)
  return dayKey(booking.startDate) <= key && key <= dayKey(booking.endDate)
}

export function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function slotLabel(slot?: string): string {
  const s = String(slot || '').toUpperCase().replace(/_/g, ' ')
  if (s === 'FULL DAY' || s === 'FULLDAY') return 'Full day'
  if (s === 'AM' || s.includes('MORNING')) return 'Morning (AM)'
  if (s === 'PM' || s.includes('AFTERNOON')) return 'Afternoon (PM)'
  if (s === 'CUSTOM HOURS' || s === 'CUSTOMHOURS') return 'Custom hours'
  return slot?.trim() || 'Full day'
}

function slotSortKey(slot?: string): number {
  const s = String(slot || '').toUpperCase().replace(/_/g, ' ')
  if (s === 'AM' || s.includes('MORNING')) return 0
  if (s === 'FULL DAY' || s === 'FULLDAY') return 1
  if (s === 'PM' || s.includes('AFTERNOON')) return 2
  return 3
}

function permsOf(user: User): User['permissions'] {
  return user.permissions || ({} as User['permissions'])
}

function operativeDisplayName(op: Operative | undefined, fallbackId: string): string {
  if (!op) return 'Operative'
  return `${op.firstName || ''} ${op.lastName || ''}`.trim() || op.email || fallbackId
}

export type DailyOverviewModel = {
  day: Date
  dayLabel: string
  isToday: boolean
  isWeekday: boolean
  labourHours: number
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
  operatives: Operative[]
  subcontractorBookings?: OverviewSubcontractorBooking[]
  subcontractors?: { id: string; name: string; contacts?: { id: string; name: string }[] }[]
}): DailyOverviewModel {
  const day = params.day
  const today = params.today || new Date()
  const dayBookings = uniqueById(params.bookings).filter((b) => {
    const status = normalizeBookingStatus(b.status)
    return coversCalendarDay(b.date, day) && (status === 'Confirmed' || status === 'Tentative')
  })
  const dayManager = uniqueById(params.managerBookings).filter((b) => coversCalendarDay(b.date, day))
  const daySubs = (params.subcontractorBookings || []).filter((b) => {
    if (!coversCalendarDay(b.date, day)) return false
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

  const holidays = params.holidays.filter((h) => holidayCovers(h, day))

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
        params.operatives.find((o) => o.id === a.operativeId),
        a.operativeId
      )
      const nameB = operativeDisplayName(
        params.operatives.find((o) => o.id === b.operativeId),
        b.operativeId
      )
      return nameA.localeCompare(nameB)
    })
    for (const b of opBookings) {
      const op = params.operatives.find((row) => row.id === b.operativeId)
      const name = operativeDisplayName(op, b.operativeId)
      const hours = estimatedPaidHours(b)
      const linkedUser = op
        ? params.users.find((row) => row.email.trim().toLowerCase() === op.email.trim().toLowerCase())
        : undefined
      rows.push({
        id: `op-${b.id}`,
        personKey: `op:${normalizeWorkId(b.operativeId)}`,
        name,
        initials: initialsFrom(name),
        subtitle: slotLabel(String(b.timeSlot)),
        pillText: `${overviewFormatHours(hours)}h`,
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
      const user = params.users.find((row) => row.id === b.userId)
      const name = user ? displayName(user) : 'Manager'
      const hours = estimatedPaidHours(b)
      rows.push({
        id: `mgr-${b.id}`,
        personKey: `mgr:${normalizeWorkId(b.userId)}`,
        name,
        initials: initialsFrom(name),
        subtitle: slotLabel(b.timeSlot),
        pillText: `${overviewFormatHours(hours)}h`,
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
      const hours = estimatedPaidHours(b)
      rows.push({
        id: `sub-${b.id}`,
        personKey: `sub:${normalizeWorkId(b.subcontractorId)}`,
        name,
        initials: initialsFrom(firm?.name || name),
        subtitle: slotLabel(b.timeSlot),
        pillText: `${overviewFormatHours(hours)}h`,
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
        isSmallWorks: isSmallWorksJobType(project.jobType || '') || /small works/i.test(project.jobType || ''),
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
  for (const b of dayBookings) onSiteKeys.add(`op:${b.operativeId}`)
  for (const b of dayManager) {
    if (b.locationType === 'project' || b.locationType === 'small_work') onSiteKeys.add(`u:${b.userId}`)
  }
  for (const b of daySubs) onSiteKeys.add(`sub:${b.subcontractorId || b.id}`)

  const bookedKeys = new Set(onSiteKeys)
  for (const b of dayManager) bookedKeys.add(`u:${b.userId}`)

  const paidByOperative = new Map<string, number>()
  for (const b of dayBookings) {
    paidByOperative.set(b.operativeId, (paidByOperative.get(b.operativeId) || 0) + estimatedPaidHours(b))
  }
  const paidByUser = new Map<string, number>()
  for (const b of dayManager) {
    paidByUser.set(b.userId, (paidByUser.get(b.userId) || 0) + estimatedPaidHours(b))
  }

  const operativeUsers = params.users.filter((u) => {
    const p = permsOf(u)
    return (
      u.isActive &&
      u.passwordSet &&
      p.operativeMode &&
      !p.manager &&
      !p.adminAccess &&
      !u.isSuperAdmin &&
      u.role !== 'admin'
    )
  })
  const managerUsers = params.users.filter((u) => {
    const p = permsOf(u)
    return u.isActive && u.passwordSet && (p.manager || p.adminAccess || u.isSuperAdmin || u.role === 'admin')
  })

  const unbookedNames: string[] = []
  const pushUnbooked = (user: User) => {
    const linked = params.operatives.find((o) => o.email.toLowerCase() === user.email.toLowerCase())
    if (holidays.some((h) => h.userId === user.id || (linked && h.operativeId === linked.id))) return
    const paid = (linked ? paidByOperative.get(linked.id) || 0 : 0) + (paidByUser.get(user.id) || 0)
    if (paid >= STANDARD_PAID_HOURS) return
    const missing = Math.max(0, STANDARD_PAID_HOURS - paid)
    const name = `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email
    unbookedNames.push(`${name} (missing ${overviewFormatHours(missing)}h)`)
  }
  operativeUsers.forEach(pushUnbooked)
  managerUsers.forEach(pushUnbooked)
  unbookedNames.sort()

  const labourHours = [
    ...dayBookings,
    ...dayManager.filter((b) => b.locationType === 'project' || b.locationType === 'small_work'),
    ...daySubs,
  ].reduce((sum, b) => sum + estimatedPaidHours(b), 0)

  const hasOther = officeBookings.length > 0 || wfhBookings.length > 0 || customGroups.length > 0
  const empty =
    projectCards.length === 0 && holidays.length === 0 && !hasOther && siteSurveyBookings.length === 0

  const dayLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(day)

  return {
    day,
    dayLabel,
    isToday: isSameLondonDay(day, today),
    isWeekday: isLondonWeekday(day),
    labourHours,
    peopleCount: Math.max(onSiteKeys.size, bookedKeys.size),
    jobsCount: projectCards.length,
    bookedPeopleCount: bookedKeys.size,
    unbookedCount: unbookedNames.length,
    unbookedNames,
    officeCount: new Set(officeBookings.map((b) => b.userId)).size,
    wfhCount: new Set(wfhBookings.map((b) => b.userId)).size,
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
