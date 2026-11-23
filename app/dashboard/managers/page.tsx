/**
 * The admin Managers page (owner 17 Nov): the same table as Manage users and the Operatives page, Managers only
 * (rulebook `rosterListFor('managers')`, §11). Admins only (`canViewManagers`), as before.
 * iOS: Views/ManagersView.swift
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { canViewManagers } from '@/lib/permissions'
import { ManageUsersScreen } from '@/components/users/ManageUsersScreen'

export default function ManagersPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const allowed = canViewManagers(user)

  useEffect(() => {
    if (user && !allowed) router.replace('/dashboard')
  }, [user, allowed, router])

  if (!user || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="muted">Loading managers...</p>
      </div>
    )
  }

  return <ManageUsersScreen scope="managers" />
}
