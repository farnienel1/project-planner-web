/**
 * `users/{uid}/orgMemberships/{orgId}` — one shape for every platform (rulebook §14, 1.10.0).
 *
 * Before 1.10.0 web stored the role flags nested (`permissions.{key}`) and iOS merged a flat copy of the whole users
 * document on every organisation switch (hard-coding `skills: false` and forcing `materials` / `siteAudit` on), so a
 * flag from one company could land on another company's membership, and the security rules let a person rewrite
 * their own membership, role and permissions included.
 *
 * `parseOrgMembershipDocument` reads both shapes; `orgMembershipWriteFields` writes the nested one only, as a partial
 * update, and only an admin of that organisation writes role, permissions, super admin or the active flag. Pure.
 */

export const ORG_MEMBERSHIP_PERMISSION_KEYS = [
  'adminAccess',
  'manager',
  'operatives',
  'skills',
  'qualifications',
  'materials',
  'projects',
  'smallWorks',
  'operativeMode',
  'siteAudit',
  'subContractors',
  'wholesalersOrderHistory',
  'annualLeaveSelfBook',
  'weeklyReports',
  'dailyOverview',
] as const
export type OrgMembershipPermissionKey = (typeof ORG_MEMBERSHIP_PERMISSION_KEYS)[number]

/** Flags that are on when nothing is stored (the web `permissionsFromRecord` defaults). */
export const ORG_MEMBERSHIP_DEFAULT_ON: ReadonlyArray<OrgMembershipPermissionKey> = [
  'materials',
  'siteAudit',
  'wholesalersOrderHistory',
  'dailyOverview',
]

/** Fields only an admin of the organisation writes (the rules refuse a self write that changes them). */
export const ORG_MEMBERSHIP_ADMIN_FIELDS = ['role', 'isSuperAdmin', 'accountActive', 'isActive', 'permissions', ...ORG_MEMBERSHIP_PERMISSION_KEYS] as const

/** Fields the person writes on their own membership: accepting (`status` active, `acceptedAt`). */
export const ORG_MEMBERSHIP_SELF_FIELDS = ['status', 'acceptedAt', 'updatedAt', 'updatedBy', 'updatedFrom'] as const

export type OrgMembershipStatus = 'active' | 'pending'

export type OrgMembershipDocument = {
  organizationId: string
  role: string
  status: OrgMembershipStatus
  isSuperAdmin: boolean
  /** `accountActive`, else `isActive`; missing is active. */
  accountActive: boolean
  permissions: Record<OrgMembershipPermissionKey, boolean>
  invitedBy: string | null
  invitedAtMs: number | null
  acceptedAtMs: number | null
  updatedAtMs: number | null
  /** True when any flag was read from the legacy flat (top-level) shape. */
  hasLegacyFlatFlags: boolean
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function bool(value: unknown): boolean | null {
  if (value === true || value === 1) return true
  if (value === false || value === 0) return false
  return null
}

function instantMs(raw: unknown): number | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw.getTime()
  if (typeof raw === 'string') {
    const ms = Date.parse(raw)
    return Number.isNaN(ms) ? null : ms
  }
  if (typeof raw === 'object') {
    const row = raw as Record<string, unknown>
    if (typeof (row as { toMillis?: unknown }).toMillis === 'function') {
      const ms = (row as { toMillis: () => number }).toMillis()
      return Number.isFinite(ms) ? ms : null
    }
    const seconds = Number(row.seconds ?? row._seconds)
    if (!Number.isFinite(seconds)) return null
    const nanos = Number(row.nanoseconds ?? row._nanoseconds ?? 0)
    return seconds * 1000 + Math.floor((Number.isFinite(nanos) ? nanos : 0) / 1e6)
  }
  return null
}

/**
 * Reads a membership document. A flag is the nested `permissions.{key}` when it is a boolean there, else the flat
 * top-level key (older iOS), else its default (`ORG_MEMBERSHIP_DEFAULT_ON`). Operative mode turns `manager` and
 * `operatives` off. Status is `pending` only when stored as pending. Null for a blank organisation id.
 */
export function parseOrgMembershipDocument(
  organizationId: unknown,
  data: Record<string, unknown> | null | undefined
): OrgMembershipDocument | null {
  const org = text(organizationId)
  if (!org) return null
  const row = data && typeof data === 'object' ? data : {}
  const nested = row.permissions && typeof row.permissions === 'object' ? (row.permissions as Record<string, unknown>) : {}
  let hasLegacyFlatFlags = false
  const permissions = {} as Record<OrgMembershipPermissionKey, boolean>
  for (const key of ORG_MEMBERSHIP_PERMISSION_KEYS) {
    const fromNested = bool(nested[key])
    const fromFlat = bool(row[key])
    if (fromNested == null && fromFlat != null) hasLegacyFlatFlags = true
    permissions[key] = fromNested ?? fromFlat ?? ORG_MEMBERSHIP_DEFAULT_ON.includes(key)
  }
  if (permissions.operativeMode) {
    permissions.manager = false
    permissions.operatives = false
  }
  const accountActive = bool(row.accountActive) ?? bool(row.isActive) ?? true
  return {
    organizationId: org,
    role: text(row.role) || 'member',
    status: text(row.status) === 'pending' ? 'pending' : 'active',
    isSuperAdmin: bool(row.isSuperAdmin) === true,
    accountActive,
    permissions,
    invitedBy: text(row.invitedBy) || null,
    invitedAtMs: instantMs(row.invitedAt),
    acceptedAtMs: instantMs(row.acceptedAt),
    updatedAtMs: instantMs(row.updatedAt),
    hasLegacyFlatFlags,
  }
}

export type OrgMembershipChange = {
  role?: string | null
  status?: OrgMembershipStatus | null
  isSuperAdmin?: boolean | null
  accountActive?: boolean | null
  permissions?: Partial<Record<OrgMembershipPermissionKey, boolean>> | null
  invitedBy?: string | null
}

export type OrgMembershipWrite = {
  /** `create`: set the document (it does not exist); `update`: partial update of `fields` (dotted keys). */
  mode: 'create' | 'update'
  fields: Record<string, unknown>
  /** Keys to delete in the same update (legacy flat flags an admin save clears). */
  remove: string[]
}

/**
 * The membership write for a change (1.10.0). `writer` `admin` (an admin of that organisation) may write every
 * field; `self` (the person) writes only `status: 'active'` (accepting) — any other field in `next` is ignored, so a
 * person can never raise their own role or permissions. Only values that differ from `stored` are written; an
 * admin update also removes the legacy flat flag keys. `now` is the app's instant (server timestamp or Date) used for
 * `acceptedAt` / `invitedAt` / `updatedAt`. Null when there is nothing to write.
 */
export function orgMembershipWriteFields(input: {
  organizationId: string
  stored: Record<string, unknown> | null | undefined
  next: OrgMembershipChange
  writer: 'admin' | 'self'
  now: unknown
}): OrgMembershipWrite | null {
  const org = text(input?.organizationId)
  if (!org) return null
  const storedRaw = input.stored && typeof input.stored === 'object' ? input.stored : null
  const current = storedRaw ? parseOrgMembershipDocument(org, storedRaw) : null
  const next = input.next || {}
  const fields: Record<string, unknown> = {}
  const remove: string[] = []

  if (input.writer === 'self') {
    if (next.status === 'active' && (!current || current.status === 'pending')) {
      fields.status = 'active'
      fields.acceptedAt = input.now
    }
    if (!current && Object.keys(fields).length > 0) {
      return { mode: 'create', fields: { ...fields, invitedAt: input.now, updatedAt: input.now }, remove: [] }
    }
    if (Object.keys(fields).length === 0) return null
    fields.updatedAt = input.now
    return { mode: 'update', fields, remove: [] }
  }

  const role = text(next.role)
  if (!current) {
    const permissions = {} as Record<string, boolean>
    for (const key of ORG_MEMBERSHIP_PERMISSION_KEYS) {
      const value = next.permissions?.[key]
      permissions[key] = typeof value === 'boolean' ? value : ORG_MEMBERSHIP_DEFAULT_ON.includes(key)
    }
    const status = next.status === 'pending' ? 'pending' : 'active'
    const set: Record<string, unknown> = {
      role: role || 'member',
      status,
      isSuperAdmin: next.isSuperAdmin === true,
      accountActive: next.accountActive !== false,
      permissions,
      invitedAt: input.now,
      updatedAt: input.now,
    }
    if (status === 'active') set.acceptedAt = input.now
    const invitedBy = text(next.invitedBy)
    if (invitedBy) set.invitedBy = invitedBy
    return { mode: 'create', fields: set, remove: [] }
  }

  if (role && role !== current.role) fields.role = role
  if (next.status && next.status !== current.status) {
    fields.status = next.status
    if (next.status === 'active') fields.acceptedAt = input.now
  }
  if (typeof next.isSuperAdmin === 'boolean' && next.isSuperAdmin !== current.isSuperAdmin) fields.isSuperAdmin = next.isSuperAdmin
  if (typeof next.accountActive === 'boolean' && next.accountActive !== current.accountActive) fields.accountActive = next.accountActive
  const nested =
    storedRaw && storedRaw.permissions && typeof storedRaw.permissions === 'object'
      ? (storedRaw.permissions as Record<string, unknown>)
      : {}
  for (const key of ORG_MEMBERSHIP_PERMISSION_KEYS) {
    const value = next.permissions?.[key]
    if (typeof value !== 'boolean') {
      // Keep the value a legacy flat flag held when it moves to the nested map.
      if (bool(nested[key]) == null && storedRaw && bool(storedRaw[key]) != null) {
        fields[`permissions.${key}`] = current.permissions[key]
      }
      continue
    }
    if (bool(nested[key]) !== value) fields[`permissions.${key}`] = value
  }
  if (storedRaw) {
    for (const key of ORG_MEMBERSHIP_PERMISSION_KEYS) if (key in storedRaw) remove.push(key)
    if ('isActive' in storedRaw) {
      if (!('accountActive' in fields) && bool(storedRaw.accountActive) == null) fields.accountActive = current.accountActive
      remove.push('isActive')
    }
  }
  if (Object.keys(fields).length === 0 && remove.length === 0) return null
  fields.updatedAt = input.now
  return { mode: 'update', fields, remove }
}
