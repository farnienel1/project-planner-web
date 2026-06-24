import { OrgSetupWizard } from '@/components/setup/OrgSetupWizard'
import { SetupAuthGuard } from '@/components/setup/SetupAuthGuard'

export const metadata = {
  title: 'Set up organisation | Project Planner',
  description: 'Create your organisation and choose a subscription plan.',
}

export default function SetupPage() {
  return (
    <SetupAuthGuard>
      <OrgSetupWizard />
    </SetupAuthGuard>
  )
}
