'use client'

import { siteAuditFieldCounter, type SiteAuditLimitedField } from '@/lib/canonical'

/** The live "34 / 120" under a site audit field (rulebook 1.65.0 §29); red when the text is over the limit. */
export function SiteAuditFieldCounter({ field, value }: { field: SiteAuditLimitedField; value: string }) {
  const counter = siteAuditFieldCounter(field, value)
  return (
    <p className={`text-right text-[11px] ${counter.over ? 'font-semibold text-[var(--red)]' : 'text-[var(--ink3)]'}`} aria-live="polite">
      {counter.label}
    </p>
  )
}
