'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppShell } from '@/components/shell/AppShell'
import { BillingReadOnlyBanner } from '@/components/billing/BillingReadOnlyBanner'
import { ProductAnalyticsProvider } from '@/components/analytics/ProductAnalyticsProvider'
import { SplashScreen } from '@/components/auth/SplashScreen'
import { PolicyGate } from '@/components/auth/PolicyGate'
import { CheckEmailScreen } from '@/components/auth/CheckEmailScreen'
import { hasCustomerOrganisation, isPlatformOwnerEmail } from '@/lib/platform/owner'
import { isMfaGateOpen, mfaVerifyHref } from '@/lib/auth/mfa/mfaClient'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const { user, loading, mfaPending, mfaVerified, mfaStatusKnown } = useAuthStore()
  const blocked =
    mfaPending ||
    isMfaGateOpen(user?.id) ||
    Boolean(user && (!mfaStatusKnown || !mfaVerified))

  useEffect(() => {
    if (blocked) {
      router.replace(mfaVerifyHref('/dashboard'))
      return
    }
    if (!loading && !user) {
      router.push('/login')
      return
    }
    if (!loading && mfaVerified && user && isPlatformOwnerEmail(user.email) && !hasCustomerOrganisation(user.organizationId)) {
      router.replace('/developer')
    }
  }, [blocked, user, loading, mfaVerified, router])

  if (blocked) return <SplashScreen />
  if (loading) return <SplashScreen />
  if (!user) return <SplashScreen />
  if (!mfaVerified) return <SplashScreen />
  if (user.accountConfirmed === false) return <CheckEmailScreen email={user.email} />
  if (!user.policyAccepted) return <PolicyGate />

  return (
    <AppShell>
      <BillingReadOnlyBanner />
      <ProductAnalyticsProvider>{children}</ProductAnalyticsProvider>
    </AppShell>
  )
}
