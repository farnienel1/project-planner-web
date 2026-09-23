import { Suspense } from 'react'
import { MfaVerifyScreen } from '@/components/auth/MfaVerifyScreen'

export const metadata = { title: 'Verification code | Project Planner' }

export default function MfaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
        </div>
      }
    >
      <MfaVerifyScreen />
    </Suspense>
  )
}
