'use client'

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { ProjectRecordPageShell } from '@/components/projects/ProjectRecordPageShell'
import { ProjectWorkspaceChrome } from '@/components/projects/ProjectWorkspaceChrome'
import { useTaskStore } from '@/lib/stores/taskStore'
import { useAuthStore } from '@/lib/stores/authStore'

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
  const { tasks, loadTasks } = useTaskStore()
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
        const openTaskCount = tasks.filter((t) => t.projectId === project.id && t.status !== 'Completed').length
        return (
          <ProjectWorkspaceChrome project={project} basePath={basePath} taskCount={ready ? openTaskCount : undefined}>
            {children(project)}
          </ProjectWorkspaceChrome>
        )
      }}
    </ProjectRecordPageShell>
  )
}
