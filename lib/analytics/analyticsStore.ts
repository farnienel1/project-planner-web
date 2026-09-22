'use client'

import { create } from 'zustand'
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
import type { ProductEvent, ProductEventName, ProductSession } from '@/lib/analytics/events'
import type { PlatformOrganisation } from '@/lib/analytics/analyticsTypes'
import {
  isPermissionDenied,
  mergeOrganisationsFromUsers,
  parseOwnerConsoleOrganisation,
  parseOwnerConsoleUser,
} from '@/lib/analytics/ownerDirectory'
import type { User } from '@/types'

export type { PlatformOrganisation } from '@/lib/analytics/analyticsTypes'

type AnalyticsState = {
  events: ProductEvent[]
  sessions: ProductSession[]
  users: User[]
  organisations: PlatformOrganisation[]
  loading: boolean
  error: string | null
  warning: string | null
  loadedAt?: Date
  load: (since?: Date) => Promise<void>
  refresh: () => Promise<void>
}

const PAGE = 400

function parseEvent(id: string, data: Record<string, unknown>): ProductEvent | null {
  const eventName = data.eventName
  const userId = data.userId
  const createdAt = parseFirestoreDate(data.createdAt)
  if (typeof eventName !== 'string' || typeof userId !== 'string' || !createdAt) return null
  return {
    id,
    userId,
    organizationId: typeof data.organizationId === 'string' ? data.organizationId : undefined,
    sessionId: typeof data.sessionId === 'string' ? data.sessionId : undefined,
    eventName: eventName as ProductEventName,
    metadata: data.metadata && typeof data.metadata === 'object' ? (data.metadata as ProductEvent['metadata']) : undefined,
    createdAt,
  }
}

function parseSession(id: string, data: Record<string, unknown>): ProductSession | null {
  const userId = data.userId
  const startedAt = parseFirestoreDate(data.startedAt)
  const lastActivityAt = parseFirestoreDate(data.lastActivityAt) || startedAt
  if (typeof userId !== 'string' || !startedAt || !lastActivityAt) return null
  const endedAt = parseFirestoreDate(data.endedAt)
  return {
    id,
    userId,
    organizationId: typeof data.organizationId === 'string' ? data.organizationId : undefined,
    startedAt,
    lastActivityAt,
    endedAt,
    durationMs: endedAt ? Math.max(0, endedAt.getTime() - startedAt.getTime()) : Math.max(0, lastActivityAt.getTime() - startedAt.getTime()),
    entryPath: typeof data.entryPath === 'string' ? data.entryPath : undefined,
    exitPath: typeof data.exitPath === 'string' ? data.exitPath : undefined,
  }
}

async function fetchAllDocs(collectionName: string): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  if (!db) return []
  const out: QueryDocumentSnapshot<DocumentData>[] = []
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined
  for (;;) {
    const page = cursor
      ? query(collection(db, collectionName), orderBy(documentId()), startAfter(cursor), limit(PAGE))
      : query(collection(db, collectionName), orderBy(documentId()), limit(PAGE))
    const snap = await getDocs(page)
    out.push(...snap.docs)
    if (snap.size < PAGE) break
    cursor = snap.docs[snap.docs.length - 1]
  }
  return out
}

async function loadUsers(): Promise<User[]> {
  const docs = await fetchAllDocs('users')
  const users: User[] = []
  for (const entry of docs) {
    const parsed = parseOwnerConsoleUser(entry.id, entry.data() as Record<string, unknown>)
    if (parsed) users.push(parsed)
  }
  return users
}

async function loadOrganisations(userOrgIds: string[]): Promise<PlatformOrganisation[]> {
  if (!db) return []
  try {
    const docs = await fetchAllDocs('organizations')
    return docs
      .map((entry) => parseOwnerConsoleOrganisation(entry.id, entry.data() as Record<string, unknown>))
      .filter((row): row is PlatformOrganisation => Boolean(row))
  } catch (error) {
    if (!isPermissionDenied(error)) throw error
    const recovered: PlatformOrganisation[] = []
    const unique = [...new Set(userOrgIds.filter(Boolean))]
    await Promise.all(
      unique.map(async (id) => {
        if (!db) return
        try {
          const snap = await getDoc(doc(db, 'organizations', id))
          if (!snap.exists()) return
          const parsed = parseOwnerConsoleOrganisation(snap.id, snap.data() as Record<string, unknown>)
          if (parsed) recovered.push(parsed)
        } catch {
          /* keep the user-derived row */
        }
      })
    )
    return recovered
  }
}

async function loadEvents(since: Date): Promise<ProductEvent[]> {
  if (!db) return []
  const stamp = Timestamp.fromDate(since)
  try {
    const snap = await getDocs(query(collection(db, 'productEvents'), where('createdAt', '>=', stamp)))
    return snap.docs
      .map((entry) => parseEvent(entry.id, entry.data() as Record<string, unknown>))
      .filter((row): row is ProductEvent => Boolean(row))
  } catch (error) {
    if (isPermissionDenied(error)) throw error
    const docs = await fetchAllDocs('productEvents')
    return docs
      .map((entry) => parseEvent(entry.id, entry.data() as Record<string, unknown>))
      .filter((row): row is ProductEvent => Boolean(row))
      .filter((row) => row.createdAt.getTime() >= since.getTime())
  }
}

async function loadSessions(since: Date): Promise<ProductSession[]> {
  if (!db) return []
  const stamp = Timestamp.fromDate(since)
  try {
    const snap = await getDocs(query(collection(db, 'productSessions'), where('startedAt', '>=', stamp)))
    return snap.docs
      .map((entry) => parseSession(entry.id, entry.data() as Record<string, unknown>))
      .filter((row): row is ProductSession => Boolean(row))
  } catch (error) {
    if (isPermissionDenied(error)) throw error
    const docs = await fetchAllDocs('productSessions')
    return docs
      .map((entry) => parseSession(entry.id, entry.data() as Record<string, unknown>))
      .filter((row): row is ProductSession => Boolean(row))
      .filter((row) => row.startedAt.getTime() >= since.getTime())
  }
}

function permissionMessage(error: unknown): string {
  if (isPermissionDenied(error)) {
    return 'Missing or insufficient permissions. Publish the latest firestore.rules so the owner console can read every organisation, user, idea and product event.'
  }
  return error instanceof Error ? error.message : 'Could not load analytics'
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  events: [],
  sessions: [],
  users: [],
  organisations: [],
  loading: false,
  error: null,
  warning: null,

  load: async (since) => {
    if (!db) return
    const current = get()
    if (current.loading) return
    if (current.loadedAt && Date.now() - current.loadedAt.getTime() < 15_000 && current.users.length + current.organisations.length > 0) {
      return
    }
    const from = since && since.getTime() > 0 ? since : new Date('2018-01-01T00:00:00.000Z')
    set({ loading: true, error: null, warning: null })
    const warnings: string[] = []
    let users: User[] = []
    let organisations: PlatformOrganisation[] = []
    let events: ProductEvent[] = []
    let sessions: ProductSession[] = []
    let fatal: unknown

    try {
      users = await loadUsers()
    } catch (error) {
      fatal = error
    }

    try {
      organisations = mergeOrganisationsFromUsers(await loadOrganisations(users.map((user) => user.organizationId)), users)
    } catch (error) {
      organisations = mergeOrganisationsFromUsers([], users)
      if (!organisations.length && !users.length) fatal = fatal || error
      else if (isPermissionDenied(error)) {
        warnings.push('Organisation names need published firestore.rules. User accounts still appear below.')
      }
    }

    try {
      events = await loadEvents(from)
    } catch (error) {
      if (isPermissionDenied(error)) {
        warnings.push('Product events could not be read. Live organisation and user counts still come from account records.')
      } else {
        warnings.push(error instanceof Error ? error.message : 'Could not load product events')
      }
    }

    try {
      sessions = await loadSessions(from)
    } catch (error) {
      if (!isPermissionDenied(error)) {
        warnings.push(error instanceof Error ? error.message : 'Could not load sessions')
      }
    }

    if (fatal && users.length === 0 && organisations.length === 0) {
      set({ error: permissionMessage(fatal), loading: false })
      return
    }

    set({
      users,
      organisations,
      events,
      sessions,
      loading: false,
      loadedAt: new Date(),
      error: null,
      warning: warnings.join(' ') || null,
    })
  },

  refresh: async () => {
    set({ loadedAt: undefined })
    await get().load()
  },
}))
