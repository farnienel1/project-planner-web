'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { OperativeForm } from '@/components/operatives/OperativeForm'
import { FormBackLink } from '@/components/forms/FormShell'
import { LoadingSpinner, PageHeader } from '@/components/dashboard/PageShell'
import type { Operative } from '@/types'

export default function EditOperativePage() {
  const params = useParams()
  const router = useRouter()
  const { organization } = useAuthStore()
  const { getOperative } = useOperativeStore()
  const [operative, setOperative] = useState<Operative | null>(null)

  useEffect(() => {
    if (!organization?.id || !params.id) return
    getOperative(organization.id, String(params.id)).then(setOperative)
  }, [organization, params.id, getOperative])

  if (!operative) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <FormBackLink href={`/dashboard/operatives/${operative.id}`} label="Back to operative" />
      <PageHeader title="Edit operative" description={`${operative.firstName} ${operative.lastName}`} />
      <OperativeForm initial={operative} backHref={`/dashboard/operatives/${operative.id}`} onSaved={() => router.push(`/dashboard/operatives/${operative.id}`)} />
    </div>
  )
}
