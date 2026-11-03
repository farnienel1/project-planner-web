import { format, startOfDay } from 'date-fns'
import { coversCalendarDay } from '@/lib/ios-parity/londonTime'
import type { Booking, Operative, Project, User } from '@/types'
import { detectOperativeClashes, type OperativeBookingClash } from '@/lib/scheduling/bookingClashUtils'
import { clockText } from '@/lib/warnings/clashIntervals'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { slotKey, slotToFirestore, type ScheduleDateSlot } from '@/lib/scheduling/scheduleUtils'
import type { SchedulablePerson, SchedulablePersonKind } from '@/lib/scheduling/scheduleRosterUtils'
import { ORPHAN_BOOKING_LABEL, bookingRequestClashIds, type BookingLeaveConflict, type PayrollTimePolicyState } from '@/lib/canonical'
import { dayKey as orgDayKey } from '@/lib/ios-parity/londonTime'
import { leaveConflictsForBooking } from '@/lib/scheduling/leaveConflicts'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import type { HolidayBooking } from '@/types'

export type DayBookingState = 'free' | 'clash_pending' | 'clash_accepted' | 'removed'

export type DraftBookingPerson = {
  personId: string
  kind: SchedulablePersonKind
  name: string
  email: string
  badge: string
  dayStates: Record<string, DayBookingState>
  clashByDay: Record<string, OperativeBookingClash[]>
  /** Rulebook 1.16.0: annual leave on that day (`bookingLeaveConflicts`); the day waits for a tick or ✕ like a clash. */
  leaveByDay?: Record<string, BookingLeaveConflict>
}

export type WizardStep = 'dates' | 'pick-person' | 'review'

function emailKey(value: string | undefined): string {
  return (value || '').trim().toLowerCase()
}

function projectLabel(projectId: string, projects: Project[]): string {
  const project = projects.find((p) => p.id === projectId)
  if (!project) return ORPHAN_BOOKING_LABEL
  return `${project.jobNumber} ${project.siteName}`.trim()
}

function linkedUserForPerson(person: SchedulablePerson, users: User[]): User | undefined {
  const email = emailKey(person.email)
  if (!email) return undefined
  return users.find((user) => emailKey(user.email) === email)
}

function linkedOperativeForPerson(person: SchedulablePerson, operatives: Operative[]): Operative | undefined {
  if (person.kind === 'operative') {
    return operatives.find((operative) => operative.id === person.id)
  }
  const email = emailKey(person.email)
  if (!email) return undefined
  return operatives.find((operative) => emailKey(operative.email) === email)
}

/** Rulebook 1.23.0 §5 `bookingRequestClashIds` over the person's manager schedule bookings, on the booked day's hours. */
function detectManagerDayClashes({
  userId,
  slot,
  managerSiteBookings,
  projects,
  day,
  timeZone,
}: {
  userId: string
  slot: ScheduleDateSlot
  managerSiteBookings: ManagerSiteBooking[]
  projects: Project[]
  currentProjectId?: string
  day: OrgPayrollTimePolicy | PayrollTimePolicyState | null
  timeZone?: string
}): OperativeBookingClash[] {
  const firestoreSlot = slotToFirestore(slot)
  const own = managerSiteBookings.filter((existing) => existing.userId === userId)
  const byId = new Map(own.map((existing) => [existing.id, existing]))
  const ids = bookingRequestClashIds({
    request: {
      dayKey: orgDayKey(slot.date, timeZone),
      timeSlot: firestoreSlot.timeSlot,
      workStartTime: firestoreSlot.workStartTime ?? null,
      workEndTime: firestoreSlot.workEndTime ?? null,
    },
    existing: own.map((existing) => ({
      id: existing.id,
      dayKey: orgDayKey(new Date(existing.date), timeZone),
      timeSlot: String(existing.timeSlot ?? ''),
      workStartTime: clockText(existing.workStartTime),
      workEndTime: clockText(existing.workEndTime),
    })),
    day,
  })

  return ids.flatMap((id) => {
    const existing = byId.get(id)
    if (!existing) return []
    return [
      {
        operativeId: userId,
        operativeName: '',
        date: startOfDay(slot.date),
        newTimeSlot: firestoreSlot.timeSlot,
        existingBookingId: existing.id,
        existingProjectId: existing.locationId || '',
        existingTimeSlot: existing.timeSlot,
        existingProjectLabel: existing.locationId ? projectLabel(existing.locationId, projects) : 'Another booking',
      },
    ]
  })
}

export function buildDraftPersonDayStates({
  person,
  slots,
  bookings,
  managerSiteBookings,
  operatives,
  users = [],
  projects,
  currentProjectId,
  holidays = [],
  payrollPolicy = null,
  timeZone = null,
}: {
  person: SchedulablePerson
  slots: ScheduleDateSlot[]
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  users?: User[]
  projects: Project[]
  currentProjectId: string
  /** Rulebook 1.16.0: annual leave, listed beside double bookings (`bookingLeaveConflicts`). */
  holidays?: HolidayBooking[]
  /**
   * Rulebook 1.23.0: the organisation's working-hours state (or one policy). Clashes and leave are read under the
   * hours in effect on each booked day, never today's.
   */
  payrollPolicy?: OrgPayrollTimePolicy | PayrollTimePolicyState | null
  timeZone?: string | null
}): DraftBookingPerson {
  const dayStates: Record<string, DayBookingState> = {}
  const clashByDay: Record<string, OperativeBookingClash[]> = {}
  const leaveByDay: Record<string, BookingLeaveConflict> = {}
  const linkedUser = linkedUserForPerson(person, users)
  const linkedOperative = linkedOperativeForPerson(person, operatives)
  const managerUserId = person.kind === 'manager' ? person.id : linkedUser?.id
  const operativeId = person.kind === 'operative' ? person.id : linkedOperative?.id

  for (const slot of slots) {
    const key = slotKey(slot.date)
    const clashes: OperativeBookingClash[] = []

    if (operativeId) {
      clashes.push(
        ...detectOperativeClashes({
          operativeIds: [operativeId],
          slots: [slot],
          bookings,
          operatives,
          projects,
          day: payrollPolicy,
          timeZone: timeZone ?? undefined,
        }).map((clash) => ({ ...clash, operativeName: person.name }))
      )
    }

    if (managerUserId) {
      clashes.push(
        ...detectManagerDayClashes({
          userId: managerUserId,
          slot,
          managerSiteBookings,
          projects,
          currentProjectId,
          day: payrollPolicy,
          timeZone: timeZone ?? undefined,
        }).map((clash) => ({ ...clash, operativeName: person.name }))
      )
    }

    const firestoreSlot = slotToFirestore(slot)
    const [leave] = leaveConflictsForBooking({
      people: [{ id: person.id, userId: managerUserId ?? null, operativeIds: operativeId ? [operativeId] : [], email: person.email }],
      dayKeys: [orgDayKey(slot.date, timeZone ?? undefined)],
      holidays,
      users,
      payrollPolicy,
      timeZone,
      timeSlot: firestoreSlot.timeSlot,
      workStartTime: firestoreSlot.workStartTime ?? null,
      workEndTime: firestoreSlot.workEndTime ?? null,
    })
    if (leave) leaveByDay[key] = leave

    if (clashes.length > 0 || leave) {
      dayStates[key] = 'clash_pending'
      if (clashes.length > 0) clashByDay[key] = clashes
    } else {
      dayStates[key] = 'free'
    }
  }

  return {
    personId: person.id,
    kind: person.kind,
    name: person.name,
    email: person.email,
    badge: person.badge,
    dayStates,
    clashByDay,
    leaveByDay,
  }
}

export function personHasPendingClashes(person: DraftBookingPerson): boolean {
  return Object.values(person.dayStates).some((s) => s === 'clash_pending')
}

export function personHasBookableDays(person: DraftBookingPerson): boolean {
  return Object.values(person.dayStates).some((s) => s === 'free' || s === 'clash_accepted')
}

export function personHasAcceptedClashes(person: DraftBookingPerson): boolean {
  return Object.values(person.dayStates).some((s) => s === 'clash_accepted')
}

export function draftPersonNeedsWarning(person: DraftBookingPerson): boolean {
  return personHasPendingClashes(person) || personHasAcceptedClashes(person)
}

export function isExactDuplicateManagerBooking(
  managerSiteBookings: ManagerSiteBooking[],
  locationId: string,
  userId: string,
  slot: ScheduleDateSlot
): boolean {
  const firestoreSlot = slotToFirestore(slot)
  return managerSiteBookings.some(
    (booking) =>
      booking.locationId === locationId &&
      booking.userId === userId &&
      coversCalendarDay(booking.date, slot.date) &&
      String(booking.timeSlot) === firestoreSlot.timeSlot &&
      (booking.workStartTime || '') === (firestoreSlot.workStartTime || '') &&
      (booking.workEndTime || '') === (firestoreSlot.workEndTime || '')
  )
}

export function acceptDayClash(person: DraftBookingPerson, dateKey: string): DraftBookingPerson {
  return {
    ...person,
    dayStates: { ...person.dayStates, [dateKey]: 'clash_accepted' },
  }
}

export function removeDayFromPerson(person: DraftBookingPerson, dateKey: string): DraftBookingPerson {
  return {
    ...person,
    dayStates: { ...person.dayStates, [dateKey]: 'removed' },
  }
}

export function formatDayStateLabel(date: Date, state: DayBookingState): string {
  const label = format(date, 'EEE d MMM')
  if (state === 'removed') return `${label} (removed)`
  return label
}

export function slotsForPerson(
  person: DraftBookingPerson,
  slots: ScheduleDateSlot[]
): ScheduleDateSlot[] {
  return slots.filter((slot) => {
    const state = person.dayStates[slotKey(slot.date)]
    return state === 'free' || state === 'clash_accepted'
  })
}

export function allDraftPeopleResolved(people: DraftBookingPerson[]): boolean {
  if (people.length === 0) return false
  return people.every((p) => !personHasPendingClashes(p) && personHasBookableDays(p))
}

/**
 * Owner (3 Nov): going back to the dates step and changing the dates keeps the people already chosen. Rebuilding a
 * person for the new dates recomputes every day's clashes; a ✓ (book anyway) or ✕ (drop) the booker already gave on a
 * day that is still in the request and still clashes is kept. New days and days that no longer clash start fresh.
 */
export function carryDayDecisions(previous: DraftBookingPerson, rebuilt: DraftBookingPerson): DraftBookingPerson {
  const dayStates = { ...rebuilt.dayStates }
  for (const [key, state] of Object.entries(rebuilt.dayStates)) {
    const before = previous.dayStates[key]
    if (state === 'clash_pending' && (before === 'clash_accepted' || before === 'removed')) dayStates[key] = before
  }
  return { ...rebuilt, dayStates }
}

/** A person stays in the request while any day is bookable or still waiting for ✓ / ✕. */
export function draftPersonStillListed(person: DraftBookingPerson): boolean {
  return personHasBookableDays(person) || personHasPendingClashes(person)
}
