import { isTaskOverdue as projectTaskIsOverdue } from '@/lib/tasks/projectTaskFilters'
import type { Manager, Operative, Project, ProjectTask, User } from '@/types'
import { tasksAssignedToViewer } from '@/lib/canonical'

/**
 * Whether a task is assigned to the signed-in user: rulebook 1.35.0 `tasksAssignedToViewer` (any assignee — operative
 * or manager ids — is one of the viewer's ids: `personIdSet` of their account and email over the users, `operatives`
 * and `managers` rows, without case), the same test Home and My Profile use. 1.36.0: before, web matched one
 * `managers` row on the email and the `operatives` rows on it with letter case, and never the person's own users id,
 * so a task assigned under the users id, a second managers row or an iOS upper-case id was missing from My tasks.
 * The rulebook test matches every task the old one did (never fewer) — `roster` adds the person's other documents.
 */
export function isTaskAssignedToUser(
  task: ProjectTask,
  user: User | null,
  operatives: Operative[],
  managers: Manager[],
  roster: ReadonlyArray<User> = []
): boolean {
  return tasksAssignedToUser([task], user, operatives, managers, roster).length > 0
}

/**
 * The tasks of a list assigned to the signed-in user (`isTaskAssignedToUser` for each), with one call to
 * `tasksAssignedToViewer`, so the viewer's ids are folded once for the whole list rather than once per task.
 * Returned in the given order.
 */
export function tasksAssignedToUser(
  tasks: ReadonlyArray<ProjectTask>,
  user: User | null,
  operatives: Operative[],
  managers: Manager[],
  roster: ReadonlyArray<User> = []
): ProjectTask[] {
  if (!user || tasks.length === 0) return []
  const rows = roster.some((row) => row.id === user.id) ? roster : [user, ...roster]
  return tasksAssignedToViewer({
    viewer: { id: user.id, email: user.email ?? null },
    roster: rows.map((row) => ({
      id: row.id,
      email: row.email ?? null,
      formerUserIds: row.formerUserIds ?? [],
    })),
    operatives: operatives.map((row) => ({ id: row.id, email: row.email ?? null })),
    managers: managers.map((row) => ({ id: row.id, email: row.email ?? null })),
    tasks,
  })
}

/** Rulebook 1.23.0 §23 `isTaskOverdue` on the organisation day. */
export function isTaskOverdue(task: ProjectTask): boolean {
  return projectTaskIsOverdue(task)
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

export function getTaskDetailHref(
  task: ProjectTask,
  projects: Project[],
  smallWorks: Project[]
): string | null {
  const href = getTaskProjectHref(task, projects, smallWorks)
  return href ? `${href}?task=${encodeURIComponent(task.id)}` : null
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
    : tasksAssignedToUser(tasks, user, operatives, managers)

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
