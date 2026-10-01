import type { User, UserPermissions } from '@/types'
import { UserRole } from '@/types'
import { dedupeUsersByEmail } from '@/lib/staff/userRosterUtils'

const EPOCH = new Date(0)

function permissions(kind: 'operative' | 'manager'): UserPermissions {
  const base: UserPermissions = {
    adminAccess: false,
    manager: kind === 'manager',
    operatives: kind === 'manager',
    skills: false,
    qualifications: kind === 'manager',
    materials: true,
    projects: true,
    smallWorks: true,
    operativeMode: kind === 'operative',
    siteAudit: true,
    subContractors: kind === 'manager',
    wholesalersOrderHistory: true,
    annualLeaveSelfBook: false,
    weeklyReports: false,
    dailyOverview: true,
  }
  return base
}

/** A managers/operatives roster row is enough to show the person when their user document was missed. */
export function userFromRosterRecord(input: {
  id: string
  organizationId: string
  firstName: string
  surname: string
  email: string
  phone?: string
  isActive?: boolean
  kind: 'operative' | 'manager'
}): User | null {
  const firstName = input.firstName.trim()
  const surname = input.surname.trim()
  const email = input.email.trim()
  if (!firstName && !surname && !email) return null
  return {
    id: input.id,
    email,
    firstName,
    surname,
    organizationId: input.organizationId,
    role: input.kind === 'operative' ? UserRole.OPERATIVE : UserRole.MANAGER,
    isActive: input.isActive !== false,
    passwordSet: true,
    isSuperAdmin: false,
    mobileNumber: input.phone?.trim() || undefined,
    permissions: permissions(input.kind),
    policyAccepted: true,
    createdAt: EPOCH,
    updatedAt: EPOCH,
  }
}

function emailKey(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * The organisation user query can come back as only the signed-in admin.
 * Keep everyone already on screen, and add anyone this load did find.
 * A person leaves only when `confirmedMissingIds` says their user document is gone.
 */
export function mergeRetainedRoster(
  previous: User[],
  incoming: User[],
  confirmedMissingIds: ReadonlySet<string> = new Set()
): User[] {
  const sameOrg = previous[0]?.organizationId
  const prior =
    sameOrg && incoming.some((user) => user.organizationId && user.organizationId !== sameOrg)
      ? previous.filter((user) => user.organizationId === incoming[0]?.organizationId)
      : previous
  if (incoming.length === 0 && prior.length > 0) return dedupeUsersByEmail(prior)

  const incomingIds = new Set(incoming.map((user) => user.id))
  const incomingEmails = new Set(incoming.map((user) => emailKey(user.email)).filter(Boolean))
  const kept = [...incoming]
  for (const user of prior) {
    if (confirmedMissingIds.has(user.id)) continue
    const email = emailKey(user.email)
    if (incomingIds.has(user.id) || (email && incomingEmails.has(email))) continue
    kept.push(user)
  }
  return dedupeUsersByEmail(kept)
}

/** An empty refresh must not wipe rows already loaded. The first load may still be empty. */
export function retainLoadedRows<T>(previous: readonly T[], next: readonly T[]): T[] {
  if (next.length === 0 && previous.length > 0) return [...previous]
  return [...next]
}

/**
 * Documents were still returned, but every one failed to parse.
 * That is not an empty company — keep the rows already on screen.
 */
export function retainParsedRows<T>(documentCount: number, previous: readonly T[], parsed: readonly T[]): T[] {
  if (documentCount > 0 && parsed.length === 0 && previous.length > 0) return [...previous]
  return [...parsed]
}

const removedIdsByScope = new Map<string, Set<string>>()

/** An in-app delete. A later empty refresh must not put this row back, and must not wipe the rest. */
export function markRowsRemoved(scope: string, ids: readonly string[]): void {
  if (!scope || ids.length === 0) return
  const set = removedIdsByScope.get(scope) ?? new Set<string>()
  for (const id of ids) {
    if (id) set.add(id)
  }
  removedIdsByScope.set(scope, set)
}

export function retainScopedRows<T extends { id: string }>(
  scope: string,
  previous: readonly T[],
  next: readonly T[]
): T[] {
  const gone = removedIdsByScope.get(scope)
  const withoutRemoved = (rows: readonly T[]) =>
    gone && gone.size > 0 ? rows.filter((row) => !gone.has(row.id)) : [...rows]
  return retainLoadedRows(withoutRemoved(previous), withoutRemoved(next))
}

/** A managers or operatives record means that person belongs on that list, even if their user document lost the flag. */
export function withRosterMembership(user: User, kind: 'operative' | 'manager'): User {
  if (kind === 'operative' && user.permissions.operativeMode) return user
  if (kind === 'manager' && user.permissions.manager && !user.permissions.operativeMode) return user
  return {
    ...user,
    permissions: {
      ...user.permissions,
      operativeMode: kind === 'operative' ? true : user.permissions.operativeMode,
      manager: kind === 'manager' ? true : user.permissions.manager,
      operatives: kind === 'manager' ? true : user.permissions.operatives,
      qualifications: kind === 'manager' ? true : user.permissions.qualifications,
    },
  }
}
