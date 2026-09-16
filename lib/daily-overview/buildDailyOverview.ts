/**
 * iOS parity source: Views/DailyOverviewView.swift grouping + unbooked labour
 * Spec: docs/ios-parity/sections/22-daily-overview.md
 *
 * Paid hours here use wall-clock / slot estimates (8h full day). The full
 * PayrollHoursEngine is section 17.
 */

import { addLondonDays, coversCalendarDay, dayKey, isSameLondonDay } from '@/lib/ios-parity/londonTime'
import { isSmallWorksJobType, normalizeBookingStatus } from '@/lib/ios-parity/enums'
import type { Booking, HolidayBooking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'

const STANDARD_PAID_HOURS = 8

export type OverviewSubcontractorBooking = {
  id: string
  subcontractorId: string
  projectId: string
  date: Date
  timeSlot?: string
  workStartTime?: string
  workEndTime?: string
  status?: string
  bookedOperativeNames?: string[]
}

export type OverviewPersonRow = {
  id: string
  name: string
  initials: string
  subtitle: string
  pillText: string
  bookedOperativeNames: string[]
  kind: 'operative' | 'manager' | 'subcontractor'
}

export function isLondonWeekday(date: Date): boolean {
  const wd = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short' }).format(date)
  return wd !== 'Sat' && wd !== 'Sun'
}

export function overviewFormatHours(hours: number): string {
  const rounded = Math.round(hours * 2) / 2
  if (Math.abs(rounded - Math.trunc(rounded)) < 0.01) return String(Math.trunc(rounded))
  return rounded.toFixed(1)
}

export function parseMinutes(hhmm?: string): number | null {
  if (!hhmm) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function estimatedPaidHours(input: { timeSlot?: string; workStartTime?: string; workEndTime?: string }): number {
  const start = parseMinutes(input.workStartTime)
  const end = parseMinutes(input.workEndTime)
  if (start != null && end != null && end > start) return (end - start) / 60
  const slot = String(input.timeSlot || '').toUpperCase().replace(/_/g, ' ')
  if (slot === 'AM' || slot === 'PM' || slot.includes('MORNING') || slot.includes('AFTERNOON')) return 4
  return STANDARD_PAID_HOURS
}

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

function placeholderProject(id: string): Project {
  return {
    id,
    jobNumber: 'Job',
    siteName: '',
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
  subcontractors?: { id: string; name: string }[]
}): DailyOverviewModel {
  const day = params.day
  const today = params.today || new Date()
  const dayBookings = params.bookings.filter((b) => {
    const status = normalizeBookingStatus(b.status)
    return coversCalendarDay(b.date, day) && (status === 'Confirmed' || status === 'Tentative')
  })
  const dayManager = params.managerBookings.filter((b) => coversCalendarDay(b.date, day))
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
    const list = bookingsByProject.get(b.projectId) || []
    list.push(b)
    bookingsByProject.set(b.projectId, list)
  }
  const projectIds = new Set(bookingsByProject.keys())
  for (const b of dayManager) {
    if ((b.locationType === 'project' || b.locationType === 'small_work') && b.locationId) {
      projectIds.add(b.locationId)
    }
  }
  for (const b of daySubs) {
    if (b.projectId) projectIds.add(b.projectId)
  }

  const personRowsForProject = (projectId: string): OverviewPersonRow[] => {
    const rows: OverviewPersonRow[] = []
    const opBookings = (bookingsByProject.get(projectId) || []).slice().sort((a, b) => {
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
      rows.push({
        id: `op-${b.id}`,
        name,
        initials: initialsFrom(name),
        subtitle: slotLabel(String(b.timeSlot)),
        pillText: `${overviewFormatHours(hours)}h`,
        bookedOperativeNames: [],
        kind: 'operative',
      })
    }
    const mgrs = dayManager
      .filter(
        (b) =>
          b.locationId === projectId && (b.locationType === 'project' || b.locationType === 'small_work')
      )
      .sort((a, b) => slotSortKey(a.timeSlot) - slotSortKey(b.timeSlot))
    for (const b of mgrs) {
      const user = params.users.find((row) => row.id === b.userId)
      const name = user ? displayName(user) : 'Manager'
      const hours = estimatedPaidHours(b)
      rows.push({
        id: `mgr-${b.id}`,
        name,
        initials: initialsFrom(name),
        subtitle: slotLabel(b.timeSlot),
        pillText: `${overviewFormatHours(hours)}h`,
        bookedOperativeNames: [],
        kind: 'manager',
      })
    }
    const subs = daySubs.filter((b) => b.projectId === projectId)
    for (const b of subs) {
      const firm = params.subcontractors?.find((row) => row.id === b.subcontractorId)
      const name = firm?.name || 'Subcontractor'
      const hours = estimatedPaidHours(b)
      rows.push({
        id: `sub-${b.id}`,
        name,
        initials: initialsFrom(name),
        subtitle: slotLabel(b.timeSlot),
        pillText: `${overviewFormatHours(hours)}h`,
        bookedOperativeNames: b.bookedOperativeNames || [],
        kind: 'subcontractor',
      })
    }
    return rows
  }

  const projectCards = [...projectIds]
    .map((id) => {
      const found = params.projects.find((p) => p.id === id)
      const project = found || placeholderProject(id)
      const bookings = bookingsByProject.get(id) || []
      const people = personRowsForProject(id)
      const bookedHours = people.reduce((sum, row) => sum + (Number.parseFloat(row.pillText) || 0), 0)
      return {
        project,
        bookings,
        isSmallWorks: isSmallWorksJobType(project.jobType || '') || /small works/i.test(project.jobType || ''),
        people,
        peopleCount: people.length,
        bookedHours,
      }
    })
    .sort((a, b) => a.project.siteName.localeCompare(b.project.siteName))

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
      p.operativeMode &&
      !p.manager &&
      !p.adminAccess &&
      !u.isSuperAdmin &&
      u.role !== 'admin'
    )
  })
  const managerUsers = params.users.filter((u) => {
    const p = permsOf(u)
    return u.isActive && (p.manager || p.adminAccess || u.isSuperAdmin || u.role === 'admin')
  })

  const unbookedNames: string[] = []
  const pushUnbooked = (user: User) => {
    const linked = params.operatives.find((o) => o.email.toLowerCase() === user.email.toLowerCase())
    if (holidays.some((h) => h.userId === user.id || (linked && h.operativeId === linked.id))) return
    const paid = (linked ? paidByOperative.get(linked.id) || 0 : 0) + (paidByUser.get(user.id) || 0)
    if (paid >= STANDARD_PAID_HOURS) return
    const missing = Math.max(0, STANDARD_PAID_HOURS - paid)
    const name = linked ? `${linked.firstName} ${linked.lastName}`.trim() || displayName(user) : displayName(user)
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
