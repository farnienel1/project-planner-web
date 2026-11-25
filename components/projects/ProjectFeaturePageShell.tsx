'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ProjectRecordPageShell } from '@/components/projects/ProjectRecordPageShell'
import { ProjectWorkspaceChrome } from '@/components/projects/ProjectWorkspaceChrome'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useVisibleTasks } from '@/lib/tasks/useVisibleTasks'
import { useAuthStore } from '@/lib/stores/authStore'
import { jobTileBadges } from '@/lib/canonical'

export function ProjectFeaturePageShell({
  title: _title,
  backLabel: _backLabel,
  collection = 'projects',
  children,
}: {
  title: string
  backLabel: string
  collection?: 'projects' | 'smallWorks'
  children: (project: import('@/types').Project) => ReactNode
}) {
  const { organization } = useAuthStore()
  const { loadTasks } = useTaskStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!organization?.id) return
    loadTasks(organization.id).finally(() => setReady(true))
  }, [organization?.id, loadTasks])

  return (
    <ProjectRecordPageShell collection={collection}>
      {(project) => {
        const basePath =
          collection === 'smallWorks' ? `/dashboard/small-works/${project.id}` : `/dashboard/projects/${project.id}`
        return (
          <JobTasksChrome project={project} basePath={basePath} ready={ready}>
            {children(project)}
          </JobTasksChrome>
        )
      }}
    </ProjectRecordPageShell>
  )
}

/** Rulebook 1.91.0 §34 decision A: the workspace's Tasks figure counts only the tasks this person may see. */
function JobTasksChrome({
  project,
  basePath,
  ready,
  children,
}: {
  project: import('@/types').Project
  basePath: string
  ready: boolean
  children: ReactNode
}) {
  const jobs = useMemo(() => [project], [project])
  const tasks = useVisibleTasks(jobs)
  const openTaskCount = jobTileBadges({ jobId: project.id, tasks }).openTasks
  return (
    <ProjectWorkspaceChrome project={project} basePath={basePath} taskCount={ready ? openTaskCount : undefined}>
      {children}
    </ProjectWorkspaceChrome>
  )
}
