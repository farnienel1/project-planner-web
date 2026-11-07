import { format } from 'date-fns'
import type { Operative, User } from '@/types'
import { bookingIdsForAccount, normalizeDocumentId } from '@/lib/canonical'

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
  // Rulebook §10 `bookingIdsForAccount` (1.36.0, FU-5): the booking is the viewer's own when it is filed under any id
  // they go by — their users id, a former invite id, or any `operatives` row on their email — compared without case.
  // Before, only one catalogue row on the email counted, compared with case, so the viewer's own booking filed under
  // their users id (or an upper-case iOS id) was treated as someone else's and the schedule was scoped to it.
  const target = normalizeDocumentId(operativeId)
  const own = bookingIdsForAccount(
    { id: viewer.id, email: viewer.email ?? null, formerIds: viewer.formerUserIds ?? [] },
    operatives.map((row) => ({ id: row.id, email: row.email ?? '' }))
  ).some((id) => normalizeDocumentId(id) === target)
  // Someone else's booking scopes the schedule to that person, for every viewer (the old operative / manager / admin
  // branches all returned true once the booking was not the viewer's own).
  return !own
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
