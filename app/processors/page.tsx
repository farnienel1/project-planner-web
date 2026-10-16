import type { Metadata } from 'next'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { ProcessorsPage } from '@/components/marketing/ProcessorsPage'

export const metadata: Metadata = {
  title: 'Processors | Project Planner',
  description: 'The processors and related services currently used to operate Project Planner.',
}

export default function ProcessorsRoute() {
  return (
    <MarketingShell>
      <ProcessorsPage />
    </MarketingShell>
  )
}
