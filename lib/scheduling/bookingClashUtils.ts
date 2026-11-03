import { jobKind } from '@/lib/canonical/staffAccess'
import type { Booking, Operative, Project, User } from '@/types'
import { UserRole } from '@/types'
import type { ScheduleDateSlot } from '@/lib/scheduling/scheduleUtils'
import { slotToFirestore } from '@/lib/scheduling/scheduleUtils'
import { dayKey, isSameLondonDay, londonMidnight } from '@/lib/ios-parity/londonTime'
import { LONDON_TIME_ZONE } from '@/lib/orgTime/zoneTime'

function formatLondonDay(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}
import { isActiveBookingStatus } from '@/lib/ios-parity/enums'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import {
  clockText,
  formatWarningHours,
  operativeClashInterval,
  paidHoursForOperativeBooking,
} from '@/lib/warnings/clashIntervals'
import type { ClashTimelineEntry } from '@/lib/warnings/clashTimeline'
import {
  ORPHAN_BOOKING_LABEL,
  operativeClashGroups,
  resolveBookingPerson,
  rosterAliasIdsFor,
  type BookingPersonInput,
} from '@/lib/canonical'

export interface OperativeBookingClash {
  operativeId: string
  operativeName: string
  date: Date
  newTimeSlot: string
  existingBookingId: string
  existingProjectId: string
  existingTimeSlot: string
  existingProjectLabel: string
}

export interface OperativeBookingClashWarning {
  id: string
  operativeId: string
  operativeName: string
  date: Date
  bookingAId: string
  bookingBId: string
  /** `clashResolutionKey` of the first pair (the 1.1.0 approval key). */
  resolutionKey: string
  /** Every overlapping pair in the cluster (`operativeClashGroups`): approve / un-approve writes each one. */
  pairs: Array<{ bookingAId: string; bookingBId: string }>
  projectAId: string
  projectBId: string
  projectALabel: string
  projectBLabel: string
  message: string
  entries: ClashTimelineEntry[]
}

function isActiveBooking(booking: Booking): boolean {
  return isActiveBookingStatus(booking.status)
}

function isManagerOrAdminUser(user: User): boolean {
  return Boolean(
    user.isActive &&
      (user.permissions?.manager ||
        user.permissions?.adminAccess ||
        user.isSuperAdmin ||
        user.role === UserRole.ADMIN)
  )
}

function parseMinutes(value?: string): number | null {
  if (!value) return null
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function customRangesOverlap(startA?: string, endA?: string, startB?: string, endB?: string): boolean {
  const a0 = parseMinutes(startA)
  const a1 = parseMinutes(endA)
  const b0 = parseMinutes(startB)
  const b1 = parseMinutes(endB)
  if (a0 == null || a1 == null || b0 == null || b1 == null) return true
  return a0 < b1 && b0 < a1
}

export function timeSlotsOverlap(
  slotA: string,
  slotB: string,
  startA?: string,
  endA?: string,
  startB?: string,
  endB?: string
): boolean {
  const a = slotA.toUpperCase()
  const b = slotB.toUpperCase()
  if (a === 'FULL DAY' || b === 'FULL DAY' || a === 'FULL_DAY' || b === 'FULL_DAY') return true
  if (a === b) return true
  if (a === 'CUSTOM_HOURS' && b === 'CUSTOM_HOURS') {
    return customRangesOverlap(startA, endA, startB, endB)
  }
  if (a === 'CUSTOM_HOURS' || b === 'CUSTOM_HOURS') {
    return true
  }
  return false
}

export function bookingsOverlapWithSlot(
  existing: Booking,
  timeSlot: string,
  date: Date,
  workStartTime?: string,
  workEndTime?: string
): boolean {
  if (!isActiveBooking(existing)) return false
  if (!isSameLondonDay(new Date(existing.date), date)) return false
  return timeSlotsOverlap(
    String(existing.timeSlot),
    timeSlot,
    existing.workStartTime,
    existing.workEndTime,
    workStartTime,
    workEndTime
  )
}

function projectLabel(projectId: string, projectsById: Map<string, Project>): string {
  const project = projectsById.get(projectId)
  if (!project) return ORPHAN_BOOKING_LABEL
  return `${project.jobNumber} ${project.siteName}`.trim()
}

export function clashEntryFromOperativeBooking(
  booking: Booking,
  project: Project | undefined,
  payrollPolicy: OrgPayrollTimePolicy
): ClashTimelineEntry {
  const iv = operativeClashInterval(booking, payrollPolicy) ?? { start: 8 * 60, end: 17 * 60 }
  const hours = paidHoursForOperativeBooking(booking, payrollPolicy)
  const clock =
    booking.workStartTime?.trim() && booking.workEndTime?.trim()
      ? `${booking.workStartTime}–${booking.workEndTime}`
      : String(booking.timeSlot)
  return {
    bookingId: booking.id,
    jobNumber: project?.jobNumber,
    siteName: project?.siteName,
    isSmallWorks: project ? jobKind(project, project.collection) === 'smallWorks' : false,
    locationLabel: project ? `${project.jobNumber} ${project.siteName}`.trim() : 'Project',
    timeLabel: clock,
    startMinutes: iv.start,
    endMinutes: iv.end,
    hoursLabel: `${formatWarningHours(hours)}h`,
  }
}

export function detectOperativeClashes({
  operativeIds,
  slots,
  bookings,
  operatives,
  projects,
}: {
  operativeIds: string[]
  slots: ScheduleDateSlot[]
  bookings: Booking[]
  operatives: Operative[]
  projects: Project[]
}): OperativeBookingClash[] {
  const projectsById = new Map(projects.map((p) => [p.id, p]))
  const clashes: OperativeBookingClash[] = []

  for (const operativeId of operativeIds) {
    const operative = operatives.find((o) => o.id === operativeId)
    const operativeName = operative ? `${operative.firstName} ${operative.lastName}`.trim() : 'Operative'

    for (const slot of slots) {
      const firestoreSlot = slotToFirestore(slot)
      for (const existing of bookings) {
        if (existing.operativeId !== operativeId) continue
        if (!bookingsOverlapWithSlot(existing, firestoreSlot.timeSlot, slot.date, firestoreSlot.workStartTime, firestoreSlot.workEndTime)) {
          continue
        }
        clashes.push({
          operativeId,
          operativeName,
          date: londonMidnight(slot.date),
          newTimeSlot: firestoreSlot.timeSlot,
          existingBookingId: existing.id,
          existingProjectId: existing.projectId,
          existingTimeSlot: String(existing.timeSlot),
          existingProjectLabel: projectLabel(existing.projectId, projectsById),
        })
      }
    }
  }

  return clashes
}

export function groupClashesByOperative(clashes: OperativeBookingClash[]): Map<string, OperativeBookingClash[]> {
  const map = new Map<string, OperativeBookingClash[]>()
  for (const clash of clashes) {
    const list = map.get(clash.operativeId) || []
    list.push(clash)
    map.set(clash.operativeId, list)
  }
  return map
}

export function isExactDuplicateBooking(
  bookings: Booking[],
  projectId: string,
  operativeId: string,
  slot: ScheduleDateSlot
): boolean {
  const firestoreSlot = slotToFirestore(slot)
  return bookings.some(
    (booking) =>
      booking.projectId === projectId &&
      booking.operativeId === operativeId &&
      isSameLondonDay(new Date(booking.date), slot.date) &&
      String(booking.timeSlot) === firestoreSlot.timeSlot &&
      (booking.workStartTime || '') === (firestoreSlot.workStartTime || '') &&
      (booking.workEndTime || '') === (firestoreSlot.workEndTime || '') &&
      isActiveBooking(booking)
  )
}

export function formatClashSummary(clashes: OperativeBookingClash[]): string {
  return clashes
    .slice(0, 2)
    .map(
      (clash) =>
        `${formatLondonDay(clash.date)} · ${clash.existingTimeSlot} · ${clash.existingProjectLabel}`
    )
    .join(' · ')
}

/**
 * Operative double bookings: the rulebook's `operativeClashGroups` (person-day by `bookingPersonKey`,
 * overlapping `slotInterval`s, manager and admin accounts left out). One row per cluster; `pairs` lists every
 * overlapping pair, which is what approve / un-approve write and what `isClashGroupApproved` checks.
 * Labels, names and timelines stay here.
 */
export function computeOperativeBookingClashWarnings(
  bookings: Booking[],
  operatives: Operative[],
  projects: Project[],
  options?: {
    users?: User[]
    payrollPolicy?: OrgPayrollTimePolicy
    /** Folded same-email `users` id → the id the roster kept. */
    userIdAliases?: Readonly<Record<string, string>> | null
  }
): OperativeBookingClashWarning[] {
  const projectsById = new Map(projects.map((p) => [p.id, p]))
  const operativesById = new Map(operatives.map((o) => [o.id, o]))
  const payrollPolicy = options?.payrollPolicy ?? DEFAULT_PAYROLL_POLICY
  const users = options?.users || []
  const people: BookingPersonInput = {
    accounts: users.map((user) => ({
      id: user.id,
      email: user.email,
      formerIds: user.formerUserIds ?? [],
      aliasIds: rosterAliasIdsFor(user.id, options?.userIdAliases),
    })),
    operatives: operatives.map((operative) => ({ id: operative.id, email: operative.email })),
  }

  const groups = operativeClashGroups({
    operativeBookings: bookings.map((booking) => ({
      id: booking.id,
      operativeId: booking.operativeId,
      dayKey: dayKey(booking.date),
      timeSlot: String(booking.timeSlot ?? ''),
      workStartTime: clockText(booking.workStartTime),
      workEndTime: clockText(booking.workEndTime),
      status: String(booking.status ?? ''),
    })),
    people,
    managerIds: users.filter(isManagerOrAdminUser).map((user) => user.id),
    day: payrollPolicy,
  })

  const warnings: OperativeBookingClashWarning[] = groups.map((group) => {
    const sorted = group.items.map((item) => bookings[item.index])
    const person = resolveBookingPerson(group.operativeId, people)
    const operative =
      operativesById.get(group.operativeId) ||
      (person.operativeId ? operativesById.get(person.operativeId) : undefined)
    const account = person.accountId ? users.find((user) => user.id === person.accountId) : undefined
    const operativeName = operative
      ? `${operative.firstName} ${operative.lastName}`.trim() || operative.email
      : account
        ? `${account.firstName} ${account.surname}`.trim() || account.email
        : 'Operative'
    const a = sorted[0]
    const b = sorted[1]
    const place = sorted.length === 2 ? 'two' : String(sorted.length)
    return {
      id: group.pairKey,
      resolutionKey: group.resolutionKey,
      operativeId: group.operativeId,
      operativeName,
      date: londonMidnight(a.date),
      bookingAId: group.bookingAId,
      bookingBId: group.bookingBId,
      pairs: group.pairs.map((pair) => ({ bookingAId: pair.bookingAId, bookingBId: pair.bookingBId })),
      projectAId: a.projectId,
      projectBId: b.projectId,
      projectALabel: projectLabel(a.projectId, projectsById),
      projectBLabel: projectLabel(b.projectId, projectsById),
      message: `${operativeName} is booked in ${place} places on ${formatLondonDay(londonMidnight(a.date))}. Approve if it's intentional and it'll be noted on the weekly report.`,
      entries: sorted.map((booking) =>
        clashEntryFromOperativeBooking(booking, projectsById.get(booking.projectId), payrollPolicy)
      ),
    }
  })

  return warnings.sort((a, b) => a.date.getTime() - b.date.getTime())
}
