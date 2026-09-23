'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { DeveloperAppShell } from '@/components/developer/DeveloperShell'
import { DeveloperDataBoot } from '@/components/developer/DeveloperDataBoot'
import { LoadingSpinner } from '@/components/dashboard/PageShell'
import { isMfaGateOpen, mfaVerifyHref } from '@/lib/auth/mfa/mfaClient'

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, firebaseUser, loading, mfaPending, mfaVerified, mfaStatusKnown } = useAuthStore()
  const email = firebaseUser?.email || user?.email
  const allowed = isPlatformOwnerEmail(email)
  const blocked =
    mfaPending ||
    isMfaGateOpen(firebaseUser?.uid || user?.id) ||
    Boolean((firebaseUser || user) && (!mfaStatusKnown || !mfaVerified))

  useEffect(() => {
    if (blocked) {
      router.replace(mfaVerifyHref('/developer'))
      return
    }
    if (loading && !firebaseUser && !user) return
    if (!firebaseUser && !user) {
      router.replace('/developer-login')
      return
    }
    if (!allowed) {
      router.replace('/dashboard')
    }
  }, [allowed, blocked, firebaseUser, loading, router, user])

  if (blocked || !mfaVerified) {
    return <LoadingSpinner label="Verification required…" />
  }

  if (allowed) {
    return (
      <DeveloperAppShell>
        <DeveloperDataBoot />
        {children}
      </DeveloperAppShell>
    )
  }

  return <LoadingSpinner label="Checking owner access…" />
}
