'use client'

import { useSearchParams } from 'next/navigation'
import { useParams } from 'next/navigation'
import { UserProfileSummary } from '@/components/users/UserProfileSummary'

function hubHref(from: string | null) {
  if (from === 'managers') return '/dashboard/managers'
  if (from === 'operatives') return '/dashboard/operatives'
  return '/dashboard/settings/users'
}

export default function UserProfilePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const userId = params.userId as string
  const from = searchParams.get('from') || 'users'

  return <UserProfileSummary userId={userId} backHref={hubHref(from)} from={from} />
}
