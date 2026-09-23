/**
 * iOS parity source: NotificationService.notifyDeadlineAssigned
 */

import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { syntheticUuidFromKey } from '@/lib/ios-parity/uuid'
import type { Deadline } from '@/lib/deadlines/types'

export async function notifyNewDeadlineAssignees(params: {
  organizationId: string
  previous: Deadline | null
  current: Deadline
  projectName: string
  createdBy: string
}): Promise<void> {
  const oldIds = new Set(params.previous?.assigneeUserIds ?? [])
  const added = params.current.assigneeUserIds.filter((id) => id && !oldIds.has(id))
  await Promise.all(
    added.map(async (userId) => {
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
