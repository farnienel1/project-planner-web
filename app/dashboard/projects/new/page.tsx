'use client'

import { useRouter } from 'next/navigation'
import { FormBackLink } from '@/components/forms/FormShell'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { PageHeader } from '@/components/dashboard/PageShell'
import { useAuthStore } from '@/lib/stores/authStore'

export default function NewProjectPage() {
  const router = useRouter()
  const { organization } = useAuthStore()
  const orgId = organization?.id || 'your organisation'
  return (
    <div className="space-y-6">
      <FormBackLink href="/dashboard/projects" label="Back to projects" />
      <PageHeader title="Create project" description={`New project synced to Firebase organizations/${orgId}/projects`} />
      <ProjectForm backHref="/dashboard/projects" onSaved={(id) => router.push(`/dashboard/projects/${id}`)} />
    </div>
  )
}
