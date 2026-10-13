'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { shouldSendUnconfirmedFounderToCheckEmail } from '@/lib/orgSetup/setupAuthGuardPolicy'

/**
 * Wait for auth on /setup. Do not unmount the wizard when the new founder
 * document is written with accountConfirmed: false — that aborted Stripe.
 * Check-email after pay is `/setup/success`; the dashboard still blocks.
 */
export function SetupAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading } = useAuthStore()
  const sendToCheckEmail = shouldSendUnconfirmedFounderToCheckEmail({
    accountConfirmed: user?.accountConfirmed,
    path: pathname,
  })

  useEffect(() => {
    if (loading || !sendToCheckEmail) return
    router.replace('/setup/check-email')
  }, [loading, sendToCheckEmail, router])

  if (loading) {
    return <LoadingSpinner label="Loading…" />
  }

  if (sendToCheckEmail) {
    return <LoadingSpinner label="Redirecting…" />
  }

  return <>{children}</>
}
