'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { ManagerForm } from '@/components/managers/ManagerForm'
import { FormBackLink } from '@/components/forms/FormShell'
import { LoadingSpinner, PageHeader } from '@/components/dashboard/PageShell'
import type { Manager } from '@/types'

export default function EditManagerPage() {
  const params = useParams()
  const router = useRouter()
  const { organization } = useAuthStore()
  const { getManager } = useOperativeStore()
  const [manager, setManager] = useState<Manager | null>(null)

  useEffect(() => {
    if (!organization?.id || !params.id) return
    getManager(organization.id, String(params.id)).then(setManager)
  }, [organization, params.id, getManager])

  if (!manager) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <FormBackLink href={`/dashboard/managers/${manager.id}`} label="Back to manager" />
      <PageHeader title="Edit manager" description={`${manager.firstName} ${manager.lastName}`} />
      <ManagerForm initial={manager} backHref={`/dashboard/managers/${manager.id}`} onSaved={() => router.push(`/dashboard/managers/${manager.id}`)} />
    </div>
  )
}
