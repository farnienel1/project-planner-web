'use client'

import { useMemo } from 'react'
import { create } from 'zustand'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore'
import { isRetryableAuthLoadError } from '@/lib/auth/authBoot'
import { isTimeoutError, withTimeout } from '@/lib/client/withTimeout'
import { db } from '@/lib/firebase/config'
import { subscribeOrgCollectionLoaded } from '@/lib/firebase/subscribeOrgCollection'
import { liveResultStillCurrent } from '@/lib/firebase/liveResult'
import { readOrganizationDocument } from '@/lib/firebase/orgDocumentCache'
import { UserRole, type SiteAudit, type SiteAuditItem, type User } from '@/types'
import { parseOrgUser } from '@/lib/firebase/parseUser'
import { aliasIdsForRoster, dedupeUsersByEmail } from '@/lib/staff/userRosterUtils'
import { mergeRetainedRoster, missingOrganizationIdPatch, retainScopedRows, rosterParseRecord } from '@/lib/staff/rosterRetain'
import {
  catalogueRowNeedsRead,
  explicitAccountIds,
  rosterLoadFailure,
  shouldRetryRosterLoad,
} from '@/lib/staff/rosterWaves'
import {
  isOrgLoadInFlight,
  optionsForUnappliedOrg,
  OrgLoadNotCached,
  runOrgLoad,
  invalidateOrgLoad,
  shouldSkipOrgLoad,
} from '@/lib/stores/orgLoadCache'
import { newUuid } from '@/lib/firebase/firestoreUtils'
import { mergeStoredRows, parseSiteAuditDocument, siteAuditWriteFields } from '@/lib/canonical'
import { organizationLevelFor } from '@/lib/canonical/orgRoster'
import { effectivePermissions } from '@/lib/canonical/permissionLevels'
import { savePartialDocument } from '@/lib/firebase/partialWrite'
import { inboxActorUserId } from '@/lib/firebase/notifyInbox'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { overlayRosterPay, refreshPayProfiles } from '@/lib/pay/payProfileOverlay'

/** `siteAudits/{id}` through the rulebook reader `parseSiteAuditDocument` (rulebook 1.8.0). */
function mapSiteAudit(docId: string, data: Record<string, unknown>): SiteAudit | null {
  const parsed = parseSiteAuditDocument(docId, data, { timeZone: organizationZoneOr() })
  if (!parsed) return null
  const createdAt = parsed.createdAtMs != null ? new Date(parsed.createdAtMs) : new Date()
  return {
    id: parsed.id,
    projectId: parsed.projectId,
    projectJobNumber: parsed.projectJobNumber,
    projectName: parsed.projectName,
    type: parsed.type,
    customTitle: parsed.customTitle || undefined,
    authorName: parsed.authorName,
    date: parsed.dateMs != null ? new Date(parsed.dateMs) : createdAt,
    createdByUserId: parsed.createdByUserId,
    visibleToOperatives: parsed.visibleToOperatives,
    items: parsed.items.map((item) => ({
      id: item.id,
      title: item.title,
      location: item.location,
      assignee: item.assignee,
      comments: item.comments,
      annotations: item.annotations || undefined,
      imageURL: item.imageURL ?? undefined,
      createdAt: item.createdAtMs != null ? new Date(item.createdAtMs) : createdAt,
    })),
    createdAt,
  }
}

export type SaveSiteAuditInput = {
  id?: string
  projectId: string
  projectJobNumber: string
  projectName: string
  type: string
  customTitle?: string
  authorName: string
  date: Date
  createdByUserId: string
  visibleToOperatives: boolean
  items: (Omit<SiteAuditItem, 'id' | 'createdAt'> & { id?: string; createdAt?: Date })[]
}

interface SiteAuditState {
  audits: SiteAudit[]
  loading: boolean
  error: string | null
  loadAudits: (organizationId: string) => Promise<void>
  saveAudit: (organizationId: string, input: SaveSiteAuditInput) => Promise<string>
}

let siteAuditOrgId = ''

export const useSiteAuditStore = create<SiteAuditState>((set, get) => ({
  audits: [],
  loading: false,
  error: null,

  saveAudit: async (organizationId, input) => {
    const auditId = input.id || newUuid()
    const now = new Date()
    const ref = doc(db, 'organizations', organizationId, 'siteAudits', auditId)
    // Rulebook 1.8.0 §1: a partial update (`siteAuditWriteFields`): `createdAt` and the author are never rewritten,
    // and each item is laid over its stored row (`mergeStoredRows`) so iOS-only item fields (`imageCapturedAt`) stay.
    const stored = await getDoc(ref)
    const storedItems = stored.exists() ? (stored.data() as Record<string, unknown>).items : []
    const items = mergeStoredRows(
      storedItems,
      input.items.map((item) => ({
        id: item.id || newUuid(),
        title: item.title,
        location: item.location,
        assignee: item.assignee,
        comments: item.comments,
        annotations: item.annotations || '',
        imageURL: item.imageURL || null,
        createdAt: Timestamp.fromDate(item.createdAt || now),
      }))
    )
    const payload = {
      id: auditId,
      organizationId,
      projectId: input.projectId,
      projectJobNumber: input.projectJobNumber,
      projectName: input.projectName,
      type: input.type,
      customTitle: input.customTitle?.trim() || '',
      authorName: input.authorName,
      date: Timestamp.fromDate(input.date),
      createdAt: Timestamp.fromDate(now),
      createdByUserId: input.createdByUserId,
      visibleToOperatives: input.visibleToOperatives,
      items,
    }
    await savePartialDocument(ref, payload, siteAuditWriteFields, { userId: inboxActorUserId() || input.createdByUserId })
    const storedCreatedAt = stored.exists() ? (stored.data() as Record<string, unknown>).createdAt : undefined
    const mapped = mapSiteAudit(auditId, { ...payload, createdAt: storedCreatedAt ?? payload.createdAt })
    if (mapped) {
      set({ audits: [mapped, ...get().audits.filter((a) => a.id !== auditId)] })
    }
    return auditId
  },

  loadAudits: async (organizationId) => {
    if (!organizationId) return
    if (siteAuditOrgId !== organizationId || get().audits.length === 0) set({ loading: true, error: null })
    else set({ error: null })
    try {
      // Rulebook 1.9.0 §1 (`LIVE_COLLECTIONS`): a live listener; the load resolves on its first snapshot.
      await subscribeOrgCollectionLoaded('siteAuditStore:audits', organizationId, 'siteAudits', (docs, meta) => {
        if (!liveResultStillCurrent(organizationId)) return
        const mapped = docs
          .map((entry) => mapSiteAudit(entry.id, entry.data))
          .filter((item): item is SiteAudit => item !== null)
          .sort((a, b) => b.date.getTime() - a.date.getTime())
        const previous = siteAuditOrgId === organizationId ? get().audits : []
        const audits = retainScopedRows(`siteAudits:${organizationId}`, previous, mapped, meta)
        siteAuditOrgId = organizationId
        set({ audits, loading: false })
      })
      set({ loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load site audits', loading: false })
      throw error
    }
  },
}))

function mapOrgUser(docId: string, data: Record<string, unknown>): User | null {
  return parseOrgUser(docId, data)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function userForThisOrganisation(id: string, data: Record<string, unknown>, organizationId: string, allowNamedOrg = false): User | null {
  // Rulebook 1.26.0 §8: pay is read pay profile first (`overlayPayProfile`), the users document second.
  const prepared = rosterParseRecord(overlayRosterPay(organizationId, id, data), organizationId, { allowNamedOrg })
  if (!prepared) return null
  return mapOrgUser(id, prepared)
}

/**
 * Rulebook 1.11.0 `organizationLevelFor`: a member whose users document names another company gets their level in
 * THIS organisation from its members entry (the creator is super admin), never from the other company's flags.
 */
function withOrganizationLevel(
  user: User,
  data: Record<string, unknown>,
  organizationId: string,
  members: Record<string, unknown>,
  creatorUserId: string
): User {
  const level = organizationLevelFor({
    organizationId,
    userId: user.id,
    user: data,
    membersRole: members[user.id],
    creatorUserId,
  })
  if (level.source === 'users') return user
  const permissions = effectivePermissions({ role: level.level, isSuperAdmin: level.isSuperAdmin }, level.level)
  const role = level.level === 'admin' ? UserRole.ADMIN : level.level === 'operative' ? UserRole.OPERATIVE : UserRole.MANAGER
  return { ...user, role, isSuperAdmin: level.isSuperAdmin, permissions: { ...user.permissions, ...permissions } }
}


async function fetchOrganisationRoster(
  organizationId: string,
  options?: { finalAttempt?: boolean }
): Promise<{
  users: User[]
  complete: boolean
  presentIds: Set<string>
  presentEmails: Set<string>
  /** `userEmails` document ids after a successful read. Null when that read failed. */
  claimedEmails: string[] | null
  /** People the `users where organizationId ==` query did not return (members of another current company). */
  fallbackIds: string[]
}> {
  const collected: User[] = []
  const queriedIds = new Set<string>()
  const presentIds = new Set<string>()
  const presentEmails = new Set<string>()
  let complete = true
  let firstFailure: unknown = null
  let listedMemberCount = 0
  const noteFailure = (reason: unknown) => {
    complete = false
    if (firstFailure == null) firstFailure = reason
  }

  const remember = (user: User | null) => {
    if (!user) return
    const withOrg = user.organizationId ? user : { ...user, organizationId }
    const email = withOrg.email.trim().toLowerCase()
    if (collected.some((row) => row.id === withOrg.id)) {
      presentIds.add(withOrg.id)
      if (email) presentEmails.add(email)
      return
    }
    collected.push(withOrg)
    presentIds.add(withOrg.id)
    if (email) presentEmails.add(email)
  }

  const loadUserDocument = async (id: string, allowNamedOrg = false): Promise<User | null> => {
    if (!id) return null
    try {
      const [snap, membership] = await Promise.all([
        getDoc(doc(db, 'users', id)),
        getDoc(doc(db, 'users', id, 'orgMemberships', organizationId)).catch(() => null),
      ])
      if (!snap.exists()) return null
      const data = snap.data() as Record<string, unknown>
      const membershipStatus = membership?.exists() ? membership.data()?.status : undefined
      const status =
        membershipStatus === 'pending'
          ? 'pending'
          : membershipStatus === 'active'
            ? 'active'
            : data.status
      const user = userForThisOrganisation(
        snap.id,
        status ? { ...data, status } : data,
        organizationId,
        allowNamedOrg
      )
      return user
    } catch {
      return null
    }
  }

  // Rulebook 1.23.1 §11 (owner 3A): a `managers` row only finds the person's users document; it never sets
  // `manager: true` on it. Which list a person is on is their level (`rosterListFor`), the same on iOS.
  const noteUser = (user: User | null, _kind?: 'manager') => {
    if (!user) return
    remember(user)
  }

  const userIdForEmail = async (email: string): Promise<string> => {
    const needle = email.trim().toLowerCase()
    if (!needle) return ''
    try {
      const pointer = await getDoc(doc(db, 'organizations', organizationId, 'userEmails', needle))
      const userId = pointer.exists() ? text(pointer.data().userId) : ''
      if (userId) return userId
    } catch {
      /* The users query below still runs. */
    }
    const variants = email.trim() === needle ? [needle] : [needle, email.trim()]
    for (const variant of variants) {
      try {
        const snapshot = await getDocs(query(collection(db, 'users'), where('email', '==', variant), limit(5)))
        for (const entry of snapshot.docs) {
          const user = userForThisOrganisation(entry.id, entry.data() as Record<string, unknown>, organizationId, true)
          if (user) return user.id
        }
      } catch {
        /* Try the next spelling. */
      }
    }
    return ''
  }

  const cachedUser = (id: string): User | undefined => collected.find((row) => row.id === id)

  const cachedUserByEmail = (email: string): User | undefined => {
    const needle = email.trim().toLowerCase()
    if (!needle) return undefined
    return collected.find((row) => row.email.trim().toLowerCase() === needle)
  }

  /**
   * A project open used to read every manager document and then read that
   * person's user document again, even when the organisation query had already
   * returned them. Use the rows already in memory first.
   */
  const resolveRosterLink = async (entryId: string, data: Record<string, unknown>): Promise<User | null> => {
    const email = text(data.email)
    const explicitIds = [text(data.userId), text(data.userID), text(data.uid), text(data.linkedUserId)].filter(
      (id, index, all) => id !== '' && all.indexOf(id) === index
    )
    const cachedExplicit = explicitIds.map((id) => cachedUser(id)).find((row): row is User => Boolean(row))
    if (cachedExplicit) return cachedExplicit
    const cachedEmail = cachedUserByEmail(email)
    if (explicitIds.length === 0 && cachedEmail) return cachedEmail

    const linkedIds = [...explicitIds, entryId].filter((id, index, all) => id !== '' && all.indexOf(id) === index)
    for (const id of linkedIds) {
      const cached = cachedUser(id)
      if (cached) return cached
      const user = await loadUserDocument(id, true)
      if (user) return user
    }
    if (cachedEmail) return cachedEmail
    const userId = await userIdForEmail(email)
    if (!userId) return null
    return cachedUser(userId) || loadUserDocument(userId, true)
  }

  const readTogether = async <T>(
    items: readonly T[],
    read: (item: T, index: number) => Promise<void>
  ): Promise<void> => {
    let cursor = 0
    const workers = Array.from({ length: Math.min(8, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor
        cursor += 1
        await read(items[index], index)
      }
    })
    await Promise.all(workers)
  }

  // Wave 1: every source that does not depend on another read, all at once.
  // This used to be a chain of a dozen round trips (three users queries, the
  // organisation document, each member, userEmails, operatives, managers, then
  // a per-person lookup), so the roster — and every page that waits for it —
  // took seconds on a cold session.
  type CatalogueEntry = { id: string; data: Record<string, unknown>; kind?: 'manager' }
  const [usersResult, orgResult, emailsResult, operativesResult, managersResult] = await Promise.allSettled([
    getDocs(query(collection(db, 'users'), where('organizationId', '==', organizationId))),
    readOrganizationDocument(db, organizationId),
    getDocs(collection(db, 'organizations', organizationId, 'userEmails')),
    getDocs(collection(db, 'organizations', organizationId, 'operatives')),
    getDocs(collection(db, 'organizations', organizationId, 'managers')),
  ])

  // The first read after sign-in can be refused before Firestore holds the ID
  // token. Hand that failure back so runOrgLoad retries the whole load instead
  // of caching a roster built only from the fallbacks (or nothing at all).
  if (
    shouldRetryRosterLoad({
      usersQueryFailure: usersResult.status === 'rejected' ? usersResult.reason : null,
      finalAttempt: options?.finalAttempt === true,
    })
  ) {
    throw usersResult.status === 'rejected' ? usersResult.reason : new Error('Failed to load users')
  }

  if (usersResult.status === 'fulfilled') {
    for (const entry of usersResult.value.docs) {
      queriedIds.add(entry.id)
      remember(userForThisOrganisation(entry.id, entry.data() as Record<string, unknown>, organizationId, true))
    }
  } else {
    noteFailure(usersResult.reason)
  }

  const memberIds: string[] = []
  let orgMembers: Record<string, unknown> = {}
  let orgCreatorUserId = ''
  if (orgResult.status === 'fulfilled') {
    const members = (orgResult.value.data()?.members ?? {}) as Record<string, unknown>
    orgMembers = members
    orgCreatorUserId = text(orgResult.value.data()?.creatorUserId)
    // Rulebook 1.11.0 `rosterMembersForOrganization`: the anchored people are the members keys and the creator.
    const listedIds = [...Object.keys(members), orgCreatorUserId].filter((id, index, all) => Boolean(id) && all.indexOf(id) === index)
    listedMemberCount = listedIds.length
    for (const id of listedIds) {
      if (!presentIds.has(id)) memberIds.push(id)
    }
  } else {
    noteFailure(orgResult.reason)
  }

  const emailUserIds: string[] = []
  let claimedEmails: string[] | null = null
  if (emailsResult.status === 'fulfilled') {
    claimedEmails = []
    for (const entry of emailsResult.value.docs) {
      const claim = entry.id.trim().toLowerCase()
      if (claim) claimedEmails.push(claim)
      const userId = text(entry.data().userId)
      if (userId && !presentIds.has(userId) && !memberIds.includes(userId) && !emailUserIds.includes(userId)) {
        emailUserIds.push(userId)
      }
    }
  } else {
    noteFailure(emailsResult.reason)
  }

  const catalogue: CatalogueEntry[] = []
  if (operativesResult.status === 'fulfilled') {
    for (const entry of operativesResult.value.docs) {
      catalogue.push({ id: entry.id, data: entry.data() as Record<string, unknown> })
    }
  } else {
    noteFailure(operativesResult.reason)
  }
  if (managersResult.status === 'fulfilled') {
    for (const entry of managersResult.value.docs) {
      catalogue.push({ id: entry.id, data: entry.data() as Record<string, unknown>, kind: 'manager' })
    }
  } else {
    noteFailure(managersResult.reason)
  }

  // Wave 2: only the people wave 1 did not already return.
  const memberRows: Array<User | null | 'failed'> = new Array(memberIds.length)
  let memberReadFailure: unknown = null
  const emailUsers: Array<User | null> = new Array(emailUserIds.length)
  await Promise.all([
    readTogether(memberIds, async (id, index) => {
      try {
        const snap = await getDoc(doc(db, 'users', id))
        if (!snap.exists()) {
          memberRows[index] = null
          return
        }
        const data = snap.data() as Record<string, unknown>
        const patch = missingOrganizationIdPatch(data, organizationId, true)
        const row = userForThisOrganisation(snap.id, patch ? { ...data, ...patch } : data, organizationId, true)
        memberRows[index] = row ? withOrganizationLevel(row, patch ? { ...data, ...patch } : data, organizationId, orgMembers, orgCreatorUserId) : row
      } catch (error) {
        if (memberReadFailure == null) memberReadFailure = error
        memberRows[index] = 'failed'
      }
    }),
    readTogether(emailUserIds, async (userId, index) => {
      emailUsers[index] = await loadUserDocument(userId, true)
    }),
  ])
  for (const row of memberRows) {
    if (row === 'failed') {
      noteFailure(memberReadFailure ?? new Error('A member document could not be read'))
      continue
    }
    noteUser(row)
  }
  for (const user of emailUsers) noteUser(user)

  // Catalogue rows (operatives / managers) link to an account by id or email.
  // When every source above answered, an entry that names no account id and
  // matches nobody has no account, so there is nothing more to read for it.
  // An entry that does name an account id is still read: that person's user
  // document can name another organisation (it records the company they last
  // opened), and they may be on neither the members map nor userEmails.
  // An incomplete wave falls back to the full per-entry lookup.
  const catalogueLink = (entry: CatalogueEntry): User | null => {
    for (const id of [...explicitAccountIds(entry.data), entry.id]) {
      const cached = id ? cachedUser(id) : undefined
      if (cached) return cached
    }
    return cachedUserByEmail(text(entry.data.email)) ?? null
  }
  const explicitOnly = async (entry: CatalogueEntry): Promise<User | null> => {
    for (const id of explicitAccountIds(entry.data)) {
      const user = cachedUser(id) ?? (await loadUserDocument(id, true))
      if (user) return user
    }
    return null
  }
  const unresolved: CatalogueEntry[] = []
  for (const entry of catalogue) {
    const linked = catalogueLink(entry)
    if (linked) noteUser(linked, entry.kind)
    else if (catalogueRowNeedsRead({ complete, data: entry.data })) unresolved.push(entry)
  }
  if (unresolved.length > 0) {
    const lateUsers: Array<User | null> = new Array(unresolved.length)
    await readTogether(unresolved, async (entry, index) => {
      lateUsers[index] = complete ? await explicitOnly(entry) : await resolveRosterLink(entry.id, entry.data)
    })
    unresolved.forEach((entry, index) => noteUser(lateUsers[index], entry.kind))
  }

  // A denied or empty read is not an empty company when this organisation has
  // members. The failure is retryable so the first open of Manage users loads
  // again once auth is ready. Profiles that share an email are all kept; the
  // store maps the duplicates with aliasIdsForRoster.
  const failure = rosterLoadFailure({ collectedCount: collected.length, complete, firstFailure, listedMemberCount })
  if (failure) throw failure
  return {
    users: collected,
    complete,
    presentIds,
    presentEmails,
    claimedEmails,
    fallbackIds: collected.map((user) => user.id).filter((id) => !queriedIds.has(id)),
  }
}

async function confirmMissingUserDocuments(
  previous: User[],
  presentIds: Set<string>,
  presentEmails: Set<string>
): Promise<Set<string>> {
  const missing = previous.filter((user) => {
    if (presentIds.has(user.id)) return false
    const email = user.email.trim().toLowerCase()
    if (email && presentEmails.has(email)) return false
    return true
  })
  const confirmed = new Set<string>()
  await Promise.all(
    missing.map(async (user) => {
      try {
        const snap = await getDoc(doc(db, 'users', user.id))
        if (!snap.exists()) confirmed.add(user.id)
      } catch {
        /* Not confirmed gone — keep them on the roster. */
      }
    })
  )
  return confirmed
}

// ─── Live roster ────────────────────────────────────────────────────────────
// The full roster load above stays the source of who is on the list (members map, userEmails,
// catalogue links, the canonical fold downstream). After it lands, listeners keep the rows live:
// the `users where organizationId ==` query, one document listener per person that query does
// not return (the per-member fallback reads), and `userEmails`. A change to a listed person is
// applied in place; anything that can change who is listed (a removed document, a new email
// claim) schedules one forced reload of the full roster.
let liveRosterOrgId = ''
let liveRosterUnsubs: Unsubscribe[] = []
let liveFallbackKey = ''
let liveReloadTimer: ReturnType<typeof setTimeout> | null = null
const LIVE_FALLBACK_LIMIT = 60

function stopLiveRoster(): void {
  for (const unsub of liveRosterUnsubs) unsub()
  liveRosterUnsubs = []
  liveRosterOrgId = ''
  liveFallbackKey = ''
  if (liveReloadTimer) clearTimeout(liveReloadTimer)
  liveReloadTimer = null
}

function scheduleLiveRosterReload(organizationId: string): void {
  if (liveReloadTimer) clearTimeout(liveReloadTimer)
  liveReloadTimer = setTimeout(() => {
    liveReloadTimer = null
    if (liveRosterOrgId !== organizationId) return
    void useOrgUserStore.getState().loadUsers(organizationId, { force: true }).catch(() => undefined)
  }, 1500)
}

function sortRoster(users: User[]): User[] {
  return [...users].sort((a, b) => {
    if (a.isSuperAdmin !== b.isSuperAdmin) return a.isSuperAdmin ? -1 : 1
    return a.email.localeCompare(b.email)
  })
}

/**
 * Rulebook 1.30.2 §11: every users document of the roster, NOT folded by email. `users` keeps one document per email
 * (`rosterPeople`, admin first), so a stale admin copy can stand in for a live manager; the job-manager picker
 * (`jobManagerCandidates`) and Change user type (`accountTypeChangeWrites`, every same-email document) need them all.
 */
function upsertRosterDocuments(organizationId: string, rows: readonly User[], replace = false): void {
  const state = useOrgUserStore.getState()
  const current = !replace && state.rosterDocumentsOrgId === organizationId ? state.rosterDocuments : []
  const byId = new Map(current.map((row) => [row.id, row]))
  for (const row of rows) byId.set(row.id, row)
  useOrgUserStore.setState({ rosterDocuments: [...byId.values()], rosterDocumentsOrgId: organizationId })
}

function applyLiveRosterRows(organizationId: string, rows: User[]): void {
  if (rows.length === 0 || listedRosterOrgId !== organizationId || liveRosterOrgId !== organizationId) return
  upsertRosterDocuments(organizationId, rows)
  const state = useOrgUserStore.getState()
  const users = [...state.users]
  let changed = false
  for (const incoming of rows) {
    const row = incoming
    const index = users.findIndex((existing) => existing.id === row.id)
    if (index < 0) {
      users.push(row)
      changed = true
      continue
    }
    if (JSON.stringify(users[index]) !== JSON.stringify(row)) {
      users[index] = row
      changed = true
    }
  }
  if (!changed) return
  // 1.14.0: the full load keeps one profile per email (`dedupeUsersByEmail`, the rulebook's `rosterPeople` fold). The
  // listener's first snapshot (and any edit to the other document, e.g. `accountTypeChangeWrites` updating every
  // same-email users doc) used to push the folded-away document back, so pickers listed the person twice.
  const sorted = sortRoster(dedupeUsersByEmail(users))
  writeStoredRoster(organizationId, sorted)
  useOrgUserStore.setState({
    users: sorted,
    userIdAliases: { ...state.userIdAliases, ...aliasIdsForRoster(users) },
  })
}

function startLiveRoster(organizationId: string, fallbackIds: string[]): void {
  if (!db || typeof window === 'undefined') return
  const fallback = [...new Set(fallbackIds.filter(Boolean))].slice(0, LIVE_FALLBACK_LIMIT).sort()
  const fallbackKey = fallback.join('|')
  if (liveRosterOrgId === organizationId && liveFallbackKey === fallbackKey && liveRosterUnsubs.length > 0) return
  stopLiveRoster()
  liveRosterOrgId = organizationId
  liveFallbackKey = fallbackKey
  const stillLive = () => liveRosterOrgId === organizationId

  liveRosterUnsubs.push(
    onSnapshot(
      query(collection(db, 'users'), where('organizationId', '==', organizationId)),
      (snap) => {
        if (!stillLive()) return
        const rows: User[] = []
        let removed = false
        for (const change of snap.docChanges()) {
          if (change.type === 'removed') {
            removed = true
            continue
          }
          const user = userForThisOrganisation(
            change.doc.id,
            change.doc.data() as Record<string, unknown>,
            organizationId,
            true
          )
          if (user) rows.push(user.organizationId ? user : { ...user, organizationId })
        }
        applyLiveRosterRows(organizationId, rows)
        // A document leaving the query moved company or was deleted: the full load decides.
        if (removed && !snap.metadata.fromCache) scheduleLiveRosterReload(organizationId)
      },
      () => {
        /* The roster already on screen stands; the next visit reloads it. */
      }
    )
  )

  for (const id of fallback) {
    liveRosterUnsubs.push(
      onSnapshot(
        doc(db, 'users', id),
        (snap) => {
          if (!stillLive()) return
          if (!snap.exists()) {
            if (!snap.metadata.fromCache) scheduleLiveRosterReload(organizationId)
            return
          }
          const user = userForThisOrganisation(snap.id, snap.data() as Record<string, unknown>, organizationId, true)
          if (user) applyLiveRosterRows(organizationId, [user.organizationId ? user : { ...user, organizationId }])
        },
        () => undefined
      )
    )
  }

  let firstClaims = true
  liveRosterUnsubs.push(
    onSnapshot(
      collection(db, 'organizations', organizationId, 'userEmails'),
      (snap) => {
        if (!stillLive()) return
        const claims = snap.docs.map((entry) => entry.id.trim().toLowerCase()).filter(Boolean)
        const known = new Set(useOrgUserStore.getState().users.map((user) => user.id))
        const unknownClaim = snap.docs.some((entry) => {
          const userId = text(entry.data().userId)
          return userId !== '' && !known.has(userId)
        })
        if (!snap.metadata.fromCache) useOrgUserStore.setState({ claimedEmails: claims })
        if (!firstClaims && !snap.metadata.fromCache && (unknownClaim || snap.docChanges().some((c) => c.type === 'removed'))) {
          scheduleLiveRosterReload(organizationId)
        }
        if (!snap.metadata.fromCache) firstClaims = false
      },
      () => undefined
    )
  )
}

interface OrgUserState {
  users: User[]
  loading: boolean
  error: string | null
  /** Organisation whose roster load has finished. Empty users before this is still loading. */
  rosterLoadedOrgId: string | null
  /**
   * Document ids from `organizations/{orgId}/userEmails` after a successful
   * collection read. Null when that read has not finished or failed — people
   * lists must then keep a pending invite rather than drop it.
   */
  claimedEmails: string[] | null
  /** Duplicate profile ids that share an email, pointing at the account kept on the roster. */
  userIdAliases: Record<string, string>
  /** Rulebook 1.30.2: every users document loaded for `rosterDocumentsOrgId`, not folded by email. */
  rosterDocuments: User[]
  rosterDocumentsOrgId: string | null
  loadUsers: (organizationId: string, options?: { force?: boolean }) => Promise<void>
  patchListedUser: (user: User) => void
  setListedUserActive: (userId: string, isActive: boolean) => void
}

let listedUserRevision = 0
let listedRosterOrgId = ''
let rosterLoadGeneration = 0
const ORG_USER_LOAD_KEY = 'orgUserStore:users'

function rosterStorageKey(organizationId: string): string {
  return `pp.roster:${organizationId}`
}

function readStoredRoster(organizationId: string): User[] {
  if (typeof sessionStorage === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(rosterStorageKey(organizationId))
    if (!raw) return []
    const rows = JSON.parse(raw) as User[]
    if (!Array.isArray(rows)) return []
    return rows.flatMap((row) => {
      if (!row || typeof row.id !== 'string') return []
      const createdAt = new Date(row.createdAt)
      const updatedAt = new Date(row.updatedAt)
      // Invented roster rows used the epoch. They are not user accounts.
      if (createdAt.getTime() === 0 && updatedAt.getTime() === 0) return []
      const permissions = { ...row.permissions }
      const admin = row.isSuperAdmin || permissions.adminAccess || row.role === 'admin'
      if (admin) permissions.operativeMode = false
      const revive = (value: unknown): Date | undefined => {
        if (value == null || value === '') return undefined
        const parsed = new Date(value as string | number | Date)
        return Number.isNaN(parsed.getTime()) ? undefined : parsed
      }
      return [
        {
          ...row,
          createdAt,
          updatedAt,
          employmentTypeEffectiveAt: revive(row.employmentTypeEffectiveAt),
          lastSeenAt: revive(row.lastSeenAt),
          policyAcceptedAt: revive(row.policyAcceptedAt),
          permissions,
          role: admin && row.role === UserRole.OPERATIVE ? UserRole.ADMIN : row.role,
        },
      ]
    })
  } catch {
    return []
  }
}

function writeStoredRoster(organizationId: string, users: User[]): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    if (users.length === 0) {
      // An empty read must not wipe the last roster. The next visit still has people to show.
      return
    }
    sessionStorage.setItem(rosterStorageKey(organizationId), JSON.stringify(users))
  } catch {
    /* The in-memory roster still stands when storage is full or blocked. */
  }
}

export const useOrgUserStore = create<OrgUserState>((set, get) => ({
  users: [],
  loading: false,
  error: null,
  rosterLoadedOrgId: null,
  claimedEmails: null,
  userIdAliases: {},
  rosterDocuments: [],
  rosterDocumentsOrgId: null,

  loadUsers: async (organizationId, options?: { force?: boolean }) => {
    const revisionAtStart = listedUserRevision
    // The org-load cache can still be warm after the in-memory roster was cleared.
    // Put the last roster back before that skip, or Warnings scans nobody and shows
    // "No active warnings".
    if (get().rosterLoadedOrgId !== organizationId && get().users.length === 0) {
      const stored = readStoredRoster(organizationId)
      if (stored.length > 0) {
        listedRosterOrgId = organizationId
        set({
          users: stored,
          loading: false,
          error: null,
          rosterLoadedOrgId: organizationId,
          claimedEmails: null,
        })
      }
    }
    const loadOptions = optionsForUnappliedOrg(
      ORG_USER_LOAD_KEY,
      organizationId,
      get().rosterLoadedOrgId === organizationId,
      options
    )
    const willLoad = !shouldSkipOrgLoad(ORG_USER_LOAD_KEY, organizationId, loadOptions)
    if (willLoad) {
      const inMemory = listedRosterOrgId === organizationId ? get().users : []
      const previous = inMemory.length > 0 ? inMemory : readStoredRoster(organizationId)
      if (inMemory.length === 0 && previous.length > 0) {
        listedRosterOrgId = organizationId
        set({ users: previous, loading: true, error: null })
      } else {
        set({ loading: true, error: null })
      }
    }

    await runOrgLoad(
      ORG_USER_LOAD_KEY,
      organizationId,
      async (attempt) => {
        const generation = ++rosterLoadGeneration
        const inMemory = listedRosterOrgId === organizationId ? get().users : []
        const previous = inMemory.length > 0 ? inMemory : readStoredRoster(organizationId)
        const applyLoaded = async (loaded: Awaited<ReturnType<typeof fetchOrganisationRoster>>) => {
          if (generation !== rosterLoadGeneration) throw new OrgLoadNotCached()
          const live = listedRosterOrgId === organizationId ? get().users : []
          if (revisionAtStart !== listedUserRevision && live.length > 0) {
            set({ loading: false })
            throw new OrgLoadNotCached()
          }
          const baseline = live.length > previous.length ? live : previous
          const confirmedMissing = loaded.complete
            ? await confirmMissingUserDocuments(baseline, loaded.presentIds, loaded.presentEmails)
            : new Set<string>()
          if (generation !== rosterLoadGeneration || revisionAtStart !== listedUserRevision) {
            if (generation === rosterLoadGeneration) set({ loading: false })
            throw new OrgLoadNotCached()
          }
          const users = mergeRetainedRoster(baseline, loaded.users, confirmedMissing).sort((a, b) => {
            if (a.isSuperAdmin !== b.isSuperAdmin) return a.isSuperAdmin ? -1 : 1
            return a.email.localeCompare(b.email)
          })
          const userIdAliases = {
            ...get().userIdAliases,
            ...aliasIdsForRoster([...baseline, ...loaded.users]),
          }
          listedRosterOrgId = organizationId
          writeStoredRoster(organizationId, users)
          upsertRosterDocuments(
            organizationId,
            loaded.complete ? loaded.users : [...previous, ...loaded.users].filter((row) => !confirmedMissing.has(row.id)),
            loaded.complete
          )
          set({
            users,
            userIdAliases,
            claimedEmails: loaded.claimedEmails,
            loading: false,
            error: null,
            rosterLoadedOrgId: organizationId,
          })
          startLiveRoster(organizationId, loaded.fallbackIds)
          // Rulebook 1.26.0 §8: read the pay profiles this viewer may read; when they changed, read the roster again
          // so every person's pay is laid over (`payProfileReadPlan`, `overlayPayProfile`).
          void import('@/lib/stores/authStore')
            .then(({ useAuthStore }) => refreshPayProfiles(organizationId, useAuthStore.getState().user as never, users as never))
            .then((changed) => {
              if (changed && listedRosterOrgId === organizationId) {
                return get().loadUsers(organizationId, { force: true })
              }
              return undefined
            })
            .catch(() => undefined)
        }
        try {
          const rosterPromise = fetchOrganisationRoster(organizationId, { finalAttempt: attempt.final })
          let loaded: Awaited<ReturnType<typeof fetchOrganisationRoster>>
          try {
            loaded = await withTimeout(rosterPromise, 20_000, 'The user list did not finish loading.')
          } catch (error: unknown) {
            if (!isTimeoutError(error) || generation !== rosterLoadGeneration) throw error
            // Leave the error on screen instead of spinning, then take the list if the read finishes.
            set({
              error: error instanceof Error ? error.message : 'The user list did not finish loading.',
              loading: false,
              // An empty timeout is not a finished company. Leave the roster unsettled so the screen keeps loading.
              ...(get().users.length > 0 ? { rosterLoadedOrgId: organizationId } : {}),
            })
            void rosterPromise.then(
              (late) => {
                void applyLoaded(late).catch(() => {
                  /* A newer load owns the list. */
                })
              },
              () => {
                /* The error already on screen stands. */
              }
            )
            throw new OrgLoadNotCached()
          }
          await applyLoaded(loaded)
        } catch (error: unknown) {
          if (error instanceof OrgLoadNotCached) {
            if (generation === rosterLoadGeneration) set({ loading: false })
            throw error
          }
          if (generation !== rosterLoadGeneration) throw new OrgLoadNotCached()
          // runOrgLoad retries auth-token races; keep "Loading users..." up until the last attempt fails.
          if (!attempt.final && isRetryableAuthLoadError(error)) throw error
          set({
            error: error instanceof Error ? error.message : 'Failed to load users',
            loading: false,
            // A failed read must not settle an empty company. Manage users stays on the error
            // until a retry applies people, and a later visit is not skipped for 60 seconds.
            ...(get().users.length > 0 ? { rosterLoadedOrgId: organizationId } : {}),
          })
          throw error
        }
      },
      loadOptions
    )

    if (get().loading && !isOrgLoadInFlight(ORG_USER_LOAD_KEY, organizationId)) {
      set({ loading: false })
    }
  },

  patchListedUser: (user) => {
    listedUserRevision += 1
    invalidateOrgLoad(ORG_USER_LOAD_KEY)
    const email = user.email.trim().toLowerCase()
    const existing = get().users
    const index = existing.findIndex(
      (row) => row.id === user.id || (email !== '' && row.email.trim().toLowerCase() === email)
    )
    const users = index >= 0 ? existing.map((row, i) => (i === index ? user : row)) : [...existing, user]
    const documents = get().rosterDocuments
    set({
      users,
      rosterLoadedOrgId: user.organizationId || get().rosterLoadedOrgId,
      rosterDocuments: documents.some((row) => row.id === user.id)
        ? documents.map((row) => (row.id === user.id ? user : row))
        : documents.length > 0
          ? [...documents, user]
          : documents,
    })
  },

  setListedUserActive: (userId, isActive) => {
    listedUserRevision += 1
    invalidateOrgLoad(ORG_USER_LOAD_KEY)
    set({
      users: get().users.map((user) =>
        user.id === userId ? { ...user, isActive, updatedAt: new Date() } : user
      ),
      rosterDocuments: get().rosterDocuments.map((user) =>
        user.id === userId ? { ...user, isActive, updatedAt: new Date() } : user
      ),
    })
  },
}))

/**
 * Rulebook 1.30.2 §11: the roster as every users document (unfolded) for this organisation, with the folded list's
 * fresher copies laid over by id. Falls back to the folded list when the documents have not loaded (stored roster).
 */
export function rosterDocumentsFor(
  state: Pick<OrgUserState, 'users' | 'rosterDocuments' | 'rosterDocumentsOrgId'>,
  organizationId: string | null | undefined
): User[] {
  if (!organizationId || state.rosterDocumentsOrgId !== organizationId || state.rosterDocuments.length === 0) return state.users
  const byId = new Map(state.rosterDocuments.map((row) => [row.id, row]))
  for (const row of state.users) byId.set(row.id, row)
  return [...byId.values()]
}

/** `rosterDocumentsFor` as a hook (rulebook 1.30.2: job-manager rules read every users document). */
export function useRosterDocuments(organizationId: string | null | undefined): User[] {
  const users = useOrgUserStore((state) => state.users)
  const rosterDocuments = useOrgUserStore((state) => state.rosterDocuments)
  const rosterDocumentsOrgId = useOrgUserStore((state) => state.rosterDocumentsOrgId)
  return useMemo(
    () => rosterDocumentsFor({ users, rosterDocuments, rosterDocumentsOrgId }, organizationId),
    [users, rosterDocuments, rosterDocumentsOrgId, organizationId]
  )
}
