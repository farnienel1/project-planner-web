'use client'

import { useRouter } from 'next/navigation'
import { FormBackLink } from '@/components/forms/FormShell'
import { PageHeader } from '@/components/dashboard/PageShell'
import { OperativeForm } from '@/components/operatives/OperativeForm'

export default function NewOperativePage() {
  const router = useRouter()
  return (
    <div className="space-y-6">
      <FormBackLink href="/dashboard/operatives" label="Back to operatives" />
      <PageHeader title="Create New Operative" description="Writes to Firebase organizations/{org}/operatives so iOS and web stay in sync." />
      <OperativeForm backHref="/dashboard/operatives" onSaved={(id) => router.push(`/dashboard/operatives/${id}`)} />
    </div>
  )
}
