import type { Operative, User } from '@/types'
import { getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import { isPendingPerson } from '@/lib/staff/pendingPeople'
import {
  getManagerUsers,
  getOperativeModeUsers,
  isCurrentLabourNamedPerson,
  isCurrentLabourUser,
  isRoleOnlyPersonName,
  rosterDisplayName,
} from '@/lib/staff/userRosterUtils'

export type SchedulablePersonKind = 'operative' | 'manager'

export type SchedulablePerson = {
  id: string
  kind: SchedulablePersonKind
  name: string
  email: string
  badge: string
}

function emailKey(value: string | undefined): string {
  return (value || '').trim().toLowerCase()
}

function roleBadge(user: User | undefined): string {
  if (!user) return 'Operative'
  if (user.permissions.adminAccess || user.isSuperAdmin) return 'Admin'
  if (user.permissions.manager) return 'Manager'
  return 'Operative'
}

/**
 * Operatives-list user documents (`getOperativeModeUsers`) that can be booked:
 * a current person (never an anonymised Deleted user) who is active. `passwordSet`
 * is not required — a pending invite is a real person on the Operatives list, and
 * Add User does not write `operativeProfiles` (`inviteWritesOperativeProfile` is false).
 */
function schedulableOperativeListUsers(users: User[]): User[] {
  return getOperativeModeUsers(users).filter((user) => isCurrentLabourUser(user) && user.isActive)
}

/**
 * iOS ScheduleBookablePersonBuilder: one row per email.
 * Roster operatives come first (badge Admin/Manager/Operative from the linked user).
 * Operatives-list user documents with no operative record sharing that email follow,
 * including a pending invite (`passwordSet` false). Their bookings use the user document id,
 * the same host id `operativeRecordForUser` uses when no catalogue row exists.
 * Manager/admin app users without a roster profile are appended once.
 */
export function buildSchedulablePeople(
  operatives: Operative[],
  users: User[]
): SchedulablePerson[] {
  const accepted = users.filter((user) => !isPendingPerson(user))
  const operativeListUsers = schedulableOperativeListUsers(users)
  const operativeListIds = new Set(operativeListUsers.map((user) => user.id))
  // A pending manager/admin invite is still not schedulable. A pending operative-list user is.
  const pendingEmails = new Set(
    users
      .filter((user) => isPendingPerson(user) && !operativeListIds.has(user.id))
      .map((user) => emailKey(user.email))
      .filter(Boolean)
  )
  const usersByEmail = new Map<string, User>()
  for (const user of accepted) {
    const email = emailKey(user.email)
    if (email && !usersByEmail.has(email)) usersByEmail.set(email, user)
  }

  const seenEmails = new Set<string>()
  const people: SchedulablePerson[] = []

  for (const operative of getActiveOperativesForScheduling(operatives)) {
    if (!isCurrentLabourNamedPerson(operative)) continue
    const email = emailKey(operative.email)
    if (email && pendingEmails.has(email)) continue
    if (email && seenEmails.has(email)) continue
    const linked = email ? usersByEmail.get(email) : undefined
    // iOS ScheduleBookablePersonBuilder keeps an active operative who has no login.
    // A manager catalogue row with no account is excluded by the manager picker, not here.
    const name = rosterDisplayName({
      firstName: operative.firstName,
      surname: operative.lastName,
      email: operative.email,
    })
    if (!name) continue
    if (email) seenEmails.add(email)
    people.push({
      id: operative.id,
      kind: 'operative',
      name,
      email: operative.email,
      badge: roleBadge(linked),
    })
  }

  for (const user of operativeListUsers) {
    const email = emailKey(user.email)
    if (email && seenEmails.has(email)) continue
    const name = rosterDisplayName(user)
    if (!name || isRoleOnlyPersonName(name)) continue
    if (email) seenEmails.add(email)
    people.push({
      id: user.id,
      kind: 'operative',
      name,
      email: user.email,
      badge: roleBadge(user),
    })
  }

  for (const user of getManagerUsers(accepted).filter((row) => isCurrentLabourUser(row) && row.passwordSet && row.isActive)) {
    const email = emailKey(user.email)
    if (email && seenEmails.has(email)) continue
    if (email) seenEmails.add(email)
    const name = rosterDisplayName(user)
    if (!name || isRoleOnlyPersonName(name)) continue
    people.push({
      id: user.id,
      kind: 'manager',
      name,
      email: user.email,
      badge: roleBadge(user),
    })
  }

  return people.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export function filterSchedulablePeople(
  people: SchedulablePerson[],
  search: string,
  kindFilter: 'all' | SchedulablePersonKind
): SchedulablePerson[] {
  let list = people
  if (kindFilter === 'operative') {
    list = list.filter((person) => person.badge === 'Operative')
  } else if (kindFilter === 'manager') {
    list = list.filter((person) => person.badge === 'Manager' || person.badge === 'Admin')
  }
  const q = search.trim().toLowerCase()
  if (!q) return list
  return list.filter(
    (person) =>
      person.name.toLowerCase().includes(q) ||
      person.email.toLowerCase().includes(q) ||
      person.badge.toLowerCase().includes(q)
  )
}
