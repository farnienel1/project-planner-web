import type { User } from '@/types'

export type RosterSegment = 'active' | 'inactive' | 'pending'

export type OperativeFilterField = 'firstName' | 'surname' | 'email'
export type ManagerFilterField = 'firstName' | 'surname' | 'email' | 'mobileNumber'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** iOS UserRosterSegment.matches */
export function matchesRosterSegment(user: User, segment: RosterSegment): boolean {
  switch (segment) {
    case 'active':
      return user.passwordSet && user.isActive
    case 'inactive':
      return user.passwordSet && !user.isActive
    case 'pending':
      return !user.passwordSet
  }
}

export function rosterStatusLabel(user: User): 'Active' | 'Inactive' | 'Pending' {
  if (!user.passwordSet) return 'Pending'
  if (!user.isActive) return 'Inactive'
  return 'Active'
}

function choosePreferredUser(a: User, b: User): User {
  if (a.passwordSet !== b.passwordSet) return a.passwordSet ? a : b
  if (a.isActive !== b.isActive) return a.isActive ? a : b
  return a.updatedAt >= b.updatedAt ? a : b
}

/** Deduplicate by email — keeps the best account when duplicates exist in Firebase. */
export function dedupeUsersByEmail(users: User[]): User[] {
  const byEmail = new Map<string, User>()
  for (const user of users) {
    const email = normalizeEmail(user.email)
    if (!email) continue
    const existing = byEmail.get(email)
    byEmail.set(email, existing ? choosePreferredUser(existing, user) : user)
  }
  return Array.from(byEmail.values())
}

/** iOS OperativesView — operative-mode app users. */
export function getOperativeModeUsers(users: User[]): User[] {
  return dedupeUsersByEmail(users.filter((user) => user.permissions?.operativeMode)).sort((a, b) =>
    `${a.firstName} ${a.surname}`.localeCompare(`${b.firstName} ${b.surname}`, undefined, {
      sensitivity: 'base',
    })
  )
}

/** Admins and managers (not operative-mode) — used by pickers / scheduling. */
export function getManagerUsers(users: User[]): User[] {
  return dedupeUsersByEmail(
    users.filter((user) => {
      if (user.permissions?.operativeMode) return false
      return user.permissions?.adminAccess || user.isSuperAdmin || user.permissions?.manager
    })
  ).sort((a, b) =>
    `${a.firstName} ${a.surname}`.localeCompare(`${b.firstName} ${b.surname}`, undefined, {
      sensitivity: 'base',
    })
  )
}

/** iOS ManagersView — manager users, excluding admins / super-admins / operative-mode. */
export function getManagersRosterUsers(users: User[]): User[] {
  return dedupeUsersByEmail(
    users.filter((user) => {
      const p = user.permissions
      if (!p) return false
      if (p.operativeMode) return false
      if (p.adminAccess || user.isSuperAdmin) return false
      return p.manager === true
    })
  ).sort((a, b) =>
    `${a.firstName} ${a.surname}`.localeCompare(`${b.firstName} ${b.surname}`, undefined, {
      sensitivity: 'base',
    })
  )
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
