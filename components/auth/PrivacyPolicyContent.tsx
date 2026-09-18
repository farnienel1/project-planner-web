'use client'

import { LEGAL_ENTITY, legalDocumentById } from '@/lib/legal/customerLegalPack'
import { LegalDocumentBody } from '@/components/legal/ScrollAcceptDocument'

export function PrivacyPolicyContent() {
  const document = legalDocumentById('privacy')
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tight text-ios-ink lg:text-[32px]">
          {document.title}
        </h1>
        <p className="mt-2 text-sm text-ios-muted">
          {LEGAL_ENTITY.name} · Version {LEGAL_ENTITY.version} · Effective {LEGAL_ENTITY.effectiveDate}
        </p>
      </header>
      <LegalDocumentBody document={document} />
    </div>
  )
}
