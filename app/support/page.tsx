import type { Metadata } from 'next'
import { SupportPage } from '@/components/marketing/SupportPage'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { PAGE_META } from '@/lib/marketing/content'

export const metadata: Metadata = PAGE_META.support

export default function SupportRoute() {
  return (
    <MarketingShell>
      <SupportPage />
    </MarketingShell>
  )
}
