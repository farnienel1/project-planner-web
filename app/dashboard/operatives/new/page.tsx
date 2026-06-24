'use client'

import { useRouter } from 'next/navigation'
import { FormBackLink } from '@/components/forms/FormShell'
import { PageHeader } from '@/components/dashboard/PageShell'
import { OperativeForm } from '@/components/operatives/OperativeForm'
import { useAuthStore } from '@/lib/stores/authStore'

export default function NewOperativePage() {
  const router = useRouter()
  const { organization } = useAuthStore()
  const orgId = organization?.id || 'your organisation'
  return (
    <div className="space-y-6">
      <FormBackLink href="/dashboard/operatives" label="Back to operatives" />
      <PageHeader title="Add operative" description={`Create operative profile in Firebase organizations/${orgId}/operatives`} />
      <OperativeForm backHref="/dashboard/operatives" onSaved={(id) => router.push(`/dashboard/operatives/${id}`)} />
    </div>
  )
}
