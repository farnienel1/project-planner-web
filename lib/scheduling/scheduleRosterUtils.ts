import type { Operative, User } from '@/types'
import { getActiveOperativesForScheduling } from '@/lib/operatives/operativeRosterUtils'
import { getManagerUsers } from '@/lib/staff/userRosterUtils'

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
  const usersByEmail = new Map<string, User>()
  for (const user of users) {
    const email = emailKey(user.email)
    if (email && !usersByEmail.has(email)) usersByEmail.set(email, user)
  }

  const seenEmails = new Set<string>()
  const people: SchedulablePerson[] = []

  for (const operative of getActiveOperativesForScheduling(operatives)) {
    const email = emailKey(operative.email)
    if (email) {
      if (seenEmails.has(email)) continue
      seenEmails.add(email)
    }
    const linked = email ? usersByEmail.get(email) : undefined
    people.push({
      id: operative.id,
      kind: 'operative',
      name: `${operative.firstName} ${operative.lastName}`.trim() || operative.email,
      email: operative.email,
      badge: roleBadge(linked),
    })
  }

  for (const user of getManagerUsers(users).filter((row) => row.passwordSet && row.isActive)) {
    const email = emailKey(user.email)
    if (email && seenEmails.has(email)) continue
    if (email) seenEmails.add(email)
    people.push({
      id: user.id,
      kind: 'manager',
      name: `${user.firstName} ${user.surname}`.trim() || user.email,
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
