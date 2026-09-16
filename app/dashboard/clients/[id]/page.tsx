/**
 * iOS parity source: Views/ClientsView.swift ClientDetailsView
 * Spec: docs/ios-parity/sections/09-clients.md
 */

'use client'

import { useParams } from 'next/navigation'
import { ClientsScreen } from '@/components/clients/ClientsScreen'

export default function ClientDetailPage() {
  const params = useParams()
  return <ClientsScreen selectedId={String(params.id || '')} />
}
