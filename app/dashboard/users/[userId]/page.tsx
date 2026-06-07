'use client'

import { useSearchParams } from 'next/navigation'
import { useParams } from 'next/navigation'
import { EditUserProfile } from '@/components/users/EditUserProfile'

export default function UserProfilePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const userId = params.userId as string
  const from = searchParams.get('from')

  const backHref =
    from === 'managers'
      ? '/dashboard/managers'
      : from === 'operatives'
        ? '/dashboard/operatives'
        : from === 'users'
          ? '/dashboard/settings/users'
          : '/dashboard/settings/users'

  const suppressAdminAccessToggle = from === 'managers'

  return (
    <EditUserProfile userId={userId} backHref={backHref} suppressAdminAccessToggle={suppressAdminAccessToggle} />
  )
}
