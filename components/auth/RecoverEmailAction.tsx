'use client'

import { Suspense, useLayoutEffect, useState } from 'react'
import { CompletePasswordResetScreen } from '@/components/auth/CompletePasswordResetScreen'
import { EMAIL_ACTION_BOOT_SCRIPT, emailActionRecoveryHref, parseEmailActionSearch } from '@/lib/auth/emailAction'

function OpeningResetLink() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
    </div>
  )
}

/**
 * Firebase emails land on /__/auth/action. Next has no such route, so App Router
 * hydrates the 404. Wrap the 404 UI: if the URL carries an oobCode, show the
 * password form (and jump to /auth/action) instead of "went off-site".
 */
export function EmailActionNotFoundGate({ children }: { children: React.ReactNode }) {
  const [handleAction, setHandleAction] = useState(false)

  useLayoutEffect(() => {
    const search = window.location.search
    const action = parseEmailActionSearch(new URLSearchParams(search.replace(/^\?/, '')))
    if (!action.oobCode) return
    setHandleAction(true)
    const href = emailActionRecoveryHref(window.location.pathname, search)
    if (href) window.location.replace(href)
  }, [])

  if (handleAction) {
    return (
      <Suspense fallback={<OpeningResetLink />}>
        <CompletePasswordResetScreen />
      </Suspense>
    )
  }

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: EMAIL_ACTION_BOOT_SCRIPT }} />
      {children}
    </>
  )
}

