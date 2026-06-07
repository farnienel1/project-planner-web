'use client'

import { create } from 'zustand'
import { collection, doc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import type { SiteAudit, SiteAuditItem, User } from '@/types'
import { parseOrgUser } from '@/lib/firebase/parseUser'
import { dedupeUsersByEmail } from '@/lib/staff/userRosterUtils'
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
    const mapped = mapSiteAudit(auditId, payload as Record<string, unknown>)
    if (mapped) {
      set({ audits: [mapped, ...get().audits.filter((a) => a.id !== auditId)] })
    }
    return auditId
  },

  loadAudits: async (organizationId) => {
    set({ loading: true, error: null })
    try {
      const ref = collection(db, 'organizations', organizationId, 'siteAudits')
      const snapshot = await getDocs(ref)
      const audits = snapshot.docs
        .map((entry) => mapSiteAudit(entry.id, entry.data() as Record<string, unknown>))
        .filter((item): item is SiteAudit => item !== null)
        .sort((a, b) => b.date.getTime() - a.date.getTime())
      set({ audits, loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load site audits', loading: false })
    }
  },
}))

function mapOrgUser(docId: string, data: Record<string, unknown>): User | null {
  return parseOrgUser(docId, data)
}

interface OrgUserState {
  users: User[]
  loading: boolean
  error: string | null
  loadUsers: (organizationId: string) => Promise<void>
}

export const useOrgUserStore = create<OrgUserState>((set) => ({
  users: [],
  loading: false,
  error: null,

  loadUsers: async (organizationId) => {
    set({ loading: true, error: null })
    try {
      const usersRef = query(collection(db, 'users'), where('organizationId', '==', organizationId))
      const snapshot = await getDocs(usersRef)
      const users = dedupeUsersByEmail(
        snapshot.docs
          .map((entry) => mapOrgUser(entry.id, entry.data() as Record<string, unknown>))
          .filter((user): user is User => user !== null)
      ).sort((a, b) => {
        if (a.isSuperAdmin !== b.isSuperAdmin) return a.isSuperAdmin ? -1 : 1
        return a.email.localeCompare(b.email)
      })
      set({ users, loading: false })
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Failed to load users', loading: false })
    }
  },
}))
