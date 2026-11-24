'use client'

/**
 * The writes behind every task button (Start, Complete, Reopen, a tick, Save progress, Delete). The rulebook decides
 * the fields (§32 `taskActionStatus`, `taskStatusChangeFields`, `taskToggleChecklistItem`; §1 `taskWriteFields` through
 * the store's partial save); this file only calls the store and reports the outcome. Every path settles: it returns
 * an error message instead of throwing, so no button is left spinning.
 */

import { taskActionStatus, taskStatusChangeFields, taskToggleChecklistItem, TASK_COPY, type TaskActionKey } from '@/lib/canonical'
import { useTaskStore } from '@/lib/stores/taskStore'
import type { ProjectTask, ProjectTaskStatus } from '@/types'

export function personDisplay(user: { firstName?: string; surname?: string; email?: string } | null | undefined): string {
  if (!user) return 'Unknown'
  return `${user.firstName || ''} ${user.surname || ''}`.trim() || user.email || 'Unknown'
}

export function errorText(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
  if (code === 'permission-denied') return TASK_COPY.errors.noAccess
  if (error instanceof Error && error.message) return error.message
  return TASK_COPY.errors.saveFailed
}

/** Start or Reopen (one tap). Complete opens the complete step instead. */
export async function runStatusAction(task: ProjectTask, action: Exclude<TaskActionKey, 'complete'>, byName: string): Promise<string | null> {
  try {
    const fields = taskStatusChangeFields(task, taskActionStatus(action), { completedBy: byName, now: new Date() })
    await useTaskStore.getState().saveTask({
      ...task,
      status: fields.status as ProjectTaskStatus,
      completedAt: fields.completedAt ?? undefined,
      completedBy: fields.completedBy ?? undefined,
      updatedAt: new Date(),
    })
    return null
  } catch (error) {
    return errorText(error)
  }
}

/** F14: tick or untick one item from the task view; saved straight away. */
export async function toggleTaskItem(task: ProjectTask, itemId: string): Promise<string | null> {
  try {
    await useTaskStore.getState().saveTask({
      ...task,
      completedItemIds: taskToggleChecklistItem(task.completedItemIds, itemId),
      updatedAt: new Date(),
    })
    return null
  } catch (error) {
    return errorText(error)
  }
}

export async function deleteTaskById(organizationId: string, taskId: string): Promise<string | null> {
  try {
    await useTaskStore.getState().deleteTask(organizationId, taskId)
    return null
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
    return code === 'permission-denied' ? TASK_COPY.errors.deleteRefused : errorText(error)
  }
}
