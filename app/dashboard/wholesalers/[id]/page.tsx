/**
 * iOS parity source: Views/WholesalersRevampViews.swift WholesalerDetailView
 * Spec: docs/ios-parity/sections/06-wholesalers.md
 */
'use client'

import { useParams } from 'next/navigation'
import { WholesalersScreen } from '@/components/wholesalers/WholesalersScreen'

export default function WholesalerDetailPage() {
  const params = useParams()
  return <WholesalersScreen selectedId={String(params.id || '')} />
}
