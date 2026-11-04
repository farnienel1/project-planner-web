/**
 * Who can be a project or small-works job manager, and how a job's stored managers read now (rulebook §11, 1.30.3).
 *
 * Before 1.30.3 each app picked job managers itself. iOS offered every active `managers` catalogue row that has an
 * active users document on its email, plus active signed-up admins. Web judged the person on the one users document the
 * email fold kept — and the fold keeps an admin document first, so a stale admin duplicate (an old invite, an inactive
 * copy) left behind by repeated Change user type saves hid a live manager from the web picker, while iOS still listed
 * them. One rule now, for both apps:
 *   - `jobManagerCandidates(roster)`: the active admins, super admins and managers, one per person (folded like
 *     `lineManagerCandidates`: the live users document speaks for the person), never an operative, an inactive
 *     person, an invite not accepted yet, or an anonymised deleted profile.
 *   - `jobManagerAssignments(job, roster, catalogue)`: each manager stored on the job (`jobManagerIds`) as `current`
 *     (a candidate), `former` (a known person who is no longer a candidate, with the reason and the note the picker
 *     shows) or `unknown` (nobody loaded matches; kept so a save never drops an assignment not loaded yet).
 *
 * The roster is the organisation's users documents, NOT pre-folded: a fold that already dropped the live document
 * cannot be undone here. Pure, JSON in / JSON out.
 */

import { levelOf, rosterPersonGroups, rosterPersonName, type LineManagerRosterPerson } from './lineManagers'
import { idKey, rosterMemberActive } from './personIds'
import { jobManagerIds, stableManagerId, type JobManagerFields } from './staffAccess'
import { isAnonymisedDeletedProfile } from './userRosterSegment'

/** A users document as the job-manager picker reads it (the line-manager roster row plus the invite status). */
export type JobManagerRosterPerson = LineManagerRosterPerson & {
  /** `pending` (an invite not accepted in this organisation) is never a candidate. */
  status?: string | null
}

/** A row of `organizations/{orgId}/managers` (the catalogue iOS stores in `managerIds`). */
export type JobManagerCatalogueRow = {
  id: string
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  isActive?: boolean | null
}

export type JobManagerCandidate = {
  /** The person's live users document id. */
  id: string
  /** Every id of the person (each users document on the email, former and same-email ids), stored case. */
  userIds: string[]
  email: string
  name: string
  level: 'admin' | 'manager'
}

export type JobManagerFormerReason = 'not_manager' | 'inactive' | 'pending' | 'deleted' | 'no_account'

export type JobManagerAssignment = {
  /** The id as stored on the job. */
  storedId: string
  state: 'current' | 'former' | 'unknown'
  /** The candidate (current) — null otherwise. */
  candidate: JobManagerCandidate | null
  /** The person's name when known, else ''. */
  name: string
  reason: JobManagerFormerReason | null
  /** Shown beside a former manager in the picker; null when current or unknown. */
  note: string | null
}

export const JOB_MANAGER_LEVEL_LABELS: Readonly<Record<'admin' | 'manager', string>> = {
  admin: 'Admin',
  manager: 'Manager',
}

/** The picker note beside an assigned manager who is no longer a candidate, by reason. */
export const JOB_MANAGER_FORMER_NOTES: Readonly<Record<JobManagerFormerReason, string>> = {
  not_manager: 'Former manager — no longer a manager',
  inactive: 'Former manager — inactive',
  pending: 'Former manager — invite not accepted',
  deleted: 'Former manager — user deleted',
  no_account: 'Former manager — no user account',
}

export const JOB_MANAGER_NO_CANDIDATES_MESSAGE = 'No managers or admins yet. Invite a manager from Manage users, then return here.'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function bareKey(value: unknown): string {
  const raw = text(value)
  return idKey(raw.toLowerCase().startsWith('user:') ? raw.slice(5) : raw)
}

function emailKey(value: unknown): string {
  return text(value).toLowerCase()
}

type Group = ReturnType<typeof rosterPersonGroups>[number]

function groupsOf(roster: ReadonlyArray<JobManagerRosterPerson> | null | undefined): Group[] {
  return rosterPersonGroups((roster || []).filter((row) => row && text(row.id)))
}

/** Why this person is not a candidate, or null when they are. */
function exclusion(row: JobManagerRosterPerson): JobManagerFormerReason | null {
  if (isAnonymisedDeletedProfile(row as never)) return 'deleted'
  if (!rosterMemberActive(row)) return 'inactive'
  if (row.passwordSet === false || text(row.status).toLowerCase() === 'pending') return 'pending'
  return levelOf(row) === 'operative' ? 'not_manager' : null
}

function candidateOf(group: Group): JobManagerCandidate | null {
  const row = group.primary as JobManagerRosterPerson
  if (exclusion(row)) return null
  const ids: string[] = []
  const seen = new Set<string>()
  const add = (id: unknown) => {
    const value = text(id)
    if (!value || seen.has(idKey(value))) return
    seen.add(idKey(value))
    ids.push(value)
  }
  add(row.id)
  for (const member of group.rows) {
    add(member.id)
    for (const alias of [...(member.formerUserIds || []), ...(member.sameEmailUserIds || [])]) add(alias)
  }
  return {
    id: text(row.id),
    userIds: ids,
    email: text(row.email),
    name: rosterPersonName(row),
    level: levelOf(row) === 'admin' ? 'admin' : 'manager',
  }
}

function byName(a: JobManagerCandidate, b: JobManagerCandidate): number {
  return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id)
}

/**
 * Who can be picked as a project or small-works manager (rulebook §11, 1.30.3): every active admin, super admin and
 * manager, one per person (rows that are one person by `personIdSet` fold together; the active, signed-up document
 * speaks for them, as in `lineManagerCandidates`), sorted by name then id. Never an operative, an inactive person, an
 * invite not accepted yet (`passwordSet` false or status `pending`), or an anonymised deleted profile. Create and edit,
 * projects and small works, on every platform, offer exactly this list.
 */
export function jobManagerCandidates(roster: ReadonlyArray<JobManagerRosterPerson> | null | undefined): JobManagerCandidate[] {
  const out: JobManagerCandidate[] = []
  for (const group of groupsOf(roster)) {
    const candidate = candidateOf(group)
    if (candidate) out.push(candidate)
  }
  return out.sort(byName)
}

/**
 * Each manager stored on the job (`jobManagerIds`: `managerIds`, `managerId`, `assignedManagerUserIds`,
 * `managerUserIds`; one per person) as it reads now (rulebook §11, 1.30.3). A stored id names a person when it is one
 * of their ids (a `user:` prefix and letter case ignored), or a `managers` catalogue row (its id or iOS
 * `stableManagerId`) whose email is theirs. `current`: the person is a `jobManagerCandidates` row. `former`: a known
 * person who is not (operative now, inactive, invite not accepted, deleted), or a catalogue row with no users document
 * — with `JOB_MANAGER_FORMER_NOTES[reason]`. `unknown`: nothing loaded matches; the app keeps the id.
 */
export function jobManagerAssignments(
  job: JobManagerFields | Record<string, unknown> | null | undefined,
  roster: ReadonlyArray<JobManagerRosterPerson> | null | undefined,
  catalogue?: ReadonlyArray<JobManagerCatalogueRow> | null
): JobManagerAssignment[] {
  const groups = groupsOf(roster)
  const rows = (catalogue || []).filter((row) => row && text(row.id))
  const out: JobManagerAssignment[] = []
  const seenPeople = new Set<Group>()
  for (const storedId of jobManagerIds(job)) {
    const key = bareKey(storedId)
    if (!key) continue
    let group = groups.find((entry) => entry.keys.has(key))
    let catalogueRow: JobManagerCatalogueRow | undefined
    if (!group) {
      catalogueRow = rows.find((row) => idKey(row.id) === key || idKey(stableManagerId(row.id)) === key)
      const email = emailKey(catalogueRow?.email)
      if (email) group = groups.find((entry) => entry.rows.some((row) => emailKey(row.email) === email))
    }
    if (group) {
      if (seenPeople.has(group)) continue
      seenPeople.add(group)
      const candidate = candidateOf(group)
      const reason = candidate ? null : exclusion(group.primary as JobManagerRosterPerson)
      out.push({
        storedId,
        state: candidate ? 'current' : 'former',
        candidate,
        name: rosterPersonName(group.primary),
        reason,
        note: reason ? JOB_MANAGER_FORMER_NOTES[reason] : null,
      })
      continue
    }
    if (catalogueRow) {
      out.push({
        storedId,
        state: 'former',
        candidate: null,
        name: `${text(catalogueRow.firstName)} ${text(catalogueRow.lastName)}`.trim() || text(catalogueRow.email),
        reason: 'no_account',
        note: JOB_MANAGER_FORMER_NOTES.no_account,
      })
      continue
    }
    out.push({ storedId, state: 'unknown', candidate: null, name: '', reason: null, note: null })
  }
  return out
}
