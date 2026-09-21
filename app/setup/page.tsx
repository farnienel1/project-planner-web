import { Suspense } from 'react'
import { OrgSetupWizard } from '@/components/setup/OrgSetupWizard'
import { SetupAuthGuard } from '@/components/setup/SetupAuthGuard'

export const metadata = {
  title: 'Set up organisation | Project Planner',
  description: 'Create your organisation and choose a subscription plan.',
}

export default function SetupPage() {
  return (
    <SetupAuthGuard>
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--blue)]" />
          </div>
        }
      >
        <OrgSetupWizard />
      </Suspense>
    </SetupAuthGuard>
  )
}
