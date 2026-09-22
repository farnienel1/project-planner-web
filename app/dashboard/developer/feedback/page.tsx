'use client'

import { Suspense } from 'react'
import { DeveloperFeedbackScreen } from '@/components/developer/DeveloperFeedback'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

export default function DeveloperFeedbackPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DeveloperFeedbackScreen />
    </Suspense>
  )
}
