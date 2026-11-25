'use client'

/**
 * The data every task screen needs (main Tasks page, the Tasks tab of Projects and Small works, the task popup), read
 * from the existing stores. Decisions come from the rulebook (§34 `taskAccess`, §23 `tasksAssignedToViewer` via
 * `tasksAssignedToUser`, §21 `taskPersonIndex`; 1.91.0 `visibleTasksForViewer`, `taskAssigneeCandidates`); this hook only
 * gathers inputs.
 */

import { useEffect, useMemo } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore, useRosterDocuments } from '@/lib/stores/siteAuditStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { organizationZoneOr } from '@/lib/orgTime/activeOrganizationZone'
import { tasksAssignedToUser } from '@/lib/tasks/taskUtils'
import { taskPersonIndex } from '@/lib/tasks/taskAssigneePeople'
import { taskAccess, taskAssigneeCandidates, taskPersonKeys, taskViewerRole, visibleTasksForViewer } from '@/lib/canonical'
import type { Project, ProjectTask } from '@/types'

export type TaskLocation = {
  id: string
  kind: 'project' | 'smallWorks'
  code: string
  name: string
  /** The location's Tasks tab. */
  href: string
}

export function taskLocationOf(project: Project, kind: 'project' | 'smallWorks'): TaskLocation {
  const segment = kind === 'smallWorks' ? 'small-works' : 'projects'
  return {
    id: project.id,
    kind,
    code: project.jobNumber || '',
    name: project.siteName || project.jobNumber || 'Untitled',
    href: `/dashboard/${segment}/${project.id}/tasks`,
  }
}

export function useTaskWorkspace() {
  const { user, organization } = useAuthStore()
  const { tasks: storedTasks, loading, error, loadTasks } = useTaskStore()
  const { operatives, managers, allManagerRows, operativesLoadedOrgId, managersLoadedOrgId, loadOperatives, loadManagers } =
    useOperativeStore()
  const { users, loadUsers, rosterLoadedOrgId } = useOrgUserStore()
  const roster = useRosterDocuments(organization?.id)
  const { projects, smallWorks, loadProjects, loadSmallWorks } = useProjectStore()

  useEffect(() => {
    if (!organization?.id) return
    loadTasks(organization.id)
    loadOperatives(organization.id)
    loadManagers(organization.id)
    loadUsers(organization.id)
    loadProjects(organization.id)
    loadSmallWorks(organization.id)
  }, [organization?.id, loadTasks, loadOperatives, loadManagers, loadUsers, loadProjects, loadSmallWorks])

  // Review of #452 (guardrail 3): the level from `permissionLevelOf` (§11), so a legacy user with no level flag is a
  // manager and keeps seeing every task.
  const role = useMemo(() => taskViewerRole(user), [user])
  const access = useMemo(() => taskAccess(role), [role])
  const allManagers = allManagerRows.length > 0 ? allManagerRows : managers
  const personIndex = useMemo(() => taskPersonIndex({ managers, operatives, roster }), [managers, operatives, roster])
  const personKeys = useMemo(() => taskPersonKeys({ managers: allManagers, operatives, roster }).keys, [allManagers, operatives, roster])
  // Rulebook 1.91.0 §34 decision A: admins every task; managers the tasks on jobs they manage plus their own
  // (assigned or created); operatives their own. Every list and count on the task screens reads this list.
  const tasks = useMemo(
    () =>
      visibleTasksForViewer({
        viewer: user as unknown as Record<string, unknown>,
        tasks: storedTasks,
        jobs: [...projects, ...smallWorks],
        roster,
        operatives,
        managers: allManagers,
      }),
    [user, storedTasks, projects, smallWorks, roster, operatives, allManagers]
  )
  // Rulebook 1.91.0 §34 (owner report 25 Nov): who the assignee pickers offer — current people only.
  const candidates = useMemo(
    () => taskAssigneeCandidates({ managers: allManagers, operatives, roster }),
    [allManagers, operatives, roster]
  )
  const assignableManagers = useMemo(() => {
    const ids = new Set(candidates.managerIds.map((id) => id.toLowerCase()))
    return allManagers.filter((row) => ids.has(row.id.toLowerCase()))
  }, [allManagers, candidates])
  const assignableOperatives = useMemo(() => {
    const ids = new Set(candidates.operativeIds.map((id) => id.toLowerCase()))
    return operatives.filter((row) => ids.has(row.id.toLowerCase()))
  }, [operatives, candidates])
  // Never a false "Removed user": rows count as gone only once the users roster has loaded.
  const usersLoaded = Boolean(organization?.id) && rosterLoadedOrgId === organization?.id
  const goneIds = useMemo(() => new Set(usersLoaded ? candidates.goneIds : []), [candidates, usersLoaded])
  const assignedIds = useMemo(
    () => new Set(tasksAssignedToUser(tasks, user, operatives, managers, users).map((task) => task.id)),
    [tasks, user, operatives, managers, users]
  )
  const locations = useMemo(() => {
    const out: TaskLocation[] = []
    for (const row of projects) out.push(taskLocationOf(row, 'project'))
    for (const row of smallWorks) out.push(taskLocationOf(row, 'smallWorks'))
    return out
  }, [projects, smallWorks])
  const liveLocations = useMemo(() => {
    const live = new Set([...projects, ...smallWorks].filter((row) => row.isLive !== false).map((row) => row.id))
    return locations.filter((row) => live.has(row.id))
  }, [locations, projects, smallWorks])

  const locationOf = (task: ProjectTask): TaskLocation | null => {
    const key = (task.projectId || '').trim().toLowerCase()
    return locations.find((row) => row.id.toLowerCase() === key) ?? null
  }

  /** Names on tasks: every managers row as stored (a placeholder a task names still reads by name), once loaded. */
  const rostersLoaded = Boolean(organization?.id) && operativesLoadedOrgId === organization?.id && managersLoadedOrgId === organization?.id
  const nameRows = useMemo(
    () => ({
      managers: allManagers,
      operatives,
      index: personIndex,
      loaded: rostersLoaded,
      goneIds,
    }),
    [allManagers, operatives, personIndex, rostersLoaded, goneIds]
  )

  /** Each person's own access to one task: staff always, anyone else when assigned. */
  const accessFor = (task: ProjectTask | null) => taskAccess(role, { isAssignee: task ? assignedIds.has(task.id) : false })

  /** The signed-in person's own catalogue rows, for "Me" (a managers row first, as the old form did). */
  const me = useMemo(() => {
    const email = (user?.email || '').trim().toLowerCase()
    if (!email) return null
    const manager = managers.find((row) => (row.email || '').trim().toLowerCase() === email && row.isActive !== false)
    if (manager) return { kind: 'manager' as const, id: manager.id }
    const operative = operatives.find((row) => (row.email || '').trim().toLowerCase() === email && row.isActive !== false)
    return operative ? { kind: 'operative' as const, id: operative.id } : null
  }, [user?.email, managers, operatives])

  return {
    user,
    organization,
    tasks,
    /** Every stored task (before visibility), only to tell "no access" from "not found". */
    allTasks: storedTasks,
    loading,
    error,
    operatives,
    managers,
    assignableManagers,
    assignableOperatives,
    personKeys,
    candidates,
    roster,
    role,
    access,
    personIndex,
    nameRows,
    rostersLoaded,
    assignedIds,
    locations,
    liveLocations,
    locationOf,
    accessFor,
    me,
    timeZone: organizationZoneOr(),
  }
}

export type TaskWorkspace = ReturnType<typeof useTaskWorkspace>
