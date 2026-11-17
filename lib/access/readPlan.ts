/**
 * Web inputs for the rulebook read plans (rulebook §17, 1.10.0 round 2). The plans themselves are
 * `jobQueryPlan` / `bookingQueryPlan` in `lib/canonical/staffAccess.ts`; this file only turns the signed-in user and
 * the stores into their inputs and their query shapes into Firestore constraints, so the web app runs exactly the
 * queries iOS runs.
 */
import { or, where, type QueryConstraint } from 'firebase/firestore'
import {
  bookingIdsForAccount,
  bookingQueryPlan,
  jobQueryPlan,
  leaveQueryPlan,
  type BookingPermissionCollection,
  type BookingQuery,
  type JobAccessViewer,
  type JobCollection,
  type JobQuery,
} from '@/lib/canonical'
import type { OrgPlanPart } from '@/lib/firebase/subscribeOrgPlan'
import { jobAccessViewer } from '@/lib/access/bookingAccess'
import { enforcedReadsFor } from '@/lib/access/securitySwitches'
import type { User } from '@/types'

export function webJobAccessViewer(user: User | null | undefined): JobAccessViewer | null {
  return user ? jobAccessViewer(user) : null
}

/** `bookingIdsForAccount` for the signed-in user over the operatives list. */
export function ownBookingIdsFor(
  user: User | null | undefined,
  operatives: ReadonlyArray<{ id: string; email?: string | null }>
): string[] {
  if (!user) return []
  return bookingIdsForAccount(
    { id: user.id, email: user.email ?? null, formerIds: user.formerUserIds ?? [] },
    operatives.map((row) => ({ id: row.id, email: row.email ?? '' }))
  )
}

function jobPart(query: JobQuery): OrgPlanPart[] {
  if (query.kind === 'all') return [{ id: 'all' }]
  return query.ids.map((id) => ({ id: `doc:${id}`, documentId: id }))
}

/**
 * The parts for one job collection, or null when the viewer reads the whole collection (`kind: 'all'`, the
 * existing listener). `documentIds`: for operatives, the jobs of their own bookings, tasks and deadlines.
 */
export function jobPlanParts(
  viewer: JobAccessViewer | null,
  collection: JobCollection,
  documentIds?: ReadonlyArray<string>
): OrgPlanPart[] | null {
  // 1.26.0: planned for the `enforcedReads` switch as the rules read it now (`securitySwitchOn`).
  const plan = jobQueryPlan(viewer, { documentIds: documentIds ?? [], enforced: enforcedReadsFor() })
  const queries = plan.queries.filter((query) => query.collection === collection)
  if (queries.some((query) => query.kind === 'all')) return null
  return queries.flatMap(jobPart)
}

function bookingPart(query: BookingQuery, bound: QueryConstraint[], boundId: string): OrgPlanPart {
  if (query.kind === 'all') return { id: `all|${boundId}`, constraints: bound }
  // 1.33.0: the only other query is an operative's own labour bookings (`operativeId in`).
  const filter = where(query.field, 'in', query.values)
  return { id: `${query.kind}:${query.field}:${query.values.join(',')}|${boundId}`, constraints: [filter, ...bound] }
}

/**
 * The parts for one booking collection, or null when the viewer reads every booking (the existing whole-collection
 * listener). `bound` is the collection's download bound (`date >= bookingLoadStart`), `boundId` its stable name.
 */
export function bookingPlanParts(
  viewer: JobAccessViewer | null,
  collection: BookingPermissionCollection,
  visibleJobIds: ReadonlyArray<string>,
  ownBookingIds: ReadonlyArray<string>,
  bound: QueryConstraint[] = [],
  boundId = ''
): OrgPlanPart[] | null {
  const plan = bookingQueryPlan(viewer, visibleJobIds, { ownBookingIds, enforced: enforcedReadsFor() })
  if (plan.readsEveryBooking) return null
  return plan.queries.filter((query) => query.collection === collection).map((query) => bookingPart(query, bound, boundId))
}

/** The booking plan's inputs, kept here so the stores need not import each other (set by `readPlanSync`). */
let planVisibleJobIds: string[] = []
let planOwnBookingIds: string[] = []

/** True when the inputs changed (the booking listeners must re-plan). */
export function setBookingPlanInputs(visibleJobIds: ReadonlyArray<string>, ownBookingIds: ReadonlyArray<string>): boolean {
  const visible = [...new Set(visibleJobIds.filter(Boolean))].sort()
  const own = [...new Set(ownBookingIds.filter(Boolean))].sort()
  if (visible.join('|') === planVisibleJobIds.join('|') && own.join('|') === planOwnBookingIds.join('|')) return false
  planVisibleJobIds = visible
  planOwnBookingIds = own
  return true
}

export function bookingPlanInputs(): { visibleJobIds: string[]; ownBookingIds: string[] } {
  return { visibleJobIds: planVisibleJobIds, ownBookingIds: planOwnBookingIds }
}

/**
 * Rulebook 1.56.0 §9 / §17 (`leaveQueryPlan`): the annual-leave parts for the viewer, or null when they read every
 * leave record (admins, super admins, managers: the existing whole-collection listener). An operative gets one
 * `userId in values OR operativeId in values` query per chunk of their own ids — never the whole collection, so the
 * Phase B rules (switch `operativeOwnLeave`) can refuse colleagues' leave without breaking this app.
 */
export function leavePlanParts(
  viewer: JobAccessViewer | null,
  ownIds: ReadonlyArray<string>,
  email: string | null | undefined
): OrgPlanPart[] | null {
  const plan = leaveQueryPlan(viewer, { ownIds, email })
  if (plan.readsEveryLeave) return null
  return plan.queries.flatMap((query) => {
    if (query.kind !== 'own') return []
    const [byUser, byOperative] = query.anyOf
    return [
      {
        id: `own:${byUser.values.join(',')}`,
        filter: or(where(byUser.field, 'in', byUser.values), where(byOperative.field, 'in', byOperative.values)),
      },
    ]
  })
}

/** The leave plan's own ids (the signed-in user's `bookingIdsForAccount`), set by `readPlanSync` like the booking inputs. */
let planOwnLeaveIds: string[] = []

/** True when the own ids changed (the leave listener must re-plan). */
export function setLeavePlanInputs(ownIds: ReadonlyArray<string>): boolean {
  const own = [...new Set(ownIds.filter(Boolean))].sort()
  if (own.join('|') === planOwnLeaveIds.join('|')) return false
  planOwnLeaveIds = own
  return true
}

export function leavePlanInputs(): { ownIds: string[] } {
  return { ownIds: planOwnLeaveIds }
}
