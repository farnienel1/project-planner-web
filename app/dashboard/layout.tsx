'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppShell } from '@/components/shell/AppShell'
import { ProductAnalyticsProvider } from '@/components/analytics/ProductAnalyticsProvider'
import { SplashScreen } from '@/components/auth/SplashScreen'
import { PolicyGate } from '@/components/auth/PolicyGate'
import { CheckEmailScreen } from '@/components/auth/CheckEmailScreen'
import { hasCustomerOrganisation, isPlatformOwnerEmail } from '@/lib/platform/owner'
import { isMfaGateOpen } from '@/lib/auth/mfa/mfaClient'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, loading } = useAuthStore()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
      return
    }
    if (!loading && user && isMfaGateOpen(user.id)) {
      router.replace('/auth/mfa?next=/dashboard')
      return
    }
    if (!loading && user && isPlatformOwnerEmail(user.email) && !hasCustomerOrganisation(user.organizationId)) {
      router.replace('/developer')
    }
  }, [user, loading, router])

  if (loading) return <SplashScreen />
  if (!user) return <SplashScreen />
  if (user.accountConfirmed === false) return <CheckEmailScreen email={user.email} />
  if (!user.policyAccepted) return <PolicyGate />

  return <AppShell>
    <ProductAnalyticsProvider>{children}</ProductAnalyticsProvider>
  </AppShell>
}
