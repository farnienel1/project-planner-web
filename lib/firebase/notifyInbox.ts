/**
 * iOS parity source: Core/NotificationService.swift saveNotification
 * Spec: docs/ios-parity/sections/09-clients.md
 */

import { doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { serializeNotification } from '@/lib/ios-parity/converters'
import { newUppercaseUuid } from '@/lib/ios-parity/uuid'

export async function saveInboxNotification(input: {
  organizationId: string
  type: string
  title: string
  message: string
  userId?: string | null
  relatedId?: string | null
  requiresPermission?: string | null
  deepLinkUserId?: string | null
  deepLinkWeekStart?: Date | null
  id?: string
}): Promise<void> {
  if (!db) return
  const id = input.id || newUppercaseUuid()
  const payload = serializeNotification({
    organizationId: input.organizationId,
    type: input.type,
    title: input.title,
    message: input.message,
    userId: input.userId ?? null,
    relatedId: input.relatedId ?? null,
    requiresPermission: input.requiresPermission ?? null,
    deepLinkUserId: input.deepLinkUserId ?? null,
    deepLinkWeekStart: input.deepLinkWeekStart ?? null,
    isRead: false,
    createdAt: new Date(),
  })
  await setDoc(doc(db, 'organizations', input.organizationId, 'notifications', id), payload)
}

/** NotificationService.notifyClientCreated ~L368 */
export async function notifyClientCreated(params: {
  organizationId: string
  clientId: string
  clientName: string
  createdBy: string
}): Promise<void> {
  await saveInboxNotification({
    organizationId: params.organizationId,
    type: 'client_created',
    title: 'New Client Created',
    message: `${params.createdBy} added a new client: ${params.clientName}`,
    relatedId: params.clientId,
    requiresPermission: 'superAdminOrAdmin',
  })
}
