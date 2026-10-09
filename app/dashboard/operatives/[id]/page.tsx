'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/lib/stores/authStore'
import { useOperativeStore } from '@/lib/stores/operativeStore'
import { useOrgUserStore } from '@/lib/stores/siteAuditStore'
import { editUserHrefForOperative, findUserForOperative } from '@/lib/operatives/operativeRosterUtils'

/** Roster operatives with an account open the same Edit User as Manage Operatives. */
export default function OperativeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { organization } = useAuthStore()
  const { operatives, loadOperatives } = useOperativeStore()
  const { users, loadUsers } = useOrgUserStore()
  const operativeId = String(params.id || '')

  useEffect(() => {
    if (!organization?.id) return
    loadOperatives(organization.id)
    loadUsers(organization.id)
  }, [organization?.id, loadOperatives, loadUsers])

  useEffect(() => {
    if (!operativeId || users.length === 0) return
    const href = editUserHrefForOperative(operativeId, operatives, users)
    if (href.startsWith('/dashboard/users/')) router.replace(href)
  }, [operativeId, operatives, users, router])

  const operative = operatives.find((row) => row.id === operativeId)
  const linked = findUserForOperative(operative, users)

  if (linked) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="muted">Opening their profile…</p>
      </div>
    )
  }

  if (!operative) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Operative not found</p>
          <Link href="/dashboard/operatives" className="mt-2 inline-block text-blue-600 hover:underline">
            Back to Operatives
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="empty card pad mx-auto max-w-2xl">
      <h3>
        {operative.firstName} {operative.lastName}
      </h3>
      <p>This roster row has no login. Open the catalogue editor to change contact details.</p>
      <Link href={`/dashboard/operatives/${operative.id}/edit`} className="btn primary">
        Edit catalogue row
      </Link>
    </div>
  )
}
