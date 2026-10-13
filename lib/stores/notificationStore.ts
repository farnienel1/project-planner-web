'use client'

import { create } from 'zustand'
import { collection, onSnapshot, query, updateDoc, where, doc, type Unsubscribe } from 'firebase/firestore'
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
    const inbox = query(
      collection(db, 'organizations', organizationId, 'notifications'),
      where('userId', '==', userId)
    )
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
          unreadCount: unreadNotificationBadgeCount(kept, userId),
          loading: false,
        })
      },
      (error) => {
        if (inboxOrgId !== organizationId || inboxUserId !== userId) return
        set({ error: error.message, loading: false })
      }
    )
  },

  markAllAsRead: async (organizationId) => {
    const unread = get().notifications.filter((row) => !row.isRead)
    await Promise.all(
      unread.map((row) => updateDoc(doc(db, 'organizations', organizationId, 'notifications', row.id), { isRead: true }))
    )
  },
}))
