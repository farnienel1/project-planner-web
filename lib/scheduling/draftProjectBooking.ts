import { format, isSameDay, startOfDay } from 'date-fns'
import type { Booking, Operative, Project } from '@/types'
import {
  detectOperativeClashes,
  type OperativeBookingClash,
  timeSlotsOverlap,
} from '@/lib/scheduling/bookingClashUtils'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { slotKey, slotToFirestore, type ScheduleDateSlot } from '@/lib/scheduling/scheduleUtils'
import type { SchedulablePerson, SchedulablePersonKind } from '@/lib/scheduling/scheduleRosterUtils'

export type DayBookingState = 'free' | 'clash_pending' | 'clash_accepted' | 'removed'

export type DraftBookingPerson = {
  personId: string
  kind: SchedulablePersonKind
  name: string
  email: string
  dayStates: Record<string, DayBookingState>
  clashByDay: Record<string, OperativeBookingClash[]>
}

export type WizardStep = 'dates' | 'pick-person' | 'resolve-person' | 'review'

function projectLabel(projectId: string, projects: Project[]): string {
  const project = projects.find((p) => p.id === projectId)
  if (!project) return 'Another job'
  return `${project.jobNumber} ${project.siteName}`.trim()
}

function detectManagerDayClashes({
  userId,
  slot,
  managerSiteBookings,
  projects,
  currentProjectId,
}: {
  userId: string
  slot: ScheduleDateSlot
  managerSiteBookings: ManagerSiteBooking[]
  projects: Project[]
  currentProjectId: string
}): OperativeBookingClash[] {
  const firestoreSlot = slotToFirestore(slot)
  const clashes: OperativeBookingClash[] = []

  for (const existing of managerSiteBookings) {
    if (existing.userId !== userId) continue
    if (!isSameDay(existing.date, slot.date)) continue
    if (existing.locationId === currentProjectId) continue

    if (
      !timeSlotsOverlap(
        existing.timeSlot,
        firestoreSlot.timeSlot,
        existing.workStartTime,
        existing.workEndTime,
        firestoreSlot.workStartTime,
        firestoreSlot.workEndTime
      )
    ) {
      continue
    }

    clashes.push({
      operativeId: userId,
      operativeName: '',
      date: startOfDay(slot.date),
      newTimeSlot: firestoreSlot.timeSlot,
      existingBookingId: existing.id,
      existingProjectId: existing.locationId || '',
      existingTimeSlot: existing.timeSlot,
      existingProjectLabel: existing.locationId
        ? projectLabel(existing.locationId, projects)
        : 'Another booking',
    })
  }

  return clashes
}

export function buildDraftPersonDayStates({
  person,
  slots,
  bookings,
  managerSiteBookings,
  operatives,
  projects,
  currentProjectId,
}: {
  person: SchedulablePerson
  slots: ScheduleDateSlot[]
  bookings: Booking[]
  managerSiteBookings: ManagerSiteBooking[]
  operatives: Operative[]
  projects: Project[]
  currentProjectId: string
}): DraftBookingPerson {
  const dayStates: Record<string, DayBookingState> = {}
  const clashByDay: Record<string, OperativeBookingClash[]> = {}

  for (const slot of slots) {
    const key = slotKey(slot.date)
    let clashes: OperativeBookingClash[] = []

    if (person.kind === 'operative') {
      clashes = detectOperativeClashes({
        operativeIds: [person.id],
        slots: [slot],
        bookings,
        operatives,
        projects,
      })
    } else {
      clashes = detectManagerDayClashes({
        userId: person.id,
        slot,
        managerSiteBookings,
        projects,
        currentProjectId,
      }).map((c) => ({ ...c, operativeName: person.name }))
    }

    if (clashes.length > 0) {
      dayStates[key] = 'clash_pending'
      clashByDay[key] = clashes
    } else {
      dayStates[key] = 'free'
    }
  }

  return {
    personId: person.id,
    kind: person.kind,
    name: person.name,
    email: person.email,
    dayStates,
    clashByDay,
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
      isSameDay(booking.date, slot.date) &&
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
