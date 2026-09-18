import { Suspense } from 'react'
import ConfirmAccountClient from './ConfirmAccountClient'

export const metadata = {
  title: 'Confirm your account | Project Planner',
}

export default function ConfirmAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f4f6f9]">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      }
    >
      <ConfirmAccountClient />
    </Suspense>
  )
}
