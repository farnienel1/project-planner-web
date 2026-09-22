'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isPasswordResetAction, parseEmailActionSearch } from '@/lib/auth/emailAction'

/** Firebase sometimes sets the custom action URL to the site root. */
export function EmailActionCatch() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const fromHook = parseEmailActionSearch(searchParams)
    const fromWindow =
      typeof window === 'undefined' ? fromHook : parseEmailActionSearch(new URLSearchParams(window.location.search))
    const action = fromWindow.oobCode ? fromWindow : fromHook
    if (!action.oobCode) return
    if (action.mode === 'resetPassword' || isPasswordResetAction(action) || action.mode) {
      const query = typeof window !== 'undefined' ? window.location.search : `?${searchParams.toString()}`
      router.replace(`/auth/action${query.startsWith('?') ? query : `?${query}`}`)
    }
  }, [router, searchParams])

  return null
}
