/**
 * iOS parity source: NotificationService.notifyDeadlineAssigned
 *
 * Recipients are `deadlineAssignedRecipients(addedIds, actor, roster)`: the newly added assignees, never the
 * person who assigned them under any of their ids, and no inactive roster member.
 */

import { deadlineAssignedRecipients } from '@/lib/canonical'
import { inboxActorUserId, saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { syntheticUuidFromKey } from '@/lib/ios-parity/uuid'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import type { Deadline } from '@/lib/deadlines/types'
import type { User } from '@/types'

export async function notifyNewDeadlineAssignees(params: {
  organizationId: string
  previous: Deadline | null
  current: Deadline
  projectName: string
  createdBy: string
  /** The signed-in user who assigned them (defaults to the signed-in uid). */
  actorUserId?: string | null
  /** The organisation roster (`users` on `organizationId`). */
  users?: ReadonlyArray<User>
}): Promise<void> {
  const oldIds = new Set(params.previous?.assigneeUserIds ?? [])
  const added = params.current.assigneeUserIds.filter((id) => id && !oldIds.has(id))
  if (added.length === 0) return
  const users = params.users ?? []
  const actorId = String(params.actorUserId ?? '').trim() || inboxActorUserId()
  const actorUser = actorId ? users.find((row) => row.id === actorId) : undefined
  const recipients = deadlineAssignedRecipients(
    added,
    actorUser ? rulebookPerson(actorUser, users) : actorId || null,
    rulebookRoster(users)
  )
  await Promise.all(
    recipients.map(async (userId) => {
      const id = await syntheticUuidFromKey(`deadlineAssigned|${params.current.id}|${userId}`)
      await saveInboxNotification({
        id,
        organizationId: params.organizationId,
        type: 'deadline_assigned',
        title: 'Deadline assigned',
        message: `${params.createdBy} assigned you a deadline on ${params.projectName}: ${params.current.title}`,
        userId,
        relatedId: params.current.id,
      })
    })
  )
}
