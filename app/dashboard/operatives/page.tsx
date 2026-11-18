/**
 * The one Operatives page (owner 17 Nov): the Manage users table, Operatives only, with an Add operative button.
 * Admins and managers with the Operatives permission (rulebook `canManageOperatives`, §11). For an Operatives manager
 * `/dashboard/settings/users` redirects here, so there is one page, not two.
 * iOS: Views/OperativesView.swift
 */

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { canViewOperatives } from '@/lib/permissions'
import { ManageUsersScreen } from '@/components/users/ManageUsersScreen'

export default function OperativesPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const allowed = canViewOperatives(user)

  useEffect(() => {
    if (user && !allowed) router.replace('/dashboard')
  }, [user, allowed, router])

  if (!user || !allowed) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="muted">Loading operatives...</p>
      </div>
    )
  }

  return <ManageUsersScreen scope="operatives" />
}
