/**
 * Line manager pickers and labels on Manage Users (rulebook §8, §11; 1.11.0).
 *
 * Before 1.11.0 each app chose its own candidates and label: iOS showed a manager an empty picker ("No line managers
 * are available to assign") while still offering "No line manager" — which §8 allows only for admins — and labelled
 * two stored ids it could not resolve as "Manager +-1 more". One rule for both apps:
 *   - `lineManagerCandidates(person, roster)`: who may be picked;
 *   - `lineManagerOptions(person)`: whether "No line manager" is offered;
 *   - `lineManagerSummary(person, roster)`: the names and a never-negative "+N more".
 * Pure, JSON in / JSON out.
 */

import { lineManagerRequired } from './leaveRequests'
import { permissionLevelOf } from './permissionLevels'
import { idKey, personIdSet, rosterMemberActive, rosterMemberFor, type PersonRosterRow } from './personIds'
import { isAnonymisedDeletedProfile } from './userRosterSegment'

/** A roster row as Manage Users has it (users documents of the organisation, parsed). */
export type LineManagerRosterPerson = PersonRosterRow & {
  firstName?: string | null
  surname?: string | null
  lastName?: string | null
  name?: string | null
  displayName?: string | null
  /** False for an invite not accepted yet (pending). */
  passwordSet?: boolean | null
  isSuperAdmin?: boolean | null
  adminAccess?: boolean | null
  manager?: boolean | null
  operativeMode?: boolean | null
  permissions?: Record<string, unknown> | null
}

/** The person being edited (or added): their ids, email, level flags and stored line manager fields. */
export type LineManagerSubject = {
  id?: string | null
  email?: string | null
  formerUserIds?: ReadonlyArray<string> | null
  sameEmailUserIds?: ReadonlyArray<string> | null
  role?: unknown
  isSuperAdmin?: boolean | null
  adminAccess?: boolean | null
  operativeMode?: boolean | null
  permissions?: Record<string, unknown> | null
  isActive?: boolean | null
  assignedManagerUserIds?: ReadonlyArray<string> | null
  assignedManagerUserId?: string | null
  hasNoLineManager?: boolean | null
}

export type LineManagerCandidate = { id: string; name: string; level: 'admin' | 'manager' }

export const NO_LINE_MANAGER_LABEL = 'No line manager'
export const NO_LINE_MANAGER_HELP = 'For directors or senior staff whose timesheets and leave nobody else approves.'
export const LINE_MANAGER_NOT_SET_LABEL = 'Not set'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** "First Surname", else the stored name, else the email. */
export function rosterPersonName(row: LineManagerRosterPerson | null | undefined): string {
  if (!row) return ''
  const full = `${text(row.firstName)} ${text(row.surname) || text(row.lastName)}`.trim()
  return full || text(row.displayName) || text(row.name) || text(row.email)
}

function levelOf(row: LineManagerRosterPerson): 'admin' | 'manager' | 'operative' {
  const role = row.role
  if (role && typeof role === 'object') {
    const resolved = role as { isAdmin?: boolean; isSuperAdmin?: boolean; isManager?: boolean; isOperativeMode?: boolean }
    if (resolved.isAdmin === true || resolved.isSuperAdmin === true) return 'admin'
    if (resolved.isOperativeMode === true) return 'operative'
    return resolved.isManager === true ? 'manager' : 'operative'
  }
  return permissionLevelOf(row)
}

/**
 * The roster grouped into people (rulebook §8, 1.14.0): rows that are one person by `personIdSet` (same id ignoring
 * case, `formerUserIds`, `sameEmailUserIds`, same email ignoring case) form one group, in roster order. Each group's
 * `primary` is the row that speaks for the person: active first, then a signed-up account (`passwordSet` not false),
 * then a row no other row of the group lists as an alias (the users document `rosterPeople` kept), then roster order.
 */
function rosterPersonGroups(rows: ReadonlyArray<LineManagerRosterPerson>): Array<{ primary: LineManagerRosterPerson; rows: LineManagerRosterPerson[]; keys: Set<string> }> {
  const groups: Array<{ primary: LineManagerRosterPerson; rows: LineManagerRosterPerson[]; keys: Set<string> }> = []
  const grouped = new Set<string>()
  for (const row of rows) {
    const key = idKey(row.id)
    if (grouped.has(key)) continue
    const keys = new Set(personIdSet(row as never, rows).map(idKey))
    keys.add(key)
    const members = rows.filter((other) => keys.has(idKey(other.id)))
    for (const member of members) grouped.add(idKey(member.id))
    const aliasKeys = new Set<string>()
    for (const member of members) {
      for (const alias of [...(member.formerUserIds || []), ...(member.sameEmailUserIds || []), ...(member.formerIds || []), ...(member.aliasIds || [])]) {
        if (idKey(alias) !== idKey(member.id)) aliasKeys.add(idKey(alias))
      }
    }
    const rank = (member: LineManagerRosterPerson) =>
      (rosterMemberActive(member) && !isAnonymisedDeletedProfile(member as never) ? 0 : 4) +
      (member.passwordSet === false ? 2 : 0) +
      (aliasKeys.has(idKey(member.id)) ? 1 : 0)
    const primary = members.reduce((best, member) => (rank(member) < rank(best) ? member : best), members[0])
    groups.push({ primary, rows: members, keys })
  }
  return groups
}

/**
 * Who can be picked as this person's line manager (rulebook §8, §11; 1.11.0, 1.14.0): every active admin, super admin
 * and manager on the roster — never an operative, an inactive person, an invite not accepted yet (`passwordSet` false),
 * an anonymised deleted profile, or the person themself under any of their ids (`personIdSet`). **One row per person**:
 * rows that are the same person by `personIdSet` (two users documents on one email, an id in another letter case, a
 * former invite id) are one candidate, whose id is the person's live users document (`rosterPersonGroups` primary) and
 * whose level is read from that row. Sorted by name (then id). Both apps fill the Add User and Edit User picker with
 * exactly this list.
 */
export function lineManagerCandidates(
  person: LineManagerSubject | null | undefined,
  roster: ReadonlyArray<LineManagerRosterPerson> | null | undefined
): LineManagerCandidate[] {
  const rows = (roster || []).filter((row) => row && text(row.id))
  const self = new Set(person ? personIdSet(person as never, rows).map(idKey) : [])
  const out: LineManagerCandidate[] = []
  for (const group of rosterPersonGroups(rows)) {
    if ([...group.keys].some((key) => self.has(key))) continue
    const row = group.primary
    if (!rosterMemberActive(row) || row.passwordSet === false) continue
    if (isAnonymisedDeletedProfile(row as never)) continue
    const level = levelOf(row)
    if (level === 'operative') continue
    out.push({ id: text(row.id), name: rosterPersonName(row), level })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id))
}

/**
 * The picker's selected values for this person (rulebook §8, 1.14.0): each stored line manager id
 * (`assignedManagerUserIds`, else `assignedManagerUserId`; none when `hasNoLineManager`) mapped to the
 * `lineManagerCandidates` id of the same person (`personIdSet`), so a stored id that names that person's other users
 * document, an old invite id or another letter case still shows as selected. One entry per person, stored order; an
 * id that matches no candidate is kept as stored (the screen shows it as not pickable, never drops it silently).
 */
export function lineManagerSelectedIds(
  person: LineManagerSubject | null | undefined,
  roster: ReadonlyArray<LineManagerRosterPerson> | null | undefined
): string[] {
  if (!person || person.hasNoLineManager === true) return []
  const listed = (person.assignedManagerUserIds || []).map(text).filter(Boolean)
  const stored = listed.length > 0 ? listed : [text(person.assignedManagerUserId)].filter(Boolean)
  if (stored.length === 0) return []
  const rows = (roster || []).filter((row) => row && text(row.id))
  const candidates = lineManagerCandidates(person, rows)
  const groups = rosterPersonGroups(rows)
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of stored) {
    const group = groups.find((entry) => entry.keys.has(idKey(id)))
    const candidate = group ? candidates.find((entry) => group.keys.has(idKey(entry.id))) : candidates.find((entry) => idKey(entry.id) === idKey(id))
    const value = candidate ? candidate.id : id
    const key = group ? `g:${idKey(group.primary.id)}` : idKey(value)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

/**
 * The picker's options for this person (rulebook §8): `allowsNoLineManager` — "No line manager" is offered only when
 * `lineManagerRequired(person)` is false (an admin or super admin; an inactive person). A manager or operative is never
 * offered it, even when the candidate list is empty (the screen then says no one can be picked yet).
 */
export function lineManagerOptions(person: LineManagerSubject | null | undefined): {
  required: boolean
  allowsNoLineManager: boolean
  noLineManagerLabel: string
  noLineManagerHelp: string
} {
  const required = lineManagerRequired(person as never)
  return { required, allowsNoLineManager: !required, noLineManagerLabel: NO_LINE_MANAGER_LABEL, noLineManagerHelp: NO_LINE_MANAGER_HELP }
}

/** Shown for a stored line manager id the roster does not know (never a raw id, never dropped from the count). */
export const UNKNOWN_PERSON_LABEL = 'Unknown person'

/**
 * The line manager row (rulebook §11, 1.11.0): the person's stored line managers (`assignedManagerUserIds`, else the
 * single id) in stored order, each resolved on the roster — an id the roster knows as an alias is that person (one
 * entry per person, folded by `personIdSet` as in `lineManagerCandidates`, 1.14.0); an id it does not know reads `Unknown person`. `label`: "No line manager" when `hasNoLineManager`;
 * "Not set" when none is stored; the first name alone; or "First +N more" with N = the other entries, shown only for
 * N ≥ 1 (never "+0" or "+-1").
 */
export function lineManagerSummary(
  person: LineManagerSubject | null | undefined,
  roster: ReadonlyArray<LineManagerRosterPerson> | null | undefined
): { label: string; ids: Array<{ id: string; name: string; resolved: boolean }>; moreCount: number } {
  if (!person) return { label: LINE_MANAGER_NOT_SET_LABEL, ids: [], moreCount: 0 }
  if (person.hasNoLineManager === true) return { label: NO_LINE_MANAGER_LABEL, ids: [], moreCount: 0 }
  const listed = (person.assignedManagerUserIds || []).map(text).filter(Boolean)
  const stored = listed.length > 0 ? listed : [text(person.assignedManagerUserId)].filter(Boolean)
  const rows = (roster || []).filter((row) => row && text(row.id))
  const ids: Array<{ id: string; name: string; resolved: boolean }> = []
  const seen = new Set<string>()
  const groups = rosterPersonGroups(rows)
  for (const id of stored) {
    const group = groups.find((entry) => entry.keys.has(idKey(id)))
    const row = group ? group.primary : rosterMemberFor(id, rows)
    const key = group ? `g:${idKey(group.primary.id)}` : idKey(row ? row.id : id)
    if (seen.has(key)) continue
    seen.add(key)
    ids.push(row
      ? { id: text(row.id), name: rosterPersonName(row) || UNKNOWN_PERSON_LABEL, resolved: true }
      : { id, name: UNKNOWN_PERSON_LABEL, resolved: false })
  }
  const moreCount = Math.max(0, ids.length - 1)
  const label = ids.length === 0 ? LINE_MANAGER_NOT_SET_LABEL : moreCount >= 1 ? `${ids[0].name} +${moreCount} more` : ids[0].name
  return { label, ids, moreCount }
}
