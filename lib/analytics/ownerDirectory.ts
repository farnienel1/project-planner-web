import { parseAppUserDocument, defaultUserPermissions } from '@/lib/ios-parity/converters'
import { asDate } from '@/lib/ios-parity/firestoreCodec'
import { isPlatformOwnerSentinelOrg } from '@/lib/platform/owner'
import { UserRole, type User } from '@/types'
import type { PlatformOrganisation } from '@/lib/analytics/analyticsTypes'

export function readOrganizationId(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''
    const match = trimmed.match(/(?:^|\/)organizations\/([^/]+)\/?$/i)
    return match ? match[1] : trimmed
  }
  if (value && typeof value === 'object') {
    const rec = value as { id?: unknown; path?: unknown }
    if (typeof rec.path === 'string' && rec.path.trim()) return readOrganizationId(rec.path)
    if (typeof rec.id === 'string' && rec.id.trim()) return rec.id.trim()
  }
  return ''
}

export function parseOwnerConsoleUser(id: string, data: Record<string, unknown>): User | null {
  const organizationId = readOrganizationId(data.organizationId)
  if (organizationId && isPlatformOwnerSentinelOrg(organizationId)) return null
  const normalized = organizationId ? { ...data, organizationId } : data
  const parsed = parseAppUserDocument(id, normalized)
  if (parsed.ok) {
    if (isPlatformOwnerSentinelOrg(parsed.value.organizationId)) return null
    return parsed.value
  }
  if (!organizationId) return null
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
  const firstName = typeof data.firstName === 'string' ? data.firstName : ''
  const surname = typeof data.surname === 'string' ? data.surname : typeof data.lastName === 'string' ? data.lastName : ''
  const roleRaw = typeof data.role === 'string' ? data.role : ''
  const role =
    roleRaw === UserRole.ADMIN || roleRaw === 'admin'
      ? UserRole.ADMIN
      : roleRaw === UserRole.MANAGER || roleRaw === 'manager'
        ? UserRole.MANAGER
        : roleRaw === UserRole.OPERATIVE || roleRaw === 'operative'
          ? UserRole.OPERATIVE
          : UserRole.MANAGER
  return {
    id,
    email: email || `${id}@unknown.user`,
    firstName: firstName || 'User',
    surname,
    organizationId,
    role,
    isActive: data.isActive !== false,
    passwordSet: data.passwordSet === true,
    isSuperAdmin: data.isSuperAdmin === true,
    permissions: defaultUserPermissions(data.operativeMode === true),
    lastSeenAt: asDate(data.lastSeenAt),
    createdAt: asDate(data.createdAt) || new Date(0),
    updatedAt: asDate(data.updatedAt) || asDate(data.lastSeenAt) || asDate(data.createdAt) || new Date(0),
    policyAccepted: data.policyAccepted === true,
  }
}

export function parseOwnerConsoleOrganisation(id: string, data: Record<string, unknown>): PlatformOrganisation | null {
  if (!id || isPlatformOwnerSentinelOrg(id)) return null
  const members = data.members && typeof data.members === 'object' ? (data.members as Record<string, unknown>) : {}
  const name =
    (typeof data.name === 'string' && data.name.trim()) ||
    (typeof data.companyName === 'string' && data.companyName.trim()) ||
    (typeof data.organisationName === 'string' && data.organisationName.trim()) ||
    ''
  return {
    id,
    name: name || 'Unnamed organisation',
    memberCount: Object.keys(members).length,
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
  }
}

export function mergeOrganisationsFromUsers(
  organisations: PlatformOrganisation[],
  users: Pick<User, 'organizationId'>[]
): PlatformOrganisation[] {
  const map = new Map<string, PlatformOrganisation>()
  for (const org of organisations) {
    if (!org.id || isPlatformOwnerSentinelOrg(org.id)) continue
    map.set(org.id, { ...org })
  }
  const counts = new Map<string, number>()
  for (const user of users) {
    const id = (user.organizationId || '').trim()
    if (!id || isPlatformOwnerSentinelOrg(id)) continue
    counts.set(id, (counts.get(id) || 0) + 1)
    if (!map.has(id)) {
      map.set(id, { id, name: 'Unknown organisation', memberCount: 0 })
    }
  }
  return [...map.values()]
    .map((org) => ({ ...org, memberCount: counts.get(org.id) || org.memberCount }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

export function isPermissionDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '')
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : ''
  return /permission|insufficient/i.test(message) || code === 'permission-denied'
}

export function ownerPersonName(user: { firstName?: string; surname?: string; email?: string }): string {
  return `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email || 'Unknown user'
}

export function ownerRoleLabel(role?: string): string {
  const value = (role || '').toLowerCase()
  if (value === 'admin') return 'Admin'
  if (value === 'manager') return 'Manager'
  if (value === 'operative') return 'Operative'
  if (value === 'viewer') return 'Viewer'
  return role?.trim() || 'User'
}

export function matchesOwnerSearch(parts: Array<string | undefined>, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return parts.some((part) => (part || '').toLowerCase().includes(needle))
}

export function formatOwnerWhen(date?: Date, empty = 'No activity recorded yet'): string {
  if (!date || date.getTime() === 0) return empty
  return date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}
