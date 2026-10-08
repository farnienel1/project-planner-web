'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { canViewMaterials } from '@/lib/permissions'

/** Operatives with Materials off do not get the job materials list. Staff are not gated. */
export function MaterialsAccess({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user, loading } = useAuthStore()
  const allowed = Boolean(user) && canViewMaterials(user)

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/login')
      return
    }
    if (!allowed) router.replace('/dashboard')
  }, [allowed, loading, router, user])

  if (loading || !user || !allowed) return null
  return children
}
