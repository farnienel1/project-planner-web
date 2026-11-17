/**
 * Rulebook 1.56.0 §9 / §16 (owner answer 17 Nov Q4: "fix the data"): which stored annual-leave records an operative
 * would no longer see once they read only their own leave (`leaveQueryPlan`, and later the Phase B rules behind the
 * `operativeOwnLeave` switch). Read only — the owner runs `scripts/report-leave-legacy-keys.mjs`, then fixes the
 * records it lists; nothing is migrated automatically.
 *
 * A record belongs to an operative when the shared reader gives it to them (`parseHolidayDocument` — every legacy key —
 * matched by `leaveRecordsForAccount` under every id they go by: users id, former ids, same-email users ids,
 * `operatives` rows on their email and the email itself, without case). It is **missed** when its stored `userId` is
 * not among the queried ids and emails and its `operativeId` is not among the queried ids (Firestore `in` compares
 * exactly; `leaveQueryValues` over `bookingIdsForAccount` with the users id and former ids, as both apps plan it).
 * Operatives are the people at the operative level in this organisation (`organizationLevelFor`: their users document
 * of this organisation, else their membership here, else the `members` role), so a member whose users document names
 * another company is included. A record two operatives would both claim is one `conflict` finding (the owner decides
 * whose it is), never two fixes.
 */

import { bookingIdsForAccount, leaveRecordsForAccount } from './bookingPerson'
import { parseHolidayDocument } from './holidayDocument'
import { organizationLevelFor } from './orgRoster'
import { permissionLevelOf } from './permissionLevels'
import { leaveQueryValues } from './staffAccess'
import { isAnonymisedDeletedProfile, isGhostUser } from './userRosterSegment'

export type LeaveReadAuditUser = {
  id: string
  email?: string | null
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
  isActive?: unknown
  [key: string]: unknown
}

export type LeaveReadAuditFinding = {
  leaveId: string
  /** The operative the shared reader gives the record to. */
  personId: string
  personEmail: string
  /** The record's stored top-level fields (null when missing or not text). */
  storedUserId: string | null
  storedOperativeId: string | null
  /** The id the reader matched it by (it may come from a legacy key such as `user_id` or a nested `user.id`). */
  readerUserId: string | null
  readerOperativeId: string | null
  /**
   * `letterCase` — a stored id differs from a queried one only by letter case or spaces;
   * `sameEmailAccount` — it is filed under a second users document on the person's email (not queried);
   * `legacyKey` — the person's id is only under a key the query does not read (`user_id`, `uid`, `user.id`, …), or
   *   the email is stored as `operativeId` (only `userId` is queried for the email);
   * `conflict` — two or more operatives would claim the record (`otherPersonIds`); the owner decides whose it is.
   */
  reason: 'letterCase' | 'sameEmailAccount' | 'legacyKey' | 'conflict'
  /** For a `conflict`, the other operatives' users ids. */
  otherPersonIds: string[]
  /** Plain-English fix for the owner. */
  fix: string
}

function storedText(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

const key = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '')

/**
 * The leave records operatives would stop seeing under their own-leave query, one finding per record. `users` are the
 * organisation's users documents plus the users documents of its members from other companies, `memberships` their
 * `users/{uid}/orgMemberships/{orgId}` documents by uid, `members` the organisation's `members` map, `operatives` its
 * `operatives` rows, `leaveDocs` every `holidayBookings` document `{ id, data }`. Ghosts (no login), deleted profiles
 * and anyone not at the operative level are skipped: they never run an own-leave query.
 */
export function leaveLegacyKeyFindings(input: {
  organizationId?: string | null
  users: ReadonlyArray<LeaveReadAuditUser>
  memberships?: Readonly<Record<string, Record<string, unknown> | null | undefined>> | null
  members?: Readonly<Record<string, unknown>> | null
  creatorUserId?: string | null
  operatives: ReadonlyArray<{ id: string; email?: string | null }>
  leaveDocs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>
  timeZone?: string | null
}): LeaveReadAuditFinding[] {
  const organizationId = typeof input.organizationId === 'string' ? input.organizationId : ''
  const operatives = (input.operatives || []).map((row) => ({ id: row.id, email: row.email ?? '' }))
  const people = (input.users || []).filter((user) => {
    if (!user || typeof user.id !== 'string' || user.id === '') return false
    if (isGhostUser(user as { ghost?: unknown }) || isAnonymisedDeletedProfile(user as never)) return false
    const level = organizationId
      ? organizationLevelFor({
          organizationId,
          userId: user.id,
          user: user as Record<string, unknown>,
          membership: input.memberships?.[user.id] ?? null,
          membersRole: input.members?.[user.id],
          creatorUserId: input.creatorUserId ?? null,
        }).level
      : permissionLevelOf(user)
    return level === 'operative'
  })
  const parsed = (input.leaveDocs || [])
    .map((entry) => ({ entry, record: parseHolidayDocument(entry.id, entry.data, input.timeZone) }))
    .filter((row): row is { entry: (typeof input.leaveDocs)[number]; record: NonNullable<ReturnType<typeof parseHolidayDocument>> } => row.record !== null)

  const plans = people.map((person) => {
    const email = typeof person.email === 'string' ? person.email : ''
    const planIds = bookingIdsForAccount({ id: person.id, email, formerIds: person.formerUserIds ?? [] }, operatives)
    const { ids, emails } = leaveQueryValues(person.id, planIds, email)
    return {
      person,
      email,
      userValues: new Set([...ids, ...emails]),
      operativeValues: new Set(ids),
      userKeys: new Set([...ids, ...emails].map(key)),
      operativeKeys: new Set(ids.map(key)),
      sameEmailKeys: new Set((person.sameEmailUserIds ?? []).map(key).filter(Boolean)),
      account: { id: person.id, email, formerIds: person.formerUserIds ?? [], aliasIds: person.sameEmailUserIds ?? [] },
    }
  })

  const findings: LeaveReadAuditFinding[] = []
  for (const { entry, record } of parsed) {
    const owners = plans.filter((plan) => leaveRecordsForAccount([record], plan.account, operatives).length > 0)
    if (owners.length === 0) continue
    const storedUserId = storedText(entry.data?.userId)
    const storedOperativeId = storedText(entry.data?.operativeId)
    const queriedBy = (plan: (typeof plans)[number]) =>
      (storedUserId !== null && plan.userValues.has(storedUserId)) ||
      (storedOperativeId !== null && plan.operativeValues.has(storedOperativeId))
    if (owners.length > 1) {
      findings.push({
        leaveId: entry.id,
        personId: owners[0].person.id,
        personEmail: owners[0].email,
        storedUserId,
        storedOperativeId,
        readerUserId: record.userId,
        readerOperativeId: record.operativeId,
        reason: 'conflict',
        otherPersonIds: owners.slice(1).map((plan) => plan.person.id),
        fix: `Decide whose leave organizations/{orgId}/holidayBookings/${entry.id} is (${owners.map((plan) => plan.person.id).join(', ')}) and set its userId to that person's users id.`,
      })
      continue
    }
    const owner = owners[0]
    if (queriedBy(owner)) continue
    const spelling = owner.userKeys.has(key(storedUserId)) || owner.operativeKeys.has(key(storedOperativeId))
    const sameEmail = owner.sameEmailKeys.has(key(record.userId)) || owner.sameEmailKeys.has(key(record.operativeId))
    const reason: LeaveReadAuditFinding['reason'] = spelling ? 'letterCase' : sameEmail ? 'sameEmailAccount' : 'legacyKey'
    findings.push({
      leaveId: entry.id,
      personId: owner.person.id,
      personEmail: owner.email,
      storedUserId,
      storedOperativeId,
      readerUserId: record.userId,
      readerOperativeId: record.operativeId,
      reason,
      otherPersonIds: [],
      fix: `Set userId to "${owner.person.id}" on organizations/{orgId}/holidayBookings/${entry.id} (keep every other field).`,
    })
  }
  return findings
}
