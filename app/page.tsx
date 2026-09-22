'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { HomePage } from '@/components/marketing/HomePage'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { EmailActionCatch } from '@/components/auth/EmailActionCatch'

export default function Home() {
  const router = useRouter()
  const { user, loading } = useAuthStore()

  useEffect(() => {
    if (!loading && user) router.push('/dashboard')
  }, [user, loading, router])

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
      </div>
    )
  }

  return (
    <MarketingShell current="/">
      <Suspense fallback={null}>
        <EmailActionCatch />
      </Suspense>
      <HomePage />
    </MarketingShell>
  )
}
