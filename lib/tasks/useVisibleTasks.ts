'use client'

/**
 * Rulebook 1.91.0 §34 decision A: the tasks the signed-in person may see (`visibleTasksForViewer`), for screens that
 * count or list tasks outside the Tasks pages — Home and a job's Tasks figure — so their counts match the Tasks list.
 * Only gathers inputs from the stores the screen already loads.
 */

import { useEffect, useMemo } from 'react'
import { useAuthStore } from '@/lib/stores/authStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore, useRosterDocuments } from '@/lib/stores/siteAuditStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { taskViewerRole, visibleTasksForViewer } from '@/lib/canonical'
import { taskVisibilityReady } from '@/lib/tasks/taskVisibilityReady'
import type { ProjectTask } from '@/types'

/**
 * `extraJobs`: a job the screen already holds (a job page has its own copy) — so its manager list counts even before
 * the job lists load. The hook asks the operatives, managers and users stores to load (each store keeps one listener),
 * unless `load: false` (Home loads them itself and may pause its loads).
 */
export function useVisibleTasks(
  extraJobs?: ReadonlyArray<{ id: string }> | null,
  options?: { load?: boolean }
): ProjectTask[] {
  return useVisibleTasksState(extraJobs, options).tasks
}

/**
 * The visible tasks and whether that list can be trusted yet (`taskVisibilityReady`, review of #458): until it is,
 * screens show their figures as loading, never a short count.
 */
export function useVisibleTasksState(
  extraJobs?: ReadonlyArray<{ id: string }> | null,
  options?: { load?: boolean }
): { tasks: ProjectTask[]; ready: boolean } {
  const { user, organization } = useAuthStore()
  const tasks = useTaskStore((state) => state.tasks)
  const operatives = useOperativeStore((state) => state.operatives)
  const managers = useOperativeStore((state) => state.managers)
  const allManagerRows = useOperativeStore((state) => state.allManagerRows)
  const projects = useProjectStore((state) => state.projects)
  const smallWorks = useProjectStore((state) => state.smallWorks)
  const projectsLoadedOrgId = useProjectStore((state) => state.projectsLoadedOrgId)
  const smallWorksLoadedOrgId = useProjectStore((state) => state.smallWorksLoadedOrgId)
  const operativesLoadedOrgId = useOperativeStore((state) => state.operativesLoadedOrgId)
  const managersLoadedOrgId = useOperativeStore((state) => state.managersLoadedOrgId)
  const rosterServerOrgId = useOrgUserStore((state) => state.rosterServerOrgId ?? null)
  const roster = useRosterDocuments(organization?.id)
  const loadOperatives = useOperativeStore((state) => state.loadOperatives)
  const loadManagers = useOperativeStore((state) => state.loadManagers)
  const loadUsers = useOrgUserStore((state) => state.loadUsers)
  const orgId = organization?.id
  const load = options?.load !== false
  useEffect(() => {
    if (!orgId || !load) return
    loadOperatives(orgId)
    loadManagers(orgId)
    loadUsers(orgId)
  }, [orgId, load, loadOperatives, loadManagers, loadUsers])
  const allManagers = allManagerRows.length > 0 ? allManagerRows : managers
  const ready = taskVisibilityReady({
    role: taskViewerRole(user),
    orgId,
    hasOwnJobs: Boolean(extraJobs && extraJobs.length > 0),
    projectsLoadedOrgId,
    smallWorksLoadedOrgId,
    operativesLoadedOrgId,
    managersLoadedOrgId,
    rosterServerOrgId,
  })
  const visible = useMemo(
    () =>
      visibleTasksForViewer({
        viewer: user as unknown as Record<string, unknown>,
        tasks,
        jobs: [...(extraJobs || []), ...projects, ...smallWorks] as never,
        roster,
        operatives,
        managers: allManagers,
      }),
    [user, tasks, extraJobs, projects, smallWorks, roster, operatives, allManagers]
  )
  return { tasks: visible, ready }
}
