/**
 * iOS parity source: Models/ProjectTask.swift, Views/ProjectDetailView.swift (job My Tasks)
 * Spec: docs/ios-parity/sections/16-job-tiles.md
 */

import type { Manager, Operative, ProjectTask, User } from '@/types'

export type ProjectTaskListScope = 'assignedToMe' | 'active' | 'overdue' | 'completed'

export const PROJECT_TASK_SCOPES: { id: ProjectTaskListScope; label: string }[] = [
  { id: 'assignedToMe', label: 'Assigned to me' },
  { id: 'active', label: 'Active' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
]

function normalizedEmail(value?: string | null): string {
  return (value || '').trim().toLowerCase()
}

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

export function isTaskCompleted(task: ProjectTask): boolean {
  return task.status === 'Completed'
}

export function isTaskOverdue(task: ProjectTask, now = new Date()): boolean {
  if (isTaskCompleted(task) || !task.dueDate) return false
  const due = new Date(task.dueDate)
  due.setHours(0, 0, 0, 0)
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  return due.getTime() < startOfToday.getTime()
}

export function isAssignedToUser(
  task: ProjectTask,
  userEmail: string | undefined,
  operatives: Pick<Operative, 'id' | 'email'>[],
  managers: Pick<Manager, 'id' | 'email'>[],
  operativeMode: boolean
): boolean {
  const raw = normalizedEmail(userEmail)
  if (!raw) return false
  if (operativeMode) {
    const op = operatives.find((row) => normalizedEmail(row.email) === raw)
    return op ? allAssignedOperativeIds(task).includes(op.id) : false
  }
  const mgr = managers.find((row) => normalizedEmail(row.email) === raw)
  if (mgr && allAssignedManagerIds(task).includes(mgr.id)) return true
  const op = operatives.find((row) => normalizedEmail(row.email) === raw)
  if (op && allAssignedOperativeIds(task).includes(op.id)) return true
  return false
}

export function isCreatedByCurrentUser(task: ProjectTask, user: Pick<User, 'email' | 'firstName' | 'surname'> | null): boolean {
  if (!user) return false
  const by = task.createdBy.trim().toLowerCase()
  if (!by) return false
  const full = `${user.firstName} ${user.surname}`.trim().toLowerCase()
  const email = normalizedEmail(user.email)
  if (by === full || by === email) return true
  const first = user.firstName.trim().toLowerCase()
  return Boolean(first && by === first)
}

export function emptyCopyForScope(scope: ProjectTaskListScope): { title: string; subtitle: string } {
  switch (scope) {
    case 'active':
      return {
        title: 'No active tasks',
        subtitle:
          'Create your first task to get started. Break it into checklist items, assign it to your team, and set a deadline.',
      }
    case 'completed':
      return {
        title: 'No completed tasks',
        subtitle: 'Completed tasks for this project will appear here.',
      }
    case 'assignedToMe':
      return {
        title: 'Nothing assigned to you',
        subtitle: 'When someone assigns you on a task, it will show here.',
      }
    case 'overdue':
      return {
        title: 'No overdue tasks',
        subtitle: 'Overdue tasks still appear under Active. This filter shows only tasks past their due date.',
      }
  }
}

export function filterTasksForScope(
  tasks: ProjectTask[],
  scope: ProjectTaskListScope,
  opts: {
    userEmail?: string
    user: Pick<User, 'email' | 'firstName' | 'surname'> | null
    operatives: Pick<Operative, 'id' | 'email'>[]
    managers: Pick<Manager, 'id' | 'email'>[]
    operativeMode: boolean
    now?: Date
  }
): ProjectTask[] {
  const assigned = (task: ProjectTask) =>
    isAssignedToUser(task, opts.userEmail, opts.operatives, opts.managers, opts.operativeMode)

  switch (scope) {
    case 'assignedToMe':
      return tasks.filter((task) => assigned(task))
    case 'active':
      return tasks.filter((task) => !isTaskCompleted(task))
    case 'overdue':
      return tasks.filter((task) => isTaskOverdue(task, opts.now))
    case 'completed':
      return tasks.filter((task) => isTaskCompleted(task))
  }
}

export function taskScopeCounts(
  tasks: ProjectTask[],
  opts: Parameters<typeof filterTasksForScope>[2]
): Record<ProjectTaskListScope, number> {
  return {
    assignedToMe: filterTasksForScope(tasks, 'assignedToMe', opts).length,
    active: filterTasksForScope(tasks, 'active', opts).length,
    overdue: filterTasksForScope(tasks, 'overdue', opts).length,
    completed: filterTasksForScope(tasks, 'completed', opts).length,
  }
}

export function taskStatCounts(tasks: ProjectTask[], now = new Date()) {
  return {
    todo: tasks.filter((task) => task.status === 'To Do').length,
    inProgress: tasks.filter((task) => task.status === 'In Progress').length,
    overdue: tasks.filter((task) => isTaskOverdue(task, now)).length,
    done: tasks.filter((task) => isTaskCompleted(task)).length,
  }
}
