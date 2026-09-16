/**
 * iOS parity source: Views/HomeUpNextSupport.swift
 * Spec: docs/ios-parity/IOS_APP_BLUEPRINT.md §3.4
 */

import type { Booking, Operative, Project, User } from '@/types'
import type { ManagerSiteBooking } from '@/lib/scheduling/managerSiteBookingUtils'
import { managerSiteBookingDisplayTitle } from '@/lib/scheduling/managerSiteBookingUtils'
import {
  addMinutesToDay,
  dayHeadingWithOrdinal,
  formatShortTime,
  londonMidnight,
  parseHhMm,
} from '@/lib/ios-parity/londonTime'
import { normalizeBookingStatus, normalizeManagerTimeSlot } from '@/lib/ios-parity/enums'

export interface HomeUpNextRow {
  id: string
  title: string
  subtitle: string
  sortDate: Date
  accent: 'blue' | 'purple'
}

export interface HomeUpNextDaySection {
  id: string
  heading: string
  rows: HomeUpNextRow[]
}

export interface PayrollTimePolicy {
  standardDayStart: string
  standardDayEnd: string
}

export const DEFAULT_PAYROLL_TIME_POLICY: PayrollTimePolicy = {
  standardDayStart: '07:30',
  standardDayEnd: '16:00',
}

function displayName(userId: string, users: User[]): string {
  const u = users.find((user) => user.id === userId)
  if (!u) return ''
  const full = `${u.firstName} ${u.surname}`.trim()
  if (full) return full
  return u.email.split('@')[0] || ''
}

export function sortDateOperativeBooking(
  booking: Booking,
  policy: PayrollTimePolicy = DEFAULT_PAYROLL_TIME_POLICY
): Date {
  const day = londonMidnight(booking.date)
  if (booking.workStartTime) {
    const mins = parseHhMm(booking.workStartTime)
    if (mins != null) return addMinutesToDay(day, mins)
  }
  const slot = String(booking.timeSlot)
  const start = parseHhMm(policy.standardDayStart) ?? 8 * 60
  const end = parseHhMm(policy.standardDayEnd) ?? 16 * 60
  const mid = start + Math.floor((end - start) / 2)
  if (slot === 'PM') return addMinutesToDay(day, mid)
  if (slot === 'Evening' || slot === 'Overtime') return addMinutesToDay(day, 17 * 60)
  return addMinutesToDay(day, start)
}

export function sortDateManagerBooking(
  booking: ManagerSiteBooking,
  policy: PayrollTimePolicy = DEFAULT_PAYROLL_TIME_POLICY
): Date {
  const day = londonMidnight(booking.date)
  if (booking.workStartTime) {
    const mins = parseHhMm(booking.workStartTime)
    if (mins != null) return addMinutesToDay(day, mins)
  }
  const ds = parseHhMm(policy.standardDayStart)
  const de = parseHhMm(policy.standardDayEnd)
  const slot = normalizeManagerTimeSlot(booking.timeSlot)
  if (ds == null || de == null || de <= ds) {
    if (slot === 'PM') return addMinutesToDay(day, 13 * 60)
    return addMinutesToDay(day, 8 * 60)
  }
  const mid = ds + Math.floor((de - ds) / 2)
  if (slot === 'PM') return addMinutesToDay(day, mid)
  return addMinutesToDay(day, ds)
}

export function upcomingRows(params: {
  limit: number
  now: Date
  authUserId?: string | null
  currentUserEmail?: string | null
  operatives: Operative[]
  bookings: Booking[]
  managerBookings: ManagerSiteBooking[]
  allProjects: Project[]
  organizationUsers: User[]
  payrollTimePolicy?: PayrollTimePolicy
}): HomeUpNextRow[] {
  const policy = params.payrollTimePolicy ?? DEFAULT_PAYROLL_TIME_POLICY
  const rows: HomeUpNextRow[] = []
  const emailKey = params.currentUserEmail?.toLowerCase().trim()
  const projectsById = new Map(params.allProjects.map((p) => [p.id, p.siteName]))

  if (emailKey) {
    const op = params.operatives.find(
      (o) => o.email.toLowerCase().trim() === emailKey
    )
    if (op) {
      const mine = params.bookings.filter((b) => {
        if (b.operativeId !== op.id) return false
        const status = normalizeBookingStatus(b.status)
        return status !== 'Cancelled' && status !== 'Completed'
      })
      for (const b of mine) {
        const start = sortDateOperativeBooking(b, policy)
        if (start < params.now) continue
        const proj = params.allProjects.find((p) => p.id === b.projectId)
        const site = proj?.siteName || 'Scheduled work'
        const timeStr = formatShortTime(start)
        const booker = displayName(b.bookedBy, params.organizationUsers)
        const job = proj?.jobNumber
        let subtitle = timeStr
        if (job && booker) subtitle = `${timeStr} · ${job} · ${booker}`
        else if (job) subtitle = `${timeStr} · ${job}`
        else if (booker) subtitle = `${timeStr} · ${booker}`
        rows.push({
          id: b.id,
          title: site,
          subtitle,
          sortDate: start,
          accent: 'blue',
        })
      }
    }
  }

  if (params.authUserId) {
    const mine = params.managerBookings.filter((b) => b.userId === params.authUserId)
    for (const b of mine) {
      const start = sortDateManagerBooking(b, policy)
      if (start < params.now) continue
      const loc = managerSiteBookingDisplayTitle(b, projectsById)
      const timeStr = formatShortTime(start)
      const slot = b.workStartTime
        ? `${b.workStartTime}${b.workEndTime ? `–${b.workEndTime}` : ''}`
        : String(b.timeSlot)
      rows.push({
        id: b.id,
        title: loc,
        subtitle: `${timeStr} · ${slot}`,
        sortDate: start,
        accent: 'purple',
      })
    }
  }

  rows.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
  return rows.slice(0, params.limit)
}

export function upcomingDaySections(params: {
  minDistinctDays?: number
  mergeRowLimit?: number
  now: Date
  authUserId?: string | null
  currentUserEmail?: string | null
  operatives: Operative[]
  bookings: Booking[]
  managerBookings: ManagerSiteBooking[]
  allProjects: Project[]
  organizationUsers: User[]
  payrollTimePolicy?: PayrollTimePolicy
}): HomeUpNextDaySection[] {
  const merged = upcomingRows({
    ...params,
    limit: params.mergeRowLimit ?? 48,
  })
  if (merged.length === 0) return []

  const byDay = new Map<string, HomeUpNextRow[]>()
  for (const row of merged) {
    const key = londonMidnight(row.sortDate).toISOString()
    const list = byDay.get(key) ?? []
    list.push(row)
    byDay.set(key, list)
  }
  const sortedDays = [...byDay.keys()].sort()
  const chosen = sortedDays.slice(0, params.minDistinctDays ?? 2)
  return chosen.map((key) => {
    const rows = (byDay.get(key) ?? []).sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
    const day = new Date(key)
    return {
      id: key,
      heading: dayHeadingWithOrdinal(day),
      rows,
    }
  })
}
