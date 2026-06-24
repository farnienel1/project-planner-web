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

export function buildSchedulablePeople(
  operatives: Operative[],
  users: User[]
): SchedulablePerson[] {
  const activeOps = getActiveOperativesForScheduling(operatives)
  const managers = getManagerUsers(users).filter((u) => u.passwordSet && u.isActive)

  const operativePeople: SchedulablePerson[] = activeOps.map((op) => ({
    id: op.id,
    kind: 'operative',
    name: `${op.firstName} ${op.lastName}`.trim(),
    email: op.email,
    badge: 'Operative',
  }))

  const managerPeople: SchedulablePerson[] = managers.map((user) => ({
    id: user.id,
    kind: 'manager',
    name: `${user.firstName} ${user.surname}`.trim(),
    email: user.email,
    badge: user.permissions.adminAccess || user.isSuperAdmin ? 'Admin' : 'Manager',
  }))

  return [...operativePeople, ...managerPeople].sort((a, b) => a.name.localeCompare(b.name))
}

export function filterSchedulablePeople(
  people: SchedulablePerson[],
  search: string,
  kindFilter: 'all' | SchedulablePersonKind
): SchedulablePerson[] {
  let list = people
  if (kindFilter !== 'all') {
    list = list.filter((p) => p.kind === kindFilter)
  }
  const q = search.trim().toLowerCase()
  if (!q) return list
  return list.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.badge.toLowerCase().includes(q)
  )
}
