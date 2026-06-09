import { format } from 'date-fns'
import type { Operative, User } from '@/types'
import { findOperativeForUser } from '@/lib/operatives/operativeRosterUtils'
import { hasAdminAccess, isOperativeMode } from '@/lib/navigation/menuPermissions'

export type ScheduleFocus = {
  date: Date
  operativeId: string
  bookingId?: string
}

/** Mirrors iOS: scope schedule to another operative when a manager/admin opens their booking. */
export function shouldScopeScheduleToOperative(
  viewer: User | null,
  operativeId: string,
  operatives: Operative[]
): boolean {
  if (!viewer) return true
  const linkedOperativeId = findOperativeForUser(viewer, operatives)?.id
  if (linkedOperativeId && linkedOperativeId === operativeId) return false

  if (isOperativeMode(viewer)) return operativeId !== linkedOperativeId

  return hasAdminAccess(viewer) || viewer.permissions.manager === true || operativeId !== linkedOperativeId
}

export function buildScheduleUrl(
  focus: ScheduleFocus,
  viewer: User | null,
  operatives: Operative[]
): string {
  const params = new URLSearchParams()
  params.set('date', format(focus.date, 'yyyy-MM-dd'))
  if (focus.bookingId) params.set('bookingId', focus.bookingId)

  if (shouldScopeScheduleToOperative(viewer, focus.operativeId, operatives)) {
    params.set('operativeId', focus.operativeId)
  }

  const query = params.toString()
  return query ? `/dashboard/daily-overview?${query}` : '/dashboard/daily-overview'
}

export function buildScheduleUrlForClash(
  clash: { operativeId: string; date: Date; bookingAId: string },
  viewer: User | null,
  operatives: Operative[]
): string {
  return buildScheduleUrl(
    {
      date: clash.date,
      operativeId: clash.operativeId,
      bookingId: clash.bookingAId,
    },
    viewer,
    operatives
  )
}

/** Existing booking overlap shown during scheduling (OperativeBookingClash). */
export function buildScheduleUrlForExistingClash(
  clash: { operativeId: string; date: Date; existingBookingId: string },
  viewer: User | null,
  operatives: Operative[]
): string {
  return buildScheduleUrl(
    {
      date: clash.date,
      operativeId: clash.operativeId,
      bookingId: clash.existingBookingId,
    },
    viewer,
    operatives
  )
}

export function parseScheduleSearchParams(searchParams: URLSearchParams): {
  date: Date | null
  operativeId: string | null
  bookingId: string | null
} {
  const dateRaw = searchParams.get('date')
  const operativeId = searchParams.get('operativeId')
  const bookingId = searchParams.get('bookingId')

  let date: Date | null = null
  if (dateRaw) {
    const parsed = new Date(`${dateRaw}T12:00:00`)
    if (!Number.isNaN(parsed.getTime())) date = parsed
  }

  return { date, operativeId, bookingId }
}
