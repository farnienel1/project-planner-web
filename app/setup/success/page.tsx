import { Suspense } from 'react'
import SetupSuccessClient from './SetupSuccessClient'

export const metadata = {
  title: 'Setup complete | Project Planner',
}

export default function SetupSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="dark pp-site-dark flex min-h-screen items-center justify-center bg-[var(--bg)]">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      }
    >
      <SetupSuccessClient />
    </Suspense>
  )
}
