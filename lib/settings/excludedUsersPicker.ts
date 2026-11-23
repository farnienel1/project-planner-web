import type { User } from '@/types'
import {
  listedCurrentLabourPeople,
  listedRosterUsers,
  normalizeDocumentId,
  personIdSet,
  rosterSegment,
} from '@/lib/canonical'
import { personDisplayName } from '@/lib/settings/orgHubUtils'

/** Label for a stored excluded id that names nobody on the roster any more (a deleted person). */
export const EXCLUDED_REMOVED_USER_LABEL = 'Removed user'

export type ExcludedUsersPickerRow = {
  /** Stable React key. */
  key: string
  /** `person`: a current person (rulebook roster, Active). `stored`: a saved exclusion that names no current person. */
  kind: 'person' | 'stored'
  title: string
  subtitle: string
  /** Every id of this row that may be stored in the excluded list (a person: all their ids; stored: that id). */
  ids: string[]
  /** The id written when the row is ticked on. */
  primaryId: string
  excluded: boolean
}

type RosterUser = Pick<User, 'id' | 'email' | 'firstName' | 'surname'> & Parameters<typeof rosterSegment>[0] & {
  formerUserIds?: string[]
  sameEmailUserIds?: string[]
}

/**
 * The rows Settings → Warnings → Excluded users shows.
 *
 * People: the rulebook roster (`listedRosterUsers`, `listedCurrentLabourPeople`) and only those whose roster segment
 * is Active (`rosterSegment`) — the people the unbooked-labour warning can list. No pending invites, inactive people or
 * anonymised deleted profiles. A person counts as excluded when any id they go by is stored (`personIdSet`, without
 * case), as `unbookedLabourRows` matches them.
 *
 * Stored ids that match no current person each get a row so the admin can untick them; nothing is written until Save.
 * A known person who is no longer current (inactive or pending) keeps their name with the status; an id nobody on
 * the roster goes by (or an anonymised profile) reads `Removed user`.
 */
export function excludedUsersPickerRows<T extends RosterUser>(input: {
  users: readonly T[]
  /** Every users document (unfolded), for `personIdSet`. Defaults to `users`. */
  rosterDocuments?: readonly T[] | null
  claimedEmails?: readonly string[] | null
  excludedIds: readonly string[]
}): ExcludedUsersPickerRow[] {
  const roster = input.rosterDocuments && input.rosterDocuments.length > 0 ? input.rosterDocuments : input.users
  const excludedKeys = new Set(input.excludedIds.map((id) => normalizeDocumentId(id)).filter(Boolean))
  const listed = listedRosterUsers(input.users, input.claimedEmails ?? null)
  const current = listedCurrentLabourPeople(listed).filter((user) => rosterSegment(user) === 'active')

  const claimedKeys = new Set<string>()
  const personRows: ExcludedUsersPickerRow[] = current
    .map((user) => {
      const ids = personIdSet(user, roster as never)
      for (const id of ids) claimedKeys.add(normalizeDocumentId(id))
      return {
        key: `person:${user.id}`,
        kind: 'person' as const,
        title: personDisplayName(user),
        subtitle: user.email ?? '',
        ids,
        primaryId: user.id,
        excluded: ids.some((id) => excludedKeys.has(normalizeDocumentId(id))),
      }
    })
    .sort((a, b) => a.title.localeCompare(b.title))

  const storedRows: ExcludedUsersPickerRow[] = []
  const seenStored = new Set<string>()
  for (const id of input.excludedIds) {
    const key = normalizeDocumentId(id)
    if (!key || claimedKeys.has(key) || seenStored.has(key)) continue
    seenStored.add(key)
    const known = input.users.find((user) =>
      personIdSet(user, roster as never).some((own) => normalizeDocumentId(own) === key)
    )
    const removed = !known || listedCurrentLabourPeople([known]).length === 0
    const segment = known ? rosterSegment(known) : null
    storedRows.push({
      key: `stored:${key}`,
      kind: 'stored',
      title: removed ? EXCLUDED_REMOVED_USER_LABEL : personDisplayName(known),
      subtitle: removed ? 'No longer in this organisation' : segment === 'pending' ? 'Pending' : 'Inactive',
      ids: [id],
      primaryId: id,
      excluded: true,
    })
  }
  return [...personRows, ...storedRows]
}

/** Rows whose title or subtitle contains the search text (without case). */
export function filterExcludedUsersPickerRows(
  rows: readonly ExcludedUsersPickerRow[],
  search: string
): ExcludedUsersPickerRow[] {
  const q = search.trim().toLowerCase()
  if (!q) return [...rows]
  return rows.filter((row) => row.title.toLowerCase().includes(q) || row.subtitle.toLowerCase().includes(q))
}

/**
 * The stored list after ticking a row: on adds the row's id; off removes every id of that row (without case).
 * A stored row ticked off and on again comes back as the same id.
 */
export function excludedIdsAfterToggle(excludedIds: readonly string[], row: ExcludedUsersPickerRow): string[] {
  const rowKeys = new Set(row.ids.map((id) => normalizeDocumentId(id)))
  const on = excludedIds.some((id) => rowKeys.has(normalizeDocumentId(id)))
  if (on) return excludedIds.filter((id) => !rowKeys.has(normalizeDocumentId(id)))
  return [...excludedIds, row.primaryId]
}

/** The badge count: current people excluded (each once). Saved ids that name nobody current are not counted. */
export function excludedCurrentPeopleCount(rows: readonly ExcludedUsersPickerRow[]): number {
  return rows.filter((row) => row.kind === 'person' && row.excluded).length
}
