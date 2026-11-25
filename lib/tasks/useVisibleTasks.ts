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
import { visibleTasksForViewer } from '@/lib/canonical'
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
  const { user, organization } = useAuthStore()
  const tasks = useTaskStore((state) => state.tasks)
  const operatives = useOperativeStore((state) => state.operatives)
  const managers = useOperativeStore((state) => state.managers)
  const allManagerRows = useOperativeStore((state) => state.allManagerRows)
  const projects = useProjectStore((state) => state.projects)
  const smallWorks = useProjectStore((state) => state.smallWorks)
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
  return useMemo(
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
}
