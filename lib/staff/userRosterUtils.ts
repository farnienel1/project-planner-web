import type { User } from '@/types'
import {
  isAnonymisedDeletedProfile,
  listedRosterUsers,
  matchesRosterSegment as canonicalMatchesRosterSegment,
  rosterPeople,
  rosterStatusLabel as canonicalRosterStatusLabel,
  rosterListFor,
  type RosterDocument,
  type RosterListKind,
  type RosterListRow,
  type RosterSegment,
  type RosterSegmentProfile,
} from '@/lib/canonical'
import { isPendingPerson } from '@/lib/staff/pendingPeople'

export type { RosterSegment }

export type OperativeFilterField = 'firstName' | 'surname' | 'email'
export type ManagerFilterField = 'firstName' | 'surname' | 'email' | 'mobileNumber'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function rosterProfile(user: User): RosterSegmentProfile {
  return {
    email: user.email,
    firstName: user.firstName,
    surname: user.surname,
    passwordSet: user.passwordSet,
    isActive: user.isActive,
    mobileNumber: user.mobileNumber,
    ghost: user.ghost === true,
  }
}

/** Canonical UserRosterSegment.matches — do not keep a second passwordSet calculator. */
export function matchesRosterSegment(user: User, segment: RosterSegment): boolean {
  return canonicalMatchesRosterSegment(rosterProfile(user), segment)
}

/** Current warnings / Daily Overview / scheduling pickers. People lists still show Inactive. */
export function isCurrentLabourUser(user: User): boolean {
  return !isAnonymisedDeletedProfile(rosterProfile(user))
}

export function isCurrentLabourNamedPerson(person: {
  email?: string | null
  firstName?: string | null
  surname?: string | null
  lastName?: string | null
  name?: string | null
  displayName?: string | null
}): boolean {
  return !isAnonymisedDeletedProfile({
    email: person.email,
    firstName: person.firstName,
    surname: person.surname || person.lastName,
    name: person.name,
    displayName: person.displayName,
  })
}

export function rosterStatusLabel(user: User): 'Active' | 'Inactive' | 'Pending' {
  return canonicalRosterStatusLabel(rosterProfile(user))
}

export function listedUsersForRoster(
  users: readonly User[],
  claimedEmails?: readonly string[] | null
): User[] {
  return listedRosterUsers(users, claimedEmails)
}

function listedDedupe(users: readonly User[], claimedEmails?: readonly string[] | null): User[] {
  return listedRosterUsers(dedupeUsersByEmail(users), claimedEmails)
}

function directoryAdmin(user: User): boolean {
  return user.isSuperAdmin === true || user.permissions?.adminAccess === true || user.role === 'admin'
}

function rosterDocument(user: User): RosterDocument {
  return {
    id: user.id,
    email: user.email,
    passwordSet: user.passwordSet,
    isActive: user.isActive,
    firstName: user.firstName,
    surname: user.surname,
    admin: directoryAdmin(user),
    listed: Boolean(directoryAdmin(user) || user.permissions?.manager || user.permissions?.operativeMode),
    updatedAtMs: user.updatedAt instanceof Date ? user.updatedAt.getTime() : null,
    formerUserIds: user.formerUserIds ?? [],
  }
}

/** The rulebook's `rosterPeople` over these profiles: which id each email keeps, and every folded id. */
function foldedRoster(users: readonly User[]) {
  return rosterPeople(users.map(rosterDocument))
}

/**
 * Every user id that shares an email points at the account dedupe keeps.
 * A manager booking stored on the other profile must not become a person named "Manager".
 */
export function aliasIdsForRoster(users: readonly User[]): Record<string, string> {
  const { userIdAliases } = foldedRoster(users)
  const aliases: Record<string, string> = {}
  for (const user of users) aliases[user.id] = userIdAliases[user.id] || user.id
  return aliases
}

export function findUserByAnyId(
  users: readonly User[],
  userId: string,
  aliases?: Record<string, string>
): User | undefined {
  const needle = userId.trim()
  if (!needle) return undefined
  const direct = users.find((user) => user.id === needle || user.id.toLowerCase() === needle.toLowerCase())
  if (direct) return direct
  const keptId =
    aliases?.[needle] ||
    aliases?.[needle.toLowerCase()] ||
    Object.entries(aliases || {}).find(([alias]) => alias.toLowerCase() === needle.toLowerCase())?.[1]
  if (!keptId || keptId === needle) return undefined
  return users.find((user) => user.id === keptId || user.id.toLowerCase() === keptId.toLowerCase())
}

/** A label that is only a role is not a person's name. */
export function isRoleOnlyPersonName(value: string): boolean {
  return /^(manager|admin|operative|user)$/i.test(value.trim())
}

/** Every profile id that is the same person as `userId`, including the other document that shares the email. */
export function samePersonIds(
  userId: string,
  users: readonly User[],
  aliases?: Record<string, string>
): Set<string> {
  const ids = new Set<string>()
  if (userId.trim()) ids.add(userId.trim())
  const user = findUserByAnyId(users, userId, aliases)
  const email = normalizeEmail(user?.email || '')
  if (email) {
    for (const row of users) {
      if (normalizeEmail(row.email) === email) ids.add(row.id)
    }
  }
  for (const [alias, kept] of Object.entries(aliases || {})) {
    if (ids.has(alias) || ids.has(kept)) {
      ids.add(alias)
      ids.add(kept)
    }
  }
  return ids
}

/** Name for a roster row. A bare role word is not used in place of a missing name. */
export function rosterDisplayName(
  user: Pick<User, 'firstName' | 'surname' | 'email'> | null | undefined
): string {
  if (!user) return ''
  const name = `${user.firstName || ''} ${user.surname || ''}`.trim()
  if (name && !isRoleOnlyPersonName(name)) return name
  const email = (user.email || '').trim()
  if (email && !isRoleOnlyPersonName(email)) return email
  return ''
}

/**
 * One profile per email: the rulebook's `rosterPeople` chooses which document is kept (signed in, listed,
 * named, active, then newest). The kept profile is returned unchanged; its folded ids are in `aliasIdsForRoster`.
 */
export function dedupeUsersByEmail(users: readonly User[]): User[] {
  const byId = new Map<string, User>()
  for (const user of users) if (!byId.has(user.id)) byId.set(user.id, user)
  return foldedRoster(users).people.flatMap((row) => {
    const user = byId.get(row.id)
    return user ? [user] : []
  })
}

/** The rulebook's `RosterListRow` for a web `User` (rulebook 1.23.0 §11, `rosterListFor`). */
function rosterListRow(user: User): RosterListRow & { user: User } {
  return {
    ...rosterProfile(user),
    id: user.id,
    role: user.role ?? null,
    isSuperAdmin: user.isSuperAdmin ?? null,
    permissions: (user.permissions ?? null) as unknown as Record<string, unknown> | null,
    updatedAtMs: user.updatedAt instanceof Date ? user.updatedAt.getTime() : null,
    formerUserIds: user.formerUserIds ?? [],
    user,
  }
}

/** Rulebook 1.23.0 §11 `rosterListFor`: the people on the Operatives, Managers or Admins list, one per email, by name. */
export function usersOnRosterList(
  kind: RosterListKind,
  users: readonly User[],
  claimedEmails?: readonly string[] | null
): User[] {
  return rosterListFor(kind, users.map(rosterListRow), claimedEmails).map((row) => row.user)
}

/** Operatives list (rulebook 1.23.0 §11): the operative level (`rosterListFor('operatives', …)`). */
export function getOperativeModeUsers(
  users: User[],
  claimedEmails?: readonly string[] | null
): User[] {
  return usersOnRosterList('operatives', users, claimedEmails)
}

/** Admins and managers for job View access — admins stay in Managers even if they also have operative mode. */
export function getVisibilityManagerUsers(
  users: User[],
  claimedEmails?: readonly string[] | null
): User[] {
  return listedDedupe(
    users.filter((user) => user.permissions?.adminAccess || user.isSuperAdmin || user.permissions?.manager),
    claimedEmails
  ).sort((a, b) =>
    `${a.firstName} ${a.surname}`.localeCompare(`${b.firstName} ${b.surname}`, undefined, {
      sensitivity: 'base',
    })
  )
}

/** Everyone who is not in the Managers tab — so View lists the whole organisation. */
export function getVisibilityOperativeUsers(
  users: User[],
  claimedEmails?: readonly string[] | null
): User[] {
  const managerIds = new Set(getVisibilityManagerUsers(users, claimedEmails).map((user) => user.id))
  return listedDedupe(
    users.filter((user) => !managerIds.has(user.id)),
    claimedEmails
  ).sort((a, b) =>
    `${a.firstName} ${a.surname}`.localeCompare(`${b.firstName} ${b.surname}`, undefined, {
      sensitivity: 'base',
    })
  )
}

/** Admins and managers (not operative-mode) — used by pickers / scheduling. */
export function getManagerUsers(
  users: User[],
  claimedEmails?: readonly string[] | null
): User[] {
  return listedDedupe(
    users.filter((user) => {
      if (user.permissions?.operativeMode) return false
      return user.permissions?.adminAccess || user.isSuperAdmin || user.permissions?.manager
    }),
    claimedEmails
  ).sort((a, b) =>
    `${a.firstName} ${a.surname}`.localeCompare(`${b.firstName} ${b.surname}`, undefined, {
      sensitivity: 'base',
    })
  )
}

/**
 * Managers list (rulebook 1.23.0 §11): the manager level (`rosterListFor('managers', …)`) — the manager flag, the
 * manager role, or no level flag at all; never an admin (by flag or role) or an operative.
 */
export function getManagersRosterUsers(
  users: User[],
  claimedEmails?: readonly string[] | null
): User[] {
  return usersOnRosterList('managers', users, claimedEmails)
}

/** iOS OperativesView live search — token match on first / surname / full / email / phone. */
export function filterRosterByNameQuery(
  users: User[],
  search: string,
  extraPhone?: Record<string, string>
): User[] {
  const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return users
  return users.filter((user) => {
    const phone = extraPhone?.[user.id] || user.mobileNumber || ''
    const hay = [
      user.firstName,
      user.surname,
      `${user.firstName} ${user.surname}`,
      user.email,
      phone,
    ]
      .join(' ')
      .toLowerCase()
    return tokens.every((token) => hay.includes(token))
  })
}

export function filterUsersBySearch<T extends OperativeFilterField | ManagerFilterField>(
  users: User[],
  search: string,
  field: T,
  mobileNumbers?: Record<string, string>
): User[] {
  const q = search.trim().toLowerCase()
  if (!q) return users

  return users.filter((user) => {
    switch (field) {
      case 'firstName':
        return user.firstName.toLowerCase().includes(q)
      case 'surname':
        return user.surname.toLowerCase().includes(q)
      case 'email':
        return user.email.toLowerCase().includes(q)
      case 'mobileNumber': {
        const mobile = mobileNumbers?.[user.id] || user.mobileNumber || ''
        return mobile.toLowerCase().includes(q)
      }
      default:
        return true
    }
  })
}

export function emptyRosterTitle(
  segment: RosterSegment,
  kind: 'operatives' | 'managers',
  hasAny: boolean
): string {
  if (!hasAny) {
    return kind === 'operatives' ? 'No Operatives Added Yet' : 'No managers added yet'
  }
  switch (segment) {
    case 'active':
      return kind === 'operatives' ? 'No Active Operatives' : 'No Active Managers'
    case 'inactive':
      return kind === 'operatives' ? 'No Inactive Operatives' : 'No Inactive Managers'
    case 'pending':
      return kind === 'operatives' ? 'No Pending Operatives' : 'No Pending Managers'
  }
}
