/**
 * Rulebook 1.32.4 (§16): a person's role and company facts as Firebase Auth custom claims.
 *
 * The security rules used to look up the caller's own `users/{uid}`, `organizations/{orgId}.members` /
 * `creatorUserId` and `users/{uid}/orgMemberships/{orgId}` at every call site, which made `firestore.rules` too
 * expensive for Google's rules compiler. From 1.32.4 the Cloud Function (`functions/authClaims.js`), the backfill
 * (`scripts/backfill-auth-claims.mjs`) and the rules tests compute those facts once, here, and the rules read
 * `request.auth.token.pp`. This module mirrors the 1.32.3 rules helpers exactly (same field reads, same `== true || == 1`
 * truthiness, same `isActive` / `accountActive` tests), so the rules decide the same way they did with the lookups.
 *
 * Shape (`pp`, kept under Firebase's 1,000-byte custom-claims limit):
 *   { v: 1, s: <stamp>, h?: <home organisation id>, r?: <raw organizationId when it differs from h, false for a
 *     reference>, u: [home flags], o: { <organisation id, lower case>: [role, listedRole, ...organisation flags] },
 *     x?: <organisations left out> }
 *
 * - `role` is the 1.32.3 `callerOrgRoleAnyBilling`: 'admin' | 'manager' | 'operative' | 'member' | 'other' | ''.
 * - `listedRole` is the `members` map entry (`callerListedRole`): the same words, 'other' for any other value.
 * - Home flags (`u`, from the users document, whatever organisation is open): see `AUTH_CLAIMS_HOME_FLAGS`.
 * - Organisation flags: see `AUTH_CLAIMS_ORGANIZATION_FLAGS`.
 *
 * Not in claims (they change often or are about other documents): billing and deletion (`orgBillingOpen` stays a
 * lookup), pay, line managers, alias ids (`formerUserIds`, `sameEmailUserIds`), names and email.
 *
 * Staleness: claims reach the rules on the person's next ID token (a client that listens to the marker
 * `users/{uid}/private/authClaims` refreshes at once; otherwise within an hour). Pure.
 */

export const AUTH_CLAIMS_KEY = 'pp'
export const AUTH_CLAIMS_VERSION = 1
/** Firebase refuses custom claims over 1,000 bytes (JSON). Room is left for the key and future fields. */
export const AUTH_CLAIMS_MAX_BYTES = 950
/** The marker the Cloud Function writes after every claims change: `{ v: <stamp>, updatedAt }`, server-only. */
export const AUTH_CLAIMS_MARKER_DOC_ID = 'authClaims'

export function authClaimsMarkerPath(uid: string): string {
  return `users/${String(uid ?? '').trim()}/private/${AUTH_CLAIMS_MARKER_DOC_ID}`
}

/** Fields of `users/{uid}` the claims read. A write that changes none of them (and not existence) changes no claim. */
export const AUTH_CLAIMS_USER_FIELDS = [
  'organizationId',
  'isActive',
  'role',
  'isSuperAdmin',
  'adminAccess',
  'operativeMode',
  'manager',
  'operatives',
  'projects',
  'smallWorks',
  'annualLeaveSelfBook',
  'permissions',
] as const

/** Fields of `organizations/{orgId}` the claims read. */
export const AUTH_CLAIMS_ORGANIZATION_FIELDS = ['members', 'creatorUserId'] as const

/** Home flags (`pp.u`): facts about the caller's users document that the rules use without an organisation. */
export const AUTH_CLAIMS_HOME_FLAGS = {
  a: 'admin-like users document (adminLikeUser)',
  o: 'operative profile (isOperativeProfile)',
  p: 'operative-like users document, top-level operativeMode or role (isOperativeLikeUser)',
  k: 'manager with operatives access, top-level flags, not operative mode (isManagerWithOperativesAccess)',
  q: 'operatives manager by staffFlag: operatives and manager on, not admin, not operative, active',
  s: 'Super Admin flag (staffFlag isSuperAdmin)',
  t: 'isSuperAdmin stored as true at the top level',
  x: 'users document exists',
  i: 'users document isActive false',
} as const

/** Organisation flags (after role and listed role in `pp.o[orgId]`). */
export const AUTH_CLAIMS_ORGANIZATION_FLAGS = {
  c: 'member and active here, billing aside (canAccessOrganization)',
  h: 'users document names this organisation (userOrgIdMatchesPath / homeOrgIs)',
  C: 'creator of this organisation (orgCreatorIs)',
  E: 'admin here by users document or members map, billing aside (orgAdminEither)',
  H: 'active admin by the users document of this organisation, billing aside (isOrganizationAdmin)',
  S: 'Super Admin of this organisation (callerIsSuperAdminOf)',
  P: 'Projects toggle in this organisation (callerJobToggle projects)',
  W: 'Small works toggle in this organisation (callerJobToggle smallWorks)',
  B: 'books own annual leave here: creator or Annual Leave Management (hbCallerSelfBooks)',
} as const

export type AuthClaimsRole = 'admin' | 'manager' | 'operative' | 'member' | 'other' | ''
const KNOWN_ROLES = ['admin', 'manager', 'operative', 'member']

export type AuthClaimsPayload = {
  v: number
  s: number
  h?: string
  r?: string | false
  u: string[]
  o: Record<string, string[]>
  x?: number
}

type Doc = Record<string, unknown>

/**
 * A Firestore map: a plain object. Checked by constructor name, not `Object.prototype`, because the Cloud Function and
 * the backfill run this script in a separate VM context (another realm) and pass in documents from the main one.
 */
function isPlainMap(value: unknown): value is Doc {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === null || (proto && typeof proto.constructor === 'function' && proto.constructor.name === 'Object')
}

/** A Firestore DocumentReference (admin or client SDK): an object with a string `path` that is not a plain map. */
function referencePath(value: unknown): string | null {
  if (value == null || typeof value !== 'object' || isPlainMap(value)) return null
  const path = (value as { path?: unknown }).path
  return typeof path === 'string' ? path : null
}

function has(d: Doc, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(d, key)
}

/** The rules' `d.get(key, fallback)`: the stored value (null included) when the key exists. */
function get(d: Doc, key: string, fallback: unknown): unknown {
  return has(d, key) ? d[key] : fallback
}

function truthy(value: unknown): boolean {
  return value === true || value === 1
}

function staffFlag(d: Doc, key: string): boolean {
  const own = get(d, key, null)
  if (own == null) {
    const perms = get(d, 'permissions', {})
    return truthy(isPlainMap(perms) ? get(perms, key, null) : null)
  }
  return truthy(own)
}

function adminLikeUser(d: Doc): boolean {
  const perms = d.permissions
  return truthy(get(d, 'isSuperAdmin', false)) ||
    truthy(get(d, 'adminAccess', false)) ||
    (has(d, 'permissions') && isPlainMap(perms) && has(perms, 'adminAccess') && truthy(perms.adminAccess)) ||
    get(d, 'role', '') === 'admin'
}

function isOperativeProfile(d: Doc): boolean {
  return staffFlag(d, 'operativeMode') || get(d, 'role', '') === 'operative'
}

function isOperativeLikeUser(d: Doc): boolean {
  return (has(d, 'operativeMode') && truthy(d.operativeMode)) || (has(d, 'role') && d.role === 'operative')
}

function rawFlag(d: Doc, key: string): boolean {
  return has(d, key) && truthy(d[key])
}

function homeRoleIsManager(d: Doc): boolean {
  const perms = d.permissions
  return rawFlag(d, 'manager') ||
    (has(d, 'permissions') && isPlainMap(perms) && has(perms, 'manager') && truthy(perms.manager)) ||
    (has(d, 'role') && d.role === 'manager')
}

function homeActive(d: Doc): boolean {
  return get(d, 'isActive', true) !== false
}

/**
 * The organisation the users document names, lower case, the way the rules' `homeOrgIs` matches it: a plain id (trimmed),
 * an "…organizations/<id>" path string, or a reference to `organizations/<id>`. '' when it names none.
 */
export function authClaimsHomeOrganizationKey(value: unknown): string {
  if (typeof value === 'string') {
    if (!value.includes('/')) return value.trim().toLowerCase()
    const match = /(?:^|\/)organizations\/([^/]*)$/.exec(value.toLowerCase())
    return match ? match[1] : ''
  }
  const path = referencePath(value)
  if (path != null) {
    const parts = path.split('/').filter((part) => part !== '')
    return parts.length >= 2 && parts[parts.length - 2].toLowerCase() === 'organizations'
      ? parts[parts.length - 1].toLowerCase()
      : ''
  }
  return ''
}

/** The rules' `docOrganizationId`: the last path segment, trimmed, case kept. '' when not a string or reference. */
function docOrganizationId(value: unknown): string {
  const raw = typeof value === 'string' ? value : referencePath(value) ?? ''
  const parts = raw.split('/')
  return parts.length > 0 ? parts[parts.length - 1].trim() : ''
}

function listedRoleWord(raw: unknown): AuthClaimsRole {
  if (raw == null || raw === '') return ''
  return typeof raw === 'string' && KNOWN_ROLES.includes(raw) ? (raw as AuthClaimsRole) : 'other'
}

function membershipFlag(m: Doc, key: string): boolean {
  const nested = get(m, 'permissions', {})
  if (isPlainMap(nested)) {
    const value = get(nested, key, null)
    if (value === true || value === false || value === 1 || value === 0) return truthy(value)
  }
  return truthy(get(m, key, false))
}

function membershipActive(m: Doc): boolean {
  return (has(m, 'accountActive') ? m.accountActive : get(m, 'isActive', true)) !== false
}

/** 1.32.3 `membershipSelfManageFlag` (the membership's level here, then the toggle). */
function membershipSelfManageFlag(m: Doc, key: string, adminOnly: boolean): boolean {
  const stored = get(m, 'role', '')
  const role = typeof stored === 'string' ? stored.toLowerCase().replace(/[ -]/g, '_') : ''
  const admin = ['admin', 'super_admin', 'superadmin'].includes(role) ||
    (!['manager', 'operative'].includes(role) && (truthy(get(m, 'isSuperAdmin', false)) || membershipFlag(m, 'adminAccess')))
  const operative = !admin && (role === 'operative' || (role !== 'manager' && membershipFlag(m, 'operativeMode')))
  return membershipActive(m) && membershipFlag(m, key) && (admin || (!adminOnly && !operative))
}

function membershipJobToggle(m: Doc, kind: string): boolean {
  const perms = get(m, 'permissions', {})
  if (!isPlainMap(perms)) return false
  return truthy(get(perms, kind, get(m, kind, false)))
}

export type AuthClaimsInput = {
  uid: string
  /** `users/{uid}` data, or null when it does not exist. */
  user: Doc | null | undefined
  /** `organizations/{orgId}` data by exact id: the home organisation, every one listing the person or created by them. */
  organizations: Record<string, Doc | null | undefined>
  /** `users/{uid}/orgMemberships/{orgId}` data by organisation id. */
  memberships?: Record<string, Doc | null | undefined>
  /** `pp.s`: when these claims were computed (ms). The marker carries the same value. */
  stamp?: number
}

export type AuthClaimsResult = {
  /** The custom claims to set: `{ pp }`. */
  claims: { pp: AuthClaimsPayload }
  /** Organisations the person belongs to that did not fit under `AUTH_CLAIMS_MAX_BYTES` (refused by the rules). */
  omittedOrganizationIds: string[]
}

function utf8Bytes(text: string): number {
  let bytes = 0
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4
      i += 1
    } else bytes += 3
  }
  return bytes
}

const ROLE_ORDER: Record<string, number> = { admin: 0, manager: 1, operative: 2, member: 3, other: 4, '': 5 }

/**
 * The claims for one person (rulebook 1.32.4 §16). Every organisation the person belongs to (their users document
 * names it, its `members` map lists them, or they created it) gets an entry. When they do not all fit under
 * `AUTH_CLAIMS_MAX_BYTES`, the home organisation is kept first, then the others by role (admin, manager, operative,
 * member) and id; the rest are left out (`pp.x` counts them) and the rules refuse them until the person leaves another
 * organisation. The backfill dry run lists everyone affected.
 */
export function authClaimsForPerson(input: AuthClaimsInput): AuthClaimsResult {
  const uid = String(input?.uid ?? '').trim()
  const userExists = input?.user != null && typeof input.user === 'object'
  const H: Doc = userExists ? (input.user as Doc) : {}
  const organizations = input?.organizations && typeof input.organizations === 'object' ? input.organizations : {}
  const memberships = input?.memberships && typeof input.memberships === 'object' ? input.memberships : {}

  const pp: AuthClaimsPayload = { v: AUTH_CLAIMS_VERSION, s: Number.isFinite(input?.stamp) ? Number(input.stamp) : 0, u: [], o: {} }

  const rawOrg = get(H, 'organizationId', null)
  if (typeof rawOrg === 'string') {
    pp.h = docOrganizationId(rawOrg)
    if (rawOrg !== pp.h) pp.r = rawOrg
  } else if (referencePath(rawOrg) != null) {
    pp.h = docOrganizationId(rawOrg)
    pp.r = false
  }

  const adminLike = adminLikeUser(H)
  const opProfile = isOperativeProfile(H)
  const active = homeActive(H)
  if (userExists) {
    const u = pp.u
    if (adminLike) u.push('a')
    if (opProfile) u.push('o')
    if (isOperativeLikeUser(H)) u.push('p')
    if (!rawFlag(H, 'operativeMode') && rawFlag(H, 'manager') && rawFlag(H, 'operatives')) u.push('k')
    if (staffFlag(H, 'operatives') && !adminLike && staffFlag(H, 'manager') && !opProfile && active) u.push('q')
    if (staffFlag(H, 'isSuperAdmin')) u.push('s')
    if (has(H, 'isSuperAdmin') && H.isSuperAdmin === true) u.push('t')
    u.push('x')
    if (get(H, 'isActive', true) === false) u.push('i')
  }

  const homeKey = userExists ? authClaimsHomeOrganizationKey(rawOrg) : ''
  const membershipByKey = new Map<string, Doc>()
  for (const [id, data] of Object.entries(memberships)) {
    if (data && typeof data === 'object') {
      const key = id.trim().toLowerCase()
      if (!membershipByKey.has(key) || id === key) membershipByKey.set(key, data as Doc)
    }
  }

  type Candidate = { key: string; id: string; org: Doc | null }
  const candidates = new Map<string, Candidate>()
  for (const [id, data] of Object.entries(organizations)) {
    const org = data && typeof data === 'object' ? (data as Doc) : null
    const key = id.trim().toLowerCase()
    if (!key) continue
    const members = org ? get(org, 'members', {}) : {}
    const listed = isPlainMap(members) && uid !== '' ? get(members, uid, null) : null
    const tied = key === homeKey || listed != null || (org != null && get(org, 'creatorUserId', null) === uid && uid !== '')
    if (!tied) continue
    const existing = candidates.get(key)
    if (!existing || (existing.org == null && org != null) || id === docOrganizationId(rawOrg)) candidates.set(key, { key, id, org })
  }
  if (homeKey && !candidates.has(homeKey)) candidates.set(homeKey, { key: homeKey, id: homeKey, org: null })

  const entries: Array<{ key: string; entry: string[] }> = []
  for (const { key, id, org } of candidates.values()) {
    const home = key === homeKey
    const exists = org != null
    const O: Doc = org ?? {}
    const members = get(O, 'members', {})
    const listedRaw: unknown = exists ? (isPlainMap(members) ? get(members, uid, '') : '') : ''
    const listedPresent = isPlainMap(members) && get(members, uid, null) != null
    const creatorAny = exists && get(O, 'creatorUserId', null) === uid
    const creator = exists && id !== '' && !id.includes('.') && get(O, 'creatorUserId', '') === uid
    const M = membershipByKey.get(key) ?? null
    const membershipDeactivated = M != null && !membershipActive(M)

    const access = home ? active : exists && (listedPresent || creatorAny) && !membershipDeactivated
    let role: AuthClaimsRole
    if (home) {
      role = !active ? '' : listedRaw === 'admin' || adminLike ? 'admin' : opProfile ? 'operative' : homeRoleIsManager(H) ? 'manager' : 'member'
    } else {
      const word = listedRoleWord(listedRaw)
      role = word !== '' && membershipDeactivated ? '' : word
    }
    const listedAdmin = exists && isPlainMap(members) && has(members, uid) && members[uid] === 'admin'
    const homeAdmin = home && adminLike && active
    const flags: string[] = []
    if (access) flags.push('c')
    if (home) flags.push('h')
    if (creator) flags.push('C')
    if (homeAdmin || (listedAdmin && !(get(H, 'isActive', true) === false && home))) flags.push('E')
    if (homeAdmin) flags.push('H')
    if (creator || (staffFlag(H, 'isSuperAdmin') && home)) flags.push('S')
    for (const [kind, letter] of [['projects', 'P'], ['smallWorks', 'W']] as const) {
      if (home ? staffFlag(H, kind) : M != null && membershipJobToggle(M, kind)) flags.push(letter)
    }
    const selfBooks = home
      ? active && (adminLike || !opProfile) && (staffFlag(H, 'annualLeaveSelfBook') || staffFlag(H, 'isSuperAdmin'))
      : M != null && membershipSelfManageFlag(M, 'annualLeaveSelfBook', false)
    if (creator || selfBooks) flags.push('B')
    entries.push({ key, entry: [role, listedRoleWord(listedRaw), ...flags] })
  }

  entries.sort((a, b) => {
    if (a.key === homeKey) return -1
    if (b.key === homeKey) return 1
    const rank = (ROLE_ORDER[a.entry[0]] ?? 9) - (ROLE_ORDER[b.entry[0]] ?? 9)
    return rank !== 0 ? rank : a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })

  const omitted: string[] = []
  for (const { key, entry } of entries) {
    pp.o[key] = entry
    if (key !== homeKey && utf8Bytes(JSON.stringify({ [AUTH_CLAIMS_KEY]: { ...pp, x: omitted.length + 1 } })) > AUTH_CLAIMS_MAX_BYTES) {
      delete pp.o[key]
      omitted.push(key)
    }
  }
  if (omitted.length > 0) pp.x = omitted.length
  return { claims: { pp }, omittedOrganizationIds: omitted }
}

export type ParsedAuthClaimsOrganization = {
  role: AuthClaimsRole
  listedRole: AuthClaimsRole
  flags: string[]
  access: boolean
  home: boolean
  creator: boolean
  adminEither: boolean
  homeAdmin: boolean
  superAdmin: boolean
  projects: boolean
  smallWorks: boolean
  selfBooksLeave: boolean
}

export type ParsedAuthClaims = {
  version: number
  stamp: number
  homeOrganizationId: string | null
  homeFlags: string[]
  organizations: Record<string, ParsedAuthClaimsOrganization>
  omittedCount: number
}

function roleOf(value: unknown): AuthClaimsRole {
  return typeof value === 'string' && (KNOWN_ROLES.includes(value) || value === 'other') ? (value as AuthClaimsRole) : ''
}

/**
 * Reads `pp` from decoded token claims (or the `{ pp }` object, or `pp` itself). Null when there are no claims or they
 * are not this shape — the rules then refuse everything a role decides.
 */
export function parseAuthClaims(raw: unknown): ParsedAuthClaims | null {
  if (!raw || typeof raw !== 'object') return null
  const outer = raw as Doc
  const pp = (isPlainMap(outer[AUTH_CLAIMS_KEY]) ? outer[AUTH_CLAIMS_KEY] : outer) as Doc
  if (typeof pp.v !== 'number' || !isPlainMap(pp.o) || !Array.isArray(pp.u)) return null
  const organizations: Record<string, ParsedAuthClaimsOrganization> = {}
  for (const [key, value] of Object.entries(pp.o as Doc)) {
    if (!Array.isArray(value)) continue
    const flags = value.slice(2).filter((flag): flag is string => typeof flag === 'string')
    organizations[key] = {
      role: roleOf(value[0]),
      listedRole: roleOf(value[1]),
      flags,
      access: flags.includes('c'),
      home: flags.includes('h'),
      creator: flags.includes('C'),
      adminEither: flags.includes('E'),
      homeAdmin: flags.includes('H'),
      superAdmin: flags.includes('S'),
      projects: flags.includes('P'),
      smallWorks: flags.includes('W'),
      selfBooksLeave: flags.includes('B'),
    }
  }
  return {
    version: pp.v,
    stamp: typeof pp.s === 'number' ? pp.s : 0,
    homeOrganizationId: typeof pp.h === 'string' ? pp.h : null,
    homeFlags: (pp.u as unknown[]).filter((flag): flag is string => typeof flag === 'string'),
    organizations,
    omittedCount: typeof pp.x === 'number' ? pp.x : 0,
  }
}

function withoutStamp(pp: unknown): string {
  if (!isPlainMap(pp)) return ''
  const { s: _stamp, ...rest } = pp
  const sorted: Doc = {}
  for (const key of Object.keys(rest).sort()) sorted[key] = rest[key]
  if (isPlainMap(sorted.o)) {
    const orgs: Doc = {}
    for (const key of Object.keys(sorted.o).sort()) orgs[key] = (sorted.o as Doc)[key]
    sorted.o = orgs
  }
  return JSON.stringify(sorted)
}

/** True when two `pp` payloads grant the same (the stamp aside). The function sets claims only when this is false. */
export function authClaimsEqual(a: unknown, b: unknown): boolean {
  return withoutStamp(a) === withoutStamp(b)
}

/**
 * True when `after` takes access away that `before` gave: an organisation entry with access (`c`) is gone or has
 * lost it. The function then also revokes the person's refresh tokens (deactivation, removal).
 */
export function authClaimsRevokeAccess(before: unknown, after: unknown): boolean {
  const prev = parseAuthClaims(before)
  if (!prev) return false
  const next = parseAuthClaims(after)
  return Object.entries(prev.organizations).some(([key, org]) => org.access && !(next?.organizations[key]?.access ?? false))
}

/** True when a users document write can change the claims: existence or any of `AUTH_CLAIMS_USER_FIELDS`. */
export function authClaimsUserInputsChanged(before: Doc | null | undefined, after: Doc | null | undefined): boolean {
  if ((before == null) !== (after == null)) return true
  if (before == null || after == null) return false
  return AUTH_CLAIMS_USER_FIELDS.some((key) => has(before, key) !== has(after, key) ||
    JSON.stringify(comparable(before[key])) !== JSON.stringify(comparable(after[key])))
}

/** A value with references replaced by their path, so it can be compared as JSON. */
function comparable(value: unknown): unknown {
  const path = referencePath(value)
  if (path != null) return `ref:${path}`
  if (Array.isArray(value)) return value.map(comparable)
  if (isPlainMap(value)) {
    const out: Doc = {}
    for (const key of Object.keys(value).sort()) out[key] = comparable(value[key])
    return out
  }
  return value ?? null
}

/** The people whose claims an organisation write can change: a `members` entry or `creatorUserId` changed for them. */
export function authClaimsOrganizationAffectedUids(before: Doc | null | undefined, after: Doc | null | undefined): string[] {
  const ids = new Set<string>()
  const mb = before && isPlainMap(before.members) ? (before.members as Doc) : {}
  const ma = after && isPlainMap(after.members) ? (after.members as Doc) : {}
  for (const uid of new Set([...Object.keys(mb), ...Object.keys(ma)])) {
    if (!has(mb, uid) || !has(ma, uid) || mb[uid] !== ma[uid] || before == null || after == null) ids.add(uid)
  }
  const cb = before ? before.creatorUserId : undefined
  const ca = after ? after.creatorUserId : undefined
  if (cb !== ca) {
    if (typeof cb === 'string' && cb) ids.add(cb)
    if (typeof ca === 'string' && ca) ids.add(ca)
  }
  return [...ids].filter((uid) => uid.trim() !== '' && !uid.includes('/')).sort()
}

/**
 * Clients: true when the marker (`users/{uid}/private/authClaims`, field `v`) names claims newer than the signed-in
 * token's (`pp.s`), so the app calls `getIdToken(true)` (web) / `getIDTokenForcingRefresh(true)` (iOS).
 */
export function authClaimsTokenIsStale(markerVersion: unknown, tokenClaims: unknown): boolean {
  if (typeof markerVersion !== 'number' || !Number.isFinite(markerVersion)) return false
  const parsed = parseAuthClaims(tokenClaims)
  return !parsed || parsed.stamp !== markerVersion
}

/** Clients: true when the token's claims give this organisation (access flag), e.g. after founding or joining it. */
export function authClaimsCoverOrganization(tokenClaims: unknown, organizationId: unknown): boolean {
  const key = String(organizationId ?? '').trim().toLowerCase()
  if (!key) return false
  return parseAuthClaims(tokenClaims)?.organizations[key]?.access === true
}
