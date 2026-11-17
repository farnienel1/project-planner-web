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
 * leave record (the `operativeOwnLeave` switch off, or anyone not at the operative level: the existing
 * whole-collection listener). With the switch on an operative gets one
 * `userId in (ids + email) OR operativeId in ids` query per chunk of their own ids — never the whole collection, so
 * the Phase B rules (switch `operativeOwnLeave`) can refuse colleagues' leave without breaking this app. Empty
 * `ownIds` means "not known yet": the plan falls back to the viewer's users id and former ids.
 */
export function leavePlanParts(
  viewer: JobAccessViewer | null,
  ownIds: ReadonlyArray<string>,
  email: string | null | undefined,
  operativeOwnLeave = false
): OrgPlanPart[] | null {
  const plan = leaveQueryPlan(viewer, { ownIds, email, operativeOwnLeave })
  if (plan.readsEveryLeave) return null
  return plan.queries.flatMap((query) => {
    if (query.kind !== 'own') return []
    const [byUser, byOperative] = query.anyOf
    return [
      {
        id: `own:${byUser.values.join(',')}|${byOperative.values.join(',')}`,
        filter: or(where(byUser.field, 'in', byUser.values), where(byOperative.field, 'in', byOperative.values)),
      },
    ]
  })
}

/** A stable name for a leave plan: `all`, or its parts' ids (an empty plan is `none`). */
export function leavePlanKey(parts: ReadonlyArray<OrgPlanPart> | null): string {
  if (parts === null) return 'all'
  return parts.length === 0 ? 'none' : parts.map((part) => part.id).join('#')
}

/**
 * The organisation whose leave listener must be planned again, or null. Re-plans the organisation last requested
 * (never the one whose first snapshot arrived last) only while it is still the open organisation — after a company
 * switch the old company is never re-opened; the new company's own `loadBookings` plans it — and only when the plan
 * the current inputs give differs from the plan the listener runs. Nothing while signed out or before any
 * organisation was requested. `currentOrgId` empty blocks once an organisation context has been adopted
 * (`contextAdopted`, sign-out / mid-switch); before the first adoption (boot, tests) it does not.
 */
export function leaveReplanTarget(input: {
  requestedOrgId: string | null
  currentOrgId?: string | null
  /** An organisation context has been adopted (epoch > 0): then "no organisation open" blocks too. */
  contextAdopted?: boolean
  plannedKey: string | null
  nextKey: string
  signedIn: boolean
}): string | null {
  if (!input.signedIn || !input.requestedOrgId) return null
  const current = String(input.currentOrgId ?? '').trim().toLowerCase()
  if (!current && input.contextAdopted) return null
  if (current && current !== input.requestedOrgId.trim().toLowerCase()) return null
  return input.plannedKey === input.nextKey ? null : input.requestedOrgId
}
