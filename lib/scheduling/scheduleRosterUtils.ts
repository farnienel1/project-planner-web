import type { Operative, User } from '@/types'
import { getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import { isPendingPerson } from '@/lib/staff/pendingPeople'
import { getManagerUsers, isRoleOnlyPersonName, rosterDisplayName } from '@/lib/staff/userRosterUtils'

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
 * iOS ScheduleBookablePersonBuilder: one row per email.
 * Roster operatives come first (badge Admin/Manager/Operative from the linked user).
 * Manager/admin app users without a roster profile are appended once.
 */
export function buildSchedulablePeople(
  operatives: Operative[],
  users: User[]
): SchedulablePerson[] {
  const accepted = users.filter((user) => !isPendingPerson(user))
  const pendingEmails = new Set(
    users.filter((user) => isPendingPerson(user)).map((user) => emailKey(user.email)).filter(Boolean)
  )
  const usersByEmail = new Map<string, User>()
  for (const user of accepted) {
    const email = emailKey(user.email)
    if (email && !usersByEmail.has(email)) usersByEmail.set(email, user)
  }

  const seenEmails = new Set<string>()
  const people: SchedulablePerson[] = []

  for (const operative of getActiveOperativesForScheduling(operatives)) {
    const email = emailKey(operative.email)
    if (email && pendingEmails.has(email)) continue
    if (email && seenEmails.has(email)) continue
    const linked = email ? usersByEmail.get(email) : undefined
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

  for (const user of getManagerUsers(accepted).filter((row) => row.passwordSet && row.isActive)) {
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
