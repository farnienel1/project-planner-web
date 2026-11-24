import type { Metadata } from 'next'
import { SharedCompliancePage } from '@/components/compliance/SharedCompliancePage'

export const metadata: Metadata = {
  title: 'Shared documents · Project Planner',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <SharedCompliancePage token={token} />
}
