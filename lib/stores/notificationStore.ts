'use client'

import { create } from 'zustand'
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type FirestoreError,
  type Query,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { retainParsedRows } from '@/lib/staff/rosterRetain'
import {
  compareInboxNotificationsByCreatedAt,
  inboxNotificationVisibleToUser,
  unreadNotificationBadgeCount,
} from '@/lib/canonical'
import {
  logSkippedDocument,
  parseNotification,
  type AppInboxNotification,
} from '@/lib/ios-parity/converters'

interface NotificationState {
  notifications: AppInboxNotification[]
  unreadCount: number
  loading: boolean
  error: string | null
  /**
   * `ownerIds`: every id of the signed-in person (`inboxOwnerIds`: id, `formerUserIds`, same-email accounts). The
   * listener still reads `userId == signed-in uid` (what security rules allow); listing and the unread count use
   * `inboxNotificationVisibleToUser` / `unreadNotificationBadgeCount` with the whole id list.
   */
  loadNotifications: (organizationId: string, userId: string, ownerIds?: ReadonlyArray<string>) => void
  markAllAsRead: (organizationId: string) => Promise<void>
  /** Stops the listener and clears the inbox (sign-out, organisation switch). */
  reset: () => void
}

let inboxUnsub: Unsubscribe | null = null
let inboxOrgId = ''
let inboxUserId = ''
let inboxOwnerIdList: string[] = []

function ownerIdList(userId: string, ownerIds?: ReadonlyArray<string>): string[] {
  const list = [userId, ...(ownerIds ?? [])].map((id) => String(id ?? '').trim()).filter(Boolean)
  return Array.from(new Set(list))
}

/** Newest inbox rows kept live (iOS NotificationService limits its listener to 150). */
export const INBOX_LISTENER_LIMIT = 150

let inboxOwnedRows: AppInboxNotification[] = []
let inboxRevealTimer: ReturnType<typeof setTimeout> | null = null
let inboxRetryTimer: ReturnType<typeof setTimeout> | null = null
let inboxRetryAttempt = 0

/** Retry delay after a listener error: 5 s, doubling to 60 s (iOS NotificationService retries 5–60 s). */
export function inboxRetryDelayMs(attempt: number): number {
  return Math.min(60_000, 5_000 * 2 ** Math.max(0, attempt))
}

function stopInboxListener(): void {
  inboxUnsub?.()
  inboxUnsub = null
  if (inboxRetryTimer) clearTimeout(inboxRetryTimer)
  inboxRetryTimer = null
}

function sameIds(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function rowCreatedAtMs(row: AppInboxNotification): number | null {
  const value = (row as { createdAt?: unknown }).createdAt
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return value
  return null
}

/**
 * Rulebook 1.10.0 (M5): a row is listed and counted only from its `createdAt` (`inboxNotificationVisibleToUser` with
 * now), so a scheduled `deadline_reminder` / `deadline_due` written ahead of time appears when it is due. A timer
 * re-publishes at the next due row.
 */
function publishInbox(set: (partial: Partial<NotificationState>) => void): void {
  const now = Date.now()
  const kept = inboxOwnedRows.filter((row) => inboxNotificationVisibleToUser(row, inboxOwnerIdList, now))
  set({
    notifications: kept,
    // Canonical badge over the rows loaded (the newest 150), same as iOS.
    unreadCount: unreadNotificationBadgeCount(kept, inboxOwnerIdList, now),
    loading: false,
  })
  if (inboxRevealTimer) clearTimeout(inboxRevealTimer)
  inboxRevealTimer = null
  const next = inboxOwnedRows
    .map(rowCreatedAtMs)
    .filter((ms): ms is number => ms != null && ms > now)
    .sort((a, b) => a - b)[0]
  if (next != null) {
    inboxRevealTimer = setTimeout(() => publishInbox(set), Math.min(next - now + 50, 2 ** 31 - 1))
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  loadNotifications: (organizationId, userId, ownerIds) => {
    if (!organizationId || !userId || !db) return
    const nextOwners = ownerIdList(userId, ownerIds)
    const ownersChanged = !sameIds(nextOwners, inboxOwnerIdList)
    inboxOwnerIdList = nextOwners
    const already = inboxOrgId === organizationId && inboxUserId === userId && (inboxUnsub || inboxRetryTimer)
    if (already) {
      // Same listener: a new owner-id list (roster loaded later) re-lists the rows already held.
      if (ownersChanged) publishInbox(set)
      else if (get().loading && inboxOwnedRows.length > 0) set({ loading: false })
      return
    }
    if (inboxOrgId !== organizationId || inboxUserId !== userId) {
      // Another company or account: never show the previous inbox's rows.
      inboxOwnedRows = []
      inboxRetryAttempt = 0
      set({ notifications: [], unreadCount: 0 })
    }
    set({ loading: true, error: null })

    stopInboxListener()
    inboxOrgId = organizationId
    inboxUserId = userId
    const scope = collection(db, 'organizations', organizationId, 'notifications')
    // Newest first, bounded like iOS. Needs the (userId asc, createdAt desc) index in
    // firestore.indexes.json; until that index is deployed the ordered query fails with
    // failed-precondition, so fall back to the unordered listener rather than an empty inbox.
    const ordered = query(
      scope,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(INBOX_LISTENER_LIMIT)
    )
    const unordered = query(scope, where('userId', '==', userId))
    const current = () => inboxOrgId === organizationId && inboxUserId === userId
    const listen = (inbox: Query, fallback: Query | null) => {
      inboxUnsub = onSnapshot(
        inbox,
        (snap) => {
          if (!current()) return
          inboxRetryAttempt = 0
          const notifications: AppInboxNotification[] = []
          let failed = 0
          for (const entry of snap.docs) {
            const parsed = parseNotification(entry.id, entry.data() as Record<string, unknown>, organizationId)
            if (!parsed.ok) {
              failed += 1
              logSkippedDocument('notifications', entry.id, parsed.errors)
              continue
            }
            // Owner check only here; the createdAt check runs in publishInbox (1.10.0).
            if (inboxNotificationVisibleToUser(parsed.value, inboxOwnerIdList, Number.MAX_SAFE_INTEGER)) {
              notifications.push(parsed.value)
            }
          }
          notifications.sort(compareInboxNotificationsByCreatedAt)
          inboxOwnedRows =
            snap.docs.length > 0 && failed === snap.docs.length
              ? retainParsedRows(snap.docs.length, inboxOwnedRows, notifications)
              : notifications
          set({ error: null })
          publishInbox(set)
        },
        (error: FirestoreError) => {
          if (!current()) return
          inboxUnsub?.()
          inboxUnsub = null
          if (fallback && error.code === 'failed-precondition') {
            listen(fallback, null)
            return
          }
          // 1.16.0: an error is never final. Keep the rows already shown, report it, and listen again with backoff
          // (the ordered query first), so the inbox does not stay frozen until a reload.
          set({ error: error.message, loading: false })
          const delay = inboxRetryDelayMs(inboxRetryAttempt)
          inboxRetryAttempt += 1
          if (inboxRetryTimer) clearTimeout(inboxRetryTimer)
          inboxRetryTimer = setTimeout(() => {
            inboxRetryTimer = null
            if (current()) listen(ordered, unordered)
          }, delay)
        }
      )
    }
    listen(ordered, unordered)
  },

  reset: () => {
    stopInboxListener()
    if (inboxRevealTimer) clearTimeout(inboxRevealTimer)
    inboxRevealTimer = null
    inboxOrgId = ''
    inboxUserId = ''
    inboxOwnerIdList = []
    inboxOwnedRows = []
    inboxRetryAttempt = 0
    set({ notifications: [], unreadCount: 0, loading: false, error: null })
  },

  markAllAsRead: async (organizationId) => {
    const unread = get().notifications.filter((row) => !row.isRead)
    await Promise.all(
      unread.map((row) => updateDoc(doc(db, 'organizations', organizationId, 'notifications', row.id), { isRead: true }))
    )
  },
}))
