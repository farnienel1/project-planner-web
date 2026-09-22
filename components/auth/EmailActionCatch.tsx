'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isPasswordResetAction, parseEmailActionSearch } from '@/lib/auth/emailAction'

/** Firebase sometimes sets the custom action URL to the site root. */
export function EmailActionCatch() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const action = parseEmailActionSearch(searchParams)
    if (!action.oobCode) return
    if (action.mode === 'resetPassword' || isPasswordResetAction(action) || action.mode) {
      router.replace(`/auth/action?${searchParams.toString()}`)
    }
  }, [router, searchParams])

  return null
}
