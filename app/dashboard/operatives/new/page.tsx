'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Rulebook 1.34.0 §11: "Create New Operative" wrote an `operatives` catalogue row with no login. That is now a ghost
 * operative, added from Add user with the Ghost account toggle (`ghostCreateWrites`), so this page only redirects.
 */
export default function NewOperativePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/settings/users/new?ghost=1')
  }, [router])
  return (
    <div className="flex h-64 items-center justify-center">
      <p className="muted">Opening Add user…</p>
    </div>
  )
}
