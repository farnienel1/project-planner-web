/**
 * iOS parity source: Core/NotificationService.swift saveNotification
 * Spec: docs/ios-parity/sections/09-clients.md
 */

import { doc, getDoc, setDoc } from 'firebase/firestore'
import { notificationCreateFields, type NotificationCreateInput } from '@/lib/canonical'
import { auth, db } from '@/lib/firebase/config'
import { serializeNotification } from '@/lib/ios-parity/converters'
import { newUppercaseUuid } from '@/lib/ios-parity/uuid'
import type { User } from '@/types'

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
  const validated = serializeNotification({
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
  const ref = doc(db, 'organizations', input.organizationId, 'notifications', id)
  // Rulebook 1.9.0 §13 `notificationCreateFields`: a row is created once. A deterministic (dedupe) id that already
  // exists is left alone, so its read state is never reset. A row this account may not read is not checked here:
  // the security rules refuse a non-admin update of someone else's row.
  let stored: Record<string, unknown> | null = null
  if (input.id) {
    stored = await getDoc(ref)
      .then((snap) => (snap.exists() ? (snap.data() as Record<string, unknown>) : null))
      .catch(() => null)
  }
  const create = notificationCreateFields(
    {
      ...validated,
      actorUserId: inboxActorUserId(input.actorUserId) || null,
      dayKey: input.dayKey ?? null,
      catalogue: input.catalogue ?? null,
    } as NotificationCreateInput,
    stored
  )
  if (!create) return
  await setDoc(ref, create.set)
}

/** The signed-in uid (`actorUserId` on every inbox row), unless the caller passes null for a scheduled notice. */
export function inboxActorUserId(explicit?: string | null): string {
  if (explicit === null) return ''
  // Security rules accept only the signed-in uid, so any other value is never written.
  return String(auth?.currentUser?.uid ?? '').trim()
}

/**
 * NotificationService.notifyClientCreated ~L368. Rulebook 1.4.0: one row per admin
 * (`companyActivityRecipients`), never a row without `userId`.
 */
export async function notifyClientCreated(params: {
  organizationId: string
  clientId: string
  clientName: string
  createdBy: string
  actor: User | null | undefined
  users: ReadonlyArray<User>
}): Promise<void> {
  const { notifyCompanyActivity } = await import('@/lib/notifications/companyActivity')
  await notifyCompanyActivity({
    organizationId: params.organizationId,
    type: 'client_created',
    title: 'New Client Created',
    message: `${params.createdBy} added a new client: ${params.clientName}`,
    relatedId: params.clientId,
    requiresPermission: 'superAdminOrAdmin',
    actor: params.actor,
    users: params.users,
  })
}
