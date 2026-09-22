'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { isPlatformOwnerEmail } from '@/lib/platform/owner'
import { DeveloperAppShell } from '@/components/developer/DeveloperShell'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, firebaseUser, loading } = useAuthStore()
  const email = firebaseUser?.email || user?.email
  const allowed = isPlatformOwnerEmail(email)

  useEffect(() => {
    if (loading) return
    if (!firebaseUser && !user) {
      router.replace('/developer-login')
      return
    }
    if (!allowed) {
      router.replace('/dashboard')
    }
  }, [allowed, firebaseUser, loading, router, user])

  if (loading || !allowed) return <LoadingSpinner label="Checking owner access…" />

  return <DeveloperAppShell>{children}</DeveloperAppShell>
}
