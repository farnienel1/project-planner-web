import type { Metadata } from 'next'
import { legalDocumentById } from '@/lib/legal/customerLegalPack'
import { LegalPage } from '@/components/marketing/LegalPage'
import { MarketingShell } from '@/components/marketing/MarketingShell'
import { PAGE_META } from '@/lib/marketing/content'

export const metadata: Metadata = PAGE_META.terms

export default function TermsRoute() {
  return (
    <MarketingShell>
      <LegalPage document={legalDocumentById('saas')} heading="Terms of Service" />
    </MarketingShell>
  )
}
