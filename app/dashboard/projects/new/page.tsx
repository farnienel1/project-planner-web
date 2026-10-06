'use client'

import { useRouter } from 'next/navigation'
import { FormBackLink } from '@/components/forms/FormShell'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { PageHeader } from '@/components/dashboard/PageShell'

export default function NewProjectPage() {
  const router = useRouter()
  return (
    <div className="space-y-6">
      <FormBackLink href="/dashboard/projects" label="Back to projects" />
      <PageHeader title="New project" />
      <ProjectForm backHref="/dashboard/projects" onSaved={(id) => router.push(`/dashboard/projects/${id}`)} />
    </div>
  )
}
