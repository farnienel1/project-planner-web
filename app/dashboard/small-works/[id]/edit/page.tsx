'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useProjectStore } from '@/lib/stores/projectStore'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { FormBackLink } from '@/components/forms/FormShell'
import { LoadingSpinner, PageHeader } from '@/components/dashboard/PageShell'
import type { Project } from '@/types'

export default function EditSmallWorkPage() {
  const params = useParams()
  const router = useRouter()
  const { organization } = useAuthStore()
  const { getProject } = useProjectStore()
  const [work, setWork] = useState<Project | null>(null)

  useEffect(() => {
    if (!organization?.id || !params.id) return
    getProject(organization.id, String(params.id), 'smallWorks').then(setWork)
  }, [organization, params.id, getProject])

  if (!work) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <FormBackLink href={`/dashboard/small-works/${work.id}`} label="Back to small work" />
      <PageHeader title="Edit small work" description={`Job #${work.jobNumber}`} />
      <ProjectForm initial={work} collection="smallWorks" backHref={`/dashboard/small-works/${work.id}`} onSaved={() => router.push(`/dashboard/small-works/${work.id}`)} />
    </div>
  )
}
