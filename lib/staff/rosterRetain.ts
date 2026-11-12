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

function textField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * A user document the organisation query missed can still belong to this company.
 * Fill a missing organisation id so the document can be read.
 * Do not relabel a document that already names a different organisation.
 */
export function rosterParseRecord(
  data: Record<string, unknown>,
  organizationId: string,
  options?: { allowNamedOrg?: boolean }
): Record<string, unknown> | null {
  const named =
    textField(data.organizationId) || textField(data.organisationId) || textField(data.orgId)
  if (named && named !== organizationId && !options?.allowNamedOrg) return null
  if (!named) return { ...data, organizationId }
  if (named === organizationId && data.organizationId !== organizationId) {
    return { ...data, organizationId }
  }
  return data
}

/**
 * organizationId on the user document is the company they last opened.
 * Write it only when it is missing and this organisation's members map lists them.
 */
export function missingOrganizationIdPatch(
  data: Record<string, unknown>,
  organizationId: string,
  onMembersMap: boolean
): { organizationId: string } | null {
  if (!onMembersMap || !organizationId) return null
  const named = textField(data.organizationId) || textField(data.organisationId) || textField(data.orgId)
  if (named) return null
  return { organizationId }
}

/**
 * The organisation user query can come back as only the signed-in admin.
 * Keep everyone already on screen, and add anyone this load did find.
 * A different organizationId is not a missing person.
 * A person leaves only when `confirmedMissingIds` says their user document is gone.
 */
export function mergeRetainedRoster(
  previous: User[],
  incoming: User[],
  confirmedMissingIds: ReadonlySet<string> = new Set()
): User[] {
  if (incoming.length === 0 && previous.length > 0) return dedupeUsersByEmail(previous)

  const incomingIds = new Set(incoming.map((user) => user.id))
  const incomingEmails = new Set(incoming.map((user) => emailKey(user.email)).filter(Boolean))
  const kept = [...incoming]
  for (const user of previous) {
    if (confirmedMissingIds.has(user.id)) continue
    const email = emailKey(user.email)
    if (incomingIds.has(user.id) || (email && incomingEmails.has(email))) continue
    kept.push(user)
  }
  return dedupeUsersByEmail(kept)
}

/** How a snapshot was read: `authoritative` is a server answer (not the local cache, not a partial read). */
export type RetainOptions = { authoritative?: boolean } | null | undefined

/**
 * An empty cache or partial refresh must not wipe rows already loaded. The first load may still be empty.
 * A server (non-cache) snapshot is authoritative: rows missing from it are gone — deleted or moved elsewhere —
 * and are removed, even when that empties the list.
 */
export function retainLoadedRows<T>(previous: readonly T[], next: readonly T[], options?: RetainOptions): T[] {
  if (options?.authoritative) return [...next]
  if (next.length === 0 && previous.length > 0) return [...previous]
  // Rulebook 1.38.0 §27 (data-parity fixture, step "cache-partial"): a snapshot known to come from the local cache
  // (`authoritative: false`) that is shorter than the list on screen only adds and updates rows — it never drops
  // one, as iOS `LiveSnapshotMerge.apply` does. Only a server snapshot removes a row. A caller that does not say
  // where the rows came from (`options` missing) keeps the older behaviour.
  if (options && options.authoritative === false && next.length < previous.length) {
    return mergeById(previous, next)
  }
  return [...next]
}

function rowId(row: unknown): string | null {
  if (row && typeof row === 'object' && typeof (row as { id?: unknown }).id === 'string') return (row as { id: string }).id
  return null
}

/** `previous` in order with each row replaced by its `next` copy, then the rows only `next` has. */
function mergeById<T>(previous: readonly T[], next: readonly T[]): T[] {
  const incoming = new Map<string, T>()
  for (const row of next) {
    const id = rowId(row)
    if (id === null) return [...next]
    incoming.set(id, row)
  }
  const out: T[] = []
  const seen = new Set<string>()
  for (const row of previous) {
    const id = rowId(row)
    if (id === null) return [...next]
    if (seen.has(id)) continue
    seen.add(id)
    out.push(incoming.get(id) ?? row)
  }
  for (const row of next) {
    const id = rowId(row) as string
    if (seen.has(id)) continue
    seen.add(id)
    out.push(row)
  }
  return out
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
  next: readonly T[],
  options?: RetainOptions
): T[] {
  const gone = removedIdsByScope.get(scope)
  const withoutRemoved = (rows: readonly T[]) =>
    gone && gone.size > 0 ? rows.filter((row) => !gone.has(row.id)) : [...rows]
  return retainLoadedRows(withoutRemoved(previous), withoutRemoved(next), options)
}

