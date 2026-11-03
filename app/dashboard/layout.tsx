'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppShell } from '@/components/shell/AppShell'
import { BillingReadOnlyBanner } from '@/components/billing/BillingReadOnlyBanner'
import { ProductAnalyticsProvider } from '@/components/analytics/ProductAnalyticsProvider'
import { AnalyticsConsentHost } from '@/components/analytics/AnalyticsConsentHost'
import { SplashScreen } from '@/components/auth/SplashScreen'
import { PolicyGate } from '@/components/auth/PolicyGate'
import { CheckEmailScreen } from '@/components/auth/CheckEmailScreen'
import { hasCustomerOrganisation, isPlatformOwnerEmail } from '@/lib/platform/owner'
import { DeactivatedAccountScreen } from '@/components/auth/DeactivatedAccountScreen'
import { isMfaGateOpen, mfaVerifyHref } from '@/lib/auth/mfa/mfaClient'
import { MISSING_USER_PROFILE_SETUP_HREF } from '@/lib/auth/missingProfile'
import { legalPackNeedsAcceptance, subscriptionAccess } from '@/lib/canonical'
import { hasAdminAccess } from '@/lib/navigation/menuPermissions'
import { LAPSED_BILLING_PATH, LapsedBillingOnly, SubscriptionLapsedScreen } from '@/components/billing/SubscriptionLapsedScreen'
import { LEGAL_ENTITY } from '@/lib/legal/customerLegalPack'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, firebaseUser, organization, loading, error, mfaPending, mfaVerified, mfaStatusKnown, ensureSignedInProfile } =
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
          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                profileRetryStarted.current = false
                void ensureSignedInProfile()
              }}
            >
              Try again
            </button>
            <Link href={MISSING_USER_PROFILE_SETUP_HREF} className="btn">
              Set up an organisation
            </Link>
            <p className="text-xs text-slate-500">If you were invited back, open the link in that email instead.</p>
          </div>
        </div>
      </div>
    )
  }
  if (!user && firebaseUser) return <SplashScreen />
  if (!user) return <SplashScreen />
  if (!mfaVerified) return <SplashScreen />
  if (user.isActive === false && !isPlatformOwnerEmail(user.email)) return <DeactivatedAccountScreen />
  if (user.accountConfirmed === false) return <CheckEmailScreen email={user.email} />
  if (
    legalPackNeedsAcceptance({
      policyAccepted: user.policyAccepted,
      acceptedVersion: user.legalPackVersion,
      currentVersion: LEGAL_ENTITY.version,
    })
  ) {
    return <PolicyGate />
  }

  // Rulebook 1.13.0 §19 (`subscriptionAccess`): a lapsed subscription blocks the app; admins reach billing only.
  const access = subscriptionAccess({
    billing: organization?.billing,
    viewerIsAdmin: hasAdminAccess(user),
    viewerIsPlatformOwner: isPlatformOwnerEmail(user.email),
  })
  if (access === 'blocked') return <SubscriptionLapsedScreen admin={false} />
  if (access === 'adminBillingOnly') {
    if (pathname?.startsWith(LAPSED_BILLING_PATH)) return <LapsedBillingOnly>{children}</LapsedBillingOnly>
    return <SubscriptionLapsedScreen admin />
  }

  return (
    <AppShell>
      <BillingReadOnlyBanner />
      <AnalyticsConsentHost autoPrompt />
      <ProductAnalyticsProvider>{children}</ProductAnalyticsProvider>
    </AppShell>
  )
}
