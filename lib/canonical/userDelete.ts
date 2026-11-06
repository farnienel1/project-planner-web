/**
 * Deleting a person from an organisation (rulebook §11, 1.10.0).
 *
 * Before 1.10.0 each app decided for itself. Web removed the person's future bookings and tax ids and only then
 * deleted `users/{uid}`, so deleting an admin (which the rules refuse) still wiped their bookings; web left the
 * operatives/managers row and pending invitations behind, iOS left `private/taxIds` and `orgMemberships`.
 *
 * `canDeleteUser` is the gate both apps check before any write; `userDeleteWrites` is the one ordered plan. Its first
 * batch deletes `users/{uid}` together with the documents only it guards (tax ids, the email claim, the membership
 * and the members-map entry), so a refusal by the security rules leaves everything as it was. Pure.
 */

import { bookingsToRemoveOnOperativeDelete } from './bookings'
import { BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT, bookingTombstonePath, bookingTombstoneWriteFields } from './bookingTombstones'
import { personIdSet, type PersonRosterRow } from './personIds'
import type { StaffAccountRole } from './staffAccess'
import type { WritePlatform } from './writeMetadata'
import { isGhostUser } from './userRosterSegment'

export type UserDeletePerson = {
  id: string
  email?: string | null
  role: StaffAccountRole
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
  /** 1.34.0: a ghost operative has only its users document (no tax ids, membership, email claim or members entry). */
  ghost?: boolean | null
}

export type UserDeleteRefusal = 'not_admin' | 'self' | 'super_admin' | 'creator' | 'admin_needs_super_admin' | 'operatives_only'

export const USER_DELETE_REFUSAL_MESSAGES: Readonly<Record<UserDeleteRefusal, string>> = {
  not_admin: 'Only an admin can delete people.',
  self: 'You cannot delete your own account here.',
  super_admin: 'The super admin cannot be deleted.',
  creator: 'The company owner cannot be deleted.',
  admin_needs_super_admin: 'Only the super admin can delete an admin.',
  operatives_only: 'With the Operatives permission you can delete operatives only.',
}

function key(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Why `actor` may not delete `target`, or null when they may (the same test as the `users/{uid}` delete rule):
 * an admin or super admin outside operative mode deletes; never themselves (any of their ids); never the
 * super admin or the organisation creator (`creatorUserId`); an admin who is not super admin deletes only people who
 * are not admins. 1.31.0 (owner decision 7): a manager with the Operatives toggle (`actorManagesOperatives`) deletes
 * operatives only (`operatives_only` otherwise), never themselves.
 */
export type UserDeleteOptions = {
  roster?: ReadonlyArray<PersonRosterRow> | null
  creatorUserId?: string | null
  /**
   * 1.31.0 (owner decision 7): the actor is a manager with the Operatives toggle in this organisation
   * (`canManageOperatives`). They may delete operatives (with or without a login) — never a manager, an admin or
   * themselves.
   */
  actorManagesOperatives?: boolean | null
}

export function userDeleteRefusal(
  actor: UserDeletePerson | null | undefined,
  target: UserDeletePerson | null | undefined,
  options?: UserDeleteOptions | null
): UserDeleteRefusal | null {
  if (!actor || !target || !text(target.id)) return 'not_admin'
  const actorRole = actor.role
  if (!actorRole || actorRole.isOperativeMode) return 'not_admin'
  const actorIsAdmin = actorRole.isAdmin || actorRole.isSuperAdmin
  if (!actorIsAdmin) {
    if (!(actorRole.isManager && options?.actorManagesOperatives === true)) return 'not_admin'
    const operativesRoster = options?.roster ?? null
    const ownIds = new Set(personIdSet(actor, operativesRoster).map(key))
    if (personIdSet(target, operativesRoster).some((id) => ownIds.has(key(id)))) return 'self'
    const targetRole = target.role
    const operativeOnly = !!targetRole && targetRole.isOperativeMode && !targetRole.isAdmin && !targetRole.isSuperAdmin && !targetRole.isManager
    return operativeOnly ? null : 'operatives_only'
  }
  const roster = options?.roster ?? null
  const actorIds = new Set(personIdSet(actor, roster).map(key))
  const targetIds = personIdSet(target, roster).map(key)
  if (targetIds.some((id) => actorIds.has(id))) return 'self'
  if (target.role?.isSuperAdmin) return 'super_admin'
  const creator = key(options?.creatorUserId)
  if (creator && targetIds.includes(creator)) return 'creator'
  if (actorRole.isSuperAdmin) return null
  if (target.role?.isAdmin || target.role?.isSuperAdmin) return 'admin_needs_super_admin'
  return null
}

/** True when `userDeleteRefusal` is null. Both apps check it before any write and hide Delete otherwise. */
export function canDeleteUser(
  actor: UserDeletePerson | null | undefined,
  target: UserDeletePerson | null | undefined,
  options?: UserDeleteOptions | null
): boolean {
  return userDeleteRefusal(actor, target, options) === null
}

/** One write in the plan. `update` is a partial update; `deleteFields` are removed (dotted keys). */
export type UserDeleteWrite =
  | { op: 'delete'; path: string }
  | { op: 'update'; path: string; deleteFields: string[] }
  | { op: 'set'; path: string; fields: Record<string, unknown>; serverTimestampFields: string[] }

/** One Firestore batch. Run the steps in order; stop at the first refused step. */
export type UserDeleteStep = {
  step: 'account' | 'bookings' | 'rosterRows' | 'invitations'
  writes: UserDeleteWrite[]
}

export type UserDeleteRow = { id: string; email?: string | null; userId?: string | null }

export type UserDeleteInput = {
  orgId: string
  user: UserDeletePerson
  /** The signed-in admin (deletedBy on tombstones). */
  actorUserId: string
  platform: WritePlatform
  roster?: ReadonlyArray<PersonRosterRow> | null
  /** `organizations/{orgId}/bookings` rows (id, operativeId, dateMs). */
  bookings?: ReadonlyArray<{ id: string; operativeId: string; dateMs: number }> | null
  /** `organizations/{orgId}/managerSiteBookings` rows (id, userId, dateMs). */
  managerSiteBookings?: ReadonlyArray<{ id: string; userId: string; dateMs: number }> | null
  operativeRows?: ReadonlyArray<UserDeleteRow> | null
  managerRows?: ReadonlyArray<UserDeleteRow> | null
  /** `invitations` in this organisation (id, email). */
  invitations?: ReadonlyArray<UserDeleteRow> | null
  /** True when the person's `organizations/{orgId}.members` map has an entry for them. Default true. */
  listedInMembers?: boolean | null
  /** 1.31.0: the actor is a manager with the Operatives permission (the account step runs one write at a time). */
  actorManagesOperatives?: boolean | null
  nowIso: string
  tz?: string | null
}

/**
 * The ordered plan for deleting `user` from `orgId` (1.10.0). Nothing is written unless `canDeleteUser` passed.
 *  1. `account` (one batch, first): delete `users/{uid}`, `users/{uid}/private/taxIds`,
 *     `users/{uid}/orgMemberships/{orgId}`, `organizations/{orgId}/userEmails/{email}`, and remove
 *     `members.{uid}` from the organisation. A refusal here stops the delete with nothing changed.
 *  2. `bookings` (batches of `BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT`): their labour bookings (every id,
 *     `bookingsToRemoveOnOperativeDelete`) and manager site bookings from today on, each with its tombstone
 *     (`bookingTombstoneWriteFields`; the app adds `deletedAt` as the server time). Past bookings stay.
 *  3. `rosterRows`: their `operatives` and `managers` rows (by id or email, without case).
 *  4. `invitations`: their pending invitations in this organisation (by email, without case).
 */
export function userDeleteWrites(input: UserDeleteInput): UserDeleteStep[] {
  const org = text(input?.orgId)
  const uid = text(input?.user?.id)
  if (!org || !uid || org.includes('/') || uid.includes('/')) return []
  const ids = personIdSet(input.user, input.roster ?? null)
  const idKeys = new Set(ids.map(key))
  const email = key(input.user.email)

  // 1.34.0: a ghost has only its users document — no tax ids, membership or members entry, and an email claim only
  // once an admin has invited it (Give app access); deleting it touches nothing else.
  const ghost = isGhostUser(input.user)
  const account: UserDeleteWrite[] = ghost
    ? [{ op: 'delete', path: `users/${uid}` }]
    : [
        { op: 'delete', path: `users/${uid}` },
        { op: 'delete', path: `users/${uid}/private/taxIds` },
        { op: 'delete', path: `users/${uid}/orgMemberships/${org}` },
      ]
  if (email && !email.includes('/')) account.push({ op: 'delete', path: `organizations/${org}/userEmails/${email}` })
  if (!ghost && input.listedInMembers !== false) account.push({ op: 'update', path: `organizations/${org}`, deleteFields: [`members.${uid}`] })
  // 1.31.0 (owner decision 7): a manager with the Operatives permission runs the account step one write at a time,
  // in this order — tax ids, membership, email claim (each checked against the users document still there), then the
  // users document, then the members entry (checked against it being gone). The security rules' document-lookup and
  // expression budget is per request, and their tests are dearer than an admin's. An admin's stays one batch.
  const steps: UserDeleteStep[] =
    input.actorManagesOperatives === true
      ? [
          ...account.filter((write) => write.path !== `users/${uid}` && write.op === 'delete'),
          ...account.filter((write) => write.path === `users/${uid}`),
          ...account.filter((write) => write.op === 'update'),
        ].map((write) => ({ step: 'account' as const, writes: [write] }))
      : [{ step: 'account', writes: account }]

  const rowMatches = (row: UserDeleteRow) =>
    idKeys.has(key(row?.id)) || idKeys.has(key(row?.userId)) || (email !== '' && key(row?.email) === email)
  const rosterRows = [
    ...(input.operativeRows || []).filter(rowMatches).map((row) => ({ collection: 'operatives', id: text(row.id) })),
    ...(input.managerRows || []).filter(rowMatches).map((row) => ({ collection: 'managers', id: text(row.id) })),
  ].filter((row) => row.id && !row.id.includes('/'))

  // 1.31.0 (owner decision): an operatives manager deletes only the bookings dated after today
  // (`operativesManagerMayDeleteBooking`); today's and past bookings are left as they are (history), and manager site
  // bookings are never theirs to delete.
  const managerActor = input.actorManagesOperatives === true
  const labour = bookingsToRemoveOnOperativeDelete({
    bookings: input.bookings || [],
    operativeIds: [...ids, ...rosterRows.filter((row) => row.collection === 'operatives').map((row) => row.id)],
    nowIso: input.nowIso,
    timeZone: input.tz,
    futureOnly: managerActor,
  }).map((id) => ({ collection: 'bookings' as const, id }))
  const today = bookingsToRemoveOnOperativeDelete({
    bookings: managerActor ? [] : (input.managerSiteBookings || []).map((row) => ({ id: row.id, operativeId: row.userId, dateMs: row.dateMs })),
    operativeIds: ids,
    nowIso: input.nowIso,
    timeZone: input.tz,
  }).map((id) => ({ collection: 'managerSiteBookings' as const, id }))
  const bookingWrites: UserDeleteWrite[][] = []
  let current: UserDeleteWrite[] = []
  for (const row of [...labour, ...today]) {
    const tombstone = bookingTombstoneWriteFields({
      bookingId: row.id,
      collection: row.collection,
      deletedBy: input.actorUserId,
      deletedFrom: input.platform,
    })
    const path = bookingTombstonePath(org, row.id)
    if (!tombstone || !path) continue
    current.push({ op: 'delete', path: `organizations/${org}/${row.collection}/${row.id}` })
    current.push({ op: 'set', path, fields: { ...tombstone }, serverTimestampFields: ['deletedAt'] })
    if (current.length >= BOOKING_TOMBSTONE_BATCH_DELETE_LIMIT * 2) {
      bookingWrites.push(current)
      current = []
    }
  }
  if (current.length > 0) bookingWrites.push(current)
  for (const writes of bookingWrites) steps.push({ step: 'bookings', writes })

  if (rosterRows.length > 0) {
    steps.push({
      step: 'rosterRows',
      writes: rosterRows.map((row) => ({ op: 'delete' as const, path: `organizations/${org}/${row.collection}/${row.id}` })),
    })
  }
  const invitations = (input.invitations || [])
    .filter((row) => email !== '' && key(row?.email) === email && text(row.id) && !text(row.id).includes('/'))
    .map((row) => ({ op: 'delete' as const, path: `invitations/${text(row.id)}` }))
  if (invitations.length > 0) steps.push({ step: 'invitations', writes: invitations })
  return steps
}
