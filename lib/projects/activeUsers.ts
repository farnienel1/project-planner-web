/**
 * iOS parity source: Views/ProjectActiveOperativesView.swift, ProjectDetailView.canViewActiveOperatives
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 *
 * Everyone booked onto a project or small works site: operatives, staff, subcontractors.
 */
import { isOperativeMode } from '@/lib/permissions'
import { idsMatch } from '@/lib/subcontractors/bookingPeople'
import { normalizeBookingStatus } from '@/lib/ios-parity/enums'
import { bookingPersonKey, isOpenBookingStatus, jobTileBadges, resolveBookingPerson, type FoldPersonRow } from '@/lib/canonical'
import { paidBookedHours, scheduleLabel } from '@/lib/timesheets/timesheetHours'
import { DEFAULT_PAYROLL_POLICY, type OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import type { Manager, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import type { SubcontractorBookingRow } from '@/lib/weekly-report/weeklyReportData'

export type ActiveUserKind = 'operative' | 'staff' | 'subcontractor'

export type ActiveUserBooking = {
  id: string
  date: Date
  timeSlot: string
  workStartTime?: string
  workEndTime?: string
  isBreakRemoved?: boolean
  status?: string
}

export type ActiveUserSummary = {
  id: string
  kind: ActiveUserKind
  displayName: string
  subtitle: string
  initials: string
  bookingCount: number
  totalHours: number
  firstDate: Date
  lastDate: Date
}

export type ActiveUserDayRow = {
  id: string
  date: Date
  scheduleLabel: string
  hours: number
}

type OperativeBooking = ActiveUserBooking & {
  operativeId: string
  projectId: string
}

type NamedOperative = { id: string; firstName: string; lastName: string; email?: string | null }
type NamedSubcontractor = { id: string; name: string; subcontractorType?: string }

export function formatActiveUserHours(value: number): string {
  const rounded = Math.round(value * 2) / 2
  if (Math.abs(rounded - Math.round(rounded)) < 0.001) return String(Math.round(rounded))
  return rounded.toFixed(1)
}

export function activeUserInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('')
  }
  return (parts[0] || trimmed).slice(0, 2).toUpperCase()
}

export function assignedManagerIds(project: Pick<Project, 'managerId' | 'managerIds'>): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const id of [project.managerId, ...(project.managerIds || [])]) {
    const trimmed = id?.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    output.push(trimmed)
  }
  return output
}

/** Admins, or a manager whose roster row is assigned on the job. Operative mode never sees it. */
export function canViewProjectActiveUsers(
  user: User | null | undefined,
  managers: Pick<Manager, 'id' | 'email'>[],
  project: Pick<Project, 'managerId' | 'managerIds'>
): boolean {
  if (!user || isOperativeMode(user)) return false
  if (user.isSuperAdmin || user.permissions.adminAccess || user.role === 'admin') return true
  if (!user.permissions.manager) return false
  const email = user.email.trim().toLowerCase()
  if (!email) return false
  const assigned = assignedManagerIds(project)
  return managers.some(
    (manager) =>
      manager.email.trim().toLowerCase() === email && assigned.some((id) => idsMatch(id, manager.id))
  )
}

function bookingHours(booking: ActiveUserBooking, policy: OrgPayrollTimePolicy): number {
  return paidBookedHours(
    booking.timeSlot,
    booking.workStartTime,
    booking.workEndTime,
    policy,
    booking.isBreakRemoved
  )
}

function isCancelled(status: string | undefined): boolean {
  return normalizeBookingStatus(status) === 'Cancelled'
}

function summarize(input: {
  id: string
  kind: ActiveUserKind
  displayName: string
  subtitle: string
  bookings: ActiveUserBooking[]
  policy: OrgPayrollTimePolicy
}): ActiveUserSummary | null {
  if (input.bookings.length === 0) return null
  const sorted = [...input.bookings].sort((a, b) => a.date.getTime() - b.date.getTime())
  const totalHours = input.bookings.reduce((sum, booking) => sum + bookingHours(booking, input.policy), 0)
  return {
    id: input.id,
    kind: input.kind,
    displayName: input.displayName,
    subtitle: input.subtitle,
    initials: activeUserInitials(input.displayName),
    bookingCount: input.bookings.length,
    totalHours,
    firstDate: sorted[0].date,
    lastDate: sorted[sorted.length - 1].date,
  }
}

function personName(user: Pick<User, 'firstName' | 'surname' | 'email'> | undefined): string {
  if (!user) return 'Staff member'
  const full = `${user.firstName || ''} ${user.surname || ''}`.trim()
  return full || user.email || 'Staff member'
}

export function buildProjectActiveUsers(input: {
  projectId: string
  operativeBookings: OperativeBooking[]
  operatives: NamedOperative[]
  managerBookings: ManagerSiteBooking[]
  users: User[]
  subcontractorBookings: SubcontractorBookingRow[]
  subcontractors: NamedSubcontractor[]
  payrollPolicy?: OrgPayrollTimePolicy
}): ActiveUserSummary[] {
  const policy = input.payrollPolicy ?? DEFAULT_PAYROLL_POLICY
  const rows: ActiveUserSummary[] = []

  // A booking's `operativeId` may be a catalogue row or the person's users id (Book labour books an operative with
  // no catalogue row under it). The rulebook decides who it names (`resolveBookingPerson`), and one person's
  // bookings under several ids are one row (`bookingPersonKey`).
  const people = {
    accounts: input.users.map((user) => ({ id: user.id, email: user.email, formerIds: user.formerUserIds ?? [] })),
    operatives: input.operatives.map((operative) => ({ id: operative.id, email: operative.email ?? null })),
  }
  const operativeGroups = new Map<string, { storedId: string; bookings: OperativeBooking[] }>()
  for (const booking of input.operativeBookings) {
    if (!idsMatch(booking.projectId, input.projectId) || isCancelled(booking.status)) continue
    const storedId = booking.operativeId.trim()
    if (!storedId) continue
    const key = bookingPersonKey(storedId, people)
    const group = operativeGroups.get(key) || { storedId, bookings: [] }
    group.bookings.push(booking)
    operativeGroups.set(key, group)
  }
  for (const { storedId, bookings } of operativeGroups.values()) {
    const person = resolveBookingPerson(storedId, people)
    const operative = person.operativeId ? input.operatives.find((row) => idsMatch(row.id, person.operativeId!)) : undefined
    const user = person.accountId ? input.users.find((row) => idsMatch(row.id, person.accountId!)) : undefined
    if (!operative && !user) continue
    const name = operative ? `${operative.firstName} ${operative.lastName}`.trim() : personName(user)
    const summary = summarize({
      id: `op-${operative ? operative.id : user!.id}`,
      kind: 'operative',
      displayName: name || 'Operative',
      subtitle: 'Operative',
      bookings,
      policy,
    })
    if (summary) rows.push(summary)
  }

  const staffGroups = new Map<string, ManagerSiteBooking[]>()
  for (const booking of input.managerBookings) {
    if (!idsMatch(booking.locationId, input.projectId)) continue
    if (booking.locationType !== 'project' && booking.locationType !== 'small_work') continue
    const key = booking.userId.trim()
    if (!key) continue
    const group = staffGroups.get(key) || []
    group.push(booking)
    staffGroups.set(key, group)
  }
  for (const [userId, bookings] of staffGroups) {
    const user = input.users.find((row) => idsMatch(row.id, userId))
    const summary = summarize({
      id: `staff-${userId}`,
      kind: 'staff',
      displayName: personName(user),
      subtitle: user?.permissions.manager ? 'Manager / staff' : 'Staff',
      bookings,
      policy,
    })
    if (summary) rows.push(summary)
  }

  const subGroups = new Map<string, SubcontractorBookingRow[]>()
  for (const booking of input.subcontractorBookings) {
    if (!idsMatch(booking.projectId, input.projectId) || !isOpenBookingStatus(booking.status)) continue
    const key = booking.subcontractorId.trim()
    if (!key) continue
    const group = subGroups.get(key) || []
    group.push(booking)
    subGroups.set(key, group)
  }
  for (const [subcontractorId, bookings] of subGroups) {
    const firm = input.subcontractors.find((row) => idsMatch(row.id, subcontractorId))
    if (!firm) continue
    const summary = summarize({
      id: `sub-${firm.id}`,
      kind: 'subcontractor',
      displayName: firm.name.trim() || 'Subcontractor',
      subtitle: firm.subcontractorType?.trim() ? firm.subcontractorType.trim() : 'Subcontractor',
      bookings,
      policy,
    })
    if (summary) rows.push(summary)
  }

  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))
}

/**
 * Tile badge (rulebook 1.23.0 §21 `jobTileBadges`): people booked on the job, each person once under all their ids
 * (`people`: users, operatives and managers rows), plus subcontractor firms with an open booking.
 */
export function countProjectActiveUsers(input: {
  projectId: string
  operativeBookings: Array<{ operativeId: string; projectId: string; status?: string }>
  managerBookings: Array<{ userId: string; locationId?: string; locationType: string }>
  subcontractorBookings: Array<{ subcontractorId: string; projectId: string; status?: string }>
  people?: ReadonlyArray<FoldPersonRow>
}): number {
  return jobTileBadges({
    jobId: input.projectId,
    bookings: input.operativeBookings.map((booking) => ({
      projectId: booking.projectId,
      operativeId: booking.operativeId,
      status: booking.status ?? null,
    })),
    managerSiteBookings: input.managerBookings.map((booking) => ({
      userId: booking.userId,
      locationId: booking.locationId ?? null,
      locationType: booking.locationType,
    })),
    subcontractorBookings: input.subcontractorBookings,
    people: input.people ?? [],
  }).activeUsers
}

export function activeUserDayRows(
  summaryId: string,
  input: Parameters<typeof buildProjectActiveUsers>[0]
): ActiveUserDayRow[] {
  const policy = input.payrollPolicy ?? DEFAULT_PAYROLL_POLICY
  const rows: ActiveUserDayRow[] = []

  if (summaryId.startsWith('op-')) {
    const operativeId = summaryId.slice(3)
    for (const booking of input.operativeBookings) {
      if (!idsMatch(booking.operativeId, operativeId)) continue
      if (!idsMatch(booking.projectId, input.projectId) || isCancelled(booking.status)) continue
      rows.push(dayRow(booking, policy))
    }
  } else if (summaryId.startsWith('staff-')) {
    const userId = summaryId.slice('staff-'.length)
    for (const booking of input.managerBookings) {
      if (!idsMatch(booking.userId, userId)) continue
      if (!idsMatch(booking.locationId, input.projectId)) continue
      if (booking.locationType !== 'project' && booking.locationType !== 'small_work') continue
      rows.push(dayRow(booking, policy))
    }
  } else if (summaryId.startsWith('sub-')) {
    const subcontractorId = summaryId.slice(4)
    for (const booking of input.subcontractorBookings) {
      if (!idsMatch(booking.subcontractorId, subcontractorId)) continue
      if (!idsMatch(booking.projectId, input.projectId) || !isOpenBookingStatus(booking.status)) continue
      rows.push(dayRow(booking, policy))
    }
  }

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime())
}

function dayRow(booking: ActiveUserBooking, policy: OrgPayrollTimePolicy): ActiveUserDayRow {
  return {
    id: booking.id,
    date: booking.date,
    scheduleLabel: scheduleLabel(
      booking.timeSlot,
      booking.workStartTime,
      booking.workEndTime,
      booking.isBreakRemoved
    ),
    hours: bookingHours(booking, policy),
  }
}
