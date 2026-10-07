'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { canSeeAnyVariations } from '@/lib/variations/variationAccess'

/** Operatives never open variations. The screen does not paint. */
export function VariationAccess({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user, loading } = useAuthStore()
  const allowed = Boolean(user) && canSeeAnyVariations(user)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (!allowed) router.replace('/dashboard')
  }, [loading, user, allowed, router])

  if (loading || !user || !allowed) return null
  return children
}
