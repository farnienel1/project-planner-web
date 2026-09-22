'use client'

import { create } from 'zustand'
import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { parseFirestoreDate } from '@/lib/firebase/firestoreUtils'
import type { ProductEvent, ProductEventName, ProductSession } from '@/lib/analytics/events'
import type { User } from '@/types'
import { parseAppUserDocument } from '@/lib/ios-parity/converters'
import { isPlatformOwnerSentinelOrg } from '@/lib/platform/owner'

export type PlatformOrganisation = {
  id: string
  name: string
  memberCount: number
  createdAt?: Date
  updatedAt?: Date
}

type AnalyticsState = {
  events: ProductEvent[]
  sessions: ProductSession[]
  users: User[]
  organisations: PlatformOrganisation[]
  loading: boolean
  error: string | null
  loadedAt?: Date
  load: (since: Date) => Promise<void>
}

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

function parseOrganisation(id: string, data: Record<string, unknown>): PlatformOrganisation | null {
  if (isPlatformOwnerSentinelOrg(id)) return null
  const members = data.members && typeof data.members === 'object' ? (data.members as Record<string, unknown>) : {}
  return {
    id,
    name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Unnamed organisation',
    memberCount: Object.keys(members).length,
    createdAt: parseFirestoreDate(data.createdAt),
    updatedAt: parseFirestoreDate(data.updatedAt),
  }
}

function permissionMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (/permission|insufficient/i.test(message)) {
    return 'Missing or insufficient permissions. Publish the latest firestore.rules so the owner console can read every organisation, user, idea and product event.'
  }
  return message || 'Could not load analytics'
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  events: [],
  sessions: [],
  users: [],
  organisations: [],
  loading: false,
  error: null,

  load: async (since) => {
    if (!db) return
    set({ loading: true, error: null })
    try {
      const stamp = Timestamp.fromDate(since)
      const [eventSnap, sessionSnap, userSnap, orgSnap] = await Promise.all([
        getDocs(query(collection(db, 'productEvents'), where('createdAt', '>=', stamp))),
        getDocs(query(collection(db, 'productSessions'), where('startedAt', '>=', stamp))),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'organizations')),
      ])
      const events = eventSnap.docs
        .map((entry) => parseEvent(entry.id, entry.data() as Record<string, unknown>))
        .filter((row): row is ProductEvent => Boolean(row))
      const sessions = sessionSnap.docs
        .map((entry) => parseSession(entry.id, entry.data() as Record<string, unknown>))
        .filter((row): row is ProductSession => Boolean(row))
      const users: User[] = []
      for (const entry of userSnap.docs) {
        if (isPlatformOwnerSentinelOrg(String((entry.data() as Record<string, unknown>).organizationId || ''))) continue
        const parsed = parseAppUserDocument(entry.id, entry.data() as Record<string, unknown>)
        if (parsed.ok) users.push(parsed.value)
      }
      const organisations = orgSnap.docs
        .map((entry) => parseOrganisation(entry.id, entry.data() as Record<string, unknown>))
        .filter((row): row is PlatformOrganisation => Boolean(row))
        .sort((a, b) => a.name.localeCompare(b.name))
      set({ events, sessions, users, organisations, loading: false, loadedAt: new Date() })
    } catch (error: unknown) {
      set({ error: permissionMessage(error), loading: false })
    }
  },
}))
