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
import { CONSOLE_EVENTS_CAP, consoleEventsLoadCovers, consoleEventsSince, widerEventsSince } from '@/lib/analytics/consolePeriod'
import { useConsolePrefs } from '@/lib/analytics/consolePrefs'

export type { PlatformOrganisation } from '@/lib/analytics/analyticsTypes'

type AnalyticsState = {
  events: ProductEvent[]
  sessions: ProductSession[]
  users: User[]
  organisations: PlatformOrganisation[]
  loading: boolean
  error: string | null
  loadedAt?: Date
  /** First instant the loaded events and sessions cover; null = no lower bound (To date); undefined = not loaded. */
  eventsSince?: Date | null
  /** True when the events or sessions hit CONSOLE_EVENTS_CAP, so the oldest in the window are missing. */
  eventsTruncated: boolean
  /** Set when events or sessions could not be read: the pages say so instead of showing empty counts as real. */
  eventsError: string | null
  /**
   * Loads the directory and the events and sessions of the page's period (owner console PR 1: never every event ever).
   * `since` defaults to the shared period's comparison start (`consoleEventsSince`).
   */
  load: (since?: Date | null) => Promise<void>
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

/** Events from `since` (newest first), at most CONSOLE_EVENTS_CAP. A refused read is empty, never a full download. */
async function loadEvents(since: Date | null): Promise<{ rows: ProductEvent[]; truncated: boolean; error: string | null }> {
  if (!db) return { rows: [], truncated: false, error: null }
  const constraints = since
    ? [where('createdAt', '>=', Timestamp.fromDate(since)), orderBy('createdAt', 'desc'), limit(CONSOLE_EVENTS_CAP)]
    : [orderBy('createdAt', 'desc'), limit(CONSOLE_EVENTS_CAP)]
  try {
    const snap = await getDocs(query(collection(db, 'productEvents'), ...constraints))
    const rows = snap.docs
      .map((entry) => parseEvent(entry.id, entry.data() as Record<string, unknown>))
      .filter((row): row is ProductEvent => Boolean(row))
    return { rows, truncated: snap.size >= CONSOLE_EVENTS_CAP, error: null }
  } catch (error) {
    // Never a silent empty list: the pages show that the events could not be read (review of #348, M2).
    console.warn('[owner console] events', error)
    return { rows: [], truncated: false, error: eventsLoadMessage(error, 'events') }
  }
}

/** Sessions started from `since` (newest first), at most CONSOLE_EVENTS_CAP. */
async function loadSessions(since: Date | null): Promise<{ rows: ProductSession[]; truncated: boolean; error: string | null }> {
  if (!db) return { rows: [], truncated: false, error: null }
  const constraints = since
    ? [where('startedAt', '>=', Timestamp.fromDate(since)), orderBy('startedAt', 'desc'), limit(CONSOLE_EVENTS_CAP)]
    : [orderBy('startedAt', 'desc'), limit(CONSOLE_EVENTS_CAP)]
  try {
    const snap = await getDocs(query(collection(db, 'productSessions'), ...constraints))
    const rows = snap.docs
      .map((entry) => parseSession(entry.id, entry.data() as Record<string, unknown>))
      .filter((row): row is ProductSession => Boolean(row))
    return { rows, truncated: snap.size >= CONSOLE_EVENTS_CAP, error: null }
  } catch (error) {
    // Never a silent empty list: the pages show that the sessions could not be read (review of #348, M2).
    console.warn('[owner console] sessions', error)
    return { rows: [], truncated: false, error: eventsLoadMessage(error, 'sessions') }
  }
}

function eventsLoadMessage(error: unknown, what: 'events' | 'sessions'): string {
  if (isPermissionDenied(error)) return `Product ${what} could not be read (permission refused). Sign in again as the owner.`
  return `Product ${what} could not be read${error instanceof Error && error.message ? `: ${error.message}` : ''}. Refresh to try again.`
}

/** A wider window asked for while a load is running; loaded straight after it (review of #348, M2). */
let queuedSince: Date | null | undefined

function permissionMessage(error: unknown): string {
  if (isPermissionDenied(error)) {
    return 'Could not read live organisations and users. Sign in again as the owner, then refresh.'
  }
  return error instanceof Error ? error.message : 'Could not load the owner console'
}

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  events: [],
  sessions: [],
  users: [],
  organisations: [],
  loading: false,
  error: null,
  eventsTruncated: false,
  eventsError: null,

  load: async (sinceArg) => {
    if (!db) return
    const current = get()
    const since = sinceArg === undefined ? consoleEventsSince(useConsolePrefs.getState().period) : sinceArg
    if (current.loading) {
      // Never drop a wider window: remember it and load it when this load finishes.
      queuedSince = widerEventsSince(queuedSince, since)
      return
    }
    const directoryFresh =
      Boolean(current.loadedAt) &&
      Date.now() - (current.loadedAt as Date).getTime() < 15_000 &&
      current.users.length + current.organisations.length > 0
    if (directoryFresh && consoleEventsLoadCovers(current.eventsSince, since)) return
    set({ loading: true, error: null })
    let users: User[] = current.users
    let organisations: PlatformOrganisation[] = current.organisations
    let fatal: unknown

    if (!directoryFresh) {
      // The directory (users, organisations) is still read whole here for the old pages; the new pages read the
      // paged /api/owner/directory routes instead. Removed with useAnalyticsStore (PLAN §8, PR 11).
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
      }
    }

    const [events, sessions] = await Promise.all([loadEvents(since), loadSessions(since)])

    if (fatal && users.length === 0 && organisations.length === 0) {
      queuedSince = undefined
      set({ error: permissionMessage(fatal), loading: false })
      return
    }

    set({
      users,
      organisations,
      events: events.rows,
      sessions: sessions.rows,
      eventsSince: since,
      eventsTruncated: events.truncated || sessions.truncated,
      eventsError: events.error || sessions.error,
      loading: false,
      loadedAt: directoryFresh ? current.loadedAt : new Date(),
      error: null,
    })
    const queued = queuedSince
    queuedSince = undefined
    if (queued !== undefined && !consoleEventsLoadCovers(since, queued)) await get().load(queued)
  },

  refresh: async () => {
    set({ loadedAt: undefined, eventsSince: undefined })
    await get().load()
  },
}))
