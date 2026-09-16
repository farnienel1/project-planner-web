'use client'

import { create } from 'zustand'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { isOrgCollectionSubscribed, subscribeOrgCollection } from '@/lib/firebase/subscribeOrgCollection'
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

function visibleToUser(row: AppInboxNotification, userId: string): boolean {
  if (!row.userId) return true
  return row.userId === userId
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  loadNotifications: (organizationId, userId) => {
    if (!organizationId || !db) return
    if (isOrgCollectionSubscribed('notifications', organizationId)) {
      set({ loading: false })
      return
    }
    set({ loading: true, error: null })
    subscribeOrgCollection(
      'notifications',
      organizationId,
      'notifications',
      (docs) => {
        const notifications: AppInboxNotification[] = []
        for (const entry of docs) {
          const parsed = parseNotification(entry.id, entry.data, organizationId)
          if (parsed.ok && visibleToUser(parsed.value, userId)) notifications.push(parsed.value)
          else if (!parsed.ok) logSkippedDocument('notifications', entry.id, parsed.errors)
        }
        notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        set({
          notifications,
          unreadCount: notifications.filter((row) => !row.isRead).length,
          loading: false,
        })
      },
      (error) => set({ error: error.message, loading: false })
    )
  },

  markAllAsRead: async (organizationId) => {
    const unread = get().notifications.filter((row) => !row.isRead)
    await Promise.all(
      unread.map((row) => updateDoc(doc(db, 'organizations', organizationId, 'notifications', row.id), { isRead: true }))
    )
  },
}))
