'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { canAccessDeveloperDashboard } from '@/lib/permissions'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading } = useAuthStore()
  const allowed = canAccessDeveloperDashboard(user)

  useEffect(() => {
    if (!loading && user && !allowed) router.replace('/dashboard')
  }, [allowed, loading, router, user])

  if (loading || !user) return <LoadingSpinner />
  if (!allowed) return <LoadingSpinner label="Not authorised" />
  return <>{children}</>
}
