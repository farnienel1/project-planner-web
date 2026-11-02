/**
 * iOS parity source: Core/NotificationService.swift saveNotification
 * Spec: docs/ios-parity/sections/09-clients.md
 */

import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/config'
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
  dayKey?: string | null
  catalogue?: 'projects' | 'smallWorks' | null
  id?: string
  /**
   * Rulebook §13: who caused the row. Defaults to the signed-in user (security rules require exactly that uid when
   * present). Pass null only for a scheduled notice nobody caused (the submission reminder), so the push function's
   * "never push to the actor" guard does not silence the signed-in user's own reminder.
   */
  actorUserId?: string | null
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
  const dayKey = String(input.dayKey ?? '').trim()
  if (dayKey) payload.dayKey = dayKey
  if (input.catalogue === 'projects' || input.catalogue === 'smallWorks') payload.catalogue = input.catalogue
  const actorUserId = inboxActorUserId(input.actorUserId)
  if (actorUserId) payload.actorUserId = actorUserId
  await setDoc(doc(db, 'organizations', input.organizationId, 'notifications', id), payload)
}

/** The signed-in uid (`actorUserId` on every inbox row), unless the caller passes null for a scheduled notice. */
export function inboxActorUserId(explicit?: string | null): string {
  if (explicit === null) return ''
  // Security rules accept only the signed-in uid, so any other value is never written.
  return String(auth?.currentUser?.uid ?? '').trim()
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
