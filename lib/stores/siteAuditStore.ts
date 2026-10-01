'use client'

import { create } from 'zustand'
import { collection, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { SiteAudit, SiteAuditItem, User } from '@/types'
import { parseOrgUser } from '@/lib/firebase/parseUser'
import { dedupeUsersByEmail } from '@/lib/staff/userRosterUtils'
import { mergeRetainedRoster, retainScopedRows, userFromRosterRecord, withRosterMembership } from '@/lib/staff/rosterRetain'
import { runOrgLoad, invalidateOrgLoad } from '@/lib/stores/orgLoadCache'
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

  const remember = (user: User | null, rosterKind?: 'operative' | 'manager') => {
    if (!user) return
    const withOrg = user.organizationId ? user : { ...user, organizationId }
    const email = withOrg.email.trim().toLowerCase()
    if (rosterKind) {
      const existing = collected.find(
        (row) => row.id === withOrg.id || (email !== '' && row.email.trim().toLowerCase() === email)
      )
      if (existing) {
        const patched = withRosterMembership(existing, rosterKind)
        if (patched !== existing) {
          const index = collected.indexOf(existing)
          collected[index] = patched
        }
        presentIds.add(withOrg.id)
        presentIds.add(existing.id)
        if (email) presentEmails.add(email)
        return
      }
    }
    collected.push(withOrg)
    presentIds.add(withOrg.id)
    if (email) presentEmails.add(email)
  }

  try {
    const snapshot = await getDocs(query(collection(db, 'users'), where('organizationId', '==', organizationId)))
    for (const entry of snapshot.docs) remember(mapOrgUser(entry.id, entry.data() as Record<string, unknown>))
  } catch {
    complete = false
  }

  try {
    const orgSnap = await getDoc(doc(db, 'organizations', organizationId))
    const members = (orgSnap.data()?.members ?? {}) as Record<string, unknown>
    const missingIds = Object.keys(members).filter((id) => id && !presentIds.has(id))
    const memberDocs = await Promise.all(missingIds.map((id) => getDoc(doc(db, 'users', id)).catch(() => null)))
    for (const snap of memberDocs) {
      if (!snap?.exists()) continue
      remember(mapOrgUser(snap.id, snap.data() as Record<string, unknown>))
    }
  } catch {
    complete = false
  }

  try {
    const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'operatives'))
    for (const entry of snapshot.docs) {
      const data = entry.data() as Record<string, unknown>
      remember(
        userFromRosterRecord({
          id: entry.id,
          organizationId,
          firstName: text(data.firstName),
          surname: text(data.lastName) || text(data.surname),
          email: text(data.email),
          phone: text(data.phone) || text(data.mobileNumber),
          isActive: data.isActive !== false,
          kind: 'operative',
        }),
        'operative'
      )
    }
  } catch {
    complete = false
  }

  try {
    const snapshot = await getDocs(collection(db, 'organizations', organizationId, 'managers'))
    for (const entry of snapshot.docs) {
      const data = entry.data() as Record<string, unknown>
      remember(
        userFromRosterRecord({
          id: entry.id,
          organizationId,
          firstName: text(data.firstName),
          surname: text(data.lastName) || text(data.surname),
          email: text(data.email),
          phone: text(data.phone) || text(data.mobile) || text(data.mobileNumber),
          isActive: data.isActive !== false,
          kind: 'manager',
        }),
        'manager'
      )
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
  loadUsers: (organizationId: string, options?: { force?: boolean }) => Promise<void>
  setListedUserActive: (userId: string, isActive: boolean) => void
}

let listedUserRevision = 0

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
    return rows
      .filter((row) => row && typeof row.id === 'string' && row.organizationId === organizationId)
      .map((row) => ({
        ...row,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }))
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

  loadUsers: async (organizationId, options?: { force?: boolean }) => {
    const revisionAtStart = listedUserRevision
    await runOrgLoad(
      'orgUserStore:users',
      organizationId,
      async () => {
        const inMemory = get().users.filter((user) => user.organizationId === organizationId)
        const previous = inMemory.length > 0 ? inMemory : readStoredRoster(organizationId)
        if (previous.length === 0) set({ loading: true, error: null })
        else set({ error: null })
        try {
          const loaded = await fetchOrganisationRoster(organizationId)
          if (revisionAtStart !== listedUserRevision) {
            set({ loading: false })
            return
          }
          const confirmedMissing = loaded.complete
            ? await confirmMissingUserDocuments(previous, loaded.presentIds, loaded.presentEmails)
            : new Set<string>()
          const users = mergeRetainedRoster(previous, loaded.users, confirmedMissing).sort((a, b) => {
            if (a.isSuperAdmin !== b.isSuperAdmin) return a.isSuperAdmin ? -1 : 1
            return a.email.localeCompare(b.email)
          })
          writeStoredRoster(organizationId, users)
          set({ users, loading: false, error: null })
        } catch (error: unknown) {
          set({
            error: error instanceof Error ? error.message : 'Failed to load users',
            loading: false,
          })
          throw error
        }
      },
      options
    )
  },

  setListedUserActive: (userId, isActive) => {
    listedUserRevision += 1
    invalidateOrgLoad('orgUserStore:users')
    set({
      users: get().users.map((user) =>
        user.id === userId ? { ...user, isActive, updatedAt: new Date() } : user
      ),
    })
  },
}))
