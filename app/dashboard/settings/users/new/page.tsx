'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { canInviteOperatives } from '@/lib/navigation/menuPermissions'
import { AddUserScreen } from '@/components/users/AddUserScreen'

export default function AddUserPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  useEffect(() => {
    if (user && !canInviteOperatives(user)) {
      router.replace('/dashboard')
    }
  }, [user, router])

  if (!user || !canInviteOperatives(user)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  return <AddUserScreen />
}
