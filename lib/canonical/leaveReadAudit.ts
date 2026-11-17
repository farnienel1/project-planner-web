/**
 * Rulebook 1.56.0 §9 / §16 (owner answer 17 Nov Q4: "fix the data"): which stored annual-leave records an operative
 * would no longer see once they read only their own leave (`leaveQueryPlan`, and later the Phase B rules behind the
 * `operativeOwnLeave` switch). Read only — the owner runs `scripts/report-leave-legacy-keys.mjs`, then fixes the
 * records it lists; nothing is migrated automatically.
 *
 * A record belongs to an operative when the shared reader gives it to them (`parseHolidayDocument` — every legacy key —
 * matched by `leaveRecordsForAccount` under every id they go by: users id, former ids, same-email users ids,
 * `operatives` rows on their email and the email itself, without case). It is **missed** when its stored top-level
 * `userId` and `operativeId` (Firestore `in` compares exactly) are not among the values the app queries
 * (`leaveQueryValues` over `bookingIdsForAccount` with the users id and former ids, as both apps plan it).
 */

import { bookingIdsForAccount, leaveRecordsForAccount } from './bookingPerson'
import { parseHolidayDocument } from './holidayDocument'
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
   * `legacyKey` — the person's id is only under a key the query does not read (`user_id`, `uid`, `user.id`, …).
   */
  reason: 'letterCase' | 'sameEmailAccount' | 'legacyKey'
  /** Plain-English fix for the owner. */
  fix: string
}

function storedText(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

const key = (value: unknown) => (typeof value === 'string' ? value.trim().toLowerCase() : '')

/**
 * The leave records operatives would stop seeing under their own-leave query, one finding per record and operative.
 * `users` are the organisation's users documents (any shape), `operatives` its `operatives` rows, `leaveDocs` every
 * `holidayBookings` document `{ id, data }`. Ghosts (no login), deleted profiles and non-operatives are skipped: they
 * never run an own-leave query.
 */
export function leaveLegacyKeyFindings(input: {
  users: ReadonlyArray<LeaveReadAuditUser>
  operatives: ReadonlyArray<{ id: string; email?: string | null }>
  leaveDocs: ReadonlyArray<{ id: string; data: Record<string, unknown> }>
  timeZone?: string | null
}): LeaveReadAuditFinding[] {
  const operatives = (input.operatives || []).map((row) => ({ id: row.id, email: row.email ?? '' }))
  const people = (input.users || []).filter(
    (user) =>
      user &&
      typeof user.id === 'string' &&
      user.id !== '' &&
      permissionLevelOf(user) === 'operative' &&
      !isGhostUser(user as { ghost?: unknown }) &&
      !isAnonymisedDeletedProfile(user as never)
  )
  const parsed = (input.leaveDocs || [])
    .map((entry) => ({ entry, record: parseHolidayDocument(entry.id, entry.data, input.timeZone) }))
    .filter((row): row is { entry: (typeof input.leaveDocs)[number]; record: NonNullable<ReturnType<typeof parseHolidayDocument>> } => row.record !== null)

  const findings: LeaveReadAuditFinding[] = []
  for (const person of people) {
    const email = typeof person.email === 'string' ? person.email : ''
    const planIds = bookingIdsForAccount({ id: person.id, email, formerIds: person.formerUserIds ?? [] }, operatives)
    const values = new Set(leaveQueryValues(person.id, planIds, email))
    const valueKeys = new Set([...values].map(key))
    const sameEmailKeys = new Set((person.sameEmailUserIds ?? []).map(key).filter(Boolean))
    const account = {
      id: person.id,
      email,
      formerIds: person.formerUserIds ?? [],
      aliasIds: person.sameEmailUserIds ?? [],
    }
    for (const { entry, record } of parsed) {
      if (leaveRecordsForAccount([record], account, operatives).length === 0) continue
      const storedUserId = storedText(entry.data?.userId)
      const storedOperativeId = storedText(entry.data?.operativeId)
      const queried = (storedUserId !== null && values.has(storedUserId)) || (storedOperativeId !== null && values.has(storedOperativeId))
      if (queried) continue
      const spelling = valueKeys.has(key(storedUserId)) || valueKeys.has(key(storedOperativeId))
      const sameEmail = sameEmailKeys.has(key(record.userId)) || sameEmailKeys.has(key(record.operativeId))
      const reason: LeaveReadAuditFinding['reason'] = spelling ? 'letterCase' : sameEmail ? 'sameEmailAccount' : 'legacyKey'
      findings.push({
        leaveId: entry.id,
        personId: person.id,
        personEmail: email,
        storedUserId,
        storedOperativeId,
        readerUserId: record.userId,
        readerOperativeId: record.operativeId,
        reason,
        fix: `Set userId to "${person.id}" on organizations/{orgId}/holidayBookings/${entry.id} (keep every other field).`,
      })
    }
  }
  return findings
}
