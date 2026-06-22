import { Suspense } from 'react'
import SetupPasswordClient from './SetupPasswordClient'

export const metadata = {
  title: 'Set up password | Project Planner',
}

export default function SetupPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9]">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      }
    >
      <SetupPasswordClient />
    </Suspense>
  )
}
