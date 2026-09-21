import type { Metadata } from 'next'
import { DownloadPage } from '@/components/marketing/DownloadPage'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { PAGE_META } from '@/lib/marketing/content'

export const metadata: Metadata = PAGE_META.download

export default function DownloadRoute() {
  return (
    <MarketingShell>
      <DownloadPage />
    </MarketingShell>
  )
}
