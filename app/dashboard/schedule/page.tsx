'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

function ScheduleLegacyRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const query = searchParams.toString()
    router.replace(query ? `/dashboard/daily-overview?${query}` : '/dashboard/daily-overview')
  }, [router, searchParams])

  return <LoadingSpinner label="Redirecting…" />
}

/** Legacy route — daily overview was previously at /dashboard/schedule. */
export default function ScheduleRedirectPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Redirecting…" />}>
      <ScheduleLegacyRedirect />
    </Suspense>
  )
}
