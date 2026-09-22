import { Suspense } from 'react'
import { DeveloperLoginScreen } from '@/components/auth/DeveloperLoginScreen'

export const metadata = {
  title: 'Developer login | Project Planner',
}

export default function DeveloperLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
        </div>
      }
    >
      <DeveloperLoginScreen />
    </Suspense>
  )
}
