/**
 * Who is on an organisation's roster, and at what level (rulebook §1, §11, §14; 1.11.0).
 *
 * The live roster query is `users where organizationId == X`. A member whose `users/{uid}.organizationId` names another
 * company (a person in two companies, or a super admin who last opened another one) is not in that query; both apps
 * read them by id from the organisation's `members` map. Before 1.11.0 the security rules refused that read to
 * co-members and a refused read removed the person from Manage Users on that device (the super admin vanished).
 *
 * `rosterMembersForOrganization` is the one rule: the anchored people (every `members` key, the creator, and the
 * signed-in user when listed) are always on the roster; a person's level in X comes from their users flags only when
 * that document's `organizationId` is X, otherwise from their membership in X (`parseOrgMembershipDocument`), else the
 * `members` role — the creator is always X's super admin. An anchored person leaves only when their users document is
 * confirmed missing (`missingIds`) or they leave `members`; a denied read never removes them (`unreadIds`). Pure.
 */

import { parseOrgMembershipDocument } from './orgMembership'
import { permissionLevelOf, storedPermissionFlag, type PermissionLevel } from './permissionLevels'
import { rosterPeople, type RosterDocument } from './scheduleSources'
import { selfManageToggles } from './leaveRequests'

export type OrgRosterLevel = {
  level: PermissionLevel
  isSuperAdmin: boolean
  /** Where the level came from. */
  source: 'users' | 'membership' | 'members' | 'creator'
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function orgIdOf(value: unknown): string {
  const raw = text(value)
  return raw.includes('/') ? raw.split('/').filter(Boolean).pop() ?? '' : raw
}

function flagValue(value: unknown): boolean {
  return value === true || value === 1
}

/** A users-document flag on at the top level or inside `permissions` (firestore.rules `staffFlag`). */
function eitherFlag(user: Record<string, unknown> | null, key: string): boolean {
  if (!user) return false
  const permissions = user.permissions && typeof user.permissions === 'object' ? (user.permissions as Record<string, unknown>) : {}
  return flagValue(user[key]) || flagValue(permissions[key])
}

function levelFromRole(role: unknown): PermissionLevel | null {
  const value = text(role).toLowerCase().replace(/[\s-]/g, '_')
  if (value === 'admin' || value === 'super_admin' || value === 'superadmin') return 'admin'
  if (value === 'manager') return 'manager'
  if (value === 'operative') return 'operative'
  return null
}

/**
 * The person's level in `organizationId`: their users flags when `users/{uid}.organizationId` is that organisation;
 * otherwise their membership there (role, then its flags), else the `members` role (`member` reads as operative); the
 * creator is admin and super admin whatever else says.
 */
export function organizationLevelFor(input: {
  organizationId: string
  userId: string
  user?: Record<string, unknown> | null
  membership?: Record<string, unknown> | null
  membersRole?: unknown
  creatorUserId?: string | null
}): OrgRosterLevel {
  const org = text(input.organizationId).toLowerCase()
  const id = text(input.userId)
  if (id && text(input.creatorUserId) === id) return { level: 'admin', isSuperAdmin: true, source: 'creator' }
  const user = input.user ?? null
  if (user && orgIdOf(user.organizationId).toLowerCase() === org) {
    return { level: permissionLevelOf(user), isSuperAdmin: storedPermissionFlag(user, 'isSuperAdmin') === true, source: 'users' }
  }
  if (input.membership && typeof input.membership === 'object') {
    const parsed = parseOrgMembershipDocument(input.organizationId, input.membership)
    if (parsed) {
      const fromRole = levelFromRole(parsed.role)
      const level =
        fromRole ??
        (parsed.isSuperAdmin || parsed.permissions.adminAccess ? 'admin' : parsed.permissions.operativeMode ? 'operative' : 'manager')
      return { level, isSuperAdmin: parsed.isSuperAdmin === true, source: 'membership' }
    }
  }
  return { level: levelFromRole(input.membersRole) ?? 'operative', isSuperAdmin: false, source: 'members' }
}

/**
 * Where a person's self-manage toggles for organisation `organizationId` are read (rulebook §8, §9, §16; 1.30.2) —
 * the same source as `organizationLevelFor` and the security rules (`orgSelfManageData`):
 *   - the organisation's creator: its Super Admin, both toggles on;
 *   - their users document when its `organizationId` is this organisation (`isSuperAdmin` there is the Super Admin);
 *   - otherwise their membership here (`users/{uid}/orgMemberships/{orgId}`, `parseOrgMembershipDocument`: role, then
 *     its flags). A membership never makes anyone the Super Admin (`isOrganizationSuperAdmin`);
 *   - otherwise nothing: both off.
 * Never the users document of another company (before 1.30.2 the rules read it: an admin whose toggles were on only
 * in their membership here was refused approved leave, and a manager with the flag on at home was allowed it here).
 * `annualLeaveSelfBook` / `timesheetSelfSign` are in effect as `selfManageToggles` reads them (operative mode, admin
 * level, Super Admin); `active` is that source's active flag. Pure.
 */
export function organizationSelfManageFlags(input: {
  organizationId: string
  userId: string
  user?: Record<string, unknown> | null
  membership?: Record<string, unknown> | null
  creatorUserId?: string | null
}): {
  source: 'creator' | 'users' | 'membership' | 'none'
  superAdmin: boolean
  admin: boolean
  active: boolean
  annualLeaveSelfBook: boolean
  timesheetSelfSign: boolean
} {
  const org = text(input?.organizationId).toLowerCase()
  const id = text(input?.userId)
  const user = input?.user && typeof input.user === 'object' ? input.user : null
  const none = { source: 'none' as const, superAdmin: false, admin: false, active: true, annualLeaveSelfBook: false, timesheetSelfSign: false }
  if (!org || !id) return none
  const creator = text(input?.creatorUserId) !== '' && text(input?.creatorUserId) === id
  const home = Boolean(user && orgIdOf(user.organizationId).toLowerCase() === org)
  if (creator || home) {
    const level = home ? permissionLevelOf(user) : 'admin'
    const superAdmin = creator || eitherFlag(user, 'isSuperAdmin')
    const toggles = selfManageToggles({
      id,
      role: level,
      adminAccess: level === 'admin',
      operativeMode: level === 'operative',
      // Top level or `permissions`, as the rules' `staffFlag` reads a users document.
      annualLeaveSelfBook: eitherFlag(user, 'annualLeaveSelfBook'),
      timesheetSelfSign: eitherFlag(user, 'timesheetSelfSign'),
      organizationSuperAdmin: superAdmin,
    } as Parameters<typeof selfManageToggles>[0])
    return {
      source: creator ? 'creator' : 'users',
      superAdmin,
      admin: level === 'admin',
      active: creator ? true : user?.isActive !== false,
      annualLeaveSelfBook: toggles.annualLeaveSelfBook,
      timesheetSelfSign: toggles.timesheetSelfSign,
    }
  }
  const parsed = input?.membership && typeof input.membership === 'object'
    ? parseOrgMembershipDocument(input.organizationId, input.membership)
    : null
  if (!parsed) return none
  const level = organizationLevelFor({ organizationId: org, userId: id, membership: input.membership }).level
  const toggles = selfManageToggles({
    id,
    role: level,
    adminAccess: level === 'admin',
    operativeMode: level === 'operative',
    annualLeaveSelfBook: parsed.permissions.annualLeaveSelfBook,
    timesheetSelfSign: parsed.permissions.timesheetSelfSign,
    organizationSuperAdmin: false,
  } as Parameters<typeof selfManageToggles>[0])
  return {
    source: 'membership',
    superAdmin: false,
    admin: level === 'admin',
    active: parsed.accountActive,
    annualLeaveSelfBook: toggles.annualLeaveSelfBook,
    timesheetSelfSign: toggles.timesheetSelfSign,
  }
}

/**
 * The roster of organisation `organizationId` (rulebook §1, §11; 1.11.0): `users` are the users documents the app
 * read (the `organizationId` query plus the anchored people read by id), `members` the organisation's members map,
 * `memberships` the membership documents the app could read, by user id. Returns
 *   - `people`: `rosterPeople` over the documents of this organisation and of the anchored people, each with
 *     `organizationLevel` (`organizationLevelFor`);
 *   - `userIdAliases`: as `rosterPeople`;
 *   - `anchoredIds`: every `members` key, the creator, and the signed-in user when they are listed;
 *   - `unreadIds`: anchored people with no document in `users` that are not in `missingIds` (a denied or failed read):
 *     the app keeps their last known row (or a placeholder) and never drops them for it.
 * An anchored person whose document is confirmed missing (`missingIds`) is left out.
 */
export function rosterMembersForOrganization<T extends RosterDocument & Record<string, unknown>>(input: {
  organizationId: string
  users: ReadonlyArray<T>
  members?: Record<string, unknown> | null
  creatorUserId?: string | null
  signedInUserId?: string | null
  memberships?: Record<string, Record<string, unknown> | null | undefined> | null
  missingIds?: ReadonlyArray<string> | null
}): {
  people: Array<T & { sameEmailUserIds: string[]; formerUserIds: string[]; organizationLevel: OrgRosterLevel }>
  userIdAliases: Record<string, string>
  anchoredIds: string[]
  unreadIds: string[]
} {
  const org = text(input?.organizationId)
  const members = input?.members && typeof input.members === 'object' ? input.members : {}
  const creator = text(input?.creatorUserId)
  const signedIn = text(input?.signedInUserId)
  const anchored: string[] = []
  const add = (id: string) => {
    if (id && !anchored.some((row) => row.toLowerCase() === id.toLowerCase())) anchored.push(id)
  }
  for (const key of Object.keys(members)) add(text(key))
  add(creator)
  if (signedIn && Object.keys(members).some((key) => key.toLowerCase() === signedIn.toLowerCase())) add(signedIn)
  const anchoredKeys = new Set(anchored.map((id) => id.toLowerCase()))
  const missing = new Set((input?.missingIds || []).map((id) => text(id).toLowerCase()))
  const docs = (input?.users || []).filter((row) => {
    const id = text(row?.id).toLowerCase()
    if (!id || missing.has(id)) return false
    return orgIdOf(row.organizationId).toLowerCase() === org.toLowerCase() || anchoredKeys.has(id)
  })
  const folded = rosterPeople(docs)
  const people = folded.people.map((person) => {
    const id = text(person.id)
    const membersRole = Object.entries(members).find(([key]) => key.toLowerCase() === id.toLowerCase())?.[1]
    return {
      ...person,
      organizationLevel: organizationLevelFor({
        organizationId: org,
        userId: id,
        user: person,
        membership: input?.memberships?.[id] ?? null,
        membersRole,
        creatorUserId: creator,
      }),
    }
  })
  const present = new Set(docs.map((row) => text(row.id).toLowerCase()))
  const unreadIds = anchored.filter((id) => !present.has(id.toLowerCase()) && !missing.has(id.toLowerCase()))
  return { people, userIdAliases: folded.userIdAliases, anchoredIds: anchored, unreadIds }
}
