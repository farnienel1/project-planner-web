'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { canManageUsers } from '@/lib/navigation/menuPermissions'
import { ManageUsersScreen } from '@/components/users/ManageUsersScreen'

export default function ManageUsersPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  useEffect(() => {
    if (user && !canManageUsers(user)) {
      router.replace('/dashboard')
    }
  }, [user, router])

  if (!user || !canManageUsers(user)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  return <ManageUsersScreen />
}
