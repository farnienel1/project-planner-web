import { Suspense } from 'react'
import VerifyEmailClient from './VerifyEmailClient'

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="dark pp-site-dark flex min-h-screen items-center justify-center bg-[var(--bg)]">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  )
}
