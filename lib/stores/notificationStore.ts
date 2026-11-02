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
    inboxOwnerIdList = ownerIdList(userId, ownerIds)
    const already = inboxOrgId === organizationId && inboxUserId === userId && inboxUnsub
    if (already || get().notifications.length > 0) set({ loading: false })
    else set({ loading: true, error: null })
    if (already) return

    inboxUnsub?.()
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
    const listen = (inbox: Query, fallback: Query | null) => {
      inboxUnsub = onSnapshot(
        inbox,
        (snap) => {
          if (inboxOrgId !== organizationId || inboxUserId !== userId) return
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
          publishInbox(set)
        },
        (error: FirestoreError) => {
          if (inboxOrgId !== organizationId || inboxUserId !== userId) return
          if (fallback && error.code === 'failed-precondition') {
            inboxUnsub?.()
            listen(fallback, null)
            return
          }
          set({ error: error.message, loading: false })
        }
      )
    }
    listen(ordered, unordered)
  },

  markAllAsRead: async (organizationId) => {
    const unread = get().notifications.filter((row) => !row.isRead)
    await Promise.all(
      unread.map((row) => updateDoc(doc(db, 'organizations', organizationId, 'notifications', row.id), { isRead: true }))
    )
  },
}))
