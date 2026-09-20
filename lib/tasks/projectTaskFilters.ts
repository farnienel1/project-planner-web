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
      return tasks.filter((task) => !isTaskCompleted(task) && assigned(task))
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

export type JobTaskFilterType = 'all' | 'operative' | 'manager' | 'dateRange'

export type JobTaskFilter = {
  type: JobTaskFilterType
  operativeId?: string
  managerId?: string
  dateStart?: Date
  dateEnd?: Date
}

export const EMPTY_JOB_TASK_FILTER: JobTaskFilter = { type: 'all' }

export const JOB_TASK_FILTER_TYPES: { id: JobTaskFilterType; label: string }[] = [
  { id: 'all', label: 'All Tasks' },
  { id: 'operative', label: 'By Operative' },
  { id: 'manager', label: 'By Manager' },
  { id: 'dateRange', label: 'Date Range' },
]

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function applyJobTaskFilter(tasks: ProjectTask[], filter: JobTaskFilter): ProjectTask[] {
  switch (filter.type) {
    case 'operative':
      return filter.operativeId
        ? tasks.filter((task) => allAssignedOperativeIds(task).includes(filter.operativeId as string))
        : tasks
    case 'manager':
      return filter.managerId
        ? tasks.filter((task) => allAssignedManagerIds(task).includes(filter.managerId as string))
        : tasks
    case 'dateRange': {
      if (!filter.dateStart && !filter.dateEnd) return tasks
      const start = startOfDay(filter.dateStart || filter.dateEnd || new Date())
      const end = startOfDay(filter.dateEnd || filter.dateStart || new Date())
      return tasks.filter((task) => {
        if (!task.dueDate) return false
        const due = startOfDay(task.dueDate).getTime()
        return due >= start.getTime() && due <= end.getTime()
      })
    }
    default:
      return tasks
  }
}

export function jobTaskFilterDescription(
  filter: JobTaskFilter,
  operatives: Pick<Operative, 'id' | 'firstName' | 'lastName' | 'email'>[],
  managers: Pick<Manager, 'id' | 'firstName' | 'lastName' | 'email'>[]
): string {
  const personName = (row: { firstName: string; lastName: string; email: string }) =>
    `${row.firstName} ${row.lastName}`.trim() || row.email
  switch (filter.type) {
    case 'operative': {
      const name = operatives.find((row) => row.id === filter.operativeId)
      return name ? `Filtered by operative: ${personName(name)}` : 'Filtered by operative'
    }
    case 'manager': {
      const name = managers.find((row) => row.id === filter.managerId)
      return name ? `Filtered by manager: ${personName(name)}` : 'Filtered by manager'
    }
    case 'dateRange': {
      if (!filter.dateStart && !filter.dateEnd) return 'Filtered by date range'
      const start = filter.dateStart || filter.dateEnd
      const end = filter.dateEnd || filter.dateStart
      if (!start || !end) return 'Filtered by date range'
      const fmt = (date: Date) =>
        date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      return `Filtered by date: ${fmt(start)} – ${fmt(end)}`
    }
    default:
      return 'Showing all tasks'
  }
}

export function personDisplayName(row: { firstName: string; lastName: string; email: string }): string {
  return `${row.firstName} ${row.lastName}`.trim() || row.email
}
