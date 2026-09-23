'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ResetPasswordRequestScreen } from '@/components/auth/ResetPasswordRequestScreen'
import { CompletePasswordResetScreen } from '@/components/auth/CompletePasswordResetScreen'
import { isPasswordResetAction, parseEmailActionSearch } from '@/lib/auth/emailAction'

function ResetPasswordRouter() {
  const searchParams = useSearchParams()
  const action = parseEmailActionSearch(searchParams)
  if (isPasswordResetAction(action)) return <CompletePasswordResetScreen />
  return <ResetPasswordRequestScreen initialEmail={searchParams.get('email') || ''} />
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
        </div>
      }
    >
      <ResetPasswordRouter />
    </Suspense>
  )
}
