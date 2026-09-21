import type { Metadata } from 'next'
import { FeaturesPage } from '@/components/marketing/FeaturesPage'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { PAGE_META } from '@/lib/marketing/content'

export const metadata: Metadata = PAGE_META.features

export default function FeaturesRoute() {
  return (
    <MarketingShell>
      <FeaturesPage />
    </MarketingShell>
  )
}
