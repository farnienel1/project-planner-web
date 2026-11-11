/**
 * Rulebook 1.36.0 §11 (owner decision 10 Nov): warn about a duplicate name when adding a user.
 *
 * Add User / Add new operative (the ghost path included) asks `usersWithSameName` before it saves. When the first and
 * last name match a person already in the organisation, the app shows `DUPLICATE_NAME_WARNING_MESSAGE` with
 * **Add anyway** and **Cancel**. A warning only, never a block: a person is identified by their email (their login),
 * never by their name (`personIdSet`, §8).
 *
 * "Exactly" (owner): the first name and the last name are compared trimmed, without case, with runs of spaces inside a
 * name read as one space. Both names are needed; a blank first or last name matches nobody.
 */

import { idKey, idText, personIdSet, type PersonIdsInput, type PersonRosterRow } from './personIds'
import { permissionLevelOf, type PermissionLevel } from './permissionLevels'
import { GHOST_BADGE_LABEL } from './ghostOperatives'
import {
  isAnonymisedDeletedProfile,
  isGhostUser,
  isIdentifiablePendingLeftover,
  rosterPersonName,
  rosterSegment,
  type RosterSegment,
  type RosterSegmentProfile,
} from './userRosterSegment'

export const DUPLICATE_NAME_WARNING_TITLE = 'Name already in use'
export const DUPLICATE_NAME_WARNING_MESSAGE = 'A user with this name already exists. Are you sure you want to add this user?'
export const DUPLICATE_NAME_CONFIRM_LABEL = 'Add anyway'
export const DUPLICATE_NAME_CANCEL_LABEL = 'Cancel'
/** Shown for a match with no email who is not a ghost (an older record or an invite stored without one). */
export const DUPLICATE_NAME_NO_EMAIL_LABEL = 'No email'

/** A users document of the organisation as `usersWithSameName` reads it. */
export type SameNameRosterRow = PersonIdsInput &
  RosterSegmentProfile & {
    id: string
    role?: string | null
    isSuperAdmin?: unknown
    adminAccess?: unknown
    operativeMode?: unknown
    permissions?: unknown
  }

export type SameNamePerson = {
  /** The users id of the row that speaks for the person (an active one first). */
  id: string
  /** The stored name as the lists show it (`rosterPersonName`). */
  displayName: string
  /** Trimmed, as stored; '' for a ghost or anyone without an email. */
  email: string
  level: PermissionLevel
  /** `rosterSegment` is `active`. */
  active: boolean
  segment: RosterSegment
  ghost: boolean
}

/** Trimmed, lower case, inner runs of white space read as one space. */
export function normalizePersonNamePart(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLowerCase() : ''
}

function rowNameParts(row: SameNameRosterRow): { first: string; last: string; full: string } {
  const first = normalizePersonNamePart(row.firstName)
  const last = normalizePersonNamePart(row.surname) || normalizePersonNamePart(row.lastName)
  return { first, last, full: normalizePersonNamePart(rosterPersonName(row)) }
}

function rowMatches(row: SameNameRosterRow, first: string, last: string): boolean {
  const parts = rowNameParts(row)
  if (parts.first || parts.last) return parts.first === first && parts.last === last
  // A row stored with only a single `name` / `displayName` (older documents): compare the whole name.
  return parts.full !== '' && parts.full === `${first} ${last}`
}

function segmentRank(segment: RosterSegment): number {
  return segment === 'active' ? 0 : segment === 'pending' ? 1 : 2
}

/**
 * The people of the organisation whose first and last name match the draft, one per person.
 *
 * - `roster`: every users document of the organisation (the unfolded roster or the email fold; rows that are one
 *   person by `personIdSet` — the same id without case, `formerUserIds`, `sameEmailUserIds` or the same email — are
 *   counted once, an active row speaking for them).
 * - Counted: active, inactive and pending people, and ghosts.
 * - Left out: anonymised deleted profiles (`isAnonymisedDeletedProfile`) and leftover invites whose email claim is
 *   gone (`isIdentifiablePendingLeftover` with `claimedEmails`; null or omitted = the claims did not load, so an
 *   emailed pending invite is kept, as the people lists do).
 */
export function usersWithSameName(
  roster: ReadonlyArray<SameNameRosterRow> | null | undefined,
  draft: { firstName?: unknown; lastName?: unknown },
  options: { claimedEmails?: readonly string[] | null } = {}
): SameNamePerson[] {
  const first = normalizePersonNamePart(draft?.firstName)
  const last = normalizePersonNamePart(draft?.lastName)
  if (!first || !last) return []
  const rows = (roster || []).filter((row) => row && typeof row === 'object' && idText(row.id))
  const groups: Array<{ keys: Set<string>; row: SameNameRosterRow; segment: RosterSegment }> = []
  for (const row of rows) {
    if (isAnonymisedDeletedProfile(row)) continue
    if (isIdentifiablePendingLeftover(row, options.claimedEmails)) continue
    if (!rowMatches(row, first, last)) continue
    const keys = new Set(personIdSet(row, rows as ReadonlyArray<PersonRosterRow>).map(idKey))
    const segment = rosterSegment(row)
    const existing = groups.find((group) => [...keys].some((key) => group.keys.has(key)))
    if (!existing) {
      groups.push({ keys, row, segment })
      continue
    }
    for (const key of keys) existing.keys.add(key)
    if (segmentRank(segment) < segmentRank(existing.segment)) {
      existing.row = row
      existing.segment = segment
    }
  }
  return groups.map(({ row, segment }) => ({
    id: idText(row.id),
    displayName: rosterPersonName(row),
    email: idText(row.email),
    level: permissionLevelOf(row),
    active: segment === 'active',
    segment,
    ghost: isGhostUser(row),
  }))
}

/**
 * What the warning shows next to a match's name: their email; else "No app login" (`GHOST_BADGE_LABEL`) for a ghost
 * only; else `DUPLICATE_NAME_NO_EMAIL_LABEL`.
 */
export function sameNamePersonContactLabel(person: Pick<SameNamePerson, 'email' | 'ghost'> | null | undefined): string {
  const email = idText(person?.email)
  if (email) return email
  return person?.ghost === true ? GHOST_BADGE_LABEL : DUPLICATE_NAME_NO_EMAIL_LABEL
}
