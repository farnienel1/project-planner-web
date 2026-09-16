'use client'

import { useRouter } from 'next/navigation'
import { FormBackLink } from '@/components/forms/FormShell'
import { ProjectForm } from '@/components/projects/ProjectForm'
import { PageHeader } from '@/components/dashboard/PageShell'

export default function NewSmallWorkPage() {
  const router = useRouter()
  return (
    <div className="space-y-6">
      <FormBackLink href="/dashboard/small-works" label="Back to small works" />
      <PageHeader title="New small works" description="Create a new small works job. Fill in the essentials, add the rest later." />
      <ProjectForm collection="smallWorks" backHref="/dashboard/small-works" onSaved={(id) => router.push(`/dashboard/small-works/${id}`)} />
    </div>
  )
}
