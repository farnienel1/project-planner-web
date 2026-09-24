'use client'

import { useEffect, useRef } from 'react'
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
  const { user, firebaseUser, loading, error, mfaPending, mfaVerified, mfaStatusKnown, ensureSignedInProfile } =
    useAuthStore()
  const profileRetryStarted = useRef(false)
  const needsMfa =
    mfaPending ||
    isMfaGateOpen(user?.id || firebaseUser?.uid) ||
    (mfaStatusKnown && !mfaVerified && Boolean(user || firebaseUser))

  useEffect(() => {
    if (needsMfa) {
      router.replace(mfaVerifyHref('/dashboard'))
      return
    }
    if (!loading && !user && !firebaseUser) {
      router.push('/login')
      return
    }
    if (!loading && mfaVerified && user && isPlatformOwnerEmail(user.email) && !hasCustomerOrganisation(user.organizationId)) {
      router.replace('/developer')
    }
  }, [needsMfa, user, firebaseUser, loading, mfaVerified, router])

  useEffect(() => {
    if (profileRetryStarted.current || needsMfa || loading || user || !firebaseUser) return
    profileRetryStarted.current = true
    void ensureSignedInProfile()
  }, [needsMfa, loading, user, firebaseUser, ensureSignedInProfile])

  if (needsMfa) return <SplashScreen />
  if (loading) return <SplashScreen />
  if (!mfaStatusKnown && (firebaseUser || user)) return <SplashScreen />
  if (!user && firebaseUser && error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="w-full max-w-md text-center">
          <p className="text-lg font-semibold text-slate-900">Signing in did not finish loading</p>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            className="btn primary mt-6"
            onClick={() => {
              profileRetryStarted.current = false
              void ensureSignedInProfile()
            }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }
  if (!user && firebaseUser) return <SplashScreen />
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
