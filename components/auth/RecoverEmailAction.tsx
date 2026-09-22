'use client'

import { useEffect } from 'react'
import { parseEmailActionSearch, emailActionRecoveryHref } from '@/lib/auth/emailAction'

/** Firebase reset links often land on /__/auth/action. After hydration Next treats that as 404. */
export function RecoverEmailAction() {
  useEffect(() => {
    const href = emailActionRecoveryHref(window.location.pathname, window.location.search)
    if (href) window.location.replace(href)
  }, [])
  return null
}
