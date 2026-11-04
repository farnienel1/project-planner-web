import { idsMatch } from '@/lib/subcontractors/bookingPeople'
import { stableManagerId } from '@/lib/canonical/staffAccess'
import {
  JOB_MANAGER_LEVEL_LABELS,
  jobManagerAssignments,
  jobManagerCandidates,
  type JobManagerAssignment,
  type JobManagerRosterPerson,
} from '@/lib/canonical/jobManagers'

/**
 * Who can be chosen as a project or small-works manager: rulebook 1.30.2 `jobManagerCandidates` (active admins, super
 * admins and managers, one per person, never an operative, inactive, pending or deleted profile), and how each stored
 * manager reads now: `jobManagerAssignments` (current / former with a note / unknown). This file only maps the web
 * roster into those functions and maps a candidate to the id the job stores.
 *
 * Pass every users document (`rosterDocumentsFor`), not the email-folded roster: the fold keeps an admin copy first,
 * and before 1.30.2 a stale admin copy (an old invite) left by repeated Change user type saves hid a live manager.
 *
 * iOS stores `managerIds` as `Manager.stableId(forFirestoreDocumentId:)` of a `managers` catalogue row. That equals the
 * document id when the id is a UUID, and a hash when the document id is a user id. A pick with no catalogue row is
 * `user:{uid}` until the save creates the row.
 */

export type ProjectManagerRosterRow = {
  id: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  isActive?: boolean
  organizationId?: string | null
}

export type ProjectManagerAccount = {
  id: string
  firstName?: string | null
  surname?: string | null
  email?: string | null
  isActive?: boolean
  passwordSet?: boolean
  status?: string | null
  organizationId?: string | null
  isSuperAdmin?: boolean
  role?: string | null
  permissions?: {
    manager?: boolean
    adminAccess?: boolean
    operativeMode?: boolean
  } | null
}

export type ProjectManagerChoice = {
  id: string
  label: string
  email: string
  userId?: string
  /** Rulebook 1.30.2: 'admin' | 'manager' and its badge text. */
  level: 'admin' | 'manager'
  levelLabel: string
}

/** One selected entry in the picker: a current candidate, a former manager (with the note) or an id not loaded. */
export type ProjectManagerSelectedEntry = {
  id: string
  label: string
  state: JobManagerAssignment['state']
  levelLabel: string | null
  note: string | null
}

function clean(value: string | null | undefined): string {
  return String(value || '').trim()
}

export function normalizeManagerEmail(email: string | null | undefined): string {
  return clean(email).toLowerCase()
}

function bareId(id: string): string {
  return id.toLowerCase().startsWith('user:') ? id.slice('user:'.length) : id
}

export function managerIdsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = clean(left)
  const b = clean(right)
  if (!a || !b) return false
  return idsMatch(a, b) || idsMatch(bareId(a), bareId(b))
}

/** iOS `Manager.stableId(forFirestoreDocumentId:)` — the rulebook `stableManagerId` (1.10.0). */
export function stableManagerDocumentId(documentId: string): string {
  return stableManagerId(documentId)
}

export function choiceIdForRoster(documentId: string): string {
  const stable = stableManagerDocumentId(documentId)
  return managerIdsMatch(stable, documentId) ? documentId : stable
}

function sameOrganisation(user: ProjectManagerAccount, organizationId?: string): boolean {
  if (!organizationId || !clean(user.organizationId)) return true
  return user.organizationId === organizationId
}

/** The web roster as `jobManagerCandidates` reads it (this organisation's users documents only). */
function rosterRows(users: readonly ProjectManagerAccount[], organizationId?: string): JobManagerRosterPerson[] {
  return users
    .filter((user) => sameOrganisation(user, organizationId))
    .map((user) => ({
      id: user.id,
      email: user.email ?? '',
      firstName: user.firstName ?? '',
      surname: user.surname ?? '',
      isActive: user.isActive,
      passwordSet: user.passwordSet,
      status: user.status ?? null,
      role: user.role ?? null,
      isSuperAdmin: user.isSuperAdmin ?? null,
      permissions: (user.permissions ?? null) as Record<string, unknown> | null,
    }))
}

function catalogueRows(managers: readonly ProjectManagerRosterRow[]) {
  return managers.map((row) => ({
    id: row.id,
    email: row.email ?? '',
    firstName: row.firstName ?? '',
    lastName: row.lastName ?? '',
    isActive: row.isActive,
  }))
}

/** The catalogue row a candidate's pick is stored as: an active row on their email, else none. */
function catalogueRowForEmail(managers: readonly ProjectManagerRosterRow[], email: string): ProjectManagerRosterRow | undefined {
  const key = normalizeManagerEmail(email)
  if (!key) return undefined
  const rows = managers.filter((row) => normalizeManagerEmail(row.email) === key)
  return rows.find((row) => row.isActive !== false) || rows[0]
}

/** Options for the project and small-works manager picker (`jobManagerCandidates`), by name. */
export function projectManagerChoices(
  managers: readonly ProjectManagerRosterRow[],
  users: readonly ProjectManagerAccount[],
  organizationId?: string
): ProjectManagerChoice[] {
  return jobManagerCandidates(rosterRows(users, organizationId)).map((candidate) => {
    const row = catalogueRowForEmail(managers, candidate.email)
    return {
      id: row ? choiceIdForRoster(row.id) : `user:${candidate.id}`,
      label: candidate.name || candidate.email,
      email: candidate.email,
      userId: candidate.id,
      level: candidate.level,
      levelLabel: JOB_MANAGER_LEVEL_LABELS[candidate.level],
    }
  })
}

/** Catalogue rows of people who are job-manager candidates (task assignment uses the catalogue). */
export function assignableProjectManagers<T extends ProjectManagerRosterRow>(
  managers: readonly T[],
  users: readonly ProjectManagerAccount[],
  organizationId?: string
): T[] {
  const emails = new Set(
    jobManagerCandidates(rosterRows(users, organizationId)).map((candidate) => normalizeManagerEmail(candidate.email))
  )
  return managers.filter((row) => row.isActive !== false && emails.has(normalizeManagerEmail(row.email)))
}

/** Each stored manager as it reads now (`jobManagerAssignments`). */
export function projectManagerAssignments(
  project: { managerId?: string | null; managerIds?: readonly string[] | null },
  managers: readonly ProjectManagerRosterRow[],
  users: readonly ProjectManagerAccount[],
  organizationId?: string
): JobManagerAssignment[] {
  // Web `managerIdsMatch` also matches a UUID stored without dashes; hand the rulebook the row id it names.
  const original = new Map<string, string>()
  const known = [...managers.map((row) => row.id), ...users.map((row) => row.id)]
  const normalise = (id: string) => {
    const bare = clean(id)
    const match = known.find((rowId) => managerIdsMatch(rowId, bare) || managerIdsMatch(stableManagerDocumentId(rowId), bare))
    const next = match || bare
    if (!original.has(next)) original.set(next, id)
    return next
  }
  const ids = [...(project.managerIds || [])].map(normalise)
  const primary = project.managerId ? normalise(project.managerId) : null
  return jobManagerAssignments({ managerIds: ids, managerId: primary }, rosterRows(users, organizationId), catalogueRows(managers)).map(
    (row) => ({ ...row, storedId: original.get(row.storedId) ?? row.storedId })
  )
}

function choiceFor(assignment: JobManagerAssignment, choices: readonly ProjectManagerChoice[]): ProjectManagerChoice | undefined {
  const userId = assignment.candidate?.id
  return (
    choices.find((choice) => managerIdsMatch(choice.id, assignment.storedId)) ||
    (userId ? choices.find((choice) => choice.userId === userId) : undefined)
  )
}

/**
 * The picker's selected entries, in order, one per person: current managers as their choice, former managers with
 * `JOB_MANAGER_FORMER_NOTES` (shown so they can be removed, never silently), ids nobody loaded as "Not loaded".
 */
export function projectManagerSelectedEntries(
  selectedIds: readonly string[],
  managers: readonly ProjectManagerRosterRow[],
  users: readonly ProjectManagerAccount[],
  organizationId?: string
): ProjectManagerSelectedEntry[] {
  const choices = projectManagerChoices(managers, users, organizationId)
  const out: ProjectManagerSelectedEntry[] = []
  for (const assignment of projectManagerAssignments({ managerIds: selectedIds }, managers, users, organizationId)) {
    if (assignment.state === 'current') {
      const choice = choiceFor(assignment, choices)
      out.push({
        id: assignment.storedId,
        label: choice?.label || assignment.name,
        state: 'current',
        levelLabel: choice?.levelLabel ?? null,
        note: null,
      })
      continue
    }
    out.push({
      id: assignment.storedId,
      label: assignment.name || 'Unknown person',
      state: assignment.state,
      levelLabel: null,
      note: assignment.note,
    })
  }
  return out
}

/** Whether a choice is already picked (the same person under any id stored). */
export function projectManagerChoiceSelected(
  choice: ProjectManagerChoice,
  entries: readonly ProjectManagerSelectedEntry[],
  managers: readonly ProjectManagerRosterRow[],
  users: readonly ProjectManagerAccount[],
  organizationId?: string
): boolean {
  if (entries.some((entry) => managerIdsMatch(entry.id, choice.id))) return true
  const current = projectManagerAssignments({ managerIds: entries.map((entry) => entry.id) }, managers, users, organizationId)
  return current.some((row) => row.candidate?.id === choice.userId)
}

/**
 * Ids to save: each current manager as its choice id, ids not loaded kept (a save never drops an assignment it could
 * not read); former managers (no longer candidates) are left out — the picker shows them with a note first.
 */
export function projectManagerSelectionIds(
  project: { managerId?: string | null; managerIds?: readonly string[] | null },
  managers: readonly ProjectManagerRosterRow[],
  users: readonly ProjectManagerAccount[],
  organizationId?: string
): string[] {
  const choices = projectManagerChoices(managers, users, organizationId)
  const selected: string[] = []
  for (const assignment of projectManagerAssignments(project, managers, users, organizationId)) {
    if (assignment.state === 'former') continue
    const next = assignment.state === 'current' ? choiceFor(assignment, choices)?.id || assignment.storedId : assignment.storedId
    if (!selected.some((existing) => managerIdsMatch(existing, next))) selected.push(next)
  }
  return selected
}

/** The ids on the form without `id` and without any other id stored for the same person. */
export function projectManagerIdsWithout(
  selectedIds: readonly string[],
  id: string,
  managers: readonly ProjectManagerRosterRow[],
  users: readonly ProjectManagerAccount[],
  organizationId?: string
): string[] {
  const personOf = (value: string) =>
    projectManagerAssignments({ managerIds: [value] }, managers, users, organizationId)[0]?.candidate?.id ?? null
  const person = personOf(id)
  return selectedIds.filter((existing) => !managerIdsMatch(existing, id) && (!person || personOf(existing) !== person))
}
