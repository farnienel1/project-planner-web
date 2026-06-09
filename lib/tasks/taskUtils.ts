import type { Manager, Operative, Project, ProjectTask, User } from '@/types'
import { isOperativeMode } from '@/lib/navigation/menuPermissions'

function normalizedEmail(value: string | undefined | null): string {
  return value?.toLowerCase().trim() ?? ''
}

/** Whether a task is assigned to the signed-in user (mirrors iOS `ProjectTask.isAssignedToUser`). */
export function isTaskAssignedToUser(
  task: ProjectTask,
  user: User | null,
  operatives: Operative[],
  managers: Manager[]
): boolean {
  const email = normalizedEmail(user?.email)
  if (!email) return false

  if (isOperativeMode(user)) {
    const operative = operatives.find((op) => normalizedEmail(op.email) === email)
    if (!operative) return false
    return task.assignedOperativeId === operative.id
  }

  const manager = managers.find((m) => normalizedEmail(m.email) === email)
  if (manager && task.assignedManagerId === manager.id) return true

  const operative = operatives.find((op) => normalizedEmail(op.email) === email)
  if (operative && task.assignedOperativeId === operative.id) return true

  return false
}

export function isTaskOverdue(task: ProjectTask): boolean {
  if (task.status === 'Completed' || !task.dueDate) return false
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const due = new Date(task.dueDate)
  due.setHours(0, 0, 0, 0)
  return due < startOfToday
}

export function getTaskProjectHref(
  task: ProjectTask,
  projects: Project[],
  smallWorks: Project[]
): string | null {
  if (!task.projectId) return null
  const isSmallWork = smallWorks.some((sw) => sw.id === task.projectId)
  const collection = isSmallWork ? 'small-works' : 'projects'
  const exists = projects.some((p) => p.id === task.projectId) || isSmallWork
  if (!exists) return null
  return `/dashboard/${collection}/${task.projectId}/tasks`
}

export function resolveProjectName(
  task: ProjectTask,
  projects: Project[],
  smallWorks: Project[]
): string {
  const proj =
    projects.find((p) => p.id === task.projectId) ?? smallWorks.find((sw) => sw.id === task.projectId)
  return proj?.siteName || task.projectId || 'No project'
}

export type TaskListFilter = 'todo' | 'inProgress' | 'overdue' | 'completed'

export function filterTasksForView(
  tasks: ProjectTask[],
  filter: TaskListFilter,
  user: User | null,
  operatives: Operative[],
  managers: Manager[],
  showAllTasks: boolean
): ProjectTask[] {
  let list = showAllTasks
    ? tasks
    : tasks.filter((task) => isTaskAssignedToUser(task, user, operatives, managers))

  switch (filter) {
    case 'todo':
      return list.filter((t) => t.status === 'To Do')
    case 'inProgress':
      return list.filter((t) => t.status === 'In Progress')
    case 'completed':
      return list.filter((t) => t.status === 'Completed')
    case 'overdue':
      return list.filter((t) => isTaskOverdue(t))
    default:
      return list
  }
}
