'use client'

import { useSearchParams } from 'next/navigation'
import { useParams } from 'next/navigation'
import { EditUserProfile } from '@/components/users/EditUserProfile'

function hubHref(from: string | null) {
  if (from === 'managers') return '/dashboard/managers'
  if (from === 'operatives') return '/dashboard/operatives'
  return '/dashboard/settings/users'
}

export default function EditUserPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const userId = params.userId as string
  const from = searchParams.get('from') || 'users'

  return (
    <EditUserProfile
      userId={userId}
      backHref={`/dashboard/users/${userId}?from=${encodeURIComponent(from)}`}
      suppressAdminAccessToggle={from === 'managers'}
      hubHref={hubHref(from)}
    />
  )
}
