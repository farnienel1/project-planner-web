'use client'

import { useRouter } from 'next/navigation'
import { FormBackLink } from '@/components/forms/FormShell'
import { PageHeader } from '@/components/dashboard/PageShell'
import { ManagerForm } from '@/components/managers/ManagerForm'

export default function NewManagerPage() {
  const router = useRouter()
  return (
    <div className="space-y-6">
      <FormBackLink href="/dashboard/managers" label="Back to managers" />
      <PageHeader title="New Manager" description="Job-assignment manager record in Firebase organizations/{org}/managers — the same catalogue iOS uses on jobs." />
      <ManagerForm backHref="/dashboard/managers" onSaved={(id) => router.push(`/dashboard/managers/${id}`)} />
    </div>
  )
}
