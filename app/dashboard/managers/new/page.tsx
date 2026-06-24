'use client'

import { useRouter } from 'next/navigation'
import { FormBackLink } from '@/components/forms/FormShell'
import { PageHeader } from '@/components/dashboard/PageShell'
import { ManagerForm } from '@/components/managers/ManagerForm'
import { useAuthStore } from '@/lib/stores/authStore'

export default function NewManagerPage() {
  const router = useRouter()
  const { organization } = useAuthStore()
  const orgId = organization?.id || 'your organisation'
  return (
    <div className="space-y-6">
      <FormBackLink href="/dashboard/managers" label="Back to managers" />
      <PageHeader title="Add manager" description={`Create manager profile in Firebase organizations/${orgId}/managers`} />
      <ManagerForm backHref="/dashboard/managers" onSaved={(id) => router.push(`/dashboard/managers/${id}`)} />
    </div>
  )
}
