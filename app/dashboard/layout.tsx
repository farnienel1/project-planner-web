'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { AppShell } from '@/components/shell/AppShell'
import { SplashScreen } from '@/components/auth/SplashScreen'
import { PolicyGate } from '@/components/auth/PolicyGate'
import { CheckEmailScreen } from '@/components/auth/CheckEmailScreen'

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
    }
  }, [user, loading, router])

  if (loading) return <SplashScreen />
  if (!user) return <SplashScreen />
  if (user.accountConfirmed === false) return <CheckEmailScreen email={user.email} />
  if (!user.policyAccepted) return <PolicyGate />

  return <AppShell>{children}</AppShell>
}
