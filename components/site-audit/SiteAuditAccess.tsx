'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { canViewSiteAudit } from '@/lib/permissions'

/** Operatives with Site audit off are sent home. The screen does not paint. */
export function SiteAuditAccess({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user, loading } = useAuthStore()
  const allowed = Boolean(user) && canViewSiteAudit(user)

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
