/**
 * The "Line manager" cell on User Timesheets (Awaiting, Signed off, Exported). Display only: the label is the rulebook's
 * `lineManagerSummary` (rulebook §11) over the person and every users document of the organisation, so a stored line
 * manager id that names a folded-away same-email document, a former invite id or another letter case still reads as
 * that person. Before 24 Nov the cell matched only the first stored id, exactly, against the email-folded roster and
 * showed "Unknown" for those.
 */
import type { User } from '@/types'
import { lineManagerSummary } from '@/lib/canonical'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'

/** Every users document once by id: the unfolded documents first, then any folded row they do not hold. */
export function lineManagerRosterRows(rosterDocuments: ReadonlyArray<User>, users: ReadonlyArray<User>): User[] {
  const byId = new Map<string, User>()
  for (const row of [...rosterDocuments, ...users]) {
    if (row?.id && !byId.has(row.id)) byId.set(row.id, row)
  }
  return [...byId.values()]
}

export function memberLineManagerLabel(member: User, roster: ReadonlyArray<User>): string {
  const rows = roster.some((row) => row.id === member.id) ? [...roster] : [...roster, member]
  // `rulebookRoster` carries ids, aliases and flags but no names; the summary names each line manager from these.
  const named = rulebookRoster(rows).map((row, index) => ({
    ...row,
    firstName: rows[index].firstName ?? null,
    surname: rows[index].surname ?? null,
  }))
  return lineManagerSummary(rulebookPerson(member, rows) as never, named as never).label
}
