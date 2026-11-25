/**
 * The "Line manager" cell on User Timesheets (Awaiting, Signed off, Exported). Display only: the label is the rulebook's
 * `lineManagerSummary` (rulebook §11) over every users document of the organisation, so a stored line manager id that
 * names a folded-away same-email document, a former invite id or another letter case still reads as that person.
 * Before 24 Nov the cell matched only the first stored id, exactly, against the email-folded roster and showed
 * "Unknown" for those.
 *
 * Review of #451 (performance): the named roster is built once per roster (`lineManagerLabelResolver`) and each label
 * is cached by the person's stored line-manager fields — `lineManagerSummary` reads only those from the person — so a
 * list of 100 rows over 300 users costs one roster build and one summary per distinct line manager.
 */
import type { User } from '@/types'
import { lineManagerSummary } from '@/lib/canonical'
import { rulebookRoster } from '@/lib/staff/rulebookPeople'

/** Every users document once by id: the unfolded documents first, then any folded row they do not hold. */
export function lineManagerRosterRows(rosterDocuments: ReadonlyArray<User>, users: ReadonlyArray<User>): User[] {
  const byId = new Map<string, User>()
  for (const row of [...rosterDocuments, ...users]) {
    if (row?.id && !byId.has(row.id)) byId.set(row.id, row)
  }
  return [...byId.values()]
}

/** The person's stored line-manager fields, as `lineManagerSummary` reads them. */
function lineManagerSubject(member: User) {
  return {
    id: member.id,
    hasNoLineManager: member.hasNoLineManager === true,
    assignedManagerUserIds: (member.assignedManagerUserIds || []).map((id) => String(id ?? '').trim()).filter(Boolean),
    assignedManagerUserId: String(member.assignedManagerUserId ?? '').trim() || null,
  }
}

/**
 * The roster as `lineManagerSummary` reads it, with names: `rulebookRoster` carries ids, aliases and flags but no
 * names, so a line manager it resolved was named by email (`rosterPersonName` falls back to it).
 */
export function lineManagerNamedRoster(roster: ReadonlyArray<User>) {
  const rows = [...roster]
  return rulebookRoster(rows).map((row, index) => ({
    ...row,
    firstName: rows[index].firstName ?? null,
    surname: rows[index].surname ?? null,
  }))
}

/**
 * The whose-turn line on the timesheet page (rulebook 1.77.0 §8): the line manager's name only when the person has
 * exactly one known line manager, from `lineManagerSummary` over the unfolded, named roster; null otherwise.
 */
export function soleLineManagerName(member: User, roster: ReadonlyArray<User>): string | null {
  const summary = lineManagerSummary(lineManagerSubject(member) as never, lineManagerNamedRoster(roster) as never)
  const only = summary.ids.length === 1 ? summary.ids[0] : null
  return only && only.resolved && only.name.trim() ? only.name.trim() : null
}

/** Builds the named roster once; the returned function gives a person's label (cached per stored line-manager fields). */
export function lineManagerLabelResolver(roster: ReadonlyArray<User>): (member: User) => string {
  const named = lineManagerNamedRoster(roster)
  const cache = new Map<string, string>()
  return (member: User) => {
    const subject = lineManagerSubject(member)
    const key = `${subject.hasNoLineManager ? 1 : 0}|${subject.assignedManagerUserIds.join(',')}|${subject.assignedManagerUserId ?? ''}`
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const label = lineManagerSummary(subject as never, named as never).label
    cache.set(key, label)
    return label
  }
}

/** One label (tests and one-off use); lists use `lineManagerLabelResolver`. */
export function memberLineManagerLabel(member: User, roster: ReadonlyArray<User>): string {
  return lineManagerLabelResolver(roster)(member)
}
