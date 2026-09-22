'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

export default function LegacyDeveloperRedirect() {
  const router = useRouter()
  const pathname = usePathname() || '/dashboard/developer'

  useEffect(() => {
    const next = pathname.replace(/^\/dashboard\/developer/, '/developer') || '/developer'
    router.replace(next)
  }, [pathname, router])

  return <LoadingSpinner label="Opening the owner console…" />
}
