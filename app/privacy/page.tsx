import type { Metadata } from 'next'
import { legalDocumentById } from '@/lib/legal/customerLegalPack'
import { LegalPage } from '@/components/marketing/LegalPage'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { PAGE_META } from '@/lib/marketing/content'

export const metadata: Metadata = PAGE_META.privacy

export default function PrivacyRoute() {
  return (
    <MarketingShell>
      <LegalPage document={legalDocumentById('privacy')} heading="Privacy Policy" />
    </MarketingShell>
  )
}
