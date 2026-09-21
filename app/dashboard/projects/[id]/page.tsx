'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { useTaskStore } from '@/lib/stores/taskStore'
import { ProjectHub } from '@/components/projects/ProjectHub'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import type { Project } from '@/types'

export default function ProjectDetailPage() {
  const params = useParams()
  const { organization } = useAuthStore()
  const { getProject } = useProjectStore()
  const { tasks, loadTasks } = useTaskStore()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organization?.id || !params.id) return
    getProject(organization.id, String(params.id), 'projects').then((p) => {
      setProject(p)
      setLoading(false)
    })
    loadTasks(organization.id)
  }, [organization, params.id, getProject, loadTasks])

  const openTaskCount = useMemo(
    () => tasks.filter(t => t.projectId === String(params.id) && t.status !== 'Completed').length,
    [tasks, params.id]
  )

  if (loading) return <LoadingSpinner />
  if (!project) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/projects" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to projects
        </Link>
        <p className="text-slate-600">Project not found.</p>
      </div>
    )
  }

  const basePath = `/dashboard/projects/${project.id}`

  return <ProjectHub project={project} basePath={basePath} taskCount={openTaskCount} />
}
