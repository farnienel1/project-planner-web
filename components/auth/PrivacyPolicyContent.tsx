'use client'

import { useMemo, useState } from 'react'
import {
  LEGAL_ENTITY,
  LEGAL_PACK_DOCUMENTS,
  type LegalDocumentId,
} from '@/lib/legal/customerLegalPack'
import { LegalDocumentBody } from '@/components/legal/ScrollAcceptDocument'

export function PrivacyPolicyContent() {
  const [active, setActive] = useState<LegalDocumentId>('privacy')
  const document = useMemo(() => LEGAL_PACK_DOCUMENTS.find((row) => row.id === active)!, [active])

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-8">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--ink)] lg:text-[32px]">Legal policies</h1>
        <p className="mt-2 text-sm text-[var(--ink3)]">
          {LEGAL_ENTITY.name} · Version {LEGAL_ENTITY.version} · Effective {LEGAL_ENTITY.effectiveDate}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-700">
          These are the same documents accepted at first sign-up: the SaaS Agreement, Data Processing Agreement,
          Acceptable Use Policy, and Privacy Policy. They apply to every organisation using ProjectPlanner.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {LEGAL_PACK_DOCUMENTS.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setActive(row.id)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold ${
              active === row.id ? 'bg-[var(--blue)] text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {row.title}
          </button>
        ))}
      </div>

      <article className="rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.10)] sm:p-8">
        <h2 className="text-[22px] font-semibold">{document.title}</h2>
        <LegalDocumentBody document={document} />
      </article>

      <p className="text-[13px] text-[var(--ink3)]">
        Questions: {LEGAL_ENTITY.privacyEmail}. Registered office: {LEGAL_ENTITY.registeredOffice}.
      </p>
    </div>
  )
}
