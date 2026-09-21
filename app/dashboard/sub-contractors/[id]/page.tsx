/**
 * iOS parity source: Views/SubcontractorsView.swift SubcontractorFirmDetailView
 * Spec: docs/ios-parity/sections/08-sub-contractors.md
 */
'use client'

import { useParams } from 'next/navigation'
import { SubcontractorsScreen } from '@/components/subcontractors/SubcontractorsScreen'

export default function SubContractorDetailPage() {
  const params = useParams()
  return <SubcontractorsScreen selectedId={String(params.id || '')} />
}
