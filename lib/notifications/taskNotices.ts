/**
 * Rulebook 1.10.0 §13: web writes `task_created` and `task_completed` (iOS already did).
 *   - `task_created`: the task's assignees (operatives and managers rows, matched to accounts by email), without the
 *     person who created it (`excludeActor`).
 *   - `task_completed`: the task's creator, without the person who completed it (`excludeActor`). Tasks store the
 *     creator's name (`createdBy`), not an id, so the creator is the one active account with that display name; with
 *     none or several, nobody is notified (rule question for the rulebook: store `createdByUserId`).
 * relatedId is the task id (`notificationRelatedIdFor`); each row has a deterministic id so a re-save never repeats it.
 */
import { excludeActor } from '@/lib/canonical'
import { saveInboxNotification } from '@/lib/firebase/notifyInbox'
import { syntheticUuidFromKey } from '@/lib/ios-parity/uuid'
import { rulebookPerson, rulebookRoster } from '@/lib/staff/rulebookPeople'
import type { ProjectTask, User } from '@/types'

type Row = { id: string; email?: string | null }

function key(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

/** Account ids of a task's assignees: an assignee id that is an account id, or a roster row's email account. */
export function taskAssigneeAccountIds(
  task: Pick<ProjectTask, 'assignedOperativeId' | 'assignedOperativeIds' | 'assignedManagerId' | 'assignedManagerIds'>,
  users: ReadonlyArray<User>,
  operatives: ReadonlyArray<Row>,
  managers: ReadonlyArray<Row>
): string[] {
  const assigned = new Set(
    [task.assignedOperativeId, ...(task.assignedOperativeIds ?? []), task.assignedManagerId, ...(task.assignedManagerIds ?? [])]
      .map(key)
      .filter(Boolean)
  )
  const emails = new Set(
    [...operatives, ...managers].filter((row) => assigned.has(key(row.id))).map((row) => key(row.email)).filter(Boolean)
  )
  return users
    .filter((user) => user.isActive !== false && (assigned.has(key(user.id)) || emails.has(key(user.email))))
    .map((user) => user.id)
}

async function write(input: { organizationId: string; type: 'task_created' | 'task_completed'; title: string; message: string; taskId: string; userId: string }) {
  await saveInboxNotification({
    id: await syntheticUuidFromKey(`${input.type === 'task_created' ? 'taskCreated' : 'taskCompleted'}|${input.taskId}|${input.userId}`),
    organizationId: input.organizationId,
    type: input.type,
    title: input.title,
    message: input.message,
    userId: input.userId,
    relatedId: input.taskId,
  })
}

export async function notifyTaskCreated(input: {
  task: ProjectTask
  actor: User | null
  users: ReadonlyArray<User>
  operatives: ReadonlyArray<Row>
  managers: ReadonlyArray<Row>
}): Promise<void> {
  const ids = taskAssigneeAccountIds(input.task, input.users, input.operatives, input.managers)
  const actor = input.actor ? rulebookPerson(input.actor, input.users) : null
  const recipients = excludeActor(ids, actor, rulebookRoster(input.users))
  const by = input.task.createdBy || 'Someone'
  await Promise.all(
    recipients.map((userId) =>
      write({
        organizationId: input.task.organizationId,
        type: 'task_created',
        title: 'New Task Assigned',
        message: `${by} assigned you a new task: ${input.task.title}`,
        taskId: input.task.id,
        userId,
      }).catch(() => undefined)
    )
  )
}

export async function notifyTaskCompleted(input: {
  task: ProjectTask
  actor: User | null
  users: ReadonlyArray<User>
}): Promise<void> {
  const creatorName = key(input.task.createdBy)
  if (!creatorName) return
  const named = input.users.filter(
    (user) => user.isActive !== false && key(`${user.firstName} ${user.surname}`) === creatorName
  )
  if (named.length !== 1) return
  const actor = input.actor ? rulebookPerson(input.actor, input.users) : null
  const recipients = excludeActor([named[0].id], actor, rulebookRoster(input.users))
  const by = input.task.completedBy || (input.actor ? `${input.actor.firstName} ${input.actor.surname}`.trim() : 'Someone')
  await Promise.all(
    recipients.map((userId) =>
      write({
        organizationId: input.task.organizationId,
        type: 'task_completed',
        title: 'Task Completed',
        message: `${by} completed the task: ${input.task.title}`,
        taskId: input.task.id,
        userId,
      }).catch(() => undefined)
    )
  )
}
