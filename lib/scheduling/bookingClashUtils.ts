import { format } from 'date-fns'
import type { Booking, Operative, Project, User } from '@/types'
import { UserRole } from '@/types'
import type { ScheduleDateSlot } from '@/lib/scheduling/scheduleUtils'
import { slotToFirestore } from '@/lib/scheduling/scheduleUtils'
import { dayKey, isSameLondonDay, londonMidnight } from '@/lib/ios-parity/londonTime'
import { isActiveBookingStatus } from '@/lib/ios-parity/enums'
import type { OrgPayrollTimePolicy } from '@/lib/settings/organizationSettings'
import { DEFAULT_PAYROLL_POLICY } from '@/lib/settings/organizationSettings'
import { bookingsOverlapByInterval, overlappingClusters } from '@/lib/warnings/clashIntervals'

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
  projectAId: string
  projectBId: string
  projectALabel: string
  projectBLabel: string
  message: string
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
  if (!project) return 'Another job'
  return `${project.jobNumber} ${project.siteName}`.trim()
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
        `${format(clash.date, 'd MMM yyyy')} · ${clash.existingTimeSlot} · ${clash.existingProjectLabel}`
    )
    .join(' · ')
}

export function computeOperativeBookingClashWarnings(
  bookings: Booking[],
  operatives: Operative[],
  projects: Project[],
  options?: { users?: User[]; payrollPolicy?: OrgPayrollTimePolicy }
): OperativeBookingClashWarning[] {
  const projectsById = new Map(projects.map((p) => [p.id, p]))
  const operativesById = new Map(operatives.map((o) => [o.id, o]))
  const payrollPolicy = options?.payrollPolicy ?? DEFAULT_PAYROLL_POLICY
  const managerAdminEmails = new Set(
    (options?.users || [])
      .filter(isManagerOrAdminUser)
      .map((user) => user.email.trim().toLowerCase())
      .filter(Boolean)
  )
  const active = bookings.filter(isActiveBooking)
  const warnings: OperativeBookingClashWarning[] = []
  const seen = new Set<string>()

  const byOperativeDay = new Map<string, Booking[]>()
  for (const booking of active) {
    const key = `${booking.operativeId}|${dayKey(booking.date)}`
    const list = byOperativeDay.get(key) || []
    list.push(booking)
    byOperativeDay.set(key, list)
  }

  for (const [, dayBookings] of byOperativeDay) {
    if (dayBookings.length < 2) continue
    const operative = operativesById.get(dayBookings[0].operativeId)
    if (operative && managerAdminEmails.has(operative.email.trim().toLowerCase())) continue

    const clusters = overlappingClusters(dayBookings, (a, b) => bookingsOverlapByInterval(a, b, payrollPolicy))
    for (const cluster of clusters) {
      const sorted = [...cluster].sort((a, b) => a.id.localeCompare(b.id))
      const pairKey = sorted.map((booking) => booking.id).join('|')
      if (seen.has(pairKey)) continue
      seen.add(pairKey)
      const operativeName = operative
        ? `${operative.firstName} ${operative.lastName}`.trim() || operative.email
        : 'Operative'
      const a = sorted[0]
      const b = sorted[1]
      const projectALabel = projectLabel(a.projectId, projectsById)
      const projectBLabel = projectLabel(b.projectId, projectsById)
      const place = sorted.length === 2 ? 'two' : String(sorted.length)
      warnings.push({
        id: pairKey,
        operativeId: a.operativeId,
        operativeName,
        date: londonMidnight(a.date),
        bookingAId: a.id,
        bookingBId: b.id,
        projectAId: a.projectId,
        projectBId: b.projectId,
        projectALabel,
        projectBLabel,
        message: `${operativeName} is booked in ${place} places on ${format(londonMidnight(a.date), 'd MMM yyyy')}. Approve if it's intentional and it'll be noted on the weekly report.`,
      })
    }
  }

  return warnings.sort((a, b) => a.date.getTime() - b.date.getTime())
}
