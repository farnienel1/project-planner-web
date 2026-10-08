'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/stores/authStore'
import { canOpenWorkForm } from '@/lib/permissions'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

/** Hides a create or edit form when the catalogue toggle is off. The list stays open. */
export function WorkFormGate({
  kind,
  mode,
  href,
  children,
}: {
  kind: 'projects' | 'smallWorks'
  mode: 'create' | 'edit'
  href: string
  children: ReactNode
}) {
  const router = useRouter()
  const { user, loading } = useAuthStore()
  const allowed = canOpenWorkForm(user, kind, mode)

  useEffect(() => {
    if (!loading && user && !allowed) router.replace(href)
  }, [allowed, href, loading, router, user])

  if (loading || !user || !allowed) return <LoadingSpinner />
  return children
}
