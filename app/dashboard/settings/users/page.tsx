'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { peopleManagementHref } from '@/lib/navigation/menuPermissions'
import { ManageUsersScreen } from '@/components/users/ManageUsersScreen'

/**
 * Manage users: admins only (every level). Owner 17 Nov — one page for operatives: a manager with the Operatives
 * permission is sent to the Operatives page (`peopleManagementHref`), which has the same table, Operatives only.
 */
export default function ManageUsersPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const destination = user ? peopleManagementHref(user) : null
  const here = destination === '/dashboard/settings/users'

  useEffect(() => {
    if (user && !here) router.replace(destination ?? '/dashboard')
  }, [user, here, destination, router])

  if (!user || !here) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    )
  }

  return <ManageUsersScreen />
}
