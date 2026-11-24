/**
 * Owner console person page (spec §4.4, PLAN §8 PR 5). Pure functions over plain document data the
 * `/api/owner/people/[uid]` route reads with the owner's token (and the server key for Auth and memberships), so they
 * are unit-tested without Firestore. Business rules come from lib/canonical:
 * - who the person is: the directory row (`rosterPeople`, one per email) and `personIdSet` (guardrail 1: never a
 *   single id);
 * - their level in each organisation: `organizationLevelFor` (users document of that organisation, else the
 *   membership there, else the `members` role; the creator is the Super Admin);
 * - Active / Inactive / Pending: `rosterSegment`; deletion: `organizationDeletionState`.
 * Emails leave the server masked; pay, tax ids and push tokens never leave it (only a count of tokens).
 */
import { displayNameInOrganization, type MemberNames } from '@/lib/canonical/memberNames'
import { lineManagerSummary, type LineManagerRosterPerson, type LineManagerSubject } from '@/lib/canonical/lineManagers'
import { documentOrganizationId } from '@/lib/canonical/peopleDocuments'
import { organizationLevelFor } from '@/lib/canonical/orgRoster'
import { personIdSet } from '@/lib/canonical/personIds'
import { pushTokenList } from '@/lib/canonical/pushTokens'
import { rosterPersonName, rosterSegment, type RosterSegment, type RosterSegmentProfile } from '@/lib/canonical/userRosterSegment'
import { maskEmail } from '@/lib/auth/maskEmail'
import { isRevealAction, ownerActionLabel } from '@/lib/owner/commandCentre'
import type { OwnerOrgRow, OwnerPersonRow, PlainDoc } from '@/lib/owner/directory'
import type { AdminAuthRecord } from '@/lib/owner/identityToolkitAdmin'

/** Most users documents one person page reads (a person rarely has more than two or three). */
export const PERSON_USER_DOCS_MAX = 20
/** Most organisations one person page reads. */
export const PERSON_ORGANISATIONS_MAX = 30
/** Most audit entries read for one person (no index on targetUserId + at: read, then sorted here). */
export const PERSON_AUDIT_READ_MAX = 300

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function timeMs(value: unknown): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) && value.getTime() > 0 ? value.getTime() : null
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value)
    return Number.isFinite(ms) && ms > 0 ? ms : null
  }
  if (value && typeof value === 'object') {
    const rec = value as { seconds?: unknown; _seconds?: unknown }
    const seconds = typeof rec.seconds === 'number' ? rec.seconds : typeof rec._seconds === 'number' ? rec._seconds : null
    if (seconds != null && seconds > 0) return Math.round(seconds * 1000)
  }
  return null
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : []
}

/** The directory row this id belongs to: any of its users document ids, without case. */
export function findDirectoryPerson(rows: readonly OwnerPersonRow[], uid: string): OwnerPersonRow | null {
  const key = uid.trim().toLowerCase()
  if (!key) return null
  return rows.find((row) => row.userIds.some((id) => id.toLowerCase() === key)) || null
}

export type OwnerPersonDocument = {
  id: string
  organizationId: string
  name: string
  emailMasked: string
  segment: RosterSegment
  passwordSet: boolean | null
  isActive: boolean | null
  ghost: boolean
  isInternal: boolean
  createdAtMs: number | null
  lastSeenAtMs: number | null
  /** D6 fields; null until the apps record them ("Not recorded"). */
  lastSeenFrom: string | null
  lastSeenAppVersion: string | null
  /** How many device push tokens are stored (never the tokens). */
  pushTokenCount: number
  formerUserIds: string[]
  sameEmailUserIds: string[]
}

/** One users document as the person page shows it: no pay, no tax ids, no tokens, the email masked. */
export function ownerPersonDocument(doc: PlainDoc): OwnerPersonDocument {
  const data = doc.data || {}
  const profile = data as RosterSegmentProfile
  return {
    id: doc.id,
    organizationId: documentOrganizationId(data.organizationId) || '',
    name: rosterPersonName(profile) || '',
    emailMasked: maskEmail(text(data.email)),
    segment: rosterSegment(profile),
    passwordSet: typeof data.passwordSet === 'boolean' ? data.passwordSet : null,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : null,
    ghost: data.ghost === true,
    isInternal: data.isInternal === true,
    createdAtMs: timeMs(data.createdAt),
    lastSeenAtMs: timeMs(data.lastSeenAt),
    lastSeenFrom: text(data.lastSeenFrom) || null,
    lastSeenAppVersion: text(data.lastSeenAppVersion) || null,
    pushTokenCount: pushTokenList(data.pushTokens).length,
    formerUserIds: stringList(data.formerUserIds),
    sameEmailUserIds: stringList(data.sameEmailUserIds),
  }
}

/**
 * Every id the person goes by (rulebook `personIdSet`): each users document id, its former invite ids and same-email
 * ids. Used to match audit entries and memberships, never a single id.
 */
export function ownerPersonIds(row: OwnerPersonRow, docs: readonly PlainDoc[]): string[] {
  const kept = docs.find((doc) => doc.id === row.id) || docs[0]
  const all = new Set<string>()
  for (const doc of docs.length ? docs : [{ id: row.id, data: {} }]) {
    for (const id of personIdSet({
      id: doc.id,
      email: text(doc.data?.email),
      formerUserIds: stringList(doc.data?.formerUserIds),
      sameEmailUserIds: [...stringList(doc.data?.sameEmailUserIds), ...row.userIds],
    })) {
      all.add(id)
    }
  }
  if (kept) all.add(kept.id)
  return [...all]
}

export type OwnerPersonOrganisation = {
  id: string
  name: string
  /** The level here (rulebook `organizationLevelFor`). */
  level: 'admin' | 'manager' | 'operative'
  isSuperAdmin: boolean
  /** Where the level was read from: a users document of this organisation, a membership, the members map, the creator. */
  source: string
  /** The users document of this person that names this organisation, if any. */
  homeUserId: string | null
  deletion: OwnerOrgRow['deletion'] | 'unknown'
  lapsed: boolean
  isTest: boolean
  /** Rulebook 1.82.0 §11: the person's name in this organisation (its `memberNames` entry, else the account name). */
  nameHere: string
  /** True when `nameHere` is the organisation's own entry; false when it falls back to the account name. */
  nameFromOrganization: boolean
  /** Active in this organisation: the users document of this organisation, else the membership here (`accountActive`). */
  active: boolean
  /**
   * The line manager here (rulebook `lineManagerSummary` over this organisation's users documents), read from the
   * person's users document of this organisation. `recorded` is false when they have none here (a member through a
   * membership only, whose line manager is not stored on a document the owner reads), and null when the caller did not
   * pass the organisation's people.
   */
  lineManager: { label: string; names: string[]; recorded: boolean } | null
}

/** The users documents whose organisation is `orgId` (the roster a line manager is resolved on). */
export function usersOfOrganisation(userDocs: readonly PlainDoc[], orgId: string): PlainDoc[] {
  return userDocs.filter((doc) => (documentOrganizationId(doc.data?.organizationId) || '') === orgId)
}

export const LINE_MANAGER_NOT_RECORDED_LABEL = 'Not recorded here'

/** The line manager of the person in one organisation, from their users document there (none → not recorded). */
export function ownerLineManagerHere(
  homeDoc: PlainDoc | null,
  roster: readonly PlainDoc[]
): { label: string; names: string[]; recorded: boolean } {
  if (!homeDoc) return { label: LINE_MANAGER_NOT_RECORDED_LABEL, names: [], recorded: false }
  const rows = roster.map((doc) => ({ ...(doc.data || {}), id: doc.id }) as unknown as LineManagerRosterPerson)
  const summary = lineManagerSummary({ ...(homeDoc.data || {}), id: homeDoc.id } as LineManagerSubject, rows)
  return { label: summary.label, names: summary.ids.map((entry) => entry.name), recorded: true }
}

/**
 * The organisations the person belongs to, each with their level there. `orgDocs` are the organisation documents
 * (for the `members` map and creator); `memberships` maps `orgId` → membership fields, when the server key could read
 * them. An organisation the owner could not read is still listed (guardrail 3), as "Unknown organisation".
 */
export function ownerPersonOrganisations(input: {
  organizationIds: readonly string[]
  userDocs: readonly PlainDoc[]
  personIds: readonly string[]
  orgRows: readonly OwnerOrgRow[]
  orgDocs: readonly PlainDoc[]
  memberships: ReadonlyMap<string, Record<string, unknown>>
  /** 1.82.0: `orgId` → the organisation's `memberNames` entries for the person's ids (read by id). */
  memberNames?: ReadonlyMap<string, MemberNames>
  /** Every users document the directory read; when given, each organisation's line manager is resolved on it. */
  allUserDocs?: readonly PlainDoc[]
}): OwnerPersonOrganisation[] {
  const rowById = new Map(input.orgRows.map((row) => [row.id, row]))
  const docById = new Map(input.orgDocs.map((doc) => [doc.id, doc]))
  const ids = new Set(input.personIds.map((id) => id.toLowerCase()))
  return input.organizationIds.map((orgId) => {
    const orgData = docById.get(orgId)?.data || {}
    const members = orgData.members && typeof orgData.members === 'object' ? (orgData.members as Record<string, unknown>) : {}
    const membersKey = Object.keys(members).find((key) => ids.has(key.toLowerCase()))
    const homeDoc = input.userDocs.find((doc) => (documentOrganizationId(doc.data?.organizationId) || '') === orgId) || null
    const creator = text(orgData.creatorUserId)
    const creatorIsThem = creator && ids.has(creator.toLowerCase()) ? creator : null
    const userId = creatorIsThem || homeDoc?.id || membersKey || input.userDocs[0]?.id || ''
    const level = organizationLevelFor({
      organizationId: orgId,
      userId,
      user: homeDoc ? homeDoc.data : null,
      membership: input.memberships.get(orgId) || null,
      membersRole: membersKey ? members[membersKey] : undefined,
      creatorUserId: creator || null,
    })
    const row = rowById.get(orgId)
    const person = { ...((homeDoc || input.userDocs[0])?.data || {}), id: userId, formerUserIds: input.personIds }
    const name = displayNameInOrganization({ person, names: input.memberNames?.get(orgId) || null })
    const membership = input.memberships.get(orgId)
    const active = homeDoc
      ? homeDoc.data?.isActive !== false
      : membership
        ? (membership.accountActive ?? membership.isActive) !== false
        : true
    return {
      lineManager: input.allUserDocs ? ownerLineManagerHere(homeDoc, usersOfOrganisation(input.allUserDocs, orgId)) : null,
      nameHere: name.displayName,
      nameFromOrganization: name.source === 'organization',
      active,
      id: orgId,
      name: row?.name || 'Unknown organisation',
      level: level.level,
      isSuperAdmin: level.isSuperAdmin,
      source: level.source,
      homeUserId: homeDoc?.id || null,
      deletion: row?.deletion || 'unknown',
      lapsed: row?.lapsed === true,
      isTest: row?.isTest === true,
    }
  })
}

export type OwnerPersonAuth = Omit<AdminAuthRecord, 'email'> & { emailMasked: string }

/** An Auth record with its email masked (the full email only through the audited reveal). */
export function ownerPersonAuth(record: AdminAuthRecord): OwnerPersonAuth {
  const { email, ...rest } = record
  return { ...rest, emailMasked: maskEmail(email) }
}

export type OwnerPersonAuditRow = {
  requestId: string
  action: string
  label: string
  phase: string
  atMs: number
  reason: string
  targetOrgId: string
  targetUserId: string
}

/**
 * The owner actions about this person, newest first: one row per action (the latest step of each `requestId`), plus
 * every reveal (reveals are records of a look, so each is listed). Entries about other people are left out.
 */
export function ownerPersonAudit(entries: readonly PlainDoc[], personIds: readonly string[]): OwnerPersonAuditRow[] {
  const ids = new Set(personIds.map((id) => id.toLowerCase()))
  const byKey = new Map<string, OwnerPersonAuditRow>()
  for (const entry of entries) {
    const data = entry.data || {}
    const target = text(data.targetUserId)
    if (!target || !ids.has(target.toLowerCase())) continue
    const action = text(data.action)
    const atMs = timeMs(data.at)
    if (!action || atMs == null) continue
    const requestId = text(data.requestId)
    const key = requestId && !isRevealAction(action) ? requestId : `doc:${entry.id}`
    const row: OwnerPersonAuditRow = {
      requestId,
      action,
      label: ownerActionLabel(action),
      phase: text(data.phase),
      atMs,
      reason: text(data.reason),
      targetOrgId: text(data.targetOrgId),
      targetUserId: target,
    }
    const current = byKey.get(key)
    if (!current || row.atMs > current.atMs || (row.atMs === current.atMs && current.phase === 'requested' && row.phase !== 'requested')) {
      byKey.set(key, { ...row, reason: row.reason || current?.reason || '' })
    } else if (!current.reason && row.reason) {
      current.reason = row.reason
    }
  }
  return [...byKey.values()].sort((a, b) => b.atMs - a.atMs)
}
