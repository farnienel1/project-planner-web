'use client'

import { create } from 'zustand'
import { collection, doc, getDoc, getDocs, limit, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { isTimeoutError, withTimeout } from '@/lib/client/withTimeout'
import { db } from '@/lib/firebase/config'
import { readOrganizationDocument } from '@/lib/firebase/orgDocumentCache'
import { UserRole, type SiteAudit, type SiteAuditItem, type User } from '@/types'
import { parseOrgUser } from '@/lib/firebase/parseUser'
import { isRetryableAuthLoadError } from '@/lib/auth/authBoot'
import { dedupeUsersByEmail } from '@/lib/staff/userRosterUtils'
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
import { newUuid, parseFirestoreDate, parseOptionalString, parseString, parseUuid } from '@/lib/firebase/firestoreUtils'

function parseAuditItems(rows: unknown): SiteAuditItem[] {
  if (!Array.isArray(rows)) return []
  const items: SiteAuditItem[] = []
  for (const row of rows) {
    const data = row as Record<string, unknown>
    const title = parseString(data.title)
    const location = parseString(data.location)
    const assignee = parseString(data.assignee)
    const comments = parseString(data.comments)
    const createdAt = parseFirestoreDate(data.createdAt)
    if (!title || !createdAt) continue
    items.push({
      id: parseUuid(data.id),
      title,
      location,
      assignee,
      comments,
      annotations: parseOptionalString(data.annotations),
      imageURL: parseOptionalString(data.imageURL),
      createdAt,
    })
  }
  return items
}

function mapSiteAudit(docId: string, data: Record<string, unknown>): SiteAudit | null {
  const projectId = parseString(data.projectId)
  const projectJobNumber = parseString(data.projectJobNumber)
  const projectName = parseString(data.projectName)
  const type = parseString(data.type)
  const authorName = parseString(data.authorName)
  const date = parseFirestoreDate(data.date)
  const createdAt = parseFirestoreDate(data.createdAt)
  const createdByUserId = parseString(data.createdByUserId)
  if (!projectId || !projectName || !type || !authorName || !date || !createdAt || !createdByUserId) return null

  return {
    id: parseUuid(data.id, docId),
    projectId,
    projectJobNumber,
    projectName,
    type,
    customTitle: parseOptionalString(data.customTitle),
    authorName,
    date,
    createdByUserId,
    visibleToOperatives: data.visibleToOperatives !== false,
    items: parseAuditItems(data.items),
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
    const items = input.items.map((item) => ({
      id: item.id || newUuid(),
      title: item.title,
      location: item.location,
      assignee: item.assignee,
      comments: item.comments,
      annotations: item.annotations || '',
      imageURL: item.imageURL || null,
      createdAt: Timestamp.fromDate(item.createdAt || now),
    }))
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
    await setDoc(doc(db, 'organizations', organizationId, 'siteAudits', auditId), payload)
    invalidateOrgLoad('siteAuditStore:audits')
    const mapped = mapSiteAudit(auditId, payload as Record<string, unknown>)
    if (mapped) {
      set({ audits: [mapped, ...get().audits.filter((a) => a.id !== auditId)] })
    }
    return auditId
  },

  loadAudits: async (organizationId) => {
    await runOrgLoad('siteAuditStore:audits', organizationId, async () => {
      if (get().audits.length === 0) set({ loading: true, error: null })
      else set({ error: null })
      try {
        const ref = collection(db, 'organizations', organizationId, 'siteAudits')
        const snapshot = await getDocs(ref)
        const mapped = snapshot.docs
          .map((entry) => mapSiteAudit(entry.id, entry.data() as Record<string, unknown>))
          .filter((item): item is SiteAudit => item !== null)
          .sort((a, b) => b.date.getTime() - a.date.getTime())
        const previous = siteAuditOrgId === organizationId ? get().audits : []
        const audits = retainScopedRows(`siteAudits:${organizationId}`, previous, mapped)
        siteAuditOrgId = organizationId
        set({ audits, loading: false })
      } catch (error: unknown) {
        set({ error: error instanceof Error ? error.message : 'Failed to load site audits', loading: false })
        throw error
      }
    })
  },
}))

function mapOrgUser(docId: string, data: Record<string, unknown>): User | null {
  return parseOrgUser(docId, data)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function userForThisOrganisation(id: string, data: Record<string, unknown>, organizationId: string, allowNamedOrg = false): User | null {
  const prepared = rosterParseRecord(data, organizationId, { allowNamedOrg })
  if (!prepared) return null
  return mapOrgUser(id, prepared)
}

function withManagerListHint(user: User): User {
  if (user.isSuperAdmin || user.permissions.adminAccess || user.role === 'admin') return user
  if (user.permissions.operativeMode || user.permissions.manager) return user
  return { ...user, permissions: { ...user.permissions, manager: true } }
}

async function fetchOrganisationRoster(
  organizationId: string,
  options?: { finalAttempt?: boolean }
): Promise<{
  users: User[]
  complete: boolean
  presentIds: Set<string>
  presentEmails: Set<string>
}> {
  const collected: User[] = []
  const presentIds = new Set<string>()
  const presentEmails = new Set<string>()
  let complete = true
  let firstFailure: unknown = null
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

  const noteUser = (user: User | null, kind?: 'manager') => {
    if (!user) return
    remember(user)
    if (kind !== 'manager') return
    const email = user.email.trim().toLowerCase()
    const index = collected.findIndex(
      (row) => row.id === user.id || (email !== '' && row.email.trim().toLowerCase() === email)
    )
    if (index >= 0) collected[index] = withManagerListHint(collected[index])
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
      remember(userForThisOrganisation(entry.id, entry.data() as Record<string, unknown>, organizationId, true))
    }
  } else {
    noteFailure(usersResult.reason)
  }

  const memberIds: string[] = []
  if (orgResult.status === 'fulfilled') {
    const members = (orgResult.value.data()?.members ?? {}) as Record<string, unknown>
    for (const id of Object.keys(members)) {
      if (id && !presentIds.has(id)) memberIds.push(id)
    }
  } else {
    noteFailure(orgResult.reason)
  }

  const emailUserIds: string[] = []
  if (emailsResult.status === 'fulfilled') {
    for (const entry of emailsResult.value.docs) {
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
        memberRows[index] = userForThisOrganisation(snap.id, patch ? { ...data, ...patch } : data, organizationId, true)
      } catch {
        memberRows[index] = 'failed'
      }
    }),
    readTogether(emailUserIds, async (userId, index) => {
      emailUsers[index] = await loadUserDocument(userId, true)
    }),
  ])
  for (const row of memberRows) {
    if (row === 'failed') {
      noteFailure(new Error('A member document could not be read'))
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

  const failure = rosterLoadFailure({ collectedCount: collected.length, complete, firstFailure })
  if (failure) throw failure
  return { users: dedupeUsersByEmail(collected), complete, presentIds, presentEmails }
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

interface OrgUserState {
  users: User[]
  loading: boolean
  error: string | null
  /** Organisation whose roster load has finished. Empty users before this is still loading. */
  rosterLoadedOrgId: string | null
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
      sessionStorage.removeItem(rosterStorageKey(organizationId))
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

  loadUsers: async (organizationId, options?: { force?: boolean }) => {
    const revisionAtStart = listedUserRevision
    // The org-load cache can still be warm after the in-memory roster was cleared.
    // Put the last roster back before that skip, or Warnings scans nobody and shows
    // "No active warnings".
    if (get().rosterLoadedOrgId !== organizationId && get().users.length === 0) {
      const stored = readStoredRoster(organizationId)
      if (stored.length > 0) {
        listedRosterOrgId = organizationId
        set({ users: stored, loading: false, error: null, rosterLoadedOrgId: organizationId })
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
          listedRosterOrgId = organizationId
          writeStoredRoster(organizationId, users)
          set({ users, loading: false, error: null, rosterLoadedOrgId: organizationId })
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
              rosterLoadedOrgId: organizationId,
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
            rosterLoadedOrgId: organizationId,
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
    set({ users, rosterLoadedOrgId: user.organizationId || get().rosterLoadedOrgId })
  },

  setListedUserActive: (userId, isActive) => {
    listedUserRevision += 1
    invalidateOrgLoad(ORG_USER_LOAD_KEY)
    set({
      users: get().users.map((user) =>
        user.id === userId ? { ...user, isActive, updatedAt: new Date() } : user
      ),
    })
  },
}))
