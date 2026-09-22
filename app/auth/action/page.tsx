import { Suspense } from 'react'
import { CompletePasswordResetScreen } from '@/components/auth/CompletePasswordResetScreen'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Reset password | Project Planner',
}

export default function AuthActionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
        </div>
      }
    >
      <CompletePasswordResetScreen />
    </Suspense>
  )
}
