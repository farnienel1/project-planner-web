'use client'

import type { ReactNode } from 'react'
import { SiteAuditAccess } from '@/components/site-audit/SiteAuditAccess'

export default function SiteAuditLayout({ children }: { children: ReactNode }) {
  return <SiteAuditAccess>{children}</SiteAuditAccess>
}
