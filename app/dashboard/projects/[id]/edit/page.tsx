'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { FormBackLink } from '@/components/forms/FormShell'
import { LoadingSpinner, PageHeader } from '@/components/dashboard/PageShell'
import type { Project } from '@/types'

export default function EditProjectPage() {
  const params = useParams()
  const router = useRouter()
  const { organization } = useAuthStore()
  const { getProject } = useProjectStore()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!organization?.id || !params.id) return
    getProject(organization.id, String(params.id), 'projects').then((p) => {
      setProject(p)
      setLoading(false)
    })
  }, [organization, params.id, getProject])

  if (loading) return <LoadingSpinner />
  if (!project) return <p className="text-slate-600">Project not found.</p>

  return (
    <div className="space-y-6">
      <FormBackLink href={`/dashboard/projects/${project.id}`} label="Back to project" />
      <PageHeader title="Edit project" description={`Job #${project.jobNumber}`} />
      <ProjectForm
        initial={project}
        collection="projects"
        backHref={`/dashboard/projects/${project.id}`}
        onSaved={() => router.push(`/dashboard/projects/${project.id}`)}
      />
    </div>
  )
}
