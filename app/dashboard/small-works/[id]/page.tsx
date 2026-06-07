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

export default function SmallWorkDetailPage() {
  const params = useParams()
  const { organization } = useAuthStore()
  const { getProject } = useProjectStore()
  const { tasks, loadTasks } = useTaskStore()
  const [work, setWork] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organization?.id || !params.id) return
    getProject(organization.id, String(params.id), 'smallWorks').then((p) => {
      setWork(p)
      setLoading(false)
    })
    loadTasks(organization.id)
  }, [organization, params.id, getProject, loadTasks])

  const openTaskCount = useMemo(
    () => tasks.filter(t => t.projectId === String(params.id) && t.status !== 'Completed').length,
    [tasks, params.id]
  )

  if (loading) return <LoadingSpinner />
  if (!work) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/small-works" className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 hover:underline">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to small works
        </Link>
        <p className="text-slate-600">Small work not found.</p>
      </div>
    )
  }

  const basePath = `/dashboard/small-works/${work.id}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/small-works"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Small works
        </Link>
        <Link
          href={`${basePath}/edit`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </Link>
      </div>
      <ProjectHub project={work} basePath={basePath} taskCount={openTaskCount} />
    </div>
  )
}
