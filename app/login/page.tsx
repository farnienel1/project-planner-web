import { Suspense } from 'react'
import { LoginBrandScreen } from '@/components/auth/LoginBrandScreen'

export const metadata = {
  title: 'Sign in | Project Planner',
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
        </div>
      }
    >
      <LoginBrandScreen />
    </Suspense>
  )
}
