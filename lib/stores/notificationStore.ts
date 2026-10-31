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
  loadNotifications: (organizationId: string, userId: string) => void
  markAllAsRead: (organizationId: string) => Promise<void>
}

let inboxUnsub: Unsubscribe | null = null
let inboxOrgId = ''
let inboxUserId = ''

/** Newest inbox rows kept live (iOS NotificationService limits its listener to 150). */
export const INBOX_LISTENER_LIMIT = 150

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  loadNotifications: (organizationId, userId) => {
    if (!organizationId || !userId || !db) return
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
            if (inboxNotificationVisibleToUser(parsed.value, userId)) notifications.push(parsed.value)
          }
          notifications.sort(compareInboxNotificationsByCreatedAt)
          const kept =
            snap.docs.length > 0 && failed === snap.docs.length
              ? retainParsedRows(snap.docs.length, get().notifications, notifications)
              : notifications
          set({
            notifications: kept,
            // Canonical badge over the rows loaded (the newest 150), same as iOS.
            unreadCount: unreadNotificationBadgeCount(kept, userId),
            loading: false,
          })
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
