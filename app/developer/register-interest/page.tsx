import { Suspense } from 'react'
import { RegisterInterestList } from '@/components/developer/RegisterInterestConsole'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

export const metadata = { title: 'Register interest | Owner console' }

export default function DeveloperRegisterInterestPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RegisterInterestList />
    </Suspense>
  )
}
