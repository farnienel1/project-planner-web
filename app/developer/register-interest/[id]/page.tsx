import { Suspense } from 'react'
import { RegisterInterestPerson } from '@/components/developer/RegisterInterestConsole'
import { LoadingSpinner } from '@/components/dashboard/PageShell'

export const metadata = { title: 'Registration | Owner console' }

export default async function DeveloperRegisterInterestPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <RegisterInterestPerson id={id} />
    </Suspense>
  )
}
