import type { Metadata } from 'next'
import { AboutPage } from '@/components/marketing/AboutPage'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { PAGE_META } from '@/lib/marketing/content'

export const metadata: Metadata = PAGE_META.about

export default function AboutRoute() {
  return (
    <MarketingShell>
      <AboutPage />
    </MarketingShell>
  )
}
