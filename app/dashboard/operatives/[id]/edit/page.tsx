'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { OperativeForm } from '@/components/operatives/OperativeForm'
import { FormBackLink } from '@/components/forms/FormShell'
import { LoadingSpinner, PageHeader } from '@/components/dashboard/PageShell'
import { editUserHrefForOperative } from '@/lib/operatives/operativeRosterUtils'
import type { Operative } from '@/types'

export default function EditOperativePage() {
  const params = useParams()
  const router = useRouter()
  const { organization } = useAuthStore()
  const { getOperative, operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const [operative, setOperative] = useState<Operative | null>(null)
  const operativeId = String(params.id || '')

  useEffect(() => {
    if (!organization?.id) return
    loadOperatives(organization.id)
    loadUsers(organization.id)
    getOperative(organization.id, operativeId).then(setOperative)
  }, [organization?.id, operativeId, getOperative, loadOperatives, loadUsers])

  useEffect(() => {
    if (!operativeId || users.length === 0) return
    const href = editUserHrefForOperative(operativeId, operatives.length ? operatives : operative ? [operative] : [], users)
    if (href.startsWith('/dashboard/users/')) router.replace(href)
  }, [operativeId, operatives, operative, users, router])

  if (!operative) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <FormBackLink href="/dashboard/operatives" label="Back to operatives" />
      <PageHeader title="Edit catalogue row" description={`${operative.firstName} ${operative.lastName}`} />
      <OperativeForm
        initial={operative}
        backHref="/dashboard/operatives"
        onSaved={() => router.push('/dashboard/operatives')}
      />
    </div>
  )
}
