import { isTaskOverdue as canonicalIsTaskOverdue } from '@/lib/canonical'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
/**
 * Small task helpers for screens. 1.88.0 §32: the old job-tab scopes, stat cards and filters (`filterTasksForScope`,
 * `taskStatCounts`, `applyJobTaskFilter`, …) are gone — tabs, counts and sorting are the rulebook's (`taskTabCounts`,
 * `sortTasksForTab`), shared with iOS.
 */

import type { ProjectTask } from '@/types'

export function allAssignedOperativeIds(task: ProjectTask): string[] {
  const ids = [...(task.assignedOperativeIds || [])]
  if (task.assignedOperativeId && !ids.includes(task.assignedOperativeId)) {
    ids.push(task.assignedOperativeId)
  }
  return ids
}

export function allAssignedManagerIds(task: ProjectTask): string[] {
  const ids = [...(task.assignedManagerIds || [])]
  if (task.assignedManagerId && !ids.includes(task.assignedManagerId)) {
    ids.push(task.assignedManagerId)
  }
  return ids
}

/** Rulebook 1.23.0 §23 `isTaskOverdue`: due before today on the organisation day, never the browser's. */
export function isTaskOverdue(task: ProjectTask, now = new Date()): boolean {
  return canonicalIsTaskOverdue({ status: task.status, dueDate: task.dueDate ?? null }, now.getTime(), organizationZoneOr())
}

export function personDisplayName(row: { firstName: string; lastName: string; email: string }): string {
  return `${row.firstName} ${row.lastName}`.trim() || row.email
}
