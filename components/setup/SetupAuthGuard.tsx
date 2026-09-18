'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

/**
 * Redirects authenticated users who already belong to an organisation away from /setup.
 */
export function SetupAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, organization, loading } = useAuthStore()

  useEffect(() => {
    if (loading) return
    if (user && organization?.id) {
      router.replace(user.accountConfirmed === false ? '/setup/check-email' : '/dashboard')
    }
  }, [loading, user, organization?.id, router])

  if (loading) {
    return <LoadingSpinner label="Loading…" />
  }

  if (user && organization?.id) {
    return <LoadingSpinner label={user.accountConfirmed === false ? 'Redirecting…' : 'Redirecting to dashboard…'} />
  }

  return <>{children}</>
}
