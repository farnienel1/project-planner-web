import { jobKind } from '@/lib/canonical/staffAccess'
import type { Booking, Operative, Project, User } from '@/types'
import type { ScheduleDateSlot } from '@/lib/scheduling/scheduleUtils'
import { slotToFirestore } from '@/lib/scheduling/scheduleUtils'
import { dayKey, isSameLondonDay, londonMidnight } from '@/lib/ios-parity/londonTime'

function formatLondonDay(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: organizationZoneOr(),
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
  bookingRequestClashIds,
  clashManagerIds,
  operativeClashGroups,
  resolveBookingPerson,
  rosterAliasIdsFor,
  standardDayOn,
  type BookingPersonInput,
  type PayrollTimePolicyState,
} from '@/lib/canonical'
import { normalizeDocumentId } from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'

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

/** Rulebook 1.23.0 §5 `clashManagerIds`: active admins and people with the manager flag (Medium clashes). */
export function clashManagerIdsForUsers(users: readonly User[]): string[] {
  return clashManagerIds(
    users.map((user) => ({
      id: user.id,
      isActive: user.isActive,
      role: user.role ?? null,
      isSuperAdmin: user.isSuperAdmin ?? null,
      permissions: (user.permissions ?? null) as unknown as Record<string, unknown> | null,
    }))
  )
}

function parseMinutes(value?: string): number | null {
  if (!value) return null
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
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

/**
 * Rulebook 1.23.0 §5 `bookingRequestClashIds`: the person's existing labour bookings a booking being made would
 * clash with — clock intervals (`slotInterval`) under the working hours in effect on the booked day, touching
 * times do not clash. `day` is the organisation's working-hours state (or one policy).
 */
export function detectOperativeClashes({
  operativeIds,
  slots,
  bookings,
  operatives,
  projects,
  day = null,
  timeZone,
}: {
  operativeIds: string[]
  slots: ScheduleDateSlot[]
  bookings: Booking[]
  operatives: Operative[]
  projects: Project[]
  day?: OrgPayrollTimePolicy | PayrollTimePolicyState | null
  timeZone?: string
}): OperativeBookingClash[] {
  const projectsById = new Map(projects.map((p) => [p.id, p]))
  const clashes: OperativeBookingClash[] = []

  for (const operativeId of operativeIds) {
    const operative = operatives.find((o) => normalizeDocumentId(o.id) === normalizeDocumentId(operativeId))
    const operativeName = operative ? `${operative.firstName} ${operative.lastName}`.trim() : 'Operative'
    const own = bookings.filter((existing) => normalizeDocumentId(existing.operativeId) === normalizeDocumentId(operativeId))
    const byId = new Map(own.map((existing) => [existing.id, existing]))

    for (const slot of slots) {
      const firestoreSlot = slotToFirestore(slot)
      const ids = bookingRequestClashIds({
        request: {
          dayKey: dayKey(slot.date, timeZone),
          timeSlot: firestoreSlot.timeSlot,
          workStartTime: firestoreSlot.workStartTime ?? null,
          workEndTime: firestoreSlot.workEndTime ?? null,
        },
        existing: own.map((existing) => ({
          id: existing.id,
          dayKey: dayKey(new Date(existing.date), timeZone),
          timeSlot: String(existing.timeSlot ?? ''),
          workStartTime: clockText(existing.workStartTime),
          workEndTime: clockText(existing.workEndTime),
          status: String(existing.status ?? ''),
        })),
        day,
      })
      for (const id of ids) {
        const existing = byId.get(id)
        if (!existing) continue
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
      normalizeDocumentId(booking.operativeId) === normalizeDocumentId(operativeId) &&
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
    /** Rulebook 1.23.0: the whole working-hours state, read on each booking's own day. */
    payrollPolicyState?: PayrollTimePolicyState | null
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
    managerIds: clashManagerIdsForUsers(users),
    // 1.23.0: each booking's named slot under the working hours in effect on its own day.
    day: options?.payrollPolicyState ?? payrollPolicy,
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
        clashEntryFromOperativeBooking(
          booking,
          projectsById.get(booking.projectId),
          (standardDayOn(options?.payrollPolicyState ?? payrollPolicy, dayKey(booking.date)) as OrgPayrollTimePolicy | null) ?? payrollPolicy
        )
      ),
    }
  })

  return warnings.sort((a, b) => a.date.getTime() - b.date.getTime())
}
