'use client'

import { create } from 'zustand'
import { collection, doc, getDoc, getDocs, limit, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { UserRole, type SiteAudit, type SiteAuditItem, type User } from '@/types'
import { parseOrgUser } from '@/lib/firebase/parseUser'
import { dedupeUsersByEmail } from '@/lib/staff/userRosterUtils'
import { mergeRetainedRoster, missingOrganizationIdPatch, retainScopedRows, rosterParseRecord } from '@/lib/staff/rosterRetain'
import { isOrgLoadInFlight, OrgLoadNotCached, runOrgLoad, invalidateOrgLoad, shouldSkipOrgLoad } from '@/lib/stores/orgLoadCache'
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

async function fetchOrganisationRoster(organizationId: string): Promise<{
  users: User[]
  complete: boolean
  presentIds: Set<string>
  presentEmails: Set<string>
}> {
  const collected: User[] = []
  const presentIds = new Set<string>()
  const presentEmails = new Set<string>()
  let complete = true

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
      const snap = await getDoc(doc(db, 'users', id))
      if (!snap.exists()) return null
      return userForThisOrganisation(snap.id, snap.data() as Record<string, unknown>, organizationId, allowNamedOrg)
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

  const attachRosterLink = async (entryId: string, data: Record<string, unknown>, kind?: 'manager') => {
    const email = text(data.email)
    const linkedIds = [text(data.userId), text(data.userID), text(data.uid), text(data.linkedUserId), entryId].filter(
      (id, index, all) => id !== '' && all.indexOf(id) === index
    )
    for (const id of linkedIds) {
      const user = await loadUserDocument(id, true)
      if (!user) continue
      noteUser(user, kind)
      return
    }
    const userId = await userIdForEmail(email)
    if (!userId) return
    noteUser(await loadUserDocument(userId, true), kind)
  }

  for (const field of ['organizationId', 'organisationId', 'orgId'] as const) {
    try {
      const snapshot = await getDocs(query(collection(db, 'users'), where(field, '==', organizationId)))
      for (const entry of snapshot.docs) {
        remember(userForThisOrganisation(entry.id, entry.data() as Record<string, unknown>, organizationId, true))
      }
    } catch {
      complete = false
    }
  }

  try {
    const orgSnap = await getDoc(doc(db, 'organizations', organizationId))
    const members = (orgSnap.data()?.members ?? {}) as Record<string, unknown>
    for (const id of Object.keys(members)) {
      if (!id) continue
      try {
        const snap = await getDoc(doc(db, 'users', id))
        if (!snap.exists()) continue
        const data = snap.data() as Record<string, unknown>
        const patch = missingOrganizationIdPatch(data, organizationId, true)
        if (patch) {
          try {
            await updateDoc(doc(db, 'users', id), patch)
          } catch {
            /* A rules error or timeout does not confirm the field should stay blank. */
          }
        }
        if (presentIds.has(id)) continue
        noteUser(userForThisOrganisation(snap.id, patch ? { ...data, ...patch } : data, organizationId, true))
      } catch {
        complete = false
      }
    }
  } catch {
    complete = false
  }

  try {
    const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'userEmails'))
    for (const entry of snapshot.docs) {
      const userId = text(entry.data().userId)
      if (!userId || presentIds.has(userId)) continue
      noteUser(await loadUserDocument(userId, true))
    }
  } catch {
    complete = false
  }

  try {
    const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'operatives'))
    for (const entry of snapshot.docs) {
      await attachRosterLink(entry.id, entry.data() as Record<string, unknown>)
    }
  } catch {
    complete = false
  }

  try {
    const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'managers'))
    for (const entry of snapshot.docs) {
      await attachRosterLink(entry.id, entry.data() as Record<string, unknown>, 'manager')
    }
  } catch {
    complete = false
  }

  if (collected.length === 0 && !complete) {
    throw new Error('Failed to load users')
  }
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
      return [
        {
          ...row,
          createdAt,
          updatedAt,
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
    const willLoad = !shouldSkipOrgLoad(ORG_USER_LOAD_KEY, organizationId, options)
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
      async () => {
        const generation = ++rosterLoadGeneration
        const inMemory = listedRosterOrgId === organizationId ? get().users : []
        const previous = inMemory.length > 0 ? inMemory : readStoredRoster(organizationId)
        try {
          const loaded = await fetchOrganisationRoster(organizationId)
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
          if (generation !== rosterLoadGeneration) throw new OrgLoadNotCached()
          const users = mergeRetainedRoster(baseline, loaded.users, confirmedMissing).sort((a, b) => {
            if (a.isSuperAdmin !== b.isSuperAdmin) return a.isSuperAdmin ? -1 : 1
            return a.email.localeCompare(b.email)
          })
          listedRosterOrgId = organizationId
          writeStoredRoster(organizationId, users)
          set({ users, loading: false, error: null, rosterLoadedOrgId: organizationId })
        } catch (error: unknown) {
          if (error instanceof OrgLoadNotCached) {
            if (generation === rosterLoadGeneration) set({ loading: false })
            throw error
          }
          if (generation !== rosterLoadGeneration) throw new OrgLoadNotCached()
          set({
            error: error instanceof Error ? error.message : 'Failed to load users',
            loading: false,
            rosterLoadedOrgId: organizationId,
          })
          throw error
        }
      },
      options
    )

    if (get().loading && !isOrgLoadInFlight(ORG_USER_LOAD_KEY, organizationId)) {
      set({ loading: false })
    }
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
