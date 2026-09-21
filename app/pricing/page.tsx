import type { Metadata } from 'next'
import { PricingPage } from '@/components/marketing/PricingPage'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { PAGE_META } from '@/lib/marketing/content'

export const metadata: Metadata = PAGE_META.pricing

export default function PricingRoute() {
  return (
    <MarketingShell>
      <PricingPage />
    </MarketingShell>
  )
}
