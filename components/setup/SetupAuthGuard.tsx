'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

/**
 * Lets signed-in users create another organisation. Unconfirmed founders are
 * sent to check-email instead of repeating setup.
 */
export function SetupAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading } = useAuthStore()

  useEffect(() => {
    if (loading) return
    if (user && user.accountConfirmed === false) {
      router.replace('/setup/check-email')
    }
  }, [loading, user, router])

  if (loading) {
    return <LoadingSpinner label="Loading…" />
  }

  if (user && user.accountConfirmed === false) {
    return <LoadingSpinner label="Redirecting…" />
  }

  return <>{children}</>
}
