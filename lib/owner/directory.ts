/**
 * Owner console directory (PLAN §3.1): the rows the `/api/owner/directory/*` and `/api/owner/search` routes return.
 * Pure functions over plain document data (the route reads it with the owner's token, server side), so they are
 * unit-tested against the seed fixtures. Business rules come from lib/canonical:
 * - one person per email across every organisation: `rosterPeople` (guardrail 1, never a single-id match);
 * - Active / Inactive / Pending: `rosterSegment`;
 * - deletion: `organizationDeletionState`; subscription access: `hasAccess`; the organisation id: `documentOrganizationId`.
 * Emails leave the server masked; the full email is only used to match a search.
 */
import { hasAccess, type OrgBillingAccessInput } from '@/lib/canonical/billingAccess'
import { organizationDeletionState } from '@/lib/canonical/organizationDeletion'
import { documentOrganizationId } from '@/lib/canonical/peopleDocuments'
import { rosterPeople } from '@/lib/canonical/scheduleSources'
import { rosterMembersForOrganization } from '@/lib/canonical/orgRoster'
import { personIdSet } from '@/lib/canonical/personIds'
import { rosterPersonName, rosterSegment, type RosterSegment } from '@/lib/canonical/userRosterSegment'
import { maskEmail } from '@/lib/auth/maskEmail'
import { isPlatformOwnerSentinelOrg } from '@/lib/platform/owner'
import { isUnfinishedSetupName } from '@/lib/owner/unfinishedSetup'
import { isTestOrganisation, isTestPerson } from '@/lib/owner/testData'

export type PlainDoc = { id: string; data: Record<string, unknown> }

export const DIRECTORY_PAGE_DEFAULT = 50
export const DIRECTORY_PAGE_MAX = 200
/** Most documents one directory request reads on the server. A bigger platform shows `truncated`, never a quiet cut. */
export const DIRECTORY_SCAN_CAP = 10_000
export const SEARCH_RESULT_LIMIT = 10
export const SEARCH_MIN_LENGTH = 2

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

// MARK: - Organisations

export type OwnerOrgFilter = 'all' | 'test' | 'scheduled' | 'lapsed' | 'unfinished'
export const OWNER_ORG_FILTERS: readonly OwnerOrgFilter[] = ['all', 'test', 'scheduled', 'lapsed', 'unfinished']
export type OwnerOrgSort = 'name' | 'created'
export const OWNER_ORG_SORTS: readonly OwnerOrgSort[] = ['name', 'created']

export type OwnerOrgRow = {
  id: string
  name: string
  /** True when the stored name is missing or an unfinished-setup label. */
  unfinished: boolean
  createdAtMs: number | null
  /** Keys of `organizations/{id}.members` (people listed on the company). */
  memberCount: number
  billingStatus: string | null
  billingInterval: string | null
  /** `hasAccess(billing)` is false: the apps are blocked (rulebook §19). Missing billing is open, never lapsed. */
  lapsed: boolean
  deletion: 'active' | 'scheduled' | 'erased'
  eraseAfterMs: number | null
  isTest: boolean
  /** `billing.trialEnd` (owner console PR 2, the "trial ending" reason). */
  trialEndMs: number | null
  /** `billing.mrrPence` as stored; null when missing or not a number (never filled in from a list price). */
  mrrPence: number | null
  cancelAtPeriodEnd: boolean
  lastPaymentFailedAtMs: number | null
}

export function ownerOrgRow(doc: PlainDoc, nowMs = Date.now()): OwnerOrgRow | null {
  if (!doc.id || isPlatformOwnerSentinelOrg(doc.id)) return null
  const data = doc.data || {}
  const name = text(data.name) || text(data.companyName) || text(data.organisationName)
  const members = data.members && typeof data.members === 'object' ? Object.keys(data.members as object) : []
  const billing = data.billing && typeof data.billing === 'object' ? (data.billing as Record<string, unknown>) : null
  const deletion = organizationDeletionState(data, nowMs)
  return {
    id: doc.id,
    name: name || 'Unnamed organisation',
    unfinished: isUnfinishedSetupName(name),
    createdAtMs: timeMs(data.createdAt),
    memberCount: members.length,
    billingStatus: billing && text(billing.status) ? text(billing.status) : null,
    billingInterval: billing && text(billing.billingInterval) ? text(billing.billingInterval) : null,
    lapsed: billing ? !hasAccess(billing as OrgBillingAccessInput, nowMs) : false,
    deletion: deletion.state,
    eraseAfterMs: deletion.state === 'scheduled' ? deletion.eraseAfterMs : null,
    isTest: isTestOrganisation(data),
    trialEndMs: billing ? timeMs(billing.trialEnd) : null,
    mrrPence: billing && typeof billing.mrrPence === 'number' && Number.isFinite(billing.mrrPence) ? billing.mrrPence : null,
    cancelAtPeriodEnd: billing?.cancelAtPeriodEnd === true,
    lastPaymentFailedAtMs: billing ? timeMs(billing.lastPaymentFailedAt) : null,
  }
}

export function ownerOrgRows(docs: readonly PlainDoc[], nowMs = Date.now()): OwnerOrgRow[] {
  return docs.map((doc) => ownerOrgRow(doc, nowMs)).filter((row): row is OwnerOrgRow => Boolean(row))
}

function orgMatchesFilter(row: OwnerOrgRow, filter: OwnerOrgFilter): boolean {
  if (filter === 'test') return row.isTest
  if (filter === 'scheduled') return row.deletion === 'scheduled'
  if (filter === 'lapsed') return row.lapsed
  if (filter === 'unfinished') return row.unfinished
  return true
}

function orgMatchesQuery(row: OwnerOrgRow, needle: string): boolean {
  return !needle || row.name.toLowerCase().includes(needle) || row.id.toLowerCase().includes(needle)
}

export type DirectoryQuery<F, S> = {
  q?: string
  filter?: F
  sort?: S
  includeTestData?: boolean
  cursor?: string | null
  limit?: number
  /** People only: last seen inside this window (the Overview's "Active people" tile, owner console PR 5). */
  seenIn?: { start: Date; end: Date } | null
  /** People only: created inside this window (the Overview's "New people" tile). */
  joinedIn?: { start: Date; end: Date } | null
}

export type DirectoryPage<T> = {
  rows: T[]
  /** Rows after filter and search, before paging. */
  total: number
  nextCursor: string | null
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' })
}

export function selectOwnerOrgs(rows: readonly OwnerOrgRow[], query: DirectoryQuery<OwnerOrgFilter, OwnerOrgSort>): DirectoryPage<OwnerOrgRow> {
  const filter = query.filter || 'all'
  const needle = (query.q || '').trim().toLowerCase()
  const kept = rows.filter(
    (row) =>
      (query.includeTestData || filter === 'test' || !row.isTest) && orgMatchesFilter(row, filter) && orgMatchesQuery(row, needle)
  )
  const sorted = [...kept].sort((a, b) =>
    query.sort === 'created'
      ? (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) || compareText(a.name, b.name) || a.id.localeCompare(b.id)
      : compareText(a.name, b.name) || a.id.localeCompare(b.id)
  )
  return pageRows(sorted, query.cursor, query.limit)
}

// MARK: - People

export type OwnerPeopleFilter = 'all' | RosterSegment | 'test'
export const OWNER_PEOPLE_FILTERS: readonly OwnerPeopleFilter[] = ['all', 'active', 'inactive', 'pending', 'test']
export type OwnerPeopleSort = 'name' | 'lastSeen' | 'created'
export const OWNER_PEOPLE_SORTS: readonly OwnerPeopleSort[] = ['name', 'lastSeen', 'created']

export type OwnerPersonRow = {
  /** The users document the roster keeps for this person (rulebook `rosterPeople`). */
  id: string
  /** Every users document id of the person: the kept one first, then the same-email ids. */
  userIds: string[]
  name: string
  emailMasked: string
  role: string
  segment: RosterSegment
  /** Every organisation any of their users documents names. */
  organizationIds: string[]
  organizationNames: string[]
  lastSeenAtMs: number | null
  createdAtMs: number | null
  ghost: boolean
  isTest: boolean
}

type PersonDoc = {
  id: string
  email: string
  passwordSet: boolean | null
  isActive: boolean | null
  firstName: string | null
  surname: string | null
  admin: boolean
  listed: boolean
  updatedAtMs: number | null
  formerUserIds: string[]
  sameEmailUserIds: string[]
  data: Record<string, unknown>
  organizationId: string
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim() !== '') : []
}

function roleLabel(data: Record<string, unknown>): string {
  if (data.isSuperAdmin === true) return 'Super Admin'
  const role = text(data.role).toLowerCase()
  if (data.adminAccess === true || role === 'admin') return 'Admin'
  if (data.operativeMode === true || role === 'operative') return 'Operative'
  if (data.manager === true || role === 'manager') return 'Manager'
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User'
}

function personDoc(doc: PlainDoc): PersonDoc | null {
  const data = doc.data || {}
  const organizationId = documentOrganizationId(data.organizationId) || ''
  if (isPlatformOwnerSentinelOrg(organizationId)) return null
  const role = text(data.role).toLowerCase()
  return {
    id: doc.id,
    email: text(data.email).toLowerCase(),
    passwordSet: typeof data.passwordSet === 'boolean' ? data.passwordSet : null,
    isActive: typeof data.isActive === 'boolean' ? data.isActive : null,
    firstName: text(data.firstName) || null,
    surname: text(data.surname) || text(data.lastName) || null,
    admin: data.isSuperAdmin === true || data.adminAccess === true || role === 'admin',
    listed: data.adminAccess === true || data.manager === true || data.operativeMode === true,
    updatedAtMs: timeMs(data.updatedAt),
    formerUserIds: stringList(data.formerUserIds),
    sameEmailUserIds: stringList(data.sameEmailUserIds),
    data,
    organizationId,
  }
}

/**
 * The organisations each id is anchored in: every `members` key and the creator (rulebook §1 anchored people,
 * `rosterMembersForOrganization(...).anchoredIds`). Keys are lower case (ids compare without case). The owner can read
 * these maps, unlike a person's membership subcollection. A person is matched under every id they go by
 * (`personIdSet`: own, former and same-email ids), so a member listed under a former invite id still counts
 * (review of #348).
 */
export function organisationMembership(orgDocs: readonly PlainDoc[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const org of orgDocs) {
    if (!org.id || isPlatformOwnerSentinelOrg(org.id)) continue
    const members = org.data?.members && typeof org.data.members === 'object' ? (org.data.members as Record<string, unknown>) : null
    const { anchoredIds } = rosterMembersForOrganization({
      organizationId: org.id,
      users: [],
      members,
      creatorUserId: typeof org.data?.creatorUserId === 'string' ? org.data.creatorUserId : null,
    })
    for (const id of anchoredIds) {
      const key = id.trim().toLowerCase()
      if (!key) continue
      const list = out.get(key) || []
      if (!list.includes(org.id)) list.push(org.id)
      out.set(key, list)
    }
  }
  return out
}

/**
 * One row per person across every organisation: users documents on one email are one person (`rosterPeople`), with
 * every organisation any of them names or is a member of (`members` maps, when `orgDocs` is given). Inactive, pending,
 * ghost and anonymised deleted people all stay (guardrail 3).
 *
 * Test data (D12, review of #348 L6): a person is hidden by default only when **every** users document of theirs is
 * flagged `isInternal`, or when **every** organisation they belong to (home organisation or member) is a test one. A
 * member of a real company stays visible.
 */
export function ownerPeopleRows(
  userDocs: readonly PlainDoc[],
  orgRows: readonly Pick<OwnerOrgRow, 'id' | 'name' | 'isTest'>[],
  orgDocs: readonly PlainDoc[] = []
): OwnerPersonRow[] {
  const docs = userDocs.map(personDoc).filter((doc): doc is PersonDoc => Boolean(doc))
  const { people, userIdAliases } = rosterPeople(docs)
  const memberOf = organisationMembership(orgDocs)
  const orgName = new Map(orgRows.map((org) => [org.id, org.name]))
  const testOrgIds = new Set(orgRows.filter((org) => org.isTest).map((org) => org.id))
  const byKept = new Map<string, PersonDoc[]>()
  for (const doc of docs) {
    const kept = userIdAliases[doc.id] || doc.id
    const list = byKept.get(kept) || []
    list.push(doc)
    byKept.set(kept, list)
  }
  return people.map((person) => {
    const group = byKept.get(person.id) || [person]
    const ids = personIdSet({
      id: person.id,
      email: person.email,
      formerUserIds: [...person.formerUserIds, ...group.flatMap((doc) => doc.formerUserIds)],
      sameEmailUserIds: [...person.sameEmailUserIds, ...group.map((doc) => doc.id)],
    })
    const organizationIds = [
      ...new Set([...group.map((doc) => doc.organizationId), ...ids.flatMap((id) => memberOf.get(id.toLowerCase()) || [])].filter(Boolean)),
    ].sort()
    const lastSeen = group.map((doc) => timeMs(doc.data.lastSeenAt)).filter((ms): ms is number => ms != null)
    const created = group.map((doc) => timeMs(doc.data.createdAt)).filter((ms): ms is number => ms != null)
    const name = rosterPersonName(person.data) || person.email || 'Unknown person'
    return {
      id: person.id,
      userIds: [person.id, ...person.sameEmailUserIds.filter((id) => id !== person.id)],
      name,
      emailMasked: maskEmail(person.email),
      role: roleLabel(person.data),
      segment: rosterSegment(person.data),
      organizationIds,
      organizationNames: organizationIds.map((id) => orgName.get(id) || 'Unknown organisation'),
      lastSeenAtMs: lastSeen.length ? Math.max(...lastSeen) : null,
      createdAtMs: created.length ? Math.min(...created) : null,
      ghost: person.data.ghost === true,
      isTest: isTestPerson({ isInternal: group.every((doc) => doc.data.isInternal === true), organizationIds }, testOrgIds),
      // Used by search only; never returned (see stripPersonSearchKey). Emails are matched from their start only
      // (review of #348 L5), never as a substring of the hidden address.
      _search: [name, ...group.map((doc) => doc.id), ...organizationIds].join(' ').toLowerCase(),
      _emails: [...new Set(group.map((doc) => doc.email).filter(Boolean))],
    } as OwnerPersonRow & { _search: string; _emails: string[] }
  })
}

/** The response row without the server-only search text (which holds the full email). */
export function stripPersonSearchKey(row: OwnerPersonRow): OwnerPersonRow {
  const copy = { ...row } as OwnerPersonRow & { _search?: string; _emails?: string[] }
  delete copy._search
  delete copy._emails
  return copy
}

function personMatchesFilter(row: OwnerPersonRow, filter: OwnerPeopleFilter): boolean {
  if (filter === 'test') return row.isTest
  if (filter === 'all') return true
  return row.segment === filter
}

function inWindow(ms: number | null, window: { start: Date; end: Date } | null | undefined): boolean {
  if (!window) return true
  return ms != null && ms >= window.start.getTime() && ms <= window.end.getTime()
}

function personMatchesQuery(row: OwnerPersonRow, needle: string): boolean {
  if (!needle) return true
  const hidden = row as OwnerPersonRow & { _search?: string; _emails?: string[] }
  if ((hidden._search || `${row.name} ${row.id}`.toLowerCase()).includes(needle)) return true
  if (row.organizationNames.some((name) => name.toLowerCase().includes(needle))) return true
  // An email matches only from its start: a whole local part, the whole address, or a prefix of it.
  return (hidden._emails || []).some((email) => email.startsWith(needle))
}

export function selectOwnerPeople(
  rows: readonly OwnerPersonRow[],
  query: DirectoryQuery<OwnerPeopleFilter, OwnerPeopleSort>
): DirectoryPage<OwnerPersonRow> {
  const filter = query.filter || 'all'
  const needle = (query.q || '').trim().toLowerCase()
  const kept = rows.filter(
    (row) =>
      (query.includeTestData || filter === 'test' || !row.isTest) &&
      personMatchesFilter(row, filter) &&
      personMatchesQuery(row, needle) &&
      inWindow(row.lastSeenAtMs, query.seenIn) &&
      inWindow(row.createdAtMs, query.joinedIn)
  )
  const sorted = [...kept].sort((a, b) => {
    if (query.sort === 'lastSeen') return (b.lastSeenAtMs ?? 0) - (a.lastSeenAtMs ?? 0) || compareText(a.name, b.name)
    if (query.sort === 'created') return (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) || compareText(a.name, b.name)
    return compareText(a.name, b.name) || a.id.localeCompare(b.id)
  })
  const page = pageRows(sorted, query.cursor, query.limit)
  return { ...page, rows: page.rows.map(stripPersonSearchKey) }
}

// MARK: - Paging

/** An opaque cursor: the next offset, base64url. A bad cursor reads as the first page. */
export function encodeDirectoryCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), 'utf8').toString('base64url')
}

export function decodeDirectoryCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { o?: unknown }
    return typeof parsed.o === 'number' && Number.isInteger(parsed.o) && parsed.o >= 0 ? parsed.o : 0
  } catch {
    return 0
  }
}

export function directoryLimit(raw: unknown): number {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return DIRECTORY_PAGE_DEFAULT
  return Math.min(DIRECTORY_PAGE_MAX, Math.floor(value))
}

export function pageRows<T>(rows: readonly T[], cursor: string | null | undefined, limit?: number): DirectoryPage<T> {
  const size = directoryLimit(limit)
  const start = Math.min(decodeDirectoryCursor(cursor), rows.length)
  const end = start + size
  return { rows: rows.slice(start, end), total: rows.length, nextCursor: end < rows.length ? encodeDirectoryCursor(end) : null }
}

/** Reads one allowed value of a query parameter; anything else is the default. */
export function oneOf<T extends string>(raw: string | null | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(raw || '') ? (raw as T) : fallback
}

// MARK: - Search (⌘K)

export type OwnerSearchResult = {
  query: string
  organisations: OwnerOrgRow[]
  people: OwnerPersonRow[]
}

/** Organisations and people by name, email, organisation id or user id; the top SEARCH_RESULT_LIMIT of each. */
export function ownerSearch(
  orgRows: readonly OwnerOrgRow[],
  personRows: readonly OwnerPersonRow[],
  rawQuery: string,
  includeTestData: boolean
): OwnerSearchResult {
  const query = rawQuery.trim()
  if (query.length < SEARCH_MIN_LENGTH) return { query, organisations: [], people: [] }
  const organisations = selectOwnerOrgs(orgRows, { q: query, includeTestData, limit: SEARCH_RESULT_LIMIT }).rows
  const people = selectOwnerPeople(personRows, { q: query, includeTestData, limit: SEARCH_RESULT_LIMIT }).rows
  return { query, organisations, people }
}
